/**
 * Local smoke test for the inventory route: run the host half with a fake scope,
 * ask it to scan the real machine, and print what the page would render.
 *
 * It never writes files and never opens a window. Pass a workspace directory as
 * the first argument; defaults to the current directory. Without a composed
 * preset in the fake scope the roots are the provider defaults (`~/.dsh/skills`,
 * `~/.agents/skills`, and the workspace project roots), and the packaged
 * `dsh-agent-preset/skills` fallback is not added.
 *
 * Usage (Desktop has no `node` on PATH):
 *   $env:ELECTRON_RUN_AS_NODE='1'
 *   & $env:DSH_NODE_EXECUTABLE scripts/probe-local.mjs "D:\some\workspace"
 */
import { apply } from '../index.js'

const workspace = process.argv[2] ?? process.cwd()
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
    if (name === 'workspaceRegistry') {
      return { list: () => [{ id: 'probe', path: workspace, title: workspace }] }
    }
    return undefined
  },
  effect(fn) { return fn() },
  emit() {},
  logger: { warn: (...args) => console.warn('warn:', ...args) },
}

apply({ ...scope, inject(_dependencies, callback) { callback(scope) } })

const route = routes.get('/api/dsh-skill-manager/inventory')
if (!route) throw new Error('inventory route was not registered')

const response = await route.fetch(new Request('http://127.0.0.1/api/dsh-skill-manager/inventory'))
const inventory = await response.json()

console.log(`workspace: ${workspace}`)
console.log(`status:    ${response.status}`)
console.log('roots:')
for (const root of inventory.roots) {
  console.log(`  [${root.exists && root.isDirectory ? 'ok' : '--'}] ${root.source.padEnd(15)} ${root.path}`)
}
console.log('skills:')
for (const skill of inventory.skills) {
  const flags = `model=${skill.modelInvocable} user=${skill.userInvocable}${skill.shadowed ? ' shadowed' : ''}`
  const references = Array.isArray(skill.references) ? skill.references : []
  const broken = references.filter((ref) => ref.exists === false && ref.archive !== true).length
  const referencedBy = Array.isArray(skill.referencedBy) ? skill.referencedBy : []
  const graph = [
    references.length > 0 ? `refs=${references.length}` : '',
    broken > 0 ? `broken=${broken}` : '',
    referencedBy.length > 0 ? `by=${referencedBy.join(',')}` : '',
  ].filter((part) => part.length > 0).join(' ')
  console.log(`  ${skill.name.padEnd(28)} ${skill.source.padEnd(15)} ${flags}${graph ? ` ${graph}` : ''}`)
}
if (inventory.warnings.length > 0) {
  console.log('warnings:')
  for (const warning of inventory.warnings) console.log(`  - ${warning}`)
}
console.log(`total: ${inventory.skills.length} skills, ${inventory.roots.length} roots`)