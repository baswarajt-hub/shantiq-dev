import type { DoctorStatus, Patient } from './types';

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
