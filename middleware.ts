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

  // Map subdomains to your existing routes
  const subdomainMap: { [key: string]: string } = {
    'app': '/',                    // app.shantiq.in → dashboard (root)
    'doc': '/doctor',              // doc.shantiq.in → doctor panel
    'tv1': '/tv-display',          // tv1.shantiq.in → TV display 1
    'tv2': '/tv-display?layout=2', // tv2.shantiq.in → TV display 2 with layout param
    'www': '/login',               // www.shantiq.in → patient portal login
    'shantiq': '/login'            // shantiq.in → patient portal login
  }

  const pathname = subdomainMap[subdomain]

  if (pathname && !url.pathname.startsWith('/_next') && !url.pathname.startsWith('/api')) {
    // For routes with query parameters
    if (pathname.includes('?')) {
      const [basePath, queryString] = pathname.split('?')
      url.pathname = basePath
      url.search = queryString
    } else {
      url.pathname = pathname
    }
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