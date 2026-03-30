import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Text, TextStyle, Texture } from 'pixi.js'

// Talia sprite sheet: 1584x672, 8 cols x 4 rows, each frame 198x168
// Rows: 0=down, 1=left, 2=right, 3=up
const FRAME_W = 198
const FRAME_H = 168
const FRAME_COUNT = 8
const ROW_DIR = { down: 0, left: 1, right: 2, up: 3 }

// Display scale — 198px frames are huge, scale down to ~48px effective height
const DISPLAY_SCALE = 0.25

export class TaliaCharacter {
  sprite: Container
  private animated: AnimatedSprite | null = null
  private fallback: Graphics | null = null
  private nameTag: Text
  private idleTimer = 0
  private ring: Graphics

  constructor(x: number, y: number) {
    this.sprite = new Container()
    this.sprite.x = x
    this.sprite.y = y

    // Proximity ring — always visible
    this.ring = new Graphics()
    this.ring.circle(0, 0, 28)
    this.ring.stroke({ color: 0x7b68ee, width: 1.5, alpha: 0.3 })
    this.sprite.addChild(this.ring)

    // Name tag
    const style = new TextStyle({
      fontFamily: 'Courier New',
      fontSize: 10,
      fill: '#b8a0ff',
      stroke: { color: '#000000', width: 3 },
      fontWeight: 'bold',
    })
    this.nameTag = new Text({ text: 'Talia', style })
    this.nameTag.anchor.set(0.5, 1)
    this.nameTag.y = -52
    this.sprite.addChild(this.nameTag)

    this.buildFallback()
    this.loadSprite()
  }

  private buildFallback() {
    const g = new Graphics()
    const s = 2.2
    // Simplified version while loading
    g.ellipse(0, -14*s, 9*s, 10*s); g.fill(0xf5c5a3)
    g.ellipse(0, -21*s, 9*s, 5*s);  g.fill(0xf5c842)
    g.rect(-7*s, -2*s, 14*s, 12*s); g.fill(0x1a1a4e)
    g.circle(-1*s, 4*s, 3*s);       g.fill(0xf5c842)
    g.circle(1*s, 4*s, 2.5*s);      g.fill(0x1a1a4e)
    this.fallback = g
    this.sprite.addChild(g)
  }

  private async loadSprite() {
    try {
      const tex = await Assets.load({
        alias: 'talia-sheet',
        src: '/assets/sprites/talia-sprite-sheet.png'
      })

      // Build idle frames from row 0 (facing down)
      const idleFrames = this.buildRowFrames(tex, ROW_DIR.down)

      this.animated = new AnimatedSprite(idleFrames)
      this.animated.animationSpeed = 0.08  // gentle idle cycle
      this.animated.anchor.set(0.5, 0.85)
      this.animated.scale.set(DISPLAY_SCALE)
      this.animated.play()

      if (this.fallback) {
        this.sprite.removeChild(this.fallback)
        this.fallback = null
      }
      this.sprite.addChild(this.animated)
    } catch (e) {
      console.warn('[talia] Sprite sheet not found, using fallback', e)
    }
  }

  private buildRowFrames(tex: Texture, row: number): Texture[] {
    return Array.from({ length: FRAME_COUNT }, (_, col) =>
      new Texture({
        source: tex.source,
        frame: new Rectangle(col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H),
      })
    )
  }

  update(delta: number) {
    // Subtle name tag bob regardless of sprite type
    this.idleTimer += delta * 0.018
    this.nameTag.y = -52 + Math.sin(this.idleTimer) * 1.5

    // Fallback still bobs
    if (this.fallback) {
      this.fallback.y = Math.sin(this.idleTimer) * 1.5
    }
  }
}
