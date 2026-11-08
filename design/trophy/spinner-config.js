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

import { WAVE_VARIANTS, WAVE_DEFAULT, autoFrames, artBand, layerColors, layerNames } from './wave-frames.js';

// ---------------------------------------------------------------------------
// Dimensions (mm)
// ---------------------------------------------------------------------------
// Ring proportions. v3/v4 (Chase, 2026-10-28, print 2): Ø103, r 35–51.5, between
// prototypes 1 (Ø93 — slots too narrow for 10 frames) and 2 (Ø113 — a bit large).
// v5 (2026-11-04): 5 mm smaller again, Ø98, r 33–49 — the ring keeps its 16 mm
// width (it moves in 2 mm at both edges), so the band is still 12 mm and 10 frames
// stay full size (cell aspect 2.20 vs the 2.06 design cell). Arms show for 7.5 mm.
// v6 (2026-11-07, after the first Bambu slice dropped the plover's thinnest lines): the ring comes in to
// r 29.7 for 8 frames — the art band grows to 15.4 (r 32.8–48.2), the tallest band 8 frames fill at the
// 2.06 cell, so the art is 28% bigger. (9 frames would want r 31.1 / band 14.0, +15%; 10 only r 32.3, +5%.)
// Same Ø98 outside; arms show for 4.2 mm past the Ø51 hub.
const RING_IN = 29.7, RING_OUT = 49;
const HUB_R = 25.5;           // the two still discs (front hub, back cap) share this radius

export const DIM = {
  // 608 bearing — the one bought part every option shares
  bearing: { od: 22, id: 8, w: 7, innerOd: 12.1, outerId: 19.2 },
  t: 7,                         // body thickness = bearing width

  // spinning body: hub pressed onto the outer race, arms, wave ring
  bore: 21.9,                   // press fit on the Ø22 outer race (21.8 tight … 22.0 loose — tune after print 1)
  hubOut: 16,                   // printed hub radius around the bearing
  armW: 9,
  ringIn: RING_IN, ringOut: RING_OUT,            // the wave ring, Ø98 overall
  waveIn: RING_IN + 3.1, waveOut: RING_OUT - 0.8, // artwork band on the ring's front face (15.4 wide; v5 12.1), clear of the rim ridges
                                                  // (a sea: 'edge' style picks its own inner edge and runs its sea to ringIn: see waveBand)
  // bearing seat (v3, after the wobble on print 1 — option `seat`, default lip): the body is still t
  // thick but sits 0.6 further back — a lip behind the bore that only the OUTER race face touches
  // (r 9.9–10.95; the shield starts at r 9.6) squares the ring to the bearing, and a 45° chamfer
  // eases the press-in. Print 2 (v3) confirmed it: spins much better. `seat=plain` is the v1/v2 bore.
  lip: 0.6, lipIn: 9.9, chamfer: 0.6,
  inlay: 0.6,                   // flush artwork / text pocket depth (multi-colour)
  proud: 0.4, proudFoam: 0.7,   // art=proud: the inlays stand this far above the face (water / foam), from the same 0.6 pocket
  // art insert (option ring=insert, 2026-11-08): the relief rides a thin ring printed flat on its own plate (fine
  // nozzle) and glued into a pocket in the body's front face; the body prints single-colour at 0.4. Pocket r
  // ringIn → waveOut (the ridged rim is the outer wall and centres it; the inner edge is open), insertT deep.
  insertT: 1.0, insertClear: 0.15,
  relief: 0.4, reliefFoam: 0.8, // art=raised: one solid part, water 0.4 and foam 0.8 above the face — two 0.2 mm layers each, so the slicer can colour them by height
  // rim grip (option grip). v5 default: micro ridges — fine reeding like a coin edge, the full
  // thickness of the ring, front to back. Round-bottomed grooves ridgeW wide and ridgeDepth deep,
  // about ridgePitch apart; the count is rounded to a multiple of the frame count so the ridges
  // freeze with the art under a strobe. v4: notches — scallops cut from the back that stopped
  // notchKeep short of the front face (they felt coarse, and didn't reach the edge).
  ridgePitch: 1.5, ridgeW: 0.9, ridgeDepth: 0.35,
  notchR: 3.5, notchDepth: 1.2, notchKeep: 1.5,

  // still front hub on the inner race — carries the text, hides the arms
  // v5: 3.0 thick (was 2.4, it flexed and rubbed) and 1.0 stand-off (was 0.6): 1.0 over the bearing's
  // spinning outer race, 1.6 over the body's front face (the lip puts the body 0.6 behind the bearing)
  hubR: HUB_R, hubT: 3.0, standoff: 1.0,
  stemD: 8.1, stemLen: 3.3,               // into the Ø8 inner-race bore (8.0 … 8.2)
  spacerR: 5.5,                           // lands on the inner race only (r 4 … 6.05)
  textSize: 4.6, textTrack: 0.12, textInset: 4.6,

  // back cap on the inner race, same Ø51 disc as the front hub. v5: capSpacer 2.2 = 1.6 clearance over
  // the body's back face (which is 0.6 proud of the bearing, the lip), matching the front. Default
  // (magnet=none, v4 tests): a plain grip plate as thick as the hub with a spherical finger divot —
  // v5 makes it a proper fingertip divot, Ø18 × 1.6 (v4: a Ø22 × 1 dish). The Ø25 × 5 neodymium disc
  // behind the bearing cost 2–3× in spin time; magnet=disc keeps that pocketed cap (5.8 thick).
  capR: HUB_R, capT: 3.0, capSpacer: 2.2, dishD: 18, dishDepth: 1.6,
  capTMag: 5.8, magD: 25, magT: 5, magPocketD: 25.6, magPocketDepth: 4.6,

  // centre screw (option screw, v5): an M3 × 12 countersunk screw (ISO 10642 / DIN 7991) from the back,
  // through the cap and its stem, self-tapping into a blind pilot in the front hub's stem. It clamps the
  // inner race between the two spacers, so hub and cap can't rock on their stems and touch the body.
  // The head sits flush in the bottom of the finger divot. Pilot 2.6 self-taps PLA; open it to 4.0 for
  // an M3 × 4 heat-set insert if it gets taken apart a lot. frontSkin is what's left over the pilot.
  screwD: 3.4, screwPilot: 2.6, screwHeadD: 6.0, screwHead: 5.5, screwLen: 12, frontSkin: 1.6,   // countersink Ø6.0 at the divot bottom; a real ISO head (Ø5.5) seats 0.25 below it

  // bought weights, in the tier metal
  bezelWire: 3.5, bezelProud: 0.6,                            // round craft ring Ø(2·ringOut) × 3.5 wire in a half-round groove (Ø93 is not a stock craft size — buy 3.5" and print to it, or go flat)
  flatOd: 2 * RING_OUT, flatId: 2 * RING_OUT - 7, flatT: 3.18, flatClear: 0.15,  // laser-cut flat ring, 3.5 mm wide section (SendCutSend 0.125")
  cogTeeth: 22, cogTip: 48.8, cogRoot: 45.4, cogBore: 34.8, cogT: 2.3,  // 22T 3/32" track cog (tip Ø ≈ 97): just hidden behind the Ø98 rim — the cog option only makes sense with a chainring (≥ 46T) or as pure hidden weight
  cogBossIn: 12,
};
export const PLA_G_PER_MM3 = 1.24e-3;

// ---------------------------------------------------------------------------
// Colours and tiers
// ---------------------------------------------------------------------------
export const COLORS = {
  bone: '#e9e1cf', navy: '#1d3050', cream: '#efe7d2', ink: '#16273d', orange: '#ff6b35', teal: '#3aa9a3',
  brown: '#a9825a',             // light brown body behind a tier-colour insert (Chase, 2026-11-08)
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
    generated: true, color: 'body',  filament: 'body colour (option)', print: { flip: false, z: 0 } },
  { id: 'wave-water', group: 'Spinning piece', label: 'Art · bottom layer', detail: 'First inlay colour, flush in the ring face (water, or the plover’s body)',
    generated: true, color: 'layer-water', filament: 'layer colour', print: { flip: false, z: 0 }, when: o => isInlay(o) && !isInsert(o) },
  { id: 'wave-foam',  group: 'Spinning piece', label: 'Art · top layer',    detail: 'Second inlay colour on top of the first (foam, or the plover’s details)',
    generated: true, color: 'layer-foam', filament: 'layer colour', print: { flip: false, z: 0 }, when: o => isInlay(o) && !isInsert(o) },
  { id: 'insert',     group: 'Spinning piece', label: 'Art insert ring', detail: 'Thin ring carrying the wave in relief — printed flat on its own plate (fine nozzle, several per plate), glued into the body’s pocket',
    generated: true, color: 'tier',  filament: 'tier colour + navy + cream (its own plate)', print: { flip: false, z: 0 }, when: o => isInsert(o) },
  { id: 'hub',        group: 'Still parts',    label: 'Front hub',    detail: 'Rides the inner race; hides the arms; carries the text',
    generated: true, color: 'navy',  filament: 'navy', print: { flip: true, z: DIM.standoff + DIM.hubT } },
  { id: 'hub-text',   group: 'Still parts',    label: 'Hub text',     detail: '"SURFTOBER 2026" over the top, the name along the bottom — a separate inlay part',
    generated: true, color: 'tier',  filament: 'tier colour', print: { flip: true, z: DIM.standoff + DIM.hubT }, when: o => o.text === 'inlay' },
  { id: 'back-cap',   group: 'Still parts',    label: 'Back cap',     detail: 'Ø51 disc on the inner race, matching the hub — a finger divot in the back, the centre screw through it (magnet pocket optional)',
    generated: true, color: 'cap',   filament: 'any (or anodized aluminium)', print: { flip: false, z: DIM.capSpacer + DIM.capT } },
  { id: 'bearing',    group: 'Bought',         label: '608 bearing',  detail: '8 × 22 × 7 — cleaned, no grease, for spin time', color: 'steel' },
  { id: 'screw',      group: 'Bought',         label: 'Centre screw', detail: 'M3 × 12 countersunk (ISO 10642), from the back through the cap, self-taps into the hub stem — clamps hub and cap to the inner race', color: 'steel', when: o => hasScrew(o) },
  { id: 'magnet',     group: 'Bought',         label: 'Magnet',       detail: 'Ø25 × 5 adhesive-backed disc in the back cap, 0.4 proud — slows the spin 2–3×, off by default', color: 'magnet', when: o => o.magnet === 'disc' },
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
  if (c === 'body') return o.weight !== 'none' ? COLORS.bone : o.body === 'tier' ? TIERS[o.tier].color : COLORS[o.body];   // bone under a metal weight; else the body colour option
  if (c === 'cap') return CAP_COLORS[o.cap];
  if (c === 'layer-water') return layerColors(o.wave).water;
  if (c === 'layer-foam') return layerColors(o.wave).foam;
  return COLORS[c] || '#999999';
}
export const partFilament = (id, o) => PART[id].color === 'layer-water' || PART[id].color === 'layer-foam' ? partColor(id, o) : PART[id].color === 'body' ? (o.weight !== 'none' ? 'bone (the metal carries the tier)' : o.body === 'tier' ? 'tier colour' : o.body) : PART[id].filament;
export const activeParts = o => PARTS.filter(p => !p.when || p.when(o)).map(p => p.id);
export const generatedParts = o => activeParts(o).filter(id => PART[id].generated);

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
export const OPTIONS = {
  version:{ label: 'Version',    type: 'text',   default: 'v6', max: 12, hint: 'prefix on every output file; bump it per print round' },
  name:   { label: 'Name',       type: 'text',   default: 'NAHLA', max: 16 },
  tier:   { label: 'Tier',       type: 'choice', default: 'gold',   values: Object.keys(TIERS), labels: Object.fromEntries(Object.entries(TIERS).map(([k, v]) => [k, v.label])) },
  arms:   { label: 'Arms',       type: 'choice', default: 3,        values: [3, 4], labels: { 3: '3 arms', 4: '4 arms' } },
  wave:   { label: 'Animation',  type: 'choice', default: 'ploverleanbold', values: Object.keys(WAVE_VARIANTS), labels: Object.fromEntries(Object.entries(WAVE_VARIANTS).map(([k, v]) => [k, `${v.label} (${v.N})`])) },
  frames: { label: 'Frames',     type: 'int',    default: 0, min: 6, max: 16, hint: '0 = auto: as many slots as the band allows without shrinking the wave' },
  art:    { label: 'Artwork',    type: 'choice', default: 'raised', values: ['raised', 'proud', 'inlay', 'none'],
            labels: { raised: 'Raised relief · one solid part, water 0.4 / foam 0.8 (colour by height in the slicer)', proud: 'Separate inlay parts · 0.4 proud', inlay: 'Separate inlay parts · flush', none: 'Plain ring' } },
  text:   { label: 'Hub text',   type: 'choice', default: 'recessed', values: ['recessed', 'inlay', 'raised'],
            labels: { recessed: 'Recessed · engraved into the hub', inlay: 'Flush inlay · second colour', raised: 'Raised' } },
  grip:   { label: 'Rim grip',   type: 'choice', default: 'ridges', values: ['ridges', 'notches', 'none'],
            labels: { ridges: 'Micro ridges · full thickness (v5)', notches: 'Finger notches · 2 per frame (v4)', none: 'Smooth rim' }, hint: 'fine reeding round the whole edge, front to back, for flicking', when: o => o.weight !== 'bezel' },
  seat:   { label: 'Bearing seat', type: 'choice', default: 'lip', values: ['lip', 'plain'],
            labels: { lip: 'Lip + chamfer · v3, spins best', plain: 'Plain bore · v1/v2' }, hint: 'v3 seat: 0.6 lip behind the bore on the outer race face + entry chamfer' },
  weight: { label: 'Weight',     type: 'choice', default: 'none',   values: ['none', 'bezel', 'cog'],
            labels: { none: 'None — solid print', bezel: 'Metal bezel ring in the rim', cog: 'Bike cog behind the ring' } },
  bezel:  { label: 'Bezel ring', type: 'choice', default: 'flat',   values: ['flat', 'round'],
            labels: { flat: 'Flat laser-cut ring (SendCutSend)', round: 'Round craft wire ring' }, when: o => o.weight === 'bezel' },
  cap:    { label: 'Cap colour', type: 'choice', default: 'orange', values: Object.keys(CAP_COLORS) },
  magnet: { label: 'Magnet',     type: 'choice', default: 'none',   values: ['none', 'disc'],
            labels: { none: 'None · plain grip cap with a finger divot', disc: 'Ø25 × 5 neodymium disc in the cap (slows the spin 2–3×)' } },
  body:   { label: 'Body colour',  type: 'choice', default: 'tier', values: ['tier', 'brown', 'bone'],
            labels: { tier: 'Tier colour (gold / silver / bronze / teal)', brown: 'Light brown — the tier colour on the insert only', bone: 'Bone — the tier colour on the insert only' }, hint: 'the spinning body’s filament; the art insert is always in the tier colour, so a brown or bone body makes the gold ring the medal' },
  ring:   { label: 'Art ring',     type: 'choice', default: 'solid', values: ['solid', 'insert'],
            labels: { solid: 'One piece · relief on the body', insert: 'Glue-in insert · 1 mm ring with the relief, pocket in the body' }, hint: 'insert: the body prints single-colour at 0.4 in ~45 min; the inserts print flat at the fine nozzle, up to 4 per plate, and glue in' },
  copies: { label: 'Inserts per plate', type: 'int', default: 1, min: 1, max: 4, when: o => o.ring === 'insert', hint: 'how many insert rings the insert project file puts on one plate (Ø98: 4 fit the X1C bed)' },
  nozzle: { label: 'Nozzle',       type: 'choice', default: '0.4', values: ['0.4', '0.2'],
            labels: { '0.4': '0.4 mm · 0.20 layers (stock X1C)', '0.2': '0.2 mm · 0.10 layers — fine art, ~3.5× the ring time' }, hint: 'the -bambu.3mf project is written for this nozzle (with an insert: only the insert plate; the body plate is always 0.4) (printer, process and filament profiles, Arachne walls), so the slicer does not fall back to the stock classic walls' },
  screw:  { label: 'Centre screw', type: 'choice', default: 'm3', values: ['m3', 'none'],
            labels: { m3: 'M3 × 12 countersunk · clamps hub + cap (v5)', none: 'None · press-fit stems only (v4)' }, hint: 'from the back, through the cap, into the hub stem', when: o => o.magnet !== 'disc' },
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
// Multi-colour art (separate inlay parts), flush or proud.
export const isInlay = o => o.art === 'inlay' || o.art === 'proud';
// The relief rides a separate glue-in ring (the body then has a pocket and no art of its own).
export const isInsert = o => o.ring === 'insert';
// Rim grip, none with a bezel ring (its groove is there). Notches: two per animation frame.
// Ridges: about one per ridgePitch round the rim, rounded to a multiple of the frame count.
export const notchCount = o => (o.grip === 'notches' && o.weight !== 'bezel' ? 2 * frameCount(o) : 0);
export function ridgeCount(o) {
  if (o.grip !== 'ridges' || o.weight === 'bezel') return 0;
  const N = frameCount(o);
  return N * Math.max(1, Math.round(2 * Math.PI * DIM.ringOut / DIM.ridgePitch / N));
}
// The centre screw needs the middle of the cap, so it's off with the magnet pocket.
export const hasScrew = o => o.screw === 'm3' && o.magnet !== 'disc';
// Centre screw z (mounted pose): the countersink's top at the divot bottom, the seated head's top face, the tip,
// and the top of the pilot in the hub (frontSkin under the hub face).
export function screwZ(o) {
  const csk = -(DIM.capSpacer + capT(o)) + DIM.dishDepth, head = csk + (DIM.screwHeadD - DIM.screwHead) / 2;
  return { csk, head, tip: head + DIM.screwLen, pilotTop: DIM.t + DIM.standoff + DIM.hubT - DIM.frontSkin, pilotBottom: DIM.t - DIM.stemLen };
}
// Back-cap plate thickness: thin grip plate, or the pocketed magnet cap.
export const capT = o => (o.magnet === 'disc' ? DIM.capTMag : DIM.capT);
// Where the back of the assembly touches a surface (the proud magnet face, or the cap's back face).
export const backFace = o => -(DIM.capSpacer + capT(o)) - (o.magnet === 'disc' ? Math.max(0, DIM.magT - DIM.magPocketDepth) : 0);
// How far the spinning body sits behind the bearing's back face (the seat lip) — 0 for a plain bore.
export const bodyShift = o => (o.seat === 'lip' ? DIM.lip : 0);
export const frameCount = o => o.frames || autoFrames(o.wave, DIM.waveIn, DIM.waveOut);
// The band the art actually fills for these options: { rIn, rOut, seaIn, A } (see artBand in wave-frames.js).
export const waveBand = o => artBand(o.wave, frameCount(o), DIM.waveIn, DIM.waveOut, DIM.ringIn);

// The parts the generator will actually write for these options.
export const partsToGenerate = o => generatedParts(o).filter(id => !o.parts || o.parts.includes(id));

// Output file tag: `<who>-<arms>arm-<wave><N>[-weight[-bezel]][-art]`. `who` is the
// name when a part carries it, `ring` for the spinning piece alone, `parts` otherwise.
export function outputTag(o) {
  const gen = partsToGenerate(o);
  const who = gen.some(id => id === 'hub' || id === 'hub-text') ? slug(o.name) : gen.every(id => PART[id].group === 'Spinning piece') ? 'ring' : 'parts';
  return [slug(o.version), who, `${o.arms}arm`, `${o.wave}${frameCount(o)}`]
    .concat(o.weight === 'none' ? [] : [o.weight + (o.weight === 'bezel' ? `-${o.bezel}` : '')])
    .concat(o.art === OPTIONS.art.default ? [] : [o.art])
    .concat(o.grip === 'ridges' || o.weight === 'bezel' ? [] : [o.grip === 'notches' ? 'notches' : 'smooth'])
    .concat(hasScrew(o) || o.magnet === 'disc' ? [] : ['noscrew'])
    .concat(o.nozzle === '0.4' ? [] : [`n${o.nozzle.replace('.', '')}`])
    .concat(o.ring === 'insert' ? ['insert'] : [])
    .concat(o.body === 'tier' ? [] : [`${o.body}-body`])
    .concat(o.magnet === 'none' ? [] : ['magnet'])
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
  if (o.art !== OPTIONS.art.default) args.push(`--art ${o.art}`);
  if (o.grip !== 'ridges' && o.weight !== 'bezel') args.push(`--grip ${o.grip}`);
  if (o.screw !== 'm3' && o.magnet !== 'disc') args.push(`--screw ${o.screw}`);
  if (o.magnet !== 'none') args.push(`--magnet ${o.magnet}`);
  if (o.nozzle !== '0.4') args.push(`--nozzle ${o.nozzle}`);
  if (o.ring === 'insert') args.push('--ring insert' + (o.copies > 1 ? ` --copies ${o.copies}` : ''));
  if (o.body !== 'tier') args.push(`--body ${o.body}`);
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
  insert:    { label: '★ Current build · gold insert on a brown body', detail: 'ploverleanfine on a 1 mm glue-in insert in the tier colour (0.2 nozzle, 2 per plate) · light-brown body, hub and cap at 0.4', options: { wave: 'ploverleanfine', ring: 'insert', body: 'brown', nozzle: '0.2', copies: 2 } },
  full:      { label: 'Full trophy',                  detail: 'One solid spinning piece, wave in two-level relief, micro-ridged rim; hub + cap + centre screw', options: {} },
  inlays:    { label: 'Full trophy · inlay parts',    detail: 'Wave and foam as separate proud inlay parts (v4 first try — fiddly)', options: { art: 'proud' } },
  testring:  { label: 'Spinning piece only',          detail: 'Just the body with the wave in relief',          options: { parts: ['body'] } },
  stillset:  { label: 'Still parts only',             detail: 'Front hub, text and back cap for one name',       options: { parts: ['hub', 'hub-text', 'back-cap'] } },
  bezel:     { label: 'Metal bezel · brass',           detail: 'Laser-cut ring in the rim carries the tier',     options: { weight: 'bezel', bezel: 'flat', tier: 'gold' } },
  cog:       { label: 'Bike cog · 4 arms',             detail: 'Heaviest option, gear teeth past the rim',       options: { weight: 'cog', arms: 4 } },
  plain:     { label: 'Plain ring · no wave',          detail: 'For spin-time tests of the bare body',           options: { art: 'none', parts: ['body'] } },
};
export const applyPreset = (key, base = defaults()) => parseOptions({ ...base, ...PRESETS[key].options });

export { WAVE_VARIANTS, WAVE_DEFAULT };
