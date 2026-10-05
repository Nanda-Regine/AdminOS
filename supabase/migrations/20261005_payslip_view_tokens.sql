-- 2026-10-05 — Session 18: payslips employees can actually open.
--
-- Payslip distribution WhatsApps each employee a link to
-- /api/payroll/payslip/<id>, which requires an AdminOS login — and live, 0 of
-- 12 staff rows are linked to a login. So every link led to a sign-in page.
-- (It also 404'd for everyone: the route selected columns that don't exist.)
--
-- Each payslip now carries an unguessable, expiring view token; the message
-- links to /api/payslips/view/<token>, which renders that one payslip with
-- sensitive identifiers masked. Additive.

ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS view_token text;
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS view_token_expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS payslips_view_token_key
  ON public.payslips (view_token)
  WHERE view_token IS NOT NULL;

NOTIFY pgrst, 'reload schema';
