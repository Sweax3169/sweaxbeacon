'use strict'

// server.properties: read into a map, write back changed keys in place so the
// file keeps its comments and order. Values use the Java .properties escapes.

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function unescape(v) {
  return v.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (m, e) => {
    if (e[0] === 'u' && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16))
    return { t: '\t', n: '\n', r: '\r', f: '\f' }[e] || e
  })
}

function escape(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/[:=]/g, (c) => '\\' + c)
}

const KEY = /^((?:\\.|[^=:\s\\])+)/

function parse(text) {
  const map = {}
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line[0] === '#' || line[0] === '!') continue
    const k = KEY.exec(line)
    if (!k) continue
    const rest = line.slice(k[1].length).replace(/^\s*[=:]?\s*/, '')
    map[unescape(k[1])] = unescape(rest)
  }
  return map
}

function read(dir) {
  const file = path.join(dir, 'server.properties')
  try { return parse(fs.readFileSync(file, 'utf8')) } catch (e) { return null }
}

// Sets keys, keeping every other line untouched. Missing keys go at the end.
function write(dir, changes) {
  const file = path.join(dir, 'server.properties')
  const text = fs.readFileSync(file, 'utf8')
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const left = new Map(Object.entries(changes))
  const lines = text.split(/\r?\n/).map((raw) => {
    const line = raw.trim()
    if (!line || line[0] === '#' || line[0] === '!') return raw
    const k = KEY.exec(line)
    if (!k) return raw
    const key = unescape(k[1])
    if (!left.has(key)) return raw
    const v = left.get(key)
    left.delete(key)
    return `${k[1]}=${escape(v)}`
  })
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  for (const [k, v] of left) lines.push(`${k}=${escape(v)}`)
  fs.writeFileSync(file, lines.join(eol) + eol, 'utf8')
}

function newPassword() {
  return crypto.randomBytes(18).toString('base64url')
}

module.exports = { parse, read, write, newPassword }
