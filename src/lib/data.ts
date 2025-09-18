

import type { DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember, Session, VisitPurpose, ClinicDetails, Notification } from './types';
import { format, parse, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'src', 'lib', 'data');
const patientsFilePath = path.join(dataDir, 'patients.json');
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

let patients: Patient[] = readData<Patient[]>(patientsFilePath, []);
let family: FamilyMember[] = readData<FamilyMember[]>(familyFilePath, []);
let nextPatientId = patients.length > 0 ? Math.max(...patients.map(p => p.id)) + 1 : 1;
let nextFamilyId = family.length > 0 ? Math.max(...family.map(f => f.id)) + 1 : 1;

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

// This is a mock database. In a real app, you'd use a proper database.
export async function getPatients() {
  patients = readData<Patient[]>(patientsFilePath, []);
  return JSON.parse(JSON.stringify(patients));
}

export async function addPatient(patient: Omit<Patient, 'id' | 'estimatedWaitTime' | 'slotTime'>) {
    const newPatient: Patient = {
        ...patient,
        id: nextPatientId++,
        estimatedWaitTime: patients.filter(p => p.status === 'Waiting').length * 15,
        rescheduleCount: 0,
        slotTime: patient.appointmentTime,
        status: patient.status || 'Booked',
    };
  patients.push(newPatient);
  writeData(patientsFilePath, patients);
  return newPatient;
}

export async function addPatientData(patientData: Omit<Patient, 'id' | 'estimatedWaitTime' | 'slotTime'>) {
    const newPatient: Patient = {
        ...patientData,
        id: nextPatientId++,
        estimatedWaitTime: 15, // Default, will be recalculated
        slotTime: patientData.appointmentTime,
    };
    patients.push(newPatient);
    writeData(patientsFilePath, patients);
    return newPatient;
}

export async function updatePatient(id: number, updates: Partial<Patient>) {
  patients = patients.map(p => (p.id === id ? { ...p, ...updates } : p));
  writeData(patientsFilePath, patients);
  return patients.find(p => p.id === id);
}

export async function findPatientById(id: number) {
  return patients.find(p => p.id === id);
}

export async function findPatientsByPhone(phone: string) {
    return patients.filter(p => p.phone === phone);
}

export async function updateAllPatients(newPatients: Patient[]) {
  patients = newPatients;
  writeData(patientsFilePath, newPatients);
}

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
    family = readData<FamilyMember[]>(familyFilePath, []);
    return family.filter(member => member.phone === phone);
}

export async function findPrimaryUserByPhone(phone: string): Promise<FamilyMember | null> {
    family = readData<FamilyMember[]>(familyFilePath, []);
    const primaryUser = family.find(member => member.phone === phone && member.isPrimary);
    return primaryUser || null;
}

export async function searchFamilyMembers(searchTerm: string): Promise<FamilyMember[]> {
    family = readData<FamilyMember[]>(familyFilePath, []);
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
    family = readData<FamilyMember[]>(familyFilePath, []);
    const newId = family.length > 0 ? Math.max(...family.map(f => f.id)) + 1 : 1;
    const newMember: FamilyMember = {
        ...memberData,
        id: newId,
        avatar: `https://picsum.photos/seed/${newId}/200/200`,
    };
    family.push(newMember);
    writeData(familyFilePath, family);
    nextFamilyId = newId + 1;
    return newMember;
}

export async function updateFamilyMember(updatedMember: FamilyMember) {
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
    family = readData<FamilyMember[]>(familyFilePath, []);
    return JSON.parse(JSON.stringify(family));
}
