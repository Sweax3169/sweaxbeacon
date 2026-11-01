'use strict'

// Compiles native/SweaxHelper.cs into native/bin/sweax-helper.exe with the C#
// compiler that ships with .NET Framework 4 on every Windows 10 and 11 PC.
//
//   node tools/build-helper.cjs

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const windir = process.env.WINDIR || 'C:\\Windows'
const csc = path.join(windir, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')
if (!fs.existsSync(csc)) { console.error('csc.exe not found at ' + csc); process.exit(1) }

const outDir = path.join(ROOT, 'native', 'bin')
fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'sweax-helper.exe')
const r = spawnSync(csc, [
  '/nologo', '/optimize+', '/platform:x64', '/target:exe',
  '/reference:System.Web.Extensions.dll',
  '/out:' + out,
  path.join(ROOT, 'native', 'SweaxHelper.cs'),
], { stdio: 'inherit' })
if (r.status !== 0) process.exit(r.status || 1)
console.log('built', path.relative(ROOT, out), fs.statSync(out).size, 'bytes')
