import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve, relative, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = resolve(root, 'dist')
const html = await readFile(join(dist, 'index.html'), 'utf8')
for (const pattern of [
  /<title>[^<]+<\/title>/,
  /rel="icon"/,
  /name="description"/,
  /property="og:title"/,
  /property="og:image"/,
])
  assert.match(html, pattern)
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const value = match[1]
  if (/^(https?:|data:|#)/.test(value)) continue
  assert.ok(!value.startsWith('/'), `Root-absolute asset URL: ${value}`)
  assert.ok(
    (await stat(resolve(dist, value))).isFile(),
    `Missing asset: ${value}`,
  )
}
let exportBytes = 0,
  sourceBytes = 0,
  fileCount = 0
const excluded = new Set([
  '.git',
  '.github',
  '.imd',
  '.agents',
  '.codex',
  '.aws',
])
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const name = relative(root, path).replaceAll('\\', '/')
    if (excluded.has(entry.name) || name === 'test/scratch') continue
    if (entry.name === 'node_modules') continue
    assert.ok(
      !entry.name.startsWith('.env'),
      `Environment file in submission: ${name}`,
    )
    assert.ok(!entry.isSymbolicLink(), `Unexpected symlink: ${name}`)
    if (entry.isDirectory()) await walk(path)
    else {
      const bytes = (await stat(path)).size
      sourceBytes += bytes
      fileCount++
      if (name.startsWith('dist/')) {
        exportBytes += bytes
        assert.ok(
          !/\.(map|tgz|zip|gz|br)$/.test(name),
          `Unneeded export packaging: ${name}`,
        )
        if (name.endsWith('.css')) {
          const css = await readFile(path, 'utf8')
          for (const [, value] of css.matchAll(/url\(["']?([^"')]+)["']?\)/g))
            assert.ok(!value.startsWith('/'), `Root-absolute CSS URL: ${value}`)
        }
      }
    }
  }
}
await walk(root)
assert.ok(sourceBytes < 8_388_608, `Payload exceeds 8 MiB: ${sourceBytes}`)
console.log(
  JSON.stringify(
    {
      passed: true,
      files: fileCount,
      staticExportBytes: exportBytes,
      submissionFileBytes: sourceBytes,
      limitBytes: 8_388_608,
      note: 'Uncompressed delivered file sum, excluding dependencies, pinned inputs and scratch; no Git metadata was changed. Dependencies must remain untracked.',
    },
    null,
    2,
  ),
)
