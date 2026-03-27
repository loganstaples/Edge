/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    }
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};
module.exports = nextConfig;
