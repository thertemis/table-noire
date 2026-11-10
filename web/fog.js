/* fog.js — fog of war on maps.
   maps.fog (JSON) = { on: true, holes: [[x, y, r], …] } in the map image's pixel space, saved with the map (world.js).
   Players see the map covered except the revealed circles (points and texts under the fog are hidden too);
   the GM sees the fog translucent and reveals with a brush (click or drag) in map edit mode.
   Note: the map image file itself stays readable by the campaign; the fog only hides it in the app. */

const FOG = { brush: false, size: 120, drag: null };
const fogOf = m => (m && m.fog && m.fog.on ? m.fog : null);

function fogSvg(m) {
  const f = fogOf(m); if (!f) return '';
  const gm = isMJ();
  return `<g id="fogLayer" pointer-events="none"><defs><mask id="fogMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${m.w}" height="${m.h}">
    <rect width="${m.w}" height="${m.h}" fill="#fff"/>${(f.holes || []).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#000"/>`).join('')}</mask></defs>
    <rect class="fog ${gm ? 'gm' : ''}" width="${m.w}" height="${m.h}" mask="url(#fogMask)"/></g>`;
}
// the fog layer always ends the world group, above the points and texts
function placeFog() {
  const w = $('#world'); if (!w) return;
  w.querySelector('#fogLayer')?.remove();
  const m = MAPS[S.map]; if (!fogOf(m)) return;
  w.insertAdjacentHTML('beforeend', fogSvg(m));
  if (!isMJ()) {   // players: no point or text inside the fog
    const holes = m.fog.holes || [];
    w.querySelectorAll('.poi,.mtext').forEach(el => {
      const it = refObj('poi', el.dataset.poi || el.dataset.mtext); if (!it) return;
      el.style.display = holes.some(([x, y, r]) => Math.hypot(it.x - x, it.y - y) <= r) ? '' : 'none';
    });
  }
}
const _refreshMapItemsFog = refreshMapItems;
refreshMapItems = function () { _refreshMapItemsFog(); placeFog(); };
const _renderFog = render;
render = function () { _renderFog(); if (S.tab === 'carte') placeFog(); };

/* GM tools in the map edit bar */
const _renderMapFog = renderMap;
renderMap = function () {
  let html = _renderMapFog();
  if (S.tab !== 'carte' || !isMJ() || !S.mapEdit || !MAPS[S.map]) return html;
  const f = MAPS[S.map].fog;
  const tools = `<span class="fog-tools"><button class="btn ${f && f.on ? 'on' : ''}" data-act="fogToggle">${ic('eyeOff')}Brouillard</button>
    ${f && f.on ? `<button class="btn ${FOG.brush ? 'on' : ''}" data-act="fogBrush">${ic('eye')}Révéler au pinceau</button>
      <label class="fog-size">Taille<input type="range" min="30" max="400" step="10" value="${FOG.size}" data-fog-size></label>
      <button class="btn" data-act="fogReset">Tout recouvrir</button><button class="btn" data-act="fogClear">Tout dévoiler</button>` : ''}</span>`;
  return html.replace('<span class="hint">En édition, glisse un point', `${tools}<span class="hint">En édition, glisse un point`);
};
ACT.fogToggle = () => { const m = MAPS[S.map]; m.fog = m.fog && m.fog.on ? { ...m.fog, on: false } : { on: true, holes: (m.fog && m.fog.holes) || [] }; FOG.brush = false; };
ACT.fogBrush = () => { FOG.brush = !FOG.brush; S.addMode = null; };
ACT.fogReset = () => { if (confirm('Recouvrir toute la carte ?')) MAPS[S.map].fog.holes = []; };
ACT.fogClear = () => { MAPS[S.map].fog = { on: false, holes: [] }; FOG.brush = false; };
ACT.mapEdit = (orig => () => { FOG.brush = false; return orig(); })(ACT.mapEdit);
document.addEventListener('input', e => { if (e.target.matches && e.target.matches('[data-fog-size]')) FOG.size = +e.target.value; });

// brush: capture the pointer before the map's own pan / drag handlers
const brushOn = e => S.tab === 'carte' && FOG.brush && isMJ() && S.mapEdit && e.target.closest && e.target.closest('#mapsvg');
function paintAt(e) {
  const svg = $('#mapsvg'), m = MAPS[S.map]; if (!svg || !fogOf(m)) return;
  const p = toWorld(svgPoint(svg, e.clientX, e.clientY)), r = Math.round(FOG.size);
  const last = FOG.drag && FOG.drag.last;
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < r / 3) return;
  m.fog.holes.push([Math.round(p.x), Math.round(p.y), r]);
  if (FOG.drag) FOG.drag.last = p;
  placeFog();
}
document.addEventListener('pointerdown', e => { if (!brushOn(e)) return; e.stopPropagation(); e.preventDefault(); FOG.drag = { last: null }; paintAt(e); }, true);
document.addEventListener('pointermove', e => { if (!FOG.drag) return; e.stopPropagation(); paintAt(e); }, true);
document.addEventListener('pointerup', e => { if (!FOG.drag) return; e.stopPropagation(); FOG.drag = null; scheduleWorld(400); }, true);
document.addEventListener('click', e => { if (brushOn(e)) e.stopPropagation(); }, true);

const fogCss = document.createElement('style');
fogCss.textContent = `
.fog{fill:#0d0c0a}
.fog.gm{fill:#0d0c0a;opacity:.55}
#mapsvg:has(#fogLayer){}
.fog-tools{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap}
.fog-size{display:inline-flex;align-items:center;gap:6px;font:500 10px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.fog-size input{width:110px;accent-color:var(--orange)}`;
document.head.appendChild(fogCss);
