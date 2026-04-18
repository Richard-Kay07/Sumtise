/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['localhost'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['pdfkit', 'fontkit', 'iconv-lite'],
}

module.exports = nextConfig
