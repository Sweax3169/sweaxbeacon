import React, { useState } from 'react'
import { Px, Face } from '../pixel/Pixel.jsx'
import { Head } from './common.jsx'

export default function Players({ run, mode, game, players, selector, setWho }) {
  const [say, setSay] = useState('')
  const [wl, setWl] = useState('')
  const single = mode === 'chat' && game && game.where === 'single'

  return (
    <>
      <Head title="Oyuncular">{single ? 'Tek oyunculu dünyada yalnızsın; operatör ve beyaz liste ayarları sunucular içindir.' : 'Çevrimiçi oyuncuları yönet, duyuru yap, beyaz listeyi ayarla.'}</Head>

      {mode === 'rcon' && (
        <section className="group">
          <h2>Çevrimiçi <small>{players.length} oyuncu</small></h2>
          <div className="plist">
            {players.map(p => (
              <div className="prow block" key={p}>
                <Face name={p} size={40} />
                <span><b>{p}</b><span>{selector === p ? 'Komutlar bu oyuncuya gidiyor' : 'Çevrimiçi'}</span></span>
                <div className="actions">
                  <button className="btn small" onClick={() => setWho(p)}>Seç</button>
                  <button className="btn small" onClick={() => run(`${p}: operatör`, [`op ${p}`])}>Operatör yap</button>
                  <button className="btn small" onClick={() => run(`${p}: operatörlüğü al`, [`deop ${p}`])}>Operatörlüğü al</button>
                  <button className="btn small danger" onClick={() => run(`${p}: at`, [`kick ${p}`])}>At</button>
                  <button className="btn small danger" onClick={() => run(`${p}: yasakla`, [`ban ${p}`])}>Yasakla</button>
                </div>
              </div>
            ))}
            {!players.length && <div className="empty block">Şu an kimse çevrimiçi değil.</div>}
          </div>
        </section>
      )}

      <section className="group">
        <h2>Duyuru</h2>
        <div className="row">
          <div className="field grow"><label>Herkese mesaj</label><input className="input" value={say} onChange={e => setSay(e.target.value)} placeholder="Sunucu 5 dakika sonra yeniden başlıyor" onKeyDown={e => { if (e.key === 'Enter' && say.trim()) { run('Duyuru', [`say ${say.trim()}`]); setSay('') } }} /></div>
          <button className="btn primary" disabled={!say.trim()} onClick={() => { run('Duyuru', [`say ${say.trim()}`]); setSay('') }}>Gönder</button>
        </div>
      </section>

      {!single && (
        <section className="group">
          <h2>Beyaz liste <small>açıkken yalnız listedekiler girebilir</small></h2>
          <div className="actions" style={{ marginBottom: 10 }}>
            <button className="action" onClick={() => run('Beyaz liste açık', ['whitelist on'])}><span className="slot"><Px name="lever" size={24} /></span>Aç</button>
            <button className="action" onClick={() => run('Beyaz liste kapalı', ['whitelist off'])}><span className="slot"><Px name="lever" size={24} style={{ transform: 'scaleX(-1)' }} /></span>Kapat</button>
            <button className="action" onClick={() => run('Beyaz liste', ['whitelist list'])}><span className="slot"><Px name="map" size={24} /></span>Listeyi göster</button>
          </div>
          <div className="row">
            <div className="field" style={{ width: 260 }}><label>Oyuncu</label><input className="input" value={wl} onChange={e => setWl(e.target.value)} placeholder="Alex" spellCheck={false} /></div>
            <button className="btn" disabled={!wl.trim()} onClick={() => run(`${wl.trim()} listeye`, [`whitelist add ${wl.trim()}`])}>Ekle</button>
            <button className="btn ghost" disabled={!wl.trim()} onClick={() => run(`${wl.trim()} listeden`, [`whitelist remove ${wl.trim()}`])}>Çıkar</button>
          </div>
        </section>
      )}
    </>
  )
}
