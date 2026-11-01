'use strict'

// End-to-end test of server discovery and setup against a real server folder.
//
//   node tools/test/server-test.cjs --dir=<server folder> --version=1.21.4
//
// Expects that server to be running with RCON switched off. Then, the way the
// app does it: finds it, switches RCON on, has it restarted (the test stops it,
// SweaxBeacon's own start button starts it again in a console window), waits
// until the remote console answers and runs real commands over it.

const path = require('path')
const { execFileSync } = require('child_process')
const helper = require('../../electron/sys/helper.cjs')
const { discover } = require('../../electron/mc/discover.cjs')
const { enableRcon, startServer, startPlan } = require('../../electron/mc/servers.cjs')
const props = require('../../electron/mc/props.cjs')
const { RconLink } = require('../../electron/mc/links.cjs')

const arg = (n, d) => { const a = process.argv.find(s => s.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d }
const DIR = path.resolve(arg('dir'))
const VERSION = arg('version', '1.21.4')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
let failures = 0
const check = (ok, what, extra) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${extra ? '  ' + extra : ''}`); if (!ok) failures++ }
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()

async function find() {
  const r = await discover({ known: [DIR] })
  return r.servers.find(s => same(s.dir, DIR))
}

;(async () => {
  let s = await find()
  check(s && s.running, 'running server found from its process', s && `${s.software} ${s.versionLabel}, pid ${s.pid}`)
  check(s && !s.rcon.enabled, 'RCON is off in server.properties')
  check(s && s.version === VERSION, 'version from the server list ping', s && s.version)

  const before = props.read(DIR)
  const res = await enableRcon(DIR)
  const after = props.read(DIR)
  check(after['enable-rcon'] === 'true', 'enable-rcon=true written')
  check(after['rcon.password'] && after['rcon.password'].length >= 20, 'random password written', `${after['rcon.password'].length} characters`)
  check(Number(after['rcon.port']) === res.port && res.port !== Number(after['server-port']), 'free RCON port chosen', String(res.port))
  check(after.motd === before.motd && after['server-port'] === before['server-port'], 'other settings untouched')

  s = await find()
  check(s && s.running && s.rcon.enabled && !s.rcon.listening, 'needs a restart: RCON on in the file, not listening yet')

  // The player restarts the server; here the test stops it.
  execFileSync('taskkill', ['/PID', String(s.pid), '/F'], { stdio: 'ignore' })
  for (let i = 0; i < 100; i++) { s = await find(); if (s && !s.running) break; await sleep(300) }
  check(s && !s.running, 'server folder still known while stopped')

  const plan = startPlan(DIR, VERSION)
  check(plan.kind === 'jar' && plan.java, 'start plan', `${plan.jar} with Java ${plan.javaMajor}`)
  startServer(DIR, VERSION, 'SweaxBeacon test server')
  const t0 = Date.now()
  for (;;) {
    s = await find()
    if (s && s.running && s.rcon.listening) break
    if (Date.now() - t0 > 120000) break
    await sleep(1000)
  }
  check(s && s.running && s.rcon.listening, 'started by SweaxBeacon, RCON listening', `${((Date.now() - t0) / 1000).toFixed(1)} s`)

  const link = new RconLink({ host: '127.0.0.1', port: s.rcon.port, password: props.read(DIR)['rcon.password'] })
  await link.open()
  const r = await link.run(['list', 'difficulty', 'time query daytime', 'gamerule keepInventory', 'weather clear', 'gamemode creative NoSuchPlayer'])
  for (const x of r) console.log('   ', x.cmd, '=>', JSON.stringify(x.resp.slice(0, 120)), x.ok ? '' : '(error)')
  check(/players online/i.test(r[0].resp), 'list over RCON')
  check(/difficulty/i.test(r[1].resp), 'difficulty over RCON')
  check(/time is/i.test(r[2].resp), 'time over RCON')
  check(/keepInventory/i.test(r[3].resp), 'gamerule over RCON')
  check(r[4].ok, 'weather over RCON')
  check(!r[5].ok, 'unknown player reported as an error', r[5].resp)
  const help = await link.query('minecraft:help')
  check(help && help.length > 4096, 'reply longer than one RCON packet is joined', `${help && help.length} characters`)

  const bad = new RconLink({ host: '127.0.0.1', port: s.rcon.port, password: 'wrong-password' })
  let code = null
  try { await bad.open() } catch (e) { code = e.code }
  check(code === 'auth', 'wrong password is reported as such', code)

  await link.run(['stop'])
  link.close()
  for (let i = 0; i < 60; i++) { s = await find(); if (s && !s.running) break; await sleep(500) }
  check(s && !s.running, 'stopped over RCON')
  try { execFileSync('taskkill', ['/FI', 'WINDOWTITLE eq SweaxBeacon test server*', '/T', '/F'], { stdio: 'ignore' }) } catch (e) { /* window already closed */ }
  helper.stop()
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED')
  process.exit(failures ? 1 : 0)
})().catch((e) => { console.error('ERROR', e.stack); helper.stop(); process.exit(1) })
