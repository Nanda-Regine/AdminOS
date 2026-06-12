// SARS 2025/26 tax year (1 March 2025 – 28 February 2026)

export interface PayrollInput {
  grossMonthly: number      // basic + allowances + bonuses
  medicalAidMonthlyPremium?: number
  pensionContributionPct?:   number  // percentage of gross, e.g. 7.5
  otherDeductions?: { label: string; amount: number }[]
  isDirector?: boolean
  ageYears?: number
  annualPayroll?: number    // for SDL threshold check — total company payroll
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

// 2025/26 SARS income tax brackets (annual)
const TAX_BRACKETS = [
  { from:       0, to:   237_100, rate: 0.18, base:       0 },
  { from: 237_101, to:   370_500, rate: 0.26, base:  42_678 },
  { from: 370_501, to:   512_800, rate: 0.31, base:  77_362 },
  { from: 512_801, to:   673_000, rate: 0.36, base: 121_475 },
  { from: 673_001, to:   857_900, rate: 0.39, base: 179_147 },
  { from: 857_901, to: 1_817_000, rate: 0.41, base: 251_258 },
  { from: 1_817_001, to: Infinity, rate: 0.45, base: 644_489 },
]

const PRIMARY_REBATE    = 17_235    // 2025/26
const SECONDARY_REBATE  =  9_444    // age 65–74
const TERTIARY_REBATE   =  3_145    // age 75+

const UIF_CAP_MONTHLY   = 17_712    // UIF ceiling on monthly remuneration
const UIF_RATE          = 0.01      // 1% each party

const SDL_THRESHOLD_ANNUAL = 500_000
const SDL_RATE             = 0.01

// Medical tax credits 2025/26
const MEDICAL_CREDIT_MAIN         = 364   // per month for main member
const MEDICAL_CREDIT_FIRST_DEP    = 364   // first dependant
const MEDICAL_CREDIT_ADDITIONAL   = 246   // each additional dependant

function calculateAnnualPAYE(annualTaxable: number, age: number = 30): number {
  let tax = 0
  for (const bracket of TAX_BRACKETS) {
    if (annualTaxable <= bracket.from) break
    if (annualTaxable > bracket.to) {
      tax = bracket.base + (bracket.to - bracket.from) * bracket.rate
    } else {
      tax = bracket.base + (annualTaxable - bracket.from) * bracket.rate
      break
    }
  }

  // Apply rebates
  tax -= PRIMARY_REBATE
  if (age >= 65) tax -= SECONDARY_REBATE
  if (age >= 75) tax -= TERTIARY_REBATE

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
  const annualPAYE  = calculateAnnualPAYE(annualTaxable, ageYears)
  let   monthlyPAYE = annualPAYE / 12

  // Medical aid credits reduce PAYE (main member only — no dependant data here)
  const medicalCredit = medicalAidMonthlyPremium > 0 ? MEDICAL_CREDIT_MAIN : 0
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

export function generateEMP201(
  payslips: { paye: number; uifEmployee: number; uifEmployer: number; sdl: number }[],
  periodMonth: number,
  periodYear: number
): EMP201Data {
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
