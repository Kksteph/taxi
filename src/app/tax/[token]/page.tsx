import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { SummaryCards } from '@/components/employee/SummaryCards'
import { MonthlyBreakdown } from '@/components/employee/MonthlyBreakdown'
import { ReceiptUpload } from '@/components/employee/ReceiptUpload'
import { DownloadPDFButton } from '@/components/employee/DownloadPDFButton'
import { TokenPing } from '@/components/employee/TokenPing'
import { FileText, Clock, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Employee, MonthlyRecord, Receipt, TaxSummary } from '@/types'

export default async function EmployeeTaxPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createServiceClient()

  // Look up summary by magic token
  const { data: summary, error } = await supabase
    .from('tax_summaries')
    .select('*')
    .eq('magic_token', token)
    .single()

  if (error || !summary) notFound()

  // Check expiry
  const expired = summary.token_expires_at
    ? new Date(summary.token_expires_at) < new Date()
    : false

  if (expired) {
    return <ExpiredPage />
  }

  // Fetch employee
  const { data: employee } = await supabase
    .from('employees')
    .select('*, department:departments(id, name)')
    .eq('id', summary.employee_id)
    .single()

  if (!employee) notFound()

  // Fetch monthly records
  const { data: records } = await supabase
    .from('monthly_records')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('year', summary.year)
    .order('month', { ascending: true })

  // Fetch latest receipt (not replaced)
  const { data: receipt } = await supabase
    .from('receipts')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('year', summary.year)
    .is('replaced_at', null)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const emp = employee as Employee
  const sum = summary as TaxSummary
  const recs = (records ?? []) as MonthlyRecord[]
  const rec = receipt as Receipt | null

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Track view — ping API silently */}
      <TokenPing token={token} />

      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900">Tax Filing Portal</span>
          </div>
          <div className="flex items-center gap-2">
            {sum.status === 'submitted' ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Receipt Submitted
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                <Clock className="h-3.5 w-3.5" />
                Awaiting Receipt
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12 space-y-8">
        {/* Welcome */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-blue-600">
            {sum.year} Annual Tax Summary
          </p>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Hello, {emp.name.split(' ')[0]}
          </h1>
          <p className="text-slate-500 text-sm">
            Your tax summary is ready. Review the figures below, download your PDF,
            and upload your tax receipt to complete submission.
          </p>
        </div>

        {/* Section 1: Summary cards */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Annual Summary
          </h2>
          <SummaryCards summary={sum} />
        </section>

        {/* Formula callout */}
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 px-5 py-4 ring-1 ring-blue-100">
          <div className="mt-0.5 text-blue-400">ƒ</div>
          <p className="text-sm text-blue-700">
            <strong>Chargeable Income</strong> = Basic Salary + Cash Allowance − Social Security (SSNIT)
          </p>
        </div>

        {/* Section 2: Monthly breakdown */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Monthly Breakdown
          </h2>
          {recs.length > 0 ? (
            <MonthlyBreakdown records={recs} />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-400">
              Monthly records not available
            </div>
          )}
        </section>

        {/* Section 3 + 4: PDF + Receipt side by side on large screens */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Section 3: PDF download */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Download PDF
            </h2>
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {sum.year} Tax Summary PDF
                  </p>
                  <p className="text-xs text-slate-500">
                    Official document for tax authority submission
                  </p>
                </div>
              </div>
              <DownloadPDFButton token={token} year={sum.year} employeeName={emp.name} />
            </div>
          </section>

          {/* Section 4: Receipt upload */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Submit Receipt
            </h2>
            <ReceiptUpload token={token} year={sum.year} existingReceipt={rec} />
          </section>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 pb-4">
          {emp.name} · {emp.employee_id} · {sum.year} Tax Year
          {sum.token_expires_at && (
            <> · Link expires {new Date(sum.token_expires_at).toLocaleDateString('en-GH', { dateStyle: 'long' })}</>
          )}
        </p>
      </main>
    </div>
  )
}

function ExpiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-sm text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
          <AlertTriangle className="h-7 w-7 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Link Expired</h1>
        <p className="text-sm text-slate-500">
          This secure link has expired. Please contact your finance team to
          request a new link.
        </p>
      </div>
    </div>
  )
}
