import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['better-sqlite3'],
  // Don't write AGENTS.md into the repo on `next dev`.
  agentRules: false,
};

export default nextConfig;
