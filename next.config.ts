import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['better-sqlite3'],
  // The few images are tiny static files; serving them as-is means the server never writes an
  // image cache (releases are read-only on the VM).
  images: { unoptimized: true },
  // Don't write AGENTS.md into the repo on `next dev`.
  agentRules: false,
};

export default nextConfig;
