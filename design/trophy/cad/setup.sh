#!/bin/sh
# One-time setup for the trophy CAD generator: a Python venv with CadQuery (+ shapely, to heal slit-cut holes).
# Needs Python 3.12 (CadQuery ships wheels for 3.10–3.12) and node ≥ 18 (spinner-config.js is read
# through cad/bridge.mjs). Prefers uv's standalone 3.12 (brew install uv && uv python install 3.12):
# Homebrew's python@3.12 breaks pip on macOS 26.2 (its pyexpat wants a newer /usr/lib/libexpat).
set -e
cd "$(dirname "$0")"
PY=${PY:-$(uv python find 3.12 2>/dev/null || echo /opt/homebrew/bin/python3.12)}
command -v node >/dev/null || { echo "node is required (brew install node)"; exit 1; }
[ -x .venv/bin/python ] || "$PY" -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q cadquery shapely
.venv/bin/python -c "import cadquery as cq; print('cadquery', cq.__version__, 'ready')"
echo
echo "serve + generate from the browser:  .venv/bin/python serve.py 8930   → http://localhost:8930/"
echo "or from the terminal:               .venv/bin/python spinner.py --name NAHLA   (see --help / --list)"
