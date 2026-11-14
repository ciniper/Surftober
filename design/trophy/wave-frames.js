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
// A style can recolour / rename its two inlay layers (the plover is a cream bird with navy details).
// `water` is the bottom layer, `foam` the top one — the top is cut out of the bottom in CAD.
export const layerColors = v => ({ ...WAVE_COLORS, ...((WAVE_VARIANTS[v] || WAVE_VARIANTS[WAVE_DEFAULT]).layers || {}) });
export const layerNames = v => ({ water: 'water', foam: 'foam', ...((WAVE_VARIANTS[v] || WAVE_VARIANTS[WAVE_DEFAULT]).layerNames || {}) });
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
  // v5 hollow throw (Chase, 2026-11-04: "extends out further instead of breaks so vertical"): the lip
  // pitches out almost horizontally and lands far ahead of the wave, leaving a long open tube
  hpeak:    [[0, S], [.08, .22], [.17, .26], [.25, .34], [.32, .46], [.39, .6], [.46, .7], [.53, .74], [.59, .725], [.63, .68], [.65, .6], [.665, .48], [.7, .3], [1, S]],
  hthrow:   [[0, S], [.08, .22], [.17, .27], [.25, .37], [.32, .52], [.39, .67], [.47, .78], [.62, .82], [.72, .7], [.67, .68], [.6, .7], [.55, .55], [.6, .28], [1, S]],
  htube:    [[0, S], [.08, .22], [.17, .27], [.25, .38], [.32, .55], [.39, .71], [.48, .83], [.71, .86], [.85, .63], [.79, .63], [.67, .73], [.52, .59], [.56, .27], [1, S]],
  hcurtain: [[0, S], [.08, .22], [.17, .27], [.25, .37], [.32, .53], [.4, .68], [.5, .79], [.77, .8], [.93, .44], [.865, .46], [.71, .66], [.53, .55], [.56, .26], [1, S]],
  hland:    [[0, S], [.08, .22], [.17, .26], [.26, .35], [.34, .48], [.43, .61], [.53, .7], [.71, .71], [.95, .27], [.89, .3], [.74, .56], [.57, .48], [.6, .25], [1, S]],
  himpact:  [[0, S], [.1, .22], [.2, .25], [.3, .31], [.4, .4], [.5, .48], [.6, .52], [.7, .52], [.78, .49], [.84, .45], [.89, .4], [.93, .34], [.97, .27], [1, S]],
  hrebuild: [[0, S], [.08, .22], [.17, .25], [.25, .31], [.33, .41], [.4, .51], [.47, .58], [.53, .6], [.58, .57], [.61, .51], [.63, .43], [.65, .35], [.7, .26], [1, S]],
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
  // "Foam on the lip" iterations (Chase, 2026-10-12): same surfaces as the originals, but the
  // foam is anchored to the wave's LIP-TIP point (surface point 8) every frame — the top-front of
  // the swell before it breaks, the pitching lip as it throws and comes down — with a size curve
  // that stays modest through impact instead of the hand-placed explosion. `tip.size` and
  // `tip.spray` are keyed on loop time like the shapes.
  returntip: {
    label: 'Whitewater return · foam on the lip', N: 10, mode: 'stay',
    keys: [[0, 'peak'], [.1, 'throw'], [.2, 'barrel'], [.3, 'land'], [.4, 'impact'], [.55, 'rebuild'], [.75, 'rebuild2'], [1, 'peak']],
    tip: { size: [[0, .055], [.1, .06], [.2, .07], [.3, .085], [.4, .095], [.55, .075], [.75, .06], [1, .055]],
           spray: [[0, 0], [.2, 0], [.3, .45], [.4, .3], [.5, 0], [1, 0]] },
  },
  classictip: {
    label: 'Classic break · foam on the lip', N: 12, mode: 'stay',
    keys: [[0, 'swell'], [2 / 12, 'rising'], [4 / 12, 'peak'], [5 / 12, 'throw'], [6 / 12, 'barrel'], [7 / 12, 'land'],
           [8 / 12, 'impact'], [9 / 12, 'slump'], [10 / 12, 'reswell1'], [11 / 12, 'reswell2'], [1, 'swell']],
    tip: { size: [[0, 0], [2 / 12, .03], [4 / 12, .05], [5 / 12, .06], [6 / 12, .07], [7 / 12, .09], [8 / 12, .1], [9 / 12, .085], [10 / 12, .06], [11 / 12, .03], [1, 0]],
           spray: [[0, 0], [6 / 12, 0], [7 / 12, .45], [8 / 12, .3], [9 / 12, 0], [1, 0]] },
  },
  // The logo's snowy plover (Chase, 2026-10-29): side view facing left, scurrying — wings flap once
  // and the legs take one stride per loop, with a little body bob. Drawn procedurally by sprite().
  plover: {
    label: 'Snowy plover · flap + run', N: 10, mode: 'stay', kind: 'sprite',
    layers: { water: '#efe7d2', foam: '#1d3050' }, layerNames: { water: 'body', foam: 'details' },
  },
  // v5 (Chase, 2026-11-04): the plover getting barreled — a navy silhouette crouched on a cream
  // surfboard inside an open tube (the ring colour shows through), looking out of its mouth. Only a little moves: the lip breathes, spray flicks off its tip,
  // the bird bobs, rocks its board and balances on its wing. Drawn by barrelScene().
  plovertube: {
    label: 'Plover in the barrel', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'lip, board, eye' },
    motion: { lip: .4, walk: .06, crest: .01, bob: .008, wing: [0, 6], tilt: 1.5, crouch: .25 },
  },
  ploverspit: {
    label: 'Plover · the barrel spits', N: 8, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'lip, spray, board, eye' },
    motion: { lip: .4, walk: .06, crest: .008, bob: .006, wing: [3, 8], tilt: 2, crouch: .45, spit: 1 },
  },
  plovertuck: {
    // the lip pitches out and down mid-loop while the bird tucks under it, then both open up again
    label: 'Plover · tuck and stand', N: 9, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'lip, board, eye' },
    motion: { lip: .4, walk: .06, crest: .015, bob: .003, wing: [0, 6], tilt: 1, crouch: .8, tuck: true },
  },
  // v5 options (Chase, 2026-11-04: "foam a little closer to whitewater return", "legs crossed over each
  // other"): the lip's foam is the whitewater-return cluster of round bubbles riding its tip, growing as
  // it throws over (foam: 'ww'); legs: 'cross' = crossed stance (each foot under the other hip),
  // lead: 'back' = cross-stepping (the back foot crosses over the front one, like walking to the nose).
  ploverwash: {
    label: 'Plover · whitewater lip', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .22, reach: 1, walk: .036, lift: .018, crest: .01, bob: .005, tilt: .9, crouch: .15, foam: 'ww', splash: 1 },
  },
  plovercross: {
    label: 'Plover · crossed legs', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .22, reach: 1, walk: .036, lift: .018, crest: .01, bob: .005, tilt: .9, crouch: .15, foam: 'ww', splash: 1, legs: 'cross' },
  },
  ploverxstep: {
    label: 'Plover · cross-steps', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .22, reach: 1, walk: .054, lift: .018, stance: .6, crest: .01, bob: .004, tilt: .9, crouch: .12, foam: 'ww', splash: 1, lead: 'back' },
  },
  // Cross-step with a breathing back (Chase, 2026-11-04): "when it's not fully barreling the back of the
  // wave a little bit wider, and when the whitewater has crashed it should compress and get skinnier".
  // back = how far the back slope widens / narrows about the crest (± fraction); backLag = how far behind
  // the lip it moves (loop fraction); rise = how much the back stands up as it narrows. The wave also sits
  // further right (shift .32) while the plover stays where it was (birdShift .22), clearing its tail.
  ploverback: {
    label: 'Plover · cross-steps, breathing back', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .32, birdShift: .22, reach: 1, walk: .054, lift: .018, stance: .6, crest: .01, bob: .004, tilt: .9, crouch: .12, foam: 'ww', splash: 1, lead: 'back', back: .12 },
  },
  ploverbacklag: {
    label: 'Plover · cross-steps, back follows the crash', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .32, birdShift: .22, reach: 1, walk: .054, lift: .018, stance: .6, crest: .01, bob: .004, tilt: .9, crouch: .12, foam: 'ww', splash: 1, lead: 'back', back: .14, backLag: .1 },
  },
  ploverbackrise: {
    label: 'Plover · cross-steps, back stands up', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .32, birdShift: .22, reach: 1, walk: .054, lift: .018, stance: .6, crest: .01, bob: .004, tilt: .9, crouch: .12, foam: 'ww', splash: 1, lead: 'back', back: .12, backLag: .05, rise: .07 },
  },
  // Cross-step, round 3 (Chase, 2026-11-04): "plover is moving too far forward and the beak is hitting the
  // wave", "make the surfboard wobble a little more", the breathing back doesn't look natural — "maybe the
  // whole wave is moving right to left". The walk is shorter (.04, was .054) and the bird sits in the middle
  // of the tube (≥ 0.03 clear of the lip ahead and the back wall behind in every frame); the board rocks more
  // (tilt 2°, plus a quicker wobble twice a loop). Then one whole-wave motion per option (see barrelScene).
  ploverxstep2: {
    label: 'Plover · cross-steps, shorter walk, wobblier board', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .25, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back' },
  },
  ploverfull: {
    label: 'Plover · cross-steps, back fills and hollows', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .25, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', full: .09, fullLag: .05 },
  },
  ploverswell: {
    label: 'Plover · cross-steps, swell rolls up the back', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .25, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', swell: .07 },
  },
  ploverlean: {
    label: 'Plover · cross-steps, wave leans into the throw', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .25, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07 },
  },
  // Texture riffs on the lean (Chase, 2026-11-04: liking the lean, "should we add any texture to the wave
  // itself?"): see TEX / texture(). Lines sit a fixed depth under the surface, so they lean and throw with it.
  ploverleanlines: {
    label: 'Plover · lean + flowing face lines', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .25, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { face: 1, dash: 2 } },
  },
  // Print round (Chase, 2026-11-07: the slice dropped the plover's outline and legs and the lip line — "if we
  // made the inner diameter go further in we would have more space to enlarge features, especially with 8 or
  // 9 frames"): lean + lines on 8 frames (the v6 band is 28% taller) with every plover stroke at least 0.03.
  // The bolder outline ate the bird's clearance, and frame 7 (t .75) lands on the foam ball's closest pass
  // (10 frames straddled it at 0.06 mm): the bird is 92%, a touch further back, with a shorter bill (tip at
  // 350 px, was 312) — ≥ 0.43 mm from the wave and ≥ 0.47 mm from the foam in every frame.
  ploverleanbold: {
    label: 'Plover · lean + lines, bold for print (8 frames)', N: 8, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .275, birdScale: .92, bill: 350, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { face: 1, dash: 2 }, bold: .03 },
  },
  // 0.2 mm nozzle round (Chase, 2026-11-07: "I tried .2 and the beak still didn't come out"). Measured on the
  // ring: the logo bill as drawn is a 1.1 mm triangle only 0.38 mm tall at its base — under two 0.22 mm lines
  // even on a 0.2 nozzle, so the slicer keeps a stub at best. Same scene and bird as ploverleanedge (the compact
  // frame, sea down to the ring's inner rim, every stroke ≥ 0.03 of the band ≈ 0.46 mm = two 0.2-nozzle
  // lines; Chase, 2026-11-07: "is this the compacted bold iteration as well? I'd like the blue to go to the
  // rim"), but the bill is the logo's wedge (billWedge):
  // 60 px (0.87 mm) tall at the head, tapering to a round 32 px (0.46 mm) tip at x 330, ~1.3 mm out of the head.
  ploverleanfine: {
    label: 'Plover · compact, sea to the rim, wedge bill, thicker wave, bigger bird — for a 0.2 nozzle (8 frames)', N: 8, mode: 'stay', kind: 'scene', sea: 'edge', frame: [0.17, 1.93], ceiling: .06,
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .36, birdScale: 1.03, boardScale: 1.08, bill: 330, billBase: 60, billTip: 32, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { face: 1, dash: 2 }, bold: .03,
      squeeze: { at: 1.3, crash: .72, splash: .8 } },
  },
  // ---- exploration round (Chase, 2026-11-08: "do you think it's necessary at this point for 0.2mm or is there a
  // way to still have a cool design without .2mm? Should we add details in the water itself? should we make the
  // wave a little thicker since there's room above plover header?"). All beside ploverleanfine, none default.
  // sea: ploverleanfine + ripples in the flat sea under the tube's mouth (detail BELOW the wave).
  ploverleansea: {
    label: 'Explore · ripples in the sea below the wave (0.2 nozzle, 8 frames)', N: 8, mode: 'stay', kind: 'scene', sea: 'edge', frame: [0.17, 1.93], ceiling: .06,
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .36, birdScale: 1.03, boardScale: 1.08, bill: 330, billBase: 60, billTip: 32, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { face: 1, dash: 2, sea: 2 }, bold: .03,
      squeeze: { at: 1.3, crash: .72, splash: .8 } },
  },
  // thick: the tube's roof 0.06 lower (≈ 1 mm more navy over the bird). (Promoted into ploverleanfine with `room`, 2026-11-08.)
  ploverleanthick: {
    label: 'Explore · thicker wave over the bird (0.2 nozzle, 8 frames)', N: 8, mode: 'stay', kind: 'scene', sea: 'edge', frame: [0.17, 1.93], ceiling: .06,
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .34, birdScale: .92, bill: 330, billBase: 60, billTip: 32, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { face: 1, dash: 2 }, bold: .03,
      squeeze: { at: 1.3, crash: .72, splash: .8 } },
  },
  // room: the bird grown 1.12× to fill the tube instead, roof 0.03 lower.
  ploverleanroom: {
    label: 'Explore · bigger bird fills the tube (0.2 nozzle, 8 frames)', N: 8, mode: 'stay', kind: 'scene', sea: 'edge', frame: [0.17, 1.93], ceiling: .03,
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .36, birdScale: 1.03, boardScale: 1.08, bill: 330, billBase: 60, billTip: 32, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { face: 1, dash: 2 }, bold: .03,
      squeeze: { at: 1.3, crash: .72, splash: .8 } },
  },
  // water: more going on in the navy — a second face line, the lines inside the tube, bubbles up the back.
  ploverleanwater: {
    label: 'Explore · more detail in the water (0.2 nozzle, 8 frames)', N: 8, mode: 'stay', kind: 'scene', sea: 'edge', frame: [0.17, 1.93],
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .34, birdScale: .92, bill: 330, billBase: 60, billTip: 32, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { face: 1, face2: 1, barrel: 1, dash: 2, bubbles: 1 }, bold: .03,
      squeeze: { at: 1.3, crash: .72, splash: .8 } },
  },
  // silhouette: the 0.4-nozzle candidate. No navy outline — the cream bird sits straight on the ring colour, its
  // edge drawn by the colour change — and every navy detail (cap, collar, eye, legs, bill) and every cream line
  // ≥ 0.052 of the band ≈ 0.9 mm = two 0.4-nozzle lines. Bird 1.08× and the roof 0.03 lower to make room.
  ploverleansilhouette: {
    label: 'Explore · silhouette bird, no outline — for a 0.4 nozzle (8 frames)', N: 8, mode: 'stay', kind: 'scene', sea: 'edge', frame: [0.17, 1.93], ceiling: .03,
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .355, birdScale: .99, boardScale: 1.05, boardThick: 1.3, noOutline: 1, noCap: 1, bill: 322, billBase: 70, billTip: 62, raise: .035, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { face: 1, dash: 2, geo: { face: { w: .052 } } }, bold: .052,
      squeeze: { at: 1.3, crash: .72, splash: .8 } },
  },
  // Compact frame, sea to the edge (Chase, 2026-11-07: "let's [run the sea to the ring's edge] but we need to also
  // make more use of the frame — there's some unused space on the right, the plover tail could go into the wave
  // for part of the animation and the left part of the wave crash maybe can be partly compressed"): the bold
  // print round with the lip's throw, foam ball and splash pressed back towards the tube (squeeze) and the
  // plover 0.065 further into it, so its tail dips into the back wall for frames 1–5 (as it steps back) and is
  // ≥ 0.45 mm clear of it in 6–8; head, bill and feet stay ≥ 0.47 mm from the wave, ≥ 0.95 from the foam. The
  // scene then fills a 1.76-wide frame instead of 2.06, and 8 slots of that fill a band from r 30.6: the art is
  // 14% bigger again, and the sea runs on down to the ring's inner edge (sea: 'edge', see artBand).
  ploverleanedge: {
    label: 'Plover · bold, compact frame, sea to the edge (8 frames)', N: 8, mode: 'stay', kind: 'scene', sea: 'edge', frame: [0.17, 1.93],
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .34, birdScale: .92, bill: 350, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { face: 1, dash: 2 }, bold: .03,
      squeeze: { at: 1.3, crash: .72, splash: .8 } },
  },
  // The plover as the hero (Chase, 2026-11-07, after ploverleanedge: "it still looks awful sliced, most of the
  // plover features don't come out, and there's way more room in the frame"; "don't design a beak if it's going
  // to disappear in the slice"). The rule: no part and no gap of ring colour narrower than two nozzle lines
  // (0.9 mm) anywhere on the ring. The barrel (`tube`) is redrawn round the chunky print bird (`big`, see
  // chunky()) at 1.25×: the trough drops to the band's foot (level .08; the sea carries on to the ring's edge),
  // the ceiling and back wall wrap the bird with ≥ 1.1 mm of ring colour all round, and every stroke is 0.06 of
  // the band (~1 mm). No splash droplets; the foam ball's bubbles, the lip line and the face dashes never taper
  // below the stroke. The scene fits a 1.85-wide frame, so 8 slots fill r 31.3–48.2.
  ploverbig: {
    label: 'Plover · big bird, barrel wrapped round it (8 frames)', N: 8, mode: 'stay', kind: 'scene', sea: 'edge', frame: [0.1, 1.95], level: .08,
    tube: [[0, .08], [.1, .09], [.15, .2], [.19, .4], [.25, .6], [.34, .77], [.46, .89], [.64, .95], [.9, .97], [1.12, .965],
      [1.34, .92], [1.53, .82], [1.66, .66], [1.71, .5], [1.68, .4], [1.6, .45], [1.55, .56], [1.45, .67], [1.33, .765], [1.18, .82],
      [.98, .83], [.8, .76], [.68, .62], [.63, .46], [.63, .3], [.7, .15], [.95, .1], [1.3, .095], [1.7, .09], [DA, .08]],
    lipPivot: [1.2, .9],
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .2, reach: .7, ball: .85, spread: .8, shift: 0, birdShift: .06, birdY: .09, birdScale: 1.25, boardScale: 1.2, big: 1, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 0, lean: .05, tex: { face: 1, dash: 2, geo: { face: { w: .06, depth: .16 } } }, bold: .06 },
  },
  // Open face, no barrel (Chase, 2026-11-07, option 1 of the rethink). The logo plover keeps its collar, legs,
  // beak and cap at ~1.75× (every stroke lifted to ≥ 0.055 of the band, ~0.95 mm); the wave rises behind it.
  ploverface: {
    label: 'Plover · open face, no barrel (8 frames)', N: 8, mode: 'stay', kind: 'scene', sea: 'edge', frame: [0.08, 1.95], level: .08,
    face: [[0, [[0, .08], [.3, .11], [.7, .155], [1.0, .2], [1.2, .26], [1.34, .36], [1.44, .48], [1.5, .58], [1.5, .64], [1.46, .68], [1.42, .69],
               [1.38, .68], [1.35, .7], [1.35, .77], [1.37, .86], [1.48, .94], [1.6, .97], [1.73, .93], [1.82, .8], [1.87, .58], [1.9, .33], [1.92, .15], [1.94, .09], [DA, .08]]]],
    lipLine: [12, 18], tip: 12, faceLine: [4, 8, .1], lip: [9, 16, 12], lipPivot: [1.62, .82],
    layerNames: { water: 'wave + plover', foam: 'whitewater, lip, board, bird' },
    motion: { print: 1, birdScale: 1.6, boardScale: 1.2, boardThick: 1.45, tiltBase: 5, birdX: .58, birdY: .155, bill: 296, billBase: 64, billTip: 36, walk: .02, lift: .02, lead: 'back', stance: 1, headScale: 1.2, crouch: .03, bob: .004, tilt: 1.5, wobble: .5, bold: .062, ball: .065, lip: .15, reach: 1, lean: .04, dash: 2 },
  },
  ploverleancarve: {
    label: 'Plover · lean + carved face lines', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .25, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { face: 1, dash: 2, carve: 1 } },
  },
  ploverleanbarrel: {
    label: 'Plover · lean + spinning barrel lines', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .25, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { barrel: 1, dash: 2 } },
  },
  ploverleanbubbles: {
    label: 'Plover · lean + bubbles up the face', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .25, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { bubbles: 1 } },
  },
  ploverleancarvecut: {
    label: 'Plover · lean + carved woodcut', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .25, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { face: 1, face2: 1, carve: 1 } },
  },
  ploverleanwoodcut: {
    label: 'Plover · lean + woodcut strokes', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, lines, board, bird' },
    motion: { lip: .3, shift: .3, birdShift: .25, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', lean: .07, tex: { face: 1, face2: 1 } },
  },
  ploverslide: {
    label: 'Plover · cross-steps, whole wave surges left', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .37, birdShift: .32, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', slide: .07 },
  },
  ploverlive: {
    label: 'Plover · cross-steps, all of it a little', N: 10, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .35, birdShift: .3, reach: 1, walk: .04, lift: .018, stance: .6, crest: .01, bob: .006, tilt: 2, wobble: .8, crouch: .12, foam: 'ww', splash: 1, lead: 'back', full: .05, fullLag: .05, swell: .04, lean: .03, slide: .05 },
  },
  plovertuckx: {
    label: 'Plover · tuck, crossed legs', N: 9, mode: 'stay', kind: 'scene',
    layerNames: { water: 'wave + plover', foam: 'whitewater, board, bird' },
    motion: { lip: .3, shift: .22, reach: .85, walk: .036, lift: .018, crest: .012, bob: .002, tilt: .6, crouch: .48, tuck: true, foam: 'ww', splash: 1, legs: 'cross' },
  },
  hollow: {
    // like the whitewater return, but the lip throws far out instead of pitching straight down: it lands
    // near the right edge, explodes, and the foam is drawn back to the left and up into the next lip
    label: 'Hollow throw', N: 10, mode: 'stay',
    keys: [[0, 'hpeak'], [.1, 'hthrow'], [.2, 'htube'], [.31, 'hcurtain'], [.41, 'hland'], [.52, 'himpact'], [.72, 'hrebuild'], [1, 'hpeak']],
    tip: { size: [[0, .05], [.1, .055], [.2, .06], [.31, .065], [.41, .09], [.52, .12], [.62, .1], [.72, .07], [.86, .055], [1, .05]],
           spray: [[0, 0], [.31, 0], [.41, .5], [.52, .4], [.62, 0], [1, 0]] },
  },
  barrel: {
    label: 'Barrel loop', N: 8, mode: 'stay',
    keys: [[0, 'peak'], [2 / 8, 'throw'], [3 / 8, 'barrel'], [4 / 8, 'land'], [5 / 8, 'impact'], [6 / 8, 'rebuild'], [7 / 8, 'rebuild2'], [1, 'peak']],
    foam: [[0, [.9, .3, 0, 0]], [1 / 8, [.66, .8, 0, 0]], [2 / 8, [.7, .84, .05, 0]], [3 / 8, [.79, .79, .06, 0]], [4 / 8, [.84, .36, .1, .6]],
           [5 / 8, [.82, .48, .16, 1]], [6 / 8, [.88, .4, .13, .3]], [7 / 8, [.94, .32, .08, 0]], [1, [.98, .27, 0, 0]]],
  },
};
// ---- v8 candidates: sea life in the water below the wave (Chase, 2026-11-09: "make some options for a fish, whale or
// dolphin in the water below the wave. Basically I want to fill in some of the empty space with something cool").
// All are ploverleanfine (v7, 0.2 nozzle) plus `life`: creatures drawn in cream in the navy sea under the board, see
// SEA_LIFE / seaLife(). The open gold beside the wave is too narrow (≈ 1.5 mm at r 36) or taken by the foam ball, so
// they stay under water: r 30.15 → 33.85 (3.7 mm) between the ring's inner edge and the board.
const FINE = WAVE_VARIANTS.ploverleanfine;
const v8 = (label, life) => ({ ...FINE, label: `v8 · ${label} (0.2 nozzle, 8 frames)`, life });
Object.assign(WAVE_VARIANTS, {
  // three small fish milling under the board, each on its own little loop, tails beating twice a loop
  ploverfish: v8('three fish under the board', [
    { kind: 'fish', at: [-10.2, 31.6], dx: .7, dr: .25, ph: 0, beats: 2 },
    { kind: 'fish', at: [-4.4, 32.25], dx: .6, dr: .2, ph: .35, beats: 2 },
    { kind: 'fish', at: [1.6, 31.45], dx: .7, dr: .25, ph: .7, beats: 2 }]),
  // a school swimming through: fish every 7.6 mm moving one spacing left per loop, so in the video they stream
  // continuously under the wave; only whole fish are drawn, so one appears at the right edge and is gone at the left
  ploverschool: v8('a school of fish swimming through', [
    { kind: 'fish', at: [-8, 31.55], run: 7.6, copies: 4, alt: .55, beats: 2 }]),
  // one dolphin porpoising under the board: the body undulates, the flukes beat once a loop
  ploverdolphin: v8('a dolphin under the board', [
    { kind: 'dolphin', at: [-6.8, 31.55], dx: .6, dr: .2, ph: .15, beats: 1, scale: 1.15 }]),
  // a humpback gliding under the whole wave: long pectoral fin, slow fluke beat
  ploverwhale: v8('a humpback whale under the wave', [
    { kind: 'whale', at: [-9.6, 32.4], dx: .45, dr: .14, ph: .1, beats: 1 }]),
});
// ---- v10 candidates: a more natural throw (see throwLip). All are ploverfish (v8's three fish, Chase 2026-11-13: "I think
// ploverfish is better") with the lip rebuilt as a sheet falling to the water; the plover, board and back of the wave as v7.
const FISH = WAVE_VARIANTS.ploverfish;
const v10 = (label, thr, extra = {}) => ({ ...FISH, label: `v10 · ${label} (0.2 nozzle, 8 frames)`, motion: { ...FISH.motion, ...extra, throw: thr } });
// The lip's shape, shared: tip near the right of the frame on the water; crest and roof handles long and raised so the
// sheet stays high over the bird (≥ v7's roof) and then falls steeply to the tip.
const LIP = { x: 1.6, out: .75, inOut: .7, rise: .03, roof: .2, fall: .6, fallIn: .45, tip: .06, boilX: .02 };
Object.assign(WAVE_VARIANTS, {
  // the curtain: the lip lands on the water ahead of the tube and the whitewater bursts up there, flinging drops forward
  throwcurtain: v10('the lip lands on the water, whitewater bursts where it hits',
    { ...LIP, sway: .03, lift: .02, foam: 'burst', boil: .07 }),
  // the curtain with an offshore wind: spray blown back off the top of the crest as well
  throwoffshore: v10('lip lands, offshore spray blown back off the crest',
    { ...LIP, sway: .03, lift: .02, foam: 'burst', boil: .065, offshore: .45, spray: 'v1' }),
  // the pitch: the lip throws out and down over the loop and lands as it reaches furthest, then draws back up for the next
  throwpitch: v10('the lip pitches out, lands and explodes, once a loop',
    { ...LIP, x: 1.62, sway: .09, lift: .2, foam: 'burst', boil: .07, drops: 6 }),
  // the veil: the tip hangs short of the water and a curtain of drops falls from it into a small boil
  throwveil: v10('the tip hangs over the water, drops falling from it',
    { ...LIP, x: 1.56, y: .42, sway: .03, lift: .03, fall: .5, fallIn: .4, tip: .055, foam: 'veil', boil: .055, drops: 3 }),
  // the claw: the tip hooks back under itself before it lands, shedding drops ahead of it
  throwclaw: v10('the tip curls back under, a hooked lip',
    { ...LIP, x: 1.58, y: .36, sway: .03, lift: .03, curl: .6, rise: .07, tip: .075, fall: .5, fallIn: .4, foam: 'claw', boil: .045 }),
});
// ---- v10 round 2 (Chase, 2026-11-13: offshore "not actually offshore … the spray is somehow tied in with the flow of the
// water"; the front half "doesn't have as much of a pulse … moving almost like a rigid hook … not like a wave curling over").
// Offshore: the shoulder behind the crest lowered to open sky there, spray streaks blown back through it, clear of the
// water. Roll: the tip goes round an orbit and the lip bends with it (see orbitAt / throwLip).
const ROLL = { cx: 1.54, cy: .44, rx: .1, ry: .17, throw: .55, c0: .05, cA: .55, outA: .1, riseA: .03, roofA: .06, fallA: .35 };   // tip ≤ x 1.64: whole inside the slot
Object.assign(WAVE_VARIANTS, {
  throwoffshore2: v10('offshore spray blown back into the sky behind the crest',
    { ...LIP, sway: .03, lift: .02, foam: 'burst', boil: .065, shoulder: .14, offshore: .42 }),
  throwroll: v10('the lip rolls over: reaches out, curls down, lands, rolls back',
    { ...LIP, orbit: ROLL, foam: 'burst', boil: .07 }),
  throwrolloffshore: v10('rolling lip + offshore spray',
    { ...LIP, orbit: ROLL, foam: 'burst', boil: .065, shoulder: .14, offshore: .42 }),
  throwrollbig: v10('a bigger roll + offshore spray',
    { ...LIP, orbit: { ...ROLL, cx: 1.52, rx: .13, ry: .22, cy: .47, cA: .75, outA: .14, roofA: .08 }, foam: 'burst', boil: .07, drops: 6, shoulder: .14, offshore: .42 }),
});
// ---- v10 round 3: the lip keyed through hand-drawn poses, whitewater riding its tip (see poseAt / rideFoam).
// Tip x / y in the scene's final coordinates before the mirror (+x = the throw); the trough under the mouth is y ≈ .235.
const CURL = [   // roof / inOut: the underside's handle — low and short while the lip is a short overhang (so it has its thickness), high once it reaches over the bird
  [0,    { x: 1.36, y: .66, c: -.90, out: .55, rise: .03, roof: .00, inOut: .45, fall: .35, fallIn: .30, tip: .090, foam: .046, splash: 0 }],   // gather: a short, heavy overhang, pitching
  [.18,  { x: 1.52, y: .56, c: -.50, out: .66, rise: .04, roof: .07, inOut: .55, fall: .48, fallIn: .40, tip: .082, foam: .052, splash: 0 }],   // throw: out and starting down
  [.36,  { x: 1.62, y: .42, c: -.05, out: .76, rise: .04, roof: .15, inOut: .65, fall: .58, fallIn: .45, tip: .076, foam: .060, splash: 0 }],   // curl: falling, turning under
  [.52,  { x: 1.63, y: .27, c:  .30, out: .78, rise: .04, roof: .20, inOut: .70, fall: .62, fallIn: .45, tip: .076, foam: .080, splash: .6 }],  // land: hooked under, on the water
  [.68,  { x: 1.58, y: .30, c:  .40, out: .74, rise: .03, roof: .20, inOut: .70, fall: .60, fallIn: .45, tip: .080, foam: .090, splash: 1 }],   // boil: the burst
  [.85,  { x: 1.46, y: .50, c: -.40, out: .62, rise: .03, roof: .05, inOut: .50, fall: .45, fallIn: .38, tip: .086, foam: .062, splash: .2 }],  // recover: drawn back up
];
const curl = (label, extra = {}) => v10(label, { ...LIP, keys: CURL, foam: 'ride', ...extra });
Object.assign(WAVE_VARIANTS, {
  throwcurl: curl('the lip curls over and lands, whitewater riding its tip'),
  throwcurloffshore: curl('curling lip, offshore spray blown back round it off the whitewater', { wrap: { n: 8, reach: .22, lift: .04, r: .05, lanes: [0, .05, .095] } }),
});
// ---- v10 round 4 (Chase 2026-11-13: riff on throwcurtain and throwcurloffshore; "the offshore spray should go more back
// toward the crest"; "still the too skinny bug … an hourglass shape"). Both lips drawn with Q.taper (the sheet only ever
// thins root → tip), the spray (Q.wrap.far) carried most of the way back up the lip's outer face toward the crest.
Object.assign(WAVE_VARIANTS, {
  throwcurtain2: v10('curtain, refined: a heavy sheet tapering to the water, whitewater bursting where it lands',
    { ...LIP, sway: .03, lift: .02, foam: 'burst', boil: .07, tip: .085, taper: { p: 1.2 } }),
  throwcurtain2offshore: v10('curtain + offshore spray blown back up its face toward the crest',
    { ...LIP, x: 1.55, sway: .03, lift: .02, foam: 'burst', boil: .065, tip: .085, taper: { p: 1.2 }, wrap: { n: 8, reach: .7, far: .9, up: .92, lift: .04, r: .052, lanes: [0, .035], k0: .5, sat: 1 } }),
  throwcurl2offshore: curl('curl, refined: tapered lip, spray blown back up round it toward the crest',
    { taper: { p: 1.3 }, wrap: { n: 9, reach: .75, far: .9, up: .92, lift: .08, r: .054, lanes: [0, .045, .085], k0: .5, sat: 1 } }),
});
// ---- v10 round 5 (Chase 2026-11-13: curtain "is throwing out a bit far maybe?"; the curl "a little better but could
// still use more work to look better. riff on it. spray is looking better than before").
// Curtains landing closer in (the round-4 one came down at x 1.55, .3 past the board's nose).
const WRAP5 = { n: 9, reach: .75, far: .9, up: .92, lift: .08, r: .054, lanes: [0, .045, .085], k0: .5, sat: 1 };
const curtain = (label, x, extra = {}) => v10(label, { ...LIP, x, sway: .03, lift: .02, foam: 'burst', boil: .065, tip: .085, taper: { p: 1.2 }, wrap: { ...WRAP5, lift: .06 }, ...extra });
// Curls: rounder — the lip leaves the crest in one arc that tightens as it goes over (no flat table top), hooks back
// under itself as it comes down and lands closer in.
const CURL3 = [
  [0,    { x: 1.35, y: .65, c: -.60, out: .72, rise: .05, fall: .48, tip: .085, foam: .046, splash: 0 }],   // gather: a short lip, already arcing
  [.18,  { x: 1.46, y: .56, c: -.30, out: .74, rise: .05, fall: .52, tip: .080, foam: .052, splash: 0 }],   // throw
  [.36,  { x: 1.54, y: .42, c:  .25, out: .85, rise: .05, fall: .60, tip: .075, foam: .060, splash: 0 }],   // curl
  [.52,  { x: 1.50, y: .28, c:  .70, out: .95, rise: .05, fall: .70, tip: .072, foam: .078, splash: .6 }],  // land, hooked under
  [.68,  { x: 1.47, y: .30, c:  .75, out: .92, rise: .04, fall: .68, tip: .075, foam: .088, splash: 1 }],   // boil
  [.85,  { x: 1.41, y: .52, c: -.15, out: .74, rise: .04, fall: .52, tip: .082, foam: .062, splash: .2 }],  // recover
];
// the same curl drawn back less far between throws: every frame has a full, curling lip (a gentler pulse)
const CURL3B = [
  [0,    { x: 1.42, y: .58, c: -.35, out: .74, rise: .05, fall: .52, tip: .082, foam: .050, splash: 0 }],
  [.18,  { x: 1.50, y: .50, c: -.05, out: .80, rise: .05, fall: .56, tip: .078, foam: .055, splash: 0 }],
  [.36,  { x: 1.54, y: .40, c:  .35, out: .88, rise: .05, fall: .62, tip: .074, foam: .062, splash: 0 }],
  [.52,  { x: 1.50, y: .28, c:  .75, out: .95, rise: .05, fall: .70, tip: .072, foam: .078, splash: .6 }],
  [.68,  { x: 1.47, y: .30, c:  .80, out: .92, rise: .04, fall: .68, tip: .075, foam: .088, splash: 1 }],
  [.85,  { x: 1.44, y: .46, c:  .10, out: .80, rise: .04, fall: .56, tip: .080, foam: .062, splash: .2 }],
];
Object.assign(WAVE_VARIANTS, {
  throwcurtain3a: curtain('curtain landing closer in + offshore spray', 1.47),
  throwcurtain3b: curtain('curtain landing closer still + offshore spray', 1.40, { out: .7 }),
  throwcurl3offshore: v10('curl, rounder: one tightening arc, hooked under as it lands', { ...LIP, keys: CURL3, foam: 'ride', taper: { p: 1.3 }, wrap: WRAP5, splashN: 3 }),
  throwcurl3fulloffshore: v10('the rounder curl, drawn back less: a full curling lip in every frame', { ...LIP, keys: CURL3B, foam: 'ride', taper: { p: 1.3 }, wrap: WRAP5, splashN: 3 }),
});
// ---- v10 round 6 (Chase 2026-11-13: throwcurl3fulloffshore is a top pick; "make the wave look a littttle bit better …
// make 4 new versions and really work hard on making them look beautiful"). Round 5's lip was one cubic each side: a
// round hose of even width with a mushroom top. Here its top edge is a spiral (Q.spiral, see throwLip) that leaves the
// crest along the back of the wave, bends gently, then tightens over the bird into the hook; the sheet tapers faster
// (taper p 2) so it is heavy at the root and fine at the tip. Same timing as round 5's full curl (CURL3B, the tip on the
// same path), same whitewater and offshore spray. A 2 × 2: the spiral, with a bolder lit cream edge, as a more hollow
// tube (the tip hooking further back under, landing a little further out, a finer lip), and hollow + lit.
const curlTurn = (keys, b0, g = 1, f = () => ({})) => keys.map(([t, p]) => [t, { ...p, ...f(p), turn: b0 + g * Math.atan(p.c) * 180 / Math.PI }]);   // pose c → the spiral's turn (degrees)
const SPIRAL = { ...LIP, foam: 'ride', wrap: WRAP5, splashN: 3, spiral: { q: 2.4, lin: .5, ease: .3 }, samples: [.2, .45, .65, .8, .92], taper: { p: 2 } };
const LIT = [[0, 0], [.12, .016], [.4, .034], [.75, .042], [1, .036]];       // the cream edge: wider along the lip (round 5: up to .03)
const CURL4 = curlTurn(CURL3B, 115), CURL4H = curlTurn(CURL3B, 128, 1.3, p => ({ x: p.x + .04, tip: p.tip - .008 }));
Object.assign(WAVE_VARIANTS, {
  throwcurl4: v10('a spiral lip: leaves the crest smoothly, tightens into the hook', { ...SPIRAL, keys: CURL4 }),
  throwcurl4lit: v10('the spiral lip with a bolder lit cream edge', { ...SPIRAL, keys: CURL4, lipBand: LIT }),
  throwcurl4hollow: v10('a hollower tube: the spiral lip hooks further back under', { ...SPIRAL, keys: CURL4H, taper: { p: 2.4 } }),
  throwcurl4hollowlit: v10('the hollow tube with the lit cream edge', { ...SPIRAL, keys: CURL4H, taper: { p: 2.4 }, lipBand: LIT }),
});
export const WAVE_DEFAULT = 'classic';

// Circle layout of a whitewater cluster, in units of its size: [dx, dy, r]
const CLUSTER = [[0, 0, 1], [-.95, -.3, .75], [.95, -.25, .8], [-.5, .62, .68], [.52, .66, .62], [-1.7, -.55, .52], [1.7, -.5, .55], [0, -.75, .7]];
// Splash droplets thrown off the plover barrel's foam ball, in units of its size (+x = the way the lip throws): [dx, dy, r]
const SPLASH = [[.6, 1.75, .3], [1.5, 1.35, .26], [2.25, .75, .22], [-.4, 1.95, .22], [2.6, 1.6, .16], [1.05, 2.3, .17]];
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
// Sutherland–Hodgman clip to the cell [0,1] × [lo,TOP] (lo < 0: a sea that runs on below the band).
function clip(poly, lo = 0) {
  const cutX = (a, b, x) => [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])];
  const cutY = (a, b, y) => [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y];
  const planes = [[p => p[0] >= 0, (a, b) => cutX(a, b, 0)], [p => p[0] <= 1, (a, b) => cutX(a, b, 1)],
                  [p => p[1] >= lo, (a, b) => cutY(a, b, lo)], [p => p[1] <= TOP, (a, b) => cutY(a, b, TOP)]];
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
  // Cells narrower than the design cell (A < DA) would clip the wave at the slot edges, so the
  // whole wave is scaled down uniformly to fit; wider cells just get more flat sea either side.
  const fit = Math.min(1, A / DA);
  const X = u => place + (u - anchor) * DA / A * fit, Y = v => SEA + (v - SEA) * fit;
  const surface = smooth(at(V.keys, k, name => SHAPES[name])).map(([u, v]) => [X(u), Y(v)]);
  const water = [[surface[0][0], 0], ...surface, [surface[surface.length - 1][0], 0]];
  let cu, cv, s, spray;
  if (V.tip) {                                   // foam rides the lip tip (surface point 8)
    const tipPt = at(V.keys, k, name => SHAPES[name])[8];
    s = at(V.tip.size, k); spray = at(V.tip.spray, k); cu = tipPt[0]; cv = tipPt[1] + s * .25;
  } else [cu, cv, s, spray] = at(V.foam, k);
  cv = Y(cv); s *= fit; spray *= fit;
  const foam = [];
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

// ---- sprite styles: the plover -------------------------------------------------------------
// Shapes are drawn in a square space in v units (x right, y up, origin at the cell centre), then
// placed in the cell; like the waves they shrink uniformly if the cell is narrower than the design cell.
const rot = (pts, a, [px, py] = [0, 0]) => { const c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c]); };
const ell = (cx, cy, rx, ry, n = 24) => Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
const bar = (a, b, w) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * w / 2, ny = dx / L * w / 2; return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]; };
const deg = d => d * Math.PI / 180;
function plover(t) {
  const body = [], detail = [];
  const bob = 0.02 * Math.sin(4 * Math.PI * t), hy = 0.1 + bob + 0.015 * Math.sin(4 * Math.PI * t + 0.6);
  // body, tail, head
  body.push(ell(0, bob, 0.19, 0.12), [[0.17, 0.02 + bob], [0.29, 0.09 + bob], [0.27, -0.01 + bob]], ell(-0.2, hy, 0.085, 0.085, 20));
  // beak, eye, the logo's partial collar
  detail.push([[-0.27, hy + 0.025], [-0.42, hy - 0.01], [-0.27, hy - 0.025]], ell(-0.215, hy + 0.025, 0.026, 0.026, 12), bar([-0.135, hy + 0.06], [-0.105, hy - 0.08], 0.036));
  // wing: pivot at the shoulder, one flap per loop (+ = up); a thin dark leading edge keeps it readable over the body
  const a = deg(15 + 55 * Math.sin(2 * Math.PI * t)), piv = [0, 0.07 + bob];
  const wing = [[0, 0.035], [0.12, 0.045], [0.24, 0.03], [0.27, 0], [0.22, -0.03], [0.1, -0.04], [0, -0.03]].map(([x, y]) => [x + piv[0], y + piv[1]]);
  body.push(rot(wing, a, piv));
  detail.push(rot(bar([piv[0] + 0.01, piv[1] + 0.028], [piv[0] + 0.25, piv[1] + 0.022], 0.03), a, piv));
  // legs: two, half a stride apart; the forward-swinging leg bends at the knee; feet point forward (left)
  for (let i = 0; i < 2; i++) {
    const ph = 2 * Math.PI * t + i * Math.PI, th = deg(28) * Math.sin(ph), bend = deg(40) * Math.max(0, Math.cos(ph));
    const hip = [0.03 - 0.06 * i, -0.1 + bob], dir = f => [-Math.sin(f), -Math.cos(f)];
    const knee = [hip[0] + 0.1 * dir(th)[0], hip[1] + 0.1 * dir(th)[1]];
    const ankle = [knee[0] + 0.12 * dir(th - bend)[0], knee[1] + 0.12 * dir(th - bend)[1]];
    detail.push(bar(hip, knee, 0.042), bar(knee, ankle, 0.036), [[ankle[0] + 0.018, ankle[1] + 0.02], [ankle[0] - 0.07, ankle[1] - 0.012], [ankle[0] + 0.018, ankle[1] - 0.02]]);
  }
  return { body, detail };
}
// The bird is drawn about 0.75 cell-heights tall; SPRITE_SCALE fills the cell (legs ~0.09, wing tip ~0.95).
const SPRITE_SCALE = 1.35, SPRITE_CY = 0.52;
function sprite(V, k, A) {
  const fit = Math.min(1, A / DA) * SPRITE_SCALE, place = ([x, y]) => [0.5 + x / A * fit, SPRITE_CY + y * fit];
  const { body, detail } = plover(k);
  return { water: body.map(p => p.map(place)), foam: detail.map(p => p.map(place)) };
}

// ---- scene styles: the plover in the barrel ------------------------------------------------
// Drawn in v units: x 0 → DA left to right across the design cell, y 0 → 1 up from the band's inner
// edge, sea level SEA at both ends. The wave pitches to the RIGHT and stays open: the tube is a real
// hole in the navy, so the ring's own colour shows through it, and the plover rides inside it as a
// navy silhouette (cream eye and belly) on a cream board, looking out of the tube's mouth.
const TAU = 2 * Math.PI;
const wv = (t, ph = 0) => Math.sin(TAU * t + ph);
// A stroke of width w(s) (s 0 → 1 along the path) laid on one side of a polyline (side +1 = right of travel).
function band(path, w, side = 1) {
  const L = [0]; for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const inner = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
    const k = w(L[i] / L[L.length - 1]) * side; return [p[0] + dy / n * k, p[1] - dx / n * k];
  });
  return [...path, ...inner.reverse()];
}
// The wave, left → right along its surface: up the back, over the crest, the lip thrown far out to
// the right and curling down (outer edge, tip, inner edge), back along the tube's ceiling, down the
// back wall, then out along the trough under the tube's mouth to the right-hand edge.
const TUBE = [[0, S], [.15, .225], [.32, .3], [.45, .45], [.55, .62], [.66, .78], [.8, .89], [.98, .95], [1.2, .96], [1.42, .93],
  [1.62, .85], [1.78, .72], [1.86, .58], [1.875, .47], [1.84, .405], [1.785, .44], [1.73, .58], [1.61, .715], [1.43, .8], [1.23, .825],
  [1.03, .78], [.91, .67], [.85, .53], [.85, .41], [.9, .31], [1.05, .258], [1.3, .24], [1.6, .235], [1.85, .228], [DA, S]];
const TIP = 14, SEG = 6, LIP_PIVOT = [1.2, .9];
// Holes cut into a polygon as one simple outline: each hole is joined by a thin slit to the nearest
// vertex of the ORIGINAL outline (so slits never cross another hole). Holes may be any simple shape.
const area2 = p => p.reduce((s, [x, y], i) => { const [X, Y] = p[(i + 1) % p.length]; return s + x * Y - X * y; }, 0);
function withHoles(outer, holes) {
  const sgn = Math.sign(area2(outer)), bridges = holes.map(h => {
    h = Math.sign(area2(h)) === sgn ? [...h].reverse() : h;                     // holes run the other way round
    let i = 0, j = 0, best = Infinity;
    outer.forEach(([x, y], k) => h.forEach(([X, Y], m) => { const d = Math.hypot(x - X, y - Y); if (d < best) { best = d; i = k; j = m; } }));
    return { i, ring: [...h.slice(j), ...h.slice(0, j), h[j]] };
  }).sort((a, b) => b.i - a.i);
  let out = [...outer];
  for (const { i, ring } of bridges) {
    const [ox, oy] = out[i], nx = out[(i + 1) % out.length], L = Math.hypot(nx[0] - ox, nx[1] - oy) || 1, e = Math.min(0.0015 / L, 0.4);
    const r0 = ring[0], r1 = ring[1], M = Math.hypot(r1[0] - r0[0], r1[1] - r0[1]) || 1, f = Math.min(0.0015 / M, 0.4);
    ring[ring.length - 1] = [r0[0] + (r1[0] - r0[0]) * f, r0[1] + (r1[1] - r0[1]) * f];           // re-enter just beside the start: a slit, not a seam
    out = [...out.slice(0, i + 1), ...ring, [ox + (nx[0] - ox) * e, oy + (nx[1] - oy) * e], ...out.slice(i + 1)];
  }
  return out;
}
// Closed Chaikin smoothing.
function chaikin(p, n = 3) {
  for (let k = 0; k < n; k++) p = p.flatMap((a, i) => { const b = p[(i + 1) % p.length]; return [[.75 * a[0] + .25 * b[0], .75 * a[1] + .25 * b[1]], [.25 * a[0] + .75 * b[0], .25 * a[1] + .75 * b[1]]]; });
  return p;
}
// A smooth closed outline pushed out by d along its normals (the navy outline round the bird).
function grow(p, d) {
  const s = Math.sign(area2(p));
  return p.map((q, i) => { const a = p[(i + p.length - 1) % p.length], b = p[(i + 1) % p.length], dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1; return [q[0] + s * dy / n * d, q[1] - s * dx / n * d]; });
}
// The Surftober plover (the logo bird), facing left, standing on its board; origin = middle of the deck.
// Traced from the logo in its own pixels (head circle r 65 at 470,480; feet at y 870) and scaled down.
// Cream bird; navy cap, eye and partial collar show through holes; navy bill and long thin legs; a navy
// outline round the cream so it reads against the ring colour inside the tube.
const LOGO = { s: 0.00094, x0: 580, y0: 870 };
const lp = ([x, y]) => [(x - LOGO.x0) * LOGO.s, (LOGO.y0 - y) * LOGO.s];
// body + neck, reaching up into the head circle (but clear of the cap and eye) so they join without a seam
const LOGO_BODY = chaikin([[528, 462], [562, 482], [592, 500], [650, 501], [728, 516], [806, 543], [868, 572], [912, 598], [868, 612], [800, 646],
  [725, 688], [650, 712], [590, 713], [540, 692], [505, 655], [490, 612], [478, 560], [460, 530]], 3).map(lp);
// the same body with the tail's point blunted (the chunky print bird: a point can't print)
const LOGO_BODY_BLUNT = chaikin([[528, 462], [562, 482], [592, 500], [650, 501], [728, 516], [806, 543], [860, 568], [892, 585], [902, 600], [888, 613], [850, 622], [800, 646],
  [725, 688], [650, 712], [590, 713], [540, 692], [505, 655], [490, 612], [478, 560], [460, 530]], 3).map(lp);
const LOGO_COLLAR = [[588, 495], [582, 560], [551, 616], [512, 652], [495, 634], [527, 597], [553, 551], [560, 498]].map(lp);
// q: where the bird is in its walk, 0 = stepped back (lip thrown over), 1 = stepped forward (lip pulled back).
// Two steps each way: the front foot then the back foot going forward, the back foot then the front going back.
// M.bold (print, 2026-11-07): the thinnest stroke, in cell heights. The logo's outline (0.022), legs (0.026),
// board rim (0.018), eye (Ø0.026) and cap (0.028 tall) are under a 0.4 nozzle's line at any ring size that
// fits; bold lifts each of them to at least this (0.03 ≈ 0.46 mm on the 8-frame v6 band).
// The chunky print plover (M.big, 2026-11-07, Chase: "don't design a beak if it's going to disappear in the
// slice"): the logo plover rebuilt so every part, in every colour, is at least M.bold wide (~0.95 mm, two
// nozzle lines) — the ring-colour gaps between parts too. The logo's body outline stays; the head is 1.6× so a
// navy cap (≥ B thick), a round eye hole (Ø ≥ B) and the cream between them all fit; the bill is a blunt stub;
// two straight legs ≥ B wide with ≥ B between them, standing still (the 0.7 mm cross-step can't print); a thick
// board with blunt ends. The partial collar is left out: at this size it and the cream either side of it can't
// all be ≥ B.
function chunky(t, M) {
  const B = M.bold, navy = [], cream = [], c = M.crouch * (0.5 + 0.5 * wv(t, 2));
  const tilt = deg(-3 + M.tilt * wv(t, 1.3) + (M.wobble || 0) * Math.sin(2 * TAU * t + 0.4)), drop = 0.05 * c - M.bob * wv(t);
  // board: blunt nose left, squash tail right; never thinner than B (cream) inside a B navy rim
  const top = [], bot = [], kb = M.boardScale || 1, kt = M.boardThick || 1.5;
  for (let i = 0; i <= 22; i++) {
    const s = 0.02 + 0.96 * i / 22, x = 0.29 - 0.58 * s, rock = 0.045 * s ** 3, th = 0.65 + 0.35 * Math.sin(Math.PI * s) ** 0.5;
    top.push([x * kb, rock * kb + 0.022 * th * kb * kt]); bot.push([x * kb, rock * kb - 0.02 * th * kb * kt]);
  }
  const cap = (a, b, dir) => { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], h = Math.hypot(a[0] - b[0], a[1] - b[1]) / 2;   // round end from a to b
    return Array.from({ length: 7 }, (_, i) => { const th = Math.PI * (i + 1) / 8; return [m[0] + dir * Math.sin(th) * h, m[1] + (a[1] > b[1] ? 1 : -1) * Math.cos(th) * h]; }); };
  const nose = cap(top[22], bot[22], -1), tail = cap(bot[0], top[0], 1);
  const board = rot([...top, ...nose, ...[...bot].reverse(), ...tail], tilt);
  navy.push(grow(board, B)); cream.push(board);
  // the bird sits tucked down on its board (no legs: the 1 mm between belly and deck left slivers of ring colour
  // either side) and rides it — tilting with it and leaning into the ride with the crouch
  const lean = deg(-4 - 5 * c), bs = M.birdScale || 1, hs = M.headScale || 1.6, deckY = 0.022 * kb * kt;
  const P0 = q => rot([[q[0] * bs, q[1] * bs]], lean, [0, 0.2])[0];
  const sit = deckY + B - Math.min(...LOGO_BODY_BLUNT.map(q => P0(q)[1]));          // belly outline on the board's rim
  const P = q => rot([P0(q).map((v, i) => v + [0, sit][i])], tilt)[0];
  const body = LOGO_BODY_BLUNT.map(P), hc = P(lp([470, 480])), rh = 65 * LOGO.s * bs * hs;
  const head = ell(...hc, rh, rh, 48);
  // bill: a blunt stub at eye height, out of the head's outline to the left and a little down
  const ba = deg(188) + lean, bd = [Math.cos(ba), Math.sin(ba)], bn = [-bd[1], bd[0]], b0 = rh * 0.75, b1 = rh + B + B * 1.2, bw0 = B * 1.5, bw1 = B * 1.05;
  const by = [hc[0] + bd[0] * 0 + bn[0] * -0.1 * rh, hc[1] + bn[1] * -0.1 * rh];
  const bp = (d, w) => [[by[0] + bd[0] * d + bn[0] * w / 2, by[1] + bd[1] * d + bn[1] * w / 2], [by[0] + bd[0] * d - bn[0] * w / 2, by[1] + bd[1] * d - bn[1] * w / 2]];
  const [p0, p1] = bp(b0, bw0), [p2, p3] = bp(b1, bw1);
  navy.push([p0, p2, p3, p1]);
  navy.push(grow(body, B), grow(head, B));
  // fill the thin wedges of ring colour where the belly curves away from the board (under 1 mm deep)
  const ob = grow(body, B), dy = x => Math.tan(tilt) * x + deckY / Math.cos(tilt);
  const low = ob.filter(([x, y]) => y < dy(x) + B + 0.06).sort((a, b) => a[0] - b[0]);
  if (low.length > 2) navy.push([...low, ...[...low].reverse().map(([x]) => [x, dy(x) - 0.005])]);
  const capY = hc[1] + rh * 0.6;
  cream.push(body.map(([x, y]) => [x, Math.min(y, capY)]));               // the neck stops at the cap too, so no cream spike pokes up into it
  // head: cream below a cap chord (cap ≥ B thick, navy, joined to the outline), with a round eye hole
  const er = Math.max(B * 0.55, 0.03), eye = ell(hc[0] - rh * 0.12, hc[1] - rh * 0.05, er, er, 18);
  const face = ell(...hc, rh, rh, 48).map(([x, y]) => [x, Math.min(y, capY)]);
  cream.push(withHoles(face, [eye]));
  return { navy, cream };
}
// print: the logo's bill as a wedge billBase px tall at the head, tapering to a round tip billTip px across at M.bill
function billWedge(M) {
  const b0 = [418, 536], b1 = [M.bill, 550], dx = b1[0] - b0[0], dy = b1[1] - b0[1], L = Math.hypot(dx, dy), n = [-dy / L, dx / L], h0 = M.billBase / 2, h1 = M.billTip / 2;
  const arc = Array.from({ length: 9 }, (_, i) => { const a = Math.PI / 2 - Math.PI * i / 8; return [b1[0] + (n[0] * Math.sin(a) + dx / L * Math.cos(a)) * h1, b1[1] + (n[1] * Math.sin(a) + dy / L * Math.cos(a)) * h1]; });
  return [[b0[0] + n[0] * h0, b0[1] + n[1] * h0], ...arc, [b0[0] - n[0] * h0, b0[1] - n[1] * h0]];
}
function surfer(t, M, q = 0.5) {
  if (M.big) return chunky(t, M);
  const B = M.bold || 0, W = w => Math.max(w, B);
  const navy = [], cream = [], c = M.tuck ? M.crouch * (0.5 - 0.5 * Math.cos(TAU * t)) : M.crouch * (0.5 + 0.5 * wv(t, 2));
  const tilt = deg((M.tiltBase ?? -3) + M.tilt * wv(t, 1.3) + (M.wobble || 0) * Math.sin(2 * TAU * t + 0.4)), drop = 0.05 * c - M.bob * wv(t);   // the knees take the crouch and the bob; tiltBase: the board's angle on the face
  // board: pointed nose left, squash tail right, nose rocker; navy-rimmed so it reads on the gold
  const top = [], bot = [], kb = M.boardScale || 1, kt = M.boardThick || 1;      // boardScale: a bigger board under a bigger bird
  for (let i = 0; i <= 22; i++) {
    const s = 0.02 + 0.96 * i / 22, x = 0.29 - 0.58 * s, rock = 0.045 * s ** 3, th = M.print ? 0.8 + 0.2 * Math.sin(Math.PI * s) ** 0.5 : Math.sin(Math.PI * s) ** 0.5;
    top.push([x * kb, rock * kb + 0.022 * th * kb * kt]); bot.push([x * kb, rock * kb - 0.02 * th * kb * kt]);
  }
  // print: round ends instead of points (a point can't print)
  const endCap = (a, b, dir) => { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], h = Math.hypot(a[0] - b[0], a[1] - b[1]) / 2;
    return Array.from({ length: 7 }, (_, i) => { const th = Math.PI * (i + 1) / 8; return [m[0] + dir * Math.sin(th) * h, m[1] + (a[1] > b[1] ? 1 : -1) * Math.cos(th) * h]; }); };
  const board = rot(M.print ? [...top, ...endCap(top[22], bot[22], -1), ...[...bot].reverse(), ...endCap(bot[0], top[0], 1)] : [...top, ...bot.reverse()], tilt);
  navy.push(grow(board, W(0.018))); cream.push(board);
  const deck = x => rot([[x, 0.022 * kb * kt]], tilt)[0];
  // the bird above its feet, lowered by the crouch, leaning into the ride a touch
  const A = M.walk || 0, ss = x => (x = Math.min(1, Math.max(0, x)), x * x * (3 - 2 * x));
  const lift = [A - 2 * A * q, -drop + (M.raise || 0)], lean = deg(-4 - 5 * c), bs = M.birdScale || 1, P = q => rot([[q[0] * bs, q[1] * bs]], lean, [0, 0.2])[0].map((v, i) => v + lift[i]);   // birdScale: about the middle of the deck
  const hr = 65 * (M.print ? M.headScale || 1 : 1);                          // print: the head a little bigger, so cap, cream and eye are each ≥ B
  const body = (M.print ? LOGO_BODY_BLUNT : LOGO_BODY).map(P), head = ell(...lp([470, 480]), hr * LOGO.s, hr * LOGO.s, 48).map(P);
  // legs: from the belly to the feet on the deck, knees flexing forward with the crouch; flat feet, toes left
  const sw = M.stance ?? 1, fs = M.birdScale || 1, feet = (M.legs === 'cross' ? [0.065, -0.055] : [-0.055, 0.065]).map(x => (0.005 + (x - 0.005) * sw) * (M.big || M.print ? fs : 1));   // crossed: each foot under the other hip
 const ff = M.big || M.print ? fs : 1;                                                 // big: the feet grow with the bird
  [530, 628].forEach((lx, n) => {
    const fx = feet[n], j = (fx < 0) === (M.lead !== 'back') ? 0 : 1;          // which foot steps first going forward
    const st = 2 * q - j, up = st > 0 && st < 1 ? (M.lift ?? 0.03) * Math.sin(Math.PI * st) : 0;           // this foot's step: lifted mid-swing
    const hip = P(lp([lx, 700])), [ax, ay0] = deck(fx + A - 2 * A * ss(st)), ay = ay0 + up, knee = [(hip[0] + ax) / 2 - 0.03 * c - 0.005, (hip[1] + ay) / 2];
    navy.push(bar(hip, knee, W(0.026)), bar(knee, [ax, ay], W(0.026)), [[ax + 0.02 * ff, ay - 0.004], [ax - 0.058 * ff, ay - 0.004], [ax - 0.058 * ff, ay + W(0.02) - 0.004], [ax + 0.02 * ff, ay + W(0.02) - 0.004]]);
  });
  if (!M.noOutline) navy.push(grow(body, W(0.022)), grow(head, W(0.022)));                // outline (noOutline: the cream bird sits straight on the ring colour — a silhouette, for a 0.4 nozzle)
  navy.push((M.billBase ? billWedge(M) : [[408, 512], [M.bill || 312, 546], [416, 541]]).map(lp).map(P));    // bill (M.bill: its tip, logo px; print: a blunt wedge billBase → billTip px tall)
  cream.push(withHoles(body, [(B ? grow(LOGO_COLLAR, Math.max(0.004, (B / (M.birdScale || 1) - 0.028) / 2)) : LOGO_COLLAR).map(P)]));    // bold: collar band ~0.028 → 0.036 before birdScale                                                       // partial collar
  const er = Math.max(14 * LOGO.s, B / 2 / bs), eye = ell(...lp(M.print ? [462, 480 + hr * 0.24] : [461, 500]), er, er, 18).map(P);       // ≥ B across after birdScale (print: nudged in from the outline)
  if (B && M.print) {
    // print: the cap is the top of the head above a chord at logo y 452 (≥ 0.9 mm of navy, joined to the
    // outline), with ≥ 0.9 mm of cream between it and the eye
    const capY = (LOGO.y0 - (480 - hr + 0.5 * hr)) * LOGO.s, hc = lp([470, 480]);
    cream.push(withHoles(ell(...hc, hr * LOGO.s, hr * LOGO.s, 64).map(([x, y]) => [x, Math.min(y, capY)]).map(P), [eye]));
  } else if (B && !M.noCap) {
    // bold: the cream left above the cap is ~0.015 thick, so the cap runs out to the outline instead and
    // reads as a navy crown — the head is cut back to the cap ellipse (moved up and out a little) along
    // rays from its centre
    const hc = lp([470, 480]), cc = lp([496, 440]), rx = 36 * LOGO.s, ry = 22 * LOGO.s, a = deg(-4);
    const inCap = ([x, y]) => { const dx = x - cc[0], dy = y - cc[1], u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a); return (u / rx) ** 2 + (v / ry) ** 2 < 1; };
    const crowned = ell(...hc, 65 * LOGO.s, 65 * LOGO.s, 64).map(p => {
      if (!inCap(p)) return p;
      let lo = 0, hi = 1;                                   // fraction of the way out from the centre: lo outside the cap, hi inside
      for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; inCap([hc[0] + (p[0] - hc[0]) * m, hc[1] + (p[1] - hc[1]) * m]) ? hi = m : lo = m; }
      return [hc[0] + (p[0] - hc[0]) * lo, hc[1] + (p[1] - hc[1]) * lo];
    }).map(P);
    cream.push(withHoles(crowned, [eye]));                                                                 // crown + eye
  } else {
    const cap = ell(...lp([488, 452]), 33 * LOGO.s, 15 * LOGO.s, 18).map(q => rot([q], deg(-4), lp([488, 452]))[0]).map(P);
    cream.push(withHoles(head, [cap, eye]));                                                                // cap + eye
  }
  return { navy, cream };
}
// ---- texture in the wave (Chase, 2026-11-04: "should we add any texture to the wave itself?") ----
// Lines laid inside the navy a set depth under the wave's surface, so they follow it as it leans and
// throws. Cream lines go on the foam layer; carved ones are cut out of the navy so the ring colour shows.
// Nothing is narrower than 0.045 of the band (~0.55 mm) or a bubble smaller than r 0.034 (~0.8 mm across).
// Every path is a slice of the surface between two TUBE points (×SEG), travelling so that +depth is into the water.
const TEX = {
  face:   { from: 1, to: 7, depth: .095, w: .045 },    // up the back to the crest (the lip is too thin for a line as well as its foam edge)
  face2:  { from: 1, to: 4, depth: .18, w: .04 },      // a second, shorter one lower on the back
  barrel: { from: 19, to: 24, depth: .065, w: .045 },  // inside the tube: along the ceiling and down the back wall
  sea1:   { from: 25, to: 29, depth: .06, w: .04 },    // below the wave (Chase, 2026-11-08): ripples in the flat sea under the tube's mouth…
  sea2:   { from: 25, to: 29, depth: .13, w: .04 },    // …and a second, deeper one
};
// The back of the wave is only ~0.25 thick and the lip ~0.13, so at most two lines fit side by side with
// ≥ 0.04 (~0.5 mm) of navy between them and either edge; the depths above keep that in every frame.

function offsetPath(path, d) {
  return path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
    return [p[0] + dy / n * (typeof d === 'function' ? d(i / (path.length - 1)) : d), p[1] - dx / n * (typeof d === 'function' ? d(i / (path.length - 1)) : d)];
  });
}
// the part of a path between length fractions a and b (0 → 1), resampled
function subPath(path, a, b, n = 24) {
  const L = [0]; for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const T = L[L.length - 1], pt = s => { const x = s * T; let i = 1; while (i < L.length - 1 && L[i] < x) i++; const k = (x - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k]; };
  return Array.from({ length: n + 1 }, (_, j) => pt(a + (b - a) * j / n));
}
// a brush stroke along a path: width w(s), pointed at both ends
function brush(path, w) {
  const L = offsetPath(path, s => -w(s) / 2), R = offsetPath(path, s => w(s) / 2);
  return [...L, ...R.reverse()];
}
const env = s => Math.sin(Math.PI * Math.min(1, Math.max(0, s))) ** 0.35;
function texture(M, t, surface, water, foam, S = SEA) {
  const geo = key => ({ ...TEX[key], ...((M.tex.geo || {})[key]) });          // geo: per-style overrides of TEX
  const line = key => { const T = geo(key), P = offsetPath(surface.slice(T.from * SEG, T.to * SEG + 1), T.depth); return key.startsWith('sea') ? P.filter(p => p[1] >= 0.02) : P.filter(p => p[1] >= S + (M.big ? 0.2 : 0.045)); };   // stop above the flat sea (sea lines: stay inside the band)
  const out = [], holes = [];
  const lines = (keys, dash, dir) => keys.forEach(key => {
    const P = line(key), W = geo(key).w;
    if (!dash) { out.push(brush(subPath(P, 0, 1, 40), s => Math.max(M.big ? M.bold : 0, W * env(s)))); return; }
    // flowing dashes: `dash` of them along the line, each moving one gap along per loop (dir +1 = from
    // the start of the path to its end), drawn full width only in the middle of the line so they grow
    // in and thin away at its ends
    for (let j = -1; j <= dash; j++) {
      const a = (j + dir * t) / dash, b = a + 0.62 / dash, a0 = Math.max(0, a), b0 = Math.min(1, b);
      if (b0 - a0 < (M.big ? 0.25 : 0.1)) continue;                                // no specks at the ends
      const g = (a0 + b0) / 2, wid = W * Math.min(1, 0.35 + env(g));
      out.push(brush(subPath(P, a0, b0, 16), s => Math.max(M.big ? M.bold : 0, wid * env(s))));
    }
  });
  const tx = M.tex;
  if (tx.face) lines(['face', ...(tx.face2 ? ['face2'] : [])], tx.dash, 1);
  if (tx.barrel) lines(['barrel'], tx.dash, -1);          // the water in the tube runs up the back wall, over the ceiling and out to the lip
  if (tx.sea) lines(tx.sea > 1 ? ['sea1', 'sea2'] : ['sea1'], tx.dash, -1);   // ripples in the flat sea drifting in towards the wave
  if (tx.bubbles) {
    // aerated face: bubbles drift up the back and out along the lip, popping in and out where it's thin
    // (only in the thick back of the wave: in the lip they'd fill it)
    const P = offsetPath(surface.slice(1 * SEG, 7 * SEG + 1), .11).filter(p => p[1] >= S + 0.06);
    [[P, 4, 0]].forEach(([path, n, ph]) => {
      for (let j = 0; j < n; j++) {
        const s = (j + ph + t) / n % 1, e = env(s);
        if (e < 0.55) continue;
        const [x, y] = subPath(path, s, s, 1)[0], r = 0.034 + 0.01 * e;
        out.push(ell(x, y, r, r, 14));
      }
    });
  }
  if (tx.carve) holes.push(...out.splice(0)); else foam.push(...out);
  if (holes.length) water[0] = withHoles(water[0], holes);
}
// ---- scene styles: the plover on the open face (2026-11-07) -----------------------------------
// Chase: the barrel was the problem — it wraps the bird on three sides (water under it, the back wall, the lip
// overhead, each with its gap of ring colour), leaving the bird ~7 mm of a 17 mm band. Here nothing is over the
// bird: it rides low on the face in front of the peak, the wave rises behind its tail and pitches a small lip
// down behind it. Drawn left → right in its final orientation (the bird faces left, down the line). The surface
// is V.face: keyed point lists [[t, points]…] (same count each), mixed over the loop like the classic shapes.
function faceScene(V, t) {
  const M = V.motion, B = M.bold || 0;
  let pts = V.face.length > 1 ? at(V.face, t) : V.face[0][1];
  // the lip pitches out (k > 0) and draws back once a loop: lip points stretched from a pivot under the crest,
  // most at the tip; and the wave leans into the throw (sheared by height, the trough stays put)
  const k = wv(t), [l0, l1, lt] = V.lip || [0, -1, 0], PV = V.lipPivot || [1.6, .8], L0 = V.level ?? SEA;
  pts = pts.map(([x, y], i) => {
    if (i >= l0 && i <= l1) { const f = i <= lt ? (i - l0 + 1) / (lt - l0 + 1) : (l1 - i + 1) / (l1 - lt + 1), sc = (M.lip || 0) * k * f; x += (x - PV[0]) * sc * (M.reach ?? 1); y += (y - PV[1]) * sc; }
    return [x + (M.lean || 0) * wv(t, -TAU * (M.leanLag || 0)) * Math.max(0, (y - L0) / (0.97 - L0)), y];
  });
  const surface = smooth(pts.map(([x, y]) => [x / DA, y]), SEG).map(([u, v]) => [u * DA, v]);
  const water = [[[0, 0], ...surface, [DA, 0]]], foam = [];
  // the cream lip line: along the top of the lip, from its tip over the crest (V.lipLine: surface point indices)
  if (V.lipLine) foam.push(band(surface.slice(V.lipLine[0] * SEG, V.lipLine[1] * SEG + 1), () => B, 1));
  // a cream line inside the face, a set depth under the surface (V.faceLine: [from, to, depth]); never thinner than B
  if (V.faceLine) {
    // flowing dashes (M.dash of them) moving up the line once a loop, like ploverleanlines; full B width, round-free square ends
    const [i0, i1, dep] = V.faceLine, path = offsetPath(surface.slice(i0 * SEG, i1 * SEG + 1), dep), n = M.dash || 0;
    if (!n) foam.push(brush(subPath(path, 0, 1, 40), () => B));
    else for (let j = -1; j <= n; j++) {
      const a = Math.max(0, (j + t) / n), b = Math.min(1, (j + t) / n + (M.dashLen || 0.6) / n);
      if (b - a >= (M.dashMin || 0.25)) foam.push(brush(subPath(path, a, b, 16), () => B));
    }
  }
  // the foam ball on the lip's tip, boiling up as it pitches
  if (V.tip != null) {
    const tp = surface[V.tip * SEG], q = 0.5 + 0.5 * k, ts = (M.ball || 0.06) * (0.7 + 0.3 * q);
    CLUSTER.forEach(([dx, dy, r]) => { const R = Math.max(r * ts, B / 2); foam.push(ell(tp[0] - dx * ts, tp[1] + dy * ts, R, R, 16)); });
  }
  const s = surfer(t, M, (1 - k) / 2), place = p => p.map(([x, y]) => [M.birdX + x + (M.lean || 0) * 0.3 * wv(t, -TAU * (M.leanLag || 0)), M.birdY + y]);   // steps back as the lip throws, as in the barrel
  water.push(...s.navy.map(place)); foam.push(...s.cream.map(place));
  return { water, foam };
}
// ---- sea life (v8 candidates, 2026-11-09) --------------------------------------------------------------------
// Each creature is drawn in mm, nose at x 0 and tail towards +x (so it swims left, like the plover), around a spine
// that undulates as it swims; top / bot are the half-heights along it (fractions of the length → mm). Fins are
// polygons in the spine's local frame (u along it, v outward from the body at that side). Every cream part is
// ≥ 0.45 mm across (two 0.2-nozzle lines) and every navy gap ≥ 0.45 mm, tips blunted.
const SEA_LIFE = {
  fish: { len: 3.3, amp: .3, k: 2.5,
    top: [[0, 0], [.03, .42], [.08, .62], [.15, .8], [.25, .95], [.4, 1.0], [.6, .82], [.8, .52], [1, .27]],
    bot: [[0, 0], [.03, .38], [.08, .56], [.15, .72], [.25, .85], [.4, .9], [.6, .75], [.8, .48], [1, .25]],
    eye: { at: .23, v: .12, r: .26 },
    fins: [{ at: 1, side: 0, pts: [[-.15, .24], [.95, .85], [1.15, .62], [1.0, 0], [1.15, -.62], [.95, -.85], [-.15, -.24]] },
           { at: .42, side: 1, pts: [[-.55, -.1], [-.1, .45], [.3, .5], [.45, -.1]] }] },
  dolphin: { len: 8.0, amp: .45, k: 2.5,
    top: [[0, 0], [.02, .22], [.06, .3], [.1, .36], [.13, .6], [.18, .88], [.25, 1.0], [.4, 1.02], [.6, .85], [.8, .55], [1, .25]],
    bot: [[0, 0], [.02, .2], [.06, .25], [.1, .3], [.14, .45], [.22, .72], [.35, .9], [.5, .88], [.7, .65], [.85, .42], [1, .25]],
    eye: { at: .2, v: .2, r: .26 },
    fins: [{ at: 1, side: 0, pts: [[-.2, .22], [.75, 1.0], [1.05, .85], [.7, 0], [1.05, -.85], [.75, -1.0], [-.2, -.22]] },
           { at: .45, side: 1, pts: [[-1.0, -.15], [-.2, .55], [.3, 1.0], [.65, .95], [.45, .5], [.55, -.15]] },
           { at: .3, side: -1, pts: [[-.45, -.1], [.3, .8], [.75, .74], [.75, -.1]] }] },
  whale: { len: 12.5, amp: .6, k: 2.2,
    top: [[0, 0], [.015, .35], [.04, .55], [.1, .8], [.2, 1.0], [.35, 1.1], [.55, 1.05], [.62, 1.15], [.67, 1.1], [.75, .85], [.9, .5], [1, .32]],
    bot: [[0, 0], [.015, .4], [.04, .7], [.1, 1.0], [.2, 1.2], [.3, 1.25], [.45, 1.1], [.6, .9], [.8, .6], [1, .32]],
    eye: { at: .2, v: .0, r: .25 },
    fins: [{ at: 1, side: 0, pts: [[-.25, .3], [1.0, 1.25], [1.4, 1.1], [.95, 0], [1.4, -1.1], [1.0, -1.25], [-.25, -.3]] },
           { at: .3, side: -1, pts: [[-.4, -.2], [1.1, .68], [2.4, .9], [2.8, .58], [1.6, -.05], [.6, -.2]] }] },
};
function swimmer(S, t, beats = 1, ph = 0) {
  const n = 48, sp = Array.from({ length: n + 1 }, (_, i) => { const s = i / n; return [s * S.len, S.amp * s * s * Math.sin(TAU * (beats * t + ph) - S.k * s)]; });
  const nrm = i => { const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); return [-dy / L, dx / L]; };
  const side = (tab, sg) => sp.map((p, i) => { const [nx, ny] = nrm(i), h = at(tab, i / n) * sg; return [p[0] + nx * h, p[1] + ny * h]; });
  const top = side(S.top, 1), bot = side(S.bot, -1), body = [...bot, ...[...top].reverse()];
  const frameAt = (s, sg) => { const i = Math.round(s * n), [nx, ny] = nrm(i), base = sg > 0 ? top[i] : sg < 0 ? bot[i] : sp[i], o = sg || 1; return { base, tu: [ny, -nx], nv: [nx * o, ny * o] }; };
  const fins = S.fins.map(F => { const { base, tu, nv } = frameAt(F.at, F.side); return F.pts.map(([u, v]) => [base[0] + tu[0] * u + nv[0] * v, base[1] + tu[1] * u + nv[1] * v]); });
  const E = frameAt(S.eye.at, 0), eye = ell(E.base[0] + E.nv[0] * S.eye.v, E.base[1] + E.nv[1] * S.eye.v, S.eye.r, S.eye.r, 16);
  return [withHoles(body, [eye]), ...fins];
}
// Creatures sit on the ring in true mm: x along the arc at radius r0, y radial. Mapped back into the scene for the
// v7 band (artBand of ploverleanfine: r 30.61 → 48.2, 8 slots, cell aspect 1.76, frame centred on x 1.05, fit 1).
const LIFE_RING = { rIn: 30.6145, H: 17.5855, N: 8, A: 1.76, mid: 1.05 };
function seaLife(life, t) {
  const R = LIFE_RING, out = [];
  const toScene = (x0, r0) => ([x, y]) => [R.mid + R.A * ((x0 + x) / r0) / (TAU / R.N), (r0 + y - R.rIn) / R.H];
  for (const L of life) {
    const S = SEA_LIFE[L.kind];
    if (L.run) {        // a school streaming through: copies every `run` mm, one spacing left per loop, alternating heights
      for (let j = 0; j < L.copies; j++) {
        const x0 = L.at[0] + j * L.run - L.run * t, r0 = L.at[1] + (j % 2 ? L.alt : 0) + 0.15 * Math.sin(TAU * (t + j * .3));
        // only whole fish: one cut by the slot's edge would print fused to the half-fish in the next slot (v8 slice,
        // 2026-11-10), so a fish appears at the right edge and is gone at the left
        const half = Math.PI * r0 / R.N - 0.4, long = S.len + 1.25;
        if (x0 < -half || x0 + long > half) continue;
        out.push(...swimmer(S, t, L.beats, j * .25).map(p => p.map(toScene(x0, r0))));
      }
      continue;
    }
    const x0 = L.at[0] + L.dx * Math.sin(TAU * (t + L.ph)), r0 = L.at[1] + L.dr * Math.sin(TAU * (t + L.ph) + 1.3);
    const k = L.scale || 1;
    out.push(...swimmer(S, t, L.beats, L.ph).map(p => p.map(([x, y]) => [x * k, y * k]).map(toScene(x0, r0))));
  }
  return out;
}
// ---- v10: a more natural throw (Chase, 2026-11-13: "can we make the throwing half of the wave look more natural? give
// more options"). The v5–v9 lip is a stick swung in and out about a pivot (the lip points stretched from LIP_PIVOT),
// with the foam ball riding its tip in mid-air. A pitching lip is a sheet: thick where it leaves the crest, thinning
// as it throws, its tip falling to the flat water ahead of the tube, and the whitewater goes up where it lands. Here
// the lip (points 9–19 of the surface: outer edge, tip at TIP, inner edge back to the roof) is rebuilt as two cubics
// meeting at the tip: the outer edge from the crest (point 8), the inner edge from the tube's roof over the bird (point 19), each
// leaving level and arriving at the tip `fall` steep, so the lip thins as it throws and the roof over the bird stays
// where v7 had it. Coordinates are the scene's final ones before the mirror: +x = the throw, y = band heights.
// Q: x, y (tip; y defaults to just above the trough), sway (tip in and out over the loop), lift (tip rises off the water
// and falls back), out / inOut (how far the crest's / the roof's handle reaches towards the tip), rise / roof (those
// handles raised), fall / fallIn (how high the tip's outer / inner handle stands), curl (tip hooked back under, towards the bird), tip (its
// width, ≥ the print stroke). The tip never touches the trough (a navy polygon can't cross itself): it stops `gap`
// above it, and the foam laid over the landing hides that sliver of ring colour.
const bez = (P, s) => { const u = 1 - s; return [0, 1].map(j => u * u * u * P[0][j] + 3 * u * u * s * P[1][j] + 3 * u * s * s * P[2][j] + s * s * s * P[3][j]); };
// the trough's height at x (the surface from point 25 on: down the back wall and out under the tube's mouth)
const troughAt = (pts, x) => { const tr = pts.slice(25); for (let i = 1; i < tr.length; i++) if (tr[i][0] >= x) { const [a, b] = [tr[i - 1], tr[i]]; return a[1] + (b[1] - a[1]) * (x - a[0]) / ((b[0] - a[0]) || 1); } return tr[tr.length - 1][1]; };
// Rolling lip (Chase, 2026-11-13: the lip "is moving like a rigid hook just going down … not like a wave curling over").
// With Q.orbit the tip doesn't slide in and out on one path: it goes round an orbit, the way the water in a wave does —
// out at the top, curling down the front, landing, and back in along the water — and the lip bends with it: reaching
// forward and long when the tip is high (handles stretched, tip pointing ahead), hooking back under as it falls (the
// curl tightens), so the curve travels along the lip instead of the whole hook moving as one. orbit: cx, cy, rx, ry (the
// tip's orbit), throw (the share of the loop from the top, over the front, to the landing), c0 / cA (the tip's hook:
// c0 − cA·sin θ, so pointing ahead at the top, hooked back at the bottom), outA / riseA / fallA (the crest's handle longer
// and higher, the tip's handles shorter, at the top; roofA: the roof's handle with them, so the lip keeps its
// thickness as it falls). θ runs from the top (π/2) clockwise round the front.
function orbitAt(O, t) {
  const u = (((t + (O.ph || 0)) % 1) + 1) % 1, f = O.throw ?? .5;
  const w = u < f ? .5 * u / f : .5 + .5 * (u - f) / (1 - f);
  return { u, f, th: Math.PI / 2 - TAU * w };
}
// Keyed lip (v10 round 3, Chase 2026-11-13: round 2 "horrible and buggy … the white water should move with the lip the
// whole time"; the lip should curl over like a wave, not drop like a rigid hook). Q.keys: [[t, pose]…] from t 0, poses
// drawn by hand — gather, throw, curl, land, boil, recover — and run through smoothly (a closed Catmull-Rom on every
// number in the pose, so the motion never jerks at a key). pose: x, y (tip), c (the tip's hook: < 0 pointing ahead, > 0
// hooked back under), out / rise / fall / fallIn / roof (the lip's handles, as in throwLip), tip (its width), foam (the
// size of the whitewater riding the tip), splash (0 → 1: drops flung up out of it).
function poseAt(keys, t) {
  const n = keys.length; t = ((t % 1) + 1) % 1;
  let i = n - 1; for (let j = 0; j < n; j++) if (keys[j][0] <= t) i = j;
  const t0 = keys[i][0], t1 = i + 1 < n ? keys[i + 1][0] : 1 + keys[0][0], u = (t - t0) / (t1 - t0);
  const K = j => keys[((j % n) + n) % n][1], p0 = K(i - 1), p1 = K(i), p2 = K(i + 1), p3 = K(i + 2), out = {};
  for (const k in p1) out[k] = 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * u * u * u);
  return out;
}
function throwLip(Q, pts, t) {
  const k = wv(t, Q.ph || 0), b = pts[19];      // b: the roof over the bird's head (v7's own; points 20 on are kept)
  // shoulder: the back behind the crest (points 5–7) lowered, so there's sky behind the crest for offshore spray
  if (Q.shoulder) pts = pts.map((p, i) => (i >= 5 && i <= 7 ? [p[0], p[1] - Q.shoulder * [.55, .85, 1][i - 5]] : p));
  const a = pts[8];                              // a: the crest
  let tx = Q.x + (Q.sway || 0) * k, ty = (Q.y ?? 0) + (Q.lift || 0) * (0.5 - 0.5 * wv(t, (Q.ph || 0) + (Q.liftPh || 0)));
  let c = Q.curl || 0, out = Q.out ?? .7, rise = Q.rise || 0, roof = Q.roof || 0, F = Q.fall ?? .6, Fi = Q.fallIn ?? F;
  if (Q.orbit) {
    const O = Q.orbit, { th } = orbitAt(O, t), sn = Math.sin(th);
    tx = O.cx + O.rx * Math.cos(th); ty = O.cy + O.ry * sn;
    c = (O.c0 || 0) - (O.cA || 0) * sn;
    out += (O.outA || 0) * sn; rise += (O.riseA || 0) * sn; roof += (O.roofA || 0) * sn; F *= 1 - (O.fallA || 0) * sn; Fi *= 1 - (O.fallA || 0) * sn;
  }
  let tipW = Q.tip, inO = Q.inOut ?? .55;
  if (Q.keys) {
    const P = poseAt(Q.keys, t);
    tx = P.x; ty = P.y; c = P.c; out = P.out ?? out; rise = P.rise ?? rise; roof = P.roof ?? roof; F = P.fall ?? F; Fi = P.fallIn ?? Fi; tipW = P.tip ?? tipW; inO = P.inOut ?? inO;
  }
  ty = Math.max(troughAt(pts, tx) + (Q.gap ?? .035), ty);
  // the tip's direction of travel: straight down, hooked back under (−x) by c > 0, or pointing ahead by c < 0
  const dn = Math.hypot(c, 1), h = tipW / 2;
  let d = [-c / dn, -1 / dn], nrm = [-d[1], d[0]];                  // nrm: towards +x (outer side)
  const end = (sg) => [tx + nrm[0] * h * sg, ty + nrm[1] * h * sg];
  let eo = end(1), ei = end(-1);
  const back = (e, top, f) => [e[0] - d[0] * f * (top - ty), e[1] - d[1] * f * (top - ty)];      // the tip's handle, back up its path
  const O = [a, [a[0] + out * (tx - a[0]), a[1] + rise], back(eo, a[1], F), eo];
  const I = [b, [b[0] + inO * (tx - b[0]), b[1] + roof], back(ei, b[1], Fi), ei];
  let outer = s => bez(O, s), under = s => bez(I, s);
  let tan = s => { const q0 = outer(Math.max(0, s - .002)), q1 = outer(Math.min(1, s + .002)), m = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) || 1; return [(q1[0] - q0[0]) / m, (q1[1] - q0[1]) / m]; };
  if (Q.spiral) {
    // v10 round 6 (Chase 2026-11-13: throwcurl3fulloffshore — "make the wave look a littttle bit better … really work
    // hard on making them look beautiful"): the lip's top edge as a spiral, not one cubic. Its heading turns clockwise
    // (over and down) by `turn` degrees from the crest to the tip, the turning packed toward the tip by q (θ = −turn·u^q,
    // q > 1: nearly straight as it leaves the crest, tightening as it goes over — a curl, not a round hose). The curve
    // is turned and scaled so it ends on the tip's outer corner; the tip's direction is the spiral's own.
    // lin: that share of the turn spread evenly instead (some bend from the crest on, so the face leaves it as an arc, not a ramp)
    const Sp = Q.spiral, P = Q.keys ? poseAt(Q.keys, t) : {}, turn = (P.turn ?? Sp.turn ?? 160) * Math.PI / 180, q = P.q ?? Sp.q ?? 1.8, lin = Sp.lin ?? 0, n = 80;
    const TH = u => turn * (lin * u + (1 - lin) * u ** q);
    const U = [[0, 0]]; let ux = 0, uy = 0;
    for (let i = 1; i <= n; i++) { const th = -TH((i - .5) / n); ux += Math.cos(th) / n; uy += Math.sin(th) / n; U.push([ux, uy]); }
    const cA = Math.atan2(uy, ux), cL = Math.hypot(ux, uy);
    let phi = 0, L = 1;
    for (let k = 0; k < 4; k++) {        // the end's direction depends on the turn of the whole curve: settle it
      phi = Math.atan2(eo[1] - a[1], eo[0] - a[0]) - cA; L = Math.hypot(eo[0] - a[0], eo[1] - a[1]) / cL;
      const te = phi - turn; d = [Math.cos(te), Math.sin(te)]; nrm = [-d[1], d[0]]; eo = end(1); ei = end(-1);
    }
    const cs = Math.cos(phi), sn = Math.sin(phi);
    outer = s => { const f = Math.max(0, Math.min(1, s)) * n, i = Math.min(n - 1, Math.floor(f)), r = f - i, x = U[i][0] + (U[i + 1][0] - U[i][0]) * r, y = U[i][1] + (U[i + 1][1] - U[i][1]) * r; return [a[0] + L * (x * cs - y * sn), a[1] + L * (x * sn + y * cs)]; };
    tan = s => { const th = phi - TH(Math.max(0, Math.min(1, s))); return [Math.cos(th), Math.sin(th)]; };
    if (Sp.ease != null) {
      // ease: leave the crest along the back of the wave (its slope from point 7 into the crest), so the top line has no
      // kink there; whatever extra rise the fit needs comes in over the first `ease` of the lip (the face steepening as it
      // pitches), not as a turn of the whole curve. Settled by fixed point: the chord's angle error goes into that rise.
      const inc = Math.atan2(a[1] - pts[7][1], a[0] - pts[7][0]), g = u => { const v = Math.min(1, u / Sp.ease); return v * v * (3 - 2 * v); };
      let del = phi - inc, V = U;
      const build = () => { const W2 = [[0, 0]]; let x = 0, y = 0; for (let i = 1; i <= n; i++) { const u = (i - .5) / n, th = inc + del * g(u) - TH(u); x += Math.cos(th) / n; y += Math.sin(th) / n; W2.push([x, y]); } return W2; };
      for (let k = 0; k < 8; k++) {
        V = build(); const [vx, vy] = V[n], want = Math.atan2(eo[1] - a[1], eo[0] - a[0]);
        del += want - Math.atan2(vy, vx); L = Math.hypot(eo[0] - a[0], eo[1] - a[1]) / Math.hypot(vx, vy);
        const te = inc + del - turn; d = [Math.cos(te), Math.sin(te)]; nrm = [-d[1], d[0]]; eo = end(1); ei = end(-1);
      }
      V = build(); const [vx, vy] = V[n]; L = Math.hypot(eo[0] - a[0], eo[1] - a[1]) / Math.hypot(vx, vy);
      outer = s => { const f = Math.max(0, Math.min(1, s)) * n, i = Math.min(n - 1, Math.floor(f)), r = f - i; return [a[0] + L * (V[i][0] + (V[i + 1][0] - V[i][0]) * r), a[1] + L * (V[i][1] + (V[i + 1][1] - V[i][1]) * r)]; };
      tan = s => { const u = Math.max(0, Math.min(1, s)), th = inc + del * g(u) - TH(u); return [Math.cos(th), Math.sin(th)]; };
    }
  }
  if (Q.taper) {
    // v10 round 4 (Chase 2026-11-13: "still the too skinny bug … an hourglass shape in some points of the animation"):
    // the two edges drawn as separate curves could pinch mid-lip and swell again at the tip. Here the underside is the
    // top edge set in by a width that only ever tapers, root → tip (root, then tipW at the tip: w = tipW + (root − tipW)
    // (1 − s)^p), so the sheet can't neck; the root is eased onto the roof over the bird (b) as before.
    const Tp = Q.taper, p = Tp.p ?? 1.3;
    const T0 = tan(0), W0 = Tp.root ?? ((b[0] - a[0]) * T0[1] - (b[1] - a[1]) * T0[0]);     // root width: b's depth under a, across the lip
    const w = s => tipW + (W0 - tipW) * (1 - s) ** p;
    const fix = [b[0] - (a[0] + T0[1] * W0), b[1] - (a[1] - T0[0] * W0)];
    under = s => { const T = tan(s), o = outer(s), W = w(s), k = (1 - s) ** 2; return [o[0] + T[1] * W + fix[0] * k, o[1] - T[0] * W + fix[1] * k]; };
  }
  const so = Q.samples ?? [.12, .3, .5, .69, .86], si = Q.samplesIn ?? [.86, .68, .5, .32, .15];   // where the 5 + 5 lip points sit along each edge
  const lip = [...so.map(outer), [tx + d[0] * h * .9, ty + d[1] * h * .9], ...si.map(under)];
  return pts.map((p, i) => (i >= 9 && i <= 19 ? lip[i - 9] : p));
}
// Round 3 whitewater: it rides the lip's tip the whole loop — a few bubbles on the lip as it gathers, boiling up as it
// curls, bursting over the water where it lands (and flinging drops up out of the burst), carried back up small as the
// next lip gathers. Q.wrap: offshore spray — drops leave the whitewater and blow a short way back up round the outside
// of the lip (towards the crest), each on a path a set distance off the lip's outer edge, so they wrap the curl.
function rideFoam(Q, M, t, surface, foam, tip, keep, r0) {
  const P = poseAt(Q.keys, t), ts = P.foam, bold = M.bold || 0, blobs = [];
  CLUSTER.forEach(([dx, dy, r]) => {
    const R = Math.max(r * ts, r0), [x, y] = keep(tip[0] + dx * ts * (Q.spreadX ?? 1), tip[1] + ts * .3 + dy * ts, R);
    blobs.push([x, Math.max(y, R + .02), R]); foam.push(ell(x, Math.max(y, R + .02), R, R, 16));
  });
  const a = Math.max(0, Math.min(1, P.splash || 0));
  if (a > .08) SPLASH.slice(0, Q.splashN ?? SPLASH.length).forEach(([dx, dy, r]) => {      // splashN: fewer flung drops where the spray (Q.wrap) is already busy
    const R = Math.max(r0, r * ts * (.5 + .5 * a)), e = .6 + .6 * a, [x, y] = keep(tip[0] + dx * ts * e * .8, tip[1] + ts * .3 + dy * ts * e, R);
    blobs.push([x, y, R]); foam.push(ell(x, y, R, R, 12));
  });
  if (Q.wrap) sprayWrap(Q, t, surface, foam, keep, r0, ts, blobs);
}
// Offshore spray (round 3, Chase: "it should start from the white water and go back up and back around the wave … only a
// tiny bit"): a loose puff of drops thrown up out of the whitewater at the tip and blown back up round the outside of the
// lip, towards the crest. Drops, like the foam (and the spray off the claws of a woodblock wave), in a few lanes at
// different heights off the lip, with uneven spacing and sizes, crowded near the whitewater and thinning as they go. A
// drop's path follows the lip's outer face, so the puff wraps the curl; the nearest lane starts over the lip's cream edge
// (no sliver of gap), the others clear of it. W.far (round 4, "the offshore spray should go more back toward the
// crest"): the path runs on up the face to the crest itself and the drops may go that fraction of the way; near the top
// of the band a drop is drawn in towards the lip rather than dropped, and every drop is kept off the lip and its
// neighbours by at least a print gap (or merged into them), so no hairline of ring colour is left between two creams.
function sprayWrap(Q, t, surface, foam, keep, r0, ts, blobs = []) {
  const W = Q.wrap, far = W.far, edge = surface.slice((far ? 8 : 9) * SEG, 13 * SEG + 1), L = [0];
  for (let i = 1; i < edge.length; i++) L.push(L[i - 1] + Math.hypot(edge[i][0] - edge[i - 1][0], edge[i][1] - edge[i - 1][1]));
  const total = L[L.length - 1], grow = Math.min(1.2, .5 + .6 * ts / .06), lanes = W.lanes ?? [0, .055, .11], n = W.n ?? 9;
  const at = (d, o) => {                                         // d back along the lip from its tip end, o out from it
    const f = Math.max(0, 1 - d / total), a = subPath(edge, f, f, 1)[0], b = subPath(edge, Math.max(0, f - .02), Math.max(0, f - .02), 1)[0];
    const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;     // travel: tip → crest; the sky is to its right
    return [a[0] + dy / m * o, a[1] - dx / m * o];
  };
  if (!far) {
    for (let j = 0; j < n; j++) {
      const ph = (j * .618034) % 1, k = .7 + .3 * ((j * 7) % 5) / 4, s = (t * (W.speed ?? 1) + ph) % 1;
      if (s < .05) continue;                                       // still inside the whitewater
      const R = Math.max(r0, (W.r ?? .05) * k * (1 - .5 * s)), lane = lanes[j % lanes.length];
      const d = Math.min(total * .45, (W.reach ?? .3) * grow * s ** 1.5), o = lane * (.4 + .6 * s) + R * (lane ? 1.1 : .6) + (W.lift ?? .05) * s;   // slow off the foam, then away: dense at the whitewater, thinning
      const [x, y] = at(d, o);
      if (y > TOP - R - .02) continue;                             // gone over the top of the band: let it go, don't pin it to the edge
      const [X, Y] = keep(x, y, R); foam.push(ell(X, Y, R, R, 14));
    }
    return;
  }
  const g = W.gap ?? .036, face = surface.slice(5 * SEG, 20 * SEG);
  const lipDist = (x, y) => { let m = 9; for (let i = 1; i < face.length; i++) { const [p, q] = [face[i - 1], face[i]], vx = q[0] - p[0], vy = q[1] - p[1], u = Math.max(0, Math.min(1, ((x - p[0]) * vx + (y - p[1]) * vy) / (vx * vx + vy * vy || 1))); m = Math.min(m, Math.hypot(x - p[0] - u * vx, y - p[1] - u * vy)); } return m; };
  // how far back up the face the spray may go: to where the face turns over into the top of the wave (its outward
  // normal pointing up more than W.up), as there's no sky above the crest inside the band — beyond that it's gone
  let reachMax = total * far;
  for (let i = edge.length - 1; i > 0; i--) {
    const dx = edge[i - 1][0] - edge[i][0], dy = edge[i - 1][1] - edge[i][1], m = Math.hypot(dx, dy) || 1;
    if (-dx / m > (W.up ?? .8)) { reachMax = Math.min(reachMax, total - L[i]); break; }
  }
  for (let j = 0; j < n; j++) {
    const ph = (j * .618034) % 1, k = (W.k0 ?? .6) + (1 - (W.k0 ?? .6)) * ((j * 7) % 5) / 4, s = (t * (W.speed ?? 1) + ph) % 1;
    if (s < .05) continue;                                         // still inside the whitewater
    const R = Math.max(r0, (W.r ?? .05) * k * (1 - (W.shrink ?? .6) * s)), lane = lanes[j % lanes.length];
    const d = reachMax * Math.min(1, (W.reach ?? .5) * grow * s ** (W.ease ?? 1.3) / reachMax);
    if (d >= reachMax * .97 && s > .6) continue;                   // reached the top of the face: blown away over the crest
    let o = lane * (.4 + .6 * s) + R * (lane ? 1.1 : .6) + (W.lift ?? .03) * s ** 1.5, [x, y] = at(d, o);
    if (y > TOP - R - .025) continue;                              // no sky left above it: gone
    // a print gap from the lip: on it (merged) or clear of it by g
    const dl = lipDist(x, y) - R;
    if (dl > 0 && dl < g) { const o2 = dl < g / 2 ? o - dl - .012 : o + g - dl + .006; [x, y] = at(d, o2); if (y > TOP - R - .025) continue; }
    const [X, Y] = keep(x, y, R);
    if (Math.abs(X - x) > R * .5) continue;                        // would be pinned against the side of the slot: gone off the frame
    x = X; y = Y;
    // and from the other drops and the whitewater: merged with a neighbour, or clear of it by g
    for (const [cx, cy, cR] of blobs) {
      const dd = Math.hypot(x - cx, y - cy), gap = dd - R - cR;
      if (gap > 0 && gap < g) { const m = (gap + .012) / (dd || 1); x -= (x - cx) * m; y -= (y - cy) * m; }
    }
    blobs.push([x, y, R]); foam.push(ell(x, y, R, R, 14));
    // W.sat: every other drop carries a smaller one tucked behind it and off the face, merged with it — spray in little
    // clumps like the whitewater, not a string of equal beads
    if (W.sat && j % 2 === 0 && s > .12) {
      const r = Math.max(r0, R * .62), [sx, sy] = at(d - R * .95, o + R * (lane ? -.5 : .55));
      if (sy < TOP - r - .025 && Math.hypot(sx - x, sy - y) < R + r - .01) { blobs.push([sx, sy, r]); foam.push(ell(sx, sy, r, r, 12)); }
    }
  }
}
// The foam of a v10 throw. lip: the cream edge along the top of the wave from behind the crest out to the tip (as before,
// never thinner than the print stroke). Then, by Q.foam: 'burst' — a boil of round bubbles on the water where the lip
// lands, swelling as it hits, with droplets flung up and forward out of it on arcs; 'veil' — the tip hangs short of the
// water and a curtain of drops falls from it into a smaller boil; 'claw' — the tip curls back under itself and sheds
// a few drops forward; Q.offshore adds spray blown back off the crest, as an offshore wind does.
function throwFoam(Q, M, t, surface, pts, foam, V) {
  const bold = M.bold || 0, lw = w => Math.max(w, bold), r0 = Math.max(.034, bold * 1.15);
  const [fL, fR] = V.frame || [0, DA], xMax = DA - fL - .01, xMin = DA - fR + .01;
  const keep = (x, y, R) => [Math.min(xMax - R, Math.max(xMin + R, x)), Math.min(TOP - R - .01, y)];
  // Q.lipBand: the cream edge's own width profile [[along, width]…] (round 6: a bolder lit edge on the curl)
  foam.push(band(surface.slice(5 * SEG, TIP * SEG + 1), at.bind(null, Q.lipBand ? Q.lipBand.map(([u, w]) => [u, u ? lw(w) : w]) : [[0, 0], [.15, lw(.012)], [.5, lw(.026)], [.85, lw(.03)], [1, lw(Q.lipLine ?? .03)]]), 1));
  const tip = surface[TIP * SEG], ground = troughAt(pts, tip[0]);
  if (Q.keys) return rideFoam(Q, M, t, surface, foam, tip, keep, r0);
  let q = 0.5 + 0.5 * wv(t, (Q.ph || 0) - (Q.hit ?? .9));                         // q: 1 just after the lip hits
  if (Q.orbit) { const { u, f } = orbitAt(Q.orbit, t), since = (((u - f) % 1) + 1) % 1; q = Math.max(Math.exp(-since / .3), Math.exp(-(1 - since) / .06) * .6); }
  const blobs = [];
  const boil = (cx, size, n = CLUSTER.length) => CLUSTER.slice(0, n).forEach(([dx, dy, r]) => {
    const R = Math.max(r0, r * size), [x, y] = keep(cx + dx * size * 1.05, ground + size * .55 + dy * size * .8, R);
    blobs.push([x, Math.max(y, ground + R * .6), R]); foam.push(ell(x, Math.max(y, ground + R * .6), R, R, 16));
  });
  if (Q.foam === 'burst' || Q.foam === 'veil') {
    const size = (Q.boil ?? .06) * (Q.foam === 'veil' ? .75 : 1) * (Q.orbit ? 0.45 + 0.7 * q : 0.75 + 0.35 * q);   // a rolling lip: the boil dies down while the next lip forms
    boil(tip[0] + (Q.boilX ?? .04), size, Q.foam === 'veil' ? 5 : CLUSTER.length);
    // droplets flung up and forward out of the boil, each on its own arc, the next one leaving as the last lands
    const n = Q.drops ?? 5;
    for (let j = 0; j < n; j++) {
      const s = (t + j / n) % 1, vx = (Q.fling ?? .32) * (0.7 + 0.3 * ((j * 7) % 5) / 4), vy = (Q.up ?? .55) * (0.75 + 0.25 * ((j * 3) % 4) / 3);
      const x = tip[0] + .03 + vx * s, y = ground + .06 + vy * s - vy * 1.1 * s * s, R = Math.max(r0, .045 * (1 - .35 * s));
      if (y < ground + R + .04 || x > xMax - R || (Q.orbit && q < .3)) continue;
      const [X, Y] = keep(x, y, R); blobs.push([X, Y, R]); foam.push(ell(X, Y, R, R, 12));
    }
    if (Q.wrap) sprayWrap(Q, t, surface, foam, keep, r0, size, blobs);   // round 4: offshore spray off the burst, back up the face
  }
  if (Q.foam === 'veil') {
    // a curtain of drops falling from the tip into the boil, streaming down once a loop
    const n = Q.veil ?? 3;
    for (let j = 0; j < n; j++) {
      const s = (t + j / n) % 1, x = tip[0] + .015 + .02 * s, y = tip[1] - (tip[1] - ground - .07) * s * s, R = Math.max(r0, .042 * (1 - .2 * s));
      if (y > tip[1] - R - Math.max(.035, bold) || y < ground + .09) continue;
      foam.push(ell(x, y, R, R, 12));
    }
  }
  if (Q.foam === 'claw') {
    // the hooked tip sheds a few drops out ahead of it, falling as they go
    for (let j = 0; j < 3; j++) {
      const s = (t + j / 3) % 1, x = tip[0] + .05 + .22 * s, y = tip[1] + .04 - .3 * s * s, R = Math.max(r0, .04 * (1 - .3 * s));
      if (y < ground + R + .05) continue;
      const [X, Y] = keep(x, y, R); foam.push(ell(X, Y, R, R, 12));
    }
    boil(tip[0] + .02, (Q.boil ?? .045) * (0.8 + 0.3 * q), 5);
  }
  if (Q.offshore && Q.spray === 'v1') {
    // the first try, kept as it was shown (throwoffshore): drops off the crest falling onto the back of the wave
    const top = surface.reduce((m, p, i) => (i > 3 * SEG && i < TIP * SEG && p[1] > m[1] ? p : m), [0, 0]), n = 3;
    for (let j = 0; j < n; j++) {
      const s = (t + j / n) % 1, R = Math.max(r0, .046 * (1 - .3 * s)), x = top[0] - .08 - Q.offshore * s, y = Math.min(TOP - R - .01, top[1] - .03 - .3 * s * s);
      if (x < xMin + R) continue;
      foam.push(ell(x, y, R, R, 12));
    }
  } else if (Q.offshore) {
    // offshore spray: blown back off the crest into the sky behind it (−x), streaks drawn along their path, each kept
    // clear of the back of the wave (v10 first try, 2026-11-13: the drops fell onto the back and slid down it with the
    // face lines — "it's not actually offshore … like the spray is tied in with the flow of the water"); Q.shoulder
    // makes the room. n streaks, each leaving the crest in turn and thinning as it goes.
    const top = surface[8 * SEG], n = Q.sprayN ?? 4;                                // the crest (point 8)
    const backY = x => { for (let i = 1; i <= 8 * SEG; i++) if (surface[i][0] >= x) { const [p0, p1] = [surface[i - 1], surface[i]]; return p0[1] + (p1[1] - p0[1]) * (x - p0[0]) / ((p1[0] - p0[0]) || 1); } return top[1]; };
    for (let j = 0; j < n; j++) {
      const s = (t + j / n) % 1, L = Q.offshore, ry = Math.max(.016, bold * .55), rx = Math.max(ry * 1.6, .06 * (1 - .4 * s));
      const x = top[0] - .1 - L * s, y0 = Math.min(TOP - ry - .015, top[1] - .01), y = y0 - .05 * s - .1 * s * s;
      if (x < xMin + rx || y < backY(x) + ry + .035 + Math.max(.035, bold)) continue;          // clear of the cream lip line along the back
      const ang = Math.atan2(-.05 - .2 * s, -L);                                    // along the path
      foam.push(Array.from({ length: 14 }, (_, i) => { const a = i / 14 * TAU, ex = rx * Math.cos(a), ey = ry * Math.sin(a); return [x + ex * Math.cos(ang) - ey * Math.sin(ang), y + ex * Math.sin(ang) + ey * Math.cos(ang)]; }));
    }
  }
}
function barrelScene(V, t) {
  const M = V.motion, k = M.tuck ? 0.5 - 0.5 * Math.cos(TAU * t) : wv(t), k2 = M.tuck ? k : wv(t, 1.0);
  const T0 = V.tube || TUBE, PIV = V.lipPivot || LIP_PIVOT, S = V.level ?? SEA, CR = V.tube ? .97 : .96;   // a style may bring its own tube
  // ceiling: the tube's roof (points 19–24) brought down by this much — a thicker wave over the bird (exploration, 2026-11-08)
  const T = V.ceiling ? T0.map(([x, y], i) => i >= 19 && i <= 24 ? [x, y - V.ceiling * (i === 19 || i === 24 ? 0.5 : 1)] : [x, y]) : T0;
  const pts = T.map(([x, y], i) => {
    if (i >= 9 && i <= 20) {      // the lip: stretched out from / pulled back towards a pivot under the crest
      // throwing over, the lip reaches out a little less than it drops, so the tip stays inside the cell
      const f = i <= TIP ? Math.min(1, (i - 8) / 5) : Math.max(0, (21 - i) / 6), sc = M.lip * k * f, sx = sc > 0 ? (M.reach ?? 0.6) * sc : sc;
      return [x + (x - PIV[0]) * sx, y + (y - PIV[1]) * sc];
    }
    if (i >= 6 && i <= 10) return [x, y + M.crest * k2 * (1 - Math.abs(i - 8) / 3)];                                                         // the crest swells
    return [x, y];
  }).map(([x, y], i) => {
    // the back breathes: the back slope (points 1–7) widens about the crest while the lip is pulled back and
    // narrows, optionally standing up a little, once it has thrown over and crashed
    if (!M.back || i < 1 || i > 7) return [x, y];
    const c = -wv(t, -TAU * (M.backLag || 0)), sc = 1 + M.back * c;
    return [1.1 + (x - 1.1) * sc, M.rise && i <= 5 ? S + (y - S) * (1 - M.rise * c) : y];     // only the shoulder rises: the crest stays inside the slot
  }).map(([x, y], i, a) => {
    // whole-wave motions (here +x = the way the lip throws; k > 0 = throwing over):
    //  full  — the back slope bulges out, full, while the lip draws back and sucks in, hollow, once it has thrown
    //  swell — a swell rolls up the back and into the lip once a loop, arriving as it throws
    //  lean  — the wave leans into the throw (sheared by height, the trough stays put) and rocks back
    //  slide — the whole wave surges forward (left once mirrored) as it throws and settles back; the plover rides with it
    if (i === a.length - 1) return [x, y];
    const h = Math.max(0, (y - S) / (CR - S)), kl = wv(t, -TAU * (M.leanLag || 0));
    let X = x + (M.lean || 0) * kl * h + (M.slide || 0) * k, Y = y;
    if ((M.full || M.swell) && i >= 1 && i <= 7) {
      const [px, py] = T[i - 1], [nx, ny] = T[i + 1], L = Math.hypot(nx - px, ny - py), s = i / 8, env = Math.sin(Math.PI * s);
      const p = ((t + 0.6) % 1) * 1.5 - 0.25;                                         // where the swell is on the back, foot 0 → crest 1
      const out = (M.full || 0) * -wv(t, -TAU * (M.fullLag || 0)) * env + (M.swell || 0) * env * Math.exp(-(((s - p) / 0.2) ** 2));
      X += -(ny - py) / L * out; Y += (nx - px) / L * out;                            // along the outward normal (up the back)
    }
    return [X, Y];
  }).map(([x, y], i, a) => {
    // shift: the whole wave moves toward the back edge by `shift` (left here, right once mirrored) so the
    // thrown lip and its whitewater stay inside the cell; the back slope is squeezed to keep its foot at the edge
    const d = M.shift || 0;
    return i === a.length - 1 ? [x, y] : [x - d * Math.min(1, x / 1.0), y];
  }).map(([x, y], i, a) => {
    // squeeze (compact frame, 2026-11-07): everything past `at` — the lip, its throw and the crash — is pressed
    // back towards the tube by `crash`, so the scene needs a narrower slot (see V.frame); the flat sea takes the rest
    const Q = M.squeeze;
    return !Q || i === a.length - 1 || x <= Q.at ? [x, y] : [Q.at + (x - Q.at) * Q.crash, y];
  });
  const lipPts = M.throw ? throwLip(M.throw, pts, t) : pts;          // v10: the lip drawn as a falling sheet (throwLip)
  const surface = smooth(lipPts.map(([x, y]) => [x / DA, y]), SEG).map(([u, v]) => [u * DA, v]);
  const water = [[[0, 0], ...surface, [DA, 0]]], foam = [];
  const tip = surface[TIP * SEG];
  if (M.throw) throwFoam(M.throw, M, t, surface, lipPts, foam, V);
  else if (M.foam === 'ww') {
    // whitewater-return foam: a thinner feathering edge, and the full round-bubble cluster riding the lip
    // tip, small while the lip pulls back and boiling up as it throws over; kept whole inside the cell
    const lw = w => Math.max(w, M.bold || 0);
    const [fL, fR] = V.frame || [0, DA], xMax = DA - fL, xMin = DA - fR;            // keep the foam inside the style's frame (mirrored below)                                   // bold: no thinner than M.bold past the taper
    foam.push(band(surface.slice(5 * SEG, TIP * SEG + 1), at.bind(null, M.big ? [[0, M.bold], [1, M.bold]] : [[0, 0], [.15, lw(.012)], [.5, lw(.026)], [.85, lw(.03)], [1, lw(.03)]]), 1));
    const q = M.tuck ? k : 0.5 + 0.5 * k, ts = (0.05 + 0.035 * q) * (M.ball || 1);   // ball: the foam ball's size
    CLUSTER.forEach(([dx, dy, r]) => {
      const R = Math.max(r * ts, M.big ? M.bold / 2 : 0), x = Math.min(xMax - R - (M.big ? M.bold : 0.01), Math.max(xMin + R + (M.big ? M.bold : 0.01), tip[0] + dx * ts)), y = Math.max(R + 0.01, tip[1] + ts * 0.25 + dy * ts);
      foam.push(ell(x, y, R, R, 16));
    });
    // splash: as the lip crashes over, droplets flick up and out of the foam ball, then fall back in
    const a = M.splash ? Math.max(0, Math.min(1, (q - 0.6) / 0.35)) : 0;
    if (a > 0.05) SPLASH.forEach(([dx, dy, r]) => {
      const R = Math.max(0.034, r * ts * (0.5 + 0.5 * a)), e = 0.7 + 0.6 * a;     // ≥ 0.034 of the band (~0.8 mm): printable
      const x = Math.min(xMax - R - 0.01, Math.max(xMin + R + 0.01, tip[0] + dx * ts * e * (M.spread ?? M.squeeze?.splash ?? 1))), y = Math.min(TOP - R - 0.01, tip[1] + ts * 0.25 + dy * ts * e);
      foam.push(ell(x, y, R, R, 12));
    });
  } else {
    // the feathering lip: a cream edge along the top of the wave from behind the crest out to the tip
    foam.push(band(surface.slice(5 * SEG, TIP * SEG + 1), at.bind(null, [[0, 0], [.12, .02], [.45, .04], [.8, .04], [1, .028]]), 1));
    // the lip tip throws a little spray as it curls over
    const ts = 0.035 + 0.01 * wv(t, 0.7) + (M.spit ? 0.008 : 0);
    CLUSTER.slice(0, 5).forEach(([dx, dy, r]) => foam.push(ell(tip[0] + dx * ts * 0.8, tip[1] - 0.01 + dy * ts, r * ts, r * ts, 12)));
  }
  if (M.tex) texture(M, t, surface, water, foam, S);
  // spit: spray blown out of the tube's mouth, a steady stream that loops
  if (M.spit) for (let j = 0; j < 7; j++) {
    const q = (j / 7 + t) % 1, x = 1.55 + 0.55 * q, y = 0.33 + 0.07 * q - 0.12 * q * q, r = 0.028 * (1 - 0.55 * q);
    foam.push(ell(x, y, r, r, 12));
  }
  // mirror it all: the wave pitches LEFT, so the logo plover (which faces left) looks out of the tube's mouth
  const mirror = p => p.map(([x, y]) => [DA - x, y]);
  const W2 = water.map(mirror), F2 = foam.map(mirror);
  // the plover, low in the tube on the trough
  const s = surfer(t, M, M.tuck ? 1 - k : (1 - k) / 2), place = p => p.map(([x, y]) => [DA - 1.24 + (M.birdShift ?? M.shift ?? 0) - (M.slide || 0) * k - (M.lean || 0) * 0.3 * wv(t, -TAU * (M.leanLag || 0)) + x, (M.birdY ?? 0.262) + y]);
  W2.push(...s.navy.map(place)); F2.push(...s.cream.map(place));
  if (V.life) F2.push(...seaLife(V.life, t));        // v8 candidates: fish, dolphin, whale in the sea below the wave
  return { water: W2, foam: F2 };
}

// How wide a style's artwork is, in band heights: the design cell, or a scene's own `frame` [left, right].
const span = V => (V.frame ? V.frame[1] - V.frame[0] : DA);
// One frame at loop time t ∈ [0, 1) for a cell of aspect A: water and foam
// polygons in cell coordinates, already clipped to the cell. `floor` (v ≤ 0) is where the sea starts:
// 0 at the band's inner edge, below it for a style whose sea runs down to the ring's edge (see artBand).
export function waveFrame(variant, t, A = DA, floor = 0) {
  const V = WAVE_VARIANTS[variant] || WAVE_VARIANTS[WAVE_DEFAULT];
  t = ((t % 1) + 1) % 1;
  const L = V.level ?? SEA, sea = [[0, floor], [0, L], [1, L], [1, floor]];
  if (V.kind === 'sprite') {
    const s = sprite(V, t, A);
    return { water: [sea, ...s.water].map(p => clip(p, floor)).filter(p => p.length > 2), foam: s.foam.map(p => clip(p)).filter(p => p.length > 2) };
  }
  if (V.kind === 'scene') {        // like a wave: shrinks uniformly in narrow cells, flat sea either side in wide ones
    const [xL, xR] = V.frame || [0, DA], fit = Math.min(1, A / (xR - xL)), P = ([x, y]) => [0.5 + (x - (xL + xR) / 2) / A * fit, L + (y - L) * fit];
    const s = (V.face ? faceScene : barrelScene)(V, t);
    const water = [sea, ...s.water.map(p => p.map(P))].map(p => clip(p, floor)).filter(p => p.length > 2);
    return { water, foam: s.foam.map(p => clip(p.map(P), floor)).filter(p => p.length > 2) };   // floor: sea life can swim below the band
  }
  const parts = [];
  if (V.mode === 'travel') {
    // every wave still alive: ages t, t+1, t+2… each one `travel` further along
    for (let age = t; age <= V.life; age++) parts.push(wave(V, age, A, .55, age * V.travel - V.lead, false));
  } else parts.push(wave(V, t, A, .5, .5, true));
  const water = [sea, ...parts.map(p => p.water)].map(p => clip(p, floor)).filter(p => p.length > 2);
  const foam = parts.flatMap(p => p.foam).map(p => clip(p)).filter(p => p.length > 2);
  return { water, foam };
}

// Cell aspect for N slots on an r rIn–rOut band (width at mid-radius / height).
export const cellAspect = (N, rIn, rOut) => (Math.PI * (rIn + rOut) / N) / (rOut - rIn);
// Default slot count for a band: the most slots (up to the style's own count) whose cells are
// still at least as wide as the design cell, so the wave fills its slot without being shrunk.
export function autoFrames(variant, rIn, rOut, min = 6, max = 16) {
  const V = WAVE_VARIANTS[variant] || WAVE_VARIANTS[WAVE_DEFAULT];
  if (V.sea === 'edge') return Math.min(V.N, max);         // picks its own band to fit its slot count (artBand)
  for (let N = Math.min(V.N, max); N > min; N--) if (cellAspect(N, rIn, rOut) >= span(V) * 0.95) return N;
  return min;
}
// The band a style's frames fill on a ring whose art may span rIn–rOut, inside a ring that starts at ringIn.
// Most styles take the band as given. A `sea: 'edge'` style (2026-11-07, Chase: "why can't the whole water line
// go inward closer to the edge?") takes the tallest band its frame fills at N slots — the art is
// min(height, arc ÷ frame width), so a taller band than that only adds sky — and runs its sea on down to the
// ring's inner edge (seaIn), so the ring carries one unbroken band of water under the animation.
export function artBand(variant, N, rIn, rOut, ringIn) {
  const V = WAVE_VARIANTS[variant] || WAVE_VARIANTS[WAVE_DEFAULT];
  let seaIn = rIn;
  if (V.sea === 'edge' && ringIn != null) {
    const k = Math.PI / N, w = span(V);
    seaIn = ringIn + 0.02;                                 // 0.02: the polygons' chords stay on the ring (sag ≤ 0.004)
    rIn = Math.max(seaIn, rOut * (w - k) / (w + k));       // cellAspect(N, rIn, rOut) = w
  }
  return { rIn, rOut, seaIn, A: cellAspect(N, rIn, rOut), floor: (seaIn - rIn) / (rOut - rIn) };
}

// All N frames bent onto the ring band, in mm around the spinner axis (y up).
// Slot 0 is at the top; slots and frames advance clockwise.
// ringIn: the ring's inner edge, for a style whose sea runs down to it (artBand); `band` in the result is the one used.
export function ringArt({ variant = WAVE_DEFAULT, N, rIn, rOut, ringIn }) {
  N = N || (WAVE_VARIANTS[variant] || WAVE_VARIANTS[WAVE_DEFAULT]).N;
  const band = artBand(variant, N, rIn, rOut, ringIn); ({ rIn, rOut } = band);
  const H = rOut - rIn, D = 2 * Math.PI / N, A = band.A, slots = [];
  for (let j = 0; j < N; j++) {
    const th0 = Math.PI / 2 - j * D + D / 2;             // the cell's u = 0 edge
    const P = (u, v) => { const th = th0 - u * D, r = rIn + v * H; return [r * Math.cos(th), r * Math.sin(th)]; };
    const bend = poly => poly.flatMap((p, i) => {          // split long runs so edges along the band follow the arc
      const q = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.abs(q[0] - p[0]) / 0.04));
      return Array.from({ length: n }, (_, k) => P(p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n));
    });
    const { water, foam } = waveFrame(variant, j / N, A, band.floor);
    slots.push({ frame: j, water: water.map(bend), foam: foam.map(bend) });
  }
  return { N, slots, band };
}

// Front-face artwork as an SVG in mm, one group per print colour.
export function ringSVG({ variant = WAVE_DEFAULT, N, rIn, rOut, ringIn, ringOut, ringColor = '#d4af37' }) {
  const art = ringArt({ variant, N, rIn, rOut, ringIn }), f = n => n.toFixed(3), half = Math.ceil(ringOut + 2), LC = layerColors(variant);
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
    <g id="water" fill="${LC.water}">
      ${polys('water')}
    </g>
    <g id="foam" fill="${LC.foam}">
      ${polys('foam')}
    </g>
  </g>
</svg>
`;
}
