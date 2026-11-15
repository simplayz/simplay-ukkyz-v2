#!/usr/bin/env python3
"""
Renders docs/assets/*.png from the JSON that docs/figures/extract.ts produces.

    npx tsx docs/figures/extract.ts          # engine → data/*.json
    python3 docs/figures/render.py           # data/*.json → assets/*.png

Requires: numpy, matplotlib.  Palette matches src/app/globals.css (Cartographer theme).
"""
import json
import os
import re
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.colors import LightSource, LinearSegmentedColormap  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "docs", "figures", "data")
ASSETS = os.path.join(ROOT, "docs", "assets")

BG = "#101d24"
BG_DEEP = "#0b1418"
INK = "#e8eee7"
MUTED = "#8d9d93"
ACCENT = "#e6c879"
LINE = "#2c423c"
DANGER = "#ef806d"
GOOD = "#7ccaa4"

# mirrors src/renderer/PlanRenderer.ts biomeColors
BIOME_COLORS = {
    "deep_sea": "#194e67", "sea": "#32768b", "lake": "#4b91a4", "coast": "#96998d",
    "wetland": "#527c69", "urban": "#85857e", "desert": "#a39b7f", "alpine": "#9ca09c",
    "tundra": "#7e8b82", "boreal_forest": "#355c49", "rainforest": "#285c42",
    "temperate_forest": "#48734f", "savanna": "#7f9458", "grassland": "#68875c",
}
SEA = LinearSegmentedColormap.from_list("sea", ["#0d2b3c", "#174b68", "#2f7183", "#4d9eb5"])
LAND = LinearSegmentedColormap.from_list(
    "land", ["#2c5140", "#365c47", "#4d7350", "#68875c", "#86a66c", "#a8b190", "#d8dcc9", "#f2f4ec"]
)


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as handle:
        return json.load(handle)


def relief(grid, figsize, dpi, path):
    h, w, span = grid["height"], grid["width"], grid["span"]
    heights = np.array(grid["heights"], float).reshape(h, w)
    sea = heights < 0
    rgb = np.zeros((h, w, 3))
    rgb[sea] = SEA(np.clip((heights[sea] + 300) / 450, 0, 1))[:, :3]
    land = ~sea
    rgb[land] = LAND(np.clip(heights[land] / 1750, 0, 1))[:, :3]
    shade = LightSource(azdeg=315, altdeg=42).hillshade(
        np.where(sea, -5, heights), vert_exag=0.9, dx=span / w, dy=span / w
    )
    for channel in range(3):
        plane = rgb[:, :, channel]
        plane[land] = np.clip(plane[land] * (0.42 + 0.86 * shade[land]), 0, 1)

    fig = plt.figure(figsize=figsize, dpi=dpi)
    fig.patch.set_facecolor(BG_DEEP)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_facecolor(BG_DEEP)
    ax.imshow(np.clip(rgb, 0, 1), extent=[0, 1, 0, 1], aspect="auto", interpolation="bilinear")
    x_axis, y_axis = np.linspace(0, 1, w), np.linspace(0, 1, h)
    ax.contour(x_axis, y_axis, heights, levels=[0], colors=[ACCENT], linewidths=0.7, alpha=0.5)
    ax.contour(x_axis, y_axis, heights, levels=[250, 500, 900, 1400], colors=[INK], linewidths=0.3, alpha=0.12)
    for k in range(1, 12):
        ax.axvline(k / 12, color=INK, lw=0.4, alpha=0.06)
    for k in range(1, 8):
        ax.axhline(k / 8, color=INK, lw=0.4, alpha=0.06)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    fig.savefig(path, facecolor=BG_DEEP)
    plt.close()
    print("wrote", path)


def biome_map(cells, biomes, path):
    n = 64
    index = np.array([c["b"] for c in cells]).reshape(n, n)
    height = np.array([c["h"] for c in cells]).reshape(n, n)
    rgb = np.zeros((n, n, 3))
    for i, name in enumerate(biomes):
        rgb[index == i] = matplotlib.colors.to_rgb(BIOME_COLORS[name])
    gy, gx = np.gradient(height)
    score = np.clip(0.86 + 0.26 * (-gx * 0.5 - gy * 0.5) / (np.abs(np.gradient(height)).max() + 1e-9), 0.6, 1.15)

    fig, ax = plt.subplots(figsize=(4, 4), dpi=220)
    ax.imshow(np.clip(rgb * score[..., None], 0, 1), interpolation="nearest")
    for k in range(0, 65, 8):
        ax.axvline(k - 0.5, color=INK, lw=0.4, alpha=0.16)
        ax.axhline(k - 0.5, color=INK, lw=0.4, alpha=0.16)
    ax.set_xticks([])
    ax.set_yticks([])
    fig.patch.set_facecolor(BG)
    for spine in ax.spines.values():
        spine.set_color(ACCENT)
        spine.set_linewidth(0.9)
    fig.tight_layout(pad=0.1)
    fig.savefig(path, facecolor=BG)
    plt.close()
    print("wrote", path)


def scores_and_biomes(survey, biomes, path):
    sc = survey["scores"]
    keys = ["elevation", "slope", "water", "forest", "farm", "build", "defence", "hydro"]
    values = [sc[k] for k in keys]
    index = np.array([c["b"] for c in survey["cells"]]).reshape(64, 64)
    counts = np.bincount(index.ravel(), minlength=len(biomes)) / 4096.0

    fig, axes = plt.subplots(1, 2, figsize=(12.0, 2.7), dpi=200, gridspec_kw={"width_ratios": [1.08, 1]})
    fig.patch.set_facecolor(BG)
    ax = axes[0]
    ax.set_facecolor(BG)
    y = np.arange(len(keys))[::-1]
    ax.barh(y, [1] * len(keys), height=0.66, color=LINE, alpha=0.6, zorder=0)
    ax.barh(y, values, height=0.66, color=ACCENT, alpha=0.95, zorder=2)
    for yy, value in zip(y, values):
        ax.text(value + 0.025, yy, f"{value * 100:.0f}", va="center", color=INK, fontsize=7.4, family="monospace")
    ax.set_yticks(y)
    ax.set_yticklabels([k.upper() for k in keys], color=MUTED, fontsize=7)
    ax.set_xlim(0, 1.14)
    ax.set_xticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.set_title("TERRAIN SCORES · 0–1 NORMALISED", color=INK, fontsize=8, loc="left", family="monospace", pad=8)

    ax = axes[1]
    ax.set_facecolor(BG)
    order = [i for i in np.argsort(counts)[::-1] if counts[i] > 0.0005]
    yy = np.arange(len(order))[::-1]
    ax.barh(yy, [counts[i] for i in order], height=0.64, color=[BIOME_COLORS[biomes[i]] for i in order])
    for pos, i in zip(yy, order):
        ax.text(counts[i] + 0.01, pos, f"{counts[i] * 100:.1f}%", va="center", color=INK, fontsize=6.8, family="monospace")
    ax.set_yticks(yy)
    ax.set_yticklabels([biomes[i].replace("_", " ").upper() for i in order], color=MUTED, fontsize=6.4)
    ax.set_xlim(0, max(counts) * 1.3)
    ax.set_xticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.set_title(f"BIOME COVERAGE · {len(order)} OF 14 CLASSES", color=INK, fontsize=8, loc="left", family="monospace", pad=8)
    fig.tight_layout(pad=1.0)
    fig.savefig(path, facecolor=BG)
    plt.close()
    print("wrote", path)


def catalogue(path):
    source = open(os.path.join(ROOT, "src", "engine", "catalogue.ts"), encoding="utf-8").read()
    rows = re.findall(
        r'\{ type: "([a-z_]+)".*?category: "([a-z]+)".*?cost: (\d+), income: (\d+), upkeep: (\d+).*?defence: (\d+)',
        source,
    )
    items = [(t, c, int(cost), int(income), int(upkeep), int(de)) for t, c, cost, income, upkeep, de in rows]
    colors = {"civic": ACCENT, "production": "#9fcf69", "utility": "#62b9e9", "defence": DANGER, "culture": "#c6b8e8"}

    fig, ax = plt.subplots(figsize=(12.4, 2.60), dpi=200)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    for category in colors:
        points = [p for p in items if p[1] == category]
        ax.scatter(
            [p[2] for p in points], [p[3] - p[4] for p in points],
            s=[55 + p[5] * 2.4 for p in points], color=colors[category], alpha=0.92,
            edgecolor=BG, linewidth=1.1, label=category.upper(), zorder=3,
        )
    offsets = {"turret": (6, -11, "left"), "wind_turbine": (-8, 4, "right"),
               "clinic": (6, -12, "left"), "monument": (8, 4, "left")}
    for name, _cat, cost, income, upkeep, _def in items:
        dx, dy, ha = offsets.get(name, (6, 6, "left"))
        ax.annotate(name.replace("_", " "), (cost, income - upkeep), textcoords="offset points",
                    xytext=(dx, dy), ha=ha, fontsize=6.0, color=MUTED)
    ax.axhline(0, color=LINE, lw=0.8)
    ax.set_xlabel("BUILD COST (CREDITS)", color=MUTED, fontsize=6.6, labelpad=2)
    ax.set_ylabel("MARGIN / TICK", color=MUTED, fontsize=6.6, labelpad=4)
    ax.tick_params(colors=MUTED, labelsize=6.4, length=2)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.grid(color=LINE, lw=0.45, alpha=0.5)
    ax.set_axisbelow(True)
    ax.set_ylim(-18, 62)
    ax.set_xlim(330, 2600)
    ax.legend(frameon=False, labelcolor=MUTED, fontsize=6.6, ncol=5, loc="upper left",
              bbox_to_anchor=(0, 1.13), columnspacing=1.2, handletextpad=0.4)
    fig.tight_layout(pad=0.5)
    fig.savefig(path, facecolor=BG)
    plt.close()
    print("wrote", path)


def assault(reports, path):
    fig, ax = plt.subplots(figsize=(12.4, 2.48), dpi=200)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    x = np.arange(4)
    for i, report in enumerate(reports):
        attacker = [p["attacker"] for p in report["phases"]]
        defender = [p["defender"] for p in report["phases"]]
        ax.bar(x + (i * 2 - 0.5) * 0.34, defender, 0.34, color=GOOD, alpha=0.95 if i == 0 else 0.42)
        ax.bar(x + (i * 2 + 0.5) * 0.34, attacker, 0.34, color=DANGER, alpha=0.95 if i == 0 else 0.42)
    ax.set_ylim(0, 163)
    ax.set_xticks(x)
    ax.set_xticklabels([p["phase"].upper() for p in reports[0]["phases"]], color=MUTED, fontsize=7.4)
    ax.tick_params(axis="y", colors=MUTED, labelsize=6.4, length=2)
    ax.set_ylabel("COMBAT PRESSURE", color=MUTED, fontsize=6.4, labelpad=4)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.grid(axis="y", color=LINE, lw=0.45, alpha=0.5)
    ax.set_axisbelow(True)
    ax.set_title(
        f"SEED {reports[0]['seed']} · {reports[0]['enemy'].upper()} · STRENGTH "
        f"{reports[0]['enemyStrength']} vs {reports[1]['enemyStrength']} · BOTH ENGAGEMENTS HELD",
        color=INK, fontsize=7.4, loc="left", family="monospace", pad=6,
    )
    ax.legend(
        handles=[
            Patch(color=GOOD, label="Defender · outpost"),
            Patch(color=DANGER, label="Attacker · outpost"),
            Patch(color=GOOD, alpha=0.42, label="Defender · fortified"),
            Patch(color=DANGER, alpha=0.42, label="Attacker · fortified"),
        ],
        frameon=True, facecolor=BG, edgecolor="#2c423c", framealpha=1, labelcolor=MUTED,
        fontsize=6.5, loc="upper left", ncol=4, columnspacing=1.0, handletextpad=0.4,
        handlelength=1.0, borderpad=0.5,
    )
    fig.tight_layout(pad=0.5)
    fig.savefig(path, facecolor=BG)
    plt.close()
    print("wrote", path)


def main():
    if not os.path.isdir(DATA):
        sys.exit("run `npx tsx docs/figures/extract.ts` first")
    terrain = load("terrain.json")
    reports = load("assault.json")

    relief(terrain["relief"]["title"], (13.333, 7.5), 168, os.path.join(ASSETS, "hero-title.png"))
    relief(terrain["relief"]["frame"], (13.2, 4.0), 176, os.path.join(ASSETS, "relief-hero.png"))
    biome_map(terrain["cells"], terrain["biomes"], os.path.join(ASSETS, "parcel-square.png"))
    biome_map(terrain["cells"], terrain["biomes"], os.path.join(ASSETS, "parcel-biome-map.png"))
    scores_and_biomes(terrain, terrain["biomes"], os.path.join(ASSETS, "parcel-scores.png"))
    catalogue(os.path.join(ASSETS, "catalogue-economics.png"))
    assault(reports, os.path.join(ASSETS, "assault-phases.png"))


if __name__ == "__main__":
    main()
