-- POPIA s69: direct marketing by electronic communication (WhatsApp/SMS/email)
-- needs consent or an existing-customer relationship, AND the recipient must be
-- able to object on every message. `popia_consent` records the first; this
-- records the objection. Set when a contact replies STOP (webhook) or when the
-- business records it on the contact. Reach and sequences never message a
-- contact with this set. Additive + nullable: no existing row changes.
alter table public.contacts
  add column if not exists marketing_opt_out_at timestamptz;

comment on column public.contacts.marketing_opt_out_at is
  'POPIA s69(3)/(4): when this contact objected to direct marketing. Null = has not objected.';

create index if not exists contacts_tenant_marketing_ok_idx
  on public.contacts (tenant_id)
  where deleted_at is null and marketing_opt_out_at is null;
