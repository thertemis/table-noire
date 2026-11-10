// image-search — online image search for portraits and item illustrations (signed-in users).
// Body: { "action": "search", "source": "pixabay" | "ddg", "q": "..." }  -> { ok, results: [{ thumb, url, title, author, licence }] }
//       { "action": "fetch", "url": "https://..." }                      -> { ok, dataUrl }   (the browser cannot read these hosts)
// Pixabay: the key is the function variable PIXABAY_KEY (set in the Appwrite console), shared by every user, never sent to clients.
// DuckDuckGo has no official API: its image results page is read like a browser would (may break when they change it).
// fetch only follows public http(s) addresses (no LAN / loopback: the function runs on the NAS) and returns images only.
import { lookup } from 'node:dns/promises';
import net from 'node:net';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX = 6 * 1024 * 1024;
const fail = (res, status, message) => res.json({ ok: false, message }, status);

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:') && privateIp(v.slice(7));
}
async function safeUrl(raw) {
  let u; try { u = new URL(raw); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return null;
  const addrs = await lookup(u.hostname, { all: true }).catch(() => []);
  if (!addrs.length || addrs.some(a => privateIp(a.address))) return null;
  return u;
}
async function fetchImage(raw) {
  let url = raw;
  for (let hop = 0; hop < 4; hop++) {   // redirects are followed by hand, each target checked again
    const u = await safeUrl(url); if (!u) throw new Error('Adresse refusée.');
    const r = await fetch(u, { redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'image/*' }, signal: AbortSignal.timeout(12000) });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), u).href; continue; }
    if (!r.ok) throw new Error(`Image indisponible (HTTP ${r.status}).`);
    const type = (r.headers.get('content-type') || '').split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) throw new Error('Ce n’est pas une image.');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX) throw new Error('Image trop lourde.');
    return `data:${type};base64,${buf.toString('base64')}`;
  }
  throw new Error('Trop de redirections.');
}

async function pixabay(q) {
  const key = process.env.PIXABAY_KEY;
  if (!key) throw Object.assign(new Error('Pixabay n’est pas configuré : ajoute la variable PIXABAY_KEY à la fonction image-search dans la console Appwrite.'), { status: 503 });
  const r = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&per_page=30&safesearch=true&lang=fr`, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`Pixabay a refusé la recherche (HTTP ${r.status}).`);
  const j = await r.json();
  return (j.hits || []).map(h => ({ thumb: h.previewURL || h.webformatURL, url: h.largeImageURL || h.webformatURL, title: h.tags || '', author: h.user || '', licence: 'Licence Pixabay' }));
}
async function ddg(q) {
  const h = { 'User-Agent': UA, Referer: 'https://duckduckgo.com/', 'Accept-Language': 'fr-FR,fr;q=0.9' };
  const page = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`, { headers: h, signal: AbortSignal.timeout(12000) }).then(r => r.text());
  const vqd = /vqd=["']?([\d-]+)/.exec(page)?.[1];
  if (!vqd) throw new Error('DuckDuckGo ne répond pas pour l’instant (protection anti-robots). Réessaie plus tard ou utilise un autre onglet.');
  const r = await fetch(`https://duckduckgo.com/i.js?l=fr-fr&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,,,&p=1`, { headers: h, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`DuckDuckGo a refusé la recherche (HTTP ${r.status}).`);
  const j = await r.json();
  return (j.results || []).slice(0, 40).map(x => ({ thumb: x.thumbnail, url: x.image, title: x.title || '', author: (() => { try { return new URL(x.image).hostname.replace(/^www\./, ''); } catch { return x.source || ''; } })(), licence: 'droits inconnus' }));
}

export default async ({ req, res, error }) => {
  if (!req.headers['x-appwrite-user-id']) return fail(res, 401, 'Connexion requise.');
  let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { return fail(res, 400, 'Requête illisible.'); }
  try {
    if (b.action === 'fetch') return res.json({ ok: true, dataUrl: await fetchImage(String(b.url || '')) });
    const q = String(b.q || '').trim().slice(0, 100);
    if (!q) return fail(res, 400, 'Recherche vide.');
    const results = b.source === 'pixabay' ? await pixabay(q) : b.source === 'ddg' ? await ddg(q) : null;
    if (!results) return fail(res, 400, 'Source inconnue.');
    return res.json({ ok: true, results: results.filter(x => x.thumb && x.url) });
  } catch (e) {
    error(String(e.stack || e));
    return fail(res, e.status || 502, e.message || 'Recherche impossible.');
  }
};
