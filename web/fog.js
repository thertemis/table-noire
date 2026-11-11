/* fog.js — map tools.
   Fog of war (GM): maps.fog (JSON) = { on, holes: [[x, y, r] reveal | [x, y, r, 1] cover, …] in order, scale: { px, n, unit },
   ps: signature of the masked copy } in the map image's pixel space, saved with the map (world.js). Players see the map covered except the revealed circles (points and texts
   under the fog are hidden too); the GM sees the fog translucent. A new map asks whether it has fog; switching the fog
   off asks for confirmation (it shows the whole map to the players).
   Tools above the map, one at a time (picking another tool, adding a point / text or leaving edit mode always stops
   the brush, so nothing is revealed by accident):
     everyone: Move · Measure (with the GM's scale) · Draw · Ping · Eraser (own drawings; the GM erases any)
     GM, when the map has fog: Reveal · Cover, brush diameter in map pixels (slider, number, [ and ] keys), brush outline.
   Drawings and pings are rows of map_marks created by player-action (read: campaign; delete: author + GMs) and
   shared live (realtime). A ping row is deleted by its author after a few seconds.
   Anti-cheat: under fog the players never load the original image, only a masked copy drawn by the GM's app (world.js). */

const FOG = { size: 120, drag: null, cursor: null };   // size: brush diameter, in map pixels
const FOG_MIN = 2, FOG_MAX = 2000;
const fogSize = v => Math.max(FOG_MIN, Math.min(FOG_MAX, Math.round(+v || FOG.size)));
// is a map point revealed? the strokes apply in order (a cover hides what an earlier reveal opened)
const fogOpenAt = (holes, px, py) => { let open = false; for (const [x, y, r, c] of holes || []) if (Math.hypot(px - x, py - y) <= r) open = !c; return open; };
const MT = { tool: 'move', color: '#e2672c', width: 4, marks: new Map(), pings: [], live: null, measure: null, unsub: null };
const MT_COLORS = ['#e2672c', '#d6a23c', '#4f8d89', '#86985a', '#b8452f', '#8d6b9a', '#f0d9b5', '#141310'];
const fogOf = m => (m && m.fog && m.fog.on ? m.fog : null);
const mapMeta = m => (m.fog = m.fog || { on: false, holes: [] });
const screenU = px => px * unitPx() / S.view.k;   // a length in screen pixels, in map units at the current zoom

/* ---------------------------------------------------------------- layers */
function fogSvg(m) {
  const f = fogOf(m); if (!f) return '';
  return `<g id="fogLayer" pointer-events="none"><defs><mask id="fogMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${m.w}" height="${m.h}">
    <rect width="${m.w}" height="${m.h}" fill="#fff"/>${(f.holes || []).map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c ? '#fff' : '#000'}"/>`).join('')}</mask></defs>
    <rect class="fog ${isMJ() ? 'gm' : ''}" width="${m.w}" height="${m.h}" mask="url(#fogMask)"/></g>`;
}
const pathD = pts => 'M' + pts.map(p => `${p[0]} ${p[1]}`).join(' L');
function marksSvg(mapId) {
  let out = '';
  for (const r of MT.marks.values()) {
    if (r.mapId !== mapId || r.kind !== 'draw') continue;
    let pts = []; try { pts = JSON.parse(r.points || '[]'); } catch (_) {}
    if (pts.length < 2) continue;
    const mine = r.authorId === ME.user?.$id;
    out += `<path class="mark ${mine || isMJ() ? 'erasable' : ''}" data-mark="${esc(r.$id)}" d="${pathD(pts)}" stroke="${esc(r.color || '#e2672c')}" stroke-width="${+r.width || 4}"><title>${esc(r.authorName || '')}</title></path>`;
  }
  return `<g id="marksLayer" class="${MT.tool === 'erase' ? 'erasing' : ''}">${out}</g>`;
}
function overSvg(m) {
  let out = '';
  if (FOG.cursor && (MT.tool === 'reveal' || MT.tool === 'cover') && fogOf(m))
    out += `<circle class="brush ${MT.tool}" cx="${FOG.cursor.x}" cy="${FOG.cursor.y}" r="${FOG.size / 2}" stroke-width="1.5"/>`;
  if (MT.live && MT.live.pts.length > 1) out += `<path class="mark" d="${pathD(MT.live.pts)}" stroke="${MT.color}" stroke-width="${MT.width}"/>`;
  if (MT.measure) {
    const { a, b } = MT.measure, d = Math.hypot(b.x - a.x, b.y - a.y), s = (m.fog && m.fog.scale) || null;
    const label = s && s.px > 0 ? `${(d / s.px * (s.n || 1)).toFixed(1)} ${s.unit || ''}` : `${Math.round(d)} px`;
    const fs = screenU(13);
    out += `<g class="measure"><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><circle cx="${a.x}" cy="${a.y}" r="${screenU(4)}"/><circle cx="${b.x}" cy="${b.y}" r="${screenU(4)}"/>
      <text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - fs * .6}" font-size="${fs}">${esc(label)}</text></g>`;
  }
  const now = Date.now();
  for (const p of MT.pings) if (p.mapId === S.map && now - p.t < 4000) {
    const r = screenU(26);
    out += `<g class="ping" transform="translate(${p.x} ${p.y})" style="--pc:${esc(p.color)}"><circle r="${r}"/><circle r="${r}" class="p2"/><circle r="${screenU(5)}" class="dot"/>
      ${p.name ? `<text y="${-r * 1.25}" font-size="${screenU(12)}">${esc(p.name)}</text>` : ''}</g>`;
  }
  return `<g id="overLayer" pointer-events="none">${out}</g>`;
}
// marks under the fog (players do not see drawings in covered areas), then the fog, then pings / measure / live stroke
function placeFog() {
  const w = $('#world'); if (!w) return;
  w.querySelectorAll('#marksLayer,#fogLayer,#overLayer').forEach(n => n.remove());
  const m = MAPS[S.map]; if (!m) return;
  w.insertAdjacentHTML('beforeend', marksSvg(S.map) + fogSvg(m) + overSvg(m));
  if (fogOf(m) && !isMJ()) {   // players: no point or text inside the fog
    const holes = m.fog.holes || [];
    w.querySelectorAll('.poi,.mtext').forEach(el => {
      const it = refObj('poi', el.dataset.poi || el.dataset.mtext); if (!it) return;
      el.style.display = fogOpenAt(holes, it.x, it.y) ? '' : 'none';
    });
  }
}
const drawOver = () => { const w = $('#world'), m = MAPS[S.map]; if (!w || !m) return; w.querySelector('#overLayer')?.remove(); w.insertAdjacentHTML('beforeend', overSvg(m)); };
const _refreshMapItemsFog = refreshMapItems;
refreshMapItems = function () { _refreshMapItemsFog(); placeFog(); };
const _renderFog = render;
render = function () {
  _renderFog();
  if (S.tab !== 'carte') return;
  placeFog();
  const m = MAPS[S.map];
  // a map just imported by the GM: fog or not is decided now, before anyone explores it
  if (m && isMJ() && m.fog === undefined && String(m.img || '').startsWith('data:')) {
    m.fog = { on: false, holes: [] };
    setTimeout(() => { if (confirm('Activer le brouillard de guerre sur cette carte ? Les joueurs ne verront que ce que tu dévoiles.')) { m.fog.on = true; MT.tool = 'reveal'; render(); } }, 60);
  }
};

/* ---------------------------------------------------------------- toolbars */
function toolBtn(t, icon, label) { return `<button class="btn xs ${MT.tool === t ? 'on' : ''}" data-act="mapTool" data-t="${t}" title="${label}">${ic(icon, 13)}${label}</button>`; }
const _renderMapFog = renderMap;
renderMap = function () {
  let html = _renderMapFog();
  const m = MAPS[S.map];
  if (S.tab !== 'carte' || !m) return html;
  if (MT.tool !== 'move' && MT.tool !== 'reveal' && MT.tool !== 'cover' && S.addMode) MT.tool = 'move';
  const gmFog = isMJ() && fogOf(m);
  const bar = `<div class="maptools" role="toolbar" aria-label="Outils de carte">
    ${toolBtn('move', 'move', 'Déplacer')}${toolBtn('measure', 'target', 'Mesurer')}${toolBtn('draw', 'edit', 'Dessiner')}${toolBtn('ping', 'pin', 'Ping')}${toolBtn('erase', 'trash', 'Gomme')}
    ${gmFog ? `<span class="sep"></span>${toolBtn('reveal', 'eye', 'Révéler')}${toolBtn('cover', 'eyeOff', 'Recouvrir')}
      <label class="fog-size" title="Diamètre du pinceau en pixels de la carte · touches [ et ]">Pinceau<input type="range" min="${FOG_MIN}" max="${Math.min(FOG_MAX, Math.max(400, Math.round(Math.max(m.w, m.h) / 4)))}" step="1" value="${FOG.size}" data-fog-size aria-label="Taille du pinceau"><input class="field" type="number" min="${FOG_MIN}" max="${FOG_MAX}" step="1" value="${FOG.size}" data-fog-size aria-label="Diamètre du pinceau en pixels">px</label>` : ''}
    ${MT.tool === 'draw' ? `<span class="sep"></span><span class="mt-sw">${MT_COLORS.map(c => `<button style="--sw:${c}" data-act="mapColor" data-c="${c}" aria-pressed="${MT.color === c}" aria-label="Couleur ${c}"></button>`).join('')}</span>
      <label class="fog-size">Trait<input type="range" min="1" max="20" value="${MT.width}" data-mt-width aria-label="Épaisseur du trait"></label>` : ''}
    ${MT.tool === 'erase' ? `<span class="sep"></span><button class="btn xs" data-act="eraseMine">Effacer mes dessins</button>${isMJ() ? '<button class="btn xs" data-act="eraseAll">Effacer tous les dessins</button>' : ''}` : ''}
  </div>`;
  html = html.replace('<div class="mapwrap well" id="mapwrap">', `<div class="mapwrap well tool-${MT.tool}" id="mapwrap">${bar}`);
  if (isMJ() && S.mapEdit) {
    const f = m.fog || {}, s = f.scale || {};
    const fogTools = `<span class="fog-tools"><button class="btn ${f.on ? 'on' : ''}" data-act="fogToggle">${ic(f.on ? 'eyeOff' : 'eye')}${f.on ? 'Brouillard activé' : 'Sans brouillard'}</button>
      ${f.on ? `<button class="btn" data-act="fogReset">Tout recouvrir</button><button class="btn" data-act="fogClear">Tout dévoiler</button>` : ''}
      <label class="fog-size" title="Pour l’outil Mesurer">Échelle<input class="field" type="number" min="1" value="${s.px || ''}" placeholder="px" data-scale="px" aria-label="Pixels de la carte">px =<input class="field" type="number" min="0" step="any" value="${s.n || ''}" placeholder="1" data-scale="n" aria-label="Distance"><input class="field" value="${esc(s.unit || '')}" placeholder="m" maxlength="8" data-scale="unit" aria-label="Unité"></label></span>`;
    html = html.replace('<span class="hint">En édition, glisse un point', `${fogTools}<span class="hint">En édition, glisse un point`);
  }
  return html;
};
ACT.mapTool = d => { MT.tool = MT.tool === d.t && d.t !== 'move' ? 'move' : d.t; MT.live = MT.measure = null; if (MT.tool !== 'move') S.addMode = null; };
ACT.mapColor = d => { MT.color = d.c; };
ACT.fogToggle = () => {
  const m = MAPS[S.map], f = mapMeta(m);
  if (f.on) { if (!confirm('Désactiver le brouillard ? Toute la carte devient visible pour les joueurs.')) return false; f.on = false; }
  else f.on = true;
  if (!f.on && (MT.tool === 'reveal' || MT.tool === 'cover')) MT.tool = 'move';
};
ACT.fogReset = () => { if (confirm('Recouvrir toute la carte ?')) MAPS[S.map].fog.holes = []; };
ACT.fogClear = () => { if (confirm('Dévoiler toute la carte aux joueurs ? Le brouillard sera désactivé.')) { MAPS[S.map].fog = { ...MAPS[S.map].fog, on: false, holes: [] }; MT.tool = 'move'; } };
ACT.mapEdit = (orig => () => { MT.tool = 'move'; MT.live = MT.measure = null; return orig(); })(ACT.mapEdit);
ACT.addMode = (orig => d => { MT.tool = 'move'; return orig(d); })(ACT.addMode);
ACT.eraseMine = () => { eraseMarks([...MT.marks.values()].filter(r => r.mapId === S.map && r.kind === 'draw' && r.authorId === ME.user.$id)); return false; };
ACT.eraseAll = () => {
  const list = [...MT.marks.values()].filter(r => r.mapId === S.map && r.kind === 'draw');
  if (list.length && confirm(`Effacer les ${list.length} dessins de cette carte, pour toute la table ?`)) eraseMarks(list);
  return false;
};
document.addEventListener('input', e => {
  if (!e.target.matches) return;
  if (e.target.matches('[data-fog-size]')) { FOG.size = fogSize(e.target.value); document.querySelectorAll('[data-fog-size]').forEach(x => { if (x !== e.target) x.value = FOG.size; }); drawOver(); }
  if (e.target.matches('[data-mt-width]')) MT.width = +e.target.value;
  if (e.target.matches('[data-scale]') && MAPS[S.map]) {
    const f = mapMeta(MAPS[S.map]), s = f.scale = { ...(f.scale || {}) }, k = e.target.dataset.scale;
    s[k] = k === 'unit' ? e.target.value.slice(0, 8) : Math.max(0, +e.target.value || 0);
  }
});

/* ---------------------------------------------------------------- pointer: the active tool goes before the map's pan / drag */
const toolOn = e => S.tab === 'carte' && MT.tool !== 'move' && ME.camp && e.target.closest && e.target.closest('#mapsvg') && !e.target.closest('.maptools');
const worldAt = e => toWorld(svgPoint($('#mapsvg'), e.clientX, e.clientY));
function paintAt(e) {
  const m = MAPS[S.map]; if (!fogOf(m) || !isMJ()) return;
  const p = worldAt(e), r = Math.max(1, FOG.size / 2), x = Math.round(p.x * 10) / 10, y = Math.round(p.y * 10) / 10;
  const last = FOG.drag && FOG.drag.last;
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < Math.max(.5, r / 4)) return;
  const holes = m.fog.holes = m.fog.holes || [];
  if (MT.tool === 'reveal') holes.push([x, y, r]);
  else {
    // cover: exactly the brush area; strokes now entirely under it are useless and dropped
    m.fog.holes = holes.filter(([hx, hy, hr]) => Math.hypot(hx - x, hy - y) + hr > r);
    while (m.fog.holes.length && m.fog.holes[0][3]) m.fog.holes.shift();   // nothing open before: covering it is a no-op
    if (m.fog.holes.length) m.fog.holes.push([x, y, r, 1]);
  }
  if (FOG.drag) FOG.drag.last = p;
  placeFog();
}
document.addEventListener('pointerdown', e => {
  if (!toolOn(e)) return;
  e.stopPropagation(); e.preventDefault();
  const p = worldAt(e);
  if (MT.tool === 'reveal' || MT.tool === 'cover') { FOG.drag = { last: null }; paintAt(e); return; }
  if (MT.tool === 'draw') { MT.live = { pts: [[Math.round(p.x), Math.round(p.y)]] }; return; }
  if (MT.tool === 'measure') { MT.measure = { a: p, b: p, on: true }; drawOver(); return; }
  if (MT.tool === 'ping') { sendMark('ping', [[Math.round(p.x), Math.round(p.y)]]); return; }
  if (MT.tool === 'erase') { const el = e.target.closest('[data-mark]'); const r = el && MT.marks.get(el.dataset.mark); if (r && (r.authorId === ME.user.$id || isMJ())) eraseMarks([r]); }
}, true);
document.addEventListener('pointermove', e => {
  if ((MT.tool === 'reveal' || MT.tool === 'cover') && S.tab === 'carte' && e.target.closest && e.target.closest('#mapsvg')) { FOG.cursor = worldAt(e); if (!FOG.drag) drawOver(); }
  else if (FOG.cursor) { FOG.cursor = null; drawOver(); }
  if (FOG.drag) { e.stopPropagation(); paintAt(e); drawOver(); return; }
  if (MT.live) { e.stopPropagation(); const p = worldAt(e), l = MT.live.pts[MT.live.pts.length - 1];
    if (Math.hypot(p.x - l[0], p.y - l[1]) >= screenU(3)) { MT.live.pts.push([Math.round(p.x), Math.round(p.y)]); drawOver(); } return; }
  if (MT.measure && MT.measure.on) { e.stopPropagation(); MT.measure.b = worldAt(e); drawOver(); }
}, true);
document.addEventListener('pointerup', e => {
  if (FOG.drag) { e.stopPropagation(); FOG.drag = null; scheduleWorld(400); return; }
  if (MT.live) { e.stopPropagation(); const pts = MT.live.pts; MT.live = null; drawOver(); if (pts.length > 1) sendMark('draw', pts); return; }
  if (MT.measure && MT.measure.on) { e.stopPropagation(); MT.measure.on = false; }
}, true);
document.addEventListener('click', e => { if (toolOn(e)) e.stopPropagation(); }, true);
// [ and ] change the brush size while revealing / covering
document.addEventListener('keydown', e => {
  if ((e.key !== '[' && e.key !== ']') || !(MT.tool === 'reveal' || MT.tool === 'cover') || S.tab !== 'carte') return;
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
  const step = Math.max(1, Math.round(FOG.size * .15));
  FOG.size = fogSize(FOG.size + (e.key === ']' ? step : -step));
  document.querySelectorAll('[data-fog-size]').forEach(x => { x.value = FOG.size; });
  drawOver(); e.preventDefault();
});

/* ---------------------------------------------------------------- marks: server and realtime */
async function sendMark(kind, pts) {
  const m = MAPS[S.map]; if (!m || !WD.store.maps.has(S.map)) { toast('Enregistre d’abord la carte.'); return; }
  try {
    const r = await call('player-action', { action: 'mark', mapId: S.map, kind, points: pts, color: MT.color, width: MT.width });
    if (kind === 'ping') setTimeout(() => AW.db.deleteRow({ databaseId: TN.db, tableId: 'map_marks', rowId: r.id }).catch(() => {}), 8000);
  } catch (err) { toast(errMsg(err)); }
}
async function eraseMarks(list) {
  for (const r of list) {
    try { await AW.db.deleteRow({ databaseId: TN.db, tableId: 'map_marks', rowId: r.$id }); MT.marks.delete(r.$id); }
    catch (err) { toast('Effacement impossible : ' + errMsg(err)); break; }
  }
  placeFog();
}
function showPing(r) {
  let p = []; try { p = JSON.parse(r.points || '[]')[0]; } catch (_) {}
  if (!p) return;
  MT.pings.push({ mapId: r.mapId, x: p[0], y: p[1], color: r.color || '#e2672c', name: r.authorName || '', t: Date.now() });
  MT.pings = MT.pings.filter(x => Date.now() - x.t < 4000);
  if (S.tab === 'carte' && S.map === r.mapId) { drawOver(); setTimeout(drawOver, 4100); }
  else if (r.authorId !== ME.user?.$id) toast(`${r.authorName || '?'} : ping sur « ${(MAPS[r.mapId] || {}).name || 'une carte'} »`);
}
async function loadMarks() {
  MT.marks.clear();
  if (!ME.camp) return;
  const list = await rows('map_marks', [AW.Q.equal('campaignId', ME.camp.$id)]).catch(() => []);
  for (const r of list) {
    if (r.kind === 'draw') MT.marks.set(r.$id, r);
    else if (isGmHere() && Date.now() - Date.parse(r.$createdAt) > 60000) AW.db.deleteRow({ databaseId: TN.db, tableId: 'map_marks', rowId: r.$id }).catch(() => {});   // pings left behind
  }
  if (MT.unsub) MT.unsub();
  MT.unsub = AW.c.subscribe(`tablesdb.${TN.db}.tables.map_marks.rows`, ev => {
    const r = ev.payload; if (!r || !ME.camp || r.campaignId !== ME.camp.$id) return;
    if (ev.events.some(x => x.endsWith('.delete'))) { MT.marks.delete(r.$id); if (S.tab === 'carte') placeFog(); return; }
    if (!ev.events.some(x => x.endsWith('.create'))) return;
    if (r.kind === 'ping') showPing(r);
    else { MT.marks.set(r.$id, r); if (S.tab === 'carte' && S.map === r.mapId) placeFog(); }
  });
  if (S.tab === 'carte') placeFog();
}
const _enterFog = enterCampaign;
enterCampaign = async function (id) { MT.tool = 'move'; await _enterFog(id); if (ME.camp) loadMarks(); };
const _leaveFog = leaveCampaign;
leaveCampaign = function () { if (MT.unsub) { MT.unsub(); MT.unsub = null; } MT.marks.clear(); _leaveFog(); };

const fogCss = document.createElement('style');
fogCss.textContent = `
.fog{fill:#0d0c0a}
.fog.gm{fill:#0d0c0a;opacity:.55}
.brush{fill:none;vector-effect:non-scaling-stroke;stroke:#f0d9b5;stroke-dasharray:4 3;opacity:.9}
.brush.cover{stroke:#e2672c}
.fog-size input.field[data-fog-size]{width:64px}
.fog-tools{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap}
.fog-size{display:inline-flex;align-items:center;gap:6px;font:500 10px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.fog-size input[type=range]{width:100px;accent-color:var(--orange)}
.fog-size input.field{width:64px;padding:4px 6px}
.maptools{position:absolute;left:10px;top:10px;z-index:3;display:flex;flex-wrap:wrap;align-items:center;gap:5px;max-width:calc(100% - 70px);padding:6px;border-radius:8px;
  background:rgba(20,19,16,.86);box-shadow:0 2px 0 #0b0a09,0 10px 22px -10px rgba(0,0,0,.7)}
.maptools .sep{width:1px;height:20px;background:rgba(255,240,215,.12);margin:0 3px}
.mt-sw{display:inline-flex;gap:3px}
.mt-sw button{width:18px;height:18px;border-radius:50%;border:2px solid #1b1a17;background:var(--sw);cursor:pointer;padding:0}
.mt-sw button[aria-pressed=true]{outline:2px solid var(--cream);outline-offset:1px}
.mark{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;pointer-events:none}
#marksLayer.erasing .mark.erasable{pointer-events:stroke;cursor:not-allowed}
#marksLayer.erasing .mark.erasable:hover{opacity:.45}
.mapwrap.tool-draw svg,.mapwrap.tool-measure svg,.mapwrap.tool-ping svg,.mapwrap.tool-reveal svg,.mapwrap.tool-cover svg{cursor:crosshair}
.measure line{stroke:#f0d9b5;stroke-width:2;stroke-dasharray:6 4;vector-effect:non-scaling-stroke}
.measure circle{fill:#f0d9b5}
.measure text{fill:#f0d9b5;font-family:var(--f-mono);font-weight:600;text-anchor:middle;paint-order:stroke;stroke:#141310;stroke-width:3px}
.ping circle{fill:none;stroke:var(--pc);stroke-width:3;vector-effect:non-scaling-stroke;transform-box:fill-box;transform-origin:center;animation:ping 1.2s ease-out 3}
.ping circle.p2{animation-delay:.4s}
.ping circle.dot{fill:var(--pc);animation:none}
.ping text{fill:var(--pc);font-family:var(--f-mono);font-weight:600;text-anchor:middle;paint-order:stroke;stroke:#141310;stroke-width:3px}
@keyframes ping{from{transform:scale(.2);opacity:1}to{transform:scale(1.6);opacity:0}}
@media (prefers-reduced-motion:reduce){.ping circle{animation:none}}`;
document.head.appendChild(fogCss);
