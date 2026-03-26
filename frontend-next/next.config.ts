import type { NextConfig } from "next";

const rawApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL;

const apiUrl = rawApiUrl ? new URL(rawApiUrl) : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...(apiUrl
        ? [
            {
              protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
              hostname: apiUrl.hostname,
              port: apiUrl.port || undefined,
              pathname: "/media/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
