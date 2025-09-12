import { NextResponse } from 'next/server';
import { getPatients as getPatientsData } from '@/lib/data';

export async function GET() {
  const patients = await getPatientsData();
  return NextResponse.json(patients, { status: 200 });
}
