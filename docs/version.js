// Surftober deploy marker — bump APP_VERSION on every deploy.
// Served network-first (see sw.js), so the live value updates the moment a
// deploy lands. Use it to confirm a push made it through the CDN + caches.
window.APP_VERSION = 'v1.34.0 · 2026-09-01';

// Crew photo album (Google Photos shared link). Lives HERE, not app.js,
// because this file is network-first: edit the link, push, done — no
// ?v= bump or SW cache dance needed. Empty string hides the 📷 button
// and the log-form hint. SWAP to the October album when the real event
// starts (see TODO.md).
window.CREW_ALBUM_URL = 'https://photos.app.goo.gl/DJin8nEzrymarTFv9';

(function () {
  console.log('[Surftober] ' + window.APP_VERSION);
  function render() {
    var nodes = document.querySelectorAll('.app-version');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = window.APP_VERSION;
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
