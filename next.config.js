/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  // Excluir pasta supabase/functions do build (Deno runtime, nao Next.js)
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
