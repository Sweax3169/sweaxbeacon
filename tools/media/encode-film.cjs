'use strict'

// Turns the screencast frames written by capture.cjs into docs/media/<name>.mp4
// and docs/media/<name>.gif. Frames arrive only when the screen changes, so each
// one is held for exactly as long as it was on screen (ffmpeg concat durations).
//
//   node tools/media/encode-film.cjs --name=tour [--frames=DIR] [--ffmpeg=PATH]

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..')
const arg = (n, d) => { const a = process.argv.find(s => s.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d }
const NAME = arg('name', 'tour')
const FRAMES = path.resolve(arg('frames', path.join(os.tmpdir(), 'sweaxbeacon-frames-' + NAME)))
const FFMPEG = arg('ffmpeg', process.env.FFMPEG || 'C:\\ffmpeg\\bin\\ffmpeg.exe')
const OUT = path.join(ROOT, 'docs', 'media')
const GIF_WIDTH = Number(arg('gif-width', 1000))
const GIF_FPS = Number(arg('gif-fps', 15))

const stamps = JSON.parse(fs.readFileSync(path.join(FRAMES, 'frames.json'), 'utf8'))
const q = (f) => `'${path.join(FRAMES, f).replace(/\\/g, '/')}'`
let list = ''
for (let i = 0; i < stamps.length; i++) {
  const dur = i < stamps.length - 1 ? Math.max(0.001, stamps[i + 1].t - stamps[i].t) : 1.6
  list += `file ${q(stamps[i].file)}\nduration ${dur.toFixed(4)}\n`
}
list += `file ${q(stamps[stamps.length - 1].file)}\n`
const listFile = path.join(FRAMES, 'list.txt')
fs.writeFileSync(listFile, list)
console.log(`${stamps.length} frames, ${(stamps[stamps.length - 1].t - stamps[0].t + 1.6).toFixed(1)} s`)

function ff(args) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
  if (r.status !== 0) throw new Error('ffmpeg failed')
}

const input = ['-f', 'concat', '-safe', '0', '-i', listFile]
ff([...input, '-vf', 'fps=30,scale=1320:-2:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, NAME + '.mp4')])
ff([...input, '-vf', `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
  '-loop', '0', path.join(OUT, NAME + '.gif')])

for (const f of [NAME + '.mp4', NAME + '.gif']) {
  console.log(f, (fs.statSync(path.join(OUT, f)).size / 1048576).toFixed(2), 'MB')
}
