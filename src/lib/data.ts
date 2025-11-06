

import type { DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember, Session, VisitPurpose, ClinicDetails, Notification, SmsSettings, PaymentGatewaySettings } from './types';
import { format, parse, parseISO, startOfToday } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, addDoc, writeBatch, updateDoc, query, where, documentId, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';

const settingsDoc = doc(db, 'settings', 'live');
const patientsCollection = collection(db, 'patients');
const familyCollection = collection(db, 'family');


// --- Helper Functions ---
function processFirestoreDoc(docData: any): any {
  if (!docData) return docData;

  const processedData: { [key: string]: any } = {};
  for (const key in docData) {
    if (Object.prototype.hasOwnProperty.call(docData, key)) {
      const value = docData[key];
      if (value instanceof Timestamp) {
        // Convert Firestore Timestamps to ISO 8601 strings
        processedData[key] = value.toDate().toISOString();
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively process nested objects
        processedData[key] = processFirestoreDoc(value);
      } else if (Array.isArray(value)) {
         processedData[key] = value.map(item => 
            (item instanceof Timestamp) ? item.toDate().toISOString() : 
            (item !== null && typeof item === 'object') ? processFirestoreDoc(item) : item
        );
      } else {
        processedData[key] = value;
      }
    }
  }
  return processedData;
}


async function getSingletonDoc<T>(docRef: any, defaultData: T): Promise<T> {
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      // Ensure nested objects exist to prevent runtime errors on partial data
      const rawData = docSnap.data();
      return processFirestoreDoc(rawData) as T;
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
        const rawData = doc.data();
        const data = processFirestoreDoc(rawData) as Omit<Patient, 'id'>;
        
        const patientData: Patient = {
          ...data,
          id: doc.id,
          subType: data.subType ?? undefined,
          checkInTime: data.checkInTime ?? undefined,
          subStatus: data.subStatus ?? undefined,
          consultationTime: data.consultationTime ?? undefined,
          consultationStartTime: data.consultationStartTime ?? undefined,
          consultationEndTime: data.consultationEndTime ?? undefined,
          purpose: data.purpose ?? null,
          rescheduleCount: data.rescheduleCount ?? 0,
          bestCaseETC: data.bestCaseETC ?? undefined,
          worstCaseETC: data.worstCaseETC ?? undefined,
          lateBy: data.lateBy ?? undefined,
          latePenalty: data.latePenalty ?? undefined,
          latePosition: data.latePosition ?? undefined,
          lateLocked: data.lateLocked ?? false,
          lateLockedAt: data.lateLockedAt ?? undefined,
          lateAnchors: data.lateAnchors ?? undefined,
        };
        return patientData;
    });
    return patientsList;
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
      return { ...(processFirestoreDoc(updatedDoc.data()) as Omit<Patient, 'id'>), id: updatedDoc.id };
    }
    return undefined;
}

export async function findPatientById(id: string): Promise<Patient | undefined> {
  const patientRef = doc(db, 'patients', id);
  const patientSnap = await getDoc(patientRef);
  if (patientSnap.exists()) {
    return { ...(processFirestoreDoc(patientSnap.data()) as Omit<Patient, 'id'>), id: patientSnap.id };
  }
  return undefined;
}


export async function findPatientsByPhone(phone: string): Promise<Patient[]> {
    const q = query(patientsCollection, where("phone", "==", phone));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...(processFirestoreDoc(doc.data()) as Omit<Patient, 'id'>), id: doc.id }));
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
    clinicLogo: 'https://i.ibb.co/1KzVv7Z/logo.png',
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
  return settings.status || defaultStatus;
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
  
  return normalizedSchedule;
}

export async function getDoctorScheduleData(): Promise<DoctorSchedule> {
  const schedule = await getDoctorSchedule();
  return schedule;
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
    return querySnapshot.docs.map(doc => ({ ...(processFirestoreDoc(doc.data()) as Omit<FamilyMember, 'id'>), id: doc.id }));
}

export async function findPrimaryUserByPhone(phone: string): Promise<FamilyMember | null> {
    const q = query(familyCollection, where("phone", "==", phone), where("isPrimary", "==", true));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { ...(processFirestoreDoc(doc.data()) as Omit<FamilyMember, 'id'>), id: doc.id };
    }
    return null;
}

export async function searchFamilyMembers(searchTerm: string, searchBy: 'phone' | 'clinicId' | 'dob' | 'fatherName' | 'motherName' | 'name'): Promise<FamilyMember[]> {
    if (!searchTerm.trim()) return [];

    const familySnapshot = await getDocs(familyCollection);
    const allMembers = familySnapshot.docs.map(doc => ({ ...(processFirestoreDoc(doc.data()) as Omit<FamilyMember, 'id'>), id: doc.id }));

    const lowercasedTerm = searchTerm.toLowerCase();

    const matchingMembers = allMembers.filter(member => {
        switch (searchBy) {
            case 'phone':
                return member.phone.includes(searchTerm);
            case 'clinicId':
                return member.clinicId?.toLowerCase().includes(lowercasedTerm);
            case 'dob':
                return member.dob === searchTerm; // Expects 'YYYY-MM-DD'
            case 'fatherName':
                return member.fatherName?.toLowerCase().includes(lowercasedTerm);
            case 'motherName':
                return member.motherName?.toLowerCase().includes(lowercasedTerm);
            case 'name':
                return member.name.toLowerCase().includes(lowercasedTerm);
            default:
                return false;
        }
    });
    
    if (matchingMembers.length === 0) {
        return [];
    }

    // Return all members of the families that matched the search
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

export async function batchImportFamilyMembers(familyData: any[], childData: any[]): Promise<{ successCount: number, skippedCount: number }> {
    let successCount = 0;
    let skippedCount = 0;
    
    const existingFamilySnapshot = await getDocs(familyCollection);
    const existingMembers: FamilyMember[] = existingFamilySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyMember));
    
    const batch = writeBatch(db);
    
    // Process family data first
    const existingPhonesWithPrimary = new Set(existingMembers.filter(m => m.isPrimary).map(m => m.phone));
    
    for (const row of familyData) {
        const phone = row.phone?.toString();
        if (!phone || existingPhonesWithPrimary.has(phone)) {
            skippedCount++;
            continue;
        }
        
        const newDocRef = doc(familyCollection);
        batch.set(newDocRef, {
            phone,
            isPrimary: true,
            name: row.primaryContact === 'Father' ? row.fatherName : row.motherName,
            fatherName: row.fatherName || '',
            motherName: row.motherName || '',
            primaryContact: row.primaryContact || 'Father',
            email: row.email || '',
            location: row.location || '',
            city: row.city || '',
            dob: null,
            gender: null,
            avatar: `https://picsum.photos/seed/${Math.random()}/200/200`,
            clinicId: row.clinicId || undefined,
        });
        existingPhonesWithPrimary.add(phone); // Add to set to avoid duplicates within the same batch
        successCount++;
    }

    // Process child data
    const allKnownMembers = [...existingMembers, ...familyData.map(f => ({...f, name: ''}))];

    for (const row of childData) {
        const phone = row.phone?.toString();
        const name = row.name;

        if (!phone || !name) {
            skippedCount++;
            continue;
        }

        const isDuplicate = allKnownMembers.some(
            m => m.phone === phone && m.name?.toLowerCase() === name.toLowerCase() && !m.isPrimary
        );

        if (isDuplicate) {
            skippedCount++;
            continue;
        }

        const newDocRef = doc(familyCollection);
        batch.set(newDocRef, {
            phone,
            isPrimary: false,
            name,
            dob: row.dob || null, // Assuming DOB is in a format Firestore can handle or needs conversion
            gender: row.gender || 'Other',
            clinicId: row.clinicId || undefined,
            avatar: `https://picsum.photos/seed/${Math.random()}/200/200`,
        });
        successCount++;
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
    return familySnapshot.docs.map(doc => ({ ...(processFirestoreDoc(doc.data()) as Omit<FamilyMember, 'id'>), id: doc.id }));
}

export async function deleteFamilyMemberData(id: string): Promise<void> {
    const memberRef = doc(db, 'family', id);
    await deleteDoc(memberRef);
}

export async function deleteFamilyByPhoneData(phone: string): Promise<void> {
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
    



    

    




    

    




