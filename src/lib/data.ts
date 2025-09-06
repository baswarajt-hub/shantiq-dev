
import type { DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember, Session } from './types';
import { format } from 'date-fns';

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
    consultationEndTime: new Date(new Date().setHours(8, 57, 0, 0)).toISOString(),
  },
];

let family: FamilyMember[] = [
    { id: 1, name: 'John Doe', dob: '1985-05-20', gender: 'Male', avatar: 'https://picsum.photos/id/237/200/200', clinicId: 'C101', phone: '5551112222' },
    { id: 2, name: 'Jane Doe', dob: '1988-10-15', gender: 'Female', avatar: 'https://picsum.photos/id/238/200/200', phone: '5551112222' },
    { id: 3, name: 'Jimmy Doe', dob: '2015-02-25', gender: 'Male', avatar: 'https://picsum.photos/id/239/200/200', clinicId: 'C101', phone: '5551112222' },
    { id: 4, name: 'Alice Johnson', dob: '1990-01-01', gender: 'Female', avatar: 'https://picsum.photos/id/240/200/200', clinicId: 'C102', phone: '555-0101' },
    { id: 5, name: 'Bob Williams', dob: '1992-02-02', gender: 'Male', avatar: 'https://picsum.photos/id/241/200/200', clinicId: 'C103', phone: '555-0102' },
    { id: 6, name: 'Charlie Brown', dob: '1994-03-03', gender: 'Male', avatar: 'https://picsum.photos/id/242/200/200', clinicId: 'C104', phone: '555-0103' },

];

let nextPatientId = patients.length + 1;
let nextFamilyId = family.length + 1;

let doctorStatus: DoctorStatus = {
  isOnline: true,
  onlineTime: new Date(new Date().setHours(8, 30, 0, 0)).toISOString(),
};

let doctorSchedule: DoctorSchedule = {
  slotDuration: 15,
  reserveFirstFive: false,
  walkInReservation: 'none',
  days: {
    Monday: {
      morning: { start: '10:30', end: '13:00', isOpen: true },
      evening: { start: '18:30', end: '21:30', isOpen: true },
    },
    Tuesday: {
      morning: { start: '10:30', end: '13:00', isOpen: true },
      evening: { start: '18:30', end: '21:30', isOpen: true },
    },
    Wednesday: {
      morning: { start: '10:30', end: '13:00', isOpen: true },
      evening: { start: '18:30', end: '21:30', isOpen: true },
    },
    Thursday: {
      morning: { start: '10:30', end: '13:00', isOpen: true },
      evening: { start: '18:30', end: '21:30', isOpen: true },
    },
    Friday: {
      morning: { start: '10:30', end: '13:00', isOpen: true },
      evening: { start: '18:30', end: '21:30', isOpen: true },
    },
    Saturday: {
      morning: { start: '10:30', end: '13:00', isOpen: true },
      evening: { start: '16:00', end: '19:00', isOpen: true },
    },
    Sunday: {
      morning: { start: '', end: '', isOpen: false },
      evening: { start: '', end: '', isOpen: false },
    },
  },
  specialClosures: [],
};


// This is a mock database. In a real app, you'd use a proper database.
export async function getPatients() {
  return patients;
}

export async function addPatient(patient: Omit<Patient, 'id' | 'estimatedWaitTime'>) {
  const newPatient: Patient = {
    ...patient,
    id: nextPatientId++,
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

export async function updateDoctorSchedule(schedule: Omit<DoctorSchedule, 'specialClosures'>) {
  doctorSchedule = { ...doctorSchedule, ...schedule };
  return doctorSchedule;
}

export async function updateSpecialClosures(closures: SpecialClosure[]) {
    doctorSchedule.specialClosures = closures;
    return doctorSchedule;
}

export async function updateTodayScheduleOverride(override: SpecialClosure) {
    const existingClosureIndex = doctorSchedule.specialClosures.findIndex(c => c.date === override.date);
    if (existingClosureIndex > -1) {
        doctorSchedule.specialClosures[existingClosureIndex] = {
            ...doctorSchedule.specialClosures[existingClosureIndex],
            ...override
        }
    } else {
        doctorSchedule.specialClosures.push(override);
    }
    return doctorSchedule;
}


// Family / Member specific functions
export async function getFamilyByPhone(phone: string) {
    return family.filter(member => member.phone === phone);
}

export async function searchFamilyMembers(searchTerm: string): Promise<FamilyMember[]> {
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
    const newMember: FamilyMember = {
        ...memberData,
        id: nextFamilyId++,
        avatar: `https://picsum.photos/seed/${Date.now()}/200/200`,
    };
    family.push(newMember);
    return newMember;
}

export async function getFamily() {
    return family;
}
