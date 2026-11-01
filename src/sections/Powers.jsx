import React, { useState } from 'react'
import { Px } from '../pixel/Pixel.jsx'
import { MODES, POWERS, GOD, INSTANT, effectOn, effectOff } from '../data/catalog.js'
import { Head, Particles, useOptimistic } from './common.jsx'
import { SELECTOR_LABEL } from '../util.js'

export default function Powers({ run, ws, selector }) {
  const [bursts, setBursts] = useState({})
  const known = !!ws.self
  const [isOn, setOn] = useOptimistic((id) => known && ws.effects.has(id))
  const [modeNow, setMode] = useOptimistic(() => (known ? ws.gamemode : null))
  const burst = (id) => setBursts(b => ({ ...b, [id]: (b[id] || 0) + 1 }))
  const who = SELECTOR_LABEL[selector] || selector

  const toggle = async (p) => {
    const on = isOn(p.id)
    setOn(p.id, !on)
    if (!on) burst(p.id)
    const r = await run(p.label, (t) => [on ? effectOff(t, p.id) : effectOn(t, p)])
    if (!r || !r.ok) setOn(p.id, on)
  }

  const godOn = GOD.effects.every(e => isOn(e.id))
  const toggleGod = async () => {
    const on = godOn
    GOD.effects.forEach(e => setOn(e.id, !on))
    if (!on) burst('god')
    await run(GOD.label, (t) => GOD.effects.map(e => (on ? effectOff(t, e.id) : effectOn(t, e))))
  }

  return (
    <>
      <Head title="Güçler">{known ? 'Açık olanlar parlıyor; tekrar basınca kapanır. Etkiler sen kapatana kadar sürer.' : `Seçtiğin oyuncuya (${who}) sonsuz süreli etki ver. Tekrar basınca kapanır.`}</Head>

      <section className="group">
        <h2>Oyun modu</h2>
        <div className="modes">
          {MODES.map(m => (
            <button key={m.id} className={`mode-card ${modeNow('x') === m.id ? 'on' : ''}`} onClick={() => { setMode('x', m.id); run(m.label, (t) => [`gamemode ${m.id} ${t}`]) }}>
              <span className="slot"><Px name={m.icon} size={36} /></span>
              <span><b>{m.label}</b><span>{m.sub}</span></span>
            </button>
          ))}
        </div>
      </section>

      <section className="group">
        <h2>Etkiler <small>{known ? 'durum oyundan okunuyor' : ''}</small></h2>
        <div className="powers">
          <button className={`power ${godOn ? 'on' : ''}`} style={{ '--fx': GOD.color }} onClick={toggleGod}>
            <span className="slot"><Px name="shield" size={32} /></span>
            <span><b>{GOD.label}</b><span>{GOD.sub}</span></span>
            <span className="pip" />
            <Particles n={bursts.god} color={GOD.color} />
          </button>
          {POWERS.map(p => (
            <button key={p.id} className={`power ${isOn(p.id) ? 'on' : ''}`} style={{ '--fx': p.color }} onClick={() => toggle(p)}>
              <span className="slot"><Px name={'potion_' + p.id} size={32} /></span>
              <span><b>{p.label}</b><span>{p.sub}</span></span>
              <span className="pip" />
              <Particles n={bursts[p.id]} color={p.color} />
            </button>
          ))}
        </div>
      </section>

      <section className="group">
        <h2>Anında</h2>
        <div className="actions">
          {INSTANT.map(a => (
            <button key={a.label} className="action" onClick={() => { run(a.label, a.cmds); if (a.icon === 'bucket_milk') POWERS.forEach(p => setOn(p.id, false)) }}>
              <span className="slot"><Px name={a.icon} size={24} /></span>{a.label}
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
