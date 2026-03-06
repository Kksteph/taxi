import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase/server'
import type { UploadResult, UploadValidationError } from '@/types'

// Accepts many common column name variations
function normalizeRow(raw: Record<string, string>) {
  const get = (...keys: string[]): string => {
    for (const k of keys) {
      const val = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()]
      if (val?.toString().trim()) return val.toString().trim()
    }
    return ''
  }

  return {
    employee_id: get('employee_id', 'employeeid', 'id', 'staff_id', 'staffid', 'emp_id', 'empid', 'employee id', 'staff id'),
    name:        get('name', 'full_name', 'fullname', 'full name', 'employee_name', 'employeename', 'employee name'),
    email:       get('email', 'email_address', 'emailaddress', 'work_email', 'workemail', 'work email', 'mail'),
    department:  get('department', 'dept', 'department_name', 'departmentname', 'division'),
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const rawRows = await parseFile(file)
  const errors: UploadValidationError[] = []
  const valid: ReturnType<typeof normalizeRow>[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const row = normalizeRow(rawRows[i])
    const rowNum = i + 2

    if (!row.employee_id) {
      errors.push({ row: rowNum, field: 'employee_id', message: 'Missing employee ID — accepted column names: id, employee_id, staff_id, emp_id' })
      continue
    }
    if (!row.name) {
      errors.push({ row: rowNum, field: 'name', message: 'Missing name — accepted column names: name, full_name, employee_name' })
      continue
    }
    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push({ row: rowNum, field: 'email', message: 'Invalid or missing email — accepted column names: email, work_email, mail' })
      continue
    }
    if (!row.department) {
      errors.push({ row: rowNum, field: 'department', message: 'Missing department — accepted column names: department, dept, division' })
      continue
    }
    valid.push(row)
  }

  if (errors.length > 0) {
    return NextResponse.json({ data: { success: false, inserted: 0, skipped: 0, errors } })
  }

  // Upsert departments
  const deptNames = [...new Set(valid.map(r => r.department))]
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
    const dept_id = deptMap.get(row.department.toLowerCase())
    const { error } = await supabase.from('employees').upsert({
      employee_id:   row.employee_id,
      name:          row.name,
      email:         row.email.toLowerCase(),
      department_id: dept_id ?? null,
    }, { onConflict: 'employee_id', ignoreDuplicates: false })

    if (error) skipped++
    else inserted++
  }

  const result: UploadResult = { success: true, inserted, skipped, errors: [] }
  return NextResponse.json({ data: result, error: null })
}

async function parseFile(file: File): Promise<Record<string, string>[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const buffer = await file.arrayBuffer()

  if (ext === 'csv') {
    const text = new TextDecoder().decode(buffer)
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
    })
    return result.data
  }

  // xlsx / xls — normalize headers the same way
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  return rows.map(row => {
    const normalized: Record<string, string> = {}
    for (const [k, v] of Object.entries(row)) {
      normalized[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v)
    }
    return normalized
  })
}
