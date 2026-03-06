import { NextRequest, NextResponse } from 'next/server'
import { generateTemplateWorkbook, generateSampleWorkbook } from '@/lib/excel/template'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year   = parseInt(searchParams.get('year') ?? new Date().getFullYear().toString(), 10)
  const sample = searchParams.get('sample') === 'true'

  const buffer = sample
    ? await generateSampleWorkbook(year)
    : await generateTemplateWorkbook(year)

  const filename = sample
    ? `Sample_Department_Workbook_${year}.xlsx`
    : `Salary_Template_${year}.xlsx`

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
