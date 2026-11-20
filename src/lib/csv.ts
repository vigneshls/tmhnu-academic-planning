/** Escape a cell; prefix formula-like values to prevent CSV injection in Excel */
function cell(v: unknown): string {
  let s = String(v ?? '')
  if (/^[=+\-@]/.test(s)) s = "'" + s
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const text = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
