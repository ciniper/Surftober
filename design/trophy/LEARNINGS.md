# Ring art that survives the slicer: what we learned (2026-11-07)

This is a hand-off for whoever picks up the 2026 trophy's wave-ring animation next. One day of
attempts went from "the plover's details vanish in the slice" to two redesigns Chase rejected on
sight. Below: the hard numbers, what was tried and why each failed, and what hasn't been tried yet.
The README beside this file is the full decision log; this is the short version with the lessons.

**Status at hand-off:**

- The default animation is still `ploverleanbold`: the plover in a barrel, 8 frames.
- Chase rejected `ploverbig` and `ploverface`. They are kept as options so they can be compared
  against, but they are not directions.
- Nothing is printed from today's work. Chase's own complaint stands: it looks awful sliced, and
  most of the plover's features don't come out.

## 1. The physical problem in numbers

- **Ring.** The ring is r 29.7 → 49 (Ø98). Rim ridges take the outer 0.8 mm, so art can use
  r 29.7 → 48.2 at most: a band about **18 mm tall**. Every frame is one slice of that ring.
- **Frames.** N frames sit around the band. A phone video at the right RPM plays them as an
  animation (8 frames at 30 fps is 225 RPM). Fewer frames give wider slots but a choppier loop.
  - The art's scale is **min(band height, slot arc at mid-band ÷ the scene's width/height
    ratio)**. With 8 frames, the slot is about 31 mm wide by 15–18 mm tall.
  - So moving the ring's inner edge in only helps when the frames get fewer or the scene gets
    narrower; otherwise it just adds sky.
- **Bend.** Each slot is a wedge, not a rectangle. Art near the inner edge is squeezed 10–20 %
  horizontally compared with mid-band. A stroke that is 1.0 mm at mid-band is about 0.85 mm
  low down.
- **How it prints.** One solid body on a Bambu X1C with a 0.4 nozzle, AMS, 4 filaments
  (ring/brown, navy, cream, cap). The art is relief: water 0.4 mm and foam 0.8 mm above the
  face, coloured by height. `cad/spinner.py` writes a pre-coloured `-bambu.3mf`.
- **What the nozzle can draw.** The line is 0.42 mm wide.
  - The stock X1C process uses the *classic* wall generator, which **silently drops** anything
    under about one line (`learnings/1-slice-classic-vs-arachne.png`). The project file now
    sets **Arachne**, which can draw thinner lines.
  - A feature one line wide still prints as a single wobbly bead, so it reads as noise. Two
    lines, **about 0.9 mm**, is the practical minimum for a shape to read as that shape.
  - That minimum applies to **every colour, including the gaps of ring colour between two
    shapes**. A gap under 0.9 mm fills in or prints as a ragged slit.

## 2. What was tried today, and the verdict

| # | option (`wave=`) | idea | verdict |
|---|---|---|---|
| 0 | `ploverleanlines` (v5, 10 frames) | Chase's pick from the design round: the logo plover cross-stepping inside a leaning barrel, whitewater lip, flowing face line | **sliced badly**: the outline, legs and lip line vanished with classic walls. This started the day. |
| 1 | `ploverleanbold` (v6, 8 frames) | ring inner edge moved in, 8 frames instead of 10 (art 28 % bigger); every plover stroke ≥ 0.03 of the band (~0.46 mm); Arachne | better on a 0.42 mm check (< 1 % lost), but **still mush in the slice**. Against the real 0.9 mm bar, about half its cream art fails (`learnings/3-printcheck-0.9mm-v6-bold-barrel.png`). Still the default. |
| 2 | `ploverleanedge` | the sea runs to the ring's inner edge; crash squeezed toward the tube; tail dips into the wave; art 14 % bigger | Chase: "it still looks awful sliced… way more room in the frame that you left just sitting there". Correct: the bird still filled only about a quarter of the frame. |
| 3 | `ploverbig` | barrel redrawn round a bird 1.25× bigger; everything ≥ 0.9 mm, done by turning the plover into a chunky blob (big head, stub beak, no legs, no collar) | **rejected with disgust.** It printed cleanly (`learnings/5-…`), but it stopped being the logo plover. |
| 4 | `ploverface` | no barrel: the plover at 1.6× with the logo's details, riding the open face, a small curl behind its tail | **rejected** ("I hate plover face"). It printed cleanly (`learnings/6-…`). Chase gave no reason. My guesses: the bird now dominates and the wave is reduced to a backdrop lump; the thick outlines and enlarged head read as cartoonish. Ask him. |

The two clean slices (3, 4) prove the 0.9 mm rule can be met. They also prove that meeting it is
not enough: **printable and liked are separate requirements, and today's attempts traded one for
the other.**

## 3. Technical lessons

1. **Composition sets the bird's size; stroke tuning doesn't.** A barrel wraps the bird on three
   sides: water under it, the back wall, and the lip overhead. Each side costs navy plus a ≥ 0.9 mm
   ring-colour gap, which leaves the bird about 7–8 mm of an 18 mm band. Under the 0.9 mm rule,
   a logo plover that small can't keep its collar, eye, cap, legs and beak.
2. **Thickening strokes in place eats the bird from inside.** At the barrel's size, 0.9 mm strokes
   fill the head. So either the bird gets bigger (composition) or details get dropped (character).
   Dropping them was hated.
3. **Check the right threshold, on the real ring.** Two passes "passed" a 0.42 mm check and still
   looked awful. The check that matches what Chase sees:
   - open each colour region by 0.45 mm;
   - flag what's lost;
   - do it on the bent ring geometry, not a flat cell;
   - include the gaps.

   That is `cad/tools/printcheck.py`.
4. **Look at the actual toolpaths before claiming success.** `cad/tools/toolpaths.py` draws the top
   layers of a Bambu G-code with real line widths and arcs, every slot turned to the top. It is
   cheap: the slicer CLI takes about 4 s and the plot about 15 s.
5. **Points don't print.** A beak tip, a tail point, the tapered ends of brush strokes, the tip of
   the lip, the tips of a board: each loses its last 0.5–1 mm. Blunt or round them by design, or
   accept a shorter shape.
6. **Things that touch merge.** A navy bird touching the navy wave stops reading as a bird, and the
   wedge where two curves meet leaves sub-0.9 mm slivers. Either overlap clearly or keep ≥ 0.9 mm of
   ring colour between them.
7. **Slot edges are shared.** One slot's right edge sits against the next slot's left edge. The sea
   level has to match there, and anything near an edge needs about 0.5 mm of margin on each side.

## 4. Process lessons: working with Chase

- **Lead with the picture he will judge**: the sliced toolpaths, then the design. Not clearance
  numbers. Several replies today reported millimetres while the slice still looked bad.
- **Show still frames of a new direction before building the animation, CAD and slice.** Taste
  rejections (`ploverbig`, `ploverface`) came after a full build each time.
- **"Make it printable" doesn't license changing the character.** The logo plover is the brand.
  If a detail can't print, say so plainly and propose alternatives; don't quietly mutate the bird.
- **Unresolved reference:** Chase said "we had an earlier plover design with 10 frames and all the
  details came out". It isn't identified yet. Candidates: the bird-only sprite `wave=plover`
  (flap + run, where the bird fills the whole slot), or a test print he made. Find out which, and
  measure its proportions. It is the one known-good datum.

## 5. Levers not tried yet (worth weighing)

- **A 0.2 mm nozzle for the ring.** This roughly halves every minimum: two lines ≈ 0.45 mm.
  The v5/v6 barrel art would then mostly print as drawn. The cost is ring print time (the plate
  is about 66 min at 0.4) and a nozzle swap. It's probably the biggest single lever, and it was
  never raised today.
- **The art as the first layers on the bed**, face down, with colour by layer. This might give
  crisper fine lines than a top surface. Unverified.
- **Fewer colours or negative space.** Draw the plover's details in ring colour, cut out of navy,
  rather than as cream-on-navy-on-brown stacks. That needs one fewer gap per edge.
- **A larger ring or fewer frames (6–7).** The band height (about 18 mm) is the hard cap on art
  size at Ø98. Chase earlier wanted the spinner smaller (Ø113 → Ø103 → Ø98), so this trades
  against size.
- **The other two non-barrel layouts**, sketched as stills only:
  - the bird above a low rolling swell with a small curl at one side;
  - the bird in front of a big wave silhouette, outlined by a ring-colour gap.
- **Simplify the wave, not the bird.** Give the bird room by making the wave quieter: thinner
  lip, no foam ball, fewer lines. The opposite of today's last attempt.

## 6. Where things are

- **Art:** `wave-frames.js`. Every animation option lives in `WAVE_VARIANTS`; new ones go beside
  the old ones and never overwrite them.
  - The barrel scene is `barrelScene()`; the open-face scene is `faceScene()`.
  - The plover is `surfer()`. It has a `print` flag (the logo bird with strokes ≥ `bold`, used by
    `ploverface`) and a `chunky()` path (`ploverbig`).
  - Bands per option come from `artBand()`. An option can take a custom `tube`, a `frame` width, a
    sea `level`, and `sea: 'edge'`.
- **Product config:** `spinner-config.js` (dimensions, options, defaults). `waveBand(o)` gives the
  band an option actually uses.
- **CAD:**
  - `cad/spinner.py` via `cad/bridge.mjs` writes STL, 3MF, STEP and `-bambu.3mf` into `cad/out/`
    (gitignored).
  - Setup is `cad/setup.sh`. Example run:
    `.venv/bin/python spinner.py --name NAHLA --arms 3 --wave ploverleanbold`.
- **Checks** (run from `cad/` with the venv python):
  - **Print check:** `tools/printcheck.py "wave=<option>" out.png [0.9]`.
  - **Slice:** `/Applications/BambuStudio.app/Contents/MacOS/BambuStudio --slice 0 --outputdir DIR
    out/<tag>-bambu.3mf`. The CLI also leaves a `result.json` in the current directory; delete it.
  - **Toolpaths:** `tools/toolpaths.py out.png "title=DIR/plate_1.gcode"`.
- **Previews:** `viewer.html` (3D configurator) and `wave-demo.html` (spin and phone-video demo).
  `python3 -m http.server --directory design/trophy` serves them.
- **Images:** `learnings/`, numbered to match the sections above.
- **Branch rule:** the `trophy` branch must never be merged into `main`.
