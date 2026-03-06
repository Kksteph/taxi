import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase/server'
import type { EmployeeCsvRow, UploadResult, UploadValidationError } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const rows = await parseFile<EmployeeCsvRow>(file)
  const errors: UploadValidationError[] = []
  const valid: EmployeeCsvRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed + header

    if (!row.employee_id?.trim()) {
      errors.push({ row: rowNum, field: 'employee_id', message: 'Missing employee_id' })
      continue
    }
    if (!row.name?.trim()) {
      errors.push({ row: rowNum, field: 'name', message: 'Missing name' })
      continue
    }
    if (!row.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push({ row: rowNum, field: 'email', message: 'Invalid or missing email' })
      continue
    }
    if (!row.department?.trim()) {
      errors.push({ row: rowNum, field: 'department', message: 'Missing department' })
      continue
    }
    valid.push(row)
  }

  if (errors.length > 0) {
    return NextResponse.json({ data: { success: false, inserted: 0, skipped: 0, errors } })
  }

  // Upsert departments
  const deptNames = [...new Set(valid.map(r => r.department.trim()))]
  const { data: existingDepts } = await supabase.from('departments').select('id, name')
  const deptMap = new Map<string, string>()
  existingDepts?.forEach(d => deptMap.set(d.name.toLowerCase(), d.id))

  for (const name of deptNames) {
    if (!deptMap.has(name.toLowerCase())) {
      const { data: newDept } = await supabase
        .from('departments').insert({ name }).select('id, name').single()
      if (newDept) deptMap.set(newDept.name.toLowerCase(), newDept.id)
    }
  }

  // Upsert employees
  let inserted = 0
  let skipped = 0

  for (const row of valid) {
    const dept_id = deptMap.get(row.department.trim().toLowerCase())
    const { error } = await supabase.from('employees').upsert({
      employee_id: row.employee_id.trim(),
      name: row.name.trim(),
      email: row.email.trim().toLowerCase(),
      department_id: dept_id ?? null,
    }, { onConflict: 'employee_id', ignoreDuplicates: false })

    if (error) {
      skipped++
    } else {
      inserted++
    }
  }

  const result: UploadResult = { success: true, inserted, skipped, errors: [] }
  return NextResponse.json({ data: result, error: null })
}

async function parseFile<T>(file: File): Promise<T[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const buffer = await file.arrayBuffer()

  if (ext === 'csv') {
    const text = new TextDecoder().decode(buffer)
    const result = Papa.parse<T>(text, { header: true, skipEmptyLines: true, transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_') })
    return result.data
  }

  // xlsx / xls
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<T>(ws, { defval: '' })
}
