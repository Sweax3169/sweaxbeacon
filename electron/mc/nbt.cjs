'use strict'

// Reads Minecraft NBT (level.dat and friends). Read only; returns plain values:
// compounds become objects, lists and arrays become JS arrays, longs BigInt.

const zlib = require('zlib')
const fs = require('fs')

function parse(buf) {
  let o = 0
  const u8 = () => buf.readUInt8(o++)
  const i16 = () => { const v = buf.readInt16BE(o); o += 2; return v }
  const u16 = () => { const v = buf.readUInt16BE(o); o += 2; return v }
  const i32 = () => { const v = buf.readInt32BE(o); o += 4; return v }
  const str = () => { const n = u16(); const s = buf.toString('utf8', o, o + n); o += n; return s }
  function payload(type) {
    switch (type) {
      case 1: { const v = buf.readInt8(o); o += 1; return v }
      case 2: return i16()
      case 3: return i32()
      case 4: { const v = buf.readBigInt64BE(o); o += 8; return v }
      case 5: { const v = buf.readFloatBE(o); o += 4; return v }
      case 6: { const v = buf.readDoubleBE(o); o += 8; return v }
      case 7: { const n = i32(); const a = Array.from(buf.subarray(o, o + n), b => (b << 24) >> 24); o += n; return a }
      case 8: return str()
      case 9: { const t = u8(); const n = i32(); const a = []; for (let i = 0; i < n; i++) a.push(payload(t)); return a }
      case 10: {
        const obj = {}
        for (;;) {
          const t = u8()
          if (t === 0) return obj
          const name = str()
          obj[name] = payload(t)
        }
      }
      case 11: { const n = i32(); const a = []; for (let i = 0; i < n; i++) a.push(i32()); return a }
      case 12: { const n = i32(); const a = []; for (let i = 0; i < n; i++) { a.push(buf.readBigInt64BE(o)); o += 8 } return a }
      default: throw new Error('bad nbt tag ' + type)
    }
  }
  const t = u8()
  if (t !== 10) throw new Error('not a compound')
  str()
  return payload(10)
}

function readFile(file) {
  let raw = fs.readFileSync(file)
  if (raw[0] === 0x1f && raw[1] === 0x8b) raw = zlib.gunzipSync(raw)
  return parse(raw)
}

module.exports = { parse, readFile }
