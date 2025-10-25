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

  // Map subdomains to your EXISTING routes
  const subdomainMap: { [key: string]: string } = {
    'app': '/',                    // app.shantiq.in → your existing dashboard (root)
    'doc': '/doctor',              // doc.shantiq.in → your existing doctor panel
    'tv1': '/tv-display',          // tv1.shantiq.in → your existing TV display
    'tv2': '/tv-display?layout=2', // tv2.shantiq.in → your existing TV display with layout param
    'www': '/login',               // www.shantiq.in → your existing patient login
    'shantiq': '/login'            // shantiq.in → your existing patient login
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
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}