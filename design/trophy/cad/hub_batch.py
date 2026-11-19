#!/usr/bin/env python
"""A plate of front hubs, one per person — one Bambu Studio project.

    .venv/bin/python hub_batch.py out/roster-participant.json
    .venv/bin/python hub_batch.py roster.json --url "preset=v9&tier=participant"
    .venv/bin/python hub_batch.py out/roster-gold.json --names NAME1,NAME2 --nozzle 0.2     # a few people, fine nozzle

roster.json: {"tier": "participant", "people": [{"name": "FIRSTNAME", "hours": 15}, …]}   (keep it in out/, which is gitignored)

Each hub is the preset's front hub (default preset v10, the same hub as v9: tier-colour hub, flush navy text on 2 layers, "X HOURS!" stacked
in the centre) with that person's name and hours. All the hubs share one plate, so the navy text — only in the first
two layers — costs 2 filament swaps for the whole plate, not 2 per hub. Every hub keeps the baked hub settings
(6 walls, 1 over the text layers, 100% infill, textured PEI). Hubs go on a 4 × 4 grid, 58 mm pitch, less the spot on
the prime tower in the back-left corner: 15 to a plate; more people spill onto further plates.
"""
import argparse, json, os, sys, time
from urllib.parse import parse_qsl, urlencode
import spinner as S

PITCH, COLS, ROWS = 58.0, 4, 4
X0, Y0 = 45.0, 40.0          # first hub centre, clear of the X1C exclusion area (front-left 18 × 28); the last row ends at y 239.5
TOWER = (15 - 3, 220 - 3, 15 + 35 + 3, 220 + 35 + 3)    # prime tower (wipe_tower_x/y, 35 wide, 3 mm brim) in plate mm
HUB_R, CLEAR = 25.5, 2.0
# grid spots row by row, skipping any a hub would overlap the prime tower: 15 a plate (the first 12 are the old 4 × 3 grid)
SPOTS = [(x, y) for r in range(ROWS) for c in range(COLS) for x, y in [(X0 + c * PITCH, Y0 + r * PITCH)]
         if not (x + HUB_R + CLEAR > TOWER[0] and x - HUB_R - CLEAR < TOWER[2] and y + HUB_R + CLEAR > TOWER[1] and y - HUB_R - CLEAR < TOWER[3])]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('roster')
    ap.add_argument('--url', default='preset=v10', help='base options (the name, hours and tier come from the roster)')
    ap.add_argument('--out', default=os.path.join(S.HERE, 'out'))
    ap.add_argument('--names', help='comma list: only these people from the roster')
    ap.add_argument('--nozzle', choices=['0.4', '0.2'], default='0.4', help='0.2 = 0.1 mm layers, the text layers too')
    ap.add_argument('--stl', action='store_true', help='also write each hub + text as STLs')
    a = ap.parse_args()
    roster = json.load(open(a.roster))
    tier, people = roster.get('tier', 'participant'), roster['people']
    if a.names:
        want = [n.strip().upper() for n in a.names.split(',') if n.strip()]
        people = [p for p in people if p['name'].upper() in want]
        missing = set(want) - {p['name'].upper() for p in people}
        if missing:
            raise SystemExit(f"not in {a.roster}: {', '.join(sorted(missing))}")
    layer = 0.1 if a.nozzle == '0.2' else 0.2
    base = dict(parse_qsl(a.url))
    t0 = time.time()

    groups, cfg_by, rng_by, plate_of, tag = [], {}, {}, [], None
    for i, p in enumerate(people):
        q = {**base, 'tier': tier, 'name': p['name'], 'centre': base.get('centre', 'hours'), 'hours': str(int(p['hours'])), 'parts': 'hub,hub-text'}
        cfg = S.bridge(urlencode(q))
        o, D = cfg['options'], cfg['dim']
        sp = S.Spinner(cfg)
        parts = []
        for meta in cfg['generate']:
            wp = sp.build(meta['id'])
            if wp is None:
                continue
            posed = S.to_print_pose(wp, meta['print'])
            parts.append((meta['id'], S.mesh(posed)))
            if a.stl:
                S.cq.exporters.export(posed, os.path.join(a.out, f"{cfg['tag']}-{meta['id']}.stl"), tolerance=0.01, angularTolerance=0.05)
        gname = f"hub {o['name'].upper()} {o['hours']}h"
        groups.append((gname, parts, SPOTS[i % len(SPOTS)]))
        plate_of.append(i // len(SPOTS))
        cfg_by[gname] = {'wall_loops': S.BAMBU_STILL_WALLS}
        if o['text'] != 'raised':
            rng_by[gname] = [(0, D['textDepth'], {'layer_height': layer, 'wall_loops': S.BAMBU_TEXT_WALLS})]
        print(f"  {o['name'].upper():<12} {o['hours']:>3} HOURS!   {sp.notes.get('hub-text', '')}")
        tag = tag or cfg['tag']
        tier_cfg = cfg['tier']

    ver = base.get('version') or cfg['options']['version']
    who = '-' + '-'.join(p['name'].lower() for p in people) if a.names else ''     # out/ is gitignored
    fn = f"{ver}-hubs-{tier}{who}-x{len(people)}{'-n02' if a.nozzle == '0.2' else ''}-bambu.3mf"
    slots = {**S.BAMBU_SLOT, 'hub': 4, 'hub-text': 2}         # tier hub on slot 4, navy text on slot 2
    S.write_bambu_3mf(os.path.join(a.out, fn), groups, nozzle=a.nozzle, slot4=(f"{tier_cfg['key']} (tier)", tier_cfg['color']),
                      slots=slots, obj_cfg=cfg_by, ranges=rng_by, plate_of=plate_of)
    print(f'bambu 3mf → {fn} ({len(groups)} hubs on {max(plate_of) + 1} plate(s), nozzle {a.nozzle}; slots 2 navy, 4 {tier_cfg["key"]} {tier_cfg["color"]})  ({time.time() - t0:.0f} s)')


if __name__ == '__main__':
    main()
