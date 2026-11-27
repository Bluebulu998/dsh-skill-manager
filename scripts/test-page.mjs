import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { URL } from 'node:url'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

// Synthetic install-archive path for the fixture. It is never read from disk:
// the page only needs an `.asar` segment to classify the root as bundled and
// read-only, so keep it clearly fake instead of resembling a real install.
const ARCHIVE_ROOT = 'C:\\demo-install\\resources\\app.asar\\dsh\\skills'

const inventoryPayload = {
  ok: true,
  generatedAt: '2026-01-01T00:00:00.000Z',
  workspaces: [{ id: 'w1', path: 'D:\\work', title: 'Demo workspace' }],
  roots: [
    { path: 'D:\\work\\.dsh\\skills', source: 'project-dsh', rank: 100, exists: true, isDirectory: true, workspaceTitle: 'Demo workspace' },
    { path: 'C:\\Users\\demo\\.dsh\\skills', source: 'user-dsh', rank: 400, exists: true, isDirectory: true },
    { path: 'C:\\Users\\demo\\.agents\\skills', source: 'user-agents', rank: 500, exists: false, isDirectory: false },
    {
      path: ARCHIVE_ROOT,
      source: 'custom',
      rank: 300,
      exists: true,
      isDirectory: true,
    },
  ],
  archives: [
    { path: 'C:\\Users\\demo\\.dsh\\skills-off', source: 'user-dsh', rank: 400 },
  ],
  archivedSkills: [
    {
      name: 'parked-skill',
      description: 'A skill parked outside the scan roots.',
      path: 'C:\\Users\\demo\\.dsh\\skills-off\\parked\\SKILL.md',
      source: 'user-dsh',
      archived: true,
    },
  ],
  skills: [
    {
      name: 'router-skill',
      description: 'Points at the demo skill by path.',
      path: 'D:\\work\\.dsh\\skills\\router\\SKILL.md',
      source: 'project-dsh',
      provider: 'filesystem',
      modelInvocable: true,
      userInvocable: true,
      workspaces: ['D:\\work'],
      workspaceTitles: ['Demo workspace'],
      role: 'router',
      references: [{ path: 'D:\\work\\.dsh\\skills\\demo\\SKILL.md', exists: true, target: 'demo-skill' }],
      referencedBy: [],
    },
    {
      name: 'demo-skill',
      description: 'A demo skill used by the page test.',
      path: 'D:\\work\\.dsh\\skills\\demo\\SKILL.md',
      source: 'project-dsh',
      provider: 'filesystem',
      modelInvocable: true,
      userInvocable: true,
      workspaces: ['D:\\work'],
      workspaceTitles: ['Demo workspace'],
      role: 'leaf',
      references: [],
      referencedBy: ['router-skill'],
    },
    {
      name: 'quiet-skill',
      description: 'A skill hidden from the model.',
      path: 'C:\\Users\\demo\\.dsh\\skills\\quiet\\SKILL.md',
      source: 'user-dsh',
      provider: 'filesystem',
      modelInvocable: false,
      userInvocable: true,
      workspaces: [],
      workspaceTitles: [],
    },
    {
      name: 'packaged-skill',
      description: 'A skill that ships inside the installation archive.',
      path: `${ARCHIVE_ROOT}\\packaged-skill\\SKILL.md`,
      source: 'custom',
      provider: 'filesystem',
      modelInvocable: true,
      userInvocable: true,
      workspaces: [],
      workspaceTitles: [],
    },
  ],
  warnings: [],
}

const calls = []
async function fetchStub(url, init = {}) {
  const path = new URL(url).pathname
  calls.push({ path, init })
  if (path.endsWith('/inventory')) {
    return { ok: true, status: 200, async json() { return inventoryPayload } }
  }
  if (path.endsWith('/invocation')) {
    const body = JSON.parse(init.body)
    const skill = inventoryPayload.skills.find((entry) => entry.path === body.path)
    const invocation = {
      modelInvocable: body.modelInvocable !== undefined ? body.modelInvocable : skill.modelInvocable,
      userInvocable: body.userInvocable !== undefined ? body.userInvocable : skill.userInvocable,
    }
    skill.modelInvocable = invocation.modelInvocable
    skill.userInvocable = invocation.userInvocable
    return { ok: true, status: 200, async json() { return { ok: true, invocation, refreshed: true } } }
  }
  if (path.endsWith('/reveal')) return { ok: true, status: 200, async json() { return { ok: true } } }
  return { ok: false, status: 404, async json() { return { ok: false, code: 'not_found' } } }
}

let factory
const sandbox = {
  window: { __ModuleLoader__: { load(entry) { factory = entry.factory } } },
  document: { baseURI: 'http://127.0.0.1:1/' },
  fetch: fetchStub,
  URL,
  console,
  setTimeout,
  clearTimeout,
  Promise,
}
vm.createContext(sandbox)
vm.runInContext(source, sandbox)

// Minimal React runtime capable of one function component with hooks.
const cells = []
let cursor = 0
let dirty = false
const pendingEffectCells = []
function sameDeps(left, right) {
  if (!left || !right || left.length !== right.length) return false
  return left.every((value, index) => Object.is(value, right[index]))
}
function cell() {
  const index = cursor
  cursor += 1
  if (!(index in cells)) cells[index] = {}
  return cells[index]
}
const ReactStub = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useState(initial) {
    const slot = cell()
    if (!('value' in slot)) slot.value = typeof initial === 'function' ? initial() : initial
    return [slot.value, (next) => {
      const value = typeof next === 'function' ? next(slot.value) : next
      if (!Object.is(value, slot.value)) {
        slot.value = value
        dirty = true
      }
    }]
  },
  useRef(initial) {
    const slot = cell()
    if (!('ref' in slot)) slot.ref = { current: initial }
    return slot.ref
  },
  useEffect(fn, deps) {
    const slot = cell()
    if (!sameDeps(deps, slot.deps)) {
      slot.deps = deps
      slot.fn = fn
      pendingEffectCells.push(slot)
    }
  },
  useMemo(fn, deps) {
    const slot = cell()
    if (!sameDeps(deps, slot.deps)) {
      slot.deps = deps
      slot.value = fn()
    }
    return slot.value
  },
  useCallback(fn, deps) {
    const slot = cell()
    if (!sameDeps(deps, slot.deps)) {
      slot.deps = deps
      slot.value = fn
    }
    return slot.value
  },
}

const registrations = []
const sandboxPlugin = factory((id) => {
  if (id === 'react') return ReactStub
  throw new Error(`unexpected module: ${id}`)
})
sandboxPlugin.apply({
  get(name) {
    if (name === 'slots') {
      return {
        inject(_owner, callback) { registrations.push(callback()); return () => {} },
        register(options, component) { return { options, component, dispose() {} } },
      }
    }
    return undefined
  },
  effect(fn) { fn(); return () => {} },
})

const pageRegistration = registrations.find((entry) => entry.options && entry.options.name === 'main')
if (!pageRegistration) throw new Error('main page not registered')

function textOf(node) {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return (node.children ?? []).map(textOf).join('|')
}
function expand(node) {
  if (node === null || node === undefined) return node
  if (typeof node === 'string' || typeof node === 'number') return node
  if (Array.isArray(node)) return node.map(expand)
  if (typeof node.type === 'function') return expand(node.type(node.props))
  return { ...node, children: (node.children ?? []).map(expand) }
}
function find(node, predicate, found = []) {
  if (!node || typeof node !== 'object') return found
  if (Array.isArray(node)) { node.forEach((child) => find(child, predicate, found)); return found }
  if (predicate(node)) found.push(node)
  ;(node.children ?? []).forEach((child) => find(child, predicate, found))
  return found
}

async function settle() {
  for (let round = 0; round < 12; round += 1) {
    cursor = 0
    pendingEffectCells.length = 0
    const tree = expand(pageRegistration.component({}))
    const runnable = pendingEffectCells.slice()
    for (const slot of runnable) {
      if (typeof slot.cleanup === 'function') slot.cleanup()
      slot.cleanup = slot.fn()
    }
    await new Promise((done) => setTimeout(done, 5))
    if (!dirty) return tree
    dirty = false
  }
  throw new Error('page did not settle')
}

let tree = await settle()
let text = textOf(tree)
if (!text.includes('demo-skill') || !text.includes('quiet-skill')) throw new Error(`skills missing from page: ${text}`)
if (!text.includes('扫描根目录')) throw new Error('roots section missing')
if (!text.includes('D:\\work\\.dsh\\skills')) throw new Error('project root path missing')
if (text.includes('C:\\Users\\demo\\.agents\\skills')) throw new Error('missing root path leaked into the default list')
if (find(tree, (node) => node.props && typeof node.props.className === 'string' && node.props.className.includes('is-missing')).length !== 0) {
  throw new Error('missing-root state rendered by default')
}
if (!text.includes('项目 · DSH') || !text.includes('用户 · DSH')) throw new Error('source labels missing')

// Global roots lead both the roots list and the source groups.
const rootsList = find(tree, (node) => node.props && node.props.className === 'dsc-roots')[0]
if (!rootsList) throw new Error('roots list missing')
const rootRows = Array.isArray(rootsList.children) ? rootsList.children.map(textOf) : []
if (!rootRows[0] || !rootRows[0].includes('C:\\Users\\demo\\.dsh\\skills')) throw new Error(`global root is not first: ${rootRows[0]}`)
const groupSections = find(tree, (node) => node.props && node.props.className === 'dsc-source-group')
if (groupSections.length !== 3) throw new Error(`expected three source groups, got ${groupSections.length}`)
if (!textOf(groupSections[0]).includes('quiet-skill')) throw new Error('the user group should stay first')
const projectGroup = groupSections.find((section) => textOf(section).includes('demo-skill'))
if (!projectGroup) throw new Error('project group missing')
if (groupSections.indexOf(projectGroup) !== 2) throw new Error('project group should follow the global and bundled groups')
const archiveGroup = groupSections.find((section) => textOf(section).includes('packaged-skill'))
if (!archiveGroup || !textOf(archiveGroup).includes('内置')) throw new Error('packaged skill should be grouped as bundled')
if (!textOf(archiveGroup).includes('位于安装包内，只读')) throw new Error('packaged skill should be marked read-only')
const archiveRootRow = rootRows.find((row) => row.includes('app.asar'))
if (!archiveRootRow || !archiveRootRow.includes('内置')) throw new Error('archive root should be labelled bundled')
console.log('ok page renders skills, global-first roots and source labels, missing roots hidden')

// The missing-root toggle reveals the absent root on demand.
const showMissingButton = find(tree, (node) => node.type === 'button'
  && node.children.some((child) => typeof child === 'string' && child.includes('显示不存在的目录')))[0]
if (!showMissingButton) throw new Error('missing-root toggle not rendered')
showMissingButton.props.onClick()
tree = await settle()
text = textOf(tree)
if (!text.includes('C:\\Users\\demo\\.agents\\skills')) throw new Error('missing root not revealed by the toggle')
if (find(tree, (node) => node.props && typeof node.props.className === 'string' && node.props.className.includes('is-missing')).length !== 1) {
  throw new Error('missing-root state not rendered after the toggle')
}
console.log('ok missing roots are hidden by default and revealed on demand')

// Find the checkbox whose aria-label names quiet-skill and whose checked value is false.
const checkboxes = find(tree, (node) => node.type === 'input' && node.props && typeof node.props['aria-label'] === 'string')
const quietBox = checkboxes.find((box) => box.props['aria-label'] === '对模型可见 quiet-skill')
if (!quietBox) throw new Error('quiet-skill model checkbox missing')
if (quietBox.props.checked !== false) throw new Error('model-visible checkbox should start false')
if (typeof quietBox.props.onChange !== 'function') throw new Error('checkbox has no change handler')

const archivedBoxes = checkboxes.filter((box) => box.props['aria-label'].includes('packaged-skill'))
if (archivedBoxes.length !== 2) throw new Error(`expected two toggles for the packaged skill, got ${archivedBoxes.length}`)
if (archivedBoxes.some((box) => box.props.disabled !== true)) throw new Error('packaged-skill toggles must be disabled')

quietBox.props.onChange({ target: { checked: true } })
tree = await settle()
const enabled = find(tree, (node) => node.type === 'input' && node.props && node.props.checked === true && node.props['aria-label'] === '对模型可见 quiet-skill')
if (enabled.length !== 1) throw new Error('optimistic update did not flip the checkbox')
const saveCall = calls.find((call) => call.path.endsWith('/invocation'))
if (!saveCall) throw new Error('no invocation request was sent')
if (JSON.parse(saveCall.init.body).path !== 'C:\\Users\\demo\\.dsh\\skills\\quiet\\SKILL.md') throw new Error('wrong save path')
if (JSON.parse(saveCall.init.body).modelInvocable !== true) throw new Error('wrong save flag')
console.log('ok checkbox toggling saves and updates the row')

const openButtons = find(tree, (node) => node.type === 'button' && node.props.disabled !== true && node.children.some((child) => typeof child === 'string' && child.includes('打开文件夹')))
if (openButtons.length !== 2) throw new Error(`expected two enabled open-folder buttons, got ${openButtons.length}`)
openButtons[0].props.onClick()
tree = await settle()
const revealCall = calls.find((call) => call.path.endsWith('/reveal'))
if (!revealCall) throw new Error('open folder did not call the reveal route')
const revealBody = JSON.parse(revealCall.init.body)
if (revealBody.path !== 'D:\\work\\.dsh\\skills' && revealBody.path !== 'C:\\Users\\demo\\.dsh\\skills') throw new Error(`reveal used an unknown root: ${revealBody.path}`)
console.log('ok open folder calls the reveal route')

// The overview strip answers "what shape is my skill set in" without scrolling.
if (!text.includes('策略概览')) throw new Error('overview strip missing')
const overviewStrip = find(tree, (node) => node.props && node.props.className === 'dsc-overview')[0]
if (!overviewStrip) throw new Error('overview element missing')
const overviewText = textOf(overviewStrip)
if (!overviewText.includes('路由 1')) throw new Error(`overview should count the router: ${overviewText}`)
if (!overviewText.includes('叶子 1')) throw new Error(`overview should count the leaf: ${overviewText}`)
if (!overviewText.includes('已归档 1')) throw new Error(`overview should count archived skills: ${overviewText}`)
console.log('ok overview counts roles and archived skills')

const hierarchyButton = find(tree, (node) => node.type === 'button'
  && node.children.some((child) => typeof child === 'string' && child === '按层级'))[0]
if (!hierarchyButton) throw new Error('hierarchy view switch missing')
if (hierarchyButton.props['aria-pressed'] !== false) throw new Error('source view should be active by default')
hierarchyButton.props.onClick()
tree = await settle()
text = textOf(tree)
if (!text.includes('router-skill')) throw new Error('router row missing in hierarchy view')
if (text.includes('demo-skill')) throw new Error('a collapsed router must not reveal its leaf')
const expandButton = find(tree, (node) => node.type === 'button'
  && node.props && node.props.className === 'dsc-expand')[0]
if (!expandButton) throw new Error('router should be expandable')
if (expandButton.props['aria-expanded'] !== false) throw new Error('router should start collapsed')
expandButton.props.onClick()
tree = await settle()
text = textOf(tree)
if (!text.includes('demo-skill')) throw new Error('expanding the router should reveal its leaf')
const nestedRows = find(tree, (node) => node.props && typeof node.props.className === 'string' && node.props.className.includes('dsc-row-nested'))
if (nestedRows.length !== 1) throw new Error(`expected one nested leaf row, got ${nestedRows.length}`)
console.log('ok hierarchy view folds routers and expands on demand')

const archiveSection = find(tree, (node) => node.props && typeof node.props.className === 'string' && node.props.className.includes('dsc-archive-group'))[0]
if (!archiveSection) throw new Error('archive section missing')
if (!textOf(archiveSection).includes('parked-skill')) throw new Error('archived skill missing from the archive section')
const archivedInputs = find(archiveSection, (node) => node.type === 'input')
if (archivedInputs.length !== 0) throw new Error('archived skills must not offer toggles')
console.log('ok archived skills render read-only in their own section')

console.log('all page rendering and interaction checks passed')