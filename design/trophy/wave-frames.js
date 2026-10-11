// Breaking-wave animation frames for the outer band of the spinner ring.
// Shared by mockups.html (3D ring) and wave-demo.html (2D demo + SVG export).
//
// How it animates: the frames sit in N equal slots around the band, running
// clockwise. A phone video samples the spinning ring; when the ring turns
// exactly one slot per video frame, every slot shows the next frame and the
// wave breaks in place (a phenakistiscope). Spin it counter-clockwise as you
// face it — the other way plays the wave backwards.
//
// A frame lives in a unit cell: u runs 0→1 along the band (clockwise on the
// ring, the way the wave travels), v runs 0→1 from the band's inner edge up
// to its outer edge. Cells are about twice as wide as tall (≈18 × 9 mm with
// 12 slots on an r 30.6–39.4 band), and the keyframes are drawn for that.

export const WAVE_N = 12;
export const WAVE_ASPECT = 2.06;  // cell width / height
export const WAVE_COLORS = { water: '#1d3050', foam: '#efe7d2' };
const SEA = 0.22;                 // water height at every cell edge, so the sea reads as one band

// 14 surface points, left edge → right edge: 0 edge, 1–3 back of the wave,
// 4–6 crest, 7 lip top, 8 lip tip, 9 lip underside, 10 barrel ceiling,
// 11 barrel back wall / face, 12 toe, 13 edge. Times are fractions of the loop.
const KEYS = [
  [0 / 12, [[0, SEA], [.12, .22], [.22, .23], [.3, .25], [.36, .27], [.44, .29], [.5, .29], [.54, .285], [.57, .28], [.6, .27], [.63, .26], [.7, .245], [.8, .225], [1, SEA]]],   // flat, low swell
  [2 / 12, [[0, SEA], [.12, .22], [.22, .25], [.3, .31], [.37, .39], [.45, .46], [.52, .47], [.56, .45], [.59, .42], [.62, .38], [.65, .33], [.7, .27], [.8, .225], [1, SEA]]],   // swell rising
  [4 / 12, [[0, SEA], [.12, .22], [.24, .27], [.33, .37], [.41, .51], [.49, .65], [.56, .72], [.61, .715], [.645, .68], [.665, .61], [.675, .52], [.685, .4], [.74, .25], [1, SEA]]], // peaking, face goes vertical
  [5 / 12, [[0, SEA], [.12, .22], [.25, .29], [.35, .44], [.43, .62], [.51, .78], [.6, .86], [.71, .83], [.79, .66], [.73, .64], [.67, .67], [.62, .46], [.68, .24], [1, SEA]]],    // lip throws
  [6 / 12, [[0, SEA], [.12, .22], [.25, .3], [.35, .47], [.43, .66], [.52, .82], [.6, .9], [.75, .85], [.85, .52], [.78, .56], [.7, .68], [.6, .5], [.64, .26], [1, SEA]]],    // barrel
  [7 / 12, [[0, SEA], [.12, .22], [.25, .3], [.35, .46], [.44, .64], [.53, .78], [.63, .84], [.76, .78], [.86, .3], [.78, .37], [.69, .55], [.61, .44], [.64, .25], [1, SEA]]],    // lip lands
  [8 / 12, [[0, SEA], [.12, .22], [.25, .24], [.35, .27], [.45, .31], [.55, .35], [.63, .38], [.7, .4], [.76, .41], [.81, .41], [.86, .4], [.9, .36], [.95, .29], [1, SEA]]],     // collapsed under the whitewater
  [10 / 12, [[0, SEA], [.12, .22], [.22, .222], [.3, .225], [.36, .228], [.44, .232], [.5, .236], [.54, .24], [.57, .245], [.6, .25], [.63, .258], [.7, .275], [.8, .29], [1, SEA]]], // whitewater rolls on
];
KEYS.push([1, KEYS[0][1]]);

// Whitewater cluster per keyframe: centre (u, v), size s (v units), spray amount.
const FOAM = [
  [0 / 12, [.5, .3, 0, 0]],
  [4 / 12, [.62, .72, 0, 0]],
  [5 / 12, [.7, .84, .05, 0]],     // crest starts to feather
  [6 / 12, [.79, .79, .06, 0]],    // spray off the lip
  [7 / 12, [.84, .36, .1, .6]],    // lip hits the flat
  [8 / 12, [.78, .45, .17, 1]],    // explosion
  [9 / 12, [.85, .41, .15, .4]],
  [10 / 12, [.9, .34, .11, 0]],
  [11 / 12, [.955, .28, .06, 0]],
  [1, [1, .24, 0, 0]],
];
// Circle layout of a whitewater cluster, in units of s: [dx, dy, r]
const CLUSTER = [[0, 0, 1], [-.95, -.3, .75], [.95, -.25, .8], [-.5, .62, .68], [.52, .66, .62], [-1.7, -.55, .52], [1.7, -.5, .55], [0, -.75, .7]];
// Spray droplets above the cluster: [du, dv × spray]
const SPRAY = [[-.06, .1], [.01, .17], [.07, .09], [-.025, .26], [.05, .24]];

const mix = (a, b, k) => Array.isArray(a) ? a.map((x, i) => mix(x, b[i], k)) : a + (b - a) * k;
function at(keys, t) {
  t = ((t % 1) + 1) % 1;
  let i = 0; while (keys[i + 1][0] <= t) i++;          // keys end at t = 1, so this stops
  const [t0, a] = keys[i], [t1, b] = keys[i + 1];
  return mix(a, b, (t - t0) / (t1 - t0));
}
// Centripetal Catmull-Rom through the surface points (no overshoot loops at the lip).
function smooth(pts, seg = 5) {
  const P = [pts[0], ...pts, pts[pts.length - 1]], out = [pts[0]];
  const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const d = (a, b) => Math.max(Math.hypot((b[0] - a[0]) * WAVE_ASPECT, b[1] - a[1]) ** 0.5, 1e-4);
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
const clampCircle = (u, v, r) => [Math.min(Math.max(u, r / WAVE_ASPECT), 1 - r / WAVE_ASPECT), Math.min(Math.max(v, r + .02), .98 - r), r];

// One frame at loop time t ∈ [0, 1): the water surface (left → right), the
// closed water polygon in cell coordinates, and foam circles [u, v, r].
export function waveFrame(t) {
  const surface = smooth(at(KEYS, t));
  const [cu, cv, s, spray] = at(FOAM, t), foam = [];
  if (s > 0.01) {
    CLUSTER.forEach(([dx, dy, r]) => foam.push(clampCircle(cu + dx * s / WAVE_ASPECT, cv + dy * s, r * s)));
    if (spray > 0.05) SPRAY.forEach(([du, dv]) => foam.push(clampCircle(cu + du, cv + s * 1.2 + dv * spray, .035)));
  }
  return { surface, water: [[0, 0], ...surface, [1, 0]], foam };
}

// All N frames bent onto the ring band, in mm around the spinner axis (y up).
// Slot 0 is at the top; slots and frames advance clockwise.
export function ringArt({ N = WAVE_N, rIn, rOut }) {
  const H = rOut - rIn, D = 2 * Math.PI / N, slots = [];
  for (let j = 0; j < N; j++) {
    const th0 = Math.PI / 2 - j * D + D / 2;             // the cell's u = 0 edge
    const P = (u, v) => { const th = th0 - u * D, r = rIn + v * H; return [r * Math.cos(th), r * Math.sin(th)]; };
    const { surface, foam } = waveFrame(j / N);
    const water = [P(0, 0), ...surface.map(([u, v]) => P(u, v)), P(1, 0)];
    for (let k = 1; k < 8; k++) water.push(P(1 - k / 8, 0)); // inner edge follows the arc
    slots.push({ frame: j, water, foam: foam.map(([u, v, r]) => [...P(u, v), r * H]) });
  }
  return { slots };
}

// Front-face artwork as an SVG in mm, one group per print colour.
export function ringSVG({ N = WAVE_N, rIn, rOut, ringIn, ringOut, ringColor = '#d4af37' }) {
  const { slots } = ringArt({ N, rIn, rOut }), f = n => n.toFixed(3), half = Math.ceil(ringOut + 2);
  const circle = r => `M ${f(r)} 0 A ${f(r)} ${f(r)} 0 1 0 ${f(-r)} 0 A ${f(r)} ${f(r)} 0 1 0 ${f(r)} 0 Z`;
  const water = slots.map(s => `<polygon points="${s.water.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}"/>`).join('\n      ');
  const foam = slots.flatMap(s => s.foam.map(([x, y, r]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`)).join('\n      ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Surftober 2026 spinner ring, front face. Units mm, origin = spinner axis, y up.
     ${N} breaking-wave frames run clockwise from the top; spin it counter-clockwise (facing it)
     and film it so the wave breaks forward. Layers: ring (medal colour), water, foam. Print the
     artwork as flush colour changes, not raised, so every slot weighs the same. -->
<svg xmlns="http://www.w3.org/2000/svg" width="${2 * half}mm" height="${2 * half}mm" viewBox="${-half} ${-half} ${2 * half} ${2 * half}">
  <g transform="scale(1,-1)">
    <path id="ring" fill="${ringColor}" fill-rule="evenodd" d="${circle(ringOut)} ${circle(ringIn)}"/>
    <g id="water" fill="${WAVE_COLORS.water}">
      ${water}
    </g>
    <g id="foam" fill="${WAVE_COLORS.foam}">
      ${foam}
    </g>
  </g>
</svg>
`;
}
