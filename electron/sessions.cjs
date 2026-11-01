'use strict'

// Keeps the list of reachable worlds fresh and one link open to the chosen one.
//
// A target is one of
//   server  a server folder on this PC (running or not)        -> RconLink
//   game    a running Minecraft client                          -> ChatLink
//   remote  a server elsewhere, added by hand with its password -> RconLink
//
// Each target has a status the window shows and acts on:
//   ready      commands go through
//   rcon-off   a running server without RCON; one click switches it on
//   restart    RCON is on in the file, the server has to restart once
//   stopped    a server folder that is not running; it can be started from here
//   starting   started from here, waiting for RCON to answer
//   game       a running game not linked yet
//   not-in-world / pause-off / cheats / no-key / no-window   (game, see links.cjs)
//   auth / refused / offline   a server that did not let us in

const path = require('path')
const fs = require('fs')
const { discover, scanDisk } = require('./mc/discover.cjs')
const { RconLink, ChatLink } = require('./mc/links.cjs')
const servers = require('./mc/servers.cjs')
const props = require('./mc/props.cjs')

const norm = (p) => path.resolve(p).replace(/[\\/]+$/, '').toLowerCase()
const LOCAL = /^(localhost|127\.0\.0\.1|::1|\[::1\])$/i

class Sessions {
  constructor({ settings, save, secret, emit }) {
    this.settings = settings
    this.save = save
    this.secret = secret
    this.emit = emit
    this.targets = new Map()
    this.games = new Map()
    this.servers = new Map()
    this.active = null // { key, link, status, error }
    this.timer = null
    this.scanning = null
    this.fastUntil = 0
    this.lastScan = 0
    if (!Array.isArray(settings.known)) settings.known = []
    if (!Array.isArray(settings.remotes)) settings.remotes = []
  }

  // ---------------------------------------------------------------- watching

  startWatching() {
    this.rescan({ disk: true })
    const tick = async () => {
      const fast = Date.now() < this.fastUntil || !this.active || this.active.status !== 'ready'
      if (Date.now() - this.lastScan >= (fast ? 2000 : 6000)) await this.rescan().catch(() => {})
      this.timer = setTimeout(tick, 1000)
    }
    this.timer = setTimeout(tick, 1500)
  }

  stop() {
    clearTimeout(this.timer)
    if (this.active && this.active.link) this.active.link.close()
  }

  hurry(ms = 120000) { this.fastUntil = Date.now() + ms }

  // ---------------------------------------------------------------- scanning

  remember(dir) {
    const n = norm(dir)
    if (this.settings.known.some(k => norm(k) === n)) return false
    this.settings.known.unshift(path.resolve(dir))
    this.settings.known = this.settings.known.slice(0, 40)
    this.save()
    return true
  }

  rescan({ disk = false } = {}) {
    if (disk && !this.diskScan) {
      this.diskScan = scanDisk().then((dirs) => {
        let added = false
        for (const d of dirs) added = this.remember(d) || added
        this.diskScan = null
        if (added) this.rescan()
      }, () => { this.diskScan = null })
    }
    if (this.scanning) return this.scanning
    this.scanning = this._rescan().finally(() => { this.scanning = null; this.lastScan = Date.now() })
    return this.scanning
  }

  async _rescan() {
    const found = await discover({ known: this.settings.known })
    const next = new Map()
    this.servers = new Map()
    for (const s of found.servers) {
      if (s.running) this.remember(s.dir)
      const t = this.serverView(s)
      next.set(t.key, t)
      this.servers.set(t.key, s)
    }
    const games = new Map()
    for (const g of found.games) {
      const key = 'game:' + norm(g.gameDir)
      const prev = this.games.get(key)
      games.set(key, prev && prev.pid === g.pid ? Object.assign(prev, { hwnd: g.hwnd || prev.hwnd, title: g.title, options: g.options }) : g)
      next.set(key, this.gameView(key, games.get(key)))
    }
    this.games = games
    for (const r of this.settings.remotes) {
      const key = this.remoteKey(r)
      next.set(key, { key, kind: 'remote', name: r.name || r.host, host: r.host, port: r.port, status: 'saved', running: true })
    }
    this.targets = next

    const a = this.active
    if (a) {
      const t = next.get(a.key)
      if (!t) {
        // The game was closed or the folder is gone.
        this.drop()
      } else if (t.kind === 'server') {
        if (a.status !== 'ready' && t.status === 'ready') await this.select(a.key)
        else if (a.status === 'ready' && t.status !== 'ready' && !t.running) this.drop(a.key, t.status)
        else if (a.status !== 'ready' && a.status !== t.status && !(a.status === 'starting' && t.status === 'stopped')) { a.status = t.status; this.emitLink() }
      } else if (t.kind === 'game' && a.link && a.link.mode === 'chat' && a.link.game.pid !== t.pid) {
        await this.select(a.key)
      }
    }
    if (!this.active) await this.autoPick()
    this.emitTargets()
  }

  serverView(s) {
    let status
    if (s.running) status = !s.rcon.enabled || !s.rcon.hasPassword ? 'rcon-off' : s.rcon.listening ? 'ready' : 'restart'
    else status = 'stopped'
    if (this.active && this.active.key === 'srv:' + norm(s.dir) && this.active.status === 'starting' && !s.running) status = 'starting'
    return {
      key: 'srv:' + norm(s.dir),
      kind: 'server',
      name: s.motd || s.motdFile || s.name,
      folder: s.name,
      dir: s.dir,
      software: s.software,
      version: s.version || null,
      versionLabel: s.versionLabel || null,
      running: s.running,
      online: s.online, max: s.max, sample: s.sample || [],
      icon: s.icon || null,
      gamePort: s.gamePort,
      rconPort: s.rcon.port,
      eula: s.eula,
      status,
    }
  }

  gameView(key, g) {
    const a = this.active
    let status = 'game'
    let snap = null
    if (a && a.key === key && a.link && a.link.mode === 'chat') { status = a.status; snap = a.link.snapshot() }
    return {
      key,
      kind: 'game',
      name: 'Minecraft ' + (g.version || ''),
      version: g.version,
      versionLabel: g.versionLabel,
      loader: g.loader,
      launcher: g.launcher,
      username: g.username,
      gameDir: g.gameDir,
      pid: g.pid,
      running: true,
      status,
      where: snap ? snap.where : null,
      server: snap ? snap.server : null,
      world: snap && snap.world ? { name: snap.world.name, folder: snap.world.folder, cheats: snap.world.cheats } : null,
    }
  }

  remoteKey(r) { return 'remote:' + String(r.host).toLowerCase() + ':' + (Number(r.port) || 25575) }

  find(key) { return this.targets.get(key) || null }

  // ---------------------------------------------------------------- choosing

  // What to open when nothing is open: the last world used, else the world
  // the player is in right now, else a server that is ready, else anything
  // that needs one click.
  async autoPick() {
    const list = [...this.targets.values()]
    if (!list.length) return
    const last = this.settings.last && this.targets.get(this.settings.last)
    const ready = (t) => t && (t.status === 'ready' || t.status === 'game')
    const games = list.filter(t => t.kind === 'game')
    const local = list.filter(t => t.kind === 'server')
    // A game connected to a server on this PC: that server's RCON is the better link.
    for (const g of games) {
      const link = await this.peekGame(g.key)
      if (link && link.where === 'server' && link.server) {
        const [host, port] = link.server.split(':')
        const s = local.find(x => LOCAL.test(host) && x.gamePort === Number(port) && x.status === 'ready')
        if (s) return this.select(s.key)
      }
    }
    if (last && last.kind !== 'remote' && ready(last)) return this.select(last.key)
    const inWorld = []
    for (const g of games) { const p = await this.peekGame(g.key); if (p && p.inWorld) inWorld.push(g) }
    const pick = inWorld[0]
      || local.find(t => t.status === 'ready')
      || games[0]
      || local.find(t => t.running)
      || (last && last.kind === 'remote' ? last : null)
      || local[0]
    if (pick) return this.select(pick.key)
  }

  // Reads a game's log state without keeping a link open.
  async peekGame(key) {
    if (this.active && this.active.key === key && this.active.link) return this.active.link.snapshot()
    const g = this.games.get(key)
    if (!g) return null
    if (!this.peeks) this.peeks = new Map()
    let p = this.peeks.get(key)
    if (!p || p.pid !== g.pid) {
      const l = new ChatLink(g)
      l.open()
      l.close()
      p = { pid: g.pid, snap: l.snapshot() }
      this.peeks.set(key, p)
    }
    return p.snap
  }

  drop(key, status) {
    if (this.active && this.active.link) { this.active.link.onClose = null; this.active.link.close() }
    this.active = key ? { key, link: null, status: status || 'offline' } : null
    this.emitLink()
  }

  async select(key, { manual = false } = {}) {
    const t = this.targets.get(key)
    if (!t) return { ok: false, error: 'not-found' }
    const a = this.active
    if (a && a.key === key && a.link && a.status === 'ready' && !manual) return { ok: true }
    if (a && a.link) { a.link.onClose = null; a.link.close() }
    this.active = { key, link: null, status: 'connecting' }
    if (manual || t.status === 'ready' || t.kind === 'game') { this.settings.last = key; this.save() }
    this.emitLink()

    try {
      if (t.kind === 'server') await this.openServer(t)
      else if (t.kind === 'game') await this.openGame(t)
      else await this.openRemote(t)
    } catch (e) {
      if (this.active && this.active.key === key) { this.active.status = e.code || e.message || 'offline'; this.active.link = null }
    }
    this.emitLink()
    this.emitTargets()
    return { ok: this.active && this.active.status === 'ready', status: this.active && this.active.status }
  }

  async openServer(t) {
    if (t.status !== 'ready') { this.active.status = t.status; return }
    const p = props.read(t.dir) || {}
    await this.openRcon({ host: '127.0.0.1', port: Number(p['rcon.port']) || t.rconPort, password: p['rcon.password'] || '' })
  }

  async openRemote(t) {
    const r = this.settings.remotes.find(x => this.remoteKey(x) === t.key)
    if (!r) throw Object.assign(new Error('not-found'), { code: 'not-found' })
    await this.openRcon({ host: r.host, port: r.port, password: this.secret.open(r.pass) })
  }

  async openRcon(opts) {
    const key = this.active.key
    const link = new RconLink(opts)
    await link.open()
    if (!this.active || this.active.key !== key) { link.close(); return }
    link.onClose = () => {
      if (this.active && this.active.link === link) { this.active.link = null; this.active.status = 'offline'; this.emitLink(); this.hurry(); this.rescan() }
    }
    this.active.link = link
    this.active.status = 'ready'
  }

  async openGame(t) {
    const g = this.games.get(t.key)
    const key = t.key
    const link = new ChatLink(g, {
      onChat: (text) => this.emit('chat', { key, text }),
      onState: () => {
        if (!this.active || this.active.link !== link) return
        this.active.status = this.gameStatus(link)
        this.emitLink()
        this.emitTargets()
      },
    })
    link.open()
    this.active.link = link
    const why = await link.problem()
    this.active.status = why || this.gameStatus(link)
  }

  gameStatus(link) {
    const s = link.state
    if (!s.inWorld) return 'not-in-world'
    if (s.cheatsOff) return 'cheats'
    if (!link.keys) return 'no-key'
    if (!link.game.options.pauseOnLostFocus) return 'pause-off'
    return 'ready'
  }

  // ---------------------------------------------------------------- actions

  async run(cmds) {
    const a = this.active
    if (!a || !a.link) return { ok: false, error: a ? a.status : 'no-target' }
    const list = (Array.isArray(cmds) ? cmds : [cmds]).map(String).filter(Boolean).slice(0, 40)
    try {
      const results = await a.link.run(list)
      if (a.link && a.link.mode === 'chat') {
        const st = this.gameStatus(a.link)
        if (st !== a.status) { a.status = st; this.emitLink(); this.emitTargets() }
      }
      return { ok: true, results, mode: a.link ? a.link.mode : null }
    } catch (e) {
      const code = e.code || e.message
      if (process.env.SWEAXBEACON_DEBUG) console.error('run failed:', code, e.detail || '', e.code ? '' : e.stack)
      if (a.link && a.link.mode === 'chat' && code !== 'loading' && code !== 'send-failed') { a.status = code; this.emitLink(); this.emitTargets() }
      return { ok: false, error: code }
    }
  }

  async query(cmd) {
    const a = this.active
    if (!a || !a.link || a.link.mode !== 'rcon') return null
    return a.link.query(String(cmd))
  }

  async enableRcon(key) {
    const t = this.targets.get(key)
    if (!t || t.kind !== 'server') return { ok: false, error: 'not-found' }
    const taken = [...this.targets.values()].filter(x => x.kind === 'server' && x.key !== key).flatMap(x => [x.rconPort, x.gamePort])
    const r = await servers.enableRcon(t.dir, { taken })
    this.hurry()
    await this.rescan()
    if (this.active && this.active.key === key) { this.active.status = this.targets.get(key).status; this.emitLink() }
    return { ok: true, running: t.running, port: r.port }
  }

  async acceptEula(key) {
    const t = this.targets.get(key)
    if (!t || t.kind !== 'server') return { ok: false, error: 'not-found' }
    servers.acceptEula(t.dir)
    await this.rescan()
    return { ok: true }
  }

  async start(key) {
    const t = this.targets.get(key)
    if (!t || t.kind !== 'server') return { ok: false, error: 'not-found' }
    if (t.running) return { ok: false, error: 'running' }
    if (!t.eula) return { ok: false, error: 'eula' }
    await servers.enableRcon(t.dir, { taken: [...this.targets.values()].filter(x => x.kind === 'server' && x.key !== key && x.running).flatMap(x => [x.rconPort, x.gamePort]) })
    const plan = servers.startServer(t.dir, t.version, t.name)
    this.active = { key, link: null, status: 'starting' }
    this.settings.last = key
    this.save()
    this.hurry()
    this.emitLink()
    return { ok: true, plan: { kind: plan.kind, script: plan.script || null, jar: plan.jar || null, java: plan.javaMajor || null } }
  }

  async addFolder(dir) {
    const has = fs.existsSync(path.join(dir, 'server.properties'))
    const jar = !has && fs.readdirSync(dir).find(n => n.toLowerCase().endsWith('.jar'))
    if (!has && !jar) return { ok: false, error: 'not-a-server' }
    if (!has) fs.writeFileSync(path.join(dir, 'server.properties'), '#Minecraft server properties\n', 'utf8')
    this.remember(dir)
    await this.rescan()
    const key = 'srv:' + norm(dir)
    await this.select(key, { manual: true })
    return { ok: true, key }
  }

  async addRemote({ name, host, port, password }) {
    host = String(host || '').trim()
    port = Number(port) || 25575
    if (!host) return { ok: false, error: 'host' }
    const link = new RconLink({ host, port, password: password || '' })
    try { await link.open() } catch (e) { return { ok: false, error: e.code || e.message } }
    link.close()
    const entry = { name: String(name || '').trim() || host, host, port, pass: this.secret.seal(password || '') }
    const key = this.remoteKey(entry)
    this.settings.remotes = [entry, ...this.settings.remotes.filter(r => this.remoteKey(r) !== key)].slice(0, 20)
    this.save()
    await this.rescan()
    await this.select(key, { manual: true })
    return { ok: true, key }
  }

  async forget(key) {
    const t = this.targets.get(key)
    if (!t) return { ok: false }
    if (t.kind === 'server') this.settings.known = this.settings.known.filter(k => 'srv:' + norm(k) !== key)
    if (t.kind === 'remote') this.settings.remotes = this.settings.remotes.filter(r => this.remoteKey(r) !== key)
    if (this.settings.last === key) delete this.settings.last
    this.save()
    if (this.active && this.active.key === key) this.drop()
    await this.rescan()
    return { ok: true }
  }

  // ---------------------------------------------------------------- views

  linkView() {
    const a = this.active
    if (!a) return null
    let t = this.targets.get(a.key) || null
    if (t && t.kind === 'game' && this.games.has(t.key)) t = this.gameView(t.key, this.games.get(t.key))
    const v = { key: a.key, status: a.status, mode: a.link ? a.link.mode : null, target: t }
    if (a.link && a.link.mode === 'chat') v.game = a.link.snapshot()
    return v
  }

  view() {
    const targets = [...this.targets.values()].map(t => t.kind === 'game' && this.games.has(t.key) ? this.gameView(t.key, this.games.get(t.key)) : t)
    return { targets, active: this.linkView(), scanning: !!this.diskScan }
  }

  emitTargets() { this.emit('targets', this.view()) }
  emitLink() { this.emit('link', this.linkView()) }
}

module.exports = { Sessions }
