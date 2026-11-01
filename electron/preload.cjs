'use strict'

const { contextBridge, ipcRenderer } = require('electron')

function on(channel, cb) {
  const wrapped = (e, data) => cb(data)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

contextBridge.exposeInMainWorld('beacon', {
  get: () => ipcRenderer.invoke('app:get'),
  select: (key) => ipcRenderer.invoke('target:select', key),
  rescan: () => ipcRenderer.invoke('target:rescan'),
  enableRcon: (key) => ipcRenderer.invoke('target:enableRcon', key),
  start: (key) => ipcRenderer.invoke('target:start', key),
  acceptEula: (key) => ipcRenderer.invoke('target:acceptEula', key),
  openFolder: (key) => ipcRenderer.invoke('target:openFolder', key),
  addFolder: () => ipcRenderer.invoke('target:addFolder'),
  addRemote: (r) => ipcRenderer.invoke('target:addRemote', r),
  forget: (key) => ipcRenderer.invoke('target:forget', key),
  run: (cmds) => ipcRenderer.invoke('run', cmds),
  query: (cmd) => ipcRenderer.invoke('query', cmd),
  itemNames: () => ipcRenderer.invoke('items:names'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
  winControl: (action) => ipcRenderer.send('window:control', action),
  onTargets: (cb) => on('targets', cb),
  onLink: (cb) => on('link', cb),
  onChat: (cb) => on('chat', cb),
  onWindow: (cb) => on('window', cb),
})
