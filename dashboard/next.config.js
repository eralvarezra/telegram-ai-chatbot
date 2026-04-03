/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = {
  ...nextConfig,
  env: {
    NEXT_PUBLIC_API_URL: 'http://localhost:3000',
  },
}