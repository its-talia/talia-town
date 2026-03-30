#!/usr/bin/env node
/**
 * qa-screenshot.js
 * 
 * Spins up the dev server, opens the game in Playwright/Chromium,
 * waits for PixiJS to render, takes a screenshot, and saves it.
 * 
 * Usage:
 *   node scripts/qa-screenshot.js [--url http://localhost:3000] [--out /tmp/screenshot.png] [--wait 4000]
 * 
 * The script starts the Vite dev server if --url is localhost and no server
 * is already running, waits for the canvas to render, then takes the shot.
 */

import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const getArg = (flag, def) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : def
}

const URL     = getArg('--url',  'http://localhost:3000')
const OUT     = getArg('--out',  resolve(ROOT, 'qa-screenshot.png'))
const WAIT_MS = parseInt(getArg('--wait', '5000'), 10)  // ms to wait for canvas render
const WIDTH   = parseInt(getArg('--width',  '1280'), 10)
const HEIGHT  = parseInt(getArg('--height',  '720'), 10)

// ── Server management ────────────────────────────────────────────────────────
let serverProc = null

async function ensureServerRunning(url) {
  // Check if already up
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    if (res.ok) { console.log(`[qa] Server already running at ${url}`); return null }
  } catch {}

  console.log('[qa] Starting dev server...')
  const proc = spawn('npm', ['run', 'dev', '--workspace=client'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  })

  proc.stdout.on('data', d => process.stdout.write(`[server] ${d}`))
  proc.stderr.on('data', d => process.stderr.write(`[server] ${d}`))

  // Wait for Vite ready signal
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 30000)
    proc.stdout.on('data', data => {
      if (data.toString().includes('Local:')) {
        clearTimeout(timeout)
        resolve()
      }
    })
    proc.on('error', err => { clearTimeout(timeout); reject(err) })
  })

  console.log('[qa] Server ready')
  return proc
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  serverProc = await ensureServerRunning(URL)

  console.log(`[qa] Launching Chromium → ${URL}`)
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setViewportSize({ width: WIDTH, height: HEIGHT })

  // Capture console logs from the page
  page.on('console', msg => console.log(`[page:${msg.type()}] ${msg.text()}`))
  page.on('pageerror', err => console.error(`[page:error] ${err.message}`))

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })

  // Wait for PixiJS canvas to appear
  await page.waitForSelector('canvas', { timeout: 15000 })
  console.log('[qa] Canvas found — waiting for render...')

  // Give PixiJS time to initialize and render
  await page.waitForTimeout(WAIT_MS)

  // Take screenshot
  await page.screenshot({ path: OUT, fullPage: false })
  console.log(`[qa] Screenshot saved → ${OUT}`)

  await browser.close()
  if (serverProc) serverProc.kill()
  process.exit(0)
}

main().catch(err => {
  console.error('[qa] Error:', err.message)
  if (serverProc) serverProc.kill()
  process.exit(1)
})
