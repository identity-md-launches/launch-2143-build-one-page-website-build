import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// This check is read-only with respect to Ethereum. It never requests a
// signature, connects an account, or sends a transaction.
const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(
  process.env.IMD_FRONTEND_DEPENDENCIES
    ? resolve(process.env.IMD_FRONTEND_DEPENDENCIES, 'package.json')
    : resolve(root, 'package.json'),
)
const { chromium } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')
const output = resolve(root, 'test/scratch/browser-validation')
await mkdir(output, { recursive: true })
const types = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}
const dist = resolve(root, 'dist')
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, 'http://localhost').pathname,
    )
    if (!pathname.startsWith('/preview/')) {
      response.writeHead(404).end()
      return
    }
    const filename = resolve(
      dist,
      pathname.slice('/preview/'.length) || 'index.html',
    )
    if (!filename.startsWith(dist + sep)) {
      response.writeHead(403).end()
      return
    }
    response.setHeader(
      'Content-Type',
      types[extname(filename)] ?? 'application/octet-stream',
    )
    response.end(await readFile(filename))
  } catch {
    response.writeHead(404).end('Not found')
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const url = `http://127.0.0.1:${server.address().port}/preview/`
const results = []
let browser
try {
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const scriptErrors = [],
    missingFiles = []
  page.on('pageerror', (error) => scriptErrors.push(error.message))
  page.on('response', (response) => {
    if (response.url().startsWith(url) && response.status() >= 400)
      missingFiles.push(response.url())
  })
  await page.goto(url)
  await page.evaluate(() => document.fonts.ready)
  await page
    .getByRole('button', { name: 'Review purchase', exact: true })
    .waitFor()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 })
    const geometry = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      mainAction: document
        .querySelector('.review-button')
        .getBoundingClientRect().bottom,
      font: document.fonts.check('400 14px "IBM Plex Mono"'),
    }))
    assert.ok(
      geometry.content <= geometry.viewport,
      `Horizontal overflow at ${width}`,
    )
    assert.ok(geometry.font, 'Local font did not load')
    if (width === 390)
      assert.ok(
        geometry.mainAction <= 844,
        'Main action below the first mobile screen',
      )
    await page.screenshot({
      path: resolve(output, `${width}.png`),
      fullPage: true,
    })
    results.push({ name: `layout-${width}`, passed: true, ...geometry })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByRole('button', { name: 'Review purchase', exact: true })
    .click()
  assert.equal(
    await page
      .locator('#brief')
      .evaluate((element) => element === document.activeElement),
    true,
  )
  await page
    .getByText('Describe the website you want to build.', { exact: true })
    .waitFor()
  await page
    .getByRole('button', { name: 'Use an example', exact: true })
    .click()
  assert.ok((await page.locator('#brief').inputValue()).length > 20)
  await page
    .getByRole('button', { name: 'Review purchase', exact: true })
    .click()
  assert.equal(
    await page
      .locator('#payment')
      .evaluate((element) => element === document.activeElement),
    true,
  )
  await page.locator('#payment').fill('0.0000000000000000001')
  await page
    .getByRole('button', { name: 'Review purchase', exact: true })
    .click()
  await page
    .getByText(
      'Enter an ETH amount with up to 18 decimal places, or use Estimate.',
    )
    .waitFor()
  await page.locator('#brief').fill('A site with "double quotes"')
  await page
    .getByRole('button', { name: 'Review purchase', exact: true })
    .click()
  assert.equal(
    await page.locator('#brief').getAttribute('aria-invalid'),
    'true',
  )
  results.push({ name: 'brief-and-payment-validation', passed: true })

  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Connect a wallet' })
  await dialog.waitFor()
  await dialog
    .getByRole('button', { name: 'Coinbase Wallet', exact: true })
    .waitFor()
  // Tab remains in the native modal and Escape restores its trigger.
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab')
    assert.equal(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
      true,
    )
  }
  await page.keyboard.press('Escape')
  assert.equal(
    await page
      .getByRole('button', { name: 'Connect', exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  )
  results.push({ name: 'wallet-sheet-keyboard', passed: true })

  await page.getByRole('link', { name: 'Track a request', exact: true }).click()
  await page.getByRole('button', { name: 'Find request', exact: true }).click()
  assert.equal(
    await page.locator('#request-id').getAttribute('aria-invalid'),
    'true',
  )
  await page.getByRole('button', { name: 'Use transaction hash' }).click()
  await page.getByLabel('Transaction hash', { exact: true }).waitFor()
  results.push({ name: 'tracking-navigation-and-validation', passed: true })
  await page.getByRole('link', { name: 'Build a website', exact: true }).click()
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  results.push({
    name: 'axe',
    passed: audit.violations.length === 0,
    violations: audit.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map(({ target }) => target),
    })),
  })
  assert.equal(
    audit.violations.length,
    0,
    JSON.stringify(audit.violations.map(({ id }) => id)),
  )
  assert.deepEqual(scriptErrors, [])
  assert.deepEqual(missingFiles, [])
  results.push({ name: 'console-and-local-resources', passed: true })
  await writeFile(
    resolve(output, 'results.json'),
    JSON.stringify({ urlPath: '/preview/', results }, null, 2),
  )
  console.log(JSON.stringify({ results }, null, 2))
} finally {
  await browser?.close()
  server.closeAllConnections()
  await new Promise((done) => server.close(done))
}
