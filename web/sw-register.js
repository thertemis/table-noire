/* sw-register.js — service worker registration (moved out of index.html for the CSP). */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // a new version took over an already-controlled page: reload once to run the new code
  const hadController = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
}
