/* gmtools.js — GM tools.
   - "Outils MJ" header button: one panel for initiative, reveals, NPCs, character copy, history, campaign copy.
   - Quick NPCs and character duplication (admin createCharacter / duplicateCharacter).
   - Change history of the sheet values (change_log, GM only) with "Rétablir".
   - Session journal tab "Séances" (session_log): entries for the GM only or for the whole table.
   - Campaign duplication (admin duplicateCampaign: template, libraries, lore, maps, settings). */

/* ---------------------------------------------------------------- header button + hub */
const _renderHeaderGm = renderHeader;
renderHeader = function () {
  _renderHeaderGm();
  const slot = $('#adminSlot');
  if (ME.camp && isGmHere() && slot && !slot.querySelector('[data-act="gmHub"]'))
    slot.insertAdjacentHTML('afterbegin', `<button class="btn orange" data-act="gmHub">${ic('grid')}Outils MJ</button>`);
};
ACT.gmHub = () => {
  const ch = ME.chars.find(c => c.$id === SH.charId);
  const tool = (act, icon, title, sub, dis = false) => `<button class="hub-tool" data-act="${act}" ${dis ? 'disabled' : ''}><span class="hub-ico">${ic(icon, 18)}</span><b>${title}</b><small>${sub}</small></button>`;
  openModal(`<h3>Outils MJ · ${esc(ME.camp.name)}</h3><div class="hub">
    ${tool('iniOpen', 'd20', 'Initiative', 'Ordre de passage partagé')}
    ${tool('revealImage', 'eye', 'Montrer une image', 'Plein écran chez les joueurs')}
    ${tool('npcNew', 'user', 'Nouveau PNJ', 'Fiche vierge, sans joueur')}
    ${tool('charDup', 'edit', 'Dupliquer le personnage', ch ? esc(ch.name) : 'Choisis d’abord un personnage', !ch)}
    ${tool('historyOpen', 'book', 'Historique', ch ? `Modifications de ${esc(ch.name)}` : 'Choisis d’abord un personnage', !ch)}
    ${tool('tabSeances', 'book', 'Journal de séance', `Séance ${ME.camp.sessionNo || 0}`)}
    ${tool('membersMgr', 'ticket', 'Joueurs & invitations', 'Membres, liens, personnages')}
    ${ME.isAdmin ? tool('campDup', 'grid', 'Dupliquer la campagne', 'Fiche, bibliothèques, lore, cartes') : ''}
  </div><div class="modal-acts"><button class="btn" data-act="closeModal">Fermer</button></div>`);
  $('#modalBox').classList.add('wide');
  return false;
};
// hub entries reuse the existing actions; the hub closes first
for (const k of ['iniOpen', 'revealImage', 'membersMgr']) { const orig = ACT[k]; ACT[k] = d => { if (!$('#modal').hidden && $('#modalBox .hub')) closeModal(); return orig(d); }; }
ACT.tabSeances = () => { closeModal(); S.tab = 'seances'; };

/* ---------------------------------------------------------------- NPCs and copies */
async function openChar(id) { await loadCharacters(); ACT.pickChar({ id }); renderHeader(); }
ACT.npcNew = () => {
  const name = (prompt('Nom du PNJ', 'Nouveau PNJ') || '').trim(); if (!name) return false;
  closeModal();
  admin('createCharacter', { campaignId: ME.camp.$id, name, kind: 'npc' }).then(r => { toast(`PNJ « ${name} » créé`); return openChar(r.id); }).catch(e => toast(errMsg(e)));
  return false;
};
ACT.charDup = () => {
  const ch = ME.chars.find(c => c.$id === SH.charId); if (!ch) return false;
  const name = (prompt('Nom de la copie', `${ch.name} (copie)`) || '').trim(); if (!name) return false;
  closeModal();
  (async () => {
    clearTimeout(SH.timer); await syncSheet(); clearTimeout(IV.timer); await syncInventory();   // copy what is saved
    try { const r = await admin('duplicateCharacter', { characterId: ch.$id, name }); toast(`Copie « ${r.name} » créée (PNJ, sans joueur)`); await openChar(r.id); }
    catch (e) { toast('Copie impossible : ' + errMsg(e)); }
  })();
  return false;
};
ACT.campDup = () => {
  const name = (prompt('Nom de la nouvelle campagne', `${ME.camp.name} (copie)`) || '').trim(); if (!name) return false;
  closeModal(); toast('Copie de la campagne en cours…');
  (async () => {
    await flushSaves();
    try {
      const r = await admin('duplicateCampaign', { campaignId: ME.camp.$id, name, gmUserId: ME.camp.gmUserId || ME.user.$id });
      const n = r.counts || {};
      toast(`« ${r.name} » créée : ${n.field_defs || 0} champs, ${n.item_defs || 0} objets, ${n.skill_defs || 0} compétences, ${n.lore_articles || 0} articles, ${n.maps || 0} cartes.`);
      if (confirm(`Campagne « ${r.name} » créée. L’ouvrir maintenant ?`)) { await leaveCampaign(); await enterCampaign(r.id); }
    } catch (e) { toast('Copie impossible : ' + errMsg(e)); }
  })();
  return false;
};

/* ---------------------------------------------------------------- change history */
const shownVal = v => String(v && typeof v === 'object' ? v.value : v ?? '');
async function logChange(fieldId, before, after) {
  if (!ME.camp || !SH.charId || shownVal(before) === shownVal(after)) return;
  const def = SH.defs.get(fieldId); if (!def) return;
  const gm = Appwrite.Role.team(ME.camp.$id, 'gm');
  await AW.db.createRow(T('change_log', { rowId: Appwrite.ID.unique(), permissions: [Appwrite.Permission.read(gm), Appwrite.Permission.delete(gm)],
    data: { campaignId: ME.camp.$id, characterId: SH.charId, fieldId, label: def.label.slice(0, 128), before: shownVal(before).slice(0, 1000), after: shownVal(after).slice(0, 1000),
      userName: (ME.user.name || '').slice(0, 64) } })).catch(() => {});
}
ACT.historyOpen = () => { historyModal(); return false; };
async function historyModal() {
  const ch = ME.chars.find(c => c.$id === SH.charId); if (!ch) return;
  openModal(`<h3>Historique · ${esc(ch.name)}</h3><p class="hint" style="margin:0">Les 100 dernières modifications des valeurs de la fiche (MJ et joueurs). « Rétablir » remet l’ancienne valeur.</p><div id="histList" class="hist"><p class="hint">Chargement…</p></div>
    <div class="modal-acts"><button class="btn" data-act="closeModal">Fermer</button></div>`);
  $('#modalBox').classList.add('wide');
  let list = [];
  try { list = await rows('change_log', [AW.Q.equal('characterId', ch.$id), AW.Q.orderDesc('$createdAt'), AW.Q.limit(100)]); } catch (e) { $('#histList').innerHTML = `<p class="hint">${esc(errMsg(e))}</p>`; return; }
  HIST.list = list;
  $('#histList').innerHTML = list.length ? `<ul class="eq-list">${list.map(h => `<li><time style="font:500 11px var(--f-mono);color:var(--mute)">${fmtDate(h.$createdAt)}</time>
      <span class="grow"><b>${esc(h.label)}</b> : ${esc(h.before || '∅')} → ${esc(h.after || '∅')} <small style="color:var(--mute)">· ${esc(h.userName || '?')}</small></span>
      ${SH.defs.has(h.fieldId) ? `<button class="btn xs" data-act="histUndo" data-id="${h.$id}">Rétablir</button>` : ''}</li>`).join('')}</ul>` : '<p class="hint">Aucune modification enregistrée.</p>';
}
const HIST = { list: [] };
ACT.histUndo = d => {
  const h = HIST.list.find(x => x.$id === d.id); if (!h) return false;
  const o = [...C.stats, ...C.gauges, ...C.flavor].find(x => x.id === h.fieldId);
  if (o) o.value = typeof o.value === 'number' ? (+h.before || 0) : h.before;
  else if (SH.notesDef && h.fieldId === SH.notesDef.$id) C.notes = h.before;
  else { toast('Ce champ n’est plus sur la fiche.'); return false; }
  closeModal(); toast(`${h.label} rétabli à ${h.before || '∅'}`);
};

/* ---------------------------------------------------------------- session journal tab */
TABS.splice(TABS.findIndex(t => t[0] === 'lore') + 1, 0, ['seances', 'Séances']);
const SESS = { list: [], loaded: null, unsub: null };
const _renderMapSess = renderMap;
renderMap = function () { return S.tab === 'seances' ? renderSessions() : _renderMapSess(); };
async function loadSessions() {
  if (!ME.camp) return;
  const c = ME.camp.$id; SESS.loaded = c;
  try { SESS.list = await rows('session_log', [AW.Q.equal('campaignId', c), AW.Q.orderDesc('$createdAt')]); } catch (e) { SESS.list = []; }
  if (SESS.unsub) SESS.unsub();
  SESS.unsub = AW.c.subscribe(`tablesdb.${TN.db}.tables.session_log.rows`, ev => {
    if ((ev.payload || {}).campaignId !== c) return;
    clearTimeout(SESS.t); SESS.t = setTimeout(async () => { await loadSessionsQuiet(); if (S.tab === 'seances' && !document.activeElement?.closest('#main')) render(); }, 300);
  });
  if (S.tab === 'seances') render();
}
async function loadSessionsQuiet() { try { SESS.list = await rows('session_log', [AW.Q.equal('campaignId', ME.camp.$id), AW.Q.orderDesc('$createdAt')]); } catch (_) {} }
function renderSessions() {
  if (SESS.loaded !== ME.camp?.$id) { loadSessions(); return '<p class="hint" style="padding:30px">Chargement du journal…</p>'; }
  const gm = isGmHere(), no = ME.camp.sessionNo || 0;
  const groups = new Map(); for (const e of SESS.list) { const k = e.sessionNo || 0; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
  return `<div class="toolbar"><div><h2>Journal de séance</h2><div class="sub">${gm ? 'Tes notes de séance. Coche « Visible par les joueurs » pour un résumé partagé.' : 'Les résumés partagés par le MJ.'}</div></div><span class="grow"></span>
    ${gm ? `<button class="btn" data-act="sessNext">${ic('plus')}Séance suivante (${no + 1})</button>` : ''}</div>
    ${gm ? `<form class="tile sess-form" id="sessForm" style="animation:none"><div class="tile-head"><span class="led"></span><h3 class="tile-title">Nouvelle entrée · Séance ${no}</h3></div>
      <textarea class="field" name="body" rows="4" placeholder="Ce qui s’est passé, en Markdown…" required></textarea>
      <div class="edit-row"><label class="dsecret" style="margin:0"><input type="checkbox" name="pub"><span>Visible par les joueurs</span></label><span class="grow"></span><button class="btn orange" type="submit">Ajouter</button></div></form>` : ''}
    <div class="sess-list">${groups.size ? [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([k, list]) => `<section><h3 class="sess-h">Séance ${k}</h3>
      ${list.map(e => `<article class="sess-e ${e.visibility === 'all' ? 'pub' : ''}"><div class="sess-meta"><time>${fmtDate(e.$createdAt)}</time><span>${esc(e.authorName || '')}</span>
        ${gm ? `<span class="grow"></span><button class="vis vis-${e.visibility === 'all' ? 'all' : 'mj'}" data-act="sessVis" data-id="${e.$id}">${ic(e.visibility === 'all' ? 'eye' : 'lock', 11)}${e.visibility === 'all' ? 'Joueurs' : 'MJ'}</button><button class="iconbtn" data-act="sessDel" data-id="${e.$id}" aria-label="Supprimer">${ic('trash', 12)}</button>` : ''}</div>
        <div class="md">${mdHtml(e.body || '')}</div></article>`).join('')}</section>`).join('') : `<div class="empty-note well">${gm ? 'Aucune entrée pour l’instant.' : 'Le MJ n’a encore rien partagé.'}</div>`}</div>`;
}
async function sessPerms(pub) {
  const c = ME.camp.$id, gm = Appwrite.Role.team(c, 'gm');
  if ((await teamReadPerms()).length === 0) return [];   // admin outside the team: default rights only
  return [Appwrite.Permission.read(pub ? Appwrite.Role.team(c) : gm), Appwrite.Permission.update(gm), Appwrite.Permission.delete(gm)];
}
document.addEventListener('submit', async e => {
  if (e.target.id !== 'sessForm') return;
  e.preventDefault(); e.stopImmediatePropagation();
  const fd = Object.fromEntries(new FormData(e.target)), pub = !!fd.pub;
  try {
    await AW.db.createRow(T('session_log', { rowId: Appwrite.ID.unique(), permissions: await sessPerms(pub),
      data: { campaignId: ME.camp.$id, sessionNo: ME.camp.sessionNo || 0, body: fd.body.trim(), visibility: pub ? 'all' : 'gm', authorName: (ME.user.name || '').slice(0, 64) } }));
    await loadSessionsQuiet(); render();
  } catch (err) { toast('Entrée non enregistrée : ' + errMsg(err)); }
}, true);
ACT.sessVis = d => {
  const x = SESS.list.find(e => e.$id === d.id); if (!x) return false;
  const pub = x.visibility !== 'all';
  sessPerms(pub).then(permissions => AW.db.updateRow(T('session_log', { rowId: x.$id, data: { visibility: pub ? 'all' : 'gm' }, permissions })))
    .then(async () => { await loadSessionsQuiet(); render(); }).catch(e => toast(errMsg(e)));
  return false;
};
ACT.sessDel = d => {
  if (!confirm('Supprimer cette entrée du journal ?')) return false;
  AW.db.deleteRow(T('session_log', { rowId: d.id })).then(async () => { await loadSessionsQuiet(); render(); }).catch(e => toast(errMsg(e)));
  return false;
};
ACT.sessNext = () => { SETTINGS.sessionNo = (+SETTINGS.sessionNo || 0) + 1; SETTINGS.sessionName = ''; applySettings(); ME.camp.sessionNo = SETTINGS.sessionNo; toast(`Séance ${SETTINGS.sessionNo}`); };
const _leaveSess = leaveCampaign;
leaveCampaign = async function () { if (SESS.unsub) { SESS.unsub(); SESS.unsub = null; } SESS.loaded = null; SESS.list = []; return _leaveSess(); };

const gmCss = document.createElement('style');
gmCss.textContent = `
.hub{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.hub-tool{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:10px;align-items:center;text-align:left;border:0;cursor:pointer;color:var(--ink);padding:12px;border-radius:10px;
  background:linear-gradient(180deg,var(--panel-a),var(--panel-b));box-shadow:inset 0 1px 0 rgba(255,240,215,.08),0 2px 0 #0d0c0a;transition:transform .08s}
.hub-tool:hover:not(:disabled){transform:translateY(-1px)}
.hub-tool:disabled{opacity:.45;cursor:default}
.hub-ico{grid-row:1/3;width:36px;height:36px;border-radius:8px;display:grid;place-items:center;background:var(--well);color:var(--orange-hi);box-shadow:inset 0 1px 3px rgba(0,0,0,.5)}
.hub-tool b{font:400 10.5px var(--f-display);letter-spacing:.12em;text-transform:uppercase}
.hub-tool small{font-size:11.5px;color:var(--mute)}
.hist{max-height:56vh;overflow:auto}
.sess-form{display:flex;flex-direction:column;gap:10px;margin-bottom:16px;max-width:820px}
.sess-list{display:flex;flex-direction:column;gap:18px;max-width:820px}
.sess-h{margin:0 0 8px;font:400 11px var(--f-display);letter-spacing:.16em;text-transform:uppercase;color:var(--cream)}
.sess-e{padding:10px 12px;border-radius:8px;background:var(--well);box-shadow:inset 0 1px 3px rgba(0,0,0,.5);margin-bottom:8px}
.sess-e.pub{box-shadow:inset 0 0 0 1px rgba(79,141,137,.45),inset 0 1px 3px rgba(0,0,0,.5)}
.sess-meta{display:flex;gap:8px;align-items:center;font:500 10.5px var(--f-mono);color:var(--mute);margin-bottom:6px}
.sess-e .md{font-size:13px}`;
document.head.appendChild(gmCss);
