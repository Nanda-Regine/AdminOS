-- Billing unification — one catalogue as the single source of truth
-- 2026-07-18 · Mirembe Muse (Pty) Ltd
--
-- Before this, add-ons were defined in three disagreeing places: the paid Paystack
-- flow (subscriptions.addon_* columns, 5 slugs), the display/gate side
-- (addon_catalogue + addon_subscriptions + planGates enum, a different 8 slugs),
-- and hardcoded arrays in the billing page. The billing page showed add-ons that
-- could not be bought, and feature-gating read a table payments never populated.
--
-- Canonical set = the 5 that have live Paystack plans:
--   ring, reach, sage, languages, client_portal
-- Activation truth = subscriptions.addon_<slug> (set by /api/paystack/webhook).
-- This migration makes addon_catalogue + plan_catalogue the single source for
-- display, price, and bundling; the app code reads only these + subscriptions.

BEGIN;

-- 1. Reseed addon_catalogue to the canonical 5 (prices from pricing_framework;
--    editable via the operator console). price_annual = 2 months free.
DELETE FROM addon_catalogue;
INSERT INTO addon_catalogue (slug, display_name, description, price_monthly, price_annual, active) VALUES
  ('ring',          'Ring',          'AI voice agent via Twilio — answers calls, takes messages, transfers to staff.',                349, 3490, true),
  ('reach',         'Reach',         'Broadcast campaigns to your contacts via WhatsApp — audience filters, delivery tracking.',      199, 1990, true),
  ('sage',          'Sage Sync',     'Bidirectional sync with Sage Accounting — contacts, invoices and payments stay aligned.',       199, 1990, true),
  ('languages',     'Languages',     'AI responses in all 11 official South African languages, auto-detected per contact.',           99,  990,  true),
  ('client_portal', 'Client Portal', 'Magic-link self-service portal — clients view invoices, pay online and submit documents.',      299, 2990, true);

-- 2. Bundling ladder: which add-ons each plan includes for free (drives upgrades).
--    Gating reads "tenant paid for the add-on OR the plan includes it".
ALTER TABLE plan_catalogue ADD COLUMN IF NOT EXISTS included_addons text[] NOT NULL DEFAULT '{}';
UPDATE plan_catalogue SET included_addons = '{}'::text[]                                              WHERE slug = 'solo';
UPDATE plan_catalogue SET included_addons = ARRAY['languages']                                        WHERE slug = 'grow';
UPDATE plan_catalogue SET included_addons = ARRAY['languages','reach']                                WHERE slug = 'operate';
UPDATE plan_catalogue SET included_addons = ARRAY['languages','reach','client_portal']                WHERE slug = 'scale';
UPDATE plan_catalogue SET included_addons = ARRAY['languages','reach','client_portal','ring','sage']  WHERE slug = 'partner';

-- 3. Drop the orphan add-on table. It was written only by the free-activation
--    /api/billing/addons route (removed) and read only by planGates (rewritten to
--    read subscriptions.addon_* + the bundle). Nothing else touches it.
DROP TABLE IF EXISTS addon_subscriptions;

COMMIT;

-- Verification:
--   SELECT slug, price_monthly FROM addon_catalogue ORDER BY price_monthly;   -- 5 rows
--   SELECT slug, included_addons FROM plan_catalogue ORDER BY price_monthly;  -- ladder
--   SELECT to_regclass('public.addon_subscriptions');                          -- NULL
