#!/usr/bin/env python3
"""Draws SweaxBeacon's own 16x16 pixel icons into src/pixel/icons.json.

    python tools/pixel_icons.py [--sheet out.png]

Every icon is drawn here from lines, boxes and ellipses, then gets a dark
outline, so the set reads like inventory sprites without copying any game
texture. --sheet writes a scaled contact sheet for checking them by eye.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'pixel', 'icons.json')
N = 16
OUTLINE = '#17141d'


class Icon:
    def __init__(self):
        self.g = [[None] * N for _ in range(N)]

    def px(self, x, y, c):
        if 0 <= x < N and 0 <= y < N:
            self.g[y][x] = c
        return self

    def get(self, x, y):
        return self.g[y][x] if 0 <= x < N and 0 <= y < N else None

    def line(self, x0, y0, x1, y1, c):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.px(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy
        return self

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c)
        return self

    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(N):
            for x in range(N):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    self.px(x, y, c)
        return self

    def rows(self, x0, y0, rows, pal):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.' and ch != ' ':
                    self.px(x0 + i, y0 + j, pal[ch])
        return self

    def shade(self, c_from, light, dark):
        """Lighten the top-left edge and darken the bottom-right edge of one colour region."""
        src = [row[:] for row in self.g]
        for y in range(N):
            for x in range(N):
                if src[y][x] != c_from:
                    continue
                up = src[y - 1][x] if y > 0 else None
                left = src[y][x - 1] if x > 0 else None
                down = src[y + 1][x] if y < N - 1 else None
                right = src[y][x + 1] if x < N - 1 else None
                if dark and (down != c_from or right != c_from):
                    self.g[y][x] = dark
                if light and (up != c_from or left != c_from):
                    self.g[y][x] = light
        return self

    def outline(self, c=OUTLINE, diagonal=False):
        src = [row[:] for row in self.g]
        for y in range(N):
            for x in range(N):
                if src[y][x] is not None:
                    continue
                nb = [(0, 1), (1, 0), (0, -1), (-1, 0)]
                if diagonal:
                    nb += [(1, 1), (-1, -1), (1, -1), (-1, 1)]
                for dx, dy in nb:
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < N and 0 <= yy < N and src[yy][xx] is not None and src[yy][xx] != c:
                        self.g[y][x] = c
                        break
        return self

    def data(self):
        pal = {}
        rows = []
        for row in self.g:
            s = ''
            for c in row:
                if c is None:
                    s += '.'
                    continue
                if c not in pal:
                    pal[c] = chr(ord('a') + len(pal)) if len(pal) < 26 else chr(ord('A') + len(pal) - 26)
                s += pal[c]
            rows.append(s)
        return {'p': {v: k for k, v in pal.items()}, 'r': rows}


ICONS = {}


def icon(name):
    def deco(fn):
        ICONS[name] = fn
        return fn
    return deco


# ---------------------------------------------------------------- tools and weapons

def sword(blade, edge, guard, grip, pommel):
    i = Icon()
    for k in range(9):
        i.px(14 - k, 1 + k, blade)
        if k:
            i.px(13 - k, 1 + k, edge)
    i.px(14, 1, '#ffffff')
    i.line(2, 8, 6, 12, guard)
    i.line(4, 11, 2, 13, grip)
    i.px(1, 14, pommel).px(2, 14, pommel).px(1, 13, pommel)
    return i.outline()


@icon('sword_iron')
def _():
    return sword('#e9eef2', '#a9b3bb', '#5b5f66', '#7a5230', '#5b5f66')


@icon('sword_diamond')
def _():
    return sword('#8ff5e8', '#2fb8ad', '#145e5a', '#7a5230', '#145e5a')


@icon('sword_netherite')
def _():
    return sword('#9a8f9c', '#62586a', '#3a333c', '#4a3527', '#3a333c')


@icon('sword_wood')
def _():
    return sword('#c79a5b', '#8a6436', '#5e4122', '#5e4122', '#5e4122')


@icon('sword_gold')
def _():
    return sword('#fff1a6', '#e2b83a', '#9a7413', '#7a5230', '#9a7413')


def pickaxe(head, shade, stick):
    i = Icon()
    i.line(3, 13, 11, 5, stick)
    i.line(2, 14, 3, 13, stick)
    # the head: an arc over the top of the handle
    pts = [(5, 2), (6, 2), (7, 2), (8, 2), (9, 2), (10, 3), (11, 3), (12, 4), (12, 5), (13, 6), (13, 7), (13, 8), (13, 9), (13, 10)]
    for x, y in pts:
        i.px(x, y, head)
    for x, y in [(6, 3), (7, 3), (8, 3), (9, 3), (10, 4), (11, 4), (11, 5), (12, 6), (12, 7), (12, 8), (12, 9)]:
        i.px(x, y, shade)
    i.px(4, 2, shade).px(13, 11, shade)
    return i.outline()


@icon('pickaxe_diamond')
def _():
    return pickaxe('#8ff5e8', '#2fb8ad', '#8a6436')


@icon('pickaxe_gold')
def _():
    return pickaxe('#fff1a6', '#e2b83a', '#8a6436')


@icon('axe_wood')
def _():
    i = Icon()
    i.line(3, 13, 11, 5, '#8a6436')
    i.line(2, 14, 3, 13, '#8a6436')
    i.rows(7, 0, [
        '...aa...',
        '..abba..',
        '.abbbba.',
        'abbbbbba',
        'abbbbba.',
        '.abbba..',
        '..aba...',
        '...a....',
    ], {'a': '#6b6f76', 'b': '#c9ced4'})
    return i.outline()


def potion(liquid, light, dark):
    i = Icon()
    i.rows(0, 0, [
        '................',
        '......kkkk......',
        '......kKKk......',
        '.....gggggg.....',
        '......gwwg......',
        '.....gwLLLg.....',
        '....gwLLLLLg....',
        '...gwLLLLLLLg...',
        '...gLLLLLLLLg...',
        '...gLLLLLLLLg...',
        '...gLLLLLLLdg...',
        '...gdLLLLLLdg...',
        '....gddddddg....',
        '.....gggggg.....',
        '................',
        '................',
    ], {'k': '#6e4a2a', 'K': '#a8774a', 'g': '#cfe3f2', 'w': light, 'L': liquid, 'd': dark})
    return i.outline()


POTIONS = {
    'speed': ('#55c8ff', '#b9ecff', '#2a86c4'),
    'haste': ('#ffd84a', '#fff4b0', '#c79a16'),
    'jump_boost': ('#5df07a', '#c3ffd0', '#22a845'),
    'strength': ('#e2463a', '#ffb1a8', '#9b231b'),
    'resistance': ('#9b7cf2', '#dcd0ff', '#6247b8'),
    'fire_resistance': ('#ff9a3c', '#ffd6a8', '#c2601a'),
    'water_breathing': ('#3d74ff', '#b5ccff', '#2343ad'),
    'night_vision': ('#3437c9', '#a7a9ff', '#1d1f80'),
    'invisibility': ('#c8cdd6', '#f4f6fa', '#8a919c'),
    'regeneration': ('#ff6fc4', '#ffc8ea', '#c03c8b'),
    'slow_falling': ('#f2ebda', '#ffffff', '#b8ad94'),
    'dolphins_grace': ('#7fd6e0', '#d6f7fb', '#3f98a3'),
    'health_boost': ('#ff7a5c', '#ffd0c4', '#c44a30'),
    'luck': ('#71d64a', '#cdf5b8', '#3e9420'),
    'absorption': ('#ffcc3d', '#fff0b8', '#c08f10'),
    'glowing': ('#e8f0a0', '#ffffff', '#a8b060'),
    'conduit_power': ('#3fd1c8', '#c8f5f2', '#1e8f88'),
    'powers': ('#c86bff', '#ecc8ff', '#7d33b8'),
}

for _name, _c in POTIONS.items():
    ICONS['potion_' + _name] = (lambda c: (lambda: potion(*c)))(_c)


@icon('shield')
def _():
    i = Icon()
    i.rows(2, 1, [
        '.aaaaaaaaaa.',
        'abbbbbbbbbba',
        'abbbbccbbbba',
        'abbbbccbbbba',
        'abbccccccbba',
        'abbccccccbba',
        'abbbbccbbbba',
        'abbbbccbbbba',
        '.abbbccbbba.',
        '.abbbbbbbba.',
        '..abbbbbba..',
        '...abbbba...',
        '....abba....',
        '.....aa.....',
    ], {'a': '#8b6a3c', 'b': '#5aa9ff', 'c': '#eaf4ff'})
    i.shade('#5aa9ff', '#8fc6ff', '#3a7fd6')
    return i.outline()


@icon('heart')
def _():
    i = Icon()
    i.rows(1, 2, [
        '.aaa...aaa....',
        'abbba.abbba...',
        'abwbbabbbbba..',
        'abbbbbbbbbba..',
        'abbbbbbbbbba..',
        '.abbbbbbbba...',
        '..abbbbbba....',
        '...abbbba.....',
        '....abba......',
        '.....aa.......',
    ], {'a': '#7a1010', 'b': '#ff3b3b', 'w': '#ffd0d0'})
    i.shade('#ff3b3b', None, '#c41f1f')
    return i.outline()


@icon('steak')
def _():
    i = Icon()
    i.ellipse(8.5, 8, 6.2, 4.6, '#a8552c')
    i.ellipse(8.2, 7.6, 4.6, 3.2, '#c97446')
    i.line(4, 7, 9, 5, '#e0a07a')
    i.line(6, 10, 12, 8, '#8a3f1e')
    i.px(3, 11, '#f2e6d6').px(2, 12, '#f2e6d6').px(3, 12, '#d8c9b4')
    return i.outline()


def apple(body, light, dark, leaf='#3fae3a'):
    i = Icon()
    i.ellipse(8, 9.5, 5.4, 5.2, body)
    i.px(8, 4, '#6e4a2a').px(8, 3, '#6e4a2a').px(9, 2, leaf).px(10, 2, leaf).px(10, 3, leaf).px(11, 3, leaf)
    i.px(5, 7, light).px(5, 8, light).px(6, 6, light)
    i.shade(body, None, dark)
    return i.outline()


@icon('apple_golden')
def _():
    return apple('#ffd23f', '#fff6c2', '#d59a12')


@icon('apple_enchanted')
def _():
    i = apple('#ffd23f', '#fff6c2', '#d59a12')
    for x, y in [(3, 5), (12, 6), (13, 11), (6, 14)]:
        i.px(x, y, '#e6a6ff')
    return i


def orb(body, light, dark, iris=None):
    i = Icon()
    i.ellipse(8, 8, 5.6, 5.6, body)
    i.shade(body, None, dark)
    i.px(6, 5, light).px(5, 6, light).px(6, 6, light).px(5, 7, light)
    if iris:
        i.ellipse(8.5, 8.5, 2.2, 3.2, iris)
        i.px(8, 8, '#0b0b0b').px(8, 9, '#0b0b0b')
    return i.outline()


@icon('ender_pearl')
def _():
    return orb('#1f8f7a', '#7ff0d6', '#0e5246')


@icon('ender_eye')
def _():
    return orb('#3fa34a', '#a8f0a0', '#1f6326', iris='#c9e86a')


@icon('xp_bottle')
def _():
    i = potion('#7dfc3f', '#e3ffc8', '#3fb31a')
    i.px(6, 8, '#fff59a').px(9, 10, '#fff59a')
    return i


@icon('totem')
def _():
    i = Icon()
    i.rows(3, 1, [
        '...aaaa...',
        '..abbbba..',
        '..abcbca..',
        '..abbbba..',
        '...addа...'.replace('а', 'a'),
        'aa.abba.aa',
        'abaabbaaba',
        '.abbbbbba.',
        '..abeeba..',
        '..abbbba..',
        '...abba...',
        '...abba...',
        '..ab..ba..',
        '..aa..aa..',
    ], {'a': '#8a6a1c', 'b': '#f5d65a', 'c': '#1d8a47', 'd': '#c79a2a', 'e': '#3fd16a'})
    return i.outline()


@icon('elytra')
def _():
    i = Icon()
    i.rows(1, 2, [
        '..aa......aa..',
        '.abba....abba.',
        'abbbba..abbbba',
        'abcbbba.abbbcba'[0:14],
        'abccbba.abbccba'[0:14],
        'abccbba..abbcca'[0:14],
        'abccba....abcca'[0:14],
        'abcba......abca'[0:14],
        'abca........aca'[0:14],
        'aba..........ba',
        '.a............a',
    ], {'a': '#5b5f7a', 'b': '#a7abc9', 'c': '#7e83a6'})
    return i.outline()


@icon('firework')
def _():
    i = Icon()
    i.rect(6, 4, 9, 12, '#d9473b')
    i.rect(6, 6, 9, 7, '#f2efe6')
    i.rect(6, 10, 9, 10, '#f2efe6')
    i.rows(6, 1, ['.aa.', 'abba', 'abba'], {'a': '#5b5f66', 'b': '#9aa1aa'})
    i.line(8, 13, 9, 15, '#8a6436')
    return i.outline()


@icon('tnt')
def _():
    i = Icon()
    i.rect(2, 3, 13, 13, '#db3b2c')
    i.rect(2, 6, 13, 10, '#f1ede4')
    for x in (4, 8, 12):
        i.px(x, 3, '#a8261b').px(x, 4, '#a8261b').px(x, 11, '#a8261b').px(x, 12, '#a8261b').px(x, 13, '#a8261b')
    i.rows(3, 7, ['aaa.aa.a.aaa', '.a..a.aa..a.', '.a..a..a..a.'], {'a': '#1b1a1f'})
    i.rect(2, 2, 13, 2, '#8a8a8a')
    return i.outline()


def cube(top, top2, left, left2, right, right2):
    """A block seen from above-front, the way inventories show blocks."""
    i = Icon()
    # top face (diamond)
    for y in range(0, 6):
        w = y * 2 + 2 if y < 3 else (5 - y) * 2 + 2
        x0 = 8 - w // 2 * 2 // 1 if False else 8 - (y + 1) * 2 if y < 3 else 8 - (6 - y) * 2
        for x in range(max(1, x0), min(15, 16 - x0)):
            i.px(x, y + 1, top if (x + y) % 3 else top2)
    # left and right faces
    for y in range(4, 15):
        for x in range(2, 8):
            if y - (x - 2) // 2 >= 4 and y <= 12 + (x - 2) // 2 + 0:
                i.px(x, y, left if (x * 3 + y) % 4 else left2)
        for x in range(8, 14):
            if y - (13 - x) // 2 >= 4 and y <= 12 + (13 - x) // 2:
                i.px(x, y, right if (x + y * 3) % 5 else right2)
    return i


@icon('block_grass')
def _():
    i = Icon()
    i.rows(1, 1, [
        '......aaaa....',
        '....aaabaaaa..',
        '..aaaabaaabaaa'[0:14],
        'aaabaaaaaaabaa'[0:14],
        'ccaaaabaaaaadd',
        'cccccaaaaddddd',
        'ceccccaadddfdd',
        'cceeccccdddddd',
        'ccccccecdfdddd',
        'cceccccc dddfd'.replace(' ', 'd'),
        'ccccecccdddddd',
        '.cccccccddfdd.',
        '...ccccc dd...'.replace(' ', 'd'),
        '.....ccdd.....',
    ], {'a': '#6cc24a', 'b': '#8fe36a', 'c': '#8a5a35', 'd': '#6b4428', 'e': '#a9764d', 'f': '#55341d'})
    for x, y in [(1, 5), (2, 6), (3, 5), (6, 7), (9, 6), (12, 6), (13, 5), (14, 6), (11, 7)]:
        i.px(x, y, '#4f9a33')
    return i.outline()


def flat_block(rows, pal):
    i = Icon()
    i.rows(1, 1, rows, pal)
    return i.outline()


@icon('block_obsidian')
def _():
    return flat_block([
        'aaaaaaaaaaaaaa',
        'abbaaacaaabbaa',
        'aabaaaaccaabaa',
        'aaaacaaaaaaaaa',
        'acaaaaabbaaaca',
        'aaaaabbbaaaaaa',
        'aabaaaaaaacaaa',
        'aaaaacaaaaaaaa',
        'abaaaaaaabbaaa',
        'aaacaaabaaaaba',
        'aaaaaaaaaacaaa',
        'acaabaaaaaaaaa',
        'aaaaaaacaaaaba',
        'aaaaaaaaaaaaaa',
    ], {'a': '#1b1326', 'b': '#3b2a57', 'c': '#5e3f8c'})


@icon('block_command')
def _():
    i = flat_block([
        'aaaaaaaaaaaaaa',
        'abbbbbbbbbbbba',
        'abccccccccccba',
        'abcddddddddcba',
        'abcd......dcba',
        'abcd.e....dcba',
        'abcd..e...dcba',
        'abcd.e....dcba',
        'abcd..ffffdcba',
        'abcd......dcba',
        'abcddddddddcba',
        'abccccccccccba',
        'abbbbbbbbbbbba',
        'aaaaaaaaaaaaaa',
    ], {'a': '#6b4a2e', 'b': '#c98f5a', 'c': '#a8713f', 'd': '#3d2a1c', 'e': '#d9d9d9', 'f': '#d9d9d9'})
    for y in range(5, 11):
        for x in range(5, 11):
            if i.get(x, y) is None:
                i.px(x, y, '#141217')
    return i


@icon('block_stone')
def _():
    return flat_block([
        'aabaaaaaaabaaa',
        'aaaaacaaaaaaaa',
        'abaaaaaabaaaca',
        'aaaabaaaaaaaaa',
        'acaaaaaacaabaa',
        'aaaaaabaaaaaaa',
        'aabaaaaaaaacaa',
        'aaaaacaaabaaaa',
        'abaaaaaaaaaaba',
        'aaaabaaaacaaaa',
        'acaaaaaaaaabaa',
        'aaaaaacaaaaaaa',
        'abaaaaaaabaaca',
        'aaaacaaaaaaaaa',
    ], {'a': '#8d8f92', 'b': '#a4a6a9', 'c': '#707276'})


@icon('bricks')
def _():
    return flat_block([
        'aaaaaabaaaaaab',
        'aaaaaabaaaaaab',
        'bbbbbbbbbbbbbb',
        'aaabaaaaaabaaa',
        'aaabaaaaaabaaa',
        'bbbbbbbbbbbbbb',
        'aaaaaabaaaaaab',
        'aaaaaabaaaaaab',
        'bbbbbbbbbbbbbb',
        'aaabaaaaaabaaa',
        'aaabaaaaaabaaa',
        'bbbbbbbbbbbbbb',
        'aaaaaabaaaaaab',
        'aaaaaabaaaaaab',
    ], {'a': '#a5543e', 'b': '#d8c7b8'})


@icon('chest')
def _():
    i = Icon()
    i.rect(1, 3, 14, 13, '#a8713f')
    i.rect(1, 3, 14, 7, '#c48a52')
    i.rect(1, 8, 14, 8, '#5e3c1f')
    i.rect(1, 3, 14, 3, '#7a5230')
    i.rect(7, 6, 8, 9, '#c7c9cc')
    i.px(7, 9, '#7d8086').px(8, 9, '#7d8086')
    i.rect(1, 13, 14, 13, '#7a5230')
    i.shade('#a8713f', None, '#8a5a30')
    return i.outline()


@icon('compass')
def _():
    i = Icon()
    i.ellipse(8, 8, 6.2, 6.2, '#8a8f99')
    i.ellipse(8, 8, 5, 5, '#e9e4d6')
    i.line(8, 8, 11, 4, '#d83a3a')
    i.line(8, 8, 5, 12, '#5b6170')
    i.px(8, 8, '#2b2f3a')
    return i.outline()


@icon('clock')
def _():
    i = Icon()
    i.ellipse(8, 8, 6.2, 6.2, '#c79a2a')
    i.ellipse(8, 8, 5, 5, '#2d3a8c')
    for y in range(3, 9):
        for x in range(3, 14):
            if i.get(x, y) == '#2d3a8c':
                i.px(x, y, '#5aa9ff')
    i.ellipse(10.5, 6, 1.6, 1.6, '#ffe36a')
    i.ellipse(5.5, 11, 1.4, 1.4, '#eef2ff')
    i.line(8, 8, 8, 4, '#3b2a10')
    return i.outline()


@icon('map')
def _():
    i = Icon()
    i.rect(2, 2, 13, 13, '#e7dcc0')
    i.rect(3, 3, 12, 12, '#cfe6a8')
    i.rect(3, 9, 12, 12, '#7cb9e8')
    i.line(3, 9, 12, 7, '#7cb9e8')
    i.rect(5, 4, 7, 6, '#7aa84a')
    i.px(10, 5, '#d83a3a').px(9, 5, '#d83a3a').px(10, 4, '#d83a3a')
    return i.outline()


@icon('torch')
def _():
    i = Icon()
    i.rect(7, 6, 8, 14, '#8a6436')
    i.rect(7, 6, 7, 14, '#a87a46')
    i.rect(6, 3, 9, 5, '#ffb43a')
    i.rect(7, 2, 8, 4, '#fff1a6')
    i.px(7, 1, '#ffd85a')
    return i.outline()


@icon('bow')
def _():
    i = Icon()
    pts = [(4, 2), (5, 2), (6, 2), (7, 3), (8, 3), (9, 4), (10, 5), (11, 6), (12, 7), (12, 8), (13, 9), (13, 10), (13, 11), (13, 12)]
    for x, y in pts:
        i.px(x, y, '#9a6a36')
    i.px(3, 3, '#c79a5b').px(13, 13, '#c79a5b')
    i.line(3, 3, 13, 13, '#e9e9e9')
    i.line(2, 14, 11, 5, '#6e4a2a')
    i.px(11, 5, '#d9d9d9').px(12, 4, '#d9d9d9').px(12, 5, '#d9d9d9')
    i.px(2, 14, '#f2f2f2').px(1, 14, '#f2f2f2').px(2, 15, '#f2f2f2')
    return i.outline()


@icon('arrow_up')
def _():
    i = Icon()
    i.rows(3, 2, [
        '....aa....',
        '...abba...',
        '..abbbba..',
        '.abbbbbba.',
        'aabbbbbbaa',
        '...abba...',
        '...abba...',
        '...abba...',
        '...abba...',
        '...abba...',
        '...aaaa...',
    ], {'a': '#2d6f7a', 'b': '#8ef6ff'})
    return i.outline()


@icon('bucket_milk')
def _():
    i = Icon()
    i.rows(2, 3, [
        '.aaaaaaaaaa.',
        'abbbbbbbbbba',
        'abwwwwwwwwba',
        'abwwwwwwwwba',
        '.abbbbbbbba.',
        '.abbbbbbbba.',
        '.abbcbbbbba.',
        '..abbbbbba..',
        '..abbbbbba..',
        '...aaaaaa...',
    ], {'a': '#4b4f57', 'b': '#bfc4cb', 'c': '#e9edf2', 'w': '#fbfbf7'})
    i.line(3, 3, 6, 1, '#4b4f57').line(12, 3, 9, 1, '#4b4f57').line(6, 1, 9, 1, '#4b4f57')
    return i.outline()


@icon('feather')
def _():
    i = Icon()
    i.line(3, 13, 12, 3, '#9aa0a8')
    for k in range(8):
        x, y = 4 + k, 12 - k
        i.px(x, y - 1, '#f4f2ee').px(x + 1, y, '#f4f2ee')
        if 1 < k < 7:
            i.px(x - 1, y - 2, '#dcd8d0').px(x + 2, y + 1, '#dcd8d0')
    i.px(2, 14, '#9aa0a8')
    return i.outline()


@icon('flower')
def _():
    i = Icon()
    i.line(8, 8, 8, 14, '#3e9a3a')
    i.line(8, 12, 11, 10, '#3e9a3a')
    i.px(11, 9, '#5cc24f').px(12, 9, '#5cc24f').px(4, 11, '#5cc24f').px(5, 11, '#5cc24f').px(6, 12, '#3e9a3a').px(7, 12, '#3e9a3a')
    i.ellipse(8, 5.5, 3.6, 3.4, '#e03a3a')
    i.ellipse(8, 5.5, 1.3, 1.2, '#2a2a2a')
    return i.outline()


@icon('skull')
def _():
    i = Icon()
    i.rows(2, 2, [
        '..aaaaaaaa..',
        '.abbbbbbbba.',
        'abbbbbbbbbba',
        'abbbbbbbbbba',
        'abccbbbbccba',
        'abccbbbbccba',
        'abbbbccbbbba',
        'abbbbbbbbbba',
        '.abcbcbcbca.',
        '.abbbbbbbba.',
        '..aaaaaaaa..',
    ], {'a': '#6f6a5e', 'b': '#e4dfcf', 'c': '#2a2824'})
    return i.outline()


@icon('sun')
def _():
    i = Icon()
    i.rect(4, 4, 11, 11, '#ffd83a')
    i.rect(5, 5, 10, 10, '#fff3a0')
    i.rect(6, 6, 9, 9, '#ffffff')
    for x, y in [(7, 1), (8, 1), (7, 14), (8, 14), (1, 7), (1, 8), (14, 7), (14, 8), (2, 2), (13, 2), (2, 13), (13, 13)]:
        i.px(x, y, '#ffd83a')
    return i.outline()


@icon('sunset')
def _():
    i = Icon()
    i.rect(4, 6, 11, 11, '#ff8a3a')
    i.rect(5, 7, 10, 11, '#ffc06a')
    i.rect(1, 12, 14, 12, '#7a3a6a')
    i.rect(2, 13, 13, 13, '#4a2a5a')
    for x, y in [(7, 3), (8, 3), (1, 9), (14, 9), (2, 5), (13, 5)]:
        i.px(x, y, '#ff8a3a')
    return i.outline()


@icon('moon')
def _():
    i = Icon()
    i.rect(4, 4, 11, 11, '#e9edf7')
    i.rect(5, 5, 6, 6, '#b9c0d4').rect(9, 8, 10, 9, '#b9c0d4').px(6, 9, '#b9c0d4')
    i.shade('#e9edf7', None, '#c9cfdf')
    for x, y in [(2, 2), (13, 3), (14, 12), (1, 13)]:
        i.px(x, y, '#cfd6ff')
    return i.outline()


def cloud(body, shade):
    i = Icon()
    i.ellipse(6, 7, 3.6, 3, body)
    i.ellipse(10, 6, 3.6, 3.2, body)
    i.rect(2, 7, 13, 9, body)
    i.rect(2, 9, 13, 9, shade)
    return i


@icon('cloud')
def _():
    i = cloud('#f4f6fb', '#c9d0dd')
    return i.outline()


@icon('rain')
def _():
    i = cloud('#aab4c6', '#7d889c')
    for x, y in [(3, 11), (6, 12), (9, 11), (12, 12), (4, 14), (10, 14), (7, 15)]:
        i.px(x, y, '#5aa9ff')
    return i.outline()


@icon('thunder')
def _():
    i = cloud('#6f7891', '#4f5770')
    i.line(9, 10, 7, 12, '#ffe94a').line(7, 12, 10, 12, '#ffe94a').line(10, 12, 7, 15, '#ffe94a')
    return i.outline()


@icon('cog')
def _():
    i = Icon()
    i.ellipse(8, 8, 5.2, 5.2, '#9aa1aa')
    for x0, y0, x1, y1 in [(7, 1, 8, 3), (7, 12, 8, 14), (1, 7, 3, 8), (12, 7, 14, 8), (3, 3, 4, 4), (11, 3, 12, 4), (3, 11, 4, 12), (11, 11, 12, 12)]:
        i.rect(x0, y0, x1, y1, '#9aa1aa')
    i.ellipse(8, 8, 2.2, 2.2, None)
    i.shade('#9aa1aa', '#d3d8de', '#6c737c')
    return i.outline()


@icon('player')
def _():
    i = Icon()
    i.rows(2, 1, [
        'aaaaaaaaaaaa',
        'aaaaaaaaaaaa',
        'aaabbbbbbaaa',
        'abbbbbbbbbba',
        'bccbbbbbbccb',
        'bdcbbbbbbdcb',
        'bbbbbeebbbbb',
        'bbbbbbbbbbbb',
        'bbbffffffbbb',
        'bbbbbbbbbbbb',
        'bbbbbbbbbbbb',
        'bbbbbbbbbbbb',
    ], {'a': '#1f2430', 'b': '#d8a77f', 'c': '#ffffff', 'd': '#2e9e6a', 'e': '#b07f5c', 'f': '#8f4f3a'})
    return i.outline()


@icon('players')
def _():
    i = Icon()
    i.rows(6, 1, [
        'aaaaaaaa',
        'abbbbbba',
        'bcbbbbcb',
        'bbbeebbb',
        'bbffffbb',
        'bbbbbbbb',
    ], {'a': '#2b2b2b', 'b': '#7a5a46', 'c': '#ffffff', 'e': '#5e4334', 'f': '#4a3226'})
    i.rows(1, 6, [
        'aaaaaaaa',
        'abbbbbba',
        'bcbbbbcb',
        'bbbeebbb',
        'bbffffbb',
        'bbbbbbbb',
        'gggggggg',
        'gggggggg',
        'gggggggg',
    ], {'a': '#4a3020', 'b': '#e0b48c', 'c': '#ffffff', 'e': '#b07f5c', 'f': '#8a5a3c', 'g': '#3fa3c4'})
    return i.outline()


@icon('bed')
def _():
    i = Icon()
    i.rect(1, 7, 14, 10, '#d83a3a')
    i.rect(1, 7, 4, 10, '#f4f2ee')
    i.rect(1, 11, 14, 11, '#a8713f')
    i.px(1, 12, '#7a5230').px(14, 12, '#7a5230')
    i.shade('#d83a3a', '#ff6a5a', '#a8261b')
    return i.outline()


@icon('lever')
def _():
    i = Icon()
    i.rect(3, 10, 12, 13, '#8d8f92')
    i.line(7, 10, 11, 3, '#8a6436')
    i.px(11, 2, '#d83a3a').px(12, 2, '#d83a3a').px(12, 3, '#d83a3a')
    return i.outline()


@icon('beacon')
def _():
    i = Icon()
    i.rect(1, 3, 14, 14, '#bfeef5')
    i.rect(2, 4, 13, 13, '#6fd3e6')
    i.rect(3, 11, 12, 13, '#2a1d3d')
    i.rect(5, 6, 10, 10, '#eafcff')
    i.rect(6, 5, 9, 11, '#eafcff')
    i.rect(7, 7, 8, 8, '#ffffff')
    i.rect(1, 3, 14, 3, '#e8fbff')
    i.rect(1, 3, 1, 14, '#e8fbff')
    return i.outline()


@icon('netherite_set')
def _():
    i = Icon()
    i.rows(2, 2, [
        'aa.aa..aa.aa',
        'abbab..abbab',
        'abbbbaabbbba',
        '.abbbbbbbba.',
        '..abbbbbba..',
        '..abccccba..',
        '..abbbbbba..',
        '..abbbbbba..',
        '..abccccba..',
        '..abbbbbba..',
        '...aaaaaa...',
    ], {'a': '#231e24', 'b': '#5e5560', 'c': '#7d737f'})
    return i.outline()


@icon('chestplate_diamond')
def _():
    i = Icon()
    i.rows(2, 2, [
        'aa.aa..aa.aa',
        'abbab..abbab',
        'abbbbaabbbba',
        '.abbbbbbbba.',
        '..abbbbbba..',
        '..abccccba..',
        '..abbbbbba..',
        '..abbbbbba..',
        '..abccccba..',
        '..abbbbbba..',
        '...aaaaaa...',
    ], {'a': '#145e5a', 'b': '#5fe6d8', 'c': '#b8fff6'})
    return i.outline()


def render():
    out = {}
    for name, fn in ICONS.items():
        out[name] = fn().data()
    return out


def sheet(data, path, scale=6):
    from PIL import Image, ImageDraw
    names = list(data)
    cols = 8
    cell = N * scale + 24
    rows = (len(names) + cols - 1) // cols
    img = Image.new('RGB', (cols * cell * 2, rows * (cell + 14)), '#0c0a10')
    d = ImageDraw.Draw(img)
    for k, name in enumerate(names):
        ic = data[name]
        for half, bg in ((0, '#0c0a10'), (1, '#ece8e1')):
            ox = (k % cols) * cell * 2 + half * cell + 12
            oy = (k // cols) * (cell + 14) + 8
            d.rectangle([ox - 4, oy - 4, ox + N * scale + 4, oy + N * scale + 4], fill=bg)
            for y, row in enumerate(ic['r']):
                for x, ch in enumerate(row):
                    if ch == '.':
                        continue
                    d.rectangle([ox + x * scale, oy + y * scale, ox + (x + 1) * scale - 1, oy + (y + 1) * scale - 1], fill=ic['p'][ch])
        d.text(((k % cols) * cell * 2 + 12, (k // cols) * (cell + 14) + N * scale + 12), name, fill='#9c95ab')
    img.save(path)


if __name__ == '__main__':
    data = render()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))
    print(len(data), 'icons ->', os.path.relpath(OUT, ROOT))
    if '--sheet' in sys.argv:
        sheet(data, sys.argv[sys.argv.index('--sheet') + 1])
