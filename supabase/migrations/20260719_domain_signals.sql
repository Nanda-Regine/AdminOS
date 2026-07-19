-- Durable mirror of the signal bus (JarvisOS dual-write pattern).
--
-- The signal bus lives in Redis (lib/signals/bus.ts) and is the fast path. This
-- table is a DURABLE, RLS-safe copy written alongside every Redis publish, so:
--   * a Redis eviction / cold cache doesn't blank the Command Center — reads can
--     fall back to the last computed snapshot here;
--   * signals become queryable with normal tenant-scoped RLS (dashboards, exports)
--     without touching Redis.
-- Redis stays the source for hot reads; this is the backstop. Additive, reversible.

CREATE TABLE IF NOT EXISTS public.domain_signals (
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain     text NOT NULL,
  payload    jsonb NOT NULL,
  health     text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, domain)
);

ALTER TABLE public.domain_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS domain_signals_tenant ON public.domain_signals;
CREATE POLICY domain_signals_tenant ON public.domain_signals
  FOR ALL USING (tenant_id = public.current_tenant_id());
