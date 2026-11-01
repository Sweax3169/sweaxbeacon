// Small helpers shared by the pages.

export const api = () => window.beacon

let idc = 1
export const nextId = () => 'i' + (idc++)

export function clock(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

// Minecraft day time (0-24000, 0 = 06:00) as a wall clock.
export function dayClock(ticks) {
  if (ticks == null) return null
  const t = ((ticks % 24000) + 24000) % 24000
  const minutes = Math.floor(((t / 1000) + 6) * 60) % (24 * 60)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function dayPart(ticks) {
  if (ticks == null) return null
  const t = ((ticks % 24000) + 24000) % 24000
  if (t < 450 || t >= 23000) return 'Şafak'
  if (t < 11500) return 'Gündüz'
  if (t < 13000) return 'Akşam'
  return 'Gece'
}

// "There are 2 of a max of 20 players online: Alex, Steve"
export function parseList(resp) {
  if (!resp) return []
  const i = resp.indexOf(':')
  if (i < 0) return []
  return resp.slice(i + 1).split(',').map(s => s.trim()).filter(Boolean)
}

// "Alex has the following entity data: [12.5d, 64.0d, -3.2d]"
export function parsePos(resp) {
  const m = /\[\s*(-?[\d.]+)d?,\s*(-?[\d.]+)d?,\s*(-?[\d.]+)d?\s*\]/.exec(resp || '')
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

export function parseEffects(resp) {
  const out = new Set()
  for (const m of String(resp || '').matchAll(/id:\s*"minecraft:([a-z_]+)"/g)) out.add(m[1])
  return out
}

export const GAMEMODE_BY_NUMBER = ['survival', 'creative', 'adventure', 'spectator']

export const fmt = (n) => (n == null || isNaN(n) ? '–' : Math.round(n).toLocaleString('tr-TR'))

export const SELECTOR_LABEL = { '@s': 'Sen', '@a': 'Herkes', '@p': 'En yakın oyuncu' }
