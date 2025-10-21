
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  console.log("🔍 Host:", request.headers.get("host"));
  return NextResponse.next();
}

    