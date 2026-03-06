import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const token = formData.get('token') as string | null
  const year = parseInt(formData.get('year') as string, 10)

  if (!file || !token || isNaN(year)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate file size
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 })
  }

  // Validate MIME type (not just extension)
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Accepted: PDF, JPG, PNG.' }, { status: 400 })
  }

  // Validate token + get employee
  const { data: summary, error: tokenErr } = await supabase
    .from('tax_summaries')
    .select('id, employee_id, token_expires_at')
    .eq('magic_token', token)
    .eq('year', year)
    .single()

  if (tokenErr || !summary) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
  }
  if (summary.token_expires_at && new Date(summary.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 410 })
  }

  const employee_id = summary.employee_id

  // Archive previous receipt if exists
  const { data: existing } = await supabase
    .from('receipts')
    .select('id')
    .eq('employee_id', employee_id)
    .eq('year', year)
    .is('replaced_at', null)
    .single()

  if (existing) {
    await supabase.from('receipts').update({
      replaced_at: new Date().toISOString(),
    }).eq('id', existing.id)
  }

  // Upload to storage
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  const filePath = `${year}/${employee_id}_receipt_${Date.now()}.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadErr } = await supabase.storage
    .from('receipts')
    .upload(filePath, bytes, { contentType: file.type, upsert: false })

  if (uploadErr) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Get signed URL for response
  const { data: signed } = await supabase.storage
    .from('receipts')
    .createSignedUrl(filePath, 60 * 60) // 1hr

  // Record in DB
  await supabase.from('receipts').insert({
    employee_id,
    year,
    file_url: signed?.signedUrl ?? '',
    file_path: filePath,
    file_name: file.name,
  })

  // Advance status to submitted
  await supabase.from('tax_summaries').update({ status: 'submitted' })
    .eq('id', summary.id)

  // Log
  await supabase.from('activity_logs').insert({
    action: 'receipt_uploaded',
    metadata: { employee_id, year, file_name: file.name, replaced: !!existing },
  })

  return NextResponse.json({ data: { file_url: signed?.signedUrl }, error: null })
}
