// functions/src/recalcQueue.ts
import { firestore as adminFirestore } from "./firebaseAdmin";
import { Firestore, DocumentSnapshot } from "@google-cloud/firestore";

/**
 * Recalculate queue for a single visit -> derive date/session and call date-session recalculation.
 */
export async function recalcQueueForVisit(visitId: string): Promise<void> {
  const firestore = adminFirestore as Firestore;

  const snap = await firestore.collection("patients").doc(visitId).get();
  if (!snap.exists) return;

  const visit = snap.data() as any;
  if (!visit?.slotTime) return;

  const dateStr = String(visit.slotTime).slice(0, 10); // YYYY-MM-DD
  const session = deriveSession(String(visit.slotTime));
  if (!session) {
    console.log(`recalcQueueForVisit: visit ${visitId} slotTime outside sessions`);
    return;
  }

  await recalcQueueForDateSession(dateStr, session);
}

/**
 * Recalculate queue for a given date + session (morning/evening).
 */
export async function recalcQueueForDateSession(dateStr: string, session: "morning" | "evening"): Promise<void> {
  const firestore = adminFirestore as Firestore;

  // Load settings
  const settingsSnap = await firestore.collection("settings").doc("live").get();
  const settings = settingsSnap.exists ? (settingsSnap.data() as any) : {};
  const schedule = settings?.schedule ?? {};
  const slotDuration = Number(schedule?.slotDuration ?? 5); // minutes

  // Default session times (IST)
  const defaultSessionTimes = {
    morning: { start: "10:30", end: "13:00" },
    evening: { start: "18:30", end: "21:30" }
  };

  // Special closures
  const specialClosures = schedule?.specialClosures ?? [];
  if (specialClosures.some((c: any) => c.date === dateStr && c.session === session)) {
    console.log(`Session ${session} on ${dateStr} closed by specialClosures`);
    return;
  }

  // Override for this date if present
  const override = (schedule?.overrides ?? []).find((o: any) => o.date === dateStr);
  const sessionStart = override?.[session]?.start ?? defaultSessionTimes[session].start;
  const sessionEnd = override?.[session]?.end ?? defaultSessionTimes[session].end;

  // Query all patients for that UTC date window
  const dayStartISO = `${dateStr}T00:00:00.000Z`;
  const nextDayISO = nextDateStr(dateStr) + "T00:00:00.000Z";

  const snaps = await firestore
    .collection("patients")
    .where("slotTime", ">=", dayStartISO)
    .where("slotTime", "<", nextDayISO)
    .get();

  const allVisits = snaps.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any[];

  // Keep only visits that belong to this session
  const sessionVisits = allVisits.filter((v: any) => v?.slotTime && deriveSession(String(v.slotTime)) === session);

  if (sessionVisits.length === 0) {
    console.log(`No visits for ${dateStr} ${session}`);
    return;
  }

  // --- Determine anchor (base time) for ETC calculations ---
  const now = new Date();
  const doctorStatus = settings?.status ?? {};

  // Determine if someone is currently in consultation
  const inConsult = sessionVisits.find((v: any) => v?.status === "In-Consultation" && v.consultationStartTime);

  // Convert session start/end (IST) to UTC Date objects
  const sessionStartUTC = new Date(convertISTDateTimeToUTC(dateStr, sessionStart));
  const sessionEndUTC = new Date(convertISTDateTimeToUTC(dateStr, sessionEnd));

  // Start anchor at session start; will be adjusted below
  let anchor: Date = sessionStartUTC;

  if (inConsult) {
    // if someone is in consultation, anchor is when that consultation should end (or now)
    const start = new Date(inConsult.consultationStartTime);
    const length = Number(inConsult.consultationTime ?? slotDuration);
    const expectedEnd = new Date(start.getTime() + length * 60000);
    anchor = expectedEnd > now ? expectedEnd : now;
  } else if (doctorStatus?.isOnline && doctorStatus?.onlineTime) {
    // Use doctor's onlineTime only if it falls within today's session window (to avoid stale timestamps)
    const onlineTime = new Date(doctorStatus.onlineTime);
    if (onlineTime >= sessionStartUTC && onlineTime <= sessionEndUTC) {
      anchor = onlineTime > now ? onlineTime : now;
    } else {
      anchor = sessionStartUTC;
    }
  } else {
    anchor = sessionStartUTC;
  }

  // Apply doctor startDelay (minutes) if present
  try {
    const startDelayMinutes = Number(doctorStatus?.startDelay ?? 0);
    if (startDelayMinutes > 0) {
      const old = anchor;
      anchor = new Date(anchor.getTime() + startDelayMinutes * 60000);
      console.log(`Applying doctor startDelay: ${startDelayMinutes} minutes; anchor moved ${old.toISOString()} -> ${anchor.toISOString()}`);
    }
  } catch (err) {
    console.warn("Doctor delay handling failed:", err);
  }

  // Debug: show final anchor so you can confirm in logs
  console.log(`Final anchor for ${dateStr} ${session}: ${anchor.toISOString()}`);

  // ------------------------------------------------------------------
  // Build timeline of slot times for this session (UTC)
  // Generate only up to the highest token (maxToken) or last patient slot
  // ------------------------------------------------------------------

  // Determine maximum token number present (preferred)
  let maxToken = Math.max(...sessionVisits.map(v => Number(v.tokenNo ?? 0)), 0);

  // Fallback: if no token numbers found, derive from last slotTime
  if (!maxToken || maxToken <= 0) {
    // compute latest slotTime among patients
    const lastSlotMs = Math.max(...sessionVisits.map(v => new Date(String(v.slotTime)).getTime()));
    const deltaMs = lastSlotMs - sessionStartUTC.getTime();
    if (deltaMs >= 0) {
      maxToken = Math.floor(deltaMs / (slotDuration * 60000)) + 1;
    } else {
      maxToken = 1;
    }
  }

  console.log(`Using maxToken=${maxToken} for ${dateStr} ${session}`);

  const slotTimesUTC: string[] = [];
  for (let token = 1; token <= maxToken; token++) {
    const offsetMs = (token - 1) * slotDuration * 60000;
    const dt = new Date(sessionStartUTC.getTime() + offsetMs);
    slotTimesUTC.push(dt.toISOString());
  }

  // Build a map from slotTime -> patient(s)
  const patientsBySlot = new Map<string, any[]>();
  for (const v of sessionVisits) {
    const key = String(v.slotTime);
    const arr = patientsBySlot.get(key) ?? [];
    arr.push(v);
    patientsBySlot.set(key, arr);
  }

  // Deterministic ordering inside same slot: tokenNo then id
  for (const [k, arr] of patientsBySlot.entries()) {
    arr.sort((a: any, b: any) => (Number(a.tokenNo ?? 99999) - Number(b.tokenNo ?? 99999)) || String(a.id).localeCompare(String(b.id)));
    patientsBySlot.set(k, arr);
  }

  // ------------------------------------------------------------------
  // Build worstQueueEntries: placeholders (empty slots) + patient entries
  // Each entry: { id?, isPlaceholder, slotTime, patient? }
  // ------------------------------------------------------------------
  const worstQueueEntries: Array<{ id?: string; isPlaceholder?: boolean; slotTime: string; patient?: any }> = [];

  for (let i = 0; i < slotTimesUTC.length; i++) {
    const st = slotTimesUTC[i];
    const patientsInSlot = patientsBySlot.get(st) ?? [];

    if (patientsInSlot.length === 0) {
      worstQueueEntries.push({ isPlaceholder: true, slotTime: st });
    } else {
      for (const p of patientsInSlot) {
        worstQueueEntries.push({ id: p.id, isPlaceholder: false, slotTime: st, patient: p });
      }
    }
  }

  // ------------------------------------------------------------------
  // Build bestQueue: patients considered for Up-Next & bestCaseETC
  // Best queue includes checked-in / priority / late (but not placeholders)
  // If none checked-in, include earliest booked (bookedNotArrived[0]) as Up-Next candidate
  // ------------------------------------------------------------------
  const terminalStatuses = new Set(["Completed", "Cancelled"]);
  const inConsultationStatuses = new Set(["In-Consultation"]);

  const checkedInAndWaiting = sessionVisits
    .filter((v: any) => v?.checkInTime && !terminalStatuses.has(v.status))
    .sort((a: any, b: any) => (Number(a.tokenNo ?? 99999) - Number(b.tokenNo ?? 99999)));

  const bookedNotArrived = sessionVisits
    .filter((v: any) => !v?.checkInTime && !terminalStatuses.has(v.status))
    .sort((a: any, b: any) => (Number(a.tokenNo ?? 99999) - Number(b.tokenNo ?? 99999)));

  const priorityCheckedIn = checkedInAndWaiting.filter((v: any) => String(v.status ?? "").toLowerCase() === "priority");
  const lateCheckedIn = checkedInAndWaiting.filter((v: any) => String(v.status ?? "").toLowerCase() === "late");
  const normalCheckedIn = checkedInAndWaiting.filter((v: any) => {
    const st = String(v.status ?? "").toLowerCase();
    return st === "waiting" || st === "booked" || st === "confirmed" || st === "up-next";
  });

  let bestQueue = [...priorityCheckedIn, ...normalCheckedIn, ...lateCheckedIn];

  if (bestQueue.length === 0 && bookedNotArrived.length > 0) {
    bestQueue.push(bookedNotArrived[0]);
  }

  // ------------------------------------------------------------------
  // Compute ETCs:
  // - bestCaseETC: anchor + index_in_bestQueue * slotDuration
  // - worstCaseETC: anchor + index_in_worstQueueEntries * slotDuration
  // ------------------------------------------------------------------
  const updatesMap = new Map<string, any>(); // id -> { field: value }

  const setUpdate = (id: string, obj: any) => {
    const cur = updatesMap.get(id) ?? {};
    updatesMap.set(id, { ...cur, ...obj });
  };

  for (let i = 0; i < bestQueue.length; i++) {
    const patient = bestQueue[i];
    const bestMs = anchor.getTime() + i * slotDuration * 60000;
    setUpdate(patient.id, { bestCaseETC: new Date(bestMs).toISOString() });
  }

  for (let i = 0; i < worstQueueEntries.length; i++) {
    const entry = worstQueueEntries[i];
    const worstMs = anchor.getTime() + i * slotDuration * 60000;
    if (!entry.isPlaceholder && entry.id) {
      setUpdate(entry.id, { worstCaseETC: new Date(worstMs).toISOString() });
    }
  }

  // Ensure worst >= best for any patient
  for (const [id, obj] of Array.from(updatesMap.entries())) {
    const best = obj.bestCaseETC ? new Date(obj.bestCaseETC).getTime() : null;
    const worst = obj.worstCaseETC ? new Date(obj.worstCaseETC).getTime() : null;
    if (best !== null && worst !== null) {
      if (worst < best) obj.worstCaseETC = obj.bestCaseETC;
    } else if (best !== null && worst === null) {
      obj.worstCaseETC = obj.bestCaseETC;
    } else if (worst !== null && best === null) {
      obj.bestCaseETC = obj.worstCaseETC;
    }
    updatesMap.set(id, obj);
  }

  // ------------------------------------------------------------------
  // Reset non-terminal statuses to baseline and assign exactly one Up-Next
  // ------------------------------------------------------------------
  for (const visit of sessionVisits) {
    if (terminalStatuses.has(visit.status) || inConsultationStatuses.has(visit.status)) {
      continue;
    }
    const normalized = visit.checkInTime ? "Waiting" : (visit.status ?? "Booked");
    setUpdate(visit.id, { status: normalized });
  }

  // Assign Up-Next
  if (bestQueue.length > 0) {
    for (const candidate of bestQueue) {
      if (terminalStatuses.has(candidate.status) || inConsultationStatuses.has(candidate.status)) continue;
      setUpdate(candidate.id, { status: "Up-Next" });
      break;
    }
  }

  // Ensure In-Consultation patients keep that status
  const inConsultationPatients = sessionVisits.filter((v: any) => v?.status === "In-Consultation");
  for (const p of inConsultationPatients) {
    setUpdate(p.id, { status: "In-Consultation" });
  }

  // ------------------------------------------------------------------
  // FIX-B: Commit updates ONLY if the values actually changed
  // ------------------------------------------------------------------
  if (updatesMap.size > 0) {
    // 1) Fetch all patient docs that we plan to update (in a single batch read)
    const ids = Array.from(updatesMap.keys());
    const refs = ids.map((id) => firestore.collection("patients").doc(id));
    const snaps: DocumentSnapshot[] = await firestore.getAll(...refs);

    const filteredUpdates = new Map<string, any>();

    // 2) Compare current DB value vs. proposed value
    snaps.forEach((snap, index) => {
      const id = ids[index];
      const newValues = updatesMap.get(id) ?? {};
      const currentValues = snap.exists ? (snap.data() as any) : {};

      const toWrite: any = {};

      for (const key of Object.keys(newValues)) {
        const newVal = newValues[key];
        const curVal = currentValues?.[key];

        if (String(curVal) !== String(newVal)) {
          toWrite[key] = newVal;
        }
      }

      if (Object.keys(toWrite).length > 0) {
        filteredUpdates.set(id, toWrite);
      }
    });

    // 3) Only write REAL changes
    if (filteredUpdates.size > 0) {
      const batch = firestore.batch();
      for (const [id, changes] of filteredUpdates.entries()) {
        const ref = firestore.collection("patients").doc(id);
        batch.set(ref, changes, { merge: true });
      }
      await batch.commit();

      console.log(
        `Queue recalculated for ${dateStr} ${session}: best=${bestQueue.length}, worst=${worstQueueEntries.length}, updates=${filteredUpdates.size}`
      );
    } else {
      console.log(`No changes required for ${dateStr} ${session} — skipping write.`);
    }
  } else {
    console.log(`Queue recalculated for ${dateStr} ${session}: best=${bestQueue.length}, worst=${worstQueueEntries.length}, updates=0`);
  }
}

/* ----------------------------------------------------------------------
   Helper functions
   ---------------------------------------------------------------------- */

/** Determine session from slotTime ISO string (assumes slotTime is UTC string) */
export function deriveSession(slotTimeISO: string): "morning" | "evening" | null {
  if (!slotTimeISO) return null;
  const d = new Date(slotTimeISO);
  // convert to IST by adding 5h30m
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

/** Convert YYYY-MM-DD + HH:mm (IST) → UTC ISO */
export function convertISTDateTimeToUTC(dateStr: string, timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const istMs = Date.UTC(
    Number(dateStr.slice(0, 4)),
    Number(dateStr.slice(5, 7)) - 1,
    Number(dateStr.slice(8, 10)),
    h,
    m,
    0
  );
  // IST is UTC+5:30, so subtract 5.5 hours to get UTC millis
  const utcMs = istMs - (5.5 * 3600 * 1000);
  return new Date(utcMs).toISOString();
}

/** Return next date string "YYYY-MM-DD" */
export function nextDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
