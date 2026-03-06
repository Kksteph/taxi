import ExcelJS from 'exceljs'
import { VALID_MONTHS } from './types'

// ── Styling helpers ────────────────────────────────────────

const DARK   = '1E293B' // slate-900
const BLUE   = '2563EB' // blue-600
const LIGHT  = 'F8FAFC' // slate-50
const BORDER_COLOR = 'CBD5E1'
const WHITE  = 'FFFFFF'
const GOLD   = 'F59E0B'

type FillStyle = ExcelJS.FillPattern

function fill(argb: string): FillStyle {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${argb}` } }
}

function border(all = true): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } }
  return all ? { top: side, left: side, bottom: side, right: side } : {}
}

function applyHeaderStyle(row: ExcelJS.Row, bgArgb: string, fontColor = WHITE) {
  row.eachCell(cell => {
    cell.fill = fill(bgArgb)
    cell.font = { bold: true, color: { argb: `FF${fontColor}` }, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = border()
  })
  row.height = 22
}

function addSectionHeader(ws: ExcelJS.Worksheet, label: string, fromCol: number, toCol: number, rowNum: number, color = DARK) {
  const row = ws.getRow(rowNum)
  const cell = row.getCell(fromCol)
  cell.value = label
  cell.fill = fill(color)
  cell.font = { bold: true, color: { argb: `FF${WHITE}` }, size: 10 }
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  cell.border = border()
  ws.mergeCells(rowNum, fromCol, rowNum, toCol)
  row.height = 20
}

// ── Single employee sheet ──────────────────────────────────

function buildEmployeeSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  employeeName: string,
  employeeId: string,
  department: string,
  taxYear: number,
  sample = false
) {
  const ws = wb.addWorksheet(sheetName)

  // Column widths
  ws.columns = [
    { width: 28 }, // A: label
    { width: 18 }, // B: Jan
    { width: 18 }, // C: Feb
    { width: 18 }, // D: Mar
    { width: 18 }, // E: Apr
    { width: 18 }, // F: May
    { width: 18 }, // G: Jun
    { width: 18 }, // H: value / months
  ]

  let row = 1

  // ── Section 1: Employee Details ──────────────────────────
  addSectionHeader(ws, 'SECTION 1 — EMPLOYEE DETAILS', 1, 4, row, DARK)
  row++

  const details = [
    ['Employee Name', employeeName],
    ['Employee ID',   employeeId],
    ['Department',    department],
    ['Tax Year',      taxYear],
  ]
  for (const [label, value] of details) {
    const r = ws.getRow(row)
    const labelCell = r.getCell(1)
    labelCell.value = label
    labelCell.font = { bold: true, size: 10, color: { argb: `FF${DARK}` } }
    labelCell.fill = fill(LIGHT)
    labelCell.border = border()
    labelCell.alignment = { vertical: 'middle', indent: 1 }

    const valCell = r.getCell(2)
    valCell.value = value
    valCell.font = { size: 10, color: { argb: `FF${DARK}` } }
    valCell.border = border()
    valCell.alignment = { vertical: 'middle' }

    r.height = 20
    row++
  }
  row++ // spacer

  // ── Section 2: Monthly Salary Table ─────────────────────
  addSectionHeader(ws, 'SECTION 2 — MONTHLY SALARY TABLE', 1, 6, row, BLUE)
  row++

  const tableHeaders = ['Month', 'Basic Salary', 'Tier 2', 'Allowances', 'Tax Paid on Account', 'Net Salary']
  const headerRow = ws.getRow(row)
  tableHeaders.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.fill = fill('334155') // slate-700
    cell.font = { bold: true, color: { argb: `FF${WHITE}` }, size: 9 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = border()
  })
  headerRow.height = 20
  row++

  // Month rows
  const sampleData: Record<string, number[]> = sample ? {
    Jan: [5000, 300, 800, 700, 4800],
    Feb: [5000, 300, 800, 700, 4800],
    Mar: [5000, 300, 800, 700, 4800],
    Apr: [5200, 310, 820, 720, 5000],
    May: [5200, 310, 820, 720, 5000],
    Jun: [5200, 310, 820, 720, 5000],
    Jul: [5400, 320, 840, 740, 5200],
    Aug: [5400, 320, 840, 740, 5200],
    Sep: [5400, 320, 840, 740, 5200],
    Oct: [5600, 330, 860, 760, 5400],
    Nov: [5600, 330, 860, 760, 5400],
    Dec: [5600, 330, 860, 760, 5400],
  } : {}

  const monthStartRow = row
  for (let i = 0; i < VALID_MONTHS.length; i++) {
    const month = VALID_MONTHS[i]
    const r = ws.getRow(row)
    r.getCell(1).value = month
    r.getCell(1).font = { bold: true, size: 9 }
    r.getCell(1).fill = fill(i % 2 === 0 ? WHITE : LIGHT)
    r.getCell(1).border = border()
    r.getCell(1).alignment = { vertical: 'middle', indent: 1 }

    const data = sampleData[month] ?? [0, 0, 0, 0, 0]
    for (let c = 2; c <= 6; c++) {
      const cell = r.getCell(c)
      cell.value = sample ? data[c - 2] : null
      cell.numFmt = '#,##0.00'
      cell.fill = fill(i % 2 === 0 ? WHITE : LIGHT)
      cell.border = border()
      cell.alignment = { vertical: 'middle', horizontal: 'right' }
    }
    r.height = 18
    row++
  }
  const monthEndRow = row - 1

  // ── Section 3: Totals ────────────────────────────────────
  row++ // spacer
  addSectionHeader(ws, 'SECTION 3 — TOTALS', 1, 6, row, '475569')
  row++

  const totalsRow = ws.getRow(row)
  totalsRow.getCell(1).value = 'TOTALS'
  totalsRow.getCell(1).font = { bold: true, size: 9 }
  totalsRow.getCell(1).fill = fill('0F172A')
  totalsRow.getCell(1).font = { bold: true, color: { argb: `FF${WHITE}` }, size: 9 }
  totalsRow.getCell(1).border = border()
  totalsRow.getCell(1).alignment = { vertical: 'middle', indent: 1 }

  const totalLabels = ['Total Basic Salary', 'Total Tier 2', 'Total Allowances', 'Total Tax Paid', 'Total Net Salary']
  for (let c = 2; c <= 6; c++) {
    const cell = totalsRow.getCell(c)
    if (sample) {
      cell.value = { formula: `SUM(${String.fromCharCode(64 + c)}${monthStartRow}:${String.fromCharCode(64 + c)}${monthEndRow})` }
    } else {
      cell.value = null
    }
    cell.numFmt = '#,##0.00'
    cell.fill = fill('1E293B')
    cell.font = { bold: true, color: { argb: `FF${WHITE}` }, size: 9 }
    cell.border = border()
    cell.alignment = { vertical: 'middle', horizontal: 'right' }
  }
  totalsRow.height = 20
  row += 2

  // ── Section 4: Bonus ─────────────────────────────────────
  addSectionHeader(ws, 'SECTION 4 — BONUS', 1, 2, row, GOLD)
  row++

  const bonusFields = [
    ['Gross Bonus',       sample ? 8000 : null],
    ['Bonus up to 15%',   sample ? 7500 : null],
    ['Excess Bonus',      sample ? 500  : null],
    ['Final Bonus Tax',   sample ? 375  : null],
    ['Excess Tax',        sample ? 25   : null],
    ['Net Bonus',         sample ? 7100 : null],
  ] as [string, number | null][]

  for (const [label, value] of bonusFields) {
    const r = ws.getRow(row)
    r.getCell(1).value = label
    r.getCell(1).font = { bold: true, size: 9 }
    r.getCell(1).fill = fill('FFFBEB')
    r.getCell(1).border = border()
    r.getCell(1).alignment = { vertical: 'middle', indent: 1 }

    r.getCell(2).value = value
    r.getCell(2).numFmt = '#,##0.00'
    r.getCell(2).border = border()
    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' }
    r.height = 18
    row++
  }
  row++

  // ── Section 5: Tax Summary ───────────────────────────────
  addSectionHeader(ws, 'SECTION 5 — SUMMARY FOR FILING', 1, 2, row, '059669')
  row++

  const summaryFields = [
    ['Basic Salary (Total)',        sample ? 63000  : null],
    ['Cash Allowances',             sample ? 9600   : null],
    ['Social Security (Tier 2 Total)', sample ? 3720 : null],
    ['Excess Bonus',                sample ? 500    : null],
    ['Chargeable Income',           sample ? 69380  : null],
    ['Tax Charged',                 sample ? 8800   : null],
    ['Tax Paid',                    sample ? 8640   : null],
    ['Tax Outstanding',             sample ? 160    : null],
  ] as [string, number | null][]

  for (const [label, value] of summaryFields) {
    const r = ws.getRow(row)
    r.getCell(1).value = label
    r.getCell(1).font = { bold: true, size: 9 }
    r.getCell(1).fill = fill('ECFDF5')
    r.getCell(1).border = border()
    r.getCell(1).alignment = { vertical: 'middle', indent: 1 }

    r.getCell(2).value = value
    r.getCell(2).numFmt = '#,##0.00'
    r.getCell(2).border = border()
    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' }
    r.height = 18
    row++
  }

  // Freeze pane: keep header rows visible when scrolling
  ws.views = [{ state: 'frozen', ySplit: 2, xSplit: 0 }]
}

// ── Template workbook ──────────────────────────────────────

export async function generateTemplateWorkbook(year: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tax Filing Portal'
  wb.created = new Date()

  buildEmployeeSheet(
    wb,
    'EmployeeName_EmpID',
    'Employee Full Name',
    'EMP001',
    'Department Name',
    year,
    false
  )

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

// ── Sample workbook (2 employees with data) ───────────────

export async function generateSampleWorkbook(year: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tax Filing Portal'
  wb.created = new Date()

  buildEmployeeSheet(wb, 'StephenKumi_EMP001',  'Stephen Kumi',  'EMP001', 'Engineering', year, true)
  buildEmployeeSheet(wb, 'AmaMensah_EMP002',    'Ama Mensah',    'EMP002', 'Finance',     year, true)

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
