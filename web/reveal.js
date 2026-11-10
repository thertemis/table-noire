/* reveal.js — the GM shows something to the whole table.
   campaigns.reveal (JSON) = { id, kind: 'lore' | 'map' | 'image', title, md?, img?, at, closed? }, written by the GM
   (admin updateCampaign) and received live by the players (tn:campaign event), who get it full screen.
   The content travels with the reveal, so a GM-only article can be shown without changing its visibility. */

const REVEAL = { seen: new Set() };
const revealState = () => { try { return JSON.parse(ME.camp?.reveal || 'null'); } catch (_) { return null; } };
const seenKey = () => `tn.reveal.${ME.camp?.$id}`;
try { (JSON.parse(localStorage.getItem('tn.reveal.seen') || '[]')).forEach(id => REVEAL.seen.add(id)); } catch (_) {}
const markSeen = id => { REVEAL.seen.add(id); try { localStorage.setItem('tn.reveal.seen', JSON.stringify([...REVEAL.seen].slice(-50))); } catch (_) {} };

const revealBox = Object.assign(document.createElement('div'), { id: 'revealBox', hidden: true });
document.body.appendChild(revealBox);
function showReveal(r) {
  revealBox.innerHTML = `<div class="rv-card" role="dialog" aria-modal="true" aria-label="${esc(r.title)}">
    <div class="rv-head"><span class="led"></span><span class="rv-from">Le MJ vous montre</span><span class="grow"></span><button class="iconbtn" data-rv-close aria-label="Fermer">${ic('x', 14)}</button></div>
    <h2>${esc(r.title)}</h2>
    <div class="rv-body">${r.kind === 'lore' ? `<div class="md">${mdHtml(r.md || '')}</div>` : `<img src="${esc(r.img || '')}" alt="${esc(r.title)}">`}</div></div>`;
  revealBox.hidden = false;
  try { sfx.flip(); } catch (_) {}
}
function closeReveal() { const r = revealState(); if (r) markSeen(r.id); revealBox.hidden = true; revealBox.innerHTML = ''; }
revealBox.addEventListener('click', e => { if (e.target === revealBox || e.target.closest('[data-rv-close]')) closeReveal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !revealBox.hidden) closeReveal(); });

function maybeShow(fresh) {
  const r = revealState();
  if (!r || isGmHere()) return;
  if (r.closed) { if (!revealBox.hidden) { revealBox.hidden = true; } return; }
  if (REVEAL.seen.has(r.id)) return;
  if (!fresh && Date.now() - (r.at || 0) > 15 * 60 * 1000) return;   // on arrival, only recent reveals
  showReveal(r);
}
document.addEventListener('tn:campaign', ev => { if ('reveal' in ev.detail) maybeShow(true); });
const _enterReveal = enterCampaign;
enterCampaign = async function (id) { await _enterReveal(id); maybeShow(false); };

async function sendReveal(r) {
  const payload = { id: 'r_' + uid() + Date.now().toString(36), at: Date.now(), ...r };
  const json = JSON.stringify(payload);
  if (json.length > 60000) { toast('Trop lourd à montrer (texte trop long).'); return; }
  try { await admin('updateCampaign', { campaignId: ME.camp.$id, reveal: json }); ME.camp.reveal = json; toast(`Montré à la table : ${r.title}`); }
  catch (e) { toast('Impossible de montrer : ' + errMsg(e)); }
}

/* GM buttons: lore article, map, any image */
const _renderLoreReveal = renderLore;
renderLore = function () {
  const html = _renderLoreReveal();
  if (!ME.camp || !isGmHere() || S.loreEdit || !LORE.find(a => a.id === S.loreSel)) return html;
  return html.replace(/<button class="btn[^"]*" data-act="loreEdit"/, m => `<button class="btn" data-act="revealLore">${ic('eye')}Montrer à la table</button>` + m);
};
const _renderMapReveal = renderMap;
renderMap = function () {
  const html = _renderMapReveal();
  if (S.tab !== 'carte' || !ME.camp || !isGmHere() || !MAPS[S.map]) return html;
  return html.replace('<button class="btn" data-act="importMap">', `<button class="btn" data-act="revealMap">${ic('eye')}Montrer la carte</button><button class="btn" data-act="importMap">`);
};
const _renderHeaderReveal = renderHeader;
renderHeader = function () {
  _renderHeaderReveal();
  const slot = $('#adminSlot');
  if (false && ME.camp && isGmHere() && slot && !slot.querySelector('[data-act="revealImage"]'))   // now in "Outils MJ" (gmtools.js)
    slot.insertAdjacentHTML('afterbegin', `<button class="btn" data-act="revealImage" title="Montrer une image à toute la table">${ic('eye')}Montrer</button>`);
};
ACT.revealLore = () => { const a = LORE.find(x => x.id === S.loreSel); if (a) sendReveal({ kind: 'lore', title: a.title, md: a.md }); return false; };
ACT.revealMap = () => {
  const m = MAPS[S.map]; if (!m) return false;
  if (String(m.img || '').startsWith('data:')) { toast('La carte est encore en cours d’envoi, réessaie dans un instant.'); return false; }
  sendReveal({ kind: 'map', title: m.name, img: m.img }); return false;
};
ACT.revealImage = () => {
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
  input.onchange = async () => {
    const f = input.files[0]; if (!f) return;
    const title = (prompt('Titre affiché aux joueurs', f.name.replace(/\.[^.]+$/, '')) || '').trim(); if (!title) return;
    try {
      toast('Envoi de l’image…');
      const up = await new Appwrite.Storage(AW.c).createFile({ bucketId: 'lore-images', fileId: Appwrite.ID.unique(), file: await toWebp(f, 2560, f.name), permissions: await teamReadPerms() });
      await sendReveal({ kind: 'image', title, img: fileUrl('lore-images', up.$id) });
    } catch (e) { toast('Image refusée : ' + errMsg(e)); }
  };
  input.click();
  return false;
};

const revealCss = document.createElement('style');
revealCss.textContent = `
#revealBox{position:fixed;inset:0;z-index:96;display:grid;place-items:center;padding:16px;background:rgba(10,9,8,.8);animation:pop .2s ease-out}
#revealBox[hidden]{display:none}
.rv-card{width:min(860px,100%);max-height:calc(100dvh - 32px);display:flex;flex-direction:column;gap:10px;padding:14px 16px 16px;border-radius:12px;
  background:var(--noise),linear-gradient(180deg,var(--panel-a),var(--panel-b));box-shadow:inset 0 1px 0 rgba(255,240,215,.08),0 3px 0 #0b0a09,0 30px 60px rgba(0,0,0,.7)}
.rv-head{display:flex;align-items:center;gap:8px}
.rv-from{font:400 9.5px var(--f-display);letter-spacing:.18em;text-transform:uppercase;color:var(--mute)}
.rv-card h2{margin:0;font:400 18px/1.25 var(--f-display);letter-spacing:.06em;color:var(--cream)}
.rv-body{overflow:auto;min-height:0;border-radius:6px}
.rv-body img{display:block;max-width:100%;max-height:72dvh;margin:0 auto;border-radius:6px;box-shadow:0 0 0 1px rgba(0,0,0,.5)}
.rv-body .md{padding:14px 16px;border-radius:6px;color:var(--paper-ink);background:var(--noise),linear-gradient(#efe7d5,#e4dbc6)}`;
document.head.appendChild(revealCss);
