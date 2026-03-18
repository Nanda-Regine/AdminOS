import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const APP_URL = 'https://adminos.co.za'
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
    'business automation South Africa',
    'WhatsApp business bot South Africa',
    'AI admin assistant Africa',
    'SME software South Africa',
    'debt recovery automation',
    'staff management system South Africa',
    'business OS Africa',
    'AdminOS',
    'invoice management South Africa',
    'daily business brief AI',
    'POPI compliant business software',
    'load shedding resilient business tool',
    'Zulu Xhosa Afrikaans business software',
    'NGO management system South Africa',
    'school admin system South Africa',
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
    images: [
      {
        url: `${APP_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'AdminOS — AI Business Operating System for Africa',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — The OS That Runs Your Business`,
    description: APP_DESCRIPTION,
    images: [`${APP_URL}/og-image.png`],
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
    // Add Google Search Console verification token here when available
    // google: 'your-google-verification-token',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#059669' },
    { media: '(prefers-color-scheme: dark)', color: '#059669' },
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
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        {/* Preconnect to critical external origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${geistSans.variable} antialiased`}>{children}</body>
    </html>
  )
}
