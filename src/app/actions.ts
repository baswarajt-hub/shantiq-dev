

'use server';

import { revalidatePath } from 'next/cache';
import { addPatient as addPatientData, findPatientById, getPatients as getPatientsData, updateAllPatients, updatePatient, getDoctorStatus as getDoctorStatusData, updateDoctorStatus, getDoctorSchedule as getDoctorScheduleData, updateDoctorSchedule, updateSpecialClosures, getFamilyByPhone, addFamilyMember, getFamily, searchFamilyMembers, updateFamilyMember, cancelAppointment, updateVisitPurposesData, updateTodayScheduleOverrideData, updateClinicDetailsData } from '@/lib/data';
import type { AIPatientData, DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember, VisitPurpose, Session, ClinicDetails } from '@/lib/types';
import { estimateConsultationTime } from '@/ai/flows/estimate-consultation-time';
import { sendAppointmentReminders } from '@/ai/flows/send-appointment-reminders';
import { format, parseISO, parse, differenceInMinutes, startOfDay, max } from 'date-fns';
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



export async function addAppointmentAction(familyMember: FamilyMember, appointmentTime: string, purpose: string, isWalkIn: boolean) {

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

    const isActive = ['Booked', 'Confirmed', 'Waiting', 'In-Consultation', 'Late', 'Priority'].includes(p.status);
    return isSameSession && isActive;
  });

  if (existingAppointment) {
    return { error: `This patient already has an appointment scheduled for this day and session.` };
  }

  // --- Session-Specific Token Number Calculation ---
    const dayOfWeek = format(toZonedTime(newAppointmentDate, timeZone), 'EEEE') as keyof DoctorSchedule['days'];
    let daySchedule = schedule.days[dayOfWeek];
    const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);
    if (todayOverride) {
        daySchedule = {
            morning: todayOverride.morningOverride ?? daySchedule.morning,
            evening: todayOverride.eveningOverride ?? daySchedule.evening,
        };
    }

    let tokenNo = 0;
    if (newAppointmentSession === 'morning') {
        const sessionStart = sessionLocalToUtc(dateStr, daySchedule.morning.start);
        const minutesFromStart = differenceInMinutes(newAppointmentDate, sessionStart);
        tokenNo = Math.floor(minutesFromStart / schedule.slotDuration) + 1;
    } else { // evening
        const sessionStart = sessionLocalToUtc(dateStr, daySchedule.evening.start);
        const minutesFromStart = differenceInMinutes(newAppointmentDate, sessionStart);
        tokenNo = Math.floor(minutesFromStart / schedule.slotDuration) + 1;
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
  revalidatePath('/queue_status');
  revalidatePath('/tv_display');
  
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
        subStatus: undefined,
      };
      await updatePatient(currentlyServing.id, completedUpdates);
    }
    
    // Now, set the new patient to "In-Consultation"
    updates.consultationStartTime = new Date().toISOString();
    // Check if coming from "Waiting for Reports"
    if(patient.status === 'Waiting for Reports') {
        updates.subStatus = 'Reports';
    } else {
        updates.subStatus = undefined;
    }


  } else if (status === 'Completed' && patient.consultationStartTime) {
    const startTime = new Date(patient.consultationStartTime);
    const endTime = new Date();
    updates.consultationEndTime = endTime.toISOString();
    updates.consultationTime = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // in minutes
    updates.subStatus = undefined;
  } else if (status === 'Priority') {
    // Special handling for priority status, this just sets the status.
    // The queue recalculation logic will handle the re-ordering.
  }

  await updatePatient(patientId, updates);
  await recalculateQueueWithETC();

  revalidatePath('/');
  revalidatePath('/tv_display');
  revalidatePath('/queue_status');
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
    revalidatePath('/tv_display');
    revalidatePath('/queue_status');
    return { success: `Doctor is now ${newStatus.isOnline ? 'Online' : 'Offline'}.` };
}

export async function updateDoctorStartDelayAction(startDelayMinutes: number) {
    await updateDoctorStatus({ startDelay: startDelayMinutes });
    await recalculateQueueWithETC();
    revalidatePath('/');
    revalidatePath('/tv_display');
    revalidatePath('/queue_status');
    return { success: `Doctor delay updated to ${startDelayMinutes} minutes.` };
}

export async function emergencyCancelAction() {
    const patients = await getPatientsData();
    const activePatients = patients.filter(p => ['Waiting', 'Confirmed', 'Booked', 'In-Consultation', 'Priority'].includes(p.status));

    for (const patient of activePatients) {
        await updatePatient(patient.id, { status: 'Cancelled' });
        // In a real app, you would also trigger notifications here.
    }
    
    // Also set doctor to offline
    await updateDoctorStatus({ isOnline: false, startDelay: 0 });

    revalidatePath('/');
    revalidatePath('/tv_display');
    revalidatePath('/queue_status');
    
    return { success: `Emergency declared. All ${activePatients.length} active appointments have been cancelled.` };
}

export async function addPatientAction(patientData: Omit<Patient, 'id' | 'estimatedWaitTime' | 'slotTime'>) {
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

        const isActive = ['Booked', 'Confirmed', 'Waiting', 'In-Consultation', 'Late', 'Priority'].includes(p.status);
        return isSameSession && isActive;
    });

    if (existingAppointment) {
        return { error: `This patient already has an appointment scheduled for this day and session.` };
    }

    // --- Session-Specific Token Number Calculation ---
    const dayOfWeek = format(toZonedTime(newAppointmentDate, timeZone), 'EEEE') as keyof DoctorSchedule['days'];
    let daySchedule = schedule.days[dayOfWeek];
    const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);
    if (todayOverride) {
        daySchedule = {
            morning: todayOverride.morningOverride ?? daySchedule.morning,
            evening: todayOverride.eveningOverride ?? daySchedule.evening,
        };
    }

    let tokenNo = 0;
    if (newAppointmentSession === 'morning') {
        const sessionStart = sessionLocalToUtc(dateStr, daySchedule.morning.start);
        const minutesFromStart = differenceInMinutes(newAppointmentDate, sessionStart);
        tokenNo = Math.floor(minutesFromStart / schedule.slotDuration) + 1;
    } else { // evening
        const sessionStart = sessionLocalToUtc(dateStr, daySchedule.evening.start);
        const minutesFromStart = differenceInMinutes(newAppointmentDate, sessionStart);
        tokenNo = Math.floor(minutesFromStart / schedule.slotDuration) + 1;
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
  revalidatePath('/queue_status');
  revalidatePath('/tv_display');
  return { success: `${patient.name} has been checked in.` };
}

export async function recalculateQueueWithETC() {
    let allPatients = await getPatientsData();
    const schedule = await getDoctorScheduleData();
    const doctorStatus = await getDoctorStatusData();

    const todayStr = format(toZonedTime(new Date(), timeZone), 'yyyy-MM-dd');
    const dayOfWeek = format(toZonedTime(new Date(), timeZone), 'EEEE') as keyof DoctorSchedule['days'];

    // Get today's base schedule and apply any overrides
    let daySchedule = schedule.days[dayOfWeek];
    const specialClosure = schedule.specialClosures.find(c => c.date === todayStr);
    if (specialClosure) {
        daySchedule = {
            morning: specialClosure.morningOverride ?? daySchedule.morning,
            evening: specialClosure.eveningOverride ?? daySchedule.evening
        };
    }
    
    // Determine which session the doctor's delay applies to.
    let delaySession: 'morning' | 'evening' | null = null;
    if (doctorStatus.isOnline && doctorStatus.onlineTime) {
        delaySession = getSessionForTime(schedule, parseISO(doctorStatus.onlineTime));
    }


    const patientUpdates = new Map<number, Partial<Patient>>();
    const sessions: ('morning' | 'evening')[] = ['morning', 'evening'];

    for (const session of sessions) {
        const sessionTimes = daySchedule[session];
        if (!sessionTimes?.isOpen) continue;

        // Filter patients for today and the current session being processed
        const sessionPatients = allPatients.filter(p => {
            const apptDate = parseISO(p.appointmentTime);
            if (format(toZonedTime(apptDate, timeZone), 'yyyy-MM-dd') !== todayStr) return false;
            const apptSession = getSessionForTime(schedule, apptDate);
            return apptSession === session;
        });

        if (sessionPatients.length === 0) continue;

        const clinicSessionStartTime = sessionLocalToUtc(todayStr, sessionTimes.start);
        
        // Apply delay ONLY if it belongs to the current session being calculated
        const sessionDelay = delaySession === session ? doctorStatus.startDelay : 0;
        const delayedClinicStartTime = new Date(clinicSessionStartTime.getTime() + sessionDelay * 60000);

        // 1. Assign Worst-case ETC for all of this session's patients based on token
        sessionPatients.forEach(p => {
            const worstCaseETC = new Date(
                delayedClinicStartTime.getTime() + (p.tokenNo - 1) * schedule.slotDuration * 60000
            ).toISOString();
            patientUpdates.set(p.id, { ...patientUpdates.get(p.id), worstCaseETC });
        });

        // 2. Automatically mark late arrivals (only for 'Booked' types, if doctor is online)
        if (doctorStatus.isOnline) {
            sessionPatients.forEach(p => {
                const currentUpdates = patientUpdates.get(p.id) || {};
                const worstCaseETC = currentUpdates.worstCaseETC || p.worstCaseETC;
                if (p.checkInTime && worstCaseETC && p.type !== 'Walk-in') {
                    const isLate = parseISO(p.checkInTime).getTime() > parseISO(worstCaseETC).getTime();
                    if (isLate && p.status === 'Waiting') {
                        const lateBy = Math.round((parseISO(p.checkInTime).getTime() - parseISO(worstCaseETC).getTime()) / 60000);
                        patientUpdates.set(p.id, { ...currentUpdates, status: 'Late', lateBy: lateBy > 0 ? lateBy : 0 });
                    }
                }
            });
        }
        
        // Apply pending status updates before forming live queue
        const updatedSessionPatients = sessionPatients.map(p => ({ ...p, ...patientUpdates.get(p.id) }));

        // 3. Form the live queue of checked-in patients for THIS SESSION
        let liveQueue = updatedSessionPatients.filter(p => ['Waiting', 'Late', 'Priority'].includes(p.status));

        // 4. Sort the live queue
        liveQueue.sort((a, b) => {
            if (a.status === 'Priority' && b.status !== 'Priority') return -1;
            if (a.status !== 'Priority' && b.status === 'Priority') return 1;
            if (a.status === 'Priority' && b.status === 'Priority') {
                return parseISO(a.checkInTime!).getTime() - parseISO(b.checkInTime!).getTime();
            }

            if (a.latePosition !== undefined && b.latePosition === undefined) return -1;
            if (a.latePosition === undefined && b.latePosition !== undefined) return 1;
            if (a.latePosition !== undefined && b.latePosition !== undefined) return a.latePosition - b.latePosition;
            
            if (a.status === 'Waiting' && b.status === 'Late') return -1;
            if (a.status === 'Late' && b.status === 'Waiting') return 1;
            
            if (a.status === 'Waiting' && b.status === 'Waiting') return a.tokenNo - b.tokenNo;

            if (a.status === 'Late' && b.status === 'Late') {
                return parseISO(a.checkInTime!).getTime() - parseISO(b.checkInTime!).getTime();
            }
            
            return a.tokenNo - b.tokenNo;
        });

        // 5. Calculate Best-case ETC based on final sorted live queue
        let now = new Date();
        let effectiveDoctorStartTime: Date;
        if (doctorStatus.isOnline && doctorStatus.onlineTime) {
            effectiveDoctorStartTime = max([now, parseISO(doctorStatus.onlineTime), delayedClinicStartTime]);
        } else {
            effectiveDoctorStartTime = delayedClinicStartTime;
        }

        const currentlyServing = updatedSessionPatients.find(p => p.status === 'In-Consultation');
        if (currentlyServing && currentlyServing.consultationStartTime) {
            const expectedEndTime = new Date(parseISO(currentlyServing.consultationStartTime).getTime() + schedule.slotDuration * 60000);
            effectiveDoctorStartTime = max([now, expectedEndTime, delayedClinicStartTime]);
        }
        
        liveQueue.forEach((p, i) => {
            let bestCaseETC: string;
            if (i === 0) {
                bestCaseETC = effectiveDoctorStartTime.toISOString();
            } else {
                const previousPatientETC = patientUpdates.get(liveQueue[i - 1].id)?.bestCaseETC || liveQueue[i-1].bestCaseETC!;
                bestCaseETC = new Date(
                    parseISO(previousPatientETC).getTime() + schedule.slotDuration * 60000
                ).toISOString();
            }
            
            const currentUpdates = patientUpdates.get(p.id) || {};
            let finalUpdates: Partial<Patient> = { ...currentUpdates, bestCaseETC };

            // Constraint: worstETC >= bestETC
            const worstETC = finalUpdates.worstCaseETC || p.worstCaseETC;
            if (worstETC && bestCaseETC && parseISO(worstETC) < parseISO(bestCaseETC)) {
                finalUpdates.worstCaseETC = bestCaseETC;
            }

            patientUpdates.set(p.id, finalUpdates);
        });
    }

    // 6. Apply all collected updates to the main patient list
    const updatedPatients = allPatients.map(p => {
        if (patientUpdates.has(p.id)) {
            return { ...p, ...patientUpdates.get(p.id) };
        }
        return p;
    });

    await updateAllPatients(updatedPatients);

    revalidatePath('/');
    revalidatePath('/booking');
    revalidatePath('/queue_status');
    revalidatePath('/tv_display');
    return { success: `Queue recalculated for all sessions.` };
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

export async function updateDoctorScheduleAction(schedule: Omit<DoctorSchedule, 'specialClosures' | 'visitPurposes' | 'clinicDetails'>) {
    await updateDoctorSchedule(schedule);
    revalidatePath('/admin');
    revalidatePath('/');
    return { success: 'Doctor schedule updated successfully.' };
}

export async function updateClinicDetailsAction(details: ClinicDetails) {
    await updateClinicDetailsData(details);
    revalidatePath('/admin');
    revalidatePath('/');
    return { success: 'Clinic details updated successfully.' };
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
    // --- Session-Specific Token Number Recalculation ---
    const dayOfWeek = format(toZonedTime(newDate, timeZone), 'EEEE') as keyof DoctorSchedule['days'];
    let daySchedule = schedule.days[dayOfWeek];
    const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);
    if (todayOverride) {
        daySchedule = {
            morning: todayOverride.morningOverride ?? daySchedule.morning,
            evening: todayOverride.eveningOverride ?? daySchedule.evening,
        };
    }
    
    let tokenNo = 0;
    if (session === 'morning') {
        const sessionStart = sessionLocalToUtc(dateStr, daySchedule.morning.start);
        const minutesFromStart = differenceInMinutes(newDate, sessionStart);
        tokenNo = Math.floor(minutesFromStart / schedule.slotDuration) + 1;
    } else { // evening
        const sessionStart = sessionLocalToUtc(dateStr, daySchedule.evening.start);
        const minutesFromStart = differenceInMinutes(newDate, sessionStart);
        tokenNo = Math.floor(minutesFromStart / schedule.slotDuration) + 1;
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
        latePenalty: undefined,
        latePosition: undefined,
    });
    
    await recalculateQueueWithETC();

    revalidatePath('/booking');
    revalidatePath('/');
    revalidatePath('/queue_status');
    revalidatePath('/tv_display');

    return { success: 'Appointment rescheduled successfully.' };
}

export async function getFamilyAction() {
    return getFamily();
}

export async function applyLatePenaltyAction(patientId: number, penalty: number) {
    const allPatients = await getPatientsData();
    const schedule = await getDoctorScheduleData();

    // Re-create the sorted live queue exactly as it appears to the user
    const todayStr = format(toZonedTime(new Date(), timeZone), 'yyyy-MM-dd');
    let liveQueue = allPatients
        .filter(p => format(toZonedTime(parseISO(p.appointmentTime), timeZone), 'yyyy-MM-dd') === todayStr)
        .filter(p => ['Waiting', 'Late', 'Priority'].includes(p.status));
        
    liveQueue.sort((a, b) => {
        if (a.status === 'Priority' && b.status !== 'Priority') return -1;
        if (a.status !== 'Priority' && b.status === 'Priority') return 1;
        if (a.status === 'Priority' && b.status === 'Priority') return parseISO(a.checkInTime!).getTime() - parseISO(b.checkInTime!).getTime();
        if (a.latePosition !== undefined && b.latePosition === undefined) return -1;
        if (a.latePosition === undefined && b.latePosition !== undefined) return 1;
        if (a.latePosition !== undefined && b.latePosition !== undefined) return a.latePosition - b.latePosition;
        if (a.status === 'Waiting' && b.status === 'Late') return -1;
        if (a.status === 'Late' && b.status === 'Waiting') return 1;
        if (a.status === 'Waiting' && b.status === 'Waiting') return a.tokenNo - b.tokenNo;
        if (a.status === 'Late' && b.status === 'Late') return parseISO(a.checkInTime!).getTime() - parseISO(b.checkInTime!).getTime();
        return a.tokenNo - b.tokenNo;
    });

    const patientIndex = liveQueue.findIndex(p => p.id === patientId);
    if (patientIndex === -1) {
        return { error: 'Patient not found in the live queue.' };
    }

    const patientToMove = liveQueue[patientIndex];
    patientToMove.latePenalty = penalty;

    liveQueue.splice(patientIndex, 1);
    
    const newIndex = Math.min(patientIndex + penalty, liveQueue.length);
    
    liveQueue.splice(newIndex, 0, patientToMove);
    
    // Update latePosition for all penalized patients to lock them in
    for (let i = 0; i < liveQueue.length; i++) {
        const p = liveQueue[i];
        if (p.latePenalty !== undefined) {
             p.latePosition = i;
         }
    }

    // Update just the penalized patients in the main list before recalculating
    const patientMap = new Map(liveQueue.map(p => [p.id, p]));
    const updatedPatients = allPatients.map(p => patientMap.get(p.id) || p);
    await updateAllPatients(updatedPatients);
    
    // After applying penalty, we must recalculate the queue to update ETCs for everyone
    await recalculateQueueWithETC();

    revalidatePath('/');
    revalidatePath('/tv_display');
    revalidatePath('/queue_status');

    return { success: `Applied penalty of ${penalty} positions.` };
}

    

    

    

    

    
    
