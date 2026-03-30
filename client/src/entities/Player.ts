import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Texture } from 'pixi.js'

type Direction = 'down' | 'up' | 'left' | 'right'

// Player sprite sheet: 256x144, 4 rows x 8 frames
// Pixel-detected frame x ranges (variable width, detected from alpha)
// Row layout confirmed: row0=down, row1=down(alt), row2=up, row3=right
// Left = row3 flipped horizontally

const ROW_H = 36
const ROW_Y: Record<string, number> = { down: 0, up: 72, right: 108 }

// Detected frame x positions per row
const FRAME_X: Record<string, [number, number][]> = {
  down:  [[3,28],[35,60],[69,90],[99,124],[131,156],[163,188],[197,218],[227,252]],
  up:    [[3,28],[37,58],[70,91],[101,122],[131,156],[165,186],[196,217],[229,250]],
  right: [[6,25],[38,57],[68,91],[102,121],[134,153],[166,185],[196,217],[230,249]],
}

const DISPLAY_SCALE = 1.6

export class Player {
  sprite: Container
  private animated: AnimatedSprite | null = null
  private allFrames: Record<Direction, Texture[]> | null = null
  private facing: Direction = 'down'

  constructor(x: number, y: number) {
    this.sprite = new Container()
    this.sprite.x = x
    this.sprite.y = y
    this.buildFallback()
    this.loadSprite()
  }

  private buildFallback() {
    const g = new Graphics()
    g.rect(-5, -20, 10, 14); g.fill(0x2a2a6e)   // body
    g.circle(0, -26, 7);     g.fill(0xf5c5a3)   // head
    g.rect(-4, -6, 4, 8);    g.fill(0x3a3a80)   // left leg
    g.rect(1,  -6, 4, 8);    g.fill(0x3a3a80)   // right leg
    this.sprite.addChild(g)
  }

  private async loadSprite() {
    try {
      const tex = await Assets.load({ alias: 'player-base', src: '/assets/sprites/player-base.png' })
      this.allFrames = this.buildAllFrames(tex)

      this.animated = new AnimatedSprite(this.allFrames['down'])
      this.animated.animationSpeed = 0.12
      this.animated.anchor.set(0.5, 1.0)
      this.animated.scale.set(DISPLAY_SCALE)
      this.animated.stop()

      // Remove fallback
      this.sprite.removeChildren()
      this.sprite.addChild(this.animated)
    } catch (e) {
      console.warn('[player] Sprite load failed', e)
    }
  }

  private buildAllFrames(tex: Texture): Record<Direction, Texture[]> {
    const makeRow = (rowKey: string): Texture[] =>
      FRAME_X[rowKey].map(([x0, x1]) =>
        new Texture({
          source: tex.source,
          frame: new Rectangle(x0, ROW_Y[rowKey], x1 - x0 + 1, ROW_H),
        })
      )

    const rightFrames = makeRow('right')

    // Left = right frames but we flip the sprite via scale.x = -1
    // so reuse same frames; flipping handled in setDirection
    return {
      down:  makeRow('down'),
      up:    makeRow('up'),
      right: rightFrames,
      left:  rightFrames,   // same frames, flipped in setDirection
    }
  }

  private setDirection(dir: Direction) {
    if (!this.animated || !this.allFrames) return
    this.facing = dir
    this.animated.textures = this.allFrames[dir]

    // Flip for left
    if (dir === 'left') {
      this.animated.scale.set(-DISPLAY_SCALE, DISPLAY_SCALE)
    } else {
      this.animated.scale.set(DISPLAY_SCALE, DISPLAY_SCALE)
    }
    this.animated.gotoAndPlay(0)
  }

  move(dx: number, dy: number, minX: number, minY: number, maxX: number, maxY: number) {
    this.sprite.x = Math.max(minX, Math.min(maxX, this.sprite.x + dx))
    this.sprite.y = Math.max(minY, Math.min(maxY, this.sprite.y + dy))

    let newDir: Direction = this.facing
    if      (dy < 0) newDir = 'up'
    else if (dy > 0) newDir = 'down'
    else if (dx < 0) newDir = 'left'
    else if (dx > 0) newDir = 'right'

    if (newDir !== this.facing) this.setDirection(newDir)
  }

  update(_delta: number, dx: number, dy: number) {
    if (!this.animated) return
    const moving = dx !== 0 || dy !== 0
    if (moving && !this.animated.playing) this.animated.play()
    if (!moving && this.animated.playing) {
      this.animated.stop()
      this.animated.currentFrame = 0
    }
  }
}
