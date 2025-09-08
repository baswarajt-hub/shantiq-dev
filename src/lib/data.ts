


import type { DoctorSchedule, DoctorStatus, Patient, SpecialClosure, FamilyMember, Session, VisitPurpose, ClinicDetails } from './types';
import { format, parse, parseISO } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

let patients: Patient[] = [];

let family: FamilyMember[] = [
    { id: 1, name: 'John Doe', dob: '1985-05-20', gender: 'Male', avatar: 'https://picsum.photos/id/237/200/200', clinicId: 'C101', phone: '5551112222' },
    { id: 2, name: 'Jane Doe', dob: '1988-10-15', gender: 'Female', avatar: 'https://picsum.photos/id/238/200/200', phone: '5551112222' },
    { id: 3, name: 'Jimmy Doe', dob: '2015-02-25', gender: 'Male', avatar: 'https://picsum.photos/id/239/200/200', clinicId: 'C101', phone: '5551112222' },
    { id: 4, name: 'Alice Johnson', dob: '1990-01-01', gender: 'Female', avatar: 'https://picsum.photos/id/240/200/200', clinicId: 'C102', phone: '555-0101' },
    { id: 5, name: 'Bob Williams', dob: '1992-02-02', gender: 'Male', avatar: 'https://picsum.photos/id/241/200/200', clinicId: 'C103', phone: '555-0102' },
    { id: 6, name: 'Charlie Brown', dob: '1994-03-03', gender: 'Male', avatar: 'https://picsum.photos/id/242/200/200', clinicId: 'C104', phone: '555-0103' },

];

let nextPatientId = 1;
let nextFamilyId = family.length + 1;

let doctorStatus: DoctorStatus = {
  isOnline: false,
  onlineTime: undefined,
  startDelay: 0,
};

let doctorSchedule: DoctorSchedule = {
  clinicDetails: {
    doctorName: 'Dr. John Smith',
    clinicName: 'HealthCare Clinic',
    tagLine: 'Your Health, Our Priority',
    address: '123 Health St, Wellness City, 12345',
    contactNumber: '555-123-4567',
    consultationFee: 500,
    paymentQRCode: 'https://picsum.photos/200'
  },
  slotDuration: 5,
  reserveFirstFive: true,
  walkInReservation: 'alternateTwo',
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
      evening: { start: '18:30', end: '21:30', isOpen: true },
    },
    Sunday: {
      morning: { start: '10:30', end: '13:00', isOpen: true },
      evening: { start: '18:30', end: '21:30', isOpen: true },
    },
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
  // Make sure to return a deep copy to avoid mutations affecting the "DB"
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

export async function updateDoctorStatus(status: Partial<DoctorStatus>) {
  doctorStatus = { ...doctorStatus, ...status };
  return doctorStatus;
}

export async function getDoctorSchedule() {
  return JSON.parse(JSON.stringify(doctorSchedule));
}

export async function updateDoctorSchedule(schedule: Omit<DoctorSchedule, 'specialClosures' | 'visitPurposes' | 'clinicDetails'>) {
  doctorSchedule = { ...doctorSchedule, ...schedule };
  return doctorSchedule;
}

export async function updateClinicDetailsData(details: ClinicDetails) {
  doctorSchedule.clinicDetails = details;
  return doctorSchedule;
}

export async function updateVisitPurposesData(purposes: VisitPurpose[]) {
    doctorSchedule.visitPurposes = purposes;
    return doctorSchedule;
}

export async function updateSpecialClosures(closures: SpecialClosure[]) {
    // In a real DB, you'd likely update this differently
    doctorSchedule.specialClosures = closures;
    return doctorSchedule;
}

export async function updateTodayScheduleOverrideData(override: SpecialClosure) {
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

export async function updateFamilyMember(updatedMember: FamilyMember) {
    family = family.map(m => m.id === updatedMember.id ? updatedMember : m);
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
    return JSON.parse(JSON.stringify(family));
}
