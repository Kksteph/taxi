// ============================================================
// Excel Ingestion — Type Definitions
// ============================================================

export const VALID_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

export type ValidMonth = (typeof VALID_MONTHS)[number]

export const MONTH_TO_NUM: Record<ValidMonth, number> = {
  Jan: 1, Feb: 2,  Mar: 3,  Apr: 4,  May: 5,  Jun: 6,
  Jul: 7, Aug: 8,  Sep: 9,  Oct: 10, Nov: 11, Dec: 12,
}

// ── Parsed structures ──────────────────────────────────────

export type ParsedMonthlyRecord = {
  month: ValidMonth
  monthNum: number
  basicSalary: number
  tier2: number
  allowances: number
  taxPaidOnAccount: number
  netSalary: number
}

export type ParsedTotals = {
  totalBasicSalary: number
  totalTier2: number
  totalAllowances: number
  totalTaxPaid: number
  totalNetSalary: number
}

export type ParsedBonus = {
  grossBonus: number
  bonus15Pct: number
  excessBonus: number
  finalBonusTax: number
  excessTax: number
  netBonus: number
}

export type ParsedTaxSummary = {
  basicSalary: number
  cashAllowances: number
  socialSecurity: number
  excessBonus: number
  chargeableIncome: number
  taxCharged: number
  taxPaid: number
  taxOutstanding: number
}

export type ParsedEmployee = {
  sheetName: string
  employeeName: string
  employeeId: string
  department: string
  taxYear: number
  monthlyRecords: ParsedMonthlyRecord[]
  totals: ParsedTotals
  bonus: ParsedBonus
  taxSummary: ParsedTaxSummary
}

export type ParsedWorkbook = {
  employees: ParsedEmployee[]
  parseErrors: ValidationError[]
}

// ── Validation ─────────────────────────────────────────────

export type ValidationLevel =
  | 'file'
  | 'workbook'
  | 'employee_metadata'
  | 'monthly'
  | 'totals'
  | 'bonus'
  | 'tax_summary'
  | 'cross_system'

export type ValidationError = {
  level: ValidationLevel
  sheet: string
  field: string
  message: string
}

export type ValidationResult = {
  valid: boolean
  errors: ValidationError[]
}

// ── Upload tracking ────────────────────────────────────────

export type SalaryUploadStatus = 'processing' | 'completed' | 'failed'

export type SalaryUpload = {
  id: string
  department_id: string | null
  year: number
  filename: string
  status: SalaryUploadStatus
  total_sheets: number
  processed: number
  errors: ValidationError[]
  uploaded_by: string | null
  created_at: string
  completed_at: string | null
}

export type WorkbookUploadResult = {
  success: boolean
  uploadId: string
  totalSheets: number
  processed: number
  errors: ValidationError[]
}
