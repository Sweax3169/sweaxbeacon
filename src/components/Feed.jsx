import React from 'react'

// Replies show up bottom-left like game chat, then fade; the Console page keeps them all.
export default function Feed({ lines }) {
  return (
    <div className="feed" aria-live="polite">
      {lines.map(l => (
        <div key={l.id} className={`feed-line ${l.kind || ''}`} title={l.text}>{l.text}</div>
      ))}
    </div>
  )
}
