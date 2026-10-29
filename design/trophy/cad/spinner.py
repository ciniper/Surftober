#!/usr/bin/env python
"""Surftober 2026 trophy — spinner CAD generator (CadQuery / OpenCascade).

Builds real solids for the fully printed ring-on-arms spinner. All dimensions,
parts, options and the output tag come from ../spinner-config.js (read through
cad/bridge.mjs with node), so this always matches the 3D viewer.

    .venv/bin/python spinner.py --name NAHLA                      # everything, flush multi-colour inlays
    .venv/bin/python spinner.py --preset testring                 # one-colour spinning piece, wave in relief
    .venv/bin/python spinner.py --parts hub,hub-text --name KAI   # any subset
    .venv/bin/python spinner.py --url "arms=4&weight=cog&art=raised"
    .venv/bin/python spinner.py --list                            # parts and presets

Output, in ./out/ (gitignored):
    <tag>-<part>.stl      one per part, in print orientation
    <tag>.3mf             all parts as multi-part objects per print orientation (Bambu / Prusa)
    <tag>.step            coloured assembly in the mounted pose, with the bearing and metal weight
    <tag>-all.stl         every part as separate shells in one STL (--combined)
    <tag>.json            manifest: options, parts, volumes, files — the viewer reads this
    metal-ring-flat-*.dxf the flat bezel ring outline for SendCutSend (--weight bezel --bezel flat)
"""
import argparse, json, math, os, subprocess, sys, time, zipfile
from urllib.parse import parse_qsl, urlencode
from xml.sax.saxutils import escape
import cadquery as cq

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.environ.get('SPINNER_FONT', '/System/Library/Fonts/Supplemental/Arial Bold.ttf')
PLA = 1.24e-3  # g/mm³


# ---------------------------------------------------------------------------
# Config from the JS single source of truth
# ---------------------------------------------------------------------------
def bridge(query):
    r = subprocess.run(['node', os.path.join(HERE, 'bridge.mjs'), query], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f'bridge.mjs failed:\n{r.stderr}')
    return json.loads(r.stdout)


def list_everything():
    cfg = bridge('')
    print('parts (generated):')
    for p in cfg['generate']:
        print(f"  {p['id']:<11} {p['group']:<16} {p['filament']}")
    print('\nquery options: version (file prefix, default v3), name, tier, arms (3|4), wave, frames, art (inlay|raised|none), text (recessed|inlay|raised), weight (none|bezel|cog), bezel (flat|round), parts')
    print('presets: full, testring, stillset, bezel, cog, plain  (defined in spinner-config.js)')


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------
def cyl(r, z0, h, r_in=0.0):
    wp = cq.Workplane('XY').workplane(offset=z0).circle(r)
    if r_in > 0:
        wp = wp.circle(r_in)
    return wp.extrude(h)


def polys_to_solid(polys, z0, h, label):
    """Union of extruded simple polygons; skips any the kernel rejects."""
    solids, skipped = [], 0
    for pts in polys:
        try:
            s = cq.Workplane('XY').workplane(offset=z0).polyline([tuple(p) for p in pts]).close().extrude(h).val()
            if s.isValid() and s.Volume() > 1e-4:
                solids.append(s)
            else:
                skipped += 1
        except Exception:
            skipped += 1
    if skipped:
        print(f'  {label}: skipped {skipped} degenerate polygon(s)', file=sys.stderr)
    return cq.Workplane('XY').add(solids).combine() if solids else None


def arc_text(text, r, size, depth, z0, top, track):
    """Glyphs around a circle like arcText() in the viewer — upright, reading left to right."""
    glyphs = []
    for ch in text:
        if ch == ' ':
            glyphs.append((None, size * 0.5))
            continue
        g = cq.Workplane('XY').text(ch, size, depth, fontPath=FONT, halign='center', valign='center')
        bb = g.val().BoundingBox()
        glyphs.append((g.translate((-(bb.xmin + bb.xmax) / 2, -(bb.ymin + bb.ymax) / 2, 0)), bb.xlen + size * track))
    total = sum(w for _, w in glyphs) - size * track
    s, parts = -total / 2, []
    for g, w in glyphs:
        mid = s + w / 2
        s += w
        if g is None:
            continue
        th = math.pi / 2 - mid / r if top else -math.pi / 2 + mid / r
        rot = math.degrees(th - math.pi / 2 if top else th + math.pi / 2)
        parts.append(g.rotate((0, 0, 0), (0, 0, 1), rot).translate((r * math.cos(th), r * math.sin(th), z0)).val())
    return cq.Workplane('XY').add(parts).combine()


def cog_shape(n, r_tip, r_root, r_bore):
    pts, pitch = [], 2 * math.pi / n
    for i in range(n):
        a = i * pitch
        for r, f in ((r_root, 0), (r_root, .18), (r_tip, .4), (r_tip, .6), (r_root, .82)):
            pts.append((r * math.cos(a + f * pitch), r * math.sin(a + f * pitch)))
    return cq.Workplane('XY').polyline(pts).close().circle(r_bore)


# ---------------------------------------------------------------------------
# Part builders — each returns the solid in the MOUNTED pose (bearing z 0…t)
# ---------------------------------------------------------------------------
class Spinner:
    BUILDERS = {'body': 'body', 'wave-water': 'wave_water', 'wave-foam': 'wave_foam', 'hub': 'hub', 'hub-text': 'hub_text',
                'back-cap': 'back_cap', 'bearing': 'bearing', 'magnet': 'magnet', 'weight': 'weight'}

    def __init__(self, cfg):
        self.cfg, self.o, self.D = cfg, cfg['options'], cfg['dim']
        self.t = self.D['t']
        self.shift = self.D['lip'] if self.o['seat'] == 'lip' else 0    # how far the body sits behind the bearing's back face
        self._art = None
        self.notes = {}

    def build(self, part_id):
        return getattr(self, self.BUILDERS[part_id])()

    # -- artwork solids, cached: (water, foam) in their pocket / relief position
    def art(self):
        if self._art is None:
            D, t, o, w = self.D, self.t, self.o, self.cfg['wave']
            if o['art'] == 'raised':
                water = polys_to_solid(w['water'], t - 0.2, D['relief'] + 0.2, 'water')        # 0.2 into the body so the fuse is clean
                foam = polys_to_solid(w['foam'], t - 0.2, D['reliefFoam'] + 0.2, 'foam')
            elif o['art'] == 'inlay':
                water = polys_to_solid(w['water'], t - D['inlay'], D['inlay'], 'water')
                foam = polys_to_solid(w['foam'], t - D['inlay'], D['inlay'], 'foam')
            elif o['art'] == 'proud':        # same pockets, inlays stand above the face (foam above water)
                water = polys_to_solid(w['water'], t - D['inlay'], D['inlay'] + D['proud'], 'water')
                foam = polys_to_solid(w['foam'], t - D['inlay'], D['inlay'] + D['proudFoam'], 'foam')
            else:
                water = foam = None
            self._art = (water, foam)
        return self._art

    def body(self):
        """Built with the bearing at z 0…t, then (seat=lip) shifted back by the lip: the body spans -lip … t-lip."""
        D, t, o = self.D, self.t, self.o
        if o['seat'] == 'lip':
            body = cyl(D['hubOut'], 0, t, D['lipIn'])                   # hub with the small hole of the seat lip…
            body = body.cut(cyl(D['bore'] / 2, D['lip'], t))             # …and the bearing bore above it
            body = body.cut(cq.Workplane('XY').add(cq.Solid.makeCone(D['bore'] / 2, D['bore'] / 2 + D['chamfer'] + 0.01, D['chamfer'] + 0.01,
                                                                     cq.Vector(0, 0, t - D['chamfer']), cq.Vector(0, 0, 1))))   # 45° entry chamfer
        else:
            body = cyl(D['hubOut'], 0, t, D['bore'] / 2)                 # plain v1/v2 bore
        arm_len = D['ringIn'] - D['hubOut'] + 1.5
        mid = (D['hubOut'] + D['ringIn']) / 2
        for i in range(o['arms']):
            arm = (cq.Workplane('XY').box(arm_len, D['armW'], t, centered=(True, True, False))
                   .translate((mid, 0, 0)).rotate((0, 0, 0), (0, 0, 1), 90 + i * 360 / o['arms']))
            body = body.union(arm)
        body = body.union(cyl(D['ringOut'], 0, t, D['ringIn']))
        # finger notches: scallops in the outer edge from the back, the front notchKeep stays a clean circle
        n_notch = 2 * self.cfg['wave']['N'] if o['grip'] == 'notches' and o['weight'] != 'bezel' else 0
        if n_notch:
            Rc = D['ringOut'] + D['notchR'] - D['notchDepth']
            for k in range(n_notch):
                a = 2 * math.pi * k / n_notch
                body = body.cut(cyl(D['notchR'], -0.1, t - D['notchKeep'] + 0.1).translate((Rc * math.cos(a), Rc * math.sin(a), 0)))
            self.notes['grip'] = f"{n_notch} rim notches r{D['notchR']} × {D['notchDepth']} deep, {t - D['notchKeep']} mm tall from the back"
        water, foam = self.art()
        for w in (water, foam):
            if w is None:
                continue
            body = body.union(w) if o['art'] == 'raised' else body.cut(w)
        # bought weight
        if o['weight'] == 'bezel' and o['bezel'] == 'round':
            wr = D['bezelWire'] / 2
            R = D['ringOut'] - wr + D['bezelProud']
            body = body.cut(cq.Workplane('XY').add(cq.Solid.makeTorus(R, wr + 0.1, cq.Vector(0, 0, t / 2), cq.Vector(0, 0, 1))))
            self.notes['bezel'] = f'round groove for a Ø{2 * D["ringOut"]:.0f} × {D["bezelWire"]} mm wire ring'
        elif o['weight'] == 'bezel':
            ring_w = (D['flatOd'] - D['flatId']) / 2
            g_in = D['ringOut'] - (ring_w - D['bezelProud']) - D['flatClear']
            g_t = D['flatT'] + D['flatClear']
            body = body.cut(cyl(D['ringOut'] + 1, t / 2 - g_t / 2, g_t, g_in))
            self.notes['bezel'] = f'flat groove: floor r {g_in:.2f}, {g_t:.2f} wide, for a {D["flatOd"]:.0f} × {D["flatId"]:.0f} × {D["flatT"]} ring'
        elif o['weight'] == 'cog':
            body = body.union(cyl(D['cogBore'] / 2 - 0.1, -D['cogT'], D['cogT'], D['cogBossIn']))
            self.notes['cog'] = f'boss Ø{D["cogBore"] - 0.2:.1f} × {D["cogT"]} mm behind the body for a {D["cogTeeth"]}T cog'
        self.notes['seat'] = (f"lip {D['lip']} mm behind the bore (r {D['lipIn']}–{D['bore'] / 2:.2f}) seats the outer race; {D['chamfer']} mm entry chamfer"
                              if o['seat'] == 'lip' else 'plain bore (v1/v2 seat)')
        return body.translate((0, 0, -self.shift))

    def wave_water(self):
        water, foam = self.art()
        if water is None or self.o['art'] not in ('inlay', 'proud'):
            return None
        return (water.cut(foam) if foam is not None else water).translate((0, 0, -self.shift))

    def wave_foam(self):
        foam = self.art()[1] if self.o['art'] in ('inlay', 'proud') else None
        return foam.translate((0, 0, -self.shift)) if foam is not None else None

    def _text(self, z0, depth):
        D, o = self.D, self.o
        r = D['hubR'] - D['textInset']
        txt = arc_text('SURFTOBER 2026', r, D['textSize'], depth, z0, True, D['textTrack'])
        return txt.union(arc_text(o['name'].upper(), r, D['textSize'], depth, z0, False, D['textTrack']))

    def hub(self):
        D, t, o = self.D, self.t, self.o
        z_disc = t + D['standoff']
        hub = (cyl(D['stemD'] / 2, t - D['stemLen'], D['stemLen'])
               .union(cyl(D['spacerR'], t, D['standoff']))
               .union(cyl(D['hubR'], z_disc, D['hubT'])))
        if o['text'] in ('recessed', 'inlay'):      # engraved pocket; the inlay part fills it when text=inlay
            hub = hub.cut(self._text(z_disc + D['hubT'] - D['inlay'], D['inlay']))
        elif o['text'] == 'raised':
            hub = hub.union(self._text(z_disc + D['hubT'] - 0.2, D['relief'] + 0.2))
        return hub

    def hub_text(self):
        D, t, o = self.D, self.t, self.o
        if o['text'] != 'inlay':
            return None     # recessed text is a pocket in the hub, raised text is fused into it
        return self._text(t + D['standoff'] + D['hubT'] - D['inlay'], D['inlay'])

    def back_cap(self):
        D = self.D
        cap = (cyl(D['stemD'] / 2, 0, D['stemLen'])
               .union(cyl(D['spacerR'], -D['capSpacer'], D['capSpacer']))
               .union(cyl(D['capR'], -D['capSpacer'] - D['capT'], D['capT'])))
        return cap.cut(cyl(D['magPocketD'] / 2, -D['capSpacer'] - D['capT'], D['magPocketDepth']))

    # -- bought parts, for the STEP assembly only
    def bearing(self):
        b, t = self.D['bearing'], self.t
        return (cyl(b['od'] / 2, 0, t, b['outerId'] / 2).union(cyl(b['innerOd'] / 2, 0, t, b['id'] / 2))
                .union(cyl(b['outerId'] / 2, 0.3, t - 0.6, b['innerOd'] / 2)))

    def magnet(self):
        D = self.D
        return cyl(D['magD'] / 2, -D['capSpacer'] - D['capT'] + (D['magPocketDepth'] - D['magT']) + 0.05, D['magT'])

    def weight(self):
        D, t, o = self.D, self.t, self.o
        zc = t / 2 - self.shift    # mid-thickness of the body
        if o['weight'] == 'bezel' and o['bezel'] == 'round':
            wr = D['bezelWire'] / 2
            return cq.Workplane('XY').add(cq.Solid.makeTorus(D['ringOut'] - wr + D['bezelProud'], wr, cq.Vector(0, 0, zc), cq.Vector(0, 0, 1)))
        if o['weight'] == 'bezel':
            r_out = D['ringOut'] + D['bezelProud']
            return cyl(r_out, zc - D['flatT'] / 2, D['flatT'], r_out - (D['flatOd'] - D['flatId']) / 2)
        if o['weight'] == 'cog':
            return cog_shape(D['cogTeeth'], D['cogTip'], D['cogRoot'], D['cogBore'] / 2).extrude(D['cogT']).translate((0, 0, -D['cogT'] - self.shift))
        return None


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
def to_print_pose(wp, print_meta):
    """Mounted pose → on the bed: optional flip (text face down), then drop to z = 0."""
    if print_meta['flip']:
        wp = wp.rotate((0, 0, 0), (1, 0, 0), 180)
    return wp.translate((0, 0, -wp.val().BoundingBox().zmin))


def mesh(wp, tol=0.02, ang=0.1):
    verts, tris = wp.val().tessellate(tol, ang)
    return [(v.x, v.y, v.z) for v in verts], tris


def write_3mf(path, groups):
    """groups: [(group_name, [(part_name, '#rrggbb', (verts, tris)), …], (tx, ty)), …]
    → one multi-part object per group, each placed on the bed by its (tx, ty) offset."""
    res, items, mats, oid = [], [], [], 1
    for gname, parts, (tx, ty) in groups:
        comp_ids = []
        for pname, color, (verts, tris) in parts:
            mats.append((pname, color))
            oid += 1
            v = ''.join(f'<vertex x="{x:.4f}" y="{y:.4f}" z="{z:.4f}"/>' for x, y, z in verts)
            t = ''.join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in tris)
            res.append(f'<object id="{oid}" name="{escape(pname)}" type="model" pid="1" pindex="{len(mats) - 1}"><mesh><vertices>{v}</vertices><triangles>{t}</triangles></mesh></object>')
            comp_ids.append(oid)
        oid += 1
        res.append(f'<object id="{oid}" name="{escape(gname)}" type="model"><components>' + ''.join(f'<component objectid="{c}"/>' for c in comp_ids) + '</components></object>')
        items.append(f'<item objectid="{oid}" transform="1 0 0 0 1 0 0 0 1 {tx:.3f} {ty:.3f} 0"/>')
    base = ''.join(f'<base name="{escape(n)}" displaycolor="{c.upper()}FF"/>' for n, c in mats)
    model = ('<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
             f'<metadata name="Title">Surftober 2026 spinner</metadata><resources><basematerials id="1">{base}</basematerials>{"".join(res)}</resources>'
             f'<build>{"".join(items)}</build></model>')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
        z.writestr('3D/3dmodel.model', model)


def hex_color(h):
    return cq.Color(int(h[1:3], 16) / 255, int(h[3:5], 16) / 255, int(h[5:7], 16) / 255)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for k in ('version', 'name', 'tier', 'wave', 'art', 'text', 'seat', 'grip', 'weight', 'bezel', 'parts', 'preset'):
        ap.add_argument(f'--{k}')
    ap.add_argument('--arms', type=int); ap.add_argument('--frames', type=int)
    ap.add_argument('--url', default='', help='a query string of options, e.g. "arms=4&weight=cog" (flags override it)')
    ap.add_argument('--combined', action='store_true', help='also write <tag>-all.stl (every part, separate shells)')
    ap.add_argument('--no-stl', action='store_true'); ap.add_argument('--no-step', action='store_true'); ap.add_argument('--no-3mf', action='store_true')
    ap.add_argument('--out', default=os.path.join(HERE, 'out'))
    ap.add_argument('--list', action='store_true', help='list parts and presets, then exit')
    a = ap.parse_args()
    if a.list:
        return list_everything()

    # flags → query → bridge (validation, tag, dims, parts, wave polygons)
    q = dict(parse_qsl(a.url))
    for k in ('preset', 'version', 'name', 'tier', 'arms', 'wave', 'frames', 'art', 'text', 'seat', 'grip', 'weight', 'bezel', 'parts'):
        if getattr(a, k) is not None:
            q[k] = str(getattr(a, k))
    cfg = bridge(urlencode(q))
    o, tag = cfg['options'], cfg['tag']
    os.makedirs(a.out, exist_ok=True)
    t0 = time.time()
    sp = Spinner(cfg)

    print(f"\n{tag}  —  {cfg['wave']['label']}, {cfg['wave']['N']} frames, {o['arms']} arms, wave: {o['art']}, text: {o['text']}, weight: {o['weight']}")
    print(f'{"part":<12}{"valid":<7}{"volume mm³":>12}{"PLA g":>8}  file')
    manifest = {'tag': tag, 'options': o, 'query': cfg['query'],
                'wave': {'variant': o['wave'], 'label': cfg['wave']['label'], 'N': cfg['wave']['N']},
                'dim': {k: cfg['dim'][k] for k in ('t', 'ringIn', 'ringOut', 'waveIn', 'waveOut', 'hubR', 'bore', 'stemD')},
                'parts': [], 'files': {}, 'generated': time.strftime('%Y-%m-%d %H:%M')}
    built, groups = {}, {}
    for meta in cfg['generate']:
        pid = meta['id']
        wp = sp.build(pid)
        if wp is None:
            continue
        s = wp.val()
        bb = s.BoundingBox()
        entry = {'id': pid, 'label': meta['label'], 'group': meta['group'], 'color': meta['color'], 'filament': meta['filament'],
                 'print': meta['print'], 'mounted_z': [round(bb.zmin, 3), round(bb.zmax, 3)],   # so the viewer can put the print-posed STL back
                 'valid': bool(s.isValid()), 'volume_mm3': round(s.Volume(), 1), 'grams_pla': round(s.Volume() * PLA, 1)}
        posed = to_print_pose(wp, meta['print'])
        if not a.no_stl:
            entry['file'] = f'{tag}-{pid}.stl'
            cq.exporters.export(posed, os.path.join(a.out, entry['file']), tolerance=0.01, angularTolerance=0.05)
        print(f"{pid:<12}{str(entry['valid']):<7}{entry['volume_mm3']:>12.0f}{entry['grams_pla']:>8.1f}  {entry.get('file', '')}")
        manifest['parts'].append(entry)
        built[pid] = (wp, posed, meta)
        # 3MF print units: parts that are meant to nest (same pose, concentric) share an object; the rest get their own
        unit = 'back cap' if pid == 'back-cap' else 'front hub' if pid in ('hub', 'hub-text') else 'spinning piece'
        groups.setdefault(unit, []).append((pid, meta['color'], posed))
    for k, v in sp.notes.items():
        print(f'  {k}: {v}')
    if not built:
        sys.exit('nothing to build for these options')

    if a.combined and not a.no_stl:
        allp = cq.Workplane('XY').add([posed.val() for _, posed, _ in built.values()])
        cq.exporters.export(allp, os.path.join(a.out, f'{tag}-all.stl'), tolerance=0.01, angularTolerance=0.05)
        manifest['files']['all_stl'] = f'{tag}-all.stl'
        print(f'combined  → {tag}-all.stl ({len(built)} shells in one file)')

    if not a.no_3mf:
        # one multi-part object per print unit, laid out side by side on the bed
        D = cfg['dim']
        spots = {'spinning piece': (0, 0), 'front hub': (D['ringOut'] + D['hubR'] + 8, 0), 'back cap': (D['ringOut'] + D['hubR'] + 8, D['hubR'] + D['capR'] + 8)}
        if 'spinning piece' not in groups:
            spots = {'front hub': (0, 0), 'back cap': (0, D['hubR'] + D['capR'] + 8)}
        write_3mf(os.path.join(a.out, f'{tag}.3mf'), [(g, [(pid, color, mesh(posed)) for pid, color, posed in parts], spots[g]) for g, parts in groups.items()])
        manifest['files']['3mf'] = f'{tag}.3mf'
        print(f'3mf       → {tag}.3mf ({len(groups)} object(s), {len(built)} part(s))')

    if o['weight'] == 'bezel' and o['bezel'] == 'flat':
        D = cfg['dim']
        r_out = D['ringOut'] + D['bezelProud']
        r_in = r_out - (D['flatOd'] - D['flatId']) / 2
        fn = f'metal-ring-flat-{2 * r_out:.1f}x{2 * r_in:.1f}.dxf'
        cq.exporters.exportDXF(cq.Workplane('XY').circle(r_out).circle(r_in), os.path.join(a.out, fn))
        manifest['files']['dxf'] = fn
        print(f'dxf       → {fn}  (SendCutSend: 0.125" brass / stainless / copper)')

    if not a.no_step:
        asm = cq.Assembly(name='surftober-spinner')
        for pid, (wp, _, meta) in built.items():
            asm.add(wp, name=pid, color=hex_color(meta['color']))
        for pid, color in (('bearing', '#d0d4d8'), ('magnet', '#333333'), ('weight', cfg['tier']['color'])):
            if pid in cfg['active']:
                ref = sp.build(pid)
                if ref is not None:
                    asm.add(ref, name=pid, color=hex_color(color))
        asm.export(os.path.join(a.out, f'{tag}.step'))
        manifest['files']['step'] = f'{tag}.step'
        print(f'step      → {tag}.step (mounted assembly incl. bearing / magnet / weight)')

    manifest['seconds'] = round(time.time() - t0, 1)
    with open(os.path.join(a.out, f'{tag}.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    print(f'\nwrote {a.out}  ({manifest["seconds"]} s)')


if __name__ == '__main__':
    main()
