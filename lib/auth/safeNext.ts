/**
 * Where to send someone after sign-in. The `next` / `redirect` query parameter is
 * attacker-controlled (a crafted login or confirmation link), so only a same-site
 * absolute PATH is ever honoured.
 *
 * `${origin}${next}` is not safe on its own: next="@evil.com" produces
 * https://www.adminos.co.za@evil.com, which browsers send to evil.com. And
 * router.push("https://evil.com") navigates off-site. Both are closed by requiring a
 * single leading slash and refusing "//host", "/\host" and any backslash or control char.
 *
 * No imports — tests load this file directly.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || typeof raw !== 'string') return fallback
  if (raw[0] !== '/') return fallback
  if (raw[1] === '/' || raw[1] === '\\') return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback
  return raw
}
