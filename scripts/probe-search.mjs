#!/usr/bin/env node
/**
 * probe-search — exercise the real semantic-search route against the machine's
 * own index, without starting DSH.
 *
 * The page test stubs the index; this one reads the real one and talks to the
 * real ollama, so a rebuild or a model change can be checked in a second.
 *
 *   node scripts/probe-search.mjs "这个按钮点着没反应" [--top 3]
 */
import { apply } from '../index.js'
import { homedir } from 'node:os'
import { join } from 'node:path'

const words = process.argv.slice(2).filter((word) => !word.startsWith('--'))
const query = words.join(' ') || '这个按钮点着没反应'
const topAt = process.argv.indexOf('--top')
const top = topAt > -1 ? Number(process.argv[topAt + 1]) || 3 : 3

process.env.DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')

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
          inherited: { includeDefaultRoots: true },
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
apply({ ...scope, inject(_deps, callback) { callback(scope) } })

const route = routes.get('/api/dsh-skill-manager/search')
if (!route) throw new Error('search route was not registered')
const started = Date.now()
const response = await route.fetch(new Request('http://127.0.0.1:1/api/dsh-skill-manager/search', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query }),
}))
const payload = await response.json()
const elapsed = Date.now() - started
if (!response.ok) {
  process.stderr.write('search failed (' + response.status + '): ' + JSON.stringify(payload) + '\n')
  process.exitCode = 1
} else {
  process.stdout.write('query: ' + query + '  ·  ' + payload.total + ' skills  ·  ' + payload.model + '  ·  ' + elapsed + 'ms\n')
  for (const row of payload.results.slice(0, top)) {
    process.stdout.write('  ' + row.score.toFixed(3) + '  [' + row.kind + '] ' + row.name + '  (' + (row.bytes / 1024).toFixed(1) + ' KB)\n')
    process.stdout.write('         ' + row.path + '\n')
  }
}
