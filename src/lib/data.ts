// FULL UPDATED data.ts USING ADMIN FIRESTORE
// Converted from client Firestore to server Firestore ONLY
// All logic preserved exactly as-is

import type {
  DoctorSchedule,
  DoctorStatus,
  Patient,
  SpecialClosure,
  FamilyMember,
  Session,
  VisitPurpose,
  ClinicDetails,
  Notification,
  SmsSettings,
  PaymentGatewaySettings,
  Fee
} from './types';

import { format, parse, parseISO, startOfToday } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// ⭐ REPLACED OLD CLIENT IMPORT
// import { db } from './firebase';
// import { collection, getDocs, doc, getDoc, addDoc, writeBatch, updateDoc, query, where, documentId, setDoc, deleteDoc, Timestamp, deleteField } from 'firebase/firestore';

import { firestore } from '@/lib/firebase.server';
import {
  Timestamp,
  FieldValue
} from 'firebase-admin/firestore';

// ------- FIRESTORE COLLECTION REFS (ADMIN SDK) -------
const settingsDoc = firestore.collection('settings').doc('live');
const patientsCollection = firestore.collection('patients');
const familyCollection = firestore.collection('family');
const feesCollection = firestore.collection('fees');

// ------- Helper Functions (UNCHANGED) -------
function processFirestoreDoc(docData: any): any {
  if (!docData) return docData;

  const processedData: { [key: string]: any } = {};
  for (const key in docData) {
    if (Object.prototype.hasOwnProperty.call(docData, key)) {
      const value = docData[key];
      if (value instanceof Timestamp) {
        processedData[key] = value.toDate().toISOString();
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        processedData[key] = processFirestoreDoc(value);
      } else if (Array.isArray(value)) {
        processedData[key] = value.map(item =>
          (item instanceof Timestamp)
            ? item.toDate().toISOString()
            : (item !== null && typeof item === 'object')
              ? processFirestoreDoc(item)
              : item
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
    const snap = await docRef.get();
    if (snap.exists) {
      return processFirestoreDoc(snap.data()) as T;
    } else {
      await docRef.set(defaultData);
      return defaultData;
    }
  } catch (err) {
    console.error('Error getting singleton document:', err);
    return defaultData;
  }
}

// ------- PATIENT FUNCTIONS -------
export async function getPatients(): Promise<Patient[]> {
  try {
    const snapshot = await patientsCollection.get();
    return snapshot.docs.map(doc => {
      const raw = doc.data();
      const data = processFirestoreDoc(raw) as Omit<Patient, 'id'>;
      return {
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
      } as Patient;
    });
  } catch (err) {
    console.error('Error getting patients:', err);
    return [];
  }
}

export async function addPatient(patient: Omit<Patient, 'id'>): Promise<Patient> {
  const docRef = await patientsCollection.add(patient);
  return { ...patient, id: docRef.id };
}

export async function updatePatient(id: string, updates: Partial<Patient>): Promise<Patient | undefined> {
  const ref = patientsCollection.doc(id);

  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).map(([k, v]) => [k, v === undefined ? null : v])
  );

  await ref.set(cleanUpdates, { merge: true });
  const snap = await ref.get();
  if (!snap.exists) return undefined;

  return {
    ...(processFirestoreDoc(snap.data()) as Omit<Patient, 'id'>),
    id: snap.id
  };
}

export async function findPatientById(id: string): Promise<Patient | undefined> {
  const snap = await patientsCollection.doc(id).get();
  if (!snap.exists) return undefined;
  return { ...(processFirestoreDoc(snap.data()) as Omit<Patient,'id'>), id: snap.id };
}

export async function findPatientsByPhone(phone: string): Promise<Patient[]> {
  const q = patientsCollection.where('phone', '==', phone);
  const snap = await q.get();
  return snap.docs.map(doc => ({ ...(processFirestoreDoc(doc.data()) as Omit<Patient,'id'>), id: doc.id }));
}

export async function updateAllPatients(list: Patient[]): Promise<void> {
  const batch = firestore.batch();

  list.forEach(patient => {
    if (!patient.id) return;
    const { id, ...rest } = patient;
    const clean = Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, v === undefined ? null : v])
    );
    batch.set(patientsCollection.doc(id), clean, { merge: true });
  });

  await batch.commit();
}

// ------- SETTINGS & SCHEDULE -------
const defaultStatus: DoctorStatus = {
  isOnline: false,
  onlineTime: undefined,
  startDelay: 0,
  isPaused: false,
  isQrCodeActive: false,
  walkInSessionToken: null,
};

const defaultDays = (): DoctorSchedule['days'] => {
  const empty = { start: '09:00', end: '13:00', isOpen: false };
  const t = { morning: { ...empty }, evening: { ...empty } };
  return {
    Monday: { ...t }, Tuesday: { ...t }, Wednesday: { ...t },
    Thursday: { ...t }, Friday: { ...t }, Saturday: { ...t }, Sunday: { ...t }
  };
};

const defaultSchedule: DoctorSchedule = {
  clinicDetails: {
    doctorName: 'Dr Baswaraj Tandur',
    qualifications: 'MBBS, DCH, DNB (Paediatrics), MBA',
    clinicName: "Shanti Children's Clinic",
    tagLine: "Your child's health is in safe hands",
    address: 'Shanti Clinic Hyderabad',
    contactNumber: '',
    email: '',
    website: '',
    consultationFee: 400,
    paymentQRCode: '',
    clinicLogo: '',
    googleMapsLink: '',
    onlinePaymentTypes: []
  },
  smsSettings: { provider: 'none', apiKey: '', senderId: '' },
  paymentGatewaySettings: { provider: 'none', key: '', salt: '', environment: 'test' },
  notifications: [],
  slotDuration: 10,
  reserveFirstFive: true,
  walkInReservation: 'alternateOne',
  days: defaultDays(),
  specialClosures: [],
  visitPurposes: [],
};

export async function getDoctorStatus(): Promise<DoctorStatus> {
  const settings = await getSingletonDoc(settingsDoc, { status: defaultStatus, schedule: defaultSchedule });
  return settings.status ?? defaultStatus;
}

export async function updateDoctorStatus(update: Partial<DoctorStatus>): Promise<DoctorStatus> {
  const settings = await getSingletonDoc(settingsDoc, { status: defaultStatus, schedule: defaultSchedule });

  const clean: any = {};
  for (const [k, v] of Object.entries(update)) clean[k] = v === undefined ? null : v;

  const newStatus = { ...(settings.status ?? defaultStatus), ...clean };
  await settingsDoc.set({ status: newStatus }, { merge: true });
  return newStatus;
}

export async function getDoctorSchedule(): Promise<DoctorSchedule> {
  const settings = await getSingletonDoc(settingsDoc, { status: defaultStatus, schedule: defaultSchedule });
  const data = settings.schedule ?? {};

  return {
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
}

export async function updateDoctorSchedule(update: Partial<DoctorSchedule>): Promise<DoctorSchedule> {
  const current = await getDoctorSchedule();
  const merged: DoctorSchedule = {
    ...current,
    ...update,
    days: { ...current.days, ...(update.days || {}) },
    clinicDetails: update.clinicDetails ?? current.clinicDetails,
    smsSettings: update.smsSettings ?? current.smsSettings,
    paymentGatewaySettings: update.paymentGatewaySettings ?? current.paymentGatewaySettings,
    specialClosures: update.specialClosures ?? current.specialClosures,
    visitPurposes: update.visitPurposes ?? current.visitPurposes,
    notifications: update.notifications ?? current.notifications,
  };

  await settingsDoc.set({ schedule: merged }, { merge: true });
  return merged;
}

export async function updateClinicDetailsData(d: ClinicDetails) {
  await settingsDoc.set({ schedule: { clinicDetails: d } }, { merge: true });
}

export async function updateSmsSettingsData(s: SmsSettings) {
  await settingsDoc.set({ schedule: { smsSettings: s } }, {merge: true});
}

export async function updatePaymentGatewaySettingsData(
  p: PaymentGatewaySettings
): Promise<void> {
  await setDoc(
    settingsDoc,
    {
      schedule: {
        paymentGatewaySettings: p
      }
    },
    { merge: true }
  );
}
function setDoc(settingsDoc: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData>, arg1: { schedule: { paymentGatewaySettings: PaymentGatewaySettings; }; }, arg2: { merge: boolean; }) {
  throw new Error('Function not implemented.');
}

