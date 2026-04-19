-- AdminOS Beta Tenant Seed
-- Run in Supabase SQL Editor to create a demo beta tenant for testing
-- Replace values below before running

DO $$
DECLARE
  v_tenant_id uuid := gen_random_uuid();
  v_staff1_id uuid := gen_random_uuid();
  v_staff2_id uuid := gen_random_uuid();
  v_contact1  uuid := gen_random_uuid();
  v_goal1_id  uuid := gen_random_uuid();
BEGIN

-- ── 1. Create tenant ──────────────────────────────────────────────────────────
INSERT INTO tenants (id, name, slug, plan, active, created_at)
VALUES (
  v_tenant_id,
  'Demo Business ZA',
  'demo-business-za',
  'growth',
  true,
  now()
);

-- ── 2. Staff members ──────────────────────────────────────────────────────────
INSERT INTO staff (id, tenant_id, full_name, role, department, phone, leave_balance, leave_taken, wellness_scores)
VALUES
  (
    v_staff1_id,
    v_tenant_id,
    'Amahle Dube',
    'Manager',
    'Operations',
    '+27821234567',
    21,
    3,
    '[{"score":4,"date":"2026-04-01"},{"score":5,"date":"2026-04-08"},{"score":4,"date":"2026-04-15"}]'
  ),
  (
    v_staff2_id,
    v_tenant_id,
    'Sipho Nkosi',
    'Sales Rep',
    'Sales',
    '+27831234567',
    21,
    0,
    '[{"score":3,"date":"2026-04-01"},{"score":3,"date":"2026-04-08"},{"score":4,"date":"2026-04-15"}]'
  );

-- ── 3. Sample contacts ────────────────────────────────────────────────────────
INSERT INTO contacts (id, tenant_id, identifier, name, phone, email, type, tags)
VALUES
  (
    v_contact1,
    v_tenant_id,
    '+27711234567',
    'Fatima Moosa',
    '+27711234567',
    'fatima@example.co.za',
    'client',
    ARRAY['vip', 'repeat']
  );

-- ── 4. Sample goal ────────────────────────────────────────────────────────────
INSERT INTO goals (id, tenant_id, title, description, quarter, target_metric, target_value, current_value, status)
VALUES (
  v_goal1_id,
  v_tenant_id,
  'Increase monthly revenue to R500k',
  'Grow recurring revenue through new client acquisitions and upsells',
  'Q2 2026',
  'monthly_revenue_zar',
  500000,
  310000,
  'active'
);

-- ── 5. Sample invoice ─────────────────────────────────────────────────────────
INSERT INTO invoices (
  tenant_id, contact_name, contact_phone, contact_email,
  amount, amount_paid, due_date, days_overdue, status, escalation_level
)
VALUES (
  v_tenant_id,
  'Fatima Moosa',
  '+27711234567',
  'fatima@example.co.za',
  15000,
  0,
  (CURRENT_DATE - INTERVAL '5 days')::text,
  5,
  'unpaid',
  1
);

RAISE NOTICE 'Beta tenant created with ID: %', v_tenant_id;
RAISE NOTICE 'Copy this tenant_id and set it in the owner user metadata: %', v_tenant_id;

END $$;
