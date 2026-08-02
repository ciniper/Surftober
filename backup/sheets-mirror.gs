/**
 * Surftober -> Google Sheet mirror (secondary, human-readable backup).
 *
 * Runs nightly on Google's servers via a time-driven trigger — no computer or
 * server needed. Mirrors sessions, profiles (WITHOUT photos), and the user
 * roster (id/email) from Supabase into tabs of a PRIVATE Google Sheet.
 *
 * This is the glanceable copy. The pg_dump workflow in the private
 * surftober-backup repo is the real restore-from backup (it has the photos).
 *
 * SETUP (once, ~10 minutes):
 *  1. Create a new Google Sheet. Keep it PRIVATE (do not "share with anyone
 *     with the link") — it will contain names, emails, and phone numbers.
 *  2. Extensions -> Apps Script. Delete the starter code, paste this file.
 *  3. Gear icon (Project Settings) -> Script Properties -> add two properties:
 *       SUPABASE_URL               https://rdrblueqytucygpmjuyh.supabase.co
 *       SUPABASE_SERVICE_ROLE_KEY  <service_role key: Supabase dashboard -> Settings -> API>
 *     The service_role key bypasses row security (needed to read all profiles).
 *     It lives ONLY here, in Script Properties — never in any repo or web page.
 *  4. In the editor toolbar select the function `setup` and click Run.
 *     Approve the permissions prompt. This does the first sync and creates the
 *     nightly 3am trigger.
 *  5. Check the Sheet: tabs `sessions`, `profiles`, `auth_users`, `meta` should
 *     be filled, and `meta` shows the last sync time. Done.
 *
 * The `meta` tab is your health check: if "last sync" ever goes stale during
 * the season, open the Apps Script editor -> Executions to see the error.
 */

const PAGE_SIZE = 1000; // PostgREST caps responses at 1000 rows; page past it.

// photo_base64 is deliberately excluded: a Sheets cell caps at 50,000
// characters and the photos are far larger (they live in the pg_dump backup).
const PROFILE_COLS = [
  'id', 'display_name', 'target_hours', 'charity_commitment', 'sponsor_match',
  'location_based', 'whatsapp_phone', 'fun_comment', 'additional_comments',
  'registered_at', 'created_at', 'updated_at'
];

// NOTE: audio_url exists only after the v1.5 upgrade SQL has been run.
// If your project predates it, remove 'audio_url' or the fetch will 400.
const SESSION_COLS = [
  'id', 'team', 'user_id', 'user_name', 'date', 'type', 'duration_minutes',
  'location', 'surf_craft', 'notes', 'no_wetsuit', 'costume', 'cleanup_items',
  'audio_url', 'created_at'
];

/** Run this once by hand: first sync + creates the nightly trigger. */
function setup() {
  // Remove any triggers from previous setups so reruns don't stack them.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'mirror') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('mirror').timeBased().everyDays(1).atHour(3).create();
  mirror();
}

/** The nightly job. */
function mirror() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // The ,id.asc tiebreakers are load-bearing: paging on a non-unique column
  // (many sessions share a date) shuffles tied rows between pages and silently
  // drops/duplicates rows past 1000. A unique key makes the order stable.
  const profiles = fetchAllRows_('/rest/v1/profiles',
    'select=' + PROFILE_COLS.join(',') + '&order=created_at.asc,id.asc');
  const sessions = fetchAllRows_('/rest/v1/sessions',
    'select=' + SESSION_COLS.join(',') + '&order=date.asc,id.asc');
  const users = fetchAuthUsers_();

  // Every profile row belongs to an auth user; fewer users than profiles means
  // the roster fetch silently truncated. Fail loudly rather than mirror a lie.
  if (users.length < profiles.length) {
    throw new Error('auth_users (' + users.length + ') < profiles (' + profiles.length + ') — roster fetch truncated?');
  }

  writeTab_(ss, 'sessions', SESSION_COLS,
    sessions.map(function (r) { return SESSION_COLS.map(function (c) { return cell_(r[c]); }); }));
  writeTab_(ss, 'profiles', PROFILE_COLS,
    profiles.map(function (r) { return PROFILE_COLS.map(function (c) { return cell_(r[c]); }); }));
  writeTab_(ss, 'auth_users', ['id', 'email', 'created_at', 'last_sign_in_at'],
    users.map(function (u) {
      return [cell_(u.id), cell_(u.email), cell_(u.created_at), cell_(u.last_sign_in_at)];
    }));
  writeTab_(ss, 'meta', ['last_sync_utc', 'profiles', 'sessions', 'auth_users'],
    [[new Date().toISOString(), profiles.length, sessions.length, users.length]]);
}

/** Script Properties -> config, with a clear error if unset. */
function config_() {
  const p = PropertiesService.getScriptProperties();
  const url = p.getProperty('SUPABASE_URL');
  const key = p.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Project Settings -> Script Properties.');
  }
  return { url: url.replace(/\/$/, ''), key: key };
}

/**
 * Page through a PostgREST endpoint and verify the total against the server.
 * Prefer: count=exact makes PostgREST report the true row count in the
 * Content-Range header ("0-999/2345"); we loop until we have them all and
 * throw if the numbers don't reconcile — truncation must be loud, never silent.
 */
function fetchAllRows_(path, query) {
  const cfg = config_();
  const rows = [];
  let total = null;
  for (let guard = 0; guard < 200; guard++) {
    const from = rows.length; // advance by what we actually received
    const res = UrlFetchApp.fetch(cfg.url + path + '?' + query, {
      headers: {
        apikey: cfg.key,
        Authorization: 'Bearer ' + cfg.key,
        'Range-Unit': 'items',
        Range: from + '-' + (from + PAGE_SIZE - 1),
        Prefer: 'count=exact'
      },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() >= 300) {
      throw new Error(path + ' -> HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
    }
    const headers = res.getHeaders();
    const cr = String(headers['Content-Range'] || headers['content-range'] || '');
    const m = cr.match(/\/(\d+)$/);
    if (m) total = Number(m[1]);
    const page = JSON.parse(res.getContentText());
    Array.prototype.push.apply(rows, page);
    if (total !== null ? rows.length >= total : page.length === 0) break;
    if (page.length === 0) break; // server stopped returning rows — bail out
  }
  if (total !== null && rows.length !== total) {
    throw new Error(path + ': fetched ' + rows.length + ' rows but server reports ' + total + ' — refusing silent truncation');
  }
  return rows;
}

/** The user roster (emails) comes from the GoTrue admin API, not PostgREST. */
function fetchAuthUsers_() {
  const cfg = config_();
  const users = [];
  // Stop only on an EMPTY page (not a short one): if the server ever clamps
  // per_page below what we asked for, a short-page check would truncate
  // silently. The empty-page check costs one extra request and can't.
  for (let page = 1; page <= 200; page++) {
    const res = UrlFetchApp.fetch(
      cfg.url + '/auth/v1/admin/users?page=' + page + '&per_page=' + PAGE_SIZE, {
        headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key },
        muteHttpExceptions: true
      });
    if (res.getResponseCode() >= 300) {
      throw new Error('/auth/v1/admin/users -> HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
    }
    const batch = JSON.parse(res.getContentText()).users || [];
    if (batch.length === 0) return users;
    Array.prototype.push.apply(users, batch);
  }
  throw new Error('auth users pagination exceeded 200 pages — aborting');
}

/** Replace a tab's contents wholesale (idempotent nightly rewrite). */
function writeTab_(ss, name, header, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  const data = [header].concat(rows);
  sh.getRange(1, 1, data.length, header.length).setValues(data);
}

/** Sheet-safe cell value: nulls -> '', long text truncated, formulas neutralized. */
function cell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'string') return v; // numbers/booleans pass through untouched
  let s = v;
  // A Sheets cell caps at 50,000 chars; one giant pasted note would otherwise
  // brick every nightly run. The full value still lives in the pg_dump backup.
  if (s.length > 49000) s = s.slice(0, 49000) + ' …[truncated]';
  // User-typed text starting with =, +, -, @ would be interpreted as a formula
  // by setValues; a leading apostrophe keeps it literal (also keeps phone
  // numbers like +1415… as text).
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
