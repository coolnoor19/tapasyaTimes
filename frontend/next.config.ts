import type { NextConfig } from "next";

// The browser only ever talks to this Next app. Anything under /api/ is forwarded to the backend,
// so there is ONE origin: no CORS, and the backend's refresh cookie (SameSite=Strict, path /api/v1/auth)
// is sent without trouble.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3005";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
