/**
 * Drops a fixed, full-bleed accent texture behind a section's content so
 * specific areas (the human/learning/community cluster) feel materially
 * distinct from the navy-leather business surfaces. The texture is
 * theme-aware (warm wood in dark, warm stucco in light) via CSS tokens, and
 * always sits under a scrim so the page's token text stays legible.
 *
 * Render it once at the top of a page's JSX. It's decorative (aria-hidden)
 * and pointer-events:none, so it never interferes with the content above it.
 */
export function SectionBackground({ tone = 'warm' }: { tone?: 'warm' }) {
  return <div aria-hidden className={`section-bg section-${tone}`} />
}
