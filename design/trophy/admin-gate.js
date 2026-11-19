// Trophy pages are admin-only on the live site, reached from Account → Admin Tools → Trophy.
// Same client-side gate as the app's own Admin page (app.js adminEmails + reflectAdminVisibility):
// it keeps the pages out of everyone else's way, it does not secure them (the files stay
// fetchable by anyone who has the URL; vercel.json marks /trophy/ noindex). Loaded first in
// <head>, before anything renders. Local dev (cad/serve.py) and Vercel previews stay open.
(function () {
  if (!/(^|\.)surftober\.com$/.test(location.hostname)) return;
  var ADMINS = ['ciniper@gmail.com'];   // keep in step with adminEmails in docs/app.js
  var email = '';
  try {
    // supabase-js v2 keeps the signed-in session under 'sb-<project-ref>-auth-token'
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) {
        var s = JSON.parse(localStorage.getItem(k) || 'null');
        var u = s && (s.user || (s.currentSession && s.currentSession.user));
        if (u && u.email) email = String(u.email).toLowerCase();
      }
    }
  } catch (e) { /* no storage → not signed in */ }
  if (ADMINS.indexOf(email) < 0) {
    document.documentElement.style.display = 'none';
    location.replace('/');
  }
})();
