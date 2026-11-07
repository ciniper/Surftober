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

  // Free-text recap slides (2025 had Surf Recap + Weather Recap).
  surfRecap: '',     // size, quality, standout swells
  weatherRecap: '',  // water temp, fog, wind

  // Fundraising (2025: $1,480 contributed, 2x company match, 5 beach cleanups).
  // `contributed` = what people actually gave (leave null to show the pledge
  // estimate: $/hour × hours). `matchMultiplier` 2 = company match doubles it,
  // the way the 2025 deck counted $1,480 contributed → $2,960 raised.
  charity: { contributed: null, matchMultiplier: 2, match: '2x company match', note: '' },

  // Judged awards — the data can't pick these. `winner` is free text.
  judged: {
    'best-dressed': { winner: '', value: '' },     // costume-surf candidates are listed on the slide
    'fallen-fathers': { winner: '', value: '' },
    'aim-for-the-stars': { winner: '', value: '' }, // 2023: fewest hours vs their goal (goals live in private profiles)
    'commuter': { winner: '', value: '' },          // 2024: travelled farthest to surf
  },

  // Agenda slide (2023 had one). Empty = no agenda slide.
  agenda: ['Overview', 'Awards', 'Story Time', 'Quotes'],

  // Photo slides: { src, caption }. `src` is a URL or a path under docs/.
  trophiesPast: [],  // 2025 deck: "Trophies Previous Years"
  trophiesNow: [],   // 2025 deck: "Trophies 2025"

  // Discussion slides from 2023/2024 — shown as big prompts.
  storyPrompts: ['What was your favorite session, favorite wave?', 'How challenging was it to complete your goal?'],

  // Closing slides. Empty strings = placeholder.
  donate: { text: 'Consider donating to Surfrider', detail: '$3–5 per hour', link: '' },
  shortFilm: { title: '', url: '' },  // 2023/2024 "Movie Time" / "Short Film?"
  tshirt: { images: [], note: '' },   // 2025 "T-shirt Concept": { src, caption } images

  // Hand-picked journal quotes: { text, by }.
  quotes: [],
};
