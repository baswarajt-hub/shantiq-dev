import { NextResponse } from 'next/server';
import { getDoctorSchedule } from '@/lib/data';

export async function GET() {
  const schedule = await getDoctorSchedule();
  return NextResponse.json(schedule, { status: 200 });
}
