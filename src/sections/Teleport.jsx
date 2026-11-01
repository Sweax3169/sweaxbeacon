import React, { useState } from 'react'
import { Px, Face } from '../pixel/Pixel.jsx'
import { QUICK_MOVES } from '../data/catalog.js'
import { nextId, parsePos } from '../util.js'
import { Head } from './common.jsx'

const DIM = { overworld: 'Dünya', the_nether: 'Nether', the_end: 'End' }
const DIM_ICON = { overworld: 'block_grass', the_nether: 'block_obsidian', the_end: 'ender_eye' }
const r = (n) => Math.round(n * 10) / 10

export default function Teleport({ run, ws, link, settings, saveSettings, players, selector, mode }) {
  const [x, setX] = useState('')
  const [y, setY] = useState('')
  const [z, setZ] = useState('')
  const [name, setName] = useState('')
  const [dest, setDest] = useState('')
  const [asked, setAsked] = useState(null)
  const key = link ? link.key : 'none'
  const places = (settings.waypoints && settings.waypoints[key]) || []
  const pos = ws.self && ws.pos ? ws.pos : asked
  const dim = ws.self ? (ws.dimension || 'overworld') : 'overworld'

  const savePlaces = (list) => saveSettings({ waypoints: { ...(settings.waypoints || {}), [key]: list } })
  const ask = async () => {
    const res = await run('Konumum', (t) => [`data get entity ${t} Pos`], { silent: true })
    const p = res && res.ok && res.results[0] && parsePos(res.results[0].resp)
    if (p) setAsked(p)
  }
  const keep = () => {
    if (!pos) return
    const label = name.trim() || `Yer ${places.length + 1}`
    savePlaces([...places, { id: nextId() + Date.now(), name: label, x: r(pos[0]), y: r(pos[1]), z: r(pos[2]), dim }])
    setName('')
  }
  const go = (p) => run(p.name, (t) => [`execute in minecraft:${p.dim || 'overworld'} run tp ${t} ${p.x} ${p.y} ${p.z}`])
  const fill = (p) => { setX(String(Math.round(p[0]))); setY(String(Math.round(p[1]))); setZ(String(Math.round(p[2]))) }
  const valid = [x, y, z].every(v => v.trim() !== '' && !isNaN(Number(v)))

  return (
    <>
      <Head title="Işınlanma">Kaydettiğin yerlere, koordinatlara ya da başka bir oyuncunun yanına git.</Head>

      <div className="split">
        <section className="card block">
          <h3>Şu an buradasın
            {!(ws.self && ws.pos) && <button className="btn small" onClick={ask}>Konumu sor</button>}
          </h3>
          {pos ? (
            <div className="here">
              <span className="coord"><span>X</span><b>{Math.round(pos[0])}</b></span>
              <span className="coord"><span>Y</span><b>{Math.round(pos[1])}</b></span>
              <span className="coord"><span>Z</span><b>{Math.round(pos[2])}</b></span>
              <span className="state"><Px name={DIM_ICON[dim] || 'block_grass'} size={18} />{DIM[dim] || dim}</span>
            </div>
          ) : <div className="empty">{mode === 'rcon' ? 'Tek bir oyuncu seçince konumu burada.' : 'Konum, oyun bir sonraki duraklamada kaydedince burada.'}</div>}
          <div className="row" style={{ marginTop: 14 }}>
            <div className="field grow"><label>Bu yere bir ad ver</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ev, köy, maden…" onKeyDown={e => e.key === 'Enter' && keep()} /></div>
            <button className="btn primary" disabled={!pos} onClick={keep}><Px name="bed" size={18} />Kaydet</button>
          </div>
        </section>

        <section className="card block">
          <h3>Kayıtlı yerler <small className="state">{places.length ? `${places.length} yer` : ''}</small></h3>
          <div className="places">
            {places.map(p => (
              <div className="place" key={p.id}>
                <Px name={DIM_ICON[p.dim] || 'block_grass'} size={22} />
                <span><b>{p.name}</b><span>{Math.round(p.x)} {Math.round(p.y)} {Math.round(p.z)}</span></span>
                <button className="btn small primary" onClick={() => go(p)}>Git</button>
                <button className="btn small ghost" onClick={() => savePlaces(places.filter(q => q.id !== p.id))} title="Sil">✕</button>
              </div>
            ))}
            {!places.length && <div className="empty">Henüz kayıtlı yer yok. Bulunduğun yeri soldan kaydet.</div>}
          </div>
        </section>
      </div>

      <section className="group" style={{ marginTop: 26 }}>
        <h2>Koordinata git</h2>
        <div className="row">
          {[['X', x, setX], ['Y', y, setY], ['Z', z, setZ]].map(([l, v, s]) => (
            <div className="field" key={l} style={{ width: 120 }}><label>{l}</label><input className="input num" value={v} onChange={e => s(e.target.value)} placeholder="0" /></div>
          ))}
          <button className="btn primary" disabled={!valid} onClick={() => run('Işınlan', (t) => [`execute as ${t} run tp @s ${Number(x)} ${Number(y)} ${Number(z)}`])}><Px name="ender_pearl" size={18} />Işınla</button>
          {pos && <button className="btn ghost" onClick={() => fill(pos)}>Konumumu yaz</button>}
          {ws.spawn && <button className="btn ghost" onClick={() => run('Doğuş noktası', (t) => [`execute in minecraft:overworld run tp ${t} ${ws.spawn[0]} ${ws.spawn[1]} ${ws.spawn[2]}`])}><Px name="bed" size={18} />Doğuş noktasına</button>}
        </div>
      </section>

      <section className="group">
        <h2>Kurtul</h2>
        <div className="actions">
          {QUICK_MOVES.map(m => <button key={m.label} className="action" onClick={() => run(m.label, m.cmds)}><span className="slot"><Px name={m.icon} size={24} /></span>{m.label}</button>)}
        </div>
      </section>

      {(players.length > 0 || mode === 'chat') && (
        <section className="group">
          <h2>Oyuncuya git</h2>
          <div className="row">
            {players.filter(p => p !== selector).map(p => (
              <button key={p} className="action" onClick={() => run(`${p} yanına`, (t) => [`tp ${t} ${p}`])}><span className="slot"><Face name={p} size={24} /></span>{p}</button>
            ))}
            <div className="field" style={{ width: 220 }}><label>Oyuncu adı</label><input className="input" value={dest} onChange={e => setDest(e.target.value)} placeholder="Alex" spellCheck={false} /></div>
            <button className="btn" disabled={!dest.trim()} onClick={() => run(`${dest.trim()} yanına`, (t) => [`tp ${t} ${dest.trim()}`])}>Yanına git</button>
            <button className="btn ghost" disabled={!dest.trim()} onClick={() => run(`${dest.trim()} buraya`, (t) => [`tp ${dest.trim()} ${t}`])}>Buraya getir</button>
          </div>
        </section>
      )}
    </>
  )
}
