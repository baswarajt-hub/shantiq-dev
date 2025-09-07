

'use server';

import { revalidatePath } from 'next/cache';
import { addPatient as addPatientData, findPatientById, getPatients as getPatientsData, updateAllPatients, updatePatient, getDoctorStatus as getDoctorStatusData, updateDoctorStatus, getDoctorSchedule as getDoctorScheduleData, updateDoctorSchedule, updateSpecialClosures, getFamilyByPhone, addFamilyMember, getFamily, searchFamilyMembers, updateFamilyMember, cancelAppointment, updateVisitPurposesData, updateTodayScheduleOverrideData } from '@/lib/data';
import type { AIPatientData, DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember, VisitPurpose, Session } from '@/lib/types';
import { estimateConsultationTime } from '@/ai/flows/estimate-consultation-time';
import { sendAppointmentReminders } from '@/ai/flows/send-appointment-reminders';
import { format, parseISO, parse, differenceInMinutes, startOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';


const timeZone = "Asia/Kolkata";

/**
 * Helper: convert a session time string ("HH:mm" or "h:mm a") anchored to dateStr (yyyy-MM-dd)
 * into a UTC Date (the instant when that local time occurs).
 */
function sessionLocalToUtc(dateStr: string, sessionTime: string) {
  // Try 24-hour format first
  let localDate: Date;
  if (/^\d{1,2}:\d{2}$/.test(sessionTime)) {
    // "HH:mm" (24-hour)
    localDate = parse(`${dateStr} ${sessionTime}`, 'yyyy-MM-dd HH:mm', new Date());
  } else {
    // attempt 12-hour with AM/PM: "h:mm a" or "hh:mm a"
    localDate = parse(`${dateStr} ${sessionTime}`, 'yyyy-MM-dd hh:mm a', new Date());
  }
  // fromZonedTime will give us the UTC Date object corresponding to that wall-clock time in the specified zone.
  return fromZonedTime(localDate, timeZone);
}

/** Returns 'morning' | 'evening' or null */
const getSessionForTime = (schedule: DoctorSchedule, appointmentUtcDate: Date): 'morning' | 'evening' | null => {
  // Convert appointment instant to clinic local date to decide which day's schedule to use
  const zonedAppt = toZonedTime(appointmentUtcDate, timeZone);
  const dayOfWeek = format(zonedAppt, 'EEEE') as keyof DoctorSchedule['days'];
  const dateStr = format(zonedAppt, 'yyyy-MM-dd');

  let daySchedule = schedule.days[dayOfWeek];
  const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);
  if (todayOverride) {
    daySchedule = {
      morning: todayOverride.morningOverride ?? daySchedule.morning,
      evening: todayOverride.eveningOverride ?? daySchedule.evening,
    };
  }

  const checkSession = (session: Session) => {
    if (!session.isOpen) return false;

    // Build UTC instants for start and end of the session (so we compare epochs)
    const startUtc = sessionLocalToUtc(dateStr, session.start);
    const endUtc = sessionLocalToUtc(dateStr, session.end);

    const apptMs = appointmentUtcDate.getTime();
    return apptMs >= startUtc.getTime() && apptMs < endUtc.getTime();
  };

  if (checkSession(daySchedule.morning)) return 'morning';
  if (checkSession(daySchedule.evening)) return 'evening';
  return null;
};



export async function addAppointmentAction(familyMember: FamilyMember, appointmentTime: string, purpose: string, isWalkIn: boolean = false) {

  const allPatients = await getPatientsData();
  const schedule = await getDoctorScheduleData();
  const newAppointmentDate = parseISO(appointmentTime);
  const dateStr = format(toZonedTime(newAppointmentDate, timeZone), "yyyy-MM-dd");

  const newAppointmentSession = getSessionForTime(schedule, newAppointmentDate);
  
  if (!newAppointmentSession) {
      return { error: "The selected time is outside of clinic hours." };
  }

  const existingAppointment = allPatients.find(p => {
    const isSamePatient = p.name === familyMember.name && p.phone === familyMember.phone;
    if (!isSamePatient) return false;
    
    const existingDate = parseISO(p.appointmentTime);
    const newDay = format(toZonedTime(newAppointmentDate, timeZone), "yyyy-MM-dd");
    const existingDay = format(toZonedTime(existingDate, timeZone), "yyyy-MM-dd");

    if (existingDay !== newDay) return false;
    
    const existingSession = getSessionForTime(schedule, existingDate);
    const isSameSession = existingSession === newAppointmentSession;

    const isActive = ['Booked', 'Confirmed', 'Waiting', 'In-Consultation', 'Late'].includes(p.status);
    return isSameSession && isActive;
  });

  if (existingAppointment) {
    return { error: `This patient already has an appointment scheduled for this day and session.` };
  }

  // --- Static Token Number Calculation ---
  const dayOfWeek = format(toZonedTime(newAppointmentDate, timeZone), 'EEEE') as keyof DoctorSchedule['days'];
  let daySchedule = schedule.days[dayOfWeek];
  const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);
  if (todayOverride) {
    daySchedule = {
      morning: todayOverride.morningOverride ?? daySchedule.morning,
      evening: todayOverride.eveningOverride ?? daySchedule.evening,
    };
  }

  const morningStart = sessionLocalToUtc(dateStr, daySchedule.morning.start);
  const morningEnd = sessionLocalToUtc(dateStr, daySchedule.morning.end);
  const eveningStart = sessionLocalToUtc(dateStr, daySchedule.evening.start);

  const totalMorningSlots = daySchedule.morning.isOpen ? differenceInMinutes(morningEnd, morningStart) / schedule.slotDuration : 0;
  
  let tokenNo = 0;
  if (newAppointmentSession === 'morning') {
    const minutesFromStart = differenceInMinutes(newAppointmentDate, morningStart);
    tokenNo = Math.floor(minutesFromStart / schedule.slotDuration) + 1;
  } else { // evening
    const minutesFromStart = differenceInMinutes(newAppointmentDate, eveningStart);
    tokenNo = totalMorningSlots + Math.floor(minutesFromStart / schedule.slotDuration) + 1;
  }
  // --- End Calculation ---


  const newPatient = await addPatientData({
    name: familyMember.name,
    phone: familyMember.phone,
    type: isWalkIn ? 'Walk-in' : 'Appointment',
    appointmentTime: appointmentTime,
    status: isWalkIn ? 'Waiting' : 'Booked',
    purpose: purpose,
    tokenNo: tokenNo
  });
  
  revalidatePath('/booking');
  revalidatePath('/');
  revalidatePath('/queue-status');
  revalidatePath('/tv-display');
  
  return { success: 'Appointment booked successfully.', patient: newPatient };
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
  await recalculateQueueWithETC();

  revalidatePath('/');
  revalidatePath('/tv-display');
  revalidatePath('/queue-status');
  revalidatePath('/booking');
  
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

export async function toggleDoctorStatusAction(isOnline: boolean, startDelayMinutes: number = 0) {
    const newStatus = {
        isOnline: isOnline,
        onlineTime: isOnline ? new Date().toISOString() : undefined,
        startDelay: startDelayMinutes
    };
    await updateDoctorStatus(newStatus);
    await recalculateQueueWithETC();
    revalidatePath('/');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    return { success: `Doctor is now ${newStatus.isOnline ? 'Online' : 'Offline'}.` };
}

export async function updateDoctorStartDelayAction(startDelayMinutes: number) {
    await updateDoctorStatus({ startDelay: startDelayMinutes });
    await recalculateQueueWithETC();
    revalidatePath('/');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    return { success: `Doctor delay updated to ${startDelayMinutes} minutes.` };
}

export async function emergencyCancelAction() {
    const patients = await getPatientsData();
    const activePatients = patients.filter(p => ['Waiting', 'Confirmed', 'Booked', 'In-Consultation'].includes(p.status));

    for (const patient of activePatients) {
        await updatePatient(patient.id, { status: 'Cancelled' });
        // In a real app, you would also trigger notifications here.
    }
    
    // Also set doctor to offline
    await updateDoctorStatus({ isOnline: false, startDelay: 0 });

    revalidatePath('/');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    
    return { success: `Emergency declared. All ${activePatients.length} active appointments have been cancelled.` };
}

export async function addPatientAction(patientData: Omit<Patient, 'id' | 'estimatedWaitTime' | 'slotTime' | 'tokenNo'>) {
    const schedule = await getDoctorScheduleData();
    const allPatients = await getPatientsData();
    const newAppointmentDate = parseISO(patientData.appointmentTime);
    const dateStr = format(toZonedTime(newAppointmentDate, timeZone), "yyyy-MM-dd");

    const newAppointmentSession = getSessionForTime(schedule, newAppointmentDate);

    if (!newAppointmentSession) {
        return { error: "The selected time is outside of clinic hours." };
    }
    
    const existingAppointment = allPatients.find(p => {
        const isSamePatient = p.name === patientData.name && p.phone === patientData.phone;
        if (!isSamePatient) return false;
        
        const existingDate = parseISO(p.appointmentTime);
        const newDay = format(toZonedTime(newAppointmentDate, timeZone), "yyyy-MM-dd");
        const existingDay = format(toZonedTime(existingDate, timeZone), "yyyy-MM-dd");

        if (existingDay !== newDay) return false;
        
        const existingSession = getSessionForTime(schedule, existingDate);
        const isSameSession = existingSession === newAppointmentSession;

        const isActive = ['Booked', 'Confirmed', 'Waiting', 'In-Consultation', 'Late'].includes(p.status);
        return isSameSession && isActive;
    });

    if (existingAppointment) {
        return { error: `This patient already has an appointment scheduled for this day and session.` };
    }

    // --- Static Token Number Calculation ---
    const dayOfWeek = format(toZonedTime(newAppointmentDate, timeZone), 'EEEE') as keyof DoctorSchedule['days'];
    const daySchedule = schedule.days[dayOfWeek];

    const morningStart = sessionLocalToUtc(dateStr, daySchedule.morning.start);
    const morningEnd = sessionLocalToUtc(dateStr, daySchedule.morning.end);
    const eveningStart = sessionLocalToUtc(dateStr, daySchedule.evening.start);

    const totalMorningSlots = daySchedule.morning.isOpen ? differenceInMinutes(morningEnd, morningStart) / schedule.slotDuration : 0;
    
    let tokenNo = 0;
    if (newAppointmentSession === 'morning') {
        const minutesFromStart = differenceInMinutes(newAppointmentDate, morningStart);
        tokenNo = Math.floor(minutesFromStart / schedule.slotDuration) + 1;
    } else { // evening
        const minutesFromStart = differenceInMinutes(newAppointmentDate, eveningStart);
        tokenNo = totalMorningSlots + Math.floor(minutesFromStart / schedule.slotDuration) + 1;
    }
    // --- End Calculation ---
    
    const newPatient = await addPatientData({...patientData, tokenNo });
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
  await recalculateQueueWithETC();
  revalidatePath('/');
  revalidatePath('/booking');
  revalidatePath('/queue-status');
  revalidatePath('/tv-display');
  return { success: `${patient.name} has been checked in.` };
}

export async function recalculateQueueWithETC() {
    let patients = await getPatientsData();
    const schedule = await getDoctorScheduleData();
    const doctorStatus = await getDoctorStatusData();

    const todayStr = format(toZonedTime(new Date(), timeZone), 'yyyy-MM-dd');
    const todaysPatients = patients.filter(p => format(toZonedTime(parseISO(p.appointmentTime), timeZone), 'yyyy-MM-dd') === todayStr);


    if (todaysPatients.length === 0) return { success: "No patients for today." };

    // 1. Sort by token number to establish base order
    todaysPatients.sort((a, b) => a.tokenNo - b.tokenNo);

    // 2. Assign Worst-case ETC based on slot/token
    const firstAppointmentDate = parseISO(todaysPatients[0].appointmentTime);
    const dayOfWeek = format(toZonedTime(firstAppointmentDate, timeZone), 'EEEE') as keyof DoctorSchedule['days'];
    let daySchedule = schedule.days[dayOfWeek];

    const specialClosure = schedule.specialClosures.find(c => c.date === todayStr);
    if(specialClosure) {
        daySchedule = {
            morning: specialClosure.morningOverride ?? daySchedule.morning,
            evening: specialClosure.eveningOverride ?? daySchedule.evening
        }
    }
    
    const session = getSessionForTime(schedule, firstAppointmentDate);
    if (!session) return { error: "Cannot determine session." };

    const sessionTimes = daySchedule[session];
    const clinicStartTime = sessionLocalToUtc(todayStr, sessionTimes.start);

    todaysPatients.forEach(p => {
        p.worstCaseETC = new Date(
            clinicStartTime.getTime() + (p.tokenNo - 1) * schedule.slotDuration * 60000
        ).toISOString();
    });

    // 3. Filter for checked-in patients only to form the live queue
    let liveQueue = todaysPatients.filter(p => ['Waiting', 'Late'].includes(p.status));

    // 4. Handle late arrivals
    liveQueue.forEach(patient => {
        if (patient.checkInTime && patient.worstCaseETC) {
            const lateBy = Math.round((parseISO(patient.checkInTime).getTime() - parseISO(patient.worstCaseETC).getTime()) / 60000);
            
            if (lateBy > 0) {
                 patient.status = 'Late';
                 patient.lateBy = lateBy;
            }
        }
    });

    // Sort live queue: on-time first, then by late arrival penalty
    liveQueue.sort((a, b) => {
      // Prioritize 'Waiting' (on-time) patients over 'Late' patients
      if (a.status === 'Waiting' && b.status === 'Late') return -1;
      if (a.status === 'Late' && b.status === 'Waiting') return 1;

      // If both are late, the one who checked in earlier goes first
      if (a.status === 'Late' && b.status === 'Late') {
        return parseISO(a.checkInTime!).getTime() - parseISO(b.checkInTime!).getTime();
      }
      
      // If both are on time, sort by their original token number
      return a.tokenNo - b.tokenNo;
    });

    // 5. Calculate Best-case ETC based on final position in the live queue
    let doctorStartTime: Date;
    const now = new Date();

    if (doctorStatus.isOnline && doctorStatus.onlineTime) {
        doctorStartTime = new Date(parseISO(doctorStatus.onlineTime).getTime() + doctorStatus.startDelay * 60000);
    } else {
        // If doctor is not online, the best case starts from the LATER of now or the clinic's scheduled start time
        const delayedClinicStart = new Date(clinicStartTime.getTime() + doctorStatus.startDelay * 60000);
        doctorStartTime = now > delayedClinicStart ? now : delayedClinicStart;
    }
    
    liveQueue.forEach((p, i) => {
        if (i === 0) {
            // For the first person, their best-case ETC is the doctor's actual start time
             p.bestCaseETC = doctorStartTime.toISOString();
        } else {
            const previousPatientETC = liveQueue[i - 1].bestCaseETC!;
            p.bestCaseETC = new Date(
                parseISO(previousPatientETC).getTime() + schedule.slotDuration * 60000
            ).toISOString();
        }
    });

    // 6. Merge updates back into the main patient list
    const updatedPatients = patients.map(p => {
        const patientInQueue = liveQueue.find(lq => lq.id === p.id);
        const patientWithWorstCase = todaysPatients.find(tp => tp.id === p.id);
        if (patientInQueue) {
            return patientInQueue;
        }
        if(patientWithWorstCase) {
             return patientWithWorstCase;
        }
        return p;
    });

    await updateAllPatients(updatedPatients);
    revalidatePath('/');
    revalidatePath('/booking');
    revalidatePath('/queue-status');
    revalidatePath('/tv-display');
    return { success: 'Queue recalculated' };
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
        await recalculateQueueWithETC();
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
    const newDate = parseISO(newAppointmentTime);
    const session = getSessionForTime(schedule, newDate);

    if (!session) {
        return { error: 'The selected time is outside of clinic hours.' };
    }

    const dateStr = format(toZonedTime(newDate, timeZone), "yyyy-MM-dd");
    // --- Static Token Number Recalculation ---
    const dayOfWeek = format(toZonedTime(newDate, timeZone), 'EEEE') as keyof DoctorSchedule['days'];
    const daySchedule = schedule.days[dayOfWeek];
    const morningStart = sessionLocalToUtc(dateStr, daySchedule.morning.start);
    const morningEnd = sessionLocalToUtc(dateStr, daySchedule.morning.end);
    const eveningStart = sessionLocalToUtc(dateStr, daySchedule.evening.start);
    const totalMorningSlots = daySchedule.morning.isOpen ? differenceInMinutes(morningEnd, morningStart) / schedule.slotDuration : 0;
    
    let tokenNo = 0;
    if (session === 'morning') {
        const minutesFromStart = differenceInMinutes(newDate, morningStart);
        tokenNo = Math.floor(minutesFromStart / schedule.slotDuration) + 1;
    } else { // evening
        const minutesFromStart = differenceInMinutes(newDate, eveningStart);
        tokenNo = totalMorningSlots + Math.floor(minutesFromStart / schedule.slotDuration) + 1;
    }
    // --- End Recalculation ---
    

    await updatePatient(appointmentId, { 
        appointmentTime: newAppointmentTime, 
        slotTime: newAppointmentTime,
        purpose: newPurpose,
        status: 'Booked',
        rescheduleCount: (patient.rescheduleCount || 0) + 1,
        tokenNo: tokenNo,
        bestCaseETC: undefined,
        worstCaseETC: undefined,
        checkInTime: undefined,
        lateBy: undefined,
    });
    
    await recalculateQueueWithETC();

    revalidatePath('/booking');
    revalidatePath('/');

    return { success: 'Appointment rescheduled successfully.' };
}

export async function getFamilyAction() {
    return getFamily();
}

    

    
