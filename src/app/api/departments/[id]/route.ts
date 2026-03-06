import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServiceClient()

  // Get employees with their latest summary and receipt for a given year
  const searchParams = new URL(_req.url).searchParams
  const year = parseInt(searchParams.get('year') ?? new Date().getFullYear().toString(), 10)

  const { data: employees, error } = await supabase
    .from('employees')
    .select(`
      *,
      department:departments(id, name),
      summaries:tax_summaries(id, status, email_sent_at, viewed_at, generated_at, magic_token, token_expires_at, year),
      receipts(id, file_url, file_path, file_name, submitted_at, replaced_at, year)
    `)
    .eq('department_id', id)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter summaries/receipts to the requested year
  const employeesWithStatus = employees?.map(emp => ({
    ...emp,
    summary: (emp.summaries as { year: number }[])?.find((s) => s.year === year) ?? null,
    receipt: (emp.receipts as { year: number; replaced_at: string | null }[])?.find((r) => r.year === year && !r.replaced_at) ?? null,
    summaries: undefined,
    receipts: undefined,
  }))

  return NextResponse.json({ data: employeesWithStatus, error: null })
}
