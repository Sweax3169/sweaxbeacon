import React, { useLayoutEffect, useRef, useState } from 'react'
import { Px } from '../pixel/Pixel.jsx'

export const SECTIONS = [
  { key: 'powers', label: 'Güçler', icon: 'potion_powers' },
  { key: 'items', label: 'Eşyalar', icon: 'chest' },
  { key: 'teleport', label: 'Işınlanma', icon: 'ender_pearl' },
  { key: 'world', label: 'Dünya', icon: 'clock' },
  { key: 'players', label: 'Oyuncular', icon: 'players' },
  { key: 'console', label: 'Konsol', icon: 'block_command' },
  { key: 'settings', label: 'Ayarlar', icon: 'cog', gear: true },
]

// The page switcher is a hotbar: number keys pick a slot, the selection frame
// springs over to it and the slot's name shows above for a moment.
export default function Hotbar({ section, setSection, busy, mode, children }) {
  const bar = useRef(null)
  const [frame, setFrame] = useState({ x: 0, w: 110 })
  const [named, setNamed] = useState(null)
  const first = useRef(true)
  useLayoutEffect(() => {
    const el = bar.current && bar.current.querySelector(`[data-key="${section}"]`)
    if (el) setFrame({ x: el.offsetLeft - 3, w: el.offsetWidth + 6 })
    if (first.current) { first.current = false; return }
    const s = SECTIONS.find(x => x.key === section)
    setNamed({ label: s.label, n: Date.now() })
  }, [section])

  const [half, setHalf] = useState(360)
  useLayoutEffect(() => { if (bar.current) setHalf(bar.current.offsetWidth / 2) }, [])
  return (
    <div className="hotbar-row" style={{ '--hotbar-half': half + 'px' }}>
      {children}
      <div className="hotbar" ref={bar}>
        {named && <div className="hb-name" key={named.n}>{named.label}</div>}
        {SECTIONS.map((s, i) => (
          <button key={s.key} data-key={s.key} className={`hb-slot ${s.gear ? 'gear' : ''} ${section === s.key ? 'on' : ''}`} onClick={() => setSection(s.key)} title={`${s.label} (${i + 1})`}>
            <span className="key num">{i + 1}</span>
            <Px name={s.icon} size={32} />
            {!s.gear && <span className="lbl">{s.label}</span>}
          </button>
        ))}
        <div className="hb-frame" style={{ transform: `translateX(${frame.x}px)`, width: frame.w }} />
      </div>
      {busy && <div className="busy-tag"><i />{mode === 'chat' ? 'Oyuna yazılıyor' : 'Gönderiliyor'}</div>}
    </div>
  )
}
