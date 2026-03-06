'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2, Filter } from 'lucide-react'
import { toast } from 'sonner'
import type { EmployeeWithStatus, SubmissionStatus } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Props = {
  departmentId: string
  year: number
  employees: EmployeeWithStatus[]
}

export function DepartmentActions({ departmentId, year, employees }: Props) {
  const [exporting, setExporting] = useState(false)

  const handleExportCSV = () => {
    const rows = employees.map(e => ({
      name: e.name,
      employee_id: e.employee_id,
      email: e.email,
      status: e.summary?.status ?? 'no_summary',
      email_sent: e.summary?.email_sent_at ? 'Yes' : 'No',
      viewed: e.summary?.viewed_at ? 'Yes' : 'No',
      submitted: e.summary?.status === 'submitted' ? 'Yes' : 'No',
      receipt_file: e.receipt?.file_name ?? '',
    }))

    const headers = Object.keys(rows[0] ?? {})
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${(r as Record<string, string>)[h] ?? ''}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${year}_submission_status.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-slate-600"
        onClick={handleExportCSV}
      >
        <Download className="h-4 w-4" />
        Export CSV
      </Button>
    </div>
  )
}
