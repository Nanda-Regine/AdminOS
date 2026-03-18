export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Plan = 'starter' | 'business' | 'enterprise' | 'white_label'
export type BusinessType = 'school' | 'clinic' | 'ngo' | 'retail' | 'property' | 'other'
export type Channel = 'whatsapp' | 'email' | 'dashboard'
export type ConversationStatus = 'open' | 'auto_resolved' | 'escalated' | 'closed'
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'urgent'
export type ContactType = 'staff' | 'client' | 'supplier' | 'unknown'
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'in_collections'
export type LeaveStatus = 'pending' | 'approved' | 'declined'
export type FileType = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'image'
export type DocCategory = 'strategy' | 'invoice' | 'hr' | 'report' | 'contract'
export type GoalStatus = 'active' | 'achieved' | 'missed'
export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: Plan
  whatsapp_number: string | null
  business_type: BusinessType | null
  country: string
  language_primary: string
  language_secondary: string[] | null
  timezone: string
  settings: TenantSettings
  goals_doc_url: string | null
  system_prompt_cache: string | null
  prompt_cached_at: string | null
  stripe_customer_id: string | null
  payfast_merchant_id: string | null
  active: boolean
  created_at: string
}

export interface TenantSettings {
  tone?: string
  policies?: string
  faqs?: string
  staff_directory?: string
  services?: string
  templates?: string
  extracted_goals?: string
  integrations?: string[]
  business_hours?: string
  location?: string
  logo_url?: string
}

export interface Conversation {
  id: string
  tenant_id: string
  channel: Channel
  contact_name: string | null
  contact_identifier: string | null
  contact_type: ContactType | null
  status: ConversationStatus
  resolved_by: string | null
  sentiment: Sentiment | null
  intent: string | null
  summary: string | null
  created_at: string
  updated_at: string
  messages?: Message[]
}

export interface Message {
  id: string
  tenant_id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  channel: Channel | null
  tokens_used: number | null
  from_cache: boolean
  created_at: string
}

export interface Staff {
  id: string
  tenant_id: string
  full_name: string
  phone: string | null
  email: string | null
  role: string | null
  department: string | null
  leave_balance: number
  leave_taken: number
  wellness_scores: WellnessScore[]
  after_hours_flag: boolean
  created_at: string
}

export interface WellnessScore {
  score: number
  date: string
}

export interface LeaveRequest {
  id: string
  tenant_id: string
  staff_id: string
  start_date: string
  end_date: string
  days: number | null
  reason: string | null
  status: LeaveStatus
  approved_by: string | null
  approved_at: string | null
  created_at: string
  staff?: Staff
}

export interface Invoice {
  id: string
  tenant_id: string
  contact_name: string
  contact_phone: string | null
  contact_email: string | null
  amount: number
  amount_paid: number
  due_date: string | null
  days_overdue: number | null
  status: InvoiceStatus
  escalation_level: number
  last_reminder_at: string | null
  xero_invoice_id: string | null
  created_at: string
}

export interface Document {
  id: string
  tenant_id: string
  original_filename: string | null
  file_type: FileType | null
  storage_url: string | null
  extracted_text: string | null
  doc_category: DocCategory | null
  ai_summary: string | null
  extracted_goals: Json | null
  processing_status: ProcessingStatus
  uploaded_by: string | null
  created_at: string
}

export interface Goal {
  id: string
  tenant_id: string
  title: string
  description: string | null
  quarter: string | null
  target_metric: string | null
  current_value: number | null
  target_value: number | null
  progress_pct: number | null
  status: GoalStatus
  created_at: string
}

export interface AuditLog {
  id: string
  tenant_id: string | null
  actor: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata: Json | null
  ip_address: string | null
  created_at: string
}
