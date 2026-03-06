import { createClient } from '@/lib/supabase/server'
import { DepartmentCard } from '@/components/finance/DepartmentCard'
import { GenerateSummariesButton } from '@/components/finance/GenerateSummariesButton'
import type { DepartmentStats } from '@/types'
import { Building2, Users, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type SearchParams = { year?: string }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const year = parseInt(params.year ?? new Date().getFullYear().toString(), 10)
  const supabase = await createClient()

  // Fetch departments with employee counts
  const { data: departments } = await supabase
    .from('departments')
    .select('id, name, created_at')
    .order('name')

  // Fetch all tax summaries for the year
  const { data: summaries } = await supabase
    .from('tax_summaries')
    .select('employee_id, status')
    .eq('year', year)

  // Fetch all employees grouped by department
  const { data: employees } = await supabase
    .from('employees')
    .select('id, department_id')

  // Build department stats
  const summaryMap = new Map<string, string>()
  summaries?.forEach(s => summaryMap.set(s.employee_id, s.status))

  const stats: DepartmentStats[] = (departments ?? []).map(dept => {
    const deptEmployees = (employees ?? []).filter(e => e.department_id === dept.id)
    const counts = { generated: 0, email_sent: 0, viewed: 0, submitted: 0 }
    deptEmployees.forEach(e => {
      const status = summaryMap.get(e.id)
      if (status && status in counts) counts[status as keyof typeof counts]++
    })
    return {
      department: dept,
      total: deptEmployees.length,
      ...counts,
    }
  })

  const totalEmployees = employees?.length ?? 0
  const totalSubmitted = summaries?.filter(s => s.status === 'submitted').length ?? 0
  const totalSent = summaries?.filter(s => s.status !== 'generated').length ?? 0

  const prevYear = year - 1
  const nextYear = year + 1
  const currentYear = new Date().getFullYear()

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finance Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tax filing progress across all departments
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-1 shadow-sm">
            <Link href={`/dashboard?year=${prevYear}`}>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">‹</Button>
            </Link>
            <span className="px-2 text-sm font-semibold text-slate-800">{year}</span>
            <Link href={`/dashboard?year=${nextYear}`}>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                disabled={nextYear > currentYear}>›</Button>
            </Link>
          </div>

          <GenerateSummariesButton year={year} />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Departments', value: departments?.length ?? 0, icon: Building2, color: 'text-blue-600 bg-blue-50' },
          { label: 'Employees', value: totalEmployees, icon: Users, color: 'text-violet-600 bg-violet-50' },
          { label: 'Emails Sent', value: totalSent, icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
          { label: 'Submitted', value: totalSubmitted, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
        ].map(kpi => (
          <div key={kpi.label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.color}`}>
              <kpi.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
              <p className="text-xs text-slate-500">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Department cards */}
      {stats.length > 0 ? (
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Departments — {year}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map(s => (
              <DepartmentCard key={s.department.id} stats={s} year={year} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
          <Building2 className="mb-4 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">No departments yet</p>
          <p className="mt-1 text-xs text-slate-400">Upload your employee master to get started</p>
          <Link href="/upload" className="mt-4">
            <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-500">
              Upload Employee Data
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
