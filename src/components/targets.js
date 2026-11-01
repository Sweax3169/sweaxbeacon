// How a target is named, drawn and described, in one place for the title bar,
// its menu and the gate.

export const STATUS = {
  ready: { tone: 'ok', text: 'Hazır' },
  cheats: { tone: 'act', text: 'Hileler kapalı' },
  connecting: { tone: 'wait', text: 'Bağlanıyor' },
  starting: { tone: 'wait', text: 'Açılıyor' },
  'rcon-off': { tone: 'act', text: 'RCON kapalı' },
  restart: { tone: 'act', text: 'Yeniden başlatılmalı' },
  stopped: { tone: 'idle', text: 'Kapalı' },
  game: { tone: 'idle', text: 'Açık' },
  saved: { tone: 'idle', text: 'Kayıtlı' },
  'not-in-world': { tone: 'act', text: 'Dünyada değil' },
  'pause-off': { tone: 'act', text: 'F3+P gerekli' },
  'no-key': { tone: 'act', text: 'Sohbet tuşu yok' },
  'no-window': { tone: 'bad', text: 'Pencere yok' },
  auth: { tone: 'bad', text: 'Şifre yanlış' },
  refused: { tone: 'bad', text: 'Ulaşılamıyor' },
  timeout: { tone: 'bad', text: 'Yanıt yok' },
  host: { tone: 'bad', text: 'Adres bulunamadı' },
  reset: { tone: 'bad', text: 'Bağlantı koptu' },
  offline: { tone: 'bad', text: 'Bağlantı yok' },
}

export const statusOf = (s) => STATUS[s] || { tone: 'bad', text: 'Bağlantı yok' }
export const toneClass = (tone) => (tone === 'ok' ? 'ok' : tone === 'act' || tone === 'wait' ? 'act' : tone === 'bad' ? 'bad' : '')

export function iconFor(t) {
  if (!t) return 'beacon'
  if (t.kind === 'game') return t.where === 'server' ? 'compass' : 'block_grass'
  if (t.kind === 'remote') return 'compass'
  return t.running ? 'block_command' : 'block_stone'
}

export function titleOf(t, game) {
  if (!t) return 'Dünya seçilmedi'
  if (t.kind === 'game') {
    const w = (game && game.world) || t.world
    if (t.where === 'server' || (game && game.where === 'server')) return 'Sunucuda: ' + ((game && game.server) || t.server || '')
    if (w && w.name) return w.name
    return 'Minecraft ' + (t.version || '')
  }
  return t.name || t.folder || t.host
}

export function subOf(t, game) {
  if (!t) return ''
  if (t.kind === 'game') {
    const where = (game && game.where) || t.where
    const bits = []
    bits.push(where === 'lan' ? 'LAN dünyası' : where === 'server' ? 'Oyun içinden' : where === 'single' ? 'Tek oyunculu' : 'Oyun açık')
    bits.push(['Java', t.version, t.loader].filter(Boolean).join(' '))
    if (t.username) bits.push(t.username)
    return bits.join(' · ')
  }
  if (t.kind === 'remote') return `${t.host}:${t.port} · uzak sunucu`
  const bits = [[t.software, t.version].filter(Boolean).join(' ')]
  if (t.running && t.max) bits.push(`${t.online || 0}/${t.max} oyuncu`)
  bits.push(`port ${t.gamePort}`)
  return bits.filter(Boolean).join(' · ')
}
