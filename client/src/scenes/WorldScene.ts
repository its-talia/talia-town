import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import { Player } from '../entities/Player'
import { TaliaCharacter } from '../entities/TaliaCharacter'
import { DialogueManager } from '../ui/DialogueManager'
import mapData from './mapData.json'

const T = mapData.tileDim   // 16px
const W = mapData.width     // 48
const H = mapData.height    // 40

// Tilesheet column counts (needed to convert flat tile ID → col,row)
const TS1_COLS  = Math.floor((mapData as any).tileSetDimX  / T)   // 30
const TS10_COLS = Math.floor((mapData as any).tileSet10DimX / T)  // 14

interface Collidable { x: number; y: number; w: number; h: number }

export class WorldScene {
  container: Container
  private app: Application
  private player!: Player
  private talia!: TaliaCharacter
  private dialogue: DialogueManager
  private worldContainer: Container
  private keys: Record<string, boolean> = {}
  private collidables: Collidable[] = []
  private animTick = 0
  private texCache = new Map<string, Texture>()

  constructor(app: Application, dialogue: DialogueManager) {
    this.app = app
    this.dialogue = dialogue
    this.container = new Container()
    this.worldContainer = new Container()
    this.container.addChild(this.worldContainer)
    this.setupInput()
    this.loadAndBuild()
  }

  private async loadAndBuild() {
    const md = mapData as any
    let ts1Tex: Texture | null = null
    let ts10Tex: Texture | null = null

    try {
      const toLoad = [{ alias: 'ts1', src: md.tileSetUrl }]
      if (md.tileSet10Url) toLoad.push({ alias: 'ts10', src: md.tileSet10Url })
      await Assets.load(toLoad)
      ts1Tex  = Assets.get('ts1')
      ts10Tex = md.tileSet10Url ? Assets.get('ts10') : null
    } catch (e) {
      console.warn('[world] Asset load failed:', e)
    }

    if (!ts1Tex) {
      const g = new Graphics()
      g.rect(0, 0, W*T, H*T); g.fill(0x4a7c59)
      this.worldContainer.addChild(g)
    } else {
      // Layer 0: base terrain from 1.png
      this.renderLayer(ts1Tex, md.bgTiles, TS1_COLS)

      // Layer 1: path overlay from 10.png (skip -1 tiles)
      if (ts10Tex && md.overlayTiles) {
        this.renderLayer(ts10Tex, md.overlayTiles, TS10_COLS)
      }
    }

    this.spawnCharacters()
  }

  // ── Tile layer renderer ───────────────────────────────────────────────────
  // tiles[tx][ty] = flat tile ID (row*sheetCols + col), or -1 to skip

  private renderLayer(tsTex: Texture, tiles: number[][], sheetCols: number) {
    const cache = new Map<number, Texture>()

    const getTex = (id: number): Texture => {
      if (cache.has(id)) return cache.get(id)!
      const col = id % sheetCols
      const row = Math.floor(id / sheetCols)
      const tex = new Texture({
        source: tsTex.source,
        frame: new Rectangle(col * T, row * T, T, T),
      })
      cache.set(id, tex)
      return tex
    }

    for (let tx = 0; tx < W; tx++) {
      for (let ty = 0; ty < H; ty++) {
        const id = tiles[tx]?.[ty] ?? -1
        if (id === -1) continue
        const s = new Sprite(getTex(id))
        s.x = tx * T
        s.y = ty * T
        this.worldContainer.addChild(s)
      }
    }
  }

  // ── Characters ────────────────────────────────────────────────────────────

  private spawnCharacters() {
    const md = mapData as any
    const tx = md.talia?.tx ?? Math.round(W / 2)
    const ty = md.talia?.ty ?? Math.round(H / 3)
    const spawnTx = md.playerSpawn?.tx ?? tx
    const spawnTy = md.playerSpawn?.ty ?? ty + 8

    this.talia = new TaliaCharacter(tx * T, ty * T)
    this.worldContainer.addChild(this.talia.sprite)

    this.player = new Player(spawnTx * T, spawnTy * T)
    this.worldContainer.addChild(this.player.sprite)
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private setupInput() {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true
      if (e.code === 'Escape') this.dialogue?.close()
      if (e.code === 'Enter' && this.dialogue?.isOpen) this.dialogue.submit()
    })
    window.addEventListener('keyup', e => { this.keys[e.code] = false })
  }

  private checkCollision(nx: number, ny: number): boolean {
    const hw = 6, hh = 6
    return this.collidables.some(c =>
      nx - hw < c.x + c.w && nx + hw > c.x &&
      ny - hh < c.y + c.h && ny + hh > c.y
    )
  }

  // ── Game loop ─────────────────────────────────────────────────────────────

  update(delta: number) {
    if (this.dialogue?.isOpen) return
    if (!this.player || !this.talia) return

    const speed = 1.5
    let dx = 0, dy = 0
    if (this.keys['KeyW'] || this.keys['ArrowUp'])    dy -= speed
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  dy += speed
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  dx -= speed
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += speed

    const minB = T * 2, maxX = (W - 2) * T, maxY = (H - 2) * T
    const nx = Math.max(minB, Math.min(maxX, this.player.sprite.x + dx * delta))
    const ny = Math.max(minB, Math.min(maxY, this.player.sprite.y + dy * delta))

    const canX = !this.checkCollision(nx, this.player.sprite.y)
    const canY = !this.checkCollision(this.player.sprite.x, ny)
    this.player.move(canX ? dx * delta : 0, canY ? dy * delta : 0, minB, minB, maxX, maxY)
    this.player.update(delta, canX ? dx : 0, canY ? dy : 0)

    const dist = Math.hypot(
      this.player.sprite.x - this.talia.sprite.x,
      this.player.sprite.y - this.talia.sprite.y
    )
    if (dist < 32 && this.dialogue.canOpen()) this.dialogue.open()

    this.talia.update(delta)
    this.updateCamera()
  }

  private updateCamera() {
    const sw = this.app.screen.width, sh = this.app.screen.height
    let cx = this.player.sprite.x - sw / 2
    let cy = this.player.sprite.y - sh / 2
    cx = Math.max(0, Math.min(W * T - sw, cx))
    cy = Math.max(0, Math.min(H * T - sh, cy))
    this.worldContainer.x = -cx
    this.worldContainer.y = -cy
  }
}
