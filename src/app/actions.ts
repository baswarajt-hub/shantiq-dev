

'use server';

import { revalidatePath } from 'next/cache';
import { addPatient as addPatientData, findPatientById, getPatients as getPatientsData, updateAllPatients, updatePatient, getDoctorStatus as getDoctorStatusData, updateDoctorStatus, getDoctorSchedule as getDoctorScheduleData, updateDoctorSchedule, updateSpecialClosures, getFamilyByPhone, addFamilyMember, getFamily, searchFamilyMembers, updateFamilyMember, cancelAppointment, updateVisitPurposesData, updateTodayScheduleOverrideData, updateClinicDetailsData, findPatientsByPhone, findPrimaryUserByPhone, updateNotificationData, deleteFamilyMember as deleteFamilyMemberData, updateSmsSettingsData, updatePaymentGatewaySettingsData, batchImportFamilyMembers, deleteFamilyByPhone as deleteFamilyByPhoneData, deleteAllFamilies as deleteAllFamiliesData } from '@/lib/data';
import type { AIPatientData, DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember, VisitPurpose, Session, ClinicDetails, Notification, SmsSettings, PaymentGatewaySettings, TranslatedMessage } from '@/lib/types';
import { estimateConsultationTime } from '@/ai/flows/estimate-consultation-time';
import { sendAppointmentReminders } from '@/ai/flows/send-appointment-reminders';
import { format, parseISO, parse, differenceInMinutes, startOfDay, max, addMinutes, subMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { createHash, randomBytes } from 'crypto';

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
    // A session must first be open in the weekly schedule.
    if (!sessionDetailsFromWeek.isOpen) return false;

    // Check if a special closure explicitly closes this session for today.
    const isClosedByOverride = (sessionName === 'morning' && todayOverride?.isMorningClosed) || (sessionName === 'evening' && todayOverride?.isEveningClosed);
    if(isClosedByOverride) return false;

    // Use override times if available, otherwise fall back to weekly schedule times.
    const sessionDetails = todayOverride?.[`${sessionName}Override`] ?? sessionDetailsFromWeek;
    
    // The override might itself be marked as not open.
    if (!sessionDetails.isOpen) {
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
  revalidatePath('/walk-in');
  
  return { success: 'Appointment booked successfully.', patient: newPatient };
}


export async function updatePatientStatusAction(patientId: string, newStatus: Patient['status']): Promise<{ success: string } | { error: string }> {
  let patients = await getPatientsData();
  const patient = patients.find(p => p.id === patientId);

  if (!patient) {
    return { error: 'Patient not found' };
  }

  const updates: Partial<Patient> = { status: newStatus };

  switch (newStatus) {
    case 'In-Consultation':
      const currentlyServing = patients.find(p => p.status === 'In-Consultation');
      if (currentlyServing && currentlyServing.id !== patientId) {
        const startTime = toDate(currentlyServing.consultationStartTime!)!;
        const endTime = new Date();
        const completedUpdates: Partial<Patient> = {
          status: 'Completed',
          consultationEndTime: endTime.toISOString(),
          consultationTime: Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)),
          subStatus: undefined,
          lateLocked: false,
          lateAnchors: undefined,
          lateLockedAt: undefined
        };
        await updatePatient(currentlyServing.id, completedUpdates);
      }
      
      updates.consultationStartTime = new Date().toISOString();
      updates.subStatus = undefined; // Clear sub-status when starting consultation
      updates.lateLocked = false;
      updates.lateAnchors = undefined;
      updates.lateLockedAt = undefined;
      break;

    case 'Completed':
      if (patient.consultationStartTime) {
        const startTime = toDate(patient.consultationStartTime)!;
        const endTime = new Date();
        updates.consultationEndTime = endTime.toISOString();
        updates.consultationTime = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // in minutes
      }
      updates.subStatus = undefined;
      updates.lateLocked = false;
      updates.lateAnchors = undefined;
      updates.lateLockedAt = undefined;
      break;

    case 'Waiting for Reports':
      updates.subStatus = 'Reports';
      break;

    case 'Cancelled':
    case 'Waiting':
    case 'Late':
    case 'Priority':
    case 'Up-Next':
      updates.subStatus = undefined; // Clear sub-status for these states
      if (newStatus !== 'Late' && newStatus !== 'Cancelled') {
        updates.lateLocked = false;
        updates.lateAnchors = undefined;
        updates.lateLockedAt = undefined;
      }
      break;
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
  
  return { success: `Patient status updated to ${newStatus}` };
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

export async function sendReminderAction(patientId: string) {
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

export async function getPatientsAction(): Promise<Patient[]> {
    return JSON.parse(JSON.stringify(await getPatientsData()));
}

export async function findPatientsByPhoneAction(phone: string) {
    await recalculateQueueWithETC();
    return JSON.parse(JSON.stringify(await findPatientsByPhone(phone)));
}


export async function getDoctorScheduleAction(): Promise<DoctorSchedule> {
    return JSON.parse(JSON.stringify(await getDoctorScheduleData()));
}

export async function getDoctorStatusAction(): Promise<DoctorStatus> {
    return JSON.parse(JSON.stringify(await getDoctorStatusData()));
}

export async function setDoctorStatusAction(status: Partial<DoctorStatus>) {
    try {
        const updates = { ...status };
        if (status.isQrCodeActive) {
            updates.walkInSessionToken = randomBytes(16).toString('hex');
        } else if (status.isQrCodeActive === false) {
            updates.walkInSessionToken = null;
        }

        const newStatus = await updateDoctorStatus(updates);
        await recalculateQueueWithETC();
        revalidatePath('/', 'layout');
        return { success: `Doctor status updated.`, status: newStatus };
    } catch (e: any) {
        return { error: e.message || "Failed to update doctor status." };
    }
}


export async function updateDoctorStartDelayAction(startDelayMinutes: number) {
    try {
        await updateDoctorStatus({ startDelay: startDelayMinutes });
        await recalculateQueueWithETC();
        revalidatePath('/');
        revalidatePath('/dashboard');
        revalidatePath('/tv-display');
        revalidatePath('/queue-status');
        revalidatePath('/patient-portal');
        revalidatePath('/booking');
        return { success: `Doctor delay updated to ${startDelayMinutes} minutes.` };
    } catch (e: any) {
        return { error: e.message || "Failed to update doctor's delay." };
    }
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

        const isActive = ['Booked', 'Confirmed', 'Waiting', 'In-Consultation', 'Priority', 'Up-Next'].includes(p.status);
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

export async function searchFamilyMembersAction(searchTerm: string): Promise<FamilyMember[]> {
    if (!searchTerm.trim()) return [];

    let effectiveSearchTerm = searchTerm;
    const ddMMyyyyRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const dateMatch = searchTerm.match(ddMMyyyyRegex);

    if (dateMatch) {
        const [, day, month, year] = dateMatch;
        effectiveSearchTerm = `${year}-${month}-${day}`;
    }

    return searchFamilyMembers(effectiveSearchTerm);
}

export async function checkInPatientAction(patientId: string) {
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
  revalidatePath('/walk-in');
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

export async function updatePatientPurposeAction(patientId: string, purpose: string) {
    try {
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
    } catch (e: any) {
        return { error: e.message || 'Failed to update visit purpose.' };
    }
}

export async function updateDoctorScheduleAction(schedule: Partial<DoctorSchedule>) {
    try {
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
    } catch (e: any) {
        return { error: e.message || 'Failed to update doctor schedule.' };
    }
}

export async function updateClinicDetailsAction(details: ClinicDetails): Promise<{success: string} | {error: string}> {
    try {
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
    } catch (e: any) {
        return { error: e.message || 'Failed to update clinic details.' };
    }
}

export async function updateSmsSettingsAction(smsSettings: SmsSettings): Promise<{success: string} | {error: string}> {
    try {
        await updateSmsSettingsData(smsSettings);
        revalidatePath('/');
        revalidatePath('/admin');
        return { success: 'SMS settings updated successfully.' };
    } catch (e: any) {
        return { error: e.message || 'Failed to update SMS settings.' };
    }
}

export async function updatePaymentGatewaySettingsAction(paymentGatewaySettings: PaymentGatewaySettings): Promise<{success: string} | {error: string}> {
    try {
        await updatePaymentGatewaySettingsData(paymentGatewaySettings);
        revalidatePath('/');
        revalidatePath('/admin');
        return { success: 'Payment Gateway settings updated successfully.' };
    } catch (e: any) {
        return { error: e.message || 'Failed to update payment gateway settings.' };
    }
}

export async function updateSpecialClosuresAction(closures: SpecialClosure[]): Promise<{success: string} | {error: string}> {
    try {
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
    } catch (e: any) {
        return { error: e.message || 'Failed to update special closures.' };
    }
}

export async function updateVisitPurposesAction(purposes: VisitPurpose[]): Promise<{success: string} | {error: string}> {
    try {
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
    } catch (e: any) {
        return { error: e.message || 'Failed to update visit purposes.' };
    }
}

export async function updateNotificationsAction(notifications: Notification[]): Promise<{success: string} | {error: string}> {
  try {
    await updateNotificationData(notifications);
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    return { success: 'Notifications updated successfully.' };
  } catch (e: any) {
    return { error: e.message || 'Failed to update notifications.' };
  }
}

export async function updateFamilyMemberAction(member: FamilyMember) {
    try {
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
    } catch (e: any) {
        return { error: e.message || 'Failed to update family member.' };
    }
}

export async function cancelAppointmentAction(appointmentId: string): Promise<{ success: string } | { error: string }> {
    try {
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
    } catch (e: any) {
        return { error: e.message || 'Failed to cancel appointment.' };
    }
}

export async function rescheduleAppointmentAction(appointmentId: string, newAppointmentTime: string, newPurpose: string) {
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

export async function markPatientAsLateAndCheckInAction(patientId: string, penalty: number) {
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
    .filter((p: Patient) => p.id !== patientId.toString() && ['Waiting', 'Up-Next', 'Late', 'Priority'].includes(p.status))
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

  await updatePatient(patient.id, updates);

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
// ==  SMS PROVIDER INTEGRATION ==========================================================
// ========================================================================================
// The code below handles OTP generation and sending. It is currently in SIMULATION mode.
// To enable live OTPs:
// 1. Configure your SMS Provider in the Admin Panel.
// 2. Uncomment the 'try...catch' block below.
// 3. Adjust the 'apiUrl' and 'body' of the fetch call to match your provider's API.
// ========================================================================================
export async function checkUserAuthAction(phone: string) {
    const user = await findPrimaryUserByPhone(phone);
    
    // For new or existing users, generate and send OTP.
    const schedule = await getDoctorScheduleData();
    if (!schedule || !schedule.smsSettings) {
        // Fail gracefully if SMS settings are not configured at all.
        console.error("SMS settings are not configured in the admin panel.");
        return { error: "SMS service is not available. Please contact support." };
    }
    const smsSettings = schedule.smsSettings;

    // FOR TESTING: Simulate success without sending SMS.
    console.log(`OTP check is in SIMULATION mode. Simulating success for ${phone}.`);
    return { userExists: !!user, otp: "123456", user: user || undefined, simulation: true };

    /*
    // --- LIVE OTP LOGIC ---
    // To enable live OTP, comment out the simulation block above and uncomment this block.

    if (smsSettings.provider === 'none') {
        // If provider is 'none', this can be treated as an error or a different kind of simulation.
        console.error("SMS provider is set to 'none'. Cannot send live OTP.");
        return { error: "SMS service is not enabled. Please contact support." };
    }

    if (!smsSettings.apiKey || !smsSettings.senderId) {
        console.error(`SMS settings for ${smsSettings.provider} are incomplete.`);
        return { error: "SMS service is not configured correctly. Please contact support." };
    }
    
    const apiKey = smsSettings.apiKey;
    const senderId = smsSettings.senderId;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // In simulation mode, we log the OTP and return it.
    console.log(`SIMULATING OTP: To=${phone}, OTP=${otp}, Provider=${smsSettings.provider}`);

    try {
        // Replace with your actual SMS provider's API endpoint.
        const apiUrl = 'https://api.your-sms-provider.com/send'; 

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}` // Or other auth method
            },
            body: JSON.stringify({
                // Adjust this body to match your provider's API requirements.
                to: phone,
                from: senderId,
                message: `Your OTP for ${schedule.clinicDetails.clinicName} is: ${otp}`
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('SMS API response not OK:', errorText);
            throw new Error('Failed to send OTP via API');
        }
        
        console.log('OTP sent successfully via live API.');

    } catch (error) {
        console.error("Live SMS API Error:", error);
        return { error: "Failed to send OTP. Please try again later." };
    }
    
    // Return the generated OTP for verification on the client side.
    return { userExists: !!user, otp: otp, user: user || undefined, simulation: false };
    */
}

export async function registerUserAction(userData: Omit<FamilyMember, 'id' | 'avatar' | 'name' | 'dob' | 'gender'>) {
    const name = userData.primaryContact === 'Father' ? userData.fatherName : userData.motherName;
    if (!name) {
        return { error: 'Primary contact name is missing.' };
    }
    
    // The user's provided fix is to destructure userData, but dob and gender aren't in the type.
    // A primary member (parent account) does not have a dob or gender.
    // The type `Omit<FamilyMember, 'id' | 'avatar' | 'name' | 'dob' | 'gender'>` confirms this.
    // The correct approach is to satisfy the target type `Omit<FamilyMember, 'id' | 'avatar'>`
    // by providing all required fields, including dob and gender, even if they are empty strings.
    const newPrimaryMember: Omit<FamilyMember, 'id' | 'avatar'> = {
        ...userData,
        name: name,
        isPrimary: true,
        dob: '', // Parent/Primary account does not have a DOB
        gender: 'Other', // Parent/Primary account does not have a gender
    };

    const newMember = await addFamilyMember(newPrimaryMember);
    revalidatePath('/api/family');
    return { success: true, user: newMember };
}
    

export async function advanceQueueAction(patientIdToBecomeUpNext: string): Promise<{ success: string } | { error: string }> {
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
    
export async function startLastConsultationAction(patientId: string): Promise<{ success: string } | { error: string }> {
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

export async function deleteFamilyByPhoneAction(phone: string) {
    await deleteFamilyByPhoneData(phone);
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/dashboard');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    revalidatePath('/api/family');
    revalidatePath('/walk-in');
    return { success: 'Family deleted.' };
}

export async function deleteAllFamiliesAction() {
    await deleteAllFamiliesData();
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/booking');
    revalidatePath('/patient-portal');
    revalidatePath('/dashboard');
    revalidatePath('/tv-display');
    revalidatePath('/queue-status');
    revalidatePath('/api/family');
    revalidatePath('/walk-in');
    revalidatePath('/family');
    return { success: 'All family records have been deleted.' };
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
    
    // Determine the target session
    if (morningDetails && now < morningDetails.endUtc) {
        targetSessionDetails = morningDetails;
    } else if (eveningDetails && now < eveningDetails.endUtc) {
        targetSessionDetails = eveningDetails;
    } else if (morningDetails && eveningDetails && now >= morningDetails.endUtc && now < eveningDetails.startUtc) {
        targetSessionDetails = eveningDetails;
    }

    if (!targetSessionDetails) {
        return { error: 'The clinic is closed for today. No upcoming sessions available.' };
    }
    
    const { startUtc: sessionStartUtc, endUtc: sessionEndUtc, name: sessionName } = targetSessionDetails;
    
    const registrationOpenTime = subMinutes(sessionStartUtc, 30);
    if (now < registrationOpenTime) {
        return { error: `Walk-in registration for the ${sessionName} session opens at ${format(toZonedTime(registrationOpenTime, timeZone), 'hh:mm a')}.` };
    }
    if (now > sessionEndUtc) {
        return { error: `The ${sessionName} session is over. Walk-ins are no longer accepted.` };
    }

    // Always start searching for a slot from the beginning of the session.
    let currentSlotTime = new Date(sessionStartUtc.getTime());
    
    let availableSlot: Date | null = null;
    
    while (currentSlotTime < sessionEndUtc) {
        const isBooked = allPatients.some(p => p.status !== 'Cancelled' && Math.abs(differenceInMinutes(parseISO(p.appointmentTime), currentSlotTime)) < 1);
        if (!isBooked) {
            availableSlot = currentSlotTime;
            break;
        }
        currentSlotTime = addMinutes(currentSlotTime, schedule.slotDuration);
    }

    if (!availableSlot) {
        return { error: 'Sorry, no walk-in slots are available at the moment.' };
    }
    
    const appointmentTime = availableSlot.toISOString();
    
    return await addAppointmentAction(member, appointmentTime, purpose, true, true);
}

export async function patientImportAction(data: Omit<FamilyMember, 'id' | 'avatar'>[]) {
    try {
        const result = await batchImportFamilyMembers(data);
        return { success: `Successfully imported ${result.successCount} patient records. Skipped ${result.skippedCount} duplicates.` };
    } catch (e: any) {
        console.error("Patient import failed:", e);
        return { error: `An error occurred during import: ${e.message}` };
    }
}
    

    

    





    


    


















    







    

    


    




    

    



