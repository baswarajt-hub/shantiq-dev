
'use server';

import { revalidatePath } from 'next/cache';
import { addPatient, findPatientById, getPatients, updateAllPatients, updatePatient, updateDoctorStatus, getDoctorStatus, updateDoctorSchedule, updateSpecialClosures, getDoctorSchedule, getFamilyByPhone, addFamilyMember, updateTodayScheduleOverride, getFamily } from '@/lib/data';
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

export async function addAppointmentAction(formData: FormData) {
  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;
  const appointmentTime = formData.get('appointmentTime') as string;
  
  if (!name || !phone || !appointmentTime) {
    return { error: 'Name, phone, and appointment time are required' };
  }

  const appointmentDateTime = new Date();
  const [hours, minutes] = appointmentTime.split(':');
  appointmentDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

  await addPatient({
    name,
    phone,
    type: 'Appointment',
    appointmentTime: appointmentDateTime.toISOString(),
    checkInTime: new Date().toISOString(),
    status: 'Waiting',
  });

  revalidatePath('/');
  revalidatePath('/appointment');
  revalidatePath('/queue-status');
  
  return { success: 'Appointment booked successfully.' };
}


export async function updatePatientStatusAction(patientId: number, status: Patient['status']) {
  const patient = await findPatientById(patientId);
  if (!patient) {
    return { error: 'Patient not found' };
  }

  // Auto-reschedule late comers
  if (status === 'Late') {
    let patients = await getPatients();
    const latePatient = patients.find(p => p.id === patientId);
    if (latePatient) {
      patients = patients.filter(p => p.id !== patientId);
      patients.push({ ...latePatient, status: 'Late' });
      await updateAllPatients(patients);
    }
  } else {
    await updatePatient(patientId, { status });
  }

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
        return { success: 'Schedule updated successfully.' };
    } catch (error) {
        return { error: 'Failed to update schedule.' };
    }
}

export async function updateSpecialClosuresAction(closures: SpecialClosure[]) {
    try {
        await updateSpecialClosures(closures);
        revalidatePath('/admin');
        return { success: 'Special closures updated successfully.' };
    } catch (error) {
        return { error: 'Failed to update special closures.' };
    }
}

export async function getFamilyByPhoneAction(phone: string): Promise<FamilyMember[]> {
    return await getFamilyByPhone(phone);
}

export async function addNewPatientAction(patientData: Omit<FamilyMember, 'id' | 'avatar'>): Promise<{ success: string; patient: FamilyMember }> {
    const newPatient = await addFamilyMember(patientData);
    revalidatePath('/');
    return { success: 'New patient added successfully.', patient: newPatient };
}

export async function updateTodayScheduleOverrideAction(override: SpecialClosure) {
    try {
        await updateTodayScheduleOverride(override);
        revalidatePath('/');
        return { success: 'Today\'s schedule has been adjusted.' };
    } catch (error) {
        return { error: 'Failed to adjust schedule.' };
    }
}

// Re-exporting for use in the new dashboard
export { estimateConsultationTime };
export { getFamily, getPatients, addPatient };
    
