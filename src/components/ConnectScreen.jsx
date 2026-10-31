import React from 'react'

export default function ConnectScreen({ form, setForm, onConnect, connecting, error }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const canConnect = form.host.trim() && form.port.trim() && !connecting

  const onKey = (e) => { if (e.key === 'Enter' && canConnect) onConnect() }

  return (
    <div className="connect-wrap">
      <div className="connect-card">
        <div className="connect-logo">🎮</div>
        <div className="connect-title">Sunucuna Bağlan</div>
        <div className="connect-sub">Minecraft sunucunun RCON bilgilerini gir.<br />Kendi PC'ndeki sunucu için adres <b>localhost</b>.</div>

        {error && <div className="connect-err">{error}</div>}

        <div className="field row">
          <div style={{ flex: 2 }}>
            <label>Sunucu adresi</label>
            <input value={form.host} onChange={e => set('host', e.target.value)} onKeyDown={onKey} placeholder="localhost" />
          </div>
          <div style={{ flex: 1 }}>
            <label>RCON portu</label>
            <input value={form.port} onChange={e => set('port', e.target.value)} onKeyDown={onKey} placeholder="25575" />
          </div>
        </div>
        <div className="field">
          <label>RCON şifresi</label>
          <input type="password" value={form.password} onChange={e => set('password', e.target.value)} onKeyDown={onKey} placeholder="server.properties'teki rcon.password" />
        </div>
        <label className="remember-row">
          <input type="checkbox" checked={form.remember} onChange={e => set('remember', e.target.checked)} />
          Şifreyi bu bilgisayarda hatırla
        </label>
        <button className="connect-btn" disabled={!canConnect} onClick={onConnect}>
          {connecting ? 'Bağlanılıyor…' : 'BAĞLAN'}
        </button>
      </div>

      <div className="help-card">
        <h3>⚙️ RCON nasıl açılır?</h3>
        Sunucunun <code>server.properties</code> dosyasını aç ve şunları ayarla:
        <div className="help-block">
          enable-rcon=true<br />
          rcon.password=birsifrebelirle<br />
          rcon.port=25575
        </div>
        <ol>
          <li>Sunucuyu <b>kapat</b>, dosyayı kaydet, tekrar <b>başlat</b>.</li>
          <li>Aynı şifreyi yukarıya gir, adres <code>localhost</code>.</li>
          <li>Bağlan ve panelden sunucunu yönet!</li>
        </ol>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
          RCON sadece senin bilgisayarında dinler; şifreyi kimseyle paylaşma.
        </div>
      </div>
    </div>
  )
}
