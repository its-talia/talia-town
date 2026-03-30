import { Application, Assets } from 'pixi.js'
import { WorldScene } from './scenes/WorldScene'
import { DialogueManager } from './ui/DialogueManager'
import { SocketManager } from './systems/SocketManager'

async function tryLoadAsset(alias: string, src: string): Promise<boolean> {
  try {
    await Assets.load({ alias, src })
    return true
  } catch {
    console.warn(`[assets] ${alias} not found at ${src} — using placeholder`)
    return false
  }
}

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

  // Load assets — each one is optional; entities fall back to Graphics placeholders
  await Promise.all([
    tryLoadAsset('tileset', '/assets/tilesets/tileset.png'),
    tryLoadAsset('talia', '/assets/sprites/talia-sprite-sheet.png'),
    tryLoadAsset('player', '/assets/sprites/player-sprite-sheet.png'),
  ])

  const socket = new SocketManager()
  const dialogue = new DialogueManager(socket)
  const world = new WorldScene(app, dialogue)

  app.stage.addChild(world.container)
  app.ticker.add((ticker) => world.update(ticker.deltaTime))
}

main().catch(console.error)
