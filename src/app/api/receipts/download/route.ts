import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')

  if (!path) return NextResponse.json({ error: 'No path provided' }, { status: 400 })

  const supabase = await createServiceClient()

  // Generate a fresh signed URL (1 hour)
  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(path, 60 * 60)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 })
  }

  // Redirect to the signed URL — browser will download the file
  return NextResponse.redirect(data.signedUrl)
}
