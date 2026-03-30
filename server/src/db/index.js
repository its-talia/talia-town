/**
 * db/index.js
 * 
 * Database abstraction layer.
 * 
 * - Production (DATABASE_URL set): Postgres via pg
 * - Local dev (no DATABASE_URL): SQLite via better-sqlite3
 * 
 * Both adapters expose the same interface.
 */

import { migrate } from './migrate.js'

class PostgresDB {
  constructor(connectionString) {
    this._connectionString = connectionString
    this._pool = null
  }

  async init() {
    const { default: pg } = await import('pg')
    this._pool = new pg.Pool({ connectionString: this._connectionString })
    await migrate(this._connectionString, 'postgres')
    console.log('[db] Connected to Postgres')
  }

  async query(sql, params = []) {
    const res = await this._pool.query(sql, params)
    return res.rows
  }

  async upsertPlayer(discordId, username, avatar) {
    const rows = await this.query(
      `INSERT INTO players (discord_id, username, avatar, last_seen)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (discord_id) DO UPDATE
       SET username = $2, avatar = $3, last_seen = NOW()
       RETURNING *`,
      [discordId, username, avatar]
    )
    return rows[0]
  }

  async savePlayerPosition(discordId, x, y) {
    await this.query(
      `UPDATE players SET pos_x = $2, pos_y = $3 WHERE discord_id = $1`,
      [discordId, x, y]
    )
  }

  async logDialogue(discordId, message, response) {
    await this.query(
      `INSERT INTO dialogue_history (discord_id, message, response) VALUES ($1, $2, $3)`,
      [discordId, message, response]
    )
  }

  async getDialogueHistory(discordId, limit = 20) {
    return this.query(
      `SELECT message, response, created_at FROM dialogue_history
       WHERE discord_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [discordId, limit]
    )
  }
}

class SQLiteDB {
  constructor(path) {
    this._path = path
    this._db = null
  }

  async init() {
    const { default: Database } = await import('better-sqlite3')
    this._db = new Database(this._path)
    this._db.pragma('journal_mode = WAL')
    await migrate(this._path, 'sqlite', this._db)
    console.log(`[db] Connected to SQLite at ${this._path}`)
  }

  query(sql, params = []) {
    // Normalize Postgres-style $1 params to ? for SQLite
    const normalized = sql.replace(/\$\d+/g, '?')
    // Strip Postgres-only clauses
    const stripped = normalized
      .replace(/RETURNING \*/gi, '')
      .replace(/NOW\(\)/gi, "datetime('now')")
      .trim()

    const stmt = this._db.prepare(stripped)
    const isSelect = /^\s*SELECT/i.test(stripped)
    const isInsert = /^\s*INSERT/i.test(stripped)
    const isUpdate = /^\s*UPDATE/i.test(stripped)

    if (isSelect) {
      return stmt.all(...params)
    } else if (isInsert && !stripped.toUpperCase().includes('RETURNING')) {
      const info = stmt.run(...params)
      // Return inserted row for upserts
      if (isInsert) {
        const tableName = stripped.match(/INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)/i)?.[1]
        if (tableName) {
          return [this._db.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`).get(info.lastInsertRowid)]
        }
      }
      return []
    } else {
      stmt.run(...params)
      return []
    }
  }

  async upsertPlayer(discordId, username, avatar) {
    this._db.prepare(
      `INSERT INTO players (discord_id, username, avatar, last_seen)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT (discord_id) DO UPDATE
       SET username = excluded.username, avatar = excluded.avatar, last_seen = datetime('now')`
    ).run(discordId, username, avatar)
    return this._db.prepare(`SELECT * FROM players WHERE discord_id = ?`).get(discordId)
  }

  async savePlayerPosition(discordId, x, y) {
    this._db.prepare(`UPDATE players SET pos_x = ?, pos_y = ? WHERE discord_id = ?`).run(x, y, discordId)
  }

  async logDialogue(discordId, message, response) {
    this._db.prepare(
      `INSERT INTO dialogue_history (discord_id, message, response) VALUES (?, ?, ?)`
    ).run(discordId, message, response)
  }

  async getDialogueHistory(discordId, limit = 20) {
    return this._db.prepare(
      `SELECT message, response, created_at FROM dialogue_history
       WHERE discord_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(discordId, limit)
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

function createDB() {
  if (process.env.DATABASE_URL) {
    return new PostgresDB(process.env.DATABASE_URL)
  }
  const path = process.env.SQLITE_PATH || './data/talia-town.db'
  return new SQLiteDB(path)
}

export const db = createDB()
