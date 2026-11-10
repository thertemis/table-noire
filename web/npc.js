/* npc.js — NPC library and the scene bar.
   - "PNJ" tab (GM only): NPC models as cards; copies made from a model ("exemplaires", for mobs and minor
     characters, each with its own sheet) are stacked on it and can be removed all at once, keeping the model.
   - Scene bar (top of the app, replaces the initiative bar): portraits of the characters present, drag to reorder
     (turn order), current turn highlighted, NPCs added from the library. The scene is campaigns.initiative;
     admin setScene makes the NPCs of the scene readable by the players (identity and "Informations" only,
     enforced by apply-visibility) and hides the others.
   - Players click a portrait: their own character opens their sheet, an NPC shows its identity and informations. */

const isNpcModel = c => c.kind === 'npc' && !c.templateId;
const copiesOf = id => ME.chars.filter(c => c.templateId === id);
function thumb(ch, size = 40) {
  const p = cleanPortrait((() => { try { return JSON.parse(ch?.portrait || 'null'); } catch (_) { return null; } })());
  const inner = !p ? `<span class="th-ini">${esc((ch?.name || '?')[0])}</span>` : p.type === 'img' ? `<img src="${esc(p.src)}" alt="">` : prender(p.style, { ...(typeof PDEF !== 'undefined' ? PDEF : {}), ...p.p });
  return `<span class="th" style="--th:${size}px">${inner}</span>`;
}

/* ---------------------------------------------------------------- scene bar (replaces the initiative bar) */
let sceneDrag = null;
renderIniBar = function () {
  const s = iniState(), gm = isGmHere();
  if (!ME.camp || (!s.list.length && !gm)) { iniBar.hidden = true; iniBar.innerHTML = ''; return; }
  const mine = myCharIds();
  iniBar.hidden = false;
  iniBar.innerHTML = `${s.active ? `<span class="ini-round">Round <b>${s.round}</b></span>` : `<span class="ini-round">Scène</span>`}
    <ol class="ini-list scene-list">${s.list.map((e, i) => { const ch = e.charId && ME.chars.find(c => c.$id === e.charId);
      return `<li class="${s.active && i === s.turn ? 'cur' : ''} ${e.charId && mine.has(e.charId) ? 'mine' : ''} ${ch && ch.kind === 'npc' ? 'npc' : ''}" data-idx="${i}" ${gm ? 'draggable="true"' : ''} title="${esc(e.name)}">
        ${thumb(ch || { name: e.name })}<span class="sc-name">${esc(e.name)}</span>${e.init !== null && e.init !== undefined ? `<span class="ini-n">${esc(String(e.init))}</span>` : ''}</li>`; }).join('')
      || '<li class="sc-empty">Scène vide</li>'}</ol>
    ${gm ? `<span class="ini-acts">
      ${s.active ? `<button class="iconbtn" data-act="iniStep" data-d="-1" aria-label="Tour précédent">${ic('minus', 13)}</button><button class="btn xs orange" data-act="iniStep" data-d="1">Tour suivant</button>` : ''}
      <button class="btn xs" data-act="sceneTurns">${s.active ? 'Arrêter les tours' : 'Tours'}</button>
      <button class="iconbtn" data-act="sceneAddNpc" aria-label="Ajouter à la scène" title="Ajouter un joueur ou un PNJ">${ic('plus', 13)}</button>
      <button class="iconbtn" data-act="iniOpen" aria-label="Modifier la scène" title="Ordre, initiative, personnages">${ic('edit', 13)}</button></span>` : ''}`;
  iniBar.querySelector('li.cur')?.scrollIntoView({ block: 'nearest', inline: 'center' });
};
// NPC visibility follows the scene
let sceneNpcsKey = null;
const _saveIniScene = saveIni;
saveIni = async function (s) {
  await _saveIniScene(s);
  const ids = [...new Set(s.list.map(e => e.charId).filter(id => (ME.chars.find(c => c.$id === id) || {}).kind === 'npc'))].sort();
  if (ids.join() !== sceneNpcsKey) { sceneNpcsKey = ids.join(); await admin('setScene', { campaignId: ME.camp.$id, characterIds: ids }).catch(e => toast('Scène : ' + errMsg(e))); }
};
ACT.sceneTurns = () => { const s = iniState(); saveIni({ ...s, active: !s.active, turn: 0, round: s.active ? s.round : 1 }); return false; };
ACT.iniEnd = () => { if (!confirm('Vider la scène ? Les PNJ redeviennent invisibles pour les joueurs.')) return false; closeModal(); saveIni(INI_EMPTY()); return false; };

// drag to reorder (GM)
iniBar.addEventListener('dragstart', e => { const li = e.target.closest('li[data-idx]'); if (li) { sceneDrag = +li.dataset.idx; e.dataTransfer.effectAllowed = 'move'; } });
iniBar.addEventListener('dragover', e => { if (sceneDrag !== null && e.target.closest('li[data-idx]')) e.preventDefault(); });
iniBar.addEventListener('drop', e => {
  const li = e.target.closest('li[data-idx]'); if (!li || sceneDrag === null) return;
  e.preventDefault();
  const s = iniState(), from = sceneDrag, to = +li.dataset.idx; sceneDrag = null; if (from === to) return;
  const cur = s.list[s.turn]?.id, [moved] = s.list.splice(from, 1); s.list.splice(to, 0, moved);
  saveIni({ ...s, turn: Math.max(0, s.list.findIndex(x => x.id === cur)) });
});
iniBar.addEventListener('dragend', () => { sceneDrag = null; });
// click a portrait
iniBar.addEventListener('click', e => {
  const li = e.target.closest('li[data-idx]'); if (!li || e.target.closest('button')) return;
  const entry = iniState().list[+li.dataset.idx], ch = entry && entry.charId && ME.chars.find(c => c.$id === entry.charId);
  if (!ch) return;
  if (isGmHere() || myCharIds().has(ch.$id)) { ACT.pickChar({ id: ch.$id }); S.tab = 'fiche'; render(); return; }
  if (ch.kind === 'npc') npcView(ch);
});

/* the players' view of an NPC: identity and informations only */
async function npcView(ch) {
  openModal(`<h3>${esc(ch.name)}</h3><div id="npcView" class="npc-view"><p class="hint">Chargement…</p></div><div class="modal-acts"><button class="btn" data-act="closeModal">Fermer</button></div>`);
  try {
    const [vals, defs] = await Promise.all([rows('character_values', [AW.Q.equal('characterId', ch.$id)]), rows('field_defs', [AW.Q.equal('campaignId', ME.camp.$id), AW.Q.orderAsc('sort')])]);
    const byField = new Map(vals.map(v => [v.fieldId, (() => { try { return JSON.parse(v.value); } catch (_) { return v.value; } })()]));
    const info = defs.filter(d => ['text', 'longtext'].includes(d.kind) && byField.has(d.$id) && String(byField.get(d.$id) || '').trim());
    const get = l => { const d = info.find(x => x.label === l); return d ? String(byField.get(d.$id)) : ''; };
    const name = [get('Prénom'), get('Nom')].filter(Boolean).join(' ') || ch.name;
    const box = $('#npcView'); if (!box) return;
    box.innerHTML = `<div class="ident">${thumb(ch, 104)}<div><div class="ident-name">${esc(name)}</div><div class="ident-sub">${esc(get('Métier') || 'PNJ')}</div></div></div>
      ${info.length ? `<dl class="flavor">${info.filter(d => !['Prénom', 'Nom', 'Métier'].includes(d.label)).map(d => `<div class="fl ${d.kind === 'longtext' ? 'wide' : ''}"><dt>${esc(d.label)}</dt><dd>${esc(String(byField.get(d.$id)))}</dd></div>`).join('')}</dl>` : '<p class="hint">Rien d’autre n’est connu sur ce personnage.</p>'}`;
  } catch (e) { const box = $('#npcView'); if (box) box.innerHTML = `<p class="hint">${esc(errMsg(e))}</p>`; }
}

/* live: players need the NPC rows that just became visible */
document.addEventListener('tn:campaign', async ev => { if ('initiative' in ev.detail) { await loadCharacters(); renderIniBar(); if (!isGmHere()) renderHeader(); } });

/* ---------------------------------------------------------------- PNJ tab (GM) */
TABS.splice(TABS.findIndex(t => t[0] === 'equipement') + 1, 0, ['pnj', 'PNJ']);
const _renderHeaderNpc = renderHeader;
renderHeader = function () { _renderHeaderNpc(); if (!isGmHere()) $('#tabs [data-tab="pnj"]')?.remove(); };
const _renderMapNpc = renderMap;
renderMap = function () { return S.tab === 'pnj' ? (isGmHere() ? renderNpcLibrary() : '') : _renderMapNpc(); };
const NPCQ = { q: '' };
function renderNpcLibrary() {
  const inScene = new Set(iniState().list.map(e => e.charId).filter(Boolean));
  const models = ME.chars.filter(isNpcModel).filter(c => !NPCQ.q || fold(c.name).includes(fold(NPCQ.q)));
  return `<div class="toolbar"><div><h2>Bibliothèque de PNJ</h2><div class="sub">Visible du MJ seul. Les joueurs ne voient un PNJ que lorsqu’il est dans la scène, et seulement son identité et ses informations.</div></div><span class="grow"></span>
      <button class="btn orange" data-act="npcNew">${ic('plus')}Nouveau PNJ</button></div>
    <div class="srch well"><label class="srch-q">${ic('search', 14)}<input class="field" id="npcQ" type="search" placeholder="Rechercher un PNJ…" value="${esc(NPCQ.q)}" autocomplete="off"></label><span class="srch-count">${models.length}</span></div>
    ${models.length ? `<div class="cards npc-cards">${models.map(m => { const cps = copiesOf(m.$id), n = cps.length;
      return `<article class="npc-card ${n ? 'stacked' : ''} ${n === 1 ? 's2' : ''} r-${inScene.has(m.$id) ? 'rare' : 'common'}">
        <div class="npc-face" data-act="npcOpen" data-id="${m.$id}" role="button" tabindex="0" title="Ouvrir la fiche">${thumb(m, 120)}${n ? `<span class="qty"><small>×</small>${n + 1}</span>` : ''}${inScene.has(m.$id) ? '<span class="eq-tag">Dans la scène</span>' : ''}</div>
        <div class="npc-name">${esc(m.name)}</div>
        ${n ? `<div class="npc-copies">${cps.map(c => `<button class="chip ${inScene.has(c.$id) ? 'on' : ''}" data-act="npcOpen" data-id="${c.$id}" title="Ouvrir">${esc(c.name)}</button>`).join('')}</div>` : ''}
        <div class="edit-row"><button class="btn xs orange" data-act="npcToScene" data-id="${m.$id}">${ic('plus', 12)}Scène</button>
          <button class="btn xs" data-act="npcCopy" data-id="${m.$id}" title="Nouveau personnage à partir de ce modèle (santé et stats séparées)">Exemplaire</button>
          ${n ? `<button class="btn xs" data-act="npcDelCopies" data-id="${m.$id}">Retirer les ${n} exemplaires</button>` : ''}
          <span class="grow"></span><button class="iconbtn" data-act="npcDel" data-id="${m.$id}" aria-label="Supprimer le PNJ">${ic('trash', 12)}</button></div></article>`; }).join('')}</div>`
      : '<div class="empty-note well">Aucun PNJ. Crée-en un avec « Nouveau PNJ ».</div>'}`;
}
document.addEventListener('input', e => { if (e.target.id === 'npcQ') { NPCQ.q = e.target.value; const pos = e.target.selectionStart; render(); const n = $('#npcQ'); n?.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } });
async function refreshChars(openId) { await loadCharacters(); renderHeader(); if (openId) { ACT.pickChar({ id: openId }); } render(); }
ACT.npcOpen = d => { ACT.pickChar({ id: d.id }); S.tab = 'fiche'; };
ACT.npcNew = () => { const name = (prompt('Nom du PNJ', 'Nouveau PNJ') || '').trim(); if (!name) return false;
  admin('createCharacter', { campaignId: ME.camp.$id, name, kind: 'npc' }).then(() => refreshChars()).then(() => toast(`PNJ « ${name} » créé`)).catch(e => toast(errMsg(e))); return false; };
async function npcCopy(model) {
  const n = copiesOf(model.$id).length + 2;
  const r = await admin('duplicateCharacter', { characterId: model.$id, name: `${model.name} ${n}`, asCopy: true });
  await loadCharacters(); return r.id;
}
ACT.npcCopy = d => { const m = ME.chars.find(c => c.$id === d.id); if (!m) return false;
  npcCopy(m).then(() => { toast('Exemplaire créé'); render(); renderHeader(); }).catch(e => toast(errMsg(e))); return false; };
async function addToScene(charId) {
  const ch = ME.chars.find(c => c.$id === charId), s = iniState();
  s.list.push({ id: 'i_' + uid(), charId, name: ch.name, init: null });
  await saveIni(s);
}
ACT.npcToScene = d => {
  const m = ME.chars.find(c => c.$id === d.id); if (!m) return false;
  (async () => {
    try {
      // the model goes in first; adding it again creates a copy (its own health and stats)
      const used = new Set(iniState().list.map(e => e.charId));
      const id = used.has(m.$id) ? (copiesOf(m.$id).find(c => !used.has(c.$id))?.$id || await npcCopy(m)) : m.$id;
      await addToScene(id); toast(`${ME.chars.find(c => c.$id === id)?.name} entre en scène`); render();
    } catch (e) { toast(errMsg(e)); }
  })();
  return false;
};
ACT.npcDelCopies = d => { const m = ME.chars.find(c => c.$id === d.id), n = copiesOf(d.id).length;
  if (!m || !confirm(`Supprimer les ${n} exemplaires de « ${m.name} » (fiches comprises) ? Le modèle est gardé.`)) return false;
  (async () => { const gone = new Set(copiesOf(d.id).map(c => c.$id)); const s = iniState();
    if (s.list.some(e => gone.has(e.charId))) await saveIni({ ...s, list: s.list.filter(e => !gone.has(e.charId)), turn: 0 });
    await admin('deleteCopies', { characterId: d.id }).then(r => toast(`${r.deleted} exemplaire(s) supprimé(s)`)).catch(e => toast(errMsg(e)));
    await refreshChars(); })();
  return false; };
ACT.npcDel = d => { const m = ME.chars.find(c => c.$id === d.id); if (!m) return false;
  if (copiesOf(d.id).length) { toast('Retire d’abord ses exemplaires.'); return false; }
  if (!confirm(`Supprimer le PNJ « ${m.name} » et sa fiche ? C’est définitif.`)) return false;
  (async () => { const s = iniState(); if (s.list.some(e => e.charId === d.id)) await saveIni({ ...s, list: s.list.filter(e => e.charId !== d.id), turn: 0 });
    await admin('deleteCharacter', { characterId: d.id }).catch(e => toast(errMsg(e))); if (SH.charId === d.id) SH.charId = null; await refreshChars(); })();
  return false; };
// GM: "+" in the scene bar picks an NPC model
ACT.sceneAddNpc = () => {
  const models = ME.chars.filter(isNpcModel), used = new Set(iniState().list.map(e => e.charId));
  const pcs = ME.chars.filter(c => c.kind !== 'npc' && !used.has(c.$id));
  openModal(`<h3>Ajouter à la scène</h3>
    ${pcs.length ? `<h4 class="npc-pick-h">Personnages des joueurs</h4><div class="npc-pick">${pcs.map(c => `<button class="npc-pick-b" data-act="scenePc" data-id="${c.$id}">${thumb(c, 48)}<span>${esc(c.name)}</span></button>`).join('')}</div>` : ''}
    <h4 class="npc-pick-h">PNJ</h4><p class="hint" style="margin:0">Ajouter un PNJ déjà présent crée un exemplaire (sa propre fiche).</p>
    ${models.length ? '' : '<p class="hint">Aucun PNJ : crée-les dans l’onglet PNJ.</p>'}
    <div class="npc-pick">${models.map(m => `<button class="npc-pick-b" data-act="npcPick" data-id="${m.$id}">${thumb(m, 48)}<span>${esc(m.name)}</span></button>`).join('')}</div>
    <div class="modal-acts"><button class="btn" data-act="closeModal">Fermer</button></div>`);
  return false;
};
ACT.npcPick = d => { closeModal(); return ACT.npcToScene(d); };
ACT.scenePc = d => { closeModal(); addToScene(d.id).then(() => render()).catch(e => toast(errMsg(e))); return false; };

const npcCss = document.createElement('style');
npcCss.textContent = `
.th{display:inline-grid;place-items:center;width:var(--th);height:var(--th);flex:none;border-radius:50%;overflow:hidden;background:var(--paper);box-shadow:0 0 0 2px #0d0c0a,0 2px 0 #0b0a09}
.th img{width:100%;height:100%;object-fit:cover}
.th .pt{width:100%;height:100%}
.th .pt svg{width:100%;height:100%}
.th-ini{font:600 calc(var(--th) * .45) var(--f-display);color:var(--paper-ink)}
.scene-list li{gap:6px;cursor:pointer;padding:4px 9px 4px 4px}
.scene-list li[draggable="true"]{cursor:grab}
.scene-list li.npc .th{box-shadow:0 0 0 2px var(--rust),0 2px 0 #0b0a09}
.scene-list li.cur .th{box-shadow:0 0 0 3px #fff3,0 0 0 5px var(--orange-hi)}
.sc-name{max-width:130px;overflow:hidden;text-overflow:ellipsis}
.sc-empty{color:var(--dim);font-style:italic}
.npc-cards{grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}
.npc-card{position:relative;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:10px;
  background:var(--noise),linear-gradient(165deg,color-mix(in srgb,var(--rc) 60%,#2e2c28),#1b1a17);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--rc) 50%,#000),0 3px 0 #0b0a09}
.npc-card.stacked{isolation:isolate}
.npc-card.stacked::before,.npc-card.stacked::after{content:"";position:absolute;inset:0;border-radius:10px;z-index:-1;pointer-events:none;
  background:linear-gradient(165deg,color-mix(in srgb,var(--rc) 55%,#2e2c28),#141310);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--rc) 45%,#000),0 3px 0 #0b0a09;transform:translate(8px,7px) rotate(2.5deg);filter:brightness(.8)}
.npc-card.stacked::after{transform:translate(15px,13px) rotate(5deg);filter:brightness(.62)}
.npc-card.stacked.s2::after{display:none}
.npc-face{position:relative;display:grid;place-items:center;padding:6px;cursor:pointer}
.npc-name{font:400 12px/1.3 var(--f-display);letter-spacing:.06em;text-align:center;color:#f6efe0}
.npc-copies{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}
.npc-copies .chip{cursor:pointer;border:0;font-size:10.5px;padding:3px 7px}
.npc-copies .chip.on{color:#24110a;background:var(--orange)}
.npc-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;max-height:50vh;overflow:auto}
.npc-pick-b{display:flex;align-items:center;gap:8px;border:0;cursor:pointer;padding:8px;border-radius:8px;color:var(--ink);background:var(--well);text-align:left}
.npc-view .ident{margin-bottom:12px}
.npc-pick-h{margin:6px 0 0;font:400 10px var(--f-display);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}`;
document.head.appendChild(npcCss);
