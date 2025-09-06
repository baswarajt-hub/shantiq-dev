

export type Patient = {
  id: number;
  name: string;
  type: 'Appointment' | 'Walk-in';
  appointmentTime: string; // ISO string format
  checkInTime: string; // ISO string format
  status: 'Waiting' | 'In-Consultation' | 'Completed' | 'Late' | 'Cancelled';
  phone: string;
  estimatedWaitTime: number; // in minutes
  consultationTime?: number; // actual time taken in minutes
  consultationStartTime?: string; // ISO string
  consultationEndTime?: string; // ISO string
};

export type AIPatientData = {
  patientFlowData: string;
  lateArrivals: string;
  doctorDelays: string;
}

export type DoctorStatus = {
  isOnline: boolean;
  onlineTime?: string; // ISO string format
};

export type Session = {
  start: string;
  end: string;
  isOpen: boolean;
};

export type DaySchedule = {
  morning: Session;
  evening: Session;
};

export type SpecialClosure = {
  date: string; // YYYY-MM-DD
  isMorningClosed?: boolean;
  isEveningClosed?: boolean;
  morningOverride?: Session;
  eveningOverride?: Session;
};

export type DoctorSchedule = {
  slotDuration: number;
  days: {
    Monday: DaySchedule;
    Tuesday: DaySchedule;
    Wednesday: DaySchedule;
    Thursday: DaySchedule;
    Friday: DaySchedule;
    Saturday: DaySchedule;
    Sunday: DaySchedule;
  };
  specialClosures: SpecialClosure[];
};

export type FamilyMember = {
  id: number;
  name: string;
  dob: string; // YYYY-MM-DD
  gender: 'Male' | 'Female' | 'Other';
  avatar?: string; // URL to avatar image
  clinicId?: string;
  phone: string;
};

export type Appointment = {
  id: number;
  familyMemberId: number;
  familyMemberName: string;
  date: string; // ISO string format
  time: string;
  status: Patient['status'] | 'Confirmed' | 'Missed' | 'Yet to Arrive';
  type?: 'Appointment' | 'Walk-in';
};

    
