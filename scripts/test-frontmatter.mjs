import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// The slice markers below are LF; normalize so a checkout with CRLF endings
// (git autocrlf on Windows) extracts the same helpers instead of failing.
const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const start = source.indexOf('function splitFrontmatter')
const end = source.indexOf('/* -------------------------------------------------------------------------- */\n/* File access')
if (start < 0 || end < 0) throw new Error('cannot locate the frontmatter helpers')

const script = `const INVOCATION_KEYS = { modelInvocable: 'disable-model-invocation', userInvocable: 'user-invocable' }\n${source.slice(start, end)}\n;__exports = { splitFrontmatter, parseInvocation, rewriteInvocation }`
const sandbox = {}
vm.createContext(sandbox)
vm.runInContext(script, sandbox)

const { parseInvocation, rewriteInvocation } = sandbox.__exports

function check(name, actual, expected) {
  const left = JSON.stringify(actual)
  const right = JSON.stringify(expected)
  if (left !== right) {
    console.error(`FAIL ${name}\n  expected ${right}\n  actual   ${left}`)
    process.exitCode = 1
  } else {
    console.log(`ok ${name}`)
  }
}

const base = `---\nname: demo\ndescription: A demo skill\nmetadata:\n  version: 1\n---\n\n# Body\n\nKeep this text.\n`
const crlf = '---\r\nname: demo\r\ndescription: A demo skill\r\n---\r\n\r\nBody\r\n'

check('parse defaults', parseInvocation(base), { modelInvocable: true, userInvocable: true })

const hidden = rewriteInvocation(base, { modelInvocable: false, userInvocable: true })
check('disable model text', hidden.text.includes('disable-model-invocation: true'), true)
check('disable model parse', parseInvocation(hidden.text), { modelInvocable: false, userInvocable: true })
check('body preserved', hidden.text.endsWith('# Body\n\nKeep this text.\n'), true)

const noUser = rewriteInvocation(hidden.text, { modelInvocable: false, userInvocable: false })
check('both keys', noUser.text.includes('user-invocable: false'), true)
check('both parse', parseInvocation(noUser.text), { modelInvocable: false, userInvocable: false })
check('only one disable key', noUser.text.split('disable-model-invocation').length - 1, 1)

const restored = rewriteInvocation(noUser.text, { modelInvocable: true, userInvocable: true })
check('restore parse', parseInvocation(restored.text), { modelInvocable: true, userInvocable: true })
check('restore removes keys', /disable-model-invocation|user-invocable/.test(restored.text), false)
check('restore keeps other fields', restored.text.includes('metadata:\n  version: 1'), true)

const crlfOut = rewriteInvocation(crlf, { modelInvocable: false, userInvocable: false })
check('crlf preserved', crlfOut.text.includes('disable-model-invocation: true\r\nuser-invocable: false\r'), true)

const quoted = '---\nname: demo\ndescription: A demo\n"user-invocable": false\n---\nBody\n'
check('quoted key parse', parseInvocation(quoted), { modelInvocable: true, userInvocable: false })
const cleaned = rewriteInvocation(quoted, { userInvocable: true })
check('quoted key restore', parseInvocation(cleaned.text).userInvocable, true)

const missing = rewriteInvocation('# no frontmatter\n', { modelInvocable: false })
check('missing frontmatter', missing.code, 'frontmatter_missing')

const invalid = rewriteInvocation('---\ndescription: only\n---\nBody\n', { modelInvocable: false })
check('invalid frontmatter', invalid.code, 'frontmatter_invalid')

const extra = rewriteInvocation('---\nname: demo\ndescription: A demo\ndisable-model-invocation: true\n---\nBody\n', { modelInvocable: true, userInvocable: false })
check('enable removes disable', /disable-model-invocation/.test(extra.text), false)
check('enable adds user key', extra.text.includes('user-invocable: false'), true)

console.log(process.exitCode === 1 ? 'frontmatter checks failed' : 'all frontmatter checks passed')