import pg from 'pg'

const { Pool } = pg

class Database {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  }

  async init() {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set — skipping DB init')
      return
    }
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS players (
          id SERIAL PRIMARY KEY,
          discord_id TEXT UNIQUE NOT NULL,
          username TEXT NOT NULL,
          avatar TEXT,
          pos_x INTEGER DEFAULT 640,
          pos_y DEFAULT 480,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          last_seen TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS dialogue_history (
          id SERIAL PRIMARY KEY,
          discord_id TEXT NOT NULL,
          message TEXT NOT NULL,
          response TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `)
      console.log('Database initialized')
    } catch (err) {
      console.error('DB init error:', err.message)
    }
  }

  async upsertPlayer(discordId, username, avatar) {
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

  async logDialogue(discordId, message, response) {
    await this.pool.query(
      `INSERT INTO dialogue_history (discord_id, message, response) VALUES ($1, $2, $3)`,
      [discordId, message, response]
    )
  }
}

export const db = new Database()
