'use client'

import { useState, useCallback } from 'react'
import { UploadZone } from '@/components/shared/UploadZone'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Loader2, CheckCircle2, AlertCircle, Download, FileSpreadsheet,
  ChevronDown, ChevronUp, Info, Building2,
} from 'lucide-react'
import type { ValidationError, WorkbookUploadResult } from '@/lib/excel/types'
import { cn } from '@/lib/utils'

const LEVEL_LABELS: Record<string, string> = {
  file: 'File',
  workbook: 'Workbook',
  employee_metadata: 'Employee',
  monthly: 'Monthly Data',
  totals: 'Totals',
  bonus: 'Bonus',
  tax_summary: 'Tax Summary',
  cross_system: 'System Check',
}

const LEVEL_COLORS: Record<string, string> = {
  file:              'bg-red-100 text-red-700',
  workbook:          'bg-orange-100 text-orange-700',
  employee_metadata: 'bg-purple-100 text-purple-700',
  monthly:           'bg-blue-100 text-blue-700',
  totals:            'bg-amber-100 text-amber-700',
  bonus:             'bg-yellow-100 text-yellow-700',
  tax_summary:       'bg-emerald-100 text-emerald-700',
  cross_system:      'bg-slate-100 text-slate-700',
}

type Department = { id: string; name: string }

type Props = {
  departments: Department[]
  year: number
}

export function WorkbookUpload({ departments, year }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [deptId, setDeptId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<WorkbookUploadResult | null>(null)
  const [expandedSheets, setExpandedSheets] = useState<Set<string>>(new Set())

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setResult(null)

    const form = new FormData()
    form.append('file', file)
    form.append('year', year.toString())
    if (deptId) form.append('department_id', deptId)

    try {
      const res = await fetch('/api/payroll/upload-workbook', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      setResult(json.data)
      if (json.data?.success) {
        toast.success(`${json.data.processed} employee records imported from workbook`)
      } else {
        toast.error(`Upload failed — ${json.data.errors.length} error(s) found`)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = (sample = false) => {
    const url = `/api/payroll/template?year=${year}${sample ? '&sample=true' : ''}`
    const a = document.createElement('a')
    a.href = url
    a.download = sample ? `Sample_Workbook_${year}.xlsx` : `Salary_Template_${year}.xlsx`
    a.click()
    toast.success(`${sample ? 'Sample' : 'Template'} workbook downloading…`)
  }

  // Group errors by sheet
  const errorsBySheet = result?.errors.reduce((acc, e) => {
    const key = e.sheet || '_workbook'
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {} as Record<string, ValidationError[]>) ?? {}

  const toggleSheet = (sheet: string) => {
    setExpandedSheets(prev => {
      const next = new Set(prev)
      next.has(sheet) ? next.delete(sheet) : next.add(sheet)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
          <FileSpreadsheet className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Department Salary Workbook</h2>
          <p className="text-sm text-slate-500">Upload a structured Excel workbook — one sheet per employee</p>
        </div>
      </div>

      {/* Template downloads */}
      <div className="flex flex-wrap gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <div className="flex items-center gap-2 flex-1">
          <Info className="h-4 w-4 text-slate-400 shrink-0" />
          <p className="text-xs text-slate-600">
            Each workbook must follow the required structure. Download the template or sample to get started.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => downloadTemplate(false)}>
            <Download className="h-3.5 w-3.5" />
            Template
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => downloadTemplate(true)}>
            <Download className="h-3.5 w-3.5" />
            Sample (2 employees)
          </Button>
        </div>
      </div>

      {/* Workbook format guide */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workbook Structure</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="space-y-1.5">
            <p className="font-medium text-slate-700">Sheet naming format:</p>
            <code className="block rounded bg-slate-100 px-2 py-1 text-violet-700">EmployeeName_EmployeeID</code>
            <p className="text-slate-400">e.g. StephenKumi_EMP001</p>
          </div>
          <div className="space-y-1.5">
            <p className="font-medium text-slate-700">Each sheet contains:</p>
            <ul className="space-y-0.5 text-slate-500">
              <li>① Employee details</li>
              <li>② Monthly salary table (Jan–Dec, partial OK)</li>
              <li>③ Totals</li>
              <li>④ Bonus section</li>
              <li>⑤ Tax summary for filing</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Department selector */}
      <div className="flex items-center gap-3">
        <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
        <select
          value={deptId}
          onChange={e => setDeptId(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
        >
          <option value="">Select department (optional)</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Upload zone */}
      <UploadZone
        label="Drop your department .xlsx workbook here"
        description="One workbook per department · Each sheet = one employee"
        accept=".xlsx"
        onFile={setFile}
        disabled={loading}
      />

      {/* Upload button */}
      <Button
        onClick={handleUpload}
        disabled={!file || loading}
        className="w-full bg-violet-600 text-white hover:bg-violet-500 gap-2"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Processing workbook…</>
        ) : 'Upload & Validate Workbook'}
      </Button>

      {/* Result */}
      {result && (
        <div className={cn(
          'rounded-2xl p-5 space-y-4 ring-1',
          result.success ? 'bg-emerald-50 ring-emerald-200' : 'bg-red-50 ring-red-200'
        )}>
          {/* Summary */}
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            )}
            <div>
              <p className={cn('font-semibold text-sm', result.success ? 'text-emerald-800' : 'text-red-700')}>
                {result.success
                  ? `${result.processed} of ${result.totalSheets} employee sheets imported successfully`
                  : `Upload failed — ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''} found`}
              </p>
              {!result.success && (
                <p className="text-xs mt-0.5 text-red-500">Fix all errors and re-upload the workbook</p>
              )}
            </div>
          </div>

          {/* Error breakdown by sheet */}
          {result.errors.length > 0 && (
            <div className="space-y-2">
              {Object.entries(errorsBySheet).map(([sheet, errs]) => {
                const expanded = expandedSheets.has(sheet)
                return (
                  <div key={sheet} className="rounded-xl border border-red-200 bg-white overflow-hidden">
                    <button
                      onClick={() => toggleSheet(sheet)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-red-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">
                          {sheet === '_workbook' ? 'Workbook' : sheet}
                        </span>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          {errs.length} error{errs.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {expanded
                        ? <ChevronUp className="h-4 w-4 text-slate-400" />
                        : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </button>

                    {expanded && (
                      <div className="divide-y divide-red-100 border-t border-red-200">
                        {errs.map((e, i) => (
                          <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide mt-0.5', LEVEL_COLORS[e.level] ?? 'bg-slate-100 text-slate-600')}>
                              {LEVEL_LABELS[e.level] ?? e.level}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs text-slate-700">{e.message}</p>
                              {e.field && <p className="text-[10px] text-slate-400 mt-0.5">Field: {e.field}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
