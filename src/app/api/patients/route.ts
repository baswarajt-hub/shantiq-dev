import { NextResponse } from 'next/server';
import { getPatientsAction } from '@/app/actions';

export const revalidate = 0;

export async function GET() {
  const patients = await getPatientsAction();
  return NextResponse.json(patients, { status: 200 });
}
