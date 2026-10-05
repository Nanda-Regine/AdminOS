import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, badRequest } from '@/lib/api/withRoute'
import { RECEIPT_BUCKET, RECEIPT_PREFIX, RECEIPT_MAX_BYTES, sniffReceiptType } from '@/lib/expenses/receipts'

const fileSchema = z.instanceof(Blob, { message: 'No file received.' })
  .refine((f) => f.size > 0, 'The file is empty.')
  .refine((f) => f.size <= RECEIPT_MAX_BYTES, 'Receipts can be at most 5 MB — retake the photo at a lower quality.')

// POST /api/expenses/receipt — multipart upload (field "file") of a receipt
// photo or PDF. Returns a `receiptRef` to pass to POST /api/expenses. The file
// lands in the tenant's folder of a private bucket; its type is read from its
// bytes, so a renamed script can't be stored as a "receipt".
export const POST = withRoute({
  action: 'expenses.submit',
  rateLimit: 'api',
}, async ({ request, ctx }) => {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw badRequest('Send the receipt as a multipart upload with a "file" field.')
  }
  const parsed = fileSchema.safeParse(form.get('file'))
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'No file received.')
  const file = parsed.data

  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffReceiptType(bytes)
  if (!type) throw badRequest('Receipts must be a JPG, PNG, WEBP photo or a PDF.')

  const path = `${ctx.tenantId}/${randomUUID()}.${type.ext}`
  const { error } = await supabaseAdmin.storage
    .from(RECEIPT_BUCKET)
    .upload(path, bytes, { contentType: type.mime, upsert: false })
  if (error) throw error

  return { receiptRef: `${RECEIPT_PREFIX}${path}` }
})
