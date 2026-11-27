/**
 * Host checks for the Node fallback writer, used when the host has no `fs`
 * service to publish through:
 * - a concurrent edit between the version snapshot and the write is refused with
 *   `stale_file` instead of silently overwriting the other surface (P1-1);
 * - the write still emits `fs/observed`, so the provider refreshes without
 *   waiting for the watcher (P1-2);
 * - a failed write never leaves its `.tmp` sibling in the skill directory (P1-3).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'

const root = mkdtempSync(join(tmpdir(), 'dsh-skill-manager-fallback-'))
const userHome = join(root, 'home')
const skillDir = join(userHome, 'skills', 'fallback-demo')
const skillFile = join(skillDir, 'SKILL.md')
mkdirSync(skillDir, { recursive: true })
writeFileSync(skillFile, '---\nname: fallback-demo\ndescription: Demo fallback skill\n---\nBody\n', 'utf8')

// Pin the scan-root environment so the run does not depend on the machine.
const MANAGED_ENV = ['DSH_HOME', 'DSH_AGENTS_HOME', 'DSH_BUNDLED_SKILL_DIR']
const previousEnv = new Map(MANAGED_ENV.map((envName) => [envName, process.env[envName]]))
process.env.DSH_HOME = userHome
process.env.DSH_AGENTS_HOME = join(root, 'agents')
delete process.env.DSH_BUNDLED_SKILL_DIR

function tempFiles() {
  return readdirSync(skillDir).filter((entry) => entry.includes('.dsh-skill-manager-') && entry.endsWith('.tmp'))
}

/** One host context whose routes are collected into a fresh map. */
function makeHost(services) {
  const routes = new Map()
  const events = []
  const scope = {
    get(serviceName) {
      if (serviceName === 'connection') {
        return {
          fetch: {
            register(route) {
              routes.set(route.path, route)
              return async () => routes.delete(route.path)
            },
          },
        }
      }
      return services[serviceName]
    },
    effect(fn) { return fn() },
    emit(...args) { events.push(args) },
    logger: { warn: (...args) => console.warn('warn:', ...args) },
  }
  apply({ ...scope, inject(_deps, callback) { callback(scope) } })
  return {
    events,
    async call(path, init) {
      const route = routes.get(path)
      if (!route) throw new Error(`route missing: ${path}`)
      const response = await route.fetch(new Request(`http://127.0.0.1:1${path}`, init))
      return { status: response.status, body: await response.json() }
    },
  }
}

function toggle(path, flags) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, ...flags }),
  }
}

/* -------------------------------------------------------------------------- */
/* No fs service: the Node writer publishes and invalidates                    */
/* -------------------------------------------------------------------------- */

const plain = makeHost({})
const inventory = await plain.call('/api/dsh-skill-manager/inventory')
if (inventory.status !== 200 || inventory.body.ok !== true) throw new Error(`inventory failed: ${JSON.stringify(inventory.body)}`)
if (!inventory.body.skills.some((skill) => skill.path === skillFile)) throw new Error('fallback host does not list the fixture skill')
console.log('ok a host without the fs service still serves inventory')

const written = await plain.call('/api/dsh-skill-manager/invocation', toggle(skillFile, { modelInvocable: false }))
if (written.status !== 200 || written.body.ok !== true) throw new Error(`fallback write failed: ${written.status} ${JSON.stringify(written.body)}`)
if (written.body.invocation.modelInvocable !== false) throw new Error('fallback write did not apply the flag')
if (written.body.refreshed !== true) throw new Error('fallback write was not verified against the file')
if (!readFileSync(skillFile, 'utf8').includes('disable-model-invocation: true')) throw new Error('fallback write did not reach the file')

const observed = plain.events.filter(([eventName]) => eventName === 'fs/observed')
if (observed.length !== 1) throw new Error(`expected one fs/observed event, got ${observed.length}`)
const [, target, observation, actor] = observed[0]
if (target?.displayPath !== skillFile) throw new Error('invalidation does not carry the skill path')
if (observation?.kind !== 'present' || typeof observation.version !== 'string') throw new Error('invalidation does not carry a present version')
if (actor?.name !== 'edit') throw new Error('invalidation actor is not the edit surface')
if (tempFiles().length !== 0) throw new Error(`fallback write left temp files: ${tempFiles().join(', ')}`)
console.log('ok the fallback write emits fs/observed with the skill path and leaves no temp file')

const restored = await plain.call('/api/dsh-skill-manager/invocation', toggle(skillFile, { modelInvocable: true }))
if (restored.status !== 200 || restored.body.invocation.modelInvocable !== true) throw new Error('fallback restore failed')
if (readFileSync(skillFile, 'utf8').includes('disable-model-invocation')) throw new Error('fallback restore left the key')
console.log('ok the fallback restore removes the key')

/* -------------------------------------------------------------------------- */
/* Concurrent edit: refused, and the refused write leaves nothing behind      */
/* -------------------------------------------------------------------------- */

// A provider that can observe and read but cannot publish a write (a read-only
// backend) forces the Node writer while giving the test a deterministic place to
// stage the other window's save: the edit lands right after this read returns.
const readOnlyFs = {
  async resolve(path) { return { displayPath: path, targetKey: path } },
  async stat() { return { version: 'provider-1', type: 'file' } },
  async readText(observedTarget) {
    const text = readFileSync(observedTarget.displayPath, 'utf8')
    writeFileSync(observedTarget.displayPath, `${text}\n<!-- concurrent edit -->\n`, 'utf8')
    return text
  },
}
const racing = makeHost({ fs: readOnlyFs })
const stale = await racing.call('/api/dsh-skill-manager/invocation', toggle(skillFile, { userInvocable: false }))
if (stale.status !== 409 || stale.body.code !== 'stale_file') {
  throw new Error(`a concurrent edit must be refused, got ${stale.status} ${JSON.stringify(stale.body)}`)
}
const afterStale = readFileSync(skillFile, 'utf8')
if (!afterStale.includes('<!-- concurrent edit -->')) throw new Error('the refused write overwrote the concurrent edit')
if (afterStale.includes('user-invocable: false')) throw new Error('the refused write still applied the flag')
if (tempFiles().length !== 0) throw new Error(`a refused write left temp files: ${tempFiles().join(', ')}`)
if (racing.events.some(([eventName]) => eventName === 'fs/observed')) throw new Error('a refused write must not invalidate the provider')
console.log('ok a concurrent edit is reported as stale_file and leaves neither a write nor a temp file')

for (const [envName, value] of previousEnv) {
  if (value === undefined) delete process.env[envName]
  else process.env[envName] = value
}
if (existsSync(root)) rmSync(root, { recursive: true, force: true })
console.log('all fallback writer checks passed')