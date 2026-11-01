'use strict'

// End-to-end test of the chat link against a real Minecraft client.
//
//   node tools/test/fetch-client.cjs 1.21.4 <client>
//   node tools/test/chat-link-test.cjs --client=<client> --game=<gameDir> --world=SweaxTest [--java=<javaw.exe>]
//
// The client is started through WMI (Win32_Process.Create), so it is not a
// child of anything in the foreground and cannot take focus; its window is
// moved far outside every monitor as soon as it appears. The test sends no
// keyboard or mouse input to the desktop: everything goes through the chat
// link (window messages to the game window only). While it runs, it samples
// the mouse position, the mouse clip rectangle and the foreground window
// every 25 ms and fails if the game ever touches any of them.

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const helper = require('../../electron/sys/helper.cjs')
const { discover } = require('../../electron/mc/discover.cjs')
const { ChatLink } = require('../../electron/mc/links.cjs')
const game = require('../../electron/mc/game.cjs')

const arg = (n, d) => { const a = process.argv.find(s => s.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d }
const CLIENT = path.resolve(arg('client'))
const GAME = path.resolve(arg('game'))
const WORLD = arg('world', 'SweaxTest')
const JAVA = arg('java', 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\javaw.exe')
const EXPECT_CHEATS = arg('cheats', 'on') === 'on'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

let failures = 0
let tWorld = Infinity
let clientPid = null
const check = (ok, what, extra) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${extra ? '  ' + extra : ''}`); if (!ok) failures++ }

function launch() {
  const L = JSON.parse(fs.readFileSync(path.join(CLIENT, 'launch.json'), 'utf8'))
  const cp = L.classpath.join(';')
  const args = [
    '-Xms512M', '-Xmx1536M', '-Dminecraft.launcher.brand=sweaxbeacon-test',
    '-cp', cp, L.mainClass,
    '--username', 'BeaconTester', '--version', path.basename(CLIENT).replace(/^client-/, ''),
    '--gameDir', GAME, '--assetsDir', path.join(CLIENT, 'assets'), '--assetIndex', L.assetIndex,
    '--uuid', '8d5a6f1c2b3e4d5f9a0b1c2d3e4f5a6b', '--accessToken', '0', '--userType', 'msa', '--versionType', 'release',
    '--width', '640', '--height', '360', '--quickPlaySingleplayer', WORLD,
  ]
  const q = (a) => /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a
  const cmd = [q(JAVA), ...args.map(q)].join(' ')
  const ps = `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${cmd.replace(/'/g, "''")}'; CurrentDirectory = '${GAME.replace(/'/g, "''")}' }; $r.ProcessId`
  const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).trim()
  return Number(out.split(/\s+/).pop())
}

;(async () => {
  try { fs.unlinkSync(path.join(GAME, 'logs', 'latest.log')) } catch (e) { /* first run */ }
  const before = await helper.call('cursor')
  const pid = launch()
  clientPid = pid
  console.log('client pid', pid)
  // A PC that has been idle lets a new window take the foreground; give it
  // straight back so the game runs in the background, as it does when the
  // player is using SweaxBeacon.
  await helper.call('guard', { pid, ms: 240000 })

  // Watch the desktop for the whole run.
  const samples = []
  let watching = true
  ;(async () => { while (watching) { try { samples.push({ t: Date.now(), ...(await helper.call('cursor')) }) } catch (e) { /* busy */ } await sleep(25) } })()

  let win = null
  for (let i = 0; i < 400 && !win; i++) {
    const ws = await helper.call('windows', { pid }).catch(() => [])
    win = ws.find(w => w.cls === 'GLFW30')
    if (!win) await sleep(50)
  }
  if (!win) throw new Error('no game window')
  await helper.call('place', { hwnd: win.hwnd, x: 200, y: 12000, bottom: true })
  console.log('window', win.hwnd, 'moved off screen; foreground at start:', win.foreground)

  const log = path.join(GAME, 'logs', 'latest.log')
  const t0 = Date.now()
  for (;;) {
    if (Date.now() - t0 > 180000) throw new Error('world did not load')
    let text = ''
    try { text = fs.readFileSync(log, 'utf8') } catch (e) { /* not yet */ }
    if (/logged in with entity id/.test(text)) break
    await sleep(500)
  }
  console.log('world loaded after', ((Date.now() - t0) / 1000).toFixed(1), 's')
  tWorld = Date.now()

  const found = await discover({})
  const g = found.games.find(x => x.pid === pid)
  check(!!g, 'discover() finds the running client')
  check(g && path.resolve(g.gameDir) === GAME, 'game folder from the command line', g && g.gameDir)
  check(g && g.username === 'BeaconTester', 'player name', g && g.username)
  check(g && g.hwnd === win.hwnd, 'game window found', g && g.title)
  check(g && g.options.pauseOnLostFocus === true, 'options.txt read')

  const states = []
  const link = new ChatLink(g, { onState: (s) => states.push(s) })
  link.open()
  await sleep(600)
  check(link.state.inWorld && link.state.where === 'single', 'log says: in a single-player world', JSON.stringify({ inWorld: link.state.inWorld, where: link.state.where }))
  const w0 = link.refreshWorld()
  check(w0 && w0.folder === WORLD, 'open world found by its session.lock', w0 && w0.name)

  // Sent right after the world loaded: the link waits until the game has settled.
  const t1 = Date.now()
  const r1 = await link.run(['gamemode creative', 'time set 6000', 'effect give @s minecraft:speed infinite 1 true'])
  console.log('batch 1 took', Date.now() - t1, 'ms')
  for (const r of r1) console.log('   ', r.cmd, '=>', JSON.stringify(r.resp), r.ok ? '' : '(error)')
  if (EXPECT_CHEATS) {
    check(r1.length === 3 && r1.every(r => r.ok && r.resp), 'three commands, three replies')
    check(/creative/i.test(r1[0].resp), 'game mode reply')
    check(/6000/.test(r1[1].resp), 'time reply')
    check(/speed/i.test(r1[2].resp), 'effect reply')

    const r2 = await link.run(['give @s minecraft:diamond 3', 'gamerule keepInventory true', 'tp @s ~ ~5 ~', 'list'])
    for (const r of r2) console.log('   ', r.cmd, '=>', JSON.stringify(r.resp), r.ok ? '' : '(error)')
    check(r2.every(r => r.ok), 'give, gamerule, tp and list work')
    const names = r2[3] && game.matches(link.language, 'list', r2[3].resp)
    check(names && /BeaconTester/.test(names[3]), 'list reply parsed', names && names[3])

    const r3 = await link.run(['gamemode nonsense'])
    check(r3[0] && !r3[0].ok, 'a wrong command is reported as an error', r3[0] && r3[0].resp)

    await sleep(2500)
    const w1 = link.refreshWorld()
    check(w1 && w1.player && w1.player.gamemode === 'creative', 'level.dat: player is in creative now', w1 && w1.player && w1.player.gamemode)
    check(w1 && w1.dayTime != null && w1.dayTime >= 6000 && w1.dayTime < 6400, 'level.dat: time is ~6000', w1 && w1.dayTime)
    check(w1 && w1.player && w1.player.effects.some(e => e.id === 'speed'), 'level.dat: speed effect is active')
    check(w1 && w1.rules && (w1.rules.keepInventory === true || w1.rules.keep_inventory === true), 'level.dat: keepInventory is on')
    check(link.pauses >= 3, 'every batch ended with the game paused again', link.pauses + ' pauses')
  } else {
    check(r1.every(r => !r.ok), 'commands fail without cheats', r1.map(r => r.resp).join(' | '))
    check(link.state.cheatsOff === true, 'link notices that cheats are off')
  }

  // The game must still be paused in the background and the desktop untouched.
  const ws = await helper.call('windows', { pid })
  check(ws.find(w => w.hwnd === win.hwnd) && !ws.find(w => w.hwnd === win.hwnd).foreground, 'game window is still in the background')
  check(/Saving and pausing game/.test(fs.readFileSync(log, 'utf8')), 'game paused itself again after each batch')
  watching = false
  await sleep(100)
  const clipChanged = samples.filter(s => s.clip.join() !== before.clip.join())
  const fgGame = samples.filter(s => s.foreground === win.hwnd)
  // The window sits below every monitor: a cursor GLFW moved there would stop at the bottom edge.
  const edge = samples.filter(s => s.pos[1] >= before.clip[3] - 1 && before.pos[1] < before.clip[3] - 1)
  const hits = samples.length ? samples[samples.length - 1].guardHits : 0
  console.log('foreground handed back', hits, 'time(s); samples with the game in front:', fgGame.length)
  if (fgGame.length) console.log('   first at +' + (fgGame[0].t - samples[0].t) + ' ms, last at +' + (fgGame[fgGame.length - 1].t - samples[0].t) + ' ms')
  check(clipChanged.length === 0, `mouse never fenced in (${samples.length} samples)`)
  check(fgGame.every(s => s.t < tWorld), 'game was never in front once the world was loaded')
  check(edge.length === 0, 'mouse never pulled toward the game window')

  link.close()
  execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  await helper.call('unclip')
  helper.stop()
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED')
  process.exit(failures ? 1 : 0)
})().catch(async (e) => {
  console.error('ERROR', e.message)
  if (clientPid) try { execFileSync('taskkill', ['/PID', String(clientPid), '/T', '/F'], { stdio: 'ignore' }) } catch (x) { /* gone */ }
  try { await helper.call('unclip') } catch (x) { /* helper gone */ }
  helper.stop()
  process.exit(1)
})
