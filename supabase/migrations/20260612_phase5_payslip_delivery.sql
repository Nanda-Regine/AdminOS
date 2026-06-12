-- Payslip delivery tracking
ALTER TABLE payslips
  ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_method  TEXT;

-- Staff employee number (needed for payslip display)
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS employee_number TEXT;

-- Auto-generate employee_number for existing staff
UPDATE staff
SET employee_number = 'EMP-' || LPAD(ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at)::TEXT, 4, '0')
WHERE employee_number IS NULL;

-- payslips.other_deductions_total for convenience
ALTER TABLE payslips
  ADD COLUMN IF NOT EXISTS other_deductions_total NUMERIC DEFAULT 0;

-- payslips.pension_deduction
ALTER TABLE payslips
  ADD COLUMN IF NOT EXISTS pension_deduction NUMERIC DEFAULT 0;

-- staff.phone (if not already present)
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Board packs table needs period_start, period_end as DATE type
-- (already created via phase11_nps_social_webhook migration)
