#!/usr/bin/env node
/**
 * skill-index — semantic index for the big skill libraries.
 *
 * The 26-entry model catalog is left alone: a model reading 26 descriptions
 * already outranks an embedding model at deciding what a vague complaint means.
 * This index exists for the libraries that never enter the catalog at all —
 * ~/.dsh/design-library (135 skills) and ~/.dsh/skills-off (13) — where the only
 * current option is reading INDEX.md and paging through by hand.
 *
 * The index is a rebuildable cache, never the source of truth: SKILL.md files
 * stay authoritative, this file only speeds up finding one.
 *
 *   node scripts/skill-index.mjs build [--force]
 *   node scripts/skill-index.mjs query "这个按钮点着没反应" [--top 5]
 *   node scripts/skill-index.mjs status
 *
 * Ollama must be running with the model pulled (default bge-m3, 1.2 GB). The
 * model unloads on its own after keep_alive; nothing stays resident.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434'
const MODEL = process.env.SKILL_EMBED_MODEL || 'bge-m3'
const DATA_DIR = join(homedir(), '.dsh', 'skill-index')
const META_FILE = join(DATA_DIR, 'meta.json')
const BIN_FILE = join(DATA_DIR, 'emb.bin')
const BODY_CHARS = 2000
const KEEP_ALIVE = process.env.SKILL_EMBED_KEEP_ALIVE || '2m'

const ROOTS = [
  { base: join(homedir(), '.dsh', 'design-library'), kind: 'design' },
  { base: join(homedir(), '.dsh', 'skills-off'), kind: 'parked' },
]

function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!match) return { fields: {}, body: text }
  const fields = {}
  for (const line of match[1].split(/\r?\n/)) {
    if (line.startsWith(' ') || line.startsWith('\t')) continue
    const at = line.indexOf(':')
    if (at < 1) continue
    fields[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^["']|["']$/g, '')
  }
  return { fields, body: text.slice(match[0].length) }
}

function walkSkills(base, kind, found) {
  if (!existsSync(base)) return
  const stack = [base]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue
        stack.push(full)
        continue
      }
      if (entry.name !== 'SKILL.md') continue
      let text
      try {
        text = readFileSync(full, 'utf8')
      } catch {
        continue
      }
      const { fields, body } = parseFrontmatter(text)
      if (!fields.name) continue
      let bytes = 0
      let mtimeMs = 0
      try {
        const info = statSync(full)
        bytes = info.size
        mtimeMs = info.mtimeMs
      } catch {}
      found.push({
        name: fields.name,
        description: (fields.description || '').replace(/\s+/g, ' ').trim(),
        path: full,
        kind,
        bytes,
        mtimeMs,
        text: (body || '').replace(/\s+/g, ' ').trim().slice(0, BODY_CHARS),
      })
    }
  }
}

function collect() {
  const found = []
  for (const root of ROOTS) walkSkills(root.base, root.kind, found)
  found.sort((a, b) => a.path.localeCompare(b.path))
  return found
}

async function embedBatch(texts) {
  const response = await fetch(OLLAMA + '/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: texts, keep_alive: KEEP_ALIVE }),
  })
  if (!response.ok) throw new Error('ollama embed failed: ' + response.status + ' ' + (await response.text()).slice(0, 200))
  const payload = await response.json()
  if (!Array.isArray(payload.embeddings) || payload.embeddings.length !== texts.length) {
    throw new Error('ollama returned ' + (payload.embeddings || []).length + ' vectors for ' + texts.length + ' texts')
  }
  return payload.embeddings
}

async function embedAll(texts, onProgress) {
  const out = []
  const size = 16
  for (let at = 0; at < texts.length; at += size) {
    const chunk = texts.slice(at, at + size)
    out.push(...(await embedBatch(chunk)))
    if (onProgress) onProgress(Math.min(texts.length, at + size), texts.length)
  }
  return out
}

function docText(item) {
  return item.name + '\n' + item.description + '\n' + item.text
}

async function build(force) {
  const items = collect()
  if (items.length === 0) throw new Error('no SKILL.md found under the library roots')
  if (!force && existsSync(META_FILE) && existsSync(BIN_FILE)) {
    const meta = JSON.parse(readFileSync(META_FILE, 'utf8'))
    if (meta.model === MODEL && meta.items.length === items.length
      && meta.items.every((old, at) => old.path === items[at].path && old.mtimeMs === items[at].mtimeMs && old.bytes === items[at].bytes)) {
      process.stdout.write('index is current: ' + items.length + ' skills, model ' + MODEL + '\n')
      return meta
    }
  }
  process.stdout.write('embedding ' + items.length + ' skills with ' + MODEL + '...\n')
  const vectors = await embedAll(items.map(docText), (done, total) => {
    if (done % 64 === 0 || done === total) process.stdout.write('  ' + done + '/' + total + '\n')
  })
  const dim = vectors[0].length
  const flat = new Float32Array(items.length * dim)
  vectors.forEach((vec, index) => flat.set(vec, index * dim))
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(BIN_FILE, Buffer.from(flat.buffer))
  const meta = {
    model: MODEL,
    dim,
    builtAt: new Date().toISOString(),
    bodyChars: BODY_CHARS,
    items: items.map(({ text, ...rest }) => rest),
  }
  writeFileSync(META_FILE, JSON.stringify(meta, null, 2))
  process.stdout.write('index written: ' + DATA_DIR + ' (' + items.length + ' x ' + dim + ')\n')
  return meta
}

function loadIndex() {
  if (!existsSync(META_FILE) || !existsSync(BIN_FILE)) {
    throw new Error('no index yet: run "node scripts/skill-index.mjs build"')
  }
  const meta = JSON.parse(readFileSync(META_FILE, 'utf8'))
  const buffer = readFileSync(BIN_FILE)
  const flat = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4)
  return { meta, flat }
}

function cosine(flat, at, dim, query) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < dim; i += 1) {
    const a = flat[at * dim + i]
    const b = query[i]
    dot += a * b
    na += a * a
    nb += b * b
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb)
}

async function query(text, top) {
  const { meta, flat } = loadIndex()
  const [vector] = await embedBatch([text])
  const rows = meta.items.map((item, at) => ({
    ...item,
    score: cosine(flat, at, meta.dim, vector),
  }))
  rows.sort((a, b) => b.score - a.score)
  return rows.slice(0, top)
}

async function status() {
  if (!existsSync(META_FILE)) {
    process.stdout.write('no index\n')
    return
  }
  const meta = JSON.parse(readFileSync(META_FILE, 'utf8'))
  const bytes = statSync(BIN_FILE).size
  process.stdout.write('model ' + meta.model + ' · ' + meta.items.length + ' skills · dim ' + meta.dim
    + ' · ' + (bytes / 1024 / 1024).toFixed(2) + ' MB · built ' + meta.builtAt + '\n')
  const byKind = {}
  for (const item of meta.items) byKind[item.kind] = (byKind[item.kind] || 0) + 1
  process.stdout.write('kinds: ' + JSON.stringify(byKind) + '\n')
}

function parseArgs(argv) {
  const [command, ...rest] = argv
  let top = 5
  const words = []
  for (let at = 0; at < rest.length; at += 1) {
    if (rest[at] === '--top') { top = Number(rest[at + 1]) || 5; at += 1 }
    else if (rest[at] === '--force') continue
    else words.push(rest[at])
  }
  return { command, text: words.join(' '), top, force: rest.includes('--force') }
}

const { command, text, top, force } = parseArgs(process.argv.slice(2))
try {
  if (command === 'build') {
    await build(force)
  } else if (command === 'query') {
    if (!text.trim()) throw new Error('query needs text')
    for (const row of await query(text, top)) {
      process.stdout.write(row.score.toFixed(3) + '  [' + row.kind + '] ' + row.name
        + '  (' + (row.bytes / 1024).toFixed(1) + ' KB)\n    ' + row.path + '\n')
    }
  } else if (command === 'status') {
    await status()
  } else {
    process.stdout.write('usage: skill-index.mjs build [--force] | query "text" [--top N] | status\n')
  }
} catch (error) {
  process.stderr.write('skill-index: ' + (error instanceof Error ? error.message : String(error)) + '\n')
  process.exitCode = 1
}
