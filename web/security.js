/* security.js — defence in depth for content written by other users.
   - Markdown (lore, session journal, reveals, player journal) is rendered by marked, then sanitised by DOMPurify:
     no scripts, event handlers or javascript: links, whoever wrote the text.
   - Portraits are JSON written by players (player-action setPortrait validates it too): only known, harmless values
     are kept before they reach the HTML / SVG attributes. */

const _mdHtmlSafe = mdHtml;
mdHtml = function (md) {
  const html = _mdHtmlSafe(md);
  if (!window.DOMPurify) return `<pre style="white-space:pre-wrap">${esc(md)}</pre>`;   // never render unsanitised HTML
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe'], FORBID_ATTR: ['style'] });
};
// links in Markdown open in a new tab without access to this page
if (window.DOMPurify) DOMPurify.addHook('afterSanitizeAttributes', n => { if (n.tagName === 'A' && n.getAttribute('href')) { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer'); } });

const PORTRAIT_SRC = new RegExp('^(' + TN_CONFIG.endpoint.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  + String.raw`\/storage\/buckets\/portraits\/files\/[A-Za-z0-9._-]{1,36}\/view\?project=[A-Za-z0-9]+|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$`);
function cleanPortrait(p) {
  if (!p || typeof p !== 'object') return null;
  if (p.type === 'img') return PORTRAIT_SRC.test(String(p.src || '')) ? { type: 'img', src: p.src, ...(p.fileId && /^[A-Za-z0-9._-]{1,36}$/.test(p.fileId) ? { fileId: p.fileId } : {}) } : null;
  const out = { type: 'gen', style: /^[a-z]{2,16}$/.test(p.style || '') ? p.style : 'croquis', p: {} };
  for (const [k, v] of Object.entries(p.p || p.cfg || {})) {
    if (!/^[A-Za-z0-9]{1,16}$/.test(k)) continue;
    if (Number.isInteger(v) && v >= 0 && v <= 99) out.p[k] = v;
    else if (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v)) out.p[k] = v;
  }
  return out;
}

/* Images are re-encoded before upload: scaled down to maxDim, saved as WebP. Lighter files, faster maps, and the
   photo metadata (EXIF, GPS position…) is dropped. Falls back to the original file if the browser cannot decode it. */
async function toWebp(blob, maxDim = 2048, name = 'image') {
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const cv = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close?.();
    const out = await new Promise(r => cv.toBlob(r, 'image/webp', 0.85));
    if (!out || out.type !== 'image/webp') throw new Error('webp');
    return new File([out], `${String(name).replace(/\.[^.]+$/, '') || 'image'}.webp`, { type: 'image/webp' });
  } catch (_) { return blob instanceof File ? blob : new File([blob], `${name}.${(blob.type.split('/')[1] || 'png')}`, { type: blob.type }); }
}

/* An expired or revoked session made every call fail silently: back to the login screen with a message.
   Only the "no session" error (guest scope) triggers it, not the permission errors of a signed-in user. */
{
  const _call = AW.c.call.bind(AW.c);
  let expired = false;
  AW.c.call = async (...args) => {
    try { return await _call(...args); }
    catch (e) {
      if (!expired && ME.user && e && e.code === 401 && /general_unauthorized_scope|user_session_not_found|user_jwt_invalid/.test(e.type || '')) {
        expired = true;
        try { localStorage.setItem('tn.expired', '1'); } catch (_) {}
        location.reload();
      }
      throw e;
    }
  };
  // without a session the lists simply come back empty: check the session itself, on return to the tab and every 2 minutes
  const checkSession = () => { if (ME.user && !expired && navigator.onLine) AW.account.get().catch(() => {}); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkSession(); });
  setInterval(checkSession, 120000);
  try { if (localStorage.getItem('tn.expired')) { localStorage.removeItem('tn.expired'); setTimeout(() => { if (typeof gateErr === 'function') gateErr('Ta session a expiré : reconnecte-toi.'); }, 800); } } catch (_) {}
}
