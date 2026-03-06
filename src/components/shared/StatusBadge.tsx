import { cn } from '@/lib/utils'
import type { SubmissionStatus } from '@/types'

const config: Record<SubmissionStatus, { label: string; className: string }> = {
  generated: {
    label: 'Generated',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
  },
  email_sent: {
    label: 'Email Sent',
    className: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  viewed: {
    label: 'Viewed',
    className: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  submitted: {
    label: 'Submitted',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
}

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const { label, className } = config[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', {
        'bg-slate-400': status === 'generated',
        'bg-blue-500': status === 'email_sent',
        'bg-amber-500': status === 'viewed',
        'bg-emerald-500': status === 'submitted',
      })} />
      {label}
    </span>
  )
}
