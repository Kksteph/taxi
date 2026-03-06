import { formatCurrency } from '@/lib/tax/compute'
import type { TaxSummary } from '@/types'
import { Banknote, Wallet, Shield, TrendingUp, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

const cards = [
  {
    key: 'total_basic' as keyof TaxSummary,
    label: 'Basic Salary',
    hint: 'Enter this value into the tax portal',
    icon: Banknote,
    accent: 'blue',
  },
  {
    key: 'total_allowance' as keyof TaxSummary,
    label: 'Cash Allowance',
    hint: 'Enter this value into the tax portal',
    icon: Wallet,
    accent: 'violet',
  },
  {
    key: 'total_ssnit' as keyof TaxSummary,
    label: 'Social Security (SSNIT)',
    hint: 'Total SSNIT deductions',
    icon: Shield,
    accent: 'slate',
  },
  {
    key: 'chargeable_income' as keyof TaxSummary,
    label: 'Chargeable Income',
    hint: 'Enter this value into the tax portal',
    icon: TrendingUp,
    accent: 'amber',
  },
  {
    key: 'total_tax' as keyof TaxSummary,
    label: 'Tax Charged',
    hint: 'Enter this value into the tax portal',
    icon: Receipt,
    accent: 'emerald',
  },
]

const accents = {
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    ring: 'ring-blue-100',    iconBg: 'bg-blue-100' },
  violet:  { bg: 'bg-violet-50',  icon: 'text-violet-600',  ring: 'ring-violet-100',  iconBg: 'bg-violet-100' },
  slate:   { bg: 'bg-slate-50',   icon: 'text-slate-600',   ring: 'ring-slate-200',   iconBg: 'bg-slate-200' },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   ring: 'ring-amber-100',   iconBg: 'bg-amber-100' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-100', iconBg: 'bg-emerald-100' },
}

export function SummaryCards({ summary }: { summary: TaxSummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map(({ key, label, hint, icon: Icon, accent }) => {
        const a = accents[accent as keyof typeof accents]
        const value = summary[key] as number
        return (
          <div
            key={key}
            className={cn(
              'flex flex-col gap-4 rounded-2xl p-5 ring-1 transition-all duration-200 hover:shadow-md',
              a.bg, a.ring
            )}
          >
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', a.iconBg)}>
              <Icon className={cn('h-5 w-5', a.icon)} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                {formatCurrency(value)}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 italic">{hint}</p>
          </div>
        )
      })}
    </div>
  )
}
