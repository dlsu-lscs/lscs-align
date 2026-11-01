import type { NextConfig } from 'next';

function resolveApiOrigin(environment: NodeJS.ProcessEnv): string {
  const configured = environment.API_UPSTREAM_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const port = environment.API_PORT?.trim() || '4000';
  return `http://127.0.0.1:${port}`;
}

const nextConfig: NextConfig = {
  agentRules: false,
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${resolveApiOrigin(process.env)}/:path*`,
      },
    ];
  },
};

export default nextConfig;
