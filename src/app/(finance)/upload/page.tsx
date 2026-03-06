'use client'

import React, { useState, useEffect } from 'react'
import { UploadZone } from '@/components/shared/UploadZone'
import { WorkbookUpload } from '@/components/finance/WorkbookUpload'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CheckCircle2, AlertCircle, Loader2, Users, FileSpreadsheet, Info, RotateCcw } from 'lucide-react'
import type { UploadResult } from '@/types'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Department = { id: string; name: string }

export default function UploadPage() {
  const [empFile, setEmpFile] = useState<File | null>(null)
  const [year] = useState(new Date().getFullYear().toString())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

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
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    setResetting(true)
    try {
      const res = await fetch('/api/reset', { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Reset failed')
      toast.success('All data cleared — ready for a fresh test')
      setResult(null)
      setEmpFile(null)
      setConfirmReset(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* ── Banner ── */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-8 py-10">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Upload your data files below</h1>
        <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
          Start with <span className="font-medium text-slate-700">Employee Master</span> to register your staff,
          then upload the <span className="font-medium text-slate-700">Salary Workbook</span> with monthly records.
          Both are required before you can generate and send tax summaries.
        </p>
      </div>

      {/* ── Side-by-side sections ── */}
      <div className="grid grid-cols-2 gap-6 items-start">

        {/* ── Left: Employee Master ── */}
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
            <div className="grid grid-cols-1 gap-y-1.5">
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

          <UploadResultCard result={result} />
        </div>

        {/* ── Right: Salary Workbook ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <WorkbookUpload departments={departments} year={parseInt(year)} />
        </div>

      </div>

      {/* ── Divider ── */}
      <div className="border-t border-slate-200" />

      {/* ── Reset (testing only) ── */}
      <div className="rounded-2xl border border-red-100 bg-red-50/50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-red-400" />
          <p className="text-sm font-semibold text-red-700">Reset Test Data</p>
        </div>
        <p className="text-xs text-red-500/80">
          Clears all employees, monthly records, tax summaries, and receipts from the database.
          Use this to reset between test runs.
        </p>
        {confirmReset ? (
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold text-red-700">Are you sure? This cannot be undone.</p>
            <Button
              size="sm"
              variant="destructive"
              className="text-xs h-7 px-3"
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Clearing…</> : 'Yes, clear all'}
            </Button>
            <button
              className="text-xs text-slate-500 hover:text-slate-700 underline"
              onClick={() => setConfirmReset(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-3 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
            onClick={handleReset}
          >
            <RotateCcw className="h-3 w-3 mr-1.5" />
            Reset all data
          </Button>
        )}
      </div>
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
