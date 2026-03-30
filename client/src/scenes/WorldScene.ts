import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import { Player } from '../entities/Player'
import { TaliaCharacter } from '../entities/TaliaCharacter'
import { DialogueManager } from '../ui/DialogueManager'
import mapData from './mapData.json'

const T = mapData.tileDim         // 16px
const MAP_W = mapData.width       // 64
const MAP_H = mapData.height      // 48
const TS_COLS = Math.floor(mapData.tileSetDimX / T)  // 30

// Talia position: top of path (~50% x, 18% y)
const TALIA_TX = Math.round(MAP_W * 0.50)
const TALIA_TY = Math.round(MAP_H * 0.18)

// Props from 3.png (verified clean)
interface PropDef { sx:number; sy:number; sw:number; sh:number; colX:number; colY:number; colW:number; colH:number }
const PROPS: Record<string, PropDef> = {
  tree:    { sx:0,   sy:0,  sw:64, sh:64, colX:-14, colY:-8,  colW:28, colH:16 },
  treeMed: { sx:144, sy:0,  sw:48, sh:64, colX:-10, colY:-6,  colW:20, colH:14 },
  treeAlt: { sx:192, sy:0,  sw:48, sh:64, colX:-10, colY:-6,  colW:20, colH:14 },
  rockSm:  { sx:64,  sy:96, sw:32, sh:32, colX:-8,  colY:-8,  colW:16, colH:14 },
  boulder: { sx:352, sy:0,  sw:64, sh:64, colX:-16, colY:-14, colW:32, colH:22 },
  well:    { sx:0,   sy:64, sw:48, sh:64, colX:-12, colY:-12, colW:24, colH:20 },
}

interface Collidable { x:number; y:number; w:number; h:number }

export class WorldScene {
  container: Container
  private app: Application
  private player!: Player
  private talia!: TaliaCharacter
  private dialogue: DialogueManager
  private worldContainer: Container
  private keys: Record<string,boolean> = {}
  private collidables: Collidable[] = []
  private waterSprites: Array<{sprite:Sprite; baseY:number}> = []
  private animTick = 0
  private texCache = new Map<string,Texture>()

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
    let tsTex: Texture | null = null
    let propsTex: Texture | null = null

    try {
      await Assets.load([
        { alias: 'tileset1', src: mapData.tileSetUrl },
        { alias: 'props3',   src: '/assets/tilesets/3.png' },
      ])
      tsTex    = Assets.get('tileset1')
      propsTex = Assets.get('props3')
    } catch(e) {
      console.warn('[world] Asset load failed:', e)
    }

    if (tsTex) {
      this.renderTileLayer(tsTex, mapData.bgTiles)
    } else {
      const g = new Graphics()
      g.rect(0, 0, MAP_W*T, MAP_H*T); g.fill(0x4a7c59)
      this.worldContainer.addChild(g)
    }

    // Build collision set from water and cliff tiles
    this.buildCollisionSet()

    if (propsTex) this.buildProps(propsTex)

    this.spawnCharacters()
  }

  // ── ai-town style tile layer renderer ────────────────────────────────────
  // bgTiles[tx][ty] = flat tile index into the tileset

  private renderTileLayer(tsTex: Texture, bgTiles: number[][]) {
    // Pre-build all unique tile textures
    const texCache = new Map<number, Texture>()
    const getTileTex = (tileId: number): Texture => {
      if (texCache.has(tileId)) return texCache.get(tileId)!
      const col = tileId % TS_COLS
      const row = Math.floor(tileId / TS_COLS)
      const tex = new Texture({
        source: tsTex.source,
        frame: new Rectangle(col * T, row * T, T, T),
      })
      texCache.set(tileId, tex)
      return tex
    }

    const WATER_MIN = 250  // tile IDs in the blue water range

    for (let tx = 0; tx < MAP_W; tx++) {
      for (let ty = 0; ty < MAP_H; ty++) {
        const tileId = bgTiles[tx]?.[ty] ?? -1
        if (tileId === -1) continue

        const tex = getTileTex(tileId)
        const s = new Sprite(tex)
        s.x = tx * T
        s.y = ty * T
        this.worldContainer.addChild(s)

        // Track water tiles for animation
        if (tileId >= 230 && tileId <= 310) {
          this.waterSprites.push({ sprite: s, baseY: ty * T })
        }
      }
    }
  }

  // ── Collision ─────────────────────────────────────────────────────────────

  private buildCollisionSet() {
    const bgTiles = mapData.bgTiles
    // Water tiles = flat index range 230-310 (blue tiles in 1.png rows 7-10)
    // Cliff tiles = 1119 (row 37)
    for (let tx = 0; tx < MAP_W; tx++) {
      for (let ty = 0; ty < MAP_H; ty++) {
        const id = bgTiles[tx]?.[ty] ?? -1
        if ((id >= 230 && id <= 320) || id === 1119) {
          this.collidables.push({ x: tx*T, y: ty*T, w: T, h: T })
        }
      }
    }
  }

  // ── Props ─────────────────────────────────────────────────────────────────

  private buildProps(propsTex: Texture) {
    const taliaX = TALIA_TX * T
    const taliaY = TALIA_TY * T
    const CLEAR = 5 * T

    const isCollidable = (tx: number, ty: number) =>
      this.collidables.some(c => tx*T >= c.x && tx*T < c.x+c.w && ty*T >= c.y && ty*T < c.y+c.h)

    let seed = 7331
    const next = () => { seed = (seed*1664525+1013904223)&0x7fffffff; return seed/0x7fffffff }
    const propKeys = ['tree','treeMed','treeAlt','rockSm','boulder']
    const placements: Array<{x:number; y:number; def:PropDef}> = []

    for (let i = 0; i < 80; i++) {
      const tx = 2 + Math.floor(next() * (MAP_W-4))
      const ty = 2 + Math.floor(next() * (MAP_H-4))
      if (isCollidable(tx, ty)) continue
      const px = tx*T, py = ty*T
      if (Math.hypot(px-taliaX, py-taliaY) < CLEAR) continue
      const def = PROPS[propKeys[Math.floor(next()*propKeys.length)]]
      if (placements.some(p => Math.hypot(px-p.x, py-p.y) < 24)) continue
      placements.push({ x:px, y:py, def })
    }

    // Well near Talia
    placements.push({ x: taliaX + 5*T, y: taliaY - T, def: PROPS.well })

    for (const { x, y, def } of placements) {
      const tex = new Texture({
        source: propsTex.source,
        frame: new Rectangle(def.sx, def.sy, def.sw, def.sh),
      })
      const s = new Sprite(tex)
      s.anchor.set(0.5, 1)
      s.x = x; s.y = y
      this.worldContainer.addChild(s)
      this.collidables.push({ x: x+def.colX, y: y+def.colY, w: def.colW, h: def.colH })
    }
  }

  // ── Characters ────────────────────────────────────────────────────────────

  private spawnCharacters() {
    const tx = TALIA_TX * T
    const ty = TALIA_TY * T
    this.talia = new TaliaCharacter(tx, ty)
    this.worldContainer.addChild(this.talia.sprite)
    this.player = new Player(tx, ty + 6*T)
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
      nx-hw < c.x+c.w && nx+hw > c.x && ny-hh < c.y+c.h && ny+hh > c.y
    )
  }

  // ── Game loop ─────────────────────────────────────────────────────────────

  update(delta: number) {
    if (this.dialogue?.isOpen) return
    if (!this.player || !this.talia) return

    this.animTick += delta * 0.03
    for (const w of this.waterSprites) {
      w.sprite.y = w.baseY + Math.sin(this.animTick + w.sprite.x * 0.015) * 0.35
    }

    const speed = 1.5
    let dx = 0, dy = 0
    if (this.keys['KeyW']||this.keys['ArrowUp'])    dy -= speed
    if (this.keys['KeyS']||this.keys['ArrowDown'])  dy += speed
    if (this.keys['KeyA']||this.keys['ArrowLeft'])  dx -= speed
    if (this.keys['KeyD']||this.keys['ArrowRight']) dx += speed

    const minB = T*2, maxX = (MAP_W-2)*T, maxY = (MAP_H-2)*T
    const nx = Math.max(minB, Math.min(maxX, this.player.sprite.x + dx*delta))
    const ny = Math.max(minB, Math.min(maxY, this.player.sprite.y + dy*delta))

    const canX = !this.checkCollision(nx, this.player.sprite.y)
    const canY = !this.checkCollision(this.player.sprite.x, ny)
    this.player.move(canX?dx*delta:0, canY?dy*delta:0, minB, minB, maxX, maxY)
    this.player.update(delta, canX?dx:0, canY?dy:0)

    const dist = Math.hypot(this.player.sprite.x - this.talia.sprite.x, this.player.sprite.y - this.talia.sprite.y)
    if (dist < 32 && this.dialogue.canOpen()) this.dialogue.open()

    this.talia.update(delta)
    this.updateCamera()
  }

  private updateCamera() {
    const sw = this.app.screen.width, sh = this.app.screen.height
    let cx = this.player.sprite.x - sw/2
    let cy = this.player.sprite.y - sh/2
    cx = Math.max(0, Math.min(MAP_W*T-sw, cx))
    cy = Math.max(0, Math.min(MAP_H*T-sh, cy))
    this.worldContainer.x = -cx
    this.worldContainer.y = -cy
  }
}
