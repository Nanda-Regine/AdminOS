import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // ── Phase 0: tenant isolation guardrails ───────────────────────────────────
  // See WORKSPACE_ARCHITECTURE.md §4 and
  // supabase/migrations/20260717_phase0_tenant_isolation.sql.
  //
  // These rules exist because the tenant-isolation bug was not one mistake, it
  // was the same mistake copy-pasted across ~150 files. Review does not catch
  // the 151st. The linter does.
  {
    files: ["app/dashboard/**/*.{ts,tsx}"],
    rules: {
      // supabaseAdmin is the service-role client: it bypasses RLS entirely, so
      // every page using it hand-rolls its own tenant filter with no safety net.
      // Page code should read through lib/auth/context.ts, whose client is
      // scoped by RLS. Cron jobs, webhooks and admin routes legitimately need to
      // cross tenants and are not covered by this rule.
      //
      // WARN, not ERROR, on purpose: 31 dashboard pages still import it, and
      // next build runs ESLint, so erroring here would fail the deploy. Those 31
      // are no longer a breach — they filter on a tenant_id from app_metadata,
      // which the user cannot forge — they just have no second line of defence.
      // Flip this to "error" when Phase 2 finishes migrating them to ctx.db.
      "no-restricted-imports": ["warn", {
        paths: [{
          name: "@/lib/supabase/admin",
          importNames: ["supabaseAdmin"],
          message:
            "supabaseAdmin bypasses RLS. In page code use `getContext()` from " +
            "@/lib/auth/context and query via ctx.db, which RLS scopes to the " +
            "caller's tenant. If you genuinely need to cross tenants, do it in " +
            "an API route or Inngest function and say why in a comment.",
        }],
      }],
    },
  },
  {
    // Security claims live in app_metadata (service-role writable only). The
    // user owns user_metadata and can rewrite it via supabase.auth.updateUser(),
    // so any authorisation decision made from it is attacker-controlled. This is
    // the exact bug Phase 0 fixed; this rule stops it coming back.
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "expo-app/**/*.{ts,tsx}", "middleware.ts"],
    rules: {
      "no-restricted-syntax": ["error", {
        selector:
          "MemberExpression[object.property.name='user_metadata']" +
          ":matches([property.name='tenant_id'], [property.name='role'], [property.name='plan']," +
          " [property.name='suspended'], [property.name='trial_expired_at'], [property.name='staff_id'])",
        message:
          "This is a security claim and user_metadata is user-writable — read it " +
          "from app_metadata instead (or, better, from getContext() in " +
          "@/lib/auth/context). See migrations/20260717_phase0_tenant_isolation.sql.",
      }],
    },
  },
]);

export default eslintConfig;
