import { NextResponse } from 'next/server';
import { getDoctorStatusAction } from '@/app/actions';

export const revalidate = 0;

export async function GET() {
  const status = await getDoctorStatusAction();
  return NextResponse.json(status, { status: 200 });
}
