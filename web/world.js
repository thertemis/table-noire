/* world.js — binds the mockup lore (LORE) and maps (MAPS with pois / texts) to Appwrite.
   Tables: lore_articles, maps, map_pois, map_texts (campaign-wide, each row has a visibility).
   Images: imported maps go to the `maps` bucket, lore images to `lore-images` (read: campaign team).
   Fog of war: the original map image is readable by the GMs only (apply-visibility); the players load a masked copy
   (maps.playerFileId) that the GM's app draws from the fog strokes and uploads on each change — the hidden parts of
   the map never reach a player's browser.
   Save: the GM's LORE / MAPS are diffed against the last synced snapshot; players only read.
   Realtime: changes from other sessions reload the world when nothing local is pending. */

const WD = { store: { lore_articles: new Map(), maps: new Map(), map_pois: new Map(), map_texts: new Map() },
  snap: null, busy: false, again: false, timer: null, unsub: null, reloadTimer: null, loaded: false };
const WORLD_TABLES = ['lore_articles', 'maps', 'map_pois', 'map_texts'];
const fileUrl = (bucket, id) => `${TN.endpoint}/storage/buckets/${bucket}/files/${id}/view?project=${TN.project}`;
const clearWorld = () => { LORE.length = 0; for (const k of Object.keys(MAPS)) delete MAPS[k]; };
// the mockup's boot() still needs its demo maps; drop them right after it ran
document.addEventListener('DOMContentLoaded', () => { if (!WD.loaded) clearWorld(); });

/* ---------------------------------------------------------------- load */
async function loadWorld(quiet = false) {
  if (!ME.camp) return;
  const c = ME.camp.$id, oldSnap = WD.snap, pre = worldSnapshot();
  if (!quiet) WD.snap = null;
  try {
    const [lore, maps, pois, texts] = await Promise.all(WORLD_TABLES.map(t => rows(t, [AW.Q.equal('campaignId', c)])));
    if (!ME.camp || ME.camp.$id !== c) return;
    if (quiet && worldSnapshot() !== pre) { WD.snap = oldSnap; return; }   // edited meanwhile: keep the local state
    WD.store = { lore_articles: new Map(lore.map(r => [r.$id, r])), maps: new Map(maps.map(r => [r.$id, r])),
      map_pois: new Map(pois.map(r => [r.$id, r])), map_texts: new Map(texts.map(r => [r.$id, r])) };
    clearWorld();
    lore.sort((a, b) => a.$createdAt.localeCompare(b.$createdAt))
      .forEach(r => LORE.push({ id: r.$id, title: r.title, vis: visFromDb(r.visibility), md: r.bodyMd || '', cat: r.category || '' }));
    const gmView = isGmHere();
    maps.forEach(r => { const fogRow = (() => { try { return JSON.parse(r.fog || 'null'); } catch (_) { return null; } })();
      const shown = !gmView && fogRow && fogRow.on && r.playerFileId ? r.playerFileId : r.imageFileId;
      MAPS[r.$id] = { name: r.name, parent: r.parentMapId || null, img: shown ? fileUrl('maps', shown) : '', pubId: r.playerFileId || '',
      fileId: r.imageFileId || '', w: r.width || 1600, h: r.height || 1100, vis: visFromDb(r.visibility), credit: '', pois: [], texts: [],
      fog: fogRow }; });
    for (const id of Object.keys(MAPS)) if (MAPS[id].parent && !MAPS[MAPS[id].parent]) MAPS[id].parent = null;   // parent hidden or gone
    pois.forEach(r => MAPS[r.mapId] && MAPS[r.mapId].pois.push({ id: r.$id, x: r.x, y: r.y, label: r.label || '', icon: r.icon || 'pin',
      color: r.color || '#e2672c', link: r.targetType && r.targetType !== 'none' && r.targetId ? `${r.targetType}:${r.targetId}` : '', vis: visFromDb(r.visibility), desc: r.description || '' }));
    texts.forEach(r => MAPS[r.mapId] && MAPS[r.mapId].texts.push({ id: r.$id, x: r.x, y: r.y, text: r.text || '', size: r.size || 32,
      color: r.color || '#2f2922', rot: r.rotation || 0, vis: visFromDb(r.visibility) }));
    if (!MAPS[S.map]) { S.map = rootMap(); S.view = { x: 0, y: 0, k: 1 }; S.openItem = null; }
    WD.loaded = true;
    WD.snap = worldSnapshot();
  } catch (e) { if (!quiet) toast('Lore et cartes indisponibles : ' + errMsg(e)); }
  subscribeWorld();
  if (!quiet && isGmHere() && Object.values(MAPS).some(needsPub)) { WD.snap = ''; scheduleWorld(300); }   // maps under fog without an up-to-date masked copy
  if (quiet && WD.snap === pre) return;   // nothing changed: no redraw
  if (quiet) { if (!S.mapEdit || S.tab !== 'carte') softRender(); } else render();
}
const rootMap = () => { const ids = Object.keys(MAPS); return ids.find(k => !MAPS[k].parent) || ids[0] || null; };

/* ---------------------------------------------------------------- save (diff) */
const worldSnapshot = () => JSON.stringify({ LORE, MAPS });
function scheduleWorld(delay = 700) {
  if (!ME.camp || WD.snap === null || !isGmHere()) return;
  clearTimeout(WD.timer); WD.timer = setTimeout(syncWorld, delay);
}
async function syncWorld() {
  if (!ME.camp || WD.snap === null) return;   // campaign closed meanwhile
  if (WD.busy) { WD.again = true; return; }
  if (worldSnapshot() === WD.snap) return;
  WD.busy = true;
  try { await pushWorld(); WD.snap = worldSnapshot(); }
  catch (e) { if (isNetErr(e)) NET.pending = true; else { toast('Enregistrement impossible : ' + errMsg(e)); WD.snap = worldSnapshot(); } }
  WD.busy = false;
  if (WD.again) { WD.again = false; scheduleWorld(100); }
}
async function uploadImage(bucketId, dataUrl, name) {
  const blob = await (await fetch(dataUrl)).blob();
  const file = await toWebp(blob, bucketId === 'maps' ? 4096 : 2048, name);
  // a map image starts GM-only: apply-visibility opens it to the players when the map has no fog
  const permissions = bucketId === 'maps' ? await gmFilePerms() : await teamReadPerms();
  return new Appwrite.Storage(AW.c).createFile({ bucketId, fileId: Appwrite.ID.unique(), file, permissions });
}
async function gmFilePerms(readRole) {
  if (!(await teamReadPerms()).length) return [];   // admin outside the team: default rights, apply-visibility fixes them
  const gm = Appwrite.Role.team(ME.camp.$id, 'gm');
  return [Appwrite.Permission.read(readRole || gm), Appwrite.Permission.update(gm), Appwrite.Permission.delete(gm)];
}

/* ---------------------------------------------------------------- fog: the players' masked copy */
// fog strokes, in order: [x, y, r] reveals, [x, y, r, 1] covers again (map image pixel space)
const fogSig = m => { const s = JSON.stringify([m.fileId, m.w, m.h, (m.fog && m.fog.holes) || []]); let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0; return h.toString(36) + s.length.toString(36); };
const needsPub = m => !!(m && m.fog && m.fog.on && m.fileId && (!m.pubId || m.fog.ps !== fogSig(m)));
async function fetchFile(url) {
  const fb = (() => { try { return localStorage.getItem('cookieFallback'); } catch (_) { return null; } })();
  const res = await fetch(url, { credentials: 'include', headers: fb && fb !== '[]' ? { 'X-Fallback-Cookies': fb } : {} });
  if (!res.ok) throw new Error('image ' + res.status);
  return res.blob();
}
async function maskedMap(m, name) {
  const bmp = await createImageBitmap(await fetchFile(fileUrl('maps', m.fileId)));
  const W = bmp.width, H = bmp.height, k = W / (m.w || W);
  const mask = document.createElement('canvas'); mask.width = W; mask.height = H;
  const mx = mask.getContext('2d');
  for (const [x, y, r, cover] of m.fog.holes || []) {
    mx.globalCompositeOperation = cover ? 'destination-out' : 'source-over';
    mx.beginPath(); mx.arc(x * k, y * k, Math.max(.5, r * k), 0, Math.PI * 2); mx.fillStyle = '#fff'; mx.fill();
  }
  mx.globalCompositeOperation = 'source-in'; mx.drawImage(bmp, 0, 0);   // the image, only inside the revealed parts
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ox = out.getContext('2d'); ox.fillStyle = '#0d0c0a'; ox.fillRect(0, 0, W, H); ox.drawImage(mask, 0, 0);
  bmp.close && bmp.close();
  const blob = await new Promise((ok, ko) => out.toBlob(b => (b ? ok(b) : ko(new Error('canvas'))), 'image/webp', .86));
  return new File([blob], name + '.webp', { type: 'image/webp' });
}
// before the rows are written: a fresh masked copy for each map whose fog changed; the replaced copies are returned
async function publishMasks() {
  const old = [];
  for (const [id, m] of Object.entries(MAPS)) {
    if (!(m.fog && m.fog.on && m.fileId)) { if (m.pubId) { old.push(m.pubId); m.pubId = ''; } continue; }
    if (!needsPub(m)) continue;
    try {
      const file = await maskedMap(m, 'map-pub-' + id);
      const f = await new Appwrite.Storage(AW.c).createFile({ bucketId: 'maps', fileId: Appwrite.ID.unique(), file,
        permissions: await gmFilePerms(m.vis === 'mj' ? null : Appwrite.Role.team(ME.camp.$id)) });
      if (m.pubId) old.push(m.pubId);
      m.pubId = f.$id; m.fog.ps = fogSig(m);
    } catch (e) { console.warn('masked map', id, e); }
  }
  return old;
}
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v || 0)));

function desiredWorld() {
  const c = ME.camp.$id, want = { lore_articles: new Map(), maps: new Map(), map_pois: new Map(), map_texts: new Map() };
  for (const a of LORE) {
    // the title is its own field (lore.js); an untitled article still takes its first heading
    if (!String(a.title || '').trim()) { const h = /^#\s+(.+)$/m.exec(a.md || ''); a.title = h ? h[1].trim() : 'Article'; }
    want.lore_articles.set(a.id, { title: String(a.title).slice(0, 255), bodyMd: a.md || '', visibility: visToDb(a.vis), category: String(a.cat || '').slice(0, 64) });
  }
  for (const [id, m] of Object.entries(MAPS)) {
    want.maps.set(id, { name: String(m.name || 'Carte').slice(0, 128), imageFileId: m.fileId || '', width: clampInt(m.w, 1, 1e6), height: clampInt(m.h, 1, 1e6),
      parentMapId: m.parent && MAPS[m.parent] ? m.parent : '', visibility: visToDb(m.vis || 'all'), fog: m.fog ? JSON.stringify(m.fog) : '', playerFileId: m.pubId || '' });
    for (const p of m.pois) {
      const [tt, ti] = p.link ? p.link.split(':') : ['none', ''];
      want.map_pois.set(p.id, { mapId: id, x: clampInt(p.x, -1e6, 1e6), y: clampInt(p.y, -1e6, 1e6), label: String(p.label || '').slice(0, 128),
        description: p.desc || '', icon: String(p.icon || 'pin').slice(0, 32), color: String(p.color || '').slice(0, 16),
        targetType: ['lore', 'map'].includes(tt) ? tt : 'none', targetId: ['lore', 'map'].includes(tt) ? ti : '', visibility: visToDb(p.vis) });
    }
    for (const t of m.texts) want.map_texts.set(t.id, { mapId: id, x: clampInt(t.x, -1e6, 1e6), y: clampInt(t.y, -1e6, 1e6), text: String(t.text || '').slice(0, 255),
      size: clampInt(t.size, 6, 200), color: String(t.color || '').slice(0, 16), rotation: clampInt(t.rot, -180, 180), visibility: visToDb(t.vis) });
  }
  return { c, want };
}
async function pushWorld() {
  // imported map images first, so the rows carry the file id
  for (const [id, m] of Object.entries(MAPS)) if (String(m.img || '').startsWith('data:')) {
    const f = await uploadImage('maps', m.img, 'map-' + id); m.fileId = f.$id; m.img = fileUrl('maps', f.$id);
  }
  const oldMasks = await publishMasks();
  const { c, want } = desiredWorld();
  const st = WD.store;
  for (const t of WORLD_TABLES) {   // creates / updates (parents before children)
    for (const [id, data] of want[t]) {
      const cur = st[t].get(id);
      if (!cur) st[t].set(id, await AW.db.createRow(T(t, { rowId: id, data: { campaignId: c, ...data } })));
      else if (Object.keys(data).some(k => (cur[k] ?? '') !== data[k])) st[t].set(id, await AW.db.updateRow(T(t, { rowId: id, data })));
    }
  }
  for (const t of [...WORLD_TABLES].reverse()) {   // deletions (children before parents)
    for (const [id, cur] of [...st[t]]) {
      if (want[t].has(id)) continue;
      await AW.db.deleteRow(T(t, { rowId: id })).catch(() => {});
      if (t === 'maps') for (const fid of [cur.imageFileId, cur.playerFileId]) if (fid) await new Appwrite.Storage(AW.c).deleteFile({ bucketId: 'maps', fileId: fid }).catch(() => {});
      st[t].delete(id);
    }
  }
  // the rows now point to the new masked copies: the old ones go
  for (const fid of oldMasks) await new Appwrite.Storage(AW.c).deleteFile({ bucketId: 'maps', fileId: fid }).catch(() => {});
}

/* ---------------------------------------------------------------- realtime */
function subscribeWorld() {
  if (WD.unsub) { WD.unsub(); WD.unsub = null; }
  if (!ME.camp) return;
  const c = ME.camp.$id;
  WD.unsub = AW.c.subscribe(WORLD_TABLES.map(t => `tablesdb.${TN.db}.tables.${t}.rows`), ev => {
    if ((ev.payload || {}).campaignId !== c) return;
    clearTimeout(WD.reloadTimer);
    WD.reloadTimer = setTimeout(function again() {
      if (WD.busy || (WD.snap !== null && worldSnapshot() !== WD.snap)) { WD.reloadTimer = setTimeout(again, 800); return; }
      if (ME.camp && ME.camp.$id === c) loadWorld(true);
    }, 500);
  });
}

/* ---------------------------------------------------------------- hooks into the mockup */
const _enterWorld = enterCampaign;
enterCampaign = async function (id) {
  WD.snap = null; WD.loaded = true; clearWorld();
  await _enterWorld(id);
  if (ME.camp) await loadWorld();
};
/* saves are debounced: write what is pending before the campaign closes (switch / logout) */
async function flushSaves() {
  const idle = async () => { for (let i = 0; i < 200 && (SH.busy || IV.busy || WD.busy); i++) await new Promise(r => setTimeout(r, 50)); };
  clearTimeout(SH.timer); clearTimeout(IV.timer); clearTimeout(WD.timer);
  await idle();
  try { if (isGmHere() || SH.charId) await syncSheet(); await syncInventory(); if (isGmHere()) await syncWorld(); }
  catch (e) { toast('Enregistrement impossible : ' + errMsg(e)); }
  await idle();
}
const _leaveWorld = leaveCampaign;
leaveCampaign = async function () {
  if (ME.camp) await flushSaves();
  if (WD.unsub) { WD.unsub(); WD.unsub = null; } WD.snap = null; clearWorld(); _leaveWorld();
};
const _logoutWorld = logout;
logout = async function () { if (ME.camp) await flushSaves(); return _logoutWorld(); };
const _renderWorld = render;
render = function () { _renderWorld(); scheduleWorld(); };
document.addEventListener('input', () => scheduleWorld(1000));
document.addEventListener('change', () => scheduleWorld(400));
document.addEventListener('pointerup', () => scheduleWorld(600));
document.addEventListener('click', () => scheduleWorld(600));

// empty campaign: no map yet
const _renderMap = renderMap;
renderMap = function () {
  if (!MAPS[S.map]) S.map = rootMap();
  if (!S.map) return `<div class="toolbar"><div><h2>Carte</h2><div class="sub">${isMJ() ? 'Aucune carte : importe une image pour commencer.' : 'Le MJ n’a pas encore partagé de carte.'}</div></div><span class="grow"></span>
    ${isMJ() ? `<button class="btn orange" data-act="importMap">${ic('upload')}Importer une image</button>` : ''}</div>`;
  let html = _renderMap();
  if (isMJ() && S.mapEdit) html = html.replace('Terminer l’édition</button>', `Terminer l’édition</button><button class="btn" data-act="renameMap">${ic('edit')}Renommer</button><button class="btn danger" data-act="deleteMap">${ic('trash')}Supprimer la carte</button>`);
  return html;
};
const _renderLore = renderLore;
renderLore = function () {
  let html = _renderLore();
  if (isMJ() && S.loreEdit) html = html.replace('Image</button>', `Image</button><button class="btn xs danger" data-act="deleteLore">${ic('trash', 12)}Supprimer</button>`);
  return html;
};

ACT.renameMap = () => { const m = MAPS[S.map]; const n = m && prompt('Nom de la carte', m.name); if (n && n.trim()) m.name = n.trim(); };
ACT.deleteMap = () => {
  const m = MAPS[S.map]; if (!m || !confirm(`Supprimer la carte « ${m.name} » avec ses points et ses textes ?`)) return false;
  for (const x of Object.values(MAPS)) if (x.parent === S.map) x.parent = m.parent || null;
  delete MAPS[S.map]; S.map = m.parent && MAPS[m.parent] ? m.parent : rootMap(); S.view = { x: 0, y: 0, k: 1 }; S.openItem = null; S.mapEdit = false;
};
ACT.deleteLore = () => {
  const i = LORE.findIndex(a => a.id === S.loreSel); if (i < 0 || !confirm(`Supprimer l’article « ${LORE[i].title} » ?`)) return false;
  LORE.splice(i, 1); S.loreSel = LORE[0] && LORE[0].id; S.loreEdit = false;
};
// the mockup inserts a demo image; online the GM picks a file, stored in `lore-images`
ACT.insertImg = () => {
  const ta = $('#mdArea'); if (!ta) return false;
  const pos = [ta.selectionStart, ta.selectionEnd];
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
  input.onchange = async () => {
    const f = input.files[0]; if (!f) return;
    try {
      toast('Envoi de l’image…');
      const up = await new Appwrite.Storage(AW.c).createFile({ bucketId: 'lore-images', fileId: Appwrite.ID.unique(), file: await toWebp(f, 2048, f.name), permissions: await teamReadPerms() });
      const area = $('#mdArea'); if (!area) return;
      area.setRangeText(`\n![${f.name.replace(/\.[^.]+$/, '')}](${fileUrl('lore-images', up.$id)})\n`, pos[0], pos[1], 'end');
      area.dispatchEvent(new Event('input', { bubbles: true })); area.focus();
    } catch (e) { toast('Image refusée : ' + errMsg(e)); }
  };
  input.click();
  return false;
};
