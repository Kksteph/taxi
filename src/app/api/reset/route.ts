import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE() {
  const supabase = await createServiceClient()

  // Delete in dependency order (children before parents)
  const steps = [
    () => supabase.from('receipts').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    () => supabase.from('tax_summaries').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    () => supabase.from('bonus_records').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    () => supabase.from('monthly_records').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    () => supabase.from('salary_uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    () => supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    () => supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    () => supabase.from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
  ]

  for (const step of steps) {
    const { error } = await step()
    // Ignore "relation does not exist" errors for optional tables
    if (error && !error.message.includes('does not exist')) {
      console.error('[reset] Error:', error.message)
    }
  }

  return NextResponse.json({ ok: true })
}
