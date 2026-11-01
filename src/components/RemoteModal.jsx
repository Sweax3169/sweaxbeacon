import React, { useState } from 'react'
import { api } from '../util.js'

const ERR = {
  auth: 'Şifre yanlış.',
  refused: 'Sunucuya ulaşılamadı. RCON açık mı, port doğru mu?',
  timeout: 'Sunucu yanıt vermedi.',
  host: 'Bu adres bulunamadı.',
  reset: 'Sunucu bağlantıyı kapattı.',
}

// The only place SweaxBeacon asks for a password: a server on another machine.
export default function RemoteModal({ onClose }) {
  const [f, setF] = useState({ name: '', host: '', port: '25575', password: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const r = await api().addRemote(f)
    setBusy(false)
    if (r && r.ok) onClose()
    else setErr(ERR[r && r.error] || 'Bağlanılamadı.')
  }
  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal block" onSubmit={submit}>
        <h2>Uzak sunucu ekle</h2>
        <p>Başka bir bilgisayardaki ya da kiralık bir sunucu için. Bilgiler sunucunun <code>server.properties</code> dosyasında; şifre bu bilgisayarda şifrelenerek saklanır.</p>
        <div className="fields">
          <div className="field"><label>Ad (isteğe bağlı)</label><input className="input" value={f.name} onChange={set('name')} placeholder="Arkadaşların sunucusu" /></div>
          <div className="row">
            <div className="field grow"><label>Adres</label><input className="input" value={f.host} onChange={set('host')} placeholder="192.168.1.20 ya da mc.ornek.com" autoFocus spellCheck={false} /></div>
            <div className="field" style={{ width: 110 }}><label>RCON portu</label><input className="input num" value={f.port} onChange={set('port')} /></div>
          </div>
          <div className="field"><label>RCON şifresi</label><input className="input" type="password" value={f.password} onChange={set('password')} /></div>
        </div>
        {err && <div className="err">{err}</div>}
        <div className="foot">
          <button type="button" className="btn ghost" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={busy || !f.host.trim()}>{busy ? 'Bağlanıyor…' : 'Bağlan ve kaydet'}</button>
        </div>
      </form>
    </div>
  )
}
