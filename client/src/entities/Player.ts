import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Texture } from 'pixi.js'

type Direction = 'down' | 'up' | 'left' | 'right'

// Player Base.png: 256x144, 6 cols × 4 rows
// Each frame: ~42.67w × 36h — we round to 42x36 and accept slight crop
const FRAME_W = 42
const FRAME_H = 36
const FRAME_COLS = 6
const ROW: Record<Direction, number> = { down: 0, up: 1, left: 2, right: 3 }

export class Player {
  sprite: Container
  private animated: AnimatedSprite | null = null
  private fallback: Graphics | null = null
  private facing: Direction = 'down'
  private moving = false

  constructor(x: number, y: number) {
    this.sprite = new Container()
    this.sprite.x = x
    this.sprite.y = y

    this.loadSprite()
  }

  private async loadSprite() {
    try {
      const tex = await Assets.load({ alias: 'player-base', src: '/assets/sprites/player-base.png' })
      const frames = this.buildFrames(tex)
      this.animated = new AnimatedSprite(frames['down'])
      this.animated.animationSpeed = 0.1
      this.animated.play()
      this.animated.anchor.set(0.5, 0.9)
      this.sprite.addChild(this.animated)
    } catch {
      this.buildFallback()
    }
  }

  private buildFrames(tex: Texture): Record<Direction, Texture[]> {
    const result: Record<Direction, Texture[]> = { down: [], up: [], left: [], right: [] }
    for (const dir of Object.keys(ROW) as Direction[]) {
      const row = ROW[dir]
      for (let col = 0; col < FRAME_COLS; col++) {
        result[dir].push(
          new Texture({
            source: tex.source,
            frame: new Rectangle(col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H),
          })
        )
      }
    }
    return result
  }

  private allFrames: Record<Direction, Texture[]> | null = null

  private async buildAllFrames() {
    try {
      const tex = Assets.get('player-base') || await Assets.load({ alias: 'player-base', src: '/assets/sprites/player-base.png' })
      this.allFrames = this.buildFrames(tex)
    } catch { /* fallback only */ }
  }

  private buildFallback() {
    const g = new Graphics()
    g.rect(-5, -10, 10, 12); g.fill(0x4a90d9)
    g.circle(0, -14, 6);     g.fill(0xf5c5a3)
    this.fallback = g
    this.sprite.addChild(g)
  }

  move(dx: number, dy: number, minX: number, minY: number, maxX: number, maxY: number) {
    this.sprite.x = Math.max(minX, Math.min(maxX, this.sprite.x + dx))
    this.sprite.y = Math.max(minY, Math.min(maxY, this.sprite.y + dy))
    this.moving = dx !== 0 || dy !== 0

    const newFacing: Direction =
      dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : dx > 0 ? 'right' : this.facing

    if (newFacing !== this.facing) {
      this.facing = newFacing
      this.updateAnimation()
    }
  }

  private async updateAnimation() {
    if (!this.animated) return
    if (!this.allFrames) await this.buildAllFrames()
    if (!this.allFrames) return

    const wasPlaying = this.animated.playing
    this.animated.textures = this.allFrames[this.facing]
    this.animated.gotoAndPlay(0)
  }

  update(delta: number, dx: number, dy: number) {
    if (!this.animated) return
    if (dx === 0 && dy === 0) {
      if (this.animated.playing) {
        this.animated.stop()
        this.animated.currentFrame = 0
      }
    } else {
      if (!this.animated.playing) this.animated.play()
    }
  }
}
