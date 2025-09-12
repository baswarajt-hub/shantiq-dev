import { NextResponse } from 'next/server';
import { getFamily } from '@/lib/data';

export async function GET() {
  const family = await getFamily();
  return NextResponse.json(family, { status: 200 });
}
