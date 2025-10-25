// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''
  
  // Remove port from hostname if present
  const cleanHostname = hostname.replace(/:\d+$/, '')
  
  // Extract subdomain
  const subdomain = cleanHostname.split('.')[0]

  // Map subdomains to routes
  const subdomainMap: { [key: string]: string } = {
    'app': '/dashboard',
    'doc': '/doctor',
    'tv1': '/tv/1',
    'tv2': '/tv/2',
    'www': '/patient',
    'shantiq': '/patient' // root domain
  }

  const pathname = subdomainMap[subdomain]

  if (pathname && !url.pathname.startsWith(pathname)) {
    // Rewrite to the appropriate route
    url.pathname = `${pathname}${url.pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}