import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifestPath = join(root, 'package.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

const problems = []
if (manifest.name !== '@dsh-local/view-f14b8d9a-d47d-4fd4-933c-f861058ea59f') {
  problems.push(`unexpected package name: ${manifest.name}`)
}
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') {
  problems.push('dsh.bundle.patch must be ./cordis.patch.yml')
}
if (manifest.dsh?.client?.platform !== 'web') {
  problems.push('dsh.client.platform must be web')
}
if (manifest.dsh?.client?.immediately !== true) {
  problems.push('dsh.client.immediately must be true')
}
for (const entry of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'locale/en.json', 'locale/zh.json']) {
  if (!existsSync(join(root, entry))) problems.push(`missing runtime file: ${entry}`)
}

for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
  if (typeof target !== 'string' || target.includes('*')) continue
  if (!existsSync(join(root, target))) problems.push(`export ${subpath} points at a missing file: ${target}`)
}

for (const locale of ['locale/en.json', 'locale/zh.json']) {
  try {
    const dictionary = JSON.parse(readFileSync(join(root, locale), 'utf8'))
    if (typeof dictionary?.meta?.title !== 'string' || dictionary.meta.title.length === 0) {
      problems.push(`${locale} is missing meta.title`)
    }
    if (typeof dictionary?.meta?.description !== 'string' || dictionary.meta.description.length === 0) {
      problems.push(`${locale} is missing meta.description`)
    }
  } catch (error) {
    problems.push(`${locale} is not valid JSON: ${error.message}`)
  }
}

const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
const insertMatch = /- insert:[\s\S]*- id: "([^"]+)"/.exec(patch)
if (!insertMatch) {
  problems.push('cordis.patch.yml must contain one insert operation with an id')
} else if (!insertMatch[1].startsWith(`${manifest.name}:`)) {
  problems.push('every inserted id must start with the package name plus a colon')
}

for (const file of ['index.js', 'client.js']) {
  try {
    // `stdio: 'inherit'` keeps the child's syntax error visible on the console
    // and avoids piped stdio: the DSH Windows sandbox denies pipe handles, so a
    // piped spawn fails with EPERM before `node --check` even runs.
    execFileSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' })
  } catch (error) {
    // A non-zero status means `--check` printed the error above; anything else
    // is the spawn itself failing, which needs its own explanation.
    if (typeof error?.status === 'number') {
      problems.push(`${file} failed the syntax check (see the error printed above)`)
    } else {
      problems.push(`${file} could not be syntax-checked: ${String(error?.message ?? error)}`)
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`build: ${problem}`)
  process.exit(1)
}
console.log(`build: ${manifest.name}@${manifest.version} is ready`)