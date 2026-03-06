import Link from 'next/link'
import { FileSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-sm space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <FileSearch className="h-7 w-7 text-slate-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Page not found</h1>
        <p className="text-sm text-slate-500">
          The page you're looking for doesn't exist or the link may have expired.
        </p>
        <Link href="/login">
          <Button className="mt-2 bg-blue-600 text-white hover:bg-blue-500">
            Back to login
          </Button>
        </Link>
      </div>
    </div>
  )
}
