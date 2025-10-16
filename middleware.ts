import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // Root domain → Patient login portal
  if (host === "shantiq.in" || host === "www.shantiq.in") {
    return NextResponse.rewrite(new URL("/login", request.url));
  }

  // Dashboard
  if (host === "app.shantiq.in") {
    return NextResponse.rewrite(new URL("/", request.url));
  }

  // TV Display 1
  if (host === "tv1.shantiq.in") {
    return NextResponse.rewrite(new URL("/tv-display", request.url));
  }

  // TV Display 2
  if (host === "tv2.shantiq.in") {
    return NextResponse.rewrite(new URL("/tv-display?layout=2", request.url));
  }

  // Doctor Panel
  if (host === "doc.shantiq.in") {
    return NextResponse.rewrite(new URL("/doctor", request.url));
  }

  // Default → allow normal routing
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"], // run middleware for all routes except static assets
};
