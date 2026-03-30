import { AnimatedSprite, Container, Graphics, Sprite, Texture } from 'pixi.js'

type Direction = 'down' | 'up' | 'left' | 'right'

export class Player {
  sprite: Container
  private body: Graphics
  private facing: Direction = 'down'
  private moving = false

  constructor(x: number, y: number) {
    this.sprite = new Container()
    this.sprite.x = x
    this.sprite.y = y

    // Placeholder: simple colored rectangle until player sprite sheet is ready
    this.body = new Graphics()
    this.drawBody()
    this.sprite.addChild(this.body)
  }

  private drawBody() {
    this.body.clear()
    // Body
    this.body.rect(-5, -10, 10, 12)
    this.body.fill(0x4a90d9)
    // Head
    this.body.circle(0, -14, 6)
    this.body.fill(0xf5c5a3)
    // Eyes
    this.body.circle(-2, -15, 1)
    this.body.fill(0x333333)
    this.body.circle(2, -15, 1)
    this.body.fill(0x333333)
  }

  move(dx: number, dy: number, minX: number, minY: number, maxX: number, maxY: number) {
    this.sprite.x = Math.max(minX, Math.min(maxX, this.sprite.x + dx))
    this.sprite.y = Math.max(minY, Math.min(maxY, this.sprite.y + dy))
    this.moving = dx !== 0 || dy !== 0

    if (dy < 0) this.facing = 'up'
    else if (dy > 0) this.facing = 'down'
    else if (dx < 0) this.facing = 'left'
    else if (dx > 0) this.facing = 'right'
  }

  update(delta: number, dx: number, dy: number) {
    // Future: swap to animated sprite frames here
  }
}
