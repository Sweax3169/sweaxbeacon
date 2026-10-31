// Tarayıcıda (Electron dışında) arayüzü denemek için sahte RCON.
export function installMockIfNeeded() {
  if (window.sweax) return
  let connected = false
  const players = ['Okan', 'Arkadas1']
  window.__MOCK__ = true
  window.sweax = {
    connect: async ({ password }) => {
      await new Promise(r => setTimeout(r, 400))
      if (password === 'yanlis') return { ok: false, message: 'RCON şifresi yanlış.' }
      connected = true
      return { ok: true }
    },
    command: async (cmd) => {
      await new Promise(r => setTimeout(r, 120))
      if (!connected) return { ok: false, message: 'Bağlantı yok.' }
      if (cmd === 'list') return { ok: true, response: `There are ${players.length} of a max of 5 players online: ${players.join(', ')}` }
      if (cmd.startsWith('gamerule ')) {
        const parts = cmd.split(' ')
        if (parts.length === 2) return { ok: true, response: `Gamerule ${parts[1]} is currently set to: true` }
        return { ok: true, response: `Gamerule ${parts[1]} is now set to: ${parts[2]}` }
      }
      return { ok: true, response: `[mock] "${cmd}" çalıştırıldı` }
    },
    disconnect: async () => { connected = false; return { ok: true } },
    status: async () => ({ connected, info: connected ? { host: 'localhost', port: 25575 } : null }),
    getSettings: async () => JSON.parse(localStorage.getItem('sweaxpanel-mock') || '{}'),
    setSettings: async (s) => { localStorage.setItem('sweaxpanel-mock', JSON.stringify(s)); return true },
    winControl: () => {},
    onClosed: () => () => {},
  }
}
