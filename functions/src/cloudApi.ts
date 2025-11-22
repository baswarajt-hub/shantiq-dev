// functions/src/cloudApi.ts
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { firestore as adminFirestore } from "./firebaseAdmin";
import { Firestore } from "@google-cloud/firestore";

/**
 * Helper copied from your recalc code so server and cloud APIs use same session derivation.
 */
function deriveSession(slotTimeISO: string): "morning" | "evening" | null {
  if (!slotTimeISO) return null;
  const d = new Date(slotTimeISO);
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  const minutes = ist.getHours() * 60 + ist.getMinutes();

  const morningStart = 10 * 60 + 30; // 10:30
  const morningEnd = 13 * 60;        // 13:00
  const eveningStart = 18 * 60 + 30; // 18:30
  const eveningEnd = 21 * 60 + 30;   // 21:30

  if (minutes >= morningStart && minutes < morningEnd) return "morning";
  if (minutes >= eveningStart && minutes < eveningEnd) return "evening";
  return null;
}

const firestore = adminFirestore as Firestore;

/**
 * GET /getDoctorStatus
 * Returns the live status object from settings/live.status
 * Example: GET /getDoctorStatus
 */
export const getDoctorStatus = onRequest(async (req, res) => {
  try {
    const snap = await firestore.collection("settings").doc("live").get();
    const data = snap.exists ? (snap.data() as any) : {};
    const status = data?.status ?? {};
    res.json({ ok: true, status });
  } catch (err) {
    logger.error("getDoctorStatus error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * GET /getDoctorSchedule
 * Returns full schedule & settings.live.schedule
 * Example: GET /getDoctorSchedule
 */
export const getDoctorSchedule = onRequest(async (req, res) => {
  try {
    const snap = await firestore.collection("settings").doc("live").get();
    const data = snap.exists ? (snap.data() as any) : {};
    const schedule = data?.schedule ?? {};
    res.json({ ok: true, schedule });
  } catch (err) {
    logger.error("getDoctorSchedule error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * GET /getPatients
 * Query parameters:
 *  - date (YYYY-MM-DD) [required]
 *  - session ("morning"|"evening") [required]
 *
 * Returns:
 *   {
 *     ok: true,
 *     patients: [ ... ],
 *     stats: { count, bestCount, worstCount }
 *   }
 *
 * This endpoint reads patient docs for the given date, filters to session using deriveSession,
 * and returns sorted arrays (by tokenNo). It relies on precomputed fields (bestCaseETC/worstCaseETC)
 * which your recalc CF already maintains.
 */
export const getPatients = onRequest(async (req, res) => {
  try {
    const dateStr = String(req.query.date || req.body?.date || "").trim();
    const session = String(req.query.session || req.body?.session || "").trim() as "morning" | "evening";

    if (!dateStr || (session !== "morning" && session !== "evening")) {
      res.status(400).json({ ok: false, error: "Missing or invalid 'date' or 'session' parameter. Use date=YYYY-MM-DD and session=morning|evening" });
      return;
    }

    // Build UTC range for the date
    const dayStartISO = `${dateStr}T00:00:00.000Z`;
    const nextDayISO = (() => {
      const d = new Date(dateStr + "T00:00:00.000Z");
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10) + "T00:00:00.000Z";
    })();

    // Query patients for date window (single query)
    const snaps = await firestore
      .collection("patients")
      .where("slotTime", ">=", dayStartISO)
      .where("slotTime", "<", nextDayISO)
      .get();

    const allVisits = snaps.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any[];

    // Filter to this session
    const sessionVisits = allVisits.filter((v: any) => v?.slotTime && deriveSession(String(v.slotTime)) === session);

    // Sort by tokenNo for consistent display
    sessionVisits.sort((a: any, b: any) => (Number(a.tokenNo ?? 99999) - Number(b.tokenNo ?? 99999)) || String(a.id).localeCompare(String(b.id)));

    // Build minimal client payload — include common fields only (reduces payload size)
    const patients = sessionVisits.map((v: any) => ({
      id: v.id,
      name: v.name,
      phone: v.phone,
      tokenNo: v.tokenNo,
      status: v.status,
      type: v.type,
      checkInTime: v.checkInTime ?? null,
      appointmentTime: v.appointmentTime ?? v.slotTime,
      slotTime: v.slotTime,
      bestCaseETC: v.bestCaseETC ?? null,
      worstCaseETC: v.worstCaseETC ?? null,
      consultationTime: v.consultationTime ?? null,
      lateLocked: v.lateLocked ?? false,
      lateAnchors: v.lateAnchors ?? null,
      subType: v.subType ?? null
    }));

    // Stats for convenience
    const stats = {
      count: patients.length,
      bestCount: patients.filter(p => p.checkInTime).length,
      worstCount: patients.length // callers may combine with session slot count if they want
    };

    res.json({ ok: true, date: dateStr, session, patients, stats });
  } catch (err) {
    logger.error("getPatients error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});
