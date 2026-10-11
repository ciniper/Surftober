// Breaking-wave animation frames for the outer band of the spinner ring.
// Shared by mockups.html (3D ring) and wave-demo.html (2D demo + SVG export).
//
// How it animates: the frames sit in N equal slots around the band, running
// clockwise. A phone video samples the spinning ring; when the ring turns
// exactly one slot per video frame, every slot shows the next frame and the
// animation plays in place (a phenakistiscope). Spin it counter-clockwise as
// you face it — the other way plays it backwards. One loop lasts N video
// frames, so fewer slots = a faster loop with bigger artwork.
//
// A frame lives in a cell: u runs 0→1 along the band (clockwise on the ring,
// the way the wave travels), v runs 0→1 from the band's inner edge up to its
// outer edge. The cell's width/height ratio A depends on the slot count; the
// wave keeps its proportions and the flat sea around it stretches or shrinks.

export const WAVE_COLORS = { water: '#1d3050', foam: '#efe7d2' };
const SEA = 0.22;    // water height at every cell edge, so the sea reads as one band at rest
const DA = 2.06;     // cell aspect the shapes below were drawn at (12 slots)
const TOP = 0.98;    // keep artwork just inside the ring's outer edge

// Wave surface shapes: 14 points left → right in a DA:1 design cell. Roles:
// 0 edge, 1–3 back of the wave, 4–6 crest, 7 lip top, 8 lip tip, 9 lip
// underside, 10 barrel ceiling, 11 barrel back wall / face, 12 toe, 13 edge.
const S = SEA;
const SHAPES = {
  flat:     [[0, S], [.12, S], [.22, S], [.3, S], [.36, S], [.44, S], [.5, S], [.54, S], [.57, S], [.6, S], [.63, S], [.7, S], [.8, S], [1, S]],
  swell:    [[0, S], [.12, .22], [.22, .23], [.3, .25], [.36, .27], [.44, .29], [.5, .29], [.54, .285], [.57, .28], [.6, .27], [.63, .26], [.7, .245], [.8, .225], [1, S]],
  rising:   [[0, S], [.12, .22], [.22, .25], [.3, .31], [.37, .39], [.45, .46], [.52, .47], [.56, .45], [.59, .42], [.62, .38], [.65, .33], [.7, .27], [.8, .225], [1, S]],
  peak:     [[0, S], [.12, .22], [.24, .27], [.33, .37], [.41, .51], [.49, .65], [.56, .72], [.61, .715], [.645, .68], [.665, .61], [.675, .52], [.685, .4], [.74, .25], [1, S]],
  throw:    [[0, S], [.12, .22], [.25, .29], [.35, .44], [.43, .62], [.51, .78], [.6, .86], [.71, .83], [.79, .66], [.73, .64], [.67, .67], [.62, .46], [.68, .24], [1, S]],
  barrel:   [[0, S], [.12, .22], [.25, .3], [.35, .47], [.43, .66], [.52, .82], [.6, .9], [.75, .85], [.85, .52], [.78, .56], [.7, .68], [.6, .5], [.64, .26], [1, S]],
  land:     [[0, S], [.12, .22], [.25, .3], [.35, .46], [.44, .64], [.53, .78], [.63, .84], [.76, .78], [.86, .3], [.78, .37], [.69, .55], [.61, .44], [.64, .25], [1, S]],
  impact:   [[0, S], [.12, .22], [.25, .28], [.35, .4], [.45, .52], [.53, .6], [.6, .62], [.67, .6], [.73, .55], [.78, .5], [.83, .45], [.88, .38], [.94, .28], [1, S]],   // lip has landed, wave still standing
  slump:    [[0, S], [.12, .22], [.22, .24], [.32, .28], [.42, .33], [.52, .38], [.6, .42], [.68, .44], [.75, .44], [.8, .43], [.85, .41], [.9, .37], [.95, .3], [1, S]],
  white:    [[0, S], [.12, .22], [.22, .222], [.3, .225], [.36, .228], [.44, .232], [.5, .236], [.54, .24], [.57, .245], [.6, .25], [.63, .258], [.7, .275], [.8, .29], [1, S]],
  reswell1: [[0, S], [.1, .225], [.2, .24], [.28, .25], [.36, .25], [.44, .24], [.52, .235], [.6, .24], [.68, .255], [.76, .27], [.83, .285], [.9, .29], [.95, .26], [1, S]],  // next swell starts behind the whitewater
  reswell2: [[0, S], [.12, .225], [.22, .245], [.3, .265], [.38, .28], [.46, .28], [.53, .27], [.6, .255], [.66, .245], [.72, .24], [.8, .245], [.88, .25], [.95, .24], [1, S]],
  rebuild:  [[0, S], [.12, .22], [.24, .27], [.33, .36], [.41, .47], [.49, .57], [.55, .62], [.6, .61], [.64, .57], [.67, .5], [.69, .42], [.72, .33], [.78, .25], [1, S]],
  rebuild2: [[0, S], [.12, .22], [.24, .27], [.33, .37], [.41, .5], [.49, .62], [.555, .68], [.605, .675], [.64, .64], [.66, .58], [.672, .5], [.684, .39], [.74, .25], [1, S]],
};

// Styles. 'stay' loops a wave in place over t ∈ [0, 1); 'travel' keys are by
// wave age in loops, with a new wave every loop spaced `travel` cells apart,
// so the loop never resets. Foam keys: [time, [u, v, size, spray]] in design-cell
// coordinates; size is in v units.
export const WAVE_VARIANTS = {
  classic: {
    label: 'Classic break', N: 12, mode: 'stay',
    keys: [[0, 'swell'], [2 / 12, 'rising'], [4 / 12, 'peak'], [5 / 12, 'throw'], [6 / 12, 'barrel'], [7 / 12, 'land'],
           [8 / 12, 'impact'], [9 / 12, 'slump'], [10 / 12, 'reswell1'], [11 / 12, 'reswell2'], [1, 'swell']],
    foam: [[0, [.5, .3, 0, 0]], [4 / 12, [.62, .72, 0, 0]], [5 / 12, [.7, .84, .05, 0]], [6 / 12, [.79, .79, .06, 0]], [7 / 12, [.84, .36, .1, .6]],
           [8 / 12, [.8, .5, .17, 1]], [9 / 12, [.86, .44, .15, .4]], [10 / 12, [.91, .35, .11, 0]], [11 / 12, [.96, .28, .06, 0]], [1, [1, .24, 0, 0]]],
  },
  rolling: {
    // Waves ¾ of a slot apart, each moving ¾ of a slot per loop and living 2.3 loops: one is
    // always rising on the left while the one ahead of it breaks and rolls out on the right.
    label: 'Rolling set', N: 10, mode: 'travel', travel: .75, lead: .6, life: 2.3,
    keys: [[0, 'swell'], [.5, 'rising'], [1, 'peak'], [1.17, 'throw'], [1.33, 'barrel'], [1.5, 'land'], [1.67, 'impact'], [1.85, 'slump'], [2.05, 'white'], [2.3, 'flat']],
    foam: [[0, [.5, .3, 0, 0]], [1, [.62, .72, 0, 0]], [1.17, [.7, .84, .05, 0]], [1.33, [.79, .79, .06, 0]], [1.5, [.84, .36, .1, .6]],
           [1.67, [.8, .5, .17, 1]], [1.85, [.82, .44, .15, .4]], [2.05, [.8, .34, .12, 0]], [2.3, [.78, .28, 0, 0]]],
  },
  return: {
    // The whitewater doesn't run off: after the explosion it's drawn back to the foot of the
    // wave, up the face and over the crest, where it becomes the feathering lip again.
    label: 'Whitewater return', N: 10, mode: 'stay',
    keys: [[0, 'peak'], [.1, 'throw'], [.2, 'barrel'], [.3, 'land'], [.4, 'impact'], [.55, 'rebuild'], [.75, 'rebuild2'], [1, 'peak']],
    foam: [[0, [.57, .74, .055, 0]], [.1, [.68, .84, .06, 0]], [.2, [.77, .8, .065, .3]], [.3, [.84, .36, .1, .6]], [.4, [.8, .48, .17, 1]],
           [.55, [.76, .36, .14, .3]], [.7, [.71, .4, .1, 0]], [.8, [.68, .52, .08, 0]], [.9, [.64, .63, .065, 0]], [1, [.57, .74, .055, 0]]],
  },
  barrel: {
    label: 'Barrel loop', N: 8, mode: 'stay',
    keys: [[0, 'peak'], [2 / 8, 'throw'], [3 / 8, 'barrel'], [4 / 8, 'land'], [5 / 8, 'impact'], [6 / 8, 'rebuild'], [7 / 8, 'rebuild2'], [1, 'peak']],
    foam: [[0, [.9, .3, 0, 0]], [1 / 8, [.66, .8, 0, 0]], [2 / 8, [.7, .84, .05, 0]], [3 / 8, [.79, .79, .06, 0]], [4 / 8, [.84, .36, .1, .6]],
           [5 / 8, [.82, .48, .16, 1]], [6 / 8, [.88, .4, .13, .3]], [7 / 8, [.94, .32, .08, 0]], [1, [.98, .27, 0, 0]]],
  },
};
export const WAVE_DEFAULT = 'classic';

// Circle layout of a whitewater cluster, in units of its size: [dx, dy, r]
const CLUSTER = [[0, 0, 1], [-.95, -.3, .75], [.95, -.25, .8], [-.5, .62, .68], [.52, .66, .62], [-1.7, -.55, .52], [1.7, -.5, .55], [0, -.75, .7]];
// Spray droplets above the cluster: [du, dv × spray]
const SPRAY = [[-.06, .1], [.01, .17], [.07, .09], [-.025, .26], [.05, .24]];

const mix = (a, b, k) => Array.isArray(a) ? a.map((x, i) => mix(x, b[i], k)) : a + (b - a) * k;
function at(keys, t, pick = v => v) {
  t = Math.min(Math.max(t, keys[0][0]), keys[keys.length - 1][0]);
  let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= t) i++;
  const [t0, a] = keys[i], [t1, b] = keys[i + 1];
  return mix(pick(a), pick(b), (t - t0) / (t1 - t0));
}
// Centripetal Catmull-Rom through the surface points (no overshoot loops at the lip).
function smooth(pts, seg = 5) {
  const P = [pts[0], ...pts, pts[pts.length - 1]], out = [pts[0]];
  const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const d = (a, b) => Math.max(Math.hypot((b[0] - a[0]) * DA, b[1] - a[1]) ** 0.5, 1e-4);
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    for (let k = 1; k <= seg; k++) {
      const t = t1 + (t2 - t1) * k / seg;
      const A1 = lerp(p0, p1, t / t1), A2 = lerp(p1, p2, (t - t1) / (t2 - t1)), A3 = lerp(p2, p3, (t - t2) / (t3 - t2));
      const B1 = lerp(A1, A2, t / t2), B2 = lerp(A2, A3, (t - t1) / (t3 - t1));
      out.push(lerp(B1, B2, (t - t1) / (t2 - t1)));
    }
  }
  return out;
}
// Sutherland–Hodgman clip to the cell [0,1] × [0,TOP].
function clip(poly) {
  const cutX = (a, b, x) => [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])];
  const cutY = (a, b, y) => [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y];
  const planes = [[p => p[0] >= 0, (a, b) => cutX(a, b, 0)], [p => p[0] <= 1, (a, b) => cutX(a, b, 1)],
                  [p => p[1] >= 0, (a, b) => cutY(a, b, 0)], [p => p[1] <= TOP, (a, b) => cutY(a, b, TOP)]];
  for (const [inside, cut] of planes) {
    const out = [];
    poly.forEach((b, i) => {
      const a = poly[(i + poly.length - 1) % poly.length];
      if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); } else if (inside(a)) out.push(cut(a, b));
    });
    if (!(poly = out).length) break;
  }
  return poly;
}
const circle = (u, v, r, A, n = 18) => Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI; return [u + Math.cos(a) * r / A, v + Math.sin(a) * r]; });

// One wave (surface + foam) at key time `k`, placed so design-cell u `anchor` lands on cell u `at`.
function wave(V, k, A, anchor, place, keep) {
  const X = u => place + (u - anchor) * DA / A;
  const surface = smooth(at(V.keys, k, name => SHAPES[name])).map(([u, v]) => [X(u), v]);
  const water = [[surface[0][0], 0], ...surface, [surface[surface.length - 1][0], 0]];
  const [cu, cv, s, spray] = at(V.foam, k), foam = [];
  if (s > 0.01) {
    const add = (u, v, r) => {
      if (keep) { u = Math.min(Math.max(u, r / A), 1 - r / A); v = Math.min(Math.max(v, r + .02), TOP - r); } // whole circles inside the cell
      foam.push(circle(u, v, r, A));
    };
    CLUSTER.forEach(([dx, dy, r]) => add(X(cu) + dx * s / A, cv + dy * s, r * s));
    if (spray > 0.05) SPRAY.forEach(([du, dv]) => add(X(cu + du), cv + s * 1.2 + dv * spray, .035));
  }
  return { water, foam };
}

// One frame at loop time t ∈ [0, 1) for a cell of aspect A: water and foam
// polygons in cell coordinates, already clipped to the cell.
export function waveFrame(variant, t, A = DA) {
  const V = WAVE_VARIANTS[variant] || WAVE_VARIANTS[WAVE_DEFAULT];
  t = ((t % 1) + 1) % 1;
  const parts = [];
  if (V.mode === 'travel') {
    // every wave still alive: ages t, t+1, t+2… each one `travel` further along
    for (let age = t; age <= V.life; age++) parts.push(wave(V, age, A, .55, age * V.travel - V.lead, false));
  } else parts.push(wave(V, t, A, .5, .5, true));
  const water = [[[0, 0], [0, SEA], [1, SEA], [1, 0]], ...parts.map(p => p.water)].map(clip).filter(p => p.length > 2);
  const foam = parts.flatMap(p => p.foam).map(clip).filter(p => p.length > 2);
  return { water, foam };
}

// Cell aspect for N slots on an r rIn–rOut band (width at mid-radius / height).
export const cellAspect = (N, rIn, rOut) => (Math.PI * (rIn + rOut) / N) / (rOut - rIn);

// All N frames bent onto the ring band, in mm around the spinner axis (y up).
// Slot 0 is at the top; slots and frames advance clockwise.
export function ringArt({ variant = WAVE_DEFAULT, N, rIn, rOut }) {
  N = N || (WAVE_VARIANTS[variant] || WAVE_VARIANTS[WAVE_DEFAULT]).N;
  const H = rOut - rIn, D = 2 * Math.PI / N, A = cellAspect(N, rIn, rOut), slots = [];
  for (let j = 0; j < N; j++) {
    const th0 = Math.PI / 2 - j * D + D / 2;             // the cell's u = 0 edge
    const P = (u, v) => { const th = th0 - u * D, r = rIn + v * H; return [r * Math.cos(th), r * Math.sin(th)]; };
    const bend = poly => poly.flatMap((p, i) => {          // split long runs so edges along the band follow the arc
      const q = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.abs(q[0] - p[0]) / 0.04));
      return Array.from({ length: n }, (_, k) => P(p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n));
    });
    const { water, foam } = waveFrame(variant, j / N, A);
    slots.push({ frame: j, water: water.map(bend), foam: foam.map(bend) });
  }
  return { N, slots };
}

// Front-face artwork as an SVG in mm, one group per print colour.
export function ringSVG({ variant = WAVE_DEFAULT, N, rIn, rOut, ringIn, ringOut, ringColor = '#d4af37' }) {
  const art = ringArt({ variant, N, rIn, rOut }), f = n => n.toFixed(3), half = Math.ceil(ringOut + 2);
  const circ = r => `M ${f(r)} 0 A ${f(r)} ${f(r)} 0 1 0 ${f(-r)} 0 A ${f(r)} ${f(r)} 0 1 0 ${f(r)} 0 Z`;
  const polys = key => art.slots.flatMap(s => s[key].map(p => `<polygon points="${p.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}"/>`)).join('\n      ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Surftober 2026 spinner ring, front face. Units mm, origin = spinner axis, y up.
     Wave style "${(WAVE_VARIANTS[variant] || WAVE_VARIANTS[WAVE_DEFAULT]).label}", ${art.N} frames running clockwise from the top;
     spin it counter-clockwise (facing it) and film it so the wave plays forward. Layers: ring
     (medal colour), water, foam; shapes within a layer overlap, so union them in CAD. Print the
     artwork as flush colour changes, not raised, so every slot weighs the same. -->
<svg xmlns="http://www.w3.org/2000/svg" width="${2 * half}mm" height="${2 * half}mm" viewBox="${-half} ${-half} ${2 * half} ${2 * half}">
  <g transform="scale(1,-1)">
    <path id="ring" fill="${ringColor}" fill-rule="evenodd" d="${circ(ringOut)} ${circ(ringIn)}"/>
    <g id="water" fill="${WAVE_COLORS.water}">
      ${polys('water')}
    </g>
    <g id="foam" fill="${WAVE_COLORS.foam}">
      ${polys('foam')}
    </g>
  </g>
</svg>
`;
}
