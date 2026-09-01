// Surftober build step — content-hashed assets, zero dependencies.
//
// Vercel runs this (buildCommand in vercel.json, cwd = docs/) and deploys
// dist/. It replaces the old manual cache ritual (bump ?v= in three HTML
// files + sw.js ASSETS + the CACHE name on every asset change — the
// project's most error-prone step, done by hand ~95 times):
//
//   1. every asset in HASHED gets a content-hashed filename
//      (app.js -> app.3f2a9c1b.js), so its URL changes exactly when its
//      bytes do — never forgotten, never spurious;
//   2. references in the HTML files and sw.js are rewritten to match;
//   3. sw.js's CACHE sentinel ('surftober-src') becomes 'surftober-<hash>'
//      derived from ALL precached content, so every deploy activates a
//      fresh cache and cleans up the old one;
//   4. hashed URLs are safe for far-future immutable caching (vercel.json
//      serves them with max-age=31536000).
//
// The SOURCE files keep plain names on purpose: served raw (localhost dev,
// the GitHub Pages fallback) everything still works — just without
// automatic cache busting, which those contexts don't need.
//
// Self-checks at the bottom fail the build loudly. A failed Vercel build
// leaves the previous production deployment live, so the worst case of a
// builder bug is "deploy didn't happen", never "site broke".

import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(SRC, 'dist');

// Hashed: everything cacheable-forever. Order matters only for the
// manifest, which references the two icons — it is rewritten before ITS
// hash is computed, so an icon change ripples into a new manifest URL.
const HASHED = ['styles.css', 'awards.js', 'photo-kit.js', 'app.js', 'logo.svg', 'icon-maskable.svg'];
const MANIFEST = 'manifest.webmanifest';
// Rewritten in place (stable names, network-first at runtime).
const REWRITTEN = ['index.html', 'register.html', 'landing.html', 'sw.js'];
// Deliberately NOT hashed: version.js (the human-readable deploy marker —
// network-first by design) and sw.js (its registration URL must be stable).
// Never shipped in the static output: this script, vercel.json (Vercel
// reads config from the source root), api/ (compiled as functions from the
// source root, independent of outputDirectory), CNAME (GitHub Pages
// fallback only), and dist itself.
const EXCLUDE = new Set(['dist', 'build.mjs', 'vercel.json', 'api', 'CNAME', '.DS_Store']);

// The FULL declaration, not just the string: sw.js's explanatory comment
// also contains 'surftober-src', and replacing the bare string swapped the
// comment's copy while leaving the real declaration untouched (caught in
// browser verification — the cache installed under the sentinel name).
const CACHE_SENTINEL = "const CACHE = 'surftober-src';";

const sha8 = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 8);
const hashedName = (name, buf) => {
  const dot = name.lastIndexOf('.');
  return `${name.slice(0, dot)}.${sha8(buf)}${name.slice(dot)}`;
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);

// 1) Verbatim copies: whatever isn't hashed, rewritten, or excluded
//    (today: version.js; future additions ship automatically).
const special = new Set([...HASHED, MANIFEST, ...REWRITTEN]);
for (const entry of readdirSync(SRC)) {
  if (EXCLUDE.has(entry) || special.has(entry)) continue;
  cpSync(path.join(SRC, entry), path.join(OUT, entry), { recursive: true });
}

// 2) Hash the leaf assets.
const map = new Map(); // './app.js' -> './app.3f2a9c1b.js'
const hashedBufs = [];
for (const name of HASHED) {
  const buf = readFileSync(path.join(SRC, name));
  const out = hashedName(name, buf);
  writeFileSync(path.join(OUT, out), buf);
  map.set(`./${name}`, `./${out}`);
  hashedBufs.push(buf);
}

const applyMap = (text) => {
  for (const [from, to] of map) text = text.replaceAll(from, to);
  return text;
};

// 3) Manifest: rewrite its icon references, then hash the RESULT.
{
  const rewritten = applyMap(readFileSync(path.join(SRC, MANIFEST), 'utf8'));
  const buf = Buffer.from(rewritten);
  const out = hashedName(MANIFEST, buf);
  writeFileSync(path.join(OUT, out), buf);
  map.set(`./${MANIFEST}`, `./${out}`);
  hashedBufs.push(buf);
}

// 4) Cache name covers ALL precached content: the hashed assets plus the
//    network-first files the SW also precaches for offline (HTML pages,
//    version.js). version.js is bumped every deploy, so in practice each
//    deploy gets a fresh cache and the activate handler drops the old one.
const htmlBufs = ['index.html', 'register.html', 'landing.html']
  .map((f) => Buffer.from(applyMap(readFileSync(path.join(SRC, f), 'utf8'))));
const versionBuf = readFileSync(path.join(SRC, 'version.js'));
const cacheName = `surftober-${sha8(Buffer.concat([...hashedBufs, ...htmlBufs, versionBuf]))}`;

// 5) Rewrite the HTML files and sw.js.
for (const name of REWRITTEN) {
  let text = applyMap(readFileSync(path.join(SRC, name), 'utf8'));
  if (name === 'sw.js') {
    if (!text.includes(CACHE_SENTINEL)) {
      console.error(`build.mjs: sw.js no longer contains the sentinel declaration ${CACHE_SENTINEL}`);
      process.exit(1);
    }
    text = text.replace(CACHE_SENTINEL, `const CACHE = '${cacheName}';`);
  }
  writeFileSync(path.join(OUT, name), text);
}

// ---- self-checks: fail the deploy rather than ship broken references ----
let failed = false;
const fail = (msg) => { console.error('build.mjs CHECK FAILED: ' + msg); failed = true; };

// (a) no output file may still reference a plain (unhashed) asset name
for (const name of [...REWRITTEN, ...[...map.values()].filter((v) => v.endsWith('.webmanifest'))]) {
  const text = readFileSync(path.join(OUT, path.basename(name)), 'utf8');
  for (const from of map.keys()) {
    if (text.includes(from)) fail(`${name} still references ${from}`);
  }
}
// (b) every ASSETS entry in the built sw.js must exist in dist
const swText = readFileSync(path.join(OUT, 'sw.js'), 'utf8');
const assets = [...swText.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1]).filter((a) => a !== './');
for (const a of assets) {
  if (!existsSync(path.join(OUT, a.slice(2)))) fail(`sw.js precaches ${a} but it is not in dist/`);
}
// (c) the cache name was injected INTO THE DECLARATION (a hash merely
// appearing somewhere in the file is not enough — see the sentinel note)
if (!swText.includes(`const CACHE = '${cacheName}';`)) fail('sw.js cache declaration was not rewritten');
if (swText.includes(CACHE_SENTINEL)) fail('sw.js still declares the sentinel cache name');
if (failed) process.exit(1);

const files = readdirSync(OUT).filter((f) => statSync(path.join(OUT, f)).isFile());
console.log(`build.mjs: ${cacheName} · ${files.length} files\n  ` + files.sort().join('\n  '));
