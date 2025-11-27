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
 * - dateStr: 'YYYY-MM-DD'
 * - session: 'morning' | 'evening'
 */
export async function recalcQueueForDateSession(dateStr: string, session: "morning" | "evening"): Promise<void> {
  const firestore = adminFirestore as Firestore;

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

  // Special closures (if schedule.specialClosures structure differs adapt accordingly)
  const specialClosures = schedule?.specialClosures ?? [];
  if (specialClosures.some((c: any) => c.date === dateStr && c.session === session)) {
    console.log(`Session ${session} on ${dateStr} closed by specialClosures`);
    return;
  }

  // Per-date override (if any)
  const override = (schedule?.overrides ?? []).find((o: any) => o.date === dateStr);
  const sessionStart = override?.[session]?.start ?? defaultSessionTimes[session].start;
  const sessionEnd = override?.[session]?.end ?? defaultSessionTimes[session].end;

  // Query patients for that UTC date window
  const dayStartISO = `${dateStr}T00:00:00.000Z`;
  const nextDayISO = nextDateStr(dateStr) + "T00:00:00.000Z";

  const snaps = await firestore
    .collection("patients")
    .where("slotTime", ">=", dayStartISO)
    .where("slotTime", "<", nextDayISO)
    .get();

  // Build list of visits for that date
  const allVisits = snaps.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any[];

  // Keep only visits that belong to this session
  const sessionVisits = allVisits.filter((v: any) => v?.slotTime && deriveSession(String(v.slotTime)) === session);

  if (sessionVisits.length === 0) {
    console.log(`No visits for ${dateStr} ${session}`);
    return;
  }

  // -------------------------
  // Anchor (base time) selection
  // -------------------------
  const now = new Date();
  const doctorStatus = settings?.status ?? {};

  // If someone is In-Consultation pick their expected end (or now)
  const inConsult = sessionVisits.find((v: any) => v?.status === "In-Consultation" && v.consultationStartTime);

  const sessionStartUTC = new Date(convertISTDateTimeToUTC(dateStr, sessionStart));
  const sessionEndUTC = new Date(convertISTDateTimeToUTC(dateStr, sessionEnd));

  let anchor: Date = sessionStartUTC;

  if (inConsult) {
    const start = new Date(inConsult.consultationStartTime);
    const length = Number(inConsult.consultationTime ?? slotDuration);
    const expectedEnd = new Date(start.getTime() + length * 60000);
    anchor = expectedEnd > now ? expectedEnd : now;
  } else {
    // If doctor is online and onlineTime is same calendar-day (IST), use that as anchor (or now)
    if (doctorStatus?.isOnline && doctorStatus?.onlineTime) {
      const onlineTime = new Date(doctorStatus.onlineTime);
      const onlineIst = new Date(onlineTime.getTime() + 5.5 * 3600 * 1000);
      const onlineDateStr = onlineIst.toISOString().slice(0, 10);

      if (onlineDateStr === dateStr) {
        anchor = onlineTime > now ? onlineTime : now;
        // rule: once online, startDelay resets to 0 persistently
        if (Number(doctorStatus.startDelay ?? 0) > 0) {
          try {
            await settingsRef.set({ status: { ...doctorStatus, startDelay: 0 } }, { merge: true });
            console.log("Doctor became online - reset startDelay to 0");
          } catch (err) {
            console.warn("Failed to persist startDelay reset:", err);
          }
        }
      } else {
        // onlineTime stale -> fall back to session start or now (whichever later)
        anchor = sessionStartUTC > now ? sessionStartUTC : now;
      }

      // auto-turn-off logic after session + 2 hours
      try {
        const autoOffCutoff = new Date(sessionEndUTC.getTime() + 2 * 60 * 60 * 1000);
        if (doctorStatus.isOnline && now > autoOffCutoff) {
          await settingsRef.set({ status: { ...doctorStatus, isOnline: false, onlineTime: null, startDelay: 0 } }, { merge: true });
          console.log("Auto-turned-off doctor's online status after session +2h");
        }
      } catch (err) {
        console.warn("Auto-off doctor status failed:", err);
      }
    } else {
      anchor = sessionStartUTC > now ? sessionStartUTC : now;
    }

    // Apply configured startDelay (push anchor forwards)
    const effectiveStartDelay = Number(doctorStatus?.startDelay ?? 0);
    if (effectiveStartDelay > 0) {
      const old = anchor;
      anchor = new Date(anchor.getTime() + effectiveStartDelay * 60000);
      console.log(`Applying doctor startDelay: ${effectiveStartDelay} minutes; anchor moved ${old.toISOString()} -> ${anchor.toISOString()}`);
    }
  }

  // -------------------------
  // Build worstQueue entries up to last used token (placeholders included)
  // -------------------------
  const tokenNums = sessionVisits
    .map((v: any) => Number(v.tokenNo ?? 0))
    .filter((n: number) => Number.isFinite(n) && n > 0);

  const maxTokenUsed = tokenNums.length > 0 ? Math.max(...tokenNums) : 0;
  if (maxTokenUsed === 0) {
    console.log(`No token numbers found for ${dateStr} ${session}`);
    return;
  }

  // Map token -> patient docs array (multiple per token allowed)
  const patientsByToken = new Map<number, any[]>();
  for (const v of sessionVisits) {
    const t = Number(v.tokenNo ?? 0);
    if (!t || !Number.isFinite(t)) continue;
    const arr = patientsByToken.get(t) ?? [];
    arr.push(v);
    patientsByToken.set(t, arr);
  }

  // Sort patients within token deterministically
  for (const [k, arr] of patientsByToken.entries()) {
    arr.sort((a: any, b: any) => ((Number(a.tokenNo ?? 99999) - Number(b.tokenNo ?? 99999)) || String(a.id).localeCompare(String(b.id))));
    patientsByToken.set(k, arr);
  }

  // Build worstQueueEntries as ordered sequence of tokens (placeholders where no patient)
  type WorstEntry = { id?: string; isPlaceholder?: boolean; tokenNo: number; patient?: any };
  const worstQueueEntries: WorstEntry[] = [];
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

  // -------------------------
  // Build bestQueue — only checked-in (and priority/late ordering)
  // Booked-but-not-checked-in must NOT get bestCaseETC nor Up-Next
  // -------------------------
  const terminalStatuses = new Set(["Completed", "Cancelled"]);
  const inConsultationStatuses = new Set(["In-Consultation"]);

  const checkedInAndWaiting = sessionVisits
    .filter((v: any) => v?.checkInTime && !terminalStatuses.has(v.status))
    .sort((a: any, b: any) => (Number(a.tokenNo ?? 99999) - Number(b.tokenNo ?? 99999)));

  const priorityCheckedIn = checkedInAndWaiting.filter((v: any) => String(v.status ?? "").toLowerCase() === "priority");
  const lateCheckedIn = checkedInAndWaiting.filter((v: any) => !!v?.lateLocked);
  const normalCheckedIn = checkedInAndWaiting.filter((v: any) => {
    const st = String(v.status ?? "").toLowerCase();
    return st === "waiting" || st === "up-next" || st === "confirmed" || st === "priority" || st === "late";
  });

  let bestQueue: any[] = [...priorityCheckedIn, ...normalCheckedIn];

  // Insert late-locked patients according to their anchors (we insert after last found anchor)
  for (const lateP of lateCheckedIn) {
    const anchors: string[] = Array.isArray(lateP.lateAnchors) ? lateP.lateAnchors : [];
    let lastIdx = -1;
    for (const aid of anchors) {
      const idx = bestQueue.findIndex((x: any) => x.id === aid);
      if (idx >= 0 && idx > lastIdx) lastIdx = idx;
    }
    const insertAt = lastIdx + 1;
    if (!bestQueue.some((x: any) => x.id === lateP.id)) {
      bestQueue.splice(insertAt, 0, lateP);
    }
  }

  // -------------------------
  // Compute ETCs
  // - bestCaseETC only assigned to checked-in patients (bestQueue)
  // - worstCaseETC assigned by walking worstQueueEntries (placeholders advance the clock)
  // -------------------------
  const updatesMap = new Map<string, any>(); // id -> changes
  const setUpdate = (id: string, obj: any) => {
    const cur = updatesMap.get(id) ?? {};
    updatesMap.set(id, { ...cur, ...obj });
  };

  // bestCaseETC for checked-in (bestQueue)
  for (let i = 0; i < bestQueue.length; i++) {
    const patient = bestQueue[i];
    const bestMs = anchor.getTime() + i * slotDuration * 60000;
    setUpdate(patient.id, { bestCaseETC: new Date(bestMs).toISOString() });
  }

  // worstCaseETC across tokens (placeholders included)
  for (let i = 0; i < worstQueueEntries.length; i++) {
    const entry = worstQueueEntries[i];
    const worstMs = anchor.getTime() + i * slotDuration * 60000;
    if (!entry.isPlaceholder && entry.id) {
      setUpdate(entry.id, { worstCaseETC: new Date(worstMs).toISOString() });
    }
  }

  // Ensure worst >= best, and set missing pair to the other
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

  // -------------------------
  // Normalize statuses (do NOT promote 'Booked' to Up-Next)
  // - Completed / Cancelled / In-Consultation -> leave as-is
  // - checked-in -> "Waiting"
  // - not checked-in & type Walk-in -> "Walk-in Booked" (if you prefer another label adjust here)
  // - otherwise -> "Booked"
  // -------------------------
  for (const visit of sessionVisits) {
    if (terminalStatuses.has(visit.status) || inConsultationStatuses.has(visit.status)) {
      continue;
    }

    let normalized: string;
    if (visit.checkInTime) {
      normalized = "Waiting";
    } else if (visit.type === "Walk-in") {
      normalized = "Walk-in Booked";
    } else {
      normalized = "Booked";
    }
    setUpdate(visit.id, { status: normalized });
  }

  // Assign exactly one Up-Next from bestQueue — only checked-in candidates
  if (bestQueue.length > 0) {
    for (const candidate of bestQueue) {
      if (terminalStatuses.has(candidate.status) || inConsultationStatuses.has(candidate.status)) continue;
      if (!candidate.checkInTime) continue; // only checked-in can be Up-Next
      setUpdate(candidate.id, { status: "Up-Next" });
      break;
    }
  }

  // Preserve In-Consultation statuses explicitly
  const inConsultationPatients = sessionVisits.filter((v: any) => v?.status === "In-Consultation");
  for (const p of inConsultationPatients) {
    setUpdate(p.id, { status: "In-Consultation" });
  }

  // -------------------------
  // Commit updates: compare DB values and write only real changes (reduces writes)
  // -------------------------
  if (updatesMap.size > 0) {
    const ids = Array.from(updatesMap.keys());
    const refs = ids.map(id => firestore.collection("patients").doc(id));
    // Firestore client library provides getAll on admin.firestore
    const snaps: DocumentSnapshot[] = await firestore.getAll(...refs);

    const filtered = new Map<string, any>();
    snaps.forEach((snap, idx) => {
      const id = ids[idx];
      const current = snap.exists ? (snap.data() as any) : {};
      const proposed = updatesMap.get(id) ?? {};
      const toWrite: any = {};
      for (const k of Object.keys(proposed)) {
        const curVal = current?.[k];
        const newVal = proposed[k];
        if (String(curVal) !== String(newVal)) {
          toWrite[k] = newVal;
        }
      }
      if (Object.keys(toWrite).length > 0) filtered.set(id, toWrite);
    });

    if (filtered.size > 0) {
      const batch = firestore.batch();
      for (const [id, changes] of filtered.entries()) {
        const ref = firestore.collection("patients").doc(id);
        batch.set(ref, changes, { merge: true });
      }
      await batch.commit();
      console.log(`Queue recalculated for ${dateStr} ${session}: best=${bestQueue.length}, worst=${worstQueueEntries.length}, updates=${filtered.size}`);
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
