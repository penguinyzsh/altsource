import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    turbopack: {
        root: __dirname, // 明确指定项目根目录，消除多 lockfile 告警
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "raw.githubusercontent.com",
            },
            {
                protocol: "https",
                hostname: "avatars.githubusercontent.com",
            },
        ],
    },
};

export default nextConfig;
