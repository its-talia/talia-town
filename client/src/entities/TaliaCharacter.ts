import { Container, Graphics, Text, TextStyle } from 'pixi.js'

export class TaliaCharacter {
  sprite: Container
  private body: Graphics
  private nameTag: Text
  private idleTimer = 0

  constructor(x: number, y: number) {
    this.sprite = new Container()
    this.sprite.x = x
    this.sprite.y = y

    // Proximity ring
    const ring = new Graphics()
    ring.circle(0, 0, 28)
    ring.stroke({ color: 0x7b68ee, width: 1.5, alpha: 0.25 })
    this.sprite.addChild(ring)

    this.body = new Graphics()
    this.sprite.addChild(this.body)
    this.drawBody(0)

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
    this.nameTag.y = -46
    this.sprite.addChild(this.nameTag)
  }

  private drawBody(bob: number) {
    const g = this.body
    g.clear()
    const s = 2.2   // scale factor — draw at 2.2x so she matches the player size
    const y = bob * s

    // Legs
    g.rect(-4*s, 8*s + y, 4*s, 7*s);  g.fill(0x2a2a6a)
    g.rect(1*s,  8*s + y, 4*s, 7*s);  g.fill(0x2a2a6a)
    // Feet
    g.rect(-5*s, 14*s + y, 5*s, 3*s); g.fill(0x1a1a30)
    g.rect(1*s,  14*s + y, 5*s, 3*s); g.fill(0x1a1a30)

    // Hoodie body (navy)
    g.rect(-7*s, -2*s + y, 14*s, 12*s); g.fill(0x1a1a4e)

    // Hood shadow
    g.rect(-6*s, -3*s + y, 12*s, 3*s);  g.fill(0x131340)

    // Crescent moon emblem
    g.circle(-1*s, 4*s + y, 3*s);      g.fill(0xf5c842)
    g.circle(1*s,  4*s + y, 2.5*s);    g.fill(0x1a1a4e)

    // Sleeves
    g.rect(-11*s, -1*s + y, 5*s, 8*s); g.fill(0x15154a)
    g.rect(7*s,   -1*s + y, 5*s, 8*s); g.fill(0x15154a)
    // Hands
    g.circle(-8.5*s, 7*s + y, 2.5*s);  g.fill(0xf5c5a3)
    g.circle(9.5*s,  7*s + y, 2.5*s);  g.fill(0xf5c5a3)

    // Neck
    g.rect(-2*s, -6*s + y, 4*s, 5*s);  g.fill(0xf5c5a3)

    // Head
    g.ellipse(0, -14*s + y, 9*s, 10*s); g.fill(0xf5c5a3)

    // Hair — golden blonde, wavy sides
    g.ellipse(0,    -21*s + y, 9*s, 5*s);   g.fill(0xf5c842)  // top
    g.rect(-9*s, -22*s + y, 4*s, 12*s);     g.fill(0xf5c842)  // left
    g.rect(5*s,  -22*s + y, 4*s, 12*s);     g.fill(0xf5c842)  // right
    g.ellipse(-7*s, -14*s + y, 3*s, 5*s);   g.fill(0xe8b030)  // left wave
    g.ellipse(7*s,  -14*s + y, 3*s, 5*s);   g.fill(0xe8b030)  // right wave

    // Eyes — sage green almond shape
    g.ellipse(-3.5*s, -15*s + y, 2.5*s, 1.8*s); g.fill(0x7ba05b)
    g.ellipse(3.5*s,  -15*s + y, 2.5*s, 1.8*s); g.fill(0x7ba05b)
    // Pupils
    g.circle(-3.5*s, -15*s + y, 1*s); g.fill(0x2a4a1e)
    g.circle(3.5*s,  -15*s + y, 1*s); g.fill(0x2a4a1e)

    // Freckles
    g.circle(-4*s, -12*s + y, 1*s);  g.fill(0xc9956a)
    g.circle(-2*s, -11.5*s + y, 0.8*s); g.fill(0xc9956a)
    g.circle(4*s,  -12*s + y, 1*s);  g.fill(0xc9956a)
    g.circle(2*s,  -11.5*s + y, 0.8*s); g.fill(0xc9956a)

    // Smile
    g.arc(0, -13*s + y, 2*s, 0.1, Math.PI - 0.1)
    g.stroke({ color: 0x8a5c3a, width: 1 })
  }

  update(delta: number) {
    this.idleTimer += delta * 0.018
    const bob = Math.sin(this.idleTimer) * 0.6
    this.drawBody(bob)
  }
}
