import React, { useRef, useEffect } from 'react'

export default function LogPanel({ log, onClear }) {
  const bodyRef = useRef(null)
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [log])
  return (
    <div className="log-panel">
      <div className="log-head">
        <span>Komut Günlüğü</span>
        <button className="log-clear" onClick={onClear}>temizle</button>
      </div>
      <div className="log-body" ref={bodyRef}>
        {log.length === 0 && <div className="log-empty">Henüz komut çalıştırılmadı. Bir butona bas, sonuç burada görünür.</div>}
        {log.map(l => (
          <div key={l.id}>
            <div className="log-line">
              <span className="log-time">{l.time}</span>
              <span className="log-cmd">{l.cmd}</span>
            </div>
            {l.resp ? <div className="log-line"><span className="log-time"> </span><span className={`log-resp ${l.ok ? 'ok' : 'err'}`}>{l.resp}</span></div> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
