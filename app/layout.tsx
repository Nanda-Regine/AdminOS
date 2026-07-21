import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { CookieConsent } from '@/components/CookieConsent'
import { PostHogAnalytics } from '@/components/providers/PostHogAnalytics'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://adminos.co.za'
const APP_NAME = 'AdminOS'
const APP_DESCRIPTION =
  'AI-powered business operating system for South African SMEs, NGOs, schools, and clinics. Automate WhatsApp, debt recovery, staff wellness, and get daily AI business briefs. Built for Africa.'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `${APP_NAME} — The OS That Runs Your Business`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: [
    // High-intent SA SME search terms
    'small business software South Africa',
    'invoicing software South Africa',
    'invoice app South Africa',
    'accounting software for small business South Africa',
    'payroll software South Africa',
    'PAYE UIF SDL payroll software',
    'bookkeeping software South Africa',
    'quotation software South Africa',
    'CRM software South Africa',
    'business management software South Africa',
    'debt collection software South Africa',
    'WhatsApp business automation South Africa',
    'stokvel management app',
    'point of sale small business South Africa',
    'SME software South Africa',
    // Product / brand
    'AdminOS',
    'business operating system South Africa',
    'AI business assistant South Africa',
    'debt recovery automation',
    'daily business brief AI',
    'staff management system South Africa',
    'business automation South Africa',
    // Compliance & context
    'POPIA compliant business software',
    'load shedding resilient business tool',
    'Zulu Xhosa Afrikaans business software',
    'NGO management system South Africa',
    'school admin system South Africa',
    'clinic management software South Africa',
    // Local (major metros)
    'business software Johannesburg',
    'business software Cape Town',
    'business software Durban',
    'business software Pretoria',
    'small business tools Soweto',
    'SME software Gqeberha Port Elizabeth',
  ],
  authors: [{ name: 'Nandawula Regine', url: APP_URL }],
  creator: 'Mirembe Muse (Pty) Ltd',
  publisher: 'Mirembe Muse (Pty) Ltd',
  category: 'Business Software',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    url: APP_URL,
    siteName: APP_NAME,
    title: `${APP_NAME} — The OS That Runs Your Business`,
    description: APP_DESCRIPTION,
    locale: 'en_ZA',
    // OG image auto-served from app/opengraph-image.tsx (Next.js convention)
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — The OS That Runs Your Business`,
    description: APP_DESCRIPTION,
    // Twitter image auto-served from app/twitter-image.tsx (Next.js convention)
    creator: '@CreativelyNanda',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: APP_URL,
    languages: {
      'en-ZA': APP_URL,
      'af-ZA': `${APP_URL}?lang=af`,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  verification: {
    google: 'JogHfuzsF3lFeAqN31WUTsUCxQH6gGsD8syARKx-T4I',
  },
  // Geo-targeting signals for South-Africa-wide local search.
  other: {
    'geo.region':    'ZA',
    'geo.placename': 'South Africa',
    'geo.position':  '-30.5595;22.9375',
    'ICBM':          '-30.5595, 22.9375',
    'distribution':  'global',
    'coverage':      'South Africa',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0A0F2C' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0F2C' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-ZA" dir="ltr">
      <head>
        {/* Apply the saved theme before paint to avoid a flash. Default: dark. */}
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.setAttribute('data-theme',localStorage.getItem('adminos-theme')||'dark')}catch(e){document.documentElement.setAttribute('data-theme','dark')}` }} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        {/* Preconnect to critical external origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${geistSans.variable} antialiased`}>
        {children}
        <CookieConsent />
        <PostHogAnalytics apiKey={process.env.POSTHOG_TOKEN} />
        <Analytics />
        <SpeedInsights />
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}` }} />
      </body>
    </html>
  )
}
