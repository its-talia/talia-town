import FastifyOAuth2 from '@fastify/oauth2'

export async function authRoutes(fastify) {
  fastify.register(FastifyOAuth2, {
    name: 'discordOAuth2',
    scope: ['identify'],
    credentials: {
      client: {
        id: process.env.DISCORD_CLIENT_ID,
        secret: process.env.DISCORD_CLIENT_SECRET,
      },
      auth: {
        authorizeHost: 'https://discord.com',
        authorizePath: '/oauth2/authorize',
        tokenHost: 'https://discord.com',
        tokenPath: '/api/oauth2/token',
      },
    },
    startRedirectPath: '/auth/discord',
    callbackUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3001/auth/discord/callback',
  })

  fastify.get('/auth/discord/callback', async (req, reply) => {
    try {
      const { token } = await fastify.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(req)

      // Fetch Discord user info
      const res = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      })
      const user = await res.json()

      // Store in session
      req.session.user = {
        discordId: user.id,
        username: user.username,
        avatar: user.avatar,
      }

      reply.redirect('/')
    } catch (err) {
      fastify.log.error(err)
      reply.status(500).send({ error: 'Auth failed' })
    }
  })

  fastify.get('/auth/me', async (req, reply) => {
    if (!req.session.user) return reply.status(401).send({ error: 'Not authenticated' })
    reply.send(req.session.user)
  })

  fastify.get('/auth/logout', async (req, reply) => {
    req.session.destroy()
    reply.redirect('/')
  })
}
