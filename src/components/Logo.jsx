import React from 'react'

// The mark: a beacon on a three-step pyramid, its beam going up.
export default function Logo({ size = 24, lit = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden="true">
      <defs>
        <linearGradient id="lg-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#eafdff" />
          <stop offset=".6" stopColor="#8ef6ff" stopOpacity=".85" />
          <stop offset="1" stopColor="#8ef6ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {lit && <rect x="14" y="0" width="4" height="13" fill="url(#lg-beam)" />}
      <rect x="2" y="26" width="28" height="5" fill="#2b1f40" />
      <rect x="2" y="26" width="28" height="1" fill="#4a3870" />
      <rect x="6" y="21" width="20" height="5" fill="#3a2b57" />
      <rect x="6" y="21" width="20" height="1" fill="#5e4a8f" />
      <rect x="10" y="16" width="12" height="5" fill="#4d3a75" />
      <rect x="10" y="16" width="12" height="1" fill="#7a62b0" />
      <rect x="12" y="10" width="8" height="7" fill="#bff3fa" />
      <rect x="13" y="11" width="6" height="5" fill="#5fd0e2" />
      <rect x="14" y="12" width="4" height="3" fill={lit ? '#ffffff' : '#9fdde6'} />
    </svg>
  )
}
