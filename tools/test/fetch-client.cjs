'use strict'

// Downloads an official Minecraft Java client (jar + libraries + asset index)
// from Mojang's servers into a test folder, for the chat-link test. Sounds and
// language files are left out: the game runs silent and in English.
//
//   node tools/test/fetch-client.cjs <version> <folder>

const fs = require('fs')
const path = require('path')
const https = require('https')
const crypto = require('crypto')

const [version, folder] = process.argv.slice(2)
if (!version || !folder) { console.error('usage: fetch-client.cjs <version> <folder>'); process.exit(2) }

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'SweaxBeacon-tests' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve(get(res.headers.location)) }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(res.statusCode + ' ' + url)) }
      const parts = []
      res.on('data', d => parts.push(d))
      res.on('end', () => resolve(Buffer.concat(parts)))
    }).on('error', reject)
  })
}

async function file(url, dest, sha1) {
  if (fs.existsSync(dest)) {
    if (!sha1 || crypto.createHash('sha1').update(fs.readFileSync(dest)).digest('hex') === sha1) return
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const buf = await get(url)
  if (sha1 && crypto.createHash('sha1').update(buf).digest('hex') !== sha1) throw new Error('sha1 mismatch ' + url)
  fs.writeFileSync(dest, buf)
}

function allowed(rules) {
  if (!rules) return true
  let ok = false
  for (const r of rules) {
    const osOk = !r.os || (r.os.name === 'windows' && (!r.os.arch || r.os.arch === 'x86_64' || r.os.arch === 'x86'))
    if (r.features) continue
    if (osOk) ok = r.action === 'allow'
  }
  return ok
}

;(async () => {
  const manifest = JSON.parse(await get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'))
  const entry = manifest.versions.find(v => v.id === version)
  if (!entry) throw new Error('no such version ' + version)
  const vjson = JSON.parse(await get(entry.url))
  const root = path.resolve(folder)
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(path.join(root, 'version.json'), JSON.stringify(vjson, null, 1))
  await file(vjson.downloads.client.url, path.join(root, 'client.jar'), vjson.downloads.client.sha1)
  // The matching vanilla server, used to create test worlds.
  if (vjson.downloads.server) await file(vjson.downloads.server.url, path.join(root, 'server.jar'), vjson.downloads.server.sha1)
  const cp = []
  for (const lib of vjson.libraries) {
    if (!allowed(lib.rules)) continue
    const a = lib.downloads && lib.downloads.artifact
    if (a) {
      if (/natives-(linux|macos|osx)/.test(a.path) || /natives-windows-(arm64|x86)\./.test(a.path)) continue
      const dest = path.join(root, 'libraries', a.path)
      await file(a.url, dest, a.sha1)
      cp.push(dest)
    }
  }
  const ai = vjson.assetIndex
  await file(ai.url, path.join(root, 'assets', 'indexes', ai.id + '.json'), ai.sha1)
  // The few non-sound assets the game needs to start (title panorama, icons): ~6 MB.
  const index = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'indexes', ai.id + '.json'), 'utf8'))
  for (const [name, o] of Object.entries(index.objects)) {
    if (/^(minecraft\/sounds\/|minecraft\/lang\/|realms\/)/.test(name)) continue
    await file(`https://resources.download.minecraft.net/${o.hash.slice(0, 2)}/${o.hash}`, path.join(root, 'assets', 'objects', o.hash.slice(0, 2), o.hash), o.hash)
  }
  fs.writeFileSync(path.join(root, 'launch.json'), JSON.stringify({
    mainClass: vjson.mainClass, classpath: [...cp, path.join(root, 'client.jar')], assetIndex: ai.id,
    java: vjson.javaVersion && vjson.javaVersion.majorVersion,
  }, null, 1))
  console.log('ready', version, cp.length, 'libraries')
})().catch((e) => { console.error(e.message); process.exit(1) })
