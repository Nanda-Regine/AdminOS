// SARS PAYE. Tables are keyed by tax year (1 March – end February) and chosen
// from the pay period, so a back-dated run uses the tables that applied then.
// Add a new TAX_TABLES entry every Budget (February). No imports: tests load
// this file directly.

export interface PayrollInput {
  grossMonthly: number      // basic + allowances + bonuses
  medicalAidMonthlyPremium?: number
  pensionContributionPct?:   number  // percentage of gross, e.g. 7.5
  otherDeductions?: { label: string; amount: number }[]
  isDirector?: boolean
  ageYears?: number
  annualPayroll?: number    // for SDL threshold check — total company payroll
  /** Pay period — selects the tax year's tables. Defaults to today. */
  periodMonth?: number
  periodYear?: number
}

export interface PayrollResult {
  grossSalary:       number
  paye:              number
  uifEmployee:       number
  uifEmployer:       number
  sdl:               number
  medicalAidCredit:  number
  pensionDeduction:  number
  otherDeductions:   number
  netPay:            number
  effectiveTaxRate:  number
  components: {
    label:     string
    amount:    number
    type:      'earning' | 'deduction' | 'employer_cost'
  }[]
}

export interface TaxTable {
  /** Annual taxable income: `over` is the bracket floor, tax = base + rate × (income − over). */
  brackets: { over: number; rate: number; base: number }[]
  primary: number
  secondary: number   // age 65–74 (cumulative with primary)
  tertiary: number    // age 75+
  medicalMain: number // per month, main member and first dependant
  medicalAdditional: number
}

/** Keyed by the calendar year the tax year ENDS in: 2027 = 1 Mar 2026 – 28 Feb 2027. */
export const TAX_TABLES: Record<number, TaxTable> = {
  2026: {
    brackets: [
      { over:         0, rate: 0.18, base:       0 },
      { over:   237_100, rate: 0.26, base:  42_678 },
      { over:   370_500, rate: 0.31, base:  77_362 },
      { over:   512_800, rate: 0.36, base: 121_475 },
      { over:   673_000, rate: 0.39, base: 179_147 },
      { over:   857_900, rate: 0.41, base: 251_258 },
      { over: 1_817_000, rate: 0.45, base: 644_489 },
    ],
    primary: 17_235, secondary: 9_444, tertiary: 3_145,
    medicalMain: 364, medicalAdditional: 246,
  },
  // 2026 Budget: brackets, rebates and credits raised 3.4% for inflation —
  // the first adjustment since 2023/24.
  2027: {
    brackets: [
      { over:         0, rate: 0.18, base:       0 },
      { over:   245_100, rate: 0.26, base:  44_118 },
      { over:   383_100, rate: 0.31, base:  79_998 },
      { over:   530_200, rate: 0.36, base: 125_599 },
      { over:   695_800, rate: 0.39, base: 185_215 },
      { over:   887_000, rate: 0.41, base: 259_783 },
      { over: 1_878_600, rate: 0.45, base: 666_339 },
    ],
    primary: 17_820, secondary: 9_765, tertiary: 3_249,
    medicalMain: 376, medicalAdditional: 254,
  },
}

/** Tax year (by its end year) for a pay period: March onwards belongs to the next year's label. */
export function taxYearFor(periodMonth: number, periodYear: number): number {
  return periodMonth >= 3 ? periodYear + 1 : periodYear
}

/** The table for a period; falls back to the latest known year (and never silently to an older one). */
export function taxTableFor(periodMonth: number, periodYear: number): { year: number; table: TaxTable } {
  const want = taxYearFor(periodMonth, periodYear)
  const years = Object.keys(TAX_TABLES).map(Number).sort((a, b) => a - b)
  const year = TAX_TABLES[want] ? want : want > years[years.length - 1] ? years[years.length - 1] : years[0]
  return { year, table: TAX_TABLES[year] }
}

const UIF_CAP_MONTHLY   = 17_712    // UIF ceiling on monthly remuneration
const UIF_RATE          = 0.01      // 1% each party

const SDL_THRESHOLD_ANNUAL = 500_000
const SDL_RATE             = 0.01

export function calculateAnnualPAYE(annualTaxable: number, age: number, table: TaxTable): number {
  if (annualTaxable <= 0) return 0
  // Highest bracket whose floor the income exceeds. The old loop measured from
  // `from` = floor + 1 (e.g. 237,101), under-taxing every bracket by R1 × rate.
  let b = table.brackets[0]
  for (const br of table.brackets) if (annualTaxable > br.over) b = br
  let tax = b.base + (annualTaxable - b.over) * b.rate

  tax -= table.primary
  if (age >= 65) tax -= table.secondary
  if (age >= 75) tax -= table.tertiary

  return Math.max(0, tax)
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const {
    grossMonthly,
    medicalAidMonthlyPremium = 0,
    pensionContributionPct = 0,
    otherDeductions: extraDeductions = [],
    ageYears = 30,
    annualPayroll = 0,
  } = input
  const now = new Date()
  const { table } = taxTableFor(input.periodMonth ?? now.getMonth() + 1, input.periodYear ?? now.getFullYear())

  const components: PayrollResult['components'] = []

  components.push({ label: 'Basic Salary', amount: grossMonthly, type: 'earning' })

  // Pension / retirement fund deduction (capped at 27.5% of taxable income or R350k/yr)
  const pensionMonthly = Math.min(
    (grossMonthly * pensionContributionPct) / 100,
    350_000 / 12  // annual cap / 12
  )
  if (pensionMonthly > 0) {
    components.push({ label: 'Pension Fund', amount: -pensionMonthly, type: 'deduction' })
  }

  // Taxable income after pension deduction
  const monthlyTaxable  = grossMonthly - pensionMonthly
  const annualTaxable   = monthlyTaxable * 12

  // PAYE
  const annualPAYE  = calculateAnnualPAYE(annualTaxable, ageYears, table)
  let   monthlyPAYE = annualPAYE / 12

  // Medical aid credits reduce PAYE (main member only — no dependant data here)
  const medicalCredit = medicalAidMonthlyPremium > 0 ? table.medicalMain : 0
  monthlyPAYE = Math.max(0, monthlyPAYE - medicalCredit)

  if (monthlyPAYE > 0) {
    components.push({ label: 'PAYE', amount: -monthlyPAYE, type: 'deduction' })
  }

  // UIF employee contribution
  const uifBase     = Math.min(grossMonthly, UIF_CAP_MONTHLY)
  const uifEmployee = uifBase * UIF_RATE
  const uifEmployer = uifBase * UIF_RATE

  components.push({ label: 'UIF (Employee)', amount: -uifEmployee, type: 'deduction' })
  components.push({ label: 'UIF (Employer)', amount: -uifEmployer, type: 'employer_cost' })

  // SDL — only if annual payroll exceeds R500k
  const sdl = (annualPayroll > SDL_THRESHOLD_ANNUAL)
    ? grossMonthly * SDL_RATE
    : 0

  if (sdl > 0) {
    components.push({ label: 'SDL (Employer)', amount: -sdl, type: 'employer_cost' })
  }

  // Medical aid deduction (employee portion — not a benefit deduction for PAYE purposes above)
  if (medicalAidMonthlyPremium > 0) {
    components.push({ label: 'Medical Aid', amount: -medicalAidMonthlyPremium, type: 'deduction' })
  }

  // Other deductions
  let otherTotal = 0
  for (const d of extraDeductions) {
    components.push({ label: d.label, amount: -d.amount, type: 'deduction' })
    otherTotal += d.amount
  }

  const totalDeductions = monthlyPAYE + uifEmployee + pensionMonthly + medicalAidMonthlyPremium + otherTotal
  const netPay          = grossMonthly - totalDeductions

  return {
    grossSalary:      round2(grossMonthly),
    paye:             round2(monthlyPAYE),
    uifEmployee:      round2(uifEmployee),
    uifEmployer:      round2(uifEmployer),
    sdl:              round2(sdl),
    medicalAidCredit: round2(medicalCredit),
    pensionDeduction: round2(pensionMonthly),
    otherDeductions:  round2(otherTotal),
    netPay:           round2(netPay),
    effectiveTaxRate: grossMonthly > 0 ? round2((monthlyPAYE / grossMonthly) * 100) : 0,
    components,
  }
}

// Generate EMP201 data for SARS submission
export interface EMP201Data {
  periodMonth:     number
  periodYear:      number
  totalPAYE:       number
  totalUIF:        number   // employee + employer combined
  totalSDL:        number
  totalETI:        number   // Employment Tax Incentive (if applicable)
  totalLiability:  number
  employeeCount:   number
}

/** EMP201 input from either calculatePayroll results or payslips rows (snake_case). */
export type EMP201Input =
  | { paye: number; uifEmployee: number; uifEmployer: number; sdl: number }
  | { paye: number | string | null; uif_employee: number | string | null; uif_employer: number | string | null; sdl: number | string | null }

function emp201Row(p: EMP201Input) {
  // The EMP201 route regenerated from payslips ROWS (uif_employee) through a
  // function reading uifEmployee — so UIF and total liability came out NaN.
  if ('uifEmployee' in p) return p
  return {
    paye: Number(p.paye ?? 0),
    uifEmployee: Number(p.uif_employee ?? 0),
    uifEmployer: Number(p.uif_employer ?? 0),
    sdl: Number(p.sdl ?? 0),
  }
}

export function generateEMP201(
  input: EMP201Input[],
  periodMonth: number,
  periodYear: number
): EMP201Data {
  const payslips = input.map(emp201Row)
  const totalPAYE       = payslips.reduce((s, p) => s + p.paye, 0)
  const totalUIF        = payslips.reduce((s, p) => s + p.uifEmployee + p.uifEmployer, 0)
  const totalSDL        = payslips.reduce((s, p) => s + p.sdl, 0)
  const totalLiability  = totalPAYE + totalUIF + totalSDL

  return {
    periodMonth,
    periodYear,
    totalPAYE:      round2(totalPAYE),
    totalUIF:       round2(totalUIF),
    totalSDL:       round2(totalSDL),
    totalETI:       0,
    totalLiability: round2(totalLiability),
    employeeCount:  payslips.length,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
