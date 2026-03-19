import type { NextConfig } from 'next'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest:        'public',
  disable:     process.env.NODE_ENV === 'development',
  register:    true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // Supabase API — network first, short cache for fresh data
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler:    'NetworkFirst',
      options: {
        cacheName:  'supabase-api',
        expiration: { maxEntries: 50, maxAgeSeconds: 300 },
        networkTimeoutSeconds: 5,
      },
    },
    {
      // Next.js static assets — cache forever (content-hashed)
      urlPattern: /\/_next\/static\/.*/i,
      handler:    'CacheFirst',
      options: {
        cacheName:  'next-static',
        expiration: { maxEntries: 300, maxAgeSeconds: 31_536_000 },
      },
    },
    {
      // Dashboard pages — network first, fall back to cache during load shedding
      urlPattern: /^https:\/\/adminos\.co\.za\/dashboard.*/i,
      handler:    'NetworkFirst',
      options: {
        cacheName:  'dashboard-pages',
        expiration: { maxEntries: 20, maxAgeSeconds: 3_600 },
        networkTimeoutSeconds: 10,
      },
    },
  ],
})

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://app.360dialog.io https://api.resend.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Long cache for static assets
        source: '/icons/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },

  // Optimise imports from heavy packages to reduce bundle size
  experimental: {
    optimizePackageImports: ['@anthropic-ai/sdk', '@supabase/supabase-js', '@upstash/redis'],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/sign/**',
      },
    ],
  },

  // Keep AI SDK on Node.js runtime — it uses Node APIs
  serverExternalPackages: ['@anthropic-ai/sdk'],
}

export default withPWA(nextConfig)
