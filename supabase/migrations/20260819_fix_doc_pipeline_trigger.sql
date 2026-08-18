-- Fix fn_trigger_doc_pipeline(): the original definition in
-- 002_v2_architecture.sql read NEW.status and NEW.storage_path, neither of
-- which exist on `documents` (the real columns are `processing_status` and
-- `storage_url` — see supabase/schema.sql). Every INSERT into `documents`
-- has therefore been throwing `42703 record "new" has no field "status"`
-- since that migration ran — a live, app-wide bug, not specific to any one
-- tenant. Discovered 2026-08-18 while seeding the "Mzansi Test Traders"
-- tester tenant (BUILD_JOURNEY_ADMINOS.md, same-day entry).
--
-- The corrected version already existed on paper in supabase/master_schema.sql
-- (marked with "-- FIX: was using NEW.status (wrong)...") but had never been
-- applied to production. This migration applies that exact fix, plus widens
-- the trigger to fire on processing_status transitions (not just INSERT) with
-- an idempotency guard, matching master_schema.sql.
--
-- Applied directly to production 2026-08-19 via the Supabase Management API
-- and verified (a real INSERT with processing_status='processing' now
-- succeeds and enqueues the correct workflow_queue payload; 5 realistic
-- documents were seeded into Mzansi Test Traders in the same pass). This
-- file makes that same fix reproducible for any future environment / local
-- dev DB.

CREATE OR REPLACE FUNCTION fn_trigger_doc_pipeline()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.processing_status = 'processing' AND
     (TG_OP = 'INSERT' OR OLD.processing_status IS DISTINCT FROM 'processing') THEN
    INSERT INTO workflow_queue (tenant_id, workflow_type, payload)
    VALUES (
      NEW.tenant_id,
      'document_uploaded',
      jsonb_build_object(
        'document_id',  NEW.id,
        'file_type',    COALESCE(NEW.file_type::text, 'unknown'),
        'storage_url',  NEW.storage_url,
        'is_reference', COALESCE(NEW.is_reference, false)
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_document_processing ON documents;
CREATE TRIGGER trg_document_processing
  AFTER INSERT OR UPDATE OF processing_status ON documents
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_doc_pipeline();
