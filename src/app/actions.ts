
'use server';

import { revalidatePath } from 'next/cache';
import { addPatient, findPatientById, getPatients, updateAllPatients, updatePatient, updateDoctorStatus, getDoctorStatus, updateDoctorSchedule, updateSpecialClosures, getDoctorSchedule, getFamilyByPhone, addFamilyMember, updateTodayScheduleOverride, getFamily, searchFamilyMembers, updateFamilyMember, cancelAppointment } from '@/lib/data';
import type { AIPatientData, DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember } from '@/lib/types';
import { estimateConsultationTime } from '@/ai/flows/estimate-consultation-time';
import { sendAppointmentReminders } from '@/ai/flows/send-appointment-reminders';

export async function addWalkInPatientAction(formData: FormData) {
  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;

  if (!name || !phone) {
    return { error: 'Name and phone are required' };
  }

  await addPatient({
    name,
    phone,
    type: 'Walk-in',
    appointmentTime: new Date().toISOString(),
    checkInTime: new Date().toISOString(),
    status: 'Waiting',
  });

  revalidatePath('/');
  return { success: 'Walk-in patient added successfully.' };
}

export async function addAppointmentAction(familyMember: FamilyMember, date: string, time: string) {

  // Manually parse date to avoid timezone issues. date is in YYYY-MM-DD format.
  const [year, month, day] = date.split('-').map(Number);

  const [hours, minutesPart] = time.split(':');
  const minutes = minutesPart.split(' ')[0];
  const ampm = minutesPart.split(' ')[1];

  let hourNumber = parseInt(hours, 10);
  if (ampm.toLowerCase() === 'pm' && hourNumber < 12) {
    hourNumber += 12;
  }
  if (ampm.toLowerCase() === 'am' && hourNumber === 12) {
    hourNumber = 0; // Midnight case
  }
  
  // Construct date in server's local timezone then convert to ISO string.
  const appointmentDateTime = new Date(year, month - 1, day, hourNumber, parseInt(minutes, 10));
  
  console.log(`Booking for ${date} ${time} -> created ISO string: ${appointmentDateTime.toISOString()}`);


  await addPatient({
    name: familyMember.name,
    phone: familyMember.phone,
    type: 'Appointment',
    appointmentTime: appointmentDateTime.toISOString(),
    checkInTime: appointmentDateTime.toISOString(), // For appointments, check-in is appointment time until they arrive
    status: 'Confirmed', // A new status for appointments that are booked but not yet checked in
  });

  revalidatePath('/booking');
  revalidatePath('/');
  
  return { success: 'Appointment booked successfully.' };
}


export async function updatePatientStatusAction(patientId: number, status: Patient['status']) {
  const patients = await getPatients();
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
    const patients = await getPatients();
    const waitingPatients = patients.filter(p => p.status === 'Waiting');

    for (const patient of waitingPatients) {
      const estimation = await estimateConsultationTime({
        ...aiPatientData,
        currentQueueLength: waitingPatients.indexOf(patient) + 1,
        appointmentType: patient.type === 'Appointment' ? 'Routine Checkup' : 'Walk-in Inquiry',
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
  let patients = await getPatients();
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
  const currentStatus = await getDoctorStatus();
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

export async function updateDoctorScheduleAction(schedule: Omit<DoctorSchedule, 'specialClosures'>) {
    try {
        const currentSchedule = await getDoctorSchedule();
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
        await updateTodayScheduleOverride(override);
        revalidatePath('/');
        revalidatePath('/booking');
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

export async function rescheduleAppointmentAction(appointmentId: number, newDate: string, newTime: string) {
    // Manually parse date to avoid timezone issues. newDate is in YYYY-MM-DD format.
    const [year, month, day] = newDate.split('-').map(Number);
    
    const [hours, minutesPart] = newTime.split(':');
    const minutes = minutesPart.split(' ')[0];
    const ampm = minutesPart.split(' ')[1];

    let hourNumber = parseInt(hours, 10);
    if (ampm.toLowerCase() === 'pm' && hourNumber < 12) {
        hourNumber += 12;
    }
    if (ampm.toLowerCase() === 'am' && hourNumber === 12) {
        hourNumber = 0;
    }

    const appointmentTime = new Date(year, month - 1, day, hourNumber, parseInt(minutes, 10));

    const result = await updatePatient(appointmentId, {
        appointmentTime: appointmentTime.toISOString(),
        status: 'Confirmed'
    });

    revalidatePath('/booking');
    revalidatePath('/');
    return { success: 'Appointment rescheduled.', patient: result };
}


// Re-exporting for use in the new dashboard
export { estimateConsultationTime };
export { getFamily, getPatients, addPatient, getDoctorSchedule };

    