





export type Patient = {
  id: number;
  name: string;
  type: 'Appointment' | 'Walk-in';
  appointmentTime: string; // ISO string
  checkInTime?: string; // ISO string format, set when patient checks in
  status: 'Waiting' | 'In-Consultation' | 'Completed' | 'Late' | 'Cancelled' | 'Waiting for Reports' | 'Confirmed' | 'Booked' | 'Priority';
  phone: string;
  estimatedWaitTime: number; // in minutes
  consultationTime?: number; // actual time taken in minutes
  consultationStartTime?: string; // ISO string
  consultationEndTime?: string; // ISO string
  purpose?: string;
  rescheduleCount?: number;
  // New fields for advanced queue management
  tokenNo: number;        // Static token based on booking order
  slotTime: string;         // ISO String for the scheduled slot start
  bestCaseETC?: string;     // ISO String for the best-case consultation time
  worstCaseETC?: string;    // ISO String for the worst-case consultation time
  lateBy?: number; // in minutes
};

export type AIPatientData = {
  patientFlowData: string;
  lateArrivals: string;
  doctorDelays: string;
}

export type DoctorStatus = {
  isOnline: boolean;
  onlineTime?: string; // ISO string format
  startDelay: number; // in minutes
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

export type VisitPurpose = {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
}

export type ClinicDetails = {
    doctorName: string;
    qualifications: string;
    clinicName: string;
    tagLine: string;
    address: string;
    contactNumber: string;
    email: string;
    website: string;
    consultationFee: number;
    paymentQRCode?: string;
};

export type DoctorSchedule = {
  clinicDetails: ClinicDetails;
  slotDuration: number;
  reserveFirstFive: boolean;
  walkInReservation: 'none' | 'alternateOne' | 'alternateTwo';
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
  visitPurposes: VisitPurpose[];
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
  date: string; // ISO string format from Patient.appointmentTime
  time: string;
  status: Patient['status'] | 'Missed';
  type?: 'Appointment' | 'Walk-in';
  purpose?: string;
  rescheduleCount?: number;
};
