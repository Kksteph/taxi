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
      if (!res.ok) throw new Error('PDF not available')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${year}_tax_summary_${employeeName.replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch {
      toast.error('PDF not available. Contact your finance team.')
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
