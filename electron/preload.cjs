'use strict'

const { contextBridge, ipcRenderer } = require('electron')

const listeners = new Map()
function on(channel, cb) {
  const wrapped = (e, data) => cb(data)
  if (!listeners.has(channel)) listeners.set(channel, [])
  listeners.get(channel).push(wrapped)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

contextBridge.exposeInMainWorld('sweax', {
  connect: (opts) => ipcRenderer.invoke('rcon:connect', opts),
  command: (cmd) => ipcRenderer.invoke('rcon:command', cmd),
  disconnect: () => ipcRenderer.invoke('rcon:disconnect'),
  status: () => ipcRenderer.invoke('rcon:status'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  winControl: (action) => ipcRenderer.send('window:control', action),
  onClosed: (cb) => on('rcon:closed', cb),
})
