

'use server';

import { revalidatePath } from 'next/cache';
import { addPatient as addPatientData, findPatientById, getPatients as getPatientsData, updateAllPatients, updatePatient, getDoctorStatus as getDoctorStatusData, updateDoctorStatus, getDoctorSchedule as getDoctorScheduleData, updateDoctorSchedule, updateSpecialClosures, getFamilyByPhone, addFamilyMember, getFamily, searchFamilyMembers, updateFamilyMember, cancelAppointment, updateVisitPurposes as updateVisitPurposesData, updateTodayScheduleOverride as updateTodayScheduleOverrideData } from '@/lib/data';
import type { AIPatientData, DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember, VisitPurpose, Session } from '@/lib/types';
import { estimateConsultationTime } from '@/ai/flows/estimate-consultation-time';
import { sendAppointmentReminders } from '@/ai/flows/send-appointment-reminders';
import { format, parseISO, parse } from 'date-fns';
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
    // We now explicitly use toZonedTime on the combination of date string and time string to get a correct IST Date object.
    const startDateTime = toZonedTime(`${dateStr}T${session.start}:00`, timeZone);
    const endDateTime = toZonedTime(`${dateStr}T${session.end}:00`, timeZone);
    
    // The incoming `date` is a UTC Date object. It must be compared against the IST boundaries.
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
    console.error('Error sending reminder:', error);
    return { error: 'An unexpected error occurred while sending the reminder.' };
  }
}

export async function getPatientsAction() {
    return getPatientsData();
}

export async function getDoctorScheduleAction() {
    return getDoctorScheduleData();
}

export async function getDoctorStatusAction() {
    return getDoctorStatusData();
}

export async function toggleDoctorStatusAction() {
    const currentStatus = await getDoctorStatusData();
    const newStatus = {
        isOnline: !currentStatus.isOnline,
        onlineTime: !currentStatus.isOnline ? new Date().toISOString() : undefined,
    };
    await updateDoctorStatus(newStatus);
    revalidatePath('/');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    return { success: `Doctor is now ${newStatus.isOnline ? 'Online' : 'Offline'}.` };
}

export async function emergencyCancelAction() {
    const patients = await getPatientsData();
    const activePatients = patients.filter(p => ['Waiting', 'Confirmed', 'In-Consultation'].includes(p.status));

    for (const patient of activePatients) {
        await updatePatient(patient.id, { status: 'Cancelled' });
        // In a real app, you would also trigger notifications here.
    }
    
    // Also set doctor to offline
    await updateDoctorStatus({ isOnline: false });

    revalidatePath('/');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    
    return { success: `Emergency declared. All ${activePatients.length} active appointments have been cancelled.` };
}

export async function addPatientAction(patientData: Omit<Patient, 'id' | 'estimatedWaitTime'>) {
    const schedule = await getDoctorScheduleData();
    const newAppointmentDate = new Date(patientData.appointmentTime);
    const newAppointmentSession = getSessionForTime(schedule, newAppointmentDate);

    if (!newAppointmentSession) {
        return { error: "The selected time is outside of clinic hours." };
    }
    
    const newPatient = await addPatientData(patientData);
    revalidatePath('/');
    return { patient: newPatient, success: "Patient added successfully" };
}


export async function addNewPatientAction(familyMemberData: Omit<FamilyMember, 'id'|'avatar'>) {
    const newMember = await addFamilyMember(familyMemberData);
    revalidatePath('/booking');
    revalidatePath('/');
    return { patient: newMember, success: "Family member added successfully." };
}

export async function getFamilyByPhoneAction(phone: string) {
    return getFamilyByPhone(phone);
}

export async function searchFamilyMembersAction(searchTerm: string) {
    return searchFamilyMembers(searchTerm);
}

export async function checkInPatientAction(patientId: number) {
  const patient = await findPatientById(patientId);
  if (!patient) {
    return { error: 'Patient not found' };
  }
  await updatePatient(patient.id, { status: 'Waiting', checkInTime: new Date().toISOString() });
  revalidatePath('/');
  return { success: `${patient.name} has been checked in.` };
}

export async function updateTodayScheduleOverrideAction(override: SpecialClosure) {
    await updateTodayScheduleOverrideData(override);
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/booking');
    return { success: "Today's schedule has been updated." };
}

export async function updatePatientPurposeAction(patientId: number, purpose: string) {
    await updatePatient(patientId, { purpose });
    revalidatePath('/');
    return { success: 'Visit purpose updated.' };
}

export async function updateDoctorScheduleAction(schedule: Omit<DoctorSchedule, 'specialClosures' | 'visitPurposes'>) {
    await updateDoctorSchedule(schedule);
    revalidatePath('/admin');
    revalidatePath('/');
    return { success: 'Doctor schedule updated successfully.' };
}

export async function updateSpecialClosuresAction(closures: SpecialClosure[]) {
    await updateSpecialClosures(closures);
    revalidatePath('/admin');
    revalidatePath('/');
    return { success: 'Special closures updated successfully.' };
}

export async function updateVisitPurposesAction(purposes: VisitPurpose[]) {
    await updateVisitPurposesData(purposes);
    revalidatePath('/admin');
    return { success: 'Visit purposes updated successfully.' };
}

export async function updateFamilyMemberAction(member: FamilyMember) {
    await updateFamilyMember(member);
    revalidatePath('/booking');
    return { success: 'Family member updated.' };
}

export async function cancelAppointmentAction(appointmentId: number) {
    const patient = await cancelAppointment(appointmentId);
    if (patient) {
        revalidatePath('/booking');
        revalidatePath('/');
        return { success: 'Appointment cancelled.' };
    }
    return { error: 'Could not find appointment to cancel.' };
}

export async function rescheduleAppointmentAction(appointmentId: number, newAppointmentTime: string, newPurpose: string) {
    const patient = await findPatientById(appointmentId);
    if (!patient) {
        return { error: 'Patient not found' };
    }

    const schedule = await getDoctorScheduleData();
    const newDate = new Date(newAppointmentTime);
    const session = getSessionForTime(schedule, newDate);

    if (!session) {
        return { error: 'The selected time is outside of clinic hours.' };
    }

    await updatePatient(appointmentId, { 
        appointmentTime: newAppointmentTime, 
        purpose: newPurpose,
        status: 'Confirmed'
    });

    revalidatePath('/booking');
    revalidatePath('/');

    return { success: 'Appointment rescheduled successfully.' };
}
