import Link from 'next/link'
import { Building2, ChevronRight, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DepartmentStats } from '@/types'

type DepartmentCardProps = {
  stats: DepartmentStats
  year: number
}

export function DepartmentCard({ stats, year }: DepartmentCardProps) {
  const { department, total, submitted } = stats
  const pct = total === 0 ? 0 : Math.round((submitted / total) * 100)

  const color =
    submitted === total && total > 0
      ? 'emerald'
      : submitted === 0
      ? 'red'
      : 'amber'

  const colorMap = {
    emerald: {
      dot: 'bg-emerald-500',
      ring: 'ring-emerald-200',
      bar: 'bg-emerald-500',
      badge: 'bg-emerald-50 text-emerald-700',
      label: submitted === total ? 'All Complete' : `${submitted} / ${total}`,
    },
    amber: {
      dot: 'bg-amber-400',
      ring: 'ring-amber-200',
      bar: 'bg-amber-400',
      badge: 'bg-amber-50 text-amber-700',
      label: `${submitted} / ${total}`,
    },
    red: {
      dot: 'bg-red-400',
      ring: 'ring-red-200',
      bar: 'bg-red-400',
      badge: 'bg-red-50 text-red-700',
      label: 'None submitted',
    },
  }[color]

  return (
    <Link href={`/department/${department.id}?year=${year}`}>
      <div className={cn(
        'group relative flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 transition-all duration-200',
        'hover:shadow-md hover:ring-slate-300 cursor-pointer',
        colorMap.ring
      )}>
        {/* Status dot */}
        <span className={cn('absolute right-5 top-5 h-2.5 w-2.5 rounded-full', colorMap.dot)} />

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <Building2 className="h-5 w-5 text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
              {department.name}
            </h3>
            <p className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
              <Users className="h-3 w-3" />
              {total} employee{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-slate-100">
            <div
              className={cn('h-1.5 rounded-full transition-all duration-500', colorMap.bar)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', colorMap.badge)}>
              {colorMap.label}
            </span>
            <span className="text-xs text-slate-400">{pct}% submitted</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 divide-x divide-slate-100 rounded-xl bg-slate-50 px-2 py-2.5 text-center">
          {[
            { label: 'Generated', value: stats.generated },
            { label: 'Sent', value: stats.email_sent },
            { label: 'Viewed', value: stats.viewed },
            { label: 'Done', value: stats.submitted },
          ].map(s => (
            <div key={s.label} className="px-2">
              <p className="text-sm font-semibold text-slate-800">{s.value}</p>
              <p className="text-[10px] text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        <ChevronRight className="absolute bottom-6 right-5 h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
    </Link>
  )
}
