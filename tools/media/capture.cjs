'use strict'

// Screenshots and screen recordings of SweaxBeacon for the README and the site.
//
//   npx vite build
//   npx electron tools/media/capture.cjs --scene=stills [--theme=quartz] [--out=docs/media]
//   npx electron tools/media/capture.cjs --scene=gates --demo=empty|stopped|rconoff
//   npx electron tools/media/capture.cjs --scene=tour|single|setup [--frames=DIR]
//   node tools/media/encode-film.cjs --frames=DIR --name=tour
//
// It loads the app's own electron/main.cjs in demo mode (SWEAXBEACON_DEMO):
// the real interface, on the made-up worlds of src/mockApi.js, so no real
// server, game, folder or player name appears. The window sits off screen and
// never takes focus; it is driven through the Chrome DevTools Protocol.
// --live loads the real thing instead (for checking against real servers);
// those pictures go to a temp folder, never into docs/.

const path = require('path')
const fs = require('fs')
const os = require('os')
const { app, BrowserWindow } = require('electron')

const ROOT = path.resolve(__dirname, '..', '..')
const argv = process.argv.slice(1)
const arg = (name, def) => { const a = argv.find(s => s.startsWith(`--${name}=`)); return a ? a.split('=').slice(1).join('=') : def }
const has = (name) => argv.includes(`--${name}`)
const SCENE = arg('scene', 'stills')
const LIVE = has('live')
const OUT = LIVE ? path.join(os.tmpdir(), 'sweaxbeacon-live') : path.resolve(ROOT, arg('out', 'docs/media'))
const FRAMES = path.resolve(arg('frames', path.join(os.tmpdir(), 'sweaxbeacon-frames-' + SCENE)))
const W = 1320, H = 860

const DEMO_FOR = { stills: 'server', tour: 'server', single: 'chat', chatstill: 'chat', setup: 'rconoff', gates: 'empty' }
if (!LIVE) process.env.SWEAXBEACON_DEMO = arg('demo', DEMO_FOR[SCENE] || 'server')
if (arg('theme')) process.env.SWEAXBEACON_THEME = arg('theme')

app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.setPath('userData', path.join(os.tmpdir(), 'sweaxbeacon-capture-profile'))

// Never steal focus from whoever is using the PC.
BrowserWindow.prototype.show = function () { this.showInactive() }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

app.on('browser-window-created', (e, win) => {
  win.setPosition(-20000, 40)
  win.setSkipTaskbar(true)
  win.webContents.once('did-finish-load', () => {
    run(win).then(() => app.exit(0), async (err) => {
      console.error(err)
      try { const img = await win.webContents.capturePage(); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'capture-error.png'), img.toPNG()) } catch (e) { /* closing */ }
      app.exit(1)
    })
  })
})

async function run(win) {
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
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false })

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
    focus(sel, text) { const el = this.find(sel, text); el.focus(); el.select && el.select(); return true },
    cursor(on) {
      let c = document.getElementById('__cap_cursor')
      if (!on) { if (c) c.remove(); return }
      if (c) return
      c = document.createElement('div')
      c.id = '__cap_cursor'
      c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(760px,520px);transition:transform .55s cubic-bezier(.25,.8,.25,1)'
      c.innerHTML = '<span style="position:absolute;left:-14px;top:-14px;width:28px;height:28px;border:2px solid #fff;opacity:0;transform:scale(.4)"></span>'
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
    await evaluate(`__cap.focus(${JSON.stringify(sel)}, ${JSON.stringify(text ?? null)})`)
    await type(value, perChar)
  }
  async function key(k, code) {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code })
    if (k === 'Enter') await send('Input.dispatchKeyEvent', { type: 'char', key: k, text: '\r', unmodifiedText: '\r' })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code })
  }
  async function shot(name, { park = true } = {}) {
    if (park) await mouse('mouseMoved', W - 4, 70, { button: 'none' })
    await sleep(450)
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(path.join(OUT, name), Buffer.from(data, 'base64'))
    console.log('saved', path.join(OUT, name))
  }
  const slot = (label, wait = 650) => click('.hb-slot', label, wait)
  const waitFor = async (expr, ms = 10000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) { if (await evaluate(expr)) return; await sleep(100) }
    throw new Error('timed out waiting for ' + expr)
  }
  // Hide the replies already shown (hidden, not removed: React owns those nodes).
  const quiet = () => evaluate(`document.querySelectorAll('.feed-line').forEach(e => { e.style.visibility = 'hidden' }); true`)

  async function film(fn) {
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
    await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 })
    filming.on = true
    await sleep(900)
    await fn()
    filming.on = false
    await send('Page.stopScreencast')
    await sleep(300)
    fs.writeFileSync(path.join(FRAMES, 'frames.json'), JSON.stringify(stamps, null, 1))
    console.log('frames', stamps.length, '->', FRAMES)
  }

  await waitFor(`!!document.querySelector('.hotbar')`)
  await sleep(900)

  if (LIVE) {
    // A look at the real app against whatever runs on this PC; nothing is clicked in a world.
    await sleep(5000)
    await shot('live-start.png')
    for (const s of ['Güçler', 'Eşyalar', 'Işınlanma', 'Dünya', 'Oyuncular', 'Konsol']) { await slot(s, 2500); await shot(`live-${s}.png`) }
    await click('.switch', null, 700)
    await shot('live-menu.png')
    return
  }

  if (SCENE === 'stills') {
    const theme = arg('theme', 'obsidian')
    const sfx = theme === 'obsidian' ? '' : '-' + theme
    await click('.who-row', 'Alex', 700)
    await click('.mode-card', 'Yaratıcı', 300)
    await click('.power', 'Ölümsüzlük', 300)
    await click('.power', 'Hız', 300)
    await click('.power', 'Gece görüşü', 900)
    await shot(`powers${sfx}.png`)
    if (sfx) return

    await quiet()
    await slot('Eşyalar')
    await click('.item', 'Elmas aletler', 250)
    await click('.item', 'Elytra ve roket', 250)
    await fill('.search input', null, 'netherit')
    await sleep(500)
    await click('.result', 'Netherit Külçesi', 700)
    await shot('items.png')

    await quiet()
    await slot('Işınlanma')
    await fill('.card input', null, 'Maden girişi')
    await click('.btn', 'Kaydet', 400)
    await click('.place .btn', 'Git', 800)
    await shot('teleport.png')

    await quiet()
    await slot('Dünya', 1200)
    await click('.tile', 'Akşam', 300)
    await click('.rule .lever', null, 300)
    await click('.tile', 'Yağmur', 900)
    await shot('world.png')

    await quiet()
    await slot('Oyuncular', 900)
    await fill('.field input', null, 'Sunucu 10 dakika sonra yeniden başlıyor')
    await click('.btn', 'Gönder', 600)
    await shot('players.png')

    await quiet()
    await slot('Konsol', 700)
    for (const c of ['seed', 'locate structure minecraft:village_plains', 'give {t} minecraft:spyglass']) {
      await fill('.cmdline input', null, c)
      await key('Enter', 13)
      await sleep(300)
    }
    await fill('.cmdline input', null, 'weather clear')
    await shot('console.png')

    await quiet()
    await slot('Güçler', 500)
    await click('.switch', null, 800)
    await shot('switch.png')
    return
  }

  if (SCENE === 'chatstill') {
    await click('.mode-card', 'Yaratıcı', 1500)
    await click('.power', 'Gece görüşü', 1500)
    await click('.power', 'Zıplama', 1800)
    await shot('single.png')
    return
  }

  if (SCENE === 'gates') {
    await sleep(600)
    await shot(`gate-${process.env.SWEAXBEACON_DEMO}.png`)
    return
  }

  if (SCENE === 'tour') {
    await film(async () => {
      await click('.who-row', 'Alex', 600)
      await click('.mode-card', 'Yaratıcı', 700)
      await click('.power', 'Hız', 600)
      await click('.power', 'Gece görüşü', 600)
      await click('.power', 'Ölümsüzlük', 1000)
      await slot('Eşyalar', 700)
      await click('.item', 'Netherite takım', 900)
      await click('.search input', null, 200)
      await type('elmas', 110)
      await sleep(500)
      await click('.result', 'Elmas Bloğu', 900)
      await slot('Dünya', 1000)
      await click('.tile', 'Gece', 1200)
      await click('.tile', 'Sabah', 1000)
      await click('.rule .lever', null, 900)
      await slot('Işınlanma', 800)
      await click('.place .btn', 'Git', 1400)
    })
    return
  }

  if (SCENE === 'single') {
    await film(async () => {
      await sleep(400)
      await click('.mode-card', 'Yaratıcı', 1700)
      await click('.power', 'Gece görüşü', 1500)
      await click('.power', 'Zıplama', 1500)
      await slot('Dünya', 900)
      await click('.tile', 'Öğle', 1500)
      await click('.tile', 'Açık', 1500)
      await slot('Işınlanma', 900)
      await click('.action', 'Yüzeye çık', 1900)
    })
    return
  }

  if (SCENE === 'setup') {
    await film(async () => {
      await sleep(900)
      await click('.btn', 'RCON', 4600)
      await waitFor(`!!document.querySelector('.power')`, 9000)
      await sleep(600)
      await click('.who-row', 'Deniz', 600)
      await click('.power', 'Kazma hızı', 1400)
    })
  }
}

require(path.join(ROOT, 'electron', 'main.cjs'))
