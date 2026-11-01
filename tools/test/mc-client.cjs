'use strict'

// Starts a real Minecraft client for the tests without disturbing the desktop:
// it is created through WMI (not a child of anything in front, so it cannot
// take focus), a guard in the helper hands the foreground straight back if
// Windows gives it to the new window anyway, and the window is moved below
// every monitor and to the bottom of the window order as soon as it appears.

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const helper = require('../../electron/sys/helper.cjs')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const DEFAULT_JAVA = 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\javaw.exe'

async function launchClient({ client, game, world, java = DEFAULT_JAVA, user = 'BeaconTester', minimize = !!process.env.MC_MINIMIZE }) {
  const L = JSON.parse(fs.readFileSync(path.join(client, 'launch.json'), 'utf8'))
  const args = [
    '-Xms512M', '-Xmx1536M', '-Dminecraft.launcher.brand=sweaxbeacon-test',
    '-cp', L.classpath.join(';'), L.mainClass,
    '--username', user, '--version', path.basename(client).replace(/^client-/, ''),
    '--gameDir', game, '--assetsDir', path.join(client, 'assets'), '--assetIndex', L.assetIndex,
    '--uuid', '8d5a6f1c2b3e4d5f9a0b1c2d3e4f5a6b', '--accessToken', '0', '--userType', 'msa', '--versionType', 'release',
    '--width', '640', '--height', '360', '--quickPlaySingleplayer', world,
  ]
  const q = (a) => /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a
  const cmd = [q(java), ...args.map(q)].join(' ')
  try { fs.unlinkSync(path.join(game, 'logs', 'latest.log')) } catch (e) { /* first run */ }
  const ps = `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${cmd.replace(/'/g, "''")}'; CurrentDirectory = '${game.replace(/'/g, "''")}' }; $r.ProcessId`
  const pid = Number(execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).trim().split(/\s+/).pop())
  await helper.call('guard', { pid, ms: 600000 })
  let win = null
  for (let i = 0; i < 400 && !win; i++) {
    const ws = await helper.call('windows', { pid }).catch(() => [])
    win = ws.find(w => w.cls === 'GLFW30')
    if (!win) await sleep(50)
  }
  if (!win) throw new Error('no game window')
  await helper.call('place', { hwnd: win.hwnd, x: 200, y: 12000, bottom: true, minimize })
  return { pid, hwnd: win.hwnd }
}

async function waitWorld(game, ms = 180000) {
  const log = path.join(game, 'logs', 'latest.log')
  const t0 = Date.now()
  for (;;) {
    if (Date.now() - t0 > ms) throw new Error('world did not load')
    let text = ''
    try { text = fs.readFileSync(log, 'utf8') } catch (e) { /* not yet */ }
    if (/logged in with entity id/.test(text)) return (Date.now() - t0) / 1000
    await sleep(500)
  }
}

function killClient(pid) {
  try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }) } catch (e) { /* gone */ }
}

module.exports = { launchClient, waitWorld, killClient }
