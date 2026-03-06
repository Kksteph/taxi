// ============================================================
// Domain Types
// ============================================================

export type Department = {
  id: string
  name: string
  created_at: string
}

export type Employee = {
  id: string
  employee_id: string
  name: string
  email: string
  department_id: string | null
  created_at: string
  department?: Department
}

export type MonthlyRecord = {
  id: string
  employee_id: string
  month: number
  year: number
  basic: number
  allowance: number
  ssnit: number
  tax: number
  created_at: string
}

export type TaxSummary = {
  id: string
  employee_id: string
  year: number
  total_basic: number
  total_allowance: number
  total_ssnit: number
  chargeable_income: number
  total_tax: number
  pdf_url: string | null
  pdf_path: string | null
  magic_token: string | null
  token_expires_at: string | null
  status: SubmissionStatus
  email_sent_at: string | null
  viewed_at: string | null
  generated_at: string
  employee?: Employee
}

export type Receipt = {
  id: string
  employee_id: string
  year: number
  file_url: string
  file_path: string
  file_name: string | null
  submitted_at: string
  replaced_at: string | null
}

export type ActivityLog = {
  id: string
  user_id: string | null
  action: string
  metadata: Record<string, unknown> | null
  timestamp: string
}

export type FinanceUser = {
  id: string
  name: string | null
  role: 'finance' | 'admin'
  created_at: string
}

// ============================================================
// Status Pipeline
// ============================================================

export type SubmissionStatus = 'generated' | 'email_sent' | 'viewed' | 'submitted'

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  generated: 'Generated',
  email_sent: 'Email Sent',
  viewed: 'Viewed',
  submitted: 'Submitted',
}

export const STATUS_ORDER: SubmissionStatus[] = ['generated', 'email_sent', 'viewed', 'submitted']

// ============================================================
// Upload / Ingestion Types
// ============================================================

export type EmployeeCsvRow = {
  employee_id: string
  name: string
  email: string
  department: string
}

export type PayrollCsvRow = {
  employee_id: string
  month: string | number
  year: string | number
  basic: string | number
  allowance: string | number
  ssnit: string | number
  tax: string | number
}

export type UploadValidationError = {
  row: number
  field: string
  message: string
}

export type UploadResult = {
  success: boolean
  inserted: number
  skipped: number
  errors: UploadValidationError[]
}

// ============================================================
// Dashboard / Aggregate Types
// ============================================================

export type DepartmentStats = {
  department: Department
  total: number
  generated: number
  email_sent: number
  viewed: number
  submitted: number
}

export type EmployeeWithStatus = Employee & {
  summary: TaxSummary | null
  receipt: Receipt | null
}

// ============================================================
// API Response Types
// ============================================================

export type ApiResponse<T = unknown> =
  | { data: T; error: null }
  | { data: null; error: string }
