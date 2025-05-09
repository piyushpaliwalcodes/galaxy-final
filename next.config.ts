import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {} as any,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: [
      "s3dev.imgix.net",
      "www.reshot.com",
      "cdn.prod.website-files.com",
    ],
  },
  async rewrites() {
    return [
      {
        source: "/(.*)",
        destination: "/"
      }
    ];
  },
};

export default nextConfig;
