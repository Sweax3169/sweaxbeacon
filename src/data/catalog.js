// What the buttons send. {t} is the chosen player (a name, @s or @a).
// Commands that move or place relative to a player run "as" and "at" that
// player, because a server console stands at the world origin.

export const MODES = [
  { id: 'survival', label: 'Hayatta kalma', sub: 'Normal oyun', icon: 'sword_iron' },
  { id: 'creative', label: 'Yaratıcı', sub: 'Uç, her şey sınırsız', icon: 'block_grass' },
  { id: 'adventure', label: 'Macera', sub: 'Blok kırılmaz', icon: 'map' },
  { id: 'spectator', label: 'İzleyici', sub: 'Duvarlardan geç', icon: 'ender_eye' },
]

// Effects that last until switched off. amp is the level minus one.
export const POWERS = [
  { id: 'speed', label: 'Hız', sub: 'Daha hızlı koş', amp: 1, color: '#55c8ff' },
  { id: 'haste', label: 'Kazma hızı', sub: 'Blokları çabuk kır', amp: 1, color: '#ffd84a' },
  { id: 'jump_boost', label: 'Zıplama', sub: 'Daha yükseğe zıpla', amp: 1, color: '#5df07a' },
  { id: 'strength', label: 'Güç', sub: 'Daha sert vur', amp: 1, color: '#e2463a' },
  { id: 'resistance', label: 'Direnç', sub: 'Daha az hasar al', amp: 1, color: '#9b7cf2' },
  { id: 'fire_resistance', label: 'Ateş direnci', sub: 'Lav ve ateş işlemez', amp: 0, color: '#ff9a3c' },
  { id: 'water_breathing', label: 'Su altı nefesi', sub: 'Boğulmazsın', amp: 0, color: '#3d74ff' },
  { id: 'night_vision', label: 'Gece görüşü', sub: 'Karanlıkta gör', amp: 0, color: '#6a6dff' },
  { id: 'invisibility', label: 'Görünmezlik', sub: 'Kimse seni görmez', amp: 0, color: '#c8cdd6' },
  { id: 'regeneration', label: 'Yenilenme', sub: 'Can kendini doldurur', amp: 1, color: '#ff6fc4' },
  { id: 'slow_falling', label: 'Yavaş düşüş', sub: 'Düşme hasarı yok', amp: 0, color: '#f2ebda' },
  { id: 'dolphins_grace', label: 'Yunus lütfu', sub: 'Suda hızlı yüz', amp: 0, color: '#7fd6e0' },
  { id: 'health_boost', label: 'Ekstra can', sub: '+10 kalp', amp: 4, color: '#ff7a5c' },
  { id: 'glowing', label: 'Parlama', sub: 'Duvar arkasından görün', amp: 0, color: '#e8f0a0' },
]

export const effectOn = (t, p) => `effect give ${t} minecraft:${p.id} infinite ${p.amp} true`
export const effectOff = (t, id) => `effect clear ${t} minecraft:${id}`

// Immortality is three effects at once.
export const GOD = {
  label: 'Ölümsüzlük', sub: 'Direnç V, ateş direnci, yenilenme', color: '#5aa9ff',
  effects: [{ id: 'resistance', amp: 4 }, { id: 'fire_resistance', amp: 0 }, { id: 'regeneration', amp: 2 }],
}

export const INSTANT = [
  { label: 'Canı doldur', icon: 'heart', cmds: (t) => [`effect give ${t} minecraft:instant_health 1 10 true`] },
  { label: 'Açlığı doldur', icon: 'steak', cmds: (t) => [`effect give ${t} minecraft:saturation 1 20 true`] },
  { label: '+30 seviye', icon: 'xp_bottle', cmds: (t) => [`xp add ${t} 30 levels`] },
  { label: 'Süt iç (hepsini sil)', icon: 'bucket_milk', cmds: (t) => [`effect clear ${t}`] },
]

const give = (t, id, n = 1) => `give ${t} minecraft:${id}${n > 1 ? ' ' + n : ''}`

export const KITS = [
  { label: 'Elmas aletler', icon: 'pickaxe_diamond', count: 4, cmds: (t) => ['diamond_sword', 'diamond_pickaxe', 'diamond_axe', 'diamond_shovel'].map(i => give(t, i)) },
  { label: 'Elmas zırh', icon: 'chestplate_diamond', count: 4, cmds: (t) => ['diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots'].map(i => give(t, i)) },
  { label: 'Netherite takım', icon: 'netherite_set', count: 6, cmds: (t) => ['netherite_helmet', 'netherite_chestplate', 'netherite_leggings', 'netherite_boots', 'netherite_sword', 'netherite_pickaxe'].map(i => give(t, i)) },
  { label: 'Büyülü altın elma', icon: 'apple_enchanted', count: 8, cmds: (t) => [give(t, 'enchanted_golden_apple', 8)] },
  { label: 'Altın elma', icon: 'apple_golden', count: 32, cmds: (t) => [give(t, 'golden_apple', 32)] },
  { label: 'Pişmiş biftek', icon: 'steak', count: 64, cmds: (t) => [give(t, 'cooked_beef', 64)] },
  { label: 'Ender incisi', icon: 'ender_pearl', count: 16, cmds: (t) => [give(t, 'ender_pearl', 16)] },
  { label: 'Elytra ve roket', icon: 'elytra', count: 64, cmds: (t) => [give(t, 'elytra'), give(t, 'firework_rocket', 64)] },
  { label: 'Ölümsüzlük totemi', icon: 'totem', count: 5, cmds: (t) => [give(t, 'totem_of_undying', 5)] },
  { label: 'Yay ve ok', icon: 'bow', count: 64, cmds: (t) => [give(t, 'bow'), give(t, 'arrow', 64)] },
  { label: 'TNT', icon: 'tnt', count: 64, cmds: (t) => [give(t, 'tnt', 64)] },
  { label: 'Obsidyen', icon: 'block_obsidian', count: 64, cmds: (t) => [give(t, 'obsidian', 64)] },
  { label: 'Meşale', icon: 'torch', count: 64, cmds: (t) => [give(t, 'torch', 64)] },
  { label: 'Tuğla', icon: 'bricks', count: 64, cmds: (t) => [give(t, 'bricks', 64)] },
  { label: 'Taş', icon: 'block_stone', count: 64, cmds: (t) => [give(t, 'stone', 64)] },
  { label: 'Deneyim şişesi', icon: 'xp_bottle', count: 64, cmds: (t) => [give(t, 'experience_bottle', 64)] },
]

export const TIMES = [
  { label: 'Sabah', ticks: 1000, icon: 'sun', clock: '07:00' },
  { label: 'Öğle', ticks: 6000, icon: 'sun', clock: '12:00' },
  { label: 'Akşam', ticks: 12000, icon: 'sunset', clock: '18:00' },
  { label: 'Gece', ticks: 18000, icon: 'moon', clock: '00:00' },
]

export const WEATHER = [
  { id: 'clear', label: 'Açık', icon: 'sun' },
  { id: 'rain', label: 'Yağmur', icon: 'rain' },
  { id: 'thunder', label: 'Fırtına', icon: 'thunder' },
]

export const DIFFICULTY = [
  { id: 'peaceful', label: 'Barışçıl', sub: 'Canavar yok', icon: 'flower' },
  { id: 'easy', label: 'Kolay', sub: 'Az hasar', icon: 'sword_wood' },
  { id: 'normal', label: 'Normal', sub: 'Varsayılan', icon: 'sword_iron' },
  { id: 'hard', label: 'Zor', sub: 'Açlık öldürür', icon: 'skull' },
]

// Game rule names changed in Java 1.21.11 (keepInventory -> keep_inventory).
export const RULES = [
  { id: 'keepInventory', camel: 'keepInventory', snake: 'keep_inventory', label: 'Ölünce eşyalar kalsın' },
  { id: 'daylight', camel: 'doDaylightCycle', snake: 'advance_time', label: 'Zaman aksın' },
  { id: 'weather', camel: 'doWeatherCycle', snake: 'advance_weather', label: 'Hava değişsin' },
  { id: 'griefing', camel: 'mobGriefing', snake: 'mob_griefing', label: 'Moblar blok bozsun' },
  { id: 'spawning', camel: 'doMobSpawning', snake: 'spawn_mobs', label: 'Moblar doğsun' },
  { id: 'phantoms', camel: 'doInsomnia', snake: 'spawn_phantoms', label: 'Phantom gelsin' },
  { id: 'fire', camel: 'doFireTick', snake: 'fire_spread_radius_around_player', label: 'Ateş yayılsın', snakeOn: '128', snakeOff: '0' },
  { id: 'fall', camel: 'fallDamage', snake: 'fall_damage', label: 'Düşme hasarı' },
  { id: 'regen', camel: 'naturalRegeneration', snake: 'natural_health_regeneration', label: 'Can kendiliğinden dolsun' },
  { id: 'respawn', camel: 'doImmediateRespawn', snake: 'immediate_respawn', label: 'Anında yeniden doğ' },
  { id: 'deathMessages', camel: 'showDeathMessages', snake: 'show_death_messages', label: 'Ölüm mesajları' },
  { id: 'drowning', camel: 'drowningDamage', snake: 'drowning_damage', label: 'Boğulma hasarı' },
]

export function ruleName(rule, style) { return style === 'snake' ? rule.snake : rule.camel }
export function ruleValue(rule, style, on) {
  if (style === 'snake' && rule.snakeOn) return on ? rule.snakeOn : rule.snakeOff
  return on ? 'true' : 'false'
}
export function ruleIsOn(v) { return v === true || v === 1 || v === 'true' || (typeof v === 'number' && v > 0) }

// 1.21.11 and every 26.x release use the new rule names.
export function rulesStyleFor(version) {
  const m = String(version || '').match(/^(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!m) return null
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3] || 0)]
  if (a >= 20) return 'snake'
  if (b > 21 || (b === 21 && c >= 11)) return 'snake'
  return 'camel'
}

export const QUICK_MOVES = [
  { label: 'Yüzeye çık', icon: 'arrow_up', cmds: (t) => [`execute as ${t} at @s positioned over motion_blocking_no_leaves run tp @s ~ ~ ~`] },
  { label: '50 blok yukarı', icon: 'feather', cmds: (t) => [`execute as ${t} at @s run tp @s ~ ~50 ~`] },
]

export const CHIPS = [
  'time set day', 'weather clear', 'give {t} minecraft:diamond 64', 'effect clear {t}',
  'kill @e[type=minecraft:item]', 'execute at {t} run summon minecraft:lightning_bolt ~ ~ ~',
  'locate structure minecraft:village_plains', 'seed', 'list',
]
