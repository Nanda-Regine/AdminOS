/**
 * Expense receipts. Photos from the staff app go to the private
 * `expense-receipts` bucket and are referenced as
 * `storage:expense-receipts/<tenantId>/<uuid>.<ext>` in expenses.receipt_url;
 * they're served only by GET /api/expenses/[id]/receipt as a short-lived signed
 * URL after the same own-or-finance check as the claim. Older claims may hold
 * an external https link instead.
 *
 * No imports — shared by routes, the expenses page and tests.
 */

export const RECEIPT_BUCKET = 'expense-receipts'
export const RECEIPT_PREFIX = `storage:${RECEIPT_BUCKET}/`
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024

export function isStoredReceipt(ref: string | null | undefined): boolean {
  return typeof ref === 'string' && ref.startsWith(RECEIPT_PREFIX)
}

/** Storage object path for a stored receipt ref, or null. */
export function receiptPath(ref: string | null | undefined): string | null {
  return ref && isStoredReceipt(ref) ? ref.slice(RECEIPT_PREFIX.length) : null
}

/** A stored ref is only valid inside its own tenant's folder. */
export function isTenantReceiptRef(ref: string, tenantId: string): boolean {
  const path = receiptPath(ref)
  return path != null && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(path) && path.startsWith(`${tenantId}/`)
}

/** Link for a claim's receipt in the UI, or null. Never returns a non-https URL. */
export function receiptHref(claim: { id: string; receipt_url?: string | null }): string | null {
  const ref = claim.receipt_url
  if (!ref) return null
  if (isStoredReceipt(ref)) return `/api/expenses/${claim.id}/receipt`
  return ref.startsWith('https://') ? ref : null
}

/** Sniff the real file type from its first bytes — never trust the client's MIME. */
export function sniffReceiptType(bytes: Uint8Array): { ext: 'jpg' | 'png' | 'webp' | 'pdf'; mime: string } | null {
  const b = bytes
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', mime: 'image/png' }
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: 'webp', mime: 'image/webp' }
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { ext: 'pdf', mime: 'application/pdf' }
  return null
}
