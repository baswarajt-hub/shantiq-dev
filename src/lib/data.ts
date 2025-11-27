// ================================================
// FULLY UPDATED data.ts (Admin Firestore ONLY)
// ================================================

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
} from "./types";

import { format, parseISO, parse } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

import { firestore } from "@/lib/firebase.server";
import {
  Timestamp,
  FieldValue,
} from "firebase-admin/firestore";

// ================================================
// COLLECTION REFERENCES
// ================================================
const settingsDoc = firestore.collection("settings").doc("live");
const patientsCollection = firestore.collection("patients");
const familyCollection = firestore.collection("family");
const feesCollection = firestore.collection("fees");

// ================================================
// HELPERS
// ================================================
function processFirestoreDoc(docData: any): any {
  if (!docData) return docData;

  const processedData: { [key: string]: any } = {};
  for (const key in docData) {
    if (!Object.prototype.hasOwnProperty.call(docData, key)) continue;

    const value = docData[key];

    if (value instanceof Timestamp) {
      processedData[key] = value.toDate().toISOString();
    } else if (Array.isArray(value)) {
      processedData[key] = value.map((v) =>
        v instanceof Timestamp
          ? v.toDate().toISOString()
          : typeof v === "object"
          ? processFirestoreDoc(v)
          : v
      );
    } else if (value !== null && typeof value === "object") {
      processedData[key] = processFirestoreDoc(value);
    } else {
      processedData[key] = value;
    }
  }
  return processedData;
}

async function getSingletonDoc<T>(docRef: any, defaultData: T): Promise<T> {
  const snap = await docRef.get();
  if (snap.exists) {
    return processFirestoreDoc(snap.data()) as T;
  } else {
    await docRef.set(defaultData);
    return defaultData;
  }
}

// ================================================
// PATIENT FUNCTIONS
// ================================================
export async function getPatients(): Promise<Patient[]> {
  const snapshot = await patientsCollection.get();
  return snapshot.docs.map((doc) => {
    const data = processFirestoreDoc(doc.data()) as Omit<Patient, "id">;
    return { ...data, id: doc.id } as Patient;
  });
}

export async function addPatient(patient: Omit<Patient, "id">): Promise<Patient> {
  const docRef = await patientsCollection.add(patient);
  return { ...patient, id: docRef.id };
}

export async function updatePatient(
  id: string,
  updates: Partial<Patient>
): Promise<Patient | undefined> {
  const ref = patientsCollection.doc(id);

  await ref.set(
    Object.fromEntries(
      Object.entries(updates).map(([k, v]) => [k, v ?? null])
    ),
    { merge: true }
  );

  const snap = await ref.get();
  if (!snap.exists) return undefined;
  return { ...(processFirestoreDoc(snap.data()) as any), id };
}

export async function findPatientById(
  id: string
): Promise<Patient | undefined> {
  const snap = await patientsCollection.doc(id).get();
  if (!snap.exists) return undefined;
  return { ...(processFirestoreDoc(snap.data()) as any), id };
}

export async function findPatientsByPhone(
  phone: string
): Promise<Patient[]> {
  const snap = await patientsCollection.where("phone", "==", phone).get();
  return snap.docs.map((doc) => ({
    ...(processFirestoreDoc(doc.data()) as any),
    id: doc.id,
  }));
}

export async function updateAllPatients(list: Patient[]): Promise<void> {
  const batch = firestore.batch();

  list.forEach((p) => {
    if (!p.id) return;
    const ref = patientsCollection.doc(p.id);
    const { id, ...rest } = p;

    batch.set(
      ref,
      Object.fromEntries(
        Object.entries(rest).map(([k, v]) => [k, v === undefined ? null : v])
      ),
      { merge: true }
    );
  });

  await batch.commit();
}

// ================================================
// DOCTOR STATUS / SCHEDULE
// ================================================
const defaultStatus: DoctorStatus = {
  isOnline: false,
  onlineTime: undefined,
  startDelay: 0,
  isPaused: false,
  isQrCodeActive: false,
  walkInSessionToken: null,
};

const defaultDays = (): DoctorSchedule["days"] => {
  const empty = { start: "09:00", end: "13:00", isOpen: false };
  return {
    Monday: { morning: { ...empty }, evening: { ...empty } },
    Tuesday: { morning: { ...empty }, evening: { ...empty } },
    Wednesday: { morning: { ...empty }, evening: { ...empty } },
    Thursday: { morning: { ...empty }, evening: { ...empty } },
    Friday: { morning: { ...empty }, evening: { ...empty } },
    Saturday: { morning: { ...empty }, evening: { ...empty } },
    Sunday: { morning: { ...empty }, evening: { ...empty } },
  };
};

const defaultSchedule: DoctorSchedule = {
  clinicDetails: {
    doctorName: "",
    qualifications: "",
    clinicName: "",
    tagLine: "",
    address: "",
    contactNumber: "",
    email: "",
    website: "",
    consultationFee: 0,
    paymentQRCode: "",
    clinicLogo: "",
    googleMapsLink: "",
    onlinePaymentTypes: [],
  },
  smsSettings: { provider: "none", apiKey: "", senderId: "" },
  paymentGatewaySettings: {
    provider: "none",
    key: "",
    salt: "",
    environment: "test",
  },
  notifications: [],
  slotDuration: 10,
  reserveFirstFive: true,
  walkInReservation: "alternateOne",
  days: defaultDays(),
  specialClosures: [],
  visitPurposes: [],
};

export async function getDoctorStatus(): Promise<DoctorStatus> {
  const settings = await getSingletonDoc(settingsDoc, {
    status: defaultStatus,
    schedule: defaultSchedule,
  });
  return settings.status ?? defaultStatus;
}

export async function updateDoctorStatus(
  update: Partial<DoctorStatus>
): Promise<DoctorStatus> {
  const current = await getDoctorStatus();
  const newStatus = { ...current, ...update };

  await settingsDoc.set({ status: newStatus }, { merge: true });
  return newStatus;
}

export async function getDoctorSchedule(): Promise<DoctorSchedule> {
  const settings = await getSingletonDoc(settingsDoc, {
    status: defaultStatus,
    schedule: defaultSchedule,
  });

  const data = settings.schedule ?? {};

  return {
    slotDuration: data.slotDuration ?? defaultSchedule.slotDuration,
    reserveFirstFive: data.reserveFirstFive ?? defaultSchedule.reserveFirstFive,
    walkInReservation:
      data.walkInReservation ?? defaultSchedule.walkInReservation,
    days: { ...defaultDays(), ...(data.days || {}) },
    clinicDetails: data.clinicDetails ?? defaultSchedule.clinicDetails,
    smsSettings: data.smsSettings ?? defaultSchedule.smsSettings,
    paymentGatewaySettings:
      data.paymentGatewaySettings ?? defaultSchedule.paymentGatewaySettings,
    notifications: data.notifications ?? defaultSchedule.notifications,
    visitPurposes: data.visitPurposes ?? defaultSchedule.visitPurposes,
    specialClosures: data.specialClosures ?? defaultSchedule.specialClosures,
  };
}

export async function updateDoctorSchedule(
  update: Partial<DoctorSchedule>
): Promise<DoctorSchedule> {
  const current = await getDoctorSchedule();
  const merged: DoctorSchedule = {
    ...current,
    ...update,
    days: { ...current.days, ...(update.days || {}) },
  };

  await settingsDoc.set({ schedule: merged }, { merge: true });
  return merged;
}

export async function updateClinicDetailsData(
  d: ClinicDetails
): Promise<void> {
  await settingsDoc.set({ schedule: { clinicDetails: d } }, { merge: true });
}

export async function updateSmsSettingsData(s: SmsSettings) {
  await settingsDoc.set({ schedule: { smsSettings: s } }, { merge: true });
}

export async function updatePaymentGatewaySettingsData(
  p: PaymentGatewaySettings
): Promise<void> {
  await settingsDoc.set(
    { schedule: { paymentGatewaySettings: p } },
    { merge: true }
  );
}

export async function updateVisitPurposesData(
  purposes: VisitPurpose[]
): Promise<void> {
  await settingsDoc.set(
    { schedule: { visitPurposes: purposes } },
    { merge: true }
  );
}

export async function updateSpecialClosures(
  closures: SpecialClosure[]
): Promise<void> {
  await settingsDoc.set(
    { schedule: { specialClosures: closures } },
    { merge: true }
  );
}

export async function updateTodayScheduleOverrideData(
  override: SpecialClosure
) {
  const schedule = await getDoctorSchedule();
  const idx = schedule.specialClosures.findIndex((c) => c.date === override.date);

  if (idx >= 0) {
    schedule.specialClosures[idx] = { ...schedule.specialClosures[idx], ...override };
  } else {
    schedule.specialClosures.push(override);
  }

  await settingsDoc.set(
    { schedule: { specialClosures: schedule.specialClosures } },
    { merge: true }
  );
}

export async function updateNotificationData(
  notifications: Notification[]
): Promise<void> {
  await settingsDoc.set(
    { schedule: { notifications } },
    { merge: true }
  );
}

// ================================================
// FAMILY FUNCTIONS (Admin Firestore)
// ================================================
export async function getFamily(): Promise<FamilyMember[]> {
  const snap = await familyCollection.get();
  return snap.docs.map((doc) => ({
    ...(processFirestoreDoc(doc.data()) as any),
    id: doc.id,
  }));
}

export async function getFamilyByPhone(phone: string): Promise<FamilyMember[]> {
  const snap = await familyCollection.where("phone", "==", phone).get();
  return snap.docs.map((doc) => ({
    ...(processFirestoreDoc(doc.data()) as any),
    id: doc.id,
  }));
}

export async function findPrimaryUserByPhone(
  phone: string
): Promise<FamilyMember | null> {
  const snap = await familyCollection
    .where("phone", "==", phone)
    .where("isPrimary", "==", true)
    .get();

  if (snap.empty) return null;

  const d = snap.docs[0];
  return { ...(processFirestoreDoc(d.data()) as any), id: d.id };
}

export async function searchFamilyMembers(
  searchTerm: string,
  searchBy: "phone" | "clinicId" | "dob" | "fatherName" | "motherName" | "name"
): Promise<FamilyMember[]> {
  if (!searchTerm.trim()) return [];

  const familySnapshot = await familyCollection.get();
  const allMembers = familySnapshot.docs.map((doc) => ({
    ...(processFirestoreDoc(doc.data()) as any),
    id: doc.id,
  }));

  const lower = searchTerm.toLowerCase();

  const matches = allMembers.filter((m) => {
    switch (searchBy) {
      case "phone":
        return m.phone?.includes(searchTerm);
      case "clinicId":
        return m.clinicId?.toLowerCase().includes(lower);
      case "dob":
        return m.dob === searchTerm;
      case "fatherName":
        return m.fatherName?.toLowerCase().includes(lower);
      case "motherName":
        return m.motherName?.toLowerCase().includes(lower);
      case "name":
        return m.name?.toLowerCase().includes(lower);
      default:
        return false;
    }
  });

  if (matches.length === 0) return [];

  const phones = [...new Set(matches.map((m) => m.phone))];

  return allMembers.filter((m) => phones.includes(m.phone));
}

export async function addFamilyMember(
  memberData: Omit<FamilyMember, "id">
): Promise<FamilyMember> {
  const enhanced = {
    ...memberData,
    avatar: `https://picsum.photos/seed/${Math.random()}/200/200`,
  };

  const docRef = await familyCollection.add(enhanced);

  return {
    ...enhanced,
    id: docRef.id,
  };
}

export async function updateFamilyMember(
  updated: FamilyMember
): Promise<FamilyMember> {
  const { id, ...rest } = updated;

  await familyCollection.doc(id).update(
    Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, v === undefined ? null : v])
    )
  );

  return updated;
}

export async function deleteFamilyMemberData(id: string): Promise<void> {
  await familyCollection.doc(id).delete();
}

export async function deleteFamilyByPhoneData(phone: string): Promise<void> {
  const snap = await familyCollection.where("phone", "==", phone).get();

  const batch = firestore.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

export async function batchImportFamilyMembers(
  familyData: any[],
  childData: any[]
): Promise<{ successCount: number; skippedCount: number }> {
  let success = 0;
  let skipped = 0;

  const existingSnap = await familyCollection.get();
  const existingMembers = existingSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as any),
  })) as FamilyMember[];

  const existingPhonesWithPrimary = new Set(
    existingMembers.filter((m) => m.isPrimary).map((m) => m.phone)
  );

  const batch = firestore.batch();

  // PRIMARY MEMBERS
  for (const row of familyData) {
    const phone = row.phone?.toString();
    if (!phone || existingPhonesWithPrimary.has(phone)) {
      skipped++;
      continue;
    }

    const ref = familyCollection.doc();

    batch.set(ref, {
      phone,
      isPrimary: true,
      name:
        row.primaryContact === "Father"
          ? row.fatherName
          : row.motherName ?? "",
      fatherName: row.fatherName ?? "",
      motherName: row.motherName ?? "",
      primaryContact: row.primaryContact ?? "Father",
      email: row.email ?? "",
      location: row.location ?? "",
      city: row.city ?? "",
      dob: null,
      gender: null,
      clinicId: row.clinicId || undefined,
      avatar: `https://picsum.photos/seed/${Math.random()}/200/200`,
    });

    existingPhonesWithPrimary.add(phone);
    success++;
  }

  // CHILDREN
  const known = [...existingMembers, ...familyData.map((f) => ({ ...f, name: "" }))];

  for (const row of childData) {
    const phone = row.phone?.toString();
    const name = row.name;

    if (!phone || !name) {
      skipped++;
      continue;
    }

    const isDuplicate = known.some(
      (m) => m.phone === phone && m.name?.toLowerCase() === name.toLowerCase()
    );

    if (isDuplicate) {
      skipped++;
      continue;
    }

    const ref = familyCollection.doc();

    batch.set(ref, {
      phone,
      isPrimary: false,
      name,
      dob: row.dob || null,
      gender: row.gender || "Other",
      clinicId: row.clinicId || undefined,
      avatar: `https://picsum.photos/seed/${Math.random()}/200/200`,
    });

    success++;
  }

  await batch.commit();

  return { successCount: success, skippedCount: skipped };
}

// ================================================
// FEES (unchanged, if needed you can tell me)
// ================================================
export async function saveFeeData(fee: Fee) {
  await feesCollection.doc(fee.id).set(fee);
}

export async function getFeesForSessionData(session: string): Promise<Fee[]> {
  const snap = await feesCollection.where("session", "==", session).get();
  return snap.docs.map((d) => ({ ...(d.data() as any), id: d.id }));
}

export async function editFeeData(id: string, updates: Partial<Fee>) {
  await feesCollection.doc(id).update(updates);
}

export async function deleteFeeData(id: string) {
  await feesCollection.doc(id).delete();
}

export async function convertGuestToExistingData(
  memberId: string,
  phone: string
) {
  await familyCollection.doc(memberId).update({ phone });
}
