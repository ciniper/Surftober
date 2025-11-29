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
  // Always try to use latest SW on page load
  try {
    const reg = await navigator.serviceWorker.getRegistration('./');
    if (reg) {
      await reg.update().catch(()=>{});
      if (reg.waiting) { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); }
    }
  } catch {}

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
const SUPABASE_URL = 'https://fexixuteqhgcmccuivcv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleGl4dXRlcWhnY21jY3VpdmN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNDYwOTksImV4cCI6MjA3OTkyMjA5OX0.M6AlLo7ICTFJ20wIFC2QfZAXhwN5uWEeKRtcnBkTAOU';
const TEAM = 'surftober-2025';

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

function toast(msg, type='success'){
  const box = document.getElementById('toast-container');
  if (!box) { console.log(`[${type}]`, msg); return; }
  const el = document.createElement('div');
  el.className = 'toast ' + (type||'');
  el.innerHTML = `<span>${msg}</span><span class="close">✕</span>`;
  el.querySelector('.close').onclick = ()=> el.remove();
  box.appendChild(el);
  // Fetch NUKE_ADMINS list from the function (safe to expose list of emails you already configured)
  let adminEmails = [];
  try {
    const { data, error } = await sb.functions.invoke('nuke_admins');
    if (!error && Array.isArray(data?.admins)) adminEmails = data.admins.map((s)=>String(s).toLowerCase());
  } catch {}

  setTimeout(()=> el.remove(), 4000);
}

async function initSupabase(){
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  // handle auth redirect / initial session
  const {
    data: { user }
  } = await sb.auth.getUser();
  currentUser = user || null;
  reflectAuthUI();
  await fetchProfile();
  enforceProfileNameOnUI();
  reflectAdminVisibility(adminEmails);

  // initial sync
  syncFromCloud();

  // auth state changes
  sb.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    reflectAuthUI();
    try {
      const { data, error } = await sb.functions.invoke('nuke_admins');
      const admins = (!error && Array.isArray(data?.admins)) ? data.admins.map((s)=>String(s).toLowerCase()) : [];
      reflectAdminVisibility(admins);
    } catch { reflectAdminVisibility([]); }
    if (currentUser) {
      fetchProfile();
      syncFromCloud();
    } else {
      profileName = null;
      enforceProfileNameOnUI();
    }
  });

  // start realtime listener for sessions
// Admin UI gating based on NUKE_ADMINS allowlist
function reflectAdminVisibility(adminEmailList = []){
  const tab = document.getElementById('tab-admin-link');
  const page = document.getElementById('page-admin');
  const isAdmin = !!currentUser && currentUser.email && adminEmailList.includes(currentUser.email.toLowerCase());
  if (tab) tab.style.display = isAdmin ? '' : 'none';
  if (page) page.style.display = isAdmin ? '' : 'none';
}

  try {
    sb
      .channel('public:sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
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
  if (!currentUser) { profileName = null; return; }
  const { data, error } = await sb.from('profiles').select('display_name').eq('id', currentUser.id).maybeSingle();
  if (error) { console.warn('profile fetch error', error); return; }
  profileName = (data && data.display_name) ? data.display_name : null;
  // Reflect Account UI
  const dn = document.getElementById('display-name');
  if (dn && profileName) dn.value = profileName;
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
  // My Stats filter
  const meUser = document.getElementById('me-user');
  if (meUser) {
    if (currentUser && profileName) {
      // Default to your profile name but allow changing to view others
      meUser.value = profileName;
      meUser.readOnly = false;
      meUser.title = 'Default: your name. Pick another to view others.';
    } else {
      meUser.readOnly = false;
      meUser.title = '';
    }
  }
}

async function signInMagicLink(email){
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
}

async function signOut(){
  await sb.auth.signOut();
  currentUser = null;
  reflectAuthUI();
}

async function saveDisplayName(){
  if (!currentUser) throw new Error('Sign in first');
  const val = (document.getElementById('display-name').value || '').trim();
  if (!val) throw new Error('Display name cannot be empty');
  const { error } = await sb.from('profiles').upsert({ id: currentUser.id, display_name: val });
  if (error) throw error;
}

async function fetchCloudSessions(){
  const { data, error } = await sb
    .from('sessions')
    .select('*')
    .eq('team', TEAM)
    .order('date', { ascending: true })
    .limit(5000);
  if (error) throw error;
  return (data || []).map((s) => ({
    _id: s.id,
    user: s.user_name,
    date: s.date,
    type: s.type,
    duration: SurftoberAwards.minutesToHHMM(s.duration_minutes),
    location: s.location,
    board: s.surf_craft,
    notes: s.notes,
    no_wetsuit: s.no_wetsuit ? 1 : 0,
    costume: s.costume ? 1 : 0,
    cleanup_items: s.cleanup_items || 0
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
  const payload = {
    team: TEAM,
    user_id: currentUser.id,
    user_name: row.user,
    date: row.date,
    type: row.type,
    duration_minutes: SurftoberAwards.hhmmToMinutes(row.duration) * (row.no_wetsuit ? 2 : 1),
    location: row.location || null,
    surf_craft: row.board || null,
    notes: row.notes || null,
    no_wetsuit: !!row.no_wetsuit,
    costume: !!row.costume,
    cleanup_items: Number(row.cleanup_items || 0),
    client_entry_id: crypto.randomUUID()
  };
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
  if (btnOut) btnOut.addEventListener('click', async () => {
    try {
      await signOut();
      document.getElementById('account-status').textContent = 'Signed out';
    } catch (e) {
      document.getElementById('account-status').textContent = 'Sign out error: ' + e.message;
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
        .concat(rows.map(r=>`<tr><td>${r.email}</td><td>${r.name}</td></tr>`))
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
      let { error: err1 } = await sb.from('sessions').delete().eq('user_id', currentUser.id);
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

function seedSample() {
  const sample = [
    { user: 'Jason', date: '2025-10-03', type: 'surf', duration: '02:10', location: 'OB - Lawton', board: 'PPE', notes: 'Clean but a bit walled', no_wetsuit: 0, costume: 0, cleanup_items: 0 },
    { user: 'Jason', date: '2025-10-08', type: 'surf', duration: '03:48', location: 'OB - Lawton', board: 'PPE', notes: 'Marathon day', no_wetsuit: 0, costume: 0, cleanup_items: 0 },
    { user: 'Nic', date: '2025-10-09', type: 'surf', duration: '01:30', location: 'OB - Lawton', board: 'Shortboard', notes: 'Speedo sesh', no_wetsuit: 1, costume: 0, cleanup_items: 0 },
    { user: 'Nic', date: '2025-10-20', type: 'surf', duration: '01:54', location: 'OB - Lawton', board: 'Shortboard', notes: 'All OB all month', no_wetsuit: 1, costume: 0, cleanup_items: 0 },
    { user: 'Nahla', date: '2025-10-22', type: 'surf', duration: '02:15', location: 'OB - Noriega', board: 'Mid', notes: 'Streak day 20', no_wetsuit: 0, costume: 0, cleanup_items: 0 },
    { user: 'Nahla', date: '2025-10-24', type: 'surf', duration: '02:05', location: 'OB - Noriega', board: 'Mid', notes: 'Twofer day', no_wetsuit: 0, costume: 0, cleanup_items: 0 },
    { user: 'Pam', date: '2025-10-05', type: 'surf', duration: '01:10', location: 'OB - Kellys', board: 'Log', notes: 'With friends: Jason, Nic', no_wetsuit: 0, costume: 0, cleanup_items: 0 },
    { user: 'Pam', date: '2025-10-17', type: 'cleanup', duration: '01:00', location: 'OB', board: 'cleanup', notes: 'Picked up 80 items', no_wetsuit: 0, costume: 0, cleanup_items: 80 },
    { user: 'Chase', date: '2025-10-12', type: 'kitesurf', duration: '01:35', location: 'OB - Moraga', board: 'TwinTip', notes: 'Great wind; high five with Nick', no_wetsuit: 0, costume: 0, cleanup_items: 0 },
    { user: 'Chase', date: '2025-10-26', type: 'surf', duration: '01:20', location: 'OB - Kirkham', board: 'Step Up', notes: 'Inner bar smashy', no_wetsuit: 0, costume: 0, cleanup_items: 0 }
  ].map(SurftoberAwards.normalizeSession);
  saveSessions(sample);
}

function appendSession(row) {
  const all = loadSessions();
  all.push(SurftoberAwards.normalizeSession(row));
  saveSessions(all);
}

function toCSV(rows) {
  const header = ['user', 'date', 'type', 'duration', 'location', 'board', 'notes', 'no_wetsuit', 'costume', 'cleanup_items'];
  const esc = (v) => '"' + String(v || '').replace(/"/g, '""') + '"';
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.user, r.date, r.type, r.duration, r.location, r.board, r.notes, r.no_wetsuit ? 1 : 0, r.costume ? 1 : 0, r.cleanup_items || 0].map(esc).join(','));
  }
  return lines.join('\n');
}

function renderTabs() {
  const hash = location.hash.replace('#', '') || 'log';
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.remove('active'));
  const el = document.getElementById('page-' + hash);
  const tab = document.querySelector(`.tabs a[data-tab="${hash}"]`);
  if (el) el.classList.add('active');
  if (tab) tab.classList.add('active');
}

function initForm() {
  const f = document.getElementById('log-form');
  const defaultDate = '2025-10-15';
  document.getElementById('log-date').value = defaultDate;

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
    try {
      const d = new Date(dateStr);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const all = loadSessions();
      return all.some(
        (s) =>
          (s.user || '').trim() === user.trim() &&
          (() => {
            const ds = new Date(s.date);
            return ds.getFullYear() === y && ds.getMonth() + 1 === m;
          })() &&
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
    try {
      if (editingId && sb && currentUser) {
        await updateCloudSession(editingId, row);
        toast('Session updated', 'success');
        editingId = null;
        document.getElementById('btn-submit').textContent = 'Add Entry';
        document.getElementById('btn-cancel-edit').style.display = 'none';
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
      document.getElementById('log-date').value = defaultDate;
    } catch (e) {
      const st = document.getElementById('status');
      if (st) st.textContent = 'Save failed: ' + e.message;
      toast('Save failed: ' + e.message, 'error');
    }
  });
  // Cancel edit
  const btnCancel = document.getElementById('btn-cancel-edit');
  if (btnCancel) btnCancel.addEventListener('click', () => {
    editingId = null;
    document.getElementById('btn-submit').textContent = 'Add Entry';
    document.getElementById('btn-cancel-edit').style.display = 'none';
    f.reset();
    document.getElementById('log-date').value = defaultDate;
  });
  document.getElementById('btn-repeat-last').addEventListener('click', () => {
    const all = loadSessions();
    const last = all[all.length - 1];
    if (!last) return;
    document.getElementById('log-user').value = last.user;
    document.getElementById('log-type').value = last.type;
    document.getElementById('log-location').value = last.location;
    document.getElementById('log-board').value = last.board;
    document.getElementById('log-notes').value = last.notes || '';
    document.getElementById('log-no-wetsuit').checked = !!last.no_wetsuit;
    document.getElementById('log-costume').checked = !!last.costume;
  });
}

// Editing state and helpers (top-level)
let editingId = null; // UUID of session being edited (cloud), null when not editing

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
}

async function updateCloudSession(id, row){
  // Update allowed only for owner; server RLS will enforce user_id = auth.uid()
  const payload = {
    date: row.date,
    type: row.type,
    duration_minutes: SurftoberAwards.hhmmToMinutes(row.duration) * (row.no_wetsuit ? 2 : 1),
    location: row.location || null,
    surf_craft: row.board || null,
    notes: row.notes || null,
    no_wetsuit: !!row.no_wetsuit,
    costume: !!row.costume,
    cleanup_items: Number(row.cleanup_items||0),
    user_name: profileName || row.user,
  };
  const { error } = await sb.from('sessions').update(payload).eq('id', id);
  if (error) throw error;
}

function renderRecent() {
  const container = document.getElementById('recent-entries');
  const all = loadSessions().slice(-10).reverse();
  container.innerHTML = all
    .map((r) => {
      const canEdit = !!currentUser && !!profileName && r.user === profileName && r._id;
      const edit = canEdit ? `<div><a class="edit-link" data-id="${r._id}">Edit</a></div>` : '';
      return `<div class="card"><div><b>${r.user}</b> · ${r.date} · ${r.type}</div>
      <div>${r.location || ''} · ${r.board || ''}</div>
      <div>${r.duration} (${SurftoberAwards.minutesToHHMM(r.base_minutes)}) ${r.no_wetsuit ? '<span class="badge">No wetsuit</span>' : ''} ${
        r.costume ? '<span class="badge">Costume</span>' : ''
      } ${r.cleanup_items ? `<span class="badge">Cleanup ${r.cleanup_items}</span>` : ''}</div>
      <div>${r.notes || ''}</div>${edit}</div>`;
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

function renderMyStats() {
  const user = document.getElementById('me-user').value.trim();
  const year = Number(document.getElementById('me-year').value);
  const month = Number(document.getElementById('me-month').value);
  const all = loadSessions();
  const normalized = all.map(SurftoberAwards.normalizeSession);
  const mine = normalized.filter((s) => !user || s.user === user);
  const totals = SurftoberAwards.rollupByUser(mine, { year, month });
  const summary = document.getElementById('me-summary');
  summary.innerHTML =
    totals
      .map(
        (t) =>
          `<div class="card"><h3>${t.user}</h3>
     <div>Total Hours: ${t.total_hours.toFixed(1)} <span class="badge ${t.medal.toLowerCase()}">${t.medal}</span></div>
     <div>Boards: ${t.boards} · Locations: ${t.locations}</div>
     <div>Std Dev: ${t.stddev.toFixed(1)} min · Twofer days: ${t.twofer_days}</div>
     <div>Weekend: ${Math.round(t.weekendShare * 100)}% · Weekday: ${Math.round(t.weekdayShare * 100)}%</div>
     <div>First Half: ${Math.round(t.firstHalfShare * 100)}% · Last Half: ${Math.round(t.lastHalfShare * 100)}%</div>
    </div>`
      )
      .join('') || '<div class="hint">No data</div>';

  // Table of sessions
  const sessions = mine
    .filter((s) => SurftoberAwards.minutesToHHMM)
    .filter((s) => {
      const d = new Date(s.date);
      const okY = !year || d.getFullYear() === year;
      const okM = !month || d.getMonth() + 1 === month;
      return okY && okM;
    });
  // Determine which session (if any) gets the one-time costume +1h in this period
  let costumeIdx = -1;
  let earliest = null;
  sessions.forEach((s, i) => {
    if (!s.costume) return;
    const ts = new Date(s.date).getTime();
    if (earliest === null || ts < earliest || (ts === earliest && i < costumeIdx)) {
      earliest = ts;
      costumeIdx = i;
    }
  });
  const tbl = [
    `<table><thead><tr><th>Date</th><th>Type</th><th>Dur</th><th>Scored</th><th>Bonuses</th><th>Location</th><th>Surf craft</th><th>Notes</th><th></th></tr></thead><tbody>`
  ];
  sessions.forEach((s, i) => {
    const costumeApplied = i === costumeIdx;
    const scoredMins = s.base_minutes + (costumeApplied ? 60 : 0);
    const bonusBadges = [
      s.no_wetsuit ? '<span class="badge">No Wetsuit ×2</span>' : '',
      costumeApplied ? '<span class="badge">Costume +1h</span>' : '',
      s.type === 'cleanup' ? '<span class="badge">Cleanup</span>' : ''
    ]
      .filter(Boolean)
      .join(' ');
    const canEdit = !!currentUser && !!profileName && s.user === profileName && s._id;
    const edit = canEdit ? `<a class="edit-link" data-id="${s._id}">Edit</a>` : '';
    tbl.push(
      `<tr><td>${s.date}</td><td>${s.type}</td><td>${s.duration}</td><td>${SurftoberAwards.minutesToHHMM(
        scoredMins
      )}</td><td>${bonusBadges}</td><td>${s.location || ''}</td><td>${s.board || ''}</td><td>${s.notes || ''}</td><td>${edit}</td></tr>`
    );
  });
  tbl.push('</tbody></table>');
  document.getElementById('me-sessions').innerHTML = tbl.join('');
  // Attach edit handlers in My Stats
  document.querySelectorAll('#me-sessions .edit-link').forEach((a) => {
    a.addEventListener('click', () => {
      const id = a.getAttribute('data-id');
      const allSess = loadSessions();
      const s = allSess.find((x) => x._id === id);
      if (s) {
        location.hash = '#log';
        startEditSession(s);
      }
    });
  });
}

function renderLeaderboard() {
  const year = Number(document.getElementById('lb-year').value);
  const month = Number(document.getElementById('lb-month').value);
  const totals = SurftoberAwards.rollupByUser(loadSessions().map(SurftoberAwards.normalizeSession), { year, month });
  const rows = totals.map(
    (t, i) => `<tr><td>${i + 1}</td><td>${t.user}</td><td>${t.total_hours.toFixed(1)}</td><td><span class="badge ${t.medal.toLowerCase()}">${t.medal}</span></td></tr>`
  );
  document.getElementById('leaderboard').innerHTML = `<table><thead><tr><th>#</th><th>User</th><th>Hours</th><th>Medal</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

function renderAwards() {
  const year = Number(document.getElementById('aw-year').value);
  const month = Number(document.getElementById('aw-month').value);
  const { awards } = SurftoberAwards.computeAwards(loadSessions().map(SurftoberAwards.normalizeSession), { year, month });
  const cards = awards.map(
    (a) => `<div class="card"><h3>${a.name}</h3><div>${a.desc}</div><div><b>${a.winner}</b> — ${a.value}</div></div>`
  );
  document.getElementById('awards').innerHTML = cards.join('') || '<div class="hint">No awards for period</div>';
}

function exportAwards() {
  const year = Number(document.getElementById('aw-year').value);
  const month = Number(document.getElementById('aw-month').value);
  const data = SurftoberAwards.computeAwards(loadSessions().map(SurftoberAwards.normalizeSession), { year, month });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `awards_${year}_${month || 'all'}.json`;
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
        const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
        const headers = headerLine.split(',').map((h) => h.replace(/^"|"$/g, ''));
        const rows = [];
        for (const line of lines) {
          const cols = line.match(/\"([^\"]*)\"|[^,]+/g)?.map((s) => s.replace(/^\"|\"$/g, '')) || [];
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
  document.getElementById('user-list').innerHTML = users.map((u) => `<option value="${u}">`).join('');
  document.getElementById('location-list').innerHTML = locs.map((u) => `<option value="${u}">`).join('');
  document.getElementById('board-list').innerHTML = boards.map((u) => `<option value="${u}">`).join('');
}

function openPrintSlides() {
  const w = window.open('', 'slides');
  const year = Number(document.getElementById('aw-year').value);
  const month = Number(document.getElementById('aw-month').value);
  const { awards, totals } = SurftoberAwards.computeAwards(loadSessions().map(SurftoberAwards.normalizeSession), { year, month });
  const style = `<style>body{font-family:system-ui;margin:0;background:#111;color:#fff}section{page-break-after:always;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:5vw}h1{font-size:6vw;margin:0}.sub{opacity:.8;margin-top:1vw}table{width:80%;margin:2vw auto;border-collapse:collapse}td,th{border-bottom:1px solid #333;padding:.5vw 1vw;text-align:left}</style>`;
  const lbRows = totals
    .map((t, i) => `<tr><td>${i + 1}</td><td>${t.user}</td><td>${t.total_hours.toFixed(1)}</td><td>${t.medal}</td></tr>`)
    .join('');
  const pages = [
    `<section><div><h1>Surftober Awards</h1><div class="sub">${year}${month ? ` — Month ${month}` : ''}</div></div></section>`,
    `<section><div><h1>Leaderboard</h1><table><thead><tr><th>#</th><th>User</th><th>Hours</th><th>Medal</th></tr></thead><tbody>${lbRows}</tbody></table></div></section>`,
    ...awards.map(
      (a) =>
        `<section><div><h1>${a.name}</h1><div class="sub">${a.desc}</div><h1>${a.winner}</h1><div class="sub">${a.value}</div></div></section>`
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
  renderTabs();
  initForm();
  attachAccountHandlers();
  renderRecent();
  renderMyStats();
  renderLeaderboard();
  renderAwards();
  registerSW();
  // Handlers
  document.getElementById('lb-year').addEventListener('input', renderLeaderboard);
  document.getElementById('lb-month').addEventListener('change', renderLeaderboard);
  document.getElementById('me-user').addEventListener('input', () => {
    renderMyStats();
  });
  document.getElementById('me-year').addEventListener('input', renderMyStats);
  document.getElementById('me-month').addEventListener('change', renderMyStats);
  document.getElementById('aw-year').addEventListener('input', () => {
    renderAwards();
  });
  document.getElementById('aw-month').addEventListener('change', () => {
    renderAwards();
  });
  document.getElementById('btn-compute-awards').addEventListener('click', renderAwards);
  document.getElementById('btn-export-awards').addEventListener('click', exportAwards);
  document.getElementById('btn-awards-slides').addEventListener('click', openPrintSlides);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  const btnFactory = document.getElementById('btn-factory-reset');
  if (btnFactory) btnFactory.addEventListener('click', factoryResetThisDevice);
  const btnNuclear = document.getElementById('btn-nuclear-wipe');
  if (btnNuclear) btnNuclear.addEventListener('click', nuclearWipeAll);
  document.getElementById('btn-load-sample').addEventListener('click', () => {
    seedSample();
    populateDataLists();
    renderRecent();
    renderMyStats();
    renderLeaderboard();
    renderAwards();
  });
  document.getElementById('btn-clear').addEventListener('click', () => {
    saveSessions([]);
    populateDataLists();
    renderRecent();
    renderMyStats();
    renderLeaderboard();
    renderAwards();
  });
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
