import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    serverActions: {
      // Default is 1MB. Homework voice notes (and student-discount evidence)
      // are sent as Server Action FormData and were 413ing before Supabase.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
