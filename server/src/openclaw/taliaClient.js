/**
 * taliaClient.js
 * 
 * Bridges the game server to OpenClaw's gateway, routing player messages
 * to Talia's session and returning her response.
 * 
 * Supported modes:
 *   1. OPENCLAW_GATEWAY_URL + OPENCLAW_GATEWAY_TOKEN — HTTP gateway (preferred)
 *   2. MOCK_MODE=true — Returns canned responses for local dev without OpenClaw
 */

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN
const MOCK_MODE = process.env.MOCK_MODE === 'true' || !GATEWAY_URL

const MOCK_RESPONSES = [
  "Hey! Didn't expect company today. What brings you all the way out here?",
  "I've been standing in this field for what feels like forever. You're the most interesting thing that's happened all day.",
  "You know, I've been thinking about the stars. There's something about being out here in the open that makes everything feel bigger.",
  "Ask me anything. I've got nothing but time and a very good memory.",
  "Careful around the tree line — I've heard things rustling around over there at night.",
]
let mockIdx = 0

export async function talkToTalia(message, discordId, username) {
  if (MOCK_MODE) {
    // Simulate a small delay
    await new Promise(r => setTimeout(r, 600 + Math.random() * 800))
    const response = MOCK_RESPONSES[mockIdx % MOCK_RESPONSES.length]
    mockIdx++
    return response
  }

  // Real OpenClaw gateway call
  // POST to the sessions/send endpoint with Talia's agent context
  const res = await fetch(`${GATEWAY_URL}/api/sessions/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({
      agentId: 'talia',
      message: `[In-game message from ${username} (Discord: ${discordId})]: ${message}`,
      // Include game context so Talia knows she's responding in-game
      context: {
        surface: 'talia-town',
        discordId,
        username,
      }
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenClaw gateway error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  // Extract text response from OpenClaw response envelope
  return data.response || data.message || data.text || '...'
}
