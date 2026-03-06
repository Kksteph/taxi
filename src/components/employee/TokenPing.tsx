'use client'

import { useEffect } from 'react'

export function TokenPing({ token }: { token: string }) {
  useEffect(() => {
    fetch(`/api/token/${token}`, { method: 'POST' }).catch(() => {})
  }, [token])
  return null
}
