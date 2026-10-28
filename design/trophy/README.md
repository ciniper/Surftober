# Surftober 2026 trophy — the spinner (concept C)

**Branch note: `trophy` is a design scratch branch. Do NOT merge it into
`main`** — nothing here is part of the site. It exists so the mockup viewer,
the prompts and the idea list live somewhere versioned while the trophy is
being decided. If a concept wins and needs printable files, start those from
this branch and decide then whether anything belongs in main.

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

## Viewing the previews

Both pages use ES-module imports and load three.js from unpkg, so they need
internet and a local static server (opening them as `file://` won't work).
From the repo root:

    python3 -m http.server 8930 --directory design/trophy

Then open **http://localhost:8930/** — `index.html` links both previews, and
they link to each other, so one server session covers everything. Direct links,
on the same computer: `localhost` links don't work from a
phone or another machine; send screenshots, or publish a page, if someone
else needs to see it.

- 3D viewer: http://localhost:8930/mockups.html?name=NAHLA (spinner only
  since 2026-10-12; the other concepts are archived, see the end)
  - Printed disc + still hub + whitewater return (current pick):
    http://localhost:8930/mockups.html?body=printed&text=hub&wave=return&name=NAHLA
  - Metal disc + still hub:
    http://localhost:8930/mockups.html?body=metal&text=hub&wave=return&name=NAHLA
  - Stock spinner + ring (the original plan):
    http://localhost:8930/mockups.html?body=stock&text=ring&name=NAHLA
- Wave demo: http://localhost:8930/wave-demo.html?wave=return&text=hub
  (also `?wave=rolling`, `classic`, `barrel`)

URL options (both pages where they apply): `body=stock|printed|metal`,
`text=ring|hub`, `ring=wave|disk|notched`, `wave=classic|rolling|return|barrel`,
`frames=6…16`, `name=YOURNAME`. Every option also has a control on the page.

Viewing tips:
- In a narrow window the wave demo stacks its views; **Phone video** is the
  first one. **Still** never moves, by design.
- At sync the phone view looks parked while the wave plays; that's the
  effect. **Real spin, slowed 20×** shows how the ring actually turns.
- After changing wave style, frame count or camera, press **Snap to sync**
  or the phone view sits between sync speeds and just jitters.
- In the 3D viewer, **Phone-cam demo** turns the ring head-on and steps it
  like a 30 fps video; **Auto-rotate** and **Spin body** stop the motion for
  a close look.

## Mockup viewer

`mockups.html` — self-contained three.js scene, four blocky procedural
concepts to judge proportions and the modular idea (not finish).

Buttons switch concept, the dropdown switches the medal tier colour,
`?name=` sets the name, "Download PNG" saves the current camera angle.

- **C · Spinner magnet (v2, 2026-10-10)** — see "Concept C build plan" below.
  Stock metal tri-spinner + 608 bearing, metal weight inserts in the lobes,
  anodized 6061 caps with the magnet in the back cap, and a wide printed
  medal-colour ring on the front with three full-length rods through the
  inserts' holes. Extra buttons: cap colour, **Exploded**
  (parts pulled apart along the axis) and **On fridge** (steel door touching
  only the back cap), plus **Spin body** to stop or start the body spinning.
  **Ring** switches between *disk + wave* (default), plain *disk* and
  *notched*; `?ring=wave|disk|notched` does the same from the URL.
  **Wave** picks the animation style (below). **Phone-cam demo** steps the
  ring the way a 30 fps phone video sees it near the sync speed, so the wave
  breaks on screen. **Body** and **Text** switch between the build approaches
  below (stock / printed / metal disc; text on the ring or on a still hub).
  Dimensions are placeholders until real parts are measured.


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

Question: is there a metal ring or outer gear we could build in for spin
weight, visible is fine, maybe even as the tier indicator? Yes — two
bought parts fit the ring-on-arms body without changing the print much,
and both come in brass / stainless / copper finishes, so the metal can BE
the tier and the print becomes one neutral filament for every trophy.
Viewer: `Weight:` selector (ring-on-arms body only) or `?weight=bezel|cog`;
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

## CAD generator — STL + STEP (2026-10-27)

`design/trophy/cad/spinner.py` builds the real parts with CadQuery
(OpenCascade kernel), not the three.js preview meshes: proper booleans,
flush inlay pockets, exact bores. One-time setup, then one command per
trophy:

```bash
cd design/trophy/cad && ./setup.sh          # venv + cadquery (Homebrew python3.12, needs node too)
.venv/bin/python spinner.py --name NAHLA --arms 3 --wave return
.venv/bin/python spinner.py --name KAI --arms 4 --weight bezel --bezel flat
.venv/bin/python spinner.py --name MOANA --weight cog --wave classic
```

Output in `cad/out/` (gitignored — regenerate, don't commit), ~11 s a run:

| file | what | print it in |
|---|---|---|
| `<tag>-body.stl` | hub on the 608 (Ø21.9 bore), N arms, wave ring with 0.6 mm pockets | bone / tier colour |
| `<tag>-wave-water.stl` | navy water inlays, fill the pockets flush | navy |
| `<tag>-wave-foam.stl` | cream foam inlays | cream |
| `<tag>-hub.stl` | still front hub (Ø8.1 stem, r 5.5 spacer, r 25.5 disc) with text pockets | navy |
| `<tag>-hub-text.stl` | "SURFTOBER 2026" over the top, name along the bottom, 0.6 mm inlays | gold / silver / copper |
| `<tag>-back-cap.stl` | printed stand-in for the magnet cap: stem, spacer, Ø10.2 × 2.1 pocket | anything |
| `<tag>.step` | coloured assembly of all of the above + a 608 + the metal ring, mounted | — |
| `metal-ring-flat-81.2x74.2.dxf` | the flat bezel ring outline for SendCutSend (`--weight bezel --bezel flat`) | brass / stainless / copper 0.125" |

`<tag>` = `nahla-3arm-return10[-bezel-flat|-cog]`. STLs are saved in print
orientation: body back-face down, hub text-face down (crisp inlay on the
bed), cap fridge-face down. In Bambu Studio drag all the STLs of one tag in
together and answer **Yes** to "load as a single object with multiple
parts", then set a filament per part. The wave frames come straight from
`wave-frames.js` via node (`cad/wave-polys.mjs`), so they match the demo
exactly.

Weights (`--weight`): `bezel --bezel flat` cuts a square groove around the
rim for a 3.18 mm laser-cut ring and writes its DXF; `--bezel round` cuts a
half-round groove for a Ø80 × 3.5 craft ring; `cog` adds a Ø34.6 × 2.3 boss
behind the body for a 1.37"×24 tpi track cog. All dimensions sit in the `P`
dict at the top of the script — bore and stem press fits (`bore`, `stem_d`)
are the two to tune after the first print.

**Just one component.** `--only ring` builds only the wave ring (r 27.5–40)
with its water and foam inlays — no hub, arms or caps — tagged
`ring-<wave><N>`; add `--ring-t 3` for a thinner, faster test coin of the
animation. `--parts body,wave-water,wave-foam` (any subset of the six names)
limits which files are written for a full build. The viewer's **CAD
command** button prints both commands for whatever is on screen.

Quick visual check without a slicer: `cad/view.html` (linked from the
landing page) lists whatever is in `out/`, shows the parts mounted, exploded,
or as wireframe. Mass check from the generator (PLA, 100 %): body ~29 g,
hub ~6 g, inlays < 1 g — matching the estimates in the weight table above.

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

    git show 4557532:design/trophy/mockups.html
    git show 4557532:design/trophy/README.md
