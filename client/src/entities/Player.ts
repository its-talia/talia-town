import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Texture } from 'pixi.js'

type Direction = 'down' | 'up' | 'left' | 'right'

// Pixel-detected frame boundaries from player-base.png (256x144, 4 rows x 8 frames)
// Each row is 36px tall. Frames have variable width — detected from alpha channel.
const ROW_H = 36
const ROW_Y: Record<Direction, number> = { down: 0, up: 36, left: 72, right: 108 }

// X ranges [x0, x1] per direction, pixel-detected
const FRAME_X: Record<Direction, [number, number][]> = {
  down:  [[3,28],[35,60],[69,90],[99,124],[131,156],[163,188],[197,218],[227,252]],
  up:    [[3,28],[37,58],[70,91],[101,122],[131,156],[165,186],[196,217],[229,250]],
  left:  [[3,28],[35,60],[68,91],[99,124],[130,155],[163,188],[196,219],[227,252]],
  right: [[6,25],[38,57],[68,91],[102,121],[134,153],[166,185],[196,217],[230,249]],
}

export class Player {
  sprite: Container
  private animated: AnimatedSprite | null = null
  private fallback: Graphics | null = null
  private facing: Direction = 'down'
  private allFrames: Record<Direction, Texture[]> | null = null

  constructor(x: number, y: number) {
    this.sprite = new Container()
    this.sprite.x = x
    this.sprite.y = y
    this.buildFallback()   // show immediately while sprite loads
    this.loadSprite()
  }

  private buildFallback() {
    const g = new Graphics()
    // Body
    g.rect(-5, -10, 10, 12); g.fill(0x4a90d9)
    // Head
    g.circle(0, -16, 6);     g.fill(0xf5c5a3)
    this.fallback = g
    this.sprite.addChild(g)
  }

  private async loadSprite() {
    try {
      const tex = await Assets.load({ alias: 'player-base', src: '/assets/sprites/player-base.png' })
      this.allFrames = this.buildAllFrames(tex)

      this.animated = new AnimatedSprite(this.allFrames['down'])
      this.animated.animationSpeed = 0.12
      this.animated.anchor.set(0.5, 0.85)  // slightly above bottom to avoid float
      this.animated.scale.set(1.5)
      this.animated.stop()

      // Remove fallback, add animated sprite
      if (this.fallback) {
        this.sprite.removeChild(this.fallback)
        this.fallback = null
      }
      this.sprite.addChild(this.animated)
    } catch (e) {
      console.warn('[player] Sprite load failed, using fallback', e)
    }
  }

  private buildAllFrames(tex: Texture): Record<Direction, Texture[]> {
    const result = {} as Record<Direction, Texture[]>
    for (const dir of ['down','up','left','right'] as Direction[]) {
      const y = ROW_Y[dir]
      result[dir] = FRAME_X[dir].map(([x0, x1]) =>
        new Texture({
          source: tex.source,
          frame: new Rectangle(x0, y, x1 - x0 + 1, ROW_H),
        })
      )
    }
    return result
  }

  move(dx: number, dy: number, minX: number, minY: number, maxX: number, maxY: number) {
    this.sprite.x = Math.max(minX, Math.min(maxX, this.sprite.x + dx))
    this.sprite.y = Math.max(minY, Math.min(maxY, this.sprite.y + dy))

    const newFacing: Direction =
      dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : dx > 0 ? 'right' : this.facing

    if (newFacing !== this.facing) {
      this.facing = newFacing
      if (this.animated && this.allFrames) {
        this.animated.textures = this.allFrames[this.facing]
        this.animated.gotoAndPlay(0)
      }
    }
  }

  update(_delta: number, dx: number, dy: number) {
    if (!this.animated) return
    const isMoving = dx !== 0 || dy !== 0
    if (isMoving && !this.animated.playing) {
      this.animated.play()
    } else if (!isMoving && this.animated.playing) {
      this.animated.stop()
      this.animated.currentFrame = 0
    }
  }
}
