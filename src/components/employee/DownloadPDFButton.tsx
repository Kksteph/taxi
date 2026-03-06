'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Props = {
  token: string
  year: number
  employeeName: string
}

export function DownloadPDFButton({ token, year, employeeName }: Props) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/pdf/${token}`)
      if (!res.ok) {
        const contentType = res.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
          const json = await res.json()
          throw new Error(json.error ?? `HTTP ${res.status}`)
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${year}_tax_summary_${employeeName.replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF not available. Contact your finance team.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleDownload}
      disabled={loading}
      className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-500 shadow-sm"
      size="lg"
    >
      {loading ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Preparing PDF…</>
      ) : (
        <><Download className="h-4 w-4" /> Download Tax Summary PDF</>
      )}
    </Button>
  )
}
