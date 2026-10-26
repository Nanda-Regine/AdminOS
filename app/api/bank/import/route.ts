import { z } from 'zod'
import { withRoute, badRequest } from '@/lib/api/withRoute'
import { MAX_STATEMENT_BYTES, commitStatement, previewStatement, settleAfterImport } from '@/lib/bank/service'

const query = z.object({ mode: z.enum(['preview', 'commit']).default('preview') })

/**
 * POST /api/bank/import?mode=preview|commit  (multipart/form-data, field "file")
 *
 * preview: parse, categorise, flag lines already imported and suggest invoice
 *          matches — writes nothing, so the owner sees what will happen first.
 * commit:  re-parses the file ON THE SERVER (the browser never sends amounts back
 *          to be trusted) and stores the new lines. Re-uploading an overlapping
 *          statement is safe: lines already imported are skipped.
 */
export const POST = withRoute({
  action: 'bank.write',
  query,
  rateLimit: 'api',
}, async ({ ctx, request, query, audit }) => {
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) throw badRequest('Choose a CSV file from your bank.')
  if (file.size === 0) throw badRequest('That file is empty.')
  if (file.size > MAX_STATEMENT_BYTES) throw badRequest('That file is over 2 MB. Export a shorter date range and try again.')
  if (!/\.(csv|txt)$/i.test(file.name)) throw badRequest('Only CSV files are supported. In your banking app choose Export → CSV.')

  const text = await file.text()

  if (query.mode === 'preview') {
    return previewStatement(ctx.tenantId, text)
  }

  const result = await commitStatement(ctx.tenantId, ctx.userId, file.name, text)
  await audit({
    action: 'bank.statement_imported',
    resourceType: 'bank_statement_import',
    resourceId: result.importId,
    metadata: { imported: result.imported, duplicates: result.duplicates, skipped: result.skipped },
  })
  const settled = await settleAfterImport(ctx.tenantId, ctx.userId)
  if (settled.applied > 0) {
    await audit({ action: 'bank.auto_matched', resourceType: 'bank_statement_import', resourceId: result.importId, metadata: { applied: settled.applied } })
  }
  return { ...result, settled }
})
