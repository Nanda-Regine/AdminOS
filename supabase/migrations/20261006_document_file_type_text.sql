-- Session 20: documents.file_type had no value for plain-text uploads (.txt is
-- on the upload allow-list), and the upload route wrote the raw extension
-- ('png', 'txt', ...) instead of the enum — every image and text upload failed
-- with 22P02. Code now maps extensions → enum (lib/documents/pipeline.ts
-- toDbFileType); this adds the one missing value. Additive and safe.
ALTER TYPE public.file_type ADD VALUE IF NOT EXISTS 'text';
