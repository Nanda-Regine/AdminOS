-- tasks.assigned_to referenced auth.users(id), but the only UI that ever
-- writes it (app/dashboard/tasks/TaskActions.tsx's "Assign To" dropdown)
-- populates it from `staff`, not from portal login accounts — so every task
-- creation/update that picked an assignee has always failed with a foreign
-- key violation. The 13 existing rows all point to one auth.users id from
-- scripts/seed-demo-tenant.mjs's demo data, none of which match any staff
-- record — nulled out here since they don't mean anything under the
-- corrected model.

UPDATE tasks SET assigned_to = NULL WHERE assigned_to IS NOT NULL;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL;
