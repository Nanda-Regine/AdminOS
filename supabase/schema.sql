-- AdminOS Database Schema
-- Run this in your Supabase SQL editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'starter',
  whatsapp_number TEXT,
  business_type TEXT,
  country TEXT DEFAULT 'ZA',
  language_primary TEXT DEFAULT 'en',
  language_secondary TEXT[],
  timezone TEXT DEFAULT 'Africa/Johannesburg',
  settings JSONB DEFAULT '{}',
  goals_doc_url TEXT,
  system_prompt_cache TEXT,
  prompt_cached_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  payfast_merchant_id TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_own_data" ON public.tenants
  USING (id = (auth.jwt() ->> 'tenant_id')::UUID);

-- Conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  contact_name TEXT,
  contact_identifier TEXT,
  contact_type TEXT,
  status TEXT DEFAULT 'open',
  resolved_by TEXT,
  sentiment TEXT,
  intent TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.conversations
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE INDEX idx_conversations_tenant_id ON public.conversations(tenant_id);
CREATE INDEX idx_conversations_status ON public.conversations(tenant_id, status);
CREATE INDEX idx_conversations_contact ON public.conversations(tenant_id, contact_identifier);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  channel TEXT,
  tokens_used INTEGER,
  from_cache BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.messages
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE INDEX idx_messages_tenant_id ON public.messages(tenant_id);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);

-- Staff
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT,
  department TEXT,
  leave_balance DECIMAL DEFAULT 15,
  leave_taken DECIMAL DEFAULT 0,
  wellness_scores JSONB DEFAULT '[]',
  after_hours_flag BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.staff
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE INDEX idx_staff_tenant_id ON public.staff(tenant_id);
CREATE INDEX idx_staff_phone ON public.staff(tenant_id, phone);

-- Leave requests
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.leave_requests
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE INDEX idx_leave_requests_tenant_id ON public.leave_requests(tenant_id);
CREATE INDEX idx_leave_requests_staff_id ON public.leave_requests(staff_id);

-- Invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  amount DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  due_date DATE,
  days_overdue INTEGER GENERATED ALWAYS AS
    (CASE WHEN due_date < CURRENT_DATE THEN EXTRACT(DAY FROM NOW() - due_date)::INTEGER ELSE 0 END) STORED,
  status TEXT DEFAULT 'unpaid',
  escalation_level INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  xero_invoice_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.invoices
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE INDEX idx_invoices_tenant_id ON public.invoices(tenant_id);
CREATE INDEX idx_invoices_status ON public.invoices(tenant_id, status);
CREATE INDEX idx_invoices_due_date ON public.invoices(tenant_id, due_date);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  original_filename TEXT,
  file_type TEXT,
  storage_url TEXT,
  extracted_text TEXT,
  doc_category TEXT,
  ai_summary TEXT,
  extracted_goals JSONB,
  processing_status TEXT DEFAULT 'pending',
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.documents
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE INDEX idx_documents_tenant_id ON public.documents(tenant_id);

-- Goals
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  quarter TEXT,
  target_metric TEXT,
  current_value DECIMAL,
  target_value DECIMAL,
  progress_pct DECIMAL GENERATED ALWAYS AS
    (CASE WHEN target_value > 0 THEN (current_value / target_value * 100) ELSE 0 END) STORED,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.goals
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE INDEX idx_goals_tenant_id ON public.goals(tenant_id);

-- Audit log (append-only, no RLS — system writes only)
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  actor TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant_id ON public.audit_log(tenant_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at);

-- Revoke update/delete on audit_log
REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON public.audit_log FROM anon;

-- Function to auto-update conversations.updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
