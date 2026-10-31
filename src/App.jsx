import React, { useState, useEffect, useRef, useCallback } from 'react'
import TitleBar from './components/TitleBar.jsx'
import ConnectScreen from './components/ConnectScreen.jsx'
import Sidebar from './components/Sidebar.jsx'
import LogPanel from './components/LogPanel.jsx'
import { PowersSection, ItemsSection, TeleportSection, WorldSection, PlayersSection, ConsoleSection } from './components/Sections.jsx'
import { applyTarget, parsePlayers, cleanResponse, nowClock, nextId } from './util.js'

const api = () => window.sweax

export default function App() {
  const [view, setView] = useState('connect')
  const [connecting, setConnecting] = useState(false)
  const [connectErr, setConnectErr] = useState('')
  const [form, setForm] = useState({ host: 'localhost', port: '25575', password: '', remember: false })
  const [info, setInfo] = useState(null)
  const [target, setTarget] = useState('')
  const [players, setPlayers] = useState([])
  const [section, setSection] = useState('powers')
  const [log, setLog] = useState([])
  const [toasts, setToasts] = useState([])
  const targetRef = useRef(target)
  targetRef.current = target

  const toast = useCallback((text, kind = 'info') => {
    const id = nextId()
    setToasts(t => [...t, { id, text, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000)
  }, [])

  const addLog = useCallback((entry) => {
    setLog(l => [...l.slice(-200), { id: nextId(), time: nowClock(), ...entry }])
  }, [])

  // --------------------------- açılış
  useEffect(() => {
    ;(async () => {
      const s = await api().getSettings()
      if (s && s.conn) setForm(f => ({ ...f, ...s.conn }))
      const st = await api().status()
      if (st && st.connected) { setInfo(st.info); setView('dash'); refreshPlayers() }
    })()
    const off = api().onClosed(() => {
      setView('connect')
      setInfo(null)
      toast('Sunucu bağlantısı kesildi.', 'err')
    })
    return () => off && off()
  }, [])

  // --------------------------- komut çalıştırma
  const exec = useCallback(async (cmd) => {
    const res = await api().command(cmd)
    return res
  }, [])

  // Sessiz sorgu (durum okuma) — log'a yazmaz
  const query = useCallback(async (cmd) => {
    const res = await api().command(cmd)
    return res && res.ok ? cleanResponse(res.response) : null
  }, [])

  // Butonların ana çalıştırıcısı
  const run = useCallback(async (cmds, opts = {}) => {
    const list = Array.isArray(cmds) ? cmds : [cmds]
    const needsTarget = list.some(c => c.includes('{t}'))
    const t = targetRef.current.trim()
    if (needsTarget && !t) {
      toast('Önce sol menüden bir hedef oyuncu seç.', 'err')
      return []
    }
    const results = []
    for (const raw of list) {
      const cmd = applyTarget(raw, t)
      const res = await api().command(cmd)
      const clean = res && res.ok ? cleanResponse(res.response) : (res && res.message) || 'hata'
      addLog({ cmd, resp: clean, ok: res && res.ok })
      results.push(res)
      if (res && !res.ok) toast(res.message || 'Komut çalıştırılamadı.', 'err')
    }
    return results
  }, [addLog, toast])

  const refreshPlayers = useCallback(async () => {
    const res = await api().command('list')
    if (res && res.ok) {
      const names = parsePlayers(cleanResponse(res.response))
      setPlayers(names)
      if (!targetRef.current && names.length) setTarget(names[0])
    }
  }, [])

  // --------------------------- bağlan / kes
  const connect = useCallback(async () => {
    setConnecting(true)
    setConnectErr('')
    const res = await api().connect({ host: form.host.trim(), port: form.port.trim(), password: form.password })
    setConnecting(false)
    if (!res.ok) { setConnectErr(res.message || 'Bağlanılamadı.'); return }
    setInfo({ host: form.host.trim(), port: Number(form.port) || 25575 })
    const conn = { host: form.host.trim(), port: form.port.trim(), remember: form.remember }
    if (form.remember) conn.password = form.password
    api().setSettings({ conn })
    setView('dash')
    setLog([])
    toast('Sunucuya bağlanıldı 🎮', 'ok')
    refreshPlayers()
  }, [form, toast, refreshPlayers])

  const disconnect = useCallback(async () => {
    await api().disconnect()
    setView('connect')
    setInfo(null)
    setPlayers([])
  }, [])

  const sectionProps = { run, query, target, players, refreshPlayers, setTarget, toast, addLog, exec }

  return (
    <div className="app">
      <TitleBar connected={view === 'dash'} info={info} />
      {view === 'connect' ? (
        <ConnectScreen form={form} setForm={setForm} onConnect={connect} connecting={connecting} error={connectErr} />
      ) : (
        <div className="dash">
          <Sidebar
            section={section} setSection={setSection}
            target={target} setTarget={setTarget}
            players={players} refreshPlayers={refreshPlayers}
            info={info} onDisconnect={disconnect}
          />
          <div className="content">
            <div className="content-scroll" key={section}>
              {section === 'powers' && <PowersSection {...sectionProps} />}
              {section === 'items' && <ItemsSection {...sectionProps} />}
              {section === 'teleport' && <TeleportSection {...sectionProps} />}
              {section === 'world' && <WorldSection {...sectionProps} />}
              {section === 'players' && <PlayersSection {...sectionProps} />}
              {section === 'console' && <ConsoleSection {...sectionProps} />}
            </div>
            <LogPanel log={log} onClear={() => setLog([])} />
          </div>
        </div>
      )}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span>{t.kind === 'err' ? '⚠️' : t.kind === 'ok' ? '✅' : '💡'}</span>
            <div>{t.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
