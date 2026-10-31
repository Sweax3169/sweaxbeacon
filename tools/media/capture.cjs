'use strict'

// Takes the README screenshots and the demo recording of the real app.
//
//   npx vite build
//   npx electron tools/media/capture.cjs [--stills] [--film] [--out=docs/media]
//
// It starts the stand-in RCON server from fake-rcon-server.cjs, then loads the
// app's own electron/main.cjs (same window, same preload, same RCON client),
// drives the window through the Chrome DevTools Protocol (webContents.debugger)
// and saves PNG screenshots and screencast frames. The window is placed off
// screen and never takes focus, so it does not get in the way of the desktop.
// The app data folder is redirected to a temp folder, so saved connection
// settings of a real install are neither read nor written.

const path = require('path')
const fs = require('fs')
const os = require('os')
const { app, BrowserWindow } = require('electron')
const { startFakeRcon } = require('./fake-rcon-server.cjs')

const ROOT = path.resolve(__dirname, '..', '..')
const argv = process.argv.slice(1)
const arg = (name, def) => { const a = argv.find(s => s.startsWith(`--${name}=`)); return a ? a.split('=').slice(1).join('=') : def }
const has = (name) => argv.includes(`--${name}`)
const OUT = path.resolve(ROOT, arg('out', 'docs/media'))
const FRAMES = path.resolve(arg('frames', path.join(os.tmpdir(), 'sweaxpanel-frames')))
const DO_STILLS = has('stills') || !has('film')
const DO_FILM = has('film') || !has('stills')
const PORT = 25575
const PASSWORD = 'screenshots-only'

app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.setPath('userData', path.join(os.tmpdir(), 'sweaxpanel-capture-profile'))

// Never steal focus from whoever is using the PC.
BrowserWindow.prototype.show = function () { this.showInactive() }

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

app.on('browser-window-created', (e, win) => {
  win.setPosition(-20000, 40)
  win.setSkipTaskbar(true)
  win.webContents.once('did-finish-load', () => {
    tour(win).then(() => app.exit(0), (err) => { console.error(err); app.exit(1) })
  })
})

async function tour(win) {
  const wc = win.webContents
  const dbg = wc.debugger
  dbg.attach('1.3')
  const send = (m, p = {}) => Promise.race([
    dbg.sendCommand(m, p),
    new Promise((_, rej) => setTimeout(() => rej(new Error('CDP timeout: ' + m)), 15000)),
  ])
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('page error: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  }
  await send('Page.enable')
  await send('Emulation.setFocusEmulationEnabled', { enabled: true })
  // The window's own size (1360 x 880) rendered at 2x, whatever the monitor is.
  await send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 880, deviceScaleFactor: 2, mobile: false })

  // Small helpers inside the page: find an element by selector + text, report its centre.
  await evaluate(`window.__cap = {
    find(sel, text) {
      const els = [...document.querySelectorAll(sel)]
      const el = text == null ? els[0] : els.find(e => e.textContent.replace(/\\s+/g, ' ').trim().includes(text))
      if (!el) throw new Error('not found: ' + sel + ' ' + (text || ''))
      return el
    },
    centre(sel, text) {
      const el = this.find(sel, text)
      el.scrollIntoView({ block: 'nearest' })
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
    },
    focusSelect(sel, text) { const el = this.find(sel, text); el.focus(); el.select && el.select(); return true },
    cursor(on) {
      let c = document.getElementById('__cap_cursor')
      if (!on) { if (c) c.remove(); return }
      if (c) return
      c = document.createElement('div')
      c.id = '__cap_cursor'
      c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(700px,520px);transition:transform .55s cubic-bezier(.25,.8,.25,1)'
      c.innerHTML = '<span style="position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:2px solid #fff;opacity:0;transform:scale(.4);transition:none"></span>'
        + '<svg width="22" height="28" viewBox="0 0 22 28" style="position:absolute;left:-3px;top:-2px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))"><path d="M3 2 L3 22 L8.2 17.3 L11.6 25.2 L15 23.7 L11.7 16 L18.6 16 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>'
      document.body.appendChild(c)
    },
    moveCursor(x, y) { const c = document.getElementById('__cap_cursor'); if (c) c.style.transform = 'translate(' + x + 'px,' + y + 'px)' },
    ripple() {
      const c = document.getElementById('__cap_cursor'); if (!c) return
      const r = c.firstChild
      r.style.transition = 'none'; r.style.opacity = '.9'; r.style.transform = 'scale(.4)'
      requestAnimationFrame(() => { r.style.transition = 'transform .45s ease-out, opacity .45s ease-out'; r.style.opacity = '0'; r.style.transform = 'scale(1.6)' })
    },
  }; true`)

  const filming = { on: false }
  const centre = (sel, text) => evaluate(`__cap.centre(${JSON.stringify(sel)}, ${JSON.stringify(text ?? null)})`)
  const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra })
  async function click(sel, text, wait = 350) {
    const { x, y } = await centre(sel, text)
    if (filming.on) { await evaluate(`__cap.moveCursor(${x}, ${y})`); await sleep(620) }
    await mouse('mouseMoved', x, y, { button: 'none' })
    await mouse('mousePressed', x, y, { clickCount: 1 })
    if (filming.on) await evaluate('__cap.ripple()')
    await mouse('mouseReleased', x, y, { clickCount: 1 })
    await sleep(wait)
  }
  async function type(text, perChar = 0) {
    if (!perChar) { await send('Input.insertText', { text }); return }
    for (const ch of text) { await send('Input.insertText', { text: ch }); await sleep(perChar) }
  }
  async function fill(sel, text, value, perChar = 0) {
    await evaluate(`__cap.focusSelect(${JSON.stringify(sel)}, ${JSON.stringify(text ?? null)})`)
    if (value === '') { await key('Backspace', 8); return }
    await type(value, perChar)
  }
  async function key(k, code) {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code })
    if (k === 'Enter') await send('Input.dispatchKeyEvent', { type: 'char', key: k, text: '\r', unmodifiedText: '\r' })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code })
  }
  async function shot(name) {
    await mouse('mouseMoved', 1300, 860, { button: 'none' }) // park the pointer away from hover states
    await sleep(350)
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(path.join(OUT, name), Buffer.from(data, 'base64'))
    console.log('saved', name)
  }
  const nav = (label) => click('.nav-item', label, 450)
  const clearLog = () => click('.log-clear', null, 150)
  const waitFor = async (expr, ms = 8000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) { if (await evaluate(expr)) return; await sleep(100) }
    throw new Error('timed out waiting for ' + expr)
  }

  await sleep(600)

  if (DO_STILLS) {
    await fill('.connect-card input[type=password]', null, PASSWORD)
    await shot('connect.png')
    await click('.connect-btn', null, 400)
    await waitFor(`!!document.querySelector('.dash') && document.querySelectorAll('.player-chip').length === 2`)
    await sleep(5300) // let the "connected" toast leave

    await clearLog()
    for (const label of ['Creative', 'Ölümsüzlük', 'Süper Hız', 'Gece Görüşü']) await click('.action-card', label, 250)
    await shot('tab-powers.png')

    await nav('Eşya'); await clearLog()
    await click('.action-card', 'Elmas Alet Seti', 250)
    await click('.action-card', 'Elytra', 250)
    await fillNth('.form-field input', 0, 'netherite_ingot')
    await fillNth('.form-field input', 1, '16')
    await click('.go-btn', 'Ver', 300)
    await shot('tab-items.png')

    await nav('Işınlanma'); await clearLog()
    await fillNth('.form-field input', 0, '120')
    await fillNth('.form-field input', 1, '72')
    await fillNth('.form-field input', 2, '-340')
    await click('.go-btn', 'Işınla', 250)
    await click('.pill', '50 blok', 250)
    await fillNth('.form-field input', 3, 'Alex')
    await click('.go-btn', 'Steve → Alex', 300)
    await shot('tab-teleport.png')

    await nav('Dünya')
    await sleep(900) // the tab reads the current gamerules on open
    await clearLog()
    await click('.pill', 'Gündüz', 250)
    await click('.pill', 'Açık', 250)
    await click('.pill', 'Zor', 250)
    await click('.toggle', null, 400)
    await shot('tab-world.png')

    await nav('Oyuncular'); await clearLog()
    await clickInRow('Alex', 'OP')
    await fillNth('.form-field input', 0, 'Restart in 10 minutes')
    await click('.go-btn', 'Gönder', 250)
    await click('.pill', 'Listeyi gör', 300)
    await shot('tab-players.png')

    await nav('Konsol'); await clearLog()
    for (const c of ['seed', 'tps', 'give {t} minecraft:spyglass']) {
      await fill('.console-input-row input', null, c)
      await key('Enter', 13)
      await sleep(250)
    }
    await fill('.console-input-row input', null, 'weather clear')
    await shot('tab-console.png')

    await click('.disconnect-btn', null, 600)
  }

  async function fillNth(sel, n, value) {
    await evaluate(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${n}]; el.focus(); el.select(); return true })()`)
    await type(value)
  }
  async function clickInRow(player, label) {
    const { x, y } = await evaluate(`(() => {
      const row = [...document.querySelectorAll('.player-row')].find(r => r.querySelector('.player-name').textContent === ${JSON.stringify(player)})
      const b = [...row.querySelectorAll('.mini-btn')].find(b => b.textContent.trim() === ${JSON.stringify(label)})
      const r = b.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
    })()`)
    if (filming.on) { await evaluate(`__cap.moveCursor(${x}, ${y})`); await sleep(620) }
    await mouse('mouseMoved', x, y, { button: 'none' })
    await mouse('mousePressed', x, y, { clickCount: 1 })
    if (filming.on) await evaluate('__cap.ripple()')
    await mouse('mouseReleased', x, y, { clickCount: 1 })
    await sleep(350)
  }

  if (DO_FILM) {
    await waitFor(`!!document.querySelector('.connect-card')`)
    await fill('.connect-card input[type=password]', null, '')
    await evaluate('document.activeElement && document.activeElement.blur(); true')
    await evaluate('__cap.cursor(true)')
    fs.rmSync(FRAMES, { recursive: true, force: true })
    fs.mkdirSync(FRAMES, { recursive: true })
    const stamps = []
    let n = 0
    dbg.on('message', (event, method, params) => {
      if (method !== 'Page.screencastFrame') return
      const file = `f${String(n++).padStart(5, '0')}.jpg`
      fs.writeFileSync(path.join(FRAMES, file), Buffer.from(params.data, 'base64'))
      stamps.push({ file, t: params.metadata.timestamp })
      dbg.sendCommand('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {})
    })
    await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 2720, maxHeight: 1760, everyNthFrame: 1 })
    filming.on = true
    await sleep(900)

    await click('.connect-card input[type=password]', null, 200)
    await type(PASSWORD, 55)
    await click('.connect-btn', null, 1100)
    await nav('Güçler') // the app keeps the last tab across reconnects
    await click('.action-card', 'Creative', 500)
    await click('.action-card', 'Süper Hız', 500)
    await click('.action-card', 'Gece Görüşü', 700)
    await nav('Eşya')
    await click('.action-card', 'Elmas Zırh Seti', 800)
    await nav('Işınlanma')
    await click('.pill', '50 blok', 800)
    await nav('Dünya')
    await sleep(500)
    await click('.toggle', null, 500)
    await click('.pill', 'Akşam', 800)
    await nav('Oyuncular')
    await clickInRow('Alex', 'OP')
    await sleep(500)
    await nav('Konsol')
    await click('.console-input-row input', null, 150)
    await type('seed', 90)
    await key('Enter', 13)
    await sleep(1800)

    filming.on = false
    await send('Page.stopScreencast')
    await sleep(300)
    fs.writeFileSync(path.join(FRAMES, 'frames.json'), JSON.stringify(stamps, null, 1))
    console.log('frames', stamps.length, '->', FRAMES)
  }
}

;(async () => {
  await startFakeRcon({ port: PORT, password: PASSWORD })
  require(path.join(ROOT, 'electron', 'main.cjs'))
})().catch((e) => { console.error(e); app.exit(1) })
