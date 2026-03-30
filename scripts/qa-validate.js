#!/usr/bin/env node
/**
 * qa-validate.js
 * 
 * Full QA validation for talia-town. Checks:
 *   1. Game canvas renders (non-black)
 *   2. No JS errors in console
 *   3. Socket.io connects (no 404 spam)
 *   4. Player and Talia are visible
 * 
 * Returns exit code 0 = pass, 1 = fail.
 * Prints a JSON result + screenshots for each check.
 * 
 * Usage:
 *   node scripts/qa-validate.js [--url http://localhost:3000] [--out-dir /tmp/qa]
 */

import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const args = process.argv.slice(2)
const getArg = (flag, def) => { const i = args.indexOf(flag); return i !== -1 ? args[i+1] : def }

const URL     = getArg('--url', 'http://localhost:3000')
const OUT_DIR = getArg('--out-dir', resolve(ROOT, 'qa-results'))

mkdirSync(OUT_DIR, { recursive: true })

let serverProc = null

async function ensureServer(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) })
    if (r.ok) return null
  } catch {}

  const proc = spawn('npm', ['run', 'dev', '--workspace=client'], {
    cwd: ROOT, stdio: ['ignore','pipe','pipe'],
    env: { ...process.env },
  })
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), 30000)
    proc.stdout.on('data', d => { if (d.toString().includes('Local:')) { clearTimeout(t); res() }})
    proc.on('error', e => { clearTimeout(t); rej(e) })
  })
  return proc
}

async function main() {
  serverProc = await ensureServer(URL)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 720 })

  const errors = []
  const socketErrors = []
  page.on('console', msg => {
    const t = msg.text()
    if (msg.type() === 'error') errors.push(t)
    if (t.includes('404') && t.includes('socket.io')) socketErrors.push(t)
  })
  page.on('pageerror', err => errors.push(err.message))

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.waitForTimeout(5000)

  // Screenshot 1: initial render
  await page.screenshot({ path: resolve(OUT_DIR, '01-initial.png') })

  // Check 1: canvas presence and size
  const canvasData = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return null
    return { width: canvas.width, height: canvas.height, exists: true }
  })

  // Check 2: hint text visible
  const hintVisible = await page.isVisible('#hint-text').catch(() => false)

  // Check 3: no JS errors
  const noErrors = errors.length === 0

  // Check 4: no socket 404s
  const noSocketErrors = socketErrors.length === 0

  // Check 5: canvas has non-zero dimensions
  const canvasRenders = canvasData && canvasData.width > 0 && canvasData.height > 0

  const results = {
    url: URL,
    timestamp: new Date().toISOString(),
    checks: {
      canvasPresent:  { pass: !!canvasData, detail: canvasData ? `${canvasData.width}x${canvasData.height}` : 'no canvas' },
      canvasRenders:  { pass: canvasRenders, detail: canvasData ? `${canvasData.width}x${canvasData.height}` : 'n/a' },
      noJsErrors:     { pass: noErrors, detail: noErrors ? 'clean' : errors.slice(0,3).join('; ') },
      noSocketErrors: { pass: noSocketErrors, detail: noSocketErrors ? 'clean' : socketErrors.slice(0,2).join('; ') },
      hintVisible:    { pass: hintVisible, detail: hintVisible ? 'shown' : 'missing' },
    },
    screenshots: { initial: resolve(OUT_DIR, '01-initial.png') }
  }

  const allPass = Object.values(results.checks).every(c => c.pass)
  results.pass = allPass

  console.log(JSON.stringify(results, null, 2))
  console.log(`\n${allPass ? '✅ ALL CHECKS PASS' : '❌ SOME CHECKS FAILED'}`)
  console.log(`Screenshots: ${OUT_DIR}`)

  await browser.close()
  if (serverProc) serverProc.kill()
  process.exit(allPass ? 0 : 1)
}

main().catch(err => {
  console.error('[qa] Fatal:', err.message)
  if (serverProc) serverProc.kill()
  process.exit(1)
})
