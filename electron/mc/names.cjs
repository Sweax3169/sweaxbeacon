'use strict'

// Item names in the player's language, read from their own Minecraft assets
// (the language files the launcher downloaded), so the item search understands
// "elmas kılıç". Nothing is shipped or downloaded.

const fs = require('fs')
const os = require('os')
const path = require('path')

function newestIndexWith(assetsDir, entry) {
  let best = null
  try {
    for (const f of fs.readdirSync(path.join(assetsDir, 'indexes'))) {
      if (!f.endsWith('.json')) continue
      const file = path.join(assetsDir, 'indexes', f)
      const t = fs.statSync(file).mtimeMs
      if (best && t <= best.t) continue
      try {
        const idx = JSON.parse(fs.readFileSync(file, 'utf8'))
        const o = idx.objects && idx.objects[entry]
        if (o && o.hash) best = { t, hash: o.hash }
      } catch (e) { /* broken index */ }
    }
  } catch (e) { /* no assets */ }
  return best && best.hash
}

function itemNames({ games = [], lang = 'tr_tr' } = {}) {
  const candidates = []
  for (const g of games) if (g.assetsDir) candidates.push({ dir: g.assetsDir, lang: (g.options && g.options.lang) || lang })
  const home = os.homedir()
  for (const d of [
    path.join(home, 'AppData', 'Roaming', '.minecraft', 'assets'),
    path.join(home, 'curseforge', 'minecraft', 'Install', 'assets'),
    path.join(home, 'AppData', 'Roaming', 'PrismLauncher', 'assets'),
    path.join(home, 'AppData', 'Roaming', 'ModrinthApp', 'meta', 'assets'),
  ]) candidates.push({ dir: d, lang })
  for (const c of candidates) {
    const want = String(c.lang || lang).toLowerCase()
    if (want === 'en_us') continue
    const hash = newestIndexWith(c.dir, `minecraft/lang/${want}.json`)
    if (!hash) continue
    try {
      const table = JSON.parse(fs.readFileSync(path.join(c.dir, 'objects', hash.slice(0, 2), hash), 'utf8'))
      const names = {}
      for (const [k, v] of Object.entries(table)) {
        const m = /^(?:item|block)\.minecraft\.([a-z0-9_]+)$/.exec(k)
        if (m && !names[m[1]]) names[m[1]] = v
      }
      return { lang: want, names }
    } catch (e) { /* unreadable */ }
  }
  return { lang: 'en_us', names: {} }
}

module.exports = { itemNames }
