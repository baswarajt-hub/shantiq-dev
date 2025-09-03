import type { DoctorSchedule, DoctorStatus, Patient } from './types';

let patients: Patient[] = [
  {
    id: 1,
    name: 'Alice Johnson',
    type: 'Appointment',
    appointmentTime: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
    checkInTime: new Date(new Date().setHours(8, 55, 0, 0)).toISOString(),
    status: 'Waiting',
    phone: '555-0101',
    estimatedWaitTime: 10,
  },
  {
    id: 2,
    name: 'Bob Williams',
    type: 'Appointment',
    appointmentTime: new Date(new Date().setHours(9, 15, 0, 0)).toISOString(),
    checkInTime: new Date(new Date().setHours(9, 10, 0, 0)).toISOString(),
    status: 'Waiting',
    phone: '555-0102',
    estimatedWaitTime: 25,
  },
  {
    id: 3,
    name: 'Charlie Brown',
    type: 'Walk-in',
    appointmentTime: new Date(new Date().setHours(9, 20, 0, 0)).toISOString(),
    checkInTime: new Date(new Date().setHours(9, 20, 0, 0)).toISOString(),
    status: 'Waiting',
    phone: '555-0103',
    estimatedWaitTime: 40,
  },
  {
    id: 4,
    name: 'Diana Miller',
    type: 'Appointment',
    appointmentTime: new Date(new Date().setHours(9, 30, 0, 0)).toISOString(),
    checkInTime: new Date(new Date().setHours(9, 28, 0, 0)).toISOString(),
    status: 'Waiting',
    phone: '555-0104',
    estimatedWaitTime: 55,
  },
  {
    id: 5,
    name: 'Ethan Davis',
    type: 'Completed',
    appointmentTime: new Date(new Date().setHours(8, 45, 0, 0)).toISOString(),
    checkInTime: new Date(new Date().setHours(8, 40, 0, 0)).toISOString(),
    status: 'Completed',
    phone: '555-0105',
    estimatedWaitTime: 0,
    consultationTime: 12,
  },
];

let nextId = patients.length + 1;

let doctorStatus: DoctorStatus = {
  isOnline: true,
  onlineTime: new Date(new Date().setHours(8, 30, 0, 0)).toISOString(),
};

let doctorSchedule: DoctorSchedule = {
  slotDuration: 10,
  days: {
    Monday: {
      morning: { start: '09:00', end: '13:00', isOpen: true },
      evening: { start: '16:00', end: '19:00', isOpen: true },
    },
    Tuesday: {
      morning: { start: '09:00', end: '13:00', isOpen: true },
      evening: { start: '16:00', end: '19:00', isOpen: true },
    },
    Wednesday: {
      morning: { start: '09:00', end: '13:00', isOpen: true },
      evening: { start: '16:00', end: '19:00', isOpen: true },
    },
    Thursday: {
      morning: { start: '09:00', end: '13:00', isOpen: true },
      evening: { start: '16:00', end: '19:00', isOpen: true },
    },
    Friday: {
      morning: { start: '09:00', end: '13:00', isOpen: true },
      evening: { start: '16:00', end: '19:00', isOpen: true },
    },
    Saturday: {
      morning: { start: '10:00', end: '14:00', isOpen: true },
      evening: { start: '', end: '', isOpen: false },
    },
    Sunday: {
      morning: { start: '', end: '', isOpen: false },
      evening: { start: '', end: '', isOpen: false },
    },
  },
};


// This is a mock database. In a real app, you'd use a proper database.
export async function getPatients() {
  return patients;
}

export async function addPatient(patient: Omit<Patient, 'id' | 'estimatedWaitTime'>) {
  const newPatient: Patient = {
    ...patient,
    id: nextId++,
    estimatedWaitTime: patients.filter(p => p.status === 'Waiting').length * 15, // Simple estimation
  };
  patients.push(newPatient);
  return newPatient;
}

export async function updatePatient(id: number, updates: Partial<Patient>) {
  patients = patients.map(p => (p.id === id ? { ...p, ...updates } : p));
  return patients.find(p => p.id === id);
}

export async function findPatientById(id: number) {
  return patients.find(p => p.id === id);
}

export async function updateAllPatients(newPatients: Patient[]) {
  patients = newPatients;
}

export async function getDoctorStatus() {
  return doctorStatus;
}

export async function updateDoctorStatus(status: DoctorStatus) {
  doctorStatus = status;
  return doctorStatus;
}

export async function getDoctorSchedule() {
  return doctorSchedule;
}

export async function updateDoctorSchedule(schedule: DoctorSchedule) {
  doctorSchedule = schedule;
  return doctorSchedule;
}
