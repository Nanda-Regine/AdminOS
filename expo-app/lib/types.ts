/** Response shapes of the AdminOS API routes the app calls. */

export type Permission =
  | 'manage_staff' | 'view_financials' | 'approve_leave' | 'view_payroll' | 'manage_settings'
  | 'manage_billing' | 'view_analytics' | 'send_broadcasts' | 'manage_invoices' | 'manage_contacts'
  | 'manage_documents' | 'manage_inventory' | 'view_own_data_only' | 'view_communications' | '*'

export interface Me {
  user: { id: string; email: string | null; name: string | null }
  tenant: { id: string; name: string | null; plan: string | null }
  role: string
  permissions: Permission[]
  staff: null | {
    id: string
    fullName: string
    jobTitle: string | null
    department: string | null
    leave: { entitlement: number; taken: number; remaining: number }
  }
  mine: {
    openTasks?: number
    pendingLeave?: number
    latestPayslip?: { id: string; net: number; payroll_run: { period_month: number; period_year: number } } | null
  }
  decisions: {
    leaveToApprove?: number
    expensesToApprove?: number
    money?: { owed: number; overdue: number; overdueCount: number }
    escalatedConversations?: number
    health?: { overall_score: number; snapshot_date: string } | null
  }
}

export type LeaveType = 'annual' | 'sick' | 'family_responsibility' | 'maternity' | 'parental' | 'study' | 'unpaid'
export type LeaveStatus = 'pending' | 'approved' | 'declined'

export interface LeaveRequest {
  id: string
  staff_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  days: number
  reason: string | null
  status: LeaveStatus
  approved_at: string | null
  created_at: string
  staff?: { full_name: string; job_title: string | null } | null
}

export interface LeaveMine {
  linked: boolean
  requests: LeaveRequest[]
  balance: { entitlement: number; taken: number; remaining: number } | null
}

export interface ClockEvent {
  id: string
  staff_id: string
  event_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
  timestamp: string
  lat: number | null
  lng: number | null
  location_name: string | null
}

export interface Payslip {
  id: string
  gross: number
  paye: number | null
  uif: number | null
  deductions: number | null
  net: number
  pdf_url: string | null
  created_at: string
  payroll_run: { period_month: number; period_year: number; status: string }
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
  priority: 'urgent' | 'high' | 'medium' | 'low'
  due_date: string | null
  assigned_to: string | null
  created_at: string
  completed_at: string | null
}

export interface Expense {
  id: string
  staff_id: string
  amount: number
  category: string
  description: string | null
  receipt_url: string | null
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  submitted_at: string
  staff?: { full_name: string; job_title: string | null } | null
}

export interface StaffDocument {
  id: string
  title: string
  file_url: string
  file_type: string | null
  expires_at: string | null
  created_at: string
}

export interface Sop {
  id: string
  title: string
  category: string | null
  content: Record<string, unknown> | null
  version: number | null
  status: string
  requires_acknowledgement?: boolean | null
  published_at: string | null
  acks?: { user_id: string; acknowledged_at: string }[]
}

export interface Announcement {
  id: string
  title: string
  body: string
  pinned: boolean
  published_at: string | null
  created_at: string
  is_read: boolean
  expires_at: string | null
}

export interface DirectoryEntry {
  id: string
  full_name: string
  job_title: string | null
  department: string | null
}

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  action_url: string | null
  created_at: string
}

export interface Conversation {
  id: string
  channel: string | null
  contact_name: string | null
  contact_identifier: string | null
  status: 'open' | 'auto_resolved' | 'escalated' | 'closed'
  sentiment: string | null
  intent: string | null
  summary: string | null
  updated_at: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  channel: string | null
  created_at: string
}

export interface Invoice {
  id: string
  invoice_number: string | null
  contact_name: string | null
  amount: number
  amount_paid: number
  amount_due: number | null
  status: string
  due_date: string | null
  created_at: string
  contact?: { name: string | null; phone: string | null } | null
}
