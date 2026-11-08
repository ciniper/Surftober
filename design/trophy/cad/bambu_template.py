"""Rebuild bambu-x1c-project.json, the Bambu Studio project settings that spinner.py puts in <tag>-bambu.3mf.

Bambu Studio's CLI only resolves fully expanded presets, so this expands the system profiles shipped with
the app (printer, process, filament) through their `inherits` chains, has the CLI save a one-part project
with them, and keeps that project's settings, widened to four filaments. Run it on a Mac with Bambu Studio
installed (outside any sandbox — the CLI writes a temp file next to its output):

    .venv/bin/python bambu_template.py ["Bambu Lab X1 Carbon 0.4 nozzle"] ["0.20mm Standard @BBL X1C"] ["Bambu PLA Basic @BBL X1C"]
"""
import glob, json, os, subprocess, sys, tempfile, zipfile

APP = '/Applications/BambuStudio.app/Contents'
R = f'{APP}/Resources/profiles/BBL'
HERE = os.path.dirname(os.path.abspath(__file__))
N_FIL = 4


def find(kind, name):
    p = os.path.join(R, kind, name + '.json')
    if os.path.exists(p):
        return p
    for f in glob.glob(os.path.join(R, kind, '*.json')):
        try:
            if json.load(open(f)).get('name') == name:
                return f
        except ValueError:
            pass
    sys.exit(f'no {kind} preset named {name!r} in {R}')


def flat(kind, name):
    """A preset with everything it inherits and includes: parent first, then the files it `include`s (the
    printer's start / end / filament-change G-code templates live there), then its own keys."""
    d = json.load(open(find(kind, name)))
    out = flat(kind, d['inherits']) if d.get('inherits') else {}
    for inc in d.get('include', []):
        out.update({k: v for k, v in json.load(open(find(kind, inc))).items() if k not in ('name', 'instantiation')})
    out.update({k: v for k, v in d.items() if k not in ('inherits', 'include')})
    return out


def main():
    machine, process, filament = (sys.argv[1:] + [None] * 3)[:3]
    names = [('machine', machine or 'Bambu Lab X1 Carbon 0.4 nozzle'), ('process', process or '0.20mm Standard @BBL X1C'),
             ('filament', filament or 'Bambu PLA Basic @BBL X1C')]
    stl = sorted(glob.glob(os.path.join(HERE, 'out', '*.stl')))
    if not stl:
        sys.exit('run spinner.py once first (any STL in out/ will do as the dummy part)')
    with tempfile.TemporaryDirectory() as tmp:
        paths = []
        for kind, name in names:
            d = flat(kind, name); d['name'] = name; d['from'] = 'system'
            paths.append(os.path.join(tmp, f'{kind}.json')); json.dump(d, open(paths[-1], 'w'))
        subprocess.run([f'{APP}/MacOS/BambuStudio', '--load-settings', f'{paths[0]};{paths[1]}', '--load-filaments', ';'.join([paths[2]] * N_FIL),
                        '--outputdir', tmp, '--export-3mf', 'p.3mf', stl[0]], cwd=tmp, check=True, capture_output=True)
        ps = json.loads(zipfile.ZipFile(os.path.join(tmp, 'p.3mf')).read('Metadata/project_settings.config'))
    # the CLI leaves some per-filament lists at one entry (filament_colour among them): widen them
    for k, v in ps.items():
        if isinstance(v, list) and len(v) == 1 and (k.startswith('filament_') or k in ('default_filament_colour',)):
            ps[k] = v * N_FIL
    json.dump(ps, open(os.path.join(HERE, 'bambu-x1c-project.json'), 'w'), indent=4, ensure_ascii=False)
    print('wrote bambu-x1c-project.json:', ps.get('printer_settings_id'), '·', ps.get('print_settings_id'), '·', ps.get('filament_settings_id'))


if __name__ == '__main__':
    main()
