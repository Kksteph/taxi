import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { Employee, TaxSummary, MonthlyRecord } from '@/types'
import { MONTH_NAMES } from '@/lib/tax/compute'

const GHS = (n: number) =>
  'GHS ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export async function generateTaxPDF(
  employee: Employee,
  summary: TaxSummary,
  records: MonthlyRecord[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const page = doc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()

  const slate900 = rgb(0.09, 0.11, 0.17)
  const slate600 = rgb(0.28, 0.32, 0.40)
  const slate200 = rgb(0.88, 0.90, 0.93)
  const blue600  = rgb(0.15, 0.39, 0.92)
  const white    = rgb(1, 1, 1)

  let y = height - 48

  // ── Header Bar ──────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: slate900 })
  page.drawText('TAX FILING AUTOMATION PORTAL', {
    x: 40, y: height - 36, size: 13, font: fontBold, color: white,
  })
  page.drawText(`Annual Tax Summary — ${summary.year}`, {
    x: 40, y: height - 56, size: 10, font, color: rgb(0.6, 0.65, 0.75),
  })

  y = height - 110

  // ── Employee Info ────────────────────────────────────────────
  page.drawText('EMPLOYEE DETAILS', { x: 40, y, size: 8, font: fontBold, color: slate600 })
  y -= 18
  page.drawText(employee.name, { x: 40, y, size: 15, font: fontBold, color: slate900 })
  y -= 16
  page.drawText(`ID: ${employee.employee_id}  ·  ${employee.email}`, {
    x: 40, y, size: 9, font, color: slate600,
  })
  y -= 28

  // ── Divider ──────────────────────────────────────────────────
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: slate200 })
  y -= 24

  // ── Summary Cards ────────────────────────────────────────────
  page.drawText('ANNUAL SUMMARY', { x: 40, y, size: 8, font: fontBold, color: slate600 })
  y -= 18

  const n = (v: unknown) => Number(v) || 0
  const cards = [
    { label: 'Total Basic Salary',    value: GHS(n(summary.total_basic)) },
    { label: 'Total Cash Allowance',  value: GHS(n(summary.total_allowance)) },
    { label: 'Total SSNIT',           value: GHS(n(summary.total_ssnit)) },
    { label: 'Chargeable Income',     value: GHS(n(summary.chargeable_income)) },
    { label: 'Total Tax Charged',     value: GHS(n(summary.total_tax)) },
  ]

  const cardW = (width - 80 - 16) / 2
  const cardH = 52
  let col = 0

  for (const card of cards) {
    const cx = 40 + col * (cardW + 16)
    // card bg
    page.drawRectangle({ x: cx, y: y - cardH, width: cardW, height: cardH,
      color: rgb(0.97, 0.97, 0.99), borderColor: slate200, borderWidth: 1 })
    page.drawText(card.label, { x: cx + 10, y: y - 18, size: 8, font, color: slate600 })
    page.drawText(card.value, { x: cx + 10, y: y - 36, size: 12, font: fontBold, color: slate900 })

    col++
    if (col === 2) { col = 0; y -= cardH + 10 }
  }
  if (col === 1) y -= cardH + 10
  y -= 16

  // ── Formula Note ─────────────────────────────────────────────
  page.drawRectangle({
    x: 40, y: y - 28, width: width - 80, height: 28,
    color: rgb(0.93, 0.96, 1), borderColor: blue600, borderWidth: 0.5,
  })
  page.drawText('Chargeable Income = Total Basic + Total Allowances − Total SSNIT', {
    x: 50, y: y - 18, size: 8, font, color: blue600,
  })
  y -= 48

  // ── Monthly Breakdown ────────────────────────────────────────
  page.drawText('MONTHLY BREAKDOWN', { x: 40, y, size: 8, font: fontBold, color: slate600 })
  y -= 16

  // Table header
  const cols = [40, 130, 240, 340, 440]
  const headers = ['Month', 'Basic (GHS)', 'Allowance (GHS)', 'SSNIT (GHS)', 'Tax (GHS)']
  page.drawRectangle({ x: 40, y: y - 16, width: width - 80, height: 18, color: slate900 })
  headers.forEach((h, i) => {
    page.drawText(h, { x: cols[i] + 4, y: y - 11, size: 7.5, font: fontBold, color: white })
  })
  y -= 18

  const sortedRecords = [...records].sort((a, b) => a.month - b.month)

  for (let i = 0; i < sortedRecords.length; i++) {
    const r = sortedRecords[i]
    const rowBg = i % 2 === 0 ? white : rgb(0.97, 0.97, 0.99)
    page.drawRectangle({ x: 40, y: y - 14, width: width - 80, height: 15, color: rowBg })
    const vals = [
      MONTH_NAMES[r.month - 1],
      Number(r.basic).toFixed(2),
      Number(r.allowance).toFixed(2),
      Number(r.ssnit).toFixed(2),
      Number(r.tax).toFixed(2),
    ]
    vals.forEach((v, ci) => {
      page.drawText(v, { x: cols[ci] + 4, y: y - 10, size: 8, font, color: slate900 })
    })
    y -= 15
  }

  // Totals row
  page.drawRectangle({ x: 40, y: y - 16, width: width - 80, height: 17, color: slate900 })
  const totals = ['TOTAL', n(summary.total_basic).toFixed(2), n(summary.total_allowance).toFixed(2),
                  n(summary.total_ssnit).toFixed(2), n(summary.total_tax).toFixed(2)]
  totals.forEach((v, ci) => {
    page.drawText(v, { x: cols[ci] + 4, y: y - 11, size: 8, font: fontBold, color: white })
  })
  y -= 36

  // ── Footer ───────────────────────────────────────────────────
  page.drawLine({ start: { x: 40, y: 50 }, end: { x: width - 40, y: 50 },
    thickness: 0.5, color: slate200 })
  page.drawText('This document is system-generated. Please verify all figures before submitting to the tax authority.',
    { x: 40, y: 36, size: 7.5, font, color: slate600 })
  page.drawText(`Generated: ${new Date().toLocaleDateString('en-GH', { dateStyle: 'long' })}`,
    { x: 40, y: 24, size: 7.5, font, color: slate600 })

  return await doc.save()
}
