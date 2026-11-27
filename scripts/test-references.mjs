import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'

/**
 * The reference graph is the page's substitute for reading every router body:
 * a router names its leaves with hand-written paths, so the inventory has to
 * report which of those still resolve. This test pins that contract:
 * - an enabled router reports its references with a resolution flag;
 * - a broken reference becomes one warning, an `.asar` reference does not;
 * - the body itself never reaches the response;
 * - a disabled skill's body is not evidence (the model cannot load it).
 */

const root = mkdtempSync(join(tmpdir(), 'dsh-skill-manager-refs-'))
const workspace = join(root, 'workspace')
const userHome = join(root, 'home')
const agentsHome = join(root, 'agents')
// The router regex keys on the `.dsh\skills` shape, so the fixture has to keep
// that segment: pointing DSH_HOME straight at a temp dir would produce
// `home\skills`, which is not what any real install looks like.
const userSkills = join(root, 'fixture', '.dsh', 'skills')
const archiveRoot = join(root, 'resources', 'app.asar', 'dsh', 'skills')
// skills-off lives beside the user's skills root in a real install; collectRoots
// derives it from DSH_HOME, so the fixture has to mirror that placement.
const parkedRoot = join(userHome, 'skills-off')
const parkedDir = join(parkedRoot, 'parked')
mkdirSync(parkedDir, { recursive: true })
writeFileSync(join(parkedDir, 'SKILL.md'), '---\nname: parked-skill\ndescription: Parked\n---\nParked body\n', 'utf8')

const leafDir = join(userSkills, 'leaf')
const goneDir = join(userSkills, 'gone')
const routerDir = join(userSkills, 'router')
const offDir = join(userSkills, 'hidden')
mkdirSync(leafDir, { recursive: true })
mkdirSync(routerDir, { recursive: true })
mkdirSync(offDir, { recursive: true })
mkdirSync(archiveRoot, { recursive: true })
mkdirSync(join(workspace, '.git'), { recursive: true })

const leafFile = join(leafDir, 'SKILL.md')
writeFileSync(leafFile, '---\nname: leaf-skill\ndescription: Leaf\n---\nLeaf body\n', 'utf8')

// A disabled leaf: the router still points at it, and the page must be able to
// say "referenced by router" about a skill the model cannot see.
const offFile = join(offDir, 'SKILL.md')
writeFileSync(offFile, '---\nname: hidden-skill\ndescription: Hidden leaf\ndisable-model-invocation: true\n---\nHidden body\n', 'utf8')

const missing = join(goneDir, 'SKILL.md')
const archived = join(archiveRoot, 'packaged', 'SKILL.md')
const routerFile = join(routerDir, 'SKILL.md')
writeFileSync(routerFile, [
  '---',
  'name: router-skill',
  'description: Router',
  '---',
  '',
  '| task | read |',
  '|---|---|',
  `| leaf | ${leafFile.replace(/\\/g, '/')} |`,
  `| hidden | ${offFile.replace(/\\/g, '/')} |`,
  `| gone | ${missing.replace(/\\/g, '/')} |`,
  `| packaged | ${archived.replace(/\\/g, '/')} |`,
  '| home form | ~/.dsh/skills/home-form/SKILL.md |',
  '',
].join('\n'), 'utf8')

// A disabled skill that references a missing file: its body is not evidence, so
// it must contribute no references and therefore no warning.
const hiddenIdleDir = join(userSkills, 'idle')
mkdirSync(hiddenIdleDir, { recursive: true })
writeFileSync(join(hiddenIdleDir, 'SKILL.md'), [
  '---',
  'name: idle-skill',
  'description: Idle',
  'disable-model-invocation: true',
  '---',
  `reads ${join(userSkills, 'ghost', 'SKILL.md').replace(/\\/g, '/')} but nobody can load it`,
  '',
].join('\n'), 'utf8')

const previousEnv = new Map(['DSH_HOME', 'DSH_AGENTS_HOME', 'DSH_BUNDLED_SKILL_DIR']
  .map((name) => [name, process.env[name]]))
process.env.DSH_HOME = userHome
process.env.DSH_AGENTS_HOME = agentsHome
delete process.env.DSH_BUNDLED_SKILL_DIR

const routes = new Map()
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
    if (name === 'workspaceRegistry') return { list: () => [] }
    if (name === 'configEditor') {
      return {
        configuration: () => [{
          entry: { name: '@deepseek-ai/dsh-skill-filesystem', config: {} },
          inherited: { includeDefaultRoots: true, customSkillDirs: [userSkills, archiveRoot] },
          override: {},
        }],
      }
    }
    return undefined
  },
  effect(fn) { return fn() },
  emit() {},
  logger: { warn: (...args) => console.warn('warn:', ...args) },
}
const ctx = { ...scope, inject(_deps, callback) { callback(scope) } }

apply(ctx)

const inventoryResponse = await routes.get('/api/dsh-skill-manager/inventory')
  .fetch(new Request('http://127.0.0.1:1/api/dsh-skill-manager/inventory'))
const inventory = await inventoryResponse.json()
if (inventoryResponse.status !== 200 || inventory.ok !== true) throw new Error(`inventory failed: ${JSON.stringify(inventory)}`)

const byName = new Map(inventory.skills.map((skill) => [skill.name, skill]))
const router = byName.get('router-skill')
const leaf = byName.get('leaf-skill')
const hidden = byName.get('hidden-skill')
const idle = byName.get('idle-skill')
if (!router || !leaf || !hidden || !idle) throw new Error(`missing fixture skills: ${[...byName.keys()].join(', ')}`)

if (router.references.length !== 5) throw new Error(`router should report 5 references, got ${router.references.length}`)
const rows = router.references
if (!rows.every((row) => typeof row.path === 'string' && typeof row.exists === 'boolean')) {
  throw new Error(`each reference needs path and exists: ${JSON.stringify(rows)}`)
}
if (rows.filter((row) => row.exists).length !== 2) throw new Error('only the leaf and the hidden leaf resolve')
if (!rows.some((row) => row.archive === true)) throw new Error('the .asar reference must be flagged as archive')
if (!rows.some((row) => row.path.startsWith('~'))) throw new Error('the home-relative form must be reported')
console.log('ok a router reports its references with a resolution flag')

if (!leaf.referencedBy.includes('router-skill')) throw new Error('the visible leaf must be marked as referenced')
if (!hidden.referencedBy.includes('router-skill')) throw new Error('a disabled leaf must still be marked as referenced')
if (router.referencedBy.length !== 0) throw new Error('nothing references the router')
if (leaf.references.length !== 0) throw new Error('a leaf without references gets an empty list, not undefined')
console.log('ok referencedBy is inverted across visibility states')

if (idle.references.length !== 0) throw new Error('a disabled body must not contribute references')
if (idle.referencedBy.length !== 0) throw new Error('the idle skill is referenced by nobody')
console.log('ok a disabled body is not evidence')

const broken = rows.filter((row) => !row.exists && row.archive !== true)
if (broken.length < 2) throw new Error(`expected at least the missing + home-form rows to be broken, got ${broken.length}`)
if (!inventory.warnings.some((warning) => warning.includes('路由引用'))) {
  throw new Error(`expected a broken-link warning, got ${JSON.stringify(inventory.warnings)}`)
}
const archiveWarned = inventory.warnings.filter((warning) => warning.includes('app.asar'))
if (archiveWarned.length !== 0) throw new Error('archive references must not be counted as broken')
console.log('ok broken links warn once and archive references are exempt')

for (const skill of inventory.skills) {
  if (Object.hasOwn(skill, 'text')) throw new Error(`the skill body leaked into the response: ${skill.name}`)
  if (Object.hasOwn(skill, '__text')) throw new Error(`the scratch body leaked into the response: ${skill.name}`)
}
console.log('ok the response carries no skill bodies')

if (!Array.isArray(inventory.archives) || inventory.archives.length !== 1) {
  throw new Error(`expected one archive root, got ${JSON.stringify(inventory.archives)}`)
}
if (inventory.archives[0].path !== parkedRoot) throw new Error('the archive root must be the skills-off directory')
if (!Array.isArray(inventory.archivedSkills) || inventory.archivedSkills.length !== 1) {
  throw new Error(`expected one archived skill, got ${JSON.stringify(inventory.archivedSkills)}`)
}
const parked = inventory.archivedSkills[0]
if (parked.name !== 'parked-skill' || parked.archived !== true) throw new Error('archived skills must be tagged')
if (inventory.skills.some((skill) => skill.name === 'parked-skill')) {
  throw new Error('an archived skill must not appear in the editable list')
}
console.log('ok skills-off is listed separately and read-only')

for (const skill of inventory.skills) {
  if (typeof skill.role !== 'string') throw new Error(`every skill needs a role: ${skill.name}`)
}
if (router.role !== 'router') throw new Error(`router role, got ${router.role}`)
if (leaf.role !== 'leaf') throw new Error(`leaf role, got ${leaf.role}`)
if (hidden.role !== 'leaf') throw new Error(`a disabled but referenced skill is still a leaf, got ${hidden.role}`)
if (idle.role !== 'standalone') throw new Error(`unreferenced skill role, got ${idle.role}`)
console.log('ok roles follow in/out degree only')

const mapped = router.references.filter((ref) => typeof ref.target === 'string')
if (mapped.length !== 2) throw new Error(`two references resolve to inventory entries, got ${mapped.length}`)
if (!mapped.some((ref) => ref.target === 'leaf-skill')) throw new Error('the visible leaf must be mapped by target')
if (mapped.some((ref) => ref.target === 'router-skill')) throw new Error('a skill must not map to itself')
console.log('ok resolved references carry their target name')

for (const [name, value] of previousEnv) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
rmSync(root, { recursive: true, force: true })
console.log('all reference graph checks passed')
