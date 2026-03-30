import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import { Player } from '../entities/Player'
import { TaliaCharacter } from '../entities/TaliaCharacter'
import { DialogueManager } from '../ui/DialogueManager'

const T = 16           // tile size px
const W = 64           // world width in tiles
const H = 48           // world height in tiles

// ─── Tile IDs (col, row into 1.png, 30 cols × 48 rows) ──────────────────────
// Helper: encode as single number for map arrays
const tid = (col: number, row: number) => row * 30 + col

// Grass fill variants (confirmed clean)
const GR = [tid(1,3), tid(2,3), tid(1,2), tid(2,2), tid(7,3), tid(8,3)]

// Water fill (interior lake)
const WA = tid(2,9)
const WA2 = tid(3,8)

// Water shore autotiles (transparent edges — layer over grass+water)
const SH_T  = tid(2,7)   // shore top edge
const SH_B  = tid(2,10)  // shore bottom edge
const SH_L  = tid(0,8)   // shore left edge
const SH_R  = tid(5,8)   // shore right edge
const SH_TL = tid(1,6)   // top-left outer corner
const SH_TR = tid(4,6)   // top-right outer corner
const SH_BL = tid(1,10)  // bottom-left outer corner
const SH_BR = tid(4,10)  // bottom-right outer corner
// Inner concave corners
const SH_ITL = tid(9,9)  // inner top-left (land nub in TL of water)
const SH_ITR = tid(6,9)  // inner top-right
const SH_IBL = tid(9,7)  // inner bottom-left
const SH_IBR = tid(6,7)  // inner bottom-right

// Sand/dirt path fill
const SA = tid(12,21)
const SA2 = tid(13,21)

// Brown cliff fill (raised ridge top-surface)
const CF = tid(2,38)
// Cliff top edge (grass-to-cliff transition, top side)
const CF_T = tid(2,37)
const CF_TL = tid(1,37)
const CF_TR = tid(4,37)
const CF_L  = tid(0,38)
const CF_R  = tid(5,38)
const CF_BL = tid(0,41)
const CF_BR = tid(5,41)
const CF_B  = tid(2,41)

const __ = -1  // empty / no override

// ─── Map layers ──────────────────────────────────────────────────────────────
// We use 3 passes:
// 1. Base grass (auto-varied, W×H)
// 2. Terrain overlay (water, sand, cliff patches)
// 3. Shore autotiles (transparent, drawn on top)

// Terrain overlay map — defines what terrain sits at each tile position
// 0 = grass (default), WA = water, SA = sand, CF = cliff-top
// This is a SPARSE representation: [tx, ty, tileId] triples

interface TileOverride { x: number; y: number; id: number }

function makeMapData(): { water: TileOverride[], sand: TileOverride[], cliff: TileOverride[], shore: TileOverride[] } {
  const water: TileOverride[] = []
  const sand:  TileOverride[] = []
  const cliff: TileOverride[] = []
  const shore: TileOverride[] = []

  // ── LAKE: southwest corner, diagonal shoreline ──────────────────────────
  // Lake body: roughly cols 0-18, rows 28-47 (SW quadrant)
  // Diagonal NE shore runs from ~(0,16) to (20,36)
  // Approximate the diagonal with stair steps (each step = 1 tile right, 1 tile down)
  
  // Lake fill
  for (let ty = 30; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      // Diagonal edge: for each row, the lake extends from left up to col = tx_edge
      const tx_edge = Math.round(tx - (ty - 30) * 0.7)  // slope ~0.7
      if (tx < tx_edge && ty > 28) {
        water.push({ x: tx, y: ty, id: (tx + ty) % 2 === 0 ? WA : WA2 })
      }
    }
  }
  // Simpler: define lake as all tiles where tx + ty*0.7 < 22
  // This creates the SW diagonal lake

  water.length = 0  // reset and use explicit approach

  // Lake: fill lower-left, SW corner
  // Shore diagonal runs roughly: row 16 → col 20, row 36 → col 0
  // Line: col = 20 - (row - 16)
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const shoreCol = 22 - (ty - 14)  // diagonal edge column at this row
      if (tx < shoreCol && ty > 14) {
        water.push({ x: tx, y: ty, id: (tx ^ ty) % 3 === 0 ? WA2 : WA })
      }
    }
  }

  // ── SAND PATH: vertical path center-right, leading to Talia ──────────────
  const pathCenterX = Math.round(W * 0.62)  // ~col 40
  const taliaY = Math.round(H * 0.28)        // Talia is at ~row 13
  for (let ty = taliaY + 1; ty < H - 3; ty++) {
    for (let dx = -2; dx <= 2; dx++) {
      const tx = pathCenterX + dx
      if (tx >= 0 && tx < W) {
        sand.push({ x: tx, y: ty, id: (tx + ty) % 2 === 0 ? SA : SA2 })
      }
    }
  }
  // Path widens at bottom
  for (let ty = H - 12; ty < H - 2; ty++) {
    for (let dx = -4; dx <= 4; dx++) {
      const tx = pathCenterX + dx
      if (tx >= 0 && tx < W) {
        sand.push({ x: tx, y: ty, id: SA })
      }
    }
  }

  // ── CLIFF RIDGES: horizontal brown rocky ridges ───────────────────────────
  // Main ridge: roughly rows 18-22, with gaps and curves
  // From reference: 2 main curved ridges running E-W with tree-filled gaps

  // Ridge 1: row 17-20, cols 15-55 (with gap around path)
  for (let tx = 15; tx < 55; tx++) {
    if (tx >= pathCenterX - 3 && tx <= pathCenterX + 3) continue  // gap for path
    for (let ty = 17; ty <= 20; ty++) {
      cliff.push({ x: tx, y: ty, id: CF })
    }
  }

  // Ridge 2: row 26-29, cols 8-48 (offset, curved)
  for (let tx = 8; tx < 48; tx++) {
    if (tx >= pathCenterX - 3 && tx <= pathCenterX + 3) continue
    const rowOffset = tx < 25 ? 1 : tx > 40 ? -1 : 0
    for (let ty = 26 + rowOffset; ty <= 29 + rowOffset; ty++) {
      cliff.push({ x: tx, y: ty, id: CF })
    }
  }

  // ── SHORE TRANSITION TILES ────────────────────────────────────────────────
  // Build a Set of water tiles for quick lookup
  const waterSet = new Set(water.map(w => `${w.x},${w.y}`))
  const isWater = (x: number, y: number) => waterSet.has(`${x},${y}`)

  for (const w of water) {
    const { x: tx, y: ty } = w
    const hasTop    = !isWater(tx,   ty-1)
    const hasBottom = !isWater(tx,   ty+1)
    const hasLeft   = !isWater(tx-1, ty)
    const hasRight  = !isWater(tx+1, ty)

    if (hasTop && hasLeft)  shore.push({ x: tx, y: ty, id: SH_TL })
    else if (hasTop && hasRight) shore.push({ x: tx, y: ty, id: SH_TR })
    else if (hasBottom && hasLeft)  shore.push({ x: tx, y: ty, id: SH_BL })
    else if (hasBottom && hasRight) shore.push({ x: tx, y: ty, id: SH_BR })
    else if (hasTop)    shore.push({ x: tx, y: ty, id: SH_T })
    else if (hasBottom) shore.push({ x: tx, y: ty, id: SH_B })
    else if (hasLeft)   shore.push({ x: tx, y: ty, id: SH_L })
    else if (hasRight)  shore.push({ x: tx, y: ty, id: SH_R })
  }

  return { water, sand, cliff, shore }
}

// ─── Prop definitions from 3.png (verified clean) ───────────────────────────
interface PropDef {
  sx: number; sy: number; sw: number; sh: number
  colX: number; colY: number; colW: number; colH: number
}

const PROPS: Record<string, PropDef> = {
  tree:    { sx:   0, sy:  0, sw: 64, sh: 64, colX:-14, colY: -8, colW:28, colH:16 },
  treeMed: { sx: 144, sy:  0, sw: 48, sh: 64, colX:-10, colY: -6, colW:20, colH:14 },
  treeAlt: { sx: 192, sy:  0, sw: 48, sh: 64, colX:-10, colY: -6, colW:20, colH:14 },
  rockSm:  { sx:  64, sy: 96, sw: 32, sh: 32, colX: -8, colY: -8, colW:16, colH:14 },
  rockSm2: { sx:  96, sy: 96, sw: 32, sh: 32, colX: -8, colY: -8, colW:16, colH:14 },
  boulder: { sx: 352, sy:  0, sw: 64, sh: 64, colX:-16, colY:-14, colW:32, colH:22 },
  well:    { sx:   0, sy: 64, sw: 48, sh: 64, colX:-12, colY:-12, colW:24, colH:20 },
}

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
  private waterTiles: Array<{ sprite: Sprite; baseY: number }> = []
  private animTick = 0

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
    let terrainTex: Texture | null = null
    let propsTex: Texture | null = null

    try {
      await Assets.load([
        { alias: 'terrain', src: '/assets/tilesets/1.png' },
        { alias: 'props3',  src: '/assets/tilesets/3.png' },
      ])
      terrainTex = Assets.get('terrain')
      propsTex   = Assets.get('props3')
    } catch (e) {
      console.warn('[world] Asset load failed:', e)
    }

    if (!terrainTex) { this.buildFallback(); this.spawnCharacters(); return }

    const mapData = makeMapData()

    // ── Layer 0: Base grass ──────────────────────────────────────────────
    this.buildGrassBase(terrainTex)

    // ── Layer 1: Water ──────────────────────────────────────────────────
    this.buildWater(terrainTex, mapData.water)

    // ── Layer 2: Shore autotiles ─────────────────────────────────────────
    this.buildTileLayer(terrainTex, mapData.shore)

    // ── Layer 3: Sand path ───────────────────────────────────────────────
    this.buildTileLayer(terrainTex, mapData.sand)

    // ── Layer 4: Cliff ridges ────────────────────────────────────────────
    this.buildTileLayer(terrainTex, mapData.cliff)

    // ── Layer 5: Props ───────────────────────────────────────────────────
    if (propsTex) this.buildProps(propsTex, mapData)

    this.spawnCharacters()
  }

  // ── Tile rendering helpers ────────────────────────────────────────────────

  private tileTexCache = new Map<number, Texture>()
  private getTex(terrainTex: Texture, tileId: number): Texture {
    if (this.tileTexCache.has(tileId)) return this.tileTexCache.get(tileId)!
    const col = tileId % 30
    const row = Math.floor(tileId / 30)
    const tex = new Texture({ source: terrainTex.source, frame: new Rectangle(col*T, row*T, T, T) })
    this.tileTexCache.set(tileId, tex)
    return tex
  }

  private buildGrassBase(tex: Texture) {
    const variants = GR.map(id => this.getTex(tex, id))
    const rand = (x: number, y: number) => ((x * 1619 + y * 31337) & 0xffff) / 0xffff
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const r = rand(tx, ty)
        const idx = r < 0.5 ? 0 : r < 0.7 ? 1 : r < 0.82 ? 2 : r < 0.9 ? 3 : r < 0.95 ? 4 : 5
        const s = new Sprite(variants[idx])
        s.x = tx * T; s.y = ty * T
        this.worldContainer.addChild(s)
      }
    }
  }

  private buildWater(tex: Texture, waterTiles: TileOverride[]) {
    const t1 = this.getTex(tex, WA)
    const t2 = this.getTex(tex, WA2)
    for (const { x, y, id } of waterTiles) {
      const s = new Sprite(id === WA ? t1 : t2)
      s.x = x * T; s.y = y * T
      this.worldContainer.addChild(s)
      this.waterTiles.push({ sprite: s, baseY: y * T })
    }
  }

  private buildTileLayer(tex: Texture, tiles: TileOverride[]) {
    for (const { x, y, id } of tiles) {
      const s = new Sprite(this.getTex(tex, id))
      s.x = x * T; s.y = y * T
      this.worldContainer.addChild(s)
    }
  }

  // ── Props ─────────────────────────────────────────────────────────────────

  private buildProps(propsTex: Texture, mapData: ReturnType<typeof makeMapData>) {
    const waterSet = new Set(mapData.water.map(w => `${w.x},${w.y}`))
    const cliffSet = new Set(mapData.cliff.map(c => `${c.x},${c.y}`))
    const isBlocked = (tx: number, ty: number) =>
      waterSet.has(`${tx},${ty}`) || cliffSet.has(`${tx},${ty}`)

    const taliaX = Math.round(W * 0.62) * T
    const taliaY = Math.round(H * 0.28) * T
    const CLEAR = 80  // px clear around Talia

    const placements: Array<{ x: number; y: number; def: PropDef }> = []

    let seed = 7331
    const next = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff }

    const propKeys = Object.keys(PROPS).filter(k => k !== 'well')
    const propDefs = propKeys.map(k => PROPS[k])

    for (let i = 0; i < 120; i++) {
      const tx = 2 + Math.floor(next() * (W - 4))
      const ty = 2 + Math.floor(next() * (H - 4))
      if (isBlocked(tx, ty) || isBlocked(tx, ty-1)) continue
      const px = tx * T, py = ty * T
      if (Math.hypot(px - taliaX, py - taliaY) < CLEAR) continue
      const def = propDefs[Math.floor(next() * propDefs.length)]
      const tooClose = placements.some(p => Math.hypot(px - p.x, py - p.y) < 28)
      if (tooClose) continue
      placements.push({ x: px, y: py, def })
    }

    // Well east of Talia
    placements.push({ x: taliaX + 4*T, y: taliaY - 2*T, def: PROPS.well })

    for (const { x, y, def } of placements) {
      const t = new Texture({ source: propsTex.source, frame: new Rectangle(def.sx, def.sy, def.sw, def.sh) })
      const s = new Sprite(t)
      s.anchor.set(0.5, 1)
      s.x = x; s.y = y
      this.worldContainer.addChild(s)
      this.collidables.push({ x: x + def.colX, y: y + def.colY, w: def.colW, h: def.colH })
    }

    // Water and cliffs are also collidable
    for (const { x, y } of mapData.water) {
      this.collidables.push({ x: x*T, y: y*T, w: T, h: T })
    }
    for (const { x, y } of mapData.cliff) {
      this.collidables.push({ x: x*T, y: y*T, w: T, h: T })
    }
  }

  // ── Characters ────────────────────────────────────────────────────────────

  private spawnCharacters() {
    const taliaX = Math.round(W * 0.62) * T
    const taliaY = Math.round(H * 0.28) * T

    this.talia = new TaliaCharacter(taliaX, taliaY)
    this.worldContainer.addChild(this.talia.sprite)

    // Player spawns on the path below Talia
    this.player = new Player(taliaX, taliaY + 6 * T)
    this.worldContainer.addChild(this.player.sprite)
  }

  // ── Fallback (no assets) ──────────────────────────────────────────────────

  private buildFallback() {
    const g = new Graphics()
    g.rect(0, 0, W*T, H*T); g.fill(0x4a7c59)
    this.worldContainer.addChild(g)
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

  // ── Collision ─────────────────────────────────────────────────────────────

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

    // Water animation — gentle vertical shimmer
    this.animTick += delta * 0.04
    for (const { sprite, baseY } of this.waterTiles) {
      sprite.y = baseY + Math.sin(this.animTick + sprite.x * 0.02) * 0.4
    }

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

    const dist = Math.hypot(this.player.sprite.x - this.talia.sprite.x, this.player.sprite.y - this.talia.sprite.y)
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
