import React, { useState } from 'react'
import { api } from '../util.js'
import { Px } from '../pixel/Pixel.jsx'
import { titleOf } from './targets.js'

// Statuses that need something before commands can go through.
export const GATED = new Set(['connecting', 'starting', 'rcon-off', 'restart', 'stopped', 'not-in-world', 'pause-off', 'no-key',
  'no-window', 'auth', 'refused', 'timeout', 'host', 'reset', 'offline', 'game', 'saved', 'not-found'])

export function BeaconArt({ level = 2 }) {
  return (
    <svg className="beacon-art" data-level={level} viewBox="0 0 168 210" shapeRendering="crispEdges" aria-hidden="true">
      <defs>
        <linearGradient id="ga-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f2feff" />
          <stop offset=".35" stopColor="#8ef6ff" stopOpacity=".9" />
          <stop offset="1" stopColor="#8ef6ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ga-halo" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#8ef6ff" stopOpacity=".35" />
          <stop offset="1" stopColor="#8ef6ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="beam">
        <rect x="64" y="0" width="40" height="122" fill="url(#ga-halo)" />
        <rect x="76" y="0" width="16" height="122" fill="url(#ga-beam)" />
      </g>
      <rect x="8" y="186" width="152" height="22" fill="#241a36" />
      <rect x="8" y="186" width="152" height="3" fill="#43336a" />
      <rect x="28" y="164" width="112" height="22" fill="#30234a" />
      <rect x="28" y="164" width="112" height="3" fill="#55418a" />
      <rect x="48" y="142" width="72" height="22" fill="#3f2f61" />
      <rect x="48" y="142" width="72" height="3" fill="#6c55a6" />
      {[16, 40, 64, 88, 112, 136].map(x => <rect key={x} x={x} y="196" width="6" height="3" fill="#3a2c58" />)}
      <rect x="62" y="110" width="44" height="34" fill="#c5f4fb" />
      <rect x="66" y="114" width="36" height="26" fill="#58c9dc" />
      <rect x="66" y="132" width="36" height="8" fill="#2a1d3d" />
      <g className="core">
        <rect x="76" y="116" width="16" height="16" fill="#ffffff" />
        <rect x="72" y="120" width="24" height="8" fill="#e6fdff" />
      </g>
      <rect x="62" y="110" width="44" height="3" fill="#effdff" />
    </svg>
  )
}

function Card({ level, title, children, actions, fine }) {
  return (
    <div className="gate">
      <div className="gate-card block">
        <BeaconArt level={level} />
        <div>
          <h1>{title}</h1>
          {children}
          {actions && <div className="row">{actions}</div>}
          {fine && <div className="fine">{fine}</div>}
        </div>
      </div>
    </div>
  )
}

const UNREACHABLE = {
  refused: 'Sunucu kapalı ya da RCON portu yanlış.',
  timeout: 'Sunucu yanıt vermedi. Adres doğru mu, güvenlik duvarı engelliyor mu?',
  host: 'Bu adres bulunamadı.',
  reset: 'Sunucu bağlantıyı kapattı. RCON açık mı?',
  offline: 'Bağlantı koptu. Sunucu yeniden açılınca kendiliğinden bağlanırım.',
}

export default function Gate({ link, targets, scanning, onAddRemote }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const act = async (fn) => { setBusy(true); setNote(''); try { const r = await fn(); if (r && r.ok === false && r.error && r.error !== 'canceled') setNote(errorNote(r.error)) } finally { setBusy(false) } }

  if (!link) {
    if (scanning) return <Card level="wait" title="Dünyalar aranıyor"><p>Açık oyunlar ve bu bilgisayardaki sunucular taranıyor.</p></Card>
    return (
      <div className="gate">
        <div className="gate-card block">
          <BeaconArt level={0} />
          <div>
            <h1>Henüz bir dünya bulamadım</h1>
            <p>Açtığın an kendiliğinden bulurum. Aradığın yer burada yoksa göster:</p>
            <div className="choices">
              <div className="choice"><span className="slot"><Px name="block_grass" size={28} /></span><span><b>Tek oyunculu ya da bir sunucuda</b><span>Minecraft&rsquo;ı aç ve bir dünyaya gir.</span></span><span /></div>
              <div className="choice"><span className="slot"><Px name="block_command" size={28} /></span><span><b>Kendi sunucun</b><span>Sunucunu başlat ya da klasörünü göster.</span></span><button className="btn small" onClick={() => act(() => api().addFolder())}>Klasör seç</button></div>
              <div className="choice"><span className="slot"><Px name="ender_pearl" size={28} /></span><span><b>Başka bir bilgisayardaki sunucu</b><span>Adres, RCON portu ve şifreyle.</span></span><button className="btn small" onClick={onAddRemote}>Ekle</button></div>
            </div>
            {note && <div className="err">{note}</div>}
          </div>
        </div>
      </div>
    )
  }

  const t = link.target || {}
  const key = link.key
  const name = titleOf(t, link.game)
  const retry = <button className="btn" disabled={busy} onClick={() => act(() => api().select(key))}>Tekrar dene</button>
  const folder = t.dir ? <button className="btn ghost" onClick={() => api().openFolder(key)}><Px name="chest" size={18} />Klasörü aç</button> : null

  switch (link.status) {
    case 'connecting': case 'game': case 'saved':
      return <Card level="wait" title="Bağlanıyor"><p>{name}</p></Card>
    case 'starting':
      return <Card level="wait" title="Sunucu açılıyor" fine="İlk açılışta dünya oluşturulur; birkaç dakika sürebilir. Sunucu kendi penceresinde çalışıyor.">
        <p><b>{name}</b> başlatıldı. RCON yanıt verdiği an bağlanırım.</p>
      </Card>
    case 'rcon-off':
      return <Card level={1} title="Bu sunucuda uzaktan komut kapalı"
        actions={<><button className="btn primary" disabled={busy} onClick={() => act(() => api().enableRcon(key))}>RCON&rsquo;u aç</button>{folder}</>}
        fine={note || 'Sunucunun bir kez yeniden başlaması gerekecek.'}>
        <p>SweaxBeacon komutları <b>{name}</b> sunucusuna RCON ile gönderir. Açmak için <code>server.properties</code> dosyasına RCON&rsquo;u ve rastgele bir şifre yazarım; şifre bu bilgisayarda kalır.</p>
      </Card>
    case 'restart':
      return <Card level={1} title="Sunucuyu bir kez yeniden başlat" actions={folder}
        fine="Bekliyorum; ayrıca bir şeye basman gerekmiyor.">
        <p>RCON açık. Sunucu penceresine <code>stop</code> yaz, sonra her zamanki gibi yeniden başlat. Açıldığı an kendiliğinden bağlanırım.</p>
      </Card>
    case 'stopped':
      if (!t.eula) {
        return <Card level={0} title="Önce Minecraft EULA&rsquo;sı"
          actions={<><button className="btn primary" disabled={busy} onClick={() => act(async () => { await api().acceptEula(key); return api().start(key) })}>Kabul ediyorum, başlat</button>
            <button className="btn ghost" onClick={() => api().openExternal('https://aka.ms/MinecraftEULA')}>EULA&rsquo;yı oku</button></>}
          fine={note}>
          <p><b>{name}</b> hiç başlatılmamış. Sunucuyu çalıştırmak için Mojang&rsquo;ın son kullanıcı sözleşmesini kabul etmen gerekiyor; kabul edersen <code>eula.txt</code> dosyasına yazarım.</p>
        </Card>
      }
      return <Card level={0} title={`${name} kapalı`}
        actions={<><button className="btn primary" disabled={busy} onClick={() => act(() => api().start(key))}><Px name="lever" size={18} />Başlat</button>{folder}</>}
        fine={note || 'Sunucu kendi penceresinde açılır ve SweaxBeacon kapansa da çalışmaya devam eder.'}>
        <p>Başlat&rsquo;a basınca sunucuyu açarım; RCON kapalıysa önce açarım. Hazır olunca kendiliğinden bağlanırım.</p>
      </Card>
    case 'not-in-world':
      return <Card level={1} title="Minecraft açık, ama bir dünyada değilsin">
        <p>Bir dünyaya gir ya da bir sunucuya bağlan; girdiğin an buradayım.</p>
      </Card>
    case 'pause-off':
      return <Card level={1} title="Oyunda bir ayar gerekiyor" actions={retry}
        fine="Oyun arka plandayken duraklamalı; komutları ancak öyle güvenle yazabilirim.">
        <p>Oyunda <kbd>F3</kbd> tuşunu basılı tutup <kbd>P</kbd>&rsquo;ye bas. Sohbette &ldquo;odak kaybında duraklatma: açık&rdquo; yazısını görünce Tekrar dene&rsquo;ye bas.</p>
      </Card>
    case 'no-key':
      return <Card level={1} title="Sohbet tuşu klavyede değil" actions={retry}>
        <p>Oyunda Seçenekler → Kontroller → Tuş atamaları&rsquo;ndan &ldquo;Sohbeti aç&rdquo; için bir klavye tuşu seç.</p>
      </Card>
    case 'no-window':
      return <Card level={0} title="Oyun penceresi bulunamadı" actions={retry}>
        <p>Minecraft kapanmış ya da penceresi henüz açılmamış olabilir.</p>
      </Card>
    case 'auth':
      return <Card level={0} title="Şifre yanlış" actions={<><button className="btn primary" onClick={onAddRemote}>Yeniden ekle</button>{retry}</>}>
        <p><b>{name}</b> bu RCON şifresini kabul etmedi.</p>
      </Card>
    default:
      return <Card level={0} title="Sunucuya ulaşılamadı" actions={<>{retry}{folder}</>}>
        <p>{UNREACHABLE[link.status] || UNREACHABLE.offline}</p>
      </Card>
  }
}

function errorNote(code) {
  return {
    'no-java': 'Bu bilgisayarda Java bulunamadı. Sunucuyu kendi başlatma dosyasıyla aç.',
    'no-jar': 'Klasörde sunucu dosyası (.jar) bulunamadı.',
    'not-a-server': 'Bu klasörde bir Minecraft sunucusu yok.',
    'no-properties': 'server.properties bulunamadı. Sunucuyu bir kez başlat.',
    eula: 'Önce EULA kabul edilmeli.',
    running: 'Sunucu zaten açık.',
  }[code] || 'Olmadı: ' + code
}
