import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Mark token as viewed (ping on page load)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createServiceClient()

  const { data: summary, error } = await supabase
    .from('tax_summaries')
    .select('id, status, token_expires_at')
    .eq('magic_token', token)
    .single()

  if (error || !summary) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  if (summary.token_expires_at && new Date(summary.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 410 })
  }

  // Only update if not already further in pipeline
  if (summary.status === 'email_sent') {
    await supabase.from('tax_summaries').update({
      status: 'viewed',
      viewed_at: new Date().toISOString(),
    }).eq('id', summary.id)
  }

  return NextResponse.json({ data: { ok: true }, error: null })
}
