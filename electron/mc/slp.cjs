'use strict'

// Minecraft Server List Ping (the request the multiplayer screen sends). Gives
// the version, player count, a sample of player names, the MOTD and the icon,
// without RCON and without logging in.

const net = require('net')

function varint(n) {
  const out = []
  do {
    let b = n & 0x7f
    n >>>= 7
    if (n) b |= 0x80
    out.push(b)
  } while (n)
  return Buffer.from(out)
}

function readVarint(buf, off) {
  let n = 0, shift = 0, b
  do {
    if (off >= buf.length) return null
    b = buf[off++]
    n |= (b & 0x7f) << shift
    shift += 7
  } while (b & 0x80 && shift < 35)
  return { value: n, off }
}

function packet(id, payload) {
  const body = Buffer.concat([varint(id), payload])
  return Buffer.concat([varint(body.length), body])
}

function motdText(d) {
  if (d == null) return ''
  if (typeof d === 'string') return d
  let s = d.text || ''
  if (Array.isArray(d.extra)) s += d.extra.map(motdText).join('')
  return s
}

function ping(host, port, timeout = 1500) {
  return new Promise((resolve) => {
    let done = false
    let buf = Buffer.alloc(0)
    const sock = net.createConnection({ host, port })
    const finish = (v) => { if (!done) { done = true; clearTimeout(t); sock.destroy(); resolve(v) } }
    const t = setTimeout(() => finish(null), timeout)
    sock.on('error', () => finish(null))
    sock.on('connect', () => {
      const h = Buffer.from(host, 'utf8')
      const p = Buffer.alloc(2); p.writeUInt16BE(port)
      sock.write(packet(0, Buffer.concat([varint(767), varint(h.length), h, p, varint(1)])))
      sock.write(packet(0, Buffer.alloc(0)))
    })
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      const len = readVarint(buf, 0)
      if (!len || buf.length < len.off + len.value) return
      const id = readVarint(buf, len.off)
      const sl = id && readVarint(buf, id.off)
      if (!sl || id.value !== 0) return finish(null)
      try {
        const j = JSON.parse(buf.toString('utf8', sl.off, sl.off + sl.value))
        finish({
          version: j.version && j.version.name || '',
          protocol: j.version && j.version.protocol || 0,
          online: j.players ? j.players.online : 0,
          max: j.players ? j.players.max : 0,
          sample: (j.players && j.players.sample || []).map(s => s.name).filter(Boolean),
          motd: motdText(j.description).replace(/§./g, '').trim(),
          icon: typeof j.favicon === 'string' && j.favicon.startsWith('data:image/png;base64,') ? j.favicon : null,
        })
      } catch (e) { finish(null) }
    })
  })
}

module.exports = { ping }
