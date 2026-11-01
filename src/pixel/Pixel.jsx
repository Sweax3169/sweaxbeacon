import React from 'react'
import icons from './icons.json'

// Icons from tools/pixel_icons.py, drawn once to a 16x16 canvas and kept as data URLs.
const cache = new Map()

export function iconUrl(name) {
  if (cache.has(name)) return cache.get(name)
  const ic = icons[name]
  if (!ic) return null
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 16
  const g = c.getContext('2d')
  ic.r.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.') continue
      g.fillStyle = ic.p[ch]
      g.fillRect(x, y, 1, 1)
    }
  })
  const url = c.toDataURL()
  cache.set(name, url)
  return url
}

export function Px({ name, size = 32, className = '', style }) {
  const url = iconUrl(name)
  if (!url) return null
  return <img className={'px ' + className} src={url} width={size} height={size} style={style} alt="" draggable={false} />
}

// A face for a player name: 8x8, built from the name so the same player always
// gets the same face. Not anyone's skin; the game's skins are not read.
const SKIN = ['#f3d2b3', '#e8be98', '#d8a77f', '#b8865f', '#8f5f3e', '#6a442b']
const HAIR = ['#1f1712', '#3b2619', '#5e3f26', '#8a5a2e', '#c99a4a', '#e2c77c', '#1f2430', '#6e2e2e', '#d8d2c4', '#2f4f7a', '#4c2f5e']
const EYES = ['#2e9e6a', '#3a7bd5', '#6b4a2b', '#7a4fd6', '#2b2b2b', '#2aa5a0', '#b05a2a']
const faces = new Map()

function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function faceUrl(name) {
  const key = String(name || '?')
  if (faces.has(key)) return faces.get(key)
  const low = key.toLowerCase()
  const pick = (arr, salt) => arr[hash(low + '|' + salt) % arr.length]
  const skin = pick(SKIN, 'skin'), hair = pick(HAIR, 'hair'), eye = pick(EYES, 'eyes')
  const style = hash(low + '|style') % 4
  const beard = hash(low + '|beard') % 5 === 0
  const shade = shadeOf(skin)
  const S = skin, H = hair, W = '#ffffff', E = eye, M = shadeOf(shade), D = shade
  const rows = [
    [H, H, H, H, H, H, H, H],
    style === 1 ? [H, H, H, H, H, H, S, H] : [H, H, H, H, H, H, H, H],
    style === 0 ? [H, S, S, S, S, S, S, H] : style === 2 ? [H, H, S, S, S, S, H, H] : [H, S, S, S, S, H, H, H],
    style === 3 ? [H, S, S, S, S, S, S, S] : [S, S, S, S, S, S, S, S],
    [S, W, E, S, S, E, W, S],
    [S, S, S, D, D, S, S, S],
    beard ? [S, H, M, M, M, M, H, S] : [S, S, M, M, M, M, S, S],
    beard ? [S, H, H, H, H, H, H, S] : [S, S, S, S, S, S, S, S],
  ]
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 8
  const g = c.getContext('2d')
  rows.forEach((r, y) => r.forEach((col, x) => { g.fillStyle = col; g.fillRect(x, y, 1, 1) }))
  const url = c.toDataURL()
  faces.set(key, url)
  return url
}

function shadeOf(hex) {
  const n = parseInt(hex.slice(1), 16)
  const f = (v) => Math.max(0, Math.round(v * 0.8))
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255)
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
}

export function Face({ name, size = 30 }) {
  return <img className="px" src={faceUrl(name)} width={size} height={size} alt="" draggable={false} />
}
