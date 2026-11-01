#!/usr/bin/env python3
"""Draws the README and website artwork for SweaxBeacon into docs/art.

    python tools/art.py

Every SVG is self-contained: Onest and Pixelify Sans from docs/fonts are
instanced at the weight used, cut down to the characters used and embedded;
the pixel icons come from src/pixel/icons.json (tools/pixel_icons.py). Motion
is SMIL, so it plays inside <img> on GitHub. Each file exists for a light and
a dark page; anything with words in it also exists in English and Turkish.

Needs fontTools (with brotli).
"""
import base64
import copy
import io
import json
import os

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, 'docs', 'fonts')
OUT = os.path.join(ROOT, 'docs', 'art')
ICONS = json.load(open(os.path.join(ROOT, 'src', 'pixel', 'icons.json'), encoding='utf-8'))

# The app's two themes (src/styles.css): Obsidian and Quartz.
PAL = {
    'dark': dict(bg='#0c0a10', bg2='#110e16', panel='#18141f', panel2='#201b29', slot='#0e0b13', hi='#ffffff13', lo='#00000099',
                 ink='#f0ecf6', dim='#a9a0b8', faint='#6d647e', line='#2c2537', beam='#8ef6ff', glint='#b48cff',
                 chat='#060509bd', warn='#f2c14e', frame='#f0ecf6'),
    'light': dict(bg='#ece8e1', bg2='#e4dfd6', panel='#f7f4ee', panel2='#fffdf9', slot='#ddd6ca', hi='#ffffff', lo='#4a3a243d',
                  ink='#1c1722', dim='#5c5466', faint='#8d8597', line='#cfc7b8', beam='#0aa0b6', glint='#7a4fd6',
                  chat='#1c1722d1', warn='#b7860f', frame='#1c1722'),
}

FAMILY = {'sans': 'onest', 'pix': 'pixelify-sans'}
_inst = {}


def _font(fam, part, w):
    key = (fam, part, w)
    if key not in _inst:
        f = TTFont(os.path.join(FONTS, f'{FAMILY[fam]}-{part}-wght-normal.woff2'))
        _inst[key] = instancer.instantiateVariableFont(f, {'wght': w})
    return _inst[key]


def width(text, fam='sans', w=400, size=16):
    total = 0
    for ch in text:
        for part in ('latin', 'latin-ext'):
            f = _font(fam, part, w)
            cmap = f.getBestCmap()
            if ord(ch) in cmap:
                total += f['hmtx'][cmap[ord(ch)]][0] / f['head'].unitsPerEm * size
                break
        else:
            total += 0.5 * size
    return total


def face_css(fam, w, chars):
    css = ''
    for part, suffix in (('latin', ''), ('latin-ext', 'x')):
        f = _font(fam, part, w)
        cmap = f.getBestCmap()
        cs = ''.join(sorted(c for c in chars if ord(c) in cmap))
        if not cs.strip():
            continue
        g = copy.deepcopy(f)
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['kern', 'liga', 'calt', 'ccmp', 'mark', 'mkmk']
        opts.notdef_outline = True
        s = subset.Subsetter(opts)
        s.populate(text=cs + ' ')
        s.subset(g)
        buf = io.BytesIO()
        g.flavor = 'woff2'
        g.save(buf)
        b64 = base64.b64encode(buf.getvalue()).decode()
        css += f"@font-face{{font-family:'{fam}{w}{suffix}';font-weight:{w};src:url(data:font/woff2;base64,{b64}) format('woff2')}}"
    fallback = 'ui-monospace,Consolas,monospace' if fam == 'pix' else 'system-ui,Segoe UI,sans-serif'
    css += f".{fam}{w}{{font-family:'{fam}{w}','{fam}{w}x',{fallback};font-weight:{w};white-space:pre}}"
    return css


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def kt(T, pts):
    pts = sorted(pts, key=lambda p: p[0])
    if pts[0][0] > 0:
        pts.insert(0, (0, pts[0][1]))
    if pts[-1][0] < T:
        pts.append((T, pts[-1][1]))
    vals = ';'.join(str(v) for _, v in pts)
    times = ';'.join(f'{min(1, max(0, t / T)):.4f}' for t, _ in pts)
    return vals, times


def anim(attr, T, pts, mode='linear'):
    v, k = kt(T, pts)
    return f'<animate attributeName="{attr}" dur="{T}s" repeatCount="indefinite" values="{v}" keyTimes="{k}" calcMode="{mode}"/>'


def anim_tr(T, pts, kind='translate'):
    v, k = kt(T, pts)
    return f'<animateTransform attributeName="transform" type="{kind}" dur="{T}s" repeatCount="indefinite" values="{v}" keyTimes="{k}"/>'


def window(T, t0, t1, fade=0.12):
    return anim('opacity', T, [(max(0, t0 - fade), 0), (t0, 1), (t1, 1), (min(T, t1 + fade), 0)])


class Svg:
    def __init__(self, w, h, theme):
        self.w, self.h, self.P = w, h, PAL[theme]
        self.parts, self.used, self.defs = [], {}, []
        self.n = 0

    def uid(self, p='i'):
        self.n += 1
        return f'{p}{self.n}'

    def add(self, s):
        self.parts.append(s)
        return s

    def text(self, x, y, s, fam='sans', w=400, size=16, fill=None, anchor='start', extra=''):
        self.used.setdefault((fam, w), set()).update(s)
        return (f'<text x="{x:.1f}" y="{y:.1f}" class="{fam}{w}" font-size="{size}" fill="{fill or self.P["ink"]}" '
                f'text-anchor="{anchor}" shape-rendering="auto" {extra}>{esc(s)}</text>')

    def t(self, *a, **k):
        return self.add(self.text(*a, **k))

    def render(self, title):
        css = ''.join(face_css(f, w, chars) for (f, w), chars in sorted(self.used.items()))
        defs = f'<defs>{"".join(self.defs)}</defs>' if self.defs else ''
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}" '
                f'role="img" shape-rendering="crispEdges"><title>{esc(title)}</title><style>{css}</style>{defs}{"".join(self.parts)}</svg>')


def save(name, svg):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(svg)
    print(f'{name:34s} {len(svg.encode()) / 1024:6.1f} KB')


# ---------------------------------------------------------------- drawing kit

def icon(name, x, y, scale):
    """A pixel icon from icons.json as runs of rects."""
    ic = ICONS[name]
    out = [f'<g transform="translate({x:.1f} {y:.1f})">']
    for j, row in enumerate(ic['r']):
        i = 0
        while i < len(row):
            ch = row[i]
            if ch == '.':
                i += 1
                continue
            k = i
            while k < len(row) and row[k] == ch:
                k += 1
            out.append(f'<rect x="{i * scale:g}" y="{j * scale:g}" width="{(k - i) * scale:g}" height="{scale:g}" fill="{ic["p"][ch]}"/>')
            i = k
    out.append('</g>')
    return ''.join(out)


def block(P, x, y, w, h, fill=None, sunk=False):
    a, b = (P['lo'], P['hi']) if sunk else (P['hi'], P['lo'])
    return (f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2" fill="{fill or (P["slot"] if sunk else P["panel"])}"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="1" fill="{a}"/><rect x="{x}" y="{y}" width="1" height="{h}" fill="{a}"/>'
            f'<rect x="{x}" y="{y + h - 1}" width="{w}" height="1" fill="{b}"/><rect x="{x + w - 1}" y="{y}" width="1" height="{h}" fill="{b}"/></g>')


def beacon(S, x, y, u, T=4.0, top=-14):
    """The logo scene (32 x 32 units) at unit size u, with a living beam from `top` down."""
    b, h = S.uid('bm'), S.uid('hl')
    S.defs.append(f'<linearGradient id="{b}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f2feff"/>'
                  f'<stop offset=".5" stop-color="#8ef6ff" stop-opacity=".9"/><stop offset="1" stop-color="#8ef6ff" stop-opacity="0"/></linearGradient>')
    S.defs.append(f'<linearGradient id="{h}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#8ef6ff" stop-opacity=".4"/>'
                  f'<stop offset="1" stop-color="#8ef6ff" stop-opacity="0"/></linearGradient>')
    X = lambda v: x + v * u
    Y = lambda v: y + v * u
    out = [f'<g>{anim("opacity", T, [(0, .75), (T / 2, 1), (T, .75)])}'
           f'<rect x="{X(11)}" y="{Y(top)}" width="{10 * u}" height="{(11 - top) * u}" fill="url(#{h})"/>'
           f'<rect x="{X(14)}" y="{Y(top)}" width="{4 * u}" height="{(11 - top) * u}" fill="url(#{b})"/></g>',
           f'<rect x="{X(14)}" y="{Y(8)}" width="{4 * u}" height="{4 * u}" fill="#ffffff" opacity="0">'
           f'{anim("opacity", T, [(0, 0), (.1, .9), (1.4, 0)])}{anim("y", T, [(0, Y(8)), (1.4, Y(top))])}</rect>']
    for x0, y0, w, h2, c, top in [(4, 25, 24, 4, '#2b1f40', '#4a3870'), (7, 21, 18, 4, '#3a2b57', '#5e4a8f'), (10, 17, 12, 4, '#4d3a75', '#7a62b0')]:
        out.append(f'<rect x="{X(x0)}" y="{Y(y0)}" width="{w * u}" height="{h2 * u}" fill="{c}"/><rect x="{X(x0)}" y="{Y(y0)}" width="{w * u}" height="{u}" fill="{top}"/>')
    out.append(f'<rect x="{X(12)}" y="{Y(11)}" width="{8 * u}" height="{7 * u}" fill="#bff3fa"/>'
               f'<rect x="{X(13)}" y="{Y(12)}" width="{6 * u}" height="{5 * u}" fill="#5fd0e2"/>'
               f'<rect x="{X(14)}" y="{Y(13)}" width="{4 * u}" height="{3 * u}" fill="#ffffff">{anim("opacity", T, [(0, 1), (T / 2, .7), (T, 1)])}</rect>')
    return ''.join(out)


def particles(cx, cy, spread, colors, T, n=10, rise=60, size=5, seed=1):
    out = []
    r = seed
    for k in range(n):
        r = (r * 1103515245 + 12345) & 0x7fffffff
        dx = (r % 1000) / 1000 * spread - spread / 2
        r = (r * 1103515245 + 12345) & 0x7fffffff
        t0 = (r % 1000) / 1000 * (T - 1.7)
        c = colors[k % len(colors)]
        out.append(f'<rect x="{cx + dx:.1f}" y="{cy}" width="{size}" height="{size}" fill="{c}" opacity="0">'
                   f'{anim("opacity", T, [(t0, 0), (t0 + .2, 1), (t0 + 1.6, 0)])}{anim("y", T, [(t0, cy), (t0 + 1.6, cy - rise)])}</rect>')
    return ''.join(out)


# ---------------------------------------------------------------- banner

TEXT = {
    'en': dict(tag='Powers, items and world controls for Minecraft.', sub='Server, LAN world or single-player · Java Edition',
               alt='SweaxBeacon: powers, items and world controls for Minecraft Java, on your server, your LAN world or in single-player.'),
    'tr': dict(tag='Minecraft için güçler, eşyalar ve dünya ayarları.', sub='Sunucu, LAN dünyası ya da tek oyunculu · Java Edition',
               alt='SweaxBeacon: Minecraft Java için güçler, eşyalar ve dünya ayarları; sunucunda, LAN dünyanda ya da tek oyunculuda.'),
}

HOTBAR = [('potion_powers', 'Applied effect Speed to Alex'), ('chest', 'Gave 64 [Diamond] to Alex'),
          ('ender_pearl', 'Teleported Alex to 120.0, 72.0, -338.0'), ('clock', 'Set the time to 6000'),
          ('players', 'Made Deniz a server operator'), ('block_command', 'Seed: [-4172144997902289642]')]


def banner(lang, theme):
    W, H = 1280, 420
    S = Svg(W, H, theme)
    P = S.P
    tx = TEXT[lang]
    S.add(f'<rect width="{W}" height="{H}" fill="{P["bg"]}"/>')
    S.add(block(P, 24, 24, W - 48, H - 48, P['bg2']))
    T = 7.2
    S.add(particles(250, 280, 220, ['#55c8ff', '#ff6fc4', '#5df07a', '#ffd84a', '#9b7cf2'], T, n=14, rise=120, size=6, seed=7))
    S.add(beacon(S, 90, 92, 10, T=3.6, top=-6))
    x0 = 520
    S.t(x0, 150, 'Sweax', 'sans', 800, 72, P['ink'])
    S.t(x0 + width('Sweax', 'sans', 800, 72), 150, 'Beacon', 'sans', 800, 72, P['beam'])
    S.t(x0 + 2, 196, tx['tag'], 'sans', 500, 24, P['ink'])
    S.t(x0 + 2, 228, tx['sub'], 'sans', 400, 18, P['dim'])
    hx, hy, sw, gap = x0, 262, 64, 6
    S.add(block(P, hx - 6, hy - 6, 6 * sw + 5 * gap + 12, sw + 12))
    for i, (ic, _) in enumerate(HOTBAR):
        sx = hx + i * (sw + gap)
        S.add(block(P, sx, hy, sw, sw, sunk=True))
        S.add(icon(ic, sx + 16, hy + 16, 2))
    step = T / 6
    pts = []
    for i in range(6):
        x = hx + i * (sw + gap) - 3
        pts += [(i * step + (0.25 if i else 0), f'{x} 0'), (i * step + step - .05, f'{x} 0')]
    pts.append((T, f'{hx - 3} 0'))
    S.add(f'<g>{anim_tr(T, pts)}<rect x="0" y="{hy - 3}" width="{sw + 6}" height="{sw + 6}" rx="3" fill="none" stroke="{P["frame"]}" stroke-width="3"/></g>')
    for i, (_, reply) in enumerate(HOTBAR):
        y = hy + sw + 40
        w = width(reply, 'sans', 500, 15) + 20
        S.add(f'<g opacity="0">{window(T, i * step + .35, i * step + step - .15)}'
              f'<rect x="{hx - 6}" y="{y - 19}" width="{w:.0f}" height="27" rx="2" fill="{P["chat"]}"/>'
              + S.text(hx + 4, y, reply, 'sans', 500, 15, '#f4f1f8') + '</g>')
    save(f'banner-{lang}-{theme}.svg', S.render(tx['alt']))


# ---------------------------------------------------------------- feature tiles (no words)

def tile(theme):
    S = Svg(400, 220, theme)
    P = S.P
    S.add(f'<rect width="400" height="220" fill="{P["bg"]}"/>')
    S.add(block(P, 8, 8, 384, 204, P['bg2']))
    return S, P


def tile_powers(theme):
    S, P = tile(theme)
    T = 6.0
    for i, (name, color) in enumerate([('potion_speed', '#55c8ff'), ('potion_regeneration', '#ff6fc4'), ('potion_night_vision', '#6a6dff')]):
        x = 40 + i * 112
        t0 = 0.6 + i * 1.6
        on = anim('opacity', T, [(t0 - .05, 0), (t0, 1), (T - .3, 1), (T, 0)])
        S.add(block(P, x, 60, 96, 100))
        S.add(f'<rect x="{x}" y="60" width="96" height="100" rx="2" fill="{color}" opacity="0">{anim("opacity", T, [(t0 - .05, 0), (t0, .16), (T - .3, .16), (T, 0)])}</rect>')
        S.add(f'<rect x="{x - 1}" y="59" width="98" height="102" rx="3" fill="none" stroke="{color}" stroke-width="2" opacity="0">{on}</rect>')
        S.add(block(P, x + 20, 76, 56, 56, sunk=True))
        S.add(f'<g>{anim_tr(T, [(t0 - .05, "0 0"), (t0 + .15, "0 -5"), (t0 + .6, "0 -2"), (T - .3, "0 -2"), (T, "0 0")])}{icon(name, x + 24, 80, 3)}</g>')
        S.add(f'<rect x="{x + 42}" y="142" width="12" height="8" fill="{P["slot"]}"/><rect x="{x + 42}" y="142" width="12" height="8" fill="{color}" opacity="0">{on}</rect>')
        S.add(particles(x + 48, 120, 60, [color], T, n=8, rise=70, size=5, seed=3 + i))
    save(f'tile-powers-{theme}.svg', S.render('Powers'))


def tile_items(theme):
    S, P = tile(theme)
    T = 6.0
    items = [('pickaxe_diamond', '4'), ('chestplate_diamond', '4'), ('apple_enchanted', '8'), ('steak', '64'), ('ender_pearl', '16'),
             ('elytra', ''), ('totem', '5'), ('tnt', '64'), ('block_obsidian', '64'), ('torch', '64')]
    for k, (name, n) in enumerate(items):
        x = 38 + (k % 5) * 66
        y = 44 + (k // 5) * 70
        S.add(block(P, x, y, 58, 58, sunk=True))
        t0 = .3 + k * .42
        count = S.text(x + 54, y + 54, n, 'pix', 600, 15, '#ffffff', 'end', 'style="paint-order:stroke" stroke="#3a3a3a" stroke-width="3"') if n else ''
        S.add(f'<g opacity="0">{anim("opacity", T, [(t0, 0), (t0 + .05, 1), (T - .4, 1), (T - .1, 0)])}'
              f'<g>{anim_tr(T, [(t0, "0 6"), (t0 + .18, "0 -3"), (t0 + .35, "0 0")])}{icon(name, x + 13, y + 11, 2)}</g>{count}</g>')
    save(f'tile-items-{theme}.svg', S.render('Items'))


def tile_teleport(theme):
    S, P = tile(theme)
    T = 5.0
    S.add('<rect x="9" y="150" width="382" height="61" fill="#6b4428"/><rect x="9" y="150" width="382" height="10" fill="#6cc24a"/>')
    for x in (60, 330):
        S.add(f'<rect x="{x}" y="118" width="18" height="32" fill="#e0b48c"/><rect x="{x}" y="118" width="18" height="10" fill="#3b2619"/>')
    S.add(f'<g>{anim_tr(T, [(0, "80 120"), (.4, "80 120"), (1.0, "140 52"), (1.6, "205 30"), (2.2, "270 52"), (2.8, "322 116"), (T, "322 116")])}'
          f'<g opacity="0">{anim("opacity", T, [(.35, 0), (.4, 1), (2.8, 1), (2.9, 0)])}{icon("ender_pearl", -12, -12, 1.5)}</g></g>')
    S.add(f'<g opacity="0">{window(T, 2.85, 4.6)}<rect x="56" y="114" width="26" height="36" fill="{P["beam"]}" opacity=".35"/></g>')
    S.add(f'<g opacity="0">{window(T, 2.9, 4.7)}<rect x="326" y="114" width="26" height="36" fill="{P["beam"]}" opacity=".45"/></g>')
    S.add(S.text(200, 196, '120  72  -338', 'pix', 500, 18, '#ffffff', 'middle'))
    save(f'tile-teleport-{theme}.svg', S.render('Teleport'))


def tile_world(theme):
    S, P = tile(theme)
    T = 8.0
    S.add(f'<rect x="9" y="9" width="382" height="202" fill="#5aa9ff">{anim("fill", T, [(0, "#5aa9ff"), (3, "#5aa9ff"), (3.8, "#5a3a6a"), (4.4, "#0d1030"), (7.2, "#0d1030"), (8, "#5aa9ff")])}</rect>')
    for x, y in [(40, 30), (90, 54), (300, 40), (350, 70), (210, 24)]:
        S.add(f'<rect x="{x}" y="{y}" width="3" height="3" fill="#cfd6ff" opacity="0">{anim("opacity", T, [(4.0, 0), (4.6, 1), (7.0, 1), (7.6, 0)])}</rect>')
    S.add(f'<g>{anim_tr(T, [(0, "0 200 170"), (8, "360 200 170")], "rotate")}<rect x="186" y="26" width="28" height="28" fill="#ffd83a"/><rect x="191" y="31" width="18" height="18" fill="#fff3a0"/>'
          f'<rect x="188" y="288" width="24" height="24" fill="#e9edf7"/><rect x="193" y="293" width="6" height="6" fill="#b9c0d4"/></g>')
    S.add('<rect x="9" y="170" width="382" height="41" fill="#4f9a33"/><rect x="9" y="170" width="382" height="8" fill="#6cc24a"/><rect x="9" y="186" width="382" height="25" fill="#6b4428"/>')
    save(f'tile-world-{theme}.svg', S.render('World'))


def face(seed, x, y, s):
    skins = ['#e8be98', '#b8865f', '#8f5f3e', '#f3d2b3']
    hairs = ['#1f1712', '#c99a4a', '#6e2e2e', '#2f4f7a']
    eyes = ['#2e9e6a', '#3a7bd5', '#6b4a2b', '#7a4fd6']
    rows = ['HHHHHHHH', 'HHHHHHHH', 'HSSSSSSH', 'SSSSSSSS', 'SWESSEWS', 'SSSDDSSS', 'SSMMMMSS', 'SSSSSSSS']
    cols = {'H': hairs[seed % 4], 'S': skins[seed % 4], 'W': '#ffffff', 'E': eyes[seed % 4], 'D': '#00000033', 'M': '#7a4a32'}
    return ''.join(f'<rect x="{x + i * s}" y="{y + j * s}" width="{s}" height="{s}" fill="{cols[c]}"/>' for j, r in enumerate(rows) for i, c in enumerate(r))


def tile_players(theme):
    S, P = tile(theme)
    T = 6.0
    for k, n in enumerate(['Alex', 'Deniz', 'Kerem']):
        y = 34 + k * 56
        S.add(block(P, 40, y, 320, 48))
        S.add(face(k, 50, y + 8, 4))
        S.t(96, y + 30, n, 'sans', 650, 17, P['ink'])
    pts = []
    for k in range(3):
        pts += [(k * 2, f'0 {k * 56}'), (k * 2 + 1.6, f'0 {k * 56}')]
    S.add(f'<g>{anim_tr(T, pts + [(T, "0 0")])}<rect x="40" y="34" width="4" height="48" fill="{P["beam"]}"/>'
          f'<rect x="39" y="33" width="322" height="50" rx="3" fill="none" stroke="{P["beam"]}" stroke-width="1.5" opacity=".6"/></g>')
    save(f'tile-players-{theme}.svg', S.render('Players'))


def tile_console(theme):
    S, P = tile(theme)
    T = 7.0
    S.add(block(P, 30, 30, 340, 44, sunk=True))
    S.t(42, 59, '/', 'pix', 600, 20, P['beam'])
    cmd = 'locate structure village_plains'
    for i, ch in enumerate(cmd):
        t0 = .4 + i * .07
        S.add(f'<g opacity="0">{anim("opacity", T, [(t0, 0), (t0 + .01, 1), (T - .5, 1), (T - .2, 0)])}' + S.text(58 + width(cmd[:i], 'pix', 500, 15), 58, ch, 'pix', 500, 15, P['ink']) + '</g>')
    S.add(block(P, 30, 88, 340, 102, sunk=True))
    for k, (t0, s, c) in enumerate([(3.0, 'Nearest village_plains: [312, ~, -604]', P['ink']), (3.2, '(378 blocks away)', P['dim'])]):
        S.add(f'<g opacity="0">{anim("opacity", T, [(t0, 0), (t0 + .12, 1), (T - .5, 1), (T - .2, 0)])}' + S.text(44, 116 + k * 24, s, 'pix', 500, 14, c) + '</g>')
    save(f'tile-console-{theme}.svg', S.render('Console'))


# ---------------------------------------------------------------- how it works

ARCH = {
    'en': dict(title='How SweaxBeacon reaches a world', finds='Finds by itself',
               f1='Running Java processes', f1b='working folder → server.properties', f2='Server list ping', f2b='version · players · MOTD',
               f3='Game command line', f3b='game folder · latest.log · level.dat',
               a='Server on this PC or elsewhere', a1='RCON', a2='exact replies · any player',
               b='Minecraft window', b1='Chat, by window messages', b2='single-player · LAN · servers where you are op',
               log='chat link: replies from latest.log, state from level.dat'),
    'tr': dict(title='SweaxBeacon bir dünyaya nasıl ulaşır', finds='Kendisi bulur',
               f1='Çalışan Java süreçleri', f1b='çalışma klasörü → server.properties', f2='Sunucu listesi ping’i', f2b='sürüm · oyuncular · MOTD',
               f3='Oyunun komut satırı', f3b='oyun klasörü · latest.log · level.dat',
               a='Bu PC’deki ya da uzaktaki sunucu', a1='RCON', a2='birebir yanıt · her oyuncu',
               b='Minecraft penceresi', b1='Pencere mesajlarıyla sohbet', b2='tek oyunculu · LAN · operatör olduğun sunucular',
               log='sohbet yolu: yanıtlar latest.log’dan, durum level.dat’tan'),
}


def architecture(lang, theme):
    W, H = 1280, 500
    S = Svg(W, H, theme)
    P = S.P
    L = ARCH[lang]
    T = 6.0
    S.add(f'<rect width="{W}" height="{H}" fill="{P["bg"]}"/>')
    S.add(block(P, 16, 16, W - 32, H - 32, P['bg2']))
    S.add(block(P, 56, 186, 250, 128))
    S.add(beacon(S, 66, 214, 2.6, T=3, top=-8))
    S.t(162, 248, 'SweaxBeacon', 'sans', 750, 21)
    S.t(162, 274, 'Electron · React', 'sans', 400, 14, P['dim'])
    S.t(370, 84, L['finds'], 'sans', 650, 15, P['dim'])
    for k, (a, b, ic) in enumerate([(L['f1'], L['f1b'], 'block_command'), (L['f2'], L['f2b'], 'compass'), (L['f3'], L['f3b'], 'block_grass')]):
        y = 100 + k * 110
        S.add(f'<path d="M 306 250 C 340 250 336 {y + 45} 370 {y + 45}" fill="none" stroke="{P["line"]}" stroke-width="2" shape-rendering="geometricPrecision"/>')
        S.add(block(P, 370, y, 370, 90))
        S.add(block(P, 386, y + 21, 48, 48, sunk=True))
        S.add(icon(ic, 394, y + 29, 2))
        S.t(450, y + 40, a, 'sans', 650, 17)
        S.t(450, y + 64, b, 'pix', 500, 13, P['dim'])
    for k, (title, l1, l2, ic, col) in enumerate([(L['a'], L['a1'], L['a2'], 'block_command', P['beam']), (L['b'], L['b1'], L['b2'], 'block_grass', P['glint'])]):
        y = 112 + k * 170
        S.add(f'<path d="M 740 {y + 65} L 784 {y + 65}" stroke="{col}" stroke-width="2" stroke-dasharray="4 6" fill="none"/>')
        S.add(f'<rect width="10" height="10" y="{y + 60}" fill="{col}" opacity="0">{anim("x", T, [(k * 1.5, 740), (k * 1.5 + 1, 776)])}{anim("opacity", T, [(k * 1.5, 0), (k * 1.5 + .05, 1), (k * 1.5 + 1, 1), (k * 1.5 + 1.05, 0)])}</rect>')
        S.add(f'<rect width="10" height="10" y="{y + 60}" fill="{P["ink"]}" opacity="0">{anim("x", T, [(k * 1.5 + 1.4, 776), (k * 1.5 + 2.4, 740)])}{anim("opacity", T, [(k * 1.5 + 1.4, 0), (k * 1.5 + 1.45, 1), (k * 1.5 + 2.4, 1), (k * 1.5 + 2.45, 0)])}</rect>')
        S.add(block(P, 784, y, 456, 130))
        S.add(block(P, 800, y + 22, 56, 56, sunk=True))
        S.add(icon(ic, 808, y + 30, 2.5))
        S.t(870, y + 46, title, 'sans', 650, 18)
        S.t(870, y + 72, l1, 'sans', 650, 15, col)
        S.t(870, y + 100, l2, 'sans', 400, 13.5, P['dim'])
    S.t(788, 445, L['log'], 'pix', 500, 13, P['faint'])
    save(f'architecture-{lang}-{theme}.svg', S.render(L['title']))


SEQ = {
    'en': dict(title='Typing into a background Minecraft window', paused='pause menu', playing='in game', chat='chat open',
               steps=['focus', 'Esc', 'chat key', 'text', 'Enter', 'Esc', 'blur'],
               notes=['the game thinks it has focus', 'closes the pause menu', 'opens chat on the next tick', '/gamemode creative',
                      'sends it; the reply lands in latest.log', 'pause menu again ("Saving and pausing")', 'back as it was'],
               foot='Window messages to the game window only: no keyboard, no mouse, the game never comes to the front.'),
    'tr': dict(title='Arka plandaki Minecraft penceresine yazmak', paused='duraklatma menüsü', playing='oyunda', chat='sohbet açık',
               steps=['odak', 'Esc', 'sohbet tuşu', 'metin', 'Enter', 'Esc', 'odağı bırak'],
               notes=['oyun odakta olduğunu sanır', 'duraklatma menüsünü kapatır', 'sohbet bir sonraki tikte açılır', '/gamemode creative',
                      'gönderir; yanıt latest.log’a düşer', 'yine duraklatma menüsü ("Saving and pausing")', 'her şey eski hâlinde'],
               foot='Yalnızca oyun penceresine pencere mesajları: klavye yok, fare yok, oyun hiç öne gelmez.'),
}


def sequence(lang, theme):
    W, H = 1280, 360
    S = Svg(W, H, theme)
    P = S.P
    L = SEQ[lang]
    T = 9.0
    S.add(f'<rect width="{W}" height="{H}" fill="{P["bg"]}"/>')
    S.add(block(P, 16, 16, W - 32, H - 32, P['bg2']))
    n = 7
    x0, x1 = 110, 1170
    step = (x1 - x0) / (n - 1)
    for a, b, label, col in [(0, 1, L['paused'], P['warn']), (1, 2.5, L['playing'], P['beam']), (2.5, 4.5, L['chat'], P['glint']),
                             (4.5, 5, L['playing'], P['beam']), (5, 6, L['paused'], P['warn'])]:
        xa, xb = x0 + a * step, x0 + b * step
        S.add(f'<rect x="{xa:.0f}" y="62" width="{xb - xa:.0f}" height="28" fill="{col}" opacity=".16"/><rect x="{xa:.0f}" y="62" width="{xb - xa:.0f}" height="3" fill="{col}"/>')
        S.t((xa + xb) / 2, 82, label, 'sans', 600, 13, P['ink'], 'middle')
    S.add(f'<rect x="{x0}" y="139" width="{x1 - x0}" height="2" fill="{P["line"]}"/>')
    for i in range(n):
        x = x0 + i * step
        t0 = .4 + i * 1.1
        S.add(block(P, x - 22, 118, 44, 44, sunk=True))
        S.add(f'<rect x="{x - 22}" y="118" width="44" height="44" rx="2" fill="{P["beam"]}" opacity="0">{anim("opacity", T, [(t0, 0), (t0 + .08, .55), (t0 + .9, .12), (T - .3, .12), (T, 0)])}</rect>')
        S.t(x, 147, str(i + 1), 'pix', 600, 18, P['ink'], 'middle')
        S.t(x, 192, L['steps'][i], 'sans', 650, 16, P['ink'], 'middle')
        words, lines, cur = L['notes'][i].split(' '), [], ''
        for wd in words:
            if width((cur + ' ' + wd).strip(), 'sans', 400, 13) > step - 14:
                lines.append(cur)
                cur = wd
            else:
                cur = (cur + ' ' + wd).strip()
        lines.append(cur)
        for k, ln in enumerate(lines[:3]):
            S.t(x, 216 + k * 18, ln, 'pix' if i == 3 else 'sans', 500 if i == 3 else 400, 13, P['dim'], 'middle')
    pts = [(0, x0 - 5), (.4, x0 - 5)] + [(.4 + i * 1.1, x0 - 5 + i * step) for i in range(n)] + [(T - .3, x1 - 5)]
    S.add(f'<rect x="{x0 - 5}" y="135" width="10" height="10" fill="{P["ink"]}">{anim("x", T, pts)}</rect>')
    S.t(W / 2, 314, L['foot'], 'sans', 500, 15, P['dim'], 'middle')
    save(f'sequence-{lang}-{theme}.svg', S.render(L['title']))


if __name__ == '__main__':
    for theme in ('light', 'dark'):
        for lang in ('en', 'tr'):
            banner(lang, theme)
            architecture(lang, theme)
            sequence(lang, theme)
        tile_powers(theme)
        tile_items(theme)
        tile_teleport(theme)
        tile_world(theme)
        tile_players(theme)
        tile_console(theme)
