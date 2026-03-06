import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseWorkbook } from '@/lib/excel/parser'
import { validateFile, runFullValidation, type CrossSystemContext } from '@/lib/excel/validator'
import type { WorkbookUploadResult } from '@/lib/excel/types'

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()

  const formData = await req.formData()
  const file          = formData.get('file') as File | null
  const departmentId  = formData.get('department_id') as string | null
  const yearParam     = formData.get('year') as string | null

  if (!file)        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!yearParam)   return NextResponse.json({ error: 'Year is required' }, { status: 400 })

  const year = parseInt(yearParam, 10)
  if (isNaN(year))  return NextResponse.json({ error: 'Invalid year' }, { status: 400 })

  // ── Layer 1: File validation ─────────────────────────────
  const fileErrors = validateFile(file, 10)
  if (fileErrors.length > 0) {
    return NextResponse.json({
      data: { success: false, uploadId: null, totalSheets: 0, processed: 0, errors: fileErrors },
      error: null,
    })
  }

  // Create upload tracking record
  const { data: uploadRecord } = await supabase
    .from('salary_uploads')
    .insert({
      department_id: departmentId ?? null,
      year,
      filename: file.name,
      status: 'processing',
    })
    .select('id')
    .single()

  const uploadId = uploadRecord?.id ?? crypto.randomUUID()

  // ── Parse workbook ───────────────────────────────────────
  let parsed
  try {
    const buffer = await file.arrayBuffer()
    parsed = parseWorkbook(buffer)
  } catch (e) {
    await supabase.from('salary_uploads').update({
      status: 'failed',
      errors: [{ level: 'file', sheet: '', field: 'parse', message: 'Workbook is corrupted and cannot be read.' }],
      completed_at: new Date().toISOString(),
    }).eq('id', uploadId)

    return NextResponse.json({
      data: {
        success: false, uploadId, totalSheets: 0, processed: 0,
        errors: [{ level: 'file', sheet: '', field: 'parse', message: 'Workbook is corrupted and cannot be read.' }],
      },
      error: null,
    })
  }

  // ── Cross-system context ─────────────────────────────────
  const [{ data: employees }, { data: departments }, { data: existingUploads }] = await Promise.all([
    supabase.from('employees').select('employee_id'),
    supabase.from('departments').select('name'),
    supabase.from('salary_uploads')
      .select('id')
      .eq('year', year)
      .eq('status', 'completed'),
  ])

  // Also check monthly_records for existing data
  const { data: existingRecords } = await supabase
    .from('monthly_records')
    .select('employee_id, year, employees(employee_id)')
    .eq('year', year)
    .limit(1000)

  const crossCtx: CrossSystemContext = {
    existingEmployeeIds: new Set(employees?.map(e => e.employee_id) ?? []),
    existingDepartments: new Set(departments?.map(d => d.name.toLowerCase()) ?? []),
    existingUploads: new Set<string>(),
    year,
  }

  // Build set of employee IDs that already have records for this year
  // (use supabase join-style)
  // We'll re-query with employee_id string
  const empIdsWithRecords = new Set<string>()
  if (existingRecords) {
    for (const r of existingRecords as unknown as { employees: { employee_id: string } | null }[]) {
      if (r.employees?.employee_id) {
        empIdsWithRecords.add(`${r.employees.employee_id}:${year}`)
      }
    }
  }
  crossCtx.existingUploads = empIdsWithRecords

  // ── Full validation ──────────────────────────────────────
  const validation = runFullValidation(parsed, crossCtx)

  await supabase.from('salary_uploads').update({
    total_sheets: parsed.employees.length,
    errors: validation.errors,
  }).eq('id', uploadId)

  if (!validation.valid) {
    await supabase.from('salary_uploads').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
    }).eq('id', uploadId)

    return NextResponse.json({
      data: {
        success: false,
        uploadId,
        totalSheets: parsed.employees.length,
        processed: 0,
        errors: validation.errors,
      },
      error: null,
    })
  }

  // ── Persist data ─────────────────────────────────────────
  let processed = 0

  for (const emp of parsed.employees) {
    // Look up employee UUID
    const { data: empRecord } = await supabase
      .from('employees')
      .select('id')
      .eq('employee_id', emp.employeeId)
      .single()

    if (!empRecord) continue

    const employeeUUID = empRecord.id

    // Upsert monthly records
    for (const record of emp.monthlyRecords) {
      await supabase.from('monthly_records').upsert({
        employee_id:           employeeUUID,
        month:                 record.monthNum,
        year:                  emp.taxYear,
        basic:                 record.basicSalary,
        allowance:             record.allowances,
        ssnit:                 record.tier2,
        tax:                   record.taxPaidOnAccount,
        tier2:                 record.tier2,
        net_salary:            record.netSalary,
        tax_paid_on_account:   record.taxPaidOnAccount,
      }, { onConflict: 'employee_id,month,year', ignoreDuplicates: false })
    }

    // Upsert bonus record
    if (emp.bonus.grossBonus > 0) {
      await supabase.from('bonus_records').upsert({
        employee_id:      employeeUUID,
        year:             emp.taxYear,
        gross_bonus:      emp.bonus.grossBonus,
        bonus_15pct:      emp.bonus.bonus15Pct,
        excess_bonus:     emp.bonus.excessBonus,
        final_bonus_tax:  emp.bonus.finalBonusTax,
        excess_tax:       emp.bonus.excessTax,
        net_bonus:        emp.bonus.netBonus,
      }, { onConflict: 'employee_id,year', ignoreDuplicates: false })
    }

    // Upsert tax summary
    await supabase.from('tax_summaries').upsert({
      employee_id:       employeeUUID,
      year:              emp.taxYear,
      total_basic:       emp.taxSummary.basicSalary,
      total_allowance:   emp.taxSummary.cashAllowances,
      total_ssnit:       emp.taxSummary.socialSecurity,
      total_tier2:       emp.taxSummary.socialSecurity,
      chargeable_income: emp.taxSummary.chargeableIncome,
      total_tax:         emp.taxSummary.taxCharged,
      tax_charged:       emp.taxSummary.taxCharged,
      tax_paid:          emp.taxSummary.taxPaid,
      tax_outstanding:   emp.taxSummary.taxOutstanding,
      cash_allowances:   emp.taxSummary.cashAllowances,
      excess_bonus:      emp.taxSummary.excessBonus,
    }, { onConflict: 'employee_id,year', ignoreDuplicates: false })

    // Activity log
    await supabase.from('activity_logs').insert({
      action: 'salary_workbook_uploaded',
      metadata: { employee_id: employeeUUID, employee_name: emp.employeeName, year: emp.taxYear, sheets: emp.monthlyRecords.length },
    })

    processed++
  }

  // Mark upload complete
  await supabase.from('salary_uploads').update({
    status: 'completed',
    processed,
    completed_at: new Date().toISOString(),
  }).eq('id', uploadId)

  const result: WorkbookUploadResult = {
    success: true,
    uploadId,
    totalSheets: parsed.employees.length,
    processed,
    errors: [],
  }

  return NextResponse.json({ data: result, error: null })
}
