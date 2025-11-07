import { addMinutes, max, parseISO } from "date-fns";
import type { Patient, DoctorSchedule, DoctorStatus } from "@/lib/types";

/**
 * Calculates Best & Worst ETC for a live queue of patients
 * ensuring Best < Worst always and ETCs move dynamically with time.
 *
 * @param liveQueue - ordered list of patients (in-consultation, up-next, waiting)
 * @param schedule - active doctor schedule
 * @param doctorStatus - online / delay / pause info
 * @param delayedClinicStartTime - session start including delay
 * @param inConsultation - patient currently being seen (if any)
 */
export function calculateETCsForQueue(
  liveQueue: Patient[],
  schedule: DoctorSchedule,
  doctorStatus: DoctorStatus,
  delayedClinicStartTime: Date,
  inConsultation?: Patient
): Map<string, { bestCaseETC: string; worstCaseETC: string }> {
  const etcMap = new Map<string, { bestCaseETC: string; worstCaseETC: string }>();
  if (!schedule?.slotDuration) return etcMap;

  const slot = schedule.slotDuration;
  const now = new Date();

  // Starting baseline for dynamic ETC
  let runningTime = new Date(delayedClinicStartTime);

  // Adjust for doctor online time or ongoing consultation
  if (doctorStatus.isOnline && doctorStatus.onlineTime) {
    runningTime = max([runningTime, now, parseISO(doctorStatus.onlineTime)]);
  }
  if (inConsultation?.consultationStartTime) {
    const expectedEnd = addMinutes(parseISO(inConsultation.consultationStartTime), slot);
    runningTime = max([runningTime, expectedEnd]);
  }

  for (const p of liveQueue) {
    // Skip currently in consultation – it already has ETCs
    if (p.status === "In-Consultation") continue;

    const bestCase = new Date(runningTime);
    const worstCase = addMinutes(bestCase, slot);

    etcMap.set(p.id, {
      bestCaseETC: bestCase.toISOString(),
      worstCaseETC: worstCase.toISOString(),
    });

    // Next patient's ETC starts from this patient's bestCase + slot
    runningTime = addMinutes(bestCase, slot);
  }

  return etcMap;
}
