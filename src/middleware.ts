// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname;
  const pathname = request.nextUrl.pathname;

  // Only redirect root path
  if (pathname === '/') {
    let redirectPath = '';

    switch (hostname) {
      case 'shantiq.in':
        redirectPath = '/login';
        break;
      case 'app.shantiq.in':
        redirectPath = '/'; // Main dashboard
        break;
      case 'doc.shantiq.in':
        redirectPath = '/admin'; // Doctor panel
        break;
      case 'tv1.shantiq.in':
        redirectPath = '/admin/tv-display';
        break;
      case 'tv2.shantiq.in':
        redirectPath = '/admin/tv-display?layout=2';
        break;
      case 'shantiq.vercel.app':
        redirectPath = '/'; // Keep Vercel URL as dashboard
        break;
      default:
        redirectPath = '/'; // Fallback to dashboard
    }

    if (redirectPath && redirectPath !== '/') {
      const url = request.nextUrl.clone();
      url.pathname = redirectPath.split('?')[0];
      if (redirectPath.includes('?')) {
        url.search = redirectPath.split('?')[1];
      }
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/',
};
