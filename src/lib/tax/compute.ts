import type { MonthlyRecord } from '@/types'

export type TaxComputation = {
  total_basic: number
  total_allowance: number
  total_ssnit: number
  chargeable_income: number
  total_tax: number
}

/**
 * Compute annual tax summary from 12 monthly records.
 * Always run server-side — never trust client-submitted figures.
 */
export function computeTaxSummary(records: MonthlyRecord[]): TaxComputation {
  const total_basic = records.reduce((sum, r) => sum + Number(r.basic), 0)
  const total_allowance = records.reduce((sum, r) => sum + Number(r.allowance), 0)
  const total_ssnit = records.reduce((sum, r) => sum + Number(r.ssnit), 0)
  const total_tax = records.reduce((sum, r) => sum + Number(r.tax), 0)
  const chargeable_income = total_basic + total_allowance - total_ssnit

  return {
    total_basic: round2(total_basic),
    total_allowance: round2(total_allowance),
    total_ssnit: round2(total_ssnit),
    chargeable_income: round2(chargeable_income),
    total_tax: round2(total_tax),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(amount)
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function generateMagicToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

export function getTokenExpiry(): Date {
  const days = parseInt(process.env.MAGIC_LINK_EXPIRY_DAYS ?? '14', 10)
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + days)
  return expiry
}
