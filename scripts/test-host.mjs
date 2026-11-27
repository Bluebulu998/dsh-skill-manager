import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'

const root = mkdtempSync(join(tmpdir(), 'dsh-skill-catalog-'))
const workspace = join(root, 'workspace')
const userHome = join(root, 'home')
const projectSkillDir = join(workspace, '.dsh', 'skills', 'demo')
const userSkillDir = join(userHome, 'skills', 'flat-demo')
mkdirSync(projectSkillDir, { recursive: true })
mkdirSync(userSkillDir, { recursive: true })
mkdirSync(join(workspace, '.git'), { recursive: true })

const projectFile = join(projectSkillDir, 'SKILL.md')
writeFileSync(projectFile, '---\nname: demo-skill\ndescription: Demo project skill\n---\nBody\n', 'utf8')
const userFile = join(userSkillDir, 'SKILL.md')
writeFileSync(userFile, '---\nname: flat-demo\ndescription: Demo user skill\n---\nBody\n', 'utf8')

// The page scans the roots itself, so no registry mock exists here: these files
// are the only source of catalog entries.
const brokenFile = join(userHome, 'skills', 'broken.md')
writeFileSync(brokenFile, 'no frontmatter here\n', 'utf8')

const previousHome = process.env.DSH_HOME
process.env.DSH_HOME = userHome

const routes = new Map()
const events = []
const versions = new Map()
const fakeFs = {
  async resolve(path) { return { displayPath: path, targetKey: path } },
  async stat(target) {
    if (!existsSync(target.displayPath)) return undefined
    return { version: `v${versions.get(target.displayPath) ?? 0}`, type: 'file' }
  },
  async readText(target) { return readFileSync(target.displayPath, 'utf8') },
  async writeText(target, text, expected) {
    const current = `v${versions.get(target.displayPath) ?? 0}`
    if (expected && expected.kind === 'replaceIfVersion' && expected.version !== current) {
      throw Object.assign(new Error('stale'), { code: 'FS_STALE_VERSION' })
    }
    versions.set(target.displayPath, (versions.get(target.displayPath) ?? 0) + 1)
    writeFileSync(target.displayPath, text, 'utf8')
    return { operation: 'update', version: `v${versions.get(target.displayPath)}`, before: '', after: text }
  },
}
const scope = {
  get(name) {
    if (name === 'connection') {
      return {
        fetch: {
          register(route) {
            routes.set(route.path, route)
            return async () => routes.delete(route.path)
          },
        },
      }
    }
    if (name === 'workspaceRegistry') return { list: () => [{ id: 'w', path: workspace, title: 'Workspace' }] }
    if (name === 'fs') return fakeFs
    return undefined
  },
  effect(fn) { return fn() },
  emit(...args) { events.push(args) },
  logger: { warn: (...args) => console.warn('warn:', ...args) },
}
const ctx = { ...scope, inject(_deps, callback) { callback(scope) } }

apply(ctx)

function call(path, init) {
  const route = routes.get(path)
  if (!route) throw new Error(`route missing: ${path}`)
  return route.fetch(new Request(`http://127.0.0.1:1${path}`, init))
}

const catalogResponse = await call('/api/dsh-skills-catalog/catalog')
const catalog = await catalogResponse.json()
if (catalogResponse.status !== 200 || catalog.ok !== true) throw new Error(`catalog failed: ${JSON.stringify(catalog)}`)
if (catalog.skills.length !== 2) throw new Error(`expected 2 skills, got ${catalog.skills.length}`)
if (!catalog.roots.some((entry) => entry.source === 'project-dsh' && entry.exists)) throw new Error('missing project root')
if (!catalog.roots.some((entry) => entry.source === 'user-dsh')) throw new Error('missing user root')
if (!catalog.warnings.some((warning) => warning.includes('broken.md'))) throw new Error('missing warning for a malformed skill')
if (!catalog.skills.every((skill) => typeof skill.path === 'string' && skill.path.length > 0)) throw new Error('skills must carry their file paths')
console.log('ok catalog lists both roots and both skills')

const toggleResponse = await call('/api/dsh-skills-catalog/invocation', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ path: projectFile, modelInvocable: false }),
})
const toggle = await toggleResponse.json()
if (toggleResponse.status !== 200 || toggle.ok !== true) throw new Error(`toggle failed: ${JSON.stringify(toggle)}`)
if (toggle.invocation.modelInvocable !== false || toggle.invocation.userInvocable !== true) throw new Error('wrong invocation result')
const written = readFileSync(projectFile, 'utf8')
if (!written.includes('disable-model-invocation: true')) throw new Error('frontmatter not written')
if (!written.endsWith('---\nBody\n')) throw new Error('body changed')
if (events.length === 0) throw new Error('no fs/observed invalidation emitted')
console.log('ok invocation rewrite writes only the key and emits invalidation')

const restoreResponse = await call('/api/dsh-skills-catalog/invocation', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ path: projectFile, modelInvocable: true }),
})
const restore = await restoreResponse.json()
if (!restore.ok || restore.invocation.modelInvocable !== true) throw new Error('restore failed')
if (readFileSync(projectFile, 'utf8').includes('disable-model-invocation')) throw new Error('restore left the key')
console.log('ok restoring removes the key')

const unknownResponse = await call('/api/dsh-skills-catalog/invocation', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ path: join(root, 'not-a-skill.md'), modelInvocable: false }),
})
const unknown = await unknownResponse.json()
if (unknownResponse.status !== 404 || unknown.code !== 'skill_not_found') throw new Error(`expected skill_not_found, got ${JSON.stringify(unknown)}`)
console.log('ok unknown paths are rejected')

const revealUnknown = await call('/api/dsh-skills-catalog/reveal', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ path: join(root, 'elsewhere') }),
})
if (revealUnknown.status !== 403) throw new Error(`expected 403 for a non-root folder, got ${revealUnknown.status}`)
console.log('ok reveal rejects non-root folders')

if (previousHome === undefined) delete process.env.DSH_HOME
else process.env.DSH_HOME = previousHome
rmSync(root, { recursive: true, force: true })
console.log('all host route checks passed')