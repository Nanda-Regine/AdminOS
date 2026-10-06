-- Session 20 (Workstream D): two SECURITY DEFINER functions take a tenant id as
-- an argument and were executable by anon and authenticated through PostgREST
-- (/rest/v1/rpc/...), so anyone holding a tenant's UUID could:
--   seed_compliance_calendar(uuid, int)  write compliance rows into that tenant
--   search_kb_articles(uuid, text, int)  list its KB titles, unpublished and deleted included
-- Both are only ever called by the server with the service role. The calendar
-- is now generated in TypeScript (lib/compliance/calendar.ts); the SQL seed is
-- kept only so older deploys keep working, and becomes service-role only.
-- Applied to prod 2026-10-06 (Nanda approved).

REVOKE EXECUTE ON FUNCTION public.seed_compliance_calendar(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.seed_compliance_calendar(uuid, integer) TO service_role;

-- Soft-deleted articles no longer match a search.
CREATE OR REPLACE FUNCTION public.search_kb_articles(p_tenant_id uuid, p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, title text, category_id uuid, tags text[], created_at timestamp with time zone, published boolean, rank real)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT id, title, category_id, tags, created_at, published,
         ts_rank(to_tsvector('english', title || ' ' || content), plainto_tsquery('english', p_query)) AS rank
  FROM kb_articles
  WHERE tenant_id = p_tenant_id
    AND deleted_at IS NULL
    AND to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', p_query)
  ORDER BY rank DESC
  LIMIT p_limit;
$function$;

REVOKE EXECUTE ON FUNCTION public.search_kb_articles(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.search_kb_articles(uuid, text, integer) TO service_role;
