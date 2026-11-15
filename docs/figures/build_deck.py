#!/usr/bin/env python3
"""
Builds docs/Simplayz-Project-Deck.pptx — a 19-slide analysis of the Simplayz world simulator.

    npx tsx docs/figures/extract.ts     # engine output → docs/figures/data/*.json
    python3 docs/figures/render.py      # data → docs/assets/*.png
    python3 docs/figures/build_deck.py  # assets → docs/Simplayz-Project-Deck.pptx

Requires python-pptx. Figures are regenerated from this repository's own engine,
so the numbers in the deck are reproducible rather than illustrative.
"""
import copy, os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn
from lxml import etree

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "Simplayz-Project-Deck.pptx")
A = os.path.join(HERE, "..", "assets") + os.sep

# ---------------------------------------------------------------- palette
BG      = RGBColor(0x10, 0x1D, 0x24)
BG_DEEP = RGBColor(0x0A, 0x14, 0x19)
PANEL   = RGBColor(0x14, 0x26, 0x2C)
PANEL_2 = RGBColor(0x18, 0x2D, 0x33)
INK     = RGBColor(0xE8, 0xEE, 0xE7)
MUTED   = RGBColor(0x8D, 0x9D, 0x93)
DIM     = RGBColor(0x5E, 0x71, 0x6A)
ACCENT  = RGBColor(0xE6, 0xC8, 0x79)
LINE    = RGBColor(0x2B, 0x45, 0x40)
GOOD    = RGBColor(0x7C, 0xCA, 0xA4)
DANGER  = RGBColor(0xEF, 0x80, 0x6D)
VIOLET  = RGBColor(0xBB, 0xA1, 0xFF)
BLUE    = RGBColor(0x62, 0xB9, 0xE9)
LEAF    = RGBColor(0x9F, 0xCF, 0x69)

SANS = "Arial"
MONO = "Consolas"

W, H = 13.333, 7.5
M = 0.72
CW = W - 2 * M

prs = Presentation()
prs.slide_width = Inches(W)
prs.slide_height = Inches(H)
BLANK = prs.slide_layouts[6]


# ---------------------------------------------------------------- helpers
def spacing(run, hundredths):
    run.font._rPr.set("spc", str(int(hundredths)))


def slide(bg=BG):
    s = prs.slides.add_slide(BLANK)
    r = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    r.fill.solid(); r.fill.fore_color.rgb = bg
    r.line.fill.background(); r.shadow.inherit = False
    return s


def tx(s, x, y, w, h, text, size=14, color=INK, bold=False, font=SANS,
       align=PP_ALIGN.LEFT, spacing_pts=0, line=1.0, anchor=MSO_ANCHOR.TOP,
       italic=False, caps=False):
    box = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = line
        r = p.add_run()
        r.text = ln.upper() if caps else ln
        r.font.size = Pt(size); r.font.bold = bold; r.font.name = font
        r.font.color.rgb = color; r.font.italic = italic
        if spacing_pts:
            spacing(r, spacing_pts)
    return box


def rect(s, x, y, w, h, fill=None, line_c=None, lw=0.75, radius=None,
         shape=MSO_SHAPE.RECTANGLE, alpha=None):
    sh = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid(); sh.fill.fore_color.rgb = fill
        if alpha is not None:
            _alpha(sh, alpha)
    if line_c is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line_c; sh.line.width = Pt(lw)
    sh.shadow.inherit = False
    if radius is not None and shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        sh.adjustments[0] = radius
    if sh.has_text_frame:
        sh.text_frame.word_wrap = True
    return sh


def _alpha(sh, pct):
    """pct: 0..1 opacity"""
    fill = sh.fill._xPr.find(qn("a:solidFill"))
    if fill is None:
        return
    for child in list(fill):
        fill.remove(child)
    clr = etree.SubElement(fill, qn("a:srgbClr"))
    clr.set("val", str(sh.fill.fore_color.rgb))
    a = etree.SubElement(clr, qn("a:alpha"))
    a.set("val", str(int(pct * 100000)))


def pic(s, name, x, y, w=None, h=None):
    kw = {}
    if w: kw["width"] = Inches(w)
    if h: kw["height"] = Inches(h)
    return s.shapes.add_picture(A + name, Inches(x), Inches(y), **kw)


def head(s, kicker, title, sub=None, num=None):
    tx(s, M, 0.44, CW, 0.22, kicker, 9, ACCENT, True, MONO, spacing_pts=220, caps=True)
    tx(s, M, 0.68, CW - 0.4, 0.5, title, 28, INK, True, SANS, line=0.95)
    rect(s, M, 1.27, 0.62, 0.028, ACCENT)
    if sub:
        tx(s, M, 1.44, CW - 0.6, 0.5, sub, 12, MUTED, False, SANS, line=1.25)
    if num is not None:
        tx(s, W - M - 0.6, 0.44, 0.6, 0.22, f"{num:02d}", 9, DIM, True, MONO,
           align=PP_ALIGN.RIGHT, spacing_pts=120)


def foot(s, num, label="SIMPLAYZ · PERSISTENT WORLD SIMULATOR"):
    rect(s, M, 6.92, CW, 0.008, LINE)
    tx(s, M, 7.03, 8.5, 0.2, label, 7.5, DIM, False, MONO, spacing_pts=150, caps=True)
    tx(s, W - M - 1.2, 7.03, 1.2, 0.2, f"{num:02d} / 19", 7.5, DIM, False, MONO,
       align=PP_ALIGN.RIGHT, spacing_pts=150)


def card(s, x, y, w, h, title, body, accent=ACCENT, tag=None, title_size=13,
         body_size=10, fill=PANEL):
    rect(s, x, y, w, h, fill, LINE, 0.75, radius=0.06, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    rect(s, x, y + 0.14, 0.035, h - 0.28, accent)
    tx(s, x + 0.26, y + 0.2, w - 0.5, 0.24, title, title_size, INK, True, SANS, line=1.05)
    ty = y + 0.2 + (0.34 if title_size >= 13 else 0.3)
    if tag:
        tx(s, x + 0.26, ty - 0.04, w - 0.5, 0.2, tag, 8, accent, True, MONO,
           spacing_pts=140, caps=True)
        ty += 0.22
    if body:
        tx(s, x + 0.26, ty + 0.02, w - 0.5, h - (ty - y) - 0.18, body, body_size,
           MUTED, False, SANS, line=1.32)


def bullets(s, x, y, w, items, size=11, gap=0.42, color=INK, bullet_color=ACCENT,
            body_w=None):
    """items: list of (bold_lead, rest)"""
    for i, item in enumerate(items):
        lead, rest = item if isinstance(item, tuple) else ("", item)
        yy = y + i * gap
        rect(s, x, yy + 0.075, 0.075, 0.075, bullet_color)
        tf_box = s.shapes.add_textbox(Inches(x + 0.24), Inches(yy - 0.02),
                                      Inches(body_w or (w - 0.24)), Inches(gap))
        tf = tf_box.text_frame; tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        p = tf.paragraphs[0]; p.line_spacing = 1.28
        if lead:
            r1 = p.add_run(); r1.text = lead
            r1.font.size = Pt(size); r1.font.bold = True; r1.font.name = SANS
            r1.font.color.rgb = color
        r2 = p.add_run(); r2.text = rest
        r2.font.size = Pt(size); r2.font.name = SANS; r2.font.color.rgb = MUTED


def stat(s, x, y, w, value, label, accent=ACCENT, vsize=30):
    tx(s, x, y, w, 0.5, value, vsize, accent, True, SANS, line=1.0)
    tx(s, x, y + 0.52, w, 0.42, label, 8.5, MUTED, False, MONO, spacing_pts=120,
       line=1.25, caps=True)


def rows(s, x, y, w, headers, widths, data, row_h=0.36, head_h=0.28,
         size=10, mono_cols=(0,)):
    """custom table: headers list, widths list of inches, data list of tuples"""
    cx = x
    for hcell, cw in zip(headers, widths):
        tx(s, cx, y, cw - 0.1, 0.2, hcell, 7.5, DIM, True, MONO, spacing_pts=140, caps=True)
        cx += cw
    rect(s, x, y + head_h - 0.04, w, 0.008, LINE)
    for ri, rowdata in enumerate(data):
        ry = y + head_h + ri * row_h
        if ri % 2 == 1:
            rect(s, x - 0.08, ry - 0.04, w + 0.16, row_h - 0.02, PANEL, alpha=None)
        cx = x
        for ci, (cell, cw) in enumerate(zip(rowdata, widths)):
            is_mono = ci in mono_cols
            col = INK if ci == 0 else MUTED
            tx(s, cx, ry + 0.06, cw - 0.12, row_h - 0.06, str(cell),
               size if not is_mono else size - 0.5, col,
               bold=(ci == 0), font=MONO if is_mono else SANS, line=1.1)
            cx += cw


def arrow(s, x, y, w=0.34, color=ACCENT, h=0.16, mid=None):
    yy = y - h / 2 if mid is None else mid
    sh = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x), Inches(yy), Inches(w), Inches(h))
    sh.fill.solid(); sh.fill.fore_color.rgb = color
    sh.line.fill.background(); sh.shadow.inherit = False


def chip(s, x, y, w, h, text, color=ACCENT, size=8, fill=None):
    rect(s, x, y, w, h, fill or PANEL_2, LINE, 0.6, radius=0.25,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    tx(s, x + 0.1, y + 0.04, w - 0.2, h - 0.08, text, size, color, True, MONO,
       align=PP_ALIGN.CENTER, spacing_pts=120, caps=True, anchor=MSO_ANCHOR.MIDDLE)


# ================================================================ 01 TITLE
s = slide(BG_DEEP)
pic(s, "hero-title.png", 0, 0, w=W)
overlay = rect(s, 0, 0, W, H, BG_DEEP, alpha=0.62)
grad = rect(s, 0, 0, 7.4, H, BG_DEEP, alpha=0.86)

tx(s, 1.05, 1.42, 6.4, 0.24, "PROJECT ANALYSIS · NOVEMBER 2026", 9.5, ACCENT, True, MONO,
   spacing_pts=280)
tx(s, 1.0, 1.86, 7.0, 1.1, "SIMPLAYZ", 72, INK, True, SANS, line=0.9)
rect(s, 1.05, 3.12, 1.5, 0.045, ACCENT)
tx(s, 1.05, 3.42, 6.2, 1.0,
   "A complete persistent world simulator.\nSurvey real coordinates, build on\nprocedural terrain, command AI officers.",
   19, INK, False, SANS, line=1.42)
tx(s, 1.05, 5.18, 7.6, 0.5,
   "Next.js 16 · React 19 · TypeScript 5.9 · PostgreSQL + Drizzle\nthree.js · Tailwind 4 · Zustand · Drizzle Kit",
   9, MUTED, False, MONO, line=1.6, spacing_pts=60)
for i, (v, l) in enumerate([("48", "SOURCE FILES"), ("3,852", "LINES OF CODE"),
                            ("9", "DATABASE TABLES"), ("12", "API ROUTES")]):
    x = 1.05 + i * 1.72
    rect(s, x, 6.0, 0.02, 0.56, LINE)
    tx(s, x + 0.16, 5.98, 1.5, 0.3, v, 17, ACCENT, True, SANS)
    tx(s, x + 0.16, 6.32, 1.5, 0.2, l, 7, MUTED, False, MONO, spacing_pts=110, caps=True)
tx(s, 1.05, 6.98, 7.0, 0.2, "github.com/simplayz/simplay-ukkyz-v2 · branch arena/fd68e7af",
   7.5, DIM, False, MONO, spacing_pts=80)

# ================================================================ 02 EXEC SUMMARY
s = slide()
head(s, "EXECUTIVE SUMMARY", "What Simplayz actually is", None, 2)
tx(s, M, 1.42, CW - 1.1, 0.62,
   "A browser-based persistent world in which every player stakes a claim on a real coordinate of the Earth. "
   "Terrain, economy, interiors and conflict are one deterministic, server-authoritative simulation — not a mock-up.",
   13, INK, False, SANS, line=1.45)

stats = [("40.96M", "m² per parcel—a 6.4 km\nsquare surveyed 64 × 64"),
         ("14", "biomes derived live\nfrom a seed + lat/lon"),
         ("18", "structures across five\ncategories and 12 models"),
         ("15s", "economic tick, applied\nlazily and capped at 64")]
for i, (v, l) in enumerate(stats):
    x = M + i * (CW / 4)
    rect(s, x, 2.36, CW / 4 - 0.22, 1.42, PANEL, LINE, 0.75, radius=0.06,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    tx(s, x + 0.24, 2.52, 2.4, 0.42, v, 26, ACCENT, True, SANS, line=1.0)
    tx(s, x + 0.24, 3.0, CW / 4 - 0.66, 0.66, l, 8.7, MUTED, False, MONO, line=1.5,
       spacing_pts=60)

tx(s, M, 4.12, CW, 0.2, "THE FOUR CLAIMS THAT MAKE IT CREDIBLE", 8.5, ACCENT, True, MONO,
   spacing_pts=200)
claims = [
    ("Deterministic core", "Terrain, totals and assaults are pure functions of a seed. Zero Math.random() in the engine."),
    ("Real geography", "Web Mercator metres, OpenStreetMap z15 rasters, 100 m survey cells, pilot movement in the scene."),
    ("Server authority", "Every mutation re-validates ownership, terrain, footprint, staffing and credits inside transactions."),
    ("Honest scope", "The AI layer is a routing-profile editor and says so in the product — no fake inference, no fake output."),
]
for i, (t, b) in enumerate(claims):
    x = M + (i % 2) * (CW / 2 + 0.1)
    y = 4.42 + (i // 2) * 1.1
    card(s, x, y, CW / 2 - 0.2, 0.96, t, b, ACCENT if i % 2 == 0 else VIOLET,
         title_size=11.5, body_size=9.3)
foot(s, 2)

# ================================================================ 03 FEATURE SURFACE
s = slide()
head(s, "PRODUCT SURFACE", "Six systems, one snapshot",
     "Every screen renders the same WorldSnapshot DTO — there is exactly one shape of truth in the application.", 3)
feats = [
    ("WORLD SURVEY", "Device or manual lat/lon, clamped to the Mercator band. Nine z15 tiles, three render modes, WASD pilot.", ACCENT),
    ("CLAIM", "A 64 × 64 survey freezes 4,096 cells and eight scores. 72-hour assault protection, re-armed each battle.", GOOD),
    ("CONSTRUCT", "18 structures. Water, slope, footprint and occupancy are all gated server-side; salvage returns 40%.", BLUE),
    ("INTERIORS", "12 × 12 site plans, nine room kinds, required reception + guard, 0–100 coverage compliance model.", LEAF),
    ("ECONOMY", "Six tracks: income, upkeep, food, power, defence, prestige. Lazy 15 s ticks, deficit penalties.", VIOLET),
    ("CONFLICT & AI", "Four-phase deterministic assaults vs five factions. Three officers across 12 model profiles.", DANGER),
]
for i, (t, b, c) in enumerate(feats):
    x = M + (i % 3) * (CW / 3 + 0.04)
    y = 2.12 + (i // 3) * 1.98
    card(s, x, y, CW / 3 - 0.22, 1.76, t, b, c, title_size=12.5, body_size=10.2,
         tag=f"STEP 0{i+1} · {t.split()[0]}")
rect(s, M, 6.06, CW, 0.62, PANEL, LINE, 0.7, radius=0.05, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
for i, (v, l) in enumerate([("48 FILES · 3,852 LINES", "engine 702 · renderer 738 · components 957 · app 775"),
                            ("11 RUNTIME DEPS", "next · react · three · drizzle · pg · zustand"),
                            ("4 PAGES · 12 ROUTES", "one WorldSnapshot contract across the whole app")]):
    x = M + 0.28 + i * (CW / 3)
    tx(s, x, 6.18, CW / 3 - 0.4, 0.2, v, 8.2, ACCENT, True, MONO, spacing_pts=150)
    tx(s, x, 6.42, CW / 3 - 0.4, 0.2, l, 7.8, MUTED, False, MONO, spacing_pts=20)
foot(s, 3)

# ================================================================ 04 PLAYER JOURNEY
s = slide()
head(s, "PLAYER JOURNEY", "World → Area → Site → AI officers",
     "Four nested scopes, each a real route with its own plan view, breadcrumb and 3D preview.", 4)
steps = [
    ("WORLD", "/", "Register a call sign, pick a coordinate, survey the parcel, commission structures on live relief.", ACCENT),
    ("AREA", "/user/:id/area/:id", "64 × 64 development grid, canvas biome minimap and orbit massing preview of every site.", GOOD),
    ("SITE", "…/building/:id", "12 × 12 interior plan: place rooms, drag staffing, satisfy guard and reception coverage.", BLUE),
    ("AI", "/user/:id/ai/management", "Re-point three officers across 12 models, write directives, set autonomy 0–100.", VIOLET),
]
for i, (name, route, desc, c) in enumerate(steps):
    x = M + i * (CW / 4)
    rect(s, x, 2.05, CW / 4 - 0.34, 2.3, PANEL, LINE, 0.75, radius=0.05,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    tx(s, x + 0.24, 2.22, 1.6, 0.2, f"0{i+1}", 9, c, True, MONO, spacing_pts=140)
    tx(s, x + 0.24, 2.5, CW / 4 - 0.8, 0.3, name, 19, INK, True, SANS)
    tx(s, x + 0.24, 2.92, CW / 4 - 0.82, 0.5, route, 7.5, c, False, MONO, line=1.4)
    tx(s, x + 0.24, 3.42, CW / 4 - 0.8, 0.9, desc, 9.5, MUTED, False, SANS, line=1.35)
    if i < 3:
        arrow(s, x + CW / 4 - 0.30, 0, 0.24, DIM, 0.12, mid=3.20)

tx(s, M, 4.68, CW, 0.2, "WHAT TRAVELS BETWEEN THE SCOPES", 8.5, ACCENT, True, MONO, spacing_pts=200)
flow = [("Pilot", "seed, credits, 3 bots"), ("Parcel", "survey cells + 8 scores"),
        ("Structures", "grid, type, level"), ("Buildings", "archetype, 3 × 3 footprint"),
        ("Rooms", "kind, staff, coverage")]
for i, (a, b) in enumerate(flow):
    x = M + i * (CW / 5)
    rect(s, x, 5.02, CW / 5 - 0.2, 0.86, None, LINE, 0.7, radius=0.05,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    tx(s, x + 0.18, 5.14, CW / 5 - 0.5, 0.22, a, 10.5, INK, True, SANS)
    tx(s, x + 0.18, 5.4, CW / 5 - 0.5, 0.4, b, 8, MUTED, False, MONO, line=1.4)
    if i < 4:
        arrow(s, x + CW / 5 - 0.20, 0, 0.16, LINE, 0.11, mid=5.45)
tx(s, M, 6.06, CW, 0.5,
   "State is never duplicated across scopes: the Zustand store holds one snapshot, and a dropped stream degrades to a 25-second refetch "
   "rather than a stale screen. Selection and hover are intentionally excluded from persistence.",
   10, MUTED, False, SANS, line=1.45)
foot(s, 4)

# ================================================================ 05 WORLD FRAME
s = slide()
head(s, "THE WORLD FRAME", "Bytes → metres → tiles, exactly",
     "src/engine/geodesy.ts builds a flat metric frame on spherical Web Mercator, then wraps the XYZ tile convention over it.", 5)
metrics = [("6,378,137 m", "WGS-84 SEMI-MAJOR AXIS"), ("40,075,017 m", "WORLD CIRCUMFERENCE"),
           ("40,960,000 m²", "PARCEL AREA"), ("6,400 m", "PARCEL SIDE LENGTH"),
           ("100 m", "SURVEY CELL") , ("±85.0511°", "LATITUDE CLAMP")]
for i, (v, l) in enumerate(metrics):
    x = M + (i % 2) * 2.42
    y = 2.0 + (i // 2) * 1.0
    rect(s, x, y, 0.02, 0.5, ACCENT if i % 3 == 0 else LINE)
    tx(s, x + 0.18, y - 0.02, 2.2, 0.3, v, 15, INK, True, SANS)
    tx(s, x + 0.18, y + 0.3, 2.2, 0.2, l, 7, MUTED, False, MONO, spacing_pts=110)
tx(s, M, 4.96, 4.7, 1.5,
   "lonLatToWorld  x = R·λ   y = R·ln tan(π/4 + φ/2)\n"
   "worldToLonLat  exact inverse, asserted to 1e-9\n"
   "seedForLocation  hash(pilotSeed, lat, lon @ 1e-4)\n"
   "worldToTile  modular x-wrap, y-clamped at poles",
   8.8, ACCENT, False, MONO, line=1.9)
tx(s, M, 6.18, 4.7, 0.6,
   "Because the seed mixes the coordinate to four decimals, two pilots one kilometre apart inhabit different terrain — "
   "and the same pilot re-claiming the same spot always reproduces the same world.", 9.5, MUTED, False, SANS, line=1.4)

pic(s, "relief-hero.png", 5.22, 1.98, w=7.38)
tx(s, 5.22, 4.24, 7.38, 0.24, "PROCEDURAL RELIEF ACROSS 24 KM · PARCEL 56°N 126°E · SEED 4242",
   7, INK, False, MONO, spacing_pts=130)
tx(s, 5.22, 4.52, 7.38, 1.6,
   "The figure above was not drawn by hand: it is 31,040 direct calls to heightAtM() rendered as a hillshade. "
   "Terrain spans −300 m to 1,450 m in this window over 53% land cover, with coastline, lake bowls and "
   "river channels emerging from the same six-octave field.",
   9.5, MUTED, False, SANS, line=1.45)
foot(s, 5)

# ================================================================ 06 TERRAIN PIPELINE
s = slide()
head(s, "PROCEDURAL TERRAIN", "A six-stage field, no assets", 
     "src/engine/terrain.ts · ~275 lines · integer hash → value noise → fBm → domain warp → orogeny → derived fields", 6)
stages = [
    ("01", "DOMAIN WARP", "Two low-frequency fBm samples displace the lookup by ±925 m, then a 10° rotation breaks latitude alignment.", ACCENT),
    ("02", "CONTINENT + DETAIL", "Three fBm layers at 19 km / 6.2 km / 1.35 km build base relief: (continent − 0.49) × 1650 m.", GOOD),
    ("03", "OROGENY", "Smoothstepped mountain mask × ridged fBm^2.25 × 2350 m — sharp crests only where the mask allows.", DANGER),
    ("04", "RIVERS & LAKES", "Two ridged line features carve 135 m (up to +285 m in mountains); a bowl mask subtracts 95–175 m.", BLUE),
    ("05", "DERIVED FIELDS", "Temperature from latitude and altitude; drainage, soil, moisture, canopy and urban density from noise + slope.", LEAF),
    ("06", "BIOME TREE", "Ordered decision tree assigns 1 of 14 classes. Precedence encodes the physical logic.", VIOLET),
]
for i, (n, t, b, c) in enumerate(stages):
    x = M + (i % 3) * (CW / 3 + 0.04)
    y = 2.08 + (i // 3) * 1.72
    rect(s, x, y, CW / 3 - 0.22, 1.5, PANEL, LINE, 0.7, radius=0.05,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    tx(s, x + 0.22, y + 0.16, 0.5, 0.24, n, 11, c, True, MONO, spacing_pts=100)
    tx(s, x + 0.66, y + 0.17, CW / 3 - 0.95, 0.24, t, 9.5, INK, True, MONO, spacing_pts=120)
    tx(s, x + 0.22, y + 0.52, CW / 3 - 0.66, 0.9, b, 9.2, MUTED, False, SANS, line=1.4)

tx(s, M, 5.58, CW, 0.2, "THE 14 BIOMES · PRECEDENCE IS THE PHYSICS", 8.5, ACCENT, True, MONO,
   spacing_pts=200)
biomes = ["deep_sea", "sea", "lake", "alpine", "tundra", "coast", "wetland",
          "urban", "desert", "rainforest", "boreal_forest", "temperate_forest",
          "savanna", "grassland"]
bcolors = [RGBColor(0x19,0x4E,0x67), RGBColor(0x32,0x76,0x8B), RGBColor(0x4B,0x91,0xA4),
           RGBColor(0x9C,0xA0,0x9C), RGBColor(0x7E,0x8B,0x82), RGBColor(0x96,0x99,0x8D),
           RGBColor(0x52,0x7C,0x69), RGBColor(0x85,0x85,0x7E), RGBColor(0xA3,0x9B,0x7F),
           RGBColor(0x28,0x5C,0x42), RGBColor(0x35,0x5C,0x49), RGBColor(0x48,0x73,0x4F),
           RGBColor(0x7F,0x94,0x58), RGBColor(0x68,0x87,0x5C)]
for i, (b, c) in enumerate(zip(biomes, bcolors)):
    x = M + (i % 7) * (CW / 7)
    y = 5.9 + (i // 7) * 0.42
    rect(s, x, y + 0.03, 0.12, 0.12, c)
    tx(s, x + 0.2, y, CW / 7 - 0.3, 0.2, b.replace("_", " "), 7.4, MUTED, False, MONO,
       spacing_pts=80)
foot(s, 6)

# ================================================================ 07 PARCEL SURVEY
s = slide()
head(s, "PARCEL SURVEY", "A claim is a frozen 4,096-cell asset",
     "surveyParcel() runs once, at claim time, and is never recomputed — which is what makes a parcel a fixed asset rather than a re-rollable map.", 7)
pic(s, "parcel-biome-map.png", 8.42, 1.92, w=4.2)
tx(s, 8.42, 6.18, 4.2, 0.4, "64 × 64 BIOME SURVEY · SEED 4242 · FIVE CLASSES PRESENT",
   6.8, MUTED, False, MONO, spacing_pts=110)

rows(s, M, 2.02, 7.4,
     ["CELL KEY", "FIELD", "RANGE"], [1.3, 2.5, 3.6],
     [("h", "height in metres", "−300 … 2,000"),
      ("s", "slope (rise / run)", "0 … ~2"),
      ("b", "biome index", "0 … 13"),
      ("w", "water flag", "0 | 1"),
      ("d", "drainage", "0 … 1"),
      ("c", "canopy", "0 … 1"),
      ("u", "urban density", "0 … 1")],
     row_h=0.37, size=9.5)

tx(s, M, 4.98, 7.4, 0.2, "EIGHT AGGREGATE SCORES — THE ONLY TERRAIN INPUT TO THE ECONOMY",
   8, ACCENT, True, MONO, spacing_pts=150)
score_chips = [("ELEVATION", 0.04, DIM), ("SLOPE", 0.13, DIM), ("WATER", 0.32, BLUE),
               ("FOREST", 0.11, LEAF), ("FARM", 0.28, LEAF), ("BUILD", 0.52, ACCENT),
               ("DEFENCE", 0.13, DANGER), ("HYDRO", 0.33, BLUE)]
for i, (name, val, c) in enumerate(score_chips):
    x = M + (i % 4) * 1.86
    y = 5.3 + (i // 4) * 0.76
    tx(s, x, y, 1.5, 0.2, name, 7.2, MUTED, True, MONO, spacing_pts=120)
    tx(s, x + 1.06, y - 0.05, 0.6, 0.22, f"{val:.2f}", 9, INK, True, MONO, align=PP_ALIGN.RIGHT)
    rect(s, x, y + 0.24, 1.7, 0.05, LINE)
    rect(s, x, y + 0.24, max(0.04, 1.7 * val), 0.05, c)
foot(s, 7)

# ================================================================ 08 TERRAIN -> ECONOMY
s = slide()
head(s, "GEOGRAPHY BECOMES STRATEGY", "Measured output from the real engine",
     "Figures generated by executing surveyParcel() against seed 4242 — the same code the server runs at claim time.", 8)
pic(s, "parcel-scores.png", M, 1.92, w=CW)
tx(s, M, 4.62, CW / 3 - 0.32, 1.0,
   "01  Mixed parcels reward mixed portfolios.\nA build score of 0.52 with water 0.32 and farm 0.28 "
   "supports civic, production and utility builds without a dominant single answer.",
   9.6, MUTED, False, SANS, line=1.42)
tx(s, M + CW / 3, 4.62, CW / 3 - 0.32, 1.0,
   "02  Affinity, not penalty.\nEach structure declares one terrain affinity; that score maps to a "
   "0.65–1.35 multiplier. Bad land lowers output but never traps a player.",
   9.6, MUTED, False, SANS, line=1.42)
tx(s, M + 2 * CW / 3, 4.62, CW / 3 - 0.32, 1.0,
   "03  Location is a decision, not a skin.\nTwo pilots on the same budget should rationally build "
   "different things, because hydro, forest and elevation gate different yields.",
   9.6, MUTED, False, SANS, line=1.42)

rect(s, M, 5.72, CW, 0.92, PANEL, LINE, 0.7, radius=0.05, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
rect(s, M, 5.72, 0.035, 0.92, ACCENT)
tx(s, M + 0.26, 5.86, 3.0, 0.2, "WHY IT IS REPRODUCIBLE", 7.5, ACCENT, True, MONO, spacing_pts=160)
tx(s, M + 0.26, 6.1, CW - 0.7, 0.5,
   "heightAtM() reads no clock, no randomness and no I/O. The renderer, the claim endpoint and verify-terrain.ts "
   "each call the same function and get identical bytes — which is why a survey screenshot can be audited.",
   9.8, INK, False, SANS, line=1.4)
foot(s, 8)

# ================================================================ 09 CATALOGUE
s = slide()
head(s, "STRUCTURE CATALOGUE", "Eighteen instruments, deliberately unbalanced",
     "src/engine/catalogue.ts — a frozen as-const table. Every entry declares cost, economy, defence, prestige and one terrain affinity.", 9)
pic(s, "catalogue-economics.png", M, 1.9, w=CW)
tx(s, M, 4.78, CW / 4 - 0.34, 1.3,
   "HIGH MARGIN COSTS POWER\nFabrication Works earns +50/tick at 1,800 credits and −12 power. "
   "The richest structure is also the one that most needs an energy plan.", 9.2, MUTED, False, SANS, line=1.4)
tx(s, M + CW / 4, 4.78, CW / 4 - 0.34, 1.3,
   "DEFENCE EARNS NOTHING\nRampart, turret and barracks all sit below zero margin. "
   "Defence is a deliberate tax on income — there is no free turtle.", 9.2, MUTED, False, SANS, line=1.4)
tx(s, M + CW / 2, 4.78, CW / 4 - 0.34, 1.3,
   "TWO SITE TIERS\nNine structures are site-capable 3 × 3 buildings that spawn a 12 × 12 interior; "
   "the other nine are single-cell installations.", 9.2, MUTED, False, SANS, line=1.4)
tx(s, M + 3 * CW / 4, 4.78, CW / 4 - 0.34, 1.3,
   "TERRAIN GATES PLACEMENT\nWater cells accept only tidal generators; slope > 0.85 accepts only "
   "ramparts, turbines and mines.", 9.2, MUTED, False, SANS, line=1.4)
tx(s, M, 6.22, CW, 0.5,
   "Preview modal risk noted in the analysis: structure level exists in the schema and in three formulas, but no endpoint increments it — "
   "so half of the growth curve is currently unreachable.", 9, DANGER, False, SANS, line=1.4)
foot(s, 9)

# ================================================================ 10 ECONOMY
s = slide()
head(s, "ECONOMY & TIME", "Lazy ticks, honest scarcity",
     "There is no scheduler, no cron and no worker. Income is computed on read, so a stateless API behind a load balancer behaves identically to one instance.", 10)
rect(s, M, 2.0, 6.5, 2.5, PANEL, LINE, 0.7, radius=0.04, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
tx(s, M + 0.26, 2.14, 6.0, 0.2, "computeTotals()  ·  src/engine/simulation.ts", 7.5, ACCENT, True,
   MONO, spacing_pts=120)
tx(s, M + 0.26, 2.46, 6.0, 1.9,
   "terrainScale = 0.65 + affinity × 0.70      → 0.65 … 1.35\n"
   "levelScale   = 1 + (level − 1) × 0.35\n"
   "income      += def.income × terrainScale × levelScale\n"
   "upkeep      += def.upkeep × (1 + (level − 1) × 0.22)\n"
   "defence     += def.defence × (0.80 + scores.defence × 0.65)\n"
   "deficit      = (power<0 ? .28 : 0) + (food<0 ? .22 : 0)\n"
   "netIncome    = (income − upkeep) × (1 − min(.65, deficit))",
   9.2, INK, False, MONO, line=1.62)

tx(s, 7.6, 2.02, 5.0, 0.2, "APPLY-TICKS CONTRACT", 8, ACCENT, True, MONO, spacing_pts=180)
bullets(s, 7.6, 2.32, 5.0, [
    ("TICK_MS = 15 s. ", "Elapsed time is floored into whole ticks."),
    ("MAX_LAZY_TICKS = 64. ", "A week away yields 64 ticks, not 40,320 — an explicit anti-idle-farm rule."),
    ("lastTickAt advances by ticks consumed. ", "No simulated time is silently lost."),
    ("Credits floored at zero. ", "Debt cannot go negative."),
], size=9.6, gap=0.62, body_w=4.9)

tx(s, M, 4.76, CW, 0.2, "SCARCITY IS FELT TWICE", 8, ACCENT, True, MONO, spacing_pts=180)
paths = [("POWER DEFICIT", "net income capped at 72%", DANGER),
         ("FOOD DEFICIT", "net income capped at 78%", DANGER),
         ("BOTH", "floor of 35% — a claim can stall", RGBColor(0xC9, 0x55, 0x4B)),
         ("UPKEEP vs INCOME", "0.22 vs 0.35 per level — growth pays", GOOD)]
for i, (t, d, c) in enumerate(paths):
    x = M + i * (CW / 4)
    rect(s, x, 5.1, CW / 4 - 0.24, 0.92, None, LINE, 0.7, radius=0.05,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    rect(s, x, 5.1, CW / 4 - 0.24, 0.035, c)
    tx(s, x + 0.22, 5.26, CW / 4 - 0.6, 0.2, t, 8.5, c, True, MONO, spacing_pts=140)
    tx(s, x + 0.22, 5.56, CW / 4 - 0.6, 0.4, d, 9.5, INK, False, SANS, line=1.3)
tx(s, M, 6.24, CW, 0.5,
   "The asymmetry between upkeep (0.22) and income (0.35) per level is the single most consequential balance decision in the file: "
   "it makes vertical development a real strategy rather than a rounding error.",
   9.4, MUTED, False, SANS, line=1.4)
foot(s, 10)

# ================================================================ 11 INTERIORS
s = slide()
head(s, "BUILDING INTERIORS", "Every site is a staffed floor plan",
     "Nine room kinds on a 12 × 12 grid. Two are mandatory and free; seven are optional and cost credits. Overlap is an AABB test, server-side.", 11)
rows(s, M, 2.0, 7.0,
     ["ROOM", "FOOTPRINT", "STAFF", "COST"], [2.9, 1.3, 0.9, 1.0],
     [("Reception  ·  required", "4 × 4", 1, "0"),
      ("Guard Post  ·  required", "4 × 4", 1, "0"),
      ("Operations Office", "3 × 3", 3, "240"),
      ("Server Room", "3 × 3", 1, "420"),
      ("Workshop", "4 × 3", 2, "360"),
      ("Crew Quarters", "4 × 3", 0, "280"),
      ("Storage", "3 × 3", 0, "180"),
      ("Infirmary", "3 × 4", 2, "390"),
      ("Generator Room", "3 × 3", 1, "440")],
     row_h=0.335, size=9.5)
tx(s, M, 5.42, 7.0, 0.3, "= computeBuildingStats(rooms)", 8.5, ACCENT, True, MONO, spacing_pts=120)

tx(s, 8.0, 2.02, 4.6, 0.2, "COVERAGE MODEL", 8, ACCENT, True, MONO, spacing_pts=180)
rect(s, 8.0, 2.32, 4.6, 1.28, PANEL, LINE, 0.7, radius=0.04, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
tx(s, 8.2, 2.48, 4.3, 1.0,
   "coverage = min(100,\n  guards × 24 + receptionists × 20\n  + specialistRooms × 7)\nvalid = guards ≥ 1 && receptionists ≥ 1",
   9, GOOD, False, MONO, line=1.6)
bullets(s, 8.0, 3.78, 4.6, [
    ("Add-side block: ", "the API rejects a second reception or guard post through the optional-room endpoint."),
    ("Delete-side block: ", "the last of either kind cannot be removed, and required rooms cannot drop below 1 staff."),
    ("Salvage economics: ", "room removal refunds a flat 120 credits regardless of cost."),
], size=9.3, gap=0.68, body_w=4.55)
tx(s, 8.0, 6.05, 4.6, 0.6,
   "Building auto-seeding: commissioning any site-capable structure inserts the building row plus its Reception and Guard Post "
   "in the same transaction as the credit debit.", 9, MUTED, False, SANS, line=1.4)
foot(s, 11)

# ================================================================ 12 ASSAULTS
s = slide()
head(s, "CONFLICT", "Four phases, one seed, no dice",
     "resolveAssault() runs a 32-bit integer mixer four times per phase. Same seed and same inputs always produce the same battle report.", 12)
pic(s, "assault-phases.png", M, 1.9, w=CW)
ph = [("RECON", "0.18–0.30 ×str", "0.17–0.30 ×def", "−12% of unopposed"),
      ("BOMBARD", "0.30–0.48 ×str", "0.20–0.38 ×def + power×0.10", "−28% of leaked"),
      ("BREACH", "0.38–0.58 ×str", "0.34–0.54 ×def", "+8% line, −30% breach"),
      ("RESOLVE", "0.42–0.64 ×str", "0.45–0.70 ×def", "victory if def ≥ push")]
for i, (a, b, c, d) in enumerate(ph):
    x = M + i * (CW / 4)
    rect(s, x, 4.40, CW / 4 - 0.24, 1.06, None, LINE, 0.7, radius=0.05,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    tx(s, x + 0.2, 4.52, CW / 4 - 0.6, 0.2, a, 8.8, ACCENT, True, MONO, spacing_pts=160)
    tx(s, x + 0.2, 4.78, CW / 4 - 0.6, 0.55, f"ATK {b}\nDEF {c}", 7.6, MUTED, False, MONO, line=1.5)
    tx(s, x + 0.2, 5.24, CW / 4 - 0.6, 0.2, d, 7.6, INK, False, SANS, line=1.2)

rect(s, M, 5.66, CW / 2 - 0.15, 0.9, PANEL, LINE, 0.7, radius=0.04,
     shape=MSO_SHAPE.ROUNDED_RECTANGLE)
tx(s, M + 0.24, 5.78, 5.4, 0.7,
   "enemyStrength = 34 + rand×48 + prestige×0.62 + structures×1.8\n"
   "defence       = max(4, defence + max(0, power) × 0.12)",
   8.6, ACCENT, False, MONO, line=1.7)
tx(s, M + CW / 2 + 0.15, 5.72, CW / 2 - 0.15, 0.9,
   "Prestige cuts both ways: it strengthens the raider but pays a larger reward (450 + strength×11 + prestige×4). "
   "Power is spent twice — in the starting pool and in bombardment interception. Aggression is therefore priced, not punished.",
   9.2, MUTED, False, SANS, line=1.4)
foot(s, 12)

# ================================================================ 13 AI OFFICERS
s = slide()
head(s, "AI OFFICERS", "Persistent routing profiles — and nothing more",
     "Three fixed roles seeded at registration. A PATCH validates the provider/model pair against a 12-model catalogue before persisting.", 13)
officers = [("CTO", "Ada", "OpenAI · gpt-5-mini", "Audit build order, power resilience and technical debt. Propose the next infrastructure action.", ACCENT),
            ("CFO", "Rook", "Anthropic · claude-sonnet-4-6", "Protect the treasury. Compare net ticks, upkeep and payback time before any commission.", VIOLET),
            ("COO", "Mara", "Google · gemini-3-flash", "Keep food, staff and site logistics balanced. Flag reception or guard coverage gaps.", GOOD)]
for i, (role, name, model, directive, c) in enumerate(officers):
    x = M + i * (CW / 3)
    rect(s, x, 2.0, CW / 3 - 0.26, 2.0, PANEL, LINE, 0.75, radius=0.05,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    rect(s, x + 0.24, 2.2, 0.52, 0.52, None, c, 0.9, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    tx(s, x + 0.24, 2.34, 0.52, 0.24, role, 9, c, True, MONO, align=PP_ALIGN.CENTER,
       spacing_pts=60)
    tx(s, x + 0.88, 2.2, 2.6, 0.3, name, 20, INK, True, SANS)
    tx(s, x + 0.88, 2.56, 2.6, 0.2, model, 7.6, c, False, MONO, spacing_pts=40)
    tx(s, x + 0.24, 2.94, CW / 3 - 0.74, 0.9, directive, 9.2, MUTED, False, SANS, line=1.4)

tx(s, M, 4.24, CW, 0.2, "MODEL CATALOGUE · 6 PROVIDERS · 12 PROFILES · AUTONOMY 0–100 · DIRECTIVE ≤600 CHARS",
   8, ACCENT, True, MONO, spacing_pts=150)
models = ["GPT-5.2", "GPT-5 mini", "Claude Opus 4.6", "Claude Sonnet 4.6", "Gemini 3 Pro",
          "Gemini 3 Flash", "Mistral Large 3", "Codestral", "Grok 4", "Llama 4 Maverick",
          "Qwen3 235B", "DeepSeek V3.2"]
for i, mname in enumerate(models):
    x = M + (i % 6) * (CW / 6)
    y = 4.56 + (i // 6) * 0.46
    chip(s, x, y, CW / 6 - 0.16, 0.34, mname, MUTED, 7.6)

rect(s, M, 5.68, CW, 1.0, PANEL, LINE, 0.7, radius=0.04, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
rect(s, M, 5.68, 0.035, 1.0, DANGER)
tx(s, M + 0.28, 5.82, 4.0, 0.2, "HONEST SCOPE — STATED IN THE PRODUCT", 7.8, DANGER, True, MONO,
   spacing_pts=140)
tx(s, M + 0.28, 6.08, CW - 0.7, 0.55,
   "No provider API is contacted, no prompt is sent and no generated text is stored. The UI labels the page “Routing, not simulated inference”, "
   "and the operational-focus cards are deterministic readouts of the world snapshot. This is a clearly-bounded stub with an obvious extension point.",
   9.4, INK, False, SANS, line=1.4)
foot(s, 13)

# ================================================================ 14 ARCHITECTURE
s = slide()
head(s, "SYSTEM ARCHITECTURE", "Four layers, one direction of dependency",
     "The engine imports nothing from the database, the server or React — which is why it can be executed directly under tsx.", 14)

layers = [
    ("BROWSER · REACT 19 CLIENT", 1.92, 0.86,
     "WorldApp · AreaApp · BuildingApp · AiManagementApp   |   WorldRenderer (three.js) · PlanRenderer · ParcelMiniMap · AreaLayout · BuildingLayout   |   Zustand store · useWorldConnection",
     ACCENT),
    ("NEXT.JS 16 APP ROUTER · NODE RUNTIME", 2.98, 0.86,
     "12 API routes   →   server/world.ts (snapshot assembly, ticks, events)   →   lib/api.ts (validation + error shaping)   |   /api/tiles → OSM + cache + generated PNG",
     BLUE),
    ("ENGINE · PURE + DETERMINISTIC · NO I/O", 4.04, 0.86,
     "terrain.ts · geodesy.ts · catalogue.ts · rooms.ts · simulation.ts · ai.ts   —   functions over numbers, reusable by renderer, API and verification",
     GOOD),
    ("POSTGRESQL · DRIZZLE ORM", 5.1, 0.86,
     "9 tables: pilots · parcels · structures · buildings · rooms · bots · tile_cache · events · assaults   (pooled pg client, dev-globalised singleton)",
     VIOLET),
]
for i, (t, y, h, d, c) in enumerate(layers):
    rect(s, M, y, CW, h, PANEL, LINE, 0.75, radius=0.04, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    rect(s, M, y, 0.035, h, c)
    tx(s, M + 0.28, y + 0.13, 5.6, 0.2, t, 8, c, True, MONO, spacing_pts=150)
    tx(s, M + 0.28, y + 0.4, CW - 0.7, 0.4, d, 8.8, MUTED, False, SANS, line=1.35)
    if i < 3:
        arrow(s, W / 2 - 0.20, 0, 0.40, DIM, 0.10, mid=y + h + 0.09)

tx(s, M, 6.12, CW, 0.2, "THE LAYERING RULE", 8, ACCENT, True, MONO, spacing_pts=180)
tx(s, M, 6.38, CW, 0.5,
   "engine → server → app/api → client, with lib/types.ts defining the single WorldSnapshot contract shared by both sides. "
   "Drizzle’s jsonb columns are typed against engine types ($type<AssaultReport>()), so an engine refactor fails tsc, not production.",
   9.4, INK, False, SANS, line=1.42)
foot(s, 14)

# ================================================================ 15 DATA MODEL
s = slide()
head(s, "DATA MODEL", "Nine tables, cascading ownership",
     "src/db/schema.ts · 127 lines. Every child row cascades from its parent, so deleting a pilot is atomic and leaves nothing orphaned.", 15)
tables = [("pilots", "call_sign UNIQUE · credits 15,000 default", ACCENT),
          ("parcels", "pilot_id UNIQUE · scores + cells jsonb · lock index", GOOD),
          ("structures", "UNIQUE(parcel_id, gx, gy)", BLUE),
          ("buildings", "archetype · 3 × 3 · structure_id FK", BLUE),
          ("rooms", "kind · footprint · staff", LEAF),
          ("bots", "UNIQUE(pilot_id, role) — exactly 3", VIOLET),
          ("assaults", "full four-phase report jsonb", DANGER),
          ("events", "bigserial · (pilot_id, id) index", MUTED),
          ("tile_cache", "PK(z, x, y) · 24 h freshness", MUTED)]
for i, (t, d, c) in enumerate(tables):
    x = M + (i % 3) * (CW / 3)
    y = 1.96 + (i // 3) * 0.86
    rect(s, x, y, CW / 3 - 0.24, 0.76, PANEL, LINE, 0.7, radius=0.06,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    rect(s, x, y, 0.05, 0.76, c)
    tx(s, x + 0.22, y + 0.13, CW / 3 - 0.5, 0.22, t, 11, INK, True, MONO, spacing_pts=40)
    tx(s, x + 0.22, y + 0.4, CW / 3 - 0.5, 0.3, d, 8, MUTED, False, SANS, line=1.25)

tx(s, M, 4.62, CW, 0.2, "RELATIONSHIPS", 8, ACCENT, True, MONO, spacing_pts=180)
rel = "pilots 1─1 parcels       parcels 1─* structures       parcels 1─* buildings 1─* rooms\n" \
      "parcels 1─* assaults       pilots 1─* bots       pilots 1─* events"
tx(s, M, 4.9, CW, 0.6, rel, 9.4, INK, False, MONO, line=1.7)
bullets(s, M, 5.52, CW, [
    ("One-claim-per-pilot is enforced twice: ", "a UNIQUE index on parcels.pilot_id plus an API pre-check — defence in depth."),
    ("JSONB is the right trade here: ", "a 4,096-cell payload is written once and only ever read whole."),
    ("The typed-JSONB pattern is the standout: ", "schema columns reference engine types, so shape drift breaks the build."),
], size=9.4, gap=0.4, body_w=CW - 0.3)
foot(s, 15)

# ================================================================ 16 API
s = slide()
head(s, "API SURFACE", "Twelve routes, all server-authoritative",
     "Every mutation joins through parcels.pilot_id to prove ownership, then re-validates terrain, footprint, staffing or credits.", 16)
rows(s, M, 1.95, CW,
     ["METHOD", "PATH", "VALIDATION BEFORE WRITE"],
     [1.0, 4.5, 6.4],
     [("POST", "/api/pilots", "call sign sanitised, ≥2 chars, lat/lon inside ±85 / ±180"),
      ("POST", "/api/pilots/:id/claim", "one parcel per pilot; 4,096-cell survey; 72 h lock"),
      ("POST", "/api/pilots/:id/structures", "terrain gate, footprint, occupancy, credits — in a transaction"),
      ("DELETE", "/api/structures/:id", "ownership join; refund floor(cost × 0.4 × level)"),
      ("POST", "/api/buildings/:id/rooms", "optional room only; fits 12 × 12; no AABB overlap; credits"),
      ("PATCH", "/api/rooms/:id", "staff clamped 0–20; required rooms cannot fall below 1"),
      ("DELETE", "/api/rooms/:id", "refuses to remove the last guard or receptionist"),
      ("PATCH", "/api/pilots/:id/bots/:botId", "isAiModel(provider, model); autonomy 0–100; directive ≤600"),
      ("POST", "/api/parcels/:id/assault", "lock must be expired; transaction: report, credits, re-lock"),
      ("GET", "/api/tiles/:z/:x/:y.png", "z ≤ 19; 4-level fallback with provenance headers"),
      ("GET", "/api/stream", "SSE: ready · world · heartbeat · degraded"),
      ("GET", "/api/health", "select 1 → ok, else 500")],
     row_h=0.352, size=8.7)

tx(s, M, 6.52, CW, 0.34,
   "Error shaping is centralised in apiError(): message + 400, promoted to 404 for missing records. Tiles advertise "
   "x-simplayz-source / -cache / -provenance / -age / -tile on every response.",
   8.6, MUTED, False, SANS, line=1.35)
foot(s, 16)

# ================================================================ 17 RENDERING
s = slide()
head(s, "RENDERING & RESILIENCE", "Three modes, nine tiles, four fallbacks",
     "One three.js scene with signature-gated rebuilds; two geometry copies per tile so mode switching is opacity, not re-meshing.", 17)
modes = [("FLAT", "Displaced terrain, no raster. Reads relief honestly.", ACCENT),
         ("STACK", "Relief + raster draped at 55% opacity. Default mode.", GOOD),
         ("RASTER", "Raster-forward; the solid mesh fades to zero opacity.", BLUE)]
for i, (m, d, c) in enumerate(modes):
    x = M + i * (CW / 3)
    rect(s, x, 1.96, CW / 3 - 0.24, 0.94, PANEL, LINE, 0.7, radius=0.05,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    tx(s, x + 0.22, 2.08, 2.0, 0.22, m, 10, c, True, MONO, spacing_pts=160)
    tx(s, x + 0.22, 2.36, CW / 3 - 0.66, 0.45, d, 9, MUTED, False, SANS, line=1.3)

tx(s, M, 3.1, CW, 0.2, "TILE PIPELINE — EVERY FAILURE HAS A FLOOR", 8, ACCENT, True, MONO,
   spacing_pts=180)
stages = [("CACHE HIT", "< 24 h", GOOD), ("UPSTREAM", "OSM · 7 s timeout", BLUE),
          ("STALE", "stale-if-error 7d", ACCENT), ("GENERATED", "hand-written PNG", DANGER)]
for i, (t, d, c) in enumerate(stages):
    x = M + i * 2.92
    rect(s, x, 3.4, 2.52, 0.76, None, LINE, 0.7, radius=0.05,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    rect(s, x, 3.4, 2.52, 0.035, c)
    tx(s, x + 0.2, 3.54, 2.2, 0.2, t, 8.6, c, True, MONO, spacing_pts=150)
    tx(s, x + 0.2, 3.8, 2.2, 0.24, d, 8.6, MUTED, False, SANS)
    if i < 3:
        arrow(s, x + 2.56, 0, 0.28, LINE, 0.12, mid=3.78)

tx(s, M, 4.36, 6.1, 0.2, "THEMING", 8, ACCENT, True, MONO, spacing_pts=180)
themes = ["CARTOGRAPHER", "VIOLET", "LILAC", "CUSTOM", "CHAOS"]
for i, t in enumerate(themes):
    chip(s, M + i * 1.24, 4.64, 1.16, 0.32, t, MUTED, 7)

tx(s, M, 5.12, 6.1, 0.2, "CLIENT STATE", 8, ACCENT, True, MONO, spacing_pts=180)
tx(s, M, 5.38, 6.1, 1.3,
   "Zustand persists only pilotId, location, mode, theme and hue — never the snapshot. A custom merge() forces "
   "snapshot, notices, selection and hover to reset on rehydration, killing the classic stale-selection bug. "
   "SSE is a hint, not a source of truth: an event triggers a refetch; the server stays canonical.",
   9.3, MUTED, False, SANS, line=1.4)

pic(s, "parcel-square.png", 8.9, 4.36, w=1.95)
tx(s, 10.9, 4.42, 1.9, 0.2, "PROVENANCE", 7.6, ACCENT, True, MONO, spacing_pts=160)
tx(s, 10.9, 4.66, 1.9, 2.0,
   "Every raster response self-describes its source and age.\n\nA cache write failure is caught so a fresh tile still renders.\n\n"
   "GPU resources are disposed on route change: geometry, materials and textures.",
   8.6, MUTED, False, SANS, line=1.4)
foot(s, 17)

# ================================================================ 18 ASSESSMENT
s = slide()
head(s, "ASSESSMENT", "Strong core, ordinary growing pains",
     "What holds up under inspection — and the specific gaps that a v2 needs to close.", 18)
tx(s, M, 1.94, 6.0, 0.2, "STRENGTHS", 8.5, GOOD, True, MONO, spacing_pts=220)
strengths = [
    ("A genuinely pure domain core. ", "Deterministic, I/O-free, runnable under tsx. This is why it reads as a simulator."),
    ("Geography drives strategy. ", "Affinity multipliers plus terrain-gated placement make location an economic decision."),
    ("Server authority done properly. ", "Ownership joins, transaction boundaries, four-layer validation on every write."),
    ("Production instincts. ", "Tile cache → stale → generated, SSE → polling, health endpoint, provenance headers."),
    ("A disciplined UI system. ", "266 lines of tokenised CSS covers five themes and an entire HUD language."),
    ("Honest scope. ", "The AI stub is labelled in the product, not just in the README."),
]
bullets(s, M, 2.24, 6.0, strengths, size=9.4, gap=0.7, body_w=5.9, bullet_color=GOOD)

tx(s, 6.9, 1.94, 5.7, 0.2, "RISKS & ROUGH EDGES", 8.5, DANGER, True, MONO, spacing_pts=220)
risks = [
    ("No authentication. ", "pilotId arrives in the URL. Fine for a demo, blocking for production."),
    ("Credits race. ", "Read-modify-write without a row lock; parallel requests can double-spend."),
    ("Level is dormant. ", "The column and all three formulas exist, but nothing increments it."),
    ("No handler tests. ", "Only the pure engine is asserted; the HTTP layer rests on tsc alone."),
    ("Unbounded growth. ", "events and assault reports accumulate; the stream polls every 2 s per client."),
    ("Duplicated palette. ", "14 biome colours are copy-pasted between two renderer files."),
]
bullets(s, 6.9, 2.24, 5.7, risks, size=9.4, gap=0.7, body_w=5.6, bullet_color=DANGER)

rect(s, M, 6.28, CW, 0.5, PANEL, LINE, 0.7, radius=0.04, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
tx(s, M + 0.26, 6.4, CW - 0.6, 0.3,
   "Verdict: the hard part — a deterministic, physically plausible, strategically meaningful world — is done. "
   "What remains is product hardening, not architecture repair.",
   9.6, ACCENT, False, SANS, line=1.3)
foot(s, 18)

# ================================================================ 19 ROADMAP / CLOSE
s = slide()
head(s, "ROADMAP", "From impressive prototype to durable product", None, 19)
cols = [("NEAR TERM · HARDEN", ACCENT,
         ["Row locking on credit mutations",
          "Structure upgrade endpoint + UI (activates level)",
          "Session identity replacing URL pilotId",
          "Shared BIOME_COLORS export",
          "Route-level tests for ownership + rollback"]),
        ("MEDIUM TERM · DEPTH", GOOD,
         ["Live AI inference behind existing routing profiles",
          "Multi-parcel territories and adjacency bonuses",
          "Async PvP: raid another pilot’s real parcel",
          "Pilot progression and specialisation trees"]),
        ("LONG TERM · SCALE", VIOLET,
         ["Survey computation in Web Workers",
          "Instanced rendering for many structures",
          "Partitioned events + LISTEN/NOTIFY stream hub",
          "Shareable parcel permalinks, world territory map"])]
for i, (t, c, items) in enumerate(cols):
    x = M + i * (CW / 3)
    rect(s, x, 1.98, CW / 3 - 0.26, 3.3, PANEL, LINE, 0.75, radius=0.05,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    tx(s, x + 0.26, 2.14, CW / 3 - 0.8, 0.22, t, 8.4, c, True, MONO, spacing_pts=160)
    rect(s, x + 0.26, 2.46, 0.5, 0.025, c)
    for j, it in enumerate(items):
        yy = 2.66 + j * 0.5
        rect(s, x + 0.28, yy + 0.07, 0.06, 0.06, c)
        tx(s, x + 0.46, yy, CW / 3 - 1.0, 0.46, it, 9, MUTED, False, SANS, line=1.32)

tx(s, M, 5.6, CW, 0.2, "RUN IT IN THREE COMMANDS", 8, ACCENT, True, MONO, spacing_pts=200)
rect(s, M, 5.9, 6.1, 0.9, BG_DEEP, LINE, 0.7, radius=0.04, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
tx(s, M + 0.24, 6.02, 5.6, 0.7,
   "npm install\nnpx drizzle-kit push && npm run dev", 9, ACCENT, False, MONO, line=1.7)
tx(s, 7.1, 5.9, 5.6, 0.9,
   "Requires Node 22+ and PostgreSQL 14+, with DATABASE_URL set. The engine self-check runs standalone: "
   "npx tsx src/engine/verify-terrain.ts — projection round-trip, determinism and survey repeatability.",
   8.8, MUTED, False, SANS, line=1.4)

tx(s, M, 6.98, 8.0, 0.3, "SIMPLAYZ  ·  SURVEY A REAL COORDINATE, AND MAKE IT WORTH DEFENDING",
   8.4, INK, True, MONO, spacing_pts=180)
tx(s, W - M - 3.4, 6.98, 3.4, 0.3, "© OpenStreetMap contributors", 7.5, DIM, False, MONO,
   align=PP_ALIGN.RIGHT)


NOTES = {
1: "Simplayz is a persistent world simulator built on Next.js 16 and PostgreSQL. Every number in this deck was read out of the repository or produced by executing its own engine functions. Repo: github.com/simplayz/simplay-ukkyz-v2.",
2: "The core claim: this is not a mock-up. Terrain is generated by a pure function, the server owns every mutation, and the AI feature is honestly labelled as a routing editor rather than pretending to be an inference system.",
3: "Six product systems hang off one DTO. WorldSnapshot is the only shape of truth: the API, the Zustand store, the 3D renderer and the 2D plans all consume it. 48 source files, 3,852 lines, 11 runtime dependencies.",
4: "Four nested scopes with real routes. The important architectural point is that a dropped SSE stream degrades to 25-second polling rather than showing stale data, and that selection/hover state is deliberately not persisted.",
5: "geodesy.ts converts lon/lat into a flat metric Web Mercator frame, then wraps the XYZ tile convention. The relief image is 31,040 direct calls to heightAtM rendered as a hillshade — not a stock image.",
6: "The terrain field is six stages: domain warp, three fBm layers, ridged-fBm orogeny, river carving, lake bowls, then derived fields and a biome decision tree. There is no noise library and no heightmap asset.",
7: "A claim freezes 4,096 cells plus eight aggregate scores. Because the survey is written once and never recomputed, a parcel is a fixed asset rather than a re-rollable map — which is why JSONB is the right storage choice.",
8: "These charts come from running surveyParcel() at seed 4242: build 0.52, hydro 0.33, water 0.32, farm 0.28. Affinity multiplies output by 0.65 to 1.35, so geography changes what is worth building.",
9: "Eighteen structures, deliberately unbalanced: the highest-margin building is also the most power-hungry, and defence always earns nothing. Note the risk flagged in red — structure level exists but nothing increments it yet.",
10: "There is no scheduler. applyTicks() runs on read, caps catch-up at 64 ticks, and advances lastTickAt by exactly the ticks consumed. Upkeep scales at 0.22 per level against income at 0.35, which is what makes vertical growth worthwhile.",
11: "Interiors are enforced from both sides: the API refuses to add a second reception or guard, and refuses to delete the last one. Salvage is a flat 120 credits regardless of room cost.",
12: "Assaults are deterministic: a 32-bit integer mixer, four escalation phases, five named factions. Prestige makes you a bigger target but pays a bigger reward, so aggression is priced rather than punished.",
13: "Be explicit here: this is a routing-profile editor. No provider API is contacted and no prompt is sent, and the product UI says so. The natural next step is real server-side inference behind these same profiles.",
14: "One direction of dependency: engine to server to API to client. The engine imports nothing from Drizzle, Next or React, which is why it runs standalone under tsx. Drizzle columns are typed against engine types.",
15: "Nine tables, all cascading. One claim per pilot is enforced by a unique index and an API pre-check. The typed-JSONB pattern is the standout detail: schema columns reference engine types, so shape drift breaks the build.",
16: "Twelve routes. Every mutation joins through parcels.pilot_id, so ownership is a join condition rather than a client claim. Tiles are the only route with a four-level fallback chain.",
17: "Rendering: nine z15 tiles, each with two geometry copies so switching FLAT, STACK and RASTER is opacity rather than re-meshing. Tiles degrade cache to upstream to stale to a generated PNG.",
18: "The honest assessment. The hard part is done — a deterministic, plausible, strategically meaningful world. The gaps are product hardening: auth, row locking on credits, level progression, handler tests, retention.",
19: "Roadmap in three horizons, and the three commands needed to run it. Requires Node 22+ and PostgreSQL 14+ with DATABASE_URL set; the engine self-check runs without a database.",
}
for i, sl in enumerate(prs.slides, 1):
    if i in NOTES:
        tf = sl.notes_slide.notes_text_frame
        tf.text = NOTES[i]
        for para in tf.paragraphs:
            for r in para.runs:
                r.font.size = Pt(12)

prs.save(OUT)
print("saved", OUT, os.path.getsize(OUT) // 1024, "KB,", len(prs.slides._sldIdLst), "slides")
