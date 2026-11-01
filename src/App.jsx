import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { api, nextId, clock, parseList, parsePos, parseEffects, GAMEMODE_BY_NUMBER } from './util.js'
import { RULES, ruleName, rulesStyleFor } from './data/catalog.js'
import TitleBar from './components/TitleBar.jsx'
import Rail from './components/Rail.jsx'
import Hotbar, { SECTIONS } from './components/Hotbar.jsx'
import Feed from './components/Feed.jsx'
import Gate, { GATED } from './components/Gate.jsx'
import RemoteModal from './components/RemoteModal.jsx'
import Powers from './sections/Powers.jsx'
import Items from './sections/Items.jsx'
import Teleport from './sections/Teleport.jsx'
import World from './sections/World.jsx'
import Players from './sections/Players.jsx'
import Console from './sections/Console.jsx'
import Settings from './sections/Settings.jsx'
import CheatsBanner from './components/CheatsBanner.jsx'

const RUN_ERRORS = {
  'no-window': 'Oyun penceresi bulunamadı.',
  'pause-off': 'Oyunda F3+P ile "odak kaybında duraklat" ayarını aç.',
  'not-in-world': 'Önce bir dünyaya gir.',
  'no-key': 'Oyunda sohbet tuşu klavyede değil.',
  'no-reply': 'Oyun o an meşguldü; komut gitmedi. Tekrar dene.',
  'skipped': 'Gönderilmedi.',
  'closed': 'Bağlantı kapandı.',
  'timeout': 'Sunucu yanıt vermedi.',
  'send-failed': 'Oyuna yazılamadı.',
  'no-target': 'Önce bir dünya seç.',
  loading: 'Dünya hâlâ yükleniyor; birkaç saniye sonra tekrar dene.',
}
export const runError = (code) => RUN_ERRORS[code] || 'Komut gönderilemedi.'

function useTheme(theme) {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const resolved = theme === 'system' ? (systemDark ? 'obsidian' : 'quartz') : (theme || 'obsidian')
  useEffect(() => { document.documentElement.dataset.theme = resolved }, [resolved])
  return resolved
}

export default function App() {
  const [version, setVersion] = useState('')
  const [settings, setSettings] = useState({ theme: 'obsidian', waypoints: {} })
  const [targets, setTargets] = useState([])
  const [link, setLink] = useState(undefined)
  const [scanning, setScanning] = useState(true)
  const [section, setSection] = useState('powers')
  const [who, setWho] = useState(null)
  const [players, setPlayers] = useState([])
  const [rcon, setRcon] = useState({})
  const [log, setLog] = useState([])
  const [feed, setFeed] = useState([])
  const [busy, setBusy] = useState(0)
  const [pulse, setPulse] = useState(0)
  const [modal, setModal] = useState(null)
  const [pollKick, setPollKick] = useState(0)
  const theme = useTheme(settings.theme)

  // ---------------------------------------------------------------- wiring
  useEffect(() => {
    let alive = true
    api().get().then((s) => {
      if (!alive) return
      setVersion(s.version)
      setSettings(s.settings)
      setTargets(s.targets || [])
      setLink(s.active || null)
      setScanning(!!s.scanning)
    })
    const offs = [
      api().onTargets((v) => { setTargets(v.targets || []); setLink(v.active || null); setScanning(!!v.scanning) }),
      api().onLink((v) => setLink(v || null)),
    ]
    const t = setTimeout(() => setScanning(false), 6000)
    return () => { alive = false; clearTimeout(t); offs.forEach(o => o && o()) }
  }, [])

  const mode = link ? link.mode : null
  const status = link ? link.status : null
  const target = link ? link.target : null
  const game = link ? link.game : null
  const canRun = status === 'ready' || status === 'cheats'

  // A new world: forget the old one's players and state.
  const linkKey = link ? link.key : null
  useEffect(() => { setWho(null); setPlayers([]); setRcon({}) }, [linkKey])

  // ---------------------------------------------------------------- who the buttons act on
  const selector = useMemo(() => {
    if (who) return who
    if (mode === 'chat') return '@s'
    if (players.length === 1) return players[0]
    return '@a'
  }, [who, mode, players])

  // ---------------------------------------------------------------- feed + log
  const pushFeed = useCallback((lines) => {
    const list = (Array.isArray(lines) ? lines : [lines]).map(l => ({ id: nextId(), ...l }))
    setFeed(f => [...f, ...list].slice(-4))
  }, [])

  // ---------------------------------------------------------------- run
  const run = useCallback(async (label, cmds, opts = {}) => {
    if (!canRun) { pushFeed({ kind: 'bad', text: link ? 'Bu dünya henüz hazır değil.' : 'Önce bir dünya seç.' }); return null }
    const list = (typeof cmds === 'function' ? cmds(selector) : cmds).map(c => String(c).replace(/\{t\}/g, selector))
    if (!list.length) return null
    const id = nextId()
    setBusy(b => b + 1)
    setPulse(p => p + 1)
    setLog(l => [...l.slice(-300), { id, time: clock(), label, mode, items: list.map(cmd => ({ cmd })), pending: true }])
    let res
    try { res = await api().run(list) } catch (e) { res = { ok: false, error: 'send-failed' } }
    setBusy(b => b - 1)
    if (!res || !res.ok) {
      const text = runError(res && res.error)
      setLog(l => l.map(e => e.id === id ? { ...e, pending: false, error: text } : e))
      if (!opts.silent) pushFeed({ kind: 'bad', text: `${label}: ${text}` })
      return res
    }
    setLog(l => l.map(e => e.id === id ? { ...e, pending: false, items: res.results } : e))
    if (!opts.silent) {
      const lines = []
      for (const r of res.results) {
        if (r.error) lines.push({ kind: 'bad', text: runError(r.error) })
        else if (r.resp) for (const t of r.resp.split('\n').slice(0, 3)) lines.push({ kind: r.ok ? 'ok' : 'bad', text: t })
      }
      if (!lines.length) lines.push({ kind: 'ok', text: `${label} ✓` })
      pushFeed(lines.slice(0, 4))
    }
    setPollKick(k => k + 1)
    return res
  }, [canRun, selector, mode, link, pushFeed])

  // ---------------------------------------------------------------- live state over RCON
  const ruleStyleR = useRef(null)
  useEffect(() => {
    if (mode !== 'rcon' || status !== 'ready') return
    let stop = false
    const q = (c) => api().query(c)
    const tick = async () => {
      if (ruleStyleR.current == null) {
        const guess = rulesStyleFor(target && target.version)
        if (guess) ruleStyleR.current = guess
        else {
          const r = await q('gamerule keepInventory')
          ruleStyleR.current = r && /Incorrect argument|Unknown/i.test(r) ? 'snake' : 'camel'
        }
      }
      const list = await q('list')
      if (stop) return
      const names = parseList(list || '')
      setPlayers(names)
      const one = who && !who.startsWith('@') ? who : (names.length === 1 ? names[0] : null)
      const next = { rulesStyle: ruleStyleR.current, online: names.length, one }
      if (one && (section === 'powers' || section === 'teleport')) {
        const gm = await q(`data get entity ${one} playerGameType`)
        const m = /:\s*(\d)\s*$/.exec(gm || '')
        next.gamemode = m ? GAMEMODE_BY_NUMBER[Number(m[1])] : null
        next.effects = parseEffects(await q(`data get entity ${one} active_effects`))
        next.pos = parsePos(await q(`data get entity ${one} Pos`))
        const dim = await q(`data get entity ${one} Dimension`)
        const d = /"minecraft:([a-z_]+)"/.exec(dim || '')
        next.dimension = d ? d[1] : null
      }
      if (section === 'world' || !rcon.difficulty) {
        const tq = await q('time query daytime')
        const tm = /(\d+)\s*$/.exec(tq || '')
        next.dayTime = tm ? Number(tm[1]) : null
        const dq = await q('difficulty')
        const dm = /(peaceful|easy|normal|hard)/i.exec(dq || '')
        next.difficulty = dm ? dm[1].toLowerCase() : null
        if (section === 'world') {
          const rules = {}
          for (const r of RULES) {
            const name = ruleName(r, ruleStyleR.current)
            const v = await q(`gamerule ${name}`)
            const vm = /:\s*(\S+)\s*$/.exec(v || '')
            if (vm) rules[name] = vm[1] === 'true' ? true : vm[1] === 'false' ? false : Number(vm[1])
          }
          next.rules = rules
        }
      }
      if (!stop) setRcon(s => ({ ...s, ...next }))
    }
    tick()
    const id = setInterval(tick, 4000)
    return () => { stop = true; clearInterval(id) }
  }, [mode, status, section, who, linkKey, pollKick])
  useEffect(() => { ruleStyleR.current = null }, [linkKey])

  // ---------------------------------------------------------------- one picture of the world, whichever link
  const ws = useMemo(() => {
    if (mode === 'chat') {
      const w = game && game.world
      const p = w && w.player
      return {
        gamemode: p ? p.gamemode : null,
        effects: new Set(p ? p.effects.map(e => e.id) : []),
        dayTime: w ? w.dayTime : null,
        weather: w ? (w.thundering ? 'thunder' : w.raining ? 'rain' : 'clear') : null,
        difficulty: w ? w.difficulty : null,
        rules: w ? w.rules : null,
        rulesStyle: w ? w.rulesStyle : rulesStyleFor(target && target.version),
        pos: p ? p.pos : null,
        dimension: p ? p.dimension : null,
        spawn: w ? w.spawn : null,
        worldName: w ? w.name : null,
        self: selector === '@s' || (game && selector === game.username),
      }
    }
    if (mode === 'rcon') return { ...rcon, effects: rcon.effects || new Set(), self: !!rcon.one && (selector === rcon.one || selector === '@a' && players.length === 1) }
    return { effects: new Set() }
  }, [mode, game, rcon, selector, target, players])

  // ---------------------------------------------------------------- keys 1..7
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.altKey || e.metaKey) return
      const i = Number(e.key) - 1
      if (i >= 0 && i < SECTIONS.length) { setSection(SECTIONS[i].key); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const saveSettings = useCallback(async (patch) => {
    setSettings(s => ({ ...s, ...patch }))
    const s = await api().setSettings(patch)
    if (s && s.theme) setSettings(s)
  }, [])

  const gated = link === null || (link && GATED.has(status))
  const props = { run, ws, mode, status, target, game, link, selector, setWho, players, settings, saveSettings, pushFeed, log, setLog, version, theme, openRemote: () => setModal('remote') }

  return (
    <div className="app">
      <TitleBar link={link} targets={targets} scanning={scanning} pulse={pulse} busy={busy > 0} onAddRemote={() => setModal('remote')} />
      <div className="main">
        <Rail {...props} who={who} />
        <div className="stage">
          <div className="stage-scroll">
            {link === undefined ? null : gated && section !== 'settings' && section !== 'console' ? (
              <Gate link={link} targets={targets} scanning={scanning} onAddRemote={() => setModal('remote')} />
            ) : (
              <div className="page" key={section}>
                {status === 'cheats' && section !== 'settings' && <CheatsBanner game={game} />}
                {section === 'powers' && <Powers {...props} />}
                {section === 'items' && <Items {...props} />}
                {section === 'teleport' && <Teleport {...props} />}
                {section === 'world' && <World {...props} />}
                {section === 'players' && <Players {...props} />}
                {section === 'console' && <Console {...props} />}
                {section === 'settings' && <Settings {...props} targets={targets} />}
              </div>
            )}
          </div>
        </div>
      </div>
      <Hotbar section={section} setSection={setSection} busy={busy > 0} mode={mode}>
        <Feed lines={feed} />
      </Hotbar>
      {modal === 'remote' && <RemoteModal onClose={() => setModal(null)} />}
    </div>
  )
}
