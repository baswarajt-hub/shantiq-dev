
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https"
        ,
        hostname: "api.qrserver.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.NODE_ENV === 'production' 
      ? 'https://shantiq.in' 
      : 'http://localhost:9002',
  },

  // 👇 Add this async rewrites section
  async rewrites() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "shantiq.in" }],
        destination: "/login",
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "app.shantiq.in" }],
        destination: "/",
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "tv1.shantiq.in" }],
        destination: "/tv-display",
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "tv2.shantiq.in" }],
        destination: "/tv-display?layout=2",
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "doc.shantiq.in" }],
        destination: "/doctor",
      },
    ];
  },
};

export default nextConfig;

    