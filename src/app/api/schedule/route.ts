import { NextResponse } from 'next/server';
import { getDoctorScheduleAction } from '@/app/actions';

export const revalidate = 0;

export async function GET() {
  const schedule = await getDoctorScheduleAction();
  return NextResponse.json(schedule, { status: 200 });
}
