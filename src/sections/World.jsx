import React, { useState } from 'react'
import { Px } from '../pixel/Pixel.jsx'
import { TIMES, WEATHER, DIFFICULTY, RULES, ruleName, ruleValue, ruleIsOn, rulesStyleFor } from '../data/catalog.js'
import { dayClock, dayPart } from '../util.js'
import { Head, useOptimistic } from './common.jsx'

// Sun and moon on one arc around the horizon; 0 ticks is sunrise, 6000 noon, 18000 midnight.
function Dial({ ticks }) {
  const t = ticks == null ? 6000 : ((ticks % 24000) + 24000) % 24000
  const a = ((t / 24000) * 360 - 90) * Math.PI / 180
  const sun = [130 + 92 * Math.sin(a), 118 - 92 * Math.cos(a)]
  const moon = [130 - 92 * Math.sin(a), 118 + 92 * Math.cos(a)]
  const night = t >= 13000 && t < 23000
  const dusk = (t >= 11500 && t < 13000) || t >= 23000 || t < 450
  return (
    <svg viewBox="0 0 260 140" shapeRendering="crispEdges">
      <rect className="sky" x="0" y="0" width="260" height="140" fill={night ? '#0d1030' : dusk ? '#5a3a6a' : '#5aa9ff'} opacity={ticks == null ? .35 : 1} />
      {night && [[30, 30], [70, 18], [200, 26], [228, 54], [150, 14], [110, 40]].map(([x, y], i) => <rect key={i} x={x} y={y} width="3" height="3" fill="#cfd6ff" />)}
      <g className="orb" style={{ transform: `translate(${sun[0] - 12}px, ${sun[1] - 12}px)` }}>
        <rect width="24" height="24" fill="#ffd83a" />
        <rect x="4" y="4" width="16" height="16" fill="#fff3a0" />
      </g>
      <g className="orb" style={{ transform: `translate(${moon[0] - 10}px, ${moon[1] - 10}px)` }}>
        <rect width="20" height="20" fill="#e9edf7" />
        <rect x="4" y="4" width="5" height="5" fill="#b9c0d4" />
        <rect x="11" y="11" width="4" height="4" fill="#b9c0d4" />
      </g>
      <rect x="0" y="118" width="260" height="22" fill="#4f9a33" />
      <rect x="0" y="118" width="260" height="5" fill="#6cc24a" />
      <rect x="0" y="128" width="260" height="12" fill="#6b4428" />
    </svg>
  )
}

export default function World({ run, ws, mode, target, selector }) {
  const style = ws.rulesStyle || rulesStyleFor(target && target.version) || 'camel'
  const [ruleOn, setRule] = useOptimistic((id) => {
    const r = RULES.find(x => x.id === id)
    const rules = ws.rules || {}
    const v = rules[ruleName(r, style)]
    return v === undefined ? null : ruleIsOn(v)
  })
  const [time, setTime] = useOptimistic(() => ws.dayTime)
  const [weather, setWeather] = useOptimistic(() => ws.weather)
  const [diff, setDiff] = useOptimistic(() => ws.difficulty)
  const [fill, setFill] = useState({ x1: '', y1: '', z1: '', x2: '', y2: '', z2: '', block: 'stone' })
  const setF = (k) => (e) => setFill(s => ({ ...s, [k]: e.target.value }))
  const corner = (n) => { if (ws.pos) setFill(s => ({ ...s, ['x' + n]: String(Math.floor(ws.pos[0])), ['y' + n]: String(Math.floor(ws.pos[1])), ['z' + n]: String(Math.floor(ws.pos[2])) })) }
  const coords = ['x1', 'y1', 'z1', 'x2', 'y2', 'z2']
  const fillOk = coords.every(k => fill[k] !== '' && !isNaN(Number(fill[k])))
  const volume = fillOk ? (Math.abs(fill.x2 - fill.x1) + 1) * (Math.abs(fill.y2 - fill.y1) + 1) * (Math.abs(fill.z2 - fill.z1) + 1) : 0
  const doFill = (block) => {
    const b = String(block || 'stone').trim().replace(/^minecraft:/, '')
    const box = coords.map(k => Math.floor(Number(fill[k]))).join(' ')
    const single = selector && selector !== '@a'
    run(block === 'air' ? 'Temizle' : 'Doldur', (t) => [single ? `execute as ${t} at @s run fill ${box} minecraft:${b}` : `fill ${box} minecraft:${b}`])
  }
  const t = time('t')

  return (
    <>
      <Head title="Dünya">Zaman, hava, zorluk ve oyun kuralları. Değişiklik tüm dünyaya uygulanır.</Head>

      <section className="group">
        <h2>Zaman</h2>
        <div className="dial">
          <div className="slot" style={{ padding: 4 }}><Dial ticks={t} /></div>
          <div>
            <div className="here" style={{ marginBottom: 12 }}>
              <span className="coord"><span>SAAT</span><b>{t != null ? dayClock(t) : '–'}</b></span>
              {t != null && <span className="state">{dayPart(t)} · {Math.round(t)} tik</span>}
            </div>
            <div className="tiles">
              {TIMES.map(x => (
                <button key={x.label} className="tile" onClick={() => { setTime('t', x.ticks); run(x.label, [`time set ${x.ticks}`]) }}>
                  <span className="slot"><Px name={x.icon} size={32} /></span>{x.label}<small className="num">{x.clock}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="group">
        <h2>Hava {mode === 'rcon' && <small>sunucu havayı söylemiyor; seçtiğin uygulanır</small>}</h2>
        <div className="tiles">
          {WEATHER.map(w => (
            <button key={w.id} className={`tile ${weather('w') === w.id ? 'on' : ''}`} onClick={() => { setWeather('w', w.id); run(w.label, [`weather ${w.id}`]) }}>
              <span className="slot"><Px name={w.icon} size={32} /></span>{w.label}
            </button>
          ))}
        </div>
      </section>

      <section className="group">
        <h2>Zorluk</h2>
        <div className="tiles">
          {DIFFICULTY.map(d => (
            <button key={d.id} className={`tile ${diff('d') === d.id ? 'on' : ''}`} onClick={() => { setDiff('d', d.id); run(d.label, [`difficulty ${d.id}`]) }}>
              <span className="slot"><Px name={d.icon} size={32} /></span>{d.label}<small>{d.sub}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="group">
        <h2>Kurallar <small>{style === 'snake' ? 'Java 1.21.11 ve sonrası adları' : ''}</small></h2>
        <div className="rules">
          {RULES.map(r => {
            const on = ruleOn(r.id)
            const name = ruleName(r, style)
            return (
              <div className="rule" key={r.id}>
                <span><b>{r.label}</b><span>{name}</span></span>
                <button className={`lever ${on ? 'on' : ''} ${on === null ? 'unknown' : ''}`} aria-pressed={!!on} onClick={() => { const next = !on; setRule(r.id, next); run(r.label, [`gamerule ${name} ${ruleValue(r, style, next)}`]) }}><i /></button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="group">
        <h2>Blok doldur <small>en fazla 32 768 blok</small></h2>
        <div className="row">
          {coords.map(k => <div className="field" key={k} style={{ width: 86 }}><label>{k.toUpperCase()}</label><input className="input num" value={fill[k]} onChange={setF(k)} placeholder="0" /></div>)}
          {ws.pos && <><button className="btn ghost" onClick={() => corner(1)}>1. köşe: buram</button><button className="btn ghost" onClick={() => corner(2)}>2. köşe: buram</button></>}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="field" style={{ width: 240 }}><label>Blok</label><input className="input" value={fill.block} onChange={setF('block')} placeholder="stone" spellCheck={false} /></div>
          <button className="btn primary" disabled={!fillOk || volume > 32768} onClick={() => doFill(fill.block)}><Px name="block_stone" size={18} />Doldur</button>
          <button className="btn" disabled={!fillOk || volume > 32768} onClick={() => doFill('air')}><Px name="axe_wood" size={18} />Temizle</button>
          {fillOk && <span className="state" style={{ alignSelf: 'center' }}>{volume.toLocaleString('tr-TR')} blok{volume > 32768 ? ' · çok büyük' : ''}</span>}
        </div>
      </section>
    </>
  )
}
