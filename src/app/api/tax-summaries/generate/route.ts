import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computeTaxSummary, generateMagicToken, getTokenExpiry } from '@/lib/tax/compute'
import { generateTaxPDF } from '@/lib/pdf/generate'
import { sendTaxEmail } from '@/lib/email/send'
import type { Employee, MonthlyRecord } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()
  const body = await req.json()
  const { year, department_id, send_email = true } = body

  if (!year) return NextResponse.json({ error: 'Year required' }, { status: 400 })

  // Fetch employees (optionally filtered by department)
  let empQuery = supabase.from('employees').select('*, department:departments(id, name)')
  if (department_id) empQuery = empQuery.eq('department_id', department_id)
  const { data: employees, error: empErr } = await empQuery
  if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 })
  if (!employees?.length) return NextResponse.json({ error: 'No employees found' }, { status: 404 })

  const results = { generated: 0, skipped: 0, errors: [] as string[] }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const expiryDays = parseInt(process.env.MAGIC_LINK_EXPIRY_DAYS ?? '14', 10)

  for (const employee of employees as Employee[]) {
    // Fetch 12 monthly records
    const { data: records, error: recErr } = await supabase
      .from('monthly_records')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('year', year)
      .order('month', { ascending: true })

    if (recErr || !records?.length) {
      results.skipped++
      results.errors.push(`${employee.name}: missing monthly records`)
      continue
    }

    // Compute tax — server-side only
    const computation = computeTaxSummary(records as MonthlyRecord[])

    // Generate PDF bytes
    let pdfUrl: string | null = null
    let pdfPath: string | null = null
    try {
      const existing = await supabase.from('tax_summaries').select('id, pdf_url, pdf_path').eq('employee_id', employee.id).eq('year', year).single()
      const summaryForPdf = { ...computation, id: '', employee_id: employee.id, year, pdf_url: null, pdf_path: null, magic_token: null, token_expires_at: null, status: 'generated' as const, email_sent_at: null, viewed_at: null, generated_at: new Date().toISOString() }
      const pdfBytes = await generateTaxPDF(employee, summaryForPdf, records as MonthlyRecord[])

      const fileName = `${year}/${employee.employee_id}_tax_summary.pdf`
      const { error: uploadErr } = await supabase.storage
        .from('tax-pdfs')
        .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

      if (!uploadErr) {
        pdfPath = fileName
        // Get a long-lived signed URL (7 days — refreshed on demand)
        const { data: signed } = await supabase.storage
          .from('tax-pdfs')
          .createSignedUrl(fileName, 60 * 60 * 24 * 7)
        pdfUrl = signed?.signedUrl ?? null
      }
    } catch (e) {
      results.errors.push(`${employee.name}: PDF generation failed`)
    }

    // Generate magic token
    const magic_token = generateMagicToken()
    const token_expires_at = getTokenExpiry().toISOString()

    // Upsert tax summary
    const { error: summaryErr } = await supabase.from('tax_summaries').upsert({
      employee_id: employee.id,
      year,
      ...computation,
      pdf_url: pdfUrl,
      pdf_path: pdfPath,
      magic_token,
      token_expires_at,
      status: 'generated',
    }, { onConflict: 'employee_id,year', ignoreDuplicates: false })

    if (summaryErr) {
      results.skipped++
      results.errors.push(`${employee.name}: ${summaryErr.message}`)
      continue
    }

    // Send email
    if (send_email) {
      try {
        await sendTaxEmail({
          to: employee.email,
          employeeName: employee.name,
          year,
          magicLink: `${appUrl}/tax/${magic_token}`,
          expiryDays,
        })
        await supabase.from('tax_summaries').update({
          status: 'email_sent',
          email_sent_at: new Date().toISOString(),
        }).eq('employee_id', employee.id).eq('year', year)
      } catch (e) {
        results.errors.push(`${employee.name}: email failed — summary still generated`)
      }
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      action: 'tax_summary_generated',
      metadata: { employee_id: employee.id, employee_name: employee.name, year },
    })

    results.generated++
  }

  return NextResponse.json({ data: results, error: null })
}
