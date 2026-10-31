// SweaxPanel ikonu: konsol/komut temalı, şeker gradyanlı
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff4fa3"/>
      <stop offset="1" stop-color="#9b5cff"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d0f2e"/>
      <stop offset="1" stop-color="#120a1c"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="10" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="96" y="120" width="320" height="272" rx="36" fill="none" stroke="url(#g)" stroke-width="20" filter="url(#glow)"/>
  <path d="M168 210 L232 256 L168 302" fill="none" stroke="url(#g)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
  <rect x="252" y="288" width="96" height="20" rx="10" fill="url(#g)" filter="url(#glow)"/>
  <circle cx="150" cy="440" r="15" fill="#ff4fa3"/>
  <circle cx="256" cy="440" r="15" fill="#c95cd6"/>
  <circle cx="362" cy="440" r="15" fill="#9b5cff"/>
</svg>`

const master = await sharp(Buffer.from(svg)).png().toBuffer()
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = []
for (const s of sizes) pngs.push(await sharp(master).resize(s, s).png().toBuffer())
fs.writeFileSync(path.join(dir, 'icon.ico'), await pngToIco(pngs))
fs.writeFileSync(path.join(dir, 'icon-512.png'), await sharp(master).resize(512, 512).png().toBuffer())
console.log('icon.ico + icon-512.png üretildi')
