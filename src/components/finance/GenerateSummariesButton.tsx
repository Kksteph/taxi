'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Zap, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export function GenerateSummariesButton({ year }: { year: number }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    generated: number; skipped: number; errors: string[]
  } | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/tax-summaries/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, send_email: true }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error)

      setResult(json.data)
      if (json.data.generated > 0) {
        toast.success(`${json.data.generated} tax summaries generated and emails sent`)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 bg-blue-600 text-white hover:bg-blue-500 shadow-sm"
      >
        <Zap className="h-4 w-4" />
        Generate Summaries
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Tax Summaries — {year}</DialogTitle>
            <DialogDescription>
              This will compute tax summaries for all employees with complete payroll data,
              generate PDFs, and send email notifications.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {!result ? (
              <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
                <p className="font-semibold">Before you proceed:</p>
                <ul className="mt-2 list-disc pl-4 space-y-1 text-amber-700">
                  <li>All 12 months of payroll data must be uploaded for each employee</li>
                  <li>Employees without complete data will be skipped</li>
                  <li>Existing summaries will be regenerated with fresh calculations</li>
                  <li>Emails will be dispatched immediately</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="font-semibold text-emerald-800">{result.generated} summaries generated</p>
                    {result.skipped > 0 && (
                      <p className="text-sm text-emerald-600">{result.skipped} skipped (incomplete data)</p>
                    )}
                  </div>
                </div>
                {result.errors.length > 0 && (
                  <div className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <p className="text-sm font-semibold text-red-700">Some issues occurred:</p>
                    </div>
                    <ul className="space-y-1">
                      {result.errors.slice(0, 5).map((e, i) => (
                        <li key={i} className="text-xs text-red-600">{e}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li className="text-xs text-red-400">…and {result.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setOpen(false); setResult(null) }}>
                {result ? 'Close' : 'Cancel'}
              </Button>
              {!result && (
                <Button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="gap-2 bg-blue-600 text-white hover:bg-blue-500"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                  ) : (
                    <><Zap className="h-4 w-4" /> Generate & Send</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
