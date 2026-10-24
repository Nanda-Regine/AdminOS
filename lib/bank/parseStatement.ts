/**
 * Bank statement CSV parser for South African banks (FNB, Capitec, ABSA,
 * Standard Bank, Nedbank, TymeBank, Bidvest). Pure — no imports — so tests load
 * it directly.
 *
 * Banks disagree on everything: preamble lines before the header, comma /
 * semicolon / tab separators, one signed Amount column versus separate
 * Debit/Credit columns, "1 234,56" versus "1,234.56", "05/10/2026" versus
 * "2026-10-05" versus "05 Oct 2026". This reads the header row to find the
 * columns, then normalises every row to { date, description, amount, balance }
 * where amount is signed: money in is positive, money out is negative.
 *
 * Rows it cannot understand are counted in `skipped` rather than guessed at —
 * a wrong amount is worse than a missing line the owner can see is missing.
 */

export interface ParsedBankRow {
  /** SAST calendar date, YYYY-MM-DD. */
  date: string
  description: string
  /** Signed: positive = money in, negative = money out. Rands, 2 dp. */
  amount: number
  balance: number | null
}

export interface ParseResult {
  rows: ParsedBankRow[]
  /** Data lines that had a date but no usable amount/description. */
  skipped: number
  /** Non-fatal notes for the user, e.g. an ambiguous date format. */
  warnings: string[]
  /** Set when no header row could be found at all. */
  error: string | null
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

/** Split one CSV line honouring double quotes and "" escapes. */
export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else quoted = false
      } else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

function validYmd(y: number, m: number, d: number): boolean {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1) return false
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return d <= dim
}

const pad = (n: number | string) => String(n).padStart(2, '0')

/** Any date format SA banks export → YYYY-MM-DD, or null. Day-first is assumed for slashes/dashes. */
export function parseBankDate(raw: string): string | null {
  const s = raw.replace(/["']/g, '').trim()
  if (!s) return null
  let y: number, m: number, d: number
  let mt: RegExpMatchArray | null

  if ((mt = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) { y = +mt[1]; m = +mt[2]; d = +mt[3] }
  else if ((mt = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) { d = +mt[1]; m = +mt[2]; y = +mt[3] }
  else if ((mt = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/))) {
    const mm = MONTHS[mt[2].toLowerCase().slice(0, 3)]
    if (!mm) return null
    d = +mt[1]; m = +mm; y = +mt[3]
  } else if ((mt = s.match(/^(\d{4})(\d{2})(\d{2})$/))) { y = +mt[1]; m = +mt[2]; d = +mt[3] }
  else return null

  return validYmd(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null
}

/**
 * "R 1 234,56", "-1,234.56", "(250.00)", "1234.56Cr", "250.00 Dr", "−12.50" → number.
 * Returns null when there is no number at all (blank cell), so callers can tell
 * "empty" from "zero".
 */
export function parseBankAmount(raw: string): number | null {
  let s = raw.replace(/ | /g, ' ').replace(/[Rr]\s*(?=[\d(-])/g, '').replace(/[−–]/g, '-').trim()
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  const suffix = s.match(/\s*(cr|dr)\.?$/i)
  if (suffix) { if (suffix[1].toLowerCase() === 'dr') negative = !negative; s = s.slice(0, suffix.index) }
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1) }
  else if (s.startsWith('+')) s = s.slice(1)
  s = s.replace(/\s+/g, '')
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let normalised: string
  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: whichever comes last is the decimal mark.
    normalised = lastDot > lastComma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.')
  } else if (lastComma !== -1) {
    // Comma only: a decimal if followed by 1–2 digits at the end ("1234,56"), else thousands ("1,234").
    normalised = /,\d{1,2}$/.test(s) && s.indexOf(',') === lastComma ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (lastDot !== -1 && s.indexOf('.') !== lastDot) {
    normalised = s.replace(/\./g, '') // "1.234.567" — dots as thousands
  } else normalised = s

  const n = Number(normalised)
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n * 100) / 100
  return negative ? -rounded : rounded
}

function detectSeparator(headerLine: string): string {
  const counts = { ',': 0, ';': 0, '\t': 0 }
  let quoted = false
  for (const ch of headerLine) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && ch in counts) counts[ch as keyof typeof counts]++
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as string
}

const HEADER_DATE = /\bdate\b/i
const HEADER_MONEY = /amount|debit|credit|deposit|withdrawal|money (in|out)/i

export function parseBankStatement(text: string): ParseResult {
  const warnings: string[] = []
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())

  const headerIdx = lines.findIndex((l) => HEADER_DATE.test(l) && HEADER_MONEY.test(l))
  if (headerIdx === -1) {
    return { rows: [], skipped: 0, warnings, error: 'We could not find the column headings (Date, Description, Amount). Export the statement as CSV from your bank and try again.' }
  }

  const sep = detectSeparator(lines[headerIdx])
  const headers = splitCsvLine(lines[headerIdx], sep).map((h) => h.toLowerCase())
  const find = (re: RegExp) => headers.findIndex((h) => re.test(h))

  const col = {
    date: find(/^(transaction\s+|posting\s+|value\s+)?date$/) !== -1 ? find(/^(transaction\s+|posting\s+|value\s+)?date$/) : find(/\bdate\b/),
    amount: find(/^(transaction\s+)?amount( \(zar\))?$/),
    description: find(/description|narration|reference|details|particulars|transaction$/),
    credit: find(/^(credit(\s+amount)?|deposits?|money in)$/),
    debit: find(/^(debit(\s+amount)?|withdrawals?|money out)$/),
    balance: find(/balance/),
  }
  if (col.date === -1 || (col.amount === -1 && col.credit === -1 && col.debit === -1)) {
    return { rows: [], skipped: 0, warnings, error: 'The statement has no Date or Amount column we recognise.' }
  }

  const rows: ParsedBankRow[] = []
  let skipped = 0
  let slashDates = 0
  let ambiguous = 0

  for (const line of lines.slice(headerIdx + 1)) {
    const cells = splitCsvLine(line, sep)
    if (cells.length < 3) continue
    const date = parseBankDate(cells[col.date] ?? '')
    if (!date) continue // totals, footers and blank rows have no date — not an error

    let amount: number | null = null
    if (col.amount !== -1) amount = parseBankAmount(cells[col.amount] ?? '')
    else {
      const cr = col.credit !== -1 ? parseBankAmount(cells[col.credit] ?? '') : null
      const dr = col.debit !== -1 ? parseBankAmount(cells[col.debit] ?? '') : null
      if (cr && cr !== 0) amount = Math.abs(cr)
      else if (dr && dr !== 0) amount = -Math.abs(dr)
    }

    const description = (col.description !== -1 ? cells[col.description] ?? '' : '').replace(/\s+/g, ' ').trim()
    if (amount === null || amount === 0 || !description) { skipped++; continue }

    const rawDate = (cells[col.date] ?? '').trim()
    if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(rawDate)) {
      slashDates++
      const [a, b] = rawDate.split(/[-/.]/).map(Number)
      if (a <= 12 && b <= 12 && a !== b) ambiguous++
    }

    rows.push({
      date,
      description,
      amount,
      balance: col.balance !== -1 ? parseBankAmount(cells[col.balance] ?? '') : null,
    })
  }

  if (slashDates > 0 && ambiguous === slashDates) {
    warnings.push('Dates were read as day/month/year. Check the first few lines match your statement.')
  }
  if (rows.length === 0 && !warnings.length) {
    return { rows, skipped, warnings, error: 'No transactions were found in that file.' }
  }
  return { rows, skipped, warnings, error: null }
}
