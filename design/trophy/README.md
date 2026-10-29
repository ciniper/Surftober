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
| `name` | text, ≤ 16 | NAHLA | on the still hub, along the bottom |
| `tier` | gold · silver · bronze · participant | gold | body colour, or the metal when a weight is fitted |
| `arms` | 3 · 4 | 3 | arms carrying the ring |
| `wave` | classic · rolling · return · barrel · returntip · classictip | return | animation style (see wave demo) |
| `frames` | 0 · 6…16 | 0 = auto | slots around the band; auto = the most slots whose cells don't shrink the wave (8 on this band); fewer = faster loop, bigger art |
| `art` | inlay · raised · none | inlay | wave: flush multi-colour pockets + inlay parts · one-colour relief fused into the body · plain |
| `text` | recessed · inlay · raised | recessed | hub text: engraved pocket · pocket + separate inlay part · raised |
| `weight` | none · bezel · cog | none | bought metal for spin weight (and the tier colour) |
| `bezel` | flat · round | flat | laser-cut flat ring (+ DXF for SendCutSend) · round craft wire ring |
| `cap` | orange · navy · teal | orange | back-cap colour |
| `parts` | comma list | all | which parts to show / generate |
| `preset` | full · testring · stillset · bezel · cog · plain | — | seeds the options; explicit values win |

## Parts

| id | group | what | generated as | printed in |
|---|---|---|---|---|
| `body` | spinning | hub on the 608 outer race (Ø21.9 bore), arms, wave ring; inlay pockets or relief | STL, back face down | bone / tier colour |
| `wave-water` | spinning | navy water inlays, flush (inlay art only) | STL | navy |
| `wave-foam` | spinning | cream foam inlays, flush (inlay art only) | STL | cream |
| `hub` | still | Ø51 × 2.4 disc, Ø8.1 stem into the inner race, 0.6 stand-off; text pockets | STL, text face down | navy |
| `hub-text` | still | "SURFTOBER 2026" / name, 0.6 inlays — only with `text=inlay` (recessed = pocket in the hub, raised = fused into it) | STL | tier colour |
| `back-cap` | still | Ø18 × 3 cap, stem, Ø10.2 × 2.1 magnet pocket | STL, fridge face down | any / anodized Al |
| `bearing` · `magnet` · `weight` | bought | reference bodies | STEP only | — |

The **3MF** holds one multi-part object per print unit — spinning piece
(body + inlays), front hub (+ text), back cap — laid out side by side in print
orientation. Open it in Bambu Studio and assign a filament per part; or load
the per-part STLs together and answer *yes* to "single object with multiple
parts". The **STEP** is the mounted assembly with the bearing, magnet and
metal weight, for CAD. Each run also writes `<tag>.json`: options, parts,
volumes, grams, files.

## Dimensions

Key numbers (all in `DIM`): body 7 mm thick (= bearing width), bore Ø21.9,
hub r 16, arms 9 wide, **ring r 35 → 51.5** (Ø103), wave band r 38.1 → 50.9
(12.8 mm — the whitewater return fits its native 10 frames at full size, cell
aspect 2.18 vs the 2.06 design cell), inlays 0.6 deep, relief 0.6 / 0.9
(water / foam). Front hub r 25.5 (the arms show for 9.5 mm between hub and
ring), stem Ø8.1 × 3.3. Press fits to tune: `bore` and `stemD`.

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
| + flat bezel ring (103 × 96 × 3.18) | +~30 g brass | rim mass, tier metal |
| + bike cog | — | a track cog hides behind a Ø103 rim; only as hidden weight, or a chainring |

Ring-size history: Ø80 (r 27.5–40, 8.8 mm band, 2026-10-12) → Ø93 (r 27.5–46.5,
50 % wider band, 2026-10-27) → Ø113 (r 37.5–56.5, 10 mm further out, 2026-10-27,
print 1) → **Ø103 (r 35–51.5, band 12.8, 2026-10-28, print 2)**.

Print 1 feedback (Chase, 2026-10-28, Ø113 body + hub + cap on a greaseless
608 from a 20-pack): visible wobble, enough to shake the hub; spin-down about
70 % of a bulkier, same-weight, smaller-Ø reference spinner. Diagnosis:
squareness of the ring to the bearing (hence the lip), with some air drag
from the large open disc. Pockets were not the cause.

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
