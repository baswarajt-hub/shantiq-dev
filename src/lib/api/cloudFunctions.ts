// src/lib/api/cloudFunctions.ts

const BASE = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL;

if (!BASE) {
  console.warn("NEXT_PUBLIC_FUNCTIONS_BASE_URL is not set");
}

export async function fetchGetDoctorStatus() {
  const url = `${BASE}/getDoctorStatus`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("getDoctorStatus failed");
  return r.json();
}

export async function fetchGetDoctorSchedule() {
  const url = `${BASE}/getDoctorSchedule`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("getDoctorSchedule failed");
  return r.json();
}

export async function fetchGetPatients(dateStr: string, session: "morning" | "evening") {
  const url = `${BASE}/getPatients?date=${encodeURIComponent(dateStr)}&session=${encodeURIComponent(session)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("getPatients failed");
  return r.json();
}
