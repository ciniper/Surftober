#!/usr/bin/env python
"""Surftober 2026 trophy — spinner CAD generator (CadQuery / OpenCascade).

Builds real solids for the fully printed ring-on-arms spinner. All dimensions,
parts, options and the output tag come from ../spinner-config.js (read through
cad/bridge.mjs with node), so this always matches the 3D viewer.

    .venv/bin/python spinner.py --name NAHLA                      # everything, flush multi-colour inlays
    .venv/bin/python spinner.py --preset testring                 # just the spinning piece (one solid part, wave in relief)
    .venv/bin/python spinner.py --parts hub,hub-text --name KAI   # any subset
    .venv/bin/python spinner.py --url "arms=4&weight=cog&art=raised"
    .venv/bin/python spinner.py --list                            # parts and presets

Output, in ./out/ (gitignored):
    <tag>-<part>.stl      one per part, in print orientation
    <tag>.3mf             all parts as multi-part objects per print orientation (any slicer)
    <tag>-bambu.3mf       pre-coloured Bambu Studio project: X1C, 4 AMS slots (brown / navy / cream / orange), one plate per print unit
    <tag>.step            coloured assembly in the mounted pose, with the bearing, centre screw and metal weight
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
    print('\nquery options: version (file prefix, default v5), name, tier, arms (3|4), wave, frames, art (raised|proud|inlay|none), text (recessed|inlay|raised), '
          'seat (lip|plain), grip (ridges|notches|none), magnet (none|disc), screw (m3|none), weight (none|bezel|cog), bezel (flat|round), parts')
    print('presets: full, inlays, testring, stillset, bezel, cog, plain  (defined in spinner-config.js)')


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------
def cyl(r, z0, h, r_in=0.0):
    wp = cq.Workplane('XY').workplane(offset=z0).circle(r)
    if r_in > 0:
        wp = wp.circle(r_in)
    return wp.extrude(h)


def healed(pts, z0, h):
    """Rebuild a polygon the kernel rejects. wave-frames.js cuts holes (the plover's collar, cap and eye,
    carved texture lines) as one outline that runs in to each hole along a hairline slit (~0.02 mm),
    which OpenCascade sees as self-touching. Closing it by a hair seals the slits, then the outline is
    extruded with its holes as real inner wires."""
    from shapely.geometry import Polygon
    g = Polygon(pts).buffer(0.03, join_style=2).buffer(-0.03, join_style=2)
    out = []
    for poly in getattr(g, 'geoms', [g]):                # the collar splits the plover's body in two: keep both
        poly = poly.simplify(0.005)                       # drops the near-zero edges the closing leaves (5 µm)
        if poly.is_empty or poly.area < 1e-3:
            continue
        wp = cq.Workplane('XY').workplane(offset=z0).polyline(list(poly.exterior.coords)[:-1]).close()
        for ring in poly.interiors:
            if len(ring.coords) > 3:
                wp = wp.polyline(list(ring.coords)[:-1]).close()
        s = wp.extrude(h).val()
        if s.isValid() and s.Volume() > 1e-4:
            out.append(s)
    return out


def polys_to_solid(polys, z0, h, label):
    """Union of extruded simple polygons; heals slit-cut holes, skips anything still rejected."""
    solids, skipped, fixed = [], 0, 0
    for pts in polys:
        try:
            s = cq.Workplane('XY').workplane(offset=z0).polyline([tuple(p) for p in pts]).close().extrude(h).val()
            if s.isValid() and s.Volume() > 1e-4:
                solids.append(s)
                continue
        except Exception:
            pass
        try:
            hs = healed(pts, z0, h)
        except Exception:
            hs = []
        if hs:
            solids.extend(hs); fixed += 1
        else:
            skipped += 1
    if fixed:
        print(f'  {label}: rebuilt {fixed} polygon(s) with holes', file=sys.stderr)
    if skipped:
        print(f'  {label}: skipped {skipped} degenerate polygon(s)', file=sys.stderr)
    return cq.Workplane('XY').add(solids).combine() if solids else None


def line_text(text, size, depth, z0, cy, track):
    """One straight line of glyphs, centred on x = 0 with its cap band centred on y = cy (centreText() in the viewer)."""
    glyphs = []
    for ch in text:
        if ch == ' ':
            glyphs.append((None, size * 0.5))
            continue
        g = cq.Workplane('XY').text(ch, size, depth, fontPath=FONT, halign='center', valign='center')
        bb = g.val().BoundingBox()
        glyphs.append((g.translate((-(bb.xmin + bb.xmax) / 2, 0, 0)), bb, bb.xlen + size * track))
    total = sum(x[-1] for x in glyphs) - size * track
    y0 = cy - (min(x[1].ymin for x in glyphs if x[0] is not None) + max(x[1].ymax for x in glyphs if x[0] is not None)) / 2
    s, parts = -total / 2, []
    for x in glyphs:
        w = x[-1]
        if x[0] is not None:
            parts.append(x[0].translate((s + w / 2 - size * track / 2, y0, z0)).val())
        s += w
    return cq.Workplane('XY').add(parts).combine()


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


def ridged_ring(R, n, w, depth, r_in, z0, h):
    """Ring with n round-bottomed grooves (w wide, depth deep) round its outer edge, full height —
    true arcs, so the STEP stays light in SolidWorks."""
    hw, pitch = (w / 2) / R, 2 * math.pi / n
    P = lambda r, a: (r * math.cos(a), r * math.sin(a))
    start = P(R, -hw)
    wp = cq.Workplane('XY').workplane(offset=z0).moveTo(*start)
    for k in range(n):
        a = k * pitch
        wp = wp.threePointArc(P(R - depth, a), P(R, a + hw))                          # groove
        end = start if k == n - 1 else P(R, a + pitch - hw)
        wp = wp.threePointArc(P(R, a + pitch / 2), end)                               # land (the ridge)
    return wp.close().extrude(h).cut(cyl(r_in, z0 - 0.1, h + 0.2))


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
    BUILDERS = {'body': 'body', 'insert': 'insert', 'wave-water': 'wave_water', 'wave-foam': 'wave_foam', 'hub': 'hub', 'hub-text': 'hub_text',
                'back-cap': 'back_cap', 'bearing': 'bearing', 'screw': 'screw', 'magnet': 'magnet', 'weight': 'weight'}

    def __init__(self, cfg):
        self.cfg, self.o, self.D = cfg, cfg['options'], cfg['dim']
        self.t = self.D['t']
        self.shift = self.D['lip'] if self.o['seat'] == 'lip' else 0    # how far the body sits behind the bearing's back face
        self._art = None
        self.notes = {}
        self.has_screw = self.o.get('screw') == 'm3' and self.o['magnet'] != 'disc'

    # -- centre screw (mirrors screwZ() in spinner-config.js): countersink top at the divot bottom,
    #    the seated head's top face, the tip
    def screw_z(self):
        D = self.D
        csk = -D['capSpacer'] - self.cap_t() + D['dishDepth']
        head = csk + (D['screwHeadD'] - D['screwHead']) / 2
        return csk, head, head + D['screwLen']

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

    def body(self, relief=True):
        """Built with the bearing at z 0…t, then (seat=lip) shifted back by the lip: the body spans -lip … t-lip.
        relief=False leaves the raised art off (the multi-colour 3MF carries it as separate parts)."""
        D, t, o = self.D, self.t, self.o
        if o['seat'] == 'lip':
            body = cyl(D['hubOut'], 0, t, D['lipIn'])                   # hub with the small hole of the seat lip…
            body = body.cut(cyl(D['bore'] / 2, D['lip'], t))             # …and the bearing bore above it
            body = body.cut(cq.Workplane('XY').add(cq.Solid.makeCone(D['bore'] / 2, D['bore'] / 2 + D['chamfer'] + 0.01, D['chamfer'] + 0.01,
                                                                     cq.Vector(0, 0, t - D['chamfer']), cq.Vector(0, 0, 1))))   # 45° entry chamfer
        else:
            body = cyl(D['hubOut'], 0, t, D['bore'] / 2)                 # plain v1/v2 bore
        ins = o['ring'] == 'insert'
        arm_len = D['ringIn'] - D['hubOut'] + (0.75 if ins else 1.5)       # insert: the arms stop at the pocket's inner edge
        mid = (D['hubOut'] + D['ringIn']) / 2 - (0.375 if ins else 0)
        for i in range(o['arms']):
            arm = (cq.Workplane('XY').box(arm_len, D['armW'], t, centered=(True, True, False))
                   .translate((mid, 0, 0)).rotate((0, 0, 0), (0, 0, 1), 90 + i * 360 / o['arms']))
            body = body.union(arm)
        n_ridge = self.cfg.get('ridges', 0)
        if n_ridge:     # v5 micro ridges: fine round-bottomed grooves the full thickness of the rim
            body = body.union(ridged_ring(D['ringOut'], n_ridge, D['ridgeW'], D['ridgeDepth'], D['ringIn'], 0, t))
            self.notes['grip'] = (f"{n_ridge} micro ridges: grooves {D['ridgeW']} wide × {D['ridgeDepth']} deep, "
                                  f"pitch {2 * math.pi * D['ringOut'] / n_ridge:.2f} mm, front to back")
        else:
            body = body.union(cyl(D['ringOut'], 0, t, D['ringIn']))
        # v4 finger notches: scallops in the outer edge from the back, the front notchKeep stays a clean circle
        n_notch = 2 * self.cfg['wave']['N'] if o['grip'] == 'notches' and o['weight'] != 'bezel' else 0
        if n_notch:
            Rc = D['ringOut'] + D['notchR'] - D['notchDepth']
            for k in range(n_notch):
                a = 2 * math.pi * k / n_notch
                body = body.cut(cyl(D['notchR'], -0.1, t - D['notchKeep'] + 0.1).translate((Rc * math.cos(a), Rc * math.sin(a), 0)))
            self.notes['grip'] = f"{n_notch} rim notches r{D['notchR']} × {D['notchDepth']} deep, {t - D['notchKeep']} mm tall from the back"
        if ins:         # pocket for the glue-in art ring: ringIn → waveOut (the ridged rim stays as the outer wall), insertT deep
            body = body.cut(cyl(D['waveOut'], t - D['insertT'], D['insertT'] + 0.01, D['ringIn'] - 0.01))
            self.notes['insert'] = f"pocket r {D['ringIn']}–{D['waveOut']} × {D['insertT']} deep; insert ring r {D['ringIn']}–{D['waveOut'] - D['insertClear']:.2f} × {D['insertT']} + relief"
        water, foam = self.art()
        for w in (water, foam):
            if w is None or ins or (o['art'] == 'raised' and not relief):
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

    def insert(self, relief=True):
        """The glue-in art ring (ring=insert): a thin annulus sitting in the body's pocket, insertClear inside its
        outer wall, with the wave in relief on top (relief=False: the bare ring, for the colour split). Mounted pose."""
        D, t = self.D, self.t
        ring = cyl(D['waveOut'] - D['insertClear'], t - D['insertT'], D['insertT'], D['ringIn'])
        if relief:
            w = self.cfg['wave']
            for polys, h in ((w['water'], D['relief']), (w['foam'], D['reliefFoam'])):
                x = polys_to_solid(polys, t - 0.2, h + 0.2, 'insert art')      # 0.2 into the ring so the fuse is clean
                if x is not None:
                    ring = ring.union(x)
        return ring.translate((0, 0, -self.shift))

    def relief_parts(self):
        """art=raised (or the insert), split for a multi-colour print: the two relief layers as their own solids
        standing on the ring face, water 0.4 minus the foam's footprint and foam 0.8, so they touch the plain
        body() / insert() and each other without overlapping. Mounted pose, like body()."""
        if self.o['art'] != 'raised' and self.o['ring'] != 'insert':
            return []
        D, t, w = self.D, self.t, self.cfg['wave']
        water = polys_to_solid(w['water'], t, D['relief'], 'water')
        foam = polys_to_solid(w['foam'], t, D['reliefFoam'], 'foam')
        if water is not None and foam is not None:
            water = water.cut(foam)
        return [(pid, x.translate((0, 0, -self.shift))) for pid, x in (('wave-water', water), ('wave-foam', foam)) if x is not None]

    def wave_water(self):
        water, foam = self.art()
        if water is None or self.o['art'] not in ('inlay', 'proud') or self.o['ring'] == 'insert':
            return None
        return (water.cut(foam) if foam is not None else water).translate((0, 0, -self.shift))

    def wave_foam(self):
        foam = self.art()[1] if self.o['art'] in ('inlay', 'proud') and self.o['ring'] != 'insert' else None
        return foam.translate((0, 0, -self.shift)) if foam is not None else None

    def _text(self, z0, depth):
        D, o = self.D, self.o
        r = D['hubR'] - D['textInset']
        txt = arc_text('SURFTOBER 2026', r, D['textSize'], depth, z0, True, D['textTrack'])
        txt = txt.union(arc_text(o['name'].upper(), r, D['textSize'], depth, z0, False, D['textTrack']))
        if self.cfg.get('centre'):                  # centre=hours: big digits over "HOURS!", the stack centred on the hub
            S = D['textSize']
            if len(self.cfg['centre']) == 1:        # centre=hoursline: one line across the middle, the ring text's size
                txt = txt.union(line_text(self.cfg['centre'][0], S, depth, z0, 0, D['textTrack']))
                self.notes['hub-text'] = f"centre \"{self.cfg['centre'][0]}\": one line, {S:.2f} mm"
                return txt
            num, word = self.cfg['centre']
            Sn = S * D['hoursScale']
            hn, hw, gap = 0.73 * Sn, 0.73 * S, D['hoursGap'] * S
            H = hn + gap + hw
            txt = txt.union(line_text(num, Sn, depth, z0, H / 2 - hn / 2, D['textTrack']))
            txt = txt.union(line_text(word, S, depth, z0, -H / 2 + hw / 2, D['textTrack']))
            self.notes['hub-text'] = f"centre \"{num} {word}\": digits {Sn:.1f} mm, word {S:.1f} mm, stack {H:.1f} tall"
        return txt

    def hub(self):
        D, t, o = self.D, self.t, self.o
        z_disc = t + D['standoff']
        hub = (cyl(D['stemD'] / 2, t - D['stemLen'], D['stemLen'])
               .union(cyl(D['spacerR'], t, D['standoff']))
               .union(cyl(D['hubR'], z_disc, D['hubT'])))
        if o['text'] in ('recessed', 'inlay'):      # engraved pocket; the inlay part fills it when text=inlay
            hub = hub.cut(self._text(z_disc + D['hubT'] - D['textDepth'], D['textDepth']))
        elif o['text'] == 'raised':
            hub = hub.union(self._text(z_disc + D['hubT'] - 0.2, D['relief'] + 0.2))
        if self.has_screw:                          # blind pilot up the stem for the centre screw to self-tap into
            z0, top = t - D['stemLen'] - 0.1, z_disc + D['hubT'] - D['frontSkin']
            hub = hub.cut(cyl(D['screwPilot'] / 2, z0, top - z0))
            tip = self.screw_z()[2]
            self.notes['hub'] = (f"{D['hubT']} thick, {D['standoff']} stand-off; pilot Ø{D['screwPilot']} × {top - z0 - 0.1:.1f} deep, "
                                 f"{D['frontSkin']} skin under the face; screw engages {tip - (t - D['stemLen']):.1f} mm, {top - tip:.1f} spare")
        return hub

    def hub_text(self):
        D, t, o = self.D, self.t, self.o
        if o['text'] != 'inlay':
            return None     # recessed text is a pocket in the hub, raised text is fused into it
        return self._text(t + D['standoff'] + D['hubT'] - D['textDepth'], D['textDepth'])

    def cap_t(self):
        return self.D['capTMag'] if self.o['magnet'] == 'disc' else self.D['capT']

    def back_cap(self):
        D, T = self.D, self.cap_t()
        z_back = -D['capSpacer'] - T
        cap = (cyl(D['stemD'] / 2, 0, D['stemLen'])
               .union(cyl(D['spacerR'], -D['capSpacer'], D['capSpacer']))
               .union(cyl(D['capR'], z_back, T)))
        if self.o['magnet'] == 'disc':
            self.notes['cap'] = f"magnet pocket Ø{D['magPocketD']} × {D['magPocketDepth']} on a {T - D['magPocketDepth']:.1f} floor"
            return cap.cut(cyl(D['magPocketD'] / 2, z_back, D['magPocketDepth']))
        rd, dd = D['dishD'] / 2, D['dishDepth']                    # spherical finger divot in the back face (back=flat: none)
        if dd > 0:
            R = (rd * rd + dd * dd) / (2 * dd)
            self.notes['cap'] = f"grip plate {T} thick on a {D['capSpacer']} spacer ({D['capSpacer'] - D['lip']:.1f} clear of the body), finger divot Ø{D['dishD']} × {dd} (sphere R {R:.0f})"
            cap = cap.cut(cq.Workplane('XY').add(cq.Solid.makeSphere(R, cq.Vector(0, 0, z_back + dd - R), angleDegrees1=-90, angleDegrees2=90)))
        else:
            self.notes['cap'] = f"flat grip plate {T} thick on a {D['capSpacer']} spacer ({D['capSpacer'] - D['lip']:.1f} clear of the body), no divot"
        if self.has_screw:      # clearance hole up the middle + a 90° countersink, head flush in the divot bottom
            csk = self.screw_z()[0]
            rh, rs = D['screwHeadD'] / 2, D['screwD'] / 2
            cap = cap.cut(cyl(rs, z_back - 0.1, D['capSpacer'] + T + D['stemLen'] + 0.2))
            if csk > z_back:
                cap = cap.cut(cyl(rh, z_back - 0.1, csk - z_back + 0.1))                 # opens the divot round the head
            cap = cap.cut(cq.Workplane('XY').add(cq.Solid.makeCone(rh, rs, rh - rs, cq.Vector(0, 0, csk), cq.Vector(0, 0, 1))))
            self.notes['cap'] += f"; Ø{D['screwD']} hole + 90° countersink Ø{D['screwHeadD']} for an M3 × {D['screwLen']} countersunk screw"
        return cap

    # -- bought parts, for the STEP assembly only
    def bearing(self):
        b, t = self.D['bearing'], self.t
        return (cyl(b['od'] / 2, 0, t, b['outerId'] / 2).union(cyl(b['innerOd'] / 2, 0, t, b['id'] / 2))
                .union(cyl(b['outerId'] / 2, 0.3, t - 0.6, b['innerOd'] / 2)))

    def screw(self):
        """M3 countersunk screw, simplified (no thread), for the STEP assembly."""
        if not self.has_screw:
            return None
        D = self.D
        _, head, tip = self.screw_z()
        rh, r = D['screwHead'] / 2, 1.5                       # ISO 10642 M3: head Ø5.5 actual, 90°
        cone = cq.Workplane('XY').add(cq.Solid.makeCone(rh, r, rh - r, cq.Vector(0, 0, head), cq.Vector(0, 0, 1)))
        return cone.union(cyl(r, head + rh - r - 0.01, tip - head - (rh - r) + 0.01))

    def magnet(self):
        D = self.D
        if self.o['magnet'] != 'disc':
            return None
        return cyl(D['magD'] / 2, -D['capSpacer'] - self.cap_t() + (D['magPocketDepth'] - D['magT']) + 0.05, D['magT'])

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
    """Tessellate to one welded mesh: OpenCascade meshes each face on its own, so the vertices along shared
    edges are duplicated; merging them (to 0.1 µm) makes a closed, connected shell instead of thousands of
    loose patches with open edges, which is what slicers expect in a 3MF."""
    verts, tris = wp.val().tessellate(tol, ang)
    index, out, remap = {}, [], []
    for v in verts:
        k = (round(v.x, 4), round(v.y, 4), round(v.z, 4))
        if k not in index:
            index[k] = len(out); out.append((v.x, v.y, v.z))
        remap.append(index[k])
    faces = [(remap[a], remap[b], remap[c]) for a, b, c in tris]
    return out, [f for f in faces if len(set(f)) == 3]


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


# Multi-colour project for Bambu Studio (Chase prints on an X1C with a 4-slot AMS): which filament slot each
# part goes on, and the colour shown for it. The spinner's base is its own brown; the slots can be remapped
# in the slicer.
BAMBU_FILAMENTS = [('body', '#A9825A'), ('navy', '#1D3050'), ('cream', '#EFE7D2'), ('orange', '#FF6B35')]   # slot 1 is renamed/recoloured per project: the body colour, or the tier colour on the insert plate
BAMBU_SLOT = {'body': 1, 'insert': 1, 'wave-water': 2, 'wave-foam': 3, 'hub': 2, 'hub-text': 3, 'back-cap': 4}
BAMBU_APP = 'BambuStudio-02.08.02.61'
# Changes to the stock X1C · 0.20 Standard process. The art's finest lines (the plover's navy outline, legs,
# collar and eye, the board's rim, the cream lip line) are 0.2–0.35 mm, under a 0.4 nozzle's 0.42 line:
# the stock 'classic' wall generator drops them without a warning, Arachne prints them as narrower lines.
# v9 (Chase prints everything solid): 100% infill, rectilinear (Bambu's 'zig-zag'; the stock grid would cross itself at 100%).
BAMBU_PROCESS = {'wall_generator': 'arachne', 'sparse_infill_density': '100%', 'sparse_infill_pattern': 'zig-zag'}
# Stock Bambu profiles (installed with Bambu Studio) for a nozzle other than the 0.4 the project file was saved
# with. The 0.2 round (2026-11-07): switching the printer to the 0.2 nozzle in the slicer resets the process to
# its stock profile — classic walls — and the plover's fine strokes vanish again. Writing the 0.2 profiles into
# the project (plus Arachne) means the file opens ready to slice. 0.10 mm layers so the 0.4 / 0.8 relief steps
# land on layer lines.
BAMBU_PROFILES = os.environ.get('BAMBU_PROFILES', '/Applications/BambuStudio.app/Contents/Resources/profiles/BBL')
BAMBU_NOZZLE = {'0.2': {'machine': 'Bambu Lab X1 Carbon 0.2 nozzle', 'process': '0.10mm Standard @BBL X1C 0.2 nozzle', 'filament': 'Bambu PLA Basic @BBL X1C 0.2 nozzle'}}
BAMBU_META_KEYS = {'type', 'name', 'from', 'setting_id', 'instantiation', 'inherits', 'include', 'description', 'is_custom_defined', 'upward_compatible_machine', 'compatible_printers', 'compatible_printers_condition', 'compatible_prints', 'compatible_prints_condition'}


def bambu_profile(kind, name):
    """A stock profile with its `inherits` / `include` chain flattened (child keys win), meta keys dropped."""
    d = json.load(open(os.path.join(BAMBU_PROFILES, kind, name + '.json')))
    out = {}
    for inc in d.get('include', []):
        out.update(bambu_profile(kind, inc))
    if d.get('inherits'):
        out.update(bambu_profile(kind, d['inherits']))
    out.update({k: v for k, v in d.items() if k not in BAMBU_META_KEYS})
    return out


def bambu_nozzle_settings(ps, nozzle):
    """Project settings `ps` (saved for the 0.4) rewritten for `nozzle`: printer + process + filament profiles
    swapped for the stock ones. Only keys the saved project already has are touched, and every list is tiled to
    the project's own length for that key (Bambu stores process lists per extruder variant and filament lists
    per filament × variant), so the loader sees the schema it saved."""
    names = BAMBU_NOZZLE[nozzle]
    prof = bambu_profile('machine', names['machine'])
    proc = bambu_profile('process', names['process'])
    fil = bambu_profile('filament', names['filament'])
    for src in (prof, proc, fil):
        for k, v in src.items():
            if k not in ps:
                continue
            cur = ps[k]
            if isinstance(v, list) and isinstance(cur, list) and cur:
                ps[k] = (v * (len(cur) // len(v)))[:len(cur)] if len(v) and len(cur) % len(v) == 0 else cur if len(v) != 1 else v * len(cur)
            elif not isinstance(v, list) and not isinstance(cur, list):
                ps[k] = v
    n_fil = len(ps.get('filament_settings_id', [1, 1, 1, 1]))
    ps['printer_settings_id'], ps['print_settings_id'] = names['machine'], names['process']
    ps['filament_settings_id'] = [names['filament']] * n_fil
    ps['wipe_tower_y'] = ['200']       # the saved project parks the prime tower at y 220 (+35 wide +3 brim = past the 256 bed); the taller 0.1 mm tower trips the CLI's bounds check there
    ps['print_compatible_printers'] = proc.get('compatible_printers') or json.load(open(os.path.join(BAMBU_PROFILES, 'process', names['process'] + '.json'))).get('compatible_printers', [names['machine']])
    return ps


BAMBU_BED, BAMBU_PLATE_GAP = 256.0, 1 / 5     # X1C bed; Bambu Studio lays plates out bed × (1 + gap) apart


# Plate + per-object settings baked into every project (Chase, 2026-11-10): the textured PEI plate for every part (the
# smooth plate didn't work well); the front hub and back cap on 6 walls (Chase: loops round the screw take its hoop
# load along the filament), but 1 wall in the hub's face-down text layers so the flush text isn't ringed by echoes of
# every letter (see write_bambu_3mf's obj_cfg / ranges).
BAMBU_BED_TYPE = 'Textured PEI Plate'
BAMBU_STILL_WALLS, BAMBU_TEXT_WALLS = 6, 1


def write_bambu_3mf(path, groups, nozzle='0.4', slot1=None, slot4=None, slots=None, obj_cfg=None, ranges=None):
    """groups: [(object_name, [(part_id, (verts, tris)), …], (x, y) on its plate), …] → a Bambu Studio project
    laid out the way Bambu Studio saves one: the meshes in 3D/Objects/, one object per print unit whose parts
    (components) each carry their filament slot in Metadata/model_settings.config, one object per plate (so a
    single-colour part never shares layers with another colour and the AMS only swaps where it must), plus the
    project settings
    (obj_cfg: {object name: {setting: value}} per-object settings; ranges: {object name: [(z0, z1, {setting: value})]}
    height-range modifiers, Metadata/layer_config_ranges.xml) from bambu-x1c-project.json (X1C 0.4, 0.20 mm Standard, 4 × Bambu PLA Basic; Bambu Studio's loader
    crashes on a project without them) with the four filament colours filled in and BAMBU_PROCESS applied."""
    import uuid
    U = lambda: str(uuid.uuid4())
    FIL = [slot1 or BAMBU_FILAMENTS[0]] + BAMBU_FILAMENTS[1:3] + [slot4 or BAMBU_FILAMENTS[3]]   # slot1 / slot4: (name, hex) for those AMS slots
    SLOT = slots or BAMBU_SLOT
    NS = ('xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" '
          'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p"')
    files, root_objs, items, settings, plate, rels = {}, [], [], [], [], []
    mid = 0
    root_ids = list(range(sum(len(p) for _, p, _ in groups) + 1, sum(len(p) for _, p, _ in groups) + 1 + len(groups)))
    for gi, (gname, parts, (tx, ty)) in enumerate(groups):
        fname = f'/3D/Objects/object_{gi + 1}.model'
        meshes, comps, parts_cfg = [], [], []
        for pid, (verts, tris) in parts:
            mid += 1
            v = ''.join(f'<vertex x="{x:.4f}" y="{y:.4f}" z="{z:.4f}"/>' for x, y, z in verts)
            t = ''.join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in tris)
            meshes.append(f'<object id="{mid}" p:UUID="{U()}" type="model"><mesh><vertices>{v}</vertices><triangles>{t}</triangles></mesh></object>')
            comps.append(f'<component p:path="{fname}" objectid="{mid}" p:UUID="{U()}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>')
            slot = SLOT.get(pid, 1)
            parts_cfg.append(f'<part id="{mid}" subtype="normal_part"><metadata key="name" value="{escape(pid)} · {FIL[slot - 1][0]}"/>'
                             f'<metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/><metadata key="extruder" value="{slot}"/>'
                             f'<mesh_stat face_count="{len(tris)}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/></part>')
        files[fname[1:]] = f'<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" {NS}><metadata name="BambuStudio:3mfVersion">1</metadata><resources>{"".join(meshes)}</resources><build/></model>'
        rels.append(f'<Relationship Target="{fname}" Id="rel-{gi + 1}" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>')
        rid = root_ids[gi]
        root_objs.append(f'<object id="{rid}" p:UUID="{U()}" type="model"><components>{"".join(comps)}</components></object>')
        cols = math.ceil(math.sqrt(len(groups)) - 1e-9)                        # Bambu's plate grid: plate i at column i % cols, row i // cols
        step = BAMBU_BED * (1 + BAMBU_PLATE_GAP)
        ox, oy = (gi % cols) * step, -(gi // cols) * step
        items.append(f'<item objectid="{rid}" p:UUID="{U()}" transform="1 0 0 0 1 0 0 0 1 {ox + tx:.3f} {oy + ty:.3f} 0" printable="1"/>')
        first = SLOT.get(parts[0][0], 1)
        extra = ''.join(f'<metadata key="{k}" value="{escape(str(v))}"/>' for k, v in (obj_cfg or {}).get(gname, {}).items())
        settings.append(f'<object id="{rid}"><metadata key="name" value="{escape(gname)}"/><metadata key="extruder" value="{first}"/>{extra}'
                        f'<metadata face_count="{sum(len(tr) for _, (_, tr) in parts)}"/>{"".join(parts_cfg)}</object>')
        plate.append(f'<plate><metadata key="plater_id" value="{gi + 1}"/><metadata key="plater_name" value="{escape(gname)}"/><metadata key="locked" value="false"/>'
                     f'<model_instance><metadata key="object_id" value="{rid}"/><metadata key="instance_id" value="0"/><metadata key="identify_id" value="{100 + gi}"/></model_instance></plate>')
    root = (f'<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" {NS}>'
            f'<metadata name="Application">{BAMBU_APP}</metadata><metadata name="BambuStudio:3mfVersion">1</metadata>'
            f'<metadata name="Title">Surftober 2026 spinner</metadata><metadata name="CreationDate">{time.strftime("%Y-%m-%d")}</metadata>'
            f'<resources>{"".join(root_objs)}</resources><build p:UUID="{U()}">{"".join(items)}</build></model>')
    cfg = ('<?xml version="1.0" encoding="UTF-8"?>\n<config>' + ''.join(settings) +
           ''.join(plate) + '</config>')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
                   '<Default Extension="png" ContentType="image/png"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
        z.writestr('3D/3dmodel.model', root)
        z.writestr('3D/_rels/3dmodel.model.rels', '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ''.join(rels) + '</Relationships>')
        for name, body in files.items():
            z.writestr(name, body)
        z.writestr('Metadata/model_settings.config', cfg)
        rng = [(gi, r) for gi, (gname, _, _) in enumerate(groups) for r in (ranges or {}).get(gname, [])]
        if rng:     # objects are numbered 1… in load order (= groups order)
            z.writestr('Metadata/layer_config_ranges.xml', '<?xml version="1.0" encoding="utf-8"?>\n<objects>\n' + ''.join(
                f' <object id="{gi + 1}">\n  <range min_z="{z0:g}" max_z="{z1:g}">\n   <option opt_key="extruder">0</option>\n'
                + ''.join(f'   <option opt_key="{k}">{v}</option>\n' for k, v in opts.items()) + '  </range>\n </object>\n'
                for gi, (z0, z1, opts) in rng) + '</objects>\n')
        ps = json.load(open(os.path.join(HERE, 'bambu-x1c-project.json')))
        if nozzle in BAMBU_NOZZLE:
            ps = bambu_nozzle_settings(ps, nozzle)
        ps['filament_colour'] = [c for _, c in FIL]
        ps.update(BAMBU_PROCESS)
        ps['curr_bed_type'] = BAMBU_BED_TYPE
        diff = ps.get('different_settings_to_system') or ['']     # [process, filament 1…n, printer]: shows the process as edited
        diff[0] = ';'.join(sorted(set(filter(None, diff[0].split(';'))) | set(BAMBU_PROCESS)))
        ps['different_settings_to_system'] = diff
        z.writestr('Metadata/project_settings.config', json.dumps(ps, indent=4, ensure_ascii=False))


def hex_color(h):
    return cq.Color(int(h[1:3], 16) / 255, int(h[3:5], 16) / 255, int(h[5:7], 16) / 255)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for k in ('version', 'name', 'tier', 'wave', 'art', 'text', 'seat', 'grip', 'magnet', 'screw', 'nozzle', 'ring', 'body', 'still', 'cap', 'back', 'textsize', 'centre', 'weight', 'bezel', 'parts', 'preset'):
        ap.add_argument(f'--{k}')
    ap.add_argument('--arms', type=int); ap.add_argument('--frames', type=int); ap.add_argument('--copies', type=int, help='insert rings per plate in the insert project (ring=insert)'); ap.add_argument('--hours', type=int, help='centre=hours: the number (0 = the tier’s hours)')
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
    for k in ('preset', 'version', 'name', 'tier', 'arms', 'wave', 'frames', 'art', 'text', 'seat', 'grip', 'magnet', 'screw', 'nozzle', 'ring', 'copies', 'body', 'still', 'cap', 'back', 'textsize', 'centre', 'hours', 'weight', 'bezel', 'parts'):
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
        unit = 'back cap' if pid == 'back-cap' else 'front hub' if pid in ('hub', 'hub-text') else 'art insert' if pid == 'insert' else 'spinning piece'
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
        spots = {'spinning piece': (0, 0), 'front hub': (D['ringOut'] + D['hubR'] + 8, 0), 'back cap': (D['ringOut'] + D['hubR'] + 8, D['hubR'] + D['capR'] + 8), 'art insert': (0, -(2 * D['ringOut'] + 8))}
        if 'spinning piece' not in groups:
            spots = {'front hub': (0, 0), 'back cap': (0, D['hubR'] + D['capR'] + 8), 'art insert': (D['hubR'] + D['ringOut'] + 8, 0)}
        write_3mf(os.path.join(a.out, f'{tag}.3mf'), [(g, [(pid, color, mesh(posed)) for pid, color, posed in parts], spots[g]) for g, parts in groups.items()])
        manifest['files']['3mf'] = f'{tag}.3mf'
        print(f'3mf       → {tag}.3mf ({len(groups)} object(s), {len(built)} part(s))')

        # Bambu Studio project, pre-coloured: the same print units, one per X1C plate, each part on its own
        # filament slot (BAMBU_SLOT). art=raised splits the body into the plain body + its two relief layers.
        bed = {g: (BAMBU_BED / 2, BAMBU_BED / 2) for g in groups}             # each print unit centred on its own plate
        bam, n_bam, vol = [], 0, {}
        if 'art insert' in groups:
            # the insert: its own project file at the chosen nozzle, `copies` rings on one plate, each split
            # into bare ring + water + foam for the AMS; the body / hub / cap project below stays at 0.4
            n_cop = int(o.get('copies') or 1)
            R = D['ringOut'] + 4
            offs = [(0, 0)] if n_cop == 1 else [(-R, 0), (R, 0)] if n_cop == 2 else [(-R, R), (R, R), (-R, -R), (R, -R)][:n_cop]
            base = sp.insert(relief=False)
            dz = -base.val().BoundingBox().zmin
            plist = []
            for ci, (ox, oy) in enumerate(offs):
                for qid, x in [('insert', base)] + sp.relief_parts():
                    x = x.translate((ox, oy, dz)); vol[f'{qid}{ci + 1 if n_cop > 1 else ""}'] = x.val().Volume()
                    plist.append((qid, mesh(x)))
            fn = f'{tag}-insert-bambu.3mf'
            write_bambu_3mf(os.path.join(a.out, fn), [(f'art insert ×{n_cop}', plist, (BAMBU_BED / 2, BAMBU_BED / 2))], nozzle=o.get('nozzle', '0.4'),
                            slot1=(f"{cfg['tier']['key']} (tier)", cfg['tier']['color']))
            manifest['files']['insert_bambu_3mf'] = fn
            print(f'bambu 3mf → {fn} ({n_cop} insert(s) on one plate, nozzle {o.get("nozzle", "0.4")}; slots 1 ring colour, 2 navy, 3 cream)')
            groups = {g: p for g, p in groups.items() if g != 'art insert'}
        for g, parts in groups.items():
            plist = []
            for pid, color, posed in parts:
                if pid == 'body' and o['art'] == 'raised' and o['ring'] != 'insert':
                    base = sp.body(relief=False)
                    dz = -base.val().BoundingBox().zmin                    # the body prints as mounted (no flip)
                    for qid, x in [('body', base)] + sp.relief_parts():
                        x = x.translate((0, 0, dz)); vol[qid] = x.val().Volume()
                        plist.append((qid, mesh(x)))
                else:
                    plist.append((pid, mesh(posed)))
            n_bam += len(plist)
            bam.append((g, plist, bed[g]))
        if bam:
            body_meta = next((m for m in cfg['generate'] if m['id'] == 'body'), None)
            # still=tier: the front hub and back cap both go on slot 4, loaded with the tier colour; else slot 4 is the cap colour
            tier_still = o.get('still') == 'tier'
            slots = {**BAMBU_SLOT, 'hub': 4, 'hub-text': 2} if tier_still else BAMBU_SLOT    # tier hub → navy text
            slot4 = (f"{cfg['tier']['key']} (tier)", cfg['tier']['color']) if tier_still else (o.get('cap', 'orange'), next((m['color'] for m in cfg['generate'] if m['id'] == 'back-cap'), '#FF6B35'))
            # front hub + back cap: 6 walls; the hub has 1 wall over its face-down text layers (its first textDepth mm on the plate)
            hub_cfg = {g: {'wall_loops': BAMBU_STILL_WALLS} for g in ('front hub', 'back cap') if g in groups}
            hub_rng = {'front hub': [(0, D['textDepth'], {'layer_height': 0.2, 'wall_loops': BAMBU_TEXT_WALLS})]} if 'front hub' in groups and o['text'] != 'raised' else {}
            write_bambu_3mf(os.path.join(a.out, f'{tag}-bambu.3mf'), bam, nozzle='0.4' if o['ring'] == 'insert' else o.get('nozzle', '0.4'),
                            slot1=(body_meta['filament'], body_meta['color']) if body_meta else None, slot4=slot4, slots=slots, obj_cfg=hub_cfg, ranges=hub_rng)
            manifest['files']['bambu_3mf'] = f'{tag}-bambu.3mf'
            used = sorted({slots.get(pid, 1) for _, pl, _ in bam for pid, _ in pl})
            names = {1: body_meta['filament'] if body_meta else 'body', 2: 'navy', 3: 'cream', 4: slot4[0]}
            print(f'bambu 3mf → {tag}-bambu.3mf ({len(bam)} object(s), {n_bam} part(s); slots ' +
                  ', '.join(f'{k} {names[k]}' for k in used) + (' — 0.4 nozzle' if o['ring'] == 'insert' else '') + ')')
        if vol:
            print('  split   ' + ', '.join(f'{k} {v:.0f}' for k, v in vol.items()) + f' mm³ = {sum(vol.values()):.0f} (body {built["body"][0].val().Volume():.0f})')

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
        for pid, color in (('bearing', '#d0d4d8'), ('screw', '#9aa0a6'), ('magnet', '#333333'), ('weight', cfg['tier']['color'])):
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
