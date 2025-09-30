

export type Patient = {
  id: string;
  name: string;
  type: 'Appointment' | 'Walk-in';
  subType?: 'Booked Walk-in';
  appointmentTime: string; // ISO string
  checkInTime?: string; // ISO string format, set when patient checks in
  status: 'Waiting' | 'In-Consultation' | 'Completed' | 'Late' | 'Cancelled' | 'Waiting for Reports' | 'Confirmed' | 'Booked' | 'Priority' | 'Up-Next' | 'Missed';
  subStatus?: 'Reports'; // To specify context for certain statuses
  phone: string;
  estimatedWaitTime?: number; // in minutes
  consultationTime?: number; // actual time taken in minutes
  consultationStartTime?: string; // ISO string
  consultationEndTime?: string; // ISO string
  purpose?: string | '';
  rescheduleCount?: number;
  // New fields for advanced queue management
  tokenNo: number;        // Static token based on booking order
  slotTime?: string;         // ISO String for the scheduled slot start
  bestCaseETC?: string;     // ISO String for the best-case consultation time
  worstCaseETC?: string;    // ISO String for the worst-case consultation time
  lateBy?: number; // in minutes
  latePenalty?: number;    // set by receptionist
  latePosition?: number;  // fixed position after penalty applied
  // Anchor-based late handling
  lateLocked?: boolean;
  lateLockedAt?: string; // ISO timestamp
  lateAnchors?: string[]; // Array of patient IDs
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
  isPaused?: boolean;
  isQrCodeActive?: boolean;
  walkInSessionToken?: string | null;
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
    clinicLogo?: string;
    googleMapsLink?: string;
};

export type SmsSettings = {
  provider: 'none' | 'bulksms' | 'twilio';
  apiKey: string;
  senderId: string;
}

export type PaymentGatewaySettings = {
  provider: 'none' | 'easebuzz';
  key: string;
  salt: string;
  environment: 'test' | 'production';
};

export type TranslatedMessage = {
  en: string;
  hi?: string;
  te?: string;
};

export type Notification = {
  id: string;
  message: TranslatedMessage | string; // string for backward compatibility
  startTime?: string; // ISO string
  endTime?: string; // ISO string
  enabled: boolean;
}

export type DoctorSchedule = {
  clinicDetails: ClinicDetails;
  smsSettings: SmsSettings;
  paymentGatewaySettings: PaymentGatewaySettings;
  notifications: Notification[];
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
  id: string;
  name: string;
  dob?: string | null;
  gender?: 'Male' | 'Female' | 'Other' | '';
  avatar?: string;
  clinicId?: string;
  phone: string;
  isPrimary?: boolean;
  location?: string;
  city?: string;
  email?: string;
  fatherName?: string;
  motherName?: string;
  primaryContact?: 'Father' | 'Mother';
};

export type Appointment = {
  id: string;
  familyMemberId: number;
  familyMemberName: string;
  date: string; // ISO string format from Patient.appointmentTime
  time: string;
  status: Patient['status'] | 'Missed';
  type?: 'Appointment' | 'Walk-in';
  purpose?: string;
  rescheduleCount?: number;
  tokenNo?: number;
};

export type ActionResult = { success: string } | { error: string };
