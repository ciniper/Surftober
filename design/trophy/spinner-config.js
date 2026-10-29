// Surftober 2026 trophy — the spinner, single source of truth.
//
// Everything that describes the trophy as a product lives here: dimensions,
// the parts it's made of, the options you can choose, presets, and how all
// of that round-trips through a URL or a generator command. The 3D viewer
// (viewer.html), the wave demo (wave-demo.html) and the CAD generator
// (cad/spinner.py, via cad/bridge.mjs) all read this file, so they cannot
// drift apart. Change a number here and every preview and every STL follows.
//
// Coordinates: the spinner axis is z, the 608 bearing sits at z 0…7 with its
// front face at z = 7 (the face you look at), the fridge is behind z = 0.

import { WAVE_VARIANTS, WAVE_DEFAULT, autoFrames, layerColors, layerNames } from './wave-frames.js';

// ---------------------------------------------------------------------------
// Dimensions (mm)
// ---------------------------------------------------------------------------
// Ring proportions (Chase, 2026-10-28, print 2): between prototypes 1 (Ø93,
// r 27.5–46.5 — slots too narrow for 10 frames) and 2 (Ø113, r 37.5–56.5 — a
// bit large). Ø103, r 35–51.5: the band is 12.8 mm (vs 15.3) so the whitewater
// return fits its native 10 frames at full size with margin (cell aspect 2.18
// vs the 2.06 design cell). Hub unchanged at r 25.5; arms show for 9.5 mm.
const RING_IN = 35, RING_OUT = 51.5;
const HUB_R = 25.5;           // the two still discs (front hub, back cap) share this radius

export const DIM = {
  // 608 bearing — the one bought part every option shares
  bearing: { od: 22, id: 8, w: 7, innerOd: 12.1, outerId: 19.2 },
  t: 7,                         // body thickness = bearing width

  // spinning body: hub pressed onto the outer race, arms, wave ring
  bore: 21.9,                   // press fit on the Ø22 outer race (21.8 tight … 22.0 loose — tune after print 1)
  hubOut: 16,                   // printed hub radius around the bearing
  armW: 9,
  ringIn: RING_IN, ringOut: RING_OUT,            // the wave ring, Ø103 overall
  waveIn: RING_IN + 3.1, waveOut: RING_OUT - 0.6, // artwork band on the ring's front face (12.8 wide)
  // bearing seat (v3, after the wobble on print 1 — option `seat`, default lip): the body is still t
  // thick but sits 0.6 further back — a lip behind the bore that only the OUTER race face touches
  // (r 9.9–10.95; the shield starts at r 9.6) squares the ring to the bearing, and a 45° chamfer
  // eases the press-in. Print 2 (v3) confirmed it: spins much better. `seat=plain` is the v1/v2 bore.
  lip: 0.6, lipIn: 9.9, chamfer: 0.6,
  inlay: 0.6,                   // flush artwork / text pocket depth (multi-colour)
  relief: 0.6, reliefFoam: 0.9, // raised artwork heights (one-colour)

  // still front hub on the inner race — carries the text, hides the arms
  hubR: HUB_R, hubT: 2.4, standoff: 0.6,  // 9.5 mm reveal to the ring; 0.6 over the bearing face = 1.2 over the spinning body
  stemD: 8.1, stemLen: 3.3,               // into the Ø8 inner-race bore (8.0 … 8.2)
  spacerR: 5.5,                           // lands on the inner race only (r 4 … 6.05)
  textSize: 4.6, textTrack: 0.12, textInset: 4.6,

  // back cap on the inner race, same Ø51 disc as the front hub: holds the magnet, the only fridge contact.
  // capSpacer 1.8 = 1.2 clearance over the body's back face (which is 0.6 proud of the bearing, the lip).
  // The Ø25 × 5 adhesive-backed magnet sits in a loose pocket (0.3 radial) on a 1.2 floor, 0.4 proud.
  capR: HUB_R, capT: 5.8, capSpacer: 1.8,
  magD: 25, magT: 5, magPocketD: 25.6, magPocketDepth: 4.6,

  // bought weights, in the tier metal
  bezelWire: 3.5, bezelProud: 0.6,                            // round craft ring Ø(2·ringOut) × 3.5 wire in a half-round groove (Ø93 is not a stock craft size — buy 3.5" and print to it, or go flat)
  flatOd: 2 * RING_OUT, flatId: 2 * RING_OUT - 7, flatT: 3.18, flatClear: 0.15,  // laser-cut flat ring, 3.5 mm wide section (SendCutSend 0.125")
  cogTeeth: 22, cogTip: 48.8, cogRoot: 45.4, cogBore: 34.8, cogT: 2.3,  // 22T 3/32" track cog (tip Ø ≈ 97): hidden behind a Ø113 rim now — the cog option only makes sense with a chainring (≥ 46T) or as pure hidden weight
  cogBossIn: 12,
};
export const PLA_G_PER_MM3 = 1.24e-3;

// ---------------------------------------------------------------------------
// Colours and tiers
// ---------------------------------------------------------------------------
export const COLORS = {
  bone: '#e9e1cf', navy: '#1d3050', cream: '#efe7d2', ink: '#16273d', orange: '#ff6b35', teal: '#3aa9a3',
  sand: '#b89b70', steel: '#d0d4d8', shield: '#1a1a1a', magnet: '#333333', fridge: '#c9ccd0',
};
export const TIERS = {
  gold:        { label: 'Gold (40 h)',        color: '#d4af37', metal: 0.8,  rough: 0.3,  metalName: 'brass' },
  silver:      { label: 'Silver (30 h)',      color: '#c8ccd2', metal: 0.85, rough: 0.25, metalName: 'stainless' },
  bronze:      { label: 'Bronze (20 h)',      color: '#b87333', metal: 0.8,  rough: 0.35, metalName: 'copper' },
  participant: { label: 'Participant (10 h)', color: '#3fa98f', metal: 0.2,  rough: 0.6,  metalName: 'black-oxide steel' },
};
export const CAP_COLORS = { orange: '#ff6b35', navy: '#1d3050', teal: '#3aa9a3' };

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------
// `generated`  the CAD generator writes this part (as STL / into the STEP + 3MF)
// `when`       the part exists for these options (otherwise it's hidden everywhere)
// `print`      where it's saved relative to the mounted pose: how it goes on the bed
//              (the viewer uses the same table to put generated STLs back in place)
export const PARTS = [
  { id: 'body',       group: 'Spinning piece', label: 'Body',        detail: 'Hub on the 608 outer race, arms, wave ring — one print',
    generated: true, color: 'bone',  filament: 'bone / tier colour', print: { flip: false, z: 0 } },
  { id: 'wave-water', group: 'Spinning piece', label: 'Art · bottom layer', detail: 'First inlay colour, flush in the ring face (water, or the plover’s body)',
    generated: true, color: 'layer-water', filament: 'layer colour', print: { flip: false, z: 0 }, when: o => o.art === 'inlay' },
  { id: 'wave-foam',  group: 'Spinning piece', label: 'Art · top layer',    detail: 'Second inlay colour on top of the first (foam, or the plover’s details)',
    generated: true, color: 'layer-foam', filament: 'layer colour', print: { flip: false, z: 0 }, when: o => o.art === 'inlay' },
  { id: 'hub',        group: 'Still parts',    label: 'Front hub',    detail: 'Rides the inner race; hides the arms; carries the text',
    generated: true, color: 'navy',  filament: 'navy', print: { flip: true, z: DIM.standoff + DIM.hubT } },
  { id: 'hub-text',   group: 'Still parts',    label: 'Hub text',     detail: '"SURFTOBER 2026" over the top, the name along the bottom — a separate inlay part',
    generated: true, color: 'tier',  filament: 'tier colour', print: { flip: true, z: DIM.standoff + DIM.hubT }, when: o => o.text === 'inlay' },
  { id: 'back-cap',   group: 'Still parts',    label: 'Back cap',     detail: 'Ø51 disc on the inner race, matching the hub; holds the magnet — the only fridge contact',
    generated: true, color: 'cap',   filament: 'any (or anodized aluminium)', print: { flip: false, z: DIM.capSpacer + DIM.capT } },
  { id: 'bearing',    group: 'Bought',         label: '608 bearing',  detail: '8 × 22 × 7 — cleaned, no grease, for spin time', color: 'steel' },
  { id: 'magnet',     group: 'Bought',         label: 'Magnet',       detail: 'Ø25 × 5 adhesive-backed disc, stuck into the back cap, 0.4 proud', color: 'magnet' },
  { id: 'weight',     group: 'Bought',         label: 'Metal weight', detail: 'Bezel ring in the rim, or a bike cog behind the body — the tier metal',
    color: 'tier', when: o => o.weight !== 'none' },
];
export const PART = Object.fromEntries(PARTS.map(p => [p.id, p]));
export function partLabel(id, o) {
  if (!o) return PART[id].label;
  if (id === 'weight') return o.weight === 'bezel' ? `Metal bezel ring (${o.bezel})` : 'Bike cog';
  if (id === 'wave-water' || id === 'wave-foam') { const n = layerNames(o.wave), noun = WAVE_VARIANTS[o.wave].kind === 'sprite' ? 'Plover' : 'Wave'; return `${noun} · ${id === 'wave-water' ? n.water : n.foam}`; }
  return PART[id].label;
}
// Resolved hex colour of a part for options `o` (tier metal, cap colour, art layer, or a named colour).
export function partColor(id, o) {
  const c = PART[id].color;
  if (c === 'tier') return TIERS[o.tier].color;
  if (c === 'cap') return CAP_COLORS[o.cap];
  if (c === 'layer-water') return layerColors(o.wave).water;
  if (c === 'layer-foam') return layerColors(o.wave).foam;
  return COLORS[c] || '#999999';
}
export const partFilament = (id, o) => PART[id].color === 'layer-water' || PART[id].color === 'layer-foam' ? partColor(id, o) : PART[id].filament;
export const activeParts = o => PARTS.filter(p => !p.when || p.when(o)).map(p => p.id);
export const generatedParts = o => activeParts(o).filter(id => PART[id].generated);

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
export const OPTIONS = {
  version:{ label: 'Version',    type: 'text',   default: 'v3', max: 12, hint: 'prefix on every output file; bump it per print round' },
  name:   { label: 'Name',       type: 'text',   default: 'NAHLA', max: 16 },
  tier:   { label: 'Tier',       type: 'choice', default: 'gold',   values: Object.keys(TIERS), labels: Object.fromEntries(Object.entries(TIERS).map(([k, v]) => [k, v.label])) },
  arms:   { label: 'Arms',       type: 'choice', default: 3,        values: [3, 4], labels: { 3: '3 arms', 4: '4 arms' } },
  wave:   { label: 'Animation',  type: 'choice', default: 'return', values: Object.keys(WAVE_VARIANTS), labels: Object.fromEntries(Object.entries(WAVE_VARIANTS).map(([k, v]) => [k, `${v.label} (${v.N})`])) },
  frames: { label: 'Frames',     type: 'int',    default: 0, min: 6, max: 16, hint: '0 = auto: as many slots as the band allows without shrinking the wave' },
  art:    { label: 'Artwork',    type: 'choice', default: 'inlay',  values: ['inlay', 'raised', 'none'],
            labels: { inlay: 'Flush inlays · multi-colour', raised: 'Raised relief · one colour', none: 'Plain ring' } },
  text:   { label: 'Hub text',   type: 'choice', default: 'recessed', values: ['recessed', 'inlay', 'raised'],
            labels: { recessed: 'Recessed · engraved into the hub', inlay: 'Flush inlay · second colour', raised: 'Raised' } },
  seat:   { label: 'Bearing seat', type: 'choice', default: 'lip', values: ['lip', 'plain'],
            labels: { lip: 'Lip + chamfer · v3, spins best', plain: 'Plain bore · v1/v2' }, hint: 'v3 seat: 0.6 lip behind the bore on the outer race face + entry chamfer' },
  weight: { label: 'Weight',     type: 'choice', default: 'none',   values: ['none', 'bezel', 'cog'],
            labels: { none: 'None — solid print', bezel: 'Metal bezel ring in the rim', cog: 'Bike cog behind the ring' } },
  bezel:  { label: 'Bezel ring', type: 'choice', default: 'flat',   values: ['flat', 'round'],
            labels: { flat: 'Flat laser-cut ring (SendCutSend)', round: 'Round craft wire ring' }, when: o => o.weight === 'bezel' },
  cap:    { label: 'Cap colour', type: 'choice', default: 'orange', values: Object.keys(CAP_COLORS) },
  parts:  { label: 'Parts',      type: 'list',   default: null, hint: 'which parts to show / generate; empty = all' },
};
export const defaults = () => Object.fromEntries(Object.entries(OPTIONS).map(([k, v]) => [k, v.default]));

// Accept a URLSearchParams / query string / plain object; return a complete,
// validated options object (unknown values fall back to defaults).
export function parseOptions(src) {
  const q = src instanceof URLSearchParams ? src : typeof src === 'string' ? new URLSearchParams(src.replace(/^\?/, '')) : new URLSearchParams(Object.entries(src || {}).filter(([, v]) => v != null).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)]));
  // `preset=<key>` seeds the options; explicit values on top of it win
  const o = q.has('preset') && PRESETS[q.get('preset')] ? parseOptions(PRESETS[q.get('preset')].options) : defaults();
  for (const [k, spec] of Object.entries(OPTIONS)) {
    if (!q.has(k)) continue;
    const raw = q.get(k);
    if (spec.type === 'choice') { const v = spec.values.find(x => String(x) === raw); if (v !== undefined) o[k] = v; }
    else if (spec.type === 'int') { const n = parseInt(raw, 10); if (Number.isFinite(n)) o[k] = n === 0 ? 0 : Math.min(spec.max, Math.max(spec.min, n)); }
    else if (spec.type === 'text') { o[k] = raw.replace(/[^\p{L}\p{N} .'\-]/gu, '').trim().slice(0, spec.max) || spec.default; }
    else if (spec.type === 'list') { const ids = raw.split(',').map(s => s.trim()).filter(id => PART[id]); o[k] = ids.length ? ids : null; }
  }
  if (o.parts) o.parts = o.parts.filter(id => activeParts(o).includes(id));
  if (o.parts && !o.parts.length) o.parts = null;
  return o;
}
// Query string with only the non-default values, in a stable order.
export function serializeOptions(o) {
  const q = new URLSearchParams();
  for (const [k, spec] of Object.entries(OPTIONS)) {
    const v = o[k];
    if (v == null || v === spec.default || (spec.when && !spec.when(o))) continue;
    q.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return q.toString();
}
// How far the spinning body sits behind the bearing's back face (the seat lip) — 0 for a plain bore.
export const bodyShift = o => (o.seat === 'lip' ? DIM.lip : 0);
export const frameCount = o => o.frames || autoFrames(o.wave, DIM.waveIn, DIM.waveOut);

// The parts the generator will actually write for these options.
export const partsToGenerate = o => generatedParts(o).filter(id => !o.parts || o.parts.includes(id));

// Output file tag: `<who>-<arms>arm-<wave><N>[-weight[-bezel]][-art]`. `who` is the
// name when a part carries it, `ring` for the spinning piece alone, `parts` otherwise.
export function outputTag(o) {
  const gen = partsToGenerate(o);
  const who = gen.some(id => id === 'hub' || id === 'hub-text') ? slug(o.name) : gen.every(id => PART[id].group === 'Spinning piece') ? 'ring' : 'parts';
  return [slug(o.version), who, `${o.arms}arm`, `${o.wave}${frameCount(o)}`]
    .concat(o.weight === 'none' ? [] : [o.weight + (o.weight === 'bezel' ? `-${o.bezel}` : '')])
    .concat(o.art === 'inlay' ? [] : [o.art])
    .concat(o.text === 'recessed' ? [] : [`text-${o.text}`])
    .concat(o.seat === 'lip' ? [] : ['plain-seat'])
    .join('-');
}
export const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'spinner';

// The generator command for these options (run from design/trophy/cad).
export function cadCommand(o, { python = '.venv/bin/python' } = {}) {
  const args = [`--name "${o.name}"`, `--arms ${o.arms}`, `--wave ${o.wave}`];
  if (o.version !== OPTIONS.version.default) args.push(`--version ${o.version}`);
  if (o.frames) args.push(`--frames ${o.frames}`);
  if (o.art !== 'inlay') args.push(`--art ${o.art}`);
  if (o.text !== 'recessed') args.push(`--text ${o.text}`);
  if (o.seat !== 'lip') args.push(`--seat ${o.seat}`);
  if (o.weight !== 'none') args.push(`--weight ${o.weight}` + (o.weight === 'bezel' ? ` --bezel ${o.bezel}` : ''));
  if (o.parts) args.push(`--parts ${partsToGenerate(o).join(',')}`);
  return `${python} spinner.py ${args.join(' ')}`;
}

// ---------------------------------------------------------------------------
// Presets — one click to a sensible configuration
// ---------------------------------------------------------------------------
export const PRESETS = {
  full:      { label: 'Full trophy · multi-colour',  detail: 'Everything, flush inlays, solid print',          options: {} },
  testring:  { label: 'Test print · one-colour ring', detail: 'Just the spinning piece with the wave in relief', options: { art: 'raised', parts: ['body'] } },
  stillset:  { label: 'Still parts only',             detail: 'Front hub, text and back cap for one name',       options: { parts: ['hub', 'hub-text', 'back-cap'] } },
  bezel:     { label: 'Metal bezel · brass',           detail: 'Laser-cut ring in the rim carries the tier',     options: { weight: 'bezel', bezel: 'flat', tier: 'gold' } },
  cog:       { label: 'Bike cog · 4 arms',             detail: 'Heaviest option, gear teeth past the rim',       options: { weight: 'cog', arms: 4 } },
  plain:     { label: 'Plain ring · no wave',          detail: 'For spin-time tests of the bare body',           options: { art: 'none', parts: ['body'] } },
};
export const applyPreset = (key, base = defaults()) => parseOptions({ ...base, ...PRESETS[key].options });

export { WAVE_VARIANTS, WAVE_DEFAULT };
