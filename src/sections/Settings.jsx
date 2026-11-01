import React from 'react'
import { Px } from '../pixel/Pixel.jsx'
import { api } from '../util.js'
import { Head } from './common.jsx'
import { titleOf, subOf, iconFor } from '../components/targets.js'

const THEMES = [
  { id: 'obsidian', label: 'Obsidyen', sub: 'Koyu', colors: ['#0c0a10', '#18141f', '#8ef6ff'] },
  { id: 'quartz', label: 'Kuvars', sub: 'Açık', colors: ['#ece8e1', '#f7f4ee', '#0aa0b6'] },
  { id: 'system', label: 'Sistem', sub: 'Windows’a uyar', colors: ['#0c0a10', '#ece8e1', '#8ef6ff'] },
]

export default function Settings({ settings, saveSettings, targets, version, openRemote }) {
  const saved = targets.filter(t => t.kind === 'server' || t.kind === 'remote')
  return (
    <>
      <Head title="Ayarlar" />

      <section className="group">
        <h2>Görünüm</h2>
        <div className="themes">
          {THEMES.map(t => (
            <button key={t.id} className={`theme-card ${settings.theme === t.id ? 'on' : ''}`} onClick={() => saveSettings({ theme: t.id })}>
              <div className="swatch">{t.colors.map((c, i) => <span key={i} style={{ background: c }} />)}</div>
              <b>{t.label}</b><span>{t.sub}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="group">
        <h2>Sunucular <small>bulunanlar ve eklediklerin</small></h2>
        <div className="saved">
          {saved.map(t => (
            <div className="prow block" key={t.key}>
              <span className="slot" style={{ width: 40, height: 40 }}>{t.icon ? <img src={t.icon} width="28" height="28" alt="" /> : <Px name={iconFor(t)} size={28} />}</span>
              <span style={{ minWidth: 0 }}><b>{titleOf(t)}</b><span>{t.dir || subOf(t)}</span></span>
              <div className="actions">
                {t.dir && <button className="btn small ghost" onClick={() => api().openFolder(t.key)}>Klasör</button>}
                <button className="btn small ghost" onClick={() => api().forget(t.key)}>Unut</button>
              </div>
            </div>
          ))}
          {!saved.length && <div className="empty block">Henüz bir sunucu yok.</div>}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => api().addFolder()}><Px name="chest" size={18} />Sunucu klasörü ekle</button>
          <button className="btn" onClick={openRemote}><Px name="ender_pearl" size={18} />Uzak sunucu ekle</button>
          <button className="btn ghost" onClick={() => api().rescan()}><Px name="compass" size={18} />Yeniden tara</button>
        </div>
      </section>

      <section className="group">
        <h2>Nasıl çalışır</h2>
        <div className="prose block card">
          <p><b>Sunucularda</b> komutlar sunucunun uzaktan konsoluna (RCON) gider. SweaxBeacon açık sunucuları ve bilgisayardaki sunucu klasörlerini kendisi bulur, <code>server.properties</code> dosyasından bağlanır. RCON kapalıysa tek tıkla açar; şifreyi kendisi üretir.</p>
          <p><b>Tek oyunculu, LAN ve operatör olduğun sunucularda</b> komutlar açık Minecraft penceresinin sohbetine yazılır. Mesajlar yalnız oyun penceresine gider: oyun öne gelmez, klavyen ve faren kullanılmaz. Yanıtlar oyunun kendi günlüğünden okunur. Bunun için dünyada hilelerin açık olması (Esc → LAN&rsquo;a aç → Hilelere izin ver) ve oyunda &ldquo;odak kaybında duraklat&rdquo; ayarının açık olması (varsayılan; <kbd>F3</kbd>+<kbd>P</kbd>) gerekir.</p>
          <p>Hiçbir hesap, giriş ya da internet bağlantısı gerekmez; her şey bu bilgisayarda kalır.</p>
        </div>
      </section>

      <section className="group">
        <h2>Hakkında</h2>
        <div className="kv block card">
          <span>Sürüm</span><b className="num">{version}</b>
          <span>Minecraft</span><span style={{ color: 'var(--text)' }}>Java Edition 1.20 ve sonrası</span>
          <span>Kaynak kodu</span><a href="#" onClick={(e) => { e.preventDefault(); api().openExternal('https://github.com/Sweax3169/sweaxbeacon') }} style={{ color: 'var(--beam)' }}>github.com/Sweax3169/sweaxbeacon</a>
        </div>
      </section>
    </>
  )
}
