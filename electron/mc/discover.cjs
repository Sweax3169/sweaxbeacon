'use strict'

// Finds every Minecraft thing on this PC that SweaxBeacon can drive:
//
//   servers  running java processes whose working folder holds server.properties,
//            plus server folders found on disk or remembered from earlier runs
//   games    running Minecraft clients (any launcher), found by their command line
//
// Nothing here changes a file; it only looks.

const fs = require('fs')
const os = require('os')
const path = require('path')
const helper = require('../sys/helper.cjs')
const { listening } = require('../sys/netstat.cjs')
const props = require('./props.cjs')
const { ping } = require('./slp.cjs')

// ------------------------------------------------------------------ command lines

function splitArgs(cmd) {
  const out = []
  let cur = '', quoted = false, has = false
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]
    if (c === '"') { quoted = !quoted; has = true; continue }
    if (!quoted && /\s/.test(c)) { if (has) { out.push(cur); cur = ''; has = false } continue }
    cur += c; has = true
  }
  if (has) out.push(cur)
  return out
}

function argValue(args, name) {
  const i = args.indexOf(name)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null
}

const CLIENT_MAINS = [
  'net.minecraft.client.main.Main',
  'net.fabricmc.loader.impl.launch.knot.KnotClient',
  'net.fabricmc.loader.launch.knot.KnotClient',
  'org.quiltmc.loader.impl.launch.knot.KnotClient',
  'org.prismlauncher.EntryPoint',
  'org.multimc.EntryPoint',
]

function isClient(args) {
  if (args.some(a => CLIENT_MAINS.includes(a))) return true
  if (args.includes('--accessToken') && args.includes('--version')) return true
  const target = argValue(args, '--launchTarget')
  return !!(target && /client/i.test(target))
}

function loaderOf(args, version) {
  const joined = args.join(' ')
  if (/fabricmc/i.test(joined) || /fabric/i.test(version || '')) return 'Fabric'
  if (/quiltmc/i.test(joined)) return 'Quilt'
  if (/neoforge/i.test(joined)) return 'NeoForge'
  if (/minecraftforge|forgeclient|fmlclient/i.test(joined)) return 'Forge'
  if (/optifine/i.test(joined) || /optifine/i.test(version || '')) return 'OptiFine'
  return null
}

function launcherOf(args) {
  const brand = args.find(a => a.startsWith('-Dminecraft.launcher.brand='))
  if (brand) return brand.split('=')[1]
  const joined = args.join(' ').toLowerCase()
  if (joined.includes('tlauncher')) return 'TLauncher'
  if (joined.includes('curseforge')) return 'CurseForge'
  if (joined.includes('prismlauncher')) return 'Prism'
  if (joined.includes('modrinth')) return 'Modrinth'
  return null
}

// "Fabric 1.21.11", "fabric-loader-0.16.10-1.21.4", "1.20.1-forge-47.2.0", "26.1"
function cleanVersion(v) {
  if (!v) return null
  const m = String(v).match(/(?:^|[^\d.])((?:1\.\d{1,2}(?:\.\d{1,2})?)|(?:2\d\.\d{1,2}(?:\.\d{1,2})?))(?![\d.])/)
  return m ? m[1] : String(v)
}

function serverSoftware(args, dir) {
  const joined = args.join(' ').toLowerCase()
  const jar = (argValue(args, '-jar') || '').toLowerCase()
  if (jar.includes('purpur') || joined.includes('purpur')) return 'Purpur'
  if (jar.includes('paper') || joined.includes('io.papermc')) return 'Paper'
  if (jar.includes('spigot')) return 'Spigot'
  if (jar.includes('fabric') || joined.includes('fabricmc')) return 'Fabric'
  if (joined.includes('neoforged') || joined.includes('neoforge')) return 'NeoForge'
  if (joined.includes('minecraftforge') || jar.includes('forge')) return 'Forge'
  if (dir) {
    try {
      const names = fs.readdirSync(dir).map(n => n.toLowerCase())
      if (names.some(n => n.startsWith('purpur'))) return 'Purpur'
      if (names.some(n => n.startsWith('paper'))) return 'Paper'
      if (names.some(n => n.startsWith('spigot'))) return 'Spigot'
      if (names.includes('fabric-server-launch.jar') || names.includes('.fabric')) return 'Fabric'
      if (names.some(n => n.includes('forge'))) return 'Forge'
    } catch (e) { /* unreadable */ }
  }
  return 'Vanilla'
}

const norm = (p) => path.resolve(p).replace(/[\\/]+$/, '').toLowerCase()

// ------------------------------------------------------------------ servers

function serverDirFor(proc, args) {
  const tries = []
  if (proc.cwd) tries.push(proc.cwd)
  const jar = argValue(args, '-jar')
  if (jar && path.isAbsolute(jar)) tries.push(path.dirname(jar))
  for (const d of tries) {
    if (fs.existsSync(path.join(d, 'server.properties')) || fs.existsSync(path.join(d, 'eula.txt'))) return path.resolve(d)
  }
  return null
}

function eulaAccepted(dir) {
  try { return /^\s*eula\s*=\s*true\s*$/mi.test(fs.readFileSync(path.join(dir, 'eula.txt'), 'utf8')) } catch (e) { return false }
}

function describeServer(dir, p) {
  const rconPort = Number(p['rcon.port']) || 25575
  return {
    id: 'srv:' + norm(dir),
    kind: 'server',
    dir,
    name: path.basename(dir),
    gamePort: Number(p['server-port']) || 25565,
    host: p['server-ip'] && p['server-ip'] !== '0.0.0.0' ? p['server-ip'] : '127.0.0.1',
    motdFile: p.motd || '',
    level: p['level-name'] || 'world',
    rcon: {
      enabled: String(p['enable-rcon']).toLowerCase() === 'true',
      port: rconPort,
      hasPassword: !!(p['rcon.password'] && p['rcon.password'].length),
      listening: false,
    },
    eula: eulaAccepted(dir),
    running: false,
  }
}

// ------------------------------------------------------------------ games

function readOptions(gameDir) {
  const out = {}
  try {
    for (const line of fs.readFileSync(path.join(gameDir, 'options.txt'), 'utf8').split(/\r?\n/)) {
      const i = line.indexOf(':')
      if (i > 0) out[line.slice(0, i)] = line.slice(i + 1)
    }
  } catch (e) { /* no options yet */ }
  return out
}

async function describeGame(proc, args) {
  const gameDir = path.resolve(argValue(args, '--gameDir') || proc.cwd || path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft'))
  const rawVersion = argValue(args, '--version')
  let windows = []
  try { windows = await helper.call('windows', { pid: proc.pid }) } catch (e) { /* helper missing */ }
  const win = windows.find(w => w.cls === 'GLFW30') || windows.find(w => /minecraft/i.test(w.title)) || null
  const opts = readOptions(gameDir)
  return {
    id: 'game:' + proc.pid,
    kind: 'game',
    pid: proc.pid,
    gameDir,
    cwd: proc.cwd ? path.resolve(proc.cwd) : null,
    username: argValue(args, '--username'),
    versionLabel: rawVersion,
    version: cleanVersion(rawVersion),
    loader: loaderOf(args, rawVersion),
    launcher: launcherOf(args),
    assetsDir: argValue(args, '--assetsDir'),
    assetIndex: argValue(args, '--assetIndex'),
    hwnd: win ? win.hwnd : null,
    title: win ? win.title : null,
    iconic: win ? win.iconic : false,
    options: {
      lang: opts.lang || 'en_us',
      pauseOnLostFocus: opts.pauseOnLostFocus !== 'false',
      chatKey: opts['key_key.chat'] || 'key.keyboard.t',
      commandKey: opts['key_key.command'] || 'key.keyboard.slash',
    },
    running: true,
  }
}

// ------------------------------------------------------------------ disk scan

const SKIP = new Set([
  'node_modules', '.git', '.svn', 'windows', 'program files', 'program files (x86)', 'programdata', 'appdata',
  '$recycle.bin', 'system volume information', 'recovery', 'perflogs', '.gradle', '.m2', '.cache', '.npm', '.nuget',
  'steamapps', 'library', 'venv', '.venv', '__pycache__', 'site-packages', 'world', 'world_nether', 'world_the_end',
  'region', 'libraries', 'versions', 'logs', 'cache', 'saves', 'assets', 'resourcepacks', 'shaderpacks', '.minecraft',
  'mods', 'config', 'crash-reports', 'screenshots', 'dist', 'out', 'target', 'release', 'win-unpacked',
])

function scanRoots(extra = []) {
  const home = os.homedir()
  const roots = []
  const add = (p, depth) => { if (p && fs.existsSync(p) && !roots.some(r => norm(r.p) === norm(p))) roots.push({ p, depth }) }
  for (const sub of ['Desktop', 'Documents', 'Downloads', 'OneDrive\\Desktop', 'OneDrive\\Documents', 'OneDrive\\Masaüstü', 'OneDrive\\Belgeler']) add(path.join(home, sub), 4)
  add(home, 1)
  for (const letter of 'CDEFGHIJ') {
    const root = letter + ':\\'
    if (fs.existsSync(root)) add(root, letter === 'C' ? 2 : 3)
  }
  for (const e of extra) add(e, 3)
  return roots
}

async function scanDisk(extra = [], budgetMs = 4000) {
  const found = new Set()
  const deadline = Date.now() + budgetMs
  let visited = 0
  async function walk(dir, depth) {
    if (Date.now() > deadline || visited > 25000) return
    visited++
    let entries
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch (e) { return }
    if (entries.some(e => e.isFile() && e.name === 'server.properties')) found.add(path.resolve(dir))
    if (depth <= 0) return
    for (const e of entries) {
      if (!e.isDirectory() || e.isSymbolicLink()) continue
      const low = e.name.toLowerCase()
      if (SKIP.has(low) || low.startsWith('.') && low !== '.server') continue
      await walk(path.join(dir, e.name), depth - 1)
    }
  }
  for (const r of scanRoots(extra)) await walk(r.p, r.depth)
  return [...found]
}

// ------------------------------------------------------------------ everything

// known: folders remembered from earlier scans or added by the player.
async function discover({ known = [] } = {}) {
  let procs = []
  try { procs = await helper.call('procs') } catch (e) { procs = [] }
  const ports = await listening()

  const servers = new Map()
  const games = []

  for (const proc of procs) {
    if (!proc.cmd) continue
    const args = splitArgs(proc.cmd)
    if (isClient(args)) { games.push(await describeGame(proc, args)); continue }
    const dir = serverDirFor(proc, args)
    if (!dir) continue
    const p = props.read(dir) || {}
    const s = describeServer(dir, p)
    s.running = true
    s.pid = proc.pid
    s.software = serverSoftware(args, dir)
    const own = ports.get(proc.pid) || []
    s.rcon.listening = own.some(x => x.port === s.rcon.port)
    s.gameListening = own.some(x => x.port === s.gamePort)
    servers.set(s.id, s)
  }

  for (const dir of known) {
    if (!dir || !fs.existsSync(path.join(dir, 'server.properties'))) continue
    const id = 'srv:' + norm(dir)
    if (servers.has(id)) continue
    const s = describeServer(path.resolve(dir), props.read(dir) || {})
    s.software = serverSoftware([], dir)
    servers.set(id, s)
  }

  // Ask each running server what it is: version, players, MOTD, icon.
  await Promise.all([...servers.values()].filter(s => s.running).map(async (s) => {
    const info = await ping(s.host, s.gamePort)
    if (info) {
      s.version = cleanVersion(info.version) || info.version
      s.versionLabel = info.version
      s.protocol = info.protocol
      s.motd = info.motd
      s.icon = info.icon
      s.online = info.online
      s.max = info.max
      s.sample = info.sample
    }
  }))

  // A game connected to one of these servers is shown on the server too.
  return { servers: [...servers.values()], games }
}

module.exports = { discover, scanDisk, splitArgs, isClient, cleanVersion, readOptions }
