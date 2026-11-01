'use strict'

// Listening TCP ports per process id, from `netstat -ano` (ships with Windows).

const { execFile } = require('child_process')

function listening() {
  return new Promise((resolve) => {
    execFile('netstat', ['-ano', '-p', 'TCP'], { windowsHide: true, timeout: 8000, maxBuffer: 8 << 20 }, (err, out) => {
      const byPid = new Map()
      if (err || !out) { resolve(byPid); return }
      for (const line of String(out).split(/\r?\n/)) {
        const m = line.trim().match(/^TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i)
        if (!m) continue
        const pid = Number(m[3])
        if (!byPid.has(pid)) byPid.set(pid, [])
        byPid.get(pid).push({ addr: m[1], port: Number(m[2]) })
      }
      resolve(byPid)
    })
  })
}

module.exports = { listening }
