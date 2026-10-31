'use strict'

// SWEAXPANEL ana süreç — Sweax Studios
// RCON bağlantısını main process'te yönetir, renderer'a IPC ile açar.

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { Rcon } = require('./rcon.cjs')

let win = null
let rcon = null
let rconInfo = null // { host, port }

const settingsFile = () => path.join(app.getPath('userData'), 'sweaxpanel-settings.json')

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) } catch (e) { return {} }
}
function saveSettings(s) {
  try { fs.writeFileSync(settingsFile(), JSON.stringify(s || {}, null, 2), 'utf8'); return true } catch (e) { return false }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1060,
    minHeight: 680,
    frame: false,
    show: false,
    backgroundColor: '#0f0a18',
    title: 'SweaxPanel',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  win.once('ready-to-show', () => win.show())
  if (process.env.SWEAXPANEL_DEV_URL) win.loadURL(process.env.SWEAXPANEL_DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

function safeSend(channel, data) {
  try { if (win && !win.webContents.isDestroyed()) win.webContents.send(channel, data) } catch (e) { /* kapandı */ }
}

// ---------------------------------------------------------------- RCON IPC

const RCON_ERR = {
  refused: 'Sunucuya ulaşılamadı — sunucu kapalı ya da RCON portu yanlış olabilir.',
  timeout: 'Bağlantı zaman aşımına uğradı — adres/port doğru mu, güvenlik duvarı engelliyor mu?',
  host: 'Sunucu adresi bulunamadı — adresi kontrol et.',
  auth: 'RCON şifresi yanlış.',
  reset: 'Bağlantı sunucu tarafından kapatıldı — RCON açık mı?',
  notconnected: 'Bağlantı yok.',
  closed: 'Bağlantı kapandı.',
}
function turkceRcon(msg) {
  return RCON_ERR[msg] || ('Beklenmeyen bağlantı hatası: ' + msg)
}

ipcMain.handle('rcon:connect', async (e, { host, port, password }) => {
  try {
    if (rcon) { rcon.destroy(); rcon = null }
    const c = new Rcon()
    c.onClose = () => { if (rcon === c) { rcon = null; rconInfo = null; safeSend('rcon:closed', {}) } }
    await c.connect(host, Number(port) || 25575, password || '', 8000)
    rcon = c
    rconInfo = { host, port: Number(port) || 25575 }
    return { ok: true }
  } catch (err) {
    return { ok: false, message: turkceRcon(String(err && err.message)) }
  }
})

ipcMain.handle('rcon:command', async (e, cmd) => {
  if (!rcon || !rcon.connected) return { ok: false, message: 'Bağlantı yok.' }
  try {
    const response = await rcon.command(String(cmd))
    return { ok: true, response }
  } catch (err) {
    return { ok: false, message: turkceRcon(String(err && err.message)) }
  }
})

ipcMain.handle('rcon:disconnect', async () => {
  if (rcon) { rcon.destroy(); rcon = null; rconInfo = null }
  return { ok: true }
})

ipcMain.handle('rcon:status', async () => ({
  connected: !!(rcon && rcon.connected),
  info: rconInfo,
}))

ipcMain.handle('settings:get', () => loadSettings())
ipcMain.handle('settings:set', (e, s) => saveSettings(s))

ipcMain.on('window:control', (e, action) => {
  if (!win) return
  if (action === 'minimize') win.minimize()
  else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize()
  else if (action === 'close') win.close()
})

// ---------------------------------------------------------------- yaşam döngüsü

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  })
  app.on('window-all-closed', () => { if (rcon) rcon.destroy(); app.quit() })
}
