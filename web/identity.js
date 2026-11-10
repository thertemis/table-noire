/* identity.js — how characters are named, who rolls the dice, which sheet is open.
   - Display name of a character = its alias when the player chose "show my alias", otherwise first + last name,
     otherwise the character's name (the account name it was created with). Kept on the character row
     (characters.displayName / useAlias) so the scene, the lists and the dice show it, live for everyone
     (realtime on characters). The owner's client (player-action setIdentity) or the GM's writes it after a sheet save.
   - The "Alias" information field is added to the campaign sheet (default template, or once by the GM's client).
   - Dice: "who rolls" next to "Lancer secret". A player with one character rolls as that character; with several, picks
     one; the GM picks "MJ", an NPC of the scene, or types a name. The sheet that happens to be open does not matter
     (stat / skill rolls from the player's own sheet still roll as that character).
   - The character picker is a discreet list above the identity tile (the header row is gone). */

const IDENT = { unsub: null, as: 'gm', custom: '', saved: new Map(), aliasAsked: new Set() };
function dispName(ch) { return ch ? (ch.displayName || ch.name || '?') : '?'; }

/* ---------------------------------------------------------------- display name from the open sheet */
const ID_KEYS = { first: 'f_0', last: 'f_1', alias: 'f_alias' };
const ID_LABELS = { first: ['Prénom', 'First name'], last: ['Nom', 'Last name'], alias: ['Alias'] };
function identField(kind) {
  for (const [id, d] of SH.defs) if (d.key === ID_KEYS[kind] && ['text', 'longtext'].includes(d.kind)) return id;
  for (const [id, d] of SH.defs) if (ID_LABELS[kind].includes(d.label) && d.kind === 'text') return id;
  return null;
}
const fieldVal = id => id ? String((C.flavor.find(f => f.id === id) || {}).value || '').replace(/\s+/g, ' ').trim() : '';
function computedName(ch) {
  const alias = fieldVal(identField('alias'));
  return (ch.useAlias && alias) || [fieldVal(identField('first')), fieldVal(identField('last'))].filter(Boolean).join(' ') || ch.name;
}
const savedKey = ch => `${ch.displayName || ''}|${!!ch.useAlias}`;
async function pushIdentity() {
  const ch = ME.camp && ME.chars.find(c => c.$id === SH.charId);
  if (!ch || SH.loading || SH.snap === null || !(isGmHere() || ch.ownerId === ME.user.$id)) return;
  const name = computedName(ch).slice(0, 128), key = `${name}|${!!ch.useAlias}`;
  if (key === (IDENT.saved.get(ch.$id) ?? savedKey(ch))) return;
  try {
    if (isGmHere()) await AW.db.updateRow({ databaseId: TN.db, tableId: 'characters', rowId: ch.$id, data: { displayName: name, useAlias: !!ch.useAlias } });
    else await call('player-action', { action: 'setIdentity', characterId: ch.$id, displayName: name, useAlias: !!ch.useAlias });
    ch.displayName = name; IDENT.saved.set(ch.$id, key);
    renderIniBar(); rebuildAs(); refreshPicker();
  } catch (e) { if (!isNetErr(e)) toast('Nom du personnage non enregistré : ' + errMsg(e)); }
}
const _syncIdent = syncSheet;
syncSheet = async function () { await _syncIdent(); await pushIdentity(); };
const _loadSheetIdent = loadSheet;
loadSheet = async function (charId) {
  await _loadSheetIdent(charId);
  if (!ME.camp || charId !== SH.charId) return;
  // campaigns made before the alias field: the GM's client adds it once
  if (isGmHere() && SH.defs.size && !identField('alias') && !IDENT.aliasAsked.has(ME.camp.$id)) {
    IDENT.aliasAsked.add(ME.camp.$id);
    const last = SH.defs.get(identField('last') || '');
    try {
      await AW.db.createRow({ databaseId: TN.db, tableId: 'field_defs', rowId: Appwrite.ID.unique(),
        data: { campaignId: ME.camp.$id, key: ID_KEYS.alias, label: tr('Alias'), kind: 'text', config: '{}', defaultVisibility: 'all', sort: (last?.sort || 70) + 1 } });
      return loadSheet(charId);
    } catch (_) { /* not fatal */ }
  }
  pushIdentity();   // characters saved before display names existed get theirs
};

/* ---------------------------------------------------------------- identity tile: the name shown, the alias switch */
const _tIdentityAlias = tIdentity;
tIdentity = function () {
  let html = _tIdentityAlias();
  const ch = ME.camp && ME.chars.find(c => c.$id === SH.charId); if (!ch) return html;
  const alias = fieldVal(identField('alias'));
  if (ch.useAlias && alias) html = html.replace(/<div class="ident-name">[\s\S]*?<\/div>/, `<div class="ident-name">${esc(alias)}</div>`);
  if (identField('alias') && (isGmHere() || ch.ownerId === ME.user.$id))
    html = html.replace('<div class="chips">', `<label class="alias-tg" title="Dans la scène, les listes et les dés"><input type="checkbox" id="aliasTg" ${ch.useAlias ? 'checked' : ''}>Afficher l’alias</label><div class="chips">`);
  return html;
};
document.addEventListener('change', e => {
  if (e.target.id !== 'aliasTg') return;
  const ch = ME.chars.find(c => c.$id === SH.charId); if (!ch) return;
  ch.useAlias = e.target.checked;
  if (ch.useAlias && !fieldVal(identField('alias'))) toast('Écris d’abord ton alias dans « Informations ».');
  render(); pushIdentity();
});

/* ---------------------------------------------------------------- character picker above the identity tile */
function pickerHtml() {
  const pcs = ME.chars.filter(c => c.kind !== 'npc');
  const list = isGmHere() ? pcs : [...pcs.filter(c => c.ownerId === ME.user.$id), ...pcs.filter(c => c.ownerId && c.ownerId !== ME.user.$id)];
  const cur = ME.chars.find(c => c.$id === SH.charId);
  if (cur && !list.includes(cur)) list.unshift(cur);   // an NPC opened by the GM
  if (!list.length) return '';
  const label = c => c.ownerId && c.ownerId !== ME.user.$id && !isGmHere() ? `${dispName(c)} · ${tr('lecture')}` : c.kind === 'npc' ? `${dispName(c)} · PNJ` : dispName(c);
  return `<select class="char-pick" id="charPick" aria-label="Personnage">${list.map(c => `<option value="${c.$id}" ${c.$id === SH.charId ? 'selected' : ''}>${esc(label(c))}</option>`).join('')}</select>`;
}
const _renderFicheIdent = renderFiche;
renderFiche = function () {
  const html = _renderFicheIdent();
  if (!ME.camp) return html;
  const pick = pickerHtml();
  return pick ? html.replace(/<h2>Fiche · [^<]*<\/h2>/, `<h2 class="fiche-title">Fiche · ${pick}</h2>`) : html;
};
function refreshPicker() { const el = $('#charPick'); if (el && document.activeElement !== el) el.outerHTML = pickerHtml(); }
document.addEventListener('change', e => {
  if (e.target.id !== 'charPick') return;
  const r = ACT.pickChar({ id: e.target.value });
  if (r !== false) render();
});

/* ---------------------------------------------------------------- who rolls */
function rollOptions() {
  if (!ME.camp) return [];
  if (isGmHere()) {
    const scene = new Set(iniState().list.map(e => e.charId).filter(Boolean));
    return [['gm', 'MJ'], ...ME.chars.filter(c => c.kind === 'npc' && scene.has(c.$id)).map(c => [c.$id, dispName(c)]), ['custom', tr('Autre nom…')]];
  }
  return ME.chars.filter(c => c.ownerId === ME.user.$id).map(c => [c.$id, dispName(c)]);
}
/** The identity of the next roll: { charId, name, custom }. */
function rollIdentity() {
  const opts = rollOptions();
  if (isGmHere()) {
    if (IDENT.as === 'custom') return { charId: null, name: IDENT.custom || 'MJ', custom: IDENT.custom };
    const ch = IDENT.as !== 'gm' && ME.chars.find(c => c.$id === IDENT.as);
    return ch ? { charId: ch.$id, name: dispName(ch) } : { charId: null, name: 'MJ' };
  }
  if (!opts.length) return { charId: null, name: ME.user.name };
  const id = opts.some(o => o[0] === IDENT.as) ? IDENT.as : opts[0][0], ch = ME.chars.find(c => c.$id === id);
  return { charId: id, name: dispName(ch) };
}
/** Aliases take the open sheet's stats: refuse them when rolling as another character. */
function aliasCheck(typed, formula, rollChar) {
  if (typed === formula || !rollChar || rollChar === SH.charId) return '';
  return `Les alias (${tr('statistiques')}) viennent de la fiche ouverte : ouvre celle de ${dispName(ME.chars.find(c => c.$id === rollChar))}.`;
}
function rebuildAs() {
  const box = $('#dAsBox'); if (!box) return;
  if (!ME.camp || !ME.user) { box.innerHTML = ''; return; }
  const opts = rollOptions(), gm = isGmHere();
  if (!gm && opts.length < 2) { box.innerHTML = `<span class="das-one" title="Les dés sont lancés en tant que">${esc(rollIdentity().name)}</span>`; return; }
  if (!opts.some(o => o[0] === IDENT.as)) IDENT.as = opts[0][0];
  box.innerHTML = `<select class="field" id="dAs" aria-label="Lancer en tant que">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === IDENT.as ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    ${gm && IDENT.as === 'custom' ? `<input class="field" id="dAsName" maxlength="64" placeholder="Nom affiché" value="${esc(IDENT.custom)}" aria-label="Nom affiché">` : ''}`;
}
$('#dSecret')?.closest('label')?.insertAdjacentHTML('afterend', '<div class="das" id="dAsBox"></div>');
document.addEventListener('change', e => { if (e.target.id === 'dAs') { IDENT.as = e.target.value; rebuildAs(); if (IDENT.as === 'custom') $('#dAsName')?.focus(); } });
document.addEventListener('input', e => { if (e.target.id === 'dAsName') IDENT.custom = e.target.value; });
const _renderHeaderIdent = renderHeader;
renderHeader = function () { _renderHeaderIdent(); rebuildAs(); };
const _renderIniBarIdent = renderIniBar;
renderIniBar = function () { _renderIniBarIdent(); rebuildAs(); };

/* ---------------------------------------------------------------- live character rows (names, portraits) */
const _enterIdent = enterCampaign;
enterCampaign = async function (id) {
  IDENT.as = 'gm'; IDENT.custom = ''; IDENT.saved.clear();
  await _enterIdent(id);
  if (!ME.camp) return;
  if (IDENT.unsub) IDENT.unsub();
  IDENT.unsub = AW.c.subscribe(`tablesdb.${TN.db}.tables.characters.rows`, ev => {
    const r = ev.payload; if (!r || !ME.camp || r.campaignId !== ME.camp.$id) return;
    if (ev.events.some(x => x.endsWith('.delete'))) { ME.chars = ME.chars.filter(c => c.$id !== r.$id); }
    else { const i = ME.chars.findIndex(c => c.$id === r.$id); if (i >= 0) ME.chars[i] = { ...ME.chars[i], ...r }; else ME.chars.push(r); }
    IDENT.saved.set(r.$id, savedKey(r));
    renderIniBar(); refreshPicker();
    if (S.tab === 'fiche' && r.$id === SH.charId && !document.activeElement?.matches('input,textarea,select')) render();
  });
  rebuildAs();
};
const _leaveIdent = leaveCampaign;
leaveCampaign = function () { if (IDENT.unsub) { IDENT.unsub(); IDENT.unsub = null; } _leaveIdent(); rebuildAs(); };

const identCss = document.createElement('style');
identCss.textContent = `
body:not(.gated) .viewer .lbl,body:not(.gated) #viewerSeg{display:none}
.fiche-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.char-pick{font:400 inherit/1.1 var(--f-display);letter-spacing:inherit;color:inherit;background:transparent;border:0;border-bottom:1px dashed rgba(255,240,215,.25);
  padding:0 18px 2px 2px;cursor:pointer;max-width:100%;appearance:none;
  background-image:linear-gradient(45deg,transparent 50%,var(--mute) 50%),linear-gradient(135deg,var(--mute) 50%,transparent 50%);
  background-position:calc(100% - 9px) 55%,calc(100% - 4px) 55%;background-size:5px 5px;background-repeat:no-repeat}
.char-pick option{font:14px var(--f-body);background:#1b1a17;color:var(--ink)}
.alias-tg{display:flex;align-items:center;gap:6px;margin:4px 0;font:500 10px var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--mute);cursor:pointer}
.das{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px}
.das select,.das input{flex:1;min-width:120px;padding:5px 8px}
.das-one{font:500 11px var(--f-mono);color:var(--mute)}
.das-one::before{content:"⚄ ";color:var(--orange)}`;
document.head.appendChild(identCss);
