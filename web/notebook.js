/* notebook.js — "Carnet" tab: a private, paginated Markdown notebook per user and campaign.
   notebook_pages rows are created with read / update / delete for their author only: nobody else (players, GM)
   can read them. Pages are saved automatically while typing. */

const NB = { pages: [], loaded: null, cur: null, preview: false, timer: null, saving: false };
TABS.splice(TABS.findIndex(t => t[0] === 'carte'), 0, ['carnet', 'Carnet']);
const _renderMapNb = renderMap;
renderMap = function () { return S.tab === 'carnet' ? renderNotebook() : _renderMapNb(); };

const nbPerms = () => { const me = Appwrite.Role.user(ME.user.$id); return [Appwrite.Permission.read(me), Appwrite.Permission.update(me), Appwrite.Permission.delete(me)]; };
async function loadNotebook() {
  if (!ME.camp) return;
  NB.loaded = ME.camp.$id;
  try { NB.pages = await rows('notebook_pages', [AW.Q.equal('userId', ME.user.$id), AW.Q.equal('campaignId', ME.camp.$id), AW.Q.orderAsc('sort')]); }
  catch (e) { NB.pages = []; toast('Carnet indisponible : ' + errMsg(e)); }
  if (!NB.pages.find(p => p.$id === NB.cur)) NB.cur = NB.pages[0]?.$id || null;
  if (S.tab === 'carnet') render();
}
function renderNotebook() {
  if (NB.loaded !== ME.camp?.$id) { loadNotebook(); return '<p class="hint" style="padding:30px">Ouverture du carnet…</p>'; }
  const i = NB.pages.findIndex(p => p.$id === NB.cur), p = NB.pages[i];
  return `<div class="toolbar"><div><h2>Carnet</h2><div class="sub">Tes notes personnelles, en Markdown. Personne d’autre ne peut les lire, pas même le MJ.</div></div><span class="grow"></span>
      <button class="btn orange" data-act="nbNew">${ic('plus')}Nouvelle page</button></div>
    <div class="nb">
      <nav class="nb-pages well" aria-label="Pages">${NB.pages.length ? NB.pages.map((x, n) => `<button data-act="nbGo" data-id="${x.$id}" aria-current="${x.$id === NB.cur}"><span class="nb-n">${n + 1}</span><span>${esc(x.title || 'Sans titre')}</span></button>`).join('') : '<p class="hint" style="margin:6px">Aucune page.</p>'}</nav>
      ${p ? `<section class="nb-page tile" style="animation:none">
        <div class="nb-head"><input class="field nb-title" id="nbTitle" value="${esc(p.title || '')}" placeholder="Titre de la page" maxlength="128">
          <span class="grow"></span><span class="nb-save" id="nbSave">${NB.saving ? 'Enregistrement…' : 'Enregistré'}</span>
          <button class="btn xs ${NB.preview ? 'on' : ''}" data-act="nbPreview">${NB.preview ? ic('edit', 12) + 'Écrire' : ic('eye', 12) + 'Aperçu'}</button></div>
        ${NB.preview ? `<div class="md nb-md">${mdHtml(p.body || '') || '<p class="hint">Page vide.</p>'}</div>` : `<textarea class="field nb-body" id="nbBody" spellcheck="true" placeholder="Écris en Markdown : **gras**, *italique*, # titres, - listes…">${esc(p.body || '')}</textarea>`}
        <div class="nb-foot"><button class="btn xs" data-act="nbGo" data-id="${NB.pages[i - 1]?.$id || ''}" ${i > 0 ? '' : 'disabled'}>‹ Précédente</button>
          <span class="nb-count">Page ${i + 1} / ${NB.pages.length}</span>
          <button class="btn xs" data-act="nbGo" data-id="${NB.pages[i + 1]?.$id || ''}" ${i < NB.pages.length - 1 ? '' : 'disabled'}>Suivante ›</button>
          <span class="grow"></span>
          <button class="iconbtn" data-act="nbMove" data-d="-1" aria-label="Monter la page" ${i > 0 ? '' : 'disabled'}>${ic('minus', 12)}</button>
          <button class="iconbtn" data-act="nbMove" data-d="1" aria-label="Descendre la page" ${i < NB.pages.length - 1 ? '' : 'disabled'}>${ic('plus', 12)}</button>
          <button class="iconbtn" data-act="nbDel" aria-label="Supprimer la page">${ic('trash', 12)}</button></div></section>`
      : '<div class="empty-note well">Crée ta première page avec « Nouvelle page ».</div>'}
    </div>`;
}

async function nbSaveNow() {
  clearTimeout(NB.timer);
  const p = NB.pages.find(x => x.$id === NB.cur); if (!p || !p.__dirty) return;
  NB.saving = true; const s = $('#nbSave'); if (s) s.textContent = 'Enregistrement…';
  try { await AW.db.updateRow(T('notebook_pages', { rowId: p.$id, data: { title: (p.title || '').slice(0, 128), body: p.body || '' } })); p.__dirty = false; }
  catch (e) { toast('Page non enregistrée : ' + errMsg(e)); }
  NB.saving = false; const s2 = $('#nbSave'); if (s2) s2.textContent = p.__dirty ? 'Non enregistré' : 'Enregistré';
}
document.addEventListener('input', e => {
  if (e.target.id !== 'nbTitle' && e.target.id !== 'nbBody') return;
  const p = NB.pages.find(x => x.$id === NB.cur); if (!p) return;
  if (e.target.id === 'nbTitle') { p.title = e.target.value; const b = $(`.nb-pages [data-id="${p.$id}"] span:last-child`); if (b) b.textContent = p.title || 'Sans titre'; }
  else p.body = e.target.value;
  p.__dirty = true; const s = $('#nbSave'); if (s) s.textContent = 'Modifié…';
  clearTimeout(NB.timer); NB.timer = setTimeout(nbSaveNow, 900);
});

ACT.nbGo = d => { if (!d.id) return false; nbSaveNow(); NB.cur = d.id; };
ACT.nbPreview = () => { nbSaveNow(); NB.preview = !NB.preview; };
ACT.nbNew = () => {
  (async () => {
    await nbSaveNow();
    try {
      const sort = NB.pages.length ? Math.max(...NB.pages.map(p => p.sort || 0)) + 10 : 10;
      const r = await AW.db.createRow(T('notebook_pages', { rowId: Appwrite.ID.unique(), permissions: nbPerms(),
        data: { campaignId: ME.camp.$id, userId: ME.user.$id, sort, title: `Page ${NB.pages.length + 1}`, body: '' } }));
      NB.pages.push(r); NB.cur = r.$id; NB.preview = false; render(); $('#nbBody')?.focus();
    } catch (e) { toast('Page non créée : ' + errMsg(e)); }
  })();
  return false;
};
ACT.nbDel = () => {
  const p = NB.pages.find(x => x.$id === NB.cur); if (!p || !confirm(`Supprimer la page « ${p.title || 'Sans titre'} » ?`)) return false;
  AW.db.deleteRow(T('notebook_pages', { rowId: p.$id })).then(() => {
    const i = NB.pages.indexOf(p); NB.pages.splice(i, 1); NB.cur = (NB.pages[i] || NB.pages[i - 1] || {}).$id || null; render();
  }).catch(e => toast(errMsg(e)));
  return false;
};
ACT.nbMove = d => {
  const i = NB.pages.findIndex(x => x.$id === NB.cur), j = i + +d.d; if (i < 0 || j < 0 || j >= NB.pages.length) return false;
  [NB.pages[i], NB.pages[j]] = [NB.pages[j], NB.pages[i]];
  NB.pages.forEach((p, n) => { const s = (n + 1) * 10; if (p.sort !== s) { p.sort = s; AW.db.updateRow(T('notebook_pages', { rowId: p.$id, data: { sort: s } })).catch(() => {}); } });
};
const _leaveNb = leaveCampaign;
leaveCampaign = async function () { await nbSaveNow(); NB.loaded = null; NB.pages = []; NB.cur = null; return _leaveNb(); };

const nbCss = document.createElement('style');
nbCss.textContent = `
.nb{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;align-items:start}
.nb-pages{padding:8px;display:flex;flex-direction:column;gap:4px;max-height:70vh;overflow:auto}
.nb-pages button{display:flex;align-items:center;gap:8px;text-align:left;border:0;background:transparent;padding:8px 9px;border-radius:6px;cursor:pointer;color:var(--mute);font-weight:500}
.nb-pages button:hover{color:var(--ink);background:#22201c}
.nb-pages button[aria-current="true"]{color:var(--ink);background:linear-gradient(#3b3833,#2e2c27);box-shadow:inset 0 1px 0 rgba(255,240,215,.08),0 2px 0 #0b0a09}
.nb-n{display:inline-grid;place-items:center;min-width:22px;height:20px;border-radius:4px;font:600 11px var(--f-mono);color:var(--cream);background:linear-gradient(#2c2a26 50%,#222019 50%)}
.nb-page{display:flex;flex-direction:column;gap:10px}
.nb-head,.nb-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.nb-title{flex:1 1 220px;font:400 14px var(--f-display);letter-spacing:.04em}
.nb-body{min-height:52vh;resize:vertical;font:13.5px/1.55 var(--f-body)}
.nb-md{min-height:40vh;padding:14px 16px;border-radius:6px;color:var(--paper-ink);background:var(--noise),linear-gradient(#efe7d5,#e4dbc6)}
.nb-save,.nb-count{font:500 10.5px var(--f-mono);color:var(--mute)}
@media (max-width:900px){.nb{grid-template-columns:1fr}.nb-pages{max-height:none;flex-direction:row;flex-wrap:wrap}}`;
document.head.appendChild(nbCss);
