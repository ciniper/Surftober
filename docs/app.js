// Simple client-side Surftober demo using localStorage as the DB
// Supabase integration (Auth + DB)
const SUPABASE_URL = 'https://rdrblueqytucygpmjuyh.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkcmJsdWVxeXR1Y3lncG1qdXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMDkwODcsImV4cCI6MjA5NzU4NTA4N30.5mIdEYPqfpr1sZygMfK_0lQrLX82iAtqao-MwXTgSN0';
// Fallback season, used until the events table is reachable (and if the
// upgrade SQL hasn't been run yet — the app keeps working exactly as before).
const DEFAULT_EVENT = { id: null, name: 'Surftober 2026', team: 'surftober-2026', start_date: '2026-10-01', end_date: '2026-10-31', is_active: true };
let activeEvent = DEFAULT_EVENT;  // event currently accepting logs (null = logging closed)
let viewedEvent = DEFAULT_EVENT;  // event whose data is on screen
let viewedEventPinned = false;    // true once someone explicitly picks an event to view
let allEvents = [DEFAULT_EVENT];
let eventsTableAvailable = false;

// Load Supabase JS if not present
(function ensureSupabase(){
  if (!window.supabase) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload = initSupabase;
    document.head.appendChild(s);
  } else {
    initSupabase();
  }
})();

let sb = null; // supabase client
let currentUser = null;
let profileName = null;
let profileData = null; // full profile data
const adminEmails = ['ciniper@gmail.com']; // client-side admin allowlist (lowercase emails)
let isViewMode = false; // read-only mode

// HTML-escape for anything user-typed that lands in innerHTML. Sessions are
// public-read, so one malicious note/name would otherwise run on every device.
function esc(v){
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 'Oct 1' instead of '2026-10-01' anywhere a human reads a date
function fmtDay(d){
  try { return SurftoberAwards.localDate(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch { return String(d); }
}

// '7:15 AM' from the DB's 'HH:MM[:SS]'
function fmtTime(t){
  if (!t) return '';
  try {
    const [h, m] = String(t).split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch { return String(t); }
}

function toast(msg, type='success'){
  const box = document.getElementById('toast-container');
  if (!box) { console.log(`[${type}]`, msg); return; }
  const el = document.createElement('div');
  el.className = 'toast ' + (type||'');
  el.innerHTML = `<span>${esc(msg)}</span><span class="close">✕</span>`;
  el.querySelector('.close').onclick = ()=> el.remove();
  box.appendChild(el);
  setTimeout(()=> el.remove(), 4000);
}

function isAdminUser(){
  return !!currentUser && !!currentUser.email && adminEmails.includes(currentUser.email.toLowerCase());
}

// ===== Per-event registration =====
// Every event requires a (re-)registration: profiles.registered_event_id
// must match the active event. Existing accounts carry over — re-registering
// is just confirming the prefilled form on register.html, no new email
// verification. Admins are exempt.
// Deploy-order safety: while the SQL migration hasn't run, the column is
// absent from fetched rows and everyone counts as registered (old behavior).

// A signed-in non-admin who registered for a previous event must re-register
// before logging into the active one.
function needsReRegistration(){
  if (!currentUser || !activeEvent || isAdminUser()) return false;
  if (!profileData || !('registered_event_id' in profileData)) return false;
  return profileData.registered_event_id !== activeEvent.id;
}

// Same test for roster rows (public_profiles) — used for the 0-hour
// leaderboard rows, so only people signed up for THIS event appear.
function isProfileRegistered(p){
  if (!activeEvent || !p || !('registered_event_id' in p)) return true;
  return p.registered_event_id === activeEvent.id;
}

function updateReRegBanner(){
  const el = document.getElementById('rereg-banner');
  if (!el) return;
  if (needsReRegistration()) {
    el.innerHTML = `🌊 <b>${esc(activeEvent.name)}</b> is here — ` +
      `<a href="./register.html">re-register to join</a>! Your profile carries over; it takes 30 seconds.`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

// Admin UI gating based on NUKE_ADMINS allowlist. Awards + Admin have no
// header tabs anymore — admins reach them via the Account page's Admin
// Tools card; the pages themselves stay display:none for everyone else.
function reflectAdminVisibility(adminEmailList = []){
  const page = document.getElementById('page-admin');
  const awardsPage = document.getElementById('page-awards');
  const accountCard = document.getElementById('account-admin-card');
  const isAdmin = !!currentUser && currentUser.email && adminEmailList.includes(currentUser.email.toLowerCase());
  if (page) page.style.display = isAdmin ? '' : 'none';
  if (awardsPage) awardsPage.style.display = isAdmin ? '' : 'none';
  if (accountCard) accountCard.style.display = isAdmin ? '' : 'none';
  renderTabs(); // bounce off #admin/#awards if the current page just got hidden
}

// Viewers (in-app via the club password, not signed in) are read-only:
// no Log or Account, and a Home tab back to the landing page instead.
function reflectViewerNav(){
  const viewer = !currentUser;
  for (const key of ['log', 'account']) {
    const tab = document.querySelector(`.tabs a[data-tab="${key}"]`);
    const page = document.getElementById('page-' + key);
    if (tab) tab.style.display = viewer ? 'none' : '';
    if (page) page.style.display = viewer ? 'none' : '';
  }
  const home = document.getElementById('tab-home-link');
  if (home) home.style.display = viewer ? '' : 'none';
  renderTabs(); // bounce off #log/#account if they just got hidden
}

async function initSupabase(){
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  // handle auth redirect / initial session
  const {
    data: { user }
  } = await sb.auth.getUser();
  currentUser = user || null;
  
  // Check if user clicked "Sign In" from landing page
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'signin' && !currentUser) {
    // Redirect to register page which has sign-in options
    window.location.href = './register.html';
    return;
  }
  
  reflectAuthUI();
  reflectViewerNav();
  await fetchProfile();
  enforceProfileNameOnUI();
  reflectAdminVisibility(adminEmails);
  await loadEvents();

  // initial sync
  syncFromCloud();

  // auth state changes
  sb.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    reflectAuthUI();
    reflectViewerNav();
    reflectAdminVisibility(adminEmails);
    if (currentUser) {
      fetchProfile();
      syncFromCloud();
    } else {
      profileName = null;
      enforceProfileNameOnUI();
    }
  });

  // start realtime listener for sessions
  try {
    sb
      .channel('public:sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        syncFromCloud();
      })
      .subscribe();
  } catch {}

  // realtime listener for events, so a Launch/Activate reaches clients that
  // are already open (events are otherwise only fetched at page load)
  try {
    sb
      .channel('public:events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, async () => {
        await loadEvents();
        syncFromCloud();
      })
      .subscribe();
  } catch {}

  // realtime for the crew board — new posts appear without a reload
  try {
    sb
      .channel('public:messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadMessages(true);
      })
      .subscribe();
  } catch {}
}

function reflectAuthUI(){
  const status = document.getElementById('account-status');
  if (!status) return;
  if (currentUser) {
    status.textContent = `Signed in as ${currentUser.email}`;
  } else {
    status.textContent = 'Not signed in';
  }
}

// ===== Profile photos (stored in profiles.photo_base64, read for OTHER
// users via the public_profiles view — name+photo only, PII stays private) ===

const publicProfileCache = new Map(); // user_id -> {photo_base64, target_hours} | null
let pendingPhotoBase64;               // set when a new photo is picked, undefined otherwise

function avatarSrc(b64){
  if (!b64) return null;
  const s = String(b64);
  if (s.startsWith('data:')) return s;
  // Register-era photos are bare base64 with no MIME — sniff it (PNG starts
  // "iVBOR", JPEG "/9j/") so the data URL is labeled correctly.
  const mime = s.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
  return 'data:' + mime + ';base64,' + s;
}

async function fetchPublicProfile(userId){
  if (!sb || !userId) return null;
  if (publicProfileCache.has(userId)) return publicProfileCache.get(userId);
  try {
    // select('*'): the view only exposes public columns, so this picks up
    // whatever the deployed view offers (photo/goal/fun comment) with no
    // column-mismatch errors across SQL deploy windows.
    const { data, error } = await sb.from('public_profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    publicProfileCache.set(userId, data || null);
    return data || null;
  } catch {
    // View missing (or still on the pre-target_hours version) — cache the miss
    // so we don't refetch in a loop; page just shows totals without goal info.
    publicProfileCache.set(userId, null);
    return null;
  }
}

// ===== Roster (everyone who registered, sessions or not) ==================
// Lightweight list from public_profiles — no photos, those stay lazy via
// fetchPublicProfile — so registrants appear on the leaderboard and Sessions
// pages before their first session, and pledge rates feed the $ tracker.
let roster = []; // [{id, display_name, target_hours, charity_commitment?, fun_comment?}]

async function loadRoster(){
  if (!sb) return;
  const columnSets = [
    'id, display_name, target_hours, charity_commitment, fun_comment, registered_event_id',
    'id, display_name, target_hours, charity_commitment, fun_comment', // view predates registered_event_id
    'id, display_name, target_hours' // view predates charity_commitment
  ];
  for (const cols of columnSets) {
    let res;
    try { res = await sb.from('public_profiles').select(cols); } catch { return; }
    if (!res.error) {
      roster = (res.data || []).filter((p) => p && String(p.display_name || '').trim());
      return;
    }
    // 42703 = unknown column (older deployed view) — retry with fewer columns.
    // Any other error (network blip, view missing) keeps the PREVIOUS roster:
    // wiping it would yank zero-hour registrants off a board that rendered
    // fine a second ago. syncFromCloud runs often; a later pass will heal it.
    if (res.error.code !== '42703') return;
  }
}

// "$2/hour", "2 per hour", "$1.50" → 2, 2, 1.5. First number wins; junk → 0.
function parsePledgeRate(text){
  const m = String(text || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

// Shrink whatever the camera roll hands us to a small square-ish JPEG so the
// profiles table doesn't fill up with 8 MB originals.
async function compressImageToBase64(file, maxDim = 256, quality = 0.82){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('could not read that image'));
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fetchProfile(){
  if (!currentUser) {
    profileName = null;
    profileData = null;
    updateReRegBanner();
    return;
  }
  const { data, error} = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
  if (error) { console.warn('profile fetch error', error); return; }
  profileData = data;
  profileName = (data && data.display_name) ? data.display_name : null;
  
  // Populate all profile fields in Account tab
  const fields = {
    'display-name': data?.display_name || '',
    'profile-target-hours': data?.target_hours || '',
    'profile-charity': data?.charity_commitment || '',
    'profile-sponsor': data?.sponsor_match || '',
    'profile-location': data?.location_based || '',
    'profile-whatsapp': data?.whatsapp_phone || '',
    'profile-fun-comment': data?.fun_comment || '',
    'profile-comments': data?.additional_comments || ''
  };
  
  for (const [id, value] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  const photoPreview = document.getElementById('profile-photo-preview');
  if (photoPreview) {
    const src = avatarSrc(data && data.photo_base64);
    if (src) { photoPreview.src = src; photoPreview.style.display = ''; }
    else photoPreview.style.display = 'none';
  }

  enforceProfileNameOnUI();
  renderAccountPledge();
  updateReRegBanner();
}

async function saveProfile(){
  if (!currentUser) throw new Error('Sign in first');
  const displayName = document.getElementById('display-name').value.trim();
  if (!displayName) throw new Error('Display name cannot be empty');
  const profileUpdate = {
    id: currentUser.id,
    display_name: displayName,
    target_hours: document.getElementById('profile-target-hours').value.trim(),
    charity_commitment: document.getElementById('profile-charity').value.trim(),
    sponsor_match: document.getElementById('profile-sponsor').value.trim(),
    location_based: document.getElementById('profile-location').value.trim(),
    whatsapp_phone: document.getElementById('profile-whatsapp').value.trim(),
    fun_comment: document.getElementById('profile-fun-comment').value.trim(),
    additional_comments: document.getElementById('profile-comments').value.trim(),
    // keep the existing photo unless a new one was picked this session
    photo_base64: pendingPhotoBase64 !== undefined ? pendingPhotoBase64 : ((profileData && profileData.photo_base64) || null)
  };
  const { error } = await sb.from('profiles').upsert(profileUpdate);
  if (error) throw error;
  pendingPhotoBase64 = undefined;
  publicProfileCache.delete(currentUser.id); // Sessions page re-fetches the new photo/goal
  await fetchProfile();
  enforceProfileNameOnUI();
}

function enforceProfileNameOnUI(){
  // Log form user field. With a profile name it's plain text, not an input —
  // the name is profile-owned and was never editable here anyway. The hidden
  // input keeps its value so the submit path is unchanged.
  const userEl = document.getElementById('log-user');
  const labelEl = document.getElementById('log-user-label');
  const staticEl = document.getElementById('log-user-static');
  if (!userEl) return;
  if (currentUser && profileName) {
    userEl.value = profileName;
    userEl.readOnly = true;
    if (labelEl) labelEl.classList.add('hidden');
    if (staticEl) {
      staticEl.style.display = '';
      staticEl.innerHTML = `<span>Name</span><strong>${esc(profileName)}</strong>`;
    }
  } else {
    if (labelEl) labelEl.classList.remove('hidden');
    if (staticEl) staticEl.style.display = 'none';
    if (currentUser && !profileName) {
      userEl.value = '';
      userEl.readOnly = true;
      userEl.placeholder = 'Set your name in Account tab';
    } else {
      userEl.readOnly = false;
    }
  }
}

async function signInMagicLink(email){
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
}

async function signOut(){
  try {
    await sb.auth.signOut();
    currentUser = null;
    profileName = null;
    profileData = null;
    
    // Clear all session storage
    sessionStorage.clear();
    
    // Clear Supabase auth tokens. supabase-js v2 stores the session under
    // 'sb-<project-ref>-auth-token' — NOT under a 'supabase*' key.
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.includes('-auth-token')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    reflectAuthUI();
  } catch (e) {
    console.error('Sign out error:', e);
  }
}

async function saveDisplayName(){
  if (!currentUser) throw new Error('Sign in first');
  const val = (document.getElementById('display-name').value || '').trim();
  if (!val) throw new Error('Display name cannot be empty');
  const { error } = await sb.from('profiles').upsert({ id: currentUser.id, display_name: val });
  if (error) throw error;
}

// ===== Color scheme selector (Admin tab, applies per-device) =====
// Themes are just values for the CSS variables in styles.css. The choice is
// stored in localStorage, so the admin can tinker without changing anyone
// else's app; the winner gets baked into styles.css for everyone.

const THEME_KEY = 'surftober.theme.v1';
// on-accent = ink on accent-filled surfaces; accent-text = accent used AS text
// (darkened on light themes). Every pairing is WCAG-checked >= 4.5:1.
// btn-bg/btn-bg-strong (optional): a deeper orange for button/active-tab
// fills so on-accent can be WHITE and still pass — white on the bright brand
// orange #ff6b35 is only 2.8:1, but on #d1470f→#c2410c it's 4.6–5.2:1.
// Themes without them fall back to accent/accent-strong via CSS var defaults.
const THEME_VAR_NAMES = ['bg', 'panel', 'muted', 'accent', 'accent-strong', 'text', 'ok', 'warn', 'input-bg', 'input-border', 'card-border', 'on-accent', 'accent-text', 'btn-bg', 'btn-bg-strong', 'money'];

const THEMES = {
  'sunset-surf': { label: 'Sunset Surf (dark mode)', vars: { 'bg': '#0a1628', 'panel': '#152238', 'muted': '#1e3a52', 'accent': '#ff6b35', 'accent-strong': '#ff4500', 'text': '#e8f4f8', 'ok': '#4ecdc4', 'warn': '#ffa500', 'input-bg': '#1e3a52', 'input-border': '#2d4a62', 'card-border': '#2d4a62', 'on-accent': '#ffffff', 'accent-text': '#ff6b35', 'btn-bg': '#d1470f', 'btn-bg-strong': '#c2410c', 'money': '#4bbf7a' } },
  'sunset-ember': { label: 'Sunset Surf · accent borders', vars: { 'bg': '#0a1628', 'panel': '#152238', 'muted': '#1e3a52', 'accent': '#ff6b35', 'accent-strong': '#ff4500', 'text': '#e8f4f8', 'ok': '#4ecdc4', 'warn': '#ffa500', 'input-bg': '#1e3a52', 'input-border': '#9c4d31', 'card-border': '#9c4d31', 'on-accent': '#26140a', 'accent-text': '#ff6b35' } },
  'sunset-soft': { label: 'Sunset Soft', vars: { 'bg': '#0d1b30', 'panel': '#182842', 'muted': '#22405c', 'accent': '#ff8b5e', 'accent-strong': '#ff6b35', 'text': '#eef6f9', 'ok': '#4ecdc4', 'warn': '#ffb347', 'input-bg': '#22405c', 'input-border': '#33516e', 'card-border': '#33516e', 'on-accent': '#26140a', 'accent-text': '#ff8b5e' } },
  'board-wax': { label: 'Board Wax', vars: { 'bg': '#181310', 'panel': '#241c16', 'muted': '#33271d', 'accent': '#f4703a', 'accent-strong': '#dd4f0e', 'text': '#f3eae2', 'ok': '#57cfa8', 'warn': '#ffb54d', 'input-bg': '#33271d', 'input-border': '#85684c', 'card-border': '#4a3728', 'on-accent': '#140a04', 'accent-text': '#f4703a' } },
  'night-swell': { label: 'Night Swell', vars: { 'bg': '#060b16', 'panel': '#0e1626', 'muted': '#182337', 'accent': '#ff5a1f', 'accent-strong': '#e8430a', 'text': '#e9f0fa', 'ok': '#3fdbb4', 'warn': '#ffab40', 'input-bg': '#182337', 'input-border': '#546a8c', 'card-border': '#28374f', 'on-accent': '#140a04', 'accent-text': '#ff5a1f' } },
  'dusk-patrol': { label: 'Dusk Patrol', vars: { 'bg': '#171533', 'panel': '#211e46', 'muted': '#2e2a5e', 'accent': '#fb6a2a', 'accent-strong': '#e85510', 'text': '#efedfb', 'ok': '#5fe0c0', 'warn': '#ffc46b', 'input-bg': '#2e2a5e', 'input-border': '#6f68ad', 'card-border': '#403a78', 'on-accent': '#26140a', 'accent-text': '#fb6a2a' } },
  'high-tide': { label: 'High Tide', vars: { 'bg': '#0a1628', 'panel': '#152238', 'muted': '#1e3a52', 'accent': '#2ec4b6', 'accent-strong': '#17a398', 'text': '#e8f4f8', 'ok': '#5be37a', 'warn': '#ffa500', 'input-bg': '#1e3a52', 'input-border': '#2d4a62', 'card-border': '#2d4a62', 'on-accent': '#04231f', 'accent-text': '#2ec4b6' } },
  'golden-hour': { label: 'Golden Hour', vars: { 'bg': '#161020', 'panel': '#241a30', 'muted': '#332545', 'accent': '#ffb347', 'accent-strong': '#ff8c42', 'text': '#f6ecdf', 'ok': '#4ecdc4', 'warn': '#ffd166', 'input-bg': '#332545', 'input-border': '#453458', 'card-border': '#453458', 'on-accent': '#241505', 'accent-text': '#ffb347' } },
  'dawn-patrol': { label: 'Dawn Patrol', vars: { 'bg': '#141126', 'panel': '#1f1a38', 'muted': '#2c2450', 'accent': '#ff8fa3', 'accent-strong': '#ff5c7a', 'text': '#f3eefc', 'ok': '#7ce7c4', 'warn': '#ffc46b', 'input-bg': '#2c2450', 'input-border': '#3b3166', 'card-border': '#3b3166', 'on-accent': '#2b0f16', 'accent-text': '#ff8fa3' } },
  'deep-kelp': { label: 'Deep Kelp', vars: { 'bg': '#0a1f14', 'panel': '#12301f', 'muted': '#1a4029', 'accent': '#ffc857', 'accent-strong': '#f4a300', 'text': '#eaf6ec', 'ok': '#4ecdc4', 'warn': '#ff9f1c', 'input-bg': '#1a4029', 'input-border': '#2a5a3c', 'card-border': '#2a5a3c', 'on-accent': '#1f1503', 'accent-text': '#ffc857' } },
  'midnight-set': { label: 'Midnight Set', vars: { 'bg': '#05080f', 'panel': '#0d1420', 'muted': '#16202f', 'accent': '#4da3ff', 'accent-strong': '#1f7ae0', 'text': '#e6eefc', 'ok': '#54e0b0', 'warn': '#ffb347', 'input-bg': '#16202f', 'input-border': '#243349', 'card-border': '#243349', 'on-accent': '#02060c', 'accent-text': '#4da3ff' } },
  'neon-beach': { label: 'Neon Beach', vars: { 'bg': '#0d0d0f', 'panel': '#1a1a1e', 'muted': '#2a2a32', 'accent': '#ff6b35', 'accent-strong': '#ff4500', 'text': '#f5f5f5', 'ok': '#00ff88', 'warn': '#ffaa00', 'input-bg': '#1a1a1e', 'input-border': '#3a3a42', 'card-border': '#2a2a32', 'on-accent': '#26140a', 'accent-text': '#ff6b35' } },
  'pumpkin-spice': { label: 'Pumpkin Spice (light mode · default)', vars: { 'bg': '#f5f0e8', 'panel': '#fff8f0', 'muted': '#e8dcc8', 'accent': '#ff6b35', 'accent-strong': '#e85d2a', 'text': '#2d2416', 'ok': '#2d8659', 'warn': '#a8560f', 'input-bg': '#ffffff', 'input-border': '#d4c4a8', 'card-border': '#d4c4a8', 'on-accent': '#ffffff', 'accent-text': '#b54a17', 'btn-bg': '#d1470f', 'btn-bg-strong': '#c2410c', 'money': '#1e7a47' } },
  'pumpkin-ember': { label: 'Pumpkin Spice · accent borders', vars: { 'bg': '#f5f0e8', 'panel': '#fff8f0', 'muted': '#e8dcc8', 'accent': '#ff6b35', 'accent-strong': '#e85d2a', 'text': '#2d2416', 'ok': '#2d8659', 'warn': '#a8560f', 'input-bg': '#ffffff', 'input-border': '#e2a380', 'card-border': '#e2a380', 'on-accent': '#26140a', 'accent-text': '#b54a17' } },
  'sandbar': { label: 'Sandbar (light)', vars: { 'bg': '#f8efe2', 'panel': '#fffaf2', 'muted': '#eddcc2', 'accent': '#c8480f', 'accent-strong': '#b83c05', 'text': '#38271a', 'ok': '#1e7a52', 'warn': '#a95410', 'input-bg': '#ffffff', 'input-border': '#94795a', 'card-border': '#d8c3a2', 'on-accent': '#ffffff', 'accent-text': '#b23f07' } },
  'sea-glass': { label: 'Sea Glass (light)', vars: { 'bg': '#f2f7f7', 'panel': '#ffffff', 'muted': '#e3edee', 'accent': '#0e7c86', 'accent-strong': '#0a5c64', 'text': '#17323a', 'ok': '#1a936f', 'warn': '#9a5c0d', 'input-bg': '#ffffff', 'input-border': '#c2d4d6', 'card-border': '#d5e3e4', 'on-accent': '#ffffff', 'accent-text': '#0e7c86' } },
};

const DEFAULT_THEME = 'pumpkin-spice'; // light mode is the app default

function currentThemeSelection(){
  try { return JSON.parse(localStorage.getItem(THEME_KEY)) || { name: DEFAULT_THEME }; }
  catch { return { name: DEFAULT_THEME }; }
}

function themeVarsFor(sel){
  if (sel.name === 'custom') return { ...THEMES[DEFAULT_THEME].vars, ...(sel.vars || {}) };
  return (THEMES[sel.name] || THEMES[DEFAULT_THEME]).vars;
}

function applyThemeVars(vars){
  for (const k of THEME_VAR_NAMES) {
    // Clear optional vars a theme doesn't define (btn-bg etc.) so switching
    // away from a theme that set them falls back to the CSS defaults.
    if (vars[k]) document.documentElement.style.setProperty('--' + k, vars[k]);
    else document.documentElement.style.removeProperty('--' + k);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && vars.panel) meta.setAttribute('content', vars.panel);
  reflectModeToggle();
}

// ===== Dark / light toggle (header ☀️🌙, available to everyone) ============
// Dark = Sunset Surf, light = Pumpkin Spice. Same storage as the admin theme
// selector, so the two stay consistent; an admin-picked exotic theme is
// classified by its background luminance.
function appliedThemeIsDark(){
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const m = bg.match(/^#([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) < 128;
}

function reflectModeToggle(){
  const btn = document.getElementById('mode-toggle');
  if (btn) btn.textContent = appliedThemeIsDark() ? '☀️' : '🌙';
}

function initModeToggle(){
  const btn = document.getElementById('mode-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const name = appliedThemeIsDark() ? 'pumpkin-spice' : 'sunset-surf';
    localStorage.setItem(THEME_KEY, JSON.stringify({ name }));
    applyThemeVars(themeVarsFor({ name }));
    seedThemePickers(themeVarsFor({ name }));
    reflectThemeChips();
  });
  reflectModeToggle();
}

// Apply the saved theme the moment this module evaluates — waiting for the
// window load event painted one frame of the wrong mode first.
applyThemeVars(themeVarsFor(currentThemeSelection()));

function reflectThemeChips(){
  const sel = currentThemeSelection();
  document.querySelectorAll('#theme-presets .theme-chip').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-theme') === sel.name);
  });
  const custom = document.getElementById('theme-custom');
  if (custom) custom.classList.toggle('active', sel.name === 'custom');
}

function seedThemePickers(vars){
  document.querySelectorAll('#theme-pickers input[type="color"]').forEach((inp) => {
    const v = vars[inp.getAttribute('data-var')];
    if (v && /^#[0-9a-fA-F]{6}$/.test(v.trim())) inp.value = v.trim();
  });
}

function readThemePickers(){
  const vars = {};
  document.querySelectorAll('#theme-pickers input[type="color"]').forEach((inp) => {
    vars[inp.getAttribute('data-var')] = inp.value;
  });
  return vars;
}

function initThemeUI(){
  const presets = document.getElementById('theme-presets');
  if (!presets) return;
  presets.innerHTML = Object.entries(THEMES).map(([key, t]) =>
    `<button type="button" class="theme-chip" data-theme="${esc(key)}">
      <span class="sw" style="background:${esc(t.vars['bg'])}"></span><span class="sw" style="background:${esc(t.vars['panel'])}"></span><span class="sw" style="background:${esc(t.vars['accent'])}"></span>
      ${esc(t.label)}
    </button>`).join('');
  presets.querySelectorAll('.theme-chip').forEach((b) => b.addEventListener('click', () => {
    const name = b.getAttribute('data-theme');
    localStorage.setItem(THEME_KEY, JSON.stringify({ name }));
    applyThemeVars(themeVarsFor({ name }));
    seedThemePickers(themeVarsFor({ name }));
    reflectThemeChips();
  }));

  const pickers = document.getElementById('theme-pickers');
  if (pickers) {
    pickers.innerHTML = THEME_VAR_NAMES.map((k) =>
      `<label>${esc(k)}<input type="color" data-var="${esc(k)}" /></label>`).join('');
    pickers.querySelectorAll('input[type="color"]').forEach((inp) => inp.addEventListener('input', () => {
      const vars = readThemePickers();
      localStorage.setItem(THEME_KEY, JSON.stringify({ name: 'custom', vars }));
      applyThemeVars(vars);
      reflectThemeChips();
    }));
  }

  const copyBtn = document.getElementById('btn-theme-copy');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    // Seed the pickers from whatever is on screen right now
    const cs = getComputedStyle(document.documentElement);
    const vars = {};
    for (const k of THEME_VAR_NAMES) vars[k] = cs.getPropertyValue('--' + k).trim();
    seedThemePickers(vars);
  });

  const resetBtn = document.getElementById('btn-theme-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    localStorage.removeItem(THEME_KEY);
    applyThemeVars(THEMES[DEFAULT_THEME].vars);
    seedThemePickers(THEMES[DEFAULT_THEME].vars);
    reflectThemeChips();
  });

  // Boot state
  const sel = currentThemeSelection();
  seedThemePickers(themeVarsFor(sel));
  reflectThemeChips();
  const details = document.getElementById('theme-custom');
  if (details && sel.name === 'custom') details.open = true;
}

// ===== Events (admin-launched seasons) =====

async function loadEvents(){
  try {
    const { data, error } = await sb.from('events').select('*').order('start_date', { ascending: false });
    if (error) throw error;
    eventsTableAvailable = true;
    allEvents = data || [];
    activeEvent = allEvents.find((e) => e.is_active) || null;
    // Follow the active event unless someone explicitly picked one to view —
    // otherwise the boot-time fallback pins the screen to the wrong season.
    const stillThere = viewedEventPinned && viewedEvent && allEvents.find((e) => e.team === viewedEvent.team);
    viewedEvent = stillThere || activeEvent || allEvents[0] || DEFAULT_EVENT;
  } catch {
    // events table not deployed yet — keep the built-in season
    eventsTableAvailable = false;
    allEvents = [DEFAULT_EVENT];
    activeEvent = DEFAULT_EVENT;
    viewedEvent = DEFAULT_EVENT;
  }
  reflectEventUI();
}

function todayStr(){
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

// Today, clamped into the active event's window (the log form only accepts
// dates inside the window).
function defaultLogDate(){
  const t = todayStr();
  if (!activeEvent) return t;
  return t < activeEvent.start_date ? activeEvent.start_date : t > activeEvent.end_date ? activeEvent.end_date : t;
}

function isViewingActiveEvent(){
  return !!activeEvent && !!viewedEvent && activeEvent.team === viewedEvent.team;
}

function switchViewedEvent(ev){
  viewedEvent = ev;
  viewedEventPinned = true;
  reflectEventUI();
  syncFromCloud();
}

function reflectEventUI(){
  const ev = viewedEvent || DEFAULT_EVENT;
  // Banner when browsing a past event / when logging is closed
  const banner = document.getElementById('event-banner');
  if (banner) {
    if (activeEvent && ev.team !== activeEvent.team) {
      banner.innerHTML = `Viewing past event: <b>${esc(ev.name)}</b> (${fmtDay(ev.start_date)} – ${fmtDay(ev.end_date)}) · <a href="#" id="event-banner-back">Back to ${esc(activeEvent.name)}</a>`;
      banner.style.display = '';
      const back = document.getElementById('event-banner-back');
      if (back) back.addEventListener('click', (e) => { e.preventDefault(); switchViewedEvent(activeEvent); });
    } else if (!activeEvent && eventsTableAvailable) {
      banner.innerHTML = `No active event — logging is closed. Viewing <b>${esc(ev.name)}</b>.`;
      banner.style.display = '';
    } else {
      banner.style.display = 'none';
    }
  }
  // Scope labels: Sessions / Awards keep theirs inline; the Leaderboard's
  // moved to the global footer so it shows on every page.
  const scopeText = `${ev.name} · ${fmtDay(ev.start_date)} – ${fmtDay(ev.end_date)}`;
  for (const id of ['me-scope', 'aw-scope', 'footer-scope']) {
    const el = document.getElementById(id);
    if (el) el.textContent = scopeText;
  }
  updateReRegBanner(); // activeEvent just resolved — the re-register nag may apply now
  // Log form window
  const dateEl = document.getElementById('log-date');
  if (dateEl) {
    if (activeEvent) {
      dateEl.min = activeEvent.start_date;
      dateEl.max = activeEvent.end_date;
      if (!editingId) dateEl.value = defaultLogDate();
    } else {
      dateEl.removeAttribute('min');
      dateEl.removeAttribute('max');
    }
  }
  // Logging is closed with no active event, before the window opens (clamping
  // the date forward would silently misdate pre-season entries), and while the
  // admin has logging frozen (event stays active, board is final).
  const preWindow = !!activeEvent && todayStr() < activeEvent.start_date;
  const frozen = !!activeEvent && !!activeEvent.logging_frozen;
  const submitBtn = document.getElementById('btn-submit');
  if (submitBtn) submitBtn.disabled = !activeEvent || preWindow || frozen;
  const notice = document.getElementById('event-notice');
  if (notice) {
    if (!activeEvent) {
      notice.textContent = 'No active event — logging opens when the admin launches one.';
      notice.style.display = '';
    } else if (frozen) {
      notice.textContent = `Logging for ${activeEvent.name} is frozen — the board is final unless the admin reopens it.`;
      notice.style.display = '';
    } else if (preWindow) {
      notice.textContent = `${activeEvent.name} starts ${fmtDay(activeEvent.start_date)} — logging opens then.`;
      notice.style.display = '';
    } else {
      notice.style.display = 'none';
    }
  }
  // Audio needs the storage bucket + column from the upgrade SQL
  const audioField = document.getElementById('field-audio');
  if (audioField) audioField.style.display = eventsTableAvailable ? '' : 'none';
  renderAdminEvents();
}

function renderAdminEvents(){
  const el = document.getElementById('admin-events');
  if (!el) return;
  if (!eventsTableAvailable) {
    el.innerHTML = '<div class="hint">Events table not found — run supabase-upgrade-2026-08-events-audio.sql in the Supabase SQL editor, then reload.</div>';
    return;
  }
  if (!allEvents.length) {
    el.innerHTML = '<div class="hint">No events yet — launch one above.</div>';
    return;
  }
  const rows = allEvents.map((e) => {
    const status = [
      e.is_active ? '<span class="badge ok">ACTIVE</span>' : '', // not a medal — gold means 40h here
      e.logging_frozen ? '<span class="badge frozen">FROZEN</span>' : ''
    ].filter(Boolean).join(' ');
    const viewing = viewedEvent && viewedEvent.team === e.team ? ' 👁' : '';
    const actions = [
      `<a href="#" class="ev-view" data-team="${esc(e.team)}">View</a>`,
      e.is_active ? '' : `<a href="#" class="ev-activate" data-team="${esc(e.team)}">Activate</a>`,
      `<a href="#" class="ev-edit" data-team="${esc(e.team)}">Edit</a>`,
      // The freeze flag only has teeth on the active event — that's where the toggle lives
      e.is_active ? `<a href="#" class="ev-freeze" data-team="${esc(e.team)}">${e.logging_frozen ? 'Unfreeze' : 'Freeze logging'}</a>` : ''
    ].filter(Boolean).join(' | ');
    return `<tr><td>${esc(e.name)}${viewing}</td><td>${esc(e.start_date)} → ${esc(e.end_date)}</td><td>${status}</td><td>${actions}</td></tr>`;
  });
  el.innerHTML = `<table><thead><tr><th>Event</th><th>Window</th><th></th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  const evFor = (a) => allEvents.find((x) => x.team === a.getAttribute('data-team'));
  el.querySelectorAll('.ev-view').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const ev = evFor(a);
    if (ev) { switchViewedEvent(ev); toast(`Viewing ${ev.name}`, 'success'); }
  }));
  el.querySelectorAll('.ev-activate').forEach((a) => a.addEventListener('click', async (e) => {
    e.preventDefault();
    const ev = evFor(a);
    if (!ev) return;
    if (!confirm(`Make "${ev.name}" the active event? Users will only be able to log ${ev.start_date} → ${ev.end_date}.`)) return;
    try {
      await setActiveEvent(ev.team);
      toast(`${ev.name} is now active`, 'success');
    } catch (err) {
      toast('Activate failed: ' + err.message, 'error');
    }
  }));
  el.querySelectorAll('.ev-edit').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const ev = evFor(a);
    if (!ev) return;
    startEventEdit(ev);
  }));
  el.querySelectorAll('.ev-freeze').forEach((a) => a.addEventListener('click', async (e) => {
    e.preventDefault();
    const ev = evFor(a);
    if (!ev) return;
    const freezing = !ev.logging_frozen;
    if (!confirm(freezing
      ? `Freeze logging for "${ev.name}"? It stays the active event (board, pledges, viewing all keep working), but nobody can add, edit, or delete sessions until you unfreeze.`
      : `Unfreeze logging for "${ev.name}"? Members can log again.`)) return;
    try {
      const { data, error } = await sb.from('events')
        .update({ logging_frozen: freezing })
        .eq('team', ev.team)
        .select('team');
      if (error) throw error;
      if (!data || !data.length) throw new Error('not permitted (admin only)');
      await loadEvents();
      toast(freezing ? 'Logging frozen — the board is final until you unfreeze.' : 'Logging reopened.', 'success');
    } catch (err) {
      toast('Freeze failed: ' + err.message, 'error');
    }
  }));
}

// ===== Editing an event's name / window (team slug stays put — sessions
// reference it, so renaming only changes the display name) =====
let editingEventTeam = null;

function startEventEdit(ev){
  editingEventTeam = ev.team;
  document.getElementById('ev-name').value = ev.name;
  document.getElementById('ev-start').value = ev.start_date;
  document.getElementById('ev-end').value = ev.end_date;
  const activateCb = document.getElementById('ev-activate-now');
  if (activateCb) activateCb.checked = !!ev.is_active; // don't surprise-activate a staged event on save
  reflectEventFormMode();
  const nameEl = document.getElementById('ev-name');
  if (nameEl && nameEl.scrollIntoView) nameEl.scrollIntoView({ block: 'center' });
}

function cancelEventEdit(){
  editingEventTeam = null;
  const nameEl = document.getElementById('ev-name');
  if (nameEl) nameEl.value = '';
  const activateCb = document.getElementById('ev-activate-now');
  if (activateCb) activateCb.checked = true;
  reflectEventFormMode();
}

function reflectEventFormMode(){
  const btn = document.getElementById('btn-launch-event');
  const cancel = document.getElementById('ev-edit-cancel');
  const editing = !!editingEventTeam;
  if (btn) btn.textContent = editing ? 'Save Changes' : 'Launch Event';
  if (cancel) cancel.style.display = editing ? '' : 'none';
}

async function setActiveEvent(team){
  if (!sb) throw new Error('Not connected');
  // One atomic statement server-side (activate_event RPC): a failure between
  // "deactivate all" and "activate new" can never strand zero active events.
  const { error } = await sb.rpc('activate_event', { p_team: team });
  if (error) throw error;
  await loadEvents();
  switchViewedEvent(activeEvent || viewedEvent);
}

async function launchEvent(){
  if (!sb) { toast('Not connected yet — try again in a second', 'error'); return; }
  const name = (document.getElementById('ev-name').value || '').trim();
  const start = document.getElementById('ev-start').value;
  const end = document.getElementById('ev-end').value;
  if (!name || !start || !end) { toast('Name, start date and end date are required', 'warn'); return; }
  if (end < start) { toast('End date must be on or after the start date', 'warn'); return; }
  const activateNow = !!document.getElementById('ev-activate-now')?.checked;
  // Edit mode: update the picked event in place — team slug pinned, name free
  if (editingEventTeam) {
    const ev = allEvents.find((e) => e.team === editingEventTeam);
    const wasActive = !!(ev && ev.is_active);
    if (!confirm(`Save changes to "${name}" (${start} → ${end})${activateNow && !wasActive ? ' and make it the active event' : ''}?`)) return;
    try {
      const { data, error } = await sb.from('events')
        .update({ name, start_date: start, end_date: end })
        .eq('team', editingEventTeam)
        .select('team');
      if (error) throw error;
      if (!data || !data.length) throw new Error('not permitted (admin only)');
      if (activateNow && !wasActive) await setActiveEvent(editingEventTeam);
      else await loadEvents();
      toast(`${name} updated`, 'success');
      cancelEventEdit();
    } catch (e) {
      toast('Update failed: ' + e.message, 'error');
    }
    return;
  }
  let team = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!/\d{4}/.test(team)) team += '-' + start.slice(0, 4);
  const existing = allEvents.find((e) => e.team === team);
  const msg = existing
    ? `"${name}" already exists (${existing.start_date} → ${existing.end_date}). Update its window to ${start} → ${end}${activateNow ? ' and make it the active event' : ''}?`
    : activateNow
      ? `Launch "${name}" (${start} → ${end})? This deactivates any current event and freezes its data.`
      : `Stage "${name}" (${start} → ${end})? It stays inactive — activate it from the list when ready.`;
  if (!confirm(msg)) return;
  try {
    // Upsert the row first (inactive on insert), then optionally flip
    // activation in one atomic RPC — see setActiveEvent. Any number of
    // events can sit staged; the DB allows only one active.
    const { error } = await sb.from('events').upsert(
      { name, team, start_date: start, end_date: end },
      { onConflict: 'team' }
    );
    if (error) throw error;
    if (activateNow) {
      await setActiveEvent(team);
      toast(`${name} launched — logging window ${start} → ${end}`, 'success');
    } else {
      await loadEvents();
      toast(`${name} staged — use Activate in the events list to open it`, 'success');
    }
  } catch (e) {
    toast('Launch failed: ' + e.message, 'error');
  }
}

function attachAdminEventHandlers(){
  const yearEl = document.getElementById('ev-year');
  const monthEl = document.getElementById('ev-month');
  const startEl = document.getElementById('ev-start');
  const endEl = document.getElementById('ev-end');
  const nameEl = document.getElementById('ev-name');
  const btn = document.getElementById('btn-launch-event');
  if (!btn) return;
  function prefill(){
    const y = Number(yearEl.value);
    const m = Number(monthEl.value);
    if (!y || !m) return;
    const last = new Date(y, m, 0).getDate(); // last day of that month
    startEl.value = `${y}-${String(m).padStart(2, '0')}-01`;
    endEl.value = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    if (!nameEl.value.trim() || /^Surftober \d{4}$/.test(nameEl.value.trim())) nameEl.value = `Surftober ${y}`;
  }
  yearEl.addEventListener('input', prefill);
  monthEl.addEventListener('change', prefill);
  prefill();
  btn.addEventListener('click', launchEvent);
  const cancel = document.getElementById('ev-edit-cancel');
  if (cancel) cancel.addEventListener('click', (e) => { e.preventDefault(); cancelEventEdit(); prefill(); });
}

async function fetchCloudSessions(){
  const team = (viewedEvent || DEFAULT_EVENT).team;
  // Soft-deleted sessions (deleted_at set) stay in the DB for the backups but
  // never reach the UI.
  let { data, error } = await sb
    .from('sessions')
    .select('*')
    .eq('team', team)
    .is('deleted_at', null)
    .order('date', { ascending: true })
    .limit(5000);
  if (error && error.code === '42703') {
    // deleted_at column doesn't exist yet (soft-delete SQL not run) — fall
    // back to the unfiltered fetch so the app keeps working.
    ({ data, error } = await sb
      .from('sessions')
      .select('*')
      .eq('team', team)
      .order('date', { ascending: true })
      .limit(5000));
  }
  if (error) throw error;
  return (data || []).map((s) => ({
    _id: s.id,
    user_id: s.user_id,
    user: s.user_name,
    date: s.date,
    type: s.type,
    duration: SurftoberAwards.minutesToHHMM(s.duration_minutes),
    location: s.location,
    board: s.surf_craft,
    notes: s.notes,
    no_wetsuit: s.no_wetsuit ? 1 : 0,
    costume: s.costume ? 1 : 0,
    taught_kook: s.taught_kook ? 1 : 0,
    water_reading: s.water_reading ? 1 : 0,
    cleanup_items: s.cleanup_items || 0,
    audio_url: s.audio_url || null,
    photo_url: s.photo_url || null,
    start_time: s.start_time || null
  }));
}

async function syncFromCloud(){
  try {
    const cloud = await fetchCloudSessions();
    saveSessions(cloud);
    await loadRoster();
    populateDataLists();
    renderMyStats();
    renderLeaderboard();
    renderAwards();
    renderAccountPledge();
    const st = document.getElementById('status');
    if (st) st.textContent = 'Synced from cloud';
  } catch (e) {
    // ignore
  }
}

async function insertCloud(row){
  if (!currentUser) throw new Error('Please sign in');
  if (!activeEvent) throw new Error('No active event — logging is closed');
  const payload = {
    team: activeEvent.team,
    user_id: currentUser.id,
    user_name: row.user,
    date: row.date,
    type: row.type,
    // Store RAW minutes. The no-wetsuit ×2 is applied at scoring time
    // (normalizeSession) — storing it doubled here made it count 4×.
    duration_minutes: SurftoberAwards.hhmmToMinutes(row.duration),
    location: row.location || null,
    surf_craft: row.board || null,
    notes: row.notes || null,
    no_wetsuit: !!row.no_wetsuit,
    costume: !!row.costume,
    cleanup_items: Number(row.cleanup_items || 0),
    client_entry_id: crypto.randomUUID()
  };
  // The audio_url column exists only after the upgrade SQL has run (the same
  // script that creates the events table). PostgREST rejects the WHOLE insert
  // if the payload names an unknown column — even with a null value — so only
  // attach the key once the upgrade is detected.
  if (eventsTableAvailable) payload.audio_url = row.audio_url || null;
  payload.start_time = row.start_time || null;
  payload.taught_kook = !!row.taught_kook;
  payload.water_reading = !!row.water_reading;
  payload.photo_url = row.photo_url || null;
  let { error } = await sb.from('sessions').insert(payload);
  // Deploy-order safety: PostgREST rejects the whole insert when the payload
  // names a column the deployed schema lacks. Strip the newest columns first
  // and retry, then progressively older ones (photo_url v1.16 → bonus flags
  // v1.14 → start_time v1.7).
  if (error && error.code === 'PGRST204' && 'photo_url' in payload) {
    delete payload.photo_url;
    ({ error } = await sb.from('sessions').insert(payload));
  }
  if (error && error.code === 'PGRST204' && 'taught_kook' in payload) {
    delete payload.taught_kook;
    delete payload.water_reading;
    ({ error } = await sb.from('sessions').insert(payload));
  }
  if (error && error.code === 'PGRST204' && 'start_time' in payload) {
    delete payload.start_time;
    ({ error } = await sb.from('sessions').insert(payload));
  }
  if (error) throw error;
}

function attachAccountHandlers(){
  const emailEl = document.getElementById('auth-email');
  const btnMagic = document.getElementById('btn-magic-link');
  const btnOut = document.getElementById('btn-signout');
  const btnSaveName = document.getElementById('btn-save-name');
  const btnGoogle = document.getElementById('btn-google');
  const btnDeleteCloud = document.getElementById('btn-delete-cloud');
  if (btnMagic) btnMagic.addEventListener('click', async () => {
    try {
      if (!emailEl.value) return alert('Enter an email');
      await signInMagicLink(emailEl.value);
      document.getElementById('account-status').textContent = 'Magic link sent. Check your email.';
    } catch (e) {
      document.getElementById('account-status').textContent = 'Error: ' + e.message;
    }
  });
  if (btnGoogle) btnGoogle.addEventListener('click', async () => {
    try {
      await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    } catch (e) {
      document.getElementById('account-status').textContent = 'Google auth error: ' + e.message;
    }
  });
  if (btnOut) btnOut.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[SIGN OUT] Button clicked, starting sign out...');
    
    try {
      await signOut();
      console.log('[SIGN OUT] Sign out completed');
    } catch (err) {
      console.error('[SIGN OUT] Sign out error:', err);
    }
    
    // Use setTimeout to ensure redirect happens after all async operations
    console.log('[SIGN OUT] Redirecting to landing page...');
    setTimeout(() => {
      window.location.replace('./landing.html');
    }, 100);
  });
  
  // Profile photo: pick from library OR take one with the camera (the hidden
  // capture input opens the front camera directly on phones). Both funnel
  // into the same compress-and-preview path; saved with Save Profile.
  async function handlePhotoFile(file){
    if (!file) return;
    try {
      pendingPhotoBase64 = await compressImageToBase64(file);
      const preview = document.getElementById('profile-photo-preview');
      if (preview) { preview.src = pendingPhotoBase64; preview.style.display = ''; }
      toast('Photo ready — hit Save Profile to keep it', 'success');
    } catch (e) {
      toast('Could not process that image: ' + e.message, 'error');
    }
  }
  const photoInput = document.getElementById('profile-photo');
  if (photoInput) photoInput.addEventListener('change', () => handlePhotoFile(photoInput.files && photoInput.files[0]));
  const cameraInput = document.getElementById('profile-photo-camera');
  if (cameraInput) cameraInput.addEventListener('change', () => handlePhotoFile(cameraInput.files && cameraInput.files[0]));
  const btnTakePhoto = document.getElementById('btn-take-photo');
  if (btnTakePhoto) btnTakePhoto.addEventListener('click', () => { if (cameraInput) cameraInput.click(); });

  // New: Save full profile button
  const btnSaveProfile = document.getElementById('btn-save-profile');
  if (btnSaveProfile) btnSaveProfile.addEventListener('click', async () => {
    try {
      await saveProfile();
      toast('Profile saved successfully', 'success');
      // Re-pull sessions: a rename rewrites user_name on all of them
      // (sync_session_names trigger), so refresh every view from the cloud.
      await syncFromCloud();
    } catch (e) {
      toast('Save profile failed: ' + e.message, 'error');
    }
  });
  // Admin: List users. admin_list_users is a SECURITY DEFINER SQL function
  // with a server-side admin-email gate — non-admins simply get zero rows.
  // (Replaces the list_users edge function that died with the old project.)
  const btnListUsers = document.getElementById('btn-list-users');
  if (btnListUsers) btnListUsers.addEventListener('click', async () => {
    try {
      const { data, error } = await sb.rpc('admin_list_users');
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) {
        document.getElementById('admin-users').innerHTML =
          '<div class="hint">Nothing returned — the SQL gate only answers the admin account (and the admin_list_users function must be deployed).</div>';
        return;
      }
      const html = ['<table><thead><tr><th>Email</th><th>Name</th><th>Sessions</th><th>Registered</th><th>Last sign-in</th></tr></thead><tbody>']
        .concat(rows.map((r) =>
          `<tr><td>${esc(r.email || '')}</td><td>${esc(r.display_name || '')}</td><td>${esc(String(r.session_count ?? ''))}</td><td>${r.registered_at ? esc(fmtDay(String(r.registered_at).slice(0, 10))) : ''}</td><td>${r.last_sign_in_at ? esc(fmtDay(String(r.last_sign_in_at).slice(0, 10))) : ''}</td></tr>`))
        .concat(['</tbody></table>'])
        .join('');
      document.getElementById('admin-users').innerHTML = html;
    } catch (e) {
      toast('List users failed: ' + e.message, 'error');
    }
  });

  if (btnSaveName) btnSaveName.addEventListener('click', async () => {
    try {
      await saveDisplayName();
      await fetchProfile();
      enforceProfileNameOnUI();
      renderMyStats();
      toast('Name saved', 'success');
      document.getElementById('account-status').textContent = 'Name saved';
    } catch (e) {
      toast('Save name failed: ' + e.message, 'error');
      document.getElementById('account-status').textContent = 'Error: ' + e.message;
    }
  });
  if (btnDeleteCloud) btnDeleteCloud.addEventListener('click', async () => {
    if (!currentUser) { toast('Sign in first', 'warn'); return; }
    if (!confirm('Delete ALL your cloud data (sessions + profile)? This cannot be undone.')) return;
    try {
      // Sessions are soft-deleted (tombstoned) so the backups keep them; ask
      // the admin for a true purge if you need one.
      const { error: err1 } = await sb.rpc('soft_delete_all_my_sessions');
      if (err1) throw err1;
      let { error: err2 } = await sb.from('profiles').delete().eq('id', currentUser.id);
      if (err2) throw err2;
      toast('Deleted your cloud data', 'success');
      await signOut();
      // Clear local mirror and UI
      saveSessions([]);
      populateDataLists();
      renderMyStats();
      renderLeaderboard();
      renderAwards();
    } catch (e) {
      toast('Delete failed: ' + e.message, 'error');
    }
  });
}

// Utility: convert Blob to base64 (no prefix)
async function blobToBase64(blob){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || null);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ===== Session audio notes (Supabase Storage, bucket: session-audio) =====

const AUDIO_MAX_BYTES = 10 * 1024 * 1024; // keep in sync with the bucket's file_size_limit
const RECORD_MAX_MS = 5 * 60 * 1000;      // auto-stop: 5 min stays well under the size cap

const AUDIO_EXT_BY_TYPE = {
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a',
  'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav'
};

// Accepts a picked File or a recorded Blob.
async function uploadSessionAudio(fileOrBlob){
  if (!sb || !currentUser) throw new Error('Sign in to attach audio');
  if (fileOrBlob.size > AUDIO_MAX_BYTES) throw new Error('Audio must be under 10 MB');
  const type = (fileOrBlob.type || 'audio/mpeg').split(';')[0]; // strip ";codecs=…" — the bucket matches on bare audio/*
  const nameExt = fileOrBlob.name ? (fileOrBlob.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const ext = nameExt || AUDIO_EXT_BY_TYPE[type] || 'm4a';
  const path = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('session-audio').upload(path, fileOrBlob, {
    contentType: type,
    upsert: false
  });
  if (error) throw new Error('Audio upload failed: ' + error.message);
  const { data } = sb.storage.from('session-audio').getPublicUrl(path);
  return data.publicUrl;
}

// --- In-browser voice recording (device mic via MediaRecorder) ---
let recorder = null;        // active MediaRecorder while recording
let recorderChunks = [];
let recordedBlob = null;    // finished take waiting to be saved with the entry
let recordedUrl = null;     // object URL backing the preview player
let recordTimer = null;
let recordStartedAt = 0;

function recordingSupported(){
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

function pickRecordingMime(){
  // audio/mp4 (AAC) first: Safari records it and every browser plays it back.
  // webm/opus recordings do NOT play on iPhones, so it's the fallback only.
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  for (const c of candidates) {
    try { if (MediaRecorder.isTypeSupported(c)) return c; } catch {}
  }
  return ''; // let the browser pick
}

function fmtRecordTime(ms){
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function setRecordButton(recording){
  const btn = document.getElementById('btn-record-audio');
  if (!btn) return;
  btn.textContent = recording ? '■ Stop' : '🎙 Record';
  btn.classList.toggle('recording', recording);
}

function discardRecording(){
  recordedBlob = null;
  if (recordedUrl) { URL.revokeObjectURL(recordedUrl); recordedUrl = null; }
  const wrap = document.getElementById('audio-preview-wrap');
  if (wrap) wrap.style.display = 'none';
  const player = document.getElementById('audio-preview');
  if (player) player.removeAttribute('src');
}

async function toggleRecording(){
  if (recorder) { recorder.stop(); return; } // onstop finishes up
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickRecordingMime();
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recorderChunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) recorderChunks.push(e.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop()); // release the mic (red indicator off)
      clearInterval(recordTimer); recordTimer = null;
      const timerEl = document.getElementById('record-timer');
      if (timerEl) timerEl.style.display = 'none';
      const type = (recorder.mimeType || mime || 'audio/mp4').split(';')[0];
      recorder = null;
      setRecordButton(false);
      const blob = new Blob(recorderChunks, { type });
      recorderChunks = [];
      if (!blob.size) { toast('Nothing was recorded', 'warn'); return; }
      discardRecording(); // clear any previous take first
      recordedBlob = blob;
      recordedUrl = URL.createObjectURL(blob);
      const player = document.getElementById('audio-preview');
      const wrap = document.getElementById('audio-preview-wrap');
      if (player) player.src = recordedUrl;
      if (wrap) wrap.style.display = '';
      const fileInput = document.getElementById('log-audio');
      if (fileInput) fileInput.value = ''; // fresh recording wins over a picked file
    };
    recorder.start();
    recordStartedAt = Date.now();
    setRecordButton(true);
    const timerEl = document.getElementById('record-timer');
    if (timerEl) { timerEl.textContent = '0:00'; timerEl.style.display = ''; }
    recordTimer = setInterval(() => {
      const elapsed = Date.now() - recordStartedAt;
      const el = document.getElementById('record-timer');
      if (el) el.textContent = fmtRecordTime(elapsed);
      if (elapsed >= RECORD_MAX_MS && recorder) recorder.stop();
    }, 250);
  } catch (e) {
    recorder = null;
    setRecordButton(false);
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
      toast('Microphone access was denied — allow the mic for this site and try again.', 'error');
    } else {
      toast('Could not start recording: ' + (e.message || e.name || e), 'error');
    }
  }
}

function attachAudioHandlers(){
  const btn = document.getElementById('btn-record-audio');
  if (btn) {
    if (recordingSupported()) btn.addEventListener('click', toggleRecording);
    else btn.style.display = 'none'; // ancient browser: file upload still works
  }
  const discard = document.getElementById('btn-discard-audio');
  if (discard) discard.addEventListener('click', (e) => { e.preventDefault(); discardRecording(); });
  const fileInput = document.getElementById('log-audio');
  if (fileInput) fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) discardRecording(); // picked file replaces an old take
  });
}

function audioPathFromUrl(url){
  const m = String(url || '').match(/\/session-audio\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Best-effort cleanup when a session (or its audio) is removed/replaced.
async function deleteSessionAudio(url){
  const path = audioPathFromUrl(url);
  if (!path || !sb || !currentUser) return;
  try { await sb.storage.from('session-audio').remove([path]); } catch {}
}

function audioPlayerHtml(url){
  return url ? `<audio controls preload="none" src="${esc(url)}"></audio>` : '';
}

// ===== Session photos (Supabase Storage, bucket: session-photos) =====
// One photo per session, compressed in the browser before upload. Batch
// photos and videos live in the crew's shared Google Photos album instead
// — storage/egress there is Google's problem. The album link is
// window.CREW_ALBUM_URL, set in version.js (network-first, so editing it
// there goes live without a cache bump).

const PHOTO_MAX_EDGE = 1600;   // long-edge px after compression (~200-400 KB JPEG)
const PHOTO_QUALITY = 0.82;

let pickedPhotoBlob = null; // compressed image waiting to be saved with the entry
let pickedPhotoUrl = null;  // object URL backing the preview <img>

// Camera-roll originals are 3-8 MB (and HEIC on iPhones — Safari hands the
// file input a decodable image). Canvas re-encode caps the long edge and
// strips EXIF, including the GPS position of someone's house.
async function compressSessionPhoto(file){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('could not read that image'));
      i.src = url;
    });
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY));
    if (!blob) throw new Error('could not process that image');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function uploadSessionPhoto(blob){
  if (!sb || !currentUser) throw new Error('Sign in to attach photos');
  const path = `${currentUser.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from('session-photos').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false
  });
  if (error) throw new Error('Photo upload failed: ' + error.message);
  const { data } = sb.storage.from('session-photos').getPublicUrl(path);
  return data.publicUrl;
}

function photoPathFromUrl(url){
  const m = String(url || '').match(/\/session-photos\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Best-effort cleanup when a session photo is removed or replaced.
async function deleteSessionPhoto(url){
  const path = photoPathFromUrl(url);
  if (!path || !sb || !currentUser) return;
  try { await sb.storage.from('session-photos').remove([path]); } catch {}
}

// Thumbnail that opens the full-size image in a new tab. lazy-loading keeps
// a long session list from pulling every photo on page load (public bucket
// egress is metered).
function photoThumbHtml(url, cls = 'session-photo-thumb'){
  if (!url) return '';
  return `<a href="${esc(url)}" target="_blank" rel="noopener"><img class="${cls}" loading="lazy" src="${esc(url)}" alt="Session photo" /></a>`;
}

function discardPickedPhoto(){
  pickedPhotoBlob = null;
  if (pickedPhotoUrl) { URL.revokeObjectURL(pickedPhotoUrl); pickedPhotoUrl = null; }
  const wrap = document.getElementById('photo-preview-wrap');
  if (wrap) wrap.style.display = 'none';
  const img = document.getElementById('photo-preview');
  if (img) img.removeAttribute('src');
  setPickPhotoLabel();
}

// The picker button reads "Replace" whenever a photo is staged or the
// session being edited already has one.
function setPickPhotoLabel(){
  const btn = document.getElementById('btn-pick-photo');
  if (btn) btn.textContent = (pickedPhotoBlob || editingPhotoUrl) ? '📷 Replace Photo' : '📷 Add Photo';
}

function attachPhotoHandlers(){
  const input = document.getElementById('log-photo');
  // The native file input is hidden — the styled 📷 button (a sibling of
  // the audio field's 🎙 one) proxies clicks to it.
  const pick = document.getElementById('btn-pick-photo');
  if (pick && input) pick.addEventListener('click', () => input.click());
  if (input) input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const blob = await compressSessionPhoto(file);
      discardPickedPhoto();
      pickedPhotoBlob = blob;
      pickedPhotoUrl = URL.createObjectURL(blob);
      const img = document.getElementById('photo-preview');
      const wrap = document.getElementById('photo-preview-wrap');
      if (img) img.src = pickedPhotoUrl;
      if (wrap) wrap.style.display = '';
      setPickPhotoLabel();
    } catch (e) {
      input.value = '';
      toast('Could not read that photo: ' + (e.message || e), 'error');
    }
  });
  const discard = document.getElementById('btn-discard-photo');
  if (discard) discard.addEventListener('click', (e) => {
    e.preventDefault();
    if (input) input.value = '';
    discardPickedPhoto();
  });
  // Crew album entry points (header 📷 + log-form hint) appear only once
  // the shared-album link is configured (in version.js).
  const albumUrl = window.CREW_ALBUM_URL || '';
  if (albumUrl) {
    const headerLink = document.getElementById('album-link');
    if (headerLink) { headerLink.href = albumUrl; headerLink.style.display = ''; }
    const formHint = document.getElementById('log-photo-album-hint');
    if (formHint) {
      const a = formHint.querySelector('a');
      if (a) a.href = albumUrl;
      formHint.style.display = '';
    }
  }
}

// ===== Post-submit celebration → land on My Sessions =====

const STOKE_LINES = ['Session logged! 🤙', 'Stoke +1 🏄', 'Wave count rising 🌊', 'Logged. Go dry off 🧖'];

function celebrateAndGoToSessions(){
  const goToMySessions = () => {
    sessionsView = 'mine';
    location.hash = '#me';
    renderMyStats();
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { goToMySessions(); return; }
  const el = document.createElement('div');
  el.className = 'celebrate';
  el.innerHTML = `<div class="celebrate-inner">${STOKE_LINES[Math.floor(Math.random() * STOKE_LINES.length)]}</div>`;
  document.body.appendChild(el);
  setTimeout(() => { el.remove(); goToMySessions(); }, 1100);
}

// ===== Journal clamping (long entries collapse to 4 lines) =====

function journalHtml(text){
  return text ? `<div class="journal-text">${esc(text)}</div>` : '';
}

// Adds a Show more/less toggle to any clamped journal that actually overflows.
// Skips journals inside hidden pages (they measure as 0) and retries when the
// page becomes visible — renderTabs calls this on every tab switch.
function attachJournalToggles(){
  document.querySelectorAll('.journal-text:not([data-wired])').forEach((el) => {
    if (!el.offsetParent) return; // hidden — measure on next tab switch
    el.dataset.wired = '1';
    if (el.scrollHeight <= el.clientHeight + 2) return; // fits in the clamp
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'journal-more';
    a.textContent = 'Show more';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const expanded = el.classList.toggle('expanded');
      a.textContent = expanded ? 'Show less' : 'Show more';
    });
    el.after(a);
  });
}

// In production, replace with Supabase/Next.js API.

const LS_KEY = 'surftober.sessions.v1';

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveSessions(rows) {
  localStorage.setItem(LS_KEY, JSON.stringify(rows));
}

function appendSession(row) {
  const all = loadSessions();
  all.push(SurftoberAwards.normalizeSession(row));
  saveSessions(all);
}

function toCSV(rows) {
  const header = ['user', 'date', 'start_time', 'type', 'duration', 'location', 'board', 'notes', 'no_wetsuit', 'costume', 'taught_kook', 'water_reading', 'cleanup_items', 'audio_url', 'photo_url'];
  const quote = (v) => '"' + String(v || '').replace(/"/g, '""') + '"';
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.user, r.date, r.start_time || '', r.type, r.duration, r.location, r.board, r.notes, r.no_wetsuit ? 1 : 0, r.costume ? 1 : 0, r.taught_kook ? 1 : 0, r.water_reading ? 1 : 0, r.cleanup_items || 0, r.audio_url || '', r.photo_url || ''].map(quote).join(','));
  }
  return lines.join('\n');
}

// Proper CSV parser: honors quoted fields, "" escapes, and embedded newlines.
// The old split-on-newline + regex tokenizer could not re-import its own
// export once a note contained a quote or a line break.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

function renderTabs() {
  const hash = location.hash.replace('#', '') || 'log';
  const el = document.getElementById('page-' + hash);
  // Hidden pages (admin-only, or Log/Account in viewer mode) use inline
  // display:none, which overrides the .active class — bounce to Log, or to
  // the Leaderboard when Log itself is hidden (viewer), not a blank page.
  if (el && el.style.display === 'none') {
    const log = document.getElementById('page-log');
    location.hash = log && log.style.display === 'none' ? '#leaderboard' : '#log';
    return;
  }
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.remove('active'));
  // Awards/Admin live under Account now — keep that tab lit while on them
  const tabKey = hash === 'awards' || hash === 'admin' ? 'account' : hash;
  const tab = document.querySelector(`.tabs a[data-tab="${tabKey}"]`);
  if (el) el.classList.add('active');
  if (tab) tab.classList.add('active');
  // Journals rendered while this page was hidden couldn't be measured for the
  // Show-more toggle — retry now that it's visible.
  attachJournalToggles();
}

function initForm() {
  const f = document.getElementById('log-form');
  document.getElementById('log-date').value = defaultLogDate();

  // What counts for each session type — shown as a hint under the select
  const TYPE_HINTS = {
    surf: 'Surf, boogie, paddleboard, kayak, bodysurf',
    windsport: 'Windsurfing, kitesurfing, wing foiling',
    swim: 'Open water swim, dipping, in-water photography',
    other: 'Any other open water (ocean, river, lake) activity! Including kayaking, stand up paddle, etc…',
    cleanup: 'Beach trash pickup — a one-time +1 hour bonus',
    water: 'Water sampling with the SF Blue Water Task Force — a one-time +1 hour bonus'
  };

  function updateBonusSummary(){
    const parts = [];
    if (document.getElementById('log-no-wetsuit').checked) parts.push('No Wetsuit ×2');
    if (document.getElementById('log-costume').checked) parts.push('Costume +1h');
    if (document.getElementById('log-kook').checked) parts.push('Teach a Kook +1h');
    if (document.getElementById('log-water').checked) parts.push('Water Reading');
    if (document.getElementById('log-cleanup').checked) parts.push('Beach Cleanup');
    document.getElementById('bonus-summary').textContent = parts.length ? parts.join(' · ') : 'None';
  }

  // Session types whose bonus box drives the type (and vice versa). Both are
  // fixed +1h sessions: duration locks at 1:00 and no other bonus can stack.
  const FIXED_TYPE_BOX = { cleanup: 'log-cleanup', water: 'log-water' };
  const ALL_BONUS_BOXES = ['log-no-wetsuit', 'log-costume', 'log-kook', 'log-water', 'log-cleanup'];

  function applyTypeUI() {
    const type = document.getElementById('log-type').value;
    const isFixed = type in FIXED_TYPE_BOX;
    const h = document.getElementById('log-duration-h');
    const m = document.getElementById('log-duration-m');
    // Every bonus box except the one belonging to this type (that one stays
    // enabled so unchecking it reverts the type); surf craft and location
    // stay editable for every type.
    const otherBonuses = ALL_BONUS_BOXES
      .filter((id) => id !== FIXED_TYPE_BOX[type])
      .map((id) => document.getElementById(id));
    if (isFixed) {
      h.value = 1;
      m.value = 0;
      otherBonuses.forEach((el) => { el.checked = false; });
    }
    h.disabled = isFixed;
    m.disabled = isFixed;
    otherBonuses.forEach((el) => { el.disabled = isFixed; });
    // Mirror the type into its own bonus box, both ways. The own box is
    // always re-enabled (it may have been disabled by another fixed type or
    // the once-per-event guard) so unchecking it can revert the type; a
    // duplicate water reading is rejected at submit instead.
    if (isFixed) document.getElementById(FIXED_TYPE_BOX[type]).disabled = false;
    document.getElementById('log-cleanup').checked = type === 'cleanup';
    document.getElementById('log-water').checked = type === 'water';
    const hint = document.getElementById('log-type-hint');
    if (hint) hint.textContent = TYPE_HINTS[type] || '';
    updateBonusSummary();
  }

  // Once-per-event bonuses: costume, teach-a-kook, water-quality reading.
  // Each checkbox locks once that user has already claimed it this event.
  const ONE_TIME_BONUSES = [
    { id: 'log-costume', key: 'costume', label: 'Costume' },
    { id: 'log-kook', key: 'taught_kook', label: 'Teach a Kook' },
    { id: 'log-water', key: 'water_reading', label: 'Water reading' }
  ];

  function applyCostumeGuard() {
    const type = document.getElementById('log-type').value;
    if (type in FIXED_TYPE_BOX) return; // applyTypeUI already disabled the boxes
    const user = document.getElementById('log-user').value.trim();
    const dateStr = document.getElementById('log-date').value;
    for (const b of ONE_TIME_BONUSES) {
      const el = document.getElementById(b.id);
      if (!user || !dateStr) { el.disabled = false; continue; }
      if (bonusUsedForPeriod(user, dateStr, b.key)) {
        el.checked = false;
        el.disabled = true;
        el.title = `${b.label} bonus already used this event`;
      } else {
        el.disabled = false;
        el.title = '';
      }
    }
    updateBonusSummary(); // guard may have just unchecked a claimed bonus
  }

  function bonusUsedForPeriod(user, dateStr, key) {
    // One bonus per event window. Ignores the session being edited so
    // editing your own bonus session doesn't strip the flag.
    try {
      const ev = activeEvent || viewedEvent || DEFAULT_EVENT;
      const all = loadSessions();
      return all.some(
        (s) =>
          (s.user || '').trim() === user.trim() &&
          (!editingId || s._id !== editingId) &&
          SurftoberAwards.inRange(s.date, { start: ev.start_date, end: ev.end_date }) &&
          (s[key] === 1 || s[key] === true || String(s[key]) === '1')
      );
    } catch {
      return false;
    }
  }

  document.getElementById('log-type').addEventListener('change', () => {
    applyTypeUI();
    applyCostumeGuard();
  });
  document.getElementById('log-user').addEventListener('input', applyCostumeGuard);
  document.getElementById('log-date').addEventListener('change', applyCostumeGuard);

  // Bonuses dropdown: summary text mirrors the checked boxes; the Beach
  // Cleanup and Water Quality Reading entries drive the session type (and
  // applyTypeUI mirrors the type back into the box, so the two stay in sync
  // from either direction).
  const bonusDd = document.getElementById('bonus-dd');
  ['log-no-wetsuit', 'log-costume', 'log-kook'].forEach((id) =>
    document.getElementById(id).addEventListener('change', updateBonusSummary));
  for (const [typeValue, boxId] of Object.entries(FIXED_TYPE_BOX)) {
    const box = document.getElementById(boxId);
    box.addEventListener('change', () => {
      const typeEl = document.getElementById('log-type');
      if (box.checked) typeEl.value = typeValue;
      else if (typeEl.value === typeValue) typeEl.value = 'surf';
      typeEl.dispatchEvent(new Event('change'));
      updateBonusSummary();
    });
  }
  document.addEventListener('click', (e) => {
    if (bonusDd && bonusDd.open && !bonusDd.contains(e.target)) bonusDd.removeAttribute('open');
  });

  applyTypeUI();
  applyCostumeGuard();

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Enforce display name when signed in (no special format required)
    if (sb && currentUser && !profileName) {
      toast('Please set your display name in Account before logging.', 'warn');
      location.hash = '#account';
      return;
    }
    const logType = document.getElementById('log-type').value;
    const isCleanup = logType === 'cleanup';
    const isWater = logType === 'water';
    const isFixed = isCleanup || isWater; // fixed 1h session, no stacked bonuses
    const row = {
      user: document.getElementById('log-user').value.trim(),
      date: document.getElementById('log-date').value,
      start_time: document.getElementById('log-start-time').value || null,
      type: logType,
      duration: isFixed
        ? '01:00'
        : `${String(Number(document.getElementById('log-duration-h').value || 0)).padStart(2, '0')}:${String(
            Number(document.getElementById('log-duration-m').value || 0)
          ).padStart(2, '0')}`,
      location: document.getElementById('log-location').value,
      board: document.getElementById('log-board').value,
      notes: document.getElementById('log-notes').value,
      no_wetsuit: isFixed ? 0 : document.getElementById('log-no-wetsuit').checked ? 1 : 0,
      costume: isFixed ? 0 : document.getElementById('log-costume').checked ? 1 : 0,
      taught_kook: isFixed ? 0 : document.getElementById('log-kook').checked ? 1 : 0,
      // The water flag marks the one water-reading session per event; its
      // +1h is the locked session hour itself (no extra rollup bonus).
      water_reading: isWater ? 1 : 0,
      cleanup_items: isCleanup ? 1 : 0
    };
    if (!row.user || !row.date || !row.duration) {
      alert('Please fill required fields');
      return;
    }
    if (isWater && bonusUsedForPeriod(row.user, row.date, 'water_reading')) {
      toast('Water Quality Reading already claimed this event — it\'s a one-time bonus.', 'warn');
      return;
    }
    if (!activeEvent) {
      toast('No active event — logging is closed.', 'warn');
      return;
    }
    if (activeEvent.logging_frozen) {
      toast(`Logging for ${activeEvent.name} is frozen — the board is final.`, 'warn');
      return;
    }
    if (needsReRegistration()) {
      toast(`Re-register for ${activeEvent.name} first — your profile carries over (see the banner up top).`, 'warn');
      return;
    }
    if (todayStr() < activeEvent.start_date) {
      toast(`${activeEvent.name} starts ${fmtDay(activeEvent.start_date)} — logging opens then.`, 'warn');
      return;
    }
    if (row.date < activeEvent.start_date || row.date > activeEvent.end_date) {
      toast(`Sessions must be dated inside ${activeEvent.name} (${fmtDay(activeEvent.start_date)} – ${fmtDay(activeEvent.end_date)})`, 'warn');
      return;
    }
    if (recorder) {
      toast('Stop the audio recording first.', 'warn');
      return;
    }
    const audioInput = document.getElementById('log-audio');
    const audioRemove = document.getElementById('log-audio-remove');
    // A fresh recording wins; otherwise a picked file.
    const audioSource = recordedBlob || (audioInput && audioInput.files && audioInput.files[0]) || null;
    const previousAudioUrl = editingAudioUrl;
    const photoRemove = document.getElementById('log-photo-remove');
    const previousPhotoUrl = editingPhotoUrl;
    try {
      // Audio note: keep the existing one unless removed or replaced
      let audioUrl = editingAudioUrl;
      if (audioRemove && audioRemove.checked) audioUrl = null;
      if (audioSource) {
        if (sb && currentUser) {
          audioUrl = await uploadSessionAudio(audioSource);
        } else {
          toast('Audio notes need a signed-in account — entry saved without audio.', 'warn');
        }
      }
      row.audio_url = audioUrl || null;

      // Photo: same keep-unless-removed-or-replaced dance
      let photoUrl = editingPhotoUrl;
      if (photoRemove && photoRemove.checked) photoUrl = null;
      if (pickedPhotoBlob) {
        if (sb && currentUser) {
          photoUrl = await uploadSessionPhoto(pickedPhotoBlob);
        } else {
          toast('Photos need a signed-in account — entry saved without the photo.', 'warn');
        }
      }
      row.photo_url = photoUrl || null;

      if (editingId && sb && currentUser) {
        await updateCloudSession(editingId, row);
        if (previousAudioUrl && previousAudioUrl !== row.audio_url) deleteSessionAudio(previousAudioUrl);
        if (previousPhotoUrl && previousPhotoUrl !== row.photo_url) deleteSessionPhoto(previousPhotoUrl);
        toast('Session updated', 'success');
        resetEditState();
        await syncFromCloud();
      } else {
        if (sb && currentUser) await insertCloud(row);
        appendSession(row);
        celebrateAndGoToSessions(); // its splash IS the success feedback
      }
      const st = document.getElementById('status');
      if (st) st.textContent = 'Saved entry for ' + row.user + ' on ' + row.date + (currentUser ? ' (cloud + local)' : ' (local)');
      renderMyStats();
      renderLeaderboard();
      f.reset();
      resetAudioField();
      resetPhotoField();
      document.getElementById('log-date').value = defaultLogDate();
      // Restore the display name after reset
      enforceProfileNameOnUI();
      // form.reset() restores values but not disabled/hidden state — without
      // this, logging a cleanup leaves the duration inputs disabled for the
      // next entry, which then silently saves as 01:00.
      applyTypeUI();
      applyCostumeGuard();
    } catch (e) {
      const st = document.getElementById('status');
      if (st) st.textContent = 'Save failed: ' + e.message;
      toast('Save failed: ' + e.message, 'error');
    }
  });
  // Cancel edit
  const btnCancel = document.getElementById('btn-cancel-edit');
  if (btnCancel) btnCancel.addEventListener('click', () => {
    resetEditState();
    f.reset();
    resetAudioField();
    resetPhotoField();
    document.getElementById('log-date').value = defaultLogDate();
    enforceProfileNameOnUI();
    applyTypeUI();
    applyCostumeGuard();
  });
  // Delete (soft) — offered inside edit mode instead of on the session lists
  const btnDelete = document.getElementById('btn-delete-session');
  if (btnDelete) btnDelete.addEventListener('click', async () => {
    if (!editingId || !sb || !currentUser) return;
    if (activeEvent && activeEvent.logging_frozen) {
      toast(`Logging for ${activeEvent.name} is frozen — sessions can't be deleted.`, 'warn');
      return;
    }
    if (!confirm('Delete this session? (The admin can restore it if needed.)')) return;
    try {
      await deleteCloudSession(editingId);
      toast('Session deleted', 'success');
      resetEditState();
      f.reset();
      resetAudioField();
      resetPhotoField();
      document.getElementById('log-date').value = defaultLogDate();
      enforceProfileNameOnUI();
      applyTypeUI();
      applyCostumeGuard();
      await syncFromCloud();
    } catch (e) {
      toast('Delete failed: ' + e.message, 'error');
    }
  });
}

// Editing state and helpers (top-level)
let editingId = null; // UUID of session being edited (cloud), null when not editing
let editingAudioUrl = null; // existing audio note of the session being edited
let editingPhotoUrl = null; // existing photo of the session being edited

// Make edit mode unmistakable: title flips to "Editing Session", the action
// buttons jump up next to it, and the form gets an accent outline.
function setEditModeUI(editing){
  const title = document.getElementById('log-title');
  if (title) title.textContent = editing ? 'Editing Session' : 'Quick Log';
  const form = document.getElementById('log-form');
  if (form) form.classList.toggle('editing', editing);
  const actions = document.getElementById('log-actions');
  const headSlot = document.getElementById('log-head-actions');
  const home = document.getElementById('log-actions-home');
  if (actions && headSlot && home) (editing ? headSlot : home).appendChild(actions);
  // Delete lives in the edit view (cloud sessions only), not on the lists
  const del = document.getElementById('btn-delete-session');
  if (del) del.style.display = editing && editingId && sb && currentUser ? '' : 'none';
}

function resetEditState(){
  editingId = null;
  editingAudioUrl = null;
  editingPhotoUrl = null;
  document.getElementById('btn-submit').textContent = 'Add Entry';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  setEditModeUI(false);
}

function resetAudioField(){
  const input = document.getElementById('log-audio');
  if (input) input.value = '';
  const remove = document.getElementById('log-audio-remove');
  if (remove) remove.checked = false;
  const hint = document.getElementById('log-audio-hint');
  if (hint) hint.style.display = 'none';
  discardRecording();
}

function resetPhotoField(){
  const input = document.getElementById('log-photo');
  if (input) input.value = '';
  const remove = document.getElementById('log-photo-remove');
  if (remove) remove.checked = false;
  const hint = document.getElementById('log-photo-hint');
  if (hint) hint.style.display = 'none';
  discardPickedPhoto();
}

function startEditSession(session){
  // Prefill form with session values, lock user field (already enforced), toggle submit button label
  document.getElementById('log-date').value = session.date;
  document.getElementById('log-start-time').value = session.start_time ? String(session.start_time).slice(0, 5) : '';
  document.getElementById('log-type').value = session.type;
  const [h,m] = session.duration.split(':').map(x=>Number(x));
  document.getElementById('log-duration-h').value = h;
  document.getElementById('log-duration-m').value = m;
  document.getElementById('log-location').value = session.location||'';
  document.getElementById('log-board').value = session.board||'';
  document.getElementById('log-notes').value = session.notes||'';
  document.getElementById('log-no-wetsuit').checked = !!session.no_wetsuit;
  document.getElementById('log-costume').checked = !!session.costume;
  document.getElementById('log-kook').checked = !!session.taught_kook;
  // (log-cleanup / log-water mirror the type via applyTypeUI on the
  // change dispatch below)
  document.getElementById('btn-submit').textContent = 'Update Entry';
  document.getElementById('btn-cancel-edit').style.display = '';
  editingId = session._id || null; // we'll attach _id when rendering from cloud
  editingAudioUrl = session.audio_url || null;
  editingPhotoUrl = session.photo_url || null;
  setEditModeUI(true); // after editingId is set — the Delete button needs it
  resetAudioFieldForEdit();
  resetPhotoFieldForEdit();
  // Re-apply type-dependent UI (cleanup locks duration, hint text, bonus summary)
  document.getElementById('log-type').dispatchEvent(new Event('change'));
  // Arriving from a scrolled session list: put the edit form in view
  window.scrollTo(0, 0);
}

function resetAudioFieldForEdit(){
  const input = document.getElementById('log-audio');
  if (input) input.value = '';
  const remove = document.getElementById('log-audio-remove');
  if (remove) remove.checked = false;
  const hint = document.getElementById('log-audio-hint');
  if (hint) hint.style.display = editingAudioUrl ? '' : 'none';
  discardRecording();
}

function resetPhotoFieldForEdit(){
  const input = document.getElementById('log-photo');
  if (input) input.value = '';
  const remove = document.getElementById('log-photo-remove');
  if (remove) remove.checked = false;
  const hint = document.getElementById('log-photo-hint');
  if (hint) hint.style.display = editingPhotoUrl ? '' : 'none';
  discardPickedPhoto();
}

async function updateCloudSession(id, row){
  // Owner-scoped explicitly. Without .eq('user_id', …), RLS silently matches 0
  // rows for someone else's session and the app toasts a phantom success.
  const payload = {
    date: row.date,
    type: row.type,
    duration_minutes: SurftoberAwards.hhmmToMinutes(row.duration), // raw — see insertCloud
    location: row.location || null,
    surf_craft: row.board || null,
    notes: row.notes || null,
    no_wetsuit: !!row.no_wetsuit,
    costume: !!row.costume,
    cleanup_items: Number(row.cleanup_items||0),
    user_name: profileName || row.user,
  };
  if (eventsTableAvailable) payload.audio_url = row.audio_url || null; // see insertCloud
  payload.start_time = row.start_time || null;
  payload.taught_kook = !!row.taught_kook;
  payload.water_reading = !!row.water_reading;
  payload.photo_url = row.photo_url || null;
  let { data, error } = await sb.from('sessions').update(payload).eq('id', id).eq('user_id', currentUser.id).select('id');
  if (error && error.code === 'PGRST204' && 'photo_url' in payload) {
    delete payload.photo_url; // column not there yet — see insertCloud
    ({ data, error } = await sb.from('sessions').update(payload).eq('id', id).eq('user_id', currentUser.id).select('id'));
  }
  if (error && error.code === 'PGRST204' && 'taught_kook' in payload) {
    delete payload.taught_kook; // columns not there yet — see insertCloud
    delete payload.water_reading;
    ({ data, error } = await sb.from('sessions').update(payload).eq('id', id).eq('user_id', currentUser.id).select('id'));
  }
  if (error && error.code === 'PGRST204' && 'start_time' in payload) {
    delete payload.start_time; // column not there yet — see insertCloud
    ({ data, error } = await sb.from('sessions').update(payload).eq('id', id).eq('user_id', currentUser.id).select('id'));
  }
  if (error) throw error;
  if (!data || !data.length) throw new Error('Session not found or not yours');
}

async function deleteCloudSession(id){
  // Soft delete: the RPC stamps deleted_at instead of removing the row, so
  // backups keep it and the admin can restore it (clear deleted_at in the
  // dashboard). Ownership is enforced inside the function.
  const { data, error } = await sb.rpc('soft_delete_session', { p_id: id });
  if (error) throw error;
  if (!data) throw new Error('Session not found or not yours');
}

// (Recent Entries removed from the Log page — the Sessions tab's tile view
// replaced it in v1.7.0)

// Sessions page state: your own sessions, or one other surfer's page
let sessionsView = 'mine';   // 'mine' | 'others'
let otherUserSelected = '';
let sessionsLayout = localStorage.getItem('surftober.sessionsLayout') || 'list'; // 'list' | 'tiles'

// Display names for the session-type values stored in the DB.
const TYPE_LABELS = {
  surf: 'Surf',
  windsport: 'Windsport',
  swim: 'Swim',
  other: 'Other',
  cleanup: 'Beach Cleanup',
  water: 'Water Reading'
};
const typeLabel = (t) => TYPE_LABELS[t] || t || '';

function renderMyStats() {
  const ev = viewedEvent || DEFAULT_EVENT;
  const range = { start: ev.start_date, end: ev.end_date };
  const normalized = loadSessions().map(SurftoberAwards.normalizeSession);

  // Sub-tab chrome
  const mineBtn = document.getElementById('subtab-mine');
  const othersBtn = document.getElementById('subtab-others');
  if (mineBtn) mineBtn.classList.toggle('active', sessionsView === 'mine');
  if (othersBtn) othersBtn.classList.toggle('active', sessionsView === 'others');
  const listBtn = document.getElementById('view-list');
  const tilesBtn = document.getElementById('view-tiles');
  if (listBtn) listBtn.classList.toggle('active', sessionsLayout === 'list');
  if (tilesBtn) tilesBtn.classList.toggle('active', sessionsLayout === 'tiles');
  const otherWrap = document.getElementById('other-user-wrap');
  if (otherWrap) otherWrap.style.display = sessionsView === 'others' ? '' : 'none';

  // Resolve whose page we're showing
  let user;
  if (sessionsView === 'others') {
    // Sessions in this event ∪ the registration roster — registrants show
    // up in the picker before their first log. The roster is season-agnostic
    // (one profile per person), so it only augments the ACTIVE event; an
    // archived event's picker stays limited to people who actually surfed it.
    const sessionNames = normalized
      .filter((s) => SurftoberAwards.inRange(s.date, range))
      .map((s) => (s.user || '').trim());
    const rosterNames = isViewingActiveEvent()
      ? roster.map((p) => String(p.display_name || '').trim())
      : [];
    const names = Array.from(new Set([...sessionNames, ...rosterNames]))
      .filter((n) => n && n !== profileName)
      .sort((a, b) => a.localeCompare(b));
    const select = document.getElementById('other-user-select');
    if (select) {
      if (!names.includes(otherUserSelected)) otherUserSelected = names[0] || '';
      select.innerHTML = names.map((n) => `<option value="${esc(n)}"${n === otherUserSelected ? ' selected' : ''}>${esc(n)}</option>`).join('');
    }
    user = otherUserSelected;
  } else {
    user = profileName || '';
  }

  if (!user) {
    const hint = sessionsView === 'mine'
      ? (currentUser
          ? 'Set your display name in Account to see your sessions.'
          : 'Sign in to see your sessions — or browse Other Surfers.')
      : 'No other surfers have registered yet.';
    document.getElementById('me-summary').innerHTML = `<div class="hint">${hint}</div>`;
    document.getElementById('me-sessions').innerHTML = '';
    return;
  }

  const mine = normalized.filter((s) => s.user === user);
  let totals = SurftoberAwards.rollupByUser(mine, range);
  if (!totals.length) {
    // Registered but nothing logged this event — show the profile card at
    // 0 hours instead of a blank page.
    totals = [{ user, total_hours: 0, total_minutes: 0, medal: 'OBSERVER' }];
  }

  // Whose page is this? Own photo/goal come straight from profileData;
  // other surfers' from the public_profiles view (photo + target hours).
  // Zero-session surfers have no session rows to read user_id from, so
  // fall back to the roster.
  const rosterEntry = roster.find((p) => String(p.display_name || '').trim() === user);
  const pageUserId = sessionsView === 'mine'
    ? (currentUser && currentUser.id)
    : ((mine[0] && mine[0].user_id) || (rosterEntry && rosterEntry.id));
  let pageProfile = null;
  if (sessionsView === 'mine') {
    if (profileData) pageProfile = { photo_base64: profileData.photo_base64, target_hours: profileData.target_hours, fun_comment: profileData.fun_comment };
  } else if (pageUserId) {
    if (publicProfileCache.has(pageUserId)) {
      pageProfile = publicProfileCache.get(pageUserId);
    } else {
      fetchPublicProfile(pageUserId).then(() => renderMyStats()); // one re-render when it lands
    }
  }

  const summary = document.getElementById('me-summary');
  summary.innerHTML =
    totals
      .map(
        (t) => {
          // On-track pace across the viewed event's window
          const evStart = SurftoberAwards.localDate(ev.start_date);
          const evEnd = SurftoberAwards.localDate(ev.end_date);
          const totalDays = Math.round((evEnd - evStart) / 86400000) + 1;
          const daysElapsed = Math.min(totalDays, Math.max(0, Math.floor((new Date() - evStart) / 86400000) + 1));

          // Goal hours: yours or theirs (via public_profiles)
          const goalHours = pageProfile && pageProfile.target_hours ? Number(pageProfile.target_hours) : null;

          const onTrackHours = goalHours ? (daysElapsed / totalDays) * goalHours : null;
          const progressPercent = goalHours ? (t.total_hours / goalHours * 100) : null;

          // Determine goal medal badge (same thresholds as earned medals)
          let goalMedalBadge = '';
          if (goalHours) {
            let goalMedal = 'PARTICIPANT';
            if (goalHours >= 50) goalMedal = 'PLATINUM';
            else if (goalHours >= 40) goalMedal = 'GOLD';
            else if (goalHours >= 30) goalMedal = 'SILVER';
            else if (goalHours >= 25) goalMedal = 'BRONZE';
            goalMedalBadge = `<span class="badge ${goalMedal.toLowerCase()}">${goalMedal}</span>`;
          }

          const av = avatarSrc(pageProfile && pageProfile.photo_base64);
          const funComment = pageProfile && pageProfile.fun_comment ? String(pageProfile.fun_comment).trim() : '';
          // No badge under 10h (OBSERVER stays internal-only)
          const medalBadge = t.medal === 'OBSERVER' ? '' : `<span class="badge ${t.medal.toLowerCase()}">${t.medal}</span>`;
          let content = `<div class="card"><div class="profile-head">${av ? `<img class="avatar" src="${esc(av)}" alt="" />` : ''}<h3>${esc(t.user)}</h3></div>`;
          if (funComment) content += `<div class="fun-comment">“${esc(funComment)}”</div>`;

          if (goalHours) {
            const statusColor = t.total_hours >= onTrackHours ? 'var(--ok)' : 'var(--warn)'; // theme-aware
            content += `
              <div>Current Hours: <strong>${t.total_hours.toFixed(1)}</strong> ${medalBadge}</div>
              <div>On-Track Hours: <strong style="color:${statusColor}">${onTrackHours.toFixed(1)}</strong></div>
              <div>Goal Hours: <strong>${goalHours}</strong> ${goalMedalBadge}</div>
              <div>Progress: <strong>${progressPercent.toFixed(0)}%</strong> ${progressPercent >= 100 ? '🎉' : ''}</div>
            `;
          } else {
            content += `<div>Total Hours: <strong>${t.total_hours.toFixed(1)}</strong> ${medalBadge}</div>`;
          }

          content += `</div>`;
          return content;
        }
      )
      .join('') || '<div class="hint">No data</div>';

  // Table of sessions (scoped to the viewed event), newest first — the
  // session you just logged should greet you at the top.
  const sessions = mine
    .filter((s) => SurftoberAwards.inRange(s.date, range))
    .sort((a, b) => String(b.date + (b.start_time || '')).localeCompare(String(a.date + (a.start_time || ''))));
  // Determine which session gets each one-time +1h bonus (costume, teach a
  // kook) — PER USER (the name filter can be blank, showing everyone's
  // sessions at once). Earliest flagged session wins, matching the rollup's
  // once-per-event scoring. Water readings are their own 1h session type,
  // badged below like cleanup.
  const ONE_TIME_FLAGS = [
    { key: 'costume', badge: 'Costume +1h' },
    { key: 'taught_kook', badge: 'Teach a Kook +1h' }
  ];
  const bonusIdxByUser = new Map(ONE_TIME_FLAGS.map((f) => [f.key, new Map()]));
  for (const f of ONE_TIME_FLAGS) {
    const earliest = new Map();
    const idx = bonusIdxByUser.get(f.key);
    sessions.forEach((s, i) => {
      if (!s[f.key]) return;
      const u = (s.user || '').trim();
      const ts = SurftoberAwards.localDate(s.date).getTime();
      if (!earliest.has(u) || ts < earliest.get(u)) {
        earliest.set(u, ts);
        idx.set(u, i);
      }
    });
  }
  const isTiles = sessionsLayout === 'tiles';
  const out = [];
  if (!isTiles) {
    out.push(`<table><thead><tr><th></th><th>Date</th><th>Type</th><th>Scored</th><th>Bonuses</th><th>Location</th><th>Surf craft</th><th class="journal-cell">Journal</th><th>Media</th></tr></thead><tbody>`);
  }
  sessions.forEach((s, i) => {
    const u = (s.user || '').trim();
    const appliedFlags = ONE_TIME_FLAGS.filter((f) => bonusIdxByUser.get(f.key).get(u) === i);
    const scoredMins = s.base_minutes + appliedFlags.length * 60;
    const bonusBadges = [
      s.no_wetsuit ? '<span class="badge">No Wetsuit ×2</span>' : '',
      ...appliedFlags.map((f) => `<span class="badge">${f.badge}</span>`),
      s.type === 'cleanup' ? '<span class="badge">Cleanup</span>' : '',
      s.type === 'water' ? '<span class="badge">Water Reading</span>' : ''
    ]
      .filter(Boolean)
      .join(' ');
    const canEdit = !!currentUser && s._id && s.user_id === currentUser.id && isViewingActiveEvent() &&
      !(activeEvent && activeEvent.logging_frozen);
    const editLink = canEdit ? `<a href="#" class="edit-link" data-id="${esc(s._id)}">Edit</a>` : '';
    const when = `${fmtDay(s.date)}${s.start_time ? ` · ${fmtTime(s.start_time)}` : ''}`;
    if (isTiles) {
      const where = [s.location, s.board].filter(Boolean).map(esc).join(' · ');
      out.push(`<div class="card"><div><b>${when}</b> · ${esc(typeLabel(s.type))}</div>
      ${where ? `<div>${where}</div>` : ''}
      <div>Scored ${SurftoberAwards.minutesToHHMM(scoredMins)} ${bonusBadges}</div>
      ${photoThumbHtml(s.photo_url, 'session-photo-card')}${journalHtml(s.notes)}${audioPlayerHtml(s.audio_url)}${editLink ? `<div>${editLink}</div>` : ''}</div>`);
    } else {
      out.push(
        `<tr><td>${editLink}</td><td class="nowrap">${when}</td><td>${esc(typeLabel(s.type))}</td><td>${SurftoberAwards.minutesToHHMM(
          scoredMins
        )}</td><td>${bonusBadges}</td><td>${esc(s.location || '')}</td><td>${esc(s.board || '')}</td><td class="journal-cell">${journalHtml(s.notes)}</td><td>${photoThumbHtml(s.photo_url)}${audioPlayerHtml(s.audio_url)}</td></tr>`
      );
    }
  });
  if (!isTiles) out.push('</tbody></table>');
  document.getElementById('me-sessions').innerHTML = sessions.length
    ? (isTiles ? `<div class="card-list">${out.join('')}</div>` : out.join(''))
    : '<div class="hint">No sessions logged yet.</div>';
  // Attach edit handlers (Remove now lives inside the edit view)
  document.querySelectorAll('#me-sessions .edit-link').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('data-id');
      const s = loadSessions().find((x) => x._id === id);
      if (s) {
        location.hash = '#log';
        startEditSession(s);
      }
    });
  });
  attachJournalToggles();
}

// Current streak per user: consecutive days surfed ending today — or ending
// yesterday, since a streak stays alive until a full day is actually missed.
function currentStreaks(normalized, range){
  const dates = new Map(); // user -> Set('YYYY-MM-DD')
  normalized.filter((s) => SurftoberAwards.inRange(s.date, range)).forEach((s) => {
    const u = (s.user || '').trim();
    if (!u) return;
    if (!dates.has(u)) dates.set(u, new Set());
    dates.get(u).add(String(s.date).slice(0, 10));
  });
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const stepBack = (d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; };
  const streaks = new Map();
  for (const [u, set] of dates) {
    let d = SurftoberAwards.localDate(todayStr());
    if (!set.has(iso(d))) d = stepBack(d); // no surf yet today — count from yesterday
    let n = 0;
    while (set.has(iso(d))) { n++; d = stepBack(d); }
    streaks.set(u, n);
  }
  return streaks;
}

let leaderboardSort = 'hours'; // 'hours' (default) | 'name' | 'streak'

const STREAK_FLAME = `<svg class="streak-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c.7 3.4-.3 5.8-1.8 7.7C8.7 11.6 7 13.3 7 16a5 5 0 0 0 10 0c0-1.7-.7-3.2-1.7-4.6-.4 1.1-1 1.9-2 2.4.6-3 .2-8-1.3-11.8z"></path></svg>`;

function renderLeaderboard() {
  renderSurfReport(); // cache-guarded: hits Surfline at most once an hour
  renderTodayTile();
  renderMessageBoard();
  loadMessages(); // throttled: refetches at most once a minute
  const ev = viewedEvent || DEFAULT_EVENT;
  const normalized = loadSessions().map(SurftoberAwards.normalizeSession);
  const totals = SurftoberAwards.rollupByUser(normalized, { start: ev.start_date, end: ev.end_date });
  const streaks = currentStreaks(normalized, { start: ev.start_date, end: ev.end_date });
  // Roster rows and pledge money are live-event concepts: the roster is
  // season-agnostic (one profile per person), so merging it into an archived
  // event would list people who never surfed it and price old hours at
  // today's pledge rates.
  const live = isViewingActiveEvent();
  if (live) {
    // Registrants without a session yet still get a 0-hour row — you're on
    // the board the moment you sign up FOR THIS EVENT (per-event
    // registration; profiles from earlier events wait until they re-register).
    const seen = new Set(totals.map((t) => t.user));
    roster.forEach((p) => {
      const name = String(p.display_name || '').trim();
      if (name && !seen.has(name) && isProfileRegistered(p)) {
        seen.add(name);
        totals.push({ user: name, total_hours: 0, total_minutes: 0, medal: 'OBSERVER' });
      }
    });
  }
  if (!totals.length) {
    const tile = document.getElementById('totals-tile');
    if (tile) tile.hidden = true;
    document.getElementById('leaderboard').innerHTML = '<div class="hint">Nobody on the board yet. First wave wins.</div>';
    return;
  }
  totals.sort((a, b) => {
    if (leaderboardSort === 'name') return a.user.localeCompare(b.user);
    if (leaderboardSort === 'streak') {
      return (streaks.get(b.user) || 0) - (streaks.get(a.user) || 0) ||
        b.total_minutes - a.total_minutes || a.user.localeCompare(b.user);
    }
    return b.total_minutes - a.total_minutes || a.user.localeCompare(b.user);
  });

  // Pledges stay private per person — the board shows only the aggregate.
  // Each surfer's own accrual lives on their Account page (renderAccountPledge).
  // Rounded per surfer and summed AFTER rounding, so the total matches what
  // each person sees on their own Account.
  const rateByName = new Map(roster.map((p) => [String(p.display_name || '').trim(), parsePledgeRate(p.charity_commitment)]));
  let totalPledged = 0;
  if (live) totals.forEach((t) => { totalPledged += Math.round((rateByName.get(t.user) || 0) * t.total_hours); });
  const rows = totals.map(
    (t, i) => {
      const n = streaks.get(t.user) || 0;
      const streakCell = n >= 2 ? `<span class="streak-cell">${STREAK_FLAME}${n}</span>` : n === 1 ? '1' : '—';
      // No badge under 10h — OBSERVER exists in the data but never on screen
      const medalCell = t.medal === 'OBSERVER' ? '' : `<span class="badge ${t.medal.toLowerCase()}">${t.medal}</span>`;
      return `<tr><td>${i + 1}</td><td><a href="#me" class="user-link" data-user="${esc(t.user)}" style="color:var(--accent-text);cursor:pointer;text-decoration:none">${esc(t.user)}</a></td><td>${t.total_hours.toFixed(1)}</td><td class="nowrap">${streakCell}</td><td>${medalCell}</td></tr>`;
    }
  );
  // Totals tile: dollars raised + hours surfed, side by side. Pledge money
  // is a live-event concept (see above), so archives show hours only.
  const tile = document.getElementById('totals-tile');
  if (tile) {
    const totalHours = totals.reduce((a, t) => a + (t.total_minutes || 0), 0) / 60;
    const moneyIcon = '<svg class="money-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"></rect><circle cx="12" cy="12" r="2.7" fill="currentColor"></circle><circle cx="6.2" cy="12" r="0.9" fill="currentColor"></circle><circle cx="17.8" cy="12" r="0.9" fill="currentColor"></circle></svg>';
    const waveIcon = '<svg class="money-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 15c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><path d="M14 13c0-4.5-2.5-7.5-7-8 2 1.5 2.6 3.4 2.8 5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    const showMoney = live && totalPledged > 0;
    tile.hidden = !(showMoney || totalHours > 0);
    tile.innerHTML =
      (showMoney
        ? `<div class="total-stat"><span class="total-label">Total pledged</span><span class="total-value money">${moneyIcon}$${totalPledged}</span></div>`
        : '') +
      `<div class="total-stat"><span class="total-label">Total hours</span><span class="total-value">${waveIcon}${totalHours.toFixed(1)} h</span></div>`;
  }
  const th = (key, label) =>
    `<th class="sortable" data-key="${key}">${label}${leaderboardSort === key ? ' <span class="sort-arrow">▾</span>' : ''}</th>`;
  document.getElementById('leaderboard').innerHTML =
    `<table><thead><tr><th>#</th>${th('name', 'User')}${th('hours', 'Hours')}${th('streak', 'Streak')}<th>Medal</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  document.querySelectorAll('#leaderboard th.sortable').forEach((el) => {
    el.addEventListener('click', () => {
      leaderboardSort = el.getAttribute('data-key');
      renderLeaderboard();
    });
  });
  // Click a leaderboard name to open that surfer's Sessions page
  document.querySelectorAll('#leaderboard .user-link').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const name = a.getAttribute('data-user');
      if (profileName && name === profileName) {
        sessionsView = 'mine';
      } else {
        sessionsView = 'others';
        otherUserSelected = name;
      }
      location.hash = '#me';
      renderMyStats();
    });
  });
}

// ===== Crew message board (Leaderboard tile) ===============================
// Short posts scoped to the viewed event. Everyone (including view-mode
// guests) reads; signed-in registered members post and can delete their own.
// "Share to WhatsApp" is a client-side wa.me deep link — the poster picks
// the group chat in WhatsApp and hits send themselves (no bridge, no bot).
let messagesAvailable = true; // flips false when the table isn't deployed
let allMessages = [];
let msgFetchInFlight = false;
let msgLastFetch = 0;
let msgLastTeam = null;

async function loadMessages(force = false){
  if (!sb || !messagesAvailable) return;
  const team = (viewedEvent || DEFAULT_EVENT).team;
  if (team !== msgLastTeam) force = true; // switched events — list is stale
  if (!force && Date.now() - msgLastFetch < 60 * 1000) return;
  if (msgFetchInFlight) return;
  msgFetchInFlight = true;
  try {
    const { data, error } = await sb.from('messages')
      .select('*')
      .eq('team', team)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      // Table not deployed yet (SQL not run) — hide the tile and stop asking.
      // Any other error keeps the previous list; the next render retries.
      if (error.code === '42P01' || error.code === 'PGRST205' ||
          /schema cache|does not exist/i.test(error.message || '')) {
        messagesAvailable = false;
      }
      return;
    }
    allMessages = data || [];
    msgLastTeam = team;
    msgLastFetch = Date.now();
  } catch {
    // network blip — keep whatever list we had
  } finally {
    msgFetchInFlight = false;
    renderMessageBoard();
  }
}

function msgWhen(ts){
  const t = new Date(ts).getTime();
  if (!t) return '';
  if (Date.now() - t < 24 * 3600 * 1000) return agoText(t);
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function renderMessageBoard(){
  const box = document.getElementById('message-board');
  if (!box) return;
  if (!messagesAvailable) { box.hidden = true; return; }
  const canPost = !!currentUser && !!profileName && isViewingActiveEvent() && !needsReRegistration();
  const form = document.getElementById('msg-form');
  if (form) form.style.display = canPost ? '' : 'none';
  const list = document.getElementById('msg-list');
  if (!list) return;
  if (!allMessages.length) {
    list.innerHTML = `<div class="hint">${canPost ? 'No messages yet — say hi to the crew!' : 'No messages yet.'}</div>`;
  } else {
    list.innerHTML = allMessages.map((m) => {
      const mine = currentUser && m.user_id === currentUser.id;
      const del = mine ? ` · <a href="#" class="msg-del" data-id="${esc(m.id)}">delete</a>` : '';
      return `<div class="msg"><div class="msg-meta"><b>${esc(m.user_name || 'Someone')}</b> · ${esc(msgWhen(m.created_at))}${del}</div><div class="msg-body">${esc(m.body || '')}</div></div>`;
    }).join('');
  }
  // Guests looking at an empty board: nothing to show, keep the tile hidden
  box.hidden = !allMessages.length && !canPost;
}

function attachMessageBoardHandlers(){
  const form = document.getElementById('msg-form');
  const list = document.getElementById('msg-list');
  if (!form || !list) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('msg-input');
    const body = (input.value || '').trim();
    if (!body || !sb || !currentUser || !profileName || !activeEvent) return;
    const btn = document.getElementById('msg-send');
    btn.disabled = true;
    try {
      const { error } = await sb.from('messages').insert({
        team: activeEvent.team,
        user_id: currentUser.id,
        user_name: profileName,
        body
      });
      if (error) throw error;
      input.value = '';
      const wa = document.getElementById('msg-whatsapp');
      if (wa && wa.checked) {
        // Hand the text to WhatsApp — the poster picks the group and sends
        window.open('https://wa.me/?text=' + encodeURIComponent(`${body}\n\n🏄 surftober.com`), '_blank', 'noopener');
        wa.checked = false;
      }
      await loadMessages(true);
    } catch (err) {
      toast('Post failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
  // Deletes via delegation — the list re-renders constantly
  list.addEventListener('click', async (e) => {
    const a = e.target.closest('.msg-del');
    if (!a) return;
    e.preventDefault();
    if (!confirm('Delete this message?')) return;
    try {
      const { data, error } = await sb.from('messages').delete().eq('id', a.getAttribute('data-id')).select('id');
      if (error) throw error;
      if (!data || !data.length) throw new Error('not permitted');
      await loadMessages(true);
    } catch (err) {
      toast('Delete failed: ' + err.message, 'error');
    }
  });
}

// ===== Ocean Beach surf report (Surfline via our Supabase cache) ===========
// Surfline's API only sets CORS headers for its own domains and localhost —
// a browser on surftober.com can never call it directly (works in dev, dies
// in prod). So a pg_cron job in Supabase fetches it server-side twice an
// hour into the surf_report table (see the SQL files), and clients read that
// through our own API. Conditions are garnish: ANY failure (table missing,
// cron dead, schema change, offline) just leaves the widget hidden — never
// an error state.

const SURF_SPOTS = [
  { id: '5d9b68deab58860001c7359e', label: 'North OB' },
  { id: '638e32a4f052ba4ed06d0e3e', label: 'Central OB' },
  { id: '5842041f4e65fad6a77087f9', label: 'South OB' }
];
const SURF_CACHE_KEY = 'surftober.surfReport.v2';
const SURF_TTL_MS = 60 * 60 * 1000;   // how often a client re-checks our table
const SURF_MAX_AGE_MS = 24 * 60 * 60 * 1000; // hide the widget if the cron died
let surfFetchInFlight = false;

// Surfline's LOLA rating scale → chip label + a color that reads on every theme
const SURF_RATING = {
  FLAT:         { label: 'Flat',       color: '#9aa7b3' },
  VERY_POOR:    { label: 'Very poor',  color: '#c25b5b' },
  POOR:         { label: 'Poor',       color: '#d98a4e' },
  POOR_TO_FAIR: { label: 'Poor–fair',  color: '#e0b23e' },
  FAIR:         { label: 'Fair',       color: '#c9c94b' },
  FAIR_TO_GOOD: { label: 'Fair–good',  color: '#8fc95f' },
  GOOD:         { label: 'Good',       color: '#4bbf7a' },
  VERY_GOOD:    { label: 'Very good',  color: '#3aa9a0' },
  GOOD_TO_EPIC: { label: 'Good–epic',  color: '#4b96d9' },
  EPIC:         { label: 'Epic',       color: '#8a6fd9' }
};

function renderSurfReport(){
  const box = document.getElementById('surf-report');
  if (!box) return;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(SURF_CACHE_KEY) || 'null'); } catch {}
  if (cached && Array.isArray(cached.zones) && cached.zones.length) paintSurfReport(cached);
  // A complete report is good for an hour; one missing tides/water re-checks
  // every 5 min so newly-deployed data doesn't hide behind a stale cache.
  const cacheTtl = cached && cached.tides && cached.water ? SURF_TTL_MS : 5 * 60 * 1000;
  if ((cached && Date.now() - cached.checkedAt < cacheTtl) || surfFetchInFlight || !sb) return;
  surfFetchInFlight = true;
  (async () => {
    try {
      // select('*'): the singleton row is tiny, and this stays
      // deploy-order-safe as columns (tides, water quality) get added.
      const { data, error } = await sb.from('surf_report').select('*').eq('id', 1).maybeSingle();
      if (error || !data || !data.fetched_at || !Array.isArray(data.zones)) return;
      const byId = new Map(data.zones.filter(Boolean).map((z) => [z.id, z]));
      const zones = SURF_SPOTS.map((spot) => {
        const z = byId.get(spot.id);
        if (!z) return null;
        return {
          label: spot.label,
          min: Number(z.min) || 0,
          max: Number(z.max) || 0,
          rel: z.rel || '',
          rating: z.rating || null
        };
      }).filter(Boolean);
      if (!zones.length) return;
      const report = { checkedAt: Date.now(), fetchedAt: new Date(data.fetched_at).getTime(), zones };
      if (Array.isArray(data.tides) && data.tides.length && data.tides_at) {
        report.tides = { at: new Date(data.tides_at).getTime(), list: data.tides };
      }
      if (Array.isArray(data.water) && data.water.length && data.water_at) {
        report.water = { at: new Date(data.water_at).getTime(), stations: data.water };
      }
      try { localStorage.setItem(SURF_CACHE_KEY, JSON.stringify(report)); } catch {}
      paintSurfReport(report);
    } catch {
      // table not deployed yet / offline — widget just stays hidden
    } finally {
      surfFetchInFlight = false;
    }
  })();
}

function paintSurfReport(report){
  const box = document.getElementById('surf-report');
  if (!box) return;
  // A reading older than a day means the server cron died — hide rather than
  // show week-old "right now" conditions.
  if (!report.fetchedAt || Date.now() - report.fetchedAt > SURF_MAX_AGE_MS) return;
  // One zone: Central OB speaks for the beach (all three stay in the data in
  // case we want them back). Conditions, tide, and water quality all share
  // the one combined card — no heading above it.
  const water = (report.water && Array.isArray(report.water.stations) &&
    report.water.at && Date.now() - report.water.at < SURF_MAX_AGE_MS) ? report.water : null;
  const central = report.zones.filter((z) => z.label === 'Central OB');
  const zone = (central.length ? central : report.zones)[0];
  const tides = (report.tides && Array.isArray(report.tides.list) &&
    report.tides.at && Date.now() - report.tides.at < SURF_MAX_AGE_MS) ? report.tides : null;
  box.innerHTML = `<div class="surf-strips">${surfMainCard(zone, tides, water, report.fetchedAt)}</div>`;
  box.hidden = false;
}

// "12 min ago" / "3 h ago" for freshness stamps
function agoText(ts){
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  return mins < 1 ? 'just now' : mins < 60 ? mins + ' min ago' : Math.round(mins / 60) + ' h ago';
}

// Water quality from SFPUC's real-time beach status (the same feed behind
// the official posted/safe map). One line: SAFE when every sampled Ocean
// Beach station is clear, an advisory naming the posted stations otherwise.
// Stations marked W/Y (not sampled) don't count either way.
const SFPUC_MAP_URL = 'https://webapps.sfpuc.org/sapps/beachesandbay.html';

function surfWaterLine(water){
  const stations = (water.stations || []).filter(Boolean);
  if (!stations.length) return '';
  const up = (v) => String(v || '').trim().toUpperCase();
  const shortName = (n) => String(n || '').replace(/^Ocean Beach at /i, '');
  const cso = stations.filter((s) => s.cso);
  const posted = stations.filter((s) => up(s.s) === 'R' || (s.posted && up(s.p) === 'R'));
  const sampled = stations.filter((s) => up(s.s) !== 'W' && up(s.s) !== 'Y');
  if (!sampled.length && !cso.length) return ''; // nothing measured — say nothing
  let chip, color, text;
  if (cso.length) {
    chip = 'SEWAGE ALERT'; color = '#c25b5b';
    text = 'Sewer overflow advisory: ' + cso.map((s) => shortName(s.name)).join(', ');
  } else if (posted.length) {
    chip = 'ADVISORY'; color = '#d9714e';
    text = 'Water contact advisory posted: ' + posted.map((s) => shortName(s.name)).join(', ');
  } else {
    chip = 'SAFE'; color = '#4bbf7a';
    text = `Water quality clear at all ${sampled.length} sampled Ocean Beach stations`;
  }
  return `<div class="surf-water">
    <span class="surf-chip" style="background:${color}">${esc(chip)}</span>
    <span class="surf-water-text">${esc(text)}</span>
  </div>`;
}

// The combined conditions card: location & rating on the left, wave height
// & the Hoff-o-meter on the right, tide curve spanning the middle, water
// quality along the bottom, one shared meta line for freshness + sources.
// The tide line takes the rating's color.
function surfMainCard(z, tides, water, fetchedAt){
  const r = SURF_RATING[z.rating] || null;
  const color = r ? r.color : '#8aa0b8';
  const ft = z.min === z.max ? `${z.max} ft` : `${z.min}–${z.max} ft`;
  const waterHtml = water ? surfWaterLine(water) : '';
  const meta = `Surfline · ${esc(agoText(fetchedAt))}` +
    (waterHtml ? ` · water <a href="${SFPUC_MAP_URL}" target="_blank" rel="noopener">SFPUC</a> · checked ${esc(agoText(water.at))}` : '');
  return `<div class="surf-main">
    <div class="surf-cols">
      <div class="surf-col-main">
        <div class="surf-main-top">
          <div class="surf-main-left">
            <span class="surf-label">${esc(z.label)}</span>
            ${r ? `<span class="surf-chip" style="background:${color}">${esc(r.label)}</span>` : ''}
          </div>
          <div class="surf-main-right">
            <div class="surf-main-height">
              <div class="surf-ft">${esc(ft)}</div>
              <div class="surf-rel">${esc(z.rel)}</div>
            </div>
            ${hoffMeter(z.rel, z.max, color)}
          </div>
        </div>
        ${tides ? surfTideSection(tides.list, color) : ''}
      </div>
      ${waterHtml ? `<div class="surf-col-water">${waterHtml}</div>` : ''}
    </div>
    <div class="surf-card-meta">${meta}</div>
  </div>`;
}

// Tide section for the combined card: curve on top (line in the rating's
// color), "Tide: 3.2 ft rising · High 5.9 ft at 3:42 PM" underneath. The
// server stores two days of predictions; show a rolling window around now.
function surfTideSection(list, color){
  const now = Date.now() / 1000;
  const pts = list
    .filter((e) => e && typeof e.t === 'number' && typeof e.h === 'number')
    .filter((e) => e.t > now - 3 * 3600 && e.t < now + 21 * 3600)
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return '';
  let before = null, after = null;
  for (const p of pts) {
    if (p.t <= now) before = p;
    else { after = p; break; }
  }
  if (!before || !after) return '';
  const frac = (now - before.t) / ((after.t - before.t) || 1);
  const h = before.h + (after.h - before.h) * frac;
  const rising = after.h > before.h;
  const next = pts.find((p) => p.t > now && (p.type === 'HIGH' || p.type === 'LOW'));
  const fmtT = (t) => new Date(t * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  let text = `Tide: <strong>${h.toFixed(1)} ft</strong> ${rising ? 'rising' : 'falling'}`;
  if (next) text += ` · ${next.type === 'HIGH' ? 'High' : 'Low'} ${Number(next.h).toFixed(1)} ft at ${esc(fmtT(next.t))}`;
  return `<div class="surf-main-tide">${surfTideCurveSvg(pts, now, h, color)}<div class="surf-tide-text">${text}</div></div>`;
}

function surfTideCurveSvg(pts, now, hNow, color){
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const hs = pts.map((p) => p.h);
  const hMin = Math.min(...hs), hMax = Math.max(...hs);
  const W = 120, H = 32, PAD = 5;
  const x = (t) => ((t - t0) / ((t1 - t0) || 1)) * W;
  const y = (h) => H - PAD - ((h - hMin) / ((hMax - hMin) || 1)) * (H - 2 * PAD);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${x(p.t).toFixed(1)} ${y(p.h).toFixed(1)}`).join(' ');
  // The svg stretches to fill (preserveAspectRatio none), which would smear a
  // <circle> into a blob — so the "now" dot is an HTML element positioned in %
  const dotLeft = ((x(now) / W) * 100).toFixed(1);
  const dotTop = ((y(hNow) / H) * 100).toFixed(1);
  const stroke = color || 'currentColor';
  return `<div class="surf-tide-curve">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${d} L ${W} ${H} L 0 ${H} Z" fill="${stroke}" opacity="0.12"></path>
      <path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.5" opacity="0.8" vector-effect="non-scaling-stroke"></path>
    </svg>
    <span class="surf-tide-now" style="left:${dotLeft}%;top:${dotTop}%"></span>
  </div>`;
}

// ===== The Hoff-o-meter ====================================================
// An original Baywatch-homage lifeguard (not an actual Hasselhoff photo —
// that's copyrighted art we can't ship), drawn so the body landmarks sit at
// true height fractions: knees 0.28, waist 0.55, stomach 0.62, chest 0.73,
// head 1.0. The figure is clipped from the feet up to the wave height, with
// a rating-colored waterline on top; overhead days stack whole figures.
const HOFF_PERSON_PX = 64;
const HOFF_SVG = `<svg viewBox="0 0 40 100" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
  <path d="M12 9 Q11 1 20 1 Q29 1 28 9 Q28 13 26 14 L14 14 Q12 13 12 9 Z" fill="#4a2f1d"></path>
  <rect x="14.5" y="6" width="11" height="10.5" rx="4.5" fill="#c98850"></rect>
  <rect x="17.5" y="15" width="5" height="5" fill="#b97a44"></rect>
  <path d="M11 21 Q20 17 29 21 L28 45 L12 45 Z" fill="#c98850"></path>
  <path d="M16 27 Q20 30 24 27" stroke="#a86a38" stroke-width="1" fill="none"></path>
  <rect x="7.2" y="21" width="4.6" height="27" rx="2.3" fill="#c98850"></rect>
  <rect x="28.2" y="21" width="4.6" height="27" rx="2.3" fill="#c98850"></rect>
  <path d="M12 45 L28 45 L28 57 L22.5 57 L22.5 51 L17.5 51 L17.5 57 L12 57 Z" fill="#e23b3b"></path>
  <rect x="12.5" y="57" width="6" height="36" rx="2.5" fill="#c98850"></rect>
  <rect x="21.5" y="57" width="6" height="36" rx="2.5" fill="#c98850"></rect>
  <rect x="11" y="93" width="8.5" height="6" rx="2.5" fill="#b97a44"></rect>
  <rect x="20.5" y="93" width="8.5" height="6" rx="2.5" fill="#b97a44"></rect>
</svg>`;

// "Thigh to stomach" → 0.62 of a person, "Head to 2ft overhead" → 1.3,
// "2-3x overhead" → 3 stacked. Vocabulary sampled from live Surfline spots
// worldwide (2026-08-05): Flat, Shin to knee, Knee to thigh, Thigh to
// waist/stomach, Waist to chest/shoulder/head, Chest to head/1ft overhead/
// overhead, Head to 2ft/well overhead, Overhead to well overhead,
// 2x overhead, 2-3x overhead. Falls back to feet ÷ a 5.6 ft person.
function hoffFraction(rel, maxFt){
  const s = String(rel || '').toLowerCase();
  const mult = s.match(/(\d+)(?:\s*-\s*(\d+))?\s*x\s*overhead/); // "2x overhead", "2-3x overhead"
  if (mult) return Math.min(4, Number(mult[2] || mult[1]) || 2);
  if (s.includes('triple')) return 3;
  if (s.includes('double')) return 2;
  if (s.includes('well overhead')) return 1.6;
  if (s.includes('overhead')) return 1.3;
  const parts = [
    ['head', 1], ['shoulder', 0.85], ['chest', 0.73], ['stomach', 0.62],
    ['belly', 0.62], ['waist', 0.55], ['thigh', 0.42], ['knee', 0.28],
    ['shin', 0.16], ['ankle', 0.08]
  ];
  let f = 0;
  for (const [k, v] of parts) if (s.includes(k)) f = Math.max(f, v);
  if (f) return f;
  if (s.includes('flat')) return 0.06;
  const ft = Number(maxFt) || 0;
  return ft > 0 ? Math.min(3, ft / 5.6) : 0.5;
}

function hoffMeter(rel, maxFt, color){
  const frac = hoffFraction(rel, maxFt);
  const h = Math.max(6, Math.round(frac * HOFF_PERSON_PX));
  const count = Math.max(1, Math.ceil(frac));
  const figs = Array.from({ length: count }, (_, i) =>
    `<span class="hoff-fig" style="bottom:${i * HOFF_PERSON_PX}px">${HOFF_SVG}</span>`).join('');
  return `<div class="hoff" style="height:${h}px" title="${esc(rel || '')}">${figs}<span class="hoff-waterline" style="background:${color}"></span></div>`;
}

// ===== "Today at Surftober" tile ===========================================
// Day stats plus a featured session. Arrows page backward through previous
// days (event start → today) and through that day's sessions; the default
// pick per day is deterministic (day number modulo count) so everyone sees
// the same feature until they start browsing. Browse state lives in module
// vars so realtime re-renders don't yank the reader elsewhere.
let todayTileDate = null; // 'YYYY-MM-DD' being viewed; null = today
let todayTileIdx = null;  // session index within the day; null = daily default

function renderTodayTile(){
  const box = document.getElementById('today-tile');
  if (!box) return;
  // "Today" only makes sense on the live event — hide on archived views
  if (!isViewingActiveEvent()) { box.hidden = true; return; }
  const ev = viewedEvent || DEFAULT_EVENT;
  const today = todayStr();
  let day = todayTileDate || today;
  if (day > today) day = today;
  if (day < ev.start_date) day = ev.start_date;

  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const shiftDay = (from, off) => { const d = SurftoberAwards.localDate(from); d.setDate(d.getDate() + off); return iso(d); };

  const sessions = loadSessions().map(SurftoberAwards.normalizeSession)
    .filter((s) => String(s.date).slice(0, 10) === day)
    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
  const totalMins = sessions.reduce((a, s) => a + s.base_minutes, 0);
  const surfers = new Set(sessions.map((s) => (s.user || '').trim()).filter(Boolean));
  const isToday = day === today;
  const stat = sessions.length
    ? `<strong>${sessions.length}</strong> session${sessions.length === 1 ? '' : 's'} · <strong>${(totalMins / 60).toFixed(1)} h</strong> · ${surfers.size} surfer${surfers.size === 1 ? '' : 's'}`
    : (isToday ? 'No sessions yet — first wave wins' : 'No sessions this day');

  let idx = todayTileIdx;
  if (idx == null) {
    const dayN = Math.floor(SurftoberAwards.localDate(day).getTime() / 86400000);
    idx = sessions.length ? dayN % sessions.length : 0;
  }
  idx = Math.min(Math.max(0, idx), Math.max(0, sessions.length - 1));

  let feature = '';
  if (sessions.length) {
    const s = sessions[idx];
    const text = String(s.notes || '').trim();
    const snippet = text.length > 240 ? text.slice(0, 240).trimEnd() + '…' : text;
    const bits = [
      s.location ? `at ${esc(s.location)}` : '',
      s.start_time ? esc(fmtTime(s.start_time)) : '',
      SurftoberAwards.minutesToHHMM(s.base_minutes)
    ].filter(Boolean).join(' · ');
    const sessNav = sessions.length > 1
      ? `<span class="today-sess-nav"><button type="button" class="today-nav" data-nav="sess-prev" aria-label="Previous session">‹</button> ${idx + 1} / ${sessions.length} <button type="button" class="today-nav" data-nav="sess-next" aria-label="Next session">›</button></span>`
      : '';
    feature = `<div class="today-feature">
      <div class="today-feature-head"><span><a href="#me" class="today-user" data-user="${esc(s.user || '')}">${esc(s.user || '')}</a> ${bits}</span>${sessNav}</div>
      ${snippet ? `<blockquote class="today-quote">“${esc(snippet)}”</blockquote>` : ''}
      ${photoThumbHtml(s.photo_url, 'session-photo-card')}
      ${s.audio_url ? audioPlayerHtml(s.audio_url) : ''}
    </div>`;
  }

  const label = isToday ? 'Today at Surftober' : `${esc(fmtDay(day))} at Surftober`;
  const dayNav =
    `<button type="button" class="today-nav" data-nav="day-prev" aria-label="Previous day"${day > ev.start_date ? '' : ' disabled'}>‹</button>` +
    ` <span class="surf-label">📅 ${label}</span> ` +
    `<button type="button" class="today-nav" data-nav="day-next" aria-label="Next day"${isToday ? ' disabled' : ''}>›</button>`;

  box.innerHTML = `<div class="surf-main today-card">
    <div class="today-head"><span class="today-day-nav">${dayNav}</span><span class="today-stat">${stat}</span></div>
    ${feature}
  </div>`;
  box.hidden = false;

  box.querySelectorAll('.today-nav').forEach((b) => b.addEventListener('click', () => {
    const nav = b.getAttribute('data-nav');
    if (nav === 'day-prev') { todayTileDate = shiftDay(day, -1); todayTileIdx = null; }
    else if (nav === 'day-next') { todayTileDate = shiftDay(day, 1); todayTileIdx = null; }
    else if (nav === 'sess-prev') todayTileIdx = (idx - 1 + sessions.length) % sessions.length;
    else if (nav === 'sess-next') todayTileIdx = (idx + 1) % sessions.length;
    renderTodayTile();
  }));
  const link = box.querySelector('.today-user');
  if (link) link.addEventListener('click', (e) => {
    e.preventDefault();
    const name = link.getAttribute('data-user');
    if (profileName && name === profileName) {
      sessionsView = 'mine';
    } else {
      sessionsView = 'others';
      otherUserSelected = name;
    }
    location.hash = '#me';
    renderMyStats();
  });
}

// Your own pledge accrual, shown only to you on the Account page — the
// leaderboard publishes just the group total.
function renderAccountPledge(){
  const el = document.getElementById('account-pledge');
  if (!el) return;
  const rate = parsePledgeRate(profileData && profileData.charity_commitment);
  if (!rate || !profileName || !activeEvent) { el.textContent = ''; return; }
  const totals = SurftoberAwards.rollupByUser(
    loadSessions().map(SurftoberAwards.normalizeSession).filter((s) => s.user === profileName),
    { start: activeEvent.start_date, end: activeEvent.end_date }
  );
  const hours = totals[0] ? totals[0].total_hours : 0;
  el.textContent = `Your pledge so far: $${Math.round(rate * hours)} ($${rate}/hour × ${hours.toFixed(1)} h)`;
}

function renderAwards() {
  const ev = viewedEvent || DEFAULT_EVENT;
  const { awards } = SurftoberAwards.computeAwards(loadSessions().map(SurftoberAwards.normalizeSession), { start: ev.start_date, end: ev.end_date });
  const cards = awards.map(
    (a) => `<div class="card"><h3>${esc(a.name)}</h3><div>${esc(a.desc)}</div><div><b>${esc(a.winner)}</b> — ${esc(a.value)}</div></div>`
  );
  document.getElementById('awards').innerHTML = cards.join('') || '<div class="hint">No awards for period</div>';
}

function exportAwards() {
  const ev = viewedEvent || DEFAULT_EVENT;
  const data = SurftoberAwards.computeAwards(loadSessions().map(SurftoberAwards.normalizeSession), { start: ev.start_date, end: ev.end_date });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `awards_${ev.team}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  const data = loadSessions();
  const text = toCSV(data);
  const blob = new Blob([text], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'surftober_sessions.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function importCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        const parsed = parseCSV(String(text));
        if (!parsed.length) throw new Error('Empty CSV');
        const [headers, ...lines] = parsed;
        const rows = [];
        for (const cols of lines) {
          const row = Object.fromEntries(headers.map((h, i) => [h, cols[i] || '']));
          row.no_wetsuit = Number(row.no_wetsuit || 0);
          row.costume = Number(row.costume || 0);
          row.taught_kook = Number(row.taught_kook || 0);
          row.water_reading = Number(row.water_reading || 0);
          row.cleanup_items = Number(row.cleanup_items || 0);
          rows.push(row);
        }
        const all = loadSessions();
        for (const r of rows) all.push(SurftoberAwards.normalizeSession(r));
        saveSessions(all);
        resolve(rows.length);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function populateDataLists() {
  const all = loadSessions();
  const users = Array.from(new Set(all.map((r) => r.user))).sort();
  const locs = Array.from(new Set(all.map((r) => r.location))).sort();
  const boards = Array.from(new Set(all.map((r) => r.board))).sort();
  document.getElementById('user-list').innerHTML = users.map((u) => `<option value="${esc(u)}">`).join('');
  document.getElementById('location-list').innerHTML = locs.map((u) => `<option value="${esc(u)}">`).join('');
  document.getElementById('board-list').innerHTML = boards.map((u) => `<option value="${esc(u)}">`).join('');
}

function openPrintSlides() {
  const w = window.open('', 'slides');
  const ev = viewedEvent || DEFAULT_EVENT;
  const { awards, totals } = SurftoberAwards.computeAwards(loadSessions().map(SurftoberAwards.normalizeSession), { start: ev.start_date, end: ev.end_date });
  // @media print matters: browsers strip dark backgrounds when printing but
  // keep color:#fff — without it the deck prints white-on-white.
  const style = `<style>body{font-family:system-ui;margin:0;background:#111;color:#fff}section{page-break-after:always;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:5vw}h1{font-size:6vw;margin:0}.sub{opacity:.8;margin-top:1vw}table{width:80%;margin:2vw auto;border-collapse:collapse}td,th{border-bottom:1px solid #333;padding:.5vw 1vw;text-align:left}@media print{body{background:#fff;color:#000}.sub{opacity:1;color:#333}td,th{border-bottom:1px solid #999}}</style>`;
  const lbRows = totals
    .map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.user)}</td><td>${t.total_hours.toFixed(1)}</td><td>${t.medal}</td></tr>`)
    .join('');
  const pages = [
    `<section><div><h1>${esc(ev.name)} Awards</h1><div class="sub">${esc(ev.start_date)} → ${esc(ev.end_date)}</div></div></section>`,
    `<section><div><h1>Leaderboard</h1><table><thead><tr><th>#</th><th>User</th><th>Hours</th><th>Medal</th></tr></thead><tbody>${lbRows}</tbody></table></div></section>`,
    ...awards.map(
      (a) =>
        `<section><div><h1>${esc(a.name)}</h1><div class="sub">${esc(a.desc)}</div><h1>${esc(a.winner)}</h1><div class="sub">${esc(a.value)}</div></div></section>`
    )
  ];
  w.document.write(`<html><head><title>Surftober Slides</title>${style}</head><body>${pages.join('')}</body></html>`);
  w.document.close();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
    .then((reg) => {
      document.getElementById('sw-status').textContent = 'PWA ready';
    })
    .catch(() => {
      document.getElementById('sw-status').textContent = 'PWA failed';
    });
}

window.addEventListener('hashchange', renderTabs);
window.addEventListener('load', () => {
  applyThemeVars(themeVarsFor(currentThemeSelection())); // before anything renders
  initThemeUI();
  initModeToggle();
  renderTabs();
  initForm();
  attachAccountHandlers();
  attachAdminEventHandlers();
  attachAudioHandlers();
  attachPhotoHandlers();
  attachMessageBoardHandlers();
  reflectEventUI();
  renderMyStats();
  renderLeaderboard();
  renderAwards();
  // attachAudioHandlers(); // temporarily disabled (see feature/voice-notes-wip)
  registerSW();
  // Handlers (period filters are gone — everything is scoped to the viewed event)
  document.getElementById('subtab-mine').addEventListener('click', () => { sessionsView = 'mine'; renderMyStats(); });
  document.getElementById('subtab-others').addEventListener('click', () => { sessionsView = 'others'; renderMyStats(); });
  document.getElementById('view-list').addEventListener('click', () => { sessionsLayout = 'list'; localStorage.setItem('surftober.sessionsLayout', 'list'); renderMyStats(); });
  document.getElementById('view-tiles').addEventListener('click', () => { sessionsLayout = 'tiles'; localStorage.setItem('surftober.sessionsLayout', 'tiles'); renderMyStats(); });
  document.getElementById('other-user-select').addEventListener('change', (e) => {
    otherUserSelected = e.target.value;
    renderMyStats();
  });
  document.getElementById('btn-compute-awards').addEventListener('click', renderAwards);
  document.getElementById('btn-export-awards').addEventListener('click', exportAwards);
  document.getElementById('btn-awards-slides').addEventListener('click', openPrintSlides);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('csv-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const st = document.getElementById('status');
    if (st) st.textContent = 'Importing…';
    try {
      const n = await importCSV(f);
      if (st) st.textContent = `Imported ${n} rows`;
      populateDataLists();
      renderMyStats();
      renderLeaderboard();
      renderAwards();
    } catch (e) {
      if (st) st.textContent = 'Import failed: ' + e.message;
    }
  });
  populateDataLists();
});
