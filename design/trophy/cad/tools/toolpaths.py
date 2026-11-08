# What the printer actually lays down: the top 5 layers of a sliced Bambu G-code (export it from Bambu Studio,
# or slice the -bambu.3mf with the CLI: BambuStudio --slice 0 --outputdir DIR file.3mf), drawn with true line
# widths and arcs, every ring slot turned to the top. Several G-codes give one row each, for comparison.
# Tool colours assume the -bambu.3mf slots: T0 ring (brown), T1 navy, T2 cream, T3 cap.
#
# usage: .venv/bin/python tools/toolpaths.py out.png "title=plate_1.gcode" ["title=other.gcode" …]
import sys, math
from gcode_parse import parse
from shapely.geometry import LineString
from shapely.ops import unary_union
from shapely import affinity
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt, matplotlib.patches as mp, matplotlib.path as mpath
C = {1000: '#7B4A2A', 0: '#7B4A2A', 1: '#1D3050', 2: '#EFE7D2', 3: '#FF6B35'}
def fl(ax, g, c):
    for p in getattr(g, 'geoms', [g]):
        if p.is_empty or p.geom_type != 'Polygon': continue
        ax.add_patch(mp.PathPatch(mpath.Path.make_compound_path(*[mpath.Path(list(x.coords)) for x in [p.exterior, *p.interiors]]), color=c, lw=0))
runs = [a.split('=') for a in sys.argv[2:]]; N = 8
fig, axs = plt.subplots(len(runs), N, figsize=(3.3 * N, 2.3 * len(runs)), squeeze=False)
for ri, (title, path) in enumerate(runs):
    s = parse(path)
    tools = sorted(set(k[1] for k in s))
    allpts = [(a, b) for k, v in s.items() for a, b, *_ in v]
    cx = (min(p[0] for p in allpts if True) + max(p[0] for p in allpts)) / 2   # refined below from the ring's outer wall
    ring = [(a, b) for (z, tl), v in s.items() if tl == 1 for a, b, *_ in v if a > 60 and b < 195]   # the prime tower sits off at x < 60, y > 195
    cx = (min(p[0] for p in ring) + max(p[0] for p in ring)) / 2; cy = (min(p[1] for p in ring) + max(p[1] for p in ring)) / 2
    zs = sorted(set(k[0] for k in s))[-5:]
    geo = []
    for z in zs:
        for (zz, tl), v in s.items():
            if zz != z: continue
            g = unary_union([LineString([(a - cx, b - cy), (c - cx, d - cy)]).buffer(w / 2, cap_style=1) for a, b, c, d, w in v])
            geo.append((g, tl))
    h = math.pi / N
    for j in range(N):
        ax = axs[ri][j]; ax.axis('off'); ax.set_facecolor('#c9b49a')
        for g, tl in geo: fl(ax, affinity.rotate(g, j * 360 / N, origin=(0, 0)), C.get(tl, 'red'))
        ax.set_xlim(-49 * math.sin(h), 49 * math.sin(h)); ax.set_ylim(29.7 * math.cos(h) - 0.3, 49.5); ax.set_aspect('equal')
        ax.set_title(f'{title} · frame {j+1}' if j == 0 else f'frame {j+1}', fontsize=8, loc='left')
plt.tight_layout(); plt.savefig(sys.argv[1], dpi=90)
