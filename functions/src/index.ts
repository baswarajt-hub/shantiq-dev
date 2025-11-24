process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(
  process.env.FIREBASE_SERVICE_ACCOUNT ||
  process.env.service_account ||
  {}
);

// functions/src/index.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { recalcQueueForVisit, recalcQueueForDateSession } from "./recalcQueue";
import { getPatients, getDoctorStatus, getDoctorSchedule } from "./cloudApi";


export {
  // Export HTTP endpoints so Firebase deploys them
  getPatients,
  getDoctorStatus,
  getDoctorSchedule
};


/**
 * PATIENT TRIGGER
 * Fires whenever a patient document is created/updated/deleted.
 * Recalculates only if meaningful patient fields changed.
 */
export const onPatientChange = onDocumentWritten("patients/{visitId}", async (event) => {
  try {
    const visitId = event.params?.visitId;
    if (!visitId) {
      logger.warn("onPatientChange: No visitId in params");
      return;
    }

    const beforeData = event.data?.before?.data() ?? null;
    const afterData  = event.data?.after?.data()  ?? null;

    // If deleted → recalc (patient removed from queue)
    if (!afterData) {
      logger.info(`onPatientChange: visit ${visitId} deleted → recalculating`);
      await recalcQueueForVisit(visitId);
      return;
    }

    // If created → recalc
    if (!beforeData) {
      logger.info(`onPatientChange: visit ${visitId} created → recalculating`);
      await recalcQueueForVisit(visitId);
      return;
    }

    // Fields that should trigger recalc if changed
    const triggerFields = [
      "slotTime",
      "tokenNo",
      "status",
      "checkInTime",
      "consultationStartTime",
      "consultationEndTime",
      "consultationTime",
      "lateLocked",
      "lateAnchors",
      "type"
    ];

    const changed = triggerFields.some((field) => {
      const beforeVal = beforeData[field];
      const afterVal = afterData[field];

      // String comparison is safe for times, numbers, strings
      return String(beforeVal) !== String(afterVal);
    });

    if (!changed) {
      logger.debug(`onPatientChange: visit ${visitId} changed, but no relevant fields → skip`);
      return;
    }

    logger.info(`🔥 Trigger FIRED for visitId = ${visitId}`);
    await recalcQueueForVisit(visitId);

  } catch (err) {
    logger.error("onPatientChange error:", err);
  }
});

/**
 * SETTINGS TRIGGER
 * Fires whenever settings/live changes (doctor delay, overrides, closures, slot duration).
 * Recalculates BOTH today's morning & evening sessions.
 */
export const onSettingsLiveChange = onDocumentWritten("settings/live", async (event) => {
  try {
    logger.info("⚙️ settings/live changed — recalculating today's sessions");

    // Compute today's date in IST
    const now = new Date();
    const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const dateStr = istNow.toISOString().slice(0, 10); // YYYY-MM-DD

    await Promise.all([
      recalcQueueForDateSession(dateStr, "morning"),
      recalcQueueForDateSession(dateStr, "evening")
    ]);

    logger.info(`settings/live → recalculated morning & evening for ${dateStr}`);

  } catch (err) {
    logger.error("onSettingsLiveChange error:", err);
  }
});
