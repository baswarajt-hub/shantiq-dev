

import type { DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember, Session, VisitPurpose, ClinicDetails, Notification, SmsSettings, PaymentGatewaySettings } from './types';
import { format, parse, parseISO, startOfToday } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, addDoc, writeBatch, updateDoc, query, where, documentId, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';


// --- Firestore Collection References ---
const patientsCollection = collection(db, 'patients');
const familyCollection = collection(db, 'family');
const settingsDoc = doc(db, 'settings', 'singleton');


// --- Helper Functions ---
async function getSingletonDoc<T>(docRef: any, defaultData: T): Promise<T> {
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      // Ensure nested objects exist to prevent runtime errors on partial data
      const data = docSnap.data() as T;
      if (data && typeof data === 'object' && 'schedule' in data && (data as any).schedule && typeof (data as any).schedule === 'object') {
        const schedule = (data as any).schedule as DoctorSchedule;
        if (!schedule.specialClosures) schedule.specialClosures = [];
        if (!schedule.visitPurposes) schedule.visitPurposes = [];
        if (!schedule.notifications) schedule.notifications = [];
        if (!schedule.smsSettings) schedule.smsSettings = { provider: 'none', apiKey: '', senderId: ''};
        if (!schedule.paymentGatewaySettings) schedule.paymentGatewaySettings = { provider: 'none', key: '', salt: '', environment: 'test' };
      }
      return data;
    } else {
      // If the doc doesn't exist, create it with default data
      await setDoc(docRef, defaultData);
      return defaultData;
    }
  } catch (error) {
    console.error("Error getting singleton document:", error);
    // Return default data on error to allow the app to function minimally
    return defaultData;
  }
}


// --- Firestore Patient Functions ---

export async function getPatients(): Promise<Patient[]> {
  try {
    const patientSnapshot = await getDocs(patientsCollection);
    const patientsList = patientSnapshot.docs.map(doc => {
        const data = doc.data() as Omit<Patient, 'id'>;
        // Firestore doesn't store `undefined` but `null`. We need to handle this.
        const patientData: Patient = {
          ...data,
          id: doc.id,
          subType: data.subType || undefined,
          checkInTime: data.checkInTime || undefined,
          subStatus: data.subStatus || undefined,
          consultationTime: data.consultationTime || undefined,
          consultationStartTime: data.consultationStartTime || undefined,
          consultationEndTime: data.consultationEndTime || undefined,
          purpose: data.purpose || undefined,
          rescheduleCount: data.rescheduleCount || undefined,
          bestCaseETC: data.bestCaseETC || undefined,
          worstCaseETC: data.worstCaseETC || undefined,
          lateBy: data.lateBy || undefined,
          latePenalty: data.latePenalty || undefined,
          latePosition: data.latePosition || undefined,
          lateLocked: data.lateLocked || false,
          lateLockedAt: data.lateLockedAt || undefined,
          lateAnchors: data.lateAnchors || undefined,
        };
        return patientData;
    });
    return JSON.parse(JSON.stringify(patientsList));
  } catch (error) {
    console.error("Error getting patients from Firestore:", error);
    return [];
  }
}

export async function addPatient(patient: Omit<Patient, 'id'>): Promise<Patient> {
    const docRef = await addDoc(patientsCollection, patient);
    return { ...patient, id: docRef.id };
}

export async function addPatientData(patientData: Omit<Patient, 'id'>): Promise<Patient> {
    const docRef = await addDoc(patientsCollection, patientData);
    return { ...patientData, id: docRef.id };
}

export async function updatePatient(id: string, updates: Partial<Patient>): Promise<Patient | undefined> {
    const patientRef = doc(db, 'patients', id);
    // Convert undefined to null for Firestore compatibility
    const firestoreUpdates = Object.fromEntries(
        Object.entries(updates).map(([key, value]) => [key, value === undefined ? null : value])
    );
    await updateDoc(patientRef, firestoreUpdates);
    const updatedDoc = await getDoc(patientRef);
    if(updatedDoc.exists()) {
      return { ...(updatedDoc.data() as Omit<Patient, 'id'>), id: updatedDoc.id };
    }
    return undefined;
}

export async function findPatientById(id: string): Promise<Patient | undefined> {
  const patientRef = doc(db, 'patients', id);
  const patientSnap = await getDoc(patientRef);
  if (patientSnap.exists()) {
    return { ...(patientSnap.data() as Omit<Patient, 'id'>), id: patientSnap.id };
  }
  return undefined;
}


export async function findPatientsByPhone(phone: string): Promise<Patient[]> {
    const q = query(patientsCollection, where("phone", "==", phone));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...(doc.data() as Omit<Patient, 'id'>), id: doc.id }));
}

export async function updateAllPatients(newPatients: Patient[]): Promise<void> {
    const batch = writeBatch(db);
    newPatients.forEach(patient => {
        if (!patient.id) {
            console.error("Patient object is missing an ID:", patient);
            return; // Skip this patient
        }
        const { id, ...patientData } = patient;
        const patientRef = doc(db, "patients", id);
        
        // Convert undefined values to null before writing
        const firestorePatientData = Object.fromEntries(
          Object.entries(patientData).map(([key, value]) => [key, value === undefined ? null : value])
        );

        batch.set(patientRef, firestorePatientData, { merge: true });
    });
    await batch.commit();
}


// --- Schedule, Status, and other settings from a single document ---

const defaultStatus: DoctorStatus = {
  isOnline: false,
  onlineTime: undefined,
  startDelay: 0,
  isPaused: false,
  isQrCodeActive: false,
  walkInSessionToken: null,
};

const defaultDays = (): DoctorSchedule['days'] => {
    const emptySession = { start: "09:00", end: "13:00", isOpen: false };
    const dayTemplate = { morning: { ...emptySession }, evening: { ...emptySession } };
  
    return {
      Monday: JSON.parse(JSON.stringify(dayTemplate)),
      Tuesday: JSON.parse(JSON.stringify(dayTemplate)),
      Wednesday: JSON.parse(JSON.stringify(dayTemplate)),
      Thursday: JSON.parse(JSON.stringify(dayTemplate)),
      Friday: JSON.parse(JSON.stringify(dayTemplate)),
      Saturday: JSON.parse(JSON.stringify(dayTemplate)),
      Sunday: JSON.parse(JSON.stringify(dayTemplate)),
    };
};

const defaultSchedule: DoctorSchedule = {
  clinicDetails: {
    doctorName: 'Dr Baswaraj Tandur',
    qualifications: 'MBBS, DCH, DNB (Paediatrics), MBA',
    clinicName: 'Shanti Children\'s Clinic',
    tagLine: 'Your child\'s health is in safe hands',
    address: 'Dr Baswaraj Tandur Shanti Children\'s clinic Prajaymall complex Gowliguda Chaman, Hyderabad - 500012',
    contactNumber: '9000664833, 9398303183',
    email: 'info@shantichildrensclinic.com',
    website: 'shantichildrensclinic.com',
    consultationFee: 400,
    paymentQRCode: '',
    clinicLogo: '',
    googleMapsLink: '',
  },
  smsSettings: {
    provider: 'none',
    apiKey: '',
    senderId: ''
  },
  paymentGatewaySettings: {
    provider: 'none',
    key: '',
    salt: '',
    environment: 'test'
  },
  notifications: [],
  slotDuration: 10,
  reserveFirstFive: true,
  walkInReservation: 'alternateOne',
  days: defaultDays(),
  specialClosures: [],
  visitPurposes: [
    { id: 'vp_1', name: 'Consultation', enabled: true, description: '' },
    { id: 'vp_2', name: 'Follow-up visit', enabled: true, description: 'Next visit after paid consultation. Only one visit within 5 days of paid consultation.' },
    { id: 'vp_3', name: 'Vaccination', enabled: true, description: '' },
    { id: 'vp_4', name: 'Others', enabled: true, description: '' },
  ],
};


export async function getDoctorStatus(): Promise<DoctorStatus> {
  const settings = await getSingletonDoc(settingsDoc, { status: defaultStatus, schedule: defaultSchedule });
  return JSON.parse(JSON.stringify(settings.status || defaultStatus));
}

export async function updateDoctorStatus(statusUpdate: Partial<DoctorStatus>): Promise<DoctorStatus> {
  const settings = await getSingletonDoc(settingsDoc, { status: defaultStatus, schedule: defaultSchedule });
  
  // Create a clean update object, converting undefined to null
  const firestoreUpdates: { [key: string]: any } = {};
  for (const [key, value] of Object.entries(statusUpdate)) {
    firestoreUpdates[key] = value === undefined ? null : value;
  }
  
  const newStatus = { ...(settings.status || defaultStatus), ...firestoreUpdates };
  
  await setDoc(settingsDoc, { status: newStatus }, { merge: true });
  return newStatus;
}

export async function getDoctorSchedule(): Promise<DoctorSchedule> {
  const settings = await getSingletonDoc(settingsDoc, { status: defaultStatus, schedule: defaultSchedule });
  const data = settings.schedule || {};

  // Normalize the fetched data to ensure all fields are present.
  const normalizedSchedule: DoctorSchedule = {
    slotDuration: data.slotDuration ?? defaultSchedule.slotDuration,
    reserveFirstFive: data.reserveFirstFive ?? defaultSchedule.reserveFirstFive,
    walkInReservation: data.walkInReservation ?? defaultSchedule.walkInReservation,
    days: { ...defaultDays(), ...(data.days || {}) },
    clinicDetails: data.clinicDetails ?? defaultSchedule.clinicDetails,
    smsSettings: data.smsSettings ?? defaultSchedule.smsSettings,
    paymentGatewaySettings: data.paymentGatewaySettings ?? defaultSchedule.paymentGatewaySettings,
    notifications: data.notifications ?? defaultSchedule.notifications,
    visitPurposes: data.visitPurposes ?? defaultSchedule.visitPurposes,
    specialClosures: data.specialClosures ?? defaultSchedule.specialClosures,
  };
  
  return JSON.parse(JSON.stringify(normalizedSchedule));
}

export async function updateDoctorSchedule(scheduleUpdate: Partial<DoctorSchedule>): Promise<DoctorSchedule> {
    const currentSchedule = await getDoctorSchedule();
    const newSchedule: DoctorSchedule = {
      ...currentSchedule,
      ...scheduleUpdate,
      days: {
        ...currentSchedule.days,
        ...scheduleUpdate.days,
      },
      clinicDetails: scheduleUpdate.clinicDetails ?? currentSchedule.clinicDetails,
      smsSettings: scheduleUpdate.smsSettings ?? currentSchedule.smsSettings,
      paymentGatewaySettings: scheduleUpdate.paymentGatewaySettings ?? currentSchedule.paymentGatewaySettings,
      specialClosures: scheduleUpdate.specialClosures ?? currentSchedule.specialClosures,
      visitPurposes: scheduleUpdate.visitPurposes ?? currentSchedule.visitPurposes,
      notifications: scheduleUpdate.notifications ?? currentSchedule.notifications,
    };
    await setDoc(settingsDoc, { schedule: newSchedule }, { merge: true });
    return newSchedule;
}

export async function updateClinicDetailsData(details: ClinicDetails) {
  await setDoc(settingsDoc, { schedule: { clinicDetails: details } }, { merge: true });
}

export async function updateSmsSettingsData(smsSettings: SmsSettings) {
  await setDoc(settingsDoc, { schedule: { smsSettings: smsSettings } }, { merge: true });
}

export async function updatePaymentGatewaySettingsData(paymentGatewaySettings: PaymentGatewaySettings) {
  await setDoc(settingsDoc, { schedule: { paymentGatewaySettings: paymentGatewaySettings } }, { merge: true });
}

export async function updateVisitPurposesData(purposes: VisitPurpose[]) {
    await setDoc(settingsDoc, { schedule: { visitPurposes: purposes } }, { merge: true });
}

export async function updateSpecialClosures(closures: SpecialClosure[]) {
    await setDoc(settingsDoc, { schedule: { specialClosures: closures } }, { merge: true });
}

export async function updateTodayScheduleOverrideData(override: SpecialClosure) {
    const schedule = await getDoctorSchedule();
    const existingClosureIndex = schedule.specialClosures.findIndex(c => c.date === override.date);
    if (existingClosureIndex > -1) {
        schedule.specialClosures[existingClosureIndex] = {
            ...schedule.specialClosures[existingClosureIndex],
            ...override
        }
    } else {
        schedule.specialClosures.push(override);
    }
    await setDoc(settingsDoc, { schedule: { specialClosures: schedule.specialClosures } }, { merge: true });
}

export async function updateNotificationData(notifications: Notification[]) {
    await setDoc(settingsDoc, { schedule: { notifications: notifications } }, { merge: true });
}


// --- Family / Member specific functions ---
export async function getFamilyByPhone(phone: string): Promise<FamilyMember[]> {
    const q = query(familyCollection, where("phone", "==", phone));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...(doc.data() as Omit<FamilyMember, 'id'>), id: doc.id }));
}

export async function findPrimaryUserByPhone(phone: string): Promise<FamilyMember | null> {
    const q = query(familyCollection, where("phone", "==", phone), where("isPrimary", "==", true));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { ...(doc.data() as Omit<FamilyMember, 'id'>), id: doc.id };
    }
    return null;
}

export async function searchFamilyMembers(searchTerm: string): Promise<FamilyMember[]> {
    if (!searchTerm.trim()) return [];
    
    const familySnapshot = await getDocs(familyCollection);
    const allMembers = familySnapshot.docs.map(doc => ({ ...(doc.data() as Omit<FamilyMember, 'id'>), id: doc.id }));
    
    const lowercasedTerm = searchTerm.toLowerCase();

    const isDateSearch = /^\d{4}-\d{2}-\d{2}$/.test(searchTerm);

    const matchingMembers = allMembers.filter(member =>
        member.name.toLowerCase().includes(lowercasedTerm) ||
        (member.fatherName && member.fatherName.toLowerCase().includes(lowercasedTerm)) ||
        (member.motherName && member.motherName.toLowerCase().includes(lowercasedTerm)) ||
        member.phone.includes(searchTerm) ||
        (member.clinicId && member.clinicId.toLowerCase().includes(lowercasedTerm)) ||
        (isDateSearch && member.dob === searchTerm)
    );

    if (matchingMembers.length === 0) {
        return [];
    }

    const phoneNumbers = [...new Set(matchingMembers.map(m => m.phone))];

    return allMembers.filter(member => phoneNumbers.includes(member.phone));
}


export async function addFamilyMember(memberData: Omit<FamilyMember, 'id'>): Promise<FamilyMember> {
    const memberWithAvatar = {
        ...memberData,
        avatar: `https://picsum.photos/seed/${Math.random()}/200/200`,
    };
    const docRef = await addDoc(familyCollection, memberWithAvatar);
    return { ...memberWithAvatar, id: docRef.id };
}

export async function updateFamilyMember(updatedMember: FamilyMember): Promise<FamilyMember> {
    const { id, ...memberData } = updatedMember;
    const memberRef = doc(db, 'family', id);
    await updateDoc(memberRef, memberData);
    return updatedMember;
}

export async function batchImportFamilyMembers(data: any[]): Promise<{ successCount: number, skippedCount: number }> {
    let successCount = 0;
    let skippedCount = 0;
    const batch = writeBatch(db);

    const existingFamilySnapshot = await getDocs(familyCollection);
    const existingMembers = existingFamilySnapshot.docs.map(doc => doc.data() as FamilyMember);

    const processedPhones = new Set<string>();

    for (const row of data) {
        const phone = row.phone;
        if (!phone) continue;

        // --- Process Family (Primary) Record ---
        if (!processedPhones.has(phone)) {
            const isFamilyDuplicate = existingMembers.some(
                existing => existing.phone === phone && existing.isPrimary
            );

            if (isFamilyDuplicate) {
                // We don't increment a single skipped counter, because a family might be skipped but its patient not.
            } else {
                const primaryContactName = row.primaryContact === 'Father' ? row.fatherName : row.motherName;
                const familyRecord: Omit<FamilyMember, 'id' | 'avatar'> = {
                    phone: phone,
                    isPrimary: true,
                    name: primaryContactName,
                    fatherName: row.fatherName,
                    motherName: row.motherName,
                    primaryContact: row.primaryContact,
                    email: row.email || '',
                    location: row.location || '',
                    city: row.city || '',
                };
                const newFamilyDocRef = doc(familyCollection);
                batch.set(newFamilyDocRef, {
                    ...familyRecord,
                    avatar: `https://picsum.photos/seed/${Math.random()}/200/200`,
                });
                successCount++;
            }
            processedPhones.add(phone);
        }

        // --- Process Patient (Child) Record ---
        if (row.name && row.dob && row.gender) {
             const isPatientDuplicate = existingMembers.some(
                existing => existing.phone === phone && existing.name.toLowerCase() === row.name.toLowerCase() && !existing.isPrimary
            );
            if (isPatientDuplicate) {
                skippedCount++;
            } else {
                const patientRecord: Omit<FamilyMember, 'id'|'avatar'> = {
                    phone: phone,
                    isPrimary: false,
                    name: row.name,
                    dob: row.dob,
                    gender: row.gender,
                    clinicId: row.clinicId || '',
                     // These fields are not relevant for non-primary members
                    fatherName: row.fatherName,
                    motherName: row.motherName,
                };
                const newPatientDocRef = doc(familyCollection);
                 batch.set(newPatientDocRef, {
                    ...patientRecord,
                    avatar: `https://picsum.photos/seed/${Math.random()}/200/200`,
                });
                successCount++;
            }
        }
    }

    await batch.commit();
    return { successCount, skippedCount };
}


export async function cancelAppointment(appointmentId: string): Promise<Patient | undefined> {
    const patient = await findPatientById(appointmentId);
    if(patient){
        await updatePatient(appointmentId, { status: 'Cancelled' });
    }
    return patient;
}


export async function getFamily(): Promise<FamilyMember[]> {
    const familySnapshot = await getDocs(familyCollection);
    return familySnapshot.docs.map(doc => ({ ...(doc.data() as Omit<FamilyMember, 'id'>), id: doc.id }));
}

export async function deleteFamilyMember(id: string): Promise<void> {
    const memberRef = doc(db, 'family', id);
    await deleteDoc(memberRef);
}

export async function deleteFamilyByPhone(phone: string): Promise<void> {
    const q = query(familyCollection, where("phone", "==", phone));
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    querySnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}


export async function deleteTodaysPatientsData(): Promise<void> {
    const today = startOfToday();
    const todayTimestamp = Timestamp.fromDate(today);

    // Query for patients with an appointmentTime on or after the start of today
    const q = query(patientsCollection, where("appointmentTime", ">=", todayTimestamp.toDate().toISOString()));
    
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);

    querySnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
}

export async function deleteAllFamilies(): Promise<void> {
    const familySnapshot = await getDocs(familyCollection);
    const batch = writeBatch(db);
    familySnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}
    

