// Factory Reset helper
async function factoryResetThisDevice() {
  try {
    // Sign out first
    if (window.supabase && sb) {
      try { await sb.auth.signOut(); } catch {}
    }
    // Clear localStorage (including supabase session keys)
    localStorage.clear();
    sessionStorage.clear?.();
    // Unregister all service workers
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) { try { await r.unregister(); } catch {} }
    }
    // Clear caches
    if (window.caches) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    // Reload
    location.reload();
  } catch (e) {
    alert('Factory reset failed: ' + e.message);
  }
}

// Nuclear wipe: requires a privileged backend. Here, we call a Supabase Edge Function.
async function nuclearWipeAll(){
  if (!confirm('This will DELETE ALL users and ALL data. Type OK on the next prompt to continue.')) return;
  const confirmText = prompt('Type OK to confirm nuclear wipe (ALL users + data):');
  if ((confirmText||'').toUpperCase() !== 'OK') { toast('Cancelled', 'warn'); return; }
  try {
    if (!sb) throw new Error('Supabase client not ready');
    // Invoke via Supabase client so auth/apikey headers are handled for you
    const { data, error } = await sb.functions.invoke('nuclear_wipe', {
      body: { confirm: 'OK' }
    });
    if (error) throw new Error(error.message || JSON.stringify(error));
    toast('Nuclear wipe triggered', 'success');
  } catch (e) {
    toast('Nuclear wipe failed: ' + e.message, 'error');
  }
}

// Ensure global access for event handlers
// @ts-ignore
window.nuclearWipeAll = nuclearWipeAll;

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

// Admin UI gating based on NUKE_ADMINS allowlist
function reflectAdminVisibility(adminEmailList = []){
  const tab = document.getElementById('tab-admin-link');
  const page = document.getElementById('page-admin');
  const awardsTab = document.getElementById('tab-awards-link');
  const awardsPage = document.getElementById('page-awards');
  const isAdmin = !!currentUser && currentUser.email && adminEmailList.includes(currentUser.email.toLowerCase());
  if (tab) tab.style.display = isAdmin ? '' : 'none';
  if (page) page.style.display = isAdmin ? '' : 'none';
  if (awardsTab) awardsTab.style.display = isAdmin ? '' : 'none';
  if (awardsPage) awardsPage.style.display = isAdmin ? '' : 'none';
  renderTabs(); // bounce off #admin/#awards if the current page just got hidden
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

async function fetchProfile(){
  if (!currentUser) { 
    profileName = null; 
    profileData = null;
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
  
  enforceProfileNameOnUI();
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
    additional_comments: document.getElementById('profile-comments').value.trim()
  };
  const { error } = await sb.from('profiles').upsert(profileUpdate);
  if (error) throw error;
  await fetchProfile();
  enforceProfileNameOnUI();
}

function enforceProfileNameOnUI(){
  // Log form user field
  const userEl = document.getElementById('log-user');
  if (userEl) {
    if (currentUser && profileName) {
      userEl.value = profileName;
      userEl.readOnly = true;
      userEl.title = 'Name comes from your profile. Edit in Account tab.';
    } else if (currentUser && !profileName) {
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
const THEME_VAR_NAMES = ['bg', 'panel', 'muted', 'accent', 'accent-strong', 'text', 'ok', 'warn', 'input-bg', 'input-border', 'card-border'];

const THEMES = {
  'sunset-surf': { label: 'Sunset Surf (current)', vars: { 'bg': '#0a1628', 'panel': '#152238', 'muted': '#1e3a52', 'accent': '#ff6b35', 'accent-strong': '#ff4500', 'text': '#e8f4f8', 'ok': '#4ecdc4', 'warn': '#ffa500', 'input-bg': '#1e3a52', 'input-border': '#2d4a62', 'card-border': '#2d4a62' } },
  'sunset-ember': { label: 'Sunset Surf · accent borders', vars: { 'bg': '#0a1628', 'panel': '#152238', 'muted': '#1e3a52', 'accent': '#ff6b35', 'accent-strong': '#ff4500', 'text': '#e8f4f8', 'ok': '#4ecdc4', 'warn': '#ffa500', 'input-bg': '#1e3a52', 'input-border': '#9c4d31', 'card-border': '#9c4d31' } },
  'sunset-soft': { label: 'Sunset Soft', vars: { 'bg': '#0d1b30', 'panel': '#182842', 'muted': '#22405c', 'accent': '#ff8b5e', 'accent-strong': '#ff6b35', 'text': '#eef6f9', 'ok': '#4ecdc4', 'warn': '#ffb347', 'input-bg': '#22405c', 'input-border': '#33516e', 'card-border': '#33516e' } },
  'high-tide': { label: 'High Tide', vars: { 'bg': '#0a1628', 'panel': '#152238', 'muted': '#1e3a52', 'accent': '#2ec4b6', 'accent-strong': '#17a398', 'text': '#e8f4f8', 'ok': '#5be37a', 'warn': '#ffa500', 'input-bg': '#1e3a52', 'input-border': '#2d4a62', 'card-border': '#2d4a62' } },
  'golden-hour': { label: 'Golden Hour', vars: { 'bg': '#161020', 'panel': '#241a30', 'muted': '#332545', 'accent': '#ffb347', 'accent-strong': '#ff8c42', 'text': '#f6ecdf', 'ok': '#4ecdc4', 'warn': '#ffd166', 'input-bg': '#332545', 'input-border': '#453458', 'card-border': '#453458' } },
  'dawn-patrol': { label: 'Dawn Patrol', vars: { 'bg': '#141126', 'panel': '#1f1a38', 'muted': '#2c2450', 'accent': '#ff8fa3', 'accent-strong': '#ff5c7a', 'text': '#f3eefc', 'ok': '#7ce7c4', 'warn': '#ffc46b', 'input-bg': '#2c2450', 'input-border': '#3b3166', 'card-border': '#3b3166' } },
  'deep-kelp': { label: 'Deep Kelp', vars: { 'bg': '#0a1f14', 'panel': '#12301f', 'muted': '#1a4029', 'accent': '#ffc857', 'accent-strong': '#f4a300', 'text': '#eaf6ec', 'ok': '#4ecdc4', 'warn': '#ff9f1c', 'input-bg': '#1a4029', 'input-border': '#2a5a3c', 'card-border': '#2a5a3c' } },
  'midnight-set': { label: 'Midnight Set', vars: { 'bg': '#05080f', 'panel': '#0d1420', 'muted': '#16202f', 'accent': '#4da3ff', 'accent-strong': '#1f7ae0', 'text': '#e6eefc', 'ok': '#54e0b0', 'warn': '#ffb347', 'input-bg': '#16202f', 'input-border': '#243349', 'card-border': '#243349' } },
  'neon-beach': { label: 'Neon Beach', vars: { 'bg': '#0d0d0f', 'panel': '#1a1a1e', 'muted': '#2a2a32', 'accent': '#ff6b35', 'accent-strong': '#ff4500', 'text': '#f5f5f5', 'ok': '#00ff88', 'warn': '#ffaa00', 'input-bg': '#1a1a1e', 'input-border': '#3a3a42', 'card-border': '#2a2a32' } },
  'pumpkin-spice': { label: 'Pumpkin Spice (light)', vars: { 'bg': '#f5f0e8', 'panel': '#fff8f0', 'muted': '#e8dcc8', 'accent': '#ff6b35', 'accent-strong': '#e85d2a', 'text': '#2d2416', 'ok': '#2d8659', 'warn': '#c96a1e', 'input-bg': '#ffffff', 'input-border': '#d4c4a8', 'card-border': '#d4c4a8' } },
  'pumpkin-ember': { label: 'Pumpkin Spice · accent borders', vars: { 'bg': '#f5f0e8', 'panel': '#fff8f0', 'muted': '#e8dcc8', 'accent': '#ff6b35', 'accent-strong': '#e85d2a', 'text': '#2d2416', 'ok': '#2d8659', 'warn': '#c96a1e', 'input-bg': '#ffffff', 'input-border': '#e2a380', 'card-border': '#e2a380' } },
  'sea-glass': { label: 'Sea Glass (light)', vars: { 'bg': '#f2f7f7', 'panel': '#ffffff', 'muted': '#e3edee', 'accent': '#0e7c86', 'accent-strong': '#0a5c64', 'text': '#17323a', 'ok': '#1a936f', 'warn': '#c97b1e', 'input-bg': '#ffffff', 'input-border': '#c2d4d6', 'card-border': '#d5e3e4' } },
};

function currentThemeSelection(){
  try { return JSON.parse(localStorage.getItem(THEME_KEY)) || { name: 'sunset-surf' }; }
  catch { return { name: 'sunset-surf' }; }
}

function themeVarsFor(sel){
  if (sel.name === 'custom') return { ...THEMES['sunset-surf'].vars, ...(sel.vars || {}) };
  return (THEMES[sel.name] || THEMES['sunset-surf']).vars;
}

function applyThemeVars(vars){
  for (const k of THEME_VAR_NAMES) {
    if (vars[k]) document.documentElement.style.setProperty('--' + k, vars[k]);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && vars.panel) meta.setAttribute('content', vars.panel);
}

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
    applyThemeVars(THEMES['sunset-surf'].vars);
    seedThemePickers(THEMES['sunset-surf'].vars);
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
      banner.innerHTML = `Viewing past event: <b>${esc(ev.name)}</b> (${esc(ev.start_date)} → ${esc(ev.end_date)}) · <a href="#" id="event-banner-back">Back to ${esc(activeEvent.name)}</a>`;
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
  // Scope labels on My Stats / Leaderboard / Awards
  const scopeText = `${ev.name} · ${ev.start_date} → ${ev.end_date}`;
  for (const id of ['me-scope', 'lb-scope', 'aw-scope']) {
    const el = document.getElementById(id);
    if (el) el.textContent = scopeText;
  }
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
  // Logging is closed with no active event AND before the window opens —
  // clamping the date forward would silently misdate pre-season entries.
  const preWindow = !!activeEvent && todayStr() < activeEvent.start_date;
  const submitBtn = document.getElementById('btn-submit');
  if (submitBtn) submitBtn.disabled = !activeEvent || preWindow;
  const notice = document.getElementById('event-notice');
  if (notice) {
    if (!activeEvent) {
      notice.textContent = 'No active event — logging opens when the admin launches one.';
      notice.style.display = '';
    } else if (preWindow) {
      notice.textContent = `${activeEvent.name} starts ${activeEvent.start_date} — logging opens then.`;
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
    const status = e.is_active ? '<span class="badge gold">ACTIVE</span>' : '';
    const viewing = viewedEvent && viewedEvent.team === e.team ? ' 👁' : '';
    const actions = [
      `<a href="#" class="ev-view" data-team="${esc(e.team)}">View</a>`,
      e.is_active ? '' : `<a href="#" class="ev-activate" data-team="${esc(e.team)}">Activate</a>`
    ].filter(Boolean).join(' | ');
    return `<tr><td>${esc(e.name)}${viewing}</td><td>${esc(e.start_date)} → ${esc(e.end_date)}</td><td>${status}</td><td>${actions}</td></tr>`;
  });
  el.innerHTML = `<table><thead><tr><th>Event</th><th>Window</th><th></th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  el.querySelectorAll('.ev-view').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const ev = allEvents.find((x) => x.team === a.getAttribute('data-team'));
    if (ev) { switchViewedEvent(ev); toast(`Viewing ${ev.name}`, 'success'); }
  }));
  el.querySelectorAll('.ev-activate').forEach((a) => a.addEventListener('click', async (e) => {
    e.preventDefault();
    const ev = allEvents.find((x) => x.team === a.getAttribute('data-team'));
    if (!ev) return;
    if (!confirm(`Make "${ev.name}" the active event? Users will only be able to log ${ev.start_date} → ${ev.end_date}.`)) return;
    try {
      await setActiveEvent(ev.team);
      toast(`${ev.name} is now active`, 'success');
    } catch (err) {
      toast('Activate failed: ' + err.message, 'error');
    }
  }));
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
  let team = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!/\d{4}/.test(team)) team += '-' + start.slice(0, 4);
  const existing = allEvents.find((e) => e.team === team);
  const msg = existing
    ? `"${name}" already exists (${existing.start_date} → ${existing.end_date}). Update its window to ${start} → ${end} and make it the active event?`
    : `Launch "${name}" (${start} → ${end})? This deactivates any current event and freezes its data.`;
  if (!confirm(msg)) return;
  try {
    // Upsert the row first (inactive on insert), then flip activation in one
    // atomic RPC — see setActiveEvent.
    const { error } = await sb.from('events').upsert(
      { name, team, start_date: start, end_date: end },
      { onConflict: 'team' }
    );
    if (error) throw error;
    await setActiveEvent(team);
    toast(`${name} launched — logging window ${start} → ${end}`, 'success');
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
    cleanup_items: s.cleanup_items || 0,
    audio_url: s.audio_url || null
  }));
}

async function syncFromCloud(){
  try {
    const cloud = await fetchCloudSessions();
    saveSessions(cloud);
    populateDataLists();
    renderRecent();
    renderMyStats();
    renderLeaderboard();
    renderAwards();
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
  const { error } = await sb.from('sessions').insert(payload);
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
  // Admin: List users (emails + display names)
  const btnListUsers = document.getElementById('btn-list-users');
  if (btnListUsers) btnListUsers.addEventListener('click', async () => {
    try {
      // Fetch emails via admin-only function (returns limited fields)
      const { data: usersData, error } = await sb.functions.invoke('list_users');
      if (error) throw new Error(error.message || JSON.stringify(error));
      const users = Array.isArray(usersData?.users) ? usersData.users : [];

      // Fetch profiles (display names)
      const { data: profs, error: pErr } = await sb.from('profiles').select('id, display_name');
      if (pErr) throw pErr;
      const nameById = Object.fromEntries((profs||[]).map(p=>[p.id, p.display_name||'']));

      const rows = users.map(u => ({ email: u.email || '', name: nameById[u.id] || '' }));
      const html = [`<table><thead><tr><th>Email</th><th>Display Name</th></tr></thead><tbody>`]
        .concat(rows.map(r=>`<tr><td>${esc(r.email)}</td><td>${esc(r.name)}</td></tr>`))
        .concat(['</tbody></table>'])
        .join('');
      document.getElementById('admin-users').innerHTML = html || '<div class="hint">No users</div>';
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
      renderRecent();
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
  const header = ['user', 'date', 'type', 'duration', 'location', 'board', 'notes', 'no_wetsuit', 'costume', 'cleanup_items', 'audio_url'];
  const quote = (v) => '"' + String(v || '').replace(/"/g, '""') + '"';
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.user, r.date, r.type, r.duration, r.location, r.board, r.notes, r.no_wetsuit ? 1 : 0, r.costume ? 1 : 0, r.cleanup_items || 0, r.audio_url || ''].map(quote).join(','));
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
  // Admin/Awards pages are hidden with inline display:none for non-admins,
  // which overrides the .active class — bounce to Log instead of a blank page.
  if (el && el.style.display === 'none') {
    location.hash = '#log';
    return;
  }
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.remove('active'));
  const tab = document.querySelector(`.tabs a[data-tab="${hash}"]`);
  if (el) el.classList.add('active');
  if (tab) tab.classList.add('active');
}

function initForm() {
  const f = document.getElementById('log-form');
  document.getElementById('log-date').value = defaultLogDate();

  function applyCleanupUI() {
    const type = document.getElementById('log-type').value;
    const isCleanup = type === 'cleanup';
    const isSwim = type === 'swim';
    const h = document.getElementById('log-duration-h');
    const m = document.getElementById('log-duration-m');
    const board = document.getElementById('log-board');
    const boardField = document.getElementById('field-craft');
    const wetsuit = document.getElementById('log-no-wetsuit');
    const costume = document.getElementById('log-costume');
    if (isCleanup) {
      h.value = 1;
      m.value = 0;
      h.disabled = true;
      m.disabled = true;
      board.value = 'cleanup';
      boardField.classList.add('hidden');
      wetsuit.checked = false;
      wetsuit.disabled = true;
      costume.checked = false;
      costume.disabled = true;
    } else {
      h.disabled = false;
      m.disabled = false;
      boardField.classList.toggle('hidden', isSwim);
      wetsuit.disabled = false;
      costume.disabled = false;
    }
  }

  function applyCostumeGuard() {
    const type = document.getElementById('log-type').value;
    if (type === 'cleanup') return; // already disabled
    const user = document.getElementById('log-user').value.trim();
    const dateStr = document.getElementById('log-date').value;
    const costumeEl = document.getElementById('log-costume');
    if (!user || !dateStr) {
      costumeEl.disabled = false;
      return;
    }
    if (costumeUsedForPeriod(user, dateStr)) {
      costumeEl.checked = false;
      costumeEl.disabled = true;
      costumeEl.title = 'Costume bonus already used this month for this user';
    } else {
      costumeEl.disabled = false;
      costumeEl.title = '';
    }
  }

  function costumeUsedForPeriod(user, dateStr) {
    // One costume bonus per event window (was per calendar month, with a UTC
    // parse that misfiled dates in Pacific time). Ignores the session being
    // edited so editing your costume session doesn't strip the flag.
    try {
      const ev = activeEvent || viewedEvent || DEFAULT_EVENT;
      const all = loadSessions();
      return all.some(
        (s) =>
          (s.user || '').trim() === user.trim() &&
          (!editingId || s._id !== editingId) &&
          SurftoberAwards.inRange(s.date, { start: ev.start_date, end: ev.end_date }) &&
          (s.costume === 1 || s.costume === true || String(s.costume) === '1')
      );
    } catch {
      return false;
    }
  }

  document.getElementById('log-type').addEventListener('change', () => {
    applyCleanupUI();
    applyCostumeGuard();
  });
  document.getElementById('log-user').addEventListener('input', applyCostumeGuard);
  document.getElementById('log-date').addEventListener('change', applyCostumeGuard);
  applyCleanupUI();
  applyCostumeGuard();

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Enforce display name when signed in (no special format required)
    if (sb && currentUser && !profileName) {
      toast('Please set your display name in Account before logging.', 'warn');
      location.hash = '#account';
      return;
    }
    const isCleanup = document.getElementById('log-type').value === 'cleanup';
    const row = {
      user: document.getElementById('log-user').value.trim(),
      date: document.getElementById('log-date').value,
      type: document.getElementById('log-type').value,
      duration: isCleanup
        ? '01:00'
        : `${String(Number(document.getElementById('log-duration-h').value || 0)).padStart(2, '0')}:${String(
            Number(document.getElementById('log-duration-m').value || 0)
          ).padStart(2, '0')}`,
      location: document.getElementById('log-location').value,
      board: document.getElementById('log-board').value,
      notes: document.getElementById('log-notes').value,
      no_wetsuit: isCleanup ? 0 : document.getElementById('log-no-wetsuit').checked ? 1 : 0,
      costume: isCleanup ? 0 : document.getElementById('log-costume').checked ? 1 : 0,
      cleanup_items: isCleanup ? 1 : 0
    };
    if (!row.user || !row.date || !row.duration) {
      alert('Please fill required fields');
      return;
    }
    if (!activeEvent) {
      toast('No active event — logging is closed.', 'warn');
      return;
    }
    if (todayStr() < activeEvent.start_date) {
      toast(`${activeEvent.name} starts ${activeEvent.start_date} — logging opens then.`, 'warn');
      return;
    }
    if (row.date < activeEvent.start_date || row.date > activeEvent.end_date) {
      toast(`Sessions must be dated inside ${activeEvent.name} (${activeEvent.start_date} → ${activeEvent.end_date})`, 'warn');
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

      if (editingId && sb && currentUser) {
        await updateCloudSession(editingId, row);
        if (previousAudioUrl && previousAudioUrl !== row.audio_url) deleteSessionAudio(previousAudioUrl);
        toast('Session updated', 'success');
        resetEditState();
        await syncFromCloud();
      } else {
        if (sb && currentUser) await insertCloud(row);
        appendSession(row);
        toast('Entry saved', 'success');
      }
      const st = document.getElementById('status');
      if (st) st.textContent = 'Saved entry for ' + row.user + ' on ' + row.date + (currentUser ? ' (cloud + local)' : ' (local)');
      renderRecent();
      renderMyStats();
      renderLeaderboard();
      f.reset();
      resetAudioField();
      document.getElementById('log-date').value = defaultLogDate();
      // Restore the display name after reset
      enforceProfileNameOnUI();
      // form.reset() restores values but not disabled/hidden state — without
      // this, logging a cleanup leaves the duration inputs disabled for the
      // next entry, which then silently saves as 01:00.
      applyCleanupUI();
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
    document.getElementById('log-date').value = defaultLogDate();
    enforceProfileNameOnUI();
    applyCleanupUI();
    applyCostumeGuard();
  });
}

// Editing state and helpers (top-level)
let editingId = null; // UUID of session being edited (cloud), null when not editing
let editingAudioUrl = null; // existing audio note of the session being edited

function resetEditState(){
  editingId = null;
  editingAudioUrl = null;
  document.getElementById('btn-submit').textContent = 'Add Entry';
  document.getElementById('btn-cancel-edit').style.display = 'none';
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

function startEditSession(session){
  // Prefill form with session values, lock user field (already enforced), toggle submit button label
  document.getElementById('log-date').value = session.date;
  document.getElementById('log-type').value = session.type;
  const [h,m] = session.duration.split(':').map(x=>Number(x));
  document.getElementById('log-duration-h').value = h;
  document.getElementById('log-duration-m').value = m;
  document.getElementById('log-location').value = session.location||'';
  document.getElementById('log-board').value = session.board||'';
  document.getElementById('log-notes').value = session.notes||'';
  document.getElementById('log-no-wetsuit').checked = !!session.no_wetsuit;
  document.getElementById('log-costume').checked = !!session.costume;
  document.getElementById('btn-submit').textContent = 'Update Entry';
  document.getElementById('btn-cancel-edit').style.display = '';
  editingId = session._id || null; // we'll attach _id when rendering from cloud
  editingAudioUrl = session.audio_url || null;
  resetAudioFieldForEdit();
  // Re-apply type-dependent UI (cleanup disables inputs, swim hides craft)
  document.getElementById('log-type').dispatchEvent(new Event('change'));
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
  const { data, error } = await sb.from('sessions').update(payload).eq('id', id).eq('user_id', currentUser.id).select('id');
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

function renderRecent() {
  const container = document.getElementById('recent-entries');
  // Normalize: cloud-synced rows don't carry base_minutes until normalized
  // (it used to render as "NaN:NaN" after a sync).
  const all = loadSessions().map(SurftoberAwards.normalizeSession).slice(-10).reverse();
  container.innerHTML = all
    .map((r) => {
      // Ownership by user_id, not display name — two people sharing a name
      // must not see edit links on each other's rows.
      const canEdit = !!currentUser && r._id && r.user_id === currentUser.id && isViewingActiveEvent();
      const edit = canEdit ? `<div><a class="edit-link" data-id="${esc(r._id)}">Edit</a></div>` : '';
      return `<div class="card"><div><b>${esc(r.user)}</b> · ${esc(r.date)} · ${esc(r.type)}</div>
      <div>${esc(r.location || '')} · ${esc(r.board || '')}</div>
      <div>${esc(r.duration)} (${SurftoberAwards.minutesToHHMM(r.base_minutes)}) ${r.no_wetsuit ? '<span class="badge">No wetsuit</span>' : ''} ${
        r.costume ? '<span class="badge">Costume</span>' : ''
      } ${r.cleanup_items ? `<span class="badge">Cleanup ${Number(r.cleanup_items)}</span>` : ''}</div>
      <div>${esc(r.notes || '')}</div>${audioPlayerHtml(r.audio_url)}${edit}</div>`;
    })
    .join('');
  // Attach edit handlers
  container.querySelectorAll('.edit-link').forEach((a) => {
    a.addEventListener('click', () => {
      const id = a.getAttribute('data-id');
      const allSess = loadSessions();
      const s = allSess.find((x) => x._id === id);
      if (s) startEditSession(s);
    });
  });
}

// Sessions page state: your own sessions, or one other surfer's page
let sessionsView = 'mine';   // 'mine' | 'others'
let otherUserSelected = '';

function renderMyStats() {
  const ev = viewedEvent || DEFAULT_EVENT;
  const range = { start: ev.start_date, end: ev.end_date };
  const normalized = loadSessions().map(SurftoberAwards.normalizeSession);

  // Sub-tab chrome
  const mineBtn = document.getElementById('subtab-mine');
  const othersBtn = document.getElementById('subtab-others');
  if (mineBtn) mineBtn.classList.toggle('active', sessionsView === 'mine');
  if (othersBtn) othersBtn.classList.toggle('active', sessionsView === 'others');
  const otherWrap = document.getElementById('other-user-wrap');
  if (otherWrap) otherWrap.style.display = sessionsView === 'others' ? '' : 'none';

  // Resolve whose page we're showing
  let user;
  if (sessionsView === 'others') {
    const names = Array.from(new Set(
      normalized.filter((s) => SurftoberAwards.inRange(s.date, range)).map((s) => (s.user || '').trim())
    )).filter((n) => n && n !== profileName).sort((a, b) => a.localeCompare(b));
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
      : 'No other surfers have logged sessions in this event yet.';
    document.getElementById('me-summary').innerHTML = `<div class="hint">${hint}</div>`;
    document.getElementById('me-sessions').innerHTML = '';
    return;
  }

  const mine = normalized.filter((s) => s.user === user);
  const totals = SurftoberAwards.rollupByUser(mine, range);
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

          // Get user's goal hours from profile
          const goalHours = profileData && t.user === profileName && profileData.target_hours
            ? Number(profileData.target_hours)
            : null;

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

          let content = `<div class="card"><h3>${esc(t.user)}</h3>`;

          if (goalHours) {
            const statusColor = t.total_hours >= onTrackHours ? '#5be37a' : '#ffb347';
            content += `
              <div>Current Hours: <strong>${t.total_hours.toFixed(1)}</strong> <span class="badge ${t.medal.toLowerCase()}">${t.medal}</span></div>
              <div>On-Track Hours: <strong style="color:${statusColor}">${onTrackHours.toFixed(1)}</strong></div>
              <div>Goal Hours: <strong>${goalHours}</strong> ${goalMedalBadge}</div>
              <div>Progress: <strong>${progressPercent.toFixed(0)}%</strong> ${progressPercent >= 100 ? '🎉' : ''}</div>
            `;
          } else {
            content += `<div>Total Hours: <strong>${t.total_hours.toFixed(1)}</strong> <span class="badge ${t.medal.toLowerCase()}">${t.medal}</span></div>`;
          }

          content += `</div>`;
          return content;
        }
      )
      .join('') || '<div class="hint">No data</div>';

  // Table of sessions (scoped to the viewed event)
  const sessions = mine.filter((s) => SurftoberAwards.inRange(s.date, range));
  // Determine which session gets the one-time costume +1h — PER USER (the
  // name filter can be blank, showing everyone's sessions at once).
  const costumeIdxByUser = new Map();
  const costumeEarliestByUser = new Map();
  sessions.forEach((s, i) => {
    if (!s.costume) return;
    const u = (s.user || '').trim();
    const ts = SurftoberAwards.localDate(s.date).getTime();
    if (!costumeEarliestByUser.has(u) || ts < costumeEarliestByUser.get(u)) {
      costumeEarliestByUser.set(u, ts);
      costumeIdxByUser.set(u, i);
    }
  });
  const tbl = [
    `<table><thead><tr><th>Date</th><th>Type</th><th>Dur</th><th>Scored</th><th>Bonuses</th><th>Location</th><th>Surf craft</th><th class="journal-cell">Journal</th><th>Audio</th><th></th></tr></thead><tbody>`
  ];
  sessions.forEach((s, i) => {
    const costumeApplied = costumeIdxByUser.get((s.user || '').trim()) === i;
    const scoredMins = s.base_minutes + (costumeApplied ? 60 : 0);
    const bonusBadges = [
      s.no_wetsuit ? '<span class="badge">No Wetsuit ×2</span>' : '',
      costumeApplied ? '<span class="badge">Costume +1h</span>' : '',
      s.type === 'cleanup' ? '<span class="badge">Cleanup</span>' : ''
    ]
      .filter(Boolean)
      .join(' ');
    const canEdit = !!currentUser && s._id && s.user_id === currentUser.id && isViewingActiveEvent();
    const actions = canEdit ? `<a href="#" class="edit-link" data-id="${esc(s._id)}" style="cursor:pointer">Edit</a> | <a href="#" class="remove-link" data-id="${esc(s._id)}" style="color:#c00;cursor:pointer">Remove</a>` : '';
    tbl.push(
      `<tr><td>${esc(s.date)}</td><td>${esc(s.type)}</td><td>${esc(s.duration)}</td><td>${SurftoberAwards.minutesToHHMM(
        scoredMins
      )}</td><td>${bonusBadges}</td><td>${esc(s.location || '')}</td><td>${esc(s.board || '')}</td><td class="journal-cell">${esc(s.notes || '')}</td><td>${audioPlayerHtml(s.audio_url)}</td><td>${actions}</td></tr>`
    );
  });
  tbl.push('</tbody></table>');
  document.getElementById('me-sessions').innerHTML = tbl.join('');
  // Attach edit handlers in My Stats
  document.querySelectorAll('#me-sessions .edit-link').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('data-id');
      const allSess = loadSessions();
      const s = allSess.find((x) => x._id === id);
      if (s) {
        location.hash = '#log';
        startEditSession(s);
      }
    });
  });
  // Attach remove handlers in My Stats
  document.querySelectorAll('#me-sessions .remove-link').forEach((a) => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = a.getAttribute('data-id');
      const allSess = loadSessions();
      const s = allSess.find((x) => x._id === id);
      if (!s) return;
      
      // Confirmation dialog
      const confirmMsg = `Are you sure you want to delete this session?\n\n${s.date} - ${s.type} - ${s.duration}\n${s.location || ''} ${s.board || ''}`;
      if (!confirm(confirmMsg)) return;
      
      try {
        // Delete from cloud if authenticated (soft delete — the audio note
        // stays in storage so an undeleted session keeps its recording)
        if (sb && currentUser && s._id) {
          await deleteCloudSession(s._id);
          toast('Session deleted', 'success');
        }
        // Sync from cloud to update local storage
        await syncFromCloud();
      } catch (e) {
        toast('Delete failed: ' + e.message, 'error');
      }
    });
  });
}

function renderLeaderboard() {
  const ev = viewedEvent || DEFAULT_EVENT;
  const totals = SurftoberAwards.rollupByUser(loadSessions().map(SurftoberAwards.normalizeSession), { start: ev.start_date, end: ev.end_date });
  const rows = totals.map(
    (t, i) => `<tr><td>${i + 1}</td><td><a href="#me" class="user-link" data-user="${esc(t.user)}" style="color:var(--accent);cursor:pointer;text-decoration:none">${esc(t.user)}</a></td><td>${t.total_hours.toFixed(1)}</td><td><span class="badge ${t.medal.toLowerCase()}">${t.medal}</span></td></tr>`
  );
  document.getElementById('leaderboard').innerHTML = `<table><thead><tr><th>#</th><th>User</th><th>Hours</th><th>Medal</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
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
  const style = `<style>body{font-family:system-ui;margin:0;background:#111;color:#fff}section{page-break-after:always;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:5vw}h1{font-size:6vw;margin:0}.sub{opacity:.8;margin-top:1vw}table{width:80%;margin:2vw auto;border-collapse:collapse}td,th{border-bottom:1px solid #333;padding:.5vw 1vw;text-align:left}</style>`;
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
  renderTabs();
  initForm();
  attachAccountHandlers();
  attachAdminEventHandlers();
  attachAudioHandlers();
  reflectEventUI();
  renderRecent();
  renderMyStats();
  renderLeaderboard();
  renderAwards();
  // attachAudioHandlers(); // temporarily disabled (see feature/voice-notes-wip)
  registerSW();
  // Handlers (period filters are gone — everything is scoped to the viewed event)
  document.getElementById('subtab-mine').addEventListener('click', () => { sessionsView = 'mine'; renderMyStats(); });
  document.getElementById('subtab-others').addEventListener('click', () => { sessionsView = 'others'; renderMyStats(); });
  document.getElementById('other-user-select').addEventListener('change', (e) => {
    otherUserSelected = e.target.value;
    renderMyStats();
  });
  document.getElementById('btn-compute-awards').addEventListener('click', renderAwards);
  document.getElementById('btn-export-awards').addEventListener('click', exportAwards);
  document.getElementById('btn-awards-slides').addEventListener('click', openPrintSlides);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  const btnFactory = document.getElementById('btn-factory-reset');
  if (btnFactory) btnFactory.addEventListener('click', factoryResetThisDevice);
  const btnNuclear = document.getElementById('btn-nuclear-wipe');
  if (btnNuclear) btnNuclear.addEventListener('click', nuclearWipeAll);
  document.getElementById('csv-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const st = document.getElementById('status');
    if (st) st.textContent = 'Importing…';
    try {
      const n = await importCSV(f);
      if (st) st.textContent = `Imported ${n} rows`;
      populateDataLists();
      renderRecent();
      renderMyStats();
      renderLeaderboard();
      renderAwards();
    } catch (e) {
      if (st) st.textContent = 'Import failed: ' + e.message;
    }
  });
  populateDataLists();
});
