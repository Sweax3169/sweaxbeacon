import React from 'react'

const api = () => window.sweax

export default function TitleBar({ connected, info }) {
  return (
    <div className="titlebar">
      <div className="brand">
        <span className="brand-mark"><i /><i /><i /></span>
        <span className="brand-name">SWEAXPANEL</span>
        <span className="brand-sub">by Sweax Studios</span>
      </div>
      <div className="titlebar-spacer" />
      <div className={`conn-chip ${connected ? 'on' : 'off'}`}>
        <span className="dot" />
        {connected ? (info ? `${info.host}:${info.port}` : 'Bağlı') : 'Bağlı değil'}
      </div>
      <div className="win-controls">
        <button onClick={() => api().winControl('minimize')} title="Küçült">
          <svg width="11" height="11" viewBox="0 0 11 11"><line x1="1" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
        <button onClick={() => api().winControl('maximize')} title="Büyüt">
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" rx="1" /></svg>
        </button>
        <button className="close" onClick={() => api().winControl('close')} title="Kapat">
          <svg width="11" height="11" viewBox="0 0 11 11"><path d="M1 1 L10 10 M10 1 L1 10" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
      </div>
    </div>
  )
}
