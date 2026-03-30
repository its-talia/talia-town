import { Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js'

export class TaliaCharacter {
  sprite: Container
  private body: Graphics
  private nameTag: Text
  private idleTimer = 0
  private bobOffset = 0

  constructor(x: number, y: number) {
    this.sprite = new Container()
    this.sprite.x = x
    this.sprite.y = y

    // Placeholder body until sprite sheet is ready
    this.body = new Graphics()
    this.drawBody(0)
    this.sprite.addChild(this.body)

    // Name tag
    const style = new TextStyle({
      fontFamily: 'Courier New',
      fontSize: 9,
      fill: '#b8a0ff',
      stroke: { color: '#000000', width: 2 },
    })
    this.nameTag = new Text({ text: 'Talia', style })
    this.nameTag.anchor.set(0.5, 1)
    this.nameTag.y = -28
    this.sprite.addChild(this.nameTag)

    // Proximity indicator (gentle glow ring)
    const ring = new Graphics()
    ring.circle(0, 0, 22)
    ring.stroke({ color: 0x7b68ee, width: 1, alpha: 0.3 })
    this.sprite.addChild(ring)
  }

  private drawBody(bob: number) {
    this.body.clear()
    const y = bob

    // Hoodie body (navy)
    this.body.rect(-7, -8 + y, 14, 14)
    this.body.fill(0x1a1a4e)

    // Crescent moon detail
    this.body.circle(-1, -2 + y, 3)
    this.body.fill(0xf5c842)
    this.body.circle(1, -2 + y, 2.5)
    this.body.fill(0x1a1a4e)

    // Head
    this.body.circle(0, -16 + y, 8)
    this.body.fill(0xf5c5a3)

    // Hair (golden blonde)
    this.body.ellipse(0, -20 + y, 8, 5)
    this.body.fill(0xf5c842)
    this.body.rect(-9, -20 + y, 4, 8)
    this.body.fill(0xf5c842)
    this.body.rect(5, -20 + y, 4, 8)
    this.body.fill(0xf5c842)

    // Eyes (sage green)
    this.body.ellipse(-3, -16 + y, 2, 1.5)
    this.body.fill(0x7ba05b)
    this.body.ellipse(3, -16 + y, 2, 1.5)
    this.body.fill(0x7ba05b)

    // Freckles
    this.body.circle(-3, -13 + y, 0.8)
    this.body.fill(0xc9956a)
    this.body.circle(3, -13 + y, 0.8)
    this.body.fill(0xc9956a)
  }

  update(delta: number) {
    this.idleTimer += delta * 0.02
    this.bobOffset = Math.sin(this.idleTimer) * 0.8
    this.drawBody(this.bobOffset)
  }
}
