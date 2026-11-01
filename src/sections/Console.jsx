import React, { useEffect, useRef, useState } from 'react'
import { CHIPS } from '../data/catalog.js'
import { Head } from './common.jsx'
import { SELECTOR_LABEL } from '../util.js'

export default function Console({ run, log, setLog, selector, status }) {
  const [cmd, setCmd] = useState('')
  const [hist, setHist] = useState([])
  const [hi, setHi] = useState(-1)
  const box = useRef(null)
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [log])

  const send = () => {
    const c = cmd.trim().replace(/^\//, '')
    if (!c) return
    run('Konsol', [c])
    setHist(h => [c, ...h.filter(x => x !== c)].slice(0, 50))
    setHi(-1)
    setCmd('')
  }
  const key = (e) => {
    if (e.key === 'Enter') send()
    else if (e.key === 'ArrowUp' && hist.length) { const i = Math.min(hist.length - 1, hi + 1); setHi(i); setCmd(hist[i]); e.preventDefault() }
    else if (e.key === 'ArrowDown') { const i = hi - 1; setHi(i); setCmd(i >= 0 ? hist[i] : ''); e.preventDefault() }
  }

  return (
    <>
      <Head title="Konsol" right={log.length ? <button className="btn small ghost" onClick={() => setLog([])}>Temizle</button> : null}>
        Her komutu buradan yazabilirsin. <code>{'{t}'}</code> seçtiğin oyuncuyla değişir ({SELECTOR_LABEL[selector] || selector}).
      </Head>
      <div className="console">
        <div className="log" ref={box}>
          {!log.length && <div className="empty">Bastığın her düğmenin komutu ve yanıtı burada.</div>}
          {log.map(e => (
            <div className="log-entry" key={e.id}>
              <div className="meta"><b>{e.label}</b><span className="num">{e.time}</span><span>{e.mode === 'chat' ? 'oyun içi' : e.mode === 'rcon' ? 'RCON' : ''}</span>{e.pending && <span>gönderiliyor…</span>}</div>
              {e.items.map((it, i) => (
                <div key={i}>
                  <div className="log-cmd">{it.cmd}</div>
                  {it.resp ? <div className={`log-resp ${it.ok === false ? 'bad' : ''}`}>{it.resp}</div> : null}
                </div>
              ))}
              {e.error && <div className="log-resp bad">{e.error}</div>}
            </div>
          ))}
        </div>
        <div className="cmdline">
          <span className="slash">/</span>
          <input className="input" value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={key} placeholder="time set day" spellCheck={false} autoFocus disabled={!(status === 'ready' || status === 'cheats')} />
          <button className="btn primary" onClick={send} disabled={!cmd.trim()}>Çalıştır</button>
        </div>
        <div className="chips">
          {CHIPS.map(c => <button key={c} className="chip" onClick={() => setCmd(c)}>{c}</button>)}
        </div>
      </div>
    </>
  )
}
