'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { formatCurrency, MONTH_NAMES } from '@/lib/tax/compute'
import type { MonthlyRecord } from '@/types'

export function MonthlyBreakdown({ records }: { records: MonthlyRecord[] }) {
  const sorted = [...records].sort((a, b) => a.month - b.month)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Monthly Breakdown</h2>
        <p className="text-sm text-slate-500">Expand each month to verify your figures</p>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Month', 'Basic Salary', 'Allowance', 'SSNIT', 'Tax'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-3.5 font-medium text-slate-700">
                  {MONTH_NAMES[r.month - 1]}
                </td>
                <td className="px-6 py-3.5 text-slate-600">{formatCurrency(r.basic)}</td>
                <td className="px-6 py-3.5 text-slate-600">{formatCurrency(r.allowance)}</td>
                <td className="px-6 py-3.5 text-slate-600">{formatCurrency(r.ssnit)}</td>
                <td className="px-6 py-3.5 text-slate-600">{formatCurrency(r.tax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile accordion */}
      <div className="sm:hidden">
        <Accordion type="multiple" className="divide-y divide-slate-100">
          {sorted.map((r) => (
            <AccordionItem key={r.id} value={r.id} className="border-0 px-4">
              <AccordionTrigger className="py-3.5 text-sm font-medium text-slate-700 hover:no-underline">
                {MONTH_NAMES[r.month - 1]}
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {[
                    { label: 'Basic', value: r.basic },
                    { label: 'Allowance', value: r.allowance },
                    { label: 'SSNIT', value: r.ssnit },
                    { label: 'Tax', value: r.tax },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="text-sm font-semibold text-slate-800">{formatCurrency(value)}</dd>
                    </div>
                  ))}
                </dl>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}
