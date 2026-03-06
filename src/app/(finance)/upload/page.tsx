'use client'

import React, { useState, useEffect } from 'react'
import { UploadZone } from '@/components/shared/UploadZone'
import { WorkbookUpload } from '@/components/finance/WorkbookUpload'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CheckCircle2, AlertCircle, Loader2, Users, BookOpen, ChevronRight, Info } from 'lucide-react'
import type { UploadResult } from '@/types'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Step = 'employees' | 'workbook'
type Department = { id: string; name: string }

export default function UploadPage() {
  const [step, setStep] = useState<Step>('employees')
  const [empFile, setEmpFile] = useState<File | null>(null)
  const [year] = useState(new Date().getFullYear().toString())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('departments').select('id, name').order('name')
      .then(({ data }) => setDepartments(data ?? []))
  }, [])

  const handleEmployeeUpload = async () => {
    if (!empFile) return
    setLoading(true)
    setResult(null)
    const form = new FormData()
    form.append('file', empFile)
    try {
      const res = await fetch('/api/employees/upload', { method: 'POST', body: form })
      const json = await res.json()
      setResult(json.data)
      if (json.data?.success) {
        toast.success(`${json.data.inserted} employees imported`)
        setStep('workbook')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const steps: { id: Step; label: string; icon: React.ElementType }[] = [
    { id: 'employees', label: 'Employee Master', icon: Users },
    { id: 'workbook',  label: 'Salary Workbook', icon: BookOpen },
  ]

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload Data</h1>
        <p className="mt-1 text-sm text-slate-500">
          Import employee records and salary workbooks to generate tax summaries
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              onClick={() => setStep(s.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                step === s.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              )}
            >
              <span className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
                step === s.id ? 'bg-white/20' : 'bg-slate-100'
              )}>{i + 1}</span>
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
          </div>
        ))}
      </div>

      {/* Step 1: Employee Master */}
      {step === 'employees' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Employee Master</h2>
                <p className="text-sm text-slate-500">Upload employee roster with department assignments</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Required columns</p>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {[
                  ['employee_id', 'Unique payroll ID'],
                  ['name', 'Full name'],
                  ['email', 'Work email address'],
                  ['department', 'Department name'],
                ].map(([col, desc]) => (
                  <div key={col} className="flex gap-2">
                    <code className="text-xs font-mono text-blue-600">{col}</code>
                    <span className="text-xs text-slate-400">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <UploadZone
              label="Drop your employee CSV or Excel file here"
              accept=".csv,.xlsx,.xls"
              onFile={setEmpFile}
              disabled={loading}
            />

            <Button
              onClick={handleEmployeeUpload}
              disabled={!empFile || loading}
              className="w-full bg-blue-600 text-white hover:bg-blue-500"
            >
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</> : 'Import Employees'}
            </Button>
          </div>
          <UploadResultCard result={result} />
        </div>
      )}

      {/* Step 2: Salary Workbook */}
      {step === 'workbook' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <WorkbookUpload departments={departments} year={parseInt(year)} />
        </div>
      )}
    </div>
  )
}

function UploadResultCard({ result }: { result: UploadResult | null }) {
  if (!result) return null

  return (
    <div className={cn(
      'rounded-2xl p-5 shadow-sm ring-1 space-y-3',
      result.success ? 'bg-emerald-50 ring-emerald-200' : 'bg-red-50 ring-red-200'
    )}>
      <div className="flex items-center gap-2">
        {result.success
          ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          : <AlertCircle className="h-5 w-5 text-red-500" />}
        <p className={cn('font-semibold text-sm', result.success ? 'text-emerald-800' : 'text-red-700')}>
          {result.success
            ? `${result.inserted} records imported${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`
            : 'Upload failed — fix the errors below and re-upload'}
        </p>
      </div>

      {result.errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-white overflow-hidden">
          <div className="grid grid-cols-[auto,1fr,1fr] text-xs">
            <div className="bg-red-50 px-3 py-2 font-semibold text-red-700">Row</div>
            <div className="bg-red-50 px-3 py-2 font-semibold text-red-700">Field</div>
            <div className="bg-red-50 px-3 py-2 font-semibold text-red-700">Error</div>
            {result.errors.slice(0, 10).map((err, i) => (
              <React.Fragment key={i}>
                <div className="border-t border-red-100 px-3 py-1.5 text-slate-500">{err.row || '—'}</div>
                <div className="border-t border-red-100 px-3 py-1.5"><code className="text-red-600">{err.field}</code></div>
                <div className="border-t border-red-100 px-3 py-1.5 text-slate-600">{err.message}</div>
              </React.Fragment>
            ))}
          </div>
          {result.errors.length > 10 && (
            <p className="px-3 py-2 text-xs text-red-400 border-t border-red-100">…and {result.errors.length - 10} more errors</p>
          )}
        </div>
      )}
    </div>
  )
}
