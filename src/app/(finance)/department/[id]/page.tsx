import { createClient } from '@/lib/supabase/server'
import { EmployeeTable } from '@/components/finance/EmployeeTable'
import { DepartmentActions } from '@/components/finance/DepartmentActions'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { EmployeeWithStatus } from '@/types'

export default async function DepartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const year = parseInt(sp.year ?? new Date().getFullYear().toString(), 10)

  const supabase = await createClient()

  const { data: department } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .single()

  if (!department) notFound()

  // Fetch employees with summaries and receipts directly
  const { data: employees } = await supabase
    .from('employees')
    .select(`
      *,
      department:departments(id, name),
      summaries:tax_summaries(id, status, email_sent_at, viewed_at, generated_at, magic_token, token_expires_at, year),
      receipts(id, file_url, file_path, file_name, submitted_at, replaced_at, year)
    `)
    .eq('department_id', id)
    .order('name', { ascending: true })

  // Filter to requested year
  const employeesWithStatus: EmployeeWithStatus[] = (employees ?? []).map(emp => ({
    ...emp,
    summary: (emp.summaries as { year: number }[])?.find((s) => s.year === year) ?? null,
    receipt: (emp.receipts as { year: number; replaced_at: string | null }[])
      ?.find((r) => r.year === year && !r.replaced_at) ?? null,
    summaries: undefined,
    receipts: undefined,
  }))

  const submitted = employeesWithStatus.filter(e => e.summary?.status === 'submitted').length
  const total = employeesWithStatus.length

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard?year=${year}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{department.name}</h1>
              <p className="text-sm text-slate-500">
                {total} employees · {submitted} of {total} submitted · {year}
              </p>
            </div>
          </div>
        </div>

        <DepartmentActions departmentId={id} year={year} employees={employeesWithStatus} />
      </div>

      {/* Table */}
      <EmployeeTable
        employees={employeesWithStatus}
        year={year}
        onRegenerateLink={async () => {}}
        onDownloadReceipt={() => {}}
      />
    </div>
  )
}
