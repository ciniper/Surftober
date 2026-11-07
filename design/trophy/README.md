# Surftober 2026 trophy — the spinner (concept C)

**Branch note: `trophy` is a design scratch branch. Do NOT merge it into
`main`** — nothing here is part of the site. It holds the trophy configurator,
the CAD generator, the wave animation and the decision log, versioned
alongside the site but never deployed with it.

## What it is

A fully 3D-printed fidget-spinner fridge magnet. A 608 bearing sits in a
printed body — hub, three or four arms, and a wide **wave ring** whose outer
band carries the frames of a breaking wave. Spin it and film it: at one slot
per video frame the wave plays in place (a phenakistiscope). A still **front
hub** on the inner race carries "SURFTOBER 2026" and the name; a still **back
cap** holds the magnet, so only that cap touches the fridge. Tier (gold /
silver / bronze / participant) is the body colour, or — with a bought metal
bezel ring or bike cog for spin weight — the metal itself.

Everything reads **one config file**, `spinner-config.js`: dimensions, parts,
options, presets and URL state. The configurator, the wave demo and the CAD
generator cannot drift apart.

## Quick start

```bash
cd design/trophy/cad && ./setup.sh          # once: venv + CadQuery (Homebrew python3.12; node for the config bridge)
.venv/bin/python serve.py 8930             # local server with the generate API
open http://localhost:8930/                 # landing → Configurator / Wave demo
```

In the **configurator** (`viewer.html`): pick a preset or set the options,
tick the parts you want, click any part to inspect it (dimensions, filament,
print orientation), then **Generate STL · 3MF · STEP**. The real geometry comes
back into the same scene (choose it under *Generated*) so you can compare it
with the preview before printing. *Copy link* writes the whole state to the
URL. Without `serve.py` (any static server) the button shows the equivalent
command instead.

**On a Vercel preview** of this branch the same pages are served at
`/trophy/` (build.mjs copies `design/trophy` minus `cad/` into dist; the
landing page shows a "2026 Trophy (preview)" button on any host that is not
surftober.com). No generator there, and no generated files — procedural
preview only, for showing the design around on a phone.

From the terminal, the same thing:

```bash
cd design/trophy/cad
.venv/bin/python spinner.py --name NAHLA                      # full trophy, multi-colour inlays
.venv/bin/python spinner.py --preset testring                 # one-colour spinning piece, wave in relief
.venv/bin/python spinner.py --parts hub,hub-text --name KAI   # any subset
.venv/bin/python spinner.py --url "arms=4&weight=cog"         # any configurator link's query
.venv/bin/python spinner.py --list
```

## Files

| file | role |
|---|---|
| `spinner-config.js` | **single source of truth**: `DIM`, `PARTS`, `OPTIONS`, `PRESETS`, URL ↔ options, output tag, CAD command |
| `spinner-parts.js` | three.js builder per part (preview geometry, mounted pose) |
| `viewer.html` | the configurator |
| `wave-demo.html` · `wave-frames.js` | wave animation: frame shapes, variants, ring layout, phone-camera simulation, SVG export |
| `index.html` | landing page: links + presets |
| `cad/spinner.py` | CadQuery generator → STL per part, multi-part 3MF, STEP assembly, manifest JSON, bezel DXF |
| `cad/bridge.mjs` | node: hands the config + wave polygons to Python as JSON |
| `cad/serve.py` | local server: static files + `GET /api/outputs` + `POST /api/generate` |
| `cad/setup.sh` | venv + CadQuery |
| `cad/out/` | generated files (gitignored — regenerate, don't commit) |

## Options

All options live in `OPTIONS` in `spinner-config.js` and round-trip through the
URL, the generator (`--url` or flags) and the manifest.

| option | values | default | what |
|---|---|---|---|
| `version` | text, ≤ 12 | v5 | prefix on every output file (`v5-nahla-3arm-ploverleanlines10-body.stl`); bump per print round |
| `name` | text, ≤ 16 | NAHLA | on the still hub, along the bottom |
| `tier` | gold · silver · bronze · participant | gold | body colour, or the metal when a weight is fitted |
| `arms` | 3 · 4 | 3 | arms carrying the ring |
| `wave` | **ploverleanlines** · plovertube · ploverspit · plovertuck · hollow · classic · rolling · return · barrel · returntip · classictip · plover (and the other `plover…` options in *Animations*) | ploverleanlines | animation style (see wave demo and *Animations* below); the `plover…` scenes (v5) put the logo's snowy plover on a surfboard inside an open barrel; `hollow` (v5) = a break whose lip throws far out instead of pitching straight down; `plover` = the plover alone, wings flapping + legs striding (cream body + navy details instead of navy water + cream foam) |
| `frames` | 0 · 6…16 | 0 = auto | slots around the band; auto = the most slots, up to the style's own count, whose cells don't shrink the art (10 fit on the v5 band); fewer = faster loop, bigger art |
| `art` | raised · proud · inlay · none | raised | wave: **one solid part**, water 0.4 and foam 0.8 above the face (colour the two steps by height in the slicer) · separate inlay parts standing 0.4 / 0.7 proud · the same inlay parts flush · plain |
| `text` | recessed · inlay · raised | recessed | hub text: engraved pocket · pocket + separate inlay part · raised |
| `grip` | ridges · notches · none | ridges | rim grip, not with a bezel (its groove is there). **ridges** (v5): micro ridges the full thickness of the rim, front to back — round-bottomed grooves 0.9 wide × 0.35 deep, ~1.5 mm pitch (210 on Ø98, a multiple of the frame count so they freeze with the art under a strobe) · notches (v4): 2 per frame, r 3.5 × 1.2 scallops from the back, stopping 1.5 mm short of the front · smooth |
| `seat` | lip · plain | lip | bearing seat: the v3 lip + entry chamfer (print 2: spins much better) · the plain v1/v2 bore, for comparison |
| `weight` | none · bezel · cog | none | bought metal for spin weight (and the tier colour) |
| `bezel` | flat · round | flat | laser-cut flat ring (+ DXF for SendCutSend) · round craft wire ring |
| `cap` | orange · navy · teal | orange | back-cap colour |
| `magnet` | none · disc | none | back cap: plain grip plate with a finger divot · the Ø25 × 5 neodymium pocket (slows the spin 2–3×, see v4 tests; no centre screw then) |
| `screw` | m3 · none | m3 | **centre screw** (v5): M3 × 12 countersunk from the back, through the cap, self-tapping into the hub's stem — clamps hub and cap to the inner race · none = press-fit stems only (v4) |
| `parts` | comma list | all | which parts to show / generate |
| `preset` | full · inlays · testring · stillset · bezel · cog · plain | — | seeds the options; explicit values win |

## Parts

| id | group | what | generated as | printed in |
|---|---|---|---|---|
| `body` | spinning | hub on the 608 outer race (Ø21.9 bore + seat lip), arms, Ø98 wave ring with micro-ridged rim; inlay pockets or relief | STL, back face down | bone / tier colour |
| `wave-water` | spinning | bottom art layer (water, or the plover body), proud or flush (multi-colour art only) | STL | layer colour |
| `wave-foam` | spinning | top art layer (foam, or the plover details), proud or flush | STL | layer colour |
| `hub` | still | Ø51 × 3.0 disc, Ø8.1 stem into the inner race, 1.0 stand-off; text pockets; Ø2.6 blind pilot up the stem for the screw (1.6 skin under the face) | STL, text face down | navy |
| `hub-text` | still | "SURFTOBER 2026" / name, 0.6 inlays — only with `text=inlay` (recessed = pocket in the hub, raised = fused into it) | STL | tier colour |
| `back-cap` | still | Ø51 × 3.0 grip plate (same disc as the hub), stem, 2.2 spacer, Ø18 × 1.6 finger divot with a Ø3.4 hole + Ø6 90° countersink in its bottom; with `magnet=disc` a 5.8 plate with the Ø25.6 × 4.6 pocket | STL, back face down (the divot faces the bed — see print notes) | cap colour |
| `bearing` · `screw` · `magnet` · `weight` | bought | reference bodies (screw with `screw=m3`, magnet only with `magnet=disc`) | STEP only | — |

The **3MF** holds one multi-part object per print unit — spinning piece
(body + inlays), front hub (+ text), back cap — laid out side by side in print
orientation. Open it in Bambu Studio and assign a filament per part; or load
the per-part STLs together and answer *yes* to "single object with multiple
parts". The **STEP** is the mounted assembly with the bearing, magnet and
metal weight, for CAD. Each run also writes `<tag>.json`: options, parts,
volumes, grams, files.

## Dimensions

Key numbers (all in `DIM`): body 7 mm thick (= bearing width), bore Ø21.9,
hub r 16, arms 9 wide, **ring r 33 → 49** (Ø98, v5), wave band r 36.1 → 48.2
(12.1 mm — 10 frames still fit at full size, cell aspect 2.19 vs the 2.06
design cell). Artwork by default is **relief on
the one solid body**: water 0.4 and foam 0.8 above the face, i.e. two
0.2 mm layers each. To print it multi-colour, slice the body alone and add
height-range modifiers to it: face → +0.4 in the water colour, +0.4 → +0.8
in the foam colour (body printed back face down, face at z 7.0, so 7.0–7.4
and 7.4–7.8). The separate inlay-part modes (`proud` 0.4 / 0.7, `inlay`
flush, 0.6 pockets) are still there but were a pain to handle. Rim grip
(v5): **micro ridges** — 210 round-bottomed grooves, 0.9 wide × 0.35 deep at
~1.47 mm pitch, running the full 7 mm from the back face to the front edge,
like a coin's reeded edge. They print as perimeter detail (no overhangs);
keep elephant's-foot compensation on so the first layer doesn't fill them.
The wave band stops 0.8 short of the rim, clear of the grooves. (v4's 20
r 3.5 scallops from the back, stopping 1.5 short of the front, are still
`grip=notches`.) Front hub r 25.5 (the arms show for 7.5 mm between hub
and ring), stem Ø8.1 × 3.3. Press fits to tune: `bore` and `stemD`.

**Clearances and the centre screw (v5).** The front hub rubbed the body on
v4: a 2.4 disc on a press-fit stem could rock, and it sat only 0.6 over the
bearing's spinning outer race (1.2 over the body). Now the hub is **3.0
thick on a 1.0 stand-off** — 1.0 over the outer race, 1.6 over the body —
and the cap matches (2.2 spacer, 1.6 over the body's back face). An **M3 × 12
countersunk screw** (ISO 10642 / DIN 7991, A2 stainless) goes in from the
back: Ø3.4 clearance hole through the cap and its stem, head flush in a
Ø6 countersink at the bottom of the finger divot, self-tapping into a Ø2.6
blind pilot up the hub's stem (≈ 5 mm of thread, 0.75 spare, 1.6 mm of
plastic left under the hub face). Tightened, it clamps the inner race
between the two spacers, so neither disc can rock into the body. Snug it,
don't crank it — the stems are PLA. For a joint that comes apart a lot,
open the pilot to Ø4.0 for an M3 × 4 heat-set insert (`screwPilot`).

**Back cap.** The same Ø51 disc as the front hub, so the trophy reads as
one medallion from both sides and the arms are hidden back and front. The
2.2 mm spacer on the inner race gives 1.6 mm clearance over the body's back
face (the lip makes the body 0.6 proud of the bearing there), matching the
hub's clearance in front. Since the v4 tests (2026-10-31) the default is a
**plain grip plate**, 3.0 thick like the hub (v5), with a **Ø18 × 1.6 mm
spherical finger divot** in the back (v5; v4 had a shallow Ø22 × 1 dish) and
the centre screw's head flush in its bottom — the magnet is out of the
equation for now. Print note: the cap prints back face down, so the divot
faces the bed and its middle is an overhang — paint a support enforcer into
the divot (1.6 mm of support, pops out) or print it bare and sand the
middle smooth. With
`magnet=disc` you get the 2026-10-29 cap instead: 5.8 thick, a loose
Ø25.6 × 4.6 pocket on a 1.2 floor for the Ø25 × 5 adhesive-backed disc,
standing 0.4 proud. Both print back face down, stem up.

**Bearing seat (print 2).** Print 1 wobbled visibly — the ring was not square
to the bearing. The body only gripped the outer race over its 7 mm width, so
any flare or taper in the bore (elephant's foot, a slightly crooked press)
tilted the ring, and the Ø100+ rim multiplies that 8:1. Now a 0.6 mm **lip**
behind the bore (r 9.9 → 10.95, touching only the outer race face — the
shield starts at r 9.6) squares the ring to the bearing, and the bore has a
0.6 mm 45° **entry chamfer**. The body still prints 7 mm thick but sits 0.6
further back, so the bearing stands 0.6 proud of the front face under the
hub. Press the bearing in from the front until it seats on the lip. In the
slicer also turn on elephant's-foot compensation (≈ 0.1 mm) for the bore.

| spinning mass | PLA | note |
|---|---|---|
| body, 3 arms, inlay pockets | ~46 g | the generator prints exact grams per part |
| body, one-colour relief | ~48 g | |
| + flat bezel ring (98 × 91 × 3.18) | +~28 g brass | rim mass, tier metal |
| + bike cog | — | a 22T track cog (tip Ø97.6) just hides behind the Ø98 rim; only as hidden weight, or a chainring |

v5's smaller ring (Ø98 vs Ø103, same width) has ~17 % less spinning inertia in the ring,
so expect a little less spin time from the same bearing.

Ring-size history: Ø80 (r 27.5–40, 8.8 mm band, 2026-10-12) → Ø93 (r 27.5–46.5,
50 % wider band, 2026-10-27) → Ø113 (r 37.5–56.5, 10 mm further out, 2026-10-27,
print 1) → Ø103 (r 35–51.5, band 12.8, 2026-10-28, print 2) → **Ø98 (r 33–49,
band 12.1, 2026-11-04, v5)**.

Print 1 feedback (Chase, 2026-10-28, Ø113 body + hub + cap on a greaseless
608 from a 20-pack): visible wobble, enough to shake the hub; spin-down about
70 % of a bulkier, same-weight, smaller-Ø reference spinner. Diagnosis:
squareness of the ring to the bearing (hence the lip), with some air drag
from the large open disc. Pockets were not the cause.

Print 2 feedback (Chase, 2026-10-29, v3: Ø103 + lip + chamfer): "spins
much better". The lip seat is now the baseline (`seat=lip`, the default);
`seat=plain` keeps the old bore around only for A/B tests.

v4 (2026-10-29): rim notches for flicking, Ø51 back cap for the Ø25 × 5
adhesive magnet. Multi-colour tried first as separate proud inlay parts —
"a nightmare" to handle — so the default went back to one solid body with
the wave in two-level relief, coloured by height in the slicer.

Print 3 / v4 feedback (Chase, 2026-10-30/31): the v4 assembly spun much
worse than v3 with no identifiable wobble. Tested and confirmed:

- **The Ø25 × 5 neodymium disc behind the bearing slows the spin 2–3×.**
  It sits 1.2 mm behind a chrome-steel 608: it preloads the outer race
  axially and magnetises the balls. A neodymium disc on the axis is out.
- **Bearing quality varies 2× in the Amazon 20-pack**: bare flick
  spin-down 10 s (worst) to 20 s (best). Sort every bearing bare before
  it goes into a body; or buy skate-grade / hybrid-ceramic 608s.

Magnet options after this (not built yet): flexible magnet sheet
(0.75 mm, adhesive-backed, Ø50 disc in a shallow well — the striped
poles cancel within a few mm so nothing reaches the bearing, ~800 g hold
for a 70 g assembly, and the cap gets thin and light); small neodymium
discs out at the cap rim (r ≈ 20) instead of one on the axis; a hybrid
ceramic bearing only helps with the ball magnetisation, not the preload.

v5 (Chase, 2026-11-04), after handling the v4 prints:

- "I really don't like how ridges feel right now and I hate that it doesn't
  go to edge" → **micro ridges** the full thickness of the rim (`grip=ridges`).
- "the back should have a nice little divot for finger" → Ø18 × 1.6 divot.
- "the medallion portion is a little too close to spinner and sometimes rubs"
  → hub 2.4 → 3.0 thick, stand-off 0.6 → 1.0, cap spacer 1.8 → 2.2, and the
  **M3 centre screw** through the back cap clamping both to the inner race.
- "reduce OD of spinner by 5 more mm" → Ø103 → Ø98, ring moved in at both
  edges so the band (and 10 full-size frames) survives.
- New animations, 8–10 frames: the plover getting barreled, and a break whose
  lip "extends out further instead of breaks so vertical" (below).

## Animations — the plover in the barrel, the hollow throw (v5)

First v5 try (a filled navy wave with a cream bird, streaks and a bubbly
lip) was "god awful" (Chase, 2026-11-04). Redone:

**Plover in the barrel** (`kind: 'scene'`, drawn by `barrelScene()` in
`wave-frames.js`). The wave pitches to the **left** and stays open: the tube
is a real hole in the navy, so the ring's own colour shows through it. The
plover is **the logo bird**, traced from the Surftober logo (its own pixel
coordinates in `LOGO_BODY` / `LOGO_COLLAR`, head circle r 65 at 470,480,
scaled by `LOGO.s`): cream body and head, navy cap, eye and partial collar
(holes in the cream, joined to its edge by hairline slits the slicer
ignores), navy pointed bill and long thin legs with flat feet, and a navy
outline round the cream so it reads against the ring colour. It faces left
like the logo, out of the tube's mouth, on a cream board with a navy rim.
The lip **throws out and pulls back** hard each loop — the whole lip scales
about a pivot under the crest (`lip` in `motion`: ±40 % in all three; when
throwing it reaches out only 0.6× as far as it drops, so the tip stays in the
slot), from reaching the water to pulled well back — while spray flicks off
its tip and the bird bobs and rocks its board, knees taking the crouch.
The plover **walks with the wave** (`walk` in `motion`, ±0.06 of the slot
height): as the lip pulls back it takes two steps forward along the board,
front foot then back foot, each lifted mid-swing; as the lip throws over it
takes two steps back, back foot first. In `plovertuck` the lip only throws,
so the bird is fully forward when it's open and fully back when it closes out.
(History, 2026-11-04: v1 a filled wave with a cream songbird, "god awful";
v2 an open tube with a navy songbird, "doesn't look like a plover"; v3 the
logo plover at ±24 %; v4 this — "swing the wave 40 %", and the walk.)

| style | frames | what moves |
|---|---|---|
| `plovertube` — Plover in the barrel (v5 default until 2026-11-07) | 10 | the base loop above |
| `ploverspit` — the barrel spits | 8 | + a stream of spray blown out of the tube's mouth; the bird crouches lower |
| `plovertuck` — tuck and stand | 9 | the lip pitches all the way out (closing out the frame) mid-loop while the bird tucks, then both open up again |
| `ploverwash` — whitewater lip | 10 | the base loop, but the foam is the whitewater-return bubble cluster riding the lip tip (small as it pulls back, boiling up as it throws), with a thinner feathering edge (`foam: 'ww'`) |
| `plovercross` — crossed legs | 10 | whitewater lip + the legs crossed in an X, each foot under the other hip (`legs: 'cross'`) |
| `ploverxstep` — cross-steps | 10 | whitewater lip + cross-stepping: the back foot crosses over the front one, like walking to the nose; longer walk ±0.09 (`lead: 'back'`) |
| `plovertuckx` — tuck, crossed legs | 9 | `plovertuck` with the whitewater lip and crossed legs |
| `ploverback` — cross-steps, breathing back | 10 | `ploverxstep` + the back slope widens ±12 % about the crest while the lip is pulled back and narrows as it crashes (`back`); wave moved further right (`shift: .32`) with the plover left where it was (`birdShift: .22`) so its tail clears the back wall |
| `ploverbacklag` — back follows the crash | 10 | the same, ±14 %, narrowing a tenth of a loop after the crash (`backLag: .1`) |
| `ploverbackrise` — back stands up | 10 | the same, ±12 % with a small lag, and the back's shoulder stands up 7 % as it narrows (`rise`) |
| `ploverxstep2` — shorter walk, wobblier board | 10 | `ploverxstep` with the walk cut to ±0.04 (was ±0.054) and the plover centred in the tube (`shift: .3`, `birdShift: .25`), so beak and tail stay ≥ 0.03 clear of the wave in every frame; the board rocks ±2° (`tilt: 2`) plus a quicker wobble twice a loop (`wobble: .8`); the wave itself is still |
| `ploverfull` — back fills and hollows | 10 | `ploverxstep2` + the back slope bulges out along its normal while the lip draws back and sucks in once it has thrown (`full: .09`), foot and crest fixed |
| `ploverswell` — swell rolls up the back | 10 | `ploverxstep2` + a bump runs up the back once a loop and reaches the crest as the lip throws (`swell: .07`) |
| `ploverlean` — wave leans into the throw | 10 | `ploverxstep2` + the whole wave shears with height, leaning into the throw and rocking back (`lean: .07`); the plover rides with it |
| `ploverslide` — whole wave surges left | 10 | `ploverxstep2` + the whole wave and the plover surge ±0.07 left as the lip throws and back right as it draws up (`slide: .07`, `shift: .37`) |
| `ploverlive` — all of it a little | 10 | `full .05`, `swell .04`, `lean .03`, `slide .05` together |
| `ploverleanlines` — lean + flowing face lines (**default**, Chase's pick 2026-11-07) | 10 | `ploverlean` + one cream line inside the back (`TEX.face`), broken into two dashes flowing up towards the crest once a loop (`tex: { face, dash: 2 }`) |
| `ploverleancarve` — lean + carved face lines | 10 | the same, cut out of the navy so the ring colour shows (`carve`) |
| `ploverleanbarrel` — lean + spinning barrel lines | 10 | cream dashes running up the back wall and along the tube's ceiling towards the lip (`TEX.barrel`) |
| `ploverleanbubbles` — lean + bubbles up the face | 10 | four cream bubbles (r ≥ 0.034) drifting up the back and popping near the crest |
| `ploverleanwoodcut` — lean + woodcut strokes | 10 | two solid tapered cream strokes up the back (`face` + `face2`), no flow |
| `ploverleancarvecut` — lean + carved woodcut | 10 | the woodcut strokes cut out of the navy |

Calmer pass (Chase, 2026-11-04, "plover movement lessened by 40 %", "less overall movement" for the
barrel, "the foam ball splashes a little bit when it crashes over"): in the four whitewater options
the lip swings ±30 % (the older styles keep ±40 %); the walk, foot lift, bob, rock and crouch are all
0.6× (`ploverxstep` gets a narrower stance, `stance: .6`, so its feet still cross on the shorter
walk); and near the top of the throw droplets flick up and out of the foam ball and fall back in
(`splash`, `SPLASH`), none smaller than 0.034 of the band (~0.8 mm) so they print.

In all four the wave sits further right in its slot (`shift: .22`, with the back slope squeezed so its foot
stays at the edge), which lets the lip throw out further (`reach: 1` of its drop, `.85` for the tuck)
with the whitewater still whole inside the slot ("too far left in frame and the white water is
getting cut off").

Chase picked the cross-step (2026-11-04) and asked for more movement in the back of the wave
("a little bit wider" before it barrels, "compress and get a little bit skinnier" once the whitewater
has crashed) and the wave a bit further right so the plover's tail stops going into it on the
step back; those three are new styles beside `ploverxstep`, which is unchanged.

Round 3 (Chase, 2026-11-04): "plover is now moving too far forward and beak is hitting wave", "make
surfboard wobble a little more", and the breathing back didn't look natural — "maybe the whole wave is
moving right to left if there's room in frame … play around with some options". Measured clearances
first: `ploverxstep` ran its tail ~0.02 into the back wall stepping back, `ploverback` its beak ~0.02
into the lip stepping forward. `ploverxstep2` fixes both, and five styles try whole-wave motion
instead of scaling the back (`full`, `swell`, `lean`, `slide` in `barrelScene`). All are new styles;
nothing earlier changed.

Texture (Chase, 2026-11-04: liking `ploverlean`, "should we add any texture to the wave itself? Riff on
this"): `texture()` / `TEX` lay lines a fixed depth under the wave's surface, so they lean and throw with it.
Print limits set the layout: lines ≥ 0.045 of the band (~0.55 mm), bubbles r ≥ 0.034, and ≥ ~0.04 of navy
between a line and either edge of the wave or another line (measured in every frame). The back of the wave
is only ~0.25 thick and the lip ~0.13 with its foam edge, so the lines stay on the back below the crest,
at most two at a time, and none in the lip. They also stop above the flat sea, where the sea band would
fill a carved line back in.

The four whitewater options came from Chase's 2026-11-04 notes ("foam a little closer to
whitewater return", "legs crossed over each other", added as new styles without changing the
old ones; no more work on `ploverspit`). Note for 2D renders: fill each polygon on its own
(non-zero). An even-odd fill over a whole layer cancels where shapes overlap, which put gold
spots on the bird in the first GIFs; the demo, viewer and CAD already fill per polygon / union.

**Hollow throw** (`hollow`, 10 frames, a keyed wave like the whitewater
return). The lip doesn't pitch straight down: it throws out almost
horizontally over a long open tube, lands near the far edge of the slot,
explodes, and the foam is drawn back up into the next lip. Shapes `hpeak` →
`hthrow` → `htube` → `hcurtain` → `hland` → `himpact` → `hrebuild` in
`SHAPES`; foam rides the lip tip (`tip` keys).

Colours as before: navy (0.4 relief) and cream (0.8). In the plover scenes
the bird is cream with navy markings showing through holes, on a navy outline, so no third colour.
Smallest features at the v5 band: legs ≈ 0.45 mm, eye ≈ 0.5 mm.

# Design notes and decision log

## Last year (2025) for reference

3D-printed multi-colour plaques: blue background, red Golden Gate bridge,
"SURFTOBER 2025" in a medal-ish colour, a cable car carrying the name, sand
strip along the bottom. The cable car's colour carried the tier (gold,
silver, rose/bronze, green for participants). Everything below keeps that
idea — **one colour carries the tier** — and swaps the bridge/cable-car
motif for the new plover-on-the-dune logo.

## Ideas (Chase, 2026-10-08)

1. Wooden, laser-cut, with a trim in the medal colour.
2. Laser-cut metal that is itself the magnet.
3. Modular: base piece made separately from the name piece.
4. A fidget-spinner design that doubles as a fridge magnet.
5. Something surf-shaped — a fin, a fin key.
6. Something riffing on the Dutch windmill at Ocean Beach.

Natural pairings: 1 + 3 (laser-cut base, slot-in name tab, medal trim) and
2 + 4 (metal spinner with a magnet core).

## Concept C build plan (Chase, 2026-10-10)

Past trophies were fridge magnets with 3D-printed parts; this year's leading
idea is a **metal fidget spinner that still sticks to the fridge**. About 50
units. No wave-shaped spinner. Chase CADs it and does the cap and ring work.

**Magnet cap**
- Magnet goes in a centre cap, not the bearing: neodymium disc, N42+,
  ~10 × 2 mm, in a pocket on the cap's outward face ~0.2 mm oversize for a
  glue fit, flush or slightly recessed.
- The cap mounts on the stationary inner race, so the magnet doesn't spin;
  keep it thin and clear of the ball track to protect spin time.
- Bearing: 608 (8 × 22 × 7) — measure the stock piece. Cap ~14–20 mm OD,
  matching existing caps. Bare 6061 caps, add the pocket, anodize in
  Surftober colours.

**Medal ring**
- Every unit gets the same stock tri-spinner body and the same magnet cap —
  no per-unit engraving.
- A cheap printed ring sits on the front face and carries the medal colour
  and the trophy text ("SURFTOBER 2026 · GOLD", name).
- Stock bodies usually have a press-fit metal weight insert in each lobe,
  which leaves only a small hole. The ring therefore has three **full rods
  that pass all the way through** those holes (ending just short of the back
  face), and it has to be **wide** — roughly from just outside the centre cap
  to past the lobe tips — to cover the lobe centres. Its outer edge follows
  the arms (r 40 over each lobe, curving in to r 30 between them) so there's
  still an edge to flick. The mockup uses a Ø8 insert hole, Ø7.7 rods and a
  ring from r 17; all placeholders.
- Balance: symmetric ring, even infill, evenly inset or embossed text.
  Retention: snug pegs or a snap fit, CA glue as backup.
- Fridge clearance: nothing on the ring may sit proud of the back — the back
  magnet cap stays flat on the door.
- Filament: silk gold / silver / bronze PLA, AMS or a filament swap for
  two-colour text, PETG if toughness matters. Extra outer mass may even help
  spin time.
- Pick a tri-spinner body with open lobe holes and measure them before
  CADing the pegs.

**Body and text approaches (2026-10-11)**

Chase wondered whether the stock spinner is needed at all, and whether the
text should stay still. The 3D viewer now has **Body** and **Text** switches
(`?body=stock|printed|metal&text=ring|hub`) to mix and match. Every option
keeps the 608 bearing and the magnet back cap, so fridge clearance is the
same for all of them.

- **Body: stock spinner + ring** — the plan so far: bought metal tri-spinner
  ($4.58–5.66), printed ring with rods through the lobe inserts. Heavy and
  proven, but we're designing around a part we don't control.
- **Body: printed disc + bearing** — one printed disc (7 mm, the bearing's
  width) pressed onto the 608. Weight comes from 12 M6 hex nuts (~2.5 g each,
  ~30 g total at r 33) sealed inside by pausing the print at the pocket depth
  and dropping them in, with 1 mm of plastic left on each face. Cheapest by
  far (filament + bearing + nuts + caps), full design freedom, and the whole
  face is available for artwork. Feels less like a metal trophy.
- **Body: metal disc + bearing** — a laser-cut 2 mm disc glued to a printed
  hub that holds the 608, with the metal itself carrying the tier: brass =
  gold, stainless = silver, copper = bronze. Roughly 65–75 g of disc, so it
  spins for a long time. The artwork would have to be UV-printed or engraved
  and filled, and it needs a quote (per-unit cutting + finishing).
- **Text: on a still hub** — a printed hub (Ø32) replaces the front cap. It
  rides the inner race on a stand-off that clears the spinning face, so it
  never turns: the text stays readable while spinning, and in the phone video
  it stays put while the waves play. Navy hub with tier-colour text, per-unit
  names printed cheaply. It also frees the spinning face for artwork only.
  `wave-demo.html` has the same Text switch to preview the video.

**Spin weight: are the M6 nuts needed? (2026-10-12)**

No — they're optional. The printed disc is one print either way (the pause
just drops the nuts in; the exploded view splits it only to show them).
Rough rotational inertia for the r 11–40, 7 mm disc (estimates, not
measured):

| Printed disc | Mass | Inertia |
|---|---|---|
| ~20 % infill, no nuts | ~15 g | ~13k g·mm² |
| **100 % infill, no nuts** | ~40 g | ~34k g·mm² |
| ~20 % infill + 12 M6 nuts | ~45 g | ~46k g·mm² |

- A solid print gets about ¾ of the nut version with no hardware and no
  pause. Inertia goes with r², so a slicer modifier that prints only the
  outer band at 100 % (and the middle light) does most of the work.
- The bearing matters as much as the weight: a stock 608 is packed with
  grease and spins down fast. Degrease it (isopropyl soak, dry, one drop of
  light oil) or buy "fidget"/ceramic 608s.
- The animation doesn't need a long spin: at 30 fps the wave plays around
  180 RPM, which every spin passes through near the end. Spin time matters
  most for 240 fps slo-mo, whose sync speed is ~1800 RPM (10 frames).
- If a solid disc still spins too briefly: open pockets on the back face
  (against the fridge, never seen) with nuts or steel balls pressed or glued
  in after printing — no mid-print pause.
- Plan: test a solid disc with a cleaned bearing first; add weight only if
  it needs it.

**Buying 608 bearings**

608 = 8 × 22 × 7 mm, the skateboard-wheel bearing, so it's everywhere.

- Bulk: eBay (lots of 100), AliExpress, mklbearing.com. Generic 608s are a
  commodity part, usually well under a dollar each in 50–100 packs.
- Quick tests: Amazon "608ZZ" 10/20-packs or "fidget spinner bearing 608"
  (often pre-cleaned).
- Consistent quality: a bearing specialist such as VXB.com, or McMaster-Carr
  (pricier).
- Premium: hybrid ceramic 608s (steel races, ceramic balls) spin noticeably
  longer at a few dollars each.
- Same day: any skate shop (good, but pricey per bearing).
- In listings: **ZZ** (metal shields) beats **2RS** (rubber seals, which
  drag); "fidget", "low-noise", "ABEC-7" or "light oil" are good signs.
  Check it really says 608 — many commercial spinners use the smaller R188,
  which won't fit 608 caps.
- For the test print: a 10-pack of generic 608ZZ plus 2–3 hybrid ceramic,
  each spun in the same disc. Then order ~60 (50 + duds and test pieces).

**Patterns that only show up when it spins (ideas, not yet mocked)**

Spun fast, every point on the ring smears into a circle, so the eye sees the
average colour at each radius. Only concentric rings can appear out of
nowhere, not text or pictures. Ways to use that on the ring's front face:

1. **Confetti → bullseye (favourite).** Scatter dots and dashes so the still
   ring looks random; spinning, each radius averages into a solid band and a
   sunset bullseye (orange / sand / teal, like the logo) appears. Denser dots
   at a radius = a stronger band, so the rings can be shaded. Works with
   two-colour AMS printing.
2. **Colour mixing.** Thin alternating orange and teal wedges in one band read
   as a single new colour in motion. Easy add-on to 1.
3. **Benham's disk.** A specific black-and-white arc pattern that makes faint
   illusory colours appear when spun. Needs high contrast, so black on silver
   beats navy on gold.
4. **Freeze-frame animation — chosen, as a breaking wave (2026-10-11).** See
   "Breaking-wave band" below.

**Breaking-wave band (disk ring)**

- N frames of a wave in equal slots on the outer band (r 30.6–39.4), running
  clockwise from the top. Navy water and cream foam on the medal colour, with
  the sea at the same height at every slot edge so it reads as one band at
  rest.
- Four styles (2026-10-11), each available at 6–16 frames:
  - **Classic break** (12): one wave in place — swell, peak, lip throws,
    barrel, lip lands, impact, slump — and the next swell already rising
    behind the whitewater so the loop doesn't restart from a flat sea.
  - **Rolling set** (10): waves travel through each slot ¾ of a slot apart,
    breaking mid-slot and rolling out while the next one rises behind. Reads
    as continuous motion with no reset; waves get cut off at the slot edges.
  - **Barrel loop** (8): a standing wave that keeps throwing and landing its
    lip, like a wave pool. Shortest loop, chunkiest artwork.
  - **Whitewater return** (10): the whitewater doesn't run off. After the
    explosion it's drawn back to the foot of the wave, up the face and over
    the crest, where it becomes the feathering lip that throws and explodes
    again, so the same foam circulates (Chase's idea, 2026-10-11).
- Fewer slots = bigger, chunkier frames but a faster, choppier loop. One loop
  always lasts N video frames on playback (0.40 s for 12 at 30 fps, 0.27 s
  for 8), which is why 12 frames can feel frantic; the demo's "Slow ×4"
  shows the frames at a readable pace.
- A phone video turns it into an animation when the ring turns one slot per
  video frame: RPM = 60 × fps ÷ N — for 12 frames 150 RPM at 30 fps, 300 at
  60, 1200 at 240 slo-mo; for 8 frames 225 / 450 / 1800. Two or three slots
  per frame also work but look choppier. A spinner slows steadily, so it
  passes through these speeds by itself; just past sync the waves also drift
  clockwise, with the break.
- Flick it **counter-clockwise** as you face it; clockwise plays it backwards.
  Film in bright light (or slo-mo, which forces a fast shutter) so it doesn't
  blur. 240 fps slo-mo is probably the easiest because the sync speed lands in
  a spinner's normal range.
- Anything on the ring that doesn't repeat every slot (the text, the name)
  jumps around in the video. If that's distracting, the band could also carry
  a repeated mark, or the text could move to the non-spinning cap.
- Print the artwork as flush colour changes, not raised, so every slot weighs
  the same; the smallest drops are ~0.6 mm. Shapes within a colour overlap in
  the SVG, so union them in CAD.

Related: the caps don't spin (they're what you hold), so a logo
laser-engraved through the anodizing on the front cap stays crisp while
everything around it blurs. It's the same cap for every unit, so it doesn't
break the no-per-unit-engraving rule.

**Sourcing**
- gs-jj.com — finished metal spinners, $4.58–5.66 each, 50 minimum.
- qstomize.com — laser engraving, ~$4.25 each.
- Etsy HREFAB — magnetic 6061 608 caps, ~$15/set (good design reference);
  cheaper bare caps: FidgetThings ~$2.00, others ~$1.25.
- smrtgadget.com — bare 6061-T6 608 buttons made for anodizing.
- Bulk 608 bearings: eBay (lot of 100), mklbearing.com, AliExpress.

## Concept C v3 — fully printed, ring on arms, wide text hub (Chase, 2026-10-12)

Lead direction as of 2026-10-12: **no metal body.** Everything but the 608
bearing and the magnet is printed. The wave ring stays the hero and the
text lives on a still front hub.

The new body option, `Body: printed ring on arms` in the viewer
(`?body=spoked&text=hub&arms=3|4`):

- **One printed piece:** a hub pressed onto the bearing's outer race, three
  or four straight arms, and the wave ring out at the rim (r 27.5 → 40).
  Putting the mass at the rim is where it helps spin time most; the open
  windows between the arms save material and print time versus a disc.
- **Wide still hub (r 25.5)** on the inner race carries "SURFTOBER 2026",
  the name and a small plover medallion. It covers the arms almost
  entirely — from the front you see the wave ring, a ~2 mm dark reveal,
  and the hub. The arms only show in the Exploded view or from the back.
  Text on the ring is disabled for this body (no room, and it would spin).
- **3 vs 4 arms.** Three echoes the tri-spinner heritage and leaves the
  biggest windows; four is stiffer, prints with less overhang at the
  ring joints, and divides evenly into the 8-, 12- and 16-frame wave
  variants (three divides 12 only). Decide after a test print — stiffness
  of the ring-to-arm joint is the thing to feel for.
- **Weight:** the ring alone is lighter than the nut-filled disc. If spin
  time disappoints, the ring is thick enough (7 mm) to seal six M6 nuts
  into it at the arm roots without changing the look.
- Caption and arm-count selector update live; `setBody('spoked', 4)` from
  the console switches it for screenshots.

## Metal weight ring — and the metal as the tier colour (Chase, 2026-10-19)

> Numbers in this section are for the original Ø80 ring (r 27.5–40). The ring is
> now r 27.5–46.5 (Ø93, see Dimensions above): the solid body is ~44 g and the
> bezel / cog weights scale up with it, so the ratios hold but not the grams.

Question: is there a metal ring or outer gear we could build in for spin
weight, visible is fine, maybe even as the tier indicator? Yes — two
bought parts fit the ring-on-arms body without changing the print much,
and both come in brass / stainless / copper finishes, so the metal can BE
the tier and the print becomes one neutral filament for every trophy.
Viewer: `Weight` option or `?weight=bezel|cog`;
with a weight fitted the print renders bone-coloured, the metal in the
tier colour.

| Spinning mass | Weight | Spin inertia (g·mm²) | vs solid print |
|---|---|---|---|
| Solid bone print (ring r 27.5→40 × 7, arms, hub) | ~30 g | ~29k | 1× |
| + 12 M6 nuts sealed in (old disc idea, for reference) | ~60 g | ~46k | 1.6× |
| **+ O-ring bezel** Ø80 × 3.5 mm wire, steel / brass / copper | +18–21 g | ~57k | **~2×** |
| **+ bike cog** 19T 3/32" steel, Ø85 tip, 2.3 mm | +~60 g | ~89k | **~3×** |

Inertia is what sets spin time once the bearing is cleaned; mass at the
rim counts for r², which is why 20 g of ring at r 38 beats 30 g of nuts
at r 33.

**Bezel (lead if we want subtle).** A craft "metal O-ring" (macramé /
dreamcatcher rings: steel in silver, gold and antique-bronze finishes;
solid brass and copper rings from jewellery suppliers) snapped into a
half-round groove around the outer face of the wave ring, standing ~0.6 mm
proud so it reads as a bezel. Doesn't touch the wave art on the front
face. Print the groove to the ring you buy: groove centre radius = ring
OD / 2 − wire / 2; a 3" (76 mm) ring means ringOut 38, an 80 mm ring
means 40. Glue with a drop of CA at three points; the groove's lip holds
it. Tiers: brass = gold, stainless = silver, copper = bronze, black-oxide
steel = participant.

**Cog (lead if we want the gear look and the weight).** A single-speed /
track cog, 18–19T for 3/32" chain (tip Ø ≈ 80–85 mm, bore 1.37" × 24 tpi
≈ 34.8 mm, 2.3 mm thick, ~55–65 g in steel), glued onto a printed boss
behind the body — print the boss at the thread's minor diameter and it
threads/presses on. From the front only the teeth show past the r 40 rim;
from the back it's a bike part. Finishes: gold-plated and chrome are
everywhere (fixie market), black is everywhere, copper-plated steel is
rare — for bronze either a copper-tone anodized aluminium cog (looks
right, but only ~15 g) or a black cog and let the hub text carry the tier.
Adds 2.3 mm behind the body; still clears the 3.8 mm back-cap stand-off
and the fridge. Overall Ø grows to ~85.

**Neutral print.** If the metal carries the tier, the whole run prints in
one filament (bone / cream here so the navy wave reads), the only per-tier
difference is the bought ring or cog. That's less filament swapping and a
more "trophy-like" material mix than coloured plastic.

Test-print plan: print one bone ring body, spin it bare, then with a $3
craft ring and a $8 cog, and time each. Pick by feel and by look.

## Wave foam — direction (Chase, 2026-10-12)

"Whitewater return" is the keeper. Three computed "foam pinned to the lip"
styles were tried the same day and dropped (last at trophy commit `97d319f`);
they parked a small cap on the crest for the whole loop, which is not it.
What Chase actually wants, if `return` is ever iterated: foam sits at the
**apex before the wave breaks**, then **moves with the tip of the lip** as the
lip pitches and comes down — minimal whitewater, no base explosion.

Built as `returntip` and `classictip` (2026-10-12, second attempt): same
surface keys as the originals, foam anchored to the lip-tip point every frame
with a keyed size curve (peaks ~0.1 at impact vs 0.17 before) and a little
spray only at landing. Compare: `wave-demo.html?wave=returntip` /
`?wave=classictip` against `return` / `classic`.

## Image-generation prompts (Midjourney / ChatGPT / Gemini)

Prepend the shared style line to each concept prompt. For other tiers swap
"metallic gold" for "brushed silver", "warm bronze", or "matte seafoam green"
(participant), mirroring the 2025 cable-car colours.

### Shared style line

> Product photo of a small 3D-printed award, multi-colour FDM print with
> visible but tidy layer lines, matte PLA, sitting on a white studio surface
> with soft shadows, 45-degree three-quarter view, shallow depth of field.
> Brand palette: navy #1d3050, brand orange #ff6b35, cream #efe7d2, sand tan
> #b89b70, teal #3aa9a3. Medal tier colour: metallic gold. Text reads
> "SURFTOBER 2026" and the name "NAHLA".

### Concept C — spinner magnet

> A gunmetal tri-lobe metal fidget spinner about 8 cm across with open lobe
> holes and a 608 bearing in the centre, orange anodized aluminium centre
> caps, and a 3D-printed silk-gold PLA ring about 8 cm across clipped onto
> its front face, the ring reading "SURFTOBER 2026 · GOLD" around the top and
> "NAHLA" around the bottom in raised navy letters. Show it parked on a
> stainless fridge door, held by a small magnet in the back cap.

### Variations worth asking for

- The spinner in laser-cut steel, "the whole piece is the magnet" (idea 2).
- A family shot: five spinners in a row on a fridge, one per tier colour,
  names visible — the equivalent of the 2025 group photo.

## Archived concepts (2026-10-12)

Decision: all in on the spinner. Concepts A (modular plaque), B (fin magnet)
and D (windmill) were removed from the viewer and this doc. They last exist
in full — builders, captions, image prompts — at commit `4557532`:

    git show 4557532:design/trophy/viewer.html
    git show 4557532:design/trophy/README.md
