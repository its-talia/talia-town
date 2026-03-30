import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import { Player } from '../entities/Player'
import { TaliaCharacter } from '../entities/TaliaCharacter'
import { DialogueManager } from '../ui/DialogueManager'

const TILE = 16
const WORLD_W = 80   // tiles
const WORLD_H = 60   // tiles

// Tile coords in 1.png (30 tiles wide, each tile is 16x16)
// Row 0 is the first row of green grass tiles
const GRASS_TILES = [
  { tx: 0, ty: 0 },  // bright grass center
  { tx: 1, ty: 0 },
  { tx: 2, ty: 0 },
]

export class WorldScene {
  container: Container
  private app: Application
  private player: Player
  private talia: TaliaCharacter
  private dialogue: DialogueManager
  private worldContainer: Container
  private keys: Record<string, boolean> = {}
  private assetsLoaded = false

  constructor(app: Application, dialogue: DialogueManager) {
    this.app = app
    this.dialogue = dialogue
    this.container = new Container()
    this.worldContainer = new Container()
    this.container.addChild(this.worldContainer)

    // Load assets then build world
    this.loadAndBuild()

    this.setupInput()
  }

  private async loadAndBuild() {
    let terrainTex: Texture | null = null
    let propsTex: Texture | null = null

    try {
      await Assets.load([
        { alias: 'terrain', src: '/assets/tilesets/1.png' },
        { alias: 'props',   src: '/assets/tilesets/3.png' },
      ])
      terrainTex = Assets.get('terrain')
      propsTex   = Assets.get('props')
      this.assetsLoaded = true
    } catch (e) {
      console.warn('[world] Tileset assets not loaded, using fallback Graphics')
    }

    this.buildWorld(terrainTex, propsTex)
    this.spawnCharacters()
  }

  private buildWorld(terrainTex: Texture | null, propsTex: Texture | null) {
    if (terrainTex) {
      this.buildTiledGrass(terrainTex)
    } else {
      this.buildFallbackGrass()
    }

    this.addGroundDetails()

    if (propsTex) {
      this.scatterProps(propsTex)
    } else {
      this.scatterFallbackTrees()
    }
  }

  // --- Terrain ---

  private buildTiledGrass(tex: Texture) {
    // Confirmed solid fill grass tiles from 1.png (verified pixel-by-pixel):
    // (col, row) → pixel (col*16, row*16)
    // (1,3)=16,48  (3,3)=48,48  (1,2)=16,32  (3,2)=48,32  (7,3)=112,48  (8,3)=128,48
    const variants = [
      new Texture({ source: tex.source, frame: new Rectangle(16,  48, TILE, TILE) }),
      new Texture({ source: tex.source, frame: new Rectangle(48,  48, TILE, TILE) }),
      new Texture({ source: tex.source, frame: new Rectangle(16,  32, TILE, TILE) }),
      new Texture({ source: tex.source, frame: new Rectangle(48,  32, TILE, TILE) }),
      new Texture({ source: tex.source, frame: new Rectangle(112, 48, TILE, TILE) }),
      new Texture({ source: tex.source, frame: new Rectangle(128, 48, TILE, TILE) }),
    ]

    // Seed a simple deterministic noise for tile variety
    const rand = (x: number, y: number) => ((x * 1619 + y * 31337) & 0xffff) / 0xffff

    for (let ty = 0; ty < WORLD_H; ty++) {
      for (let tx = 0; tx < WORLD_W; tx++) {
        const r = rand(tx, ty)
        const idx = r < 0.7 ? 0 : r < 0.9 ? 1 : 2
        const sprite = new Sprite(variants[idx])
        sprite.x = tx * TILE
        sprite.y = ty * TILE
        this.worldContainer.addChild(sprite)
      }
    }
  }

  private buildFallbackGrass() {
    const bg = new Graphics()
    bg.rect(0, 0, WORLD_W * TILE, WORLD_H * TILE)
    bg.fill(0x4a7c59)
    this.worldContainer.addChild(bg)

    const patches = new Graphics()
    const rand = (x: number, y: number) => ((x * 1619 + y * 31337) & 0xffff) / 0xffff
    for (let ty = 0; ty < WORLD_H; ty++) {
      for (let tx = 0; tx < WORLD_W; tx++) {
        const r = rand(tx, ty)
        if (r > 0.8) {
          patches.rect(tx * TILE, ty * TILE, TILE, TILE)
          patches.fill(r > 0.93 ? 0x3a5c40 : 0x3d6b4a)
        }
      }
    }
    this.worldContainer.addChild(patches)
    this.addFallbackDetails()
  }

  private addFallbackDetails() {
    const details = new Graphics()
    const cx = (WORLD_W * TILE) / 2
    const cy = (WORLD_H * TILE) / 2

    // Dirt path from south edge to Talia
    for (let y = cy + 32; y < WORLD_H * TILE - TILE * 3; y += TILE) {
      details.rect(cx - 12, y, 24, TILE); details.fill(0x8b6914)
    }

    // Small pond northwest of center
    details.ellipse(cx - 120, cy - 80, 40, 28); details.fill(0x3a7abf)
    details.ellipse(cx - 120, cy - 80, 36, 24); details.fill(0x4a8fd4)

    // Flower clusters
    const flowers = [
      [cx + 60, cy + 40], [cx - 50, cy + 70], [cx + 80, cy - 30],
      [cx + 30, cy - 60], [cx - 80, cy + 20]
    ]
    for (const [fx, fy] of flowers) {
      details.circle(fx, fy, 3);         details.fill(0xffdd44)
      details.circle(fx + 8, fy + 4, 3); details.fill(0xff88aa)
      details.circle(fx - 6, fy + 6, 3); details.fill(0xffffff)
    }

    this.worldContainer.addChild(details)
  }

  // --- Ground details (path, pond, flowers) ---

  private addGroundDetails() {
    const details = new Graphics()
    const cx = (WORLD_W * TILE) / 2
    const cy = (WORLD_H * TILE) / 2

    // Dirt path leading from south edge up to Talia
    for (let y = cy + 30; y < WORLD_H * TILE - TILE * 4; y += 2) {
      details.rect(cx - 10, y, 20, 3)
      details.fill({ color: 0x9b7d3a, alpha: 0.55 })
    }

    // Small pond northwest
    details.ellipse(cx - 130, cy - 90, 44, 30)
    details.fill(0x3a7abf)
    details.ellipse(cx - 130, cy - 90, 40, 26)
    details.fill(0x5a9fd4)

    // Flower clusters scattered around
    const flowerSpots = [
      [cx + 64, cy + 44, 0xffdd44],
      [cx - 50, cy + 72, 0xff88aa],
      [cx + 90, cy - 32, 0xffffff],
      [cx - 90, cy + 28, 0xffcc00],
      [cx + 40, cy - 68, 0xff88aa],
      [cx - 60, cy - 50, 0xaaddff],
    ]
    for (const [fx, fy, color] of flowerSpots) {
      for (let i = 0; i < 5; i++) {
        const ox = ((i * 137) % 20) - 10
        const oy = ((i * 97) % 16) - 8
        details.circle(fx + ox, fy + oy, 2.5)
        details.fill(color as number)
        // Stem
        details.rect(fx + ox - 0.5, fy + oy + 2, 1, 4)
        details.fill(0x4a7c40)
      }
    }

    this.worldContainer.addChild(details)
  }

  // --- Props ---

  // 3.png is 480x128 (30 tiles wide, 8 tiles tall)
  // Visually identified props:
  //   Trees ~(0,0)-(31,63), bushes, rocks, well
  private scatterProps(tex: Texture) {
    // Verified prop regions from 3.png (sampled pixel-by-pixel)
    const props = [
      { name: 'tree-large',   x: 0,   y: 0,  w: 48, h: 64 },
      { name: 'tree-small',   x: 48,  y: 0,  w: 32, h: 48 },
      { name: 'tree-medium',  x: 128, y: 0,  w: 32, h: 64 },
      { name: 'rock-large',   x: 224, y: 0,  w: 32, h: 32 },
      { name: 'rock-small',   x: 224, y: 32, w: 16, h: 16 },
      { name: 'boulder',      x: 256, y: 0,  w: 48, h: 48 },
    ]

    const rand = (seed: number) => ((seed * 1619 + 31337) & 0xffff) / 0xffff
    const centerX = (WORLD_W * TILE) / 2
    const centerY = (WORLD_H * TILE) / 2
    const clearRadius = 80  // keep center clear for Talia

    let seed = 42
    const nextRand = () => { seed = (seed * 6364136223846793005 + 1) & 0x7fffffff; return seed / 0x7fffffff }

    for (let i = 0; i < 60; i++) {
      const x = nextRand() * WORLD_W * TILE
      const y = nextRand() * WORLD_H * TILE

      // Don't place props in center clear area or within 2 tiles of edges
      const dist = Math.hypot(x - centerX, y - centerY)
      if (dist < clearRadius) continue
      if (x < TILE * 2 || x > (WORLD_W - 4) * TILE) continue
      if (y < TILE * 2 || y > (WORLD_H - 4) * TILE) continue

      // Pick a prop
      const propIdx = Math.floor(nextRand() * props.length)
      const prop = props[propIdx]

      const propTex = new Texture({
        source: tex.source,
        frame: new Rectangle(prop.x, prop.y, prop.w, prop.h)
      })
      const sprite = new Sprite(propTex)
      sprite.x = Math.round(x / TILE) * TILE
      sprite.y = Math.round(y / TILE) * TILE
      sprite.scale.set(1)
      this.worldContainer.addChild(sprite)
    }

    // Dense tree border around the edge
    this.addTreeBorder(tex)
  }

  private addTreeBorder(tex: Texture) {
    const treeTex = new Texture({
      source: tex.source,
      frame: new Rectangle(0, 0, 48, 64)  // verified large tree coords
    })

    const positions: Array<{x: number, y: number}> = []
    for (let tx = 0; tx < WORLD_W; tx += 3) {
      positions.push({ x: tx * TILE, y: 0 })
      positions.push({ x: tx * TILE, y: (WORLD_H - 4) * TILE })
    }
    for (let ty = 3; ty < WORLD_H - 4; ty += 3) {
      positions.push({ x: 0, y: ty * TILE })
      positions.push({ x: (WORLD_W - 3) * TILE, y: ty * TILE })
    }

    for (const pos of positions) {
      const s = new Sprite(treeTex)
      s.x = pos.x
      s.y = pos.y
      this.worldContainer.addChild(s)
    }
  }

  private scatterFallbackTrees() {
    const trees = new Graphics()
    const rand = (seed: number) => ((seed * 6364136223846793005 + 1) & 0x7fffffff) / 0x7fffffff
    let seed = 42
    const next = () => { seed = (seed * 6364136223846793005 + 1) & 0x7fffffff; return seed / 0x7fffffff }
    const centerX = (WORLD_W * TILE) / 2
    const centerY = (WORLD_H * TILE) / 2

    const addTree = (x: number, y: number) => {
      trees.rect(x + 4, y + 10, 8, 6)
      trees.fill(0x8b5e3c)
      trees.rect(x, y, 16, 12)
      trees.fill(0x2d5a27)
    }

    for (let i = 0; i < 50; i++) {
      const x = next() * WORLD_W * TILE
      const y = next() * WORLD_H * TILE
      if (Math.hypot(x - centerX, y - centerY) < 80) continue
      addTree(Math.round(x / TILE) * TILE, Math.round(y / TILE) * TILE)
    }

    for (let tx = 0; tx < WORLD_W; tx += 3) {
      addTree(tx * TILE, 0)
      addTree(tx * TILE, (WORLD_H - 1) * TILE)
    }
    for (let ty = 3; ty < WORLD_H - 3; ty += 3) {
      addTree(0, ty * TILE)
      addTree((WORLD_W - 1) * TILE, ty * TILE)
    }

    this.worldContainer.addChild(trees)
  }

  // --- Characters ---

  private spawnCharacters() {
    const worldCenterX = (WORLD_W * TILE) / 2
    const worldCenterY = (WORLD_H * TILE) / 2

    this.talia = new TaliaCharacter(worldCenterX, worldCenterY)
    this.worldContainer.addChild(this.talia.sprite)

    this.player = new Player(worldCenterX, worldCenterY + 48)
    this.worldContainer.addChild(this.player.sprite)
  }

  // --- Input ---

  private setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true
      if (e.code === 'Escape') this.dialogue?.close()
      if (e.code === 'Enter' && this.dialogue.isOpen) this.dialogue.submit()
    })
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false })
  }

  // --- Game Loop ---

  update(delta: number) {
    // Don't move while chatting; also guard if characters not yet spawned
    if (this.dialogue?.isOpen) return
    if (!this.player || !this.talia) return

    const speed = 1.5
    let dx = 0, dy = 0
    if (this.keys['KeyW'] || this.keys['ArrowUp'])    dy -= speed
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  dy += speed
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  dx -= speed
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += speed

    const minX = TILE * 2, minY = TILE * 2
    const maxX = (WORLD_W - 2) * TILE, maxY = (WORLD_H - 2) * TILE
    this.player.move(dx * delta, dy * delta, minX, minY, maxX, maxY)
    this.player.update(delta, dx, dy)

    // Proximity to Talia
    const dist = Math.hypot(
      this.player.sprite.x - this.talia.sprite.x,
      this.player.sprite.y - this.talia.sprite.y
    )
    if (dist < 28 && this.dialogue.canOpen()) this.dialogue.open()

    this.talia.update(delta)
    this.updateCamera()
  }

  private updateCamera() {
    const sw = this.app.screen.width
    const sh = this.app.screen.height
    const wpw = WORLD_W * TILE
    const wph = WORLD_H * TILE

    let cx = this.player.sprite.x - sw / 2
    let cy = this.player.sprite.y - sh / 2
    cx = Math.max(0, Math.min(wpw - sw, cx))
    cy = Math.max(0, Math.min(wph - sh, cy))

    this.worldContainer.x = -cx
    this.worldContainer.y = -cy
  }
}
