import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Text, TextStyle, Texture } from 'pixi.js'

// Talia sprite sheet: 1584x672
// 8 cols x 3 rows (front, side, back)
// Col width: 198px. Row y ranges: row0=12-222, row1=242-454, row2=469-671
// We use row 0 (front/down) for idle
const COLS = 8
const COL_W = 198
const ROW_FRONT = { y: 12, h: 211 }

// Display scale: frame is ~134px wide of actual character content
// Scale down so she looks right in the 16px-tile world (~48px tall)
const DISPLAY_SCALE = 0.22

export class TaliaCharacter {
  sprite: Container
  private animated: AnimatedSprite | null = null
  private nameTag: Text
  private idleTimer = 0
  private ring: Graphics

  constructor(x: number, y: number) {
    this.sprite = new Container()
    this.sprite.x = x
    this.sprite.y = y

    this.ring = new Graphics()
    this.ring.circle(0, 0, 28)
    this.ring.stroke({ color: 0x7b68ee, width: 1.5, alpha: 0.3 })
    this.sprite.addChild(this.ring)

    const style = new TextStyle({
      fontFamily: 'Courier New',
      fontSize: 10,
      fill: '#b8a0ff',
      stroke: { color: '#000000', width: 3 },
      fontWeight: 'bold',
    })
    this.nameTag = new Text({ text: 'Talia', style })
    this.nameTag.anchor.set(0.5, 1)
    this.nameTag.y = -50
    this.sprite.addChild(this.nameTag)

    this.loadSprite()
  }

  private async loadSprite() {
    try {
      const tex = await Assets.load({ alias: 'talia-sheet', src: '/assets/sprites/talia-sprite-sheet.png' })

      // Extract 8 frames from row 0 (front-facing)
      const frames: Texture[] = []
      for (let col = 0; col < COLS; col++) {
        frames.push(new Texture({
          source: tex.source,
          frame: new Rectangle(col * COL_W, ROW_FRONT.y, COL_W, ROW_FRONT.h),
        }))
      }

      this.animated = new AnimatedSprite(frames)
      this.animated.animationSpeed = 0   // stationary — no walk animation
      this.animated.anchor.set(0.5, 1.0) // anchor to feet
      this.animated.scale.set(DISPLAY_SCALE)
      this.animated.gotoAndStop(0)

      this.sprite.addChild(this.animated)
    } catch (e) {
      console.warn('[talia] Sprite load failed', e)
      this.buildFallback()
    }
  }

  private buildFallback() {
    const g = new Graphics()
    const s = 2
    g.circle(0, -14*s, 7*s);        g.fill(0xf5c5a3)
    g.ellipse(0, -20*s, 7*s, 4*s);  g.fill(0xf5c842)
    g.rect(-6*s, -4*s, 12*s, 10*s); g.fill(0x1a1a4e)
    g.circle(-1*s, 2*s, 2.5*s);     g.fill(0xf5c842)
    g.circle(1*s,  2*s, 2*s);       g.fill(0x1a1a4e)
    g.rect(-4*s, 6*s, 3*s, 6*s);    g.fill(0x2a2a6a)
    g.rect(2*s,  6*s, 3*s, 6*s);    g.fill(0x2a2a6a)
    this.sprite.addChild(g)
  }

  update(delta: number) {
    this.idleTimer += delta * 0.018
    this.nameTag.y = -50 + Math.sin(this.idleTimer) * 1.2
  }
}
