

'use server';

import { revalidatePath } from 'next/cache';
import { addPatient as addPatientData, findPatientById, getPatients as getPatientsData, updateAllPatients, updatePatient, getDoctorStatus as getDoctorStatusData, updateDoctorStatus, getDoctorSchedule as getDoctorScheduleData, updateDoctorSchedule, updateSpecialClosures, getFamilyByPhone, addFamilyMember, getFamily, searchFamilyMembers, updateFamilyMember, cancelAppointment, updateVisitPurposesData, updateTodayScheduleOverrideData, updateClinicDetailsData, findPatientsByPhone, findPrimaryUserByPhone, updateNotificationData, deleteFamilyMember as deleteFamilyMemberData, updateSmsSettingsData, updatePaymentGatewaySettingsData } from '@/lib/data';
import type { AIPatientData, DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember, VisitPurpose, Session, ClinicDetails, Notification, SmsSettings, PaymentGatewaySettings } from '@/lib/types';
import { estimateConsultationTime } from '@/ai/flows/estimate-consultation-time';
import { sendAppointmentReminders } from '@/ai/flows/send-appointment-reminders';
import { format, parseISO, parse, differenceInMinutes, startOfDay, max, addMinutes, subMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { createHash } from 'crypto';

const timeZone = "Asia/Kolkata";

function toDate(value?: string | Date): Date | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return parseISO(value);
  return value;
}


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
  if (!schedule || !schedule.days) return null;
  const zonedAppt = toZonedTime(appointmentUtcDate, timeZone);
  const dayOfWeek = format(zonedAppt, 'EEEE') as keyof DoctorSchedule['days'];
  const dateStr = format(zonedAppt, 'yyyy-MM-dd');
  
  let dayScheduleInfo = schedule.days[dayOfWeek];
  if (!dayScheduleInfo) return null;
  
  const todayOverride = schedule.specialClosures.find(c => c.date === dateStr);
  
  const checkSession = (sessionName: 'morning' | 'evening') => {
    const sessionDetailsFromWeek = dayScheduleInfo[sessionName];
    const isClosedFromWeek = !sessionDetailsFromWeek.isOpen;
    
    // Check special closure for the whole session
    const isClosedByOverride = (sessionName === 'morning' && todayOverride?.isMorningClosed) || (sessionName === 'evening' && todayOverride?.isEveningClosed);
    if(isClosedByOverride) return false;

    // Use override times if available, otherwise fall back to weekly schedule
    const sessionDetails = todayOverride?.[`${sessionName}Override`] ?? sessionDetailsFromWeek;
    
    // If there's no override, check if the weekly session is open
    if (!todayOverride?.[`${sessionName}Override`] && isClosedFromWeek) {
        return false;
    }


    const startUtc = sessionLocalToUtc(dateStr, sessionDetails.start);
    const endUtc = sessionLocalToUtc(dateStr, sessionDetails.end);
    const apptMs = appointmentUtcDate.getTime();
    
    return apptMs >= startUtc.getTime() && apptMs < endUtc.getTime();
  };

  if (checkSession('morning')) return 'morning';
  if (checkSession('evening')) return 'evening';
  return null;
};



export async function addAppointmentAction(familyMember: FamilyMember, appointmentTime: string, purpose: string, isWalkIn: boolean, checkIn: boolean = false) {

  const allPatients = await getPatientsData();
  const schedule = await getDoctorScheduleData();
  const newAppointmentDate = parseISO(appointmentTime);

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

    const isActive = ['Booked', 'Confirmed', 'Waiting', 'In-Consultation', 'Late', 'Priority', 'Up-Next'].includes(p.status);
    return isSameSession && isActive;
  });

  if (existingAppointment) {
    return { error: `This patient already has an appointment scheduled for this day and session.` };
  }

  // --- Session-Specific Token Number Calculation ---
    const dateStr = format(toZonedTime(newAppointmentDate, timeZone), "yyyy-MM-dd");
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


  const newPatientData: Omit<Patient, 'id' | 'estimatedWaitTime' | 'slotTime'> = {
    name: familyMember.name,
    phone: familyMember.phone,
    type: isWalkIn ? 'Walk-in' : 'Appointment',
    appointmentTime: appointmentTime,
    status: checkIn ? 'Waiting' : 'Booked',
    purpose: purpose,
    tokenNo: tokenNo
  };

  if (checkIn) {
    newPatientData.checkInTime = new Date().toISOString();
  }

  // Only set subType for walk-ins that are "Book Only", not "Book & Check-in"
  if (isWalkIn && !checkIn) {
      newPatientData.subType = 'Booked Walk-in';
  }
  
  const newPatient = await addPatientData(newPatientData);

  await recalculateQueueWithETC();
  
  revalidatePath('/');
  revalidatePath('/dashboard');
  revalidatePath('/booking');
  revalidatePath('/patient-portal');
  revalidatePath('/queue-status');
  revalidatePath('/tv-display');
  revalidatePath('/admin');
  revalidatePath('/api/patients');
  revalidatePath('/api/family');
  
  return { success: 'Appointment booked successfully.', patient: newPatient };
}


export async function updatePatientStatusAction(patientId: number, status: Patient['status']) {
  const patients = await getPatientsData();
  const patient = patients.find(p => p.id === patientId);

  if (!patient) {
    return { error: 'Patient not found' };
  }

  let updates: Partial<Patient> = { status };

  // Clear late-lock fields when moving to a terminal or in-consultation state
  const shouldClearLateLock = ['In-Consultation', 'Completed', 'Cancelled'].includes(status);
  if (shouldClearLateLock) {
    updates.lateLocked = false;
    updates.lateAnchors = undefined;
    updates.lateLockedAt = undefined;
  }

  if (status === 'In-Consultation') {
    // If we are starting a new consultation, find and complete any existing one.
    const currentlyServing = patients.find(p => p.status === 'In-Consultation');
    if (currentlyServing && currentlyServing.id !== patientId) {
      const startTime = toDate(currentlyServing.consultationStartTime!)!;
      const endTime = new Date();
      const completedUpdates: Partial<Patient> = {
        status: 'Completed',
        consultationEndTime: endTime.toISOString(),
        consultationTime: Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)), // in minutes
        subStatus: undefined,
        lateLocked: false,
        lateAnchors: undefined,
        lateLockedAt: undefined
      };
      await updatePatient(currentlyServing.id, completedUpdates);
    }
    
    // Now, set the new patient to "In-Consultation"
    updates.consultationStartTime = new Date().toISOString();
    updates.subStatus = undefined;

  } else if (status === 'Completed' && patient.consultationStartTime) {
    const startTime = toDate(patient.consultationStartTime)!;
    const endTime = new Date();
    updates.consultationEndTime = endTime.toISOString();
    updates.consultationTime = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // in minutes
    updates.subStatus = undefined;
  } else if (status === 'Priority') {
    // Special handling for priority status, this just sets the status.
    // The queue recalculation logic will handle the re-ordering.
  } else if (status === 'Waiting for Reports') {
    updates.subStatus = 'Reports';
  } else if (patient.status === 'Waiting for Reports' && status === 'In-Consultation') {
    updates.consultationStartTime = new Date().toISOString();
    updates.subStatus = undefined;
  }

  await updatePatient(patientId, updates);
  await recalculateQueueWithETC();

  revalidatePath('/');
  revalidatePath('/dashboard');
  revalidatePath('/booking');
  revalidatePath('/patient-portal');
  revalidatePath('/tv-display');
  revalidatePath('/queue-status');
  revalidatePath('/admin');
  revalidatePath('/api/patients');
  
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
    revalidatePath('/dashboard');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    revalidatePath('/admin');
    revalidatePath('/api/patients');
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

export async function findPatientsByPhoneAction(phone: string) {
    await recalculateQueueWithETC();
    return findPatientsByPhone(phone);
}


export async function getDoctorScheduleAction() {
    return getDoctorScheduleData();
}

export async function getDoctorStatusAction() {
    return getDoctorStatusData();
}

export async function setDoctorStatusAction(status: Partial<DoctorStatus>) {
    await updateDoctorStatus(status);
    await recalculateQueueWithETC();
    revalidatePath('/', 'layout');
    return { success: `Doctor status updated.` };
}


export async function updateDoctorStartDelayAction(startDelayMinutes: number) {
    await updateDoctorStatus({ startDelay: startDelayMinutes });
    await recalculateQueueWithETC();
    revalidatePath('/');
    revalidatePath('/dashboard');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    revalidatePath('/patient-portal');
    revalidatePath('/booking');
    return { success: `Doctor delay updated to ${startDelayMinutes} minutes.` };
}

export async function emergencyCancelAction() {
    const patients = await getPatientsData();
    const activePatients = patients.filter(p => ['Waiting', 'Confirmed', 'Booked', 'In-Consultation', 'Priority', 'Up-Next'].includes(p.status));

    for (const patient of activePatients) {
        await updatePatient(patient.id, { status: 'Cancelled' });
        // In a real app, you would also trigger notifications here.
    }
    
    // Also set doctor to offline
    await updateDoctorStatus({ isOnline: false, startDelay: 0 });
    await recalculateQueueWithETC();

    revalidatePath('/');
    revalidatePath('/dashboard');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/api/patients');
    
    return { success: `Emergency declared. All ${activePatients.length} active appointments have been cancelled.` };
}

export async function addPatientAction(patientData: Omit<Patient, 'id' | 'estimatedWaitTime' | 'slotTime'>) {
    const schedule = await getDoctorScheduleData();
    const allPatients = await getPatientsData();
    const newAppointmentDate = parseISO(patientData.appointmentTime);

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

        const isActive = ['Booked', 'Confirmed', 'Waiting', 'In-Consultation', 'Late', 'Priority', 'Up-Next'].includes(p.status);
        return isSameSession && isActive;
    });

    if (existingAppointment) {
        return { error: `This patient already has an appointment scheduled for this day and session.` };
    }

    // --- Session-Specific Token Number Calculation ---
    const dateStr = format(toZonedTime(newAppointmentDate, timeZone), "yyyy-MM-dd");
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

    await recalculateQueueWithETC();
    revalidatePath('/');
    revalidatePath('/dashboard');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/queue-status');
    revalidatePath('/tv-display');
    revalidatePath('/admin');
    revalidatePath('/api/patients');
    revalidatePath('/api/family');
    return { patient: newPatient, success: "Patient added successfully" };
}


export async function addNewPatientAction(familyMemberData: Omit<FamilyMember, 'id' | 'avatar'>) {
    if (!familyMemberData.phone) {
        return { error: 'Phone number is required to add a family member.' };
    }
    const newMember = await addFamilyMember(familyMemberData);
    if (!newMember) {
        return { error: 'Failed to create a new family member.' };
    }
    revalidatePath('/');
    revalidatePath('/dashboard');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/queue-status');
    revalidatePath('/tv-display');
    revalidatePath('/admin');
    revalidatePath('/api/family');
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
  revalidatePath('/dashboard');
  revalidatePath('/booking');
  revalidatePath('/patient-portal');
  revalidatePath('/queue-status');
  revalidatePath('/tv-display');
  revalidatePath('/api/patients');
  return { success: `${patient.name} has been checked in.` };
}

export async function recalculateQueueWithETC() {
    let allPatients = await getPatientsData();
    const schedule = await getDoctorScheduleData();
    let doctorStatus = await getDoctorStatusData();

    if (!schedule || !schedule.days) {
        // Can't calculate without a schedule
        console.warn("Recalculation skipped: schedule.days is not available.");
        return { error: "Doctor schedule is not fully configured." };
    }

    const now = new Date();
    const todayStr = format(toZonedTime(now, timeZone), 'yyyy-MM-dd');
    const dayOfWeek = format(toZonedTime(now, timeZone), 'EEEE') as keyof DoctorSchedule['days'];

    let daySchedule = schedule.days[dayOfWeek];
    if (!daySchedule) return { error: `Schedule for ${dayOfWeek} is not configured.` };

    const specialClosure = schedule.specialClosures.find(c => c.date === todayStr);
    if (specialClosure) {
        daySchedule = {
            morning: specialClosure.morningOverride ?? daySchedule.morning,
            evening: specialClosure.eveningOverride ?? daySchedule.evening
        };
    }
    
    const patientUpdates = new Map<string, Partial<Patient>>();
    const sessions: ('morning' | 'evening')[] = ['morning', 'evening'];
    
    // --- Manual QR Code Logic: remove auto-offline logic ---
    // The QR code state is now fully manual and not tied to session times.

    for (const session of sessions) {
        const sessionTimes = daySchedule[session];
        if (!sessionTimes?.isOpen) continue;

        let sessionPatients = allPatients.filter(p => {
            const apptDate = parseISO(p.appointmentTime);
            if (format(toZonedTime(apptDate, timeZone), 'yyyy-MM-dd') !== todayStr) return false;
            const apptSession = getSessionForTime(schedule, apptDate);
            return apptSession === session;
        });

        // --- Post-Session Cleanup ---
        const sessionEndUtc = sessionLocalToUtc(todayStr, sessionTimes.end);
        const patientCleanupTimeUtc = new Date(sessionEndUtc.getTime() + 60 * 60 * 1000); // 1 hour after session end
        
        if (now > patientCleanupTimeUtc) {
            sessionPatients.forEach(p => {
                if (p.status === 'Waiting') {
                     patientUpdates.set(p.id.toString(), { ...patientUpdates.get(p.id.toString()), status: 'Completed' });
                } else if (p.status === 'Booked' || p.status === 'Confirmed') {
                     patientUpdates.set(p.id.toString(), { ...patientUpdates.get(p.id.toString()), status: 'Missed' });
                }
            });
             // Map again to include cleanup updates before continuing
            sessionPatients = sessionPatients.map(p => ({ ...p, ...patientUpdates.get(p.id.toString()) }));
        }

        // --- End Cleanup Logic ---


        if (sessionPatients.length === 0) continue;

        const clinicSessionStartTime = sessionLocalToUtc(todayStr, sessionTimes.start);
        
        let sessionDelay = 0;
        if (doctorStatus.isOnline && doctorStatus.onlineTime) {
            const onlineTimeUtc = parseISO(doctorStatus.onlineTime);
            const onlineSession = getSessionForTime(schedule, onlineTimeUtc);
            if (onlineSession === session) {
                const actualDelay = differenceInMinutes(onlineTimeUtc, clinicSessionStartTime);
                sessionDelay = actualDelay > 0 ? actualDelay : 0;
            }
        } else if (doctorStatus.startDelay > 0) {
             // Logic for when doctor is NOT online but a delay is set
             const morningStartUtc = daySchedule.morning.isOpen ? sessionLocalToUtc(todayStr, daySchedule.morning.start) : new Date(8.64e15); // Far future
             const eveningStartUtc = daySchedule.evening.isOpen ? sessionLocalToUtc(todayStr, daySchedule.evening.start) : new Date(8.64e15); // Far future

            let delayAppliesToSession: 'morning' | 'evening' | null = null;
            
            // If it's before the morning session even starts, the delay applies to the morning.
            if (now < morningStartUtc) {
                delayAppliesToSession = 'morning'; 
            } 
            // If we are between the start of morning and start of evening, the delay applies to the current (morning) session.
            else if (now >= morningStartUtc && now < eveningStartUtc) {
                delayAppliesToSession = 'morning';
            } 
            // If we are past the start of the evening session, the delay applies to the evening session.
            else if (now >= eveningStartUtc) {
                delayAppliesToSession = 'evening';
            }
            
            // Only apply the startDelay if it's for the session we are currently calculating
             if (delayAppliesToSession === session) {
                 sessionDelay = doctorStatus.startDelay;
             }
        }

        const delayedClinicStartTime = new Date(clinicSessionStartTime.getTime() + sessionDelay * 60000);

        sessionPatients.forEach(p => {
            const worstCaseETC = new Date(
                delayedClinicStartTime.getTime() + (p.tokenNo - 1) * schedule.slotDuration * 60000
            ).toISOString();
            patientUpdates.set(p.id.toString(), { ...patientUpdates.get(p.id.toString()), worstCaseETC: worstCaseETC, slotTime: worstCaseETC });
            
            const currentUpdates = patientUpdates.get(p.id.toString()) || {};
            if (p.checkInTime && doctorStatus.isOnline && p.status === 'Waiting' && p.type === 'Appointment' && !p.lateLocked && toDate(p.checkInTime)! > toDate(worstCaseETC)!) {
                 const lateBy = differenceInMinutes(toDate(p.checkInTime)!, toDate(worstCaseETC)!);
                 patientUpdates.set(p.id.toString(), { ...currentUpdates, status: 'Late', lateBy: lateBy > 0 ? lateBy : 0 });
            }
        });

        let updatedSessionPatients = sessionPatients.map(p => ({ ...p, ...patientUpdates.get(p.id.toString()) }));

        // Clear Up-Next status from anyone who has it, it will be reassigned.
        updatedSessionPatients.forEach(p => {
            if (p.status === 'Up-Next') {
                const currentUpdates = patientUpdates.get(p.id.toString()) || {};
                patientUpdates.set(p.id.toString(), { ...currentUpdates, status: 'Waiting' });
            }
        });
        // Important: map again after clearing Up-Next to ensure subsequent logic uses the correct status
        updatedSessionPatients = updatedSessionPatients.map(p => ({ ...p, ...patientUpdates.get(p.id.toString()) }));

        const inConsultation = updatedSessionPatients.find(p => p.status === 'In-Consultation');
        
        const normalWaiting = updatedSessionPatients
          .filter(p => ['Waiting', 'Priority'].includes(p.status) && !p.lateLocked)
          .sort((a, b) => {
              if (a.status === 'Priority' && b.status !== 'Priority') return -1;
              if (a.status !== 'Priority' && b.status === 'Priority') return 1;
              return (a.tokenNo || 0) - (b.tokenNo || 0);
          });
          
        const penalized = updatedSessionPatients
          .filter(p => p.lateLocked)
          .sort((a, b) => new Date(a.lateLockedAt || 0).getTime() - new Date(b.lateLockedAt || 0).getTime());

        const fullQueue: Patient[] = [];
        if (inConsultation) fullQueue.push(inConsultation);
        fullQueue.push(...normalWaiting);

        for (const p of penalized) {
          const anchorsRemaining = (p.lateAnchors || []).filter(anchorId => {
            const anchor = updatedSessionPatients.find(x => x.id === anchorId);
            return anchor && anchor.status !== 'Completed' && anchor.status !== 'Cancelled';
          });

          let lastIdx = -1;
          for (const anchorId of anchorsRemaining) {
            const idx = fullQueue.findIndex(q => q.id === anchorId);
            if (idx > lastIdx) lastIdx = idx;
          }

          const insertAt = Math.min(lastIdx + 1, fullQueue.length);
          fullQueue.splice(insertAt, 0, p);
        }
        
        const liveQueue = inConsultation ? fullQueue.slice(1) : [...fullQueue];
        
        // Designate the new "Up-Next" patient
        if (liveQueue.length > 0) {
            const upNextPatient = liveQueue[0];
            const currentUpdates = patientUpdates.get(upNextPatient.id.toString()) || {};
            // Only set to Up-Next if they are currently Waiting or Late (and not already Priority)
            if (['Waiting', 'Late'].includes(upNextPatient.status)) {
                patientUpdates.set(upNextPatient.id.toString(), { ...currentUpdates, status: 'Up-Next' });
            }
        }
        
        let effectiveDoctorStartTime: Date;
        if (doctorStatus.isOnline && doctorStatus.onlineTime) {
            effectiveDoctorStartTime = max([now, toDate(doctorStatus.onlineTime)!, delayedClinicStartTime]);
        } else {
            effectiveDoctorStartTime = delayedClinicStartTime;
        }

        if (inConsultation && inConsultation.consultationStartTime) {
            const expectedEndTime = new Date(toDate(inConsultation.consultationStartTime)!.getTime() + schedule.slotDuration * 60000);
            effectiveDoctorStartTime = max([now, expectedEndTime]);
        }
        
        liveQueue.forEach((p, i) => {
            let bestCaseETCValue: Date;
            if (i === 0) {
                bestCaseETCValue = effectiveDoctorStartTime;
            } else {
                const previousPatientETC = patientUpdates.get(liveQueue[i - 1].id.toString())?.bestCaseETC || liveQueue[i-1].bestCaseETC!;
                bestCaseETCValue = new Date(
                    toDate(previousPatientETC)!.getTime() + schedule.slotDuration * 60000
                );
            }
            
            const currentUpdates = patientUpdates.get(p.id.toString()) || {};
            let finalUpdates: Partial<Patient> = { ...currentUpdates, bestCaseETC: bestCaseETCValue.toISOString() };

            const worstETC = finalUpdates.worstCaseETC || p.worstCaseETC;
            if (worstETC && bestCaseETCValue && toDate(worstETC)! < bestCaseETCValue) {
                finalUpdates.worstCaseETC = bestCaseETCValue.toISOString();
            }
            
            if (i === 0) {
                finalUpdates.worstCaseETC = bestCaseETCValue.toISOString();
            }

            patientUpdates.set(p.id.toString(), finalUpdates);
        });

        if (inConsultation) {
            const currentUpdates = patientUpdates.get(inConsultation.id.toString()) || {};
            const bestETC = currentUpdates.bestCaseETC || inConsultation.bestCaseETC || inConsultation.consultationStartTime;
            if (bestETC) {
                const worstETC = new Date(toDate(bestETC)!.getTime() + schedule.slotDuration * 60000).toISOString();
                patientUpdates.set(inConsultation.id.toString(), { ...currentUpdates, worstCaseETC: worstETC });
            }
        }
    }
    
    const updatedPatients = allPatients.map(p => {
        if (patientUpdates.has(p.id.toString())) {
            return { ...p, ...patientUpdates.get(p.id.toString()) };
        }
        return p;
    });

    await updateAllPatients(updatedPatients);

    revalidatePath('/');
    revalidatePath('/dashboard');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/queue-status');
    revalidatePath('/tv-display');
    revalidatePath('/api/patients');
    revalidatePath('/walk-in');
    return { success: `Queue recalculated for all sessions.` };
}

export async function updateTodayScheduleOverrideAction(override: SpecialClosure) {
    await updateTodayScheduleOverrideData(override);
    await recalculateQueueWithETC();
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/dashboard');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    revalidatePath('/api/schedule');
    revalidatePath('/walk-in');
    return { success: "Today's schedule has been updated." };
}

export async function updatePatientPurposeAction(patientId: number, purpose: string) {
    await updatePatient(patientId, { purpose });
    await recalculateQueueWithETC();
    revalidatePath('/');
    revalidatePath('/dashboard');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/queue-status');
    revalidatePath('/tv-display');
    revalidatePath('/api/patients');
    revalidatePath('/walk-in');
    return { success: 'Visit purpose updated.' };
}

export async function updateDoctorScheduleAction(schedule: Partial<DoctorSchedule>) {
    const updated = await updateDoctorSchedule(schedule);
    await recalculateQueueWithETC();
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/dashboard');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    revalidatePath('/api/schedule');
    revalidatePath('/walk-in');
    return { success: 'Doctor schedule updated successfully.', schedule: updated };
}

export async function updateClinicDetailsAction(details: ClinicDetails) {
    await updateClinicDetailsData(details);
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/dashboard');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    revalidatePath('/api/schedule');
    revalidatePath('/walk-in');
    return { success: 'Clinic details updated successfully.' };
}

export async function updateSmsSettingsAction(smsSettings: SmsSettings) {
    await updateSmsSettingsData(smsSettings);
     revalidatePath('/');
    revalidatePath('/admin');
    return { success: 'SMS settings updated successfully.' };
}

export async function updatePaymentGatewaySettingsAction(paymentGatewaySettings: PaymentGatewaySettings) {
    await updatePaymentGatewaySettingsData(paymentGatewaySettings);
     revalidatePath('/');
    revalidatePath('/admin');
    return { success: 'Payment Gateway settings updated successfully.' };
}

export async function updateSpecialClosuresAction(closures: SpecialClosure[]) {
    await updateSpecialClosures(closures);
    await recalculateQueueWithETC();
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/dashboard');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    revalidatePath('/api/schedule');
    revalidatePath('/walk-in');
    return { success: 'Special closures updated successfully.' };
}

export async function updateVisitPurposesAction(purposes: VisitPurpose[]) {
    await updateVisitPurposesData(purposes);
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/dashboard');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    revalidatePath('/api/schedule');
    revalidatePath('/walk-in');
    return { success: 'Visit purposes updated successfully.' };
}

export async function updateFamilyMemberAction(member: FamilyMember) {
    await updateFamilyMember(member);
revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/dashboard');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    revalidatePath('/api/family');
    revalidatePath('/walk-in');
    return { success: 'Family member updated.' };
}

export async function cancelAppointmentAction(appointmentId: number) {
    const patient = await cancelAppointment(appointmentId);
if (patient) {
        await recalculateQueueWithETC();
        revalidatePath('/');
        revalidatePath('/dashboard');
        revalidatePath('/booking');
        revalidatePath('/patient-portal');
        revalidatePath('/queue-status');
        revalidatePath('/tv-display');
        revalidatePath('/api/patients');
        revalidatePath('/walk-in');
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
        lateLocked: false,
        lateAnchors: undefined,
        lateLockedAt: undefined,
    });
    
    await recalculateQueueWithETC();

    revalidatePath('/');
    revalidatePath('/dashboard');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/queue-status');
    revalidatePath('/tv-display');
    revalidatePath('/api/patients');
    revalidatePath('/walk-in');

    return { success: 'Appointment rescheduled successfully.' };
}

export async function getFamilyAction() {
    return getFamily();
}

export async function markPatientAsLateAndCheckInAction(patientId: number, penalty: number) {
  const allPatients = await getPatientsData();
  const patient = allPatients.find((p: Patient) => p.id === patientId);
  if (!patient) return { error: 'Patient not found.' };

  const now = new Date();
  const slotTime = patient.slotTime ? parseISO(patient.slotTime) : parseISO(patient.appointmentTime);
  const basis = patient.bestCaseETC ? max([slotTime, parseISO(patient.bestCaseETC)]) : slotTime;
  const lateBy = Math.max(0, Math.round((now.getTime() - basis.getTime()) / 60000));

  // Snapshot waiting queue for TODAY, exclude in-consultation and the target patient
  const todayStr = format(toZonedTime(new Date(), timeZone), 'yyyy-MM-dd');
  const waitingSnapshot = allPatients
    .filter((p: Patient) => format(toZonedTime(parseISO(p.appointmentTime), timeZone), 'yyyy-MM-dd') === todayStr)
    .filter((p: Patient) => p.id !== patientId && ['Waiting', 'Up-Next', 'Late', 'Priority'].includes(p.status))
    .sort((a: Patient, b: Patient) => {
       if (a.status === 'Priority' && b.status !== 'Priority') return -1;
       if (a.status !== 'Priority' && b.status === 'Priority') return 1;
       if (a.status === 'Up-Next' && b.status !== 'Up-Next') return -1;
       if (a.status !== 'Up-Next' && b.status === 'Up-Next') return 1;
       return (a.tokenNo || 0) - (b.tokenNo || 0);
    });

  const anchors = waitingSnapshot.slice(0, penalty).map(p => p.id);

  const updates: Partial<Patient> = {
    status: 'Late',
    checkInTime: now.toISOString(),
    lateBy,
    latePenalty: penalty,
    lateLocked: true,
    lateAnchors: anchors,
    lateLockedAt: now.toISOString()
  };

  await updatePatient(patientId, updates);

  await recalculateQueueWithETC();

  revalidatePath('/');
  revalidatePath('/dashboard');
  revalidatePath('/tv-display');
  revalidatePath('/queue-status');
  revalidatePath('/patient-portal');
  revalidatePath('/booking');
  revalidatePath('/walk-in');

  return { success: `Marked late and pushed down by ${penalty}.` };
}

// ========================================================================================
// ========================================================================================
// ==  FIND THIS SECTION TO INTEGRATE YOUR SMS PROVIDER ===================================
// ========================================================================================
// ========================================================================================
// The code below handles OTP generation and sending.
// The 'fetch' call to the SMS provider is currently commented out.
// You need to:
// 1. Uncomment the 'try...catch' block.
// 2. Replace the placeholder 'apiUrl' with the one from your SMS provider.
// 3. Adjust the 'headers' and 'body' of the fetch call to match your provider's API documentation.
// ========================================================================================
export async function checkUserAuthAction(phone: string) {
    const user = await findPrimaryUserByPhone(phone);
    if (user) {
        // For existing users, we can proceed to OTP verification.
    }

    // For new or existing users, generate and send OTP.
    const schedule = await getDoctorScheduleData();
    const smsSettings = schedule.smsSettings;

    if (!smsSettings || !smsSettings.provider || !smsSettings.provider.toLowerCase().includes('bulksms') || !smsSettings.apiKey || !smsSettings.senderId) {
        console.error("SMS settings for BulkSMS are not configured in the admin panel.");
        return { error: "SMS service is not configured. Please contact support." };
    }
    
    const apiKey = smsSettings.apiKey;
    const senderId = smsSettings.senderId;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // In a real implementation, you would send the OTP via your SMS provider here.
    // The following is a placeholder to show where the API call would go.
    // You will need to replace the URL, headers, and body with the correct
    // values for your specific SMS provider (e.g., BulkSMS, Twilio).
    console.log(`Simulating OTP send: To=${phone}, OTP=${otp}, Provider=${smsSettings.provider}`);
    
    /*
    try {
        const apiUrl = 'https://account.bulksms.services/index.php/api/bulk-sms.html'; // <--- REPLACE THIS
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}` // Or a different auth method
            },
            body: JSON.stringify({
                to: phone,
                from: senderId,
                message: `Your OTP to login to Shanti Children's Clinic Appointments Booking is: {#var#}`
                // The body structure will vary based on your provider's API.
            })
        });

        if (!response.ok) {
            console.error('SMS API response not OK:', await response.text());
            throw new Error('Failed to send OTP');
        }
        
        console.log('OTP sent successfully via API.');

    } catch (error) {
        console.error("SMS API Error:", error);
        return { error: "Failed to send OTP. Please try again later." };
    }
    */
  
    
    // Return the generated OTP for verification on the client side.
    // In a production app, you might store this OTP in a temporary server-side
    // cache (like Redis) with an expiry, and verify it in a separate action.
    return { userExists: !!user, otp: otp, user: user || undefined };
}

export async function registerUserAction(userData: Omit<FamilyMember, 'id' | 'avatar'>) {
    const newPrimaryMember: Omit<FamilyMember, 'id' | 'avatar'> = {
        ...userData,
        isPrimary: true
    };
    const newMember = await addFamilyMember(newPrimaryMember);
    revalidatePath('/api/family');
    return { success: true, user: newMember };
}
    

export async function advanceQueueAction(patientIdToBecomeUpNext: number) {
  // Step 1: Complete the current 'In-Consultation' patient
  let allPatients = await getPatientsData();
  const nowServing = allPatients.find(p => p.status === 'In-Consultation');
  
  if (nowServing && nowServing.consultationStartTime) {
    const startTime = toDate(nowServing.consultationStartTime)!;
    const endTime = new Date();
    await updatePatient(nowServing.id, {
      status: 'Completed',
      consultationEndTime: endTime.toISOString(),
      consultationTime: Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)),
      subStatus: undefined,
      lateLocked: false,
    });
  }

  // Step 2: Move the current 'Up Next' patient to 'In-Consultation'
  // Re-fetch patients to get the latest state after the completion
  allPatients = await getPatientsData(); 
  const upNext = allPatients.find(p => p.status === 'Up-Next');
  
  if (upNext) {
    await updatePatient(upNext.id, {
      status: 'In-Consultation',
      consultationStartTime: new Date().toISOString(),
      subStatus: undefined,
      lateLocked: false,
    });
  }

  // Step 3: Set the selected patient to 'Up-Next'
  await updatePatient(patientIdToBecomeUpNext, { status: 'Up-Next' });

  // Recalculate the entire queue with the new statuses
  await recalculateQueueWithETC();

  // Revalidate all paths
  revalidatePath('/');
  revalidatePath('/dashboard');
  revalidatePath('/booking');
  revalidatePath('/patient-portal');
  revalidatePath('/queue-status');
  revalidatePath('/tv-display');
  revalidatePath('/api/patients');
  revalidatePath('/walk-in');

  return { success: 'Queue advanced successfully.' };
}
    
export async function startLastConsultationAction(patientId: number) {
  // Step 1: Complete any currently serving patient
  let allPatients = await getPatientsData();
  const nowServing = allPatients.find(p => p.status === 'In-Consultation');
  
  if (nowServing && nowServing.consultationStartTime) {
    const startTime = toDate(nowServing.consultationStartTime)!;
    const endTime = new Date();
    await updatePatient(nowServing.id, {
      status: 'Completed',
      consultationEndTime: endTime.toISOString(),
      consultationTime: Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)),
      subStatus: undefined,
      lateLocked: false,
    });
  }

  // Step 2: Move the target patient (who was Up-Next) to In-Consultation
  await updatePatient(patientId, {
    status: 'In-Consultation',
    consultationStartTime: new Date().toISOString(),
    lateLocked: false,
  });

  // Recalculate the queue to reflect the final state
  await recalculateQueueWithETC();

  // Revalidate all paths
  revalidatePath('/');
  revalidatePath('/dashboard');
  revalidatePath('/booking');
  revalidatePath('/patient-portal');
  revalidatePath('/queue-status');
  revalidatePath('/tv-display');
  revalidatePath('/api/patients');
  revalidatePath('/walk-in');

  return { success: 'Started final consultation.' };
}

export async function updateNotificationsAction(notifications: Notification[]) {
    await updateNotificationData(notifications);
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    return { success: 'Notifications updated successfully.' };
}

export async function deleteFamilyMemberAction(id: string) {
    await deleteFamilyMemberData(id);
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/dashboard');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    revalidatePath('/api/family');
    revalidatePath('/walk-in');
    return { success: 'Family member deleted.' };
}

export async function getEasebuzzAccessKey(amount: number, email: string, phone: string, name: string) {
  'use server';

  const schedule = await getDoctorScheduleData();
  const paymentSettings = schedule.paymentGatewaySettings;

  if (!paymentSettings || paymentSettings.provider !== 'easebuzz' || !paymentSettings.key || !paymentSettings.salt) {
    return { error: 'Easebuzz payment gateway is not configured correctly.' };
  }

  const txnid = `TXN_${Date.now()}`;
  const productinfo = 'Clinic Appointment Booking';
  const surl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002'}/booking/my-appointments?status=success`;
  const furl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002'}/booking/my-appointments?status=failure`;
  const amountStr = amount.toFixed(2);

  const hashString = `${paymentSettings.key}|${txnid}|${amountStr}|${productinfo}|${name}|${email}|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|${paymentSettings.salt}`;
  const hash = createHash('sha512').update(hashString).digest('hex');

  const easebuzzPayload = new URLSearchParams();
  easebuzzPayload.append('key', paymentSettings.key);
  easebuzzPayload.append('txnid', txnid);
  easebuzzPayload.append('amount', amountStr);
  easebuzzPayload.append('productinfo', productinfo);
  easebuzzPayload.append('firstname', name);
  easebuzzPayload.append('email', email);
  easebuzzPayload.append('phone', phone);
  easebuzzPayload.append('surl', surl);
  easebuzzPayload.append('furl', furl);
  easebuzzPayload.append('hash', hash);

  const baseUrl = paymentSettings.environment === 'test'
    ? 'https://testpay.easebuzz.in'
    : 'https://pay.easebuzz.in';

  try {
    const response = await fetch(`${baseUrl}/initiate_seamless_payment/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: easebuzzPayload.toString(),
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('Easebuzz API Error Response:', errorText);
        return { error: `Failed to connect to payment gateway. Gateway message: ${errorText}` };
    }

    const result = await response.json();

    if (result.status === 1) {
      return { success: true, access_key: result.data };
    } else {
      console.error('Easebuzz Initiation Error:', result);
      return { error: result.error_Message || result.error_message || 'Failed to initiate payment from gateway.' };
    }
  } catch (error) {
    console.error('Easebuzz API connection error:', error);
    return { error: 'Could not connect to the payment gateway.' };
  }
}

export async function joinQueueAction(member: FamilyMember, purpose: string) {
  const schedule = await getDoctorScheduleData();
  const allPatients = await getPatientsData();

  if (!schedule) return { error: 'Clinic schedule not found.' };

  const now = new Date();
  const todayStr = format(toZonedTime(now, timeZone), 'yyyy-MM-dd');
  const dayOfWeek = format(toZonedTime(now, timeZone), 'EEEE') as keyof DoctorSchedule['days'];

  let daySchedule = schedule.days[dayOfWeek];
  if (!daySchedule) return { error: 'Clinic schedule not set for today.' };

  const specialClosure = schedule.specialClosures.find(c => c.date === todayStr);
  if (specialClosure) {
    daySchedule = {
      morning: specialClosure.morningOverride ?? daySchedule.morning,
      evening: specialClosure.eveningOverride ?? daySchedule.evening,
    };
  }

  const getSessionDetails = (sessionName: 'morning' | 'evening'): { name: 'morning' | 'evening'; schedule: Session; startUtc: Date, endUtc: Date } | null => {
    const session = daySchedule[sessionName];
    const isClosedByOverride = sessionName === 'morning' ? specialClosure?.isMorningClosed : specialClosure?.isEveningClosed;
    if (!session.isOpen || isClosedByOverride) return null;
    
    return {
      name: sessionName,
      schedule: session,
      startUtc: sessionLocalToUtc(todayStr, session.start),
      endUtc: sessionLocalToUtc(todayStr, session.end)
    };
  };

  const morningDetails = getSessionDetails('morning');
  const eveningDetails = getSessionDetails('evening');
  
  let targetSessionDetails: { name: 'morning' | 'evening'; schedule: Session; startUtc: Date, endUtc: Date } | null = null;
  
  // Logic to find the current or next available session
  if (morningDetails && now < morningDetails.endUtc) {
    targetSessionDetails = morningDetails;
  } else if (eveningDetails && now < eveningDetails.endUtc) {
    targetSessionDetails = eveningDetails;
  }

  if (!targetSessionDetails) {
    return { error: 'The clinic is closed for today. No upcoming sessions available.' };
  }
  
  const { schedule: sessionSchedule, startUtc: sessionStartUtc, endUtc: sessionEndUtc, name: sessionName } = targetSessionDetails;
  
  const registrationOpenTime = subMinutes(sessionStartUtc, 30);
  if (now < registrationOpenTime) {
      return { error: `Walk-in registration for the ${sessionName} session opens at ${format(toZonedTime(registrationOpenTime, timeZone), 'hh:mm a')}.` };
  }
  if (now > sessionEndUtc) {
      return { error: `The ${sessionName} session is over. Walk-ins are no longer accepted.` };
  }

  // Set the starting point for slot search to be 'now' or session start, whichever is later.
  let searchStartTime = max([now, sessionStartUtc]);

  // Align search start time to the next slot duration interval
  const minutesFromSessionStart = differenceInMinutes(searchStartTime, sessionStartUtc);
  const intervalsPast = Math.ceil(minutesFromSessionStart / schedule.slotDuration);
  let currentSlotTime = addMinutes(sessionStartUtc, intervalsPast * schedule.slotDuration);
  let slotIndex = intervalsPast;
  
  let availableSlot: Date | null = null;
  
  const reservationStrategy = schedule.walkInReservation;

  // First, check for reserved walk-in slots
  if (reservationStrategy !== 'none') {
      while (currentSlotTime < sessionEndUtc) {
        const isBooked = allPatients.some(p => p.status !== 'Cancelled' && Math.abs(differenceInMinutes(parseISO(p.appointmentTime), currentSlotTime)) < 1);
        
        if (!isBooked) {
            let isReservedForWalkIn = false;
            if (schedule.reserveFirstFive && slotIndex < 5) {
                isReservedForWalkIn = true;
            }

            const startIndexForAlternate = schedule.reserveFirstFive ? 5 : 0;
            if (slotIndex >= startIndexForAlternate) {
                const relativeIndex = slotIndex - startIndexForAlternate;
                if (reservationStrategy === 'alternateOne' && relativeIndex % 2 !== 0) isReservedForWalkIn = true;
                if (reservationStrategy === 'alternateTwo' && (relativeIndex % 4 === 2 || relativeIndex % 4 === 3)) isReservedForWalkIn = true;
            }

            if (isReservedForWalkIn) {
              availableSlot = currentSlotTime;
              break;
            }
        }
        currentSlotTime = addMinutes(currentSlotTime, schedule.slotDuration);
        slotIndex++;
      }
  }

  // If no reserved slot was found (or strategy is 'none'), find the *very next* available unbooked slot.
  if (!availableSlot) {
      currentSlotTime = addMinutes(sessionStartUtc, intervalsPast * schedule.slotDuration);
      while (currentSlotTime < sessionEndUtc) {
           const isBooked = allPatients.some(p => p.status !== 'Cancelled' && Math.abs(differenceInMinutes(parseISO(p.appointmentTime), currentSlotTime)) < 1);
           if (!isBooked) {
               availableSlot = currentSlotTime;
               break;
           }
          currentSlotTime = addMinutes(currentSlotTime, schedule.slotDuration);
      }
  }

  if (!availableSlot) {
    return { error: 'Sorry, no walk-in slots are available at the moment.' };
  }
  
  const appointmentTime = availableSlot.toISOString();
  
  return await addAppointmentAction(member, appointmentTime, purpose, true, true);
}

    

    

    

