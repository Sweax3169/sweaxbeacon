import React, { useState, useEffect } from 'react'
import { POWERS, QUICK_ITEMS, TIME, WEATHER, DIFFICULTY, GAMERULES } from '../commands.js'

// ---- ortak parçalar ----

function ActionCard({ icon, label, sub, onClick }) {
  return (
    <button className="action-card" onClick={onClick}>
      <span className="ac-icon">{icon}</span>
      <span>
        <div className="ac-label">{label}</div>
        {sub && <div className="ac-sub">{sub}</div>}
      </span>
    </button>
  )
}

function Pill({ icon, label, onClick }) {
  return <button className="pill" onClick={onClick}><span>{icon}</span>{label}</button>
}

// ---- Güçler ----

export function PowersSection({ run }) {
  return (
    <>
      <div className="section-head">⚡ Güçler</div>
      <div className="section-desc">Seçili hedef oyuncuya anında güç ver. Efektler kalıcıdır (sonsuz süre).</div>
      <div className="btn-grid">
        {POWERS.map(p => (
          <ActionCard key={p.id} icon={p.icon} label={p.label} sub={p.sub} onClick={() => run(p.cmds)} />
        ))}
      </div>
    </>
  )
}

// ---- Eşya ----

export function ItemsSection({ run, target }) {
  const [item, setItem] = useState('diamond_block')
  const [amount, setAmount] = useState('64')
  const giveCustom = () => {
    const id = item.trim().replace(/^minecraft:/, '')
    if (!id) return
    const amt = Math.max(1, Math.min(6400, parseInt(amount, 10) || 1))
    run([`give {t} minecraft:${id} ${amt}`])
  }
  return (
    <>
      <div className="section-head">🎁 Eşya Ver</div>
      <div className="section-desc">Hazır paketler ya da istediğin eşyayı elle ver.</div>

      <div className="group-title">Hazır paketler</div>
      <div className="btn-grid">
        {QUICK_ITEMS.map((it, i) => (
          <ActionCard key={i} icon={it.icon} label={it.label} onClick={() => run(it.cmds)} />
        ))}
      </div>

      <div className="group-title">Özel eşya</div>
      <div className="form-row">
        <div className="form-field wide">
          <label>Eşya kodu (ör. netherite_ingot, oak_log)</label>
          <input value={item} onChange={e => setItem(e.target.value)} placeholder="diamond_block" />
        </div>
        <div className="form-field">
          <label>Adet</label>
          <input value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <button className="go-btn" onClick={giveCustom}>Ver</button>
      </div>
    </>
  )
}

// ---- Işınlanma ----

export function TeleportSection({ run, players, target }) {
  const [x, setX] = useState('0')
  const [y, setY] = useState('100')
  const [z, setZ] = useState('0')
  const [dest, setDest] = useState('')
  return (
    <>
      <div className="section-head">🧭 Işınlanma</div>
      <div className="section-desc">Hedef oyuncuyu koordinata ya da başka bir oyuncuya ışınla.</div>

      <div className="group-title">Koordinata ışınla</div>
      <div className="form-row">
        <div className="form-field"><label>X</label><input value={x} onChange={e => setX(e.target.value)} /></div>
        <div className="form-field"><label>Y</label><input value={y} onChange={e => setY(e.target.value)} /></div>
        <div className="form-field"><label>Z</label><input value={z} onChange={e => setZ(e.target.value)} /></div>
        <button className="go-btn" onClick={() => run([`tp {t} ${Number(x) || 0} ${Number(y) || 100} ${Number(z) || 0}`])}>Işınla</button>
      </div>

      <div className="group-title">Hızlı</div>
      <div className="pill-row">
        <Pill icon="⬆️" label="50 blok yukarı (kurtul)" onClick={() => run(['tp {t} ~ ~50 ~'])} />
        <Pill icon="🔝" label="Gökyüzüne (Y=250)" onClick={() => run(['tp {t} ~ 250 ~'])} />
      </div>

      <div className="group-title">Oyuncuya ışınla</div>
      <div className="form-row">
        <div className="form-field wide">
          <label>Hedefi kime ışınlayayım?</label>
          <input value={dest} onChange={e => setDest(e.target.value)} placeholder="oyuncu adı" list="tp-players" />
          <datalist id="tp-players">{players.map(p => <option key={p} value={p} />)}</datalist>
        </div>
        <button className="go-btn" disabled={!dest.trim()} onClick={() => run([`tp {t} ${dest.trim()}`])}>{target || 'hedef'} → {dest || '...'}</button>
        <button className="go-btn ghost" disabled={!dest.trim()} onClick={() => run([`tp ${dest.trim()} {t}`])}>{dest || '...'} → {target || 'hedef'}</button>
      </div>
    </>
  )
}

// ---- Dünya ----

export function WorldSection({ run, query, toast }) {
  const [rules, setRules] = useState({})
  const [loadingRule, setLoadingRule] = useState('')
  const [fill, setFill] = useState({ x1: '', y1: '', z1: '', x2: '', y2: '', z2: '', block: 'stone' })

  const loadRules = async () => {
    const next = {}
    for (const g of GAMERULES) {
      const r = await query(`gamerule ${g.rule}`)
      if (r) next[g.rule] = /set to:\s*true/i.test(r)
    }
    setRules(next)
  }
  useEffect(() => { loadRules() }, [])

  const toggleRule = async (rule) => {
    setLoadingRule(rule)
    const newVal = !rules[rule]
    await run([`gamerule ${rule} ${newVal}`])
    setRules(r => ({ ...r, [rule]: newVal }))
    setLoadingRule('')
  }

  const setF = (k, v) => setFill(s => ({ ...s, [k]: v }))
  const doFill = (block) => {
    const { x1, y1, z1, x2, y2, z2 } = fill
    if ([x1, y1, z1, x2, y2, z2].some(v => v === '' || isNaN(Number(v)))) { toast('Tüm koordinatları doldur.', 'err'); return }
    const b = (block || fill.block || 'stone').trim().replace(/^minecraft:/, '')
    run([`fill ${Number(x1)} ${Number(y1)} ${Number(z1)} ${Number(x2)} ${Number(y2)} ${Number(z2)} minecraft:${b}`], { needTarget: false })
  }

  return (
    <>
      <div className="section-head">🌍 Dünya</div>
      <div className="section-desc">Zaman, hava, zorluk, kurallar ve blok düzenleme.</div>

      <div className="group-title">Zaman</div>
      <div className="pill-row">{TIME.map(t => <Pill key={t.cmd} icon={t.icon} label={t.label} onClick={() => run([t.cmd], { needTarget: false })} />)}</div>

      <div className="group-title">Hava</div>
      <div className="pill-row">{WEATHER.map(w => <Pill key={w.cmd} icon={w.icon} label={w.label} onClick={() => run([w.cmd], { needTarget: false })} />)}</div>

      <div className="group-title">Zorluk</div>
      <div className="pill-row">{DIFFICULTY.map(d => <Pill key={d.cmd} icon={d.icon} label={d.label} onClick={() => run([d.cmd], { needTarget: false })} />)}</div>

      <div className="group-title">Kurallar</div>
      <div className="rule-list">
        {GAMERULES.map(g => (
          <div className="rule-row" key={g.rule}>
            <span className="rr-label">{g.label} <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>({g.rule})</span></span>
            <div className={`toggle ${rules[g.rule] ? 'on' : ''} ${loadingRule === g.rule ? 'loading' : ''}`} onClick={() => toggleRule(g.rule)} />
          </div>
        ))}
      </div>

      <div className="group-title">Blok doldur / temizle</div>
      <div className="section-desc" style={{ marginBottom: 10 }}>İki köşe koordinatı ver. (Tek seferde en fazla 32768 blok — vanilla sınırı.)</div>
      <div className="form-row">
        <div className="form-field"><label>X1</label><input value={fill.x1} onChange={e => setF('x1', e.target.value)} /></div>
        <div className="form-field"><label>Y1</label><input value={fill.y1} onChange={e => setF('y1', e.target.value)} /></div>
        <div className="form-field"><label>Z1</label><input value={fill.z1} onChange={e => setF('z1', e.target.value)} /></div>
        <div className="form-field"><label>X2</label><input value={fill.x2} onChange={e => setF('x2', e.target.value)} /></div>
        <div className="form-field"><label>Y2</label><input value={fill.y2} onChange={e => setF('y2', e.target.value)} /></div>
        <div className="form-field"><label>Z2</label><input value={fill.z2} onChange={e => setF('z2', e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-field wide"><label>Blok</label><input value={fill.block} onChange={e => setF('block', e.target.value)} placeholder="stone" /></div>
        <button className="go-btn" onClick={() => doFill(fill.block)}>Doldur</button>
        <button className="go-btn ghost" onClick={() => doFill('air')}>Temizle (hava)</button>
      </div>
    </>
  )
}

// ---- Oyuncular ----

export function PlayersSection({ run, players, refreshPlayers, setTarget }) {
  const [say, setSay] = useState('')
  const [wl, setWl] = useState('')

  return (
    <>
      <div className="section-head">👥 Oyuncular</div>
      <div className="section-desc">Çevrimiçi oyuncuları yönet, mesaj yayınla, whitelist ayarla.</div>

      <div className="group-title">
        Çevrimiçi ({players.length}) <button className="mini-btn" style={{ marginLeft: 8 }} onClick={refreshPlayers}>⟳ Yenile</button>
      </div>
      {players.length === 0 && <div className="section-desc">Şu an çevrimiçi oyuncu yok.</div>}
      {players.map(p => (
        <div className="player-row" key={p}>
          <div className="player-avatar">{p.slice(0, 1).toUpperCase()}</div>
          <div className="player-name">{p}</div>
          <button className="mini-btn" onClick={() => setTarget(p)}>Hedef Yap</button>
          <button className="mini-btn" onClick={() => run([`op ${p}`], { needTarget: false })}>OP</button>
          <button className="mini-btn" onClick={() => run([`deop ${p}`], { needTarget: false })}>OP Al</button>
          <button className="mini-btn" onClick={() => run([`gamemode creative ${p}`], { needTarget: false })}>Creative</button>
          <button className="mini-btn danger" onClick={() => run([`kick ${p}`], { needTarget: false })}>At</button>
          <button className="mini-btn danger" onClick={() => run([`ban ${p}`], { needTarget: false })}>Banla</button>
        </div>
      ))}

      <div className="group-title">Mesaj Yayınla</div>
      <div className="form-row">
        <div className="form-field wide" style={{ flex: 1 }}>
          <label>Tüm sunucuya mesaj</label>
          <input value={say} onChange={e => setSay(e.target.value)} placeholder="Herkese duyuru..." style={{ width: '100%' }} />
        </div>
        <button className="go-btn" disabled={!say.trim()} onClick={() => { run([`say ${say.trim()}`], { needTarget: false }); setSay('') }}>Gönder</button>
      </div>

      <div className="group-title">Whitelist</div>
      <div className="pill-row" style={{ marginBottom: 10 }}>
        <Pill icon="🔒" label="Whitelist AÇ" onClick={() => run(['whitelist on'], { needTarget: false })} />
        <Pill icon="🔓" label="Whitelist KAPAT" onClick={() => run(['whitelist off'], { needTarget: false })} />
        <Pill icon="📋" label="Listeyi gör" onClick={() => run(['whitelist list'], { needTarget: false })} />
      </div>
      <div className="form-row">
        <div className="form-field wide"><label>Oyuncu ekle / çıkar</label><input value={wl} onChange={e => setWl(e.target.value)} placeholder="oyuncu adı" /></div>
        <button className="go-btn" disabled={!wl.trim()} onClick={() => run([`whitelist add ${wl.trim()}`], { needTarget: false })}>Ekle</button>
        <button className="go-btn ghost" disabled={!wl.trim()} onClick={() => run([`whitelist remove ${wl.trim()}`], { needTarget: false })}>Çıkar</button>
      </div>
    </>
  )
}

// ---- Konsol ----

export function ConsoleSection({ run }) {
  const [cmd, setCmd] = useState('')
  const send = () => {
    const c = cmd.trim().replace(/^\//, '')
    if (!c) return
    run([c], { needTarget: false })
    setCmd('')
  }
  return (
    <>
      <div className="section-head">💻 Konsol</div>
      <div className="section-desc">Herhangi bir sunucu komutunu doğrudan çalıştır. (Başına / koymana gerek yok.)</div>
      <div className="console-input-row">
        <input value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} placeholder="örn: time set day   ·   give Okan diamond 64   ·   summon zombie" autoFocus />
        <button className="go-btn" onClick={send}>Çalıştır</button>
      </div>
      <div className="section-desc" style={{ fontSize: 11.5 }}>
        💡 İpucu: <b>{'{t}'}</b> yazarsan seçili hedef oyuncuyla değişir. Sonuçlar aşağıdaki günlükte.
      </div>
    </>
  )
}
