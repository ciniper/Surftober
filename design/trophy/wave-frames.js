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
const LOGO_COLLAR = [[588, 495], [582, 560], [551, 616], [512, 652], [495, 634], [527, 597], [553, 551], [560, 498]].map(lp);
// q: where the bird is in its walk, 0 = stepped back (lip thrown over), 1 = stepped forward (lip pulled back).
// Two steps each way: the front foot then the back foot going forward, the back foot then the front going back.
function surfer(t, M, q = 0.5) {
  const navy = [], cream = [], c = M.tuck ? M.crouch * (0.5 - 0.5 * Math.cos(TAU * t)) : M.crouch * (0.5 + 0.5 * wv(t, 2));
  const tilt = deg(-3 + M.tilt * wv(t, 1.3) + (M.wobble || 0) * Math.sin(2 * TAU * t + 0.4)), drop = 0.05 * c - M.bob * wv(t);   // the knees take the crouch and the bob
  // board: pointed nose left, squash tail right, nose rocker; navy-rimmed so it reads on the gold
  const top = [], bot = [];
  for (let i = 0; i <= 22; i++) {
    const s = 0.02 + 0.96 * i / 22, x = 0.29 - 0.58 * s, rock = 0.045 * s ** 3, th = Math.sin(Math.PI * s) ** 0.5;
    top.push([x, rock + 0.022 * th]); bot.push([x, rock - 0.02 * th]);
  }
  const board = rot([...top, ...bot.reverse()], tilt);
  navy.push(grow(board, 0.018)); cream.push(board);
  const deck = x => rot([[x, 0.022]], tilt)[0];
  // the bird above its feet, lowered by the crouch, leaning into the ride a touch
  const A = M.walk || 0, ss = x => (x = Math.min(1, Math.max(0, x)), x * x * (3 - 2 * x));
  const lift = [A - 2 * A * q, -drop], lean = deg(-4 - 5 * c), P = q => rot([q], lean, [0, 0.2])[0].map((v, i) => v + lift[i]);
  const body = LOGO_BODY.map(P), head = ell(...lp([470, 480]), 65 * LOGO.s, 65 * LOGO.s, 32).map(P);
  // legs: from the belly to the feet on the deck, knees flexing forward with the crouch; flat feet, toes left
  const sw = M.stance ?? 1, feet = (M.legs === 'cross' ? [0.065, -0.055] : [-0.055, 0.065]).map(x => 0.005 + (x - 0.005) * sw);   // crossed: each foot under the other hip
  [530, 628].forEach((lx, n) => {
    const fx = feet[n], j = (fx < 0) === (M.lead !== 'back') ? 0 : 1;          // which foot steps first going forward
    const st = 2 * q - j, up = st > 0 && st < 1 ? (M.lift ?? 0.03) * Math.sin(Math.PI * st) : 0;           // this foot's step: lifted mid-swing
    const hip = P(lp([lx, 700])), [ax, ay0] = deck(fx + A - 2 * A * ss(st)), ay = ay0 + up, knee = [(hip[0] + ax) / 2 - 0.03 * c - 0.005, (hip[1] + ay) / 2];
    navy.push(bar(hip, knee, 0.026), bar(knee, [ax, ay], 0.026), [[ax + 0.02, ay - 0.004], [ax - 0.058, ay - 0.004], [ax - 0.058, ay + 0.016], [ax + 0.02, ay + 0.016]]);
  });
  navy.push(grow(body, 0.022), grow(head, 0.022), [[408, 512], [312, 546], [416, 541]].map(lp).map(P));    // outline + pointed bill
  cream.push(withHoles(body, [LOGO_COLLAR.map(P)]));                                                       // partial collar
  const cap = ell(...lp([488, 452]), 33 * LOGO.s, 15 * LOGO.s, 18).map(q => rot([q], deg(-4), lp([488, 452]))[0]).map(P);
  cream.push(withHoles(head, [cap, ell(...lp([461, 500]), 14 * LOGO.s, 14 * LOGO.s, 14).map(P)]));      // cap + eye
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
function texture(M, t, surface, water, foam) {
  const geo = key => ({ ...TEX[key], ...((M.tex.geo || {})[key]) });          // geo: per-style overrides of TEX
  const line = key => { const T = geo(key); return offsetPath(surface.slice(T.from * SEG, T.to * SEG + 1), T.depth).filter(p => p[1] >= S + 0.045); };   // stop above the flat sea
  const out = [], holes = [];
  const lines = (keys, dash, dir) => keys.forEach(key => {
    const P = line(key), W = geo(key).w;
    if (!dash) { out.push(brush(subPath(P, 0, 1, 40), s => W * env(s))); return; }
    // flowing dashes: `dash` of them along the line, each moving one gap along per loop (dir +1 = from
    // the start of the path to its end), drawn full width only in the middle of the line so they grow
    // in and thin away at its ends
    for (let j = -1; j <= dash; j++) {
      const a = (j + dir * t) / dash, b = a + 0.62 / dash, a0 = Math.max(0, a), b0 = Math.min(1, b);
      if (b0 - a0 < 0.1) continue;                                                  // no specks at the ends
      const g = (a0 + b0) / 2, wid = W * Math.min(1, 0.35 + env(g));
      out.push(brush(subPath(P, a0, b0, 16), s => wid * env(s)));
    }
  });
  const tx = M.tex;
  if (tx.face) lines(['face', ...(tx.face2 ? ['face2'] : [])], tx.dash, 1);
  if (tx.barrel) lines(['barrel'], tx.dash, -1);          // the water in the tube runs up the back wall, over the ceiling and out to the lip
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
function barrelScene(V, t) {
  const M = V.motion, k = M.tuck ? 0.5 - 0.5 * Math.cos(TAU * t) : wv(t), k2 = M.tuck ? k : wv(t, 1.0);
  const pts = TUBE.map(([x, y], i) => {
    if (i >= 9 && i <= 20) {      // the lip: stretched out from / pulled back towards a pivot under the crest
      // throwing over, the lip reaches out a little less than it drops, so the tip stays inside the cell
      const f = i <= TIP ? Math.min(1, (i - 8) / 5) : Math.max(0, (21 - i) / 6), sc = M.lip * k * f, sx = sc > 0 ? (M.reach ?? 0.6) * sc : sc;
      return [x + (x - LIP_PIVOT[0]) * sx, y + (y - LIP_PIVOT[1]) * sc];
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
    const h = Math.max(0, (y - S) / (0.96 - S)), kl = wv(t, -TAU * (M.leanLag || 0));
    let X = x + (M.lean || 0) * kl * h + (M.slide || 0) * k, Y = y;
    if ((M.full || M.swell) && i >= 1 && i <= 7) {
      const [px, py] = TUBE[i - 1], [nx, ny] = TUBE[i + 1], L = Math.hypot(nx - px, ny - py), s = i / 8, env = Math.sin(Math.PI * s);
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
  });
  const surface = smooth(pts.map(([x, y]) => [x / DA, y]), SEG).map(([u, v]) => [u * DA, v]);
  const water = [[[0, 0], ...surface, [DA, 0]]], foam = [];
  const tip = surface[TIP * SEG];
  if (M.foam === 'ww') {
    // whitewater-return foam: a thinner feathering edge, and the full round-bubble cluster riding the lip
    // tip, small while the lip pulls back and boiling up as it throws over; kept whole inside the cell
    foam.push(band(surface.slice(5 * SEG, TIP * SEG + 1), at.bind(null, [[0, 0], [.15, .012], [.5, .026], [.85, .03], [1, .03]]), 1));
    const q = M.tuck ? k : 0.5 + 0.5 * k, ts = 0.05 + 0.035 * q;
    CLUSTER.forEach(([dx, dy, r]) => {
      const R = r * ts, x = Math.min(DA - R - 0.01, Math.max(R + 0.01, tip[0] + dx * ts)), y = Math.max(R + 0.01, tip[1] + ts * 0.25 + dy * ts);
      foam.push(ell(x, y, R, R, 16));
    });
    // splash: as the lip crashes over, droplets flick up and out of the foam ball, then fall back in
    const a = M.splash ? Math.max(0, Math.min(1, (q - 0.6) / 0.35)) : 0;
    if (a > 0.05) SPLASH.forEach(([dx, dy, r]) => {
      const R = Math.max(0.034, r * ts * (0.5 + 0.5 * a)), e = 0.7 + 0.6 * a;     // ≥ 0.034 of the band (~0.8 mm): printable
      const x = Math.min(DA - R - 0.01, Math.max(R + 0.01, tip[0] + dx * ts * e)), y = Math.min(TOP - R - 0.01, tip[1] + ts * 0.25 + dy * ts * e);
      foam.push(ell(x, y, R, R, 12));
    });
  } else {
    // the feathering lip: a cream edge along the top of the wave from behind the crest out to the tip
    foam.push(band(surface.slice(5 * SEG, TIP * SEG + 1), at.bind(null, [[0, 0], [.12, .02], [.45, .04], [.8, .04], [1, .028]]), 1));
    // the lip tip throws a little spray as it curls over
    const ts = 0.035 + 0.01 * wv(t, 0.7) + (M.spit ? 0.008 : 0);
    CLUSTER.slice(0, 5).forEach(([dx, dy, r]) => foam.push(ell(tip[0] + dx * ts * 0.8, tip[1] - 0.01 + dy * ts, r * ts, r * ts, 12)));
  }
  if (M.tex) texture(M, t, surface, water, foam);
  // spit: spray blown out of the tube's mouth, a steady stream that loops
  if (M.spit) for (let j = 0; j < 7; j++) {
    const q = (j / 7 + t) % 1, x = 1.55 + 0.55 * q, y = 0.33 + 0.07 * q - 0.12 * q * q, r = 0.028 * (1 - 0.55 * q);
    foam.push(ell(x, y, r, r, 12));
  }
  // mirror it all: the wave pitches LEFT, so the logo plover (which faces left) looks out of the tube's mouth
  const mirror = p => p.map(([x, y]) => [DA - x, y]);
  const W2 = water.map(mirror), F2 = foam.map(mirror);
  // the plover, low in the tube on the trough
  const s = surfer(t, M, M.tuck ? 1 - k : (1 - k) / 2), place = p => p.map(([x, y]) => [DA - 1.24 + (M.birdShift ?? M.shift ?? 0) - (M.slide || 0) * k - (M.lean || 0) * 0.3 * wv(t, -TAU * (M.leanLag || 0)) + x, 0.262 + y]);
  W2.push(...s.navy.map(place)); F2.push(...s.cream.map(place));
  return { water: W2, foam: F2 };
}

// One frame at loop time t ∈ [0, 1) for a cell of aspect A: water and foam
// polygons in cell coordinates, already clipped to the cell.
export function waveFrame(variant, t, A = DA) {
  const V = WAVE_VARIANTS[variant] || WAVE_VARIANTS[WAVE_DEFAULT];
  t = ((t % 1) + 1) % 1;
  if (V.kind === 'sprite') {
    const s = sprite(V, t, A);
    return { water: s.water.map(clip).filter(p => p.length > 2), foam: s.foam.map(clip).filter(p => p.length > 2) };
  }
  if (V.kind === 'scene') {        // like a wave: shrinks uniformly in narrow cells, flat sea either side in wide ones
    const fit = Math.min(1, A / DA), P = ([x, y]) => [0.5 + (x / DA - 0.5) * DA / A * fit, SEA + (y - SEA) * fit];
    const s = barrelScene(V, t);
    const water = [[[0, 0], [0, SEA], [1, SEA], [1, 0]], ...s.water.map(p => p.map(P))].map(clip).filter(p => p.length > 2);
    return { water, foam: s.foam.map(p => clip(p.map(P))).filter(p => p.length > 2) };
  }
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
// Default slot count for a band: the most slots (up to the style's own count) whose cells are
// still at least as wide as the design cell, so the wave fills its slot without being shrunk.
export function autoFrames(variant, rIn, rOut, min = 6, max = 16) {
  const V = WAVE_VARIANTS[variant] || WAVE_VARIANTS[WAVE_DEFAULT];
  for (let N = Math.min(V.N, max); N > min; N--) if (cellAspect(N, rIn, rOut) >= DA * 0.95) return N;
  return min;
}

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
  const art = ringArt({ variant, N, rIn, rOut }), f = n => n.toFixed(3), half = Math.ceil(ringOut + 2), LC = layerColors(variant);
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
