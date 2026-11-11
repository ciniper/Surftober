# Surftober 2027 — ideas parked during 2026

Notes only. Nothing here is decided. Dated so we know how stale they are.
Source: Chase + Claude working sessions on the `trophy` branch, Oct–Nov 2026.

## Website: commenting (2026-11-10)

Chase: "ensure that next year we add commenting to the website!"

Context: the Main tab already has the global **Comment Board** (collapsible,
"💬 Comment Board (N)", since v1.38.0), so this is about commenting on the
*things* — per-session comments and reactions on a logged surf, on a photo
(photography bonus), maybe on a leaderboard milestone. Confirm scope with
Chase before building.

Things to think about when it comes up:
- Data: a `comments` table keyed by target (`session_id` / `photo_id`),
  author = `auth.uid()`, RLS like `messages`. Realtime via Supabase channel
  like the board already does.
- UX: comment count on the session tile, expand inline; emoji reactions
  are cheaper than threads and cover most of the "nice one" traffic.
- Notifications: "someone commented on your session" is the hook that
  brings people back — push (PWA) or the daily digest email.
- Moderation / deletion: author + Chase can delete; soft-delete so the
  count stays honest.
- Privacy: comments live inside the signed-in app, same as the board; the
  public pages stay aggregate-only (see pledge privacy rule in memory).

## Trophy: thumb-pad sticker / patch instead of a magnet (2026-11-10)

If the fridge-magnet route is dropped (see below), the back cap's magnet
pocket becomes a **sticker well** for a Surftober-logo patch with a nice
thumb feel — Chase's words: "textured like cloth".

Vendor notes (researched 2026-11-10, prices/minimums unverified — check
before ordering):
- **Sticker Mule — fabric stickers** ← Chase's likely pick.
  https://www.stickermule.com/products/fabric-stickers
  Full-colour print on a woven material, die-cut, no minimum, ~4-day
  turnaround, free proof. Reviews split on feel: some say the weave is
  "more visual than tactile". Order a small test batch first.
- **Woven (damask) patches with stick-on backing** — the real cloth feel,
  fine logo detail (better than embroidery), ~1 mm thick so it wants a
  1.2 mm well:
  - Dutch Label Shop stick-on patches (for solid surfaces), ~$30 / 5:
    https://www.dutchlabelshop.com/en_uk/stick-on-patches/
  - Superlabelstore, 5-piece minimum, 3M adhesive backing option:
    https://superlabelstore.com/?p=473
  - Labelpartners, round / free-shape HD patches, self-adhesive back,
    minimum possibly 100: https://en.labelpartners.com/configure_patch.html
- **Soft-touch / "suede" laminated vinyl** (velvety matte, not cloth):
  Vistaprint soft touch stickers
  https://www.vistaprint.com/labels-stickers/custom-stickers/soft-touch-stickers
- **DIY**: adhesive-backed microsuede sheet (phone-grip material) cut to
  discs + heat-transfer-vinyl logo; or no sticker at all — Bambu *Fuzzy
  Skin* on the cap face for a felt-like grip with the logo as a pocket.

Design hook: in `design/trophy/spinner-config.js` the cap pocket is
`magPocketD` / `magPocketDepth` (Ø25.6 × 4.6 for the Ø25 × 5 magnet).
For a sticker: depth ≈ 0.6 (printed fabric) or 1.2 (woven patch); the
front hub can take the same well inside the text ring.

## Trophy: fridge magnet vs Christmas ornament (2026-11-10)

The 2026 spinner is a fridge magnet by design (608 bearing, still hub +
cap, spinning wave ring). Finding from the v4 build (2026-10-30): the
assembly spun **much worse than v3** with no identifiable wobble, and the
one big new variable was the **Ø25 × 5 neodymium magnet 1.2 mm behind a
chrome-steel bearing** — axial preload on the balls + magnetised balls /
races. Chase was going to A/B it (pull the magnet, flick again). Record the
result here when known.

Options for 2027 (or a late 2026 pivot):

**Stay a fridge magnet**
- Hybrid ceramic 608 (Si₃N₄ balls, non-magnetic, a few $ each) with the
  current cap. Simplest if the magnet is confirmed as the cause.
- Ring magnet out at the cap's rim + thin steel shunt disc behind the
  bearing, or a smaller magnet on a thicker floor. Weaker hold, less drag.
- Pro: last two years were fridge magnets; people know where it goes.
  Con: steel + magnet fight the spin; needs a steel fridge.

**Christmas ornament**
- Hang it from the *still* part (cap or hub are on the inner race), so the
  ring spins freely around the hanging axis — tree-side air currents and
  the heater make it turn on its own; the phenakistiscope effect shows up
  on phone video of the tree.
- No magnet → no spin problem, lighter cap (Ø51 disc not needed; could go
  back to a small cap with a loop, or keep the medallion with the loop in
  its rim). Thumb-pad sticker becomes the back face.
- Timing fits: trophies ship early Nov, the tree goes up weeks later.
- Con: lives in a box 11 months a year; the fridge is seen daily.

**Both**: the cap is a separate print — a magnet cap and a loop cap off the
same body. Let each winner choose, or ship both caps.

Other 2026 learnings worth carrying (details in `design/trophy/README.md`
on the `trophy` branch — do not merge that branch into main):
- Bearing seat lip + entry chamfer (v3) fixed the v1/v2 wobble.
- Separate multi-colour inlay parts were "a NIGHTMARE" in the slicer; one
  solid body with two-level relief coloured by height, or the glue-in
  insert ring, is the way.
- Cheap 20-pack bearings vary a lot — spin-test bare before assembly;
  never hammer through the inner race.
