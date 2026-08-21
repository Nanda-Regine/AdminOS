-- Adds the 'view_communications' permission (call recordings/transcripts on
-- /dashboard/ring — previously ungated at the page level) and backfills it
-- onto every existing tenant's owner/admin roles, matching the same
-- owner/admin-only scope just added to DEFAULT_ROLE_PERMISSIONS in
-- lib/auth/permissions.ts. Without this backfill, gating the page would have
-- locked out every already-provisioned owner/admin the moment it shipped —
-- new tenants get it for free via seedDefaultRoles(), but seeding only runs
-- at tenant creation, not retroactively.

UPDATE roles
SET permissions = array_append(permissions, 'view_communications')
WHERE name IN ('owner', 'admin')
  AND is_system = true
  AND NOT ('view_communications' = ANY(permissions));
