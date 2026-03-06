import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase/server'
import type { PayrollCsvRow, UploadResult, UploadValidationError } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const yearParam = formData.get('year') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!yearParam) return NextResponse.json({ error: 'Year is required' }, { status: 400 })

  const year = parseInt(yearParam, 10)
  if (isNaN(year)) return NextResponse.json({ error: 'Invalid year' }, { status: 400 })

  const rows = await parseFile<PayrollCsvRow>(file)
  const errors: UploadValidationError[] = []
  const valid: PayrollCsvRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    if (!row.employee_id?.toString().trim()) {
      errors.push({ row: rowNum, field: 'employee_id', message: 'Missing employee_id' }); continue
    }
    const month = parseInt(row.month?.toString(), 10)
    if (isNaN(month) || month < 1 || month > 12) {
      errors.push({ row: rowNum, field: 'month', message: 'Invalid month (must be 1–12)' }); continue
    }
    const numFields = ['basic', 'allowance', 'ssnit', 'tax'] as const
    let hasNumErr = false
    for (const f of numFields) {
      const v = parseFloat(row[f]?.toString() ?? '')
      if (isNaN(v) || v < 0) {
        errors.push({ row: rowNum, field: f, message: `Invalid ${f} value` })
        hasNumErr = true
      }
    }
    if (!hasNumErr) valid.push({ ...row, month })
  }

  if (errors.length > 0) {
    return NextResponse.json({ data: { success: false, inserted: 0, skipped: 0, errors } })
  }

  // Map employee_id strings to UUIDs
  const empIds = [...new Set(valid.map(r => r.employee_id.toString().trim()))]
  const { data: employees } = await supabase
    .from('employees').select('id, employee_id').in('employee_id', empIds)

  const empMap = new Map<string, string>()
  employees?.forEach(e => empMap.set(e.employee_id, e.id))

  const unknownIds = empIds.filter(id => !empMap.has(id))
  if (unknownIds.length > 0) {
    return NextResponse.json({
      data: {
        success: false, inserted: 0, skipped: 0,
        errors: unknownIds.map(id => ({
          row: 0, field: 'employee_id',
          message: `Employee ID not found: ${id}`,
        })),
      },
    })
  }

  let inserted = 0
  let skipped = 0

  for (const row of valid) {
    const employee_uuid = empMap.get(row.employee_id.toString().trim())!
    const { error } = await supabase.from('monthly_records').upsert({
      employee_id: employee_uuid,
      month: parseInt(row.month.toString(), 10),
      year,
      basic: parseFloat(row.basic.toString()),
      allowance: parseFloat(row.allowance.toString()),
      ssnit: parseFloat(row.ssnit.toString()),
      tax: parseFloat(row.tax.toString()),
    }, { onConflict: 'employee_id,month,year', ignoreDuplicates: false })

    if (error) skipped++
    else inserted++
  }

  const result: UploadResult = { success: true, inserted, skipped, errors: [] }
  return NextResponse.json({ data: result, error: null })
}

async function parseFile<T>(file: File): Promise<T[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const buffer = await file.arrayBuffer()

  if (ext === 'csv') {
    const text = new TextDecoder().decode(buffer)
    const result = Papa.parse<T>(text, {
      header: true, skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
    })
    return result.data
  }

  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<T>(ws, { defval: '' })
}
