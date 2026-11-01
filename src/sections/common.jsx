import React, { useState, useEffect, useMemo } from 'react'

export function Head({ title, children, right }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {right}
    </div>
  )
}

// Potion swirl: a few squares in the effect's colour drift up and fade.
export function Particles({ n, color }) {
  const bits = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    x: 10 + Math.random() * 80 + '%', dx: (Math.random() * 40 - 20) + 'px', d: (i * 0.05 + Math.random() * 0.12) + 's',
  })), [n])
  if (!n) return null
  return (
    <span className="particles" key={n} style={{ '--fx': color }}>
      {bits.map((b, i) => <i key={i} style={{ '--x': b.x, '--dx': b.dx, '--d': b.d }} />)}
    </span>
  )
}

// Shows the state the player just asked for until the game reports back.
export function useOptimistic(actual, ms = 6000) {
  const [over, setOver] = useState({})
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      setOver(o => { const n = {}; let changed = false; for (const [k, v] of Object.entries(o)) { if (v.until > now) n[k] = v; else changed = true } return changed ? n : o })
    }, 1000)
    return () => clearInterval(id)
  }, [])
  const get = (k) => (over[k] && over[k].until > Date.now() ? over[k].v : actual(k))
  const set = (k, v) => setOver(o => ({ ...o, [k]: { v, until: Date.now() + ms } }))
  return [get, set]
}
