#!/bin/sh
# One-time setup for the trophy CAD generator: a Python venv with CadQuery.
# Needs Homebrew python3.12 (CadQuery ships wheels for 3.10–3.12) and node (for the wave polygons).
set -e
cd "$(dirname "$0")"
PY=${PY:-/opt/homebrew/bin/python3.12}
[ -x .venv/bin/python ] || "$PY" -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q cadquery
.venv/bin/python -c "import cadquery as cq; print('cadquery', cq.__version__, 'ready')"
echo "now: .venv/bin/python spinner.py --name NAHLA   (see --help)"
