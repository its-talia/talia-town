import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import { Player } from '../entities/Player'
import { TaliaCharacter } from '../entities/TaliaCharacter'
import { DialogueManager } from '../ui/DialogueManager'

const TILE = 16
const WORLD_W = 80
const WORLD_H = 60

// Solid grass fill tiles confirmed from 1.png (col*16, row*16)
const GRASS_FRAMES = [
  new Rectangle(16, 48, TILE, TILE),   // col1,row3
  new Rectangle(48, 48, TILE, TILE),   // col3,row3
  new Rectangle(16, 32, TILE, TILE),   // col1,row2
  new Rectangle(48, 32, TILE, TILE),   // col3,row2
  new Rectangle(112,48, TILE, TILE),   // col7,row3
  new Rectangle(128,48, TILE, TILE),   // col8,row3
]

// Props from 3.png — verified pixel-sampled coordinates, all CLEAN
interface PropDef {
  name: string
  sx: number; sy: number; sw: number; sh: number
  colX: number; colY: number; colW: number; colH: number
  anchor: [number, number]
}

const PROP_DEFS: PropDef[] = [
  { name: 'tree-large',  sx:   0, sy:  0, sw: 64, sh: 64, colX: -14, colY: -8, colW: 28, colH: 16, anchor: [0.5, 1] },
  { name: 'tree-medium', sx: 144, sy:  0, sw: 48, sh: 64, colX: -10, colY: -6, colW: 20, colH: 14, anchor: [0.5, 1] },
  { name: 'tree-alt',    sx: 192, sy:  0, sw: 48, sh: 64, colX: -10, colY: -6, colW: 20, colH: 14, anchor: [0.5, 1] },
  { name: 'rock-sm',     sx:  64, sy: 96, sw: 32, sh: 32, colX:  -8, colY: -8, colW: 16, colH: 14, anchor: [0.5, 1] },
  { name: 'rock-sm2',    sx:  96, sy: 96, sw: 32, sh: 32, colX:  -8, colY: -8, colW: 16, colH: 14, anchor: [0.5, 1] },
  { name: 'boulder',     sx: 352, sy:  0, sw: 64, sh: 64, colX: -16, colY:-14, colW: 32, colH: 22, anchor: [0.5, 1] },
]

// Water tile from 1.png — row 0 area has water, found at col4-5 row 0
const WATER_RECT  = new Rectangle(64,  0, TILE, TILE)
const SAND_RECT   = new Rectangle(80,  0, TILE, TILE)

interface Collidable {
  x: number; y: number; w: number; h: number
}

export class WorldScene {
  container: Container
  private app: Application
  private player!: Player
  private talia!: TaliaCharacter
  private dialogue: DialogueManager
  private worldContainer: Container
  private keys: Record<string, boolean> = {}
  private collidables: Collidable[] = []
  private taliaTex: Texture | null = null
  private propsTex: Texture | null = null

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

    try {
      const results = await Assets.load([
        { alias: 'terrain', src: '/assets/tilesets/1.png' },
        { alias: 'props3',  src: '/assets/tilesets/3.png' },
      ])
      terrainTex    = Assets.get('terrain')
      this.propsTex = Assets.get('props3')
    } catch (e) {
      console.warn('[world] Asset load failed', e)
    }

    if (terrainTex) this.buildTiledGrass(terrainTex)
    else            this.buildFallbackGrass()

    this.buildPond(terrainTex)
    this.buildPath()
    this.buildFlowers()

    if (this.propsTex) {
      this.scatterProps(this.propsTex)
      this.addWell(this.propsTex)
    } else {
      this.buildFallbackProps()
    }

    this.spawnCharacters()
  }

  // ── TERRAIN ──────────────────────────────────────────────────────────────

  private buildTiledGrass(tex: Texture) {
    const variants = GRASS_FRAMES.map(f => new Texture({ source: tex.source, frame: f }))
    const rand = (x: number, y: number) => ((x * 1619 + y * 31337) & 0xffff) / 0xffff

    for (let ty = 0; ty < WORLD_H; ty++) {
      for (let tx = 0; tx < WORLD_W; tx++) {
        const r = rand(tx, ty)
        const idx = r < 0.55 ? 0 : r < 0.7 ? 1 : r < 0.82 ? 2 : r < 0.9 ? 3 : r < 0.95 ? 4 : 5
        const s = new Sprite(variants[idx])
        s.x = tx * TILE
        s.y = ty * TILE
        this.worldContainer.addChild(s)
      }
    }
  }

  private buildFallbackGrass() {
    const bg = new Graphics()
    bg.rect(0, 0, WORLD_W * TILE, WORLD_H * TILE)
    bg.fill(0x4a7c59)
    this.worldContainer.addChild(bg)
  }

  // ── GROUND DETAILS (from tileset) ────────────────────────────────────────

  private buildPond(terrainTex: Texture | null) {
    const cx = (WORLD_W * TILE) / 2
    const cy = (WORLD_H * TILE) / 2
    // Draw a pond NW of center using water-colored tiles
    const pondG = new Graphics()
    // Use actual blue color matching water tiles in 1.png
    const pondTiles = [
      [-5,-5],[-4,-5],[-3,-5],[-2,-5],
      [-6,-4],[-5,-4],[-4,-4],[-3,-4],[-2,-4],[-1,-4],
      [-6,-3],[-5,-3],[-4,-3],[-3,-3],[-2,-3],[-1,-3],
      [-5,-2],[-4,-2],[-3,-2],[-2,-2],
    ]
    const px = cx - 100, py = cy - 80
    for (const [dx, dy] of pondTiles) {
      pondG.rect(px + dx * TILE, py + dy * TILE, TILE, TILE)
      pondG.fill(0x4a8fd4)
    }
    // Shore ring
    for (const [dx, dy] of pondTiles) {
      pondG.rect(px + dx * TILE - 1, py + dy * TILE - 1, TILE + 2, TILE + 2)
      pondG.stroke({ color: 0x2a6aaa, width: 1, alpha: 0.5 })
    }
    this.worldContainer.addChild(pondG)

    // Pond is a collidable zone
    this.collidables.push({ x: px - 6*TILE, y: py - 6*TILE, w: 7*TILE, h: 5*TILE })
  }

  private buildPath() {
    const cx = (WORLD_W * TILE) / 2
    const cy = (WORLD_H * TILE) / 2
    // Dirt path from south border to Talia — using sandy tile color from 1.png
    const pathG = new Graphics()
    for (let y = cy + 28; y < WORLD_H * TILE - 3*TILE; y += TILE) {
      for (let dx = -1; dx <= 1; dx++) {
        pathG.rect(cx + dx*TILE - TILE/2, y, TILE, TILE)
        pathG.fill(0x9b7d3a)
      }
    }
    this.worldContainer.addChild(pathG)
  }

  private buildFlowers() {
    // Flower/small plant tiles from 3.png — (96,16) and (112,16)
    // Until we know those tiles are right, draw simple pixel flowers
    const cx = (WORLD_W * TILE) / 2
    const cy = (WORLD_H * TILE) / 2
    const fg = new Graphics()

    const spots = [
      [cx + 64, cy + 44, 0xffdd44], [cx - 50, cy + 72, 0xff88aa],
      [cx + 90, cy - 32, 0xffffff], [cx - 90, cy + 28, 0xffcc00],
      [cx + 40, cy - 68, 0xff99bb], [cx - 60, cy - 50, 0xaaddff],
      [cx + 110, cy + 10, 0xffdd44], [cx - 30, cy + 100, 0xff88aa],
    ]
    for (const [fx, fy, color] of spots) {
      // 5 flower heads per cluster, each 2px
      for (let i = 0; i < 6; i++) {
        const ox = ((i * 137 + 7) % 22) - 11
        const oy = ((i * 97  + 3) % 18) - 9
        fg.rect(fx + ox, fy + oy, 2, 2)
        fg.fill(color as number)
        fg.rect(fx + ox, fy + oy + 2, 1, 4)
        fg.fill(0x4a7c40)
      }
    }
    this.worldContainer.addChild(fg)
  }

  // ── PROPS (from 3.png) ───────────────────────────────────────────────────

  private scatterProps(tex: Texture) {
    const cx = (WORLD_W * TILE) / 2
    const cy = (WORLD_H * TILE) / 2
    const CLEAR = 90

    let seed = 42
    const next = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff }

    const BORDER = 3
    const placements: Array<{x: number, y: number, def: PropDef}> = []

    for (let i = 0; i < 70; i++) {
      const x = (BORDER + next() * (WORLD_W - BORDER*2)) * TILE
      const y = (BORDER + next() * (WORLD_H - BORDER*2)) * TILE

      if (Math.hypot(x - cx, y - cy) < CLEAR) continue

      const defIdx = Math.floor(next() * PROP_DEFS.length)
      const def = PROP_DEFS[defIdx]

      // Avoid overlapping existing props
      const tooClose = placements.some(p =>
        Math.hypot(x - p.x, y - p.y) < def.colW + 4
      )
      if (tooClose) continue

      placements.push({ x, y, def })
    }

    // Dense tree border — place trees INSIDE the world bounds (anchor is bottom-center)
    // Tree is 64px tall, so place at y=5*TILE so top is at y=TILE (not clipped)
    const treeDef = PROP_DEFS[0]  // verified large tree
    const TREE_ROWS_TOP = 5    // trees anchored here have tops visible within world
    const TREE_ROWS_BOT = WORLD_H - 2

    for (let tx = BORDER + 1; tx < WORLD_W - BORDER - 1; tx += 3) {
      placements.push({ x: tx * TILE, y: TREE_ROWS_TOP * TILE,  def: treeDef })
      placements.push({ x: tx * TILE, y: TREE_ROWS_BOT * TILE,  def: treeDef })
    }
    for (let ty = TREE_ROWS_TOP + 3; ty < TREE_ROWS_BOT - 2; ty += 3) {
      placements.push({ x: (BORDER + 1) * TILE,           y: ty * TILE, def: treeDef })
      placements.push({ x: (WORLD_W - BORDER - 2) * TILE, y: ty * TILE, def: treeDef })
    }

    for (const { x, y, def } of placements) {
      const propTex = new Texture({
        source: tex.source,
        frame: new Rectangle(def.sx, def.sy, def.sw, def.sh),
      })
      const s = new Sprite(propTex)
      s.anchor.set(...def.anchor)
      s.x = x
      s.y = y
      this.worldContainer.addChild(s)

      this.collidables.push({
        x: x + def.colX,
        y: y + def.colY,
        w: def.colW,
        h: def.colH,
      })
    }
  }

  private addWell(tex: Texture) {
    const cx = (WORLD_W * TILE) / 2
    const cy = (WORLD_H * TILE) / 2
    const wx = cx + 80, wy = cy - 40
    // Well: col0-2 row4-7 = (0, 4*16, 3*16, 4*16) = (0, 64, 48, 64) — verified clean
    const wellTex = new Texture({ source: tex.source, frame: new Rectangle(0, 64, 48, 64) })
    const well = new Sprite(wellTex)
    well.anchor.set(0.5, 1)
    well.x = wx
    well.y = wy
    this.worldContainer.addChild(well)
    this.collidables.push({ x: wx - 18, y: wy - 32, w: 36, h: 28 })
  }

  private buildFallbackProps() {
    const cx = (WORLD_W * TILE) / 2
    const cy = (WORLD_H * TILE) / 2
    const g = new Graphics()
    const addTree = (x: number, y: number) => {
      g.rect(x + 4, y + 10, 8, 6); g.fill(0x8b5e3c)
      g.rect(x, y, 16, 12);        g.fill(0x2d5a27)
      this.collidables.push({ x, y, w: 16, h: 16 })
    }
    for (let tx = 2; tx < WORLD_W - 2; tx += 3) {
      addTree(tx * TILE, 2 * TILE)
      addTree(tx * TILE, (WORLD_H - 3) * TILE)
    }
    for (let ty = 4; ty < WORLD_H - 4; ty += 3) {
      if (Math.hypot(tx => 2 * TILE - cx, ty * TILE - cy) > 90) {
        addTree(2 * TILE, ty * TILE)
        addTree((WORLD_W - 3) * TILE, ty * TILE)
      }
    }
    this.worldContainer.addChild(g)
  }

  // ── CHARACTERS ───────────────────────────────────────────────────────────

  private spawnCharacters() {
    const cx = (WORLD_W * TILE) / 2
    const cy = (WORLD_H * TILE) / 2

    this.talia = new TaliaCharacter(cx, cy)
    this.worldContainer.addChild(this.talia.sprite)

    this.player = new Player(cx, cy + 52)
    this.worldContainer.addChild(this.player.sprite)
  }

  // ── INPUT ────────────────────────────────────────────────────────────────

  private setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true
      if (e.code === 'Escape') this.dialogue?.close()
      if (e.code === 'Enter' && this.dialogue?.isOpen) this.dialogue.submit()
    })
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false })
  }

  // ── COLLISION ────────────────────────────────────────────────────────────

  private checkCollision(nx: number, ny: number): boolean {
    const pw = 8, ph = 8
    const px = nx - pw / 2, py = ny - ph / 2
    return this.collidables.some(c =>
      px < c.x + c.w && px + pw > c.x &&
      py < c.y + c.h && py + ph > c.y
    )
  }

  // ── GAME LOOP ────────────────────────────────────────────────────────────

  update(delta: number) {
    if (this.dialogue?.isOpen) return
    if (!this.player || !this.talia) return

    const speed = 1.5
    let dx = 0, dy = 0
    if (this.keys['KeyW'] || this.keys['ArrowUp'])    dy -= speed
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  dy += speed
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  dx -= speed
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += speed

    const minB = TILE * 3, maxX = (WORLD_W - 3) * TILE, maxY = (WORLD_H - 3) * TILE
    const nx = Math.max(minB, Math.min(maxX, this.player.sprite.x + dx * delta))
    const ny = Math.max(minB, Math.min(maxY, this.player.sprite.y + dy * delta))

    // Try X, then Y separately (slide along walls)
    const canX = !this.checkCollision(nx, this.player.sprite.y)
    const canY = !this.checkCollision(this.player.sprite.x, ny)

    const finalDx = canX ? dx : 0
    const finalDy = canY ? dy : 0

    this.player.move(finalDx * delta, finalDy * delta, minB, minB, maxX, maxY)
    this.player.update(delta, finalDx, finalDy)

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
    const wpw = WORLD_W * TILE, wph = WORLD_H * TILE
    let cx = this.player.sprite.x - sw / 2
    let cy = this.player.sprite.y - sh / 2
    cx = Math.max(0, Math.min(wpw - sw, cx))
    cy = Math.max(0, Math.min(wph - sh, cy))
    this.worldContainer.x = -cx
    this.worldContainer.y = -cy
  }
}
