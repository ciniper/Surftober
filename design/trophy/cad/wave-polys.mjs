// Dump the breaking-wave band as JSON for spinner.py (CadQuery).
// usage: node wave-polys.mjs <variant> <frames|0> <rIn> <rOut>
// Output: { N, water: [[[x,y],…],…], foam: [...] } in mm, origin = spinner axis, y up,
// slot 0 at the top, frames advancing clockwise — the same geometry mockups.html shows.
import { ringArt, WAVE_VARIANTS, WAVE_DEFAULT } from '../wave-frames.js';

const [variant = WAVE_DEFAULT, framesArg = '0', rInArg = '30.6', rOutArg = '39.4'] = process.argv.slice(2);
if (!WAVE_VARIANTS[variant]) { console.error(`unknown wave variant "${variant}"; one of ${Object.keys(WAVE_VARIANTS).join(', ')}`); process.exit(2); }
const art = ringArt({ variant, N: +framesArg || undefined, rIn: +rInArg, rOut: +rOutArg });
const clean = poly => {                       // drop repeated points and degenerate polygons
  const out = [];
  for (const p of poly) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) out.push(p); }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 1e-4) out.pop();
  return out.length >= 3 ? out : null;
};
const gather = key => art.slots.flatMap(s => s[key].map(clean).filter(Boolean));
process.stdout.write(JSON.stringify({ variant, N: art.N, label: WAVE_VARIANTS[variant].label, water: gather('water'), foam: gather('foam') }));
