/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Keep the manifest light; no heavy experimental flags needed.
  },
};

export default nextConfig;
