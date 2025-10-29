// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname;
  const pathname = request.nextUrl.pathname;

  console.log('🔍 MIDDLEWARE TRIGGERED:', {
    hostname,
    pathname,
    fullUrl: request.url,
    userAgent: request.headers.get('user-agent')
  });

  if (pathname === '/') {
    let redirectPath = '';

    switch (hostname) {
      case 'shantiq.in':
        redirectPath = '/login';
        break;
      case 'app.shantiq.in':
        redirectPath = '/';
        break;
      case 'doc.shantiq.in':
        redirectPath = '/admin';
        break;
      case 'tv1.shantiq.in':
        redirectPath = '/admin/tv-display';
        break;
      case 'tv2.shantiq.in':
        redirectPath = '/admin/tv-display?layout=2';
        break;
      case 'shantiq.vercel.app':
        redirectPath = '/';
        break;
      default:
        redirectPath = '/';
        console.log('🔄 No redirect for hostname:', hostname);
    }

    console.log('🎯 Planning to redirect to:', redirectPath);

    if (redirectPath && redirectPath !== '/') {
      const url = request.nextUrl.clone();
      url.pathname = redirectPath.split('?')[0];
      if (redirectPath.includes('?')) {
        url.search = redirectPath.split('?')[1];
      }
      console.log('🚀 Actually redirecting to:', url.toString());
      return NextResponse.redirect(url);
    }
  }

  console.log('➡️ No redirect applied, continuing...');
  return NextResponse.next();
}

export const config = {
  matcher: '/',
};