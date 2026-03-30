/**
 * migrate.js
 * Simple file-based migration runner.
 * 
 * - Reads all *.sql files from /migrations, ordered by filename
 * - Tracks applied migrations in a `schema_migrations` table
 * - Skips already-applied migrations (idempotent)
 * - Run on server start, or manually: node server/src/db/migrate.js
 */

import pg from 'pg'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '../../migrations')

async function migrate(connectionString) {
  if (!connectionString) {
    console.warn('[migrate] No DATABASE_URL — skipping migrations')
    return
  }

  const client = new pg.Client({ connectionString })
  await client.connect()

  try {
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         SERIAL PRIMARY KEY,
        filename   TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    // Get already-applied migrations
    const { rows } = await client.query('SELECT filename FROM schema_migrations ORDER BY filename')
    const applied = new Set(rows.map(r => r.filename))

    // Read migration files, sorted
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort()

    let ran = 0
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] ✓ ${file} (already applied)`)
        continue
      }

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
        console.error(`[migrate] ❌ ${file} failed:`, err.message)
        throw err
      }
    }

    if (ran === 0) console.log('[migrate] Nothing to migrate.')
    else console.log(`[migrate] Applied ${ran} migration(s).`)

  } finally {
    await client.end()
  }
}

// Allow running directly: node server/src/db/migrate.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }
  migrate(url).catch(err => {
    console.error(err)
    process.exit(1)
  })
}

export { migrate }
