// Migrates all Inngest functions from v3 3-arg createFunction to v4 2-arg
// v3: createFunction(config, trigger, handler)
// v4: createFunction({ ...config, triggers: [trigger] }, handler)
//
// Run this script on a fresh copy — it handles both:
//   A) Files still in the original 3-arg pattern
//   B) Files that were partially fixed with the broken ` }, triggers:` pattern

const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '..', 'inngest', 'functions')
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'))

let totalFiles = 0
let totalReplacements = 0

for (const file of files) {
  const filePath = path.join(dir, file)
  let content = fs.readFileSync(filePath, 'utf8')
  let count = 0

  // Fix A: broken output from first run — "}, triggers: [{ event: 'X' }] },"
  // The `}` before `, triggers:` incorrectly closed the config object.
  // Match: space + } + the whole ", triggers: [{ key: 'val' }] },"
  // Replace: ", triggers: [{ key: 'val' }] },"  (no leading `}`)
  const fixBroken = / \}, triggers: \[\{ (event|cron): '([^']+)' \}\] \},/g
  content = content.replace(fixBroken, (_match, p1, p2) => {
    count++
    return `, triggers: [{ ${p1}: '${p2}' }] },`
  })

  // Fix B: original 3-arg pattern still in place (for any files not yet touched)
  // Match the trigger as a second arg line and move it into config.triggers
  const fixOriginal = /\},(\r?\n)([ \t]+)\{ (event|cron): '([^']+)' \},[^\r\n]*\r?\n/g
  content = content.replace(fixOriginal, (_match, p1, _p2, p3, p4) => {
    count++
    return `, triggers: [{ ${p3}: '${p4}' }] },${p1}`
  })

  if (count > 0) {
    fs.writeFileSync(filePath, content, { encoding: 'utf8' })
    console.log(`  fixed ${count}x: ${file}`)
    totalFiles++
    totalReplacements += count
  }
}

console.log(`\n✓ ${totalFiles} files, ${totalReplacements} replacements`)
