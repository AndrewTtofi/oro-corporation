import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // Hide the floating dev-tools badge (it overlapped the sidebar "Log out").
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb", // 10MB doc upload + headroom
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default config;
