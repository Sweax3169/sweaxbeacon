'use strict'

// Things SweaxBeacon can do to a server folder on this PC, each only when the
// player presses the button for it: switch RCON on, accept the EULA, start
// the server in its own console window.

const fs = require('fs')
const os = require('os')
const path = require('path')
const net = require('net')
const { spawn } = require('child_process')
const props = require('./props.cjs')

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer()
    s.once('error', () => resolve(false))
    s.once('listening', () => s.close(() => resolve(true)))
    s.listen(port, '0.0.0.0')
  })
}

// Turns RCON on with a new random password, unless it is already set up.
// Takes effect the next time the server starts.
async function enableRcon(dir, { taken = [] } = {}) {
  const p = props.read(dir)
  if (!p) throw new Error('no-properties')
  const changes = {}
  if (String(p['enable-rcon']).toLowerCase() !== 'true') changes['enable-rcon'] = 'true'
  if (!p['rcon.password']) changes['rcon.password'] = props.newPassword()
  let port = Number(p['rcon.port']) || 0
  const gamePort = Number(p['server-port']) || 25565
  if (!port || port === gamePort || taken.includes(port)) {
    port = 25575
    while (port === gamePort || taken.includes(port) || !(await portFree(port))) port++
    changes['rcon.port'] = String(port)
  }
  if (Object.keys(changes).length) props.write(dir, changes)
  return { changed: Object.keys(changes), port }
}

function acceptEula(dir) {
  const file = path.join(dir, 'eula.txt')
  let text = ''
  try { text = fs.readFileSync(file, 'utf8') } catch (e) { /* new file */ }
  if (/^\s*eula\s*=/mi.test(text)) text = text.replace(/^\s*eula\s*=.*$/mi, 'eula=true')
  else text += (text && !text.endsWith('\n') ? '\n' : '') + 'eula=true\n'
  fs.writeFileSync(file, text, 'utf8')
}

// ------------------------------------------------------------------ java

function javaMajor(exe) {
  // .../jdk-21.0.2/bin/java.exe, java-runtime-delta (21), java-runtime-gamma (17)
  const s = exe.toLowerCase()
  if (s.includes('java-runtime-delta') || s.includes('java-runtime-epsilon')) return 21
  if (s.includes('java-runtime-gamma')) return 17
  const m = s.match(/(?:jdk|jre|java|zulu|temurin)[-_]?(\d{1,2})(?:[.\-_]|\b)/)
  if (m) return Number(m[1])
  const rel = path.join(path.dirname(path.dirname(exe)), 'release')
  try {
    const v = fs.readFileSync(rel, 'utf8').match(/JAVA_VERSION="(\d+)(?:\.(\d+))?/)
    if (v) return Number(v[1]) === 1 ? Number(v[2]) : Number(v[1])
  } catch (e) { /* no release file */ }
  return 0
}

function findJavas() {
  const home = os.homedir()
  const found = new Set()
  const add = (p) => { if (p && fs.existsSync(p)) found.add(path.resolve(p)) }
  if (process.env.JAVA_HOME) add(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'))
  for (const dir of (process.env.PATH || '').split(';')) if (dir) add(path.join(dir, 'java.exe'))
  const roots = [
    'C:\\Program Files\\Java', 'C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Zulu', 'C:\\Program Files\\BellSoft', 'C:\\Program Files\\Amazon Corretto',
    path.join(home, '.jdks'),
  ]
  for (const r of roots) {
    try { for (const n of fs.readdirSync(r)) add(path.join(r, n, 'bin', 'java.exe')) } catch (e) { /* none */ }
  }
  // The Java that the Minecraft launchers download for the game.
  const runtimes = [
    path.join(home, 'AppData', 'Roaming', '.minecraft', 'runtime'),
    path.join(home, 'AppData', 'Local', 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe', 'LocalCache', 'Local', 'runtime'),
    path.join(home, 'curseforge', 'minecraft', 'Install', 'runtime'),
  ]
  for (const r of runtimes) {
    try {
      for (const n of fs.readdirSync(r)) {
        add(path.join(r, n, 'windows-x64', n, 'bin', 'java.exe'))
        add(path.join(r, n, 'bin', 'java.exe'))
      }
    } catch (e) { /* none */ }
  }
  add('C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\java.exe')
  return [...found].map(exe => ({ exe, major: javaMajor(exe) })).sort((a, b) => b.major - a.major)
}

function neededJava(version) {
  const m = String(version || '').match(/^(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!m) return 21
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3] || 0)]
  if (a >= 20) return 21 // 26.x and later
  if (b > 20 || (b === 20 && c >= 5)) return 21
  if (b >= 18) return 17
  if (b === 17) return 16
  return 8
}

// ------------------------------------------------------------------ start

const SCRIPTS = ['start.bat', 'run.bat', 'start.cmd', 'run.cmd', 'baslat.bat', 'başlat.bat', 'launch.bat', 'server.bat']

function pickJar(dir) {
  let names = []
  try { names = fs.readdirSync(dir) } catch (e) { return null }
  const jars = names.filter(n => n.toLowerCase().endsWith('.jar') && !/installer/i.test(n))
  const order = [/^purpur/i, /^paper/i, /^spigot/i, /^fabric-server-launch/i, /^minecraft_server/i, /^server\.jar$/i, /forge/i, /./]
  for (const re of order) { const j = jars.find(n => re.test(n)); if (j) return j }
  return null
}

function startPlan(dir, version) {
  let names = []
  try { names = fs.readdirSync(dir) } catch (e) { /* unreadable */ }
  const script = SCRIPTS.find(s => names.some(n => n.toLowerCase() === s))
  if (script) return { kind: 'script', script: names.find(n => n.toLowerCase() === script) }
  const jar = pickJar(dir)
  if (!jar) return { kind: 'none' }
  const need = neededJava(version)
  const javas = findJavas()
  const java = javas.find(j => j.major >= need) || javas[0] || null
  return { kind: 'jar', jar, java: java && java.exe, javaMajor: java && java.major, need }
}

// Opens the server in its own console window, the same as double-clicking
// its start script, so it keeps running when SweaxBeacon closes.
function startServer(dir, version, title) {
  const plan = startPlan(dir, version)
  const name = (title || path.basename(dir)).replace(/["^&|<>]/g, '')
  let inner
  if (plan.kind === 'script') inner = `"${plan.script}"`
  else if (plan.kind === 'jar') {
    if (!plan.java) throw new Error('no-java')
    inner = `"${plan.java}" -Xms1G -Xmx2G -jar "${plan.jar}" nogui`
  } else throw new Error('no-jar')
  const cmdline = `start "${name}" /D "${dir}" cmd /k "${inner}"`
  const child = spawn('cmd.exe', ['/d', '/s', '/c', `"${cmdline}"`], {
    cwd: dir, detached: true, stdio: 'ignore', windowsHide: false, windowsVerbatimArguments: true,
  })
  child.unref()
  return plan
}

module.exports = { enableRcon, acceptEula, startServer, startPlan, findJavas, neededJava, portFree }
