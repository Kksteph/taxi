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

  const handleDownload = () => {
    setLoading(true)
    // Direct navigation — browser handles the download natively.
    // Works for both proxied PDF bytes and signed URL redirects.
    window.location.href = `/api/pdf/${token}`
    // Reset loading after a short delay (download starts in background)
    setTimeout(() => setLoading(false), 3000)
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
