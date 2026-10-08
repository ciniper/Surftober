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
- **C · Spinner magnet** — tri-lobe spinner, logo in the hub, name and year on
  the lobes, magnet core on the back.
- **D · Windmill** — layered plaque: navy sky, sun, tower with medal-colour
  sails, name on the dune.

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

> A tri-lobe fidget spinner about 8 cm across in metallic gold, a navy and
> orange plover-at-sunset logo in the centre hub, the name on one lobe and
> "2026" on another in raised navy letters, steel bearings in the lobes, a
> black magnet disc on the back. Show it parked on a stainless fridge door at
> a slight angle.

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
