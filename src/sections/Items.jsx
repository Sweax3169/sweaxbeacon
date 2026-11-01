import React, { useEffect, useMemo, useState } from 'react'
import { Px, iconUrl } from '../pixel/Pixel.jsx'
import { KITS } from '../data/catalog.js'
import ALL_ITEMS from '../data/items.json'
import { api } from '../util.js'
import { Head } from './common.jsx'

const AMOUNTS = [1, 16, 32, 64]

// Turkish-insensitive matching: "kilic" finds "kılıç".
const fold = (s) => String(s).toLocaleLowerCase('tr-TR')
  .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')

const pretty = (id) => id.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())

function iconForItem(id) {
  const m = /^(wooden|stone|iron|golden|diamond|netherite)_(sword|pickaxe)$/.exec(id)
  if (m) {
    const mat = { wooden: 'wood', stone: 'iron', iron: 'iron', golden: 'gold', diamond: 'diamond', netherite: 'netherite' }[m[1]]
    if (m[2] === 'sword') return 'sword_' + mat
    if (mat === 'diamond' || mat === 'gold') return 'pickaxe_' + mat
  }
  const direct = {
    golden_apple: 'apple_golden', enchanted_golden_apple: 'apple_enchanted', ender_pearl: 'ender_pearl', ender_eye: 'ender_eye',
    totem_of_undying: 'totem', elytra: 'elytra', firework_rocket: 'firework', tnt: 'tnt', obsidian: 'block_obsidian',
    command_block: 'block_command', stone: 'block_stone', bricks: 'bricks', chest: 'chest', compass: 'compass', clock: 'clock',
    map: 'map', filled_map: 'map', torch: 'torch', bow: 'bow', milk_bucket: 'bucket_milk', feather: 'feather',
    cooked_beef: 'steak', experience_bottle: 'xp_bottle', lever: 'lever', beacon: 'beacon', grass_block: 'block_grass',
    diamond_chestplate: 'chestplate_diamond', netherite_chestplate: 'netherite_set', shield: 'shield', potion: 'potion_powers',
    splash_potion: 'potion_strength', lingering_potion: 'potion_regeneration', wooden_axe: 'axe_wood', poppy: 'flower',
    skeleton_skull: 'skull', player_head: 'player',
  }
  if (direct[id]) return direct[id]
  if (/_bed$/.test(id)) return 'bed'
  return null
}

export default function Items({ run }) {
  const [names, setNames] = useState({})
  const [q, setQ] = useState('')
  const [amount, setAmount] = useState(64)
  const [custom, setCustom] = useState('')
  const [popped, setPopped] = useState({})

  useEffect(() => { api().itemNames().then(r => r && r.names && setNames(r.names)).catch(() => {}) }, [])

  const results = useMemo(() => {
    const needle = fold(q.trim())
    if (!needle) return []
    const out = []
    for (const id of ALL_ITEMS) {
      const tr = names[id] || ''
      const hay = fold(id.replace(/_/g, ' ') + ' ' + tr)
      if (hay.includes(needle) || id.includes(needle.replace(/\s+/g, '_'))) out.push({ id, name: tr || pretty(id) })
      if (out.length >= 60) break
    }
    out.sort((a, b) => (fold(a.name).startsWith(needle) ? 0 : 1) - (fold(b.name).startsWith(needle) ? 0 : 1))
    return out
  }, [q, names])

  const n = Math.max(1, Math.min(6400, parseInt(custom, 10) || amount))
  const pop = (key, text) => {
    setPopped(p => ({ ...p, [key]: { n: (p[key] && p[key].n || 0) + 1, text } }))
  }

  return (
    <>
      <Head title="Eşyalar">Hazır bir set seç ya da istediğin eşyayı ara. Eşyalar seçtiğin oyuncunun envanterine gider.</Head>

      <section className="group">
        <h2>Ara</h2>
        <div className="search">
          <div className="field">
            <label>{Object.keys(names).length ? 'Türkçe ya da İngilizce ad' : 'Eşya adı ya da kodu'}</label>
            <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="ör. elmas kılıç, netherite, oak_log" spellCheck={false} />
          </div>
          <div className="field">
            <label>Adet</label>
            <div className="amounts">
              {AMOUNTS.map(a => <button key={a} className={!custom && amount === a ? 'on' : ''} onClick={() => { setAmount(a); setCustom('') }}>{a}</button>)}
              <input className="input num" style={{ width: 74 }} value={custom} onChange={e => setCustom(e.target.value.replace(/\D/g, ''))} placeholder="…" />
            </div>
          </div>
        </div>
        {q.trim() && (
          <div className="results">
            {results.map(r => {
              const icon = iconForItem(r.id)
              const p = popped['r:' + r.id]
              return (
                <button key={r.id} className="result" onClick={() => { pop('r:' + r.id, '+' + n); run(r.name, (t) => [`give ${t} minecraft:${r.id} ${n}`]) }}>
                  <span className="slot">{icon && iconUrl(icon) ? <Px name={icon} size={24} /> : r.name.slice(0, 1).toLocaleUpperCase('tr-TR')}</span>
                  <span style={{ minWidth: 0 }}><b>{r.name}</b><span>{r.id}</span></span>
                  <em>+{n}</em>
                  {p && <span className="floater" key={p.n}>{p.text}</span>}
                </button>
              )
            })}
            {!results.length && <div className="empty">Eşleşen eşya yok.</div>}
          </div>
        )}
      </section>

      <section className="group">
        <h2>Hazır setler</h2>
        <div className="inv">
          {KITS.map((k, i) => {
            const p = popped['k' + i]
            return (
              <button key={k.label} className={`item ${p ? 'pop' : ''}`} onClick={() => { pop('k' + i, k.count > 1 ? '+' + k.count : '+1'); run(k.label, k.cmds) }}>
                <span className="slot" key={p ? p.n : 0}>
                  <Px name={k.icon} size={36} />
                  {k.count > 1 && <span className="count">{k.count}</span>}
                </span>
                <b>{k.label}</b>
                {p && <span className="floater" key={'f' + p.n}>{p.text}</span>}
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}
