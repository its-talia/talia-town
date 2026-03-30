import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import { Player } from '../entities/Player'
import { TaliaCharacter } from '../entities/TaliaCharacter'
import { DialogueManager } from '../ui/DialogueManager'

const T = 16
const W = 64   // world tiles wide
const H = 48   // world tiles tall

// ─── Verified tile IDs ──────────────────────────────────────────────────────
// Encode as [tileset_number, col, row]
type TileRef = [number, number, number]

// 1.png — main terrain (30 cols × 48 rows)
const GRASS: TileRef[]   = [[1,1,3],[1,2,3],[1,1,2],[1,2,2],[1,7,3],[1,8,3]]
// Water interior — solid blue (121,156,255)
const WATER: TileRef[]   = [[1,2,8],[1,3,8],[1,2,9],[1,3,9]]
// Shore tiles — placed AT water edge positions (contain land+water)
const SH_TOP: TileRef    = [1,2,7]    // full solid — grass top, water bottom
const SH_BOT: TileRef    = [1,2,10]   // water top, grass bottom
const SH_L:   TileRef    = [1,0,8]    // water right, transparent left
const SH_R:   TileRef    = [1,5,8]    // water left, transparent right
const SH_TL:  TileRef    = [1,1,6]    // corner: water in BR
const SH_TR:  TileRef    = [1,4,6]    // corner: water in BL
const SH_BL:  TileRef    = [1,1,10]   // corner: water in TR
const SH_BR:  TileRef    = [1,4,10]   // corner: water in TL

// 7.png — cliff tiles on grass (35 cols × 12 rows)
// Verified brown/tan: (9,3)(10,3)(8,4)(9,4) etc
const CLIFF:  TileRef[]  = [[7,9,3],[7,10,3],[7,8,4],[7,9,4],[7,10,4],[7,8,5],[7,9,5],[7,10,5]]
// Cliff face (darker, bottom edge of ridge)
const CLIFF_FACE: TileRef[] = [[7,0,7],[7,1,7],[7,5,7],[7,0,8],[7,1,8],[7,4,8],[7,5,8]]
// Grass on top of cliff (7.png has its own grass tiles: bright green)
const CLIFF_GRASS: TileRef[] = [[7,2,3],[7,3,3],[7,1,4],[7,2,4],[7,3,4],[7,4,4]]

// 10.png — dirt path (14 cols × 20 rows)
// Verified warm tan: (6,10)(7,10)(6,11)(7,11)
const PATH: TileRef[]    = [[10,6,10],[10,7,10],[10,6,11],[10,7,11],[10,0,10],[10,1,10]]

// 3.png — props (verified)
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
interface PlacedTile { x:number; y:number; ref:TileRef }

export class WorldScene {
  container: Container
  private app: Application
  private player!: Player
  private talia!: TaliaCharacter
  private dialogue: DialogueManager
  private worldContainer: Container
  private keys: Record<string,boolean> = {}
  private collidables: Collidable[] = []
  private waterSprites: Array<{sprite:Sprite; baseX:number; baseY:number}> = []
  private animTick = 0
  private texCache = new Map<string,Texture>()
  private tilesets = new Map<number, Texture>()

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
    try {
      await Assets.load([
        { alias: 'ts1',  src: '/assets/tilesets/1.png'  },
        { alias: 'ts7',  src: '/assets/tilesets/7.png'  },
        { alias: 'ts10', src: '/assets/tilesets/10.png' },
        { alias: 'ts3',  src: '/assets/tilesets/3.png'  },
      ])
      this.tilesets.set(1,  Assets.get('ts1'))
      this.tilesets.set(7,  Assets.get('ts7'))
      this.tilesets.set(10, Assets.get('ts10'))
      this.tilesets.set(3,  Assets.get('ts3'))
    } catch(e) {
      console.warn('[world] Asset load failed:', e)
    }

    this.buildMap()
    this.spawnCharacters()
  }

  // ── Texture helper ────────────────────────────────────────────────────────

  private getTex([tsId, col, row]: TileRef): Texture | null {
    const key = `${tsId}_${col}_${row}`
    if (this.texCache.has(key)) return this.texCache.get(key)!
    const ts = this.tilesets.get(tsId)
    if (!ts) return null
    const tex = new Texture({ source: ts.source, frame: new Rectangle(col*T, row*T, T, T) })
    this.texCache.set(key, tex)
    return tex
  }

  private getPropsTexture(def: PropDef): Texture | null {
    const ts = this.tilesets.get(3)
    if (!ts) return null
    const key = `props_${def.sx}_${def.sy}_${def.sw}_${def.sh}`
    if (this.texCache.has(key)) return this.texCache.get(key)!
    const tex = new Texture({ source: ts.source, frame: new Rectangle(def.sx, def.sy, def.sw, def.sh) })
    this.texCache.set(key, tex)
    return tex
  }

  private sprite(ref: TileRef, x: number, y: number, isWater=false): Sprite | null {
    const tex = this.getTex(ref)
    if (!tex) return null
    const s = new Sprite(tex)
    s.x = x; s.y = y
    if (isWater) this.waterSprites.push({ sprite: s, baseX: x, baseY: y })
    return s
  }

  // ── Map generation ────────────────────────────────────────────────────────

  private buildMap() {
    if (this.tilesets.size === 0) { this.buildFallback(); return }

    // Determine map zones
    const { waterSet, shoreMap, pathSet, cliffSet, cliffFaceSet } = this.generateZones()

    // ── Layer 0: Grass base ──────────────────────────────────────────────
    const rand = (x:number,y:number) => ((x*1619+y*31337)&0xffff)/0xffff
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const k = `${tx},${ty}`
        if (waterSet.has(k) || shoreMap.has(k)) continue  // will be drawn as water/shore
        
        // Cliff top uses 7.png grass for matching color
        let grassRef: TileRef
        if (cliffSet.has(k)) {
          const idx = Math.floor(rand(tx,ty) * CLIFF_GRASS.length)
          grassRef = CLIFF_GRASS[idx]
        } else {
          const r = rand(tx,ty)
          grassRef = GRASS[Math.floor(r * GRASS.length)]
        }
        const s = this.sprite(grassRef, tx*T, ty*T)
        if (s) this.worldContainer.addChild(s)
      }
    }

    // ── Layer 1: Water fills ─────────────────────────────────────────────
    for (const k of waterSet) {
      const [tx, ty] = k.split(',').map(Number)
      const r = rand(tx, ty)
      const ref = WATER[Math.floor(r * WATER.length)]
      const s = this.sprite(ref, tx*T, ty*T, true)
      if (s) this.worldContainer.addChild(s)
      this.collidables.push({ x: tx*T, y: ty*T, w: T, h: T })
    }

    // ── Layer 2: Shore tiles (placed AT boundary, already contain transition) ──
    for (const [k, ref] of shoreMap) {
      const [tx, ty] = k.split(',').map(Number)
      const s = this.sprite(ref, tx*T, ty*T, false)
      if (s) this.worldContainer.addChild(s)
      this.collidables.push({ x: tx*T, y: ty*T, w: T, h: T })
    }

    // ── Layer 3: Path ────────────────────────────────────────────────────
    for (const k of pathSet) {
      const [tx, ty] = k.split(',').map(Number)
      const r = rand(tx,ty)
      const ref = PATH[Math.floor(r * PATH.length)]
      const s = this.sprite(ref, tx*T, ty*T)
      if (s) this.worldContainer.addChild(s)
    }

    // ── Layer 4: Cliff fill (brown rocky ridge top) ──────────────────────
    for (const k of cliffSet) {
      const [tx, ty] = k.split(',').map(Number)
      const r = rand(tx,ty)
      const ref = CLIFF[Math.floor(r * CLIFF.length)]
      const s = this.sprite(ref, tx*T, ty*T)
      if (s) this.worldContainer.addChild(s)
      this.collidables.push({ x: tx*T, y: ty*T, w: T, h: T })
    }

    // ── Layer 5: Cliff face (south edge of each ridge) ──────────────────
    for (const k of cliffFaceSet) {
      const [tx, ty] = k.split(',').map(Number)
      const r = rand(tx,ty)
      const ref = CLIFF_FACE[Math.floor(r * CLIFF_FACE.length)]
      const s = this.sprite(ref, tx*T, ty*T)
      if (s) this.worldContainer.addChild(s)
    }

    // ── Layer 6: Props ───────────────────────────────────────────────────
    this.buildProps(waterSet, cliffSet)
  }

  private generateZones() {
    const waterSet    = new Set<string>()
    const shoreMap    = new Map<string, TileRef>()
    const pathSet     = new Set<string>()
    const cliffSet    = new Set<string>()
    const cliffFaceSet = new Set<string>()

    // ── LAKE: SW quadrant, diagonal NE shoreline ─────────────────────────
    // Shore runs top-right to bottom-left: col = 20 - (row - 10)
    // Tiles left of the line AND below row 10 are water
    const shoreLineCol = (ty: number) => Math.round(22 - (ty - 10))

    for (let ty = 10; ty < H; ty++) {
      const edge = shoreLineCol(ty)
      for (let tx = 0; tx < W; tx++) {
        if (tx < edge - 1) {
          // Deep water — interior
          waterSet.add(`${tx},${ty}`)
        }
      }
    }

    // Shore tiles: tiles at the boundary (tx === edge-1) get shore sprites
    for (let ty = 10; ty < H; ty++) {
      const edge = shoreLineCol(ty)
      const edgeTx = edge - 1  // the transition tile column

      if (edgeTx < 0 || edgeTx >= W) continue

      // Determine the shore orientation by checking neighbors
      const prevEdge = shoreLineCol(ty - 1)
      const nextEdge = shoreLineCol(ty + 1)

      if (ty === 10) {
        // Top-most row: top shore
        for (let tx = 0; tx < edgeTx; tx++) {
          shoreMap.set(`${tx},${ty}`, SH_TOP)
        }
        shoreMap.set(`${edgeTx},${ty}`, SH_TR)
      } else {
        // Right edge of water (where water meets grass on the right)
        shoreMap.set(`${edgeTx},${ty}`, SH_R)
        // Top shore for the step
        if (edgeTx > prevEdge - 1) {
          // Shore stepped left — add top shore for the new tiles
          for (let tx = edgeTx; tx < prevEdge; tx++) {
            if (!shoreMap.has(`${tx},${ty}`) && !waterSet.has(`${tx},${ty}`)) {
              shoreMap.set(`${tx},${ty}`, SH_TOP)
            }
          }
        }
      }
    }

    // Left border of water (all water rows, leftmost)
    for (let ty = 11; ty < H; ty++) {
      for (let tx = 0; tx <= 1; tx++) {
        if (waterSet.has(`${tx},${ty}`)) {
          shoreMap.set(`${tx},${ty}`, tx === 0 ? SH_L : SH_L)
        }
      }
    }

    // Bottom water row — shore at bottom
    for (let tx = 0; tx < shoreLineCol(H-1) - 1; tx++) {
      if (!shoreMap.has(`${tx},${H-1}`)) {
        shoreMap.set(`${tx},${H-1}`, SH_BOT)
      }
    }

    // Clean up: remove shoreMap entries that are in waterSet
    for (const k of [...shoreMap.keys()]) {
      if (waterSet.has(k)) shoreMap.delete(k)
    }

    // ── PATH: vertical dirt path in right-center ─────────────────────────
    const PATH_CX = Math.round(W * 0.62)  // ~col 39
    const TALIA_ROW = Math.round(H * 0.28) // ~row 13
    const PATH_WIDTH = 3

    for (let ty = TALIA_ROW + 1; ty < H - 2; ty++) {
      for (let dx = -PATH_WIDTH; dx <= PATH_WIDTH; dx++) {
        const tx = PATH_CX + dx
        if (tx >= 0 && tx < W && !waterSet.has(`${tx},${ty}`) && !shoreMap.has(`${tx},${ty}`)) {
          pathSet.add(`${tx},${ty}`)
        }
      }
    }
    // Widen at bottom
    for (let ty = H - 12; ty < H - 2; ty++) {
      for (let dx = -6; dx <= 6; dx++) {
        const tx = PATH_CX + dx
        if (tx >= 0 && tx < W && !waterSet.has(`${tx},${ty}`)) {
          pathSet.add(`${tx},${ty}`)
        }
      }
    }

    // ── CLIFF RIDGES: two E-W brown ridges ───────────────────────────────
    const addRidge = (rowStart:number, rowEnd:number, colStart:number, colEnd:number) => {
      for (let tx = colStart; tx <= colEnd; tx++) {
        // Skip gap for path
        if (tx >= PATH_CX - 4 && tx <= PATH_CX + 4) continue
        if (waterSet.has(`${tx},${rowStart}`) || shoreMap.has(`${tx},${rowStart}`)) continue
        for (let ty = rowStart; ty <= rowEnd; ty++) {
          cliffSet.add(`${tx},${ty}`)
        }
        // Cliff face = one row below ridge
        if (!waterSet.has(`${tx},${rowEnd+1}`)) {
          cliffFaceSet.add(`${tx},${rowEnd+1}`)
        }
      }
    }

    // Ridge 1: ~row 18-19, cols 22-58
    addRidge(18, 19, 22, 58)
    // Ridge 2: ~row 27-28, cols 15-52 (offset left, slight downward curve east)
    addRidge(27, 28, 15, 52)

    return { waterSet, shoreMap, pathSet, cliffSet, cliffFaceSet }
  }

  // ── Props ─────────────────────────────────────────────────────────────────

  private buildProps(waterSet: Set<string>, cliffSet: Set<string>) {
    const PATH_CX = Math.round(W * 0.62)
    const TALIA_ROW = Math.round(H * 0.28)
    const taliaX = PATH_CX * T
    const taliaY = TALIA_ROW * T
    const CLEAR = 80

    const isBlocked = (tx:number, ty:number) =>
      waterSet.has(`${tx},${ty}`) || cliffSet.has(`${tx},${ty}`)

    let seed = 9999
    const next = () => { seed = (seed*1664525+1013904223)&0x7fffffff; return seed/0x7fffffff }

    const propKeys = ['tree','treeMed','treeAlt','rockSm','boulder']
    const placements: Array<{x:number; y:number; def:PropDef}> = []

    for (let i = 0; i < 100; i++) {
      const tx = 2 + Math.floor(next() * (W-4))
      const ty = 2 + Math.floor(next() * (H-4))
      if (isBlocked(tx, ty)) continue
      const px = tx*T, py = ty*T
      if (Math.hypot(px-taliaX, py-taliaY) < CLEAR) continue
      const def = PROPS[propKeys[Math.floor(next()*propKeys.length)]]
      if (placements.some(p => Math.hypot(px-p.x, py-p.y) < 24)) continue
      placements.push({ x:px, y:py, def })
    }

    // Well east of Talia
    placements.push({ x: taliaX + 5*T, y: taliaY - T, def: PROPS.well })

    for (const { x, y, def } of placements) {
      const tex = this.getPropsTexture(def)
      if (!tex) continue
      const s = new Sprite(tex)
      s.anchor.set(0.5, 1)
      s.x = x; s.y = y
      this.worldContainer.addChild(s)
      this.collidables.push({ x: x+def.colX, y: y+def.colY, w: def.colW, h: def.colH })
    }
  }

  // ── Characters ────────────────────────────────────────────────────────────

  private spawnCharacters() {
    const PATH_CX = Math.round(W * 0.62)
    const TALIA_ROW = Math.round(H * 0.28)
    const tx = PATH_CX * T
    const ty = TALIA_ROW * T

    this.talia = new TaliaCharacter(tx, ty)
    this.worldContainer.addChild(this.talia.sprite)

    this.player = new Player(tx, ty + 7*T)
    this.worldContainer.addChild(this.player.sprite)
  }

  // ── Fallback ──────────────────────────────────────────────────────────────

  private buildFallback() {
    const g = new Graphics()
    g.rect(0, 0, W*T, H*T); g.fill(0x4a7c59)
    this.worldContainer.addChild(g)
    this.spawnCharacters()
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
      nx-hw < c.x+c.w && nx+hw > c.x && ny-hh < c.y+c.h && ny+hh > c.y
    )
  }

  // ── Game loop ─────────────────────────────────────────────────────────────

  update(delta: number) {
    if (this.dialogue?.isOpen) return
    if (!this.player || !this.talia) return

    // Water shimmer animation
    this.animTick += delta * 0.03
    for (const w of this.waterSprites) {
      w.sprite.y = w.baseY + Math.sin(this.animTick + w.baseX * 0.015) * 0.35
    }

    const speed = 1.5
    let dx = 0, dy = 0
    if (this.keys['KeyW']||this.keys['ArrowUp'])    dy -= speed
    if (this.keys['KeyS']||this.keys['ArrowDown'])  dy += speed
    if (this.keys['KeyA']||this.keys['ArrowLeft'])  dx -= speed
    if (this.keys['KeyD']||this.keys['ArrowRight']) dx += speed

    const minB = T*2, maxX = (W-2)*T, maxY = (H-2)*T
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
    cx = Math.max(0, Math.min(W*T-sw, cx))
    cy = Math.max(0, Math.min(H*T-sh, cy))
    this.worldContainer.x = -cx
    this.worldContainer.y = -cy
  }
}
