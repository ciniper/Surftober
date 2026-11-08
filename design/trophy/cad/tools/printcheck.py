# Print check on the real ring: every colour region (cream foam, navy water, the brown ring face showing
# between them) must be at least MIN mm wide everywhere, or a 0.4 mm nozzle can't lay it down as two lines.
# Each region is opened (shrunk then grown) by MIN/2; whatever doesn't survive is reported and drawn in
# magenta (cream), red (navy) or green (ring-colour gaps), one panel per frame, each slot turned to the top.
#
# usage (from design/trophy/cad): .venv/bin/python tools/printcheck.py "<options query, e.g. wave=ploverface>" out.png [MIN=0.9]
import json, subprocess, sys, math, pathlib
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union
from shapely import affinity
query, out = sys.argv[1], sys.argv[2]; wave = query; MIN = float(sys.argv[3]) if len(sys.argv) > 3 else 0.9; r = MIN / 2
bridge = pathlib.Path(__file__).resolve().parents[1] / 'bridge.mjs'
d = json.loads(subprocess.run(['node', str(bridge), query if '=' in query else f'wave={query}'], capture_output=True, text=True).stdout)
w = d['wave']; D = d['dim']; N = w['N']
U = lambda ps: unary_union([Polygon(p).buffer(0) for p in ps])
ring = Point(0, 0).buffer(D['ringOut'], 256).difference(Point(0, 0).buffer(D['ringIn'], 256))
cream = U(w['foam']).intersection(ring); navy = U(w['water']).intersection(ring).difference(cream)
brown = ring.difference(navy).difference(cream)
def lost(g):
    o = g.buffer(-r * 0.999, join_style=1).buffer(r * 0.999, join_style=1)
    l = g.difference(o.buffer(0.02))
    return unary_union([p for p in getattr(l, 'geoms', [l]) if p.area > 0.01])
L = {k: lost(g) for k, g in (('cream', cream), ('navy', navy), ('brown', brown))}
# brown along the ring's own inner/outer edge is the plain ring, not art: ignore a 0.3 band at each edge
edge = Point(0, 0).buffer(D['ringIn'] + 0.3, 256).union(ring.difference(Point(0, 0).buffer(D['ringOut'] - 0.3, 256)))
L['brown'] = L['brown'].difference(edge)
print(wave, f'N {N}', ' '.join(f'{k} lost {L[k].area:.1f}/{g.area:.0f} mm²' for k, g in (('cream', cream), ('navy', navy), ('brown', brown))))
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt, matplotlib.patches as mp, matplotlib.path as mpath
def fl(ax, g, c):
    for p in getattr(g, 'geoms', [g]):
        if p.is_empty or p.geom_type != 'Polygon': continue
        ax.add_patch(mp.PathPatch(mpath.Path.make_compound_path(*[mpath.Path(list(x.coords)) for x in [p.exterior, *p.interiors]]), color=c, lw=0))
cols = 4; fig, axs = plt.subplots(math.ceil(N / cols), cols, figsize=(5.2 * cols, 3.4 * math.ceil(N / cols)))
h = math.pi / N
for j in range(N):
    ax = axs.flat[j]; ax.axis('off'); a = j * 360 / N
    R = lambda g: affinity.rotate(g, a, origin=(0, 0))
    for g, c in ((brown, '#7B4A2A'), (navy, '#1D3050'), (cream, '#EFE7D2'), (L['cream'], '#ff00ff'), (L['navy'], '#ff2020'), (L['brown'], '#20ff60')): fl(ax, R(g), c)
    ax.set_xlim(-D['ringOut'] * math.sin(h), D['ringOut'] * math.sin(h)); ax.set_ylim(D['ringIn'] * math.cos(h) - 0.3, D['ringOut'] + 0.3); ax.set_aspect('equal')
    ax.set_title(f'frame {j+1}', fontsize=9, loc='left')
plt.suptitle(f'{wave}: parts under {MIN} mm — magenta cream, red navy, green ring-colour gaps', fontsize=11)
plt.tight_layout(); plt.savefig(out, dpi=80)
