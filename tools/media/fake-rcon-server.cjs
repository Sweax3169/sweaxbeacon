'use strict'

// Stand-in RCON server used ONLY to take the README screenshots and the demo
// recording. It speaks the same Source RCON framing as a Minecraft server and
// answers a handful of commands with text in the style of a Paper server.
// It never touches a real server. Run it with `node fake-rcon-server.cjs`
// or require it from capture.cjs.

const net = require('net')

const PLAYERS = ['Steve', 'Alex']

const EFFECT_NAMES = {
  speed: 'Speed', haste: 'Haste', jump_boost: 'Jump Boost', night_vision: 'Night Vision',
  water_breathing: 'Water Breathing', strength: 'Strength', invisibility: 'Invisibility',
  regeneration: 'Regeneration', resistance: 'Resistance', fire_resistance: 'Fire Resistance',
  instant_health: 'Instant Health', saturation: 'Saturation',
}
const MODES = { creative: 'Creative', survival: 'Survival', spectator: 'Spectator', adventure: 'Adventure' }
const TIMES = { day: 1000, noon: 6000, night: 13000, midnight: 18000 }

function titleCase(id) {
  return id.replace(/^minecraft:/, '').split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function createState() {
  return {
    rules: {
      keepInventory: false, doDaylightCycle: true, doWeatherCycle: true, mobGriefing: true,
      doMobSpawning: true, doFireTick: true, fallDamage: true, doImmediateRespawn: false,
      showDeathMessages: true,
    },
    whitelist: ['Steve', 'Alex'],
  }
}

function answer(state, line) {
  const p = line.trim().split(/\s+/)
  const c = p[0]
  switch (c) {
    case 'list':
      return `There are ${PLAYERS.length} of a max of 20 players online: ${PLAYERS.join(', ')}`
    case 'gamemode':
      return `Set ${p[2]}'s game mode to ${MODES[p[1]] || p[1]} Mode`
    case 'effect':
      if (p[1] === 'clear') return `Removed every effect from ${p[2]}`
      return `Applied effect ${EFFECT_NAMES[p[3]] || titleCase(p[3])} to ${p[2]}`
    case 'give': {
      const n = Number(p[3]) || 1
      return `Gave ${n} [${titleCase(p[2])}] to ${p[1]}`
    }
    case 'tp':
      if (p.length === 3) return `Teleported ${p[1]} to ${p[2]}`
      if (p[2] && p[2].startsWith('~')) return `Teleported ${p[1]} to 214.500000, ${p[3] === '250' ? '250.000000' : '122.000000'}, -88.500000`
      return `Teleported ${p[1]} to ${(Number(p[2]) + 0.5).toFixed(6)}, ${Number(p[3]).toFixed(6)}, ${(Number(p[4]) + 0.5).toFixed(6)}`
    case 'time':
      return `Set the time to ${TIMES[p[2]] != null ? TIMES[p[2]] : p[2]}`
    case 'weather':
      return p[1] === 'clear' ? 'Set the weather to clear' : p[1] === 'rain' ? 'Set the weather to rain' : 'Set the weather to rain & thunder'
    case 'difficulty':
      return `The difficulty has been set to ${p[1][0].toUpperCase() + p[1].slice(1)}`
    case 'gamerule':
      if (p.length === 2) return `Gamerule ${p[1]} is currently set to: ${state.rules[p[1]]}`
      state.rules[p[1]] = p[2] === 'true'
      return `Gamerule ${p[1]} is now set to: ${p[2]}`
    case 'op': return `Made ${p[1]} a server operator`
    case 'deop': return `Made ${p[1]} no longer a server operator`
    case 'kick': return `Kicked ${p[1]}: Kicked by an operator`
    case 'ban': return `Banned ${p[1]}: Banned by an operator`
    case 'say': return ''
    case 'whitelist':
      if (p[1] === 'list') return `There are ${state.whitelist.length} whitelisted player(s): ${state.whitelist.join(', ')}`
      if (p[1] === 'on') return 'Whitelist is now turned on'
      if (p[1] === 'off') return 'Whitelist is now turned off'
      if (p[1] === 'add') { state.whitelist.push(p[2]); return `Added ${p[2]} to the whitelist` }
      if (p[1] === 'remove') { state.whitelist = state.whitelist.filter(n => n !== p[2]); return `Removed ${p[2]} from the whitelist` }
      return ''
    case 'seed': return 'Seed: [-4172144997902289642]'
    case 'tps': return '§6TPS from last 1m, 5m, 15m: §a20.0, §a20.0, §a20.0'
    case 'fill': return 'Successfully filled 1331 block(s)'
    case 'summon': return `Summoned new ${titleCase(p[1] || 'zombie')}`
    default: return `Unknown or incomplete command, see below for error`
  }
}

function packet(id, type, body) {
  const b = Buffer.from(body, 'utf8')
  const buf = Buffer.alloc(14 + b.length)
  buf.writeInt32LE(10 + b.length, 0)
  buf.writeInt32LE(id, 4)
  buf.writeInt32LE(type, 8)
  b.copy(buf, 12)
  return buf
}

function startFakeRcon({ port = 25575, password, log = () => {} } = {}) {
  const state = createState()
  const server = net.createServer((sock) => {
    let buf = Buffer.alloc(0)
    let authed = false
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      while (buf.length >= 4) {
        const len = buf.readInt32LE(0)
        if (buf.length < 4 + len) break
        const id = buf.readInt32LE(4)
        const type = buf.readInt32LE(8)
        const body = buf.toString('utf8', 12, 4 + len - 2)
        buf = buf.subarray(4 + len)
        if (type === 3) {
          authed = body === password
          sock.write(packet(authed ? id : -1, 2, ''))
          log(`auth ${authed ? 'ok' : 'rejected'}`)
        } else if (type === 2 && authed) {
          const out = answer(state, body)
          log(`> ${body}\n< ${out}`)
          sock.write(packet(id, 0, out))
        }
      }
    })
    sock.on('error', () => {})
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen({ port, host: '::', ipv6Only: false }, () => resolve(server))
  })
}

module.exports = { startFakeRcon }

if (require.main === module) {
  const password = process.env.FAKE_RCON_PASSWORD || 'screenshots-only'
  startFakeRcon({ port: Number(process.env.FAKE_RCON_PORT) || 25575, password, log: console.log })
    .then(() => console.log('fake RCON listening (screenshots only)'))
}
