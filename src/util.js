export function applyTarget(cmd, target) {
  return cmd.replace(/\{t\}/g, target || '')
}

// "There are 2 of a max of 5 players online: Alice, Bob" -> ['Alice','Bob']
export function parsePlayers(resp) {
  if (!resp) return []
  const idx = resp.indexOf(':')
  if (idx < 0) return []
  const tail = resp.slice(idx + 1).trim()
  if (!tail) return []
  return tail.split(',').map(s => s.trim()).filter(Boolean)
}

// RCON yanıtlarındaki § renk kodlarını temizle
export function cleanResponse(s) {
  return String(s == null ? '' : s).replace(/§[0-9a-fk-or]/gi, '').trim()
}

export function nowClock() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

let idc = 1
export function nextId() { return 'i' + (idc++) }
