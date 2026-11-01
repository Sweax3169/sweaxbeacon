'use strict'

// Talks to native/bin/sweax-helper.exe (see native/SweaxHelper.cs): one long
// running process, JSON lines both ways, started on first use.

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

let proc = null
let buf = ''
let seq = 0
const waiting = new Map()

function exePath() {
  const candidates = [
    process.resourcesPath && path.join(process.resourcesPath, 'native', 'sweax-helper.exe'),
    path.join(__dirname, '..', '..', 'native', 'bin', 'sweax-helper.exe'),
  ].filter(Boolean)
  return candidates.find(p => fs.existsSync(p)) || candidates[candidates.length - 1]
}

function start() {
  if (proc) return proc
  proc = spawn(exePath(), [], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
  proc.stdout.setEncoding('utf8')
  proc.stdout.on('data', (chunk) => {
    buf += chunk
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      let msg
      try { msg = JSON.parse(line) } catch (e) { continue }
      const w = waiting.get(msg.id)
      if (!w) continue
      waiting.delete(msg.id)
      clearTimeout(w.timer)
      if (msg.ok) w.resolve(msg.data)
      else w.reject(new Error(msg.error || 'helper error'))
    }
  })
  const fail = () => {
    proc = null
    for (const [, w] of waiting) { clearTimeout(w.timer); w.reject(new Error('helper-exited')) }
    waiting.clear()
  }
  proc.on('exit', fail)
  proc.on('error', fail)
  return proc
}

function call(op, args = {}, timeout = 15000) {
  return new Promise((resolve, reject) => {
    let p
    try { p = start() } catch (e) { reject(e); return }
    const id = ++seq
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error('helper-timeout')) }, timeout)
    waiting.set(id, { resolve, reject, timer })
    try { p.stdin.write(JSON.stringify({ id, op, ...args }) + '\n') } catch (e) {
      clearTimeout(timer); waiting.delete(id); reject(e)
    }
  })
}

function stop() {
  if (proc) { try { proc.stdin.end() } catch (e) { /* gone */ } proc = null }
}

module.exports = { call, stop, exePath }
