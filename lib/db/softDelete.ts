/**
 * Soft delete — Rule #3: business records are never hard-deleted.
 *
 * "Delete" sets `deleted_at`; every read of a soft-deletable table filters it
 * out with `live()`. Rows stay recoverable (`restore()`), audit trails keep
 * resolving, and POPIA erasure requests go through the dedicated anonymise
 * path (app/api/compliance/delete-contact), not through this.
 *
 * Columns come from supabase/migrations/20261005_soft_delete_columns.sql.
 * Converting a route = swap `.delete()` for `softDelete()` AND add `live()` to
 * every read of that table — miss a read and "deleted" records reappear. Do
 * both in the same tab sweep.
 *
 * Mind unique constraints: a soft-deleted row still holds its unique key
 * (e.g. a contact's phone), so re-creating it 409s. Where that matters, make
 * the unique index partial: `… WHERE deleted_at IS NULL`.
 */

/** The subset of the supabase-js client softDelete needs. */
interface UpdateChain {
  eq(column: string, value: string): UpdateChain
  is(column: string, value: null): UpdateChain
  not(column: string, operator: string, value: null): UpdateChain
  select(columns: string): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> }
}
interface Db {
  from(table: string): { update(values: Record<string, unknown>): UpdateChain }
}

/**
 * Soft-delete one tenant-owned row. Returns false when no live row matched —
 * wrong id, another tenant's id, or already deleted; callers should 404.
 * Throws the DB error (withRoute maps it to a friendly response).
 */
export async function softDelete(
  db: Db,
  table: string,
  where: { id: string; tenantId: string },
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const { data, error } = await db
    .from(table)
    .update({ ...extra, deleted_at: new Date().toISOString() })
    .eq('id', where.id)
    .eq('tenant_id', where.tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw error
  return data != null
}

/** Undo a soft delete. Returns false when no deleted row matched. */
export async function restore(
  db: Db,
  table: string,
  where: { id: string; tenantId: string },
): Promise<boolean> {
  const { data, error } = await db
    .from(table)
    .update({ deleted_at: null })
    .eq('id', where.id)
    .eq('tenant_id', where.tenantId)
    .not('deleted_at', 'is', null)
    .select('id')
    .maybeSingle()
  if (error) throw error
  return data != null
}

/** Exclude soft-deleted rows: `live(db.from('contacts').select('*'))`. */
export function live<Q extends { is(column: string, value: null): Q }>(query: Q): Q {
  return query.is('deleted_at', null)
}
