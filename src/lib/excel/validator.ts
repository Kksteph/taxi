import type {
  ParsedEmployee, ParsedWorkbook, ValidationError, ValidationResult,
} from './types'

const TOLERANCE = 0.02 // small float rounding tolerance

function round2(n: number) { return Math.round(n * 100) / 100 }
function approxEqual(a: number, b: number) { return Math.abs(a - b) <= TOLERANCE }

// ── Layer 1: File-level ────────────────────────────────────

export function validateFile(
  file: File,
  maxSizeMB = 10
): ValidationError[] {
  const errors: ValidationError[] = []
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext !== 'xlsx') {
    errors.push({
      level: 'file', sheet: '', field: 'file_type',
      message: 'Invalid file type. Only .xlsx files are supported.',
    })
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    errors.push({
      level: 'file', sheet: '', field: 'file_size',
      message: `File exceeds maximum allowed size of ${maxSizeMB}MB.`,
    })
  }
  // MIME check
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream', // some OS send this
  ]
  if (file.type && !allowedMimes.includes(file.type)) {
    errors.push({
      level: 'file', sheet: '', field: 'mime_type',
      message: `Invalid MIME type "${file.type}". Expected an .xlsx file.`,
    })
  }
  return errors
}

// ── Layer 2: Workbook-level ────────────────────────────────

export function validateWorkbook(parsed: ParsedWorkbook): ValidationError[] {
  const errors: ValidationError[] = []

  if (parsed.employees.length === 0) {
    errors.push({
      level: 'workbook', sheet: '', field: 'sheets',
      message: 'Workbook contains no valid employee sheets.',
    })
    return errors
  }

  // Sheet name format: EmployeeName_EmployeeID
  const sheetNameRegex = /^.+_.+$/

  // Check for duplicate employee IDs
  const seenIds = new Map<string, string>()

  for (const emp of parsed.employees) {
    if (!sheetNameRegex.test(emp.sheetName)) {
      errors.push({
        level: 'workbook', sheet: emp.sheetName, field: 'sheet_name',
        message: `Invalid sheet name format "${emp.sheetName}". Expected: EmployeeName_EmployeeID`,
      })
    }
    if (seenIds.has(emp.employeeId)) {
      errors.push({
        level: 'workbook', sheet: emp.sheetName, field: 'employee_id',
        message: `Duplicate employee ID detected: ${emp.employeeId} (also in sheet "${seenIds.get(emp.employeeId)}")`,
      })
    } else {
      seenIds.set(emp.employeeId, emp.sheetName)
    }
  }

  return errors
}

// ── Layer 3: Employee metadata ─────────────────────────────

export function validateEmployeeMetadata(emp: ParsedEmployee): ValidationError[] {
  const errors: ValidationError[] = []
  const e = (field: string, msg: string) =>
    errors.push({ level: 'employee_metadata', sheet: emp.sheetName, field, message: msg })

  if (!emp.employeeName.trim())
    e('Employee Name', `Sheet ${emp.sheetName}: Employee Name is required`)
  if (!emp.employeeId.trim())
    e('Employee ID', `Sheet ${emp.sheetName}: Employee ID is required`)
  if (!emp.department.trim())
    e('Department', `Sheet ${emp.sheetName}: Department is required`)
  if (isNaN(emp.taxYear) || emp.taxYear < 2000 || emp.taxYear > 2100)
    e('Tax Year', `Sheet ${emp.sheetName}: Tax Year must be a valid 4-digit year`)

  // Employee ID format check
  if (emp.employeeId && !/^[A-Za-z0-9\-_]+$/.test(emp.employeeId))
    e('Employee ID', `Sheet ${emp.sheetName}: Employee ID "${emp.employeeId}" contains invalid characters`)

  return errors
}

// ── Layer 4: Monthly salary table ─────────────────────────

export function validateMonthlyRecords(emp: ParsedEmployee): ValidationError[] {
  const errors: ValidationError[] = []
  const e = (field: string, msg: string) =>
    errors.push({ level: 'monthly', sheet: emp.sheetName, field, message: msg })

  if (emp.monthlyRecords.length === 0) {
    e('Monthly Table', `Sheet ${emp.sheetName}: at least one valid month is required`)
    return errors
  }

  const seenMonths = new Set<string>()
  for (const r of emp.monthlyRecords) {
    if (seenMonths.has(r.month))
      e('Month', `Sheet ${emp.sheetName}: duplicate month entry "${r.month}"`)
    seenMonths.add(r.month)

    if (r.basicSalary < 0) e('Basic Salary', `Sheet ${emp.sheetName}: negative Basic Salary in ${r.month}`)
    if (r.tier2 < 0)       e('Tier 2',       `Sheet ${emp.sheetName}: negative Tier 2 in ${r.month}`)
    if (r.allowances < 0)  e('Allowances',   `Sheet ${emp.sheetName}: negative Allowances in ${r.month}`)
    if (r.taxPaidOnAccount < 0) e('Tax Paid on Account', `Sheet ${emp.sheetName}: negative Tax Paid on Account in ${r.month}`)
    if (r.netSalary < 0)   e('Net Salary',   `Sheet ${emp.sheetName}: negative Net Salary in ${r.month}`)
  }

  return errors
}

// ── Layer 5: Totals ────────────────────────────────────────

export function validateTotals(emp: ParsedEmployee): ValidationError[] {
  const errors: ValidationError[] = []
  const e = (field: string, msg: string) =>
    errors.push({ level: 'totals', sheet: emp.sheetName, field, message: msg })

  const calc = {
    totalBasicSalary: round2(emp.monthlyRecords.reduce((s, r) => s + r.basicSalary, 0)),
    totalTier2:       round2(emp.monthlyRecords.reduce((s, r) => s + r.tier2, 0)),
    totalAllowances:  round2(emp.monthlyRecords.reduce((s, r) => s + r.allowances, 0)),
    totalTaxPaid:     round2(emp.monthlyRecords.reduce((s, r) => s + r.taxPaidOnAccount, 0)),
    totalNetSalary:   round2(emp.monthlyRecords.reduce((s, r) => s + r.netSalary, 0)),
  }

  // If totals are all 0 in sheet, skip mismatch check (totals section may be absent)
  const totalsProvided = Object.values(emp.totals).some(v => v !== 0)
  if (!totalsProvided) return errors

  if (!approxEqual(emp.totals.totalBasicSalary, calc.totalBasicSalary))
    e('Total Basic Salary', `Sheet ${emp.sheetName}: Total Basic Salary (${emp.totals.totalBasicSalary}) does not match monthly sum (${calc.totalBasicSalary})`)
  if (!approxEqual(emp.totals.totalTier2, calc.totalTier2))
    e('Total Tier 2', `Sheet ${emp.sheetName}: Total Tier 2 (${emp.totals.totalTier2}) does not match monthly sum (${calc.totalTier2})`)
  if (!approxEqual(emp.totals.totalAllowances, calc.totalAllowances))
    e('Total Allowances', `Sheet ${emp.sheetName}: Total Allowances (${emp.totals.totalAllowances}) does not match monthly sum (${calc.totalAllowances})`)
  if (!approxEqual(emp.totals.totalTaxPaid, calc.totalTaxPaid))
    e('Total Tax Paid', `Sheet ${emp.sheetName}: Total Tax Paid (${emp.totals.totalTaxPaid}) does not match monthly sum (${calc.totalTaxPaid})`)
  if (!approxEqual(emp.totals.totalNetSalary, calc.totalNetSalary))
    e('Total Net Salary', `Sheet ${emp.sheetName}: Total Net Salary (${emp.totals.totalNetSalary}) does not match monthly sum (${calc.totalNetSalary})`)

  return errors
}

// ── Layer 6: Bonus ─────────────────────────────────────────

export function validateBonus(emp: ParsedEmployee): ValidationError[] {
  const errors: ValidationError[] = []
  const e = (field: string, msg: string) =>
    errors.push({ level: 'bonus', sheet: emp.sheetName, field, message: msg })

  const { bonus } = emp
  const annualBasic = emp.monthlyRecords.reduce((s, r) => s + r.basicSalary, 0)
  const maxBonus15  = round2(annualBasic * 0.15)

  // Only validate if bonus data is present
  if (bonus.grossBonus === 0) return errors

  if (bonus.bonus15Pct > maxBonus15 + TOLERANCE)
    e('Bonus up to 15%', `Sheet ${emp.sheetName}: Bonus up to 15% (${bonus.bonus15Pct}) exceeds 15% of annual basic salary (${maxBonus15})`)

  const expectedExcess = round2(bonus.grossBonus - bonus.bonus15Pct)
  if (!approxEqual(bonus.excessBonus, expectedExcess))
    e('Excess Bonus', `Sheet ${emp.sheetName}: Excess Bonus (${bonus.excessBonus}) must equal Gross Bonus − Bonus up to 15% (${expectedExcess})`)

  for (const [field, val] of [
    ['Gross Bonus', bonus.grossBonus], ['Bonus up to 15%', bonus.bonus15Pct],
    ['Excess Bonus', bonus.excessBonus], ['Final Bonus Tax', bonus.finalBonusTax],
    ['Excess Tax', bonus.excessTax], ['Net Bonus', bonus.netBonus],
  ] as [string, number][]) {
    if (isNaN(val)) e(field, `Sheet ${emp.sheetName}: "${field}" must be a numeric value`)
  }

  return errors
}

// ── Layer 7: Tax Summary ───────────────────────────────────

export function validateTaxSummary(emp: ParsedEmployee): ValidationError[] {
  const errors: ValidationError[] = []
  const e = (field: string, msg: string) =>
    errors.push({ level: 'tax_summary', sheet: emp.sheetName, field, message: msg })

  const { taxSummary } = emp

  // Chargeable Income = Basic + Allowances + ExcessBonus - SocialSecurity
  const expectedCI = round2(
    taxSummary.basicSalary +
    taxSummary.cashAllowances +
    taxSummary.excessBonus -
    taxSummary.socialSecurity
  )
  if (taxSummary.chargeableIncome !== 0 && !approxEqual(taxSummary.chargeableIncome, expectedCI))
    e('Chargeable Income', `Sheet ${emp.sheetName}: Chargeable Income (${taxSummary.chargeableIncome}) does not match formula result (${expectedCI})`)

  // Tax Outstanding = Tax Charged - Tax Paid
  const expectedTO = round2(taxSummary.taxCharged - taxSummary.taxPaid)
  if (taxSummary.taxOutstanding !== 0 && !approxEqual(taxSummary.taxOutstanding, expectedTO))
    e('Tax Outstanding', `Sheet ${emp.sheetName}: Tax Outstanding (${taxSummary.taxOutstanding}) must equal Tax Charged − Tax Paid (${expectedTO})`)

  return errors
}

// ── Layer 8: Cross-system ──────────────────────────────────

export type CrossSystemContext = {
  existingEmployeeIds: Set<string>
  existingDepartments: Set<string>
  existingUploads: Set<string> // `${employeeId}:${year}`
  year: number
}

export function validateCrossSystem(
  emp: ParsedEmployee,
  ctx: CrossSystemContext
): ValidationError[] {
  const errors: ValidationError[] = []
  const e = (field: string, msg: string) =>
    errors.push({ level: 'cross_system', sheet: emp.sheetName, field, message: msg })

  if (!ctx.existingEmployeeIds.has(emp.employeeId))
    e('Employee ID', `Sheet ${emp.sheetName}: Employee ID "${emp.employeeId}" does not exist in the system`)

  if (ctx.existingDepartments.size > 0 && !ctx.existingDepartments.has(emp.department.toLowerCase()))
    e('Department', `Sheet ${emp.sheetName}: Department "${emp.department}" does not exist in the system`)

  const uploadKey = `${emp.employeeId}:${emp.taxYear}`
  if (ctx.existingUploads.has(uploadKey))
    e('Duplicate Upload', `Sheet ${emp.sheetName}: Employee ${emp.employeeId} already has salary data for ${emp.taxYear}`)

  return errors
}

// ── Full validation pipeline ───────────────────────────────

export function runFullValidation(
  parsed: ParsedWorkbook,
  crossCtx?: CrossSystemContext
): ValidationResult {
  const errors: ValidationError[] = [...parsed.parseErrors]

  errors.push(...validateWorkbook(parsed))

  for (const emp of parsed.employees) {
    errors.push(...validateEmployeeMetadata(emp))
    errors.push(...validateMonthlyRecords(emp))
    errors.push(...validateTotals(emp))
    errors.push(...validateBonus(emp))
    errors.push(...validateTaxSummary(emp))
    if (crossCtx) {
      errors.push(...validateCrossSystem(emp, crossCtx))
    }
  }

  return { valid: errors.length === 0, errors }
}
