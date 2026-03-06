'use client'

import { useState, useCallback } from 'react'
import { Upload, CheckCircle2, AlertCircle, RefreshCw, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

type ReceiptUploadProps = {
  token: string
  year: number
  existingReceipt?: {
    file_name: string | null
    submitted_at: string
  } | null
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export function ReceiptUpload({ token, year, existingReceipt }: ReceiptUploadProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [uploadedAt, setUploadedAt] = useState<string | null>(
    existingReceipt?.submitted_at ?? null
  )
  const [uploadedName, setUploadedName] = useState<string | null>(
    existingReceipt?.file_name ?? null
  )
  const [dragActive, setDragActive] = useState(false)

  const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png']
  const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png']

  const handleUpload = useCallback(async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      setError('Invalid file. Accepted: PDF, JPG, PNG.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum 10MB.')
      return
    }

    setState('uploading')
    setError(null)

    const form = new FormData()
    form.append('file', file)
    form.append('token', token)
    form.append('year', year.toString())

    try {
      const res = await fetch('/api/receipts', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Upload failed')

      setUploadedAt(new Date().toISOString())
      setUploadedName(file.name)
      setState('success')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.')
      setState('error')
    }
  }, [token, year])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) handleUpload(f)
  }

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleUpload(f)
  }

  const isSuccess = state === 'success' || (state === 'idle' && !!uploadedAt && !existingReceipt?.submitted_at)
  const hasExisting = !!uploadedAt

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Upload Tax Receipt</h2>
        <p className="text-sm text-slate-500">
          Upload your tax payment receipt to confirm submission
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Existing receipt notice */}
        {hasExisting && (
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Receipt submitted</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {uploadedName && <><FileText className="inline h-3 w-3 mr-1" />{uploadedName} · </>}
                {uploadedAt && formatDistanceToNow(new Date(uploadedAt), { addSuffix: true })}
              </p>
              <p className="mt-1.5 text-xs text-emerald-600 italic">
                You can upload a new file below to replace this receipt.
              </p>
            </div>
          </div>
        )}

        {/* Upload zone */}
        <label
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-all cursor-pointer',
            dragActive
              ? 'border-blue-400 bg-blue-50/60'
              : 'border-slate-200 bg-slate-50/30 hover:border-slate-300 hover:bg-slate-50',
            state === 'uploading' && 'pointer-events-none opacity-70'
          )}
          onDragOver={e => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept={ALLOWED_EXT.join(',')}
            className="sr-only"
            onChange={onInput}
            disabled={state === 'uploading'}
          />
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-white p-4 shadow-sm ring-1 ring-slate-200">
              {state === 'uploading' ? (
                <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
              ) : (
                <Upload className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                {state === 'uploading'
                  ? 'Uploading…'
                  : hasExisting
                  ? 'Replace receipt'
                  : 'Upload your receipt'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                PDF, JPG or PNG · Max 10MB · Drag & drop or click to browse
              </p>
            </div>
          </div>
        </label>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
