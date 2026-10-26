// One-off codemod (Plan v2 step 8): wraps the cron handler of each listed Inngest
// file in heartbeat(). Idempotent — a file already wrapped is skipped.
//   node scripts/wrap-heartbeats.mjs
import fs from 'fs'

const files = [
  'fanOutBrief', 'fanOutDebtRecovery', 'cashflowForecast', 'fanOutHealthScore', 'governanceDeadlines',
  'opsAlerts', 'peopleApprovals', 'processQueue', 'signalRefresh', 'trialExpiry', 'sequencesCron',
  'escalateConversations', 'accountDeletionPurge', 'payrollReminder',
]

for (const name of files) {
  const f = `inngest/functions/${name}.ts`
  let s = fs.readFileSync(f, 'utf8')
  const crlf = s.includes('\r\n')
  if (crlf) s = s.replace(/\r\n/g, '\n')
  if (s.includes('heartbeat(')) { console.log('skip (already wrapped)', name); continue }

  const cf = s.search(/createFunction\(\s*\n\s*\{[^\n]*cron:/)
  if (cf < 0) throw new Error('no cron function in ' + name)
  const id = /id:\s*'([^']+)'/.exec(s.slice(cf))[1]

  const startRe = /\n {2}async \(/g
  startRe.lastIndex = cf
  const m = startRe.exec(s)
  if (!m) throw new Error('no handler in ' + name)

  const endRe = /\n {2}\}(,?)\n\)/g
  endRe.lastIndex = m.index
  const e = endRe.exec(s)
  if (!e) throw new Error('no handler end in ' + name)

  s = s.slice(0, m.index) + `\n  heartbeat('${id}', async (` + s.slice(m.index + '\n  async ('.length, e.index) + `\n  })${e[1]}\n)` + s.slice(e.index + e[0].length)

  const imp = "import { inngest } from '@/inngest/client'\n"
  if (!s.includes(imp)) throw new Error('no inngest import in ' + name)
  s = s.replace(imp, imp + "import { heartbeat } from '@/lib/jobs/heartbeat'\n")

  if (crlf) s = s.replace(/\n/g, '\r\n')
  fs.writeFileSync(f, s)
  console.log('wrapped', name, id)
}
