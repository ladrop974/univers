"""Génère les ressources de SPORE (textures, sprites, nébuleuses, musique) et les intègre dans index.html.

Tout est procédural (aucune image ou son externe) et reproductible (graines fixes).
Usage : python tools/build_assets.py   (depuis games/spore)
Besoin : pillow, numpy, ffmpeg (pour la musique en MP3).
"""
import base64
import io
import math
import os
import re
import subprocess
import tempfile
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(HERE, "..", "index.html")
rng = np.random.default_rng(1337)


# ---------------------------------------------------------------- outils
def spectral(n, beta, seed):
    """Bruit fractal raccordable (synthèse spectrale), valeurs 0..1."""
    r = np.random.default_rng(seed)
    fx = np.fft.fftfreq(n)[:, None]
    fy = np.fft.fftfreq(n)[None, :]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1
    amp = 1 / f ** beta
    amp[0, 0] = 0
    ph = r.uniform(0, 2 * np.pi, (n, n))
    img = np.real(np.fft.ifft2(amp * np.exp(1j * ph)))
    img -= img.min()
    return img / img.max()


def worley(n, pts, seed):
    """Cellules raccordables : renvoie F1 et F2 normalisés."""
    r = np.random.default_rng(seed)
    p = r.uniform(0, n, (pts, 2))
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    d = []
    for (px, py) in p:
        dx = np.abs(xx - px)
        dx = np.minimum(dx, n - dx)
        dy = np.abs(yy - py)
        dy = np.minimum(dy, n - dy)
        d.append(np.sqrt(dx * dx + dy * dy))
    d = np.sort(np.stack(d), axis=0)
    f1, f2 = d[0], d[1]
    return f1 / f1.max(), f2 / f2.max()


def webp_uri(img, q=78, lossless=False):
    b = io.BytesIO()
    img.save(b, "WEBP", quality=q, method=6, lossless=lossless)
    return "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode(), len(b.getvalue())


def to_img(a, mode="L"):
    return Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), mode)


# ---------------------------------------------------------------- textures de détail (superposées en « overlay »)
def detail_cells():
    n = 1024
    f1, f2 = worley(n, 160, 1)
    veins = 1 - np.exp(-((f2 - f1) * 30) ** 2)
    fb = spectral(n, 1.3, 2)
    fine = spectral(n, 0.9, 9)
    a = 0.5 + 0.2 * (veins - 0.5) + 0.3 * (fb - 0.5) + 0.12 * (fine - 0.5)
    return to_img(a)


def detail_caustics():
    n = 1024
    a = spectral(n, 1.7, 3)
    b = spectral(n, 1.5, 4)
    c = np.abs(np.sin(a * 18 + b * 6))
    c = 1 - c ** 0.35
    g = spectral(n, 2.2, 5)
    out = 0.5 + 0.3 * (c - 0.5) + 0.2 * (g - 0.5)
    return to_img(out)


def skin():
    n = 256
    f1, f2 = worley(n, 34, 7)
    cell = np.clip(f1 * 2.2, 0, 1)
    rim = 1 - np.exp(-((f2 - f1) * 10) ** 2)
    fb = spectral(n, 1.2, 8)
    a = 0.5 + 0.25 * (cell - 0.5) - 0.25 * (rim - 0.5) + 0.15 * (fb - 0.5)
    return to_img(a)


# ---------------------------------------------------------------- nébuleuses et étoiles (parallaxe)
def nebula(seed, cols, n=1024):
    a = spectral(n, 2.0, seed)
    b = spectral(n, 2.3, seed + 1)
    c = spectral(n, 1.6, seed + 2)
    dens = np.clip((a - 0.45) * 2.2, 0, 1) ** 1.6 * (0.6 + 0.4 * c)
    mix = b[..., None]
    c1 = np.array(cols[0], np.float32)[None, None] / 255
    c2 = np.array(cols[1], np.float32)[None, None] / 255
    rgb = c1 * (1 - mix) + c2 * mix
    rgb = rgb * (0.6 + 0.6 * c[..., None])
    alpha = dens * 0.85
    img = np.dstack([np.clip(rgb, 0, 1), alpha])
    return Image.fromarray((img * 255).astype(np.uint8), "RGBA")


def stars(n=1024, count=1400, seed=11):
    r = np.random.default_rng(seed)
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for _ in range(count):
        x, y = r.uniform(0, n, 2)
        s = r.choice([0.6, 0.8, 1, 1.2, 1.8, 2.6], p=[0.3, 0.25, 0.2, 0.13, 0.08, 0.04])
        col = [(255, 255, 255), (200, 220, 255), (255, 230, 200), (255, 200, 240)][r.integers(4)]
        a = int(r.uniform(120, 255))
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                d.ellipse([x + ox - s, y + oy - s, x + ox + s, y + oy + s], fill=col + (a,))
    glow = im.filter(ImageFilter.GaussianBlur(2.2))
    return Image.alpha_composite(glow, im)


# ---------------------------------------------------------------- sprites de décor (atlas 6 biomes × 6)
S = 192  # taille finale d'un sprite
K = 4  # sur-échantillonnage pour l'anticrénelage
Z = S * K


def blank():
    return Image.new("RGBA", (Z, Z), (0, 0, 0, 0))


def glow_layer(im, radius, strength=1.0):
    g = im.filter(ImageFilter.GaussianBlur(radius))
    if strength != 1:
        a = np.array(g).astype(np.float32)
        a[..., 3] *= strength
        g = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
    return Image.alpha_composite(g, im)


def radial(cx, cy, r, c_in, c_out):
    yy, xx = np.mgrid[0:Z, 0:Z].astype(np.float32)
    t = np.clip(np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r, 0, 1)[..., None]
    ci = np.array(c_in, np.float32)[None, None]
    co = np.array(c_out, np.float32)[None, None]
    return Image.fromarray((ci * (1 - t) + co * t).astype(np.uint8), "RGBA")


def masked(fill, mask):
    out = blank()
    out.paste(fill, (0, 0), mask)
    return out


def ellipse_mask(box):
    m = Image.new("L", (Z, Z), 0)
    ImageDraw.Draw(m).ellipse(box, fill=255)
    return m


def poly_mask(pts):
    m = Image.new("L", (Z, Z), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


def P(x, y):
    return (x * Z, y * Z)


def sprite_mushroom(cap, spots, tall=1.0, n=1, seed=0):
    r = np.random.default_rng(seed)
    im = blank()
    for i in range(n):
        ox = 0.5 + (i - (n - 1) / 2) * 0.26 + r.uniform(-0.03, 0.03)
        sc = (1 - 0.25 * abs(i - (n - 1) / 2)) * tall
        stem_w = 0.06 * sc
        top = 0.88 - 0.55 * sc
        stem = radial(ox * Z, 0.7 * Z, 0.25 * Z, (235, 215, 255, 255), (120, 80, 160, 255))
        im = Image.alpha_composite(im, masked(stem, poly_mask([P(ox - stem_w, 0.9), P(ox - stem_w * 0.7, top + 0.06),
                                                              P(ox + stem_w * 0.7, top + 0.06), P(ox + stem_w, 0.9)])))
        cw = 0.2 * sc
        capf = radial(ox * Z, (top - 0.02) * Z, cw * Z * 1.4, tuple(min(255, c + 90) for c in cap) + (255,), tuple(cap) + (255,))
        m = Image.new("L", (Z, Z), 0)
        ImageDraw.Draw(m).pieslice([P(ox - cw, top - cw * 0.9)[0], P(ox - cw, top - cw * 0.9)[1], P(ox + cw, top + cw * 0.5)[0],
                                    P(ox + cw, top + cw * 0.5)[1]], 180, 360, fill=255)
        im = Image.alpha_composite(im, masked(capf, m))
        d = ImageDraw.Draw(im)
        for _ in range(5):
            sx = ox + r.uniform(-cw * 0.7, cw * 0.7)
            sy = top - r.uniform(0.02, cw * 0.6)
            rr = r.uniform(0.008, 0.02) * sc
            d.ellipse([P(sx - rr, sy - rr), P(sx + rr, sy + rr)], fill=spots + (230,))
    return glow_layer(im, 18, 0.9)


def sprite_crystals(col, n=5, seed=0):
    r = np.random.default_rng(seed)
    im = blank()
    for i in range(n):
        a = r.uniform(-0.6, 0.6)
        h = r.uniform(0.35, 0.7)
        w = r.uniform(0.05, 0.09)
        bx = 0.5 + r.uniform(-0.16, 0.16)
        by = 0.88
        tip = (bx + math.sin(a) * h, by - math.cos(a) * h)
        nx, ny = math.cos(a) * w, math.sin(a) * w
        pts = [P(bx - nx, by - ny), P(tip[0] - nx * 0.6, tip[1] - ny * 0.6), P(*tip), P(tip[0] + nx * 0.6, tip[1] + ny * 0.6), P(bx + nx, by + ny)]
        light = tuple(min(255, c + 110) for c in col)
        f = radial(tip[0] * Z, tip[1] * Z, h * Z, light + (250,), tuple(col) + (230,))
        im = Image.alpha_composite(im, masked(f, poly_mask(pts)))
        d = ImageDraw.Draw(im)
        d.line([P(bx, by), P(*tip)], fill=(255, 255, 255, 170), width=int(K * 1.5))
    return glow_layer(im, 22, 1.0)


def sprite_blob(c_in, c_out, bubbles=6, seed=0, glow=14):
    r = np.random.default_rng(seed)
    im = blank()
    pts = []
    for k in range(40):
        t = k / 40 * 2 * math.pi
        rr = 0.3 + 0.05 * math.sin(t * 3 + seed) + 0.03 * math.sin(t * 7)
        pts.append(P(0.5 + math.cos(t) * rr, 0.6 + math.sin(t) * rr * 0.55))
    f = radial(0.45 * Z, 0.5 * Z, 0.4 * Z, c_in, c_out)
    im = Image.alpha_composite(im, masked(f, poly_mask(pts)))
    d = ImageDraw.Draw(im)
    for _ in range(bubbles):
        x, y = r.uniform(0.3, 0.7), r.uniform(0.45, 0.72)
        rr = r.uniform(0.015, 0.045)
        d.ellipse([P(x - rr, y - rr), P(x + rr, y + rr)], outline=(255, 255, 255, 200), width=int(K * 1.2))
    return glow_layer(im, glow, 0.8)


def sprite_radial(col, arms=8, inner=0.08, outer=0.4, seed=0, ring=True):
    im = blank()
    d = ImageDraw.Draw(im)
    for k in range(arms):
        t = k / arms * 2 * math.pi + seed
        for j in range(18):
            u = j / 17
            rr = inner + (outer - inner) * u
            x = 0.5 + math.cos(t + u * 0.6) * rr
            y = 0.5 + math.sin(t + u * 0.6) * rr
            s = 0.018 * (1 - u * 0.7)
            d.ellipse([P(x - s, y - s), P(x + s, y + s)], fill=tuple(col) + (int(255 * (1 - u * 0.6)),))
    if ring:
        d.ellipse([P(0.5 - inner, 0.5 - inner), P(0.5 + inner, 0.5 + inner)], fill=(255, 255, 255, 240))
    return glow_layer(im, 16, 1.0)


def sprite_kelp(col, seed=0):
    r = np.random.default_rng(seed)
    im = blank()
    d = ImageDraw.Draw(im)
    for s in range(4):
        x0 = 0.35 + s * 0.1
        pts = []
        for j in range(30):
            u = j / 29
            pts.append(P(x0 + 0.06 * math.sin(u * 6 + s), 0.95 - u * r.uniform(0.6, 0.85)))
        d.line(pts, fill=tuple(col) + (230,), width=int(K * 5 * (1 - s * 0.15)), joint="curve")
        for j in range(0, 30, 6):
            x, y = pts[j]
            d.ellipse([x - K * 5, y - K * 3, x + K * 5, y + K * 3], fill=(200, 255, 255, 200))
    return glow_layer(im, 12, 0.8)


def sprite_coral(col, seed=0):
    r = np.random.default_rng(seed)
    im = blank()
    d = ImageDraw.Draw(im)

    def branch(x, y, a, ln, w, depth):
        if depth == 0 or ln < 0.02:
            d.ellipse([P(x - 0.015, y - 0.015), P(x + 0.015, y + 0.015)], fill=(255, 240, 250, 255))
            return
        x2 = x + math.cos(a) * ln
        y2 = y + math.sin(a) * ln
        d.line([P(x, y), P(x2, y2)], fill=tuple(col) + (240,), width=max(1, int(K * w)))
        for s in (-1, 1):
            branch(x2, y2, a + s * r.uniform(0.3, 0.6), ln * r.uniform(0.62, 0.78), w * 0.7, depth - 1)

    branch(0.5, 0.92, -math.pi / 2, 0.22, 7, 6)
    return glow_layer(im, 14, 0.9)


def sprite_gear(col, teeth=12, seed=0):
    im = blank()
    pts = []
    for k in range(teeth * 4):
        t = k / (teeth * 4) * 2 * math.pi + seed
        rr = 0.36 if (k % 4) in (0, 1) else 0.3
        pts.append(P(0.5 + math.cos(t) * rr, 0.5 + math.sin(t) * rr))
    f = radial(0.4 * Z, 0.4 * Z, 0.45 * Z, (230, 250, 255, 255), tuple(col) + (255,))
    im = Image.alpha_composite(im, masked(f, poly_mask(pts)))
    d = ImageDraw.Draw(im)
    d.ellipse([P(0.39, 0.39), P(0.61, 0.61)], fill=(10, 20, 35, 255), outline=(120, 255, 255, 255), width=K * 3)
    for k in range(6):
        t = k / 6 * 2 * math.pi
        d.line([P(0.5 + math.cos(t) * 0.12, 0.5 + math.sin(t) * 0.12), P(0.5 + math.cos(t) * 0.26, 0.5 + math.sin(t) * 0.26)],
               fill=(10, 20, 35, 255), width=K * 4)
    return glow_layer(im, 10, 0.7)


def sprite_pylon(col, seed=0):
    im = blank()
    f = radial(0.5 * Z, 0.3 * Z, 0.6 * Z, (200, 240, 255, 255), (30, 60, 90, 255))
    im = Image.alpha_composite(im, masked(f, poly_mask([P(0.42, 0.92), P(0.46, 0.2), P(0.54, 0.2), P(0.58, 0.92)])))
    d = ImageDraw.Draw(im)
    for y in (0.35, 0.5, 0.65, 0.8):
        d.line([P(0.44, y), P(0.56, y)], fill=tuple(col) + (255,), width=K * 3)
    d.ellipse([P(0.42, 0.1), P(0.58, 0.26)], fill=tuple(col) + (255,))
    for rr in (0.14, 0.2, 0.26):
        d.arc([P(0.5 - rr, 0.18 - rr), P(0.5 + rr, 0.18 + rr)], 200, 340, fill=tuple(col) + (160,), width=K * 2)
    return glow_layer(im, 14, 1.0)


def sprite_hex(col, seed=0):
    im = blank()
    d = ImageDraw.Draw(im)
    for (cx, cy, rr) in [(0.5, 0.5, 0.2), (0.28, 0.38, 0.11), (0.72, 0.62, 0.12), (0.7, 0.3, 0.08), (0.3, 0.7, 0.08)]:
        pts = [P(cx + math.cos(k / 6 * 2 * math.pi) * rr, cy + math.sin(k / 6 * 2 * math.pi) * rr) for k in range(6)]
        d.polygon(pts, outline=tuple(col) + (255,), fill=(12, 30, 50, 200))
        d.line(pts + [pts[0]], fill=tuple(col) + (255,), width=K * 3)
    d.line([P(0.28, 0.38), P(0.5, 0.5), P(0.72, 0.62)], fill=(255, 255, 255, 200), width=K * 2)
    d.line([P(0.7, 0.3), P(0.5, 0.5), P(0.3, 0.7)], fill=(255, 255, 255, 200), width=K * 2)
    return glow_layer(im, 12, 1.0)


def sprite_rock(c_in, c_out, seed=0, ring=False):
    r = np.random.default_rng(seed)
    im = blank()
    pts = []
    for k in range(14):
        t = k / 14 * 2 * math.pi
        rr = 0.26 * r.uniform(0.75, 1.1)
        pts.append(P(0.5 + math.cos(t) * rr, 0.55 + math.sin(t) * rr * 0.8))
    f = radial(0.42 * Z, 0.45 * Z, 0.38 * Z, c_in, c_out)
    im = Image.alpha_composite(im, masked(f, poly_mask(pts)))
    d = ImageDraw.Draw(im)
    for _ in range(5):
        x, y = r.uniform(0.35, 0.65), r.uniform(0.42, 0.68)
        rr = r.uniform(0.02, 0.05)
        d.ellipse([P(x - rr, y - rr), P(x + rr, y + rr)], fill=(0, 0, 0, 70))
    if ring:
        d.arc([P(0.12, 0.42), P(0.88, 0.7)], 160, 380, fill=(255, 210, 160, 230), width=K * 4)
    return glow_layer(im, 8, 0.6)


def sprite_nebula(c1, c2, seed=0):
    a = spectral(Z // 2, 2.2, 100 + seed)
    yy, xx = np.mgrid[0:Z // 2, 0:Z // 2].astype(np.float32) / (Z // 2)
    fall = np.clip(1 - np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2) * 2.1, 0, 1)
    dens = np.clip((a - 0.3) * 1.8, 0, 1) * fall ** 1.3
    m = a[..., None]
    rgb = (np.array(c1)[None, None] * (1 - m) + np.array(c2)[None, None] * m) / 255
    img = np.dstack([rgb, dens])
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGBA").resize((Z, Z), Image.BICUBIC)
    d = ImageDraw.Draw(im)
    r = np.random.default_rng(seed)
    for _ in range(14):
        x, y = r.uniform(0.25, 0.75, 2)
        s = r.uniform(0.004, 0.01)
        d.ellipse([P(x - s, y - s), P(x + s, y + s)], fill=(255, 255, 255, 255))
    return glow_layer(im, 6, 0.8)


def sprite_tree(col, seed=0):
    r = np.random.default_rng(seed)
    im = blank()
    d = ImageDraw.Draw(im)

    def br(x, y, a, ln, w, depth):
        if depth == 0:
            return
        x2, y2 = x + math.cos(a) * ln, y + math.sin(a) * ln
        d.line([P(x, y), P(x2, y2)], fill=(60, 50, 40, 255), width=max(1, int(K * w)))
        for s in (-1, 1):
            if r.random() < 0.85:
                br(x2, y2, a + s * r.uniform(0.35, 0.8), ln * 0.7, w * 0.65, depth - 1)

    br(0.5, 0.95, -math.pi / 2, 0.25, 9, 5)
    for _ in range(9):
        x, y = r.uniform(0.25, 0.75), r.uniform(0.15, 0.55)
        rr = r.uniform(0.012, 0.025)
        d.ellipse([P(x - rr, y - rr), P(x + rr, y + rr)], fill=tuple(col) + (255,))
    return glow_layer(im, 10, 0.8)


def sprite_reeds(col, seed=0):
    r = np.random.default_rng(seed)
    im = blank()
    d = ImageDraw.Draw(im)
    for _ in range(9):
        x = r.uniform(0.25, 0.75)
        h = r.uniform(0.35, 0.7)
        bend = r.uniform(-0.08, 0.08)
        pts = [P(x + bend * (j / 10) ** 2, 0.95 - h * j / 10) for j in range(11)]
        d.line(pts, fill=(70, 120, 50, 255), width=K * 3, joint="curve")
        tx, ty = pts[-1]
        d.ellipse([tx - K * 5, ty - K * 12, tx + K * 5, ty + K * 4], fill=tuple(col) + (255,))
    return glow_layer(im, 12, 1.0)


def sprite_comet(seed=0):
    im = blank()
    d = ImageDraw.Draw(im)
    for j in range(40):
        u = j / 39
        x = 0.78 - u * 0.6
        y = 0.25 + u * 0.5
        s = 0.06 * (1 - u) + 0.005
        d.ellipse([P(x - s, y - s), P(x + s, y + s)], fill=(160 + int(95 * (1 - u)), 200, 255, int(220 * (1 - u) + 20)))
    d.ellipse([P(0.73, 0.2), P(0.83, 0.3)], fill=(255, 255, 255, 255))
    return glow_layer(im, 16, 1.0)


def build_atlas():
    rows = [
        # 0 bouillon azuré
        [sprite_radial((90, 220, 255), 10, seed=0.2), sprite_blob((180, 250, 255, 220), (40, 140, 200, 120), 9, 1),
         sprite_coral((90, 200, 255), 2), sprite_kelp((60, 200, 220), 3), sprite_radial((150, 255, 230), 6, 0.06, 0.32, 1.0),
         sprite_coral((255, 140, 220), 5)],
        # 1 jungle fongique
        [sprite_mushroom((190, 70, 255), (255, 220, 255), 1.0, 1, 1), sprite_mushroom((255, 80, 170), (255, 240, 200), 0.8, 3, 2),
         sprite_mushroom((120, 90, 255), (180, 255, 255), 1.1, 2, 3), sprite_blob((230, 150, 255, 230), (120, 40, 180, 140), 3, 4),
         sprite_radial((210, 120, 255), 7, 0.05, 0.36, 0.5), sprite_mushroom((255, 120, 60), (255, 255, 200), 0.7, 3, 5)],
        # 2 désert de silice
        [sprite_crystals((255, 170, 80), 6, 1), sprite_crystals((255, 220, 160), 4, 2), sprite_rock((240, 180, 120, 255), (120, 70, 30, 255), 3),
         sprite_crystals((255, 120, 90), 7, 4), sprite_rock((255, 210, 150, 255), (150, 90, 40, 255), 5), sprite_crystals((200, 240, 255), 5, 6)],
        # 3 marais toxique
        [sprite_blob((190, 255, 120, 230), (40, 120, 30, 150), 10, 1), sprite_tree((170, 255, 90), 2), sprite_reeds((150, 255, 80), 3),
         sprite_blob((120, 255, 160, 220), (20, 90, 40, 140), 6, 4), sprite_rock((110, 140, 90, 255), (30, 50, 30, 255), 5),
         sprite_mushroom((140, 255, 60), (40, 80, 20), 0.8, 2, 6)],
        # 4 plaine biomécanique
        [sprite_gear((80, 200, 230), 12, 0.1), sprite_pylon((90, 255, 255), 1), sprite_hex((90, 240, 255), 2),
         sprite_gear((150, 170, 200), 9, 0.3), sprite_pylon((255, 120, 220), 3), sprite_hex((255, 200, 90), 4)],
        # 5 zone cosmique
        [sprite_nebula((120, 60, 255), (255, 80, 180), 1), sprite_nebula((60, 180, 255), (180, 100, 255), 2), sprite_rock((200, 190, 230, 255), (60, 50, 90, 255), 3, True),
         sprite_crystals((190, 140, 255), 6, 4), sprite_comet(5), sprite_radial((255, 230, 180), 12, 0.05, 0.42, 0.7)],
    ]
    atlas = Image.new("RGBA", (S * 6, S * 6), (0, 0, 0, 0))
    for j, row in enumerate(rows):
        for i, sp in enumerate(row):
            atlas.paste(sp.resize((S, S), Image.LANCZOS), (i * S, j * S))
    return atlas


# ---------------------------------------------------------------- musique d'ambiance (boucle)
def music(path_mp3, bpm=72, bars=24, prog=None, seed=3, kick_from=8, shift=0):
    sr = 22050
    beat = 60 / bpm
    secs = bars * 4 * beat
    n = int(sr * secs)
    t = np.arange(n) / sr
    out = np.zeros(n, np.float32)
    note = lambda m: 440 * 2 ** ((m - 69) / 12)
    prog = prog or [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [48, 52, 55]), (55, [55, 59, 62]),
                    (50, [50, 53, 57]), (53, [53, 57, 60]), (52, [52, 56, 59]), (57, [57, 60, 64])]
    prog = [(r0 + shift, [m + shift for m in c]) for r0, c in prog]
    bar = 4 * beat
    r = np.random.default_rng(seed)
    for b in range(bars):
        root, chord = prog[b % len(prog)]
        s0, s1 = int(b * bar * sr), int((b + 1) * bar * sr)
        seg = t[s0:s1] - t[s0]
        env = np.clip(seg / 1.2, 0, 1) * np.clip((bar - seg) / 1.2, 0, 1)
        pad = np.zeros_like(seg)
        for m in chord:
            for det in (-0.12, 0, 0.13):
                f = note(m + 12) * (1 + det / 100)
                ph = 2 * np.pi * f * seg + r.uniform(0, 6.28)
                pad += (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)) / 9
        out[s0:s1] += 0.32 * pad * env
        out[s0:s1] += 0.22 * np.sin(2 * np.pi * note(root - 12) * seg) * env
        # arpège en « gouttes »
        arp = chord + [chord[0] + 12, chord[1] + 12]
        for k in range(8):
            st = int(s0 + k * beat / 2 * sr)
            if st >= n or (b < 2 and k % 2):
                continue
            ln = int(sr * 1.4)
            tt = np.arange(min(ln, n - st)) / sr
            f = note(arp[(k * 3 + b) % len(arp)] + 24)
            pl = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 3.2) + 0.3 * np.sin(4 * np.pi * f * tt) * np.exp(-tt * 6)
            out[st:st + len(tt)] += 0.07 * pl
        # pulsation douce (deuxième moitié)
        if b >= kick_from:
            for k in range(4):
                st = int(s0 + k * beat * sr)
                tt = np.arange(int(sr * 0.35)) / sr
                if st + len(tt) > n:
                    continue
                kick = np.sin(2 * np.pi * (55 + 60 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 9)
                out[st:st + len(tt)] += 0.18 * kick
    # écho / réverbération simple
    for d, g in ((0.37, 0.35), (0.61, 0.25), (1.13, 0.18)):
        k = int(d * sr)
        out[k:] += g * out[:-k].copy()
    # boucle sans couture : on replie la queue sur le début
    fade = int(sr * 2)
    out[:fade] += out[-fade:] * np.linspace(1, 0, fade)
    out = out[:-fade] if False else out
    out /= np.max(np.abs(out)) * 1.05
    pcm = (out * 32767).astype(np.int16)
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    with wave.open(tmp.name, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-ac", "1", "-b:a", "48k", path_mp3], check=True)
    os.unlink(tmp.name)
    return secs


# ---------------------------------------------------------------- assemblage
def main():
    assets = {}
    sizes = {}

    def add(k, uri_size):
        assets[k], sizes[k] = uri_size

    add("detailA", webp_uri(detail_cells().convert("RGB"), 72))
    add("detailB", webp_uri(detail_caustics().convert("RGB"), 72))
    add("skin", webp_uri(skin().convert("RGB"), 80))
    add("neb1", webp_uri(nebula(21, [(90, 40, 200), (255, 60, 170)]), 70))
    add("neb2", webp_uri(nebula(31, [(30, 140, 255), (120, 255, 220)]), 70))
    add("stars", webp_uri(stars(), 80))
    add("atlas", webp_uri(build_atlas(), 82))
    mp3 = os.path.join(tempfile.gettempdir(), "spore_music.mp3")
    secs = music(mp3)
    raw = open(mp3, "rb").read()
    assets["music"] = "data:audio/mpeg;base64," + base64.b64encode(raw).decode()
    sizes["music"] = len(raw)
    # thème du stade Espace : plus rapide, mineur, pulsation dès le début
    cosmic = [(50, [50, 53, 57]), (46, [46, 50, 53]), (53, [53, 57, 60]), (48, [48, 52, 55]),
              (50, [50, 53, 57]), (55, [55, 58, 62]), (52, [52, 55, 59]), (49, [49, 52, 57])]
    mp3b = os.path.join(tempfile.gettempdir(), "spore_music2.mp3")
    secs2 = music(mp3b, bpm=96, bars=32, prog=cosmic, seed=9, kick_from=0, shift=2)
    raw2 = open(mp3b, "rb").read()
    assets["music2"] = "data:audio/mpeg;base64," + base64.b64encode(raw2).decode()
    sizes["music2"] = len(raw2)
    secs += secs2

    js = "const ASSETS=" + "{" + ",".join(f'{k}:"{v}"' for k, v in assets.items()) + "};"
    html = open(HTML, encoding="utf-8").read()
    block = "/*ASSETS-BEGIN*/" + js + "/*ASSETS-END*/"
    if "/*ASSETS-BEGIN*/" in html:
        html = re.sub(r"/\*ASSETS-BEGIN\*/.*?/\*ASSETS-END\*/", lambda _m: block, html, flags=re.S)
    else:
        raise SystemExit("marqueur /*ASSETS-BEGIN*/ absent de index.html")
    open(HTML, "w", encoding="utf-8", newline="").write(html)
    for k, v in sizes.items():
        print(f"{k:8s} {v / 1024:7.1f} Ko")
    print(f"musique {secs:.0f} s")
    print("index.html", os.path.getsize(HTML), "octets")


if __name__ == "__main__":
    main()
