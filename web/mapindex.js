/* mapindex.js — the maps overview, like the lore's: every map of the campaign as a list or a grid (thumbnail, place in
   the map tree, points of interest (for players, only those outside the fog), sub-maps, fog / secret badges), with a search on names and points, a filter by
   parent map, a visibility filter (GM) and a sort. The map tab opens on it; "‹ Cartes" goes back from a map.
   A map is shown when S.mapIndex is false: anything that opens a map (point link, breadcrumb, import, reveal) sets it.
   Thumbnails use Appwrite's image preview (smaller download), fetched with the app's session (works without a
   same-site cookie) and kept as object URLs; they fall back to the image itself. Under fog the players' thumbnail is
   the masked copy, like the map (world.js). */

Object.assign(SRCH, { maps: Object.assign({ q: '', parent: '', vis: '', sort: 'tree', view: 'grid' }, SRCH.maps || {}) });
S.mapIndex = true;

const mapPath = id => { const p = []; let cur = MAPS[id] && MAPS[id].parent; while (cur && MAPS[cur] && p.length < 20) { p.unshift(MAPS[cur].name); cur = MAPS[cur].parent; } return p; };
const mapKids = id => Object.keys(MAPS).filter(k => MAPS[k].parent === id && canSee(MAPS[k].vis || 'all'));
const mapThumb = m => { const u = String(m.img || ''); return u.includes('/view?') ? u.replace('/view?', '/preview?width=640&quality=70&') : u; };
// what a player may know of a map: its visible points and labels, outside the fog
const openHere = (m, it) => isMJ() || !fogOf(m) || fogOpenAt(m.fog.holes, it.x, it.y);
const seenPois = m => m.pois.filter(p => canSee(p.vis) && openHere(m, p));
const seenTexts = m => m.texts.filter(t => canSee(t.vis) && openHere(m, t));
const mapUpd = id => (WD.store.maps.get(id) || {}).$updatedAt || '';

function mapList() {
  const f = SRCH.maps, qq = parseQuery(f.q), active = qq.phrases.length + qq.words.length + qq.excl.length > 0;
  let ids = Object.keys(MAPS).filter(k => canSee(MAPS[k].vis || 'all'));
  const total = ids.length;
  if (isMJ() && f.vis === 'pub') ids = ids.filter(k => (MAPS[k].vis || 'all') === 'all');
  if (isMJ() && f.vis === 'secret') ids = ids.filter(k => (MAPS[k].vis || 'all') !== 'all');
  if (isMJ() && f.vis === 'fog') ids = ids.filter(k => fogOf(MAPS[k]));
  if (f.parent === '-') ids = ids.filter(k => !MAPS[k].parent);
  else if (f.parent && MAPS[f.parent]) { const under = new Set(); const walk = p => mapKids(p).forEach(k => { if (!under.has(k)) { under.add(k); walk(k); } }); walk(f.parent); ids = ids.filter(k => under.has(k)); }
  // search: the map name, then its visible points and labels (the points that matched are listed on the card)
  const found = new Map();
  if (active) ids = ids.filter(k => {
    const m = MAPS[k], norm = s => fold(String(s || ''));
    const pts = seenPois(m).map(p => [p.label, p.desc]).concat(seenTexts(m).map(t => [t.text, '']));
    const hay = norm([m.name, ...pts.flat()].join(' \n '));
    if (qq.excl.some(w => hay.includes(w))) return false;
    if (![...qq.phrases, ...qq.words].every(w => hay.includes(w))) return false;
    const inName = [...qq.phrases, ...qq.words].filter(w => norm(m.name).includes(w)).length;
    const hits = pts.filter(([a, b]) => [...qq.phrases, ...qq.words].some(w => norm(a + ' ' + b).includes(w))).map(([a]) => a).filter(Boolean);
    found.set(k, { score: inName * 10 + hits.length, hits });
    return true;
  });
  const byName = (a, b) => String(MAPS[a].name).localeCompare(String(MAPS[b].name), LOCALE);
  if (active && f.sort === 'tree') ids.sort((a, b) => found.get(b).score - found.get(a).score || byName(a, b));
  else if (f.sort === 'name') ids.sort(byName);
  else if (f.sort === 'new') ids.sort((a, b) => mapUpd(b).localeCompare(mapUpd(a)));
  else {   // the map tree: each map followed by its sub-maps
    const keep = new Set(ids), out = [];
    const walk = (p, depth) => Object.keys(MAPS).filter(k => (MAPS[k].parent || null) === p).sort(byName).forEach(k => { if (keep.has(k)) out.push(k); walk(k, depth + 1); });
    walk(null, 0);
    ids.forEach(k => { if (!out.includes(k)) out.push(k); });   // orphans (parent hidden)
    ids = out;
  }
  return { ids, total, found, active };
}

function mapsOverview() {
  const f = SRCH.maps, { ids, total, found } = mapList();
  const parents = Object.keys(MAPS).filter(k => canSee(MAPS[k].vis || 'all') && mapKids(k).length).sort((a, b) => String(MAPS[a].name).localeCompare(String(MAPS[b].name), LOCALE));
  const bar = `<div class="srch well lore-srch">
    <label class="srch-q">${ic('search', 14)}<input class="field" id="srchMaps" type="search" placeholder='Rechercher une carte ou un lieu' value="${esc(f.q)}" data-srch="maps:q" autocomplete="off"></label>
    <select class="field" data-srch="maps:parent" aria-label="Carte parente">${opt('', 'Toutes les cartes', f.parent)}${opt('-', 'Cartes principales', f.parent)}${parents.map(k => opt(k, tr('Dans « {0} »').replace('{0}', MAPS[k].name), f.parent)).join('')}</select>
    ${isMJ() ? `<select class="field" data-srch="maps:vis" aria-label="Visibilité">${opt('', 'Toutes', f.vis)}${opt('pub', 'Visibles des joueurs', f.vis)}${opt('secret', 'Secrètes (MJ)', f.vis)}${opt('fog', 'Avec brouillard', f.vis)}</select>` : ''}
    <select class="field" data-srch="maps:sort" aria-label="Tri">${opt('tree', 'Arborescence', f.sort)}${opt('name', 'Nom', f.sort)}${opt('new', 'Modifiées récemment', f.sort)}</select>
    <span class="seg lore-view" role="group" aria-label="Affichage"><button data-act="mapsView" data-v="list" aria-pressed="${f.view === 'list'}">${ic('text', 13)}Liste</button><button data-act="mapsView" data-v="grid" aria-pressed="${f.view !== 'list'}">${ic('layout', 13)}Grille</button></span>
    ${countTag(ids.length, total)}${f.q || f.vis || f.parent ? `<button class="btn xs" data-act="srchReset" data-k="maps">Effacer</button>` : ''}</div>`;
  const badges = m => `${(m.vis || 'all') !== 'all' ? `<span class="secret" title="Secrète (MJ)">${ic('lock', 12)}</span>` : ''}${isMJ() && fogOf(m) ? `<span class="mi-fog" title="Brouillard de guerre">${ic('eyeOff', 12)}</span>` : ''}`;
  const meta = k => { const m = MAPS[k], np = seenPois(m).length, nk = mapKids(k).length;
    return `<span class="mi-meta">${np ? `<span>${ic('pin', 11)}${np}</span>` : ''}${nk ? `<span title="Cartes locales">${ic('layout', 11)}${nk}</span>` : ''}${badges(m)}</span>`; };
  const path = k => { const p = mapPath(k); return p.length ? `<span class="mi-path">${p.map(esc).join(' › ')}</span>` : ''; };
  const hits = k => { const h = (found.get(k) || {}).hits || []; return h.length ? `<span class="mi-hits">${ic('pin', 11)}${h.slice(0, 4).map(esc).join(' · ')}${h.length > 4 ? ' …' : ''}</span>` : ''; };
  const depth = k => mapPath(k).length;
  const thumb = m => m.img ? `<img class="mi-thumb" ${MI.urls.has(mapThumb(m)) ? `src="${MI.urls.get(mapThumb(m))}"` : ''} data-thumb="${esc(mapThumb(m))}" data-full="${esc(m.img)}" alt="" decoding="async">` : `<span class="mi-thumb mi-none">${ic('pin', 22)}</span>`;
  const items = !ids.length ? `<div class="empty-note well">${total ? 'Aucune carte ne correspond.' : isMJ() ? 'Aucune carte : importe une image pour commencer.' : 'Le MJ n’a pas encore partagé de carte.'}</div>`
    : f.view !== 'list'
      ? `<div class="mi-grid">${ids.map(k => `<button class="mi-card" data-act="goMap" data-m="${k}">${thumb(MAPS[k])}
          <span class="mi-body"><b>${esc(MAPS[k].name)}</b>${path(k)}${meta(k)}${hits(k)}</span></button>`).join('')}</div>`
      : `<div class="lore-list">${ids.map(k => `<button class="mi-row" data-act="goMap" data-m="${k}" style="--dp:${f.sort === 'tree' && !SRCH.maps.q ? depth(k) : 0}">${thumb(MAPS[k])}
          <span class="mi-body"><span class="lr-head"><b>${esc(MAPS[k].name)}</b>${path(k)}<span class="grow"></span>${meta(k)}</span>${hits(k)}</span></button>`).join('')}</div>`;
  return `<div class="toolbar"><div><h2>Cartes</h2><div class="sub">Toutes les cartes de la campagne et leurs cartes locales.</div></div><span class="grow"></span>
    ${isMJ() ? `${typeof libBtns === 'function' ? libBtns('maps') : ''}<button class="btn" data-act="importMap">${ic('upload')}Importer une image</button>` : ''}</div>${bar}${items}`;
}

/* thumbnails: one download per image, then reused (object URLs) */
const MI = { urls: new Map(), busy: new Set() };
async function loadThumbs() {
  for (const el of document.querySelectorAll('img.mi-thumb[data-thumb]:not([src])')) {
    const u = el.dataset.thumb;
    if (MI.urls.has(u)) { el.src = MI.urls.get(u); continue; }
    if (MI.busy.has(u)) continue;
    MI.busy.add(u);
    (async () => {
      let blob = null;
      if (u.startsWith('data:')) blob = null;
      else try { blob = await fetchFile(u); } catch (_) { try { blob = await fetchFile(el.dataset.full); } catch (_) {} }
      const url = blob ? URL.createObjectURL(blob) : el.dataset.full;
      MI.urls.set(u, url); MI.busy.delete(u);
      document.querySelectorAll('img.mi-thumb[data-thumb]').forEach(i => { if (i.dataset.thumb === u && !i.getAttribute('src')) i.src = url; });
    })();
  }
}
// any redraw (render, softRender, realtime) that adds thumbnails
new MutationObserver(() => { if (document.querySelector('img.mi-thumb[data-thumb]:not([src])')) loadThumbs(); }).observe(document.getElementById('main') || document.body, { childList: true, subtree: true });

const _renderMapIdx = renderMap;
renderMap = function () {
  if (S.tab !== 'carte' || !ME.camp) return _renderMapIdx();
  if (!MAPS[S.map]) S.map = rootMap();
  if (S.mapIndex || !S.map) return mapsOverview();
  return _renderMapIdx().replace('<div class="toolbar"><div><h2>Carte · ', '<div class="toolbar"><button class="btn" data-act="mapsIndex">‹ Cartes</button><div><h2>Carte · ');
};

Object.assign(ACT, {
  mapsIndex: () => { S.mapIndex = true; S.mapEdit = false; S.addMode = null; S.openItem = null; if (typeof MT === 'object') MT.tool = 'move'; scrollTo(0, 0); },
  mapsView: d => { SRCH.maps.view = d.v; saveSearch(); },
});
// whatever opens a map leaves the overview
ACT.goMap = (orig => d => { S.mapIndex = false; return orig(d); })(ACT.goMap);
ACT.followLink = (orig => d => { S.mapIndex = false; return orig(d); })(ACT.followLink);
ACT.importMap = (orig => d => { S.mapIndex = false; return orig(d); })(ACT.importMap);
ACT.srchReset = (orig => d => { if (d.k !== 'maps') return orig(d); SRCH.maps = { q: '', parent: '', vis: '', sort: SRCH.maps.sort, view: SRCH.maps.view }; saveSearch(); })(ACT.srchReset);
const _enterMapIdx = enterCampaign;
enterCampaign = async function (id) { S.mapIndex = true; SRCH.maps.parent = ''; return _enterMapIdx(id); };
// a thumbnail the server cannot preview: the image itself
document.addEventListener('error', e => { const t = e.target; if (t && t.classList && t.classList.contains('mi-thumb') && t.dataset.full && t.src !== t.dataset.full) t.src = t.dataset.full; }, true);

const mapIdxCss = document.createElement('style');
mapIdxCss.textContent = `
.mi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.mi-card{display:flex;flex-direction:column;text-align:left;padding:0;border:0;border-radius:10px;cursor:pointer;color:var(--ink);overflow:hidden;
  background:#24221e;box-shadow:inset 0 1px 0 rgba(255,240,215,.05),0 2px 0 #0b0a09}
.mi-card:hover{background:#2c2a25}
.mi-card .mi-thumb{width:100%;aspect-ratio:16/10;object-fit:cover;background:#0d0c0a;display:block}
.mi-none{display:grid!important;place-items:center;color:var(--dim)}
.mi-body{display:flex;flex-direction:column;gap:6px;padding:10px 12px 12px;min-width:0}
.mi-body b{font:600 15px var(--f-body)}
.mi-path{font:500 11px var(--f-mono);color:var(--mute);letter-spacing:.03em}
.mi-meta{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap;font:500 11px var(--f-mono);color:var(--mute)}
.mi-meta>span{display:inline-flex;align-items:center;gap:3px}
.mi-meta .secret{color:var(--rust)}
.mi-fog{color:var(--orange-hi)}
.mi-hits{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--cream)}
.mi-row{display:flex;align-items:center;gap:12px;text-align:left;padding:8px 12px 8px 8px;margin-left:calc(var(--dp,0) * 22px);border:0;border-radius:8px;cursor:pointer;color:var(--ink);
  background:#24221e;box-shadow:inset 0 1px 0 rgba(255,240,215,.05),0 2px 0 #0b0a09}
.mi-row:hover{background:#2c2a25}
.mi-row .mi-thumb{width:84px;height:56px;flex:none;border-radius:6px;object-fit:cover;background:#0d0c0a}
.mi-row .mi-body{padding:0;flex:1}
@media (max-width:520px){.mi-row{margin-left:calc(var(--dp,0) * 10px)}}
`;
document.head.appendChild(mapIdxCss);
