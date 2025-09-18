import { NextResponse } from 'next/server';
import { getDoctorStatus } from '@/lib/data';

export const revalidate = 0;

export async function GET() {
  const status = await getDoctorStatus();
  return NextResponse.json(status, { status: 200 });
}
