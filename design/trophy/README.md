# Surftober 2026 trophy — concepts, mockups, image prompts

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

## Mockup viewer

`mockups.html` — self-contained three.js scene, four blocky procedural
concepts to judge proportions and the modular idea (not finish). Loads
three.js from unpkg, so it needs internet, and it uses ES-module imports, so
open it from a local static server rather than `file://`:

    python3 -m http.server 8930 --directory design/trophy
    # then http://localhost:8930/mockups.html?name=NAHLA

Buttons switch concept, the dropdown switches the medal tier colour,
`?name=` sets the name, "Download PNG" saves the current camera angle.

- **A · Modular plaque** — wood base, plover medallion in relief, medal-colour
  frame, separate name bar sliding into a slot. Closest evolution of 2025.
- **B · Fin magnet** — single fin in the medal colour, name + year raised on
  the face, magnet disc recessed in the back, small wood stand.
- **C · Spinner magnet (v2, 2026-10-10)** — see "Concept C build plan" below.
  Stock metal tri-spinner + 608 bearing, metal weight inserts in the lobes,
  anodized 6061 caps with the magnet in the back cap, and a wide printed
  medal-colour ring on the front with three full-length rods through the
  inserts' holes. Extra buttons: cap colour, **Exploded**
  (parts pulled apart along the axis) and **On fridge** (steel door touching
  only the back cap), plus **Spin body** to stop or start the body spinning.
  Body dimensions are placeholders until the stock part is measured.
- **D · Windmill** — layered plaque: navy sky, sun, tower with medal-colour
  sails, name on the dune.

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
4. **Freeze-frame animation.** A motif repeated evenly around the ring (e.g.
   12 plovers in walking poses) can seem to stand still or walk under
   flickering LED light or in phone video. Fun, but unreliable.

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

### Concept A — modular plaque

> A rounded rectangular wooden plaque about 12 by 9 cm with a raised circular
> logo medallion in the centre showing a snowy plover standing on a sand dune
> at sunset inside an orange ring, a thin metallic gold frame around the
> plaque edge, and a separate slide-in name bar at the bottom in metallic gold
> with the name in navy raised letters. Show the name bar half slid out of its
> slot to make the modular idea obvious.

### Concept B — fin magnet

> A single surfboard fin about 9 cm tall in metallic gold, standing upright in
> a small wooden stand, the name and "SURFTOBER 2026" raised along the fin's
> leading edge in navy, a small plover-at-sunset logo medallion near the base,
> and a round black magnet set into the back so it can hang on a fridge.

### Concept C — spinner magnet

> A gunmetal tri-lobe metal fidget spinner about 8 cm across with open lobe
> holes and a 608 bearing in the centre, orange anodized aluminium centre
> caps, and a 3D-printed silk-gold PLA ring about 8 cm across clipped onto
> its front face, the ring reading "SURFTOBER 2026 · GOLD" around the top and
> "NAHLA" around the bottom in raised navy letters. Show it parked on a
> stainless fridge door, held by a small magnet in the back cap.

### Concept D — windmill

> A layered plaque about 10 by 12 cm with a navy sky, an orange sun, the Ocean
> Beach Dutch windmill in profile with four metallic gold sails, a
> sand-coloured dune across the bottom, "SURFTOBER 2026" across the top and
> the name on the dune, all as stacked raised layers.

### Variations worth asking for

- The same concept as a laser-cut plywood piece instead of a print (ideas 1/3).
- Concept B or C in laser-cut steel, "the whole piece is the magnet" (idea 2).
- A family shot: five of concept A in a row, one per tier colour, names
  visible — the equivalent of the 2025 group photo.
