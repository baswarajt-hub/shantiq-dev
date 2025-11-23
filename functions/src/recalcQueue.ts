import { firestore as adminFirestore } from "./firebaseAdmin";
import { Firestore } from "@google-cloud/firestore";

/**
 * Entry point invoked for a single visit update.
 * Derives date & session from the visit slotTime and recalculates that session's queue.
 */
export async function recalcQueueForVisit(visitId: string) {
  const firestore = adminAdminOrFirestore();

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
 * Recalculate queue for a given date + session.
 * - dateStr: 'YYYY-MM-DD'
 * - session: 'morning' | 'evening'
 */
export async function recalcQueueForDateSession(dateStr: string, session: "morning" | "evening") {
  const firestore = adminAdminOrFirestore();

  // Load settings
  const settingsRef = firestore.collection("settings").doc("live");
  const settingsSnap = await settingsRef.get();
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

  // Determine anchor (base time) for ETC calculations
  const now = new Date();
  const doctorStatus = settings?.status ?? {};

  // Determine in-consultation patient (if any)
  const inConsult = sessionVisits.find((v: any) => v?.status === "In-Consultation" && v.consultationStartTime);

  // Convert session start/end (IST) to UTC Date objects
  const sessionStartUTC = new Date(convertISTDateTimeToUTC(dateStr, sessionStart));
  const sessionEndUTC = new Date(convertISTDateTimeToUTC(dateStr, sessionEnd));

  let anchor: Date = sessionStartUTC;

  if (inConsult) {
    // If someone is in consultation, anchor at their expected end (or now)
    const start = new Date(inConsult.consultationStartTime);
    const length = Number(inConsult.consultationTime ?? slotDuration);
    const expectedEnd = new Date(start.getTime() + length * 60000);
    anchor = expectedEnd > now ? expectedEnd : now;
  } else {
    // Not in consultation — determine anchor from doctor online state or session start
    let startDelayMinutes = Number(doctorStatus?.startDelay ?? 0);

    if (doctorStatus?.isOnline && doctorStatus?.onlineTime) {
      const onlineTime = new Date(doctorStatus.onlineTime);
      // consider onlineTime only if it is for the same calendar date in IST
      const onlineIst = new Date(onlineTime.getTime() + 5.5 * 3600 * 1000);
      const onlineDateStr = onlineIst.toISOString().slice(0, 10);

      if (onlineDateStr === dateStr) {
        // doctor came online today — anchor is max(now, onlineTime)
        anchor = onlineTime > now ? onlineTime : now;
        // per rule: once online, delay resets to 0
        if (startDelayMinutes > 0) {
          startDelayMinutes = 0;
          try {
            await settingsRef.set({ status: { ...doctorStatus, startDelay: 0 } }, { merge: true });
            console.log("Doctor came online — reset startDelay to 0 in settings");
          } catch (err) {
            console.warn("Failed to persist startDelay reset:", err);
          }
        }
      } else {
        // onlineTime is stale / other day — fall back to session start (but not earlier than now)
        anchor = sessionStartUTC > now ? sessionStartUTC : now;
      }

      // If doctor remained online beyond session end + 2 hours, auto-turn-off
      try {
        const sessionAutoOffCutoff = new Date(sessionEndUTC.getTime() + 2 * 60 * 60 * 1000);
        if (doctorStatus?.isOnline && now > sessionAutoOffCutoff) {
          // auto-off
          await settingsRef.set({ status: { ...doctorStatus, isOnline: false, onlineTime: null, startDelay: 0 } }, { merge: true });
          console.log("Auto-turned-off doctor's online status after session +2h");
        }
      } catch (err) {
        console.warn("Failed to auto-off doctor status:", err);
      }
    } else {
      // doctor not online — anchor is session start (but not earlier than now)
      anchor = sessionStartUTC > now ? sessionStartUTC : now;
    }

    // Apply configured startDelay (push the anchor later by startDelay minutes)
    try {
      const effectiveStartDelay = Number(doctorStatus?.startDelay ?? 0);
      if (effectiveStartDelay > 0) {
        const old = anchor;
        anchor = new Date(anchor.getTime() + effectiveStartDelay * 60000);
        console.log(`Applying doctor startDelay: ${effectiveStartDelay} minutes; anchor moved ${old.toISOString()} -> ${anchor.toISOString()}`);
      }
    } catch (err) {
      console.warn("Doctor delay handling failed:", err);
    }
  }

  // ------------------------------------------------------------------
  // Build worstQueueEntries based on tokens actually used (token-number model)
  // We will include placeholders only up to maxTokenUsed (no full-session enumeration)
  // ------------------------------------------------------------------
  const tokenNums = sessionVisits
    .map((v: any) => Number(v.tokenNo ?? 0))
    .filter((n: number) => Number.isFinite(n) && n > 0);

  const maxTokenUsed = tokenNums.length > 0 ? Math.max(...tokenNums) : 0;

  // If no tokens present, nothing to do
  if (maxTokenUsed === 0) {
    console.log(`No token numbers found for ${dateStr} ${session}`);
    return;
  }

  // Map token -> patients array
  const patientsByToken = new Map<number, any[]>();
  for (const v of sessionVisits) {
    const keyToken = Number(v.tokenNo ?? 0);
    if (!keyToken || !Number.isFinite(keyToken)) continue;
    const arr = patientsByToken.get(keyToken) ?? [];
    arr.push(v);
    patientsByToken.set(keyToken, arr);
  }

  // For deterministic ordering inside same token (multiple patients same slot),
  // sort by tokenNo (if present) else by doc id
  for (const [k, arr] of patientsByToken.entries()) {
    arr.sort((a: any, b: any) => (Number(a.tokenNo ?? 99999) - Number(b.tokenNo ?? 99999)) || String(a.id).localeCompare(String(b.id)));
    patientsByToken.set(k, arr);
  }

  // Build worstQueueEntries: token 1..maxTokenUsed
  const worstQueueEntries: Array<{ id?: string; isPlaceholder?: boolean; tokenNo: number; patient?: any }> = [];

  for (let t = 1; t <= maxTokenUsed; t++) {
    const arr = patientsByToken.get(t) ?? [];
    if (arr.length === 0) {
      worstQueueEntries.push({ isPlaceholder: true, tokenNo: t });
    } else {
      for (const p of arr) {
        worstQueueEntries.push({ id: p.id, isPlaceholder: false, tokenNo: t, patient: p });
      }
    }
  }

  // ------------------------------------------------------------------
  // Build bestQueue: active checked-in patients only (priority first)
  // Late-lock handling applies only to bestQueue as requested
  // ------------------------------------------------------------------
  const terminalStatuses = new Set(["Completed", "Cancelled"]);
  const inConsultationStatuses = new Set(["In-Consultation"]);

  // checked-in and not terminal, order by tokenNo ascending
  const checkedInAndWaiting = sessionVisits
    .filter((v: any) => v?.checkInTime && !terminalStatuses.has(v.status))
    .sort((a: any, b: any) => (Number(a.tokenNo ?? 99999) - Number(b.tokenNo ?? 99999)));

  // split
  const priorityCheckedIn = checkedInAndWaiting.filter((v: any) => String(v.status ?? "").toLowerCase() === "priority");
  const lateCheckedIn = checkedInAndWaiting.filter((v: any) => v?.lateLocked);
  const normalCheckedIn = checkedInAndWaiting.filter((v: any) => {
    const st = String(v.status ?? "").toLowerCase();
    return st === "waiting" || st === "up-next" || st === "booked" || st === "walk-in booked";
  });

  // Start with priority + normal
  let bestQueue: any[] = [...priorityCheckedIn, ...normalCheckedIn];

  // Insert late-locked patients at positions determined by their lateAnchors
  // lateAnchors is expected to be an array of visitIds representing patients that were ahead at lock time
  for (const lateP of lateCheckedIn) {
    const anchors: string[] = Array.isArray(lateP.lateAnchors) ? lateP.lateAnchors : [];
    // Find last existing anchor index in current bestQueue
    let lastIdx = -1;
    for (const aid of anchors) {
      const idx = bestQueue.findIndex((x: any) => x.id === aid);
      if (idx >= 0) lastIdx = Math.max(lastIdx, idx);
    }
    const insertAt = lastIdx + 1;
    // Ensure not inserting duplicates
    if (!bestQueue.some((x: any) => x.id === lateP.id)) {
      bestQueue.splice(insertAt, 0, lateP);
    }
  }

  // ------------------------------------------------------------------
  // Compute ETCs:
  // - bestCaseETC assigned by iterating bestQueue from anchor (+slotDuration)
  // - worstCaseETC assigned by iterating worstQueueEntries from anchor (+slotDuration)
  // - placeholders receive no DB writes but are used in worst-case calculation
  // ------------------------------------------------------------------
  const updatesMap = new Map<string, any>(); // id -> changes

  const setUpdate = (id: string, obj: any) => {
    const cur = updatesMap.get(id) ?? {};
    updatesMap.set(id, { ...cur, ...obj });
  };

  // Best-case through the bestQueue (only real patients)
  for (let i = 0; i < bestQueue.length; i++) {
    const patient = bestQueue[i];
    const bestMs = anchor.getTime() + i * slotDuration * 60000;
    setUpdate(patient.id, { bestCaseETC: new Date(bestMs).toISOString() });
  }

  // Worst-case through all slots (placeholders included)
  for (let i = 0; i < worstQueueEntries.length; i++) {
    const entry = worstQueueEntries[i];
    const worstMs = anchor.getTime() + i * slotDuration * 60000;
    if (!entry.isPlaceholder && entry.id) {
      setUpdate(entry.id, { worstCaseETC: new Date(worstMs).toISOString() });
    }
  }

  // Ensure for any patient we set worst >= best
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
  // (we only write back to real patient docs)
  // ------------------------------------------------------------------
  for (const visit of sessionVisits) {
    if (terminalStatuses.has(visit.status) || inConsultationStatuses.has(visit.status)) {
      // leave Completed / Cancelled / In-Consultation alone
      continue;
    }

    let normalized: string;
    if (visit.status === "In-Consultation") {
      normalized = "In-Consultation";
    } else if (visit.checkInTime) {
      normalized = "Waiting";
    } else if (visit.type === "Walk-in") {
      normalized = "Walk-in Booked"; // Option B
    } else {
      normalized = "Booked";
    }

    setUpdate(visit.id, { status: normalized });
  }

  // Assign Up-Next: first eligible in bestQueue
  let upNextAssigned = false;
  if (bestQueue.length > 0) {
    for (const candidate of bestQueue) {
      if (terminalStatuses.has(candidate.status) || inConsultationStatuses.has(candidate.status)) continue;
      setUpdate(candidate.id, { status: "Up-Next" });
      upNextAssigned = true;
      break;
    }
  }

  // Ensure In-Consultation patients keep that status
  const inConsultationPatients = sessionVisits.filter((v: any) => v?.status === "In-Consultation");
  for (const p of inConsultationPatients) {
    setUpdate(p.id, { status: "In-Consultation" });
  }

  // ------------------------------------------------------------------
  // Commit updates in a batch (only real patient docs)
  // ------------------------------------------------------------------
  if (updatesMap.size > 0) {
    const batch = firestore.batch();
    for (const [id, changes] of updatesMap.entries()) {
      const ref = firestore.collection("patients").doc(id);
      batch.set(ref, changes, { merge: true });
    }
    await batch.commit();
  } else {
    console.log(`No changes required for ${dateStr} ${session} — skipping write.`);
  }

  console.log(`Queue recalculated for ${dateStr} ${session}: best=${bestQueue.length}, worst=${worstQueueEntries.length}, updates=${updatesMap.size}`);
}

/* ----------------------------------------------------------------------
   Helper functions
   ---------------------------------------------------------------------- */

function adminAdminOrFirestore(): Firestore {
  // helper to avoid direct import errors when editing locally — use actual admin firestore import in runtime
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require('./firebaseAdmin');
    return (admin.firestore as unknown) as Firestore;
  } catch (e) {
    throw new Error('firebaseAdmin import failed');
  }
}

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
export function convertISTDateTimeToUTC(dateStr: string, timeStr: string) {
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
