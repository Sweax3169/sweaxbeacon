import React, { useState } from 'react'
import { Px, Face } from '../pixel/Pixel.jsx'
import { dayClock, dayPart } from '../util.js'
import { DIFFICULTY, MODES, WEATHER } from '../data/catalog.js'

function Who({ sel, label, sub, face, icon, on, onClick }) {
  return (
    <button className={`who-row ${on ? 'on' : ''}`} onClick={onClick}>
      {face ? <Face name={face} size={30} /> : <Px name={icon} size={30} />}
      <span style={{ minWidth: 0 }}><b>{label}</b><span>{sub}</span></span>
      <span />
    </button>
  )
}

export default function Rail({ mode, status, game, players, selector, setWho, ws, target }) {
  const [typed, setTyped] = useState('')
  const ready = status === 'ready' || status === 'cheats'
  const list = []
  if (mode === 'chat') {
    const me = (game && game.username) || 'Sen'
    list.push({ sel: '@s', label: 'Sen', sub: me, face: me })
    if (game && game.where !== 'single') list.push({ sel: '@a', label: 'Herkes', sub: 'Dünyadaki tüm oyuncular', icon: 'players' })
  } else if (mode === 'rcon') {
    for (const p of players) list.push({ sel: p, label: p, sub: 'Çevrimiçi', face: p })
    list.push({ sel: '@a', label: 'Herkes', sub: players.length ? `${players.length} oyuncu` : 'Şu an kimse yok', icon: 'players' })
  }
  if (selector && !list.some(x => x.sel === selector) && !selector.startsWith('@')) list.unshift({ sel: selector, label: selector, sub: 'Elle yazıldı', face: selector })

  const add = (e) => { e.preventDefault(); const n = typed.trim(); if (n) { setWho(n); setTyped('') } }
  const weather = WEATHER.find(w => w.id === ws.weather)
  const diff = DIFFICULTY.find(d => d.id === ws.difficulty)
  const gm = MODES.find(m => m.id === ws.gamemode)

  return (
    <aside className="rail">
      <section>
        <h3>Kime</h3>
        {ready ? (
          <>
            <div className="who-list">
              {list.map(x => <Who key={x.sel} {...x} on={selector === x.sel} onClick={() => setWho(x.sel)} />)}
            </div>
            <form className="who-add" onSubmit={add}>
              <input className="input" value={typed} onChange={e => setTyped(e.target.value)} placeholder="Oyuncu adı yaz" spellCheck={false} />
              <button className="btn small" disabled={!typed.trim()}>Seç</button>
            </form>
          </>
        ) : <div className="rail-note">Bir dünya hazır olunca oyuncular burada.</div>}
      </section>

      {ready && (
        <section>
          <h3>Dünya</h3>
          <div className="facts">
            <div className="fact"><Px name={ws.dayTime != null && ws.dayTime >= 13000 && ws.dayTime < 23000 ? 'moon' : 'sun'} size={20} /><span>{ws.dayTime != null ? dayPart(ws.dayTime) : 'Saat'}</span><b className="num">{ws.dayTime != null ? dayClock(ws.dayTime) : '–'}</b></div>
            {mode === 'chat' && <div className="fact"><Px name={weather ? weather.icon : 'cloud'} size={20} /><span>Hava</span><b>{weather ? weather.label : '–'}</b></div>}
            <div className="fact"><Px name={diff ? diff.icon : 'sword_iron'} size={20} /><span>Zorluk</span><b>{diff ? diff.label : '–'}</b></div>
            {ws.self && gm && <div className="fact"><Px name={gm.icon} size={20} /><span>Oyun modu</span><b>{gm.label}</b></div>}
            {ws.self && ws.pos && <div className="fact"><Px name="compass" size={20} /><span>Konum</span><b className="num">{ws.pos.map(n => Math.round(n)).join('  ')}</b></div>}
            {mode === 'rcon' && <div className="fact"><Px name="players" size={20} /><span>Çevrimiçi</span><b className="num">{players.length}{target && target.max ? ` / ${target.max}` : ''}</b></div>}
          </div>
        </section>
      )}

      <div className="rail-note">
        {mode === 'rcon' && <>Komutlar sunucunun <b>uzaktan konsoluna (RCON)</b> gidiyor; yanıtlar birebir geliyor.</>}
        {mode === 'chat' && <>Komutlar arka plandaki <b>oyun penceresinin sohbetine</b> yazılıyor; oyun öne gelmiyor, fareye dokunulmuyor.</>}
      </div>
    </aside>
  )
}
