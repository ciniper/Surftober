#!/usr/bin/env python
"""Local dev server for the trophy previews, with a generate button.

Serves ../ (design/trophy: viewer, wave demo, cad/out) like `python -m http.server`
and adds two JSON endpoints the viewer uses:

    GET  /api/outputs            manifests of everything in cad/out/
    POST /api/generate  {query}  run spinner.py for a query string of options; returns its manifest + log

Run from anywhere:  design/trophy/cad/.venv/bin/python design/trophy/cad/serve.py [port]
Default port 8930. Binds to 127.0.0.1 only; option values are validated by
spinner-config.js before anything runs, and nothing is passed through a shell.
"""
import json, os, subprocess, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qsl, urlencode

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'out')
PY = sys.executable
ALLOWED = {'preset', 'name', 'tier', 'arms', 'wave', 'frames', 'art', 'text', 'weight', 'bezel', 'parts'}
lock = threading.Lock()


def manifests():
    items = []
    if os.path.isdir(OUT):
        for fn in sorted(os.listdir(OUT)):
            if fn.endswith('.json'):
                try:
                    with open(os.path.join(OUT, fn)) as f:
                        items.append(json.load(f))
                except Exception:
                    pass
    return items


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        if '/api/' in (args[0] if args else ''):
            super().log_message(fmt, *args)

    def send_json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split('?')[0] == '/api/outputs':
            return self.send_json(200, {'outputs': manifests()})
        if self.path.startswith('/cad/out/'):
            self.protocol_version = 'HTTP/1.1'
        return super().do_GET()

    def end_headers(self):
        if self.path.startswith('/cad/out/') or self.path.endswith(('.js', '.html')):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        if self.path.split('?')[0] != '/api/generate':
            return self.send_json(404, {'error': 'unknown endpoint'})
        n = int(self.headers.get('Content-Length', 0))
        try:
            req = json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return self.send_json(400, {'error': 'bad json'})
        q = {k: str(v)[:64] for k, v in parse_qsl(req.get('query', '')) if k in ALLOWED}
        args = [PY, os.path.join(HERE, 'spinner.py'), '--url', urlencode(q)]
        if req.get('combined'):
            args.append('--combined')
        if not lock.acquire(blocking=False):
            return self.send_json(409, {'error': 'a generation is already running'})
        try:
            r = subprocess.run(args, capture_output=True, text=True, timeout=600, cwd=HERE)
        except subprocess.TimeoutExpired:
            return self.send_json(504, {'error': 'generator timed out'})
        finally:
            lock.release()
        log = (r.stdout + ('\n' + r.stderr if r.stderr.strip() else '')).replace(HERE + '/', '')
        log = '\n'.join(l for l in log.splitlines() if 'FutureWarning' not in l and 'warn(' not in l)
        if r.returncode:
            return self.send_json(500, {'error': 'generator failed', 'log': log})
        tag = next((l.split()[0] for l in r.stdout.splitlines() if ' — ' in l), None)
        man = None
        if tag and os.path.exists(os.path.join(OUT, f'{tag}.json')):
            with open(os.path.join(OUT, f'{tag}.json')) as f:
                man = json.load(f)
        return self.send_json(200, {'manifest': man, 'log': log})


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8930
    os.makedirs(OUT, exist_ok=True)
    print(f'trophy previews: http://localhost:{port}/   (generator API on /api/generate)')
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
