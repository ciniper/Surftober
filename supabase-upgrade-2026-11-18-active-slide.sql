-- Surftober ceremony: let phones follow the deck's current slide.
-- The deck (signed in as the admin) writes the current slide's key here on
-- every slide change; play.html reads it and, on "Watch your trophy surf"
-- (key trophy-watch-it-play), shows the Zoetrope Viewer links and steps.
-- The existing ceremony_state policies already cover the new column:
-- anyone may read it, only the admin may write it.

alter table public.ceremony_state add column if not exists active_slide text;

notify pgrst, 'reload schema';
