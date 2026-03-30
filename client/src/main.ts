import { Application, Assets } from 'pixi.js'
import { WorldScene } from './scenes/WorldScene'
import { DialogueManager } from './ui/DialogueManager'
import { SocketManager } from './systems/SocketManager'

async function main() {
  const app = new Application()

  await app.init({
    width: 640,
    height: 480,
    backgroundColor: 0x4a7c59,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })

  document.getElementById('game-container')!.appendChild(app.canvas)

  // Load assets
  await Assets.load([
    { alias: 'tileset', src: '/assets/tilesets/tileset.png' },
    { alias: 'talia', src: '/assets/sprites/talia-sprite-sheet.png' },
    { alias: 'player', src: '/assets/sprites/player-sprite-sheet.png' },
  ])

  const socket = new SocketManager()
  const dialogue = new DialogueManager(socket)
  const world = new WorldScene(app, dialogue)

  app.stage.addChild(world.container)
  app.ticker.add((ticker) => world.update(ticker.deltaTime))
}

main().catch(console.error)
