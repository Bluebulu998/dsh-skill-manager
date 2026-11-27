#!/usr/bin/env node
/**
 * Build a shareable tarball: run the checks, pack with npm, then verify that the
 * archive actually contains everything the manifest promises.
 *
 * Usage: npm run pack [-- --force]
 *   --force  overwrite an existing tarball of the same version
 *
 * The `files` whitelist in package.json decides what npm packs, so a file that
 * exists locally but is missing from `files` is absent from the tarball and the
 * plugin breaks only on the recipient's machine. This script fails in that case
 * instead of producing a half-working archive.
 */

import { execFileSync, execSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const force = process.argv.includes('--force')
const problems = []

const fail = (message) => {
  console.error(`pack: ${message}`)
  process.exit(1)
}

const globToRegExp = (pattern) => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')
  return new RegExp(`^${escaped}$`)
}

const tarballName = `${manifest.name.replace(/^@/, '').replace(/\//g, '-')}-${manifest.version}.tgz`
const distDir = join(root, 'dist')
const tarballPath = join(distDir, tarballName)

// A version is a promise to recipients: reusing one for different bytes makes
// the two archives indistinguishable. Refuse unless --force says otherwise.
if (existsSync(tarballPath) && !force) {
  fail(
    `dist/${tarballName} already exists. Bump the version first ` +
      '(npm version patch --no-git-tag-version) or pass --force to overwrite it.',
  )
}

try {
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()
  if (dirty) {
    console.warn('pack: warning: the working tree has uncommitted changes; this tarball matches no commit')
  }
} catch {
  // Not a git checkout: nothing to compare against.
}

for (const name of ['test-host', 'test-frontmatter', 'test-client', 'test-page']) {
  console.log(`pack: ${name}`)
  execFileSync(process.execPath, [join(root, 'scripts', `${name}.mjs`)], { stdio: 'inherit' })
}
execFileSync(process.execPath, [join(root, 'scripts', 'build.mjs')], { stdio: 'inherit' })

mkdirSync(distDir, { recursive: true })
console.log(`pack: npm pack ${manifest.name}@${manifest.version}`)
execSync(`npm pack --pack-destination "${distDir}"`, { cwd: root, stdio: 'inherit' })
if (!existsSync(tarballPath)) fail(`npm pack did not produce dist/${tarballName}`)

const entries = execFileSync('tar', ['-tzf', tarballPath], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const packed = new Set(entries)
const stripDotSlash = (relativePath) => relativePath.replace(/^\.\//, '')
const present = (relativePath) => packed.has(`package/${stripDotSlash(relativePath)}`)

for (const entry of entries) {
  if (!entry.startsWith('package/')) problems.push(`entry outside the package/ root: ${entry}`)
  if (/(^|\/)\.git(\/|$)/.test(entry)) problems.push(`repository metadata leaked into the archive: ${entry}`)
  if (/(^|\/)node_modules(\/|$)/.test(entry)) problems.push(`node_modules leaked into the archive: ${entry}`)
  if (/(^|\/)dist(\/|$)/.test(entry)) problems.push(`dist/ leaked into the archive: ${entry}`)
  if (/(^|\/)AGENTS\.md$/.test(entry)) problems.push(`internal handoff document leaked into the archive: ${entry}`)
  if (/\.tgz$/.test(entry)) problems.push(`another tarball leaked into the archive: ${entry}`)
}

if (!present('package.json')) problems.push('the archive has no package.json')

// Every declared export must be physically packed; that is the check the static
// build cannot make because it only looks at the disk, not at `files`.
for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
  if (typeof target !== 'string') continue
  if (target.includes('*')) {
    const pattern = globToRegExp(`package/${stripDotSlash(target)}`)
    if (!entries.some((entry) => pattern.test(entry))) problems.push(`export ${subpath} matches no packed file: ${target}`)
    continue
  }
  if (!present(target)) problems.push(`export ${subpath} is declared but missing from the archive: ${target}`)
}

const patchPath = manifest.dsh?.bundle?.patch
if (typeof patchPath === 'string' && !present(patchPath.replace(/^\.\//, ''))) {
  problems.push(`dsh.bundle.patch is missing from the archive: ${patchPath}`)
}

// Relative imports in the two runtime files: a future split into ./lib/*.js
// would break recipients silently if the new file were left out of `files`.
for (const file of ['index.js', 'client.js']) {
  const source = readFileSync(join(root, file), 'utf8')
  for (const match of source.matchAll(/(?:from\s*|require\s*\(\s*)['"](\.[^'"]+)['"]/g)) {
    const specifier = match[1]
    const relative = specifier.replace(/^\.\//, '')
    const candidates = [relative, `${relative}.js`, `${relative}/index.js`]
    if (!candidates.some((candidate) => present(candidate))) {
      problems.push(`${file} imports ${specifier}, which is missing from the archive`)
    }
  }
}

let packedManifest
const scratch = mkdtempSync(join(tmpdir(), 'dsh-pack-'))
try {
  execFileSync('tar', ['-xzf', tarballPath, '-C', scratch, 'package/package.json'])
  packedManifest = JSON.parse(readFileSync(join(scratch, 'package', 'package.json'), 'utf8'))
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
if (packedManifest.name !== manifest.name) {
  problems.push(`packed name ${packedManifest.name} does not match ${manifest.name}`)
}
if (packedManifest.version !== manifest.version) {
  problems.push(`packed version ${packedManifest.version} does not match ${manifest.version}`)
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`pack: ${problem}`)
  console.error(`pack: refusing to hand out dist/${tarballName}`)
  process.exit(1)
}

const size = statSync(tarballPath).size
console.log(`pack: dist/${basename(tarballPath)} — ${entries.length} files, ${(size / 1024).toFixed(1)} kB, manifest verified`)