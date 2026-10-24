// Renders docs/hackathon/deck.html to a 1920x1080 PDF and per-slide PNG previews.
//   node scripts/hackathon/build-deck.mjs
import path from 'path'
import { pathToFileURL } from 'url'
import { chromium } from '@playwright/test'

const dir = path.join(process.cwd(), 'docs', 'hackathon')
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
await p.goto(pathToFileURL(path.join(dir, 'deck.html')).href, { waitUntil: 'networkidle' })
await p.pdf({ path: path.join(dir, 'AdminOS-FNB-Hackathon-Pitch.pdf'), width: '1920px', height: '1080px', printBackground: true })
const n = await p.locator('.slide').count()
for (let i = 0; i < n; i++) {
  await p.locator('.slide').nth(i).screenshot({ path: path.join(dir, 'previews', `slide-${String(i + 1).padStart(2, '0')}.png`) })
}
await b.close()
console.log('slides', n)
