#!/usr/bin/env python
"""Surftober 2026 trophy — spinner CAD generator (CadQuery / OpenCascade).

Generates real solids (not the three.js preview meshes) for the fully printed
ring-on-arms spinner, matching the dimensions in mockups.html (SP):

  body        one printed piece: hub pressed onto the 608's outer race, N arms,
              wave ring at the rim; flush 0.6 mm pockets for the wave artwork
  wave-water  the navy water inlays (fill the pockets flush)
  wave-foam   the cream foam inlays
  hub         still front hub on the inner race, text pockets
  hub-text    "SURFTOBER 2026" over the top, the name along the bottom (inlays)
  back-cap    printed stand-in for the magnet cap (stem, spacer, Ø10×2 pocket)

Options add a bezel groove for a bought metal ring (round wire, or a flat
laser-cut ring + its DXF for SendCutSend) or a boss for a bike cog.

usage (from design/trophy/cad, after `./setup.sh`):
  .venv/bin/python spinner.py --name NAHLA --arms 3 --wave return
  .venv/bin/python spinner.py --weight bezel --bezel flat --name KAI
  .venv/bin/python spinner.py --weight cog --arms 4 --no-stl   # STEP only
  .venv/bin/python spinner.py --only ring --wave return        # just the wave ring + inlays (test print)
  .venv/bin/python spinner.py --parts hub,hub-text --name KAI   # any subset of the parts

Everything lands in ./out/ as STL (one per print colour, print orientation),
plus spinner.step — a coloured assembly of all parts in their mounted positions.
Load the STLs together in Bambu Studio and answer "yes" to "load as a single
object with multiple parts", then assign a filament per part.
"""
import argparse, json, math, os, subprocess, sys, time
import cadquery as cq

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'

# ---- dimensions (mm) — keep in step with SP in mockups.html -------------------
P = dict(
    t=7.0,                 # body thickness = 608 width
    bore=21.9,             # press fit on the 608's Ø22 outer race (tune: 21.8 tight … 22.0 loose)
    hub_out=16.0,          # printed hub radius around the bearing
    arm_w=9.0,
    ring_in=27.5, ring_out=40.0,
    wave_in=30.6, wave_out=39.4,
    inlay=0.6,             # flush artwork / text depth
    # still front hub (rides the inner race)
    hub_r=25.5, hub_t=2.4, standoff=0.6,
    stem_d=8.1, stem_len=3.3,  # into the 8 mm bore of the inner race (tune 8.0 … 8.2)
    spacer_r=5.5,              # lands on the inner race only (r 4 – 6.05)
    text_size=4.6, text_track=0.12,
    # back cap (printed stand-in for the anodized one)
    cap_r=9.0, cap_t=3.0, cap_spacer=0.8, mag_d=10.2, mag_depth=2.1,
    # bought weights
    bezel_wire=3.5, bezel_proud=0.6,                  # round craft ring Ø(2·ring_out) × 3.5 wire
    flat_od=80.0, flat_id=73.0, flat_t=3.18, flat_clear=0.15,  # SendCutSend ring, 0.125" brass/stainless/copper
    cog_bore=34.8, cog_t=2.3,                         # 1.37" × 24 tpi track-cog thread, minor Ø
)
PLA = 1.24e-3  # g/mm³


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
    if not solids:
        return None
    return cq.Workplane('XY').add(solids).combine()


def wave_polys(variant, frames, r_in, r_out):
    out = subprocess.run(['node', os.path.join(HERE, 'wave-polys.mjs'), variant, str(frames), str(r_in), str(r_out)],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def arc_text(text, r, size, depth, z0, top):
    """Glyphs placed around a circle like arcText() in mockups.html — upright, left→right."""
    glyphs = []
    for ch in text:
        if ch == ' ':
            glyphs.append((None, size * 0.5))
            continue
        g = cq.Workplane('XY').text(ch, size, depth, fontPath=FONT, halign='center', valign='center')
        bb = g.val().BoundingBox()
        g = g.translate((-(bb.xmin + bb.xmax) / 2, -(bb.ymin + bb.ymax) / 2, 0))
        glyphs.append((g, bb.xlen + size * 0.12))
    total = sum(w for _, w in glyphs) - size * 0.12
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


def build(a):
    t, inl = P['t'], P['inlay']
    report = {}

    # ---- body: hub ring + arms + rim (or just the rim with --only ring) ------
    if a.only == 'ring':
        t = a.ring_t or t
        body = cyl(P['ring_out'], 0, t, P['ring_in'])
    else:
        body = cyl(P['hub_out'], 0, t, P['bore'] / 2)
        arm_len = P['ring_in'] - P['hub_out'] + 1.5
        mid = (P['hub_out'] + P['ring_in']) / 2
        for i in range(a.arms):
            ang = 90 + i * 360 / a.arms
            arm = (cq.Workplane('XY').box(arm_len, P['arm_w'], t, centered=(True, True, False))
                   .translate((mid, 0, 0)).rotate((0, 0, 0), (0, 0, 1), ang))
            body = body.union(arm)
        body = body.union(cyl(P['ring_out'], 0, t, P['ring_in']))

    # ---- wave artwork: flush inlays in the front face ----------------------
    art = wave_polys(a.wave, a.frames, P['wave_in'], P['wave_out'])
    water = polys_to_solid(art['water'], t - inl, inl, 'water')
    foam = polys_to_solid(art['foam'], t - inl, inl, 'foam')
    if water is not None:
        body = body.cut(water)
        if foam is not None:
            water = water.cut(foam)
    if foam is not None:
        body = body.cut(foam)

    # ---- bought weight -----------------------------------------------------
    extras = {}
    if a.weight == 'bezel' and a.bezel == 'round':
        wr = P['bezel_wire'] / 2
        R = P['ring_out'] - wr + P['bezel_proud']
        groove = cq.Workplane('XY').add(cq.Solid.makeTorus(R, wr + 0.1, cq.Vector(0, 0, t / 2), cq.Vector(0, 0, 1)))
        body = body.cut(groove)
        extras['metal-ring-round'] = cq.Workplane('XY').add(cq.Solid.makeTorus(R, wr, cq.Vector(0, 0, t / 2), cq.Vector(0, 0, 1)))
    elif a.weight == 'bezel':
        ring_w = (P['flat_od'] - P['flat_id']) / 2                      # radial section
        proud = P['bezel_proud']
        g_in = P['ring_out'] - (ring_w - proud) - P['flat_clear']       # groove floor radius
        g_t = P['flat_t'] + P['flat_clear']
        body = body.cut(cyl(P['ring_out'] + 1, t / 2 - g_t / 2, g_t, g_in))
        ring_r_out = g_in + P['flat_clear'] + ring_w
        extras['metal-ring-flat'] = cyl(ring_r_out, t / 2 - P['flat_t'] / 2, P['flat_t'], ring_r_out - ring_w)
        report['flat ring'] = f'OD {2 * ring_r_out:.1f} × ID {2 * (ring_r_out - ring_w):.1f} × {P["flat_t"]} mm (DXF written)'
    elif a.weight == 'cog' and a.only != 'ring':
        boss = cyl(P['cog_bore'] / 2 - 0.1, -P['cog_t'], P['cog_t'], 12.0)
        body = body.union(boss)
        report['cog boss'] = f'Ø{P["cog_bore"] - 0.2:.1f} × {P["cog_t"]} mm behind the body'

    # ---- front hub + text ---------------------------------------------------
    z_disc = P['standoff']
    hub = (cyl(P['stem_d'] / 2, -P['stem_len'], P['stem_len'])
           .union(cyl(P['spacer_r'], 0, P['standoff']))
           .union(cyl(P['hub_r'], z_disc, P['hub_t'])))
    text_r = P['hub_r'] - 4.6
    z_text = z_disc + P['hub_t'] - inl
    text = arc_text('SURFTOBER 2026', text_r, P['text_size'], inl, z_text, True)
    text = text.union(arc_text(a.name.upper(), text_r, P['text_size'], inl, z_text, False))
    hub = hub.cut(text)

    # ---- back cap (printed stand-in) ---------------------------------------
    cap = (cyl(P['stem_d'] / 2, 0, P['stem_len'])
           .union(cyl(P['spacer_r'], -P['cap_spacer'], P['cap_spacer']))
           .union(cyl(P['cap_r'], -P['cap_spacer'] - P['cap_t'], P['cap_t'])))
    cap = cap.cut(cyl(P['mag_d'] / 2, -P['cap_spacer'] - P['cap_t'], P['mag_depth']))

    # ---- bearing, for the STEP only -----------------------------------------
    bearing = cyl(11, 0, t, 9.6).union(cyl(6.05, 0, t, 4.0)).union(cyl(9.6, 0.3, t - 0.6, 6.05))

    return dict(body=body, water=water, foam=foam, hub=hub, text=text, cap=cap, bearing=bearing, extras=extras, art=art, report=report, t=t)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--name', default='NAHLA')
    ap.add_argument('--arms', type=int, default=3, choices=[3, 4])
    ap.add_argument('--wave', default='return', help='classic | rolling | return | barrel | returntip | classictip')
    ap.add_argument('--frames', type=int, default=0, help='slot count; 0 = the variant default')
    ap.add_argument('--weight', default='none', choices=['none', 'bezel', 'cog'])
    ap.add_argument('--bezel', default='flat', choices=['flat', 'round'], help='flat = laser-cut ring (SendCutSend), round = craft wire ring')
    ap.add_argument('--only', default='all', choices=['all', 'ring'], help='ring = just the wave ring (r 27.5–40) with its inlays, no hub/arms/caps — a test print of the animation')
    ap.add_argument('--ring-t', type=float, default=0, help='ring thickness for --only ring (default: the body thickness, 7)')
    ap.add_argument('--parts', default='', help='comma list of parts to write, e.g. body,wave-water,wave-foam (default: all)')
    ap.add_argument('--out', default=os.path.join(HERE, 'out'))
    ap.add_argument('--no-stl', action='store_true')
    ap.add_argument('--no-step', action='store_true')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    t0 = time.time()
    m = build(a)
    t = P['t']
    tag = f"{a.name.lower()}-{a.arms}arm-{a.wave}{m['art']['N']}" + ('' if a.weight == 'none' else f"-{a.weight}" + (f"-{a.bezel}" if a.weight == 'bezel' else ''))
    if a.only == 'ring':
        tag = f"ring-{a.wave}{m['art']['N']}" + ('' if a.weight == 'none' else f"-{a.weight}" + (f"-{a.bezel}" if a.weight == 'bezel' else '')) + (f"-t{a.ring_t:g}" if a.ring_t else '')
    t = m['t']

    # print orientation: body back face down; hub text face down; cap fridge face down
    flip = lambda wp: wp.rotate((0, 0, 0), (1, 0, 0), 180)
    hub_z0 = P['standoff'] + P['hub_t']
    prints = {
        'body': m['body'], 'wave-water': m['water'], 'wave-foam': m['foam'],
        'hub': flip(m['hub']).translate((0, 0, hub_z0)), 'hub-text': flip(m['text']).translate((0, 0, hub_z0)),
        'back-cap': m['cap'].translate((0, 0, P['cap_spacer'] + P['cap_t'])),
    }
    if a.weight == 'cog' and a.only != 'ring':
        prints['body'] = prints['body'].translate((0, 0, P['cog_t']))
    if a.only == 'ring':
        prints = {k: v for k, v in prints.items() if k in ('body', 'wave-water', 'wave-foam')}
    if a.parts:
        want = {x.strip() for x in a.parts.split(',')}
        unknown = want - set(prints)
        if unknown:
            sys.exit(f'unknown part(s) {sorted(unknown)}; choose from {sorted(prints)}')
        prints = {k: v for k, v in prints.items() if k in want}

    print(f'\n{tag}  —  {m["art"]["label"]}, {m["art"]["N"]} frames, {a.arms} arms, weight: {a.weight}')
    print(f'{"part":<12}{"valid":<7}{"volume mm³":>12}{"PLA g":>8}')
    for name, wp in prints.items():
        if wp is None:
            continue
        s = wp.val()
        print(f'{name:<12}{str(s.isValid()):<7}{s.Volume():>12.0f}{s.Volume() * PLA:>8.1f}')
        if not a.no_stl:
            cq.exporters.export(wp, os.path.join(a.out, f'{tag}-{name}.stl'), tolerance=0.01, angularTolerance=0.05)
    for k, v in m['report'].items():
        print(f'  {k}: {v}')

    if a.weight == 'bezel' and a.bezel == 'flat':
        ring = m['extras']['metal-ring-flat'].val()
        bb = ring.BoundingBox()
        r_out, r_in = bb.xmax, bb.xmax - (P['flat_od'] - P['flat_id']) / 2
        cq.exporters.exportDXF(cq.Workplane('XY').circle(r_out).circle(r_in), os.path.join(a.out, f'metal-ring-flat-{2 * r_out:.1f}x{2 * r_in:.1f}.dxf'))

    if not a.no_step:
        asm = cq.Assembly(name='surftober-spinner')
        navy, cream, bone, steel, metal = (cq.Color(0.11, 0.19, 0.31), cq.Color(0.94, 0.9, 0.82), cq.Color(0.91, 0.88, 0.81),
                                           cq.Color(0.75, 0.77, 0.8), cq.Color(0.85, 0.72, 0.36))
        if 'body' in prints: asm.add(m['body'], name='body', color=bone)
        if 'wave-water' in prints and m['water'] is not None: asm.add(m['water'], name='wave-water', color=navy)
        if 'wave-foam' in prints and m['foam'] is not None: asm.add(m['foam'], name='wave-foam', color=cream)
        if 'hub' in prints: asm.add(m['hub'], name='hub', color=navy, loc=cq.Location(cq.Vector(0, 0, t)))
        if 'hub-text' in prints: asm.add(m['text'], name='hub-text', color=metal, loc=cq.Location(cq.Vector(0, 0, t)))
        if 'back-cap' in prints: asm.add(m['cap'], name='back-cap', color=cq.Color(1.0, 0.42, 0.21))
        if a.only != 'ring': asm.add(m['bearing'], name='608-bearing', color=steel)
        for k, v in m['extras'].items():
            asm.add(v, name=k, color=metal)
        asm.export(os.path.join(a.out, f'{tag}.step'))
    print(f'\nwrote {a.out}  ({time.time() - t0:.0f} s)')


if __name__ == '__main__':
    main()
