/** @type {import('next').NextConfig} */
const isDesktopBuild = process.env.DESKTOP_BUILD === 'true';

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  ...(isDesktopBuild ? { output: 'export', trailingSlash: true } : {}),
  images: {
    domains: ['localhost', 'images.unsplash.com', 'source.unsplash.com'],
    unoptimized: isDesktopBuild,
  },
};

if (!isDesktopBuild) {
  const backendOrigin = process.env.BACKEND_ORIGIN || 'http://127.0.0.1:3001';
  nextConfig.rewrites = async () => [
    {
      source: '/api/:path*',
      destination: `${backendOrigin}/api/:path*`,
    },
    {
      source: '/uploads/:path*',
      destination: `${backendOrigin}/uploads/:path*`,
    },
  ];
}

module.exports = nextConfig;
