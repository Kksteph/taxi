import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const { uploadId } = await params
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('salary_uploads')
    .select('id, status, total_sheets, processed, created_at, completed_at, filename, year')
    .eq('id', uploadId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  return NextResponse.json({ data, error: null })
}
