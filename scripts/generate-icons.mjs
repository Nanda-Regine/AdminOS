/**
 * Generate PWA icons from SVG source.
 * Run once: node scripts/generate-icons.mjs
 *
 * Requires: npm install sharp (dev dependency)
 * Or use online converter: https://svgtopng.com (upload public/icons/icon.svg)
 * Output: public/icons/icon-192.png and public/icons/icon-512.png
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

async function generateIcons() {
  try {
    // Try sharp if installed
    const { default: sharp } = await import('sharp')
    const svgBuffer = readFileSync(join(projectRoot, 'public/icons/icon.svg'))

    for (const size of [192, 512]) {
      const outPath = join(projectRoot, `public/icons/icon-${size}.png`)
      await sharp(svgBuffer).resize(size, size).png().toFile(outPath)
      console.log(`✓ Generated icon-${size}.png`)
    }
  } catch {
    console.log(`
sharp not installed. To generate icons:

Option A — Install sharp and re-run:
  npm install --save-dev sharp
  node scripts/generate-icons.mjs

Option B — Online converter:
  1. Open public/icons/icon.svg in a browser
  2. Screenshot or export as 192x192 → save as public/icons/icon-192.png
  3. Export as 512x512 → save as public/icons/icon-512.png

Option C — Use a design tool (Figma, Canva) to create branded icons.
    `)
  }
}

generateIcons()
