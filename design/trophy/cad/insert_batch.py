#!/usr/bin/env python
"""A plate of art inserts, one per animation — one Bambu Studio project, full colour, to compare waves side by side.

    .venv/bin/python insert_batch.py throwcurtain3a throwcurl3fulloffshore ploverfish
    .venv/bin/python insert_batch.py ploverschool ploverfish --url "preset=v9&tier=silver"
    .venv/bin/python insert_batch.py throwcurl4 throwcurl4 throwcurl4 throwcurl4      # a production plate: 4 of one

Each insert is the preset's art ring (default preset v9thin: the 0.5 base, 5 layers at 0.1) split into ring + navy
water + cream foam on AMS slots 1 (tier colour), 2, 3, at the preset's nozzle (0.2 for v9/v9thin). Up to 5 per plate,
laid out like Chase's hand-made plate 4 ("v9 - animation.3mf", 2026-11-13), prime tower where he put it, above the middle.
"""
import argparse, os, time
from urllib.parse import parse_qsl, urlencode
import spinner as S

# insert centres in plate mm, from Chase's 5-up plate 4: 3 = the first three (a triangle), 4–5 add the right column top
SPOTS = [(52.3, 71.9), (200.6, 74.0), (125.8, 141.5), (52.5, 207.9), (204.8, 204.8)]
TOWER = (110, 204)      # the prime tower's corner, where Chase put it on plate 4: in the gap above the middle insert, between spots 4 and 5


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('waves', nargs='+')
    ap.add_argument('--url', default='preset=v9thin', help='base options (the wave comes from the list)')
    ap.add_argument('--out', default=os.path.join(S.HERE, 'out'))
    ap.add_argument('--name', help='output file name (default <version>-inserts-<waves>-bambu.3mf)')
    a = ap.parse_args()
    if len(a.waves) > len(SPOTS):
        raise SystemExit(f'at most {len(SPOTS)} inserts fit one plate')
    base_q = dict(parse_qsl(a.url))
    t0 = time.time()
    groups, cfg = [], None
    for i, w in enumerate(a.waves):
        cfg = S.bridge(urlencode({**base_q, 'wave': w, 'ring': 'insert', 'parts': 'insert'}))
        if cfg['options']['wave'] != w:
            raise SystemExit(f'unknown wave {w!r}')
        sp = S.Spinner(cfg)
        ring = sp.insert(relief=False)
        dz = -ring.val().BoundingBox().zmin
        parts = [(pid, S.mesh(x.translate((0, 0, dz)))) for pid, x in [('insert', ring)] + sp.relief_parts()]
        groups.append((f"insert {w}" + (f" {a.waves[:i + 1].count(w)}" if a.waves.count(w) > 1 else ''), parts, SPOTS[i]))
        print(f"  {w:<24} {cfg['wave']['label']}  ({cfg['wave']['N']} frames, base {cfg['dim']['insertT']} mm)")
    o = cfg['options']
    tagw = f'{a.waves[0]}x{len(a.waves)}' if len(set(a.waves)) == 1 and len(a.waves) > 1 else '-'.join(a.waves)   # 4 of one: <wave>x4
    fn = a.name or f"{o['version']}-inserts-{tagw}{'-base' + o['base'].replace('.', '') if o.get('base', '1.0') != '1.0' else ''}-bambu.3mf"
    S.write_bambu_3mf(os.path.join(a.out, fn), groups, nozzle=o.get('nozzle', '0.4'),
                      slot1=(f"{cfg['tier']['key']} (tier)", cfg['tier']['color']), plate_of=[0] * len(groups), tower=TOWER)
    print(f'bambu 3mf → {fn} ({len(groups)} inserts on one plate, nozzle {o.get("nozzle", "0.4")}; slots 1 {cfg["tier"]["key"]}, 2 navy, 3 cream)  ({time.time() - t0:.0f} s)')


if __name__ == '__main__':
    main()
