import { NextResponse } from 'next/server';
import { getFamilyAction } from '@/app/actions';

export const revalidate = 0;

export async function GET() {
  const family = await getFamilyAction();
  return NextResponse.json(family, { status: 200 });
}
