/* templates.js — sheet templates shared by every user, and the campaign sheet layout.
   A template = the campaign's sheet fields (field_defs: stats, gauges, counters, info fields, notes card)
   + its layout (tile order, widths, heights, custom tiles, tile visibility).
   - campaigns.sheetLayout keeps each campaign's layout (saved by the GM, debounced); it used to be lost on reload.
   - sheet_templates rows are readable / creatable by any signed-in user; the creator (and the admin) can delete them.
   - Applying (GM): "replace" makes the campaign sheet identical to the template (extra fields and their values
     are deleted, layout replaced); "merge" only adds the template's missing fields. Fields are matched by kind + label,
     so values already filled in are kept. */

const TPLS = { list: [], last: null, timer: null };
const layoutSnap = () => JSON.stringify({ order: S.tpl.order, spans: S.tpl.spans, custom: S.custom, tileVis: S.tileVis || {}, rows: S.rows || {} });
const DEFAULT_LAYOUT = layoutSnap();   // the mockup's layout, for campaigns that never saved one
function applyLayout(json) {
  let l; try { l = JSON.parse(json || 'null'); } catch (_) { l = null; }
  if (!l || !Array.isArray(l.order)) l = JSON.parse(DEFAULT_LAYOUT);
  S.tpl.order = l.order; S.tpl.spans = l.spans || {};
  const swap = (obj, val) => { for (const k of Object.keys(obj)) delete obj[k]; Object.assign(obj, val || {}); };
  swap(S.custom, l.custom); if (S.tileVis) swap(S.tileVis, l.tileVis); if (S.rows) swap(S.rows, l.rows);
}

/* ---------------------------------------------------------------- campaign layout persistence (GM) */
async function saveLayout() {
  clearTimeout(TPLS.timer);
  if (!ME.camp || !isGmHere()) return;
  const now = layoutSnap(); if (now === TPLS.last) return;
  TPLS.last = now;
  try { await admin('updateCampaign', { campaignId: ME.camp.$id, sheetLayout: now }); ME.camp.sheetLayout = now; }
  catch (e) { TPLS.last = null; toast('Disposition non enregistrée : ' + errMsg(e)); }
}
const _renderTpl = render;
render = function () {
  _renderTpl();
  if (ME.camp && isGmHere() && TPLS.last !== null && layoutSnap() !== TPLS.last) { clearTimeout(TPLS.timer); TPLS.timer = setTimeout(saveLayout, 1500); }
};
const _enterTpl = enterCampaign;
enterCampaign = async function (id) {
  TPLS.last = null;
  await _enterTpl(id);
  if (!ME.camp) return;
  applyLayout(ME.camp.sheetLayout);
  TPLS.last = layoutSnap();
  render();
};
const _leaveTpl = leaveCampaign;
leaveCampaign = async function () { if (ME.camp && TPLS.last !== null) await saveLayout(); TPLS.last = null; return _leaveTpl(); };

/* ---------------------------------------------------------------- templates modal */
const _renderFicheTpl = renderFiche;
renderFiche = function () {
  const html = _renderFicheTpl();
  if (!ME.camp || !isGmHere() || S.layoutEdit) return html;
  return html.replace(/<button class="btn[^"]*" data-act="layoutEdit"/, m => `<button class="btn" data-act="tplOpen">${ic('book')}Modèles</button>` + m);
};
ACT.tplOpen = () => { tplModal(); return false; };

function tplModal() {
  openModal(`<h3>Modèles de fiche</h3>
    <p class="hint" style="margin:0">Un modèle contient les champs de la fiche (statistiques, jauges, compteurs, informations) et sa disposition. Les modèles sont partagés avec tous les utilisateurs.</p>
    <form class="form" id="tplSave"><label class="full">Nom du modèle<input class="field" name="name" maxlength="128" placeholder="ex. Enquête contemporaine" required></label>
      <label class="full">Description<input class="field" name="description" maxlength="1000" placeholder="Pour quel jeu, quel ton…"></label>
      <div class="modal-acts full"><button class="btn orange" type="submit">${ic('plus')}Enregistrer la fiche actuelle comme modèle</button></div></form>
    <div id="tplList" class="tpl-list"><p class="hint">Chargement…</p></div>
    <div class="modal-acts"><button class="btn" data-act="closeModal">Fermer</button></div>`);
  loadTemplates();
}
async function loadTemplates() {
  try { TPLS.list = await rows('sheet_templates', [AW.Q.orderDesc('$createdAt')]); }
  catch (e) { const l = $('#tplList'); if (l) l.innerHTML = `<p class="hint">Modèles indisponibles : ${esc(errMsg(e))}</p>`; return; }
  const box = $('#tplList'); if (!box) return;
  const KIND = { stat: 'stat', gauge: 'jauge', counter: 'compteur', text: 'info', longtext: 'texte', card: 'carte' };
  box.innerHTML = TPLS.list.length ? TPLS.list.map(t => {
    let f = []; try { f = JSON.parse(t.fields || '[]'); } catch (_) {}
    const mine = t.ownerId === ME.user.$id || ME.isAdmin;
    return `<article class="tpl well"><div class="tpl-head"><b>${esc(t.name)}</b><small>par ${esc(t.ownerName || '?')} · ${f.length} champ${f.length > 1 ? 's' : ''} · ${fmtDate(t.$createdAt)}</small></div>
      ${t.description ? `<p>${esc(t.description)}</p>` : ''}
      <div class="tpl-chips">${f.slice(0, 18).map(x => `<span class="chip" title="${esc(KIND[x.kind] || x.kind)}">${esc(x.label)}</span>`).join('')}${f.length > 18 ? `<span class="chip">+${f.length - 18}</span>` : ''}</div>
      <div class="edit-row"><button class="btn xs orange" data-act="tplApply" data-id="${t.$id}" data-mode="replace">Appliquer</button>
        <button class="btn xs" data-act="tplApply" data-id="${t.$id}" data-mode="merge">Ajouter ses champs</button><span class="grow"></span>
        ${mine ? `<button class="iconbtn" data-act="tplDel" data-id="${t.$id}" aria-label="Supprimer le modèle">${ic('trash', 12)}</button>` : ''}</div></article>`;
  }).join('') : '<p class="hint">Aucun modèle pour l’instant.</p>';
}

document.addEventListener('submit', async e => {
  if (e.target.id !== 'tplSave') return;
  e.preventDefault(); e.stopImmediatePropagation();
  const fd = Object.fromEntries(new FormData(e.target));
  const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
  try {
    clearTimeout(SH.timer); await syncSheet();   // the template is taken from saved fields
    const fields = [...SH.defs.values()].sort((a, b) => (a.sort || 0) - (b.sort || 0))
      .map(d => ({ key: d.key, label: d.label, kind: d.kind, config: d.config || '{}', defaultVisibility: d.defaultVisibility || 'all', sort: d.sort || 0 }));
    if (!fields.length) throw new Error('La fiche de cette campagne n’a encore aucun champ.');
    await AW.db.createRow(T('sheet_templates', { rowId: Appwrite.ID.unique(), data: { name: fd.name.trim().slice(0, 128), description: (fd.description || '').trim().slice(0, 1000),
      ownerId: ME.user.$id, ownerName: (ME.user.name || '').slice(0, 64), fields: JSON.stringify(fields), layout: layoutSnap() } }));
    toast(`Modèle « ${fd.name.trim()} » enregistré`);
    e.target.reset();
  } catch (err) { toast('Modèle non enregistré : ' + errMsg(err)); }
  btn.disabled = false;
  loadTemplates();
}, true);

ACT.tplDel = d => {
  const t = TPLS.list.find(x => x.$id === d.id); if (!t) return false;
  if (!confirm(`Supprimer le modèle « ${t.name} » ? Il disparaîtra pour tous les utilisateurs.`)) return false;
  AW.db.deleteRow(T('sheet_templates', { rowId: t.$id })).then(() => { toast('Modèle supprimé'); loadTemplates(); }).catch(e => toast('Suppression impossible : ' + errMsg(e)));
  return false;
};
ACT.tplApply = d => {
  const t = TPLS.list.find(x => x.$id === d.id); if (!t) return false;
  const msg = d.mode === 'replace'
    ? `Appliquer « ${t.name} » à la campagne « ${ME.camp.name} » ?\n\nLa fiche de TOUS les personnages prendra ces champs et cette disposition. Les champs absents du modèle seront supprimés avec leurs valeurs. Les champs de même nom et de même type gardent leurs valeurs.`
    : `Ajouter à la fiche de la campagne les champs de « ${t.name} » qui manquent ? Rien n’est supprimé.`;
  if (!confirm(msg)) return false;
  closeModal(); applyTemplate(t, d.mode);
  return false;
};

async function applyTemplate(t, mode) {
  const c = ME.camp.$id;
  let fields = []; try { fields = JSON.parse(t.fields || '[]'); } catch (_) {}
  toast('Application du modèle…');
  try {
    clearTimeout(SH.timer); await syncSheet();
    const existing = await rows('field_defs', [AW.Q.equal('campaignId', c)]);
    const fam = k => (k === 'gauge' || k === 'counter' ? 'g' : k === 'text' || k === 'longtext' ? 't' : k);
    const norm = s => String(s || '').trim().toLowerCase();
    const used = new Set(), keys = new Set(existing.map(x => x.key));
    let added = 0, removed = 0;
    for (const [i, f] of fields.entries()) {
      const data = { label: String(f.label).slice(0, 128), kind: f.kind, config: f.config || '{}', defaultVisibility: f.defaultVisibility || 'all', sort: Number.isInteger(f.sort) ? f.sort : i * 10 };
      const m = existing.find(x => !used.has(x.$id) && fam(x.kind) === fam(f.kind) && norm(x.label) === norm(f.label));
      if (m) { used.add(m.$id); if (mode === 'replace') await AW.db.updateRow(T('field_defs', { rowId: m.$id, data })); continue; }
      const key = f.key && !keys.has(f.key) ? f.key : `${f.kind}_${Date.now().toString(36)}${i}`; keys.add(key);
      await AW.db.createRow(T('field_defs', { rowId: Appwrite.ID.unique(), data: { campaignId: c, key, ...data } })); added++;
    }
    if (mode === 'replace') {
      for (const x of existing) {
        if (used.has(x.$id)) continue;
        const vals = await rows('character_values', [AW.Q.equal('campaignId', c), AW.Q.equal('fieldId', x.$id)]).catch(() => []);
        for (const v of vals) await AW.db.deleteRow(T('character_values', { rowId: v.$id })).catch(() => {});
        await AW.db.deleteRow(T('field_defs', { rowId: x.$id })).catch(() => {});
        removed++;
      }
      if (t.layout) { applyLayout(t.layout); await saveLayout(); }
    }
    await loadSheet(SH.charId);
    toast(`Modèle appliqué : ${added} champ${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''}${mode === 'replace' ? `, ${removed} supprimé${removed > 1 ? 's' : ''}` : ''}.`);
  } catch (e) { toast('Modèle non appliqué : ' + errMsg(e)); await loadSheet(SH.charId); }
}

const tplCss = document.createElement('style');
tplCss.textContent = `
.tpl-list{display:flex;flex-direction:column;gap:10px;max-height:46vh;overflow:auto;padding-right:4px}
.tpl{padding:10px 12px;display:flex;flex-direction:column;gap:7px}
.tpl-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.tpl-head b{font:400 12px var(--f-display);letter-spacing:.08em}
.tpl-head small{font:500 10.5px var(--f-mono);color:var(--mute)}
.tpl p{margin:0;font-size:12.5px;color:var(--cream-lo)}
.tpl-chips{display:flex;flex-wrap:wrap;gap:4px}
.tpl-chips .chip{font-size:10.5px;padding:3px 6px}`;
document.head.appendChild(tplCss);
