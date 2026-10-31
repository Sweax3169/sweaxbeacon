import React from 'react'

const NAV = [
  { key: 'powers', icon: '⚡', label: 'Güçler' },
  { key: 'items', icon: '🎁', label: 'Eşya' },
  { key: 'teleport', icon: '🧭', label: 'Işınlanma' },
  { key: 'world', icon: '🌍', label: 'Dünya' },
  { key: 'players', icon: '👥', label: 'Oyuncular' },
  { key: 'console', icon: '💻', label: 'Konsol' },
]

export default function Sidebar({ section, setSection, target, setTarget, players, refreshPlayers, info, onDisconnect }) {
  return (
    <div className="sidebar">
      <div className="target-box">
        <div className="tb-label">Hedef Oyuncu</div>
        <div className="target-input-row">
          <input value={target} onChange={e => setTarget(e.target.value)} placeholder="oyuncu adın" />
          <button className="icon-btn" title="Çevrimiçi oyuncuları yenile" onClick={refreshPlayers}>⟳</button>
        </div>
        {players.length > 0 ? (
          <div className="player-chips">
            {players.map(p => (
              <span key={p} className={`player-chip ${target === p ? 'active' : ''}`} onClick={() => setTarget(p)}>{p}</span>
            ))}
          </div>
        ) : (
          <div className="player-empty">Çevrimiçi oyuncu yok — adını elle yaz.</div>
        )}
      </div>

      {NAV.map(n => (
        <button key={n.key} className={`nav-item ${section === n.key ? 'active' : ''}`} onClick={() => setSection(n.key)}>
          <span className="ni-icon">{n.icon}</span>
          {n.label}
        </button>
      ))}

      <div className="sidebar-spacer" />
      <div className="server-info">
        {info ? <>🟢 {info.host}:{info.port}</> : ''}
      </div>
      <button className="disconnect-btn" onClick={onDisconnect}>Bağlantıyı Kes</button>
    </div>
  )
}
