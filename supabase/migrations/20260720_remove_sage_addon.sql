-- Remove the Sage Sync add-on. It was seeded into the catalogue and bundled into
-- the Partner plan but the integration was never wired, so it can't be sold as a
-- working feature. This forward migration keeps a fresh rebuild consistent with
-- the live DB (where the row was already removed). Idempotent.
--
-- NOTE: the journal-CSV export is still described as "Xero/Sage-importable" — that
-- is a file-format claim (the CSV imports into Sage/Xero), not this add-on, and is
-- intentionally kept.

-- Drop the purchasable add-on.
DELETE FROM addon_catalogue WHERE slug = 'sage';

-- Unbundle it from any plan that included it (Partner).
UPDATE plan_catalogue
SET included_addons = array_remove(included_addons, 'sage')
WHERE 'sage' = ANY(included_addons);

-- The subscriptions.addon_sage / addon_sage_expires_at columns are left in place
-- (NOT NULL boolean default false = "not entitled"); no tenant ever held it, and
-- dropping columns is destructive. They are simply no longer read by the app.
