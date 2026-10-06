#!/usr/bin/env node
/**
 * Generates every launcher / store / splash / notification image the app
 * needs, from one vector definition of the AdminOS "A" mark. Pure Node (zlib
 * only) — no image libraries, so it runs anywhere CI or a laptop can run node.
 *
 *   node scripts/generate-assets.cjs
 *
 * Re-run after changing the mark or the brand colours below. Output → assets/.
 * Store-listing text graphics (feature graphic, screenshots) are not generated
 * here — see STORE_LISTING.md.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const NAVY = [0x0a, 0x0f, 0x2c]
const INDIGO = [0x63, 0x66, 0xf1]
const VIOLET = [0x8b, 0x5c, 0xf6]
const WHITE = [0xff, 0xff, 0xff]

// The "A" as one even-odd compound path in a unit square (outer + counter).
const A_OUTER = [[0.27, 0.78], [0.44, 0.22], [0.56, 0.22], [0.73, 0.78], [0.61, 0.78], [0.575, 0.66], [0.425, 0.66], [0.39, 0.78]]
const A_COUNTER = [[0.455, 0.56], [0.5, 0.385], [0.545, 0.56]]

function inPoly(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Coverage (0..1) of the mark at pixel (px,py), 4×4 supersampled. */
function markCoverage(px, py, size, scale) {
  const SS = 4
  let hit = 0
  for (let sy = 0; sy < SS; sy++) {
    for (let sx = 0; sx < SS; sx++) {
      // unit coords, scaled about the centre
      const ux = ((px + (sx + 0.5) / SS) / size - 0.5) / scale + 0.5
      const uy = ((py + (sy + 0.5) / SS) / size - 0.5) / scale + 0.5
      if (inPoly(ux, uy, A_OUTER) !== inPoly(ux, uy, A_COUNTER)) hit++
    }
  }
  return hit / (SS * SS)
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

/**
 * Render an RGBA image.
 *  bg: null (transparent) | [r,g,b] | 'gradient'
 *  fg: mark colour, scale: mark size relative to the canvas
 */
function render(size, { bg, fg = WHITE, scale = 1 }) {
  const px = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let base = null
      if (bg === 'gradient') base = mix(INDIGO, VIOLET, (x + y) / (2 * size))
      else if (bg) base = bg
      const c = markCoverage(x, y, size, scale)
      const i = (y * size + x) * 4
      if (base) {
        const col = mix(base, fg, c)
        px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255
      } else {
        px[i] = fg[0]; px[i + 1] = fg[1]; px[i + 2] = fg[2]; px[i + 3] = Math.round(c * 255)
      }
    }
  }
  return encodePng(size, size, px)
}

/**
 * Play Store feature graphic (1024×500): navy → indigo sweep with the mark on
 * the left third. No text — Play warns against text in feature graphics
 * because it's cropped on some surfaces.
 */
function renderFeature(w, h) {
  const px = Buffer.alloc(w * h * 4)
  const mark = Math.round(h * 0.62)
  const ox = Math.round(w * 0.16), oy = Math.round((h - mark) / 2)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const base = mix(NAVY, mix(INDIGO, VIOLET, y / h), Math.min(1, (x / w) * 1.15))
      const inMark = x >= ox && x < ox + mark && y >= oy && y < oy + mark
      const c = inMark ? markCoverage(x - ox, y - oy, mark, 1) : 0
      const col = mix(base, WHITE, c)
      const i = (y * w + x) * 4
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255
    }
  }
  return encodePng(w, h, px)
}

// ── Minimal PNG encoder (RGBA8, filter 0) ──────────────────────────────────
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Outputs ────────────────────────────────────────────────────────────────
const out = path.join(__dirname, '..', 'assets')
fs.mkdirSync(path.join(out, 'store'), { recursive: true })

const jobs = [
  // Expo `icon` (iOS + legacy Android launcher): full-bleed, platform masks it.
  ['icon.png', 1024, { bg: 'gradient' }],
  // Android adaptive icon: mark only, inside the 66% safe zone; background colour set in app.config.
  ['adaptive-icon.png', 1024, { bg: null, scale: 0.78 }],
  // Android 13+ themed (monochrome) icon.
  ['adaptive-icon-monochrome.png', 1024, { bg: null, scale: 0.78 }],
  // Splash: mark on transparent, centred by expo-splash-screen on navy.
  ['splash-icon.png', 512, { bg: null, scale: 0.9 }],
  // Notification small icon: Android requires white-on-transparent.
  ['notification-icon.png', 96, { bg: null, scale: 1.1 }],
  ['favicon.png', 48, { bg: 'gradient' }],
  // Store listing hi-res icons: Google Play 512×512, Huawei AppGallery 216×216.
  ['store/play-icon-512.png', 512, { bg: 'gradient' }],
  ['store/appgallery-icon-216.png', 216, { bg: 'gradient' }],
]

for (const [name, size, opts] of jobs) {
  fs.writeFileSync(path.join(out, name), render(size, opts))
  console.log('wrote', name, `${size}×${size}`)
}
fs.writeFileSync(path.join(out, 'store/play-feature-graphic-1024x500.png'), renderFeature(1024, 500))
console.log('wrote store/play-feature-graphic-1024x500.png 1024×500')
// Exported for the splash/background colour in app.config.ts reference.
console.log('navy', NAVY.map((v) => v.toString(16).padStart(2, '0')).join(''))
