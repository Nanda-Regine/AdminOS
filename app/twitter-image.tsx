import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'AdminOS — The OS That Runs Your Business'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Re-use same image for Twitter card
export { default } from './opengraph-image'
