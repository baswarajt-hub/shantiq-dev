/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
      { protocol: "https", hostname: "api.qrserver.com", pathname: "/**" },
    ],
  },
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  },
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

module.exports = nextConfig;
