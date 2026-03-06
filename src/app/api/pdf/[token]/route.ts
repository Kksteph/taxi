import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateTaxPDF } from '@/lib/pdf/generate'
import type { Employee, MonthlyRecord, TaxSummary } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createServiceClient()

  // Validate token
  const { data: summary } = await supabase
    .from('tax_summaries')
    .select('*')
    .eq('magic_token', token)
    .single()

  if (!summary) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (summary.token_expires_at && new Date(summary.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 410 })
  }

  // If PDF is stored in S3/Supabase storage, serve a fresh signed URL redirect
  if (summary.pdf_path) {
    const { data: signed } = await supabase.storage
      .from('tax-pdfs')
      .createSignedUrl(summary.pdf_path, 60 * 30) // 30 min

    if (signed?.signedUrl) {
      return NextResponse.redirect(signed.signedUrl)
    }
  }

  // Fallback: regenerate PDF on the fly
  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('id', summary.employee_id)
    .single()

  const { data: records } = await supabase
    .from('monthly_records')
    .select('*')
    .eq('employee_id', summary.employee_id)
    .eq('year', summary.year)
    .order('month', { ascending: true })

  if (!employee || !records) {
    return NextResponse.json({ error: 'Data not found' }, { status: 404 })
  }

  const pdfBytes = await generateTaxPDF(
    employee as Employee,
    summary as TaxSummary,
    records as MonthlyRecord[]
  )

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${summary.year}_tax_summary.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
