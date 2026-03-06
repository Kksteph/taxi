'use client'

import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { Upload, File, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type UploadZoneProps = {
  accept?: string
  label: string
  description?: string
  onFile: (file: File) => void
  disabled?: boolean
  maxSizeMB?: number
}

export function UploadZone({
  accept = '.csv,.xlsx,.xls',
  label,
  description,
  onFile,
  disabled = false,
  maxSizeMB = 10,
}: UploadZoneProps) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    const allowed = accept.split(',').map(a => a.replace('.', '').toLowerCase())
    if (!allowed.includes(ext)) {
      setError(`Invalid file type. Accepted: ${accept}`)
      return
    }
    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large. Max ${maxSizeMB}MB.`)
      return
    }
    setError(null)
    setFile(f)
    onFile(f)
  }, [accept, maxSizeMB, onFile])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  return (
    <div className="space-y-2">
      <label
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer',
          dragging
            ? 'border-blue-400 bg-blue-50/60'
            : 'border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-50',
          disabled && 'pointer-events-none opacity-50'
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={onInputChange}
          disabled={disabled}
        />
        {file ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              type="button"
              onClick={e => { e.preventDefault(); setFile(null); setError(null) }}
              className="ml-2 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-full bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <Upload className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">{label}</p>
              {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
              <p className="mt-2 text-xs text-slate-400">
                Drag & drop or click to browse · {accept} · Max {maxSizeMB}MB
              </p>
            </div>
          </div>
        )}
      </label>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
