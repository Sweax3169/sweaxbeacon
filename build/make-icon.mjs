// SweaxBeacon app icon: the beacon on its three-step pyramid, on an obsidian block.
//   node build/make-icon.mjs
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))

// Drawn on a 32 x 32 grid so every size stays sharp.
const svg = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
  <defs>
    <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#f2feff"/>
      <stop offset=".55" stop-color="#8ef6ff" stop-opacity=".9"/>
      <stop offset="1" stop-color="#8ef6ff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="halo" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#8ef6ff" stop-opacity=".35"/>
      <stop offset="1" stop-color="#8ef6ff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="32" height="32" rx="3" fill="#120d1b"/>
  <rect x="1" y="1" width="30" height="1" fill="#2c2340"/>
  <rect x="1" y="1" width="1" height="30" fill="#2c2340"/>
  <rect x="1" y="30" width="30" height="1" fill="#07050b"/>
  <rect x="30" y="1" width="1" height="30" fill="#07050b"/>
  <rect x="12" y="2" width="8" height="12" fill="url(#halo)"/>
  <rect x="14" y="2" width="4" height="12" fill="url(#beam)"/>
  <rect x="4" y="25" width="24" height="4" fill="#2b1f40"/>
  <rect x="4" y="25" width="24" height="1" fill="#4a3870"/>
  <rect x="7" y="21" width="18" height="4" fill="#3a2b57"/>
  <rect x="7" y="21" width="18" height="1" fill="#5e4a8f"/>
  <rect x="10" y="17" width="12" height="4" fill="#4d3a75"/>
  <rect x="10" y="17" width="12" height="1" fill="#7a62b0"/>
  <rect x="12" y="11" width="8" height="7" fill="#bff3fa"/>
  <rect x="13" y="12" width="6" height="5" fill="#5fd0e2"/>
  <rect x="14" y="13" width="4" height="3" fill="#ffffff"/>
</svg>`

const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = []
for (const s of sizes) pngs.push(await sharp(Buffer.from(svg(s))).png().toBuffer())
fs.writeFileSync(path.join(dir, 'icon.ico'), await pngToIco(pngs))
fs.writeFileSync(path.join(dir, 'icon-512.png'), await sharp(Buffer.from(svg(512))).png().toBuffer())
fs.writeFileSync(path.join(dir, 'icon.svg'), svg(512))
console.log('icon.ico, icon-512.png, icon.svg')
