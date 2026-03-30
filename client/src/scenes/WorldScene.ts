import { Application, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js'
import { Player } from '../entities/Player'
import { TaliaCharacter } from '../entities/TaliaCharacter'
import { DialogueManager } from '../ui/DialogueManager'

const TILE_SIZE = 16
const WORLD_W = 80  // tiles wide
const WORLD_H = 60  // tiles tall

export class WorldScene {
  container: Container
  private app: Application
  private player: Player
  private talia: TaliaCharacter
  private dialogue: DialogueManager
  private camera: { x: number; y: number }
  private worldContainer: Container
  private keys: Record<string, boolean> = {}

  constructor(app: Application, dialogue: DialogueManager) {
    this.app = app
    this.dialogue = dialogue
    this.container = new Container()
    this.worldContainer = new Container()
    this.container.addChild(this.worldContainer)
    this.camera = { x: 0, y: 0 }

    this.buildGrassWorld()

    // Talia stands in the center of the world
    const worldCenterX = (WORLD_W * TILE_SIZE) / 2
    const worldCenterY = (WORLD_H * TILE_SIZE) / 2
    this.talia = new TaliaCharacter(worldCenterX, worldCenterY)
    this.worldContainer.addChild(this.talia.sprite)

    // Player spawns slightly below Talia
    this.player = new Player(worldCenterX, worldCenterY + 48)
    this.worldContainer.addChild(this.player.sprite)

    this.setupInput()
  }

  private buildGrassWorld() {
    // Base grass fill using tiling sprite
    try {
      const grassTex = Texture.from('tileset')
      const grass = new TilingSprite({
        texture: grassTex,
        width: WORLD_W * TILE_SIZE,
        height: WORLD_H * TILE_SIZE,
      })
      this.worldContainer.addChild(grass)
    } catch {
      // Fallback: solid green if tileset not loaded
      const bg = new Graphics()
      bg.rect(0, 0, WORLD_W * TILE_SIZE, WORLD_H * TILE_SIZE)
      bg.fill(0x4a7c59)
      this.worldContainer.addChild(bg)
    }

    // Scatter some darker grass patches for visual variety
    const patches = new Graphics()
    for (let i = 0; i < 200; i++) {
      const x = Math.floor(Math.random() * WORLD_W) * TILE_SIZE
      const y = Math.floor(Math.random() * WORLD_H) * TILE_SIZE
      patches.rect(x, y, TILE_SIZE, TILE_SIZE)
      patches.fill(0x3d6b4a)
    }
    this.worldContainer.addChild(patches)

    // Border trees (decorative rectangles until sprite assets arrive)
    this.drawBorderTrees()
  }

  private drawBorderTrees() {
    const trees = new Graphics()
    const treeColor = 0x2d5a27
    const trunkColor = 0x8b5e3c

    const addTree = (x: number, y: number) => {
      // Trunk
      trees.rect(x + 4, y + 10, 8, 6)
      trees.fill(trunkColor)
      // Canopy
      trees.rect(x, y, 16, 12)
      trees.fill(treeColor)
    }

    // Top and bottom rows
    for (let tx = 0; tx < WORLD_W; tx += 3) {
      addTree(tx * TILE_SIZE, 0)
      addTree(tx * TILE_SIZE, (WORLD_H - 1) * TILE_SIZE)
    }
    // Left and right columns
    for (let ty = 3; ty < WORLD_H - 3; ty += 3) {
      addTree(0, ty * TILE_SIZE)
      addTree((WORLD_W - 1) * TILE_SIZE, ty * TILE_SIZE)
    }

    this.worldContainer.addChild(trees)
  }

  private setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true
      if (e.code === 'Escape') this.dialogue.close()
      if (e.code === 'Enter' && this.dialogue.isOpen) {
        this.dialogue.submit()
      }
    })
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false })
  }

  update(delta: number) {
    if (this.dialogue.isOpen) return

    const speed = 1.5
    let dx = 0
    let dy = 0

    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= speed
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += speed
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= speed
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += speed

    const maxX = WORLD_W * TILE_SIZE - TILE_SIZE * 2
    const maxY = WORLD_H * TILE_SIZE - TILE_SIZE * 2

    this.player.move(dx * delta, dy * delta, TILE_SIZE * 2, TILE_SIZE * 2, maxX, maxY)
    this.player.update(delta, dx, dy)

    // Proximity check — within 28px of Talia triggers dialogue
    const dist = Math.hypot(
      this.player.sprite.x - this.talia.sprite.x,
      this.player.sprite.y - this.talia.sprite.y
    )
    if (dist < 28 && !this.dialogue.isOpen) {
      this.dialogue.open()
    }

    this.updateCamera()
    this.talia.update(delta)
  }

  private updateCamera() {
    const screenW = this.app.screen.width
    const screenH = this.app.screen.height
    const worldPixelW = WORLD_W * TILE_SIZE
    const worldPixelH = WORLD_H * TILE_SIZE

    // Center camera on player, clamp to world bounds
    let camX = this.player.sprite.x - screenW / 2
    let camY = this.player.sprite.y - screenH / 2
    camX = Math.max(0, Math.min(worldPixelW - screenW, camX))
    camY = Math.max(0, Math.min(worldPixelH - screenH, camY))

    this.worldContainer.x = -camX
    this.worldContainer.y = -camY
  }
}
