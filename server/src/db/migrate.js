/**
 * migrate.js
 * 
 * File-based migration runner for both Postgres and SQLite.
 * Reads *.sql files from /migrations, ordered by filename.
 * Tracks applied migrations in schema_migrations table.
 * 
 * Standalone: node server/src/db/migrate.js
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '../../migrations')

// ── Postgres ─────────────────────────────────────────────────────────────────

async function migratePostgres(connectionString) {
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         SERIAL PRIMARY KEY,
        filename   TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`)
    const { rows } = await client.query('SELECT filename FROM schema_migrations ORDER BY filename')
    const applied = new Set(rows.map(r => r.filename))
    const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()
    let ran = 0
    for (const file of files) {
      if (applied.has(file)) { console.log(`[migrate] ✓ ${file}`); continue }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`[migrate] ✅ ${file}`)
        ran++
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`[migrate] ❌ ${file}:`, err.message)
        throw err
      }
    }
    if (ran === 0) console.log('[migrate] Nothing to migrate (postgres)')
    else console.log(`[migrate] Applied ${ran} migration(s)`)
  } finally {
    await client.end()
  }
}

// ── SQLite ────────────────────────────────────────────────────────────────────

function migrateSQLite(dbPath, db) {
  // Ensure data directory exists
  const dir = dbPath.replace(/\/[^/]+$/, '')
  if (dir && dir !== '.') mkdirSync(dir, { recursive: true })

  db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      filename    TEXT UNIQUE NOT NULL,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )`).run()

  const applied = new Set(
    db.prepare('SELECT filename FROM schema_migrations ORDER BY filename').all().map(r => r.filename)
  )

  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()
  let ran = 0

  for (const file of files) {
    if (applied.has(file)) { console.log(`[migrate] ✓ ${file}`); continue }

    let sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')

    // Translate Postgres → SQLite syntax
    sql = sql
      .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/gi, "TEXT NOT NULL DEFAULT (datetime('now'))")
      .replace(/TIMESTAMPTZ/gi, 'TEXT')
      .replace(/NOT NULL DEFAULT NOW\(\)/gi, "NOT NULL DEFAULT (datetime('now'))")
      .replace(/DEFAULT NOW\(\)/gi, "DEFAULT (datetime('now'))")
      .replace(/NOW\(\)/gi, "datetime('now')")
      // SQLite doesn't support DESC in index definitions
      .replace(/\s+DESC\s*\)/gi, ')')

    try {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(file)
      console.log(`[migrate] ✅ ${file}`)
      ran++
    } catch (err) {
      console.error(`[migrate] ❌ ${file}:`, err.message)
      throw err
    }
  }

  if (ran === 0) console.log('[migrate] Nothing to migrate (sqlite)')
  else console.log(`[migrate] Applied ${ran} migration(s)`)
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function migrate(connectionStringOrPath, dialect = 'postgres', sqliteDb = null) {
  if (dialect === 'sqlite') {
    migrateSQLite(connectionStringOrPath, sqliteDb)
    return
  }
  await migratePostgres(connectionStringOrPath)
}

// Standalone CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL
  const path = process.env.SQLITE_PATH || './data/talia-town.db'

  if (url) {
    migrate(url, 'postgres').catch(e => { console.error(e); process.exit(1) })
  } else {
    const { default: Database } = await import('better-sqlite3')
    const { mkdirSync } = await import('fs')
    mkdirSync('./data', { recursive: true })
    const db = new Database(path)
    migrate(path, 'sqlite', db)
  }
}
