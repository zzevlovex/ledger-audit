/** Download rows as CSV. Values are quoted; formulas are neutralised so Excel won't execute them. */
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    let s = String(v)
    if (/^[=+\-@]/.test(s) && !/^-?\d/.test(s)) s = "'" + s
    return `"${s.replace(/"/g, '""')}"`
  }
  const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
