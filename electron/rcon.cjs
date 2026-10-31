'use strict'

// SWEAXPANEL — Minecraft RCON istemcisi (Source RCON protokolü)
// Bağımlılıksız: sadece Node'un net modülü. Promise tabanlı.

const net = require('net')

const TYPE_AUTH = 3
const TYPE_EXEC = 2
const TYPE_RESPONSE = 0
const TYPE_AUTH_RESPONSE = 2 // sunucudan gelen

function encode(id, type, body) {
  const bodyBuf = Buffer.from(body, 'utf8')
  const len = 4 + 4 + bodyBuf.length + 2
  const buf = Buffer.alloc(4 + len)
  buf.writeInt32LE(len, 0)
  buf.writeInt32LE(id, 4)
  buf.writeInt32LE(type, 8)
  bodyBuf.copy(buf, 12)
  buf.writeInt8(0, 12 + bodyBuf.length)
  buf.writeInt8(0, 12 + bodyBuf.length + 1)
  return buf
}

class Rcon {
  constructor() {
    this.socket = null
    this.reqId = 0
    this.pending = new Map()
    this.buffer = Buffer.alloc(0)
    this.connected = false
    this.authResolve = null
    this.authReject = null
    this.authId = null
    this.onClose = null
  }

  connect(host, port, password, timeout = 8000) {
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (fn, arg) => { if (!settled) { settled = true; clearTimeout(to); fn(arg) } }

      const to = setTimeout(() => {
        finish(reject, new Error('timeout'))
        this.destroy()
      }, timeout)

      this.socket = net.createConnection({ host, port: Number(port) })
      this.socket.setNoDelay(true)

      this.socket.on('connect', () => {
        this.authId = this._nextId()
        this.authResolve = () => { this.connected = true; finish(resolve, true) }
        this.authReject = (e) => finish(reject, e)
        this.socket.write(encode(this.authId, TYPE_AUTH, password))
      })

      this.socket.on('data', (chunk) => this._onData(chunk))

      this.socket.on('error', (err) => {
        finish(reject, this._friendly(err))
        // bağlantı sonrası hatalarda pending'leri düşür
        this._failAll(err)
      })

      this.socket.on('close', () => {
        this.connected = false
        this._failAll(new Error('closed'))
        if (this.onClose) this.onClose()
      })
    })
  }

  _friendly(err) {
    const code = err && err.code
    if (code === 'ECONNREFUSED') return new Error('refused')
    if (code === 'ETIMEDOUT') return new Error('timeout')
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return new Error('host')
    if (code === 'ECONNRESET') return new Error('reset')
    return err instanceof Error ? err : new Error(String(err))
  }

  _nextId() {
    this.reqId = (this.reqId + 1) & 0x7fffffff
    if (this.reqId === 0) this.reqId = 1
    return this.reqId
  }

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    while (this.buffer.length >= 4) {
      const len = this.buffer.readInt32LE(0)
      if (len < 10 || this.buffer.length < 4 + len) break
      const packet = this.buffer.subarray(0, 4 + len)
      this.buffer = this.buffer.subarray(4 + len)
      const id = packet.readInt32LE(4)
      const type = packet.readInt32LE(8)
      const body = packet.toString('utf8', 12, 4 + len - 2)
      this._handle(id, type, body)
    }
  }

  _handle(id, type, body) {
    // Kimlik doğrulama yanıtı
    if (this.authResolve && type === TYPE_AUTH_RESPONSE) {
      if (id === -1) {
        const rej = this.authReject
        this.authResolve = this.authReject = null
        if (rej) rej(new Error('auth'))
      } else {
        const res = this.authResolve
        this.authResolve = this.authReject = null
        if (res) res()
      }
      return
    }
    // Boş type-0 (auth öncesi bazı sunucularda) — pending yoksa yok say
    if (type === TYPE_RESPONSE) {
      const p = this.pending.get(id)
      if (p) {
        clearTimeout(p.timer)
        this.pending.delete(id)
        p.resolve(body)
      }
    }
  }

  command(cmd, timeout = 6000) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.socket) { reject(new Error('notconnected')); return }
      const id = this._nextId()
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('timeout'))
      }, timeout)
      this.pending.set(id, { resolve, reject, timer })
      try {
        this.socket.write(encode(id, TYPE_EXEC, cmd))
      } catch (e) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(this._friendly(e))
      }
    })
  }

  _failAll(err) {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(err)
    }
    this.pending.clear()
  }

  destroy() {
    try { if (this.socket) this.socket.destroy() } catch (e) { /* zaten kapalı */ }
    this.connected = false
  }
}

module.exports = { Rcon }
