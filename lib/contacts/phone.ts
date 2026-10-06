/**
 * Phone identity for contacts.
 *
 * The same person arrives as "+27 82 345 6789" (typed into the dashboard),
 * "0823456789" (public booking form) and "27823456789" (WhatsApp `from`).
 * Exact-string matching on `contacts.phone` made those three different people,
 * so every inbound channel duplicated the contact a business already had.
 *
 * `phoneDigits` is the comparison key (country digits, no '+', SA local 0 →
 * 27). `toE164` is the storage form for new rows. `phoneLikePattern` finds
 * existing rows whatever spacing they were stored with — candidates are then
 * confirmed with `samePhone`, so the loose LIKE can never produce a false match.
 *
 * No imports: loaded directly by tests under --experimental-strip-types.
 */

export function phoneDigits(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0') && d.length === 10) d = `27${d.slice(1)}`
  return d.length >= 7 && d.length <= 15 ? d : null
}

export function toE164(raw: string): string {
  const d = phoneDigits(raw)
  return d ? `+${d}` : raw.trim()
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = phoneDigits(a), db = phoneDigits(b)
  return da != null && da === db
}

/** `%8%2%3%4%5%6%7%8%9` — the last 9 digits in order, any separators between. */
export function phoneLikePattern(raw: string): string | null {
  const d = phoneDigits(raw)
  if (!d) return null
  return '%' + d.slice(-9).split('').join('%')
}
