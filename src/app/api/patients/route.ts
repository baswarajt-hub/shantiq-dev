import { NextResponse } from 'next/server';
import { getPatientsAction, recalculateQueueWithETC } from '@/app/actions';

export const revalidate = 0;

export async function GET() {
  await recalculateQueueWithETC();
  const patients = await getPatientsAction();
  return NextResponse.json(patients, { status: 200 });
}

    