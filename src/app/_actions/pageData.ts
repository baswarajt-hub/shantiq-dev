'use server';

import {
  getPatientsAction,
  getDoctorScheduleAction,
  getDoctorStatusAction,
  recalculateQueueWithETC,
  addAppointmentAction,
  checkInPatientAction,
  updatePatientStatusAction,
  sendReminderAction,
  cancelAppointmentAction,
  markPatientAsLateAndCheckInAction,
  advanceQueueAction,
  startLastConsultationAction,
} from '@/server/actions';

// ✅ Bundle key data for initial dashboard
export async function getDashboardData() {
  const [patients, schedule, doctorStatus] = await Promise.all([
    getPatientsAction(),
    getDoctorScheduleAction(),
    getDoctorStatusAction(),
  ]);
  return { patients, schedule, doctorStatus };
}

// ✅ Forward specific actions if you want to call them directly
export {
  recalculateQueueWithETC,
  addAppointmentAction,
  checkInPatientAction,
  updatePatientStatusAction,
  sendReminderAction,
  cancelAppointmentAction,
  markPatientAsLateAndCheckInAction,
  advanceQueueAction,
  startLastConsultationAction,
};
