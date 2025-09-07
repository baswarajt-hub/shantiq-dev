

'use server';

import { revalidatePath } from 'next/cache';
import { addPatient as addPatientData, findPatientById, getPatients as getPatientsData, updateAllPatients, updatePatient, getDoctorStatus as getDoctorStatusData, updateDoctorStatus, getDoctorSchedule as getDoctorScheduleData, updateDoctorSchedule, updateSpecialClosures, getFamilyByPhone, addFamilyMember, getFamily, searchFamilyMembers, updateFamilyMember, cancelAppointment, updateVisitPurposes as updateVisitPurposesData, updateTodayScheduleOverride as updateTodayScheduleOverrideData } from '@/lib/data';
import type { AIPatientData, DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember, VisitPurpose, Session } from '@/lib/types';
import { estimateConsultationTime } from '@/ai/flows/estimate-consultation-time';
import { sendAppointmentReminders } from '@/ai/flows/send-appointment-reminders';
import { format, parseISO } from 'date-fns';
import { toZonedTime, format as formatTz } from 'date-fns-tz';


const getSessionForTime = (schedule: DoctorSchedule, date: Date): 'morning' | 'evening' | null => {
  const timeZone = "Asia/Kolkata";
  
  const zonedDate = toZonedTime(date, timeZone);
  const dayOfWeek = formatTz(zonedDate, 'EEEE', { timeZone }) as keyof DoctorSchedule['days'];
  const dateStr = formatTz(zonedDate, 'yyyy-MM-dd', { timeZone });

  let daySchedule = schedule.days[dayOfWeek];

  // apply overrides if any
  const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);
  if (todayOverride) {
    daySchedule = {
      morning: todayOverride.morningOverride ?? daySchedule.morning,
      evening: todayOverride.eveningOverride ?? daySchedule.evening,
    };
  }

  const checkSession = (session: Session) => {
    if (!session.isOpen) return false;
    
    // Create Date objects from the schedule times, anchored to the appointment's date, in the clinic's timezone.
    const startDateTime = toZonedTime(`${dateStr}T${session.start}:00`, timeZone);
    const endDateTime = toZonedTime(`${dateStr}T${session.end}:00`, timeZone);
    
    // The incoming `date` is already a valid Date object (from UTC ISO string).
    // We can compare it directly.
    return date >= startDateTime && date < endDateTime;
  };

  if (checkSession(daySchedule.morning)) return 'morning';
  if (checkSession(daySchedule.evening)) return 'evening';
  return null;
};


export async function addAppointmentAction(familyMember: FamilyMember, appointmentTime: string, purpose: string) {

  const allPatients = await getPatientsData();
  const schedule = await getDoctorScheduleData();
  const newAppointmentDate = new Date(appointmentTime);
  const newAppointmentSession = getSessionForTime(schedule, newAppointmentDate);
  
  if (!newAppointmentSession) {
      return { error: "The selected time is outside of clinic hours." };
  }

  const existingAppointment = allPatients.find(p => {
    const isSamePatient = p.name === familyMember.name && p.phone === familyMember.phone;
    if (!isSamePatient) return false;
    
    const existingDate = new Date(p.appointmentTime);

    const timeZone = "Asia/Kolkata";
    const existingDay = format(toZonedTime(existingDate, timeZone), "yyyy-MM-dd");
    const newDay = format(toZonedTime(newAppointmentDate, timeZone), "yyyy-MM-dd");

    if (existingDay !== newDay) return false;
    
    const existingSession = getSessionForTime(schedule, existingDate);
    const isSameSession = existingSession === newAppointmentSession;

    const isActive = ['Confirmed', 'Waiting', 'In-Consultation', 'Late'].includes(p.status);
    return isSamePatient && isSameSession && isActive;
  });

  if (existingAppointment) {
    return { error: `This patient already has an appointment scheduled for this day and session.` };
  }

  await addPatientData({
    name: familyMember.name,
    phone: familyMember.phone,
    type: 'Appointment',
    appointmentTime: appointmentTime,
    status: 'Confirmed',
    purpose: purpose,
  });
  
  revalidatePath('/booking');
  revalidatePath('/');
  
  return { success: 'Appointment booked successfully.' };
}


export async function updatePatientStatusAction(patientId: number, status: Patient['status']) {
  const patients = await getPatientsData();
  const patient = patients.find(p => p.id === patientId);

  if (!patient) {
    return { error: 'Patient not found' };
  }

  let updates: Partial<Patient> = { status };

  if (status === 'In-Consultation') {
    // If we are starting a new consultation, find and complete any existing one.
    const currentlyServing = patients.find(p => p.status === 'In-Consultation');
    if (currentlyServing && currentlyServing.id !== patientId) {
      const startTime = new Date(currentlyServing.consultationStartTime!);
      const endTime = new Date();
      const completedUpdates: Partial<Patient> = {
        status: 'Completed',
        consultationEndTime: endTime.toISOString(),
        consultationTime: Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)), // in minutes
      };
      await updatePatient(currentlyServing.id, completedUpdates);
    }
    
    // Now, set the new patient to "In-Consultation"
    updates.consultationStartTime = new Date().toISOString();

  } else if (status === 'Completed' && patient.consultationStartTime) {
    const startTime = new Date(patient.consultationStartTime);
    const endTime = new Date();
    updates.consultationEndTime = endTime.toISOString();
    updates.consultationTime = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // in minutes
  }

  await updatePatient(patientId, updates);

  revalidatePath('/');
  revalidatePath('/tv-display');
  revalidatePath('/queue-status');
  
  return { success: `Patient status updated to ${status}` };
}

export async function runTimeEstimationAction(aiPatientData: AIPatientData) {
  try {
    const patients = await getPatientsData();
    const waitingPatients = patients.filter(p => p.status === 'Waiting');

    for (const patient of waitingPatients) {
      const estimation = await estimateConsultationTime({
        ...aiPatientData,
        currentQueueLength: waitingPatients.indexOf(patient) + 1,
        appointmentType: patient.type === 'Appointment' ? 'Routine Checkup' : 'Walk-in Inquiry',
        visitPurpose: patient.purpose
      });
      
      await updatePatient(patient.id, { estimatedWaitTime: estimation.estimatedConsultationTime });
    }

    revalidatePath('/');
    return { success: 'Wait times have been re-estimated.' };
  } catch (error) {
    console.error(error);
    return { error: 'Failed to run time estimation.' };
  }
}

export async function sendReminderAction(patientId: number) {
  const patient = await findPatientById(patientId);
  if (!patient) {
    return { error: 'Patient not found' };
  }

  try {
    const result = await sendAppointmentReminders({
      patientName: patient.name,
      phoneNumber: patient.phone,
      appointmentTime: new Date(patient.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      estimatedWaitTime: `${patient.estimatedWaitTime} minutes`,
      clinicName: 'QueueWise Clinic',
    });

    if (result.messageSent) {
      return { success: 'Reminder sent successfully.' };
    } else {
      return { error: 'Failed to send reminder.' };
    }
  } catch (error) {
    console.error(error);
    return { error: 'An error occurred while sending the reminder.' };
  }
}

export async function emergencyCancelAction() {
  let patients = await getPatientsData();
  patients = patients.map(p => 
    p.status === 'Waiting' || p.status === 'In-Consultation' || p.status === 'Late'
      ? { ...p, status: 'Cancelled' } 
      : p
  );
  await updateAllPatients(patients);
  // Here you would add logic to notify all patients.
  revalidatePath('/');
  revalidatePath('/tv-display');
  revalidatePath('/queue-status');
  return { success: 'All appointments have been cancelled due to an emergency.' };
}

export async function toggleDoctorStatusAction() {
  const currentStatus = await getDoctorStatusData();
  const newStatus: DoctorStatus = {
    isOnline: !currentStatus.isOnline,
    onlineTime: !currentStatus.isOnline ? new Date().toISOString() : undefined,
  };
  await updateDoctorStatus(newStatus);

  revalidatePath('/');
  revalidatePath('/tv-display');
  revalidatePath('/queue-status');

  return { success: `Doctor is now ${newStatus.isOnline ? 'online' : 'offline'}.` };
}

export async function updateDoctorScheduleAction(schedule: Omit<DoctorSchedule, 'specialClosures' | 'visitPurposes'>) {
    try {
        const currentSchedule = await getDoctorScheduleData();
        const newSchedule = { ...currentSchedule, ...schedule };
        await updateDoctorSchedule(newSchedule);
        revalidatePath('/admin');
        revalidatePath('/booking');
        revalidatePath('/');
        return { success: 'Schedule updated successfully.' };
    } catch (error) {
        return { error: 'Failed to update schedule.' };
    }
}

export async function updateSpecialClosuresAction(closures: SpecialClosure[]) {
    try {
        await updateSpecialClosures(closures);
        revalidatePath('/admin');
        revalidatePath('/booking');
        revalidatePath('/');
        return { success: 'Special closures updated successfully.' };
    } catch (error) {
        return { error: 'Failed to update special closures.' };
    }
}

export async function updateVisitPurposesAction(purposes: VisitPurpose[]) {
    try {
        await updateVisitPurposesData(purposes);
        revalidatePath('/admin');
        revalidatePath('/booking');
        revalidatePath('/');
        return { success: 'Visit purposes updated successfully.' };
    } catch (error) {
        return { error: 'Failed to update visit purposes.' };
    }
}

export async function getFamilyByPhoneAction(phone: string): Promise<FamilyMember[]> {
    return await getFamilyByPhone(phone);
}

export async function searchFamilyMembersAction(searchTerm: string): Promise<FamilyMember[]> {
    return await searchFamilyMembers(searchTerm);
}

export async function addNewPatientAction(patientData: Omit<FamilyMember, 'id' | 'avatar'>): Promise<{ success: string; patient: FamilyMember }> {
    const newPatient = await addFamilyMember(patientData);
    revalidatePath('/');
    revalidatePath('/booking');
    return { success: 'New patient added successfully.', patient: newPatient };
}

export async function updateFamilyMemberAction(member: FamilyMember) {
    const updatedMember = await updateFamilyMember(member);
    revalidatePath('/booking');
    return { success: 'Family member updated.', patient: updatedMember };
}

export async function updateTodayScheduleOverrideAction(override: SpecialClosure) {
    try {
        await updateTodayScheduleOverrideData(override);
        revalidatePath('/');
        revalidatePath('/booking');
        revalidatePath('/admin');
        return { success: 'Today\'s schedule has been adjusted.' };
    } catch (error) {
        return { error: 'Failed to adjust schedule.' };
    }
}

export async function cancelAppointmentAction(appointmentId: number) {
    const result = await cancelAppointment(appointmentId);
    revalidatePath('/booking');
    revalidatePath('/');
    return { success: 'Appointment cancelled', patient: result };
}

export async function rescheduleAppointmentAction(appointmentId: number, appointmentTime: string, purpose: string) {
    
    const result = await updatePatient(appointmentId, {
        appointmentTime: appointmentTime,
        status: 'Confirmed',
        purpose: purpose,
    });

    revalidatePath('/booking');
    revalidatePath('/');
    return { success: 'Appointment rescheduled.', patient: result };
}

export async function checkInPatientAction(patientId: number) {
  const patient = await findPatientById(patientId);

  if (!patient) {
    return { error: 'Patient not found' };
  }

  await updatePatient(patientId, {
    status: 'Waiting',
    checkInTime: new Date().toISOString(),
  });
  
  revalidatePath('/');
  return { success: `${patient.name} has been checked in.` };
}

export async function addPatientAction(patient: Omit<Patient, 'id' | 'estimatedWaitTime'>) {
  const allPatients = await getPatientsData();
  const schedule = await getDoctorScheduleData();
  const newAppointmentDate = new Date(patient.appointmentTime);
  const newAppointmentSession = getSessionForTime(schedule, newAppointmentDate);
  
  if (!newAppointmentSession) {
      return { error: "The selected time is outside of clinic hours." };
  }

  const existingAppointment = allPatients.find(p => {
    const isSamePatient = p.name === patient.name && p.phone === patient.phone;
    if (!isSamePatient) return false;
    
    const existingDate = new Date(p.appointmentTime);
    
    const timeZone = "Asia/Kolkata";
    const existingDay = format(toZonedTime(existingDate, timeZone), "yyyy-MM-dd");
    const newDay = format(toZonedTime(newAppointmentDate, timeZone), "yyyy-MM-dd");

    if (existingDay !== newDay) return false;

    const existingSession = getSessionForTime(schedule, existingDate);
    const isSameSession = existingSession === newAppointmentSession;

    const isActive = ['Confirmed', 'Waiting', 'In-Consultation', 'Late'].includes(p.status);
    return isSamePatient && isSameSession && isActive;
  });

  if (existingAppointment) {
    return { error: `This patient already has an appointment scheduled for this day and session.` };
  }

  const newPatient = await addPatientData(patient);
  revalidatePath('/');
  return { success: 'Patient added successfully.', patient: newPatient };
}

export async function updatePatientPurposeAction(patientId: number, purpose: string) {
    await updatePatient(patientId, { purpose });
    revalidatePath('/');
    return { success: 'Visit purpose updated.' };
}


// Re-exporting for use in the new dashboard
export { estimateConsultationTime };
export { getFamily, addFamilyMember, getDoctorScheduleData as getDoctorSchedule };

// Actions for live data fetching
export async function getPatientsAction() {
    return getPatientsData();
}

export async function getDoctorStatusAction() {
    return getDoctorStatusData();
}

    