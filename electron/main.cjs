'use strict'

// SweaxBeacon main process.
//
// Finds every Minecraft world it can reach on this PC (sessions.cjs keeps the
// list fresh), picks one, and keeps one link open to it: RCON for a server,
// the game's chat for single-player, LAN and servers where the player is an
// operator. The window only asks for something when nothing else can work.

const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, nativeTheme } = require('electron')
const path = require('path')
const fs = require('fs')
const { Sessions } = require('./sessions.cjs')
const helper = require('./sys/helper.cjs')
const { itemNames } = require('./mc/names.cjs')

let win = null
let sessions = null

// ------------------------------------------------------------------ settings

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json')

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) } catch (e) { return {} }
}

let settings = {}
let saveTimer = null
function saveSettings() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(settingsFile()), { recursive: true })
      fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), 'utf8')
    } catch (e) { /* read-only profile */ }
  }, 200)
}

// Passwords of remote servers are kept encrypted for this Windows account.
const secret = {
  seal: (text) => {
    try { if (safeStorage.isEncryptionAvailable()) return 'dpapi:' + safeStorage.encryptString(text).toString('base64') } catch (e) { /* fall through */ }
    return 'plain:' + Buffer.from(text, 'utf8').toString('base64')
  },
  open: (sealed) => {
    if (!sealed) return ''
    try {
      if (sealed.startsWith('dpapi:')) return safeStorage.decryptString(Buffer.from(sealed.slice(6), 'base64'))
      if (sealed.startsWith('plain:')) return Buffer.from(sealed.slice(6), 'base64').toString('utf8')
    } catch (e) { /* another account */ }
    return ''
  },
}

// ------------------------------------------------------------------ window

const BG = { obsidian: '#0C0A10', quartz: '#ECE8E1' }
// SWEAXBEACON_DEMO=chat|server|none opens the interface on its built-in demo
// worlds instead of the real ones (tools/media/capture.cjs records it that way).
const DEMO = process.env.SWEAXBEACON_DEMO || ''

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    frame: false,
    show: false,
    backgroundColor: BG[settings.theme] || BG.obsidian,
    title: 'SweaxBeacon',
    webPreferences: {
      preload: DEMO ? undefined : path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  win.once('ready-to-show', () => win.show())
  win.on('maximize', () => send('window', { maximized: true }))
  win.on('unmaximize', () => send('window', { maximized: false }))
  if (process.env.SWEAXBEACON_DEV_URL) win.loadURL(process.env.SWEAXBEACON_DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), DEMO ? { query: { demo: DEMO, theme: process.env.SWEAXBEACON_THEME || 'obsidian' } } : undefined)
}

function send(channel, data) {
  try { if (win && !win.webContents.isDestroyed()) win.webContents.send(channel, data) } catch (e) { /* closing */ }
}

// ------------------------------------------------------------------ IPC

function publicSettings() {
  return {
    theme: settings.theme || 'obsidian',
    waypoints: settings.waypoints || {},
    systemDark: nativeTheme.shouldUseDarkColors,
  }
}

function wire() {
  const handle = (ch, fn) => ipcMain.handle(ch, async (e, ...args) => {
    try { return await fn(...args) } catch (err) { return { ok: false, error: err.code || err.message || String(err) } }
  })

  handle('app:get', () => ({ version: app.getVersion(), settings: publicSettings(), ...sessions.view() }))
  handle('target:select', (key) => sessions.select(key, { manual: true }))
  handle('target:rescan', () => sessions.rescan({ disk: true }))
  handle('target:enableRcon', (key) => sessions.enableRcon(key))
  handle('target:start', (key) => sessions.start(key))
  handle('target:acceptEula', (key) => sessions.acceptEula(key))
  handle('target:openFolder', (key) => {
    const t = sessions.find(key)
    if (t && (t.dir || t.gameDir)) shell.openPath(t.dir || t.gameDir)
    return { ok: true }
  })
  handle('target:addFolder', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Sunucu klasörünü seç', properties: ['openDirectory'] })
    if (r.canceled || !r.filePaths[0]) return { ok: false, error: 'canceled' }
    return sessions.addFolder(r.filePaths[0])
  })
  handle('target:addRemote', (r) => sessions.addRemote(r))
  handle('target:forget', (key) => sessions.forget(key))
  let names = null
  handle('items:names', () => names || (names = itemNames({ games: [...sessions.games.values()] })))
  handle('run', (cmds) => sessions.run(cmds))
  handle('query', (cmd) => sessions.query(cmd))
  handle('settings:set', (patch) => {
    for (const k of ['theme', 'waypoints']) if (k in patch) settings[k] = patch[k]
    saveSettings()
    if ('theme' in patch && win) win.setBackgroundColor(BG[patch.theme] || BG.obsidian)
    return publicSettings()
  })
  handle('open:external', (url) => {
    if (/^https:\/\/(www\.)?(minecraft\.net|aka\.ms|github\.com|sweax3169\.github\.io)\//.test(String(url))) shell.openExternal(url)
    return { ok: true }
  })
  ipcMain.on('window:control', (e, action) => {
    if (!win) return
    if (action === 'minimize') win.minimize()
    else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize()
    else if (action === 'close') win.close()
  })
}

// ------------------------------------------------------------------ life cycle

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
  app.whenReady().then(() => {
    settings = loadSettings()
    if (DEMO) { createWindow(); return }
    sessions = new Sessions({ settings, save: saveSettings, secret, emit: send })
    wire()
    createWindow()
    sessions.startWatching()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  })
  app.on('window-all-closed', () => {
    if (sessions) sessions.stop()
    helper.stop()
    app.quit()
  })
}
