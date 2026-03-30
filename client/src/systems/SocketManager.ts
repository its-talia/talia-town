import { io, Socket } from 'socket.io-client'

export class SocketManager {
  private socket: Socket

  constructor() {
    this.socket = io()
  }

  async sendMessage(message: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Response timeout')), 30000)
      this.socket.emit('player:message', { message })
      this.socket.once('talia:response', (data: { text: string }) => {
        clearTimeout(timeout)
        resolve(data.text)
      })
      this.socket.once('talia:error', (err: { message: string }) => {
        clearTimeout(timeout)
        reject(new Error(err.message))
      })
    })
  }

  onPlayerJoin(cb: (data: { discordId: string; username: string }) => void) {
    this.socket.on('player:joined', cb)
  }
}
