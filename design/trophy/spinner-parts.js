// three.js geometry for the spinner, one builder per part in spinner-config.js.
// Mirrors cad/spinner.py: same dimensions (DIM), same part ids, same mounted
// pose (bearing z 0…t, front face at z = t). Preview geometry only — the
// generator makes the real solids.
import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { DIM, TIERS, COLORS, CAP_COLORS, PART, activeParts, frameCount } from './spinner-config.js';
import { ringArt } from './wave-frames.js';

// ---- materials --------------------------------------------------------------
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
export function materials(o) {
  const tier = TIERS[o.tier];
  // polygonOffset pushes the body faces back a hair so flush inlays drawn on the same plane win the depth test
  const flush = o.art === 'inlay' ? { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 } : {};
  return {
    body:   std(o.weight === 'none' ? tier.color : COLORS.bone, { roughness: o.weight === 'none' ? tier.rough + 0.2 : 0.75, metalness: o.weight === 'none' ? tier.metal * 0.3 : 0, ...flush }),
    water:  std(COLORS.navy, { roughness: 0.55 }),
    foam:   std(COLORS.cream),
    hub:    std(COLORS.navy, { roughness: 0.5, ...flush }),
    text:   std(tier.color, { metalness: tier.metal, roughness: tier.rough }),
    engraved: std(0x0e1829, { roughness: 0.9 }),   // the floor of a recess, drawn flush on the hub face
    cap:    std(CAP_COLORS[o.cap], { metalness: 0.65, roughness: 0.32 }),
    steel:  std(COLORS.steel, { metalness: 0.9, roughness: 0.2 }),
    shield: std(COLORS.shield, { roughness: 0.55 }),
    magnet: std(COLORS.magnet, { metalness: 0.6, roughness: 0.4 }),
    metal:  std(tier.color, { metalness: 0.85, roughness: 0.35 }),
    fridge: std(COLORS.fridge, { metalness: 0.8, roughness: 0.38 }),
  };
}

// ---- helpers ------------------------------------------------------------------
function shadow(m) { m.castShadow = true; m.receiveShadow = true; return m; }
export function zcyl(r, z0, h, mat, seg = 64) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.rotation.x = Math.PI / 2; m.position.z = z0 + h / 2; return shadow(m);
}
// Washer / disc extruded along +z from z0, optional rounded edge
export function annulus(rOut, rIn, z0, depth, mat, bevel = 0) {
  const s = new THREE.Shape(); s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  if (rIn > 0) { const h = new THREE.Path(); h.absarc(0, 0, rIn, 0, Math.PI * 2, true); s.holes.push(h); }
  const geo = new THREE.ExtrudeGeometry(s, bevel
    ? { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 2, curveSegments: 96 }
    : { depth, bevelEnabled: false, curveSegments: 96 });
  geo.translate(0, 0, z0 + (bevel || 0));
  return shadow(new THREE.Mesh(geo, mat));
}
function polySlab(poly, z0, h, mat) {
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y))), { depth: h, bevelEnabled: false }), mat);
  m.position.z = z0; return shadow(m);
}
// Text bent around a circle, upright, reading left → right (top = over the top, else along the bottom)
export function arcText(font, str, r, size, z0, depth, mat, top) {
  const g = new THREE.Group(), scale = size / font.data.resolution, track = size * DIM.textTrack, chars = [...str];
  const adv = chars.map(ch => (ch === ' ' ? size * 0.5 : (font.data.glyphs[ch] ? font.data.glyphs[ch].ha * scale : size * 0.6)) + track);
  let s = -(adv.reduce((a, b) => a + b, 0) - track) / 2;
  chars.forEach((ch, i) => {
    const mid = s + adv[i] / 2; s += adv[i];
    if (ch === ' ') return;
    const geo = new TextGeometry(ch, { font, size, height: depth, curveSegments: 4, bevelEnabled: false });
    geo.computeBoundingBox(); geo.translate(-(geo.boundingBox.min.x + geo.boundingBox.max.x) / 2, -size * 0.36, 0);
    const m = shadow(new THREE.Mesh(geo, mat));
    const th = top ? Math.PI / 2 - mid / r : -Math.PI / 2 + mid / r;
    const w = new THREE.Group(); w.add(m);
    w.position.set(r * Math.cos(th), r * Math.sin(th), z0); w.rotation.z = top ? th - Math.PI / 2 : th + Math.PI / 2;
    g.add(w);
  });
  return g;
}
function cogShape(N, rTip, rRoot, rBore) {
  const pts = [], pitch = Math.PI * 2 / N;
  for (let i = 0; i < N; i++) {
    const a = i * pitch;
    [[rRoot, 0], [rRoot, .18], [rTip, .4], [rTip, .6], [rRoot, .82]].forEach(([r, f]) => pts.push(new THREE.Vector2(r * Math.cos(a + f * pitch), r * Math.sin(a + f * pitch))));
  }
  const s = new THREE.Shape(pts), h = new THREE.Path(); h.absarc(0, 0, rBore, 0, Math.PI * 2, true); s.holes.push(h);
  return s;
}

// ---- part builders: id → Object3D in the mounted pose -------------------------
const D = DIM;
const builders = {
  body(o, M) {
    const g = new THREE.Group(), t = D.t;
    g.add(annulus(D.hubOut, D.bore / 2, 0, t, M.body, 0.4));
    const len = D.ringIn - D.hubOut + 1.5, mid = (D.hubOut + D.ringIn) / 2;
    for (let i = 0; i < o.arms; i++) {
      const a = Math.PI / 2 + i * 2 * Math.PI / o.arms, arm = shadow(new THREE.Mesh(new THREE.BoxGeometry(len, D.armW, t), M.body));
      arm.position.set(mid * Math.cos(a), mid * Math.sin(a), t / 2); arm.rotation.z = a; g.add(arm);
    }
    g.add(annulus(D.ringOut, D.ringIn, 0, t, M.body, 0.4));
    if (o.art === 'raised') {   // one-colour relief, same material as the body
      const art = waveArt(o);
      art.water.forEach(p => g.add(polySlab(p, t, D.relief, M.body)));
      art.foam.forEach(p => g.add(polySlab(p, t, D.reliefFoam, M.body)));
    }
    if (o.weight === 'cog') g.add(annulus(D.cogBore / 2 - 0.1, D.cogBossIn, -D.cogT, D.cogT, M.body));
    return g;
  },
  'wave-water'(o, M) { const g = new THREE.Group(); waveArt(o).water.forEach(p => g.add(polySlab(p, D.t - D.inlay, D.inlay, M.water))); return g; },
  'wave-foam'(o, M)  { const g = new THREE.Group(); waveArt(o).foam.forEach(p => g.add(polySlab(p, D.t - D.inlay + 0.01, D.inlay, M.foam))); return g; },
  hub(o, M, font) {
    const g = new THREE.Group(), t = D.t, zDisc = t + D.standoff;
    g.add(zcyl(D.stemD / 2, t - D.stemLen, D.stemLen, M.hub, 32));
    g.add(zcyl(D.spacerR, t, D.standoff, M.hub));
    g.add(annulus(D.hubR, 0, zDisc, D.hubT, M.hub, 0.5));
    if (font && o.text === 'raised') g.add(hubText(o, font, M.hub, zDisc + D.hubT, D.relief));
    if (font && o.text === 'recessed') g.add(hubText(o, font, M.engraved, zDisc + D.hubT - 0.02, 0.02));   // preview of the engraving; the STL has the real pocket
    return g;
  },
  'hub-text'(o, M, font) { return font ? hubText(o, font, M.text, D.t + D.standoff + D.hubT - D.inlay, D.inlay) : new THREE.Group(); },
  'back-cap'(o, M) {
    const g = new THREE.Group();
    g.add(zcyl(D.stemD / 2, 0, D.stemLen, M.cap, 32));
    g.add(zcyl(D.spacerR, -D.capSpacer, D.capSpacer, M.cap));
    const zBack = -D.capSpacer - D.capT;
    g.add(annulus(D.capR, D.magPocketD / 2, zBack, D.capT, M.cap, 0.5));                      // disc with the pocket through…
    g.add(zcyl(D.magPocketD / 2, zBack + D.magPocketDepth, D.capT - D.magPocketDepth, M.cap)); // …and its floor
    return g;
  },
  bearing(o, M) {
    const g = new THREE.Group(), b = D.bearing, t = D.t;
    g.add(annulus(b.od / 2, b.outerId / 2, 0, t, M.steel));
    g.add(annulus(b.outerId / 2, b.innerOd / 2, 0.3, t - 0.6, M.shield));
    g.add(annulus(b.innerOd / 2, b.id / 2, 0, t, M.steel));
    return g;
  },
  magnet(o, M) { return zcyl(D.magD / 2, -D.capSpacer - D.capT + (D.magPocketDepth - D.magT) + 0.05, D.magT, M.magnet); },
  weight(o, M) {
    if (o.weight === 'bezel' && o.bezel === 'round') {
      const wr = D.bezelWire / 2, m = shadow(new THREE.Mesh(new THREE.TorusGeometry(D.ringOut - wr + D.bezelProud, wr, 20, 180), M.metal));
      m.position.z = D.t / 2; return m;
    }
    if (o.weight === 'bezel') {
      const rOut = D.ringOut + D.bezelProud;
      return annulus(rOut, rOut - (D.flatOd - D.flatId) / 2, D.t / 2 - D.flatT / 2, D.flatT, M.metal, 0.3);
    }
    if (o.weight === 'cog') {
      const m = shadow(new THREE.Mesh(new THREE.ExtrudeGeometry(cogShape(D.cogTeeth, D.cogTip, D.cogRoot, D.cogBore / 2), { depth: D.cogT, bevelEnabled: false, curveSegments: 48 }), M.metal));
      m.position.z = -D.cogT; return m;
    }
    return null;
  },
};
function hubText(o, font, mat, z0, depth) {
  const g = new THREE.Group(), r = D.hubR - D.textInset;
  g.add(arcText(font, 'SURFTOBER 2026', r, D.textSize, z0, depth, mat, true));
  g.add(arcText(font, o.name.toUpperCase(), r, D.textSize, z0, depth, mat, false));
  return g;
}
let artCache = { key: null, art: null };
export function waveArt(o) {
  const key = `${o.wave}/${frameCount(o)}`;
  if (artCache.key !== key) {
    const a = ringArt({ variant: o.wave, N: frameCount(o), rIn: D.waveIn, rOut: D.waveOut });
    artCache = { key, art: { water: a.slots.flatMap(s => s.water), foam: a.slots.flatMap(s => s.foam) } };
  }
  return artCache.art;
}

// Which group a part rides in and how far it moves in the exploded view
export const POSE = {
  body: { spins: true, dz: 0 }, 'wave-water': { spins: true, dz: 10 }, 'wave-foam': { spins: true, dz: 14 },
  hub: { spins: false, dz: 30 }, 'hub-text': { spins: false, dz: 36 }, 'back-cap': { spins: false, dz: -20 },
  bearing: { spins: false, dz: 0 }, magnet: { spins: false, dz: -30 }, weight: { spins: true, dz: 0 },
};
export const WEIGHT_DZ = o => (o.weight === 'cog' ? -12 : 24);

// Build the whole spinner for options `o`. Returns { root, spin, still, parts: Map(id → Object3D) }.
// Hidden parts (o.parts) are still built, just not visible, so toggling is instant.
export function buildSpinner(o, font) {
  const M = materials(o);
  const root = new THREE.Group(), spin = new THREE.Group(), still = new THREE.Group();
  root.add(spin, still);
  const parts = new Map();
  for (const id of activeParts(o)) {
    const obj = builders[id](o, M, font);
    if (!obj) continue;
    obj.userData = { part: id, z0: obj.position.z, dz: id === 'weight' ? WEIGHT_DZ(o) : POSE[id].dz };
    obj.traverse(c => { if (c.isMesh) c.userData.part = id; });
    obj.visible = !o.parts || o.parts.includes(id);
    (POSE[id].spins ? spin : still).add(obj);
    parts.set(id, obj);
  }
  const fridge = shadow(new THREE.Mesh(new THREE.BoxGeometry(190, 170, 2), M.fridge));
  fridge.position.z = -(D.capSpacer + D.capT) - 1; fridge.visible = false; fridge.userData = { part: 'fridge' }; root.add(fridge);
  return { root, spin, still, parts, fridge, materials: M };
}
