

import type { DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember, Session, VisitPurpose, ClinicDetails, Notification } from './types';
import { format, parse, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, addDoc, writeBatch, updateDoc, query, where, documentId, setDoc, deleteDoc } from 'firebase/firestore';


// --- Firestore Collection References ---
const patientsCollection = collection(db, 'patients');
const familyCollection = collection(db, 'family');
const settingsDoc = doc(db, 'settings', 'singleton');


// --- Helper Functions ---
async function getSingletonDoc<T>(docRef: any, defaultData: T): Promise<T> {
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as T;
    } else {
      // If the doc doesn't exist, create it with default data
      await setDoc(docRef, defaultData);
      return defaultData;
    }
  } catch (error) {
    console.error("Error getting singleton document:", error);
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
    paymentQRCode: 'https://picsum.photos/200',
    clinicLogo: ''
  },
  notifications: [
    {
      "message": "The clinic will remain closed from 20/09/2025 to 22/09/2025. If any emergency please visit the nearest children's hospital.\n\nक्लिनिक 20/09/2025 से 22/09/2025 तक बंद रहेगा। किसी भी आपात स्थिति में, कृपया नज़दीकी बाल चिकित्सालय जाएँ।",
      "startTime": "2025-09-19T20:15:06.762Z",
      "endTime": "2025-09-21T20:00:00.000Z",
      "enabled": true,
      "id": "notif_1758312298986"
    }
  ],
  slotDuration: 5,
  reserveFirstFive: true,
  walkInReservation: 'alternateTwo',
  days: {
    Monday: { morning: { start: '10:30', end: '13:00', isOpen: true }, evening: { start: '18:30', end: '21:30', isOpen: true } },
    Tuesday: { morning: { start: '10:30', end: '13:00', isOpen: true }, evening: { start: '18:30', end: '21:30', isOpen: true } },
    Wednesday: { morning: { start: '10:30', end: '13:00', isOpen: true }, evening: { start: '18:30', end: '21:30', isOpen: true } },
    Thursday: { morning: { start: '10:30', end: '13:00', isOpen: true }, evening: { start: '18:30', end: '21:30', isOpen: true } },
    Friday: { morning: { start: '10:30', end: '13:00', isOpen: true }, evening: { start: '18:30', end: '21:30', isOpen: true } },
    Saturday: { morning: { start: '10:30', end: '13:00', isOpen: true }, evening: { start: '18:30', end: '21:30', isOpen: true } },
    Sunday: { morning: { start: '10:30', end: '13:00', isOpen: true }, evening: { start: '18:30', end: '21:30', isOpen: true } },
  },
  specialClosures: [
    {
      "date": "2025-09-19",
      "isMorningClosed": false,
      "isEveningClosed": true,
      "eveningOverride": {
        "start": "18:30",
        "end": "21:30",
        "isOpen": true
      },
      "morningOverride": {
        "start": "10:30",
        "end": "13:00",
        "isOpen": true
      }
    },
    {
      "date": "2025-09-18",
      "morningOverride": {
        "start": "02:00",
        "end": "03:00",
        "isOpen": true
      }
    },
    {
      "date": "2025-09-20",
      "morningOverride": {
        "start": "01:40",
        "end": "03:00",
        "isOpen": true
      }
    }
  ],
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
  const newStatus = { ...(settings.status || defaultStatus), ...statusUpdate };
  await updateDoc(settingsDoc, { status: newStatus });
  return newStatus;
}

export async function getDoctorSchedule(): Promise<DoctorSchedule> {
  const settings = await getSingletonDoc(settingsDoc, { status: defaultStatus, schedule: defaultSchedule });
  const schedule = settings.schedule || defaultSchedule;
  // Ensure nested arrays exist to prevent runtime errors
  if (!schedule.specialClosures) schedule.specialClosures = [];
  if (!schedule.visitPurposes) schedule.visitPurposes = [];
  if (!schedule.notifications) schedule.notifications = [];
  return JSON.parse(JSON.stringify(schedule));
}

export async function updateDoctorSchedule(scheduleUpdate: Partial<DoctorSchedule>): Promise<DoctorSchedule> {
  const settings = await getSingletonDoc(settingsDoc, { status: defaultStatus, schedule: defaultSchedule });
  const currentSchedule = settings.schedule || defaultSchedule;
  const newSchedule: DoctorSchedule = {
    ...currentSchedule,
    ...scheduleUpdate,
    days: {
      ...currentSchedule.days,
      ...scheduleUpdate.days,
    },
    clinicDetails: scheduleUpdate.clinicDetails ?? currentSchedule.clinicDetails,
    specialClosures: scheduleUpdate.specialClosures ?? currentSchedule.specialClosures,
    visitPurposes: scheduleUpdate.visitPurposes ?? currentSchedule.visitPurposes,
    notifications: scheduleUpdate.notifications ?? currentSchedule.notifications,
  };
  await updateDoc(settingsDoc, { schedule: newSchedule });
  return newSchedule;
}

export async function updateClinicDetailsData(details: ClinicDetails) {
  await updateDoc(settingsDoc, { 'schedule.clinicDetails': details });
}

export async function updateVisitPurposesData(purposes: VisitPurpose[]) {
    await updateDoc(settingsDoc, { 'schedule.visitPurposes': purposes });
}

export async function updateSpecialClosures(closures: SpecialClosure[]) {
    await updateDoc(settingsDoc, { 'schedule.specialClosures': closures });
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
    await updateDoc(settingsDoc, { 'schedule.specialClosures': schedule.specialClosures });
}

export async function updateNotificationData(notifications: Notification[]) {
    await updateDoc(settingsDoc, { 'schedule.notifications': notifications });
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
    const family = familySnapshot.docs.map(doc => ({ ...(doc.data() as Omit<FamilyMember, 'id'>), id: doc.id }));
    
    const lowercasedTerm = searchTerm.toLowerCase();
    return family.filter(member =>
        member.name.toLowerCase().includes(lowercasedTerm) ||
        member.phone.includes(searchTerm) ||
        (member.clinicId && member.clinicId.toLowerCase().includes(lowercasedTerm))
    );
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
