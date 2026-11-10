/* sheet.js — binds the mockup character sheet (object C) to Appwrite.
   Load: field_defs (campaign template) + character_values + wounds (+ gm_notes for the GM) + player_prefs
   are mapped into C, so the mockup renders and edits it unchanged.
   Save: after every render/input, C is diffed against the last synced snapshot and only the
   differences are written (GM: direct writes; player: player-action / own player_prefs).
   Realtime: changes to the current character's values and wounds are applied live. */

const SH = { charId: null, defs: new Map(), vals: new Map(), wounds: new Map(), notesDef: null, prefsId: null,
  snap: null, busy: false, again: false, timer: null, unsub: null, loading: false };
const visToDb = v => (v === 'mj' ? 'gm' : v || 'all');
const visFromDb = v => (v === 'gm' ? 'mj' : v || 'all');
const jparse = (s, d) => { try { const v = JSON.parse(s); return v ?? d; } catch (_) { return d; } };
const isGmHere = () => ME.role === 'gm';
// network failures keep the edit pending (net.js retries when the connection comes back)
const NET = { pending: false };
const isNetErr = e => !navigator.onLine || e instanceof TypeError || !!(e && (e.code === 0 || /Failed to fetch|NetworkError|network|Load failed/i.test(e.message || '')));
const T = (tableId, extra = {}) => ({ databaseId: TN.db, tableId, ...extra });

/* ---------------------------------------------------------------- default template (first GM visit) */
function defaultTemplate() {
  let i = 0;
  // labels in the interface language (they become campaign data); stat codes stay FOR/AGI… (display translates them)
  const d = (key, label, kind, config, vis = 'all') => ({ key, label: tr(label), kind, config: JSON.stringify(config), defaultVisibility: vis, sort: (i += 10) });
  return [
    ...[['for', 'Force', 'FOR'], ['agi', 'Agilité', 'AGI'], ['int', 'Intellect', 'INT'], ['per', 'Perception', 'PER'], ['vol', 'Volonté', 'VOL'], ['cha', 'Charisme', 'CHA']]
      .map(([k, l, a]) => d('stat_' + k, l, 'stat', { abbr: a, max: 20, default: 10 })),
    d('hp', 'Santé', 'gauge', { color: '#b8452f', hi: '#d9674e', max: 20, step: 1, min: 0, player_editable: true }),
    d('mind', 'Santé mentale', 'gauge', { color: '#4f8d89', hi: '#74b1ac', max: 15, step: 1, min: 0, player_editable: true }, 'owner'),
    d('money', 'Argent', 'counter', { unit: '€', step: 10, min: 0, player_editable: true }, 'owner'),
    ...['Prénom', 'Nom', 'Âge', 'Taille', 'Poids', 'Origine', 'Métier'].map((l, n) => d('f_' + n, l, 'text', {})),
    d('f_secret', 'Secret', 'text', {}, 'gm'),
    d('f_bio', 'Biographie', 'longtext', {}),
    d('notes', 'Infos importantes', 'card', {}),
  ];
}
function initialValue(def, cfg) {
  switch (def.kind) {
    case 'stat': return { value: cfg.default ?? 10, max: cfg.max ?? 20 };
    case 'gauge': return { value: cfg.max ?? 10, max: cfg.max ?? 10, step: cfg.step ?? 1 };
    case 'counter': return { value: cfg.default ?? 0, step: cfg.step ?? 1 };
    default: return '';
  }
}

/* ---------------------------------------------------------------- load */
async function loadSheet(charId) {
  SH.loading = true; SH.charId = charId; SH.snap = null;
  SH.defs.clear(); SH.vals.clear(); SH.wounds.clear(); SH.notesDef = null; SH.prefsId = null;
  if (!charId) { SH.loading = false; render(); return; }
  const c = ME.camp.$id, ch = ME.chars.find(x => x.$id === charId);
  try {
    let defs = await rows('field_defs', [AW.Q.equal('campaignId', c), AW.Q.orderAsc('sort')]);
    if (!defs.length && isGmHere()) {
      for (const d of defaultTemplate()) await AW.db.createRow(T('field_defs', { rowId: Appwrite.ID.unique(), data: { campaignId: c, ...d } }));
      defs = await rows('field_defs', [AW.Q.equal('campaignId', c), AW.Q.orderAsc('sort')]);
    }
    if (!isGmHere() && ch && ch.ownerId === ME.user.$id) {
      const seen = await rows('character_values', [AW.Q.equal('characterId', charId)]);
      // gm-only values are invisible to the player, so "missing" may be normal: the server skips existing rows
      if (seen.length < defs.length) await call('player-action', { action: 'ensureValues', characterId: charId }).catch(() => {});
    }
    const [vals, wounds, notes, prefs] = await Promise.all([
      rows('character_values', [AW.Q.equal('characterId', charId)]),
      rows('wounds', [AW.Q.equal('characterId', charId)]),
      isGmHere() ? rows('gm_notes', [AW.Q.equal('campaignId', c), AW.Q.equal('entityType', 'wound')]) : Promise.resolve([]),
      rows('player_prefs', [AW.Q.equal('campaignId', c), AW.Q.equal('userId', ME.user.$id)]).catch(() => []),
    ]);
    defs.forEach(d => SH.defs.set(d.$id, { ...d, cfg: jparse(d.config, {}) }));
    vals.forEach(v => SH.vals.set(v.fieldId, { rowId: v.$id, value: jparse(v.value, v.value), vis: v.visibility }));
    // GM materialises missing values (players cannot create them)
    if (isGmHere()) {   // in parallel, 6 at a time (a new character used to take one request after the other)
      const missing = [...SH.defs.values()].filter(d => !SH.vals.has(d.$id));
      for (let i = 0; i < missing.length; i += 6) await Promise.all(missing.slice(i, i + 6).map(async d => {
        const value = initialValue(d, d.cfg);
        const r = await AW.db.createRow(T('character_values', { rowId: Appwrite.ID.unique(),
          data: { campaignId: c, characterId: charId, fieldId: d.$id, value: JSON.stringify(value), visibility: d.defaultVisibility || 'all' } }));
        SH.vals.set(d.$id, { rowId: r.$id, value, vis: r.visibility });
      }));
    }
    const noteByWound = new Map(notes.map(n => [n.entityId, n]));
    wounds.forEach(w => SH.wounds.set(w.zone, { rowId: w.$id, noteId: noteByWound.get(w.$id)?.$id || null,
      w: { sev: w.severity, type: w.type || 'Autre', desc: w.description || '', mj: noteByWound.get(w.$id)?.body || '', vis: visFromDb(w.visibility) } }));
    const mine = prefs.find(p => p.characterId === charId) || prefs[0];
    SH.prefsId = mine ? mine.$id : null;
    // the player's own sheet arrangement (null = the GM's layout)
    S.pl = !isGmHere() && mine && mine.layout ? jparse(mine.layout, null) : null;
    if (typeof PLAYER_LAYOUT !== 'undefined') PLAYER_LAYOUT.last = JSON.stringify(S.pl);

    // ---- map into C (in place: C is a const of the mockup)
    const defsSorted = [...SH.defs.values()].sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const visible = d => SH.vals.has(d.$id);   // players only get the rows they may read
    const V = d => SH.vals.get(d.$id);
    C.stats = defsSorted.filter(d => d.kind === 'stat' && visible(d)).map(d => ({ id: d.$id, name: d.label, abbr: d.cfg.abbr || d.label.slice(0, 3).toUpperCase(),
      value: V(d).value?.value ?? 10, max: V(d).value?.max ?? d.cfg.max ?? 20, vis: visFromDb(V(d).vis), roll: d.cfg.roll || '' }));
    C.gauges = defsSorted.filter(d => (d.kind === 'gauge' || d.kind === 'counter') && visible(d)).map(d => ({ id: d.$id, label: d.label,
      value: V(d).value?.value ?? 0, max: V(d).value?.max ?? d.cfg.max ?? 10, step: V(d).value?.step ?? d.cfg.step ?? 1,
      color: d.cfg.color || '#d6a23c', hi: d.cfg.hi || '#e9bd62', unit: d.cfg.unit || '', counter: d.kind === 'counter', vis: visFromDb(V(d).vis) }));
    C.flavor = defsSorted.filter(d => (d.kind === 'text' || d.kind === 'longtext') && visible(d)).map(d => ({ id: d.$id, label: d.label,
      value: typeof V(d).value === 'string' ? V(d).value : '', vis: visFromDb(V(d).vis), wide: d.kind === 'longtext' }));
    SH.notesDef = defsSorted.find(d => d.kind === 'card') || null;
    C.notes = SH.notesDef && visible(SH.notesDef) ? (typeof V(SH.notesDef).value === 'string' ? V(SH.notesDef).value : '') : '';
    C.wounds = Object.fromEntries([...SH.wounds.entries()].map(([z, x]) => [z, { ...x.w }]));
    C.journal = mine ? (mine.journal || '') : '';
    C.portrait = cleanPortrait(jparse(ch?.portrait, null)) || { type: 'gen', style: 'croquis', p: { ...(typeof PDEF !== 'undefined' ? PDEF : {}) } };
    C.player = ch?.ownerId ? (ME.names[ch.ownerId] || '—') : (ch?.kind === 'npc' ? 'PNJ' : 'non attribué');
    SH.snap = snapshot();
  } catch (e) { toast('Fiche indisponible : ' + errMsg(e)); }
  SH.loading = false;
  subscribeSheet();
  render();
}

/* ---------------------------------------------------------------- save (diff) */
const snapshot = () => JSON.stringify({ stats: C.stats, gauges: C.gauges, flavor: C.flavor, notes: C.notes, journal: C.journal, wounds: C.wounds, portrait: C.portrait });
function scheduleSync(delay = 700) {
  if (!SH.charId || SH.loading || SH.snap === null) return;
  clearTimeout(SH.timer); SH.timer = setTimeout(syncSheet, delay);
}
async function syncSheet() {
  if (!ME.camp || !SH.charId || SH.snap === null) return;   // campaign closed meanwhile
  if (SH.busy) { SH.again = true; return; }
  const now = snapshot(); if (now === SH.snap) return;
  SH.busy = true;
  const prev = JSON.parse(SH.snap);
  try {
    if (isGmHere()) await pushGm(prev); else await pushPlayer(prev);
    SH.snap = snapshot();
  } catch (e) { if (isNetErr(e)) NET.pending = true; else { toast('Enregistrement impossible : ' + errMsg(e)); SH.snap = snapshot(); } }
  SH.busy = false;
  if (SH.again) { SH.again = false; scheduleSync(100); }
}

function defDataOf(kind, item, sort) {
  if (kind === 'stat') return { label: item.name, kind: 'stat', config: JSON.stringify({ abbr: item.abbr, max: item.max, default: 10, ...(item.roll ? { roll: String(item.roll).slice(0, 128) } : {}) }), sort };
  if (kind === 'gauge') return item.counter
    ? { label: item.label, kind: 'counter', config: JSON.stringify({ unit: item.unit || '', step: item.step || 1, min: 0, player_editable: true }), sort }
    : { label: item.label, kind: 'gauge', config: JSON.stringify({ color: item.color, hi: item.hi, max: item.max, step: item.step || 1, min: 0, player_editable: true }), sort };
  return { label: item.label, kind: item.wide ? 'longtext' : 'text', config: '{}', sort };
}
function valueOf(kind, item) {
  if (kind === 'stat') return { value: +item.value || 0, max: +item.max || 20 };
  if (kind === 'gauge') return item.counter ? { value: +item.value || 0, step: item.step || 1 } : { value: +item.value || 0, max: +item.max || 1, step: item.step || 1 };
  return String(item.value ?? '');
}
const sameDef = (row, data) => row.label === data.label && row.kind === data.kind && (row.config || '{}') === data.config && (row.sort || 0) === data.sort;

async function upsertValue(fieldId, value, vis) {
  const cur = SH.vals.get(fieldId), json = JSON.stringify(value);
  if (!cur) {
    const r = await AW.db.createRow(T('character_values', { rowId: Appwrite.ID.unique(),
      data: { campaignId: ME.camp.$id, characterId: SH.charId, fieldId, value: json, visibility: visToDb(vis) } }));
    SH.vals.set(fieldId, { rowId: r.$id, value, vis: visToDb(vis) });
    return;
  }
  const data = {};
  if (JSON.stringify(cur.value) !== json) data.value = json;
  if (cur.vis !== visToDb(vis)) data.visibility = visToDb(vis);
  if (Object.keys(data).length) {
    await AW.db.updateRow(T('character_values', { rowId: cur.rowId, data }));
    if (data.value && typeof logChange === 'function') logChange(fieldId, cur.value, value);
    SH.vals.set(fieldId, { ...cur, value, vis: visToDb(vis) });
  }
}

async function pushGm(prev) {
  const c = ME.camp.$id;
  // template sections: stats, gauges, flavor (order = sort)
  for (const [kind, list, before] of [['stat', C.stats, prev.stats], ['gauge', C.gauges, prev.gauges], ['flavor', C.flavor, prev.flavor]]) {
    const base = { stat: 100, gauge: 300, flavor: 500 }[kind];
    for (let i = 0; i < list.length; i++) {
      const item = list[i], data = defDataOf(kind, item, base + i * 10);
      let def = SH.defs.get(item.id);
      if (!def) {
        const r = await AW.db.createRow(T('field_defs', { rowId: Appwrite.ID.unique(),
          data: { campaignId: c, key: `${kind}_${Date.now().toString(36)}${i}`, defaultVisibility: visToDb(item.vis), ...data } }));
        def = { ...r, cfg: jparse(r.config, {}) }; SH.defs.set(r.$id, def); item.id = r.$id;
      } else if (!sameDef(def, data)) {
        const r = await AW.db.updateRow(T('field_defs', { rowId: def.$id, data }));
        SH.defs.set(def.$id, { ...r, cfg: jparse(r.config, {}) });
      }
      await upsertValue(item.id, valueOf(kind, item), item.vis);
    }
    const kept = new Set(list.map(x => x.id));
    for (const old of before) {
      if (kept.has(old.id) || !SH.defs.has(old.id)) continue;
      // removing a field removes it from the campaign template (all characters)
      // its values go too, on every character of the campaign (not only the open one)
      const orphans = await rows('character_values', [AW.Q.equal('campaignId', c), AW.Q.equal('fieldId', old.id)]).catch(() => []);
      for (const v of orphans) await AW.db.deleteRow(T('character_values', { rowId: v.$id })).catch(() => {});
      SH.vals.delete(old.id);
      await AW.db.deleteRow(T('field_defs', { rowId: old.id })).catch(() => {});
      SH.defs.delete(old.id);
    }
  }
  // notes card
  if (C.notes !== prev.notes) {
    if (!SH.notesDef) {
      const r = await AW.db.createRow(T('field_defs', { rowId: Appwrite.ID.unique(), data: { campaignId: c, key: 'notes', label: 'Infos importantes', kind: 'card', config: '{}', sort: 900 } }));
      SH.notesDef = r; SH.defs.set(r.$id, { ...r, cfg: {} });
    }
    await upsertValue(SH.notesDef.$id, C.notes, SH.vals.get(SH.notesDef.$id)?.vis ? visFromDb(SH.vals.get(SH.notesDef.$id).vis) : 'all');
  }
  // wounds (+ GM note in gm_notes)
  const zones = new Set([...Object.keys(C.wounds), ...Object.keys(prev.wounds || {})]);
  for (const z of zones) {
    const w = C.wounds[z], cur = SH.wounds.get(z);
    if (!w || !w.sev) {
      if (cur) {
        if (cur.noteId) await AW.db.deleteRow(T('gm_notes', { rowId: cur.noteId })).catch(() => {});
        await AW.db.deleteRow(T('wounds', { rowId: cur.rowId })).catch(() => {});
        SH.wounds.delete(z);
      }
      continue;
    }
    if (cur && JSON.stringify(cur.w) === JSON.stringify(w)) continue;
    const data = { severity: +w.sev, type: w.type || 'Autre', description: w.desc || '', visibility: visToDb(w.vis) };
    let rowId = cur?.rowId, noteId = cur?.noteId || null;
    if (!cur) rowId = (await AW.db.createRow(T('wounds', { rowId: Appwrite.ID.unique(), data: { campaignId: c, characterId: SH.charId, zone: z, ...data } }))).$id;
    else await AW.db.updateRow(T('wounds', { rowId, data }));
    if ((w.mj || '') !== (cur?.w.mj || '')) {
      if (noteId) await AW.db.updateRow(T('gm_notes', { rowId: noteId, data: { body: w.mj || '' } }));
      else if (w.mj) noteId = (await AW.db.createRow(T('gm_notes', { rowId: Appwrite.ID.unique(), data: { campaignId: c, entityType: 'wound', entityId: rowId, body: w.mj } }))).$id;
    }
    SH.wounds.set(z, { rowId, noteId, w: { ...w } });
  }
  // portrait
  if (JSON.stringify(C.portrait) !== JSON.stringify(prev.portrait)) {
    await storePortraitImage();
    await AW.db.updateRow(T('characters', { rowId: SH.charId, data: { portrait: JSON.stringify(C.portrait) } }));
  }
}

async function pushPlayer(prev) {
  // the player's own stats, information fields and card (player-action checks ownership and the GM-only fields)
  const send = async (id, value) => { const cur = SH.vals.get(id); if (cur) await call('player-action', { action: 'setValue', rowId: cur.rowId, value }); };
  for (const s of C.stats) { const p = prev.stats.find(x => x.id === s.id); if (p && p.value !== s.value) await send(s.id, +s.value); }
  for (const f of C.flavor) { const p = prev.flavor.find(x => x.id === f.id); if (p && p.value !== f.value) await send(f.id, String(f.value ?? '')); }
  if (C.notes !== prev.notes && SH.notesDef) await send(SH.notesDef.$id, C.notes);
  for (const g of C.gauges) {
    const p = prev.gauges.find(x => x.id === g.id);
    if (!p || p.value === g.value) continue;
    const cur = SH.vals.get(g.id); if (!cur) continue;
    await call('player-action', { action: 'setValue', rowId: cur.rowId, value: +g.value });
  }
  if (C.journal !== prev.journal) {
    if (SH.prefsId) await AW.db.updateRow(T('player_prefs', { rowId: SH.prefsId, data: { journal: C.journal } }));
    else {
      const me = Appwrite.Role.user(ME.user.$id);
      SH.prefsId = (await AW.db.createRow(T('player_prefs', { rowId: Appwrite.ID.unique(),
        data: { campaignId: ME.camp.$id, userId: ME.user.$id, characterId: SH.charId, journal: C.journal },
        permissions: [Appwrite.Permission.read(me), Appwrite.Permission.update(me), Appwrite.Permission.delete(me)] }))).$id;
    }
  }
  if (JSON.stringify(C.portrait) !== JSON.stringify(prev.portrait)) {
    await storePortraitImage();
    await call('player-action', { action: 'setPortrait', characterId: SH.charId, portrait: JSON.stringify(C.portrait) });
  }
}

/* imported portrait images go to the `portraits` bucket; the JSON keeps only the file URL */
async function storePortraitImage() {
  const p = C.portrait;
  if (!p || p.type !== 'img' || !String(p.src || '').startsWith('data:')) return;
  const blob = await (await fetch(p.src)).blob();
  const file = await toWebp(blob, 1024, `portrait-${SH.charId}`);
  const team = Appwrite.Role.team(ME.camp.$id);
  const storage = new Appwrite.Storage(AW.c);
  const perms = ME.role === 'gm' && ME.isAdmin && !(await AW.teams.listMemberships({ teamId: ME.camp.$id, queries: [AW.Q.equal('userId', ME.user.$id)] }).then(m => m.total).catch(() => 0))
    ? [] : [Appwrite.Permission.read(team)];
  const f = await storage.createFile({ bucketId: 'portraits', fileId: Appwrite.ID.unique(), file, permissions: perms });
  p.fileId = f.$id;
  p.src = `${TN.endpoint}/storage/buckets/portraits/files/${f.$id}/view?project=${TN.project}`;
}

/* ---------------------------------------------------------------- realtime for the open sheet */
function subscribeSheet() {
  if (SH.unsub) { SH.unsub(); SH.unsub = null; }
  if (!SH.charId) return;
  const id = SH.charId;
  SH.unsub = AW.c.subscribe([`tablesdb.${TN.db}.tables.character_values.rows`, `tablesdb.${TN.db}.tables.wounds.rows`], ev => {
    const p = ev.payload || {};
    if (p.characterId !== id || SH.busy) return;
    const before = snapshot();
    // a local edit is waiting to be saved: don't overwrite it with an older server state (it is saved next anyway)
    if (SH.snap !== null && before !== SH.snap) return;
    const del = (ev.events || []).some(e => e.endsWith('.delete'));
    if (p.$tableId === 'character_values' || p.fieldId) {
      const value = jparse(p.value, p.value);
      if (del) SH.vals.delete(p.fieldId); else SH.vals.set(p.fieldId, { rowId: p.$id, value, vis: p.visibility });
      const apply = list => { const o = list.find(x => x.id === p.fieldId); if (!o || del) return false;
        if (typeof value === 'object' && value) { if ('value' in value) o.value = value.value; if ('max' in value) o.max = value.max; if ('step' in value) o.step = value.step; } else o.value = value;
        o.vis = visFromDb(p.visibility); return true; };
      if (!apply(C.stats) && !apply(C.gauges) && !apply(C.flavor) && SH.notesDef && p.fieldId === SH.notesDef.$id && !del) C.notes = typeof value === 'string' ? value : '';
    } else if (p.zone) {
      if (del) { delete C.wounds[p.zone]; SH.wounds.delete(p.zone); }
      else {
        const cur = SH.wounds.get(p.zone);
        const w = { sev: p.severity, type: p.type || 'Autre', desc: p.description || '', mj: cur?.w.mj || '', vis: visFromDb(p.visibility) };
        C.wounds[p.zone] = w; SH.wounds.set(p.zone, { rowId: p.$id, noteId: cur?.noteId || null, w: { ...w } });
      }
    }
    SH.snap = snapshot();
    if (SH.snap === before) return;   // echo of our own save: nothing to redraw
    const typing = document.activeElement && document.activeElement.closest('#main') && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!typing) render();
  });
}

/* ---------------------------------------------------------------- hooks into the mockup / online.js */
const _renderSheet = render;
render = function () {
  if (ME.camp && !SH.charId && !SH.loading) {
    const first = ME.chars.find(c => c.ownerId === ME.user.$id) || (isGmHere() ? ME.chars[0] : null);
    if (first) { loadSheet(first.$id); return; }
    if (S.tab === 'fiche') { renderHeader(); $('#main').innerHTML = noCharacterHtml(); return; }
  }
  if (SH.loading && S.tab === 'fiche') { renderHeader(); $('#main').innerHTML = '<p class="hint" style="padding:30px">Chargement de la fiche…</p>'; return; }
  _renderSheet();
  scheduleSync();
};
document.addEventListener('input', () => scheduleSync(900));
document.addEventListener('change', () => scheduleSync(300));
function noCharacterHtml() {
  return `<div class="tile" style="max-width:640px"><div class="tile-head"><span class="led"></span><h3 class="tile-title">Aucun personnage</h3></div>
    <p class="hint">${isGmHere() ? 'Crée un personnage (ou invite un joueur) depuis « Joueurs &amp; invitations », puis choisis-le dans la barre « Personnage ».' : 'Le MJ ne t’a pas encore attribué de personnage dans cette campagne.'}</p>
    ${isGmHere() ? `<button class="btn orange" data-act="membersMgr">${ic('ticket')}Joueurs &amp; invitations</button>` : ''}</div>`;
}

// identity tile: character name + owner instead of the mockup's hard-coded demo values
tIdentity = function () {
  const ch = ME.chars.find(x => x.$id === SH.charId) || {};
  const first = flv('Prénom'), last = flv('Nom');
  const name = first || last ? `${esc(first)}<br>${esc(last)}` : esc(ch.name || 'Personnage');
  const age = flv('Âge');
  return tile('identity', 'Identité', `<div class="ident"><div><div class="portrait well">${portraitHtml()}</div>${S.viewer !== 'other' ? `<div class="pt-acts"><button class="btn xs" data-act="portraitCreate">${ic('edit', 12)}Créer</button><button class="btn xs" data-act="portraitImport" aria-label="Importer une image de portrait" title="Importer une image">${ic('upload', 12)}</button></div>` : ''}</div><div style="min-width:0">
    <div class="ident-name">${name}</div>
    <div class="ident-sub">${esc((flv('Métier') || '').split(',')[0] || (ch.kind === 'npc' ? 'PNJ' : 'Personnage'))}</div>
    <div class="chips"><span class="chip">Joueur : ${esc(C.player)}</span>${age ? `<span class="chip">${esc(/\d$/.test(age) ? age + ' ans' : age)}</span>` : ''}</div></div></div>`);
};

// the sheet follows the character picked in the header (GM "MJ" keeps the current sheet)
const _pickChar = ACT.pickChar;
ACT.pickChar = d => { _pickChar(d); if (d.id && d.id !== SH.charId) { loadSheet(d.id); return false; } };
const _enterCampaign = enterCampaign;
enterCampaign = async function (id) {
  if (SH.unsub) { SH.unsub(); SH.unsub = null; }
  SH.charId = null;
  await _enterCampaign(id);
};
// called by enterCampaign while the start-up screen is still up: the app shows with the real sheet, never the mockup's
async function preloadCampaign() {
  const first = ME.charId || (ME.chars[0] && ME.chars[0].$id) || null;
  await loadSheet(first);
}
const _leave = leaveCampaign;
leaveCampaign = function () { if (SH.unsub) { SH.unsub(); SH.unsub = null; } SH.charId = null; _leave(); };
