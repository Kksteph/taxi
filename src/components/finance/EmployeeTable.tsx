'use client'

import { useState } from 'react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Check, Minus, ExternalLink, RefreshCw, Download } from 'lucide-react'
import type { EmployeeWithStatus, SubmissionStatus } from '@/types'
import { cn } from '@/lib/utils'

type EmployeeTableProps = {
  employees: EmployeeWithStatus[]
  year: number
  onRegenerateLink: (employeeId: string) => Promise<void>
  onDownloadReceipt: (filePath: string, fileName: string) => void
}

export function EmployeeTable({ employees, year, onRegenerateLink, onDownloadReceipt }: EmployeeTableProps) {
  const [regenerating, setRegenerating] = useState<string | null>(null)

  const handleRegenerate = async (empId: string) => {
    setRegenerating(empId)
    try {
      await onRegenerateLink(empId)
    } finally {
      setRegenerating(null)
    }
  }

  const Tick = ({ value }: { value: boolean }) =>
    value
      ? <Check className="h-4 w-4 text-emerald-500" />
      : <Minus className="h-4 w-4 text-slate-300" />

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            {['Name', 'Email', 'Status', 'Tax Sent', 'Viewed', 'Submitted', 'Actions'].map(h => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {employees.map((emp) => {
            const status = emp.summary?.status as SubmissionStatus | undefined
            return (
              <tr key={emp.id} className="group hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3.5">
                  <span className="font-medium text-slate-800">{emp.name}</span>
                  <span className="ml-2 text-xs text-slate-400">#{emp.employee_id}</span>
                </td>
                <td className="px-4 py-3.5 text-slate-500">{emp.email}</td>
                <td className="px-4 py-3.5">
                  {status ? (
                    <StatusBadge status={status} />
                  ) : (
                    <span className="text-xs text-slate-400 italic">No summary</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <Tick value={!!emp.summary?.email_sent_at} />
                </td>
                <td className="px-4 py-3.5">
                  <Tick value={!!emp.summary?.viewed_at} />
                </td>
                <td className="px-4 py-3.5">
                  <Tick value={status === 'submitted'} />
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {emp.summary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs text-slate-600"
                        onClick={() => handleRegenerate(emp.id)}
                        disabled={regenerating === emp.id}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', regenerating === emp.id && 'animate-spin')} />
                        New Link
                      </Button>
                    )}
                    {emp.receipt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs text-slate-600"
                        onClick={() => onDownloadReceipt(emp.receipt!.file_path, emp.receipt!.file_name ?? 'receipt')}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Receipt
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {employees.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-400">
          No employees found in this department.
        </div>
      )}
    </div>
  )
}
