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
