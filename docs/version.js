// Surftober deploy marker — bump APP_VERSION on every deploy.
// Served network-first (see sw.js), so the live value updates the moment a
// deploy lands. Use it to confirm a push made it through the CDN + caches.
window.APP_VERSION = 'v1.8.0 · 2026-08-04';

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
