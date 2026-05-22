import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "studypack-storage.syd1.digitaloceanspaces.com",
      },
    ],
  },
};

export default nextConfig;
