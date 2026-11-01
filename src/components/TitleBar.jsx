import React, { useState, useEffect, useRef } from 'react'
import { api } from '../util.js'
import { Px } from '../pixel/Pixel.jsx'
import Logo from './Logo.jsx'
import { statusOf, toneClass, iconFor, titleOf, subOf } from './targets.js'

function TargetIcon({ t, size = 24 }) {
  if (t && t.icon) return <img src={t.icon} width={size} height={size} alt="" style={{ imageRendering: 'pixelated' }} />
  return <Px name={iconFor(t)} size={size} />
}

function Menu({ link, targets, scanning, onClose, onAddRemote }) {
  const groups = [
    { title: 'Oyun', list: targets.filter(t => t.kind === 'game') },
    { title: 'Bu bilgisayardaki sunucular', list: targets.filter(t => t.kind === 'server') },
    { title: 'Uzak sunucular', list: targets.filter(t => t.kind === 'remote') },
  ].filter(g => g.list.length)
  const pick = async (t) => { onClose(); await api().select(t.key) }
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="menu">
        {!groups.length && <div className="empty">{scanning ? 'Bilgisayarın taranıyor…' : 'Henüz bir Minecraft dünyası bulunamadı.'}</div>}
        {groups.map(g => (
          <div key={g.title}>
            <h4>{g.title}</h4>
            {g.list.map(t => {
              const st = statusOf(link && link.key === t.key ? link.status : t.status)
              return (
                <button key={t.key} className={`menu-item ${link && link.key === t.key ? 'on' : ''}`} onClick={() => pick(t)}>
                  <span className="slot"><TargetIcon t={t} size={26} /></span>
                  <span style={{ minWidth: 0 }}>
                    <b>{titleOf(t, link && link.key === t.key ? link.game : null)}</b>
                    <span>{subOf(t, link && link.key === t.key ? link.game : null)}</span>
                  </span>
                  <span className={`state ${toneClass(st.tone)}`}><i />{st.text}</span>
                </button>
              )
            })}
          </div>
        ))}
        <div className="menu-foot">
          <button className="btn small" onClick={() => { api().rescan() }}><Px name="compass" size={18} />Yeniden tara</button>
          <button className="btn small" onClick={() => { onClose(); api().addFolder() }}><Px name="chest" size={18} />Sunucu klasörü ekle</button>
          <button className="btn small" onClick={() => { onClose(); onAddRemote() }}><Px name="ender_pearl" size={18} />Uzak sunucu ekle</button>
        </div>
      </div>
    </>
  )
}

export default function TitleBar({ link, targets, scanning, pulse, busy, onAddRemote }) {
  const [open, setOpen] = useState(false)
  const [pulsing, setPulsing] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setPulsing(false)
    const a = requestAnimationFrame(() => setPulsing(true))
    const t = setTimeout(() => setPulsing(false), 800)
    return () => { cancelAnimationFrame(a); clearTimeout(t) }
  }, [pulse])

  const t = link && link.target
  const st = link ? statusOf(link.status) : { tone: scanning ? 'wait' : 'idle', text: scanning ? 'Aranıyor' : '' }
  const name = link ? titleOf(t, link.game) : scanning ? 'Dünyalar aranıyor…' : 'Dünya bulunamadı'
  const sub = link ? subOf(t, link.game) : scanning ? 'Sunucular ve açık oyunlar taranıyor' : 'Minecraft’ı ya da sunucunu aç'

  return (
    <div className="titlebar">
      <div className="brand">
        <Logo size={24} lit={!!(link && (link.status === 'ready' || link.status === 'cheats'))} />
        <span className="brand-name">Sweax<b>Beacon</b></span>
      </div>
      <button className={`switch ${open ? 'open' : ''} ${pulsing ? 'pulse' : ''}`} data-tone={busy ? 'wait' : st.tone} onClick={() => setOpen(o => !o)}>
        <span className="lamp" />
        <span className="icon"><TargetIcon t={t} /></span>
        <span className="who"><b>{name}</b><span>{sub}</span></span>
        {link && link.mode ? <span className={`mode ${link.mode}`}>{link.mode === 'rcon' ? 'RCON' : 'Oyun içi'}</span> : link ? <span className="mode">{st.text}</span> : <span />}
        <svg className="chev" width="12" height="12" viewBox="0 0 12 12" shapeRendering="crispEdges"><path d="M1 3h2v2H1zM3 5h2v2H3zM5 7h2v2H5zM7 5h2v2H7zM9 3h2v2H9z" fill="currentColor" /></svg>
      </button>
      <div className="win">
        <button onClick={() => api().winControl('minimize')} title="Küçült">
          <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1" y="5" width="9" height="1.4" fill="currentColor" /></svg>
        </button>
        <button onClick={() => api().winControl('maximize')} title="Büyüt">
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
        </button>
        <button className="close" onClick={() => api().winControl('close')} title="Kapat">
          <svg width="11" height="11" viewBox="0 0 11 11"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.3" /></svg>
        </button>
      </div>
      {open && <Menu link={link} targets={targets} scanning={scanning} onClose={() => setOpen(false)} onAddRemote={onAddRemote} />}
    </div>
  )
}
