
// src/app/actions.ts
'use server';

function getSessionFromAppointment(apptISO: string): "morning" | "evening" {
  const hour = new Date(apptISO).getHours();
  return hour < 14 ? "morning" : "evening";
}


import { revalidatePath } from 'next/cache';
import { firestore } from '@/lib/firebase.server';
import {
  getPatients as getPatientsData,
  addPatient as addPatientData,
  updateAllPatients,
  updatePatient,
  findPatientById,
  findPatientsByPhone,
  getDoctorStatus as getDoctorStatusData,
  updateDoctorStatus,
  getDoctorSchedule as getDoctorScheduleData,
  updateDoctorSchedule,
  updateSpecialClosures,
  updateTodayScheduleOverrideData,
  updateClinicDetailsData,
  getFamilyByPhone,
  addFamilyMember,
  getFamily,
  searchFamilyMembers,
  updateFamilyMember,
  deleteFamilyMemberData,
  deleteFamilyByPhoneData,
  batchImportFamilyMembers,
  saveFeeData,
  getFeesForSessionData,
  editFeeData,
  deleteFeeData,
  convertGuestToExistingData,
  findPrimaryUserByPhone,
  updateNotificationData,
  updateSmsSettingsData,
  updatePaymentGatewaySettingsData
} from '@/lib/data';
import crypto from 'crypto';
import type {
  DoctorSchedule,
  DoctorStatus,
  Patient,
  FamilyMember,
  SpecialClosure,
  VisitPurpose,
  ClinicDetails,
  Notification,
  SmsSettings,
  PaymentGatewaySettings,
  ActionResult,
  Fee
} from '@/lib/types';

import { estimateConsultationTime } from '@/ai/flows/estimate-consultation-time';
import { sendAppointmentReminders } from '@/ai/flows/send-appointment-reminders';

import { format, parseISO } from 'date-fns';

/* ----------------------
   Basic read wrappers
   ---------------------- */

export async function getDoctorScheduleAction(): Promise<DoctorSchedule | null> {
  return await getDoctorScheduleData();
}

export async function getDoctorStatusAction(): Promise<DoctorStatus | null> {
  return await getDoctorStatusData();
}

export async function getPatientsAction(): Promise<Patient[]> {
  return await getPatientsData();
}

export async function getFamilyAction(): Promise<FamilyMember[]> {
  return await getFamily();
}

export async function getFamilyByPhoneAction(phone: string): Promise<FamilyMember[]> {
  return await getFamilyByPhone(phone);
}

export async function searchFamilyMembersAction(term: string, by: 'phone' | 'clinicId' | 'dob' | 'fatherName' | 'motherName' | 'name' = 'name') {
  return await searchFamilyMembers(term, by);
}

/* ----------------------
   Family management
   ---------------------- */

export async function addNewPatientAction(memberData: Omit<FamilyMember, 'id' | 'avatar'>) {
  if (!memberData.phone) return { error: 'Phone number is required.' };

  if (memberData.clinicId) {
    const existing = await searchFamilyMembers(memberData.clinicId, 'clinicId');
    if (existing.length > 0) return { error: 'Clinic ID already exists.' };
  }

  const newMember = await addFamilyMember(memberData);
  revalidatePath('/', 'layout');
  return { patient: newMember, success: 'Family member added successfully.' };
}

export async function updateFamilyMemberAction(member: FamilyMember): Promise<ActionResult> {
  try {
    if (member.id.startsWith('new_')) {
      const { id: _id, ...payload } = member;
      await addFamilyMember(payload);
      revalidatePath('/', 'layout');
      return { success: 'Family member created.' };
    }

    if (member.clinicId) {
      const matches = await searchFamilyMembers(member.clinicId, 'clinicId');
      const dup = matches.find(m => m.id !== member.id);
      if (dup) return { error: 'Clinic ID already used by another member.' };
    }

    await updateFamilyMember(member);
    revalidatePath('/', 'layout');
    return { success: 'Family member updated.' };
  } catch (e: any) {
    return { error: e.message || 'Failed to update family member.' };
  }
}

export async function deleteFamilyMemberAction(id: string): Promise<ActionResult> {
  await deleteFamilyMemberData(id);
  revalidatePath('/', 'layout');
  return { success: 'Family member deleted.' };
}

export async function deleteFamilyByPhoneAction(phone: string): Promise<ActionResult> {
  await deleteFamilyByPhoneData(phone);
  revalidatePath('/', 'layout');
  return { success: 'Family deleted.' };
}

export async function patientImportAction(familyJson: string, childJson: string): Promise<ActionResult> {
  try {
    const familyData = JSON.parse(familyJson);
    const childData = JSON.parse(childJson);
    await batchImportFamilyMembers(familyData, childData);
    revalidatePath('/', 'layout');
    return { success: 'Import completed.' };
  } catch (e: any) {
    return { error: e.message || 'Import failed.' };
  }
}

/* ----------------------
   Appointments & Walk-ins
   ---------------------- */

export async function addAppointmentAction(
  member: Partial<FamilyMember> | Partial<Patient>,
  appointmentIsoString: string,
  purpose: string,
  isWalkIn = false,
  markAsBookedWalkIn = false
) {
  try {
    const appointmentDate = parseISO(appointmentIsoString);

    const patientToSave: Omit<Patient, 'id'> = {
      name: (member as any).name ?? (member as any).childName ?? 'Unknown',
      phone: (member as any).phone ?? '',
      appointmentTime: appointmentDate.toISOString(),
      purpose,
      status: 'Booked',
      type: isWalkIn ? 'Walk-in' : 'Booked',
      subType: markAsBookedWalkIn ? 'Booked Walk-in' : undefined,
      createdAt: new Date().toISOString()
    } as any;

    const newPatient = await addPatientData(patientToSave);
    revalidatePath('/', 'layout');
    return { patient: newPatient, success: 'Appointment added.' };
  } catch (e: any) {
    return { error: e.message || 'Failed to add appointment.' };
  }
}

export async function rescheduleAppointmentAction(appointmentId: string, newAppointmentTime: string, newPurpose?: string): Promise<ActionResult> {
  const p = await findPatientById(appointmentId);
  if (!p) return { error: 'Patient not found.' };

  await updatePatient(appointmentId, {
    appointmentTime: newAppointmentTime,
    purpose: newPurpose ?? p.purpose
  });

  revalidatePath('/', 'layout');
  return { success: 'Appointment rescheduled.' };
}

export async function checkInPatientAction(patientId: string): Promise<ActionResult> {
  const p = await findPatientById(patientId);
  if (!p) return { error: 'Patient not found.' };

  await updatePatient(patientId, { status: 'Waiting', checkInTime: new Date().toISOString() });
  revalidatePath('/', 'layout');
  return { success: `${p.name} checked in.` };
}

export async function updatePatientStatusAction(patientId: string, status: Patient['status']): Promise<ActionResult> {
  const p = await findPatientById(patientId);
  if (!p) return { error: 'Patient not found.' };

  await updatePatient(patientId, { status });
  revalidatePath('/', 'layout');
  return { success: 'Patient status updated.' };
}

export async function cancelAppointmentAction(appointmentId: string): Promise<ActionResult> {
  const p = await findPatientById(appointmentId);
  if (!p) return { error: 'Appointment not found.' };

  await updatePatient(appointmentId, { status: 'Cancelled' });
  revalidatePath('/', 'layout');
  return { success: 'Appointment cancelled.' };
}

export async function updatePatientPurposeAction(
  patientId: string,
  purpose: string
): Promise<ActionResult> {
  const p = await findPatientById(patientId);
  if (!p) return { error: "Patient not found." };

  await updatePatient(patientId, { purpose });
  revalidatePath("/", "layout");
  return { success: "Purpose updated." };
}

export async function addGuestAppointmentAction(
  phone: string,
  name: string,
  purpose: string,
  appointmentIso: string
): Promise<ActionResult> {
  try {
    const guestData: Partial<FamilyMember> = {
      name,
      phone
    };

    const result = await addAppointmentAction(
      guestData,
      appointmentIso,
      purpose,
      true // Walk-in
    );

    return result;
  } catch (e: any) {
    return { error: e.message || "Failed to add guest appointment." };
  }
}


export async function convertGuestToExistingAction(
  guestId: string,
  phone: string
): Promise<ActionResult> {
  try {
    const result = await convertGuestToExistingData(guestId, phone);

    // Refresh UI
    revalidatePath("/", "layout");

    return { success: "Guest converted to existing patient." };
  } catch (e: any) {
    return { error: e.message || "Failed to convert guest." };
  }
}

export async function registerFamilyAction(data: {
  phone: string;
  fatherName: string;
  motherName: string;
  primaryContact: "Father" | "Mother";
  location: string;
  city: string;
  email?: string;
}): Promise<ActionResult> {
  try {
    // Create a family parent record
    await addFamilyMember({
      name: data.primaryContact === "Father" ? data.fatherName : data.motherName,
      dob: null,
      gender: null,
      phone: data.phone,
      fatherName: data.fatherName,
      motherName: data.motherName,
      primaryContact: data.primaryContact,
      location: data.location,
      city: data.city,
      email: data.email ?? ""
    });

    revalidatePath("/", "layout");

    return { success: "Family registered successfully." };
  } catch (e: any) {
    return { error: e.message || "Failed to register family." };
  }
}

// ==  SMS PROVIDER INTEGRATION ==========================================================
// ========================================================================================
// The code below handles OTP generation and sending. It is now configured for live OTPs.
// To enable live OTPs:
// 1. Configure your SMS Provider in the Admin Panel.
// 2. Adjust the 'apiUrl' and 'body' of the fetch call to match your provider's API.
// ========================================================================================
export async function checkUserAuthAction(phone: string) {
    const user = await findPrimaryUserByPhone(phone);
    
    const schedule = await getDoctorScheduleData();
    if (!schedule || !schedule.smsSettings) {
        console.error("SMS settings are not configured in the admin panel.");
        return { error: "SMS service is not available. Please contact support." };
    }
    const smsSettings = schedule.smsSettings;

    if (smsSettings.provider === 'none') {
        // console.warn("SMS provider is set to 'none'. Simulating OTP for development.");
        // return { userExists: !!user, otp: "123456", user: user || undefined, simulation: true };
    }
    
    if (smsSettings.provider === 'bulksms' && (!smsSettings.username || !smsSettings.password || !smsSettings.senderId || !smsSettings.templateId)) {
        console.error(`BulkSMS settings are incomplete.`);
        return { error: "SMS service is not configured correctly. Please contact support." };
    }

    if (smsSettings.provider === 'twilio' && (!smsSettings.apiKey || !smsSettings.senderId)) {
      console.error(`Twilio settings are incomplete.`);
      return { error: "SMS service is not configured correctly. Please contact support." };
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const message = `${otp} is the OTP to login to Shanti Children's Clinic app to book appointment with Dr Baswaraj Tandur.`;
    
    try {
        let apiUrl = '';
        
        if (smsSettings.provider === 'bulksms') {
          apiUrl = `http://www.metamorphsystems.com/index.php/api/bulk-sms?username=${smsSettings.username}&password=${encodeURIComponent(smsSettings.password!)}&from=${smsSettings.senderId}&to=${phone}&message=${encodeURIComponent(message)}&sms_type=2&template_id=${smsSettings.templateId}`;
        } else if (smsSettings.provider === 'twilio') {
          // You would configure your Twilio logic here
          // Example:
          // const twilioClient = require('twilio')(smsSettings.apiKey, smsSettings.password);
          // await twilioClient.messages.create({ body: message, from: smsSettings.senderId, to: phone });
          console.warn("Twilio provider selected but sending logic is not fully implemented in actions.ts.");
          return { error: "Twilio SMS sending is not yet configured by the developer." };
        }

        const response = await fetch(apiUrl);

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
    
    return { userExists: !!user, otp: otp, user: user || undefined, simulation: false };
}

// -----------------------------------------------------------------------------
// SEND PAYMENT SUCCESS SMS (BulkSMS / Metamorph Systems)
// -----------------------------------------------------------------------------

export async function sendPaymentSuccessSMSAction({
  phone,
  patientName,
  appointmentTime,
  tokenNo,
  clinicName,
}: {
  phone: string;
  patientName: string;
  appointmentTime: string;
  tokenNo: string | number;
  clinicName: string;
}) {
  try {
    const schedule = await getDoctorScheduleData();
    const smsSettings = schedule?.smsSettings;

    if (!smsSettings || smsSettings.provider === "none") {
      return { success: "SMS disabled" };
    }

    if (smsSettings.provider === "bulksms") {
      if (
        !smsSettings.username ||
        !smsSettings.password ||
        !smsSettings.senderId ||
        !smsSettings.templateId
      ) {
        return { error: "SMS settings incomplete." };
      }

      // FINAL DLT-COMPLIANT PAYMENT CONFIRMATION TEMPLATE
      const message =
        `Your appointment is confirmed. Thank you.\n` +
        `Name: ${patientName}\n` +
        `Token: ${tokenNo}\n` +
        `Time: ${appointmentTime} (It is the expected consultation time and may vary depending on the real time clinic flow. Please check the live queue for your actual turn.)`;

      const apiUrl =
        `http://www.metamorphsystems.com/index.php/api/bulk-sms` +
        `?username=${smsSettings.username}` +
        `&password=${encodeURIComponent(smsSettings.password)}` +
        `&from=${smsSettings.senderId}` +
        `&to=${phone}` +
        `&message=${encodeURIComponent(message)}` +
        `&sms_type=2` +
        `&template_id=${smsSettings.templateId}`;

      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("BulkSMS sending failed:", errorText);
        return { error: "SMS sending failed" };
      }

      return { success: "SMS sent" };
    }

    return { error: "Unknown SMS provider" };

  } catch (error: any) {
    return { error: error.message || "Failed to send SMS" };
  }
}


/* ----------------------
   Queue thin wrappers
   ---------------------- */

export async function consultNextAction(): Promise<ActionResult> {
  const patients = await getPatientsData();
  const upNext = patients.find(p => p.status === 'Up-Next');
  if (!upNext) return { error: 'No Up-Next patient.' };

  await updatePatient(upNext.id, { status: 'In-Consultation', consultationStartTime: new Date().toISOString() });
  revalidatePath('/', 'layout');
  return { success: 'Consultation started.' };
}

export async function markPatientAsLateAndCheckInAction(patientId: string, penaltyMinutes = 0): Promise<ActionResult> {
  await updatePatient(patientId, { status: 'Late', lateBy: penaltyMinutes, checkInTime: new Date().toISOString() });
  revalidatePath('/', 'layout');
  return { success: 'Patient marked late and checked in.' };
}

export async function joinQueueAction(
  member: Partial<FamilyMember>,
  purpose: string
): Promise<ActionResult> {
  const newPatient = await addPatientData({
    ...member,
    purpose,
    status: "Waiting",
    type: "Walk-in",
    createdAt: new Date().toISOString()
  } as any);

  revalidatePath("/", "layout");
  return { patient: newPatient, success: "Joined queue." };
}


/* ----------------------
   Doctor status / schedule wrappers
   ---------------------- */

export async function setDoctorStatusAction(update: Partial<DoctorStatus>): Promise<ActionResult> {
  await updateDoctorStatus(update);
  revalidatePath('/', 'layout');
  return { success: 'Doctor status updated.' };
}

export async function updateDoctorScheduleActionHandler(schedule: Partial<DoctorSchedule>): Promise<ActionResult> {
  try {
    await updateDoctorSchedule(schedule);
    revalidatePath('/', 'layout');
    return { success: 'Schedule updated.' };
  } catch (e: any) {
    return { error: e.message || 'Failed to update schedule.' };
  }
}

export async function updateTodayScheduleOverrideActionHandler(override: SpecialClosure): Promise<ActionResult> {
  await updateTodayScheduleOverrideData(override);
  revalidatePath('/', 'layout');
  return { success: 'Schedule override saved.' };
}

export async function updateDoctorStartDelayAction(delayMinutes: number): Promise<ActionResult> {
  await updateDoctorStatus({ startDelay: delayMinutes });
  revalidatePath('/', 'layout');
  return { success: 'Doctor start delay updated.' };
}

/* ----------------------
   Admin helpers
   ---------------------- */

export async function emergencyCancelAction(): Promise<ActionResult> {
  const patients = await getPatientsData();
  const toCancel = patients.filter(p => !['Completed', 'Cancelled'].includes(p.status));
  await Promise.all(toCancel.map(p => updatePatient(p.id, { status: 'Cancelled' })));
  revalidatePath('/', 'layout');
  return { success: 'All active appointments cancelled.' };
}

/* ----------------------
   Notifications & reminders
   ---------------------- */

export async function sendReminderAction(patientId: string): Promise<ActionResult> {
  try {
    const patient = await findPatientById(patientId);
    if (!patient) return { error: "Patient not found." };

    await sendAppointmentReminders({
      patientName: patient.name,
      clinicName: "Shanti Children’s Clinic",
      appointmentTime: patient.appointmentTime,
      estimatedWaitTime: "0 minutes",
      phoneNumber: patient.phone,
    });

    return { success: "Reminder sent." };
  } catch (e: any) {
    return { error: e.message || "Failed to send reminder." };
  }
}


/* ----------------------
   Fees
   ---------------------- */

export async function saveFeeAction(feeData: Omit<Fee, 'id' | 'createdAt' | 'createdBy' | 'session' | 'date'>, existingFeeId?: string): Promise<ActionResult> {
  try {
    const patient = await findPatientById(feeData.patientId);
    if (!patient) return { error: 'Patient not found.' };

    const dateStr = format(parseISO(patient.appointmentTime), 'yyyy-MM-dd');

    const id = existingFeeId ?? crypto.randomUUID();
    
const session: "morning" | "evening" = getSessionFromAppointment(patient.appointmentTime);

const fullFee: Fee = {
  ...feeData,
  id,
  date: dateStr,
  session,
  createdBy: "reception",
  createdAt: new Date().toISOString()
};


    await saveFeeData(fullFee);
    await updatePatient(feeData.patientId, { purpose: feeData.purpose, feeStatus: feeData.amount > 0 ? 'Paid' : 'Pending' });
    revalidatePath('/', 'layout');
    return { success: 'Fee saved.' };
  } catch (e: any) {
    return { error: e.message || 'Failed to save fee.' };
  }
}

export async function editFeeAction(feeId: string, updates: Partial<Fee>): Promise<ActionResult> {
  await editFeeData(feeId, updates);
  revalidatePath('/', 'layout');
  return { success: 'Fee updated.' };
}

export async function deleteFeeAction(feeId: string): Promise<ActionResult> {
  await deleteFeeData(feeId);
  revalidatePath('/', 'layout');
  return { success: 'Fee deleted.' };
}

export async function getSessionFeesAction(date: string, session: 'morning' | 'evening'): Promise<Fee[]> {
  const fees = await getFeesForSessionData(session);
  return fees.filter(f => f.date === date);
}

/* ----------------------
   Admin settings
   ---------------------- */

export async function updateClinicDetailsAction(details: ClinicDetails): Promise<ActionResult> {
  await updateClinicDetailsData(details);
  revalidatePath('/', 'layout');
  return { success: 'Clinic details updated.' };
}

export async function updateNotificationDataAction(notifications: Notification[]): Promise<ActionResult> {
  await updateNotificationData(notifications);
  revalidatePath('/', 'layout');
  return { success: 'Notifications updated.' };
}

export async function updateSmsSettingsDataAction(s: SmsSettings): Promise<ActionResult> {
  await updateSmsSettingsData(s);
  revalidatePath('/', 'layout');
  return { success: 'SMS settings updated.' };
}

export async function updatePaymentGatewaySettingsDataAction(p: PaymentGatewaySettings): Promise<ActionResult> {
  await updatePaymentGatewaySettingsData(p);
  revalidatePath('/', 'layout');
  return { success: 'Payment settings updated.' };
}

/* ----------------------
   Manual Recalc (sentinel)
   ---------------------- */

export async function manualRecalculateAction(): Promise<ActionResult> {
  try {
    await firestore.collection('_ops').doc('recalc').set({
      triggeredAt: Date.now()
    });
    return { success: 'Manual recalculation triggered.' };
  } catch (e: any) {
    return { error: e.message || 'Failed to trigger recalculation.' };
  }
}

// --- Backward compatibility wrappers for Admin pages ---

export async function updateDoctorScheduleAction(
  updated: Partial<DoctorSchedule>
) {
  const result = await updateDoctorScheduleActionHandler(updated);

  if ("error" in result) return result;

  // fetch the updated schedule from database
  const updatedSchedule = await getDoctorScheduleData();

  return {
    success: "Schedule updated.",
    schedule: updatedSchedule
  };
}


export async function updateSpecialClosuresAction(closures: SpecialClosure[]) {
  await updateSpecialClosures(closures);
  revalidatePath("/", "layout");
  return { success: "Special closures updated." };
}

export async function updateVisitPurposesAction(purposes: VisitPurpose[]) {
  try {
    await firestore.collection("settings").doc("visitPurposes").set({ purposes });
    revalidatePath("/", "layout");
    return { success: "Visit purposes updated." };
  } catch (e: any) {
    return { error: e.message || "Failed to update purposes." };
  }
}


export async function updateNotificationsAction(notifications: Notification[]) {
  return updateNotificationDataAction(notifications);
}

export async function updateSmsSettingsAction(s: SmsSettings) {
  return updateSmsSettingsDataAction(s);
}

export async function updatePaymentGatewaySettingsAction(p: PaymentGatewaySettings) {
  return updatePaymentGatewaySettingsDataAction(p);
}

// ---------- Easebuzz helpers (server) ----------

/**
 * Return the Easebuzz keys.
 * You can replace this implementation to read keys from Firestore (admin) or process.env.
 */
export async function getEasebuzzAccessKeyAction() {
  // Load schedule from Firestore (doctor settings document)
  const schedule = await getDoctorScheduleData();

  const settings = schedule?.paymentGatewaySettings;

  if (!settings || settings.provider !== "easebuzz") {
    return { error: "Payment gateway not configured" };
  }

  // Decide pay URL based on environment
  const payUrl =
    settings.environment === "test"
      ? "https://testpay.easebuzz.in/pay"
      : "https://pay.easebuzz.in/pay";

  return {
    success: "ok",
    data: {
      merchantKey: settings.key,
      salt: settings.salt,
      payUrl,
      environment: settings.environment,
    }
  };
}

/**
 * Create an Easebuzz payment session payload.
 * Returns the form fields required to post to Easebuzz.
 *
 * NOTE: This does NOT call Easebuzz. Instead we compute txnid + hash and return the form fields to the client,
 * which will post a form to Easebuzz's /pay endpoint (test).
 *
 * Required args:
 * - amount (string or number)
 * - firstname (string)
 * - email (string) - optional but used in hash
 * - phone (string)
 * - productinfo (string)
 * - bookingId (string) - used as txnid suffix / reference
 */
export async function createEasebuzzPaymentSessionAction({
  amount,
  firstname,
  email,
  phone,
  productinfo,
  bookingId
}: {
  amount: string | number;
  firstname: string;
  email?: string;
  phone: string;
  productinfo?: string;
  bookingId?: string;
}) {
  // Load merchant key, salt, environment from admin settings
  const keyRes = await getEasebuzzAccessKeyAction();
  if ("error" in keyRes) return keyRes;

  const { merchantKey, salt, payUrl } = keyRes.data;

  // Unique transaction ID
  const txnid = `${bookingId ?? crypto.randomUUID().slice(0, 8)}_${Date.now()}`;

  const amountStr = typeof amount === "number" ? amount.toFixed(2) : amount.toString();
  const fname = firstname || "Guest";
  const mail = email || "";
  const prodInfo = productinfo || "Consultation";

  // Hash sequence per Easebuzz spec
  const hashString =
    `${merchantKey}|${txnid}|${amountStr}|${prodInfo}|${fname}|${mail}|||||||||||${salt}`;

  const hash = crypto.createHash("sha512").update(hashString).digest("hex");

  return {
    success: "ok",
    data: {
      payUrl,
      formFields: {
        key: merchantKey,
        txnid,
        amount: amountStr,
        productinfo: prodInfo,
        firstname: fname,
        email: mail,
        phone,
        hash,
        surl: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success/api`,
        furl: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/failure/api`
      }
    }
  };
}

/**
 * Verify Easebuzz payment callback response.
 * Easebuzz will POST several fields back, including status and hash.
 * We verify by recomputing the hash using the salt and the posted fields.
 *
 * The expected verification string (reverse of request hash) normally is:
 * SHA512(salt|status|||||||||||email|firstname|productinfo|amount|txnid|key)
 *
 * Accepts the object Easebuzz posts (req.body) and returns success/error.
 */
export async function verifyEasebuzzPaymentAction(easebuzzPayload: Record<string, any>) {
  try {
    const keysResult = await getEasebuzzAccessKeyAction();
    if ('error' in keysResult) return { error: 'Missing keys' };
    const { merchantKey, salt } = (keysResult as any).data;

    const status = easebuzzPayload.status ?? '';
    const txnid = easebuzzPayload.txnid ?? '';
    const amount = easebuzzPayload.amount ?? '';
    const productinfo = easebuzzPayload.productinfo ?? '';
    const firstname = easebuzzPayload.firstname ?? '';
    const email = easebuzzPayload.email ?? '';
    const postedHash = easebuzzPayload.hash ?? '';

    // Construct the reverse hash string per Easebuzz docs:
    // hashString = salt|status|||||||||||email|firstname|productinfo|amount|txnid|key
    const reverseHashString =
      `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${merchantKey}`;

    const calculated = crypto.createHash('sha512').update(reverseHashString).digest('hex');

    if (calculated === postedHash) {
      // Verified successful payment. Update Firestore records as needed.
      // e.g. mark appointment paid: updatePatient(...) or update some payments collection
      // (Implementation depends on your data model)
      return { success: 'Payment verified', data: easebuzzPayload };
    } else {
      return { error: 'Hash mismatch - verification failed' };
    }
  } catch (e: any) {
    return { error: e.message || 'Verification failed' };
  }
}

