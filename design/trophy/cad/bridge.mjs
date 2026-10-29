// Bridge between spinner-config.js / wave-frames.js and the Python generator.
// usage: node bridge.mjs "<query string of options>"
// Prints one JSON document: validated options, output tag, dimensions, the
// parts to generate (with print poses), tier colours and the wave artwork as
// polygons in mm (origin = spinner axis, y up, slot 0 at the top, clockwise).
import { DIM, TIERS, PART, parseOptions, serializeOptions, outputTag, partsToGenerate, activeParts, frameCount, partColor, partFilament, partLabel, WAVE_VARIANTS } from '../spinner-config.js';
import { ringArt } from '../wave-frames.js';

const o = parseOptions(process.argv[2] || '');
const art = ringArt({ variant: o.wave, N: frameCount(o), rIn: DIM.waveIn, rOut: DIM.waveOut });
const clean = poly => {                       // drop repeated points and degenerate polygons
  const out = [];
  for (const p of poly) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) out.push(p); }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 1e-4) out.pop();
  return out.length >= 3 ? out : null;
};
const gather = key => art.slots.flatMap(s => s[key].map(clean).filter(Boolean));
const meta = id => ({ id, label: partLabel(id, o), group: PART[id].group, color: partColor(id, o), filament: partFilament(id, o), print: PART[id].print });
process.stdout.write(JSON.stringify({
  options: o, query: serializeOptions(o), tag: outputTag(o),
  dim: DIM, tier: { key: o.tier, ...TIERS[o.tier] },
  generate: partsToGenerate(o).map(meta), active: activeParts(o),
  wave: { variant: o.wave, label: WAVE_VARIANTS[o.wave].label, N: art.N, water: gather('water'), foam: gather('foam') },
}));
