/* inventory.js — binds the mockup inventory and skills (ITEMS / INV / SKILLS / SKOWN) to Appwrite.
   Catalogues: item_defs / skill_defs (whole campaign); GM notes on them live in gm_notes (GM only).
   Owned: item_instances / skill_instances of the open character (visibility + hiddenFromPlayers).
   Save: the four arrays are diffed against the last synced snapshot after every render.
   The GM writes directly; a player can only hide/show their own cards (player-action toggleHidden).
   Mockup ids (uid(), 7 chars [a-z0-9]) are valid Appwrite ids, so new rows reuse them. */

const IV = { defs: new Map(), sdefs: new Map(), inst: new Map(), sinst: new Map(), notes: new Map(),
  snap: null, busy: false, again: false, timer: null, unsub: null, reloadTimer: null, charId: null };
// the mockup's demo data must never show online
ITEMS.length = 0; INV.length = 0; SKILLS.length = 0; SKOWN.length = 0;

const artUrl = fileId => `${TN.endpoint}/storage/buckets/item-art/files/${fileId}/view?project=${TN.project}`;
const charName = () => (ME.chars.find(x => x.$id === SH.charId) || {}).name || 'ce personnage';
const statAbbr = fieldId => { const d = SH.defs.get(fieldId); return d ? (d.cfg.abbr || d.label.slice(0, 3).toUpperCase()) : ''; };
const statField = abbr => (C.stats.find(s => s.abbr === abbr) || {}).id || '';

/* ---------------------------------------------------------------- load */
async function loadInventory(charId, quiet = false) {
  if (!ME.camp) return;
  const c = ME.camp.$id;
  const oldSnap = IV.snap, pre = invSnapshot();
  IV.charId = charId; if (!quiet) IV.snap = null;
  try {
    const [defs, sdefs, inst, sinst, notes] = await Promise.all([
      rows('item_defs', [AW.Q.equal('campaignId', c)]),
      rows('skill_defs', [AW.Q.equal('campaignId', c)]),
      charId ? rows('item_instances', [AW.Q.equal('characterId', charId)]) : Promise.resolve([]),
      charId ? rows('skill_instances', [AW.Q.equal('characterId', charId)]) : Promise.resolve([]),
      isGmHere() ? rows('gm_notes', [AW.Q.equal('campaignId', c), AW.Q.equal('entityType', ['item_def', 'skill_def'])]) : Promise.resolve([]),
    ]);
    if (charId !== SH.charId) return;   // another character was picked meanwhile
    if (quiet && invSnapshot() !== pre) { IV.snap = oldSnap; return; }   // edited meanwhile: keep the local state
    IV.defs = new Map(defs.map(r => [r.$id, r])); IV.sdefs = new Map(sdefs.map(r => [r.$id, r]));
    IV.inst = new Map(inst.map(r => [r.$id, r])); IV.sinst = new Map(sinst.map(r => [r.$id, r]));
    IV.notes = new Map(notes.map(n => [n.entityType + ':' + n.entityId, n]));
    const note = (t, id) => (IV.notes.get(t + ':' + id) || {}).body || '';
    const byName = (a, b) => a.name.localeCompare(b.name, 'fr');
    ITEMS.splice(0, ITEMS.length, ...defs.map(r => ({ id: r.$id, name: r.name, type: r.type || '', rarity: r.rarity || 'common',
      value: r.valueLabel || '', art: r.art || 'photo', img: r.artFileId ? artUrl(r.artFileId) : '', fileId: r.artFileId || '', slot: r.slot || '', mods: r.modifiers || '',
      desc: r.description || '', mj: note('item_def', r.$id) })).sort(byName));
    if (sdefs.length) IV.skillFormula = 'formula' in sdefs[0];   // the column was added later: older servers do not have it
    SKILLS.splice(0, SKILLS.length, ...sdefs.map(r => ({ id: r.$id, name: r.name, stat: statAbbr(r.statFieldId), level: r.defaultLevel || 1, roll: r.formula || '',
      desc: r.description || '', mj: note('skill_def', r.$id) })).sort(byName));
    const own = r => ({ iid: r.$id, def: r.itemDefId || r.skillDefId, hidden: !!r.hiddenFromPlayers, vis: visFromDb(r.visibility),
      ...(r.itemDefId ? { qty: r.qty || 1, slot: r.equippedSlot || '' } : {}) });
    INV.splice(0, INV.length, ...inst.map(own));
    SKOWN.splice(0, SKOWN.length, ...sinst.map(own));
    IV.snap = invSnapshot();
  } catch (e) { if (!quiet) toast('Inventaire indisponible : ' + errMsg(e)); }
  subscribeInventory();
  if (quiet) { if (IV.snap !== pre) softRender(); } else render();
}
function softRender() {
  const a = document.activeElement;
  const typing = a && a.closest('#main') && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
  if (!typing && $('#modal').hidden) render();
}

/* ---------------------------------------------------------------- save (diff) */
const invSnapshot = () => JSON.stringify({ ITEMS, SKILLS, INV, SKOWN });
function scheduleInv(delay = 500) {
  if (!ME.camp || IV.snap === null) return;
  clearTimeout(IV.timer); IV.timer = setTimeout(syncInventory, delay);
}
async function syncInventory() {
  if (!ME.camp || IV.snap === null) return;   // campaign closed meanwhile
  if (IV.busy) { IV.again = true; return; }
  const now = invSnapshot(); if (now === IV.snap) return;
  IV.busy = true;
  const prev = JSON.parse(IV.snap);
  try {
    if (isGmHere()) await pushInvGm(prev); else await pushInvPlayer(prev);
    IV.snap = invSnapshot();
  } catch (e) { if (isNetErr(e)) NET.pending = true; else { toast('Enregistrement impossible : ' + errMsg(e)); IV.snap = invSnapshot(); } }
  IV.busy = false;
  if (IV.again) { IV.again = false; scheduleInv(100); }
}

async function teamReadPerms() {
  // an admin acting as GM without being a team member cannot grant team roles: default rights + apply-visibility
  if (ME.isAdmin) {
    const n = await AW.teams.listMemberships({ teamId: ME.camp.$id, queries: [AW.Q.equal('userId', ME.user.$id)] }).then(m => m.total).catch(() => 0);
    if (!n) return [];
  }
  return [Appwrite.Permission.read(Appwrite.Role.team(ME.camp.$id))];
}
async function storeItemArt(item) {
  if (!String(item.img || '').startsWith('data:')) return;
  const blob = await (await fetch(item.img)).blob();
  const file = await toWebp(blob, 1024, `item-${item.id}`);
  const f = await new Appwrite.Storage(AW.c).createFile({ bucketId: 'item-art', fileId: Appwrite.ID.unique(), file, permissions: await teamReadPerms() });
  item.fileId = f.$id; item.img = artUrl(f.$id);
}
async function dropArt(fileId) { if (fileId) await new Appwrite.Storage(AW.c).deleteFile({ bucketId: 'item-art', fileId }).catch(() => {}); }

async function upsertNote(entityType, entityId, body) {
  const key = entityType + ':' + entityId, cur = IV.notes.get(key);
  if (cur) {
    if (!body) { await AW.db.deleteRow(T('gm_notes', { rowId: cur.$id })).catch(() => {}); IV.notes.delete(key); }
    else if (cur.body !== body) IV.notes.set(key, await AW.db.updateRow(T('gm_notes', { rowId: cur.$id, data: { body } })));
  } else if (body) {
    IV.notes.set(key, await AW.db.createRow(T('gm_notes', { rowId: Appwrite.ID.unique(), data: { campaignId: ME.camp.$id, entityType, entityId, body } })));
  }
}

// generic catalogue diff: list = mockup array, store = Map of rows, data(x) = row fields
async function syncDefs(tableId, noteType, list, before, store, data, instTable, instKey) {
  const c = ME.camp.$id;
  for (const x of list) {
    if (tableId === 'item_defs') await storeItemArt(x);
    const want = data(x), cur = store.get(x.id);
    if (!cur) store.set(x.id, await AW.db.createRow(T(tableId, { rowId: x.id, data: { campaignId: c, ...want } })));
    else if (Object.keys(want).some(k => (cur[k] ?? '') !== want[k])) {
      if (tableId === 'item_defs' && cur.artFileId && cur.artFileId !== want.artFileId) await dropArt(cur.artFileId);
      store.set(x.id, await AW.db.updateRow(T(tableId, { rowId: x.id, data: want })));
    }
    await upsertNote(noteType, x.id, x.mj || '');
  }
  const kept = new Set(list.map(x => x.id));
  for (const old of before) {
    if (kept.has(old.id) || !store.has(old.id)) continue;
    // deleting from the library removes the card from every character of the campaign
    const owned = await rows(instTable, [AW.Q.equal('campaignId', c), AW.Q.equal(instKey, old.id)]).catch(() => []);
    for (const r of owned) await AW.db.deleteRow(T(instTable, { rowId: r.$id })).catch(() => {});
    await upsertNote(noteType, old.id, '');
    if (tableId === 'item_defs') await dropArt(store.get(old.id).artFileId);
    await AW.db.deleteRow(T(tableId, { rowId: old.id })).catch(() => {});
    store.delete(old.id);
  }
}
async function syncOwned(tableId, list, store, defKey, extra, tracked = () => ({})) {
  // tracked(o): extra fields kept in sync after creation (item quantity); equippedSlot is owned by player-action
  if (!IV.charId) return;
  for (const o of list) {
    const want = { visibility: visToDb(o.vis), hiddenFromPlayers: !!o.hidden, ...tracked(o) }, cur = store.get(o.iid);
    if (!cur) store.set(o.iid, await AW.db.createRow(T(tableId, { rowId: o.iid,
      data: { campaignId: ME.camp.$id, characterId: IV.charId, [defKey]: o.def, ...extra(o), ...want } })));
    else if (Object.keys(want).some(k => (k === 'hiddenFromPlayers' ? !!cur[k] : cur[k]) !== want[k]))
      store.set(o.iid, await AW.db.updateRow(T(tableId, { rowId: o.iid, data: want })));
  }
  const kept = new Set(list.map(o => o.iid));
  for (const id of [...store.keys()]) if (!kept.has(id)) { await AW.db.deleteRow(T(tableId, { rowId: id })).catch(() => {}); store.delete(id); }
}

async function pushInvGm(prev) {
  await syncDefs('item_defs', 'item_def', ITEMS, prev.ITEMS, IV.defs, x => ({ name: String(x.name || 'Objet').slice(0, 128), type: String(x.type || '').slice(0, 64),
    rarity: x.rarity || 'common', valueLabel: String(x.value || '').slice(0, 64), description: x.desc || '', art: x.art || 'photo',
    artFileId: x.img ? (x.fileId || '') : '', slot: String(x.slot || '').slice(0, 64), modifiers: String(x.mods || '').slice(0, 500) }), 'item_instances', 'itemDefId');
  for (const x of ITEMS) if (!x.img) x.fileId = '';
  await syncDefs('skill_defs', 'skill_def', SKILLS, prev.SKILLS, IV.sdefs, x => ({ name: String(x.name || 'Compétence').slice(0, 128),
    statFieldId: statField(x.stat), defaultLevel: Math.max(1, Math.min(5, +x.level || 1)), description: x.desc || '', ...(IV.skillFormula ? { formula: String(x.roll || '').slice(0, 128) } : {}) }), 'skill_instances', 'skillDefId');
  await syncOwned('item_instances', INV, IV.inst, 'itemDefId', () => ({}), o => ({ qty: Math.max(1, Math.round(+o.qty || 1)) }));
  await syncOwned('skill_instances', SKOWN, IV.sinst, 'skillDefId', o => ({ level: Math.max(1, Math.min(5, +(SKILLS.find(s => s.id === o.def) || {}).level || 1)) }));
}

async function pushInvPlayer(prev) {
  for (const [tableId, list, before] of [['item_instances', INV, prev.INV], ['skill_instances', SKOWN, prev.SKOWN]]) {
    for (const o of list) {
      const p = before.find(x => x.iid === o.iid);
      if (!p || p.hidden === o.hidden) continue;
      const r = await call('player-action', { action: 'toggleHidden', tableId, rowId: o.iid });
      o.hidden = !!r.hiddenFromPlayers;
    }
  }
}

/* ---------------------------------------------------------------- realtime */
function subscribeInventory() {
  if (IV.unsub) { IV.unsub(); IV.unsub = null; }
  if (!ME.camp) return;
  const c = ME.camp.$id, ch = IV.charId;
  IV.unsub = AW.c.subscribe(['item_defs', 'skill_defs', 'item_instances', 'skill_instances'].map(t => `tablesdb.${TN.db}.tables.${t}.rows`), ev => {
    const p = ev.payload || {};
    if (p.campaignId !== c) return;
    if (p.characterId && p.characterId !== ch) return;
    clearTimeout(IV.reloadTimer);
    IV.reloadTimer = setTimeout(function again() {
      // never overwrite local edits that are not saved yet
      if (IV.busy || (IV.snap !== null && invSnapshot() !== IV.snap)) { IV.reloadTimer = setTimeout(again, 600); return; }
      if (ch === SH.charId) loadInventory(ch, true);
    }, 400);
  });
}

/* ---------------------------------------------------------------- hooks into the mockup / sheet.js */
const _loadSheetInv = loadSheet;
loadSheet = async function (charId) { await _loadSheetInv(charId); await loadInventory(charId); };
const _renderInv = render;
render = function () { _renderInv(); scheduleInv(); };
const _leaveInv = leaveCampaign;
leaveCampaign = function () {
  if (IV.unsub) { IV.unsub(); IV.unsub = null; }
  IV.snap = null; ITEMS.length = 0; INV.length = 0; SKILLS.length = 0; SKOWN.length = 0;
  _leaveInv();
};

// the mockup's texts name its demo character
const named = html => { const n = esc(charName()); return html.replaceAll('Donner à Inès', 'Donner à ' + n).replaceAll('Inventaire · Inès', 'Inventaire · ' + n)
  .replaceAll('Compétences · Inès', 'Compétences · ' + n).replaceAll('<span class="dot"></span>Inès</button>', `<span class="dot"></span>${n}</button>`); };
const _renderInventory = renderInventory, _renderSkills = renderSkills;
renderInventory = () => named(_renderInventory());
renderSkills = () => named(_renderSkills());

const needChar = () => { if (SH.charId) return true; toast('Choisis d’abord un personnage.'); return false; };
ACT.giveItem = d => {
  if (!needChar()) return false;
  // giving an item the character already carries (unequipped, same visibility) grows the stack
  const stack = INV.find(o => o.def === d.id && !o.slot && o.vis === 'all' && !o.hidden);
  if (stack) stack.qty = (stack.qty || 1) + 1; else INV.push({ iid: uid(), def: d.id, hidden: false, vis: 'all', qty: 1, slot: '' });
  toast(`Objet donné à ${charName()}${stack ? ` (×${stack.qty})` : ''}`);
};
ACT.giveSkill = d => { if (!needChar()) return false; SKOWN.push({ iid: uid(), def: d.id, hidden: false, vis: 'all' }); toast('Compétence donnée à ' + charName()); };
const _delItem = ACT.delItem, _delSkill = ACT.delSkill;
ACT.delItem = d => { const x = ITEMS.find(i => i.id === d.id); if (!x || !confirm(`Supprimer « ${x.name} » de la bibliothèque ? L’objet sera retiré à tous les personnages.`)) return false; return _delItem(d); };
ACT.delSkill = d => { const x = SKILLS.find(i => i.id === d.id); if (!x || !confirm(`Supprimer « ${x.name} » de la bibliothèque ? La compétence sera retirée à tous les personnages.`)) return false; return _delSkill(d); };
