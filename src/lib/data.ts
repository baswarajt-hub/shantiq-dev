

import type { DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember, Session, VisitPurpose, ClinicDetails, Notification } from './types';
import { format, parse, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import fs from 'fs';
import path from 'path';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, addDoc, writeBatch, updateDoc, query, where, documentId } from 'firebase/firestore';


const dataDir = path.join(process.cwd(), 'src', 'lib', 'data');
// Keep non-patient data in JSON for now
const familyFilePath = path.join(dataDir, 'family.json');
const scheduleFilePath = path.join(dataDir, 'schedule.json');
const statusFilePath = path.join(dataDir, 'status.json');

function readData<T>(filePath: string, defaultData: T): T {
    try {
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            if (fileContent.trim() === '') {
                fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
                return defaultData;
            }
            return JSON.parse(fileContent);
        }
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
        return defaultData;
    } catch (error) {
        console.error(`Error reading or writing ${filePath}:`, error);
        return defaultData;
    }
}

function writeData<T>(filePath: string, data: T): void {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error(`Error writing to ${filePath}:`, error);
    }
}

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
    clinicLogo: '',
  },
  notifications: [],
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
  specialClosures: [],
  visitPurposes: [
    { id: 'vp_1', name: 'Consultation', enabled: true },
    { id: 'vp_2', name: 'Follow-up visit', enabled: true, description: 'Next visit after paid consultation. Only one visit within 5 days of paid consultation.' },
    { id: 'vp_3', name: 'Vaccination', enabled: true },
    { id: 'vp_4', name: 'Others', enabled: true },
  ],
};

// --- Firestore Patient Functions ---

// Since Firestore generates string IDs, we need to adjust the type
// The `id` from the database will be a string. We keep the `Patient` type
// with number for now to avoid breaking the rest of the app, but we convert.
type PatientDoc = Omit<Patient, 'id'>;

export async function getPatients(): Promise<Patient[]> {
  try {
    const patientsCollection = collection(db, 'patients');
    const patientSnapshot = await getDocs(patientsCollection);
    const patientsList = patientSnapshot.docs.map(doc => {
        const data = doc.data() as PatientDoc;
        // Convert Firestore string ID to a number for compatibility with the app
        // NOTE: This is not robust for production. A better approach is to use string IDs throughout the app.
        // Or use a dedicated numeric ID field. For now, we hash the string to a number.
        let numericId = 0;
        for (let i = 0; i < doc.id.length; i++) {
            numericId = (numericId << 5) - numericId + doc.id.charCodeAt(i);
            numericId |= 0; // Convert to 32bit integer
        }
        return { ...data, id: Math.abs(numericId), firestoreId: doc.id } as Patient & { firestoreId: string };
    });
    return JSON.parse(JSON.stringify(patientsList));
  } catch (error) {
    console.error("Error getting patients from Firestore:", error);
    return [];
  }
}

async function getPatientFirestoreId(numericId: number): Promise<string | null> {
    // This is inefficient and should be avoided in a real app.
    // It's a workaround because we are using a numeric ID in the app
    // while Firestore uses string IDs.
    const patients = await getPatients();
    const patient = patients.find(p => p.id === numericId);
    return (patient as any)?.firestoreId || null;
}


export async function addPatient(patient: Omit<Patient, 'id' | 'estimatedWaitTime' | 'slotTime'>): Promise<Patient> {
    const newPatientData: PatientDoc = {
        ...patient,
        estimatedWaitTime: 0, // will be recalculated
        rescheduleCount: 0,
        slotTime: patient.appointmentTime,
        status: patient.status || 'Booked',
    };
    const docRef = await addDoc(collection(db, 'patients'), newPatientData);
    let numericId = 0;
    for (let i = 0; i < docRef.id.length; i++) {
      numericId = (numericId << 5) - numericId + docRef.id.charCodeAt(i);
      numericId |= 0;
    }
    return { ...newPatientData, id: Math.abs(numericId) };
}

export async function addPatientData(patientData: Omit<Patient, 'id' | 'estimatedWaitTime' | 'slotTime'>): Promise<Patient> {
    const newPatientData: PatientDoc = {
        ...patientData,
        slotTime: patientData.appointmentTime,
    };
    const docRef = await addDoc(collection(db, 'patients'), newPatientData);
    let numericId = 0;
    for (let i = 0; i < docRef.id.length; i++) {
      numericId = (numericId << 5) - numericId + docRef.id.charCodeAt(i);
      numericId |= 0;
    }
    return { ...newPatientData, id: Math.abs(numericId) };
}

export async function updatePatient(id: number, updates: Partial<Patient>): Promise<Patient | undefined> {
    const firestoreId = await getPatientFirestoreId(id);
    if (!firestoreId) {
        console.error("Could not find Firestore document for patient ID:", id);
        return undefined;
    }
    const patientRef = doc(db, 'patients', firestoreId);
    await updateDoc(patientRef, updates);
    const updatedDoc = await getDoc(patientRef);
    return { ...(updatedDoc.data() as PatientDoc), id };
}

export async function findPatientById(id: number): Promise<Patient | undefined> {
  const firestoreId = await getPatientFirestoreId(id);
  if (!firestoreId) return undefined;
  const patientRef = doc(db, 'patients', firestoreId);
  const patientSnap = await getDoc(patientRef);
  if (patientSnap.exists()) {
    return { ...(patientSnap.data() as PatientDoc), id };
  }
  return undefined;
}


export async function findPatientsByPhone(phone: string): Promise<Patient[]> {
    const q = query(collection(db, "patients"), where("phone", "==", phone));
    const querySnapshot = await getDocs(q);
    const patientsList = querySnapshot.docs.map(doc => {
        const data = doc.data() as PatientDoc;
         let numericId = 0;
        for (let i = 0; i < doc.id.length; i++) {
            numericId = (numericId << 5) - numericId + doc.id.charCodeAt(i);
            numericId |= 0; 
        }
        return { ...data, id: Math.abs(numericId) };
    });
    return patientsList;
}

export async function updateAllPatients(newPatients: (Patient & { firestoreId?: string })[]): Promise<void> {
    const batch = writeBatch(db);
    
    // We need firestore IDs to update. The incoming `newPatients` might not have them if they were just read.
    const allCurrentPatients = await getPatients();
    const idMap = new Map(allCurrentPatients.map(p => [(p as any).id, (p as any).firestoreId]));

    newPatients.forEach(patient => {
        const firestoreId = patient.firestoreId || idMap.get(patient.id);
        if (firestoreId) {
            const { id, firestoreId: fid, ...patientData } = patient;
            const patientRef = doc(db, "patients", firestoreId);
            batch.set(patientRef, patientData, { merge: true });
        }
    });
    await batch.commit();
}


// --- JSON file based functions (for other data) ---

export async function getDoctorStatus(): Promise<DoctorStatus> {
  const status = readData<DoctorStatus>(statusFilePath, defaultStatus);
  return JSON.parse(JSON.stringify(status));
}

export async function updateDoctorStatus(statusUpdate: Partial<DoctorStatus>): Promise<DoctorStatus> {
  const currentStatus = await getDoctorStatus();
  const newStatus = { ...currentStatus, ...statusUpdate };
  writeData(statusFilePath, newStatus);
  return newStatus;
}

export async function getDoctorSchedule(): Promise<DoctorSchedule> {
  const schedule = readData<DoctorSchedule>(scheduleFilePath, defaultSchedule);
  return JSON.parse(JSON.stringify(schedule));
}

export async function updateDoctorSchedule(scheduleUpdate: Partial<DoctorSchedule>): Promise<DoctorSchedule> {
  let doctorSchedule = await getDoctorSchedule();
  const newSchedule: DoctorSchedule = {
    ...doctorSchedule,
    ...scheduleUpdate,
    days: {
      ...doctorSchedule.days,
      ...scheduleUpdate.days,
    },
    clinicDetails: scheduleUpdate.clinicDetails ?? doctorSchedule.clinicDetails,
    specialClosures: scheduleUpdate.specialClosures ?? doctorSchedule.specialClosures,
    visitPurposes: scheduleUpdate.visitPurposes ?? doctorSchedule.visitPurposes,
    notifications: scheduleUpdate.notifications ?? doctorSchedule.notifications,
  };
  writeData(scheduleFilePath, newSchedule);
  return newSchedule;
}

export async function updateClinicDetailsData(details: ClinicDetails) {
  let doctorSchedule = await getDoctorSchedule();
  doctorSchedule.clinicDetails = details;
  writeData(scheduleFilePath, doctorSchedule);
  return doctorSchedule;
}

export async function updateVisitPurposesData(purposes: VisitPurpose[]) {
    let doctorSchedule = await getDoctorSchedule();
    doctorSchedule.visitPurposes = purposes;
    writeData(scheduleFilePath, doctorSchedule);
    return doctorSchedule;
}

export async function updateSpecialClosures(closures: SpecialClosure[]) {
    let doctorSchedule = await getDoctorSchedule();
    doctorSchedule.specialClosures = closures;
    writeData(scheduleFilePath, doctorSchedule);
    return doctorSchedule;
}

export async function updateTodayScheduleOverrideData(override: SpecialClosure) {
    let doctorSchedule = await getDoctorSchedule();
    const existingClosureIndex = doctorSchedule.specialClosures.findIndex(c => c.date === override.date);
    if (existingClosureIndex > -1) {
        doctorSchedule.specialClosures[existingClosureIndex] = {
            ...doctorSchedule.specialClosures[existingClosureIndex],
            ...override
        }
    } else {
        doctorSchedule.specialClosures.push(override);
    }
    writeData(scheduleFilePath, doctorSchedule);
    return doctorSchedule;
}

export async function updateNotificationData(notifications: Notification[]) {
    let doctorSchedule = await getDoctorSchedule();
    doctorSchedule.notifications = notifications;
    writeData(scheduleFilePath, doctorSchedule);
    return doctorSchedule;
}


// Family / Member specific functions
export async function getFamilyByPhone(phone: string) {
    const family = readData<FamilyMember[]>(familyFilePath, []);
    return family.filter(member => member.phone === phone);
}

export async function findPrimaryUserByPhone(phone: string): Promise<FamilyMember | null> {
    const family = readData<FamilyMember[]>(familyFilePath, []);
    const primaryUser = family.find(member => member.phone === phone && member.isPrimary);
    return primaryUser || null;
}

export async function searchFamilyMembers(searchTerm: string): Promise<FamilyMember[]> {
    const family = readData<FamilyMember[]>(familyFilePath, []);
    if (!searchTerm.trim()) {
        return [];
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return family.filter(member =>
        member.name.toLowerCase().includes(lowercasedTerm) ||
        member.phone.includes(searchTerm) ||
        (member.clinicId && member.clinicId.toLowerCase().includes(lowercasedTerm))
    );
}

export async function addFamilyMember(memberData: Omit<FamilyMember, 'id' | 'avatar'>): Promise<FamilyMember> {
    const family = readData<FamilyMember[]>(familyFilePath, []);
    const newId = family.length > 0 ? Math.max(...family.map(f => f.id)) + 1 : 1;
    const newMember: FamilyMember = {
        ...memberData,
        id: newId,
        avatar: `https://picsum.photos/seed/${newId}/200/200`,
    };
    family.push(newMember);
    writeData(familyFilePath, family);
    return newMember;
}

export async function updateFamilyMember(updatedMember: FamilyMember) {
    let family = readData<FamilyMember[]>(familyFilePath, []);
    family = family.map(m => m.id === updatedMember.id ? updatedMember : m);
    writeData(familyFilePath, family);
    return updatedMember;
}


export async function cancelAppointment(appointmentId: number) {
    const patient = await findPatientById(appointmentId);
    if(patient){
        await updatePatient(appointmentId, { status: 'Cancelled' });
    }
    return patient;
}


export async function getFamily() {
    const family = readData<FamilyMember[]>(familyFilePath, []);
    return JSON.parse(JSON.stringify(family));
}
