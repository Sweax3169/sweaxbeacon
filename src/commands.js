// SweaxPanel komut kataloğu. {t} = hedef oyuncu.

export const POWERS = [
  { id: 'creative', label: 'Creative', sub: 'uçuş + sınırsız', icon: '✈️', cmds: ['gamemode creative {t}'] },
  { id: 'survival', label: 'Survival', sub: 'normal mod', icon: '🗡️', cmds: ['gamemode survival {t}'] },
  { id: 'spectator', label: 'Spectator', sub: 'hayalet gez', icon: '👻', cmds: ['gamemode spectator {t}'] },
  { id: 'god', label: 'Ölümsüzlük', sub: 'hasar almaz', icon: '🛡️', cmds: [
    'effect give {t} resistance infinite 4 true',
    'effect give {t} fire_resistance infinite 0 true',
    'effect give {t} regeneration infinite 2 true',
  ] },
  { id: 'speed', label: 'Süper Hız', sub: 'speed III', icon: '⚡', cmds: ['effect give {t} speed infinite 2 true'] },
  { id: 'haste', label: 'Hızlı Kazma', sub: 'haste III', icon: '⛏️', cmds: ['effect give {t} haste infinite 2 true'] },
  { id: 'jump', label: 'Süper Zıplama', sub: 'jump IV', icon: '🦘', cmds: ['effect give {t} jump_boost infinite 3 true'] },
  { id: 'night', label: 'Gece Görüşü', sub: 'karanlıkta gör', icon: '👁️', cmds: ['effect give {t} night_vision infinite 0 true'] },
  { id: 'water', label: 'Su Nefesi', sub: 'boğulma yok', icon: '🫧', cmds: ['effect give {t} water_breathing infinite 0 true'] },
  { id: 'strength', label: 'Güç', sub: 'strength II', icon: '💪', cmds: ['effect give {t} strength infinite 1 true'] },
  { id: 'invis', label: 'Görünmezlik', sub: 'invisible', icon: '🫥', cmds: ['effect give {t} invisibility infinite 0 true'] },
  { id: 'regen', label: 'Oto Şifa', sub: 'sürekli iyileş', icon: '💗', cmds: ['effect give {t} regeneration infinite 1 true'] },
  { id: 'heal', label: 'Canı Doldur', sub: 'anında', icon: '❤️', cmds: ['effect give {t} instant_health 1 20 true'] },
  { id: 'feed', label: 'Açlığı Doldur', sub: 'tokluk', icon: '🍗', cmds: ['effect give {t} saturation 2 5 true'] },
  { id: 'clear', label: 'Efektleri Temizle', sub: 'hepsini sil', icon: '🧹', cmds: ['effect clear {t}'] },
]

export const QUICK_ITEMS = [
  { label: 'Elmas Alet Seti', icon: '⛏️', cmds: [
    'give {t} minecraft:diamond_sword', 'give {t} minecraft:diamond_pickaxe',
    'give {t} minecraft:diamond_axe', 'give {t} minecraft:diamond_shovel',
  ] },
  { label: 'Elmas Zırh Seti', icon: '🛡️', cmds: [
    'give {t} minecraft:diamond_helmet', 'give {t} minecraft:diamond_chestplate',
    'give {t} minecraft:diamond_leggings', 'give {t} minecraft:diamond_boots',
  ] },
  { label: 'Netherite Kılıç', icon: '🗡️', cmds: ['give {t} minecraft:netherite_sword'] },
  { label: 'Enderald Elma x16', icon: '🍏', cmds: ['give {t} minecraft:enchanted_golden_apple 16'] },
  { label: 'Pişmiş Et x64', icon: '🍖', cmds: ['give {t} minecraft:cooked_beef 64'] },
  { label: 'Ender İncisi x16', icon: '🟢', cmds: ['give {t} minecraft:ender_pearl 16'] },
  { label: 'Elytra', icon: '🪽', cmds: ['give {t} minecraft:elytra'] },
  { label: 'Totem x5', icon: '🗿', cmds: ['give {t} minecraft:totem_of_undying 5'] },
  { label: 'TNT x64', icon: '🧨', cmds: ['give {t} minecraft:tnt 64'] },
  { label: 'Obsidyen x64', icon: '🟪', cmds: ['give {t} minecraft:obsidian 64'] },
  { label: 'Meşale x64', icon: '🔥', cmds: ['give {t} minecraft:torch 64'] },
  { label: 'Yay + Ok x64', icon: '🏹', cmds: ['give {t} minecraft:bow', 'give {t} minecraft:arrow 64'] },
]

export const TIME = [
  { label: 'Gündüz', icon: '☀️', cmd: 'time set day' },
  { label: 'Öğle', icon: '🌤️', cmd: 'time set noon' },
  { label: 'Akşam', icon: '🌆', cmd: 'time set night' },
  { label: 'Gece', icon: '🌙', cmd: 'time set midnight' },
]

export const WEATHER = [
  { label: 'Açık', icon: '☀️', cmd: 'weather clear' },
  { label: 'Yağmur', icon: '🌧️', cmd: 'weather rain' },
  { label: 'Fırtına', icon: '⛈️', cmd: 'weather thunder' },
]

export const DIFFICULTY = [
  { label: 'Barışçıl', icon: '🕊️', cmd: 'difficulty peaceful' },
  { label: 'Kolay', icon: '🟢', cmd: 'difficulty easy' },
  { label: 'Normal', icon: '🟡', cmd: 'difficulty normal' },
  { label: 'Zor', icon: '🔴', cmd: 'difficulty hard' },
]

// Açık/kapalı kural anahtarları
export const GAMERULES = [
  { rule: 'keepInventory', label: 'Ölünce Eşya Kalsın' },
  { rule: 'doDaylightCycle', label: 'Zaman Aksın' },
  { rule: 'doWeatherCycle', label: 'Hava Değişsin' },
  { rule: 'mobGriefing', label: 'Mob Hasarı (creeper vb.)' },
  { rule: 'doMobSpawning', label: 'Moblar Doğsun' },
  { rule: 'doFireTick', label: 'Ateş Yayılsın' },
  { rule: 'fallDamage', label: 'Düşme Hasarı' },
  { rule: 'doImmediateRespawn', label: 'Anında Yeniden Doğ' },
  { rule: 'showDeathMessages', label: 'Ölüm Mesajları' },
]
