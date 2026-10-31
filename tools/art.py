#!/usr/bin/env python3
"""Draws the README and website artwork for SweaxPanel into docs/art.

    python tools/art.py

Every SVG is self-contained: the two typefaces from docs/fonts are instanced at
the weight used, cut down to the characters used, and embedded. Motion is SMIL,
so it plays inside <img> on GitHub. Each file exists for a light and a dark
page; anything with words in it also exists in English and Turkish.

Needs fontTools (with brotli) and Pillow.
"""
import base64
import copy
import io
import os

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, 'docs', 'fonts')
OUT = os.path.join(ROOT, 'docs', 'art')

# One palette for the README art and the website (docs/index.html uses the same values).
PAL = {
    'light': dict(bg='#ECEDE8', card='#F7F7F3', panel='#FFFFFF', well='#E3E5E0', ink='#16191C', dim='#59616A',
                  faint='#959CA3', line='#C9CDCB', key='#FBFBF8', side='#BFC4C0', sig='#D0301F', ack='#0A8A66',
                  len='#2D5DC8', rid='#6F42D8', typ='#BF1F74', body='#D5D9DC', led='#B7BCBF'),
    'dark': dict(bg='#0E1012', card='#13161A', panel='#171B1F', well='#1E2328', ink='#E7EAEC', dim='#8D96A0',
                 faint='#59616A', line='#2B3137', key='#22272D', side='#08090B', sig='#FF4A36', ack='#38D49D',
                 len='#6E94FF', rid='#A27EFF', typ='#FF5CAA', body='#2C333A', led='#3A4148'),
}

FAMILY = {'sans': 'instrument-sans', 'mono': 'martian-mono'}
_inst = {}


def _font(fam, part, w):
    key = (fam, part, w)
    if key not in _inst:
        f = TTFont(os.path.join(FONTS, f'{FAMILY[fam]}-{part}-wght-normal.woff2'))
        _inst[key] = instancer.instantiateVariableFont(f, {'wght': w})
    return _inst[key]


def width(text, fam='sans', w=400, size=16, ls=0.0):
    """Advance width of text in px (no kerning)."""
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
        total += ls
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
    fallback = 'ui-monospace,Consolas,monospace' if fam == 'mono' else 'system-ui,Segoe UI,sans-serif'
    css += f".{fam}{w}{{font-family:'{fam}{w}','{fam}{w}x',{fallback};font-weight:{w};white-space:pre}}"
    return css


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def kt(T, pts):
    """SMIL values/keyTimes from (time, value) pairs over a cycle of T seconds."""
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


def motion(T, path, t0, t1, rotate='auto', reverse=False):
    a, b = ('1', '0') if reverse else ('0', '1')
    k = f'0;{t0 / T:.4f};{t1 / T:.4f};1'
    return (f'<animateMotion dur="{T}s" repeatCount="indefinite" path="{path}" rotate="{rotate}" '
            f'keyPoints="{a};{a};{b};{b}" keyTimes="{k}" calcMode="linear"/>')


def window(T, t0, t1, fade=0.08):
    """Opacity 0 -> 1 between t0 and t1."""
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

    def text(self, x, y, s, fam='sans', w=400, size=16, fill=None, anchor='start', ls=None, extra='', inner=''):
        self.used.setdefault((fam, w), set()).update(s)
        lsa = f' letter-spacing="{ls}"' if ls is not None else ''
        return (f'<text x="{x:.1f}" y="{y:.1f}" class="{fam}{w}" font-size="{size}" fill="{fill or self.P["ink"]}" '
                f'text-anchor="{anchor}"{lsa} {extra}>{esc(s)}{inner}</text>')

    def t(self, *a, **k):
        return self.add(self.text(*a, **k))

    def render(self, title):
        css = ''.join(face_css(f, w, chars) for (f, w), chars in sorted(self.used.items()))
        defs = f'<defs>{"".join(self.defs)}</defs>' if self.defs else ''
        return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                f'viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}" role="img">'
                f'<title>{esc(title)}</title><style>{css}</style>{defs}{"".join(self.parts)}</svg>')


def save(name, svg):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(svg)
    print(f'{name:34s} {len(svg.encode()) / 1024:6.1f} KB')


def icon_b64(px):
    im = Image.open(os.path.join(ROOT, 'build', 'icon-512.png')).convert('RGBA').resize((px, px), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


def packet_bar(P, scale=1.0, body_w=18):
    """A tiny RCON packet: length | id | type | body | 00 00, centred on 0,0."""
    fields = [(8, P['len']), (8, P['rid']), (6, P['typ']), (body_w, P['dim']), (4, P['faint'])]
    total = sum(w for w, _ in fields) + len(fields) - 1
    h = 11
    x = -total / 2
    out = ''
    for w, c in fields:
        out += f'<rect x="{x * scale:.1f}" y="{-h / 2 * scale:.1f}" width="{w * scale:.1f}" height="{h * scale:.1f}" rx="{1.5 * scale:.1f}" fill="{c}"/>'
        x += w + 1
    return out


def keycap(S, x, y, w, h, label, T, presses, side=7, led_on=None, size=11.5):
    """A command key: top face over a darker front edge; pressed at given times."""
    P = S.P
    moves = []
    leds = []
    for t in presses:
        moves += [(t, '0 0'), (t + 0.07, f'0 {side - 2}'), (t + 0.32, '0 0')]
        leds += [(t, led_on or P['sig']), (t + 0.9, led_on or P['sig']), (t + 1.0, P['led'])]
    g = f'<rect x="{x}" y="{y + side}" width="{w}" height="{h}" rx="6" fill="{P["side"]}"/>'
    g += f'<g>{anim_tr(T, [(0, "0 0")] + moves) if presses else ""}'
    g += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{P["key"]}" stroke="{P["line"]}" stroke-width="1"/>'
    g += S.text(x + 10, y + h / 2 + size * 0.36, label, 'mono', 500, size, P['ink'])
    g += f'<rect x="{x + w - 12}" y="{y + 7}" width="5" height="5" rx="1" fill="{P["led"]}">'
    if presses:
        g += anim('fill', T, [(0, P['led'])] + leds, 'discrete')
    g += '</rect></g>'
    return g


# ----------------------------------------------------------------------------- banner

BANNER_TEXT = {
    'en': dict(sub=['A desktop control panel for the Minecraft Java', 'server you run. Each button sends an RCON command.'],
               tabs=['Powers', 'Items', 'Teleport', 'World', 'Players', 'Console'],
               title='SweaxPanel: a desktop control panel for your own Minecraft Java server, over RCON'),
    'tr': dict(sub=['Kendi Minecraft Java sunucun için masaüstü', 'kontrol paneli. Her düğme bir RCON komutu gönderir.'],
               tabs=['Güçler', 'Eşya', 'Işınlanma', 'Dünya', 'Oyuncular', 'Konsol'],
               title='SweaxPanel: kendi Minecraft Java sunucun için RCON üzerinden çalışan masaüstü kontrol paneli'),
}
KEYS = [('effect', 'Applied effect Speed to Steve'), ('give', 'Gave 1 [Elytra] to Steve'),
        ('tp', 'Teleported Steve to Alex'), ('time', 'Set the time to 1000'),
        ('op', 'Made Alex a server operator'), ('seed', 'Seed: [-4172144997902289642]')]


def banner(lang, theme):
    L, S = BANNER_TEXT[lang], Svg(1280, 440, theme)
    P = S.P
    T = 7.0
    press = [0.35 + i * 1.02 for i in range(6)]
    S.add(f'<rect width="1280" height="440" fill="{P["bg"]}"/>')
    S.add(f'<line x1="0" y1="414.5" x2="1280" y2="414.5" stroke="{P["line"]}"/>')

    # left: name and one plain sentence
    S.add(f'<image x="64" y="62" width="64" height="64" href="data:image/png;base64,{icon_b64(128)}"/>')
    S.t(62, 214, 'SweaxPanel', 'sans', 600, 76, P['ink'], ls=-2)
    size = 21
    while max(width(s, 'sans', 400, size) for s in L['sub']) > 530:
        size -= 0.5
    for i, line in enumerate(L['sub']):
        S.t(64, 262 + i * (size * 1.45), line, 'sans', 400, size, P['dim'])

    # the six tabs as small keys, lit in step with the desk
    x = 64
    for i, name in enumerate(L['tabs']):
        w = width(name, 'sans', 500, 14) + 26
        S.add(f'<rect x="{x}" y="{356 + 4}" width="{w:.1f}" height="28" rx="5" fill="{P["side"]}"/>')
        S.add(f'<rect x="{x}" y="356" width="{w:.1f}" height="28" rx="5" fill="{P["key"]}" stroke="{P["line"]}"/>')
        S.t(x + 13, 375, name, 'sans', 500, 14, P['ink'])
        S.add(f'<rect x="{x + 13}" y="389" width="{w - 26:.1f}" height="2" fill="{P["sig"]}" opacity="0">'
              f'{window(T, press[i], press[i] + 0.95)}</rect>')
        x += w + 10

    # right: the desk, the wire, the server
    S.add(f'<rect x="622" y="100" width="272" height="208" rx="10" fill="{P["panel"]}" stroke="{P["line"]}"/>')
    kw, kh, gap = 72, 44, 10
    cols = [640, 640 + kw + gap, 640 + 2 * (kw + gap)]
    rows = [120, 200]
    buses = [186, 280]
    merge_x, port_y, srv_x = 914, 236, 934
    paths = []
    for i, (cmd, _) in enumerate(KEYS):
        c, r = i % 3, i // 3
        xc = cols[c] + kw / 2
        bottom = rows[r] + kh + 7
        paths.append(f'M{xc} {bottom} V{buses[r]} H{merge_x} V{port_y} H{srv_x}')
    # traces
    for r in range(2):
        S.add(f'<path d="M{cols[0] + kw / 2} {buses[r]} H{merge_x} V{port_y}" fill="none" stroke="{P["line"]}" stroke-width="2"/>')
        for c in range(3):
            xc = cols[c] + kw / 2
            S.add(f'<line x1="{xc}" y1="{rows[r] + kh + 7}" x2="{xc}" y2="{buses[r]}" stroke="{P["line"]}" stroke-width="2"/>')
            S.add(f'<rect x="{xc - 3}" y="{buses[r] - 3}" width="6" height="6" fill="{P["line"]}"/>')
    S.add(f'<path d="M{merge_x} {port_y} H{srv_x}" stroke="{P["line"]}" stroke-width="2"/>')
    S.add(f'<rect x="{merge_x - 4}" y="{port_y - 4}" width="8" height="8" fill="{P["line"]}"/>')
    for i, (cmd, _) in enumerate(KEYS):
        c, r = i % 3, i // 3
        S.add(keycap(S, cols[c], rows[r], kw, kh, cmd, T, [press[i]], led_on=P['sig']))
    # packets out, acknowledgements back
    for i, p in enumerate(paths):
        t0 = press[i] + 0.1
        a0 = t0 + 0.95
        S.add(f'<path d="{p}" fill="none" stroke="{P["sig"]}" stroke-width="3" stroke-linecap="round" pathLength="1" '
              f'stroke-dasharray="0.22 2" stroke-dashoffset="0.22">{anim("stroke-dashoffset", T, [(t0, 0.22), (t0 + 0.75, -1)])}</path>')
        S.add(f'<path d="{p}" fill="none" stroke="{P["ack"]}" stroke-width="3" stroke-linecap="round" pathLength="1" '
              f'stroke-dasharray="0.16 2" stroke-dashoffset="-1">{anim("stroke-dashoffset", T, [(a0, -1), (a0 + 0.6, 0.16)])}</path>')
        S.add(f'<g opacity="0">{packet_bar(P, 1.25)}{motion(T, p, t0, t0 + 0.75)}{window(T, t0, t0 + 0.75, 0.02)}</g>')
        S.add(f'<g opacity="0"><rect x="-9" y="-3.5" width="18" height="7" rx="1.5" fill="{P["ack"]}"/>'
              f'{motion(T, p, a0, a0 + 0.6, reverse=True)}{window(T, a0, a0 + 0.6, 0.02)}</g>')

    # server
    S.add(f'<rect x="{srv_x}" y="84" width="{1236 - srv_x}" height="310" rx="9" fill="{P["panel"]}" stroke="{P["line"]}"/>')
    S.add(f'<rect x="{srv_x - 6}" y="{port_y - 8}" width="7" height="16" rx="1.5" fill="{P["line"]}"/>')
    S.t(srv_x + 16, 108, 'server', 'sans', 600, 14, P['ink'])
    S.t(srv_x + 16 + width('server', 'sans', 600, 14) + 8, 108, ':25575', 'mono', 400, 11.5, P['dim'])
    led = [(0, P['led'])]
    for t in press:
        led += [(t + 0.85, P['ack']), (t + 1.0, P['ack']), (t + 1.05, P['led'])]
    S.add(f'<circle cx="{1216}" cy="104" r="4.5" fill="{P["led"]}">{anim("fill", T, led, "discrete")}</circle>')
    S.add(f'<rect x="{srv_x + 14}" y="120" width="{1236 - srv_x - 28}" height="260" rx="6" fill="{P["well"]}"/>')
    for i, (_, resp) in enumerate(KEYS):
        y = 150 + i * 42
        t = press[i] + 0.85
        cid = S.uid('c')
        tw = width(resp, 'mono', 400, 11.5) + 4
        S.defs.append(f'<clipPath id="{cid}"><rect x="{srv_x + 40}" y="{y - 14}" width="0" height="20">'
                      f'{anim("width", T, [(t, 0), (t + 0.35, round(tw, 1)), (T - 0.35, round(tw, 1)), (T - 0.05, 0)])}</rect></clipPath>')
        S.add(f'<rect x="{srv_x + 28}" y="{y - 8}" width="6" height="6" fill="{P["ack"]}" opacity="0">{window(T, t, T - 0.2)}</rect>')
        S.add(f'<g clip-path="url(#{cid})">' + S.text(srv_x + 42, y, resp, 'mono', 400, 11.5, P['ink']) + '</g>')
    save(f'banner-{lang}-{theme}.svg', S.render(L['title']))


# ----------------------------------------------------------------------------- architecture

ARCH = {
    'en': dict(title='How a button press reaches the server',
               nodes=[('Window', 'React UI: tabs, target, log', ['window.sweax', '  .command(cmd)']),
                      ('Preload bridge', 'contextBridge, no Node in UI', ['ipcRenderer.invoke(', "  'rcon:command')"]),
                      ('Main process', 'holds one RCON connection', ['ipcMain.handle(', "  'rcon:command')"]),
                      ('rcon.cjs', 'Source RCON, Node net only', ['encode(id, 2, cmd)', 'socket.write(buf)']),
                      ('Your server', 'Minecraft Java, RCON on', ['enable-rcon=true', 'rcon.port=25575'])],
               lanes=['command', 'reply'],
               foot=['settings:get / settings:set', 'host and port; the password only if “remember” is ticked',
                     '%APPDATA%\\SweaxPanel\\sweaxpanel-settings.json']),
    'tr': dict(title='Bir düğmeye basınca komut sunucuya nasıl gider',
               nodes=[('Pencere', 'React arayüz: sekmeler, hedef, günlük', ['window.sweax', '  .command(cmd)']),
                      ('Preload köprüsü', "contextBridge, arayüzde Node yok", ['ipcRenderer.invoke(', "  'rcon:command')"]),
                      ('Ana süreç', 'tek RCON bağlantısını tutar', ['ipcMain.handle(', "  'rcon:command')"]),
                      ('rcon.cjs', 'Source RCON, yalnız Node net', ['encode(id, 2, cmd)', 'socket.write(buf)']),
                      ('Sunucun', 'Minecraft Java, RCON açık', ['enable-rcon=true', 'rcon.port=25575'])],
               lanes=['komut', 'yanıt'],
               foot=['settings:get / settings:set', 'adres ve port; şifre yalnız “hatırla” işaretliyse',
                     '%APPDATA%\\SweaxPanel\\sweaxpanel-settings.json']),
}


def architecture(lang, theme):
    A, S = ARCH[lang], Svg(1280, 520, theme)
    P = S.P
    T = 6.0
    S.add(f'<rect width="1280" height="520" rx="0" fill="{P["bg"]}"/>')
    S.t(40, 58, A['title'], 'sans', 600, 26, P['ink'])
    nw, gap, x0, y0, nh = 220, 30, 40, 110, 200
    lane_req, lane_rep = y0 + nh / 2 - 14, y0 + nh / 2 + 14
    x_end = x0 + 4 * (nw + gap) + 20
    S.add(f'<line x1="{x0 + nw - 10}" y1="{lane_req}" x2="{x_end}" y2="{lane_req}" stroke="{P["sig"]}" stroke-width="2" opacity=".55"/>')
    S.add(f'<line x1="{x0 + nw - 10}" y1="{lane_rep}" x2="{x_end}" y2="{lane_rep}" stroke="{P["ack"]}" stroke-width="2" opacity=".55"/>')
    for k in range(3):
        t0 = k * 2.0
        S.add(f'<g opacity="0">{packet_bar(P, 1.1)}{motion(T, f"M{x0 + nw - 20} {lane_req} H{x_end}", t0, t0 + 2.2, rotate="0")}{window(T, t0, t0 + 2.2, 0.02)}</g>')
        a0 = (t0 + 2.4) % T
        S.add(f'<g opacity="0"><rect x="-10" y="-4" width="20" height="8" rx="2" fill="{P["ack"]}"/>'
              f'{motion(T, f"M{x0 + nw - 20} {lane_rep} H{x_end}", a0, a0 + 2.0, rotate="0", reverse=True)}{window(T, a0, a0 + 2.0, 0.02)}</g>')
    for i, (name, sub, code) in enumerate(A['nodes']):
        x = x0 + i * (nw + gap)
        last = i == 4
        S.add(f'<rect x="{x}" y="{y0}" width="{nw}" height="{nh}" rx="10" fill="{P["panel"]}" stroke="{P["sig"] if last else P["line"]}" stroke-width="{1.5 if last else 1}"/>')
        S.t(x + 18, y0 + 34, name, 'sans', 600, 18, P['ink'])
        size = 13.5
        while width(sub, 'sans', 400, size) > nw - 34:
            size -= 0.5
        S.t(x + 18, y0 + 58, sub, 'sans', 400, size, P['dim'])
        S.add(f'<rect x="{x + 14}" y="{y0 + 112}" width="{nw - 28}" height="70" rx="6" fill="{P["well"]}"/>')
        for j, line in enumerate(code):
            S.t(x + 26, y0 + 140 + j * 24, line, 'mono', 400, 11.5, P['ink'] if j == 0 else P['dim'])
        if i < 4:
            S.add(f'<rect x="{x + nw - 1}" y="{lane_req - 5}" width="{gap + 2}" height="38" fill="{P["bg"]}" opacity="0"/>')
    # lane legend
    S.add(f'<rect x="{x0}" y="{y0 + nh + 30}" width="16" height="9" rx="2" fill="{P["sig"]}"/>')
    S.t(x0 + 24, y0 + nh + 39, A['lanes'][0], 'sans', 500, 14, P['dim'])
    lx = x0 + 24 + width(A['lanes'][0], 'sans', 500, 14) + 26
    S.add(f'<rect x="{lx}" y="{y0 + nh + 30}" width="16" height="9" rx="2" fill="{P["ack"]}"/>')
    S.t(lx + 24, y0 + nh + 39, A['lanes'][1], 'sans', 500, 14, P['dim'])
    # settings file
    fy = 400
    mx = x0 + 2 * (nw + gap) + nw / 2
    S.add(f'<path d="M{mx} {y0 + nh} V{fy + 16}" stroke="{P["line"]}" stroke-width="2" stroke-dasharray="4 5"/>')
    S.add(f'<rect x="{mx - 300}" y="{fy}" width="600" height="84" rx="10" fill="{P["card"]}" stroke="{P["line"]}"/>')
    S.t(mx - 280, fy + 30, A['foot'][0], 'mono', 500, 12.5, P['ink'])
    S.t(mx - 280 + width(A['foot'][0], 'mono', 500, 12.5) + 14, fy + 30, A['foot'][1], 'sans', 400, 14, P['dim'])
    S.t(mx - 280, fy + 60, A['foot'][2], 'mono', 400, 12, P['dim'])
    save(f'architecture-{lang}-{theme}.svg', S.render(A['title']))


# ----------------------------------------------------------------------------- packet anatomy

PKT = {
    'en': dict(title='One RCON packet, byte by byte', cmd='gamemode creative Steve',
               fields=[('length', 'int32 LE'), ('request id', 'int32 LE'), ('type', 'int32 LE'), ('body', 'UTF-8 text, {n} bytes'), ('end', '00 00')],
               notes=['length: how many bytes follow it ({len})', 'request id: the server echoes it back in its reply',
                      'type: 3 = log in with the password, 2 = run a command, 0 = reply'],
               total='bytes', reply='The reply uses the same frame: type 0, same request id, the result as the body.'),
    'tr': dict(title='Tek bir RCON paketi, bayt bayt', cmd='gamemode creative Steve',
               fields=[('uzunluk', 'int32 LE'), ('istek no', 'int32 LE'), ('tür', 'int32 LE'), ('gövde', 'UTF-8 metin, {n} bayt'), ('son', '00 00')],
               notes=['uzunluk: ardından gelen bayt sayısı ({len})', 'istek no: sunucu yanıtında aynısını geri yollar',
                      'tür: 3 = şifreyle giriş, 2 = komut çalıştır, 0 = yanıt'],
               total='bayt', reply='Yanıt aynı çerçeveyle gelir: tür 0, aynı istek no, gövdede sonuç.'),
}


def rcon_bytes(rid, typ, body):
    b = body.encode('utf-8')
    n = 10 + len(b)
    le = lambda v: list((v & 0xffffffff).to_bytes(4, 'little'))
    return le(n) + le(rid) + le(typ) + list(b) + [0, 0], len(b)


def packet(lang, theme):
    K, S = PKT[lang], Svg(1280, 430, theme)
    P = S.P
    T = 8.0
    S.add(f'<rect width="1280" height="430" fill="{P["bg"]}"/>')
    S.t(40, 58, K['title'], 'sans', 600, 26, P['ink'])
    S.t(40, 92, f'> {K["cmd"]}', 'mono', 500, 15, P['dim'])
    data, blen = rcon_bytes(7, 2, K['cmd'])
    spans = [(0, 4, P['len']), (4, 8, P['rid']), (8, 12, P['typ']), (12, 12 + blen, P['dim']), (12 + blen, len(data), P['faint'])]
    cw, gap, x0, y0, ch = 30, 2.2, 40, 150, 46
    for i, byte in enumerate(data):
        x = x0 + i * (cw + gap)
        color = next(c for a, b, c in spans if a <= i < b)
        t = 0.3 + i * 0.07
        is_body = 12 <= i < 12 + blen
        fill = P['panel'] if is_body else color
        ink = P['ink'] if is_body else ('#FFFFFF' if theme == 'light' else P['bg'])
        g = f'<g opacity="0">{anim("opacity", T, [(t, 0), (t + 0.12, 1), (T - 0.5, 1), (T - 0.2, 0)])}'
        g += f'<rect x="{x:.1f}" y="{y0}" width="{cw}" height="{ch}" rx="4" fill="{fill}" stroke="{color}" stroke-width="{1.5 if is_body else 0}"/>'
        g += S.text(x + cw / 2, y0 + 28, f'{byte:02x}', 'mono', 500, 11, ink, 'middle')
        if is_body:
            chs = chr(byte) if 32 < byte < 127 else '·'
            g += S.text(x + cw / 2, y0 - 12, chs, 'mono', 400, 12, P['dim'], 'middle')
        S.add(g + '</g>')
    # brackets and labels
    for (a, b, color), (name, kind) in zip(spans, K['fields']):
        xa = x0 + a * (cw + gap)
        xb = x0 + b * (cw + gap) - gap
        y = y0 + ch + 16
        S.add(f'<path d="M{xa:.1f} {y} v8 H{xb:.1f} v-8" fill="none" stroke="{color}" stroke-width="2"/>')
        S.t(xa, y + 36, name, 'sans', 600, 15.5, P['ink'])
        S.t(xa, y + 57, kind.format(n=blen), 'mono', 400, 11.5, P['dim'])
    for i, note in enumerate(K['notes']):
        S.t(40, 322 + i * 24, note.format(len=len(data) - 4), 'sans', 400, 14.5, P['dim'])
    tot = f'4 + 4 + 4 + {blen} + 2 = {len(data)} {K["total"]}'
    S.t(40, 404, tot, 'mono', 500, 12.5, P['ink'])
    S.t(40 + width(tot, 'mono', 500, 12.5) + 28, 404, K['reply'], 'sans', 400, 14.5, P['dim'])
    save(f'packet-{lang}-{theme}.svg', S.render(K['title']))


# ----------------------------------------------------------------------------- feature tiles (no words, both languages)

def tile_frame(S):
    P = S.P
    S.add(f'<rect x="0.5" y="0.5" width="{S.w - 1}" height="{S.h - 1}" rx="12" fill="{P["card"]}" stroke="{P["line"]}"/>')


def glyph(name, x, y, s, color, sw=2.2):
    paths = {
        'shield': 'M12 3 L19 6 V11 C19 15.5 16 18.8 12 21 C8 18.8 5 15.5 5 11 V6 Z',
        'sword': 'M20 4 L10 14 M20 4 H16.5 M20 4 V7.5 M7 11.5 L12.5 17 M9.5 14.5 L4.5 19.5',
        'pick': 'M4 9 Q12 2.5 20 9 M12 5.6 L12 21',
        'axe': 'M7 21 L15.5 4.5 M14 5 C18 3.5 21 6.5 20 11 L15.6 9.2',
        'shovel': 'M12 3 V13.5 M10 3 H14 M8.5 13.5 H15.5 V17 C15.5 19.5 13.8 21 12 21 C10.2 21 8.5 19.5 8.5 17 Z',
    }
    k = s / 24
    return (f'<path d="{paths[name]}" transform="translate({x} {y}) scale({k:.3f})" fill="none" stroke="{color}" '
            f'stroke-width="{sw / k:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')


def tile_powers(theme):
    S = Svg(520, 300, theme)
    P = S.P
    T = 6.0
    tile_frame(S)
    press = 0.5
    # one key, three commands
    S.add(f'<rect x="40" y="{118 + 9}" width="96" height="74" rx="8" fill="{P["side"]}"/>')
    S.add(f'<g>{anim_tr(T, [(press, "0 0"), (press + 0.08, "0 7"), (press + 0.4, "0 0")])}'
          f'<rect x="40" y="118" width="96" height="74" rx="8" fill="{P["key"]}" stroke="{P["line"]}"/>'
          f'{glyph("shield", 70, 137, 36, P["ink"])}'
          f'<rect x="122" y="125" width="6" height="6" rx="1" fill="{P["led"]}">{anim("fill", T, [(press, P["sig"]), (T - 0.4, P["led"])], "discrete")}</rect></g>')
    S.t(160, 64, 'effect give Steve', 'mono', 500, 12, P['dim'])
    rows = ['resistance infinite 4 true', 'fire_resistance infinite 0 true', 'regeneration infinite 2 true']
    for i, r in enumerate(rows):
        y = 110 + i * 56
        path = f'M140 156 H150 V{y - 4} H178'
        S.add(f'<path d="{path}" fill="none" stroke="{P["line"]}" stroke-width="2"/>')
        t0 = press + 0.15 + i * 0.45
        S.add(f'<g opacity="0">{packet_bar(P, 0.8)}{motion(T, path, t0, t0 + 0.35)}{window(T, t0, t0 + 0.35, 0.02)}</g>')
        S.add(f'<g opacity="0">{anim("opacity", T, [(t0 + 0.35, 0), (t0 + 0.45, 1), (T - 0.4, 1), (T - 0.15, 0)])}'
              f'<rect x="182" y="{y - 22}" width="306" height="36" rx="6" fill="{P["panel"]}" stroke="{P["line"]}"/>'
              + S.text(196, y + 0.5, r, 'mono', 400, 11.5, P['ink'])
              + f'<path d="M466 {y - 7} l4 4 l8 -9" fill="none" stroke="{P["ack"]}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>')
    save(f'tile-powers-{theme}.svg', S.render('Powers'))


def tile_items(theme):
    S = Svg(520, 300, theme)
    P = S.P
    T = 6.0
    tile_frame(S)
    items = [('sword', 'diamond_sword'), ('pick', 'diamond_pickaxe'), ('axe', 'diamond_axe'), ('shovel', 'diamond_shovel')]
    for i, (g, idn) in enumerate(items):
        t = 0.6 + i * 0.7
        x = 44 + i * 112
        S.add(f'<rect x="{x}" y="120" width="84" height="84" rx="8" fill="{P["well"]}" stroke="{P["line"]}"/>')
        S.add(f'<g opacity="0">{anim("opacity", T, [(t, 0), (t + 0.12, 1), (T - 0.4, 1), (T - 0.15, 0)])}'
              f'<g>{anim_tr(T, [(t, "0 -10"), (t + 0.22, "0 0")])}{glyph(g, x + 20, 140, 44, P["ink"])}</g>'
              f'<rect x="{x + 6}" y="{120 + 6}" width="8" height="8" rx="1.5" fill="{P["ack"]}"/></g>')
        S.add(f'<g opacity="0">{window(T, t, t + 0.68 if i < 3 else T - 0.3, 0.04)}'
              + S.text(44, 70, f'give Steve minecraft:{idn}', 'mono', 500, 13, P['ink']) + '</g>')
        S.add(f'<g opacity="0">{anim("opacity", T, [(t, 0), (t + 0.12, 1), (T - 0.4, 1), (T - 0.15, 0)])}'
              + S.text(x + 42, 236, idn.replace('diamond_', ''), 'mono', 400, 11, P['dim'], 'middle') + '</g>')
    S.t(44, 96, '× 4', 'mono', 400, 11, P['faint'])
    save(f'tile-items-{theme}.svg', S.render('Items'))


def tile_teleport(theme):
    S = Svg(520, 300, theme)
    P = S.P
    T = 7.0
    tile_frame(S)
    # x/z plane
    ox, oy = 150, 170
    S.add(f'<rect x="30" y="60" width="300" height="214" rx="8" fill="{P["well"]}"/>')
    S.add(f'<line x1="44" y1="{oy}" x2="316" y2="{oy}" stroke="{P["line"]}" stroke-width="1.5"/>')
    S.add(f'<line x1="{ox}" y1="72" x2="{ox}" y2="262" stroke="{P["line"]}" stroke-width="1.5"/>')
    for k in range(-2, 4):
        S.add(f'<line x1="{ox + k * 50}" y1="{oy - 4}" x2="{ox + k * 50}" y2="{oy + 4}" stroke="{P["faint"]}" stroke-width="1.5"/>')
    S.t(306, oy - 10, 'x', 'mono', 400, 11, P['faint'])
    S.t(ox + 8, 80, 'z', 'mono', 400, 11, P['faint'])
    dx, dy = ox + 120, oy - 80   # z -340 is "north", drawn up
    arc = f'M{ox} {oy} Q{ox + 20} {oy - 110} {dx} {dy}'
    S.add(f'<path d="{arc}" fill="none" stroke="{P["sig"]}" stroke-width="2" stroke-dasharray="5 5" opacity="0">'
          f'{anim("opacity", T, [(0.6, 0), (0.7, 0.8), (3.2, 0.8), (3.4, 0)])}</path>')
    S.add(f'<g>{motion(T, arc, 0.7, 1.6, rotate="0")}'
          f'<rect x="-9" y="-9" width="18" height="18" rx="3" fill="{P["ink"]}"/>'
          + S.text(0, 4, 'S', 'sans', 600, 11, P['card'], 'middle') + '</g>')
    S.add(f'<g opacity="0">{window(T, 1.6, 3.3)}<circle cx="{dx}" cy="{dy}" r="16" fill="none" stroke="{P["ack"]}" stroke-width="2"/>'
          + S.text(dx, dy + 36, '120, 72, -340', 'mono', 400, 11, P['dim'], 'middle') + '</g>')
    S.add(f'<g opacity="0">{window(T, 0.3, 3.3)}' + S.text(30, 44, 'tp Steve 120 72 -340', 'mono', 500, 13, P['ink']) + '</g>')
    # y column: ~ ~50 ~
    S.add(f'<rect x="372" y="60" width="118" height="214" rx="8" fill="{P["well"]}"/>')
    S.add(f'<line x1="431" y1="72" x2="431" y2="262" stroke="{P["line"]}" stroke-width="1.5"/>')
    for k in range(5):
        S.add(f'<line x1="425" y1="{250 - k * 44}" x2="437" y2="{250 - k * 44}" stroke="{P["faint"]}" stroke-width="1.5"/>')
    S.t(446, 254, 'y', 'mono', 400, 11, P['faint'])
    S.add(f'<g>{anim_tr(T, [(3.9, "0 0"), (4.7, "0 -150"), (T - 0.35, "0 -150"), (T - 0.05, "0 0")])}'
          f'<rect x="422" y="236" width="18" height="18" rx="3" fill="{P["ink"]}"/>'
          + S.text(431, 249, 'S', 'sans', 600, 11, P['card'], 'middle') + '</g>')
    S.add(f'<g opacity="0">{window(T, 3.6, T - 0.25)}' + S.text(30, 44, 'tp Steve ~ ~50 ~', 'mono', 500, 13, P['ink']) + '</g>')
    save(f'tile-teleport-{theme}.svg', S.render('Teleport'))


def tile_world(theme):
    S = Svg(520, 300, theme)
    P = S.P
    T = 8.0
    tile_frame(S)
    cx, cy, r = 130, 182, 86
    S.add(f'<rect x="30" y="60" width="200" height="214" rx="8" fill="{P["well"]}"/>')
    S.add(f'<line x1="40" y1="{cy}" x2="220" y2="{cy}" stroke="{P["line"]}" stroke-width="1.5"/>')
    S.add(f'<path d="M{cx - r} {cy} A{r} {r} 0 0 1 {cx + r} {cy}" fill="none" stroke="{P["line"]}" stroke-width="1.5" stroke-dasharray="3 6"/>')
    # sun travels day -> noon, then moon rises for night
    sun = f'<g>{anim_tr(T, [(0, f"{cx} {cy}"), (0.4, f"{cx} {cy}"), (1.2, f"{cx - 60} {cy - 62}"), (2.6, f"{cx - 60} {cy - 62}"), (3.2, f"{cx} {cy - r}"), (4.6, f"{cx} {cy - r}"), (5.2, f"{cx + r} {cy}"), (T, f"{cx + r} {cy}")])}'
    sun += f'<circle r="13" fill="{P["sig"]}"/></g>'
    S.add(f'<g clip-path="url(#sky)">{sun}</g>')
    S.defs.append(f'<clipPath id="sky"><rect x="30" y="60" width="200" height="{cy - 60}"/></clipPath>')
    moon = f'<g opacity="0">{window(T, 5.2, T - 0.3)}<g>{anim_tr(T, [(5.2, f"{cx - r} {cy}"), (6.2, f"{cx - 40} {cy - 72}")])}'
    moon += f'<circle r="11" fill="{P["dim"]}"/><circle cx="5" cy="-4" r="9" fill="{P["well"]}"/></g></g>'
    S.add(f'<g clip-path="url(#sky)">{moon}</g>')
    for (t0, t1, label) in [(0.4, 2.6, 'time set day'), (2.6, 4.6, 'time set noon'), (4.6, T - 0.2, 'time set night')]:
        S.add(f'<g opacity="0">{window(T, t0, t1, 0.05)}' + S.text(cx, 222, label, 'mono', 500, 11.5, P['ink'], 'middle') + '</g>')
    # gamerule switches
    rules = [('keepInventory', False, 1.0), ('doDaylightCycle', True, None), ('mobGriefing', True, 3.0), ('doFireTick', True, None)]
    for i, (rule, on, flip) in enumerate(rules):
        y = 78 + i * 50
        S.add(f'<rect x="254" y="{y}" width="236" height="40" rx="6" fill="{P["panel"]}" stroke="{P["line"]}"/>')
        S.add(S.text(268, y + 24, rule, 'mono', 400, 11, P['ink']))
        on_c, off_c = P['ack'], P['led']
        a, b = ('on', 'off')
        start_on = on
        knob = []
        trk = []
        if flip is None:
            knob = [(0, '0 0' if start_on else '-16 0')]
            trk = [(0, on_c if start_on else off_c)]
        else:
            k_on, k_off = '0 0', '-16 0'
            s, e = (k_on, k_off) if start_on else (k_off, k_on)
            knob = [(0, s), (flip, s), (flip + 0.2, e), (T - 0.4, e), (T - 0.1, s)]
            cs, ce = (on_c, off_c) if start_on else (off_c, on_c)
            trk = [(0, cs), (flip + 0.1, ce), (T - 0.25, cs)]
        S.add(f'<rect x="440" y="{y + 11}" width="36" height="18" rx="4" fill="{trk[0][1]}">{anim("fill", T, trk, "discrete")}</rect>')
        S.add(f'<g>{anim_tr(T, knob)}<rect x="458" y="{y + 13}" width="16" height="14" rx="3" fill="{P["key"]}"/></g>')
    save(f'tile-world-{theme}.svg', S.render('World'))


def tile_players(theme):
    S = Svg(520, 300, theme)
    P = S.P
    T = 7.0
    tile_frame(S)
    for i, name in enumerate(['Steve', 'Alex']):
        y = 40 + i * 64
        S.add(f'<rect x="30" y="{y}" width="460" height="50" rx="8" fill="{P["panel"]}" stroke="{P["line"]}"/>')
        S.add(f'<rect x="42" y="{y + 10}" width="30" height="30" rx="5" fill="{P["well"]}"/>')
        S.t(57, y + 30, name[0], 'sans', 600, 14, P['ink'], 'middle')
        S.t(84, y + 30, name, 'sans', 600, 15, P['ink'])
        bx = 300
        for lab in ['op', 'kick', 'ban']:
            w = width(lab, 'mono', 500, 11) + 20
            press = name == 'Alex' and lab == 'op'
            g = f'<g>{anim_tr(T, [(0.9, "0 0"), (0.97, "0 2"), (1.2, "0 0")]) if press else ""}'
            g += f'<rect x="{bx}" y="{y + 12}" width="{w:.1f}" height="26" rx="5" fill="{P["key"]}" stroke="{P["sig"] if lab == "ban" else P["line"]}"/>'
            g += S.text(bx + 10, y + 29, lab, 'mono', 500, 11, P['sig'] if lab == 'ban' else P['ink']) + '</g>'
            S.add(g)
            bx += w + 8
        if name == 'Alex':
            S.add(f'<g opacity="0">{anim("opacity", T, [(1.3, 0), (1.45, 1), (T - 0.4, 1), (T - 0.15, 0)])}'
                  f'<rect x="{84 + width("Alex", "sans", 600, 15) + 10}" y="{y + 16}" width="30" height="18" rx="4" fill="{P["ack"]}"/>'
                  + S.text(84 + width('Alex', 'sans', 600, 15) + 25, y + 29, 'OP', 'sans', 600, 10.5, P['card'], 'middle') + '</g>')
    lines = [(1.0, '> op Alex', P['ink']), (1.3, 'Made Alex a server operator', P['ack']),
             (3.0, '> whitelist add Alex', P['ink']), (3.3, 'Added Alex to the whitelist', P['ack']),
             (4.6, '> say Restart in 10 minutes', P['ink'])]
    S.add(f'<rect x="30" y="178" width="460" height="100" rx="8" fill="{P["well"]}"/>')
    for k, (t, s, c) in enumerate(lines):
        y = 198 + k * 18
        S.add(f'<g opacity="0">{anim("opacity", T, [(t, 0), (t + 0.1, 1), (T - 0.4, 1), (T - 0.15, 0)])}' + S.text(44, y, s, 'mono', 400, 10.5, c) + '</g>')
    save(f'tile-players-{theme}.svg', S.render('Players'))


def tile_console(theme):
    S = Svg(520, 300, theme)
    P = S.P
    T = 8.0
    tile_frame(S)
    S.add(f'<rect x="30" y="40" width="460" height="44" rx="7" fill="{P["panel"]}" stroke="{P["sig"]}" stroke-width="1.5"/>')
    cw = width('a', 'mono', 400, 13)

    def typed(s, t0, t1, per=0.09, y=67):
        n = len(s)
        cid = S.uid('k')
        pts = [(t0, 0)] + [(t0 + (i + 1) * per, round((i + 1) * cw, 1)) for i in range(n)] + [(t1, round(n * cw, 1)), (t1 + 0.01, 0)]
        S.defs.append(f'<clipPath id="{cid}"><rect x="46" y="{y - 16}" height="22" width="0">{anim("width", T, pts, "discrete")}</rect></clipPath>')
        S.add(f'<g clip-path="url(#{cid})">' + S.text(46, y, s, 'mono', 400, 13, P['ink']) + '</g>')
        caret = [(0, 46)]
        return t0 + n * per

    e1 = typed('seed', 0.4, 1.4)
    e2 = typed('give {t} minecraft:spyglass', 2.6, 4.9, 0.07)
    # caret
    pts = [(0, '0 0'), (0.4, '0 0')] + [(0.4 + (i + 1) * 0.09, f'{(i + 1) * cw:.1f} 0') for i in range(4)] + [(1.4, '0 0'), (2.6, '0 0')]
    pts += [(2.6 + (i + 1) * 0.07, f'{(i + 1) * cw:.1f} 0') for i in range(27)] + [(4.9, '0 0')]
    S.add(f'<g>{anim_tr(T, pts)}<rect x="47" y="53" width="2" height="18" fill="{P["sig"]}">'
          f'<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1s" repeatCount="indefinite"/></rect></g>')
    S.add(f'<rect x="30" y="102" width="460" height="168" rx="8" fill="{P["well"]}"/>')
    log = [(1.45, '> seed', P['ink']), (1.6, 'Seed: [-4172144997902289642]', P['ack']),
           (4.95, '> give Steve minecraft:spyglass', P['ink']), (5.15, 'Gave 1 [Spyglass] to Steve', P['ack'])]
    for k, (t, s, c) in enumerate(log):
        y = 130 + k * 26
        S.add(f'<g opacity="0">{anim("opacity", T, [(t, 0), (t + 0.1, 1), (T - 0.4, 1), (T - 0.15, 0)])}' + S.text(46, y, s, 'mono', 400, 12, c) + '</g>')
    # {t} became the target
    hx = 46 + width('> give ', 'mono', 400, 12)
    S.add(f'<rect x="{hx - 3:.1f}" y="{130 + 2 * 26 - 14}" width="{width("Steve", "mono", 400, 12) + 6:.1f}" height="19" rx="3" fill="none" stroke="{P["sig"]}" stroke-width="1.5" opacity="0">'
          f'{anim("opacity", T, [(5.0, 0), (5.1, 1), (T - 0.4, 1), (T - 0.15, 0)])}</rect>')
    save(f'tile-console-{theme}.svg', S.render('Console'))


if __name__ == '__main__':
    for theme in ('light', 'dark'):
        for lang in ('en', 'tr'):
            banner(lang, theme)
            architecture(lang, theme)
            packet(lang, theme)
        tile_powers(theme)
        tile_items(theme)
        tile_teleport(theme)
        tile_world(theme)
        tile_players(theme)
        tile_console(theme)
