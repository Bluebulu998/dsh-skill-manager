import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

let factory
const ReactStub = {
  createElement: (...args) => ({ type: args[0], props: args[1] ?? {}, children: args.slice(2) }),
  useState: () => { throw new Error('useState executed outside React') },
  useEffect: () => { throw new Error('useEffect executed outside React') },
  useMemo: () => { throw new Error('useMemo executed outside React') },
  useRef: (value) => ({ current: value }),
  useCallback: (fn) => fn,
}

const windowStub = {
  __ModuleLoader__: {
    load(entry) {
      factory = entry.factory
    },
  },
}
const sandbox = {
  window: windowStub,
  document: { baseURI: 'http://127.0.0.1:1/' },
  console,
}
vm.createContext(sandbox)
vm.runInContext(source, sandbox)
if (typeof factory !== 'function') throw new Error('client bundle did not register a factory')

const plugin = factory((id) => {
  if (id === 'react') return ReactStub
  throw new Error(`unexpected module require: ${id}`)
})
if (typeof plugin.apply !== 'function') throw new Error('factory did not return a plugin apply')

const registrations = []
const effects = []
const selected = []
const localeNamespaces = []
const slots = {
  inject(name, callback) {
    registrations.push({ owner: name, registration: callback() })
    return () => {}
  },
  register(options, component) {
    return { options, component, dispose() {} }
  },
}
const ctx = {
  get(name) {
    if (name === 'slots') return slots
    if (name === 'locale') {
      return {
        register(ns, dictionaries) {
          localeNamespaces.push({ ns, locales: Object.keys(dictionaries) })
          return () => {}
        },
        bind(ns) { return (key) => `${ns}:${key}` },
      }
    }
    if (name === 'layout') return { selectPanel: (id) => selected.push(id) }
    return undefined
  },
  effect(fn, label) {
    effects.push({ label, dispose: fn() })
    return () => {}
  },
}

plugin.apply(ctx)

if (localeNamespaces.length !== 1 || localeNamespaces[0].ns !== 'skills.catalog') throw new Error('locale namespace not registered')
if (!localeNamespaces[0].locales.includes('zh') || !localeNamespaces[0].locales.includes('en')) throw new Error('locale dictionaries missing zh/en')

const sidebar = registrations.find((entry) => entry.owner === 'sidebar.panellist')
const main = registrations.find((entry) => entry.owner === 'main')
if (!sidebar || !main) throw new Error('sidebar.panellist and main registrations are required')
if (sidebar.registration.options.id !== 'view-f14b8d9a-skills-catalog') throw new Error('wrong sidebar id')
if (sidebar.registration.options.order !== 20) throw new Error('wrong sidebar order')
if (main.registration.options.key !== 'view-f14b8d9a-skills-catalog') throw new Error('wrong main key')

const icon = sidebar.registration.component({ size: 18, active: true })
if (!icon || icon.type !== 'svg') throw new Error('panel icon is not an svg')

const leave = effects.find((entry) => String(entry.label).includes('leave panel'))
if (!leave) throw new Error('panel teardown effect missing')
leave.dispose()
if (selected.length !== 1 || selected[0] !== null) throw new Error(`active panel was not released: ${JSON.stringify(selected)}`)

// Re-run apply so the icon starts inactive, then confirm teardown leaves another panel alone.
selected.length = 0
const plugin2 = factory((id) => {
  if (id === 'react') return ReactStub
  throw new Error(`unexpected module require: ${id}`)
})
const effects2 = []
const registrations2 = []
const slots2 = {
  inject(name, callback) { registrations2.push({ owner: name, registration: callback() }); return () => {} },
  register(options, component) { return { options, component, dispose() {} } },
}
const ctx2 = {
  get(name) {
    if (name === 'slots') return slots2
    if (name === 'layout') return { selectPanel: (id) => selected.push(id) }
    return undefined
  },
  effect(fn, label) { effects2.push({ label, dispose: fn() }); return () => {} },
}
plugin2.apply(ctx2)
const icon2 = registrations2.find((entry) => entry.owner === 'sidebar.panellist').registration.component({ size: 18, active: false })
if (!icon2) throw new Error('icon render failed for inactive state')
const leave2 = effects2.find((entry) => String(entry.label).includes('leave panel'))
leave2.dispose()
if (selected.length !== 0) throw new Error(`inactive panel teardown changed selection: ${JSON.stringify(selected)}`)

console.log('all client registration and teardown checks passed')