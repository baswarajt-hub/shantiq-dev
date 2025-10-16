import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  console.log("🔍 Host:", request.headers.get("host"));

  const host = request.headers.get("host");

  if (!host) return NextResponse.next();

  // Redirects based on subdomain (example logic)
  if (host === "shantiq.in") {
    return NextResponse.rewrite(new URL("/login", request.url));
  }

  if (host === "app.shantiq.in") {
    return NextResponse.rewrite(new URL("/dashboard", request.url));
  }

  if (host === "tv1.shantiq.in") {
    return NextResponse.rewrite(new URL("/tv-display", request.url));
  }

  if (host === "tv2.shantiq.in") {
    return NextResponse.rewrite(new URL("/tv-display?layout=2", request.url));
  }

  if (host === "doc.shantiq.in") {
    return NextResponse.rewrite(new URL("/doctor", request.url));
  }

  return NextResponse.next();
}
