'use strict'

// The whole app against a real single-player world: SweaxBeacon has to find
// the running game by itself, link to it through the chat, and the buttons
// have to change the world.
//
//   npx vite build
//   node tools/test/app-chat-e2e.cjs --client=<client> --game=<gameDir> --world=SweaxTest
//
// Run with Node, it plays the player: it starts the game the way
// tools/test/mc-client.cjs describes (off screen, no focus), waits until the
// world is loaded and paused in the background, then opens SweaxBeacon (this
// same file, run by Electron) off screen and drives it through the DevTools
// protocol. Afterwards level.dat is read to see what really changed.

const path = require('path')
const fs = require('fs')
const os = require('os')

const argv = process.argv.slice(1)
const arg = (n, d) => { const a = argv.find(s => s.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const ROOT = path.resolve(__dirname, '..', '..')

if (!process.versions.electron) {
  // ---------------------------------------------------------------- the player
  const { spawnSync } = require('child_process')
  const { launchClient, waitWorld, killClient } = require('./mc-client.cjs')
  const helper = require('../../electron/sys/helper.cjs')
  const CLIENT = path.resolve(arg('client'))
  const GAME = path.resolve(arg('game'))
  const WORLD = arg('world', 'SweaxTest')
  let c = null
  ;(async () => {
    c = await launchClient({ client: CLIENT, game: GAME, world: WORLD })
    console.log('client pid', c.pid)
    console.log('world loaded after', (await waitWorld(GAME)).toFixed(1), 's')
    const log = path.join(GAME, 'logs', 'latest.log')
    for (let i = 0; i < 240 && !/Saving and pausing game/.test(fs.readFileSync(log, 'utf8')); i++) await sleep(500)
    console.log('game paused in the background; opening SweaxBeacon')
    const electron = require('electron') // the path to the Electron binary when required from Node
    const r = spawnSync(electron, [__filename, `--game=${GAME}`, `--pid=${c.pid}`, `--hwnd=${c.hwnd}`], { stdio: 'inherit', cwd: ROOT })
    killClient(c.pid)
    try { await helper.call('unclip') } catch (e) { /* gone */ }
    helper.stop()
    process.exit(r.status || 0)
  })().catch((e) => { console.error(e); if (c) killClient(c.pid); helper.stop(); process.exit(1) })
} else {
  // ---------------------------------------------------------------- the app
  const { app, BrowserWindow } = require('electron')
  const game = require('../../electron/mc/game.cjs')
  const helper = require('../../electron/sys/helper.cjs')
  const GAME = path.resolve(arg('game'))
  const PID = Number(arg('pid'))
  const HWND = Number(arg('hwnd'))
  const OUT = path.join(os.tmpdir(), 'sweaxbeacon-e2e')
  let failures = 0
  const check = (ok, what, extra) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${extra ? '  ' + extra : ''}`); if (!ok) failures++ }

  app.setPath('userData', path.join(os.tmpdir(), 'sweaxbeacon-e2e-profile-' + Date.now()))
  BrowserWindow.prototype.show = function () { this.showInactive() }
  app.on('browser-window-created', (e, win) => {
    win.setPosition(-20000, 40)
    win.setSkipTaskbar(true)
    win.webContents.once('did-finish-load', () => {
      drive(win).then(finish, (err) => { console.error('ERROR', err.message); failures++; finish() })
    })
  })
  const finish = () => { console.log(failures ? `${failures} FAILED` : 'ALL PASSED'); helper.stop(); app.exit(failures ? 1 : 0) }

  async function drive(win) {
    const dbg = win.webContents.debugger
    dbg.attach('1.3')
    const send = (m, p = {}) => dbg.sendCommand(m, p)
    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error('page error: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
      return r.result.value
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 1320, height: 860, deviceScaleFactor: 1, mobile: false })
    const waitFor = async (expr, ms = 60000) => {
      const t0 = Date.now()
      while (Date.now() - t0 < ms) { if (await evaluate(expr)) return true; await sleep(250) }
      return false
    }
    const click = (sel, text) => evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.includes(${JSON.stringify(text)})); if (!el) throw new Error('not found ${sel} ${text}'); el.click(); return true })()`)
    const shot = async (name) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png' })
      fs.mkdirSync(OUT, { recursive: true })
      fs.writeFileSync(path.join(OUT, name), Buffer.from(data, 'base64'))
    }

    const linked = await waitFor(`!!document.querySelector('.mode.chat')`, 60000)
    check(linked, 'found the running game and linked to it through the chat, with no setup screen')
    const title = await evaluate(`document.querySelector('.switch .who b').textContent`)
    check(title === 'Beacon Test', 'shows the open world by name', title)
    await shot('e2e-linked.png')

    await click('.mode-card', 'Yaratıcı')
    await sleep(300)
    await click('.power', 'Hız')
    await sleep(300)
    await click('.hb-slot', 'Dünya')
    await sleep(500)
    await click('.tile', 'Öğle')
    await sleep(1500)
    check(await waitFor(`!document.querySelector('.busy-tag')`, 40000), 'all three buttons finished')
    const feed = await evaluate(`[...document.querySelectorAll('.feed-line')].map(e => e.textContent)`)
    console.log('   replies in the app:', JSON.stringify(feed))
    check(feed.some(t => /Creative/i.test(t)) && feed.some(t => /Speed/i.test(t)) && feed.some(t => /6000/.test(t)), 'the game’s replies are shown')

    await sleep(2500)
    const dir = game.openWorld(GAME)
    const w = dir && game.worldState(dir)
    check(w && w.player && w.player.gamemode === 'creative', 'level.dat: creative', w && w.player && w.player.gamemode)
    check(w && w.player && w.player.effects.some(e => e.id === 'speed'), 'level.dat: speed is active')
    check(w && w.dayTime >= 6000 && w.dayTime < 6400, 'level.dat: noon', w && w.dayTime)

    await click('.hb-slot', 'Güçler')
    const shows = await waitFor(`!!document.querySelector('.mode-card.on') && document.querySelector('.mode-card.on').textContent.includes('Yaratıcı') && !!document.querySelector('.power.on')`, 15000)
    check(shows, 'the app reads the new state back from the world')
    await shot('e2e-after.png')
    const ws = await helper.call('windows', { pid: PID })
    const gw = ws.find(x => x.hwnd === HWND)
    check(gw && !gw.foreground, 'the game stayed in the background')
  }

  require(path.join(ROOT, 'electron', 'main.cjs'))
}
