/**
 * Host half of the cross-session skill manager.
 *
 * It serves three authenticated `/api` routes for the browser page:
 * - GET  inventory: the filesystem-scanned skills (with their invocation flags)
 *   grouped by scan source, plus the scan roots themselves;
 * - POST invocation: rewrite one skill's `SKILL.md` frontmatter so the
 *   filesystem skill provider rescans it immediately;
 * - POST reveal: open one displayed scan root in the OS file manager.
 *
 * The page edits only what the local filesystem provider already scans. It
 * never registers skills, changes configuration, or writes outside a root the
 * current scan reports.
 *
 * @module @bluebulu998/dsh-skill-manager
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Stable plugin name used by Cordis diagnostics. */
export const name = 'skill-manager'

/** No hard service dependency: every service is optional and checked. */
export const inject = []

const INVENTORY_PATH = '/api/dsh-skill-manager/inventory'
const INVOCATION_PATH = '/api/dsh-skill-manager/invocation'
const REVEAL_PATH = '/api/dsh-skill-manager/reveal'

const MAX_BODY_BYTES = 64 * 1024
const REVEAL_SPAWN_TIMEOUT_MS = 1500

const SOURCE_RANKS = {
  'project-dsh': 100,
  'project-agents': 200,
  custom: 300,
  'user-dsh': 400,
  'user-agents': 500,
  bundled: 600,
}

const INVOCATION_KEYS = {
  modelInvocable: 'disable-model-invocation',
  userInvocable: 'user-invocable',
}

/* -------------------------------------------------------------------------- */
/* Small utilities                                                             */
/* -------------------------------------------------------------------------- */

function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function failure(status, code, message) {
  return jsonResponse(status, { ok: false, code, message })
}

function normalizePath(value) {
  const resolved = resolve(value)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function expandHome(value) {
  if (typeof value !== 'string' || value.length === 0) return value
  if (value === '~') return homedir()
  if (value.startsWith('~/') || value.startsWith('~\\')) return join(homedir(), value.slice(2))
  return value
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function statDirectory(path) {
  try {
    const info = statSync(path)
    return { exists: true, isDirectory: info.isDirectory() }
  } catch {
    return { exists: false, isDirectory: false }
  }
}

/** True for a path that points inside an Electron `app.asar` archive. */
function isArchivePath(value) {
  return typeof value === 'string' && /\.asar([\\/]|$)/i.test(value)
}

function nearestProjectRoot(start) {
  let current = resolve(start)
  while (true) {
    if (existsSync(join(current, '.git'))) return current
    const parent = dirname(current)
    if (parent === current) return resolve(start)
    current = parent
  }
}

/* -------------------------------------------------------------------------- */
/* Scan-root derivation                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Read the skill-provider rows the active profile actually composes. A direct
 * host row registers globally, while every shipped preset declares its local
 * provider as a child of the `dsh-agent-preset` row, so both shapes are read
 * here. Configuration stays read-only: the page never edits it.
 */
function providerConfigs(scope) {
  const configs = []
  const push = (config) => {
    if (config && typeof config === 'object' && !Array.isArray(config)) configs.push(config)
  }
  const editor = scope.get('configEditor')
  try {
    if (editor && typeof editor.configuration === 'function') {
      for (const row of editor.configuration()) {
        const rowName = typeof row?.entry?.name === 'string' ? row.entry.name : ''
        const merged = { ...(row?.inherited ?? {}), ...(row?.override ?? {}) }
        if (rowName.includes('dsh-skill-filesystem')) {
          push(merged)
          continue
        }
        const children = Array.isArray(merged.plugins)
          ? merged.plugins
          : Array.isArray(row?.entry?.config?.plugins) ? row.entry.config.plugins : undefined
        if (!children) continue
        for (const child of children) {
          const childName = typeof child?.name === 'string' ? child.name : ''
          if (childName.includes('dsh-skill-filesystem')) push(child.config)
        }
      }
    }
  } catch (error) {
    scope.logger?.warn?.(`skill-manager: cannot read skill provider config: ${errorMessage(error)}`)
  }
  if (configs.length === 0) configs.push({})

  return configs.map((config) => {
    const includeDefaultRoots = config.includeDefaultRoots !== false
    const dshHome = resolve(expandHome(
      typeof config.dshHome === 'string' && config.dshHome.length > 0
        ? config.dshHome
        : process.env.DSH_HOME || join(homedir(), '.dsh'),
    ))
    const agentsHome = resolve(expandHome(
      typeof config.agentsHome === 'string' && config.agentsHome.length > 0
        ? config.agentsHome
        : process.env.DSH_AGENTS_HOME || join(homedir(), '.agents'),
    ))
    const custom = []
    let skippedCustom = 0
    if (Array.isArray(config.customSkillDirs)) {
      for (const entry of config.customSkillDirs) {
        if (typeof entry === 'string' && entry.length > 0) custom.push(resolve(expandHome(entry)))
        // A preset may compute a root with a `!!js` expression; it cannot be
        // read as a path here, so the packaged preset root below covers it.
        else skippedCustom += 1
      }
    }
    const configuredBundled = typeof config.bundledSkillDir === 'string' && config.bundledSkillDir.length > 0
      ? resolve(expandHome(config.bundledSkillDir))
      : undefined
    const environmentBundled = includeDefaultRoots && typeof process.env.DSH_BUNDLED_SKILL_DIR === 'string' && process.env.DSH_BUNDLED_SKILL_DIR.length > 0
      ? resolve(expandHome(process.env.DSH_BUNDLED_SKILL_DIR))
      : undefined
    return {
      includeDefaultRoots,
      dshHome,
      agentsHome,
      customSkillDirs: custom,
      skippedCustom,
      bundledSkillDir: configuredBundled ?? environmentBundled,
    }
  })
}

/**
 * The installed preset points at the skill directory that ships beside its own
 * manifest; this is the concrete root behind a computed `customSkillDirs` entry.
 * Resolution goes through the package graph first, so the fallback keeps working
 * if the install layout stops being `<install>/dsh/node_modules/...`.
 */
function packagedPresetSkillsDir() {
  const anchor = process.env.DSH_INSTALL_DIR
  if (typeof anchor !== 'string' || anchor.length === 0) return undefined
  const candidates = []
  try {
    const anchorRequire = createRequire(join(anchor, 'package.json'))
    candidates.push(join(dirname(anchorRequire.resolve('@deepseek-ai/dsh-agent-preset/package.json')), 'skills'))
  } catch {
    // The package graph may be unavailable (a stripped install); fall back below.
  }
  candidates.push(join(anchor, '..', '..', '..', 'node_modules', '@deepseek-ai', 'dsh-agent-preset', 'skills'))
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isDirectory()) return resolve(candidate)
    } catch {
      // Try the next candidate.
    }
  }
  return undefined
}

function listWorkspaces(scope) {
  const registry = scope.get('workspaceRegistry')
  if (!registry || typeof registry.list !== 'function') return []
  try {
    return registry.list().map((workspace) => ({
      id: String(workspace.id ?? ''),
      path: typeof workspace.path === 'string' ? workspace.path : '',
      title: typeof workspace.title === 'string' ? workspace.title : '',
    })).filter((workspace) => workspace.path.length > 0)
  } catch (error) {
    scope.logger?.warn?.(`skill-manager: cannot list workspaces: ${errorMessage(error)}`)
    return []
  }
}

/**
 * Compute the roots the local filesystem provider scans for this profile.
 * Project roots are resolved per registered workspace, because a global panel
 * has no single session cwd.
 */
function collectRoots(scope) {
  const configs = providerConfigs(scope)
  const workspaces = listWorkspaces(scope)
  const roots = []
  const index = new Map()

  const add = (path, source, workspace) => {
    if (typeof path !== 'string' || path.length === 0) return
    const key = normalizePath(path)
    const existing = index.get(key)
    if (existing) {
      if (workspace && !existing.workspaces.some((entry) => entry.cwd === workspace.cwd)) {
        existing.workspaces.push(workspace)
      }
      return existing
    }
    const info = statDirectory(path)
    const root = {
      path,
      source,
      rank: SOURCE_RANKS[source] ?? 999,
      exists: info.exists,
      isDirectory: info.isDirectory,
      workspaces: workspace ? [workspace] : [],
    }
    roots.push(root)
    index.set(key, root)
    return root
  }

  for (const config of configs) {
    if (config.includeDefaultRoots) {
      for (const workspace of workspaces) {
        const projectRoot = nearestProjectRoot(workspace.path)
        const entry = { cwd: workspace.path, title: workspace.title }
        add(join(projectRoot, '.dsh', 'skills'), 'project-dsh', entry)
        add(join(projectRoot, '.agents', 'skills'), 'project-agents', entry)
      }
    }
    for (const custom of config.customSkillDirs) add(custom, 'custom')
    if (config.skippedCustom > 0) {
      const packaged = packagedPresetSkillsDir()
      if (packaged) add(packaged, 'custom')
    }
  }

  for (const config of configs) {
    if (config.includeDefaultRoots) {
      add(join(config.dshHome, 'skills'), 'user-dsh')
      add(join(config.agentsHome, 'skills'), 'user-agents')
    }
    if (typeof config.bundledSkillDir === 'string') add(config.bundledSkillDir, 'bundled')
  }

  roots.sort((left, right) => left.rank - right.rank || left.path.localeCompare(right.path))

  // A sibling `skills-off` directory is how this machine parks a skill without
  // deleting it: the provider never scans it, so the row must never be offered
  // for editing, but hiding it entirely made "where did that skill go" a
  // filesystem question. Listed separately and read-only.
  const archives = []
  const archiveSeen = new Set()
  for (const config of configs) {
    if (!config.includeDefaultRoots) continue
    for (const [base, source] of [[config.dshHome, 'user-dsh'], [config.agentsHome, 'user-agents']]) {
      if (typeof base !== 'string') continue
      const path = join(base, 'skills-off')
      const key = normalizePath(path)
      if (archiveSeen.has(key)) continue
      archiveSeen.add(key)
      const info = statDirectory(path)
      if (!info.exists || !info.isDirectory) continue
      archives.push({ path, source, rank: SOURCE_RANKS[source] ?? 999 })
    }
  }

  return { roots, workspaces, configs, archives }
}

function rootOfSkillPath(skillPath) {
  const file = resolve(skillPath)
  return basename(file).toLowerCase() === 'skill.md' ? dirname(dirname(file)) : dirname(file)
}

/* -------------------------------------------------------------------------- */
/* Inventory read                                                             */
/* -------------------------------------------------------------------------- */

const KEBAB_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SKILL_FILE_LIMIT = 1024 * 1024
const BOOLEAN_TRUE = new Set(['true', 'yes', 'on', '1'])
const BOOLEAN_FALSE = new Set(['false', 'no', 'off', '0'])

function parseScalar(raw) {
  const value = raw.trim()
  if (value.length === 0) return ''
  if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
  if (value.length > 1 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  const comment = value.indexOf(' #')
  return comment >= 0 ? value.slice(0, comment).trim() : value
}

function foldBlock(lines, folded) {
  if (!folded) return lines.join('\n')
  let text = ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      text += '\n'
      continue
    }
    text += (text.length > 0 && !text.endsWith('\n') ? ' ' : '') + trimmed
  }
  return text.replace(/\n{2,}/g, '\n').trim()
}

/**
 * Read the top-level frontmatter keys the inventory needs. Nested maps are left
 * unread on purpose: the provider validates only these fields, and a nested
 * map must not be mistaken for a scalar.
 */
function parseFrontmatter(lines) {
  const fields = {}
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].replace(/\r$/, '')
    if (raw.trim().length === 0 || raw.trim().startsWith('#')) continue
    if (/^\s/.test(raw)) continue
    const match = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(raw)
    if (!match) continue
    const key = match[1]
    const rest = match[2].trim()
    if (/^[|>][+-]?$/.test(rest)) {
      const block = []
      while (index + 1 < lines.length) {
        const next = lines[index + 1].replace(/\r$/, '')
        if (next.trim().length > 0 && !/^\s/.test(next)) break
        block.push(next)
        index += 1
      }
      const indents = block
        .filter((line) => line.trim().length > 0)
        .map((line) => /^\s*/.exec(line)[0].length)
      const indent = indents.length > 0 ? Math.min(...indents) : 0
      fields[key] = foldBlock(block.map((line) => line.slice(indent)), rest[0] === '>')
      continue
    }
    fields[key] = parseScalar(rest)
  }
  return fields
}

function strictInvocation(fields) {
  let modelInvocable = true
  let userInvocable = true
  const disableModel = fields['disable-model-invocation']
  if (disableModel !== undefined) {
    const raw = String(disableModel).trim().toLowerCase()
    if (!BOOLEAN_TRUE.has(raw) && !BOOLEAN_FALSE.has(raw)) return undefined
    modelInvocable = !BOOLEAN_TRUE.has(raw)
  }
  const allowUser = fields['user-invocable']
  if (allowUser !== undefined) {
    const raw = String(allowUser).trim().toLowerCase()
    if (!BOOLEAN_TRUE.has(raw) && !BOOLEAN_FALSE.has(raw)) return undefined
    userInvocable = !BOOLEAN_FALSE.has(raw)
  }
  return { modelInvocable, userInvocable }
}

/**
 * Read one skill file exactly as the local provider would reject it: frontmatter
 * must exist, `name` must be kebab-case, `description` must be present, and an
 * invocation value must be a boolean spelling rather than silently permitting a
 * surface.
 */
function readSkillFile(file) {
  let text
  try {
    const info = statSync(file)
    if (!info.isFile()) return { problem: '不是普通文件' }
    if (info.size > SKILL_FILE_LIMIT) return { problem: `文件超过 ${SKILL_FILE_LIMIT} 字节` }
    text = readFileSync(file, 'utf8')
  } catch (error) {
    return { problem: `无法读取：${errorMessage(error)}` }
  }
  const split = splitFrontmatter(text)
  if (!split) return { problem: '缺少以 --- 包围的 YAML frontmatter' }
  const fields = parseFrontmatter(split.lines.slice(1, split.closing))
  const name = typeof fields.name === 'string' ? fields.name : ''
  if (!KEBAB_PATTERN.test(name)) return { problem: 'name 不是 kebab-case' }
  const rawDescription = typeof fields.description === 'string' ? fields.description : ''
  if (rawDescription.length === 0) return { problem: '缺少 description' }
  const description = rawDescription.trim()
  const invocation = strictInvocation(fields)
  if (!invocation) return { problem: 'disable-model-invocation / user-invocable 不是布尔值' }
  const whenToUse = typeof fields.whenToUse === 'string' ? fields.whenToUse.trim() : ''
  return {
    name,
    description,
    ...(whenToUse.length > 0 ? { whenToUse } : {}),
    ...invocation,
    // Kept for the reference scan in `discover()` and dropped there: the body is
    // never part of the inventory response.
    text,
  }
}

/**
 * Skill-file references written inside a router body. Routers point at their
 * leaves with hand-written paths (`~/.dsh/skills/<name>/SKILL.md`), so a rename
 * or a move silently degrades into a failed `read` at task time. Only paths
 * that name a `.md` under a `.dsh`/`.agents` `skills` root count; the page uses
 * this list to mark each row as a router, a leaf, or a broken link.
 */
const SKILL_REF_PATTERN = /(?:~|[A-Za-z]:)[\\/](?:(?:[^\s`'"|<>()[\]{}]+[\\/])*(?:\.dsh|\.agents)[\\/]skills|(?:[^\s`'"|<>()[\]{}]+[\\/])*app\.asar[\\/]dsh[\\/]skills)[\\/][\w.-]+[\\/][\w.-]+\.md/gi

/**
 * Extract the distinct skill files one body references.
 * @param text - full skill file text.
 * @returns one entry per target: the path as written, plus whether it resolves.
 */
function scanRouteReferences(text) {
  if (typeof text !== 'string' || text.length === 0) return []
  const seen = new Map()
  SKILL_REF_PATTERN.lastIndex = 0
  let match
  while ((match = SKILL_REF_PATTERN.exec(text)) !== null) {
    const raw = match[0]
    const expanded = expandHome(raw)
    const key = normalizePath(expanded)
    if (seen.has(key)) continue
    const archive = isArchivePath(raw)
    // A path inside app.asar cannot be probed from Node: the archive is a
    // single file, so `existsSync` reports false for every entry inside it.
    seen.set(key, archive ? { path: raw, exists: false, archive: true } : { path: raw, exists: existsSync(expanded) })
  }
  return [...seen.values()]
}

/** List the direct `<name>/SKILL.md` bundles and `*.md` files of one root. */
function scanRoot(root, warnings) {
  const found = []
  let entries
  try {
    entries = readdirSync(root.path, { withFileTypes: true })
  } catch (error) {
    warnings.push(`无法读取扫描根 ${root.path}：${errorMessage(error)}`)
    return found
  }
  for (const dirent of entries) {
    if (typeof dirent?.name !== 'string' || dirent.name.startsWith('.')) continue
    const fullPath = join(root.path, dirent.name)
    let directory
    try {
      const info = statSync(fullPath)
      if (!info.isDirectory() && !info.isFile()) continue
      directory = info.isDirectory()
    } catch {
      continue
    }
    let file
    if (directory) {
      // The provider resolves `<directory>/SKILL.md` and ignores a directory
      // without one; the directory's own name carries no skill identity.
      file = join(fullPath, 'SKILL.md')
      try {
        if (!statSync(file).isFile()) continue
      } catch {
        continue
      }
    } else {
      // A flat file is a candidate only when it ends in `.md`; its frontmatter
      // supplies the skill name.
      if (!dirent.name.endsWith('.md')) continue
      file = fullPath
    }
    const parsed = readSkillFile(file)
    if (parsed.problem) {
      warnings.push(`${file}：${parsed.problem}`)
      continue
    }
    found.push({ ...parsed, file })
  }
  return found
}

/**
 * Discover the skills on disk instead of asking `ctx.skills`. The registry is
 * layered: the profile root mounts only the registry, while every preset mounts
 * the local provider inside its own scope, so a host-level snapshot always sees
 * zero providers. Scanning the same roots with the provider's rules gives the
 * page both the inventory and the file paths it needs to edit.
 */
function discover(scope) {
  const { roots, workspaces, archives } = collectRoots(scope)
  const warnings = []
  const byPath = new Map()

  for (const root of roots) {
    if (!root.exists || !root.isDirectory) continue
    for (const skill of scanRoot(root, warnings)) {
      const key = normalizePath(skill.file)
      const existing = byPath.get(key)
      if (existing) {
        for (const workspace of root.workspaces) {
          if (!existing.workspaces.includes(workspace.cwd)) existing.workspaces.push(workspace.cwd)
        }
        continue
      }
      byPath.set(key, {
        name: skill.name,
        description: skill.description,
        ...(skill.whenToUse ? { whenToUse: skill.whenToUse } : {}),
        path: skill.file,
        source: root.source,
        provider: 'filesystem',
        modelInvocable: skill.modelInvocable,
        userInvocable: skill.userInvocable,
        workspaces: root.workspaces.map((workspace) => workspace.cwd),
        workspaceTitles: root.workspaces
          .map((workspace) => workspace.title)
          .filter((title) => typeof title === 'string' && title.length > 0),
        rank: root.rank,
        __text: skill.text,
      })
    }
  }

  const skills = [...byPath.values()]

  // Router skills name their leaves with hand-written paths. Resolve that graph
  // now so a renamed or moved leaf surfaces as a broken link instead of a failed
  // `read` at task time. Only model-visible bodies count as evidence: a skill the
  // model cannot discover cannot route anything on its own, and its body only
  // reaches a context when the user names it explicitly.
  const referencedBy = new Map()
  for (const skill of skills) {
    const text = skill.__text
    delete skill.__text
    skill.references = []
    if (skill.modelInvocable === false) continue
    const refs = scanRouteReferences(text)
    skill.references = refs
    for (const ref of refs) {
      if (!ref.exists) continue
      const key = normalizePath(expandHome(ref.path))
      const names = referencedBy.get(key)
      if (names) names.add(skill.name)
      else referencedBy.set(key, new Set([skill.name]))
    }
  }
  for (const skill of skills) {
    const names = referencedBy.get(normalizePath(skill.path))
    skill.referencedBy = names ? [...names].sort() : []
  }
  const brokenLinks = skills.reduce((total, skill) => total
    + skill.references.filter((ref) => !ref.exists && !ref.archive).length, 0)
  if (brokenLinks > 0) {
    warnings.push(`${brokenLinks} 处路由引用指向不存在的技能文件，读过去会失败。`)
  }
  // The reference graph is only useful if it can be read as a hierarchy: map
  // each resolved target back to an inventory entry, then derive one role per
  // skill from its in/out degree. No heuristics on names or descriptions.
  const nameByPath = new Map(skills.map((skill) => [normalizePath(skill.path), skill.name]))
  for (const skill of skills) {
    skill.references = skill.references.map((ref) => {
      if (!ref.exists) return ref
      const target = nameByPath.get(normalizePath(expandHome(ref.path)))
      return typeof target === 'string' ? { ...ref, target } : ref
    })
  }
  for (const skill of skills) {
    const outbound = skill.references.length
    const inbound = skill.referencedBy.length
    skill.role = outbound > 0 && inbound > 0 ? 'middle'
      : outbound > 0 ? 'router'
        : inbound > 0 ? 'leaf'
          : 'standalone'
  }

  const archivedSkills = []
  for (const archive of archives) {
    for (const skill of scanRoot(archive, warnings)) {
      archivedSkills.push({
        name: skill.name,
        description: skill.description,
        path: skill.file,
        source: archive.source,
        archived: true,
      })
    }
  }
  archivedSkills.sort((left, right) => left.name.localeCompare(right.name))
  if (archivedSkills.length > 0) {
    warnings.push(`${archivedSkills.length} 个技能已移出扫描根（${archives.map((entry) => entry.path).join('、')}），模型看不到它们；要让它们回来，得把目录移回 skills。`)
  }

  const appliesEverywhere = (skill) => skill.workspaces.length === 0
  const overlaps = (left, right) => appliesEverywhere(left)
    || appliesEverywhere(right)
    || left.workspaces.some((cwd) => right.workspaces.includes(cwd))
  let shadowed = 0
  for (const skill of skills) {
    skill.shadowed = skills.some((other) => other !== skill
      && other.name === skill.name
      && other.rank < skill.rank
      && overlaps(other, skill))
    if (skill.shadowed) shadowed += 1
  }
  if (shadowed > 0) {
    warnings.push(`${shadowed} 个技能被更高优先级扫描根里的同名技能覆盖，改动它们不会影响模型看到的目录。`)
  }
  if (workspaces.length === 0) {
    warnings.push('还没有注册任何工作区，项目级扫描根未列出。')
  }

  skills.sort((left, right) => left.rank - right.rank
    || left.name.localeCompare(right.name)
    || left.path.localeCompare(right.path))

  return { roots, archives, archivedSkills, skills, warnings }
}

async function readInventory(scope) {
  const { roots, archives, archivedSkills, skills, warnings } = discover(scope)
  return {
    value: {
      ok: true,
      generatedAt: new Date().toISOString(),
      roots,
      archives,
      archivedSkills,
      skills,
      warnings,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Frontmatter editing                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Split a skill file's leading YAML frontmatter, preserving each line's own
 * line ending and any BOM. Returns `undefined` when the provider would reject
 * the file's frontmatter shape.
 */
function splitFrontmatter(text) {
  const bom = text.charCodeAt(0) === 0xfeff
  const source = bom ? text.slice(1) : text
  const lines = source.split('\n')
  const first = lines[0]?.replace(/\r$/, '')
  if (first !== '---') return undefined
  let closing = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].replace(/\r$/, '') === '---') {
      closing = index
      break
    }
  }
  if (closing < 0) return undefined
  return { bom, lines, closing }
}

function parseInvocation(text) {
  const split = splitFrontmatter(text)
  const result = { modelInvocable: true, userInvocable: true }
  if (!split) return result
  for (const line of split.lines.slice(1, split.closing)) {
    const match = /^["']?(disable-model-invocation|user-invocable)["']?\s*:\s*(.*?)\s*$/.exec(line.replace(/\r$/, ''))
    if (!match) continue
    const raw = match[2].replace(/^['"]|['"]$/g, '').toLowerCase()
    const truthy = raw === 'true' || raw === 'yes' || raw === 'on' || raw === '1'
    if (match[1] === 'disable-model-invocation') result.modelInvocable = !truthy
    else result.userInvocable = !(raw === 'false' || raw === 'no' || raw === 'off' || raw === '0')
  }
  return result
}

/**
 * Return the rewritten file text with only the two invocation keys touched.
 * Enabling a surface removes its key (the provider's default permits it);
 * disabling it writes the canonical key, so unrelated frontmatter and comments
 * are preserved.
 */
function rewriteInvocation(text, next) {
  const split = splitFrontmatter(text)
  if (!split) return { code: 'frontmatter_missing', message: 'The skill file has no YAML frontmatter block.' }

  const desired = new Map()
  if (next.modelInvocable === false) desired.set(INVOCATION_KEYS.modelInvocable, 'disable-model-invocation: true')
  if (next.userInvocable === false) desired.set(INVOCATION_KEYS.userInvocable, 'user-invocable: false')

  const frontmatter = split.lines.slice(1, split.closing)
  const lineEnding = split.lines[0].endsWith('\r') || split.lines[1]?.endsWith('\r') ? '\r' : ''
  const output = []
  const emitted = new Set()
  for (const line of frontmatter) {
    const bare = line.replace(/\r$/, '')
    const match = /^["']?(disable-model-invocation|user-invocable)["']?\s*:/.exec(bare)
    if (!match) {
      output.push(line)
      continue
    }
    const key = match[1]
    if (emitted.has(key) || !desired.has(key)) continue
    emitted.add(key)
    output.push(`${desired.get(key)}${lineEnding}`)
  }
  for (const [key, line] of desired) {
    if (emitted.has(key)) continue
    output.push(`${line}${lineEnding}`)
  }

  const nameLine = output.some((line) => /^name\s*:\s*\S/.test(line.replace(/\r$/, '')))
  const descriptionLine = output.some((line) => /^description\s*:\s*\S/.test(line.replace(/\r$/, '')))
  if (!nameLine || !descriptionLine) {
    return { code: 'frontmatter_invalid', message: 'The frontmatter no longer declares a name and description.' }
  }

  const rebuilt = [
    split.lines[0],
    ...output,
    split.lines[split.closing],
    ...split.lines.slice(split.closing + 1),
  ].join('\n')
  return { text: split.bom ? `\uFEFF${rebuilt}` : rebuilt }
}

/* -------------------------------------------------------------------------- */
/* File access (filesystem service first, Node fallback)                       */
/* -------------------------------------------------------------------------- */

async function resolveTarget(scope, path) {
  const fs = scope.get('fs')
  if (fs && typeof fs.resolve === 'function') {
    const target = await fs.resolve(path)
    return { fs, target, displayPath: target.displayPath ?? path }
  }
  return { fs: undefined, target: undefined, displayPath: path }
}

async function readSkillText(scope, path) {
  const { fs, target } = await resolveTarget(scope, path)
  if (fs && typeof fs.readText === 'function') return await fs.readText(target)
  return readFileSync(path, 'utf8')
}

/**
 * Stat-derived freshness token for the Node fallback writer. A host without the
 * `fs` service has no provider version to compare, so `mtime:size` stands in for
 * one and is read again immediately before the atomic rename.
 */
function nodeFileVersion(path) {
  const info = statSync(path)
  return `${info.mtimeMs}:${info.size}`
}

function nodeFileVersionSafe(path) {
  try {
    return nodeFileVersion(path)
  } catch {
    return undefined
  }
}

/**
 * Read the freshness tokens of one skill file before its content is read. Both
 * are captured because the read and the write may take different paths: a
 * provider-backed write needs the provider's opaque version, while the Node
 * fallback can only compare the filesystem's own stat.
 */
async function readVersion(scope, path) {
  const { fs, target } = await resolveTarget(scope, path)
  let provider
  if (fs && typeof fs.stat === 'function') {
    const info = await fs.stat(target)
    provider = info?.version
  }
  return { provider, native: nodeFileVersionSafe(path) }
}

function staleVersionError(path) {
  return Object.assign(
    new Error(`cannot write "${path}": the file changed since it was read`),
    { code: 'FS_STALE_VERSION' },
  )
}

/**
 * Write one file through a sibling temp file and an atomic rename. `expected` is
 * the stat token captured before the content was read; a difference means
 * another surface edited the file in between, so the rename is refused with
 * `FS_STALE_VERSION` instead of silently overwriting that edit. The temp file
 * never outlives a failed attempt: the scanner skips dot files, but an aborted
 * write still should not leave litter in a user skill directory.
 */
function atomicNodeWrite(path, text, expected) {
  const temp = join(dirname(path), `.${basename(path)}.dsh-skill-manager-${process.pid}-${Date.now()}.tmp`)
  try {
    writeFileSync(temp, text, 'utf8')
    if (typeof expected === 'string' && nodeFileVersionSafe(path) !== expected) throw staleVersionError(path)
    renameSync(temp, path)
  } catch (error) {
    try {
      unlinkSync(temp)
    } catch {
      // Nothing to remove: the rename succeeded, or the temp file was never created.
    }
    throw error
  }
}

async function writeSkillText(scope, path, text, versions, writableRoot) {
  const { fs, target } = await resolveTarget(scope, path)
  if (fs && typeof fs.writeText === 'function') {
    // This user action edits a file outside the agent workspace; declare the
    // skill's own scan root as the writable scope so a sandboxed backend fences
    // the write to that root instead of applying the session workspace policy.
    const sandboxPolicy = typeof writableRoot === 'string' && writableRoot.length > 0
      ? { mode: 'workspace-write', workspaceRoot: writableRoot }
      : undefined
    const outcome = await fs.writeText(
      target,
      text,
      versions?.provider ? { kind: 'replaceIfVersion', version: versions.provider } : undefined,
      undefined,
      sandboxPolicy,
    )
    return outcome
  }
  atomicNodeWrite(path, text, versions?.native)
  // Report the version the caller can observe afterwards, so the invalidation
  // hint below fires on the fallback path too.
  return { operation: 'update', version: nodeFileVersionSafe(path) }
}

/* -------------------------------------------------------------------------- */
/* Request handlers                                                            */
/* -------------------------------------------------------------------------- */

async function handleInventory(scope) {
  const inventory = await readInventory(scope)
  if (inventory.error) return inventory.error
  return jsonResponse(200, inventory.value)
}

async function readBody(request) {
  const length = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return { error: failure(413, 'body_too_large', 'Request body is too large.') }
  }
  const type = request.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) {
    return { error: failure(415, 'unsupported_media_type', 'Expected an application/json request body.') }
  }
  const text = await request.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    return { error: failure(413, 'body_too_large', 'Request body is too large.') }
  }
  try {
    const value = JSON.parse(text)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('not an object')
    return { value }
  } catch {
    return { error: failure(400, 'invalid_body', 'Request body is not valid JSON.') }
  }
}

function assertFlags(value) {
  const next = {}
  for (const key of ['modelInvocable', 'userInvocable']) {
    if (value[key] === undefined) continue
    if (typeof value[key] !== 'boolean') return undefined
    next[key] = value[key]
  }
  return Object.keys(next).length > 0 ? next : undefined
}

async function handleInvocation(scope, request) {
  const body = await readBody(request)
  if (body.error) return body.error
  if (typeof body.value.path !== 'string' || body.value.path.length === 0) {
    return failure(400, 'invalid_body', 'A skill path is required.')
  }
  const requested = assertFlags(body.value)
  if (!requested) return failure(400, 'invalid_body', 'At least one boolean invocation flag is required.')

  const inventory = await readInventory(scope)
  if (inventory.error) return inventory.error
  const key = normalizePath(body.value.path)
  const skill = inventory.value.skills.find((entry) => normalizePath(entry.path) === key)
  if (!skill) {
    return failure(404, 'skill_not_found', 'That file is not a skill the current scan roots expose.')
  }
  // Anything inside the installation archive is read-only for the app, no
  // matter which scan source reported it: the preset's packaged skills arrive
  // as `custom`, so a source-name check alone would let the write through and
  // fail deeper with a filesystem error.
  if (isArchivePath(skill.path)) {
    return failure(403, 'read_only_source', 'This skill lives inside the installation archive and cannot be edited.')
  }

  let versions
  try {
    versions = await readVersion(scope, skill.path)
  } catch {
    // A file that cannot be versioned is still written unconditionally; the
    // content read below reports a real failure first.
    versions = undefined
  }

  let currentText
  try {
    currentText = await readSkillText(scope, skill.path)
  } catch (error) {
    return failure(500, 'read_failed', `Cannot read the skill file: ${errorMessage(error)}`)
  }

  // The inventory may lag a concurrent edit, so read the file's own flags for
  // the surface the caller did not ask to change.
  const current = parseInvocation(currentText)
  const next = {
    modelInvocable: requested.modelInvocable ?? current.modelInvocable,
    userInvocable: requested.userInvocable ?? current.userInvocable,
  }

  const rewritten = rewriteInvocation(currentText, next)
  if (rewritten.code) return failure(422, rewritten.code, rewritten.message)
  let outcome
  try {
    outcome = await writeSkillText(scope, skill.path, rewritten.text, versions, rootOfSkillPath(skill.path))
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'write_failed'
    return failure(code === 'FS_STALE_VERSION' ? 409 : 500, code === 'FS_STALE_VERSION' ? 'stale_file' : 'write_failed', `Cannot write the skill file: ${errorMessage(error)}`)
  }

  // Match the first-party write/edit invalidation path: the skill provider
  // records this observation synchronously and refreshes its inventory for the
  // next model step without waiting for the file watcher.
  const writtenVersion = outcome && typeof outcome.version === 'string' ? outcome.version : undefined
  if (writtenVersion !== undefined) {
    try {
      const { target } = await resolveTarget(scope, skill.path)
      // A host without an `fs` service has no provider target to hand over, and
      // the listeners only key off the display path, so a local stand-in records
      // the same invalidation there.
      const observed = target ?? { targetKey: skill.path, displayPath: skill.path }
      scope.emit('fs/observed', observed, { kind: 'present', version: writtenVersion }, { name: 'edit' })
    } catch (error) {
      scope.logger?.warn?.(`skill-manager: invalidation hint failed: ${errorMessage(error)}`)
    }
  }

  const actual = parseInvocation(rewritten.text)
  // The page reads files directly, so the new state is visible as soon as the
  // write lands; the invalidation hint above covers the provider's own inventory.
  return jsonResponse(200, { ok: true, invocation: actual, refreshed: verifyInvocation(skill.path, actual) })
}

function verifyInvocation(path, expected) {
  try {
    const actual = parseInvocation(readFileSync(path, 'utf8'))
    return actual.modelInvocable === expected.modelInvocable && actual.userInvocable === expected.userInvocable
  } catch {
    return false
  }
}

/**
 * Encode one Windows path as the target Explorer can receive intact. Explorer
 * splits its own command line at commas and equals signs, and it rejects
 * percent-encoded non-ASCII by opening the Documents folder instead, so a raw
 * path can silently open the wrong folder.
 */
function explorerTarget(windowsPath) {
  return pathToFileURL(windowsPath, { windows: true }).href
    .replace(/(?:%[89A-F][0-9A-F])+/gi, (escaped) => decodeURIComponent(escaped))
    .replaceAll(',', '%2C')
    .replaceAll('=', '%3D')
}

/**
 * Open one directory in the OS file manager. On Windows the launch must stay
 * visible: a hidden launch sets SW_HIDE on the shell, which hides the Explorer
 * folder window together with the console window.
 */
async function openFolder(scope, path) {
  return await new Promise((done) => {
    const platform = process.platform
    const command = platform === 'win32' ? 'explorer.exe' : platform === 'darwin' ? 'open' : 'xdg-open'
    const args = platform === 'win32' ? [explorerTarget(path)] : [path]
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      done(value)
    }
    let child
    try {
      child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: false })
    } catch (error) {
      finish({ ok: false, code: 'reveal_failed', message: errorMessage(error) })
      return
    }
    const timer = setTimeout(() => finish({ ok: true }), REVEAL_SPAWN_TIMEOUT_MS)
    child.once('error', (error) => {
      clearTimeout(timer)
      scope.logger?.warn?.(`skill-manager: cannot open folder: ${errorMessage(error)}`)
      finish({ ok: false, code: 'reveal_failed', message: errorMessage(error) })
    })
    child.once('spawn', () => {
      clearTimeout(timer)
      child.unref()
      finish({ ok: true })
    })
  })
}

async function handleReveal(scope, request) {
  const body = await readBody(request)
  if (body.error) return body.error
  if (typeof body.value.path !== 'string' || body.value.path.length === 0) {
    return failure(400, 'invalid_body', 'A folder path is required.')
  }
  const key = normalizePath(body.value.path)
  const inventory = await readInventory(scope)
  if (inventory.error) return inventory.error
  const root = inventory.value.roots.find((entry) => normalizePath(entry.path) === key)
  if (!root) return failure(403, 'unknown_root', 'That folder is not a current skill scan root.')
  if (!root.isDirectory) return failure(404, 'missing_root', 'That scan root does not exist on this machine.')
  if (isArchivePath(root.path)) {
    return failure(422, 'unsupported_root', 'A directory inside the installation archive cannot be opened in the file manager.')
  }
  const result = await openFolder(scope, root.path)
  return result.ok ? jsonResponse(200, { ok: true }) : failure(500, result.code, result.message)
}

/* -------------------------------------------------------------------------- */
/* Plugin entry                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Register the authenticated skill-manager routes for the browser page.
 * @param ctx - host plugin context.
 */
export function apply(ctx) {
  ctx.inject(['connection'], (scope) => {
    const connection = scope.get('connection')
    const fetchRoutes = connection?.fetch
    if (!fetchRoutes || typeof fetchRoutes.register !== 'function') {
      scope.logger?.warn?.('skill-manager: the connection fetch channel is unavailable; the page cannot load.')
      return
    }
    const register = fetchRoutes.register.bind(fetchRoutes)
    const route = (handler) => async (request) => {
      try {
        return await handler(request)
      } catch (error) {
        scope.logger?.warn?.(`skill-manager: route failed: ${errorMessage(error)}`)
        return failure(500, 'internal_error', errorMessage(error))
      }
    }

    scope.effect(() => register({
      path: INVENTORY_PATH,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: route(async () => await handleInventory(scope)),
    }), 'skill-manager: inventory route')

    scope.effect(() => register({
      path: INVOCATION_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: route(async (request) => await handleInvocation(scope, request)),
    }), 'skill-manager: invocation route')

    scope.effect(() => register({
      path: REVEAL_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: route(async (request) => await handleReveal(scope, request)),
    }), 'skill-manager: reveal route')
  })
}