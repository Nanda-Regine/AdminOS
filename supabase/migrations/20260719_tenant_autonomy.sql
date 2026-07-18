-- Tenant autonomy config — the trust backbone (ported from JarvisOS os_autonomy_config).
-- Each tenant sets, per (domain, decision_type), how much AdminOS may do unattended:
--   A = auto-act · B = auto-draft + wait for owner · C = surface-only (notify, don't act).
-- Unconfigured rows fall back to a per-decision default in code (lib/autonomy/decisions.ts),
-- and ultimately to C. Reversible; additive.

CREATE TABLE IF NOT EXISTS public.tenant_autonomy_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain        text NOT NULL,
  decision_type text NOT NULL,
  tier          char(1) NOT NULL CHECK (tier IN ('A','B','C')),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, domain, decision_type)
);

CREATE INDEX IF NOT EXISTS idx_tenant_autonomy_config_tenant ON public.tenant_autonomy_config (tenant_id);

ALTER TABLE public.tenant_autonomy_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_autonomy_config_tenant ON public.tenant_autonomy_config;
CREATE POLICY tenant_autonomy_config_tenant ON public.tenant_autonomy_config
  FOR ALL USING (tenant_id = public.current_tenant_id());
