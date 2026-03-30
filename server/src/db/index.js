import pg from 'pg'
import { migrate } from './migrate.js'

const { Pool } = pg

class Database {
  constructor() {
    this.pool = process.env.DATABASE_URL
      ? new Pool({ connectionString: process.env.DATABASE_URL })
      : null
  }

  async init() {
    if (!this.pool) {
      console.warn('[db] No DATABASE_URL — database disabled')
      return
    }
    await migrate(process.env.DATABASE_URL)
  }

  async upsertPlayer(discordId, username, avatar) {
    if (!this.pool) return null
    const res = await this.pool.query(
      `INSERT INTO players (discord_id, username, avatar, last_seen)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (discord_id) DO UPDATE
       SET username = $2, avatar = $3, last_seen = NOW()
       RETURNING *`,
      [discordId, username, avatar]
    )
    return res.rows[0]
  }

  async savePlayerPosition(discordId, x, y) {
    if (!this.pool) return
    await this.pool.query(
      `UPDATE players SET pos_x = $2, pos_y = $3 WHERE discord_id = $1`,
      [discordId, x, y]
    )
  }

  async logDialogue(discordId, message, response) {
    if (!this.pool) return
    await this.pool.query(
      `INSERT INTO dialogue_history (discord_id, message, response) VALUES ($1, $2, $3)`,
      [discordId, message, response]
    )
  }

  async getDialogueHistory(discordId, limit = 20) {
    if (!this.pool) return []
    const res = await this.pool.query(
      `SELECT message, response, created_at FROM dialogue_history
       WHERE discord_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [discordId, limit]
    )
    return res.rows.reverse()
  }
}

export const db = new Database()
