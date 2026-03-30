import { talkToTalia } from '../openclaw/taliaClient.js'

export function gameSocket(io) {
  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`)

    // Player joins with their Discord identity (passed from client after OAuth)
    socket.on('player:join', (data) => {
      socket.data.discordId = data.discordId
      socket.data.username = data.username
      console.log(`Player joined as ${data.username} (${data.discordId})`)
      socket.emit('player:joined', { discordId: data.discordId, username: data.username })
    })

    // Player sends a message to Talia
    socket.on('player:message', async (data) => {
      const { message } = data
      const discordId = socket.data.discordId || 'anonymous'
      const username = socket.data.username || 'Stranger'

      console.log(`[${username}] → Talia: ${message}`)

      try {
        const response = await talkToTalia(message, discordId, username)
        console.log(`Talia → [${username}]: ${response}`)
        socket.emit('talia:response', { text: response })
      } catch (err) {
        console.error('OpenClaw error:', err)
        socket.emit('talia:error', { message: 'Talia is unavailable right now.' })
      }
    })

    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`)
    })
  })
}
