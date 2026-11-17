// Surftober award-ceremony deck — the hand-curated half.
//
// Everything the data can't know lives here: past years, last year's hours
// (for The Ascenders / Fall from Grace), name aliases, the judged awards,
// recap copy, charity totals and quotes. deck-stats.js computes the rest live
// from Supabase. Leave a field empty and its slide shows a dashed "fill me in"
// placeholder instead of disappearing, so nothing is forgotten on the night.

window.SurftoberDeckConfig = {
  // The event the deck reports on (events.team in Supabase).
  team: '5th-surftober-2026',
  year: 2026,
  edition: '5th',
  title: 'Surftober Award Ceremony',

  // Previous Surftobers (from the 2023–2025 decks). The current year is
  // appended live. `participants` counts surfers at 10h+ (Participant medal
  // or better), matching how the 2025 deck counted; `observers` is under 10h.
  history: [
    { year: 2022, participants: 3, hours: 120, caption: 'Night Costume Surf', note: 'Inspired by the Dolphin Club Polar Bear challenge: swim 40 miles over the winter.' },
    { year: 2023, participants: 11, hours: 380, caption: 'Sunny Costume Surf' },
    { year: 2024, participants: 20, hours: 615, caption: 'Foggy Spooky Surf' },
    { year: 2025, participants: 26, observers: 8, hours: 808, caption: 'Foggy Spooky Surf' },
  ],
  // Title slide photo (path under docs/). Empty = the sun-and-waves title.
  titlePhoto: 'photos/costume-surf-2026.jpg',
  titlePhotoCaption: 'The 2026 costume surf crew',
  currentCaption: '', // e.g. 'Sunny Spooky Surf' for this year's costume surf

  // Last year's final hours, copied from the [2025] deck's Final Results.
  priorYear: 2025,
  priorHours: {
    'Jason Armstrong': 63.3, 'Brian Gormley': 60.6, 'Nic Risser': 48.2, 'Pam Campbell': 46.7,
    'Nahla Achi': 43.8, 'Chase Cooper': 41.1, 'Garrett Wesley': 37.7, 'Clem Poty': 34.8,
    'Pranav Madanahalli': 33.3, 'Hugo Leandri': 31.9, 'Erica Brooks': 30.4, 'Rachel Budenholzer': 28.0,
    'Jack Steele': 26.0, 'Juliette Chausson': 25.5, 'Margaret Shields': 25.3, 'Sebastian Pinto': 22.4,
    'Rohan Kurse': 22.2, 'Jackson Reimers': 21.6, 'Sam Steele': 20.8, 'Tony Sacharny': 20.0,
    'Nico Richard': 20.0, 'JE Goubet': 15.7, 'Becca Morrow': 15.5, 'Sarah Linden': 13.0,
    'Casey Chorens': 11.1, 'Sophie Frank': 10.6, 'Manny Labbe': 9.0, 'Jake Dalton': 7.4,
    'Carly Hammer': 5.8, 'Darien Niamir': 4.1, 'Nicole Palko': 3.5, 'Kyle Nichols': 3.4,
    'Greg Lucey': 3.3, 'Kevin Ayling': 2.1,
  },

  // This year's app display name -> last year's name, where they differ.
  // CONFIRM the guesses before the ceremony — a wrong alias hands someone
  // else's history to the wrong surfer.
  aliases: {
    'Juliette': 'Juliette Chausson',
    'kyle n': 'Kyle Nichols',
    'pana': 'Pranav Madanahalli',   // confirmed by Chase 2026-11-06
    'Nicolas': 'Nico Richard',       // confirmed by Chase 2026-11-06
  },

  // How names appear on slides. Default: first name, plus last initial when
  // two surfers share a first name. Override any of them here.
  displayNames: {
    'pana': 'Pranav',
    'Nicolas': 'Nico R.',
    'EitanKiin': 'Eitan',
    'Seany Boi': 'Seany Boi',
  },

  // Home waters for the Tech Nomad award: a session counts as "away" when
  // its (normalized) location contains none of these.
  localSpots: ['ob', 'ocean beach', 'lawton', 'noriega', 'judah', 'kirkham', 'ortega', 'pacheco', 'moraga', 'sloat',
    'vfw', 'taraval', 'rivera', 'santiago', 'quintara', 'fulton', 'balboa', 'irving', 'lincoln', 'vicente', 'central',
    'kelly', 'fort point', 'f pt', 'linda mar', 'pacifica', 'crespi', 'rockaway', 'sharp park', 'montara', 'half moon',
    'hmb', 'princeton', 'jetty', 'mavericks', 'bolinas', 'stinson', 'china beach', 'sf'],

  // Stormsurf Point Reyes Buoy 029 estimates, grouped by San Francisco date.
  // [October day, low and high from the row with the highest upper estimate.]
  dailySurfHeights: [
    [1, 6.2, 7.7],
    [2, 4.6, 5.7],
    [3, 2.8, 3.5],
    [4, 2.7, 3.4],
    [5, 3.5, 4.3],
    [6, 3.9, 4.8],
    [7, 3.7, 4.6],
    [8, 6.8, 8.6],
    [9, 7.2, 9.0],
    [10, 9.5, 11.8],
    [11, 9.7, 12.2],
    [12, 9.0, 11.3],
    [13, 7.2, 9.0],
    [14, 7.0, 8.7],
    [15, 5.8, 7.3],
    [16, 4.7, 5.9],
    [17, 4.6, 5.7],
    [18, 4.9, 6.2],
    [19, 6.9, 8.6],
    [20, 9.5, 11.9],
    [21, 8.7, 10.8],
    [22, 7.8, 9.8],
    [23, 7.3, 9.1],
    [24, 8.1, 10.1],
    [25, 6.3, 7.8],
    [26, 5.4, 6.7],
    [27, 5.2, 6.5],
    [28, 5.7, 7.1],
    [29, 4.7, 5.9],
    [30, 4.1, 5.2],
    [31, 4.5, 5.6],
  ],

  // Open-Meteo Historical Weather, 37.76° N, 122.51° W; October local dates.
  // Each row: 2025 low °F, high °F, sunny flag, then the same for 2026.
  // Sunny means at least 70% of local daylight had direct sunshine.
  dailyOctoberWeather: [
    [61.6, 70.3, 0, 56.3, 66.6, 1],
    [59.1, 63.6, 0, 57.1, 72.5, 1],
    [58.5, 64.3, 1, 56.4, 82.5, 1],
    [55.5, 64.4, 1, 58.7, 76.7, 1],
    [55.5, 67.8, 1, 59.9, 68.0, 1],
    [56.4, 81.6, 1, 58.8, 69.6, 1],
    [57.8, 74.7, 1, 58.9, 67.9, 1],
    [59.0, 66.6, 1, 58.0, 66.3, 1],
    [58.7, 67.0, 1, 56.6, 62.9, 1],
    [55.4, 68.4, 1, 55.6, 60.1, 1],
    [56.4, 65.1, 1, 51.8, 60.4, 1],
    [53.3, 64.4, 1, 51.4, 64.6, 1],
    [51.0, 62.1, 0, 51.8, 67.7, 1],
    [51.0, 60.2, 0, 51.3, 66.5, 1],
    [56.1, 62.8, 0, 53.0, 85.2, 1],
    [53.3, 62.0, 1, 58.2, 85.7, 1],
    [52.9, 68.8, 1, 56.1, 82.1, 1],
    [55.1, 76.8, 1, 57.4, 63.2, 1],
    [56.6, 67.9, 1, 57.0, 62.3, 1],
    [55.7, 78.0, 1, 54.4, 67.6, 1],
    [54.9, 70.1, 1, 57.6, 66.1, 0],
    [57.8, 63.9, 0, 57.4, 63.0, 0],
    [56.3, 61.2, 1, 54.3, 62.3, 1],
    [55.9, 62.4, 1, 52.9, 66.9, 1],
    [58.1, 64.6, 0, 50.2, 69.5, 1],
    [56.0, 63.9, 0, 57.6, 63.3, 1],
    [54.9, 63.6, 1, 54.9, 62.5, 1],
    [52.0, 70.9, 1, 53.0, 64.3, 1],
    [55.0, 72.8, 1, 52.1, 68.7, 0],
    [56.0, 60.8, 0, 54.8, 65.5, 1],
    [53.6, 63.9, 1, 54.3, 61.6, 1],
  ],

  // Highest water temperature each October day, °F: NOAA NDBC buoy 46237
  // (San Francisco Bar, CDIP 142), readings every 30 min grouped by San
  // Francisco date. Each row: [day, then one high per year in waterYears];
  // null = no reading that day. 2026: the buoy's October file starts Oct 2 at
  // 3:30 pm, so Oct 1 is empty and Oct 2 is a partial day.
  waterYears: [2024, 2025, 2026],
  dailyWaterHighs: [
    [1, 63.1, 62.6, null],
    [2, 61.3, 63.0, 60.3],
    [3, 61.5, 63.0, 63.9],
    [4, 61.9, 63.7, 63.1],
    [5, 64.6, 63.3, 61.7],
    [6, 63.9, 63.7, 61.7],
    [7, 61.3, 63.5, 60.8],
    [8, 60.6, 63.5, 60.8],
    [9, 60.3, 63.5, 60.4],
    [10, 60.8, 63.5, 60.4],
    [11, 61.2, 64.2, 60.6],
    [12, 61.0, 63.3, 62.2],
    [13, 60.8, 63.0, 60.8],
    [14, 59.9, 62.8, 61.7],
    [15, 59.5, 62.2, 62.2],
    [16, 59.5, 62.4, 64.2],
    [17, 59.9, 62.1, 61.2],
    [18, 59.5, 62.2, 61.0],
    [19, 59.5, 61.5, 60.4],
    [20, 61.0, 61.7, 61.3],
    [21, 59.0, 61.2, 60.8],
    [22, 59.0, 61.5, 60.8],
    [23, 58.6, 61.3, 61.3],
    [24, 59.5, 61.2, 62.2],
    [25, 59.4, 61.0, 62.2],
    [26, 60.1, 60.8, 61.7],
    [27, 58.8, 61.3, 61.5],
    [28, 58.3, 61.3, 62.8],
    [29, 57.7, 61.5, 62.6],
    [30, 57.4, 60.4, 62.6],
    [31, 57.0, 60.3, 61.7],
  ],
  waterNote: 'No 2026 reading on Oct 1 · hollow dot = Oct 2, from 3:30 pm only',
  waterPartialDays: [2],  // this year's days with partial readings (hollow dots)

  // Web Analytics slide (after The Author award): a snapshot, pulled
  // 2026-11-16 from Vercel Web Analytics (production, Oct 1–31 UTC days) and
  // the Surftober2 Supabase project. Vercel counts a visitor once per day, so
  // `visits` is visitor-days, not unique people.
  webAnalytics: {
    period: 'October 2026',
    visits: 1236, pageviews: 2355, mobile: 1038,
    countries: [['US', 1181], ['GB', 21], ['ID', 12], ['SG', 8], ['DE', 2], ['FR', 2], ['IL', 2], ['NL', 2], ['PR', 2], ['ES', 1], ['FJ', 1], ['PL', 1], ['PT', 1]],
    dailyVisits: [44, 54, 50, 55, 58, 46, 49, 40, 39, 34, 11, 30, 36, 40, 46, 52, 43, 33, 29, 32, 34, 37, 26, 33, 36, 39, 28, 40, 38, 50, 54],
    // Photos + audio in Supabase Storage at the end of each October day, MB.
    storageMb: [26.4, 30.2, 31.8, 34.7, 39.4, 41.7, 44.8, 45.5, 46.8, 47.3, 50.1, 52.2, 52.6, 53.8, 56.1, 59.0, 59.9, 66.1, 66.9, 68.1, 68.1, 69.2, 69.4, 70.1, 73.2, 74.3, 75.4, 77.1, 78.9, 79.9, 81.6],
    supabase: { sessions: 893, journals: 773, photos: 146, surfers: 52, databaseMb: 22 },
  },

  // Free-text recap (2025 had Surf Recap + Weather Recap). Not shown since
  // 2026-11-16: the water-temperature chart replaced the Surf & weather slide.
  surfRecap: '',     // size, quality, standout swells
  weatherRecap: [
    'Air: average daily high 68°F, low 55°F. Warmest: 86°F on Oct 16.',
    'Rain: 0.55 in total. Oct 22 was wettest at 0.41 in.',
    'Wind: highest modeled sustained speed was 17 mph on Oct 10.',
    'Water: 60.6°F average at San Francisco Bar (58.8–64.2°F, 30 of 31 days).',
    'Fort Point: no October water-temperature data returned by NOAA.',
    'Sources: Open-Meteo historical weather near Ocean Beach and NOAA buoy 46237.',
  ].join('\n\n'),

  // Fundraising (2025: $1,480 contributed, 2x company match, 5 beach cleanups).
  // `contributed` = what people actually gave (leave null to show the pledge
  // estimate: $/hour × hours). `matchMultiplier` 2 = company match doubles it,
  // the way the 2025 deck counted $1,480 contributed → $2,960 raised.
  charity: { contributed: null, matchMultiplier: 2, match: '2x company match', note: '' },

  // Leave a surfer out of one computed award; the next in line moves up.
  // Keys are award ids (deck-stats.js), names as in the app.
  awardExclusions: {
    marathon: ['Sam Steele'],  // Chase, 2026-11-16
  },

  // Judged awards — the data can't pick these. `winner` is free text.
  // Best Dressed ballot, up to six entries with unique names.
  // Set photo to a path under docs/ or an HTTPS image URL.
  // Example: { name: 'Contestant name', photo: 'costumes/contestant.jpg' }
  bestDressedCandidates: [  // Best Dressed live vote (up to 6); votes are by name
    { name: 'Erica', costume: 'Officer Dick You Down', photo: 'photos/costume-officer.jpg' },
    { name: 'Brian', costume: 'Christ', photo: 'photos/costume-christ.jpg' },
    { name: 'Jimmy', costume: 'Snow White', photo: 'photos/costume-snow-white.jpg' },
    { name: 'Anton', costume: 'Crabman', photo: 'photos/costume-crabman.jpg' },
    { name: 'Sophie', costume: 'Goldwoman', photo: 'photos/costume-goldwoman.jpg' },
  ],
  judged: {
    'best-dressed': { winner: '', value: '' },     // costume-surf candidates are listed on the slide
    'fallen-fathers': { winner: '', value: '' },
    'aim-for-the-stars': { winner: '', value: '' }, // 2023: fewest hours vs their goal (goals live in private profiles)
    'commuter': { winner: '', value: '' },          // 2024: travelled farthest to surf
  },

  // Slide order + flags from the deck's arrange mode (G grid → A → Export
  // file): paste the exported JSON here as the value. Slides are matched by
  // key; 'remove' slides are skipped, slides added since keep their place.
  // A draft saved in a browser overrides this in that browser. null = the
  // built order.
  slideArrangement: null,

  // Agenda slide (2023 had one). Empty = no agenda slide.
  agenda: ['Overview', 'Awards', 'Story Time', 'Quotes'],

  // Photo slides: { src, caption }. `src` is a URL or a path under docs/.
  // 2025's trophies were printed plaques: a red Golden Gate bridge on blue,
  // "SURFTOBER 2025", and a cable car in the tier colour carrying the name.
  // Their photos live in the [2025] Surftober Award Ceremony Google Slides.
  trophiesPast: [    // 2025 deck: "Trophies Previous Years"
    { src: 'trophy/past-2022.jpg', caption: '2022' },
    { src: 'trophy/past-2023.jpg', caption: '2023' },
    { src: 'trophy/past-2024.jpg', caption: '2024' },
    { src: 'trophy/past-2025.jpg', caption: '2025' },
  ],
  trophiesNow: [],   // 2025 deck: "Trophies 2025"

  // Trophy 2026, the spinner: a section between the two trophy galleries
  // (orbit video, design changes, engineering challenges, the wave, a live
  // "guess the print time" vote and the build). Content is from the trophy
  // branch's design/trophy/README.md log; the videos are renders of preset
  // v10 (docs/trophy/). Media: a path under docs/ or an https URL, video
  // (.mp4/.webm/.mov) or image; empty = a dashed "fill me in" box.
  trophy: {
    version: 'v10',
    orbit: 'trophy/orbit.webm', orbitPoster: 'trophy/orbit.jpg',
    strobe: 'trophy/strobe.webm', strobePoster: 'trophy/strobe.jpg',
    headline: 'Six parts, one bearing',
    parts: [  // top of the exploded stack to the bottom, as in the orbit video
      { name: 'Front hub', note: 'tier colour, flush navy text inlay' },
      { name: 'Art insert', note: 'the 8-frame wave, 0.2 nozzle, glued in' },
      { name: 'Body', note: 'Ø98 ring on three arms, ridged rim' },
      { name: '608 bearing', note: 'bought, sorted by spin-down' },
      { name: 'Back cap', note: 'finger divot, tier colour' },
      { name: 'M3 × 12 screw', note: 'clamps hub and cap to the inner race' },
    ],
    // One trophy as sliced in Bambu Studio (README v9 / v10), in minutes.
    perTrophy: [
      { part: 'insert', min: 62 },  // 0.2 nozzle, 5 per plate: 5 h 12 min
      { part: 'body', min: 65 },
      { part: 'hub', min: 23 },
      { part: 'cap', min: 17 },
    ],
    story: [  // kind 'design' → Design changes slide, 'print' → Engineering challenges
      { kind: 'design', tag: 'v3 · Oct 12', stat: 'All printed', title: 'A fully printed 608 spinner',
        text: 'The metal spinner with a printed ring became one printed body: a hub on the bearing, three arms and the wave ring at the rim. Only the bearing and a screw are bought.' },
      { kind: 'design', tag: 'Print 2 · Oct 29', stat: 'Seat lip', title: 'A lip that spins better',
        text: 'Print 1 wobbled and spun down in about 70% of the time of a reference spinner: the ring wasn’t square to the bearing. A 0.6 mm lip that seats the outer race: “spins much better”.' },
      { kind: 'design', tag: 'v4 · Oct 30', stat: '2–3× slower', title: 'The magnet that killed the spin',
        text: 'A neodymium disc behind the bearing preloaded the race and magnetised the balls. It came out. And bearings from one 20-pack spun 10 to 20 s, so every one gets sorted.' },
      { kind: 'design', tag: 'v9 · Nov 10', stat: '27 → 22 min', title: 'Hub text as an inlay',
        text: 'Name, SURFTOBER 2026 and “40 HOURS!” are a flush navy inlay only two layers deep: two filament swaps instead of four.' },
      { kind: 'print', tag: 'v6 · Nov 7', stat: '0.9 mm', title: 'The print-true rule',
        text: 'At 0.4 the slicer dropped the plover’s outline, legs, eye and lip line. New rule: nothing in any colour, gaps included, under two nozzle lines, checked on the real toolpaths.' },
      { kind: 'print', tag: 'v7 · Nov 8', stat: '0.2 nozzle', title: 'A glue-in art insert',
        text: 'The art moved to its own ring, printed flat at 0.2 (every minimum halved) and glued into a pocket in the body, which prints in one colour at 0.4.' },
      { kind: 'print', tag: 'v9thin · Nov 13', stat: '18 → 13 layers', title: 'A thinner insert',
        text: 'The insert’s plain base went from 1.0 to 0.5 mm, so the art stands as high on a shallower pocket: two inserts 2 h 59 → 2 h 17.' },
      { kind: 'print', tag: 'v10 · Nov 15', stat: '6 rounds', title: 'The wave, redrawn',
        text: 'Barrel, open face, a school of fish, then the lip rebuilt as a falling sheet keyed through hand-drawn poses. The pick: throwcurl4, a spiral lip.' },
    ],
    printFigures: [  // Bambu Studio toolpaths, from design/trophy/learnings/
      { src: 'trophy/slice-0.4.png', caption: '0.4 nozzle: classic walls drop anything under one 0.42 mm line (left); Arachne draws thinner, but a one-line stroke prints as a wobbly bead (right)' },
      { src: 'trophy/slice-0.2.png', caption: '0.2 nozzle on the insert: eye, collar, legs and bill all print' },
    ],
    waveRounds: [  // one frame of each round, drawn from wave-frames.js
      { tag: 'v5', title: 'Plover in the barrel', src: 'trophy/wave-v5.png' },
      { tag: 'v6', title: 'Big bird (rejected)', src: 'trophy/wave-v6.png' },
      { tag: 'v7', title: 'First print, 0.2', src: 'trophy/wave-v7.png' },
      { tag: 'v8', title: 'A school of fish', src: 'trophy/wave-v8.png' },
      { tag: 'v10 · r5', title: 'Curtain lip', src: 'trophy/wave-r5.png' },
      { tag: 'v10 ★', title: 'Spiral lip', src: 'trophy/wave-v10.png', pick: true },
    ],
    // Print-time vote: the multiple-choice ranges, in hours (Under 25 h,
    // 25–50 h, … , 300+ h). Changing them after voting opens orphans votes.
    voteBins: [25, 50, 75, 100, 150, 200, 300],
    build: {
      // The real total for every trophy, in hours (e.g. 142.5). It is also the
      // answer the vote reveals, and this file is public: fill it on the day.
      printHours: 135,
      trophies: null,   // how many were printed; null = this year's 10h+ medal count
      timelapse: 'trophy/timelapse.mp4',  // four Bambu timelapses (Nov 10, 11, 14, 16) joined; every layer kept, 2 Mbps (3 MB)
      assembly: 'trophy/assembly.mp4',  // assembling a trophy, sped up 5x; re-encoded to 15 fps, 1.5 Mbps (3 MB)
      note: '',
    },
  },

  // Discussion slides from 2023/2024 — shown as big prompts.
  storyPrompts: ['What was your favorite session, favorite wave?', 'How challenging was it to complete your goal?'],

  // Closing slides. Empty strings = placeholder.
  // lastYear / match show as two big figures on the Donate slide.
  donate: {
    text: 'Consider donating to Surfrider', detail: '$3–5 per hour', link: '',
    lastYear: { amount: '$2,960', label: 'raised in 2025: $1,480 given, doubled by the company match' },
    match: { amount: '$10,000', label: 'in matching this year, dollar for dollar' },
  },

  // Hand-picked journal quotes: { text, by }.
  quotes: [],

  // The journal book. Empty title = built from the 3 most-said words
  // ("The Fun, the Waves & the Good"); set a string to override.
  bookTitle: '',

  // Blue Water Task Force — from the "bwtf tober" deck (2026-11-08), in its
  // order: the `before` pictures, the intro (mission + stats), the
  // `features`, then the `after` pictures. `before`/`after` are whole slides
  // from that deck, shown edge to edge (title = grid label only). Each
  // feature's `media` is shown big under its title (`kicker` overrides the
  // "Website overview" label). `media` is an image or video path under docs/
  // (e.g. 'bwtf/map.gif', 'bwtf/alerts.mp4') or an https URL.
  // `site` (optional) is the live website; it shows as a link on each slide.
  bwtf: {
    group: 'Data & Technology Group',
    mission: 'Empower beachgoers and the Blue Water Task Force by making available data more useful.',
    combineIntro: true,  // mission + stats on one slide with the first feature (How the data flows)
    // Logo badge, top right of the BWTF slides the deck draws: intro,
    // features, bonus, not the full-bleed before/after slides. Files come from
    // the BWTF_SF site's static/brand. dark: black-ink logo, lightened in dark mode.
    logos: [
      { src: 'bwtf/logo-bwtf.png', alt: 'Blue Water Task Force' },
      { src: 'bwtf/logo-surfrider-sf.png', alt: 'Surfrider Foundation San Francisco', dark: true },
    ],
    stats: [
      { v: '27', k: 'years of beach postings' },
      { v: '82,000+', k: 'city lab results since 2000' },
      { v: '1,474', k: 'sewer discharge records since 2011' },
    ],
    before: [
      { title: 'Water Quality Monitoring Program', media: 'bwtf/program.jpg' },
      { title: 'Lab Testing', media: 'bwtf/lab.jpg' },
      { title: 'Sampling at the beach', media: 'bwtf/sampling.jpg' },
      { title: 'Six Sites Monitored', media: 'bwtf/sites.jpg' },
      { title: 'In the sewer', media: 'bwtf/sewer-1.jpg' },
      { title: 'In the transport box', media: 'bwtf/sewer-2.jpg' },
    ],
    features: [
      { title: 'How the data flows', kicker: 'How it works', media: 'bwtf/flow.gif' },
      { title: 'Unified Water Quality Map', media: 'bwtf/map.gif' },
      { title: 'Data Analysis Spanning 20+ Years', media: 'bwtf/analysis.gif' },
      { title: 'Targeted Email Alerts', media: 'bwtf/alerts.gif' },
      { title: 'Educational Modules', media: 'bwtf/education.gif' },
    ],
    after: [
      { title: 'Do you know of a space we could use to home our lab?', media: 'bwtf/lab-space.jpg' },
      { title: 'Westside transport box: decanting', media: 'bwtf/decanting.jpg' },
    ],
    site: '',
    // Last slide of the section: our own water sampling (the app's one-time
    // +1 hour Water Quality Reading bonus). Photos sit in one row, sized by
    // their own shape (ar = width / height), in this order.
    bonus: {
      title: 'Water Quality Test Bonus',
      kicker: 'Surftober × Blue Water Task Force',
      note: 'Water sampling with the SF Blue Water Task Force: a one-time +1 hour bonus.',
      photos: [
        { src: 'bwtf/bonus-sampling-1.jpg', ar: 0.75, alt: 'Wading into the shore break with the sampling pole' },
        { src: 'bwtf/bonus-sampling-2.jpg', ar: 0.75, alt: 'Taking a water sample in the surf' },
        { src: 'bwtf/bonus-crew.jpg', ar: 1.333, alt: 'The sampling crew under the Surfrider banner' },
      ],
    },
  },

  // "Who said that?" live game. Needs supabase-upgrade-2026-11-game.sql run.
  // Players join at /play.html (QR on the intro slide). There is one game:
  // rehearse on it, then clear it with Account → Admin Tools → Reset the game
  // (app.js clears every game_id starting with `${team}-ceremony`, so keep
  // id = `${team}-ceremony`).
  game: { id: '5th-surftober-2026-ceremony', rounds: 6, seed: 2026 },
};
