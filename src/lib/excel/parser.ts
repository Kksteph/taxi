import * as XLSX from 'xlsx'
import {
  VALID_MONTHS, MONTH_TO_NUM,
  type ParsedEmployee, type ParsedWorkbook, type ParsedMonthlyRecord,
  type ParsedTotals, type ParsedBonus, type ParsedTaxSummary,
  type ValidationError, type ValidMonth,
} from './types'

// ── Helpers ────────────────────────────────────────────────

type Cell = string | number | boolean | null | undefined
type Matrix = Cell[][]

function sheetToMatrix(ws: XLSX.WorkSheet): Matrix {
  if (!ws['!ref']) return []
  const range = XLSX.utils.decode_range(ws['!ref'])
  const matrix: Matrix = []
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: Cell[] = []
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      row.push(cell?.v ?? null)
    }
    matrix.push(row)
  }
  return matrix
}

function findLabelRow(matrix: Matrix, label: string): number {
  const l = label.toLowerCase()
  return matrix.findIndex(row =>
    row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes(l))
  )
}

function findLabelCell(matrix: Matrix, label: string): { r: number; c: number } | null {
  const l = label.toLowerCase()
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      const cell = matrix[r][c]
      if (typeof cell === 'string' && cell.toLowerCase().includes(l)) {
        return { r, c }
      }
    }
  }
  return null
}

/** Get the first non-null value to the right of a label (skips empty cells) */
function getValueRight(matrix: Matrix, label: string): Cell {
  const pos = findLabelCell(matrix, label)
  if (!pos) return null
  const row = matrix[pos.r] ?? []
  for (let c = pos.c + 1; c < row.length; c++) {
    if (row[c] !== null && row[c] !== undefined && row[c] !== '') return row[c]
  }
  return null
}

function toNum(val: Cell): number {
  if (val === null || val === undefined || val === '') return 0
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function normalizeMonth(val: Cell): ValidMonth | null {
  if (!val) return null
  const str = String(val).trim()
  const match = VALID_MONTHS.find(m => m.toLowerCase() === str.toLowerCase())
  return match ?? null
}

// ── Sheet parser ───────────────────────────────────────────

export function parseEmployeeSheet(
  sheetName: string,
  ws: XLSX.WorkSheet
): { employee: ParsedEmployee | null; errors: ValidationError[] } {
  const errors: ValidationError[] = []
  const matrix = sheetToMatrix(ws)

  const err = (field: string, message: string): void => {
    errors.push({ level: 'employee_metadata', sheet: sheetName, field, message })
  }

  // ── Section 1: Employee Details ──────────────────────────
  const employeeName  = String(getValueRight(matrix, 'Employee Name') ?? '').trim()
  const employeeId    = String(getValueRight(matrix, 'Employee ID')   ?? '').trim()
  const department    = String(getValueRight(matrix, 'Department')    ?? '').trim()
  const taxYearRaw    = getValueRight(matrix, 'Tax Year')
  const taxYear       = taxYearRaw ? parseInt(String(taxYearRaw), 10) : NaN

  if (!employeeName) err('Employee Name', `Sheet ${sheetName} missing Employee Name`)
  if (!employeeId)   err('Employee ID',   `Sheet ${sheetName} missing Employee ID`)
  if (!department)   err('Department',    `Sheet ${sheetName} missing Department`)
  if (isNaN(taxYear)) err('Tax Year',     `Sheet ${sheetName} missing or invalid Tax Year`)

  // ── Section 2: Monthly Salary Table ─────────────────────
  const tableHeaderRow = findLabelRow(matrix, 'Basic Salary')
  const monthlyRecords: ParsedMonthlyRecord[] = []
  const seenMonths = new Set<string>()

  if (tableHeaderRow === -1) {
    errors.push({ level: 'monthly', sheet: sheetName, field: 'Monthly Table', message: `Sheet ${sheetName} missing monthly salary table header` })
  } else {
    // Find column indices from header row
    const headerRow = matrix[tableHeaderRow]
    const colIdx = {
      month:            headerRow.findIndex(c => typeof c === 'string' && c.toLowerCase().includes('month')),
      basicSalary:      headerRow.findIndex(c => typeof c === 'string' && c.toLowerCase().includes('basic')),
      tier2:            headerRow.findIndex(c => typeof c === 'string' && c.toLowerCase().includes('tier')),
      allowances:       headerRow.findIndex(c => typeof c === 'string' && c.toLowerCase().includes('allowance')),
      taxPaidOnAccount: headerRow.findIndex(c => typeof c === 'string' && c.toLowerCase().includes('tax paid')),
      netSalary:        headerRow.findIndex(c => typeof c === 'string' && c.toLowerCase().includes('net')),
    }

    // Parse data rows until we hit "TOTALS" or empty month
    for (let r = tableHeaderRow + 1; r < matrix.length; r++) {
      const row = matrix[r]
      const monthCell = row[colIdx.month]

      // Stop at totals row
      if (typeof monthCell === 'string' && monthCell.toLowerCase().includes('total')) break
      // Stop at empty rows (end of table)
      if (!monthCell) continue

      const month = normalizeMonth(monthCell)
      if (!month) {
        errors.push({ level: 'monthly', sheet: sheetName, field: 'Month', message: `Sheet ${sheetName}: invalid month value "${monthCell}"` })
        continue
      }
      if (seenMonths.has(month)) {
        errors.push({ level: 'monthly', sheet: sheetName, field: 'Month', message: `Sheet ${sheetName}: duplicate month entry "${month}"` })
        continue
      }
      seenMonths.add(month)

      const basic     = toNum(row[colIdx.basicSalary])
      const tier2     = toNum(row[colIdx.tier2])
      const allow     = toNum(row[colIdx.allowances])
      const taxPaid   = toNum(row[colIdx.taxPaidOnAccount])
      const netSal    = toNum(row[colIdx.netSalary])

      // Validate negative values
      for (const [field, val] of [['Basic Salary', basic], ['Tier 2', tier2], ['Allowances', allow], ['Tax Paid on Account', taxPaid], ['Net Salary', netSal]] as [string, number][]) {
        if (val < 0) {
          errors.push({ level: 'monthly', sheet: sheetName, field, message: `Sheet ${sheetName}: negative value in "${field}" for ${month}` })
        }
      }

      monthlyRecords.push({
        month,
        monthNum: MONTH_TO_NUM[month],
        basicSalary: round2(basic),
        tier2: round2(tier2),
        allowances: round2(allow),
        taxPaidOnAccount: round2(taxPaid),
        netSalary: round2(netSal),
      })
    }

    if (monthlyRecords.length === 0) {
      errors.push({ level: 'monthly', sheet: sheetName, field: 'Monthly Table', message: `Sheet ${sheetName}: at least one valid month is required` })
    }
  }

  // ── Section 3: Totals ────────────────────────────────────
  const totals: ParsedTotals = {
    totalBasicSalary: round2(toNum(getValueRight(matrix, 'Total Basic Salary'))),
    totalTier2:       round2(toNum(getValueRight(matrix, 'Total Tier 2'))),
    totalAllowances:  round2(toNum(getValueRight(matrix, 'Total Allowances'))),
    totalTaxPaid:     round2(toNum(getValueRight(matrix, 'Total Tax Paid'))),
    totalNetSalary:   round2(toNum(getValueRight(matrix, 'Total Net Salary'))),
  }

  // ── Section 4: Bonus ─────────────────────────────────────
  const bonus: ParsedBonus = {
    grossBonus:    round2(toNum(getValueRight(matrix, 'Gross Bonus'))),
    bonus15Pct:    round2(toNum(getValueRight(matrix, 'Bonus up to 15%'))),
    excessBonus:   round2(toNum(getValueRight(matrix, 'Excess Bonus'))),
    finalBonusTax: round2(toNum(getValueRight(matrix, 'Final Bonus Tax'))),
    excessTax:     round2(toNum(getValueRight(matrix, 'Excess Tax'))),
    netBonus:      round2(toNum(getValueRight(matrix, 'Net Bonus'))),
  }

  // ── Section 5: Tax Summary ───────────────────────────────
  const taxSummary: ParsedTaxSummary = {
    basicSalary:      round2(toNum(getValueRight(matrix, 'Basic Salary (Total)'))),
    cashAllowances:   round2(toNum(getValueRight(matrix, 'Cash Allowances'))),
    socialSecurity:   round2(toNum(getValueRight(matrix, 'Social Security'))),
    excessBonus:      round2(toNum(getValueRight(matrix, 'Excess Bonus'))),
    chargeableIncome: round2(toNum(getValueRight(matrix, 'Chargeable Income'))),
    taxCharged:       round2(toNum(getValueRight(matrix, 'Tax Charged'))),
    taxPaid:          round2(toNum(getValueRight(matrix, 'Tax Paid'))),
    taxOutstanding:   round2(toNum(getValueRight(matrix, 'Tax Outstanding'))),
  }

  if (errors.length > 0 || !employeeName || !employeeId || isNaN(taxYear)) {
    return { employee: null, errors }
  }

  return {
    employee: {
      sheetName,
      employeeName,
      employeeId,
      department,
      taxYear,
      monthlyRecords,
      totals,
      bonus,
      taxSummary,
    },
    errors,
  }
}

// ── Workbook parser ────────────────────────────────────────

export function parseWorkbook(buffer: ArrayBuffer): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: 'array' })
  const employees: ParsedEmployee[] = []
  const parseErrors: ValidationError[] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const { employee, errors } = parseEmployeeSheet(sheetName, ws)
    parseErrors.push(...errors)
    if (employee) employees.push(employee)
  }

  return { employees, parseErrors }
}
