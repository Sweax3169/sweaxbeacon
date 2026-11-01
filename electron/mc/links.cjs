'use strict'

// The two ways SweaxBeacon reaches a world. Both take a list of commands and
// give back one result per command: { cmd, ok, resp }.
//
//   RconLink  a server's remote console (RCON): exact replies, any number of players
//   ChatLink  the chat of a running Minecraft window: single-player, LAN worlds,
//             and servers where the player is an operator; replies are read
//             from the game's own log

const fs = require('fs')
const path = require('path')
const { Rcon } = require('./rcon.cjs')
const helper = require('../sys/helper.cjs')
const game = require('./game.cjs')
const { readOptions } = require('./discover.cjs')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const clean = (s) => String(s == null ? '' : s).replace(/§[0-9a-fk-or]/gi, '').trim()

class LinkError extends Error {
  constructor(code, detail) { super(code); this.code = code; this.detail = detail }
}

// ------------------------------------------------------------------ RCON

class RconLink {
  constructor({ host, port, password }) {
    this.mode = 'rcon'
    this.host = host
    this.port = Number(port) || 25575
    this.password = password || ''
    this.rcon = null
    this.onClose = null
  }

  async open(timeout = 6000) {
    const c = new Rcon()
    c.onClose = () => { if (this.rcon === c) { this.rcon = null; if (this.onClose) this.onClose() } }
    try { await c.connect(this.host, this.port, this.password, timeout) } catch (e) { throw new LinkError(e.message) }
    this.rcon = c
  }

  get open_() { return !!(this.rcon && this.rcon.connected) }

  async run(cmds) {
    const out = []
    for (const cmd of cmds) {
      if (!this.rcon) { out.push({ cmd, ok: false, resp: '', error: 'closed' }); continue }
      try {
        const resp = clean(await this.rcon.command(cmd))
        out.push({ cmd, ok: !/^(Unknown or incomplete command|Incorrect argument|No player was found|No entity was found|Unknown )/i.test(resp) && !/<--\[HERE\]$/.test(resp), resp })
      } catch (e) { out.push({ cmd, ok: false, resp: '', error: e.message }) }
    }
    return out
  }

  async query(cmd) {
    if (!this.rcon) return null
    try { return clean(await this.rcon.command(cmd)) } catch (e) { return null }
  }

  close() { const c = this.rcon; this.rcon = null; if (c) c.destroy() }
}

// ------------------------------------------------------------------ chat
//
// Commands go into the chat of a Minecraft window that sits in the background,
// through window messages to that window only (see the helper's "chat input").
// A background Minecraft window shows its pause menu with a normal cursor
// ("pause on lost focus", on by default). It has to be back in that state
// before it hears that it lost focus, or GLFW would move the mouse. A batch:
//
//   wait       a world that just loaded first has to show its pause menu
//   focus      the game believes it has focus, so it does not pause again
//   Esc        closes the pause menu (or an open inventory)
//   per line   chat key, a tick or two, the text, Enter; then the reply is
//              awaited in the log. No reply means the game was too busy to open
//              the chat in time, and the batch stops there.
//   Esc        opens the pause menu again. In single-player the log confirms it
//              ("Saving and pausing game..."); if not, the Esc closed a chat
//              that opened late, and one more Esc pauses.
//   blur       the game is back where it was

// Log lines carry the time of day only.
function logTime(hms) {
  const [h, m, sec] = hms.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, sec, 999)
  if (d.getTime() > Date.now() + 60000) d.setDate(d.getDate() - 1)
  return d.getTime()
}

const SC_ESC = 0x01
const SC_ENTER = 0x1c
const OPEN_DELAY = 260
const WARM_UP = 6000

class ChatLink {
  constructor(g, { onChat, onState } = {}) {
    this.mode = 'chat'
    this.game = g
    this.onChat = onChat || (() => {})
    this.onState = onState || (() => {})
    this.seq = 0
    this.recent = []
    this.pauses = 0
    this.joinedAt = 0
    this.pausedSinceJoin = true
    this.state = { inWorld: false, where: null, server: null, username: g.username || null, cheatsOff: false }
    this.world = null
    this.language = game.loadLanguage(g)
    this.keys = game.chatKeys(g.options)
    this.tail = null
    this.busy = Promise.resolve()
  }

  // log4j writes logs/latest.log under the game's working folder, which most
  // launchers set to the game folder; when they differ, the newer file wins.
  logFile() {
    const dirs = [this.game.cwd, this.game.gameDir].filter(Boolean)
    let best = null
    for (const d of dirs) {
      const f = path.join(d, 'logs', 'latest.log')
      try { const t = fs.statSync(f).mtimeMs; if (!best || t > best.t) best = { f, t } } catch (e) { /* none there */ }
    }
    return best ? best.f : path.join(this.game.gameDir, 'logs', 'latest.log')
  }

  open() {
    this.tail = new game.LogTail(this.logFile(), (line, first) => this._line(line, first))
    this.tail.start()
    this.refreshWorld()
  }

  close() { if (this.tail) this.tail.stop(); this.tail = null }

  _line(raw, first) {
    const l = game.parseLogLine(raw)
    if (!l) return
    const s = this.state
    let changed = false
    const set = (k, v) => { if (s[k] !== v) { s[k] = v; changed = true } }
    const m = l.msg
    const server = l.thread === 'Server thread'
    let mm
    if ((mm = /^Setting user: (.+)$/.exec(m))) set('username', mm[1].trim())
    else if (server && /^Starting integrated minecraft server version/.test(m)) { set('where', 'single'); set('server', null); set('inWorld', false); set('cheatsOff', false) }
    else if (server && / logged in with entity id /.test(m)) { set('inWorld', true); this.joinedAt = logTime(l.time); this.pausedSinceJoin = false }
    else if (/^Started serving on /.test(m)) set('where', 'lan')
    else if ((mm = /^Connecting to (.+), (\d+)$/.exec(m))) {
      set('where', 'server'); set('server', `${mm[1]}:${mm[2]}`); set('inWorld', true); set('cheatsOff', false)
      this.joinedAt = logTime(l.time)
    } else if (server && /^Stopping (singleplayer )?server/.test(m)) { set('inWorld', false); set('where', null); set('server', null) }
    else if (/^Stopping!$/.test(m)) { set('inWorld', false); set('where', null); set('server', null) }
    else if (server && /^Saving and pausing game/.test(m)) { this.pausedSinceJoin = true; if (!first) this.pauses++ }
    if (l.chat != null && !server) {
      const text = clean(l.chat)
      if (!s.inWorld) set('inWorld', true)
      if (!first) {
        this.recent.push({ n: ++this.seq, text })
        if (this.recent.length > 300) this.recent.splice(0, 100)
        this.onChat(text)
      }
    }
    if (changed && !first) {
      this.onState(this.snapshot())
      if (s.where === 'single' || s.where === 'lan') setTimeout(() => this.refreshWorld(), 1500)
    }
  }

  // Replies that arrived after line number `mark`, without advancements, joins
  // and player chat; the "<--[HERE]" line of an error joins the line before it.
  repliesSince(mark) {
    const out = []
    for (const r of this.recent) {
      if (r.n <= mark || game.isNoise(this.language, r.text)) continue
      if (game.isContext(this.language, r.text) && out.length) out[out.length - 1] += '\n' + r.text
      else out.push(r.text)
    }
    return out
  }

  refreshWorld() {
    const dir = (this.state.where === 'server') ? null : game.openWorld(this.game.gameDir)
    const w = dir ? game.worldState(dir) : null
    const key = JSON.stringify(w, (k, v) => typeof v === 'bigint' ? String(v) : v)
    if (key !== this._worldKey) { this._worldKey = key; this.world = w; this.onState(this.snapshot()) }
    return w
  }

  snapshot() {
    return { ...this.state, world: this.world, options: { ...this.game.options }, keys: !!this.keys }
  }

  async _window() {
    const wins = await helper.call('windows', { pid: this.game.pid }).catch(() => [])
    const w = wins.find(x => x.hwnd === this.game.hwnd) || wins.find(x => x.cls === 'GLFW30')
    if (w) this.game.hwnd = w.hwnd
    return w || null
  }

  // Checks before typing anything. Returns null when ready, or a reason.
  async problem() {
    // options.txt is read again each time: F3+P or a new chat key count at once.
    const fresh = readOptions(this.game.gameDir)
    if (Object.keys(fresh).length) {
      this.game.options.pauseOnLostFocus = fresh.pauseOnLostFocus !== 'false'
      this.game.options.chatKey = fresh['key_key.chat'] || this.game.options.chatKey
      this.game.options.commandKey = fresh['key_key.command'] || this.game.options.commandKey
      this.keys = game.chatKeys(this.game.options)
    }
    if (!(await this._window())) return 'no-window'
    if (!this.state.inWorld) return 'not-in-world'
    if (!this.keys) return 'no-key'
    if (!this.game.options.pauseOnLostFocus) return 'pause-off'
    return null
  }

  run(cmds) {
    const job = this.busy.then(() => this._run(cmds))
    this.busy = job.catch(() => {})
    return job
  }

  async _run(cmds) {
    const why = await this.problem()
    if (why) throw new LinkError(why)
    const hwnd = this.game.hwnd
    const h = (op, a = {}) => helper.call(op, { hwnd, ...a }).catch((e) => {
      throw new LinkError(e.message === 'window-gone' ? 'no-window' : 'send-failed', e.message)
    })
    // A world that has just loaded is busy for a few seconds. In single-player
    // the game logs the moment its pause menu first opens; elsewhere, wait a bit.
    if (this.state.where === 'single' && !this.pausedSinceJoin) {
      const until = Date.now() + 25000
      while (!this.pausedSinceJoin && Date.now() < until) await sleep(100)
      // Not paused yet means the game is still on its loading screen; typing now
      // would open the pause menu instead of the chat.
      if (!this.pausedSinceJoin) throw new LinkError('loading')
      await sleep(300)
    } else {
      const warm = this.joinedAt + WARM_UP - Date.now()
      if (warm > 0) await sleep(warm)
    }
    const fg = await h('fgstate')
    const background = !fg.foreground
    // The pause menu appears half a second after the game loses focus; before
    // that, Esc would open it instead of closing it.
    if (background && fg.since >= 0 && fg.since < 700) await sleep(700 - fg.since)
    const single = this.state.where === 'single'
    const rules = this.world && this.world.rules || {}
    const feedback = rules.sendCommandFeedback !== false && rules.send_command_feedback !== false
    const results = []
    try {
      if (background) { await h('focus'); await sleep(90); await h('key', { scan: SC_ESC }); await sleep(160) }
      for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i]
        const mark = this.seq
        await h('key', { scan: this.keys.chatScan })
        await sleep(OPEN_DELAY)
        let text = String(cmd).replace(/^\//, '')
        if (this.keys.keyKind === 'chat') text = '/' + text
        await h('type', { text })
        await sleep(50)
        await h('key', { scan: SC_ENTER })
        const deadline = Date.now() + (feedback ? 1500 : 200)
        let replies = []
        while (Date.now() < deadline) { replies = this.repliesSince(mark); if (replies.length) break; await sleep(40) }
        if (replies.length) { await sleep(90); replies = this.repliesSince(mark) }
        if (feedback && !replies.length) {
          results.push({ cmd, ok: false, resp: '', error: 'no-reply' })
          for (const rest of cmds.slice(i + 1)) results.push({ cmd: rest, ok: false, resp: '', error: 'skipped' })
          break
        }
        results.push({ cmd, ok: !replies.some(r => game.isError(this.language, r)), resp: replies.join('\n') })
        await sleep(60)
      }
    } finally {
      if (background) await this._repause(single, h)
    }
    const unknown = results.some(r => r.resp && game.matches(this.language, 'unknownCommand', r.resp.split('\n')[0]))
    if (unknown !== this.state.cheatsOff && (unknown || results.some(r => r.ok))) { this.state.cheatsOff = unknown; this.onState(this.snapshot()) }
    setTimeout(() => this.refreshWorld(), 700)
    setTimeout(() => this.refreshWorld(), 2500)
    return results
  }

  async _repause(single, h) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = this.pauses
      await h('key', { scan: SC_ESC }).catch(() => {})
      if (!single) { await sleep(220); break }
      const until = Date.now() + 1300
      while (Date.now() < until && this.pauses === before) await sleep(40)
      if (this.pauses !== before) break
    }
    await h('blur').catch(() => {})
  }

  async query(cmd) {
    const r = await this.run([cmd])
    return r[0] && r[0].resp || null
  }
}

module.exports = { RconLink, ChatLink, LinkError }
