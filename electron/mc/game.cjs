'use strict'

// A running Minecraft client, seen from outside: its log (where chat and
// command replies land), its language file, its keys, and the world it has
// open. Used by the chat link to work in single-player, on LAN worlds and on
// servers where the player is an operator.

const fs = require('fs')
const path = require('path')
const nbt = require('./nbt.cjs')

// ------------------------------------------------------------------ keys
// Minecraft stores key bindings by GLFW key name; GLFW maps keys by their
// physical position (US names), so each name has one scan code on any layout.

const SCAN = {
  a: 0x1e, b: 0x30, c: 0x2e, d: 0x20, e: 0x12, f: 0x21, g: 0x22, h: 0x23, i: 0x17, j: 0x24, k: 0x25, l: 0x26, m: 0x32,
  n: 0x31, o: 0x18, p: 0x19, q: 0x10, r: 0x13, s: 0x1f, t: 0x14, u: 0x16, v: 0x2f, w: 0x11, x: 0x2d, y: 0x15, z: 0x2c,
  1: 0x02, 2: 0x03, 3: 0x04, 4: 0x05, 5: 0x06, 6: 0x07, 7: 0x08, 8: 0x09, 9: 0x0a, 0: 0x0b,
  slash: 0x35, period: 0x34, comma: 0x33, semicolon: 0x27, apostrophe: 0x28, 'left.bracket': 0x1a,
  'right.bracket': 0x1b, backslash: 0x2b, minus: 0x0c, equal: 0x0d, 'grave.accent': 0x29,
  enter: 0x1c, space: 0x39, tab: 0x0f,
  f1: 0x3b, f2: 0x3c, f3: 0x3d, f4: 0x3e, f5: 0x3f, f6: 0x40, f7: 0x41, f8: 0x42, f9: 0x43, f10: 0x44, f11: 0x57, f12: 0x58,
  'keypad.0': 0x52, 'keypad.1': 0x4f, 'keypad.2': 0x50, 'keypad.3': 0x51, 'keypad.4': 0x4b, 'keypad.5': 0x4c,
  'keypad.6': 0x4d, 'keypad.7': 0x47, 'keypad.8': 0x48, 'keypad.9': 0x49, 'keypad.multiply': 0x37,
  'keypad.subtract': 0x4a, 'keypad.add': 0x4e, 'keypad.decimal': 0x53, 'keypad.divide': 0x135, 'keypad.enter': 0x11c,
}

function scanFor(binding) {
  const m = /^key\.keyboard\.(.+)$/.exec(binding || '')
  return m && SCAN[m[1]] != null ? SCAN[m[1]] : null
}

// Prefer the chat key (then the line starts with "/"); fall back to the
// command key, which opens chat with "/" already typed.
function chatKeys(options) {
  const chat = scanFor(options.chatKey)
  if (chat != null) return { keyKind: 'chat', chatScan: chat }
  const cmd = scanFor(options.commandKey)
  if (cmd != null) return { keyKind: 'command', chatScan: cmd }
  return null
}

// ------------------------------------------------------------------ language
// Replies in the log are in the game's language. The patterns for the few
// replies SweaxBeacon reads are built from the player's own language file
// (from their game's assets folder), with English as the fallback.

const KEYS = {
  unknownCommand: 'command.unknown.command',
  unknownArgument: 'command.unknown.argument',
  expectedSeparator: 'command.expected.separator',
  noPlayer: 'argument.entity.notfound.player',
  noEntity: 'argument.entity.notfound.entity',
  list: 'commands.list.players',
  gameruleQuery: 'commands.gamerule.query',
  entityData: 'commands.data.entity.query',
  timeQuery: 'commands.time.query',
  difficultyQuery: 'commands.difficulty.query',
  here: 'command.context.here',
  advTask: 'chat.type.advancement.task',
  advGoal: 'chat.type.advancement.goal',
  advChallenge: 'chat.type.advancement.challenge',
  joined: 'multiplayer.player.joined',
  left: 'multiplayer.player.left',
  playerChat: 'chat.type.text',
}

const ENGLISH = {
  unknownCommand: 'Unknown or incomplete command, see below for error',
  unknownArgument: 'Incorrect argument for command',
  expectedSeparator: 'Expected whitespace to end one argument, but found trailing data',
  noPlayer: 'No player was found',
  noEntity: 'No entity was found',
  list: 'There are %s of a max of %s players online: %s',
  gameruleQuery: 'Gamerule %s is currently set to: %s',
  entityData: '%s has the following entity data: %s',
  timeQuery: 'The time is %s',
  difficultyQuery: 'The difficulty is %s',
  here: '<--[HERE]',
  advTask: '%s has made the advancement %s',
  advGoal: '%s has reached the goal %s',
  advChallenge: '%s has completed the challenge %s',
  joined: '%s joined the game',
  left: '%s left the game',
  playerChat: '<%s> %s',
}

function toRegex(template) {
  let i = 0
  const parts = String(template).split(/(%(?:\d+\$)?s)/)
  let src = ''
  for (const p of parts) {
    if (/^%(?:\d+\$)?s$/.test(p)) { src += '(.*?)'; i++ }
    else src += p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp('^' + src + '$')
}

function loadLanguage(game) {
  const lang = (game.options && game.options.lang || 'en_us').toLowerCase()
  const strings = { ...ENGLISH }
  if (lang !== 'en_us' && game.assetsDir && game.assetIndex) {
    try {
      const index = JSON.parse(fs.readFileSync(path.join(game.assetsDir, 'indexes', game.assetIndex + '.json'), 'utf8'))
      const entry = index.objects && index.objects[`minecraft/lang/${lang}.json`]
      if (entry && entry.hash) {
        const file = path.join(game.assetsDir, 'objects', entry.hash.slice(0, 2), entry.hash)
        const table = JSON.parse(fs.readFileSync(file, 'utf8'))
        for (const [k, key] of Object.entries(KEYS)) if (table[key]) strings[k] = table[key]
      }
    } catch (e) { /* stay with English */ }
  }
  const english = {}
  const own = {}
  for (const k of Object.keys(KEYS)) { english[k] = toRegex(ENGLISH[k]); own[k] = toRegex(strings[k]) }
  return { lang, own, english, hereText: [strings.here, ENGLISH.here] }
}

function matches(language, kind, text) {
  const m = language.own[kind].exec(text) || language.english[kind].exec(text)
  return m || null
}

// The second line of a syntax error: "...e nonsense<--[HERE]".
function isContext(language, text) {
  return language.hereText.some(h => h && text.endsWith(h))
}

function isError(language, text) {
  return ['unknownCommand', 'unknownArgument', 'expectedSeparator', 'noPlayer', 'noEntity'].some(k => matches(language, k, text))
    || isContext(language, text)
}

// Chat lines that are not replies to a command.
function isNoise(language, text) {
  return ['advTask', 'advGoal', 'advChallenge', 'joined', 'left', 'playerChat'].some(k => matches(language, k, text))
}

// ------------------------------------------------------------------ log
// latest.log lines look like
//   [21:14:03] [Render thread/INFO]: [System] [CHAT] Set own game mode to Creative Mode

const LINE = /^\[(\d\d:\d\d:\d\d)\] \[([^\]/]+)\/(\w+)\]: (.*)$/

function parseLogLine(line) {
  const m = LINE.exec(line)
  if (!m) return null
  const msg = m[4]
  const chat = msg.indexOf('[CHAT] ')
  return { time: m[1], thread: m[2], level: m[3], msg, chat: chat >= 0 ? msg.slice(chat + 7) : null }
}

class LogTail {
  constructor(file, onLine) {
    this.file = file
    this.onLine = onLine
    this.pos = 0
    this.rest = ''
    this.timer = null
    this.ino = null
  }

  start() {
    this.read(true)
    this.timer = setInterval(() => this.read(false), 150)
  }

  stop() { clearInterval(this.timer); this.timer = null }

  read(first) {
    let st
    try { st = fs.statSync(this.file) } catch (e) { return }
    if (this.ino !== null && (st.ino !== this.ino || st.size < this.pos)) { this.pos = 0; this.rest = '' }
    this.ino = st.ino
    if (st.size <= this.pos) return
    let fd
    try {
      fd = fs.openSync(this.file, 'r')
      const len = st.size - this.pos
      const buf = Buffer.alloc(len)
      fs.readSync(fd, buf, 0, len, this.pos)
      this.pos = st.size
      const text = this.rest + buf.toString('utf8')
      const lines = text.split(/\r?\n/)
      this.rest = lines.pop()
      for (const l of lines) this.onLine(l, first)
    } catch (e) { /* busy, try again */ } finally { if (fd !== undefined) try { fs.closeSync(fd) } catch (e) { /* closed */ } }
  }
}

// ------------------------------------------------------------------ worlds

// The open single-player world is the one whose session.lock the game holds;
// Windows refuses reads of a locked file.
function openWorld(gameDir) {
  const saves = path.join(gameDir, 'saves')
  let names = []
  try { names = fs.readdirSync(saves) } catch (e) { return null }
  for (const name of names) {
    const lock = path.join(saves, name, 'session.lock')
    if (!fs.existsSync(lock)) continue
    try { fs.readFileSync(lock) } catch (e) {
      if (e.code === 'EBUSY' || e.code === 'EPERM' || e.code === 'EACCES') return path.join(saves, name)
    }
  }
  return null
}

const EFFECT_IDS = [null, 'speed', 'slowness', 'haste', 'mining_fatigue', 'strength', 'instant_health', 'instant_damage',
  'jump_boost', 'nausea', 'regeneration', 'resistance', 'fire_resistance', 'water_breathing', 'invisibility', 'blindness',
  'night_vision', 'hunger', 'weakness', 'poison', 'wither', 'health_boost', 'absorption', 'saturation', 'glowing',
  'levitation', 'luck', 'unluck', 'slow_falling', 'conduit_power', 'dolphins_grace', 'bad_omen', 'hero_of_the_village', 'darkness']
const GAME_TYPES = ['survival', 'creative', 'adventure', 'spectator']
const DIFFICULTIES = ['peaceful', 'easy', 'normal', 'hard']

function bool(v) { return v === true || v === 1 || v === 'true' || v === '1' }

// What level.dat says about the world and its owner. The game writes it every
// time it pauses, which is also how every chat-link batch ends.
function worldState(worldDir) {
  let root
  try { root = nbt.readFile(path.join(worldDir, 'level.dat')) } catch (e) { return null }
  const d = root.Data || {}
  const rules = {}
  const gr = d.GameRules || d.game_rules || {}
  for (const [k, v] of Object.entries(gr)) rules[k.replace(/^minecraft:/, '')] = typeof v === 'string' ? (v === 'true' ? true : v === 'false' ? false : v) : v
  const p = d.Player || null
  let player = null
  if (p) {
    const effects = []
    for (const e of p.active_effects || []) effects.push({ id: String(e.id || '').replace(/^minecraft:/, ''), amp: e.amplifier || 0, duration: e.duration })
    for (const e of p.ActiveEffects || []) effects.push({ id: EFFECT_IDS[e.Id] || String(e.Id), amp: e.Amplifier || 0, duration: e.Duration })
    player = {
      pos: Array.isArray(p.Pos) ? p.Pos.map(Number) : null,
      dimension: String(p.Dimension || 'minecraft:overworld').replace(/^minecraft:/, ''),
      gamemode: GAME_TYPES[p.playerGameType] || null,
      health: p.Health,
      food: p.foodLevel,
      effects,
    }
  }
  const dayTime = d.DayTime != null ? Number(d.DayTime) : null
  return {
    folder: path.basename(worldDir),
    name: d.LevelName || path.basename(worldDir),
    cheats: bool(d.allowCommands),
    hardcore: bool(d.hardcore),
    difficulty: DIFFICULTIES[d.Difficulty] || null,
    dayTime: dayTime != null ? dayTime % 24000 : null,
    raining: bool(d.raining),
    thundering: bool(d.thundering),
    version: d.Version && d.Version.Name || null,
    dataVersion: d.DataVersion || (d.Version && d.Version.Id) || null,
    rules,
    rulesStyle: d.game_rules ? 'snake' : 'camel',
    spawn: d.SpawnX != null ? [d.SpawnX, d.SpawnY, d.SpawnZ] : d.spawn && Array.isArray(d.spawn.pos) ? d.spawn.pos.slice(0, 3) : null,
    player,
  }
}

module.exports = { chatKeys, scanFor, loadLanguage, matches, isError, isNoise, isContext, parseLogLine, LogTail, openWorld, worldState, toRegex }
