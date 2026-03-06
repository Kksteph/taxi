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
  const { data: summary, error: summaryErr } = await supabase
    .from('tax_summaries')
    .select('*')
    .eq('magic_token', token)
    .single()

  console.log('[pdf] token lookup:', { found: !!summary, error: summaryErr?.message })

  if (!summary) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (summary.token_expires_at && new Date(summary.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 410 })
  }

  const fileName = `${summary.year}_tax_summary.pdf`
  console.log('[pdf] pdf_path:', summary.pdf_path)

  // Try to serve from storage (proxy bytes — avoids cross-origin redirect issues)
  if (summary.pdf_path) {
    try {
      const { data: signed, error: signErr } = await supabase.storage
        .from('tax-pdfs')
        .createSignedUrl(summary.pdf_path, 60 * 30)

      console.log('[pdf] signed url:', { ok: !!signed?.signedUrl, error: signErr?.message })

      if (signed?.signedUrl) {
        const storageRes = await fetch(signed.signedUrl)
        console.log('[pdf] storage fetch status:', storageRes.status)
        if (storageRes.ok) {
          const buffer = await storageRes.arrayBuffer()
          return new NextResponse(Buffer.from(buffer), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${fileName}"`,
              'Cache-Control': 'private, no-store',
            },
          })
        }
      }
    } catch (e) {
      console.error('[pdf] storage fetch error:', e)
      // fall through to on-the-fly generation
    }
  }

  // Fallback: regenerate PDF on the fly
  console.log('[pdf] falling back to on-the-fly generation')

  const { data: employee, error: empErr } = await supabase
    .from('employees')
    .select('*')
    .eq('id', summary.employee_id)
    .single()

  const { data: records, error: recErr } = await supabase
    .from('monthly_records')
    .select('*')
    .eq('employee_id', summary.employee_id)
    .eq('year', summary.year)
    .order('month', { ascending: true })

  console.log('[pdf] employee:', { found: !!employee, error: empErr?.message })
  console.log('[pdf] records:', { count: records?.length ?? 0, year: summary.year, error: recErr?.message })

  if (!employee || !records?.length) {
    return NextResponse.json({ error: `Data not found — employee: ${!!employee}, records: ${records?.length ?? 0} for year ${summary.year}` }, { status: 404 })
  }

  try {
    const pdfBytes = await generateTaxPDF(
      employee as Employee,
      summary as TaxSummary,
      records as MonthlyRecord[]
    )

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[pdf] generation error:', msg)
    return NextResponse.json({ error: `PDF generation failed: ${msg}` }, { status: 500 })
  }
}
