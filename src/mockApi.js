// Demo mode: the real interface on made-up worlds, for the browser (the
// website's try-it section and `npm run dev`). A tiny command simulator keeps
// the replies and the world state believable. Nothing here reaches a game.

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const EFFECT_EN = {
  speed: 'Speed', haste: 'Haste', jump_boost: 'Jump Boost', strength: 'Strength', resistance: 'Resistance', fire_resistance: 'Fire Resistance',
  water_breathing: 'Water Breathing', night_vision: 'Night Vision', invisibility: 'Invisibility', regeneration: 'Regeneration',
  slow_falling: 'Slow Falling', dolphins_grace: "Dolphin's Grace", health_boost: 'Health Boost', glowing: 'Glowing',
  instant_health: 'Instant Health', saturation: 'Saturation',
}
const EFFECT_TR = {
  speed: 'Hız', haste: 'Acele', jump_boost: 'Zıplama Artışı', strength: 'Güç', resistance: 'Direnç', fire_resistance: 'Ateş Direnci',
  water_breathing: 'Su Altında Nefes Alma', night_vision: 'Gece Görüşü', invisibility: 'Görünmezlik', regeneration: 'Yenilenme',
  slow_falling: 'Yavaş Düşüş', dolphins_grace: 'Yunus Lütfu', health_boost: 'Can Takviyesi', glowing: 'Parlama',
  instant_health: 'Anında Sağlık', saturation: 'Doygunluk',
}
const MODE_EN = { survival: 'Survival Mode', creative: 'Creative Mode', adventure: 'Adventure Mode', spectator: 'Spectator Mode' }
const MODE_TR = { survival: 'Hayatta Kalma Modu', creative: 'Yaratıcı Mod', adventure: 'Macera Modu', spectator: 'İzleyici Modu' }
const NAMES_TR = {
  diamond_sword: 'Elmas Kılıç', diamond_pickaxe: 'Elmas Kazma', diamond_axe: 'Elmas Balta', diamond_shovel: 'Elmas Kürek',
  diamond_helmet: 'Elmas Miğfer', diamond_chestplate: 'Elmas Göğüslük', diamond_leggings: 'Elmas Pantolon', diamond_boots: 'Elmas Botlar',
  netherite_sword: 'Netherit Kılıç', netherite_pickaxe: 'Netherit Kazma', netherite_ingot: 'Netherit Külçesi', netherite_helmet: 'Netherit Miğfer',
  netherite_chestplate: 'Netherit Göğüslük', netherite_leggings: 'Netherit Pantolon', netherite_boots: 'Netherit Botlar',
  golden_apple: 'Altın Elma', enchanted_golden_apple: 'Büyülü Altın Elma', cooked_beef: 'Biftek', ender_pearl: 'Ender İncisi',
  elytra: 'Elitra', firework_rocket: 'Havai Fişek Roketi', totem_of_undying: 'Ölümsüzlük Totemi', bow: 'Yay', arrow: 'Ok', tnt: 'TNT',
  obsidian: 'Obsidyen', torch: 'Meşale', bricks: 'Tuğlalar', stone: 'Taş', experience_bottle: 'Tecrübe Şişesi', diamond: 'Elmas',
  oak_log: 'Meşe Kütüğü', iron_ingot: 'Demir Külçesi', gold_ingot: 'Altın Külçesi', emerald: 'Zümrüt', beacon: 'Fener',
  netherite_axe: 'Netherit Balta', netherite_shovel: 'Netherit Kürek', netherite_hoe: 'Netherit Çapa', netherite_block: 'Netherit Bloğu',
  netherite_scrap: 'Netherit Hurdası', netherite_horse_armor: 'Netherit At Zırhı', netherite_upgrade_smithing_template: 'Demircilik Şablonu',
  netherite_spear: 'Netherit Mızrak', netherite_nautilus_armor: 'Netherit Nautilus Zırhı', diamond_hoe: 'Elmas Çapa', diamond_ore: 'Elmas Cevheri',
  deepslate_diamond_ore: 'Kayrak Elmas Cevheri', diamond_horse_armor: 'Elmas At Zırhı', diamond_spear: 'Elmas Mızrak', diamond_nautilus_armor: 'Elmas Nautilus Zırhı',
  shield: 'Kalkan', trident: 'Trident', crafting_table: 'Çalışma Masası', chest: 'Sandık', bread: 'Ekmek', diamond_block: 'Elmas Bloğu',
}

const nameOf = (id, tr) => (tr ? NAMES_TR[id] : null) || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

function world(name, extra = {}) {
  return {
    name, dayTime: 6200, raining: false, thundering: false, difficulty: 'normal', cheats: true,
    rules: { keepInventory: false, doDaylightCycle: true, doWeatherCycle: true, mobGriefing: true, doMobSpawning: true, doInsomnia: true, doFireTick: true, fallDamage: true, naturalRegeneration: true, doImmediateRespawn: false, showDeathMessages: true, drowningDamage: true },
    rulesStyle: 'camel', spawn: [-48, 70, -96],
    ...extra,
  }
}

export function installMockIfNeeded() {
  if (window.beacon) return
  window.__DEMO__ = true
  const params = new URLSearchParams(location.search)
  const listeners = { targets: [], link: [], chat: [] }
  const emit = (ch, v) => listeners[ch].forEach(cb => cb(v))
  const on = (ch) => (cb) => { listeners[ch].push(cb); return () => { listeners[ch] = listeners[ch].filter(x => x !== cb) } }

  const players = {
    Alex: { gamemode: 'survival', effects: new Set(), pos: [118.5, 72, -340.2], dim: 'overworld' },
    Deniz: { gamemode: 'survival', effects: new Set(['night_vision']), pos: [-60.3, 64, 211.8], dim: 'overworld' },
    Kerem: { gamemode: 'creative', effects: new Set(), pos: [12, 120, 40], dim: 'overworld' },
  }
  const sp = { name: 'Kaan', gamemode: 'survival', effects: new Set(), pos: [-41.6, 71, -88.3], dim: 'overworld' }
  const srvWorld = world('Hayatta Kalma', { dayTime: 6400 })
  const spWorld = world('Kuzey Vadisi', { dayTime: 1800 })

  const targets = [
    { key: 'srv:demo-survival', kind: 'server', name: 'Hayatta Kalma', folder: 'Sunucu', dir: 'D:\\Minecraft\\Sunucu', software: 'Paper', version: '1.21.4', versionLabel: 'Paper 1.21.4', running: true, online: 3, max: 20, sample: Object.keys(players), icon: null, gamePort: 25565, rconPort: 25575, eula: true, status: 'ready' },
    { key: 'game:demo', kind: 'game', name: 'Minecraft 1.21.4', version: '1.21.4', versionLabel: '1.21.4', loader: null, launcher: 'minecraft-launcher', username: sp.name, gameDir: 'C:\\Users\\Oyuncu\\AppData\\Roaming\\.minecraft', running: true, status: 'game', where: 'single', world: { name: spWorld.name, cheats: true } },
    { key: 'srv:demo-creative', kind: 'server', name: 'Yaratıcı Dünya', folder: 'Yaratici', dir: 'D:\\Minecraft\\Yaratici', software: 'Vanilla', version: '1.21.11', running: false, gamePort: 25566, rconPort: 25576, eula: true, status: 'stopped' },
  ]
  const demo = params.get('demo') || 'server'
  if (demo === 'empty') targets.length = 0
  if (demo === 'rconoff') { const t = targets[0]; t.status = 'rcon-off' }
  const FIRST = { chat: 'game:demo', none: null, empty: null, stopped: 'srv:demo-creative' }
  const startWith = demo in FIRST ? FIRST[demo] : 'srv:demo-survival'
  let active = null
  let settings = {
    theme: params.get('theme') || 'obsidian',
    waypoints: { 'srv:demo-survival': [{ id: 'w1', name: 'Ev', x: 120, y: 72, z: -338, dim: 'overworld' }, { id: 'w2', name: 'Köy', x: 312, y: 68, z: -604, dim: 'overworld' }, { id: 'w3', name: 'Nether kapısı', x: -8, y: 70, z: 15, dim: 'overworld' }] },
  }

  const gameSnap = () => ({
    inWorld: true, where: 'single', server: null, username: sp.name, cheatsOff: false,
    world: { ...spWorld, player: { pos: sp.pos, dimension: sp.dim, gamemode: sp.gamemode, effects: [...sp.effects].map(id => ({ id, amp: 0 })) } },
    options: { pauseOnLostFocus: true },
  })
  const linkView = () => {
    if (!active) return null
    const t = targets.find(x => x.key === active.key)
    const v = { key: active.key, status: active.status, mode: active.status === 'ready' ? (t.kind === 'game' ? 'chat' : 'rcon') : null, target: { ...t, status: active.status } }
    if (t.kind === 'game' && active.status === 'ready') v.game = gameSnap()
    return v
  }
  const view = () => ({ targets: targets.map(t => (active && t.key === active.key ? { ...t, status: active.status } : t)), active: linkView(), scanning: false })
  const push = () => { emit('targets', view()); emit('link', linkView()) }

  const select = async (key) => {
    const t = targets.find(x => x.key === key)
    if (!t) return { ok: false }
    active = { key, status: 'connecting' }
    push()
    await sleep(500)
    active.status = t.kind === 'server' && !t.running ? 'stopped' : 'ready'
    push()
    return { ok: active.status === 'ready' }
  }

  // ---------------------------------------------------------------- the simulator
  function exec(raw, chat) {
    const tr = chat
    const cmd = raw.trim().replace(/^\//, '')
    const w = chat ? spWorld : srvWorld
    const who = (sel) => {
      if (chat) return sel === '@s' || sel === '@p' || sel === sp.name ? [[sp.name, sp]] : sel === '@a' ? [[sp.name, sp]] : []
      if (sel === '@a') return Object.entries(players)
      return players[sel] ? [[sel, players[sel]]] : []
    }
    const noOne = tr ? 'Hiçbir oyuncu bulunamadı' : 'No player was found'
    let m
    if ((m = /^execute (?:as|in) .*? run (.+)$/.exec(cmd)) && !/positioned over/.test(cmd)) {
      const asM = /^execute as (\S+)/.exec(cmd)
      return exec(m[1].replace(/@s/g, asM ? asM[1] : '@s'), chat)
    }
    if ((m = /^execute as (\S+) at @s positioned over \S+ run tp @s ~ ~ ~$/.exec(cmd))) {
      const list = who(m[1]); if (!list.length) return [noOne, false]
      list.forEach(([, p]) => { p.pos = [p.pos[0], 74, p.pos[2]] })
      return [tr ? `${list[0][0]} ışınlandı` : `Teleported ${list[0][0]} to ${list[0][1].pos.map(n => n.toFixed(6)).join(', ')}`, true]
    }
    if ((m = /^effect give (\S+) minecraft:(\S+) (\S+) (\d+) true$/.exec(cmd))) {
      const list = who(m[1]); if (!list.length) return [noOne, false]
      if (m[3] === 'infinite') list.forEach(([, p]) => p.effects.add(m[2]))
      const n = tr ? EFFECT_TR[m[2]] : EFFECT_EN[m[2]]
      return [list.length > 1 ? (tr ? `${list.length} hedefe ${n} etkisi verildi` : `Applied effect ${n} to ${list.length} targets`) : (tr ? `${list[0][0]} oyuncusuna ${n} etkisi verildi` : `Applied effect ${n} to ${list[0][0]}`), true]
    }
    if ((m = /^effect clear (\S+)(?: minecraft:(\S+))?$/.exec(cmd))) {
      const list = who(m[1]); if (!list.length) return [noOne, false]
      list.forEach(([, p]) => { if (m[2]) p.effects.delete(m[2]); else p.effects.clear() })
      const n = m[2] && (tr ? EFFECT_TR[m[2]] : EFFECT_EN[m[2]])
      return [m[2] ? (tr ? `${list[0][0]} oyuncusundan ${n} kaldırıldı` : `Removed effect ${n} from ${list[0][0]}`) : (tr ? `${list[0][0]} oyuncusunun tüm etkileri kaldırıldı` : `Removed every effect from ${list[0][0]}`), true]
    }
    if ((m = /^gamemode (\w+)(?: (\S+))?$/.exec(cmd))) {
      if (!MODE_EN[m[1]]) return [tr ? `Bilinmeyen oyun modu: ${m[1]}` : `Unknown game mode: ${m[1]}`, false]
      const list = who(m[2] || '@s'); if (!list.length) return [noOne, false]
      list.forEach(([, p]) => { p.gamemode = m[1] })
      if (chat) return [`Kendi oyun modun ${MODE_TR[m[1]]} olarak ayarlandı`, true]
      return [list.length > 1 ? `Set game mode to ${MODE_EN[m[1]]} for ${list.length} players` : `Set ${list[0][0]}'s game mode to ${MODE_EN[m[1]]}`, true]
    }
    if ((m = /^give (\S+) minecraft:(\S+?)(?: (\d+))?$/.exec(cmd))) {
      const list = who(m[1]); if (!list.length) return [noOne, false]
      const n = Number(m[3] || 1)
      return [tr ? `${list[0][0]} oyuncusuna ${n} [${nameOf(m[2], true)}] verildi` : (list.length > 1 ? `Gave ${n} [${nameOf(m[2])}] to ${list.length} players` : `Gave ${n} [${nameOf(m[2])}] to ${list[0][0]}`), true]
    }
    if ((m = /^xp add (\S+) (\d+) levels$/.exec(cmd))) {
      const list = who(m[1]); if (!list.length) return [noOne, false]
      return [tr ? `${list[0][0]} oyuncusuna ${m[2]} tecrübe seviyesi verildi` : `Gave ${m[2]} experience levels to ${list[0][0]}`, true]
    }
    if ((m = /^time set (\d+)$/.exec(cmd))) { w.dayTime = Number(m[1]); return [tr ? `Zaman ${m[1]} olarak ayarlandı` : `Set the time to ${m[1]}`, true] }
    if (cmd === 'time query daytime') return [`The time is ${w.dayTime}`, true]
    if ((m = /^weather (clear|rain|thunder)$/.exec(cmd))) {
      w.raining = m[1] !== 'clear'; w.thundering = m[1] === 'thunder'
      return [tr ? { clear: 'Hava açık olarak ayarlandı', rain: 'Hava yağmurlu olarak ayarlandı', thunder: 'Hava yağmurlu ve fırtınalı olarak ayarlandı' }[m[1]] : { clear: 'Set the weather to clear', rain: 'Set the weather to rain', thunder: 'Set the weather to rain & thunder' }[m[1]], true]
    }
    if ((m = /^difficulty(?: (\w+))?$/.exec(cmd))) {
      if (!m[1]) return [`The difficulty is ${w.difficulty[0].toUpperCase() + w.difficulty.slice(1)}`, true]
      w.difficulty = m[1]
      return [tr ? `Zorluk ${{ peaceful: 'Barışçıl', easy: 'Kolay', normal: 'Normal', hard: 'Zor' }[m[1]]} olarak ayarlandı` : `The difficulty has been set to ${m[1][0].toUpperCase() + m[1].slice(1)}`, true]
    }
    if ((m = /^gamerule (\S+)(?: (\S+))?$/.exec(cmd))) {
      if (!(m[1] in w.rules)) return [tr ? 'Komut için yanlış argüman' : 'Incorrect argument for command', false]
      if (m[2] == null) return [`Gamerule ${m[1]} is currently set to: ${w.rules[m[1]]}`, true]
      w.rules[m[1]] = m[2] === 'true' ? true : m[2] === 'false' ? false : Number(m[2])
      return [tr ? `${m[1]} oyun kuralı artık şu değerde: ${m[2]}` : `Gamerule ${m[1]} is now set to: ${m[2]}`, true]
    }
    if ((m = /^tp (\S+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)$/.exec(cmd))) {
      const list = who(m[1]); if (!list.length) return [noOne, false]
      list.forEach(([, p]) => { p.pos = [Number(m[2]), Number(m[3]), Number(m[4])] })
      return [tr ? `${list[0][0]} ${m[2]}, ${m[3]}, ${m[4]} konumuna ışınlandı` : `Teleported ${list[0][0]} to ${Number(m[2]).toFixed(6)}, ${Number(m[3]).toFixed(6)}, ${Number(m[4]).toFixed(6)}`, true]
    }
    if ((m = /^tp @s ~ ~(\d+) ~$/.exec(cmd))) {
      sp.pos = [sp.pos[0], sp.pos[1] + Number(m[1]), sp.pos[2]]
      return [tr ? `${sp.name} ışınlandı` : `Teleported ${sp.name}`, true]
    }
    if ((m = /^tp (\S+) (\S+)$/.exec(cmd))) {
      const a = who(m[1]), b = who(m[2])
      if (!a.length || !b.length) return [noOne, false]
      a.forEach(([, p]) => { p.pos = [...b[0][1].pos] })
      return [tr ? `${a[0][0]}, ${b[0][0]} yanına ışınlandı` : `Teleported ${a[0][0]} to ${b[0][0]}`, true]
    }
    if ((m = /^data get entity (\S+) (\w+)$/.exec(cmd))) {
      const list = who(m[1]); if (!list.length) return [noOne, false]
      const [n, p] = list[0]
      if (m[2] === 'playerGameType') return [`${n} has the following entity data: ${['survival', 'creative', 'adventure', 'spectator'].indexOf(p.gamemode)}`, true]
      if (m[2] === 'active_effects') return p.effects.size ? [`${n} has the following entity data: [${[...p.effects].map(id => `{id: "minecraft:${id}", amplifier: 1b, duration: -1}`).join(', ')}]`, true] : ['Found no elements matching active_effects', false]
      if (m[2] === 'Pos') return [`${n} has the following entity data: [${p.pos.map(v => v.toFixed(1) + 'd').join(', ')}]`, true]
      if (m[2] === 'Dimension') return [`${n} has the following entity data: "minecraft:${p.dim}"`, true]
    }
    if (cmd === 'list') {
      const names = chat ? [sp.name] : Object.keys(players)
      return [tr ? `Maksimum 8 oyuncudan ${names.length} tanesi çevrimiçi: ${names.join(', ')}` : `There are ${names.length} of a max of 20 players online: ${names.join(', ')}`, true]
    }
    if ((m = /^say (.+)$/.exec(cmd))) return [chat ? `[${sp.name}] ${m[1]}` : `[Server] ${m[1]}`, true]
    if ((m = /^(op|deop|kick|ban|pardon) (\S+)$/.exec(cmd))) {
      if (chat) return [tr ? 'Bilinmeyen ya da eksik komut, hata için aşağıya bakın' : 'Unknown or incomplete command', false]
      return [{ op: `Made ${m[2]} a server operator`, deop: `Made ${m[2]} no longer a server operator`, kick: `Kicked ${m[2]}: Kicked by an operator`, ban: `Banned ${m[2]}: Banned by an operator`, pardon: `Unbanned ${m[2]}` }[m[1]], true]
    }
    if ((m = /^whitelist (on|off|list|add|remove)(?: (\S+))?$/.exec(cmd))) {
      if (chat) return [tr ? 'Bilinmeyen ya da eksik komut, hata için aşağıya bakın' : 'Unknown or incomplete command', false]
      return [{ on: 'Whitelist is now turned on', off: 'Whitelist is now turned off', list: 'There are 2 whitelisted player(s): Alex, Deniz', add: `Added ${m[2]} to the whitelist`, remove: `Removed ${m[2]} from the whitelist` }[m[1]], true]
    }
    if (/^fill /.test(cmd)) return [tr ? '1.024 blok başarıyla dolduruldu' : 'Successfully filled 1024 block(s)', true]
    if (/^kill @e/.test(cmd)) return [tr ? '7 varlık öldürüldü' : 'Killed 7 entities', true]
    if (/^locate structure/.test(cmd)) return [tr ? 'En yakın minecraft:village_plains konumu [312, ~, -604] (378 blok uzakta)' : 'The nearest minecraft:village_plains is at [312, ~, -604] (378 blocks away)', true]
    if (cmd === 'seed') return ['Seed: [-4172144997902289642]', true]
    if (/summon minecraft:lightning_bolt/.test(cmd)) return [tr ? 'Yeni Şimşek çağrıldı' : 'Summoned new Lightning Bolt', true]
    return [tr ? 'Bilinmeyen ya da eksik komut, hata için aşağıya bakın' : 'Unknown or incomplete command, see below for error', false]
  }

  window.beacon = {
    get: async () => {
      if (startWith && !active) {
        const t = targets.find(x => x.key === startWith)
        active = { key: startWith, status: t.status === 'rcon-off' ? 'rcon-off' : t.kind === 'server' && !t.running ? 'stopped' : 'ready' }
      }
      return { version: '2.0.0', settings, ...view() }
    },
    select: (key) => select(key),
    rescan: async () => { push(); return { ok: true } },
    enableRcon: async (key) => {
      active = { key, status: 'restart' }
      push()
      setTimeout(() => { targets.find(x => x.key === key).status = 'ready'; active = { key, status: 'connecting' }; push(); setTimeout(() => { active.status = 'ready'; push() }, 700) }, 3200)
      return { ok: true, running: true }
    },
    start: async (key) => {
      const t = targets.find(x => x.key === key)
      active = { key, status: 'starting' }
      push()
      setTimeout(() => { t.running = true; t.status = 'ready'; t.online = 0; t.max = 10; active.status = 'ready'; push() }, 2600)
      return { ok: true }
    },
    acceptEula: async () => ({ ok: true }),
    openFolder: async () => ({ ok: true }),
    addFolder: async () => ({ ok: false, error: 'canceled' }),
    addRemote: async () => { await sleep(600); return { ok: false, error: 'refused' } },
    forget: async () => ({ ok: true }),
    run: async (cmds) => {
      const t = active && targets.find(x => x.key === active.key)
      const chat = t && t.kind === 'game'
      const results = []
      for (const c of cmds) {
        await sleep(chat ? 520 : 90)
        const [resp, ok] = exec(c, chat)
        results.push({ cmd: c, ok, resp })
      }
      if (chat) emit('link', linkView())
      return { ok: true, results, mode: chat ? 'chat' : 'rcon' }
    },
    query: async (c) => { await sleep(30); const t = active && targets.find(x => x.key === active.key); return exec(c, t && t.kind === 'game')[0] },
    itemNames: async () => ({ lang: 'tr_tr', names: NAMES_TR }),
    setSettings: async (patch) => { settings = { ...settings, ...patch }; return settings },
    openExternal: async (url) => { window.open(url, '_blank', 'noopener') },
    winControl: () => {},
    onTargets: on('targets'),
    onLink: on('link'),
    onChat: on('chat'),
    onWindow: () => () => {},
  }
}
