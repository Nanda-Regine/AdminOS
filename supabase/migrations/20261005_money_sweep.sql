-- 2026-10-05 — Session 18 (Phase 2 Money sweep). All additive.
--
-- Checked live before writing: 0 duplicate (tenant_id, invoice_number),
-- 0 duplicate (payroll_run_id, staff_id), no adjust_product_stock function,
-- 0 products with negative stock — so both unique indexes build cleanly.

-- 1. Invoice numbers are unique per tenant. Numbers were count(*)+1, so two
--    invoices created at the same moment got the same number. The API now
--    retries on 23505 against this index. Null numbers (legacy rows) are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_invoice_number_key
  ON public.invoices (tenant_id, invoice_number)
  WHERE invoice_number IS NOT NULL;

-- 2. Atomic stock movement. Stock was read, adjusted in JS, and written back,
--    so two sales of the same item at once both read 5 and both wrote 4 —
--    and the products update had no tenant filter. One UPDATE with the
--    arithmetic and the "never below zero" check in the WHERE clause.
--    Returns the new stock, or NULL when the product isn't this tenant's,
--    is deleted, or doesn't have enough stock.
CREATE OR REPLACE FUNCTION public.adjust_product_stock(p_tenant uuid, p_product uuid, p_delta integer)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.products
     SET current_stock = current_stock + p_delta
   WHERE id = p_product
     AND tenant_id = p_tenant
     AND deleted_at IS NULL
     AND current_stock + p_delta >= 0
  RETURNING current_stock;
$$;
-- Server-only (called with the service role). Never callable from a browser.
REVOKE ALL ON FUNCTION public.adjust_product_stock(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(uuid, uuid, integer) TO service_role;

-- 3. Payslips: soft delete (a re-run of an unsent payroll replaces its
--    payslips — Rule #3, never hard-delete) and one live payslip per
--    employee per run. A re-run used to insert a second full set.
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS payslips_run_staff_live_key
  ON public.payslips (payroll_run_id, staff_id)
  WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
