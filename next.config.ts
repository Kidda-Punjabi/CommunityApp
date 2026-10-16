import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        destination: "/api/apple-app-site-association",
      },
    ];
  },
  serverExternalPackages: ["@pdf-lib/fontkit"],
  outputFileTracingIncludes: {
    "/api/certificates/**": [
      "./public/logo/kidda-peacock.png",
      "./public/fonts/certificate/**/*",
    ],
  },
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
