/* search.js — search, filter and sort in the item / skill libraries and inventories, advanced search in the lore.
   Libraries: full text on name, type, description (and the GM note for the GM); filters by type, rarity, equipment
   spot, equipped state / statistic, minimum level; sorts by name, rarity, type, level, newest.
   Lore: words are matched without accents or case, all of them must appear; "an exact phrase" in quotes,
   -word to exclude, titles only on demand; results sorted by relevance with a snippet, matches highlighted in the article.
   The views are rendered by the mockup's own functions on a filtered copy of the lists (restored right after). */

P.search = P.search || '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4.2-4.2"/>';
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SRCH = (() => {
  const d = { inv: { q: '', type: '', rarity: '', slot: '', eq: '', sort: 'name' }, sk: { q: '', stat: '', lvl: 0, sort: 'name' }, lore: { q: '', titles: false, vis: '', sort: 'score' } };
  try { const s = JSON.parse(localStorage.getItem('tn.search') || 'null'); if (s) for (const k of Object.keys(d)) Object.assign(d[k], s[k] || {}); } catch (_) {}
  return d;
})();
const saveSearch = () => { try { localStorage.setItem('tn.search', JSON.stringify(SRCH)); } catch (_) {} };
const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legend: 4 };
const createdAt = (store, id) => (store.get(id) || {}).$createdAt || '';

// run a mockup renderer on filtered lists, then put the real lists back
function withLists(pairs, fn) {
  const saved = pairs.map(([arr]) => arr.slice());
  try { pairs.forEach(([arr, list]) => arr.splice(0, arr.length, ...list)); return fn(); }
  finally { pairs.forEach(([arr], i) => arr.splice(0, arr.length, ...saved[i])); }
}
const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
const countTag = (n, total) => `<span class="srch-count">${n === total ? `${total}` : `${n} / ${total}`}</span>`;
const insertBar = (html, bar) => { const i = html.search(/<div class="(cards|skills|empty-note)/); return i < 0 ? html + bar : html.slice(0, i) + bar + html.slice(i); };

/* ---------------------------------------------------------------- items */
function itemMatches(d, f) {
  if (f.type && d.type !== f.type) return false;
  if (f.rarity && d.rarity !== f.rarity) return false;
  if (f.slot && (f.slot === '-' ? d.slot : d.slot !== f.slot)) return false;
  const q = fold(f.q).trim(); if (!q) return true;
  const hay = fold([d.name, d.type, d.desc, d.value, isMJ() ? d.mj : ''].join(' '));
  return q.split(/\s+/).every(w => hay.includes(w));
}
const itemSort = f => (a, b) => f.sort === 'rarity' ? (RANK[b.rarity] ?? 0) - (RANK[a.rarity] ?? 0) || a.name.localeCompare(b.name, 'fr')
  : f.sort === 'type' ? a.type.localeCompare(b.type, 'fr') || a.name.localeCompare(b.name, 'fr')
  : f.sort === 'new' ? createdAt(IV.defs, b.id).localeCompare(createdAt(IV.defs, a.id))
  : f.sort === 'za' ? b.name.localeCompare(a.name, 'fr') : a.name.localeCompare(b.name, 'fr');
const _renderInventorySearch = renderInventory;
renderInventory = function () {
  const f = SRCH.inv, lib = isMJ() && S.invMode === 'lib', byId = new Map(ITEMS.map(d => [d.id, d]));
  const defs = ITEMS.filter(d => itemMatches(d, f)).sort(itemSort(f));
  const order = new Map(defs.map((d, i) => [d.id, i]));
  const owned = INV.filter(o => byId.has(o.def) && order.has(o.def) && (!f.eq || (f.eq === 'on' ? !!o.slot : !o.slot)))
    .sort((a, b) => order.get(a.def) - order.get(b.def));
  const html = lib ? withLists([[ITEMS, defs]], _renderInventorySearch) : withLists([[INV, owned]], _renderInventorySearch);
  const types = [...new Set(ITEMS.map(d => d.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const slots = [...new Set(ITEMS.map(d => d.slot).filter(Boolean))];
  const total = lib ? ITEMS.length : INV.length, shown = lib ? defs.length : owned.length;
  return insertBar(html, `<div class="srch well">
    <label class="srch-q">${ic('search', 14)}<input class="field" id="srchInv" type="search" placeholder="Rechercher un objet…" value="${esc(f.q)}" data-srch="inv:q" autocomplete="off"></label>
    <select class="field" data-srch="inv:type" aria-label="Type">${opt('', 'Tous les types', f.type)}${types.map(t => opt(t, t, f.type)).join('')}</select>
    <select class="field" data-srch="inv:rarity" aria-label="Rareté">${opt('', 'Toutes raretés', f.rarity)}${Object.entries(RARITY).map(([k, l]) => opt(k, l, f.rarity)).join('')}</select>
    <select class="field" data-srch="inv:slot" aria-label="Équipement">${opt('', 'Équipable ou non', f.slot)}${opt('-', 'Ne s’équipe pas', f.slot)}${slots.map(s => opt(s, typeLabel(s), f.slot)).join('')}</select>
    ${lib ? '' : `<select class="field" data-srch="inv:eq" aria-label="Équipé">${opt('', 'Équipés ou non', f.eq)}${opt('on', 'Équipés', f.eq)}${opt('off', 'Non équipés', f.eq)}</select>`}
    <select class="field" data-srch="inv:sort" aria-label="Tri">${opt('name', 'Nom A → Z', f.sort)}${opt('za', 'Nom Z → A', f.sort)}${opt('rarity', 'Rareté', f.sort)}${opt('type', 'Type', f.sort)}${opt('new', 'Plus récents', f.sort)}</select>
    ${countTag(shown, total)}${f.q || f.type || f.rarity || f.slot || f.eq ? `<button class="btn xs" data-act="srchReset" data-k="inv">Effacer</button>` : ''}</div>`);
};

/* ---------------------------------------------------------------- skills */
function skillMatches(d, f) {
  if (f.stat && d.stat !== f.stat) return false;
  if (+f.lvl && (d.level || 1) < +f.lvl) return false;
  const q = fold(f.q).trim(); if (!q) return true;
  const hay = fold([d.name, d.stat, d.desc, isMJ() ? d.mj : ''].join(' '));
  return q.split(/\s+/).every(w => hay.includes(w));
}
const skillSort = f => (a, b) => f.sort === 'level' ? (b.level || 1) - (a.level || 1) || a.name.localeCompare(b.name, 'fr')
  : f.sort === 'stat' ? String(a.stat).localeCompare(String(b.stat)) || a.name.localeCompare(b.name, 'fr')
  : f.sort === 'new' ? createdAt(IV.sdefs, b.id).localeCompare(createdAt(IV.sdefs, a.id))
  : f.sort === 'za' ? b.name.localeCompare(a.name, 'fr') : a.name.localeCompare(b.name, 'fr');
const _renderSkillsSearch = renderSkills;
renderSkills = function () {
  const f = SRCH.sk, lib = isMJ() && S.skMode === 'lib';
  const defs = SKILLS.filter(d => skillMatches(d, f)).sort(skillSort(f)), order = new Map(defs.map((d, i) => [d.id, i]));
  const owned = SKOWN.filter(o => order.has(o.def)).sort((a, b) => order.get(a.def) - order.get(b.def));
  const html = lib ? withLists([[SKILLS, defs]], _renderSkillsSearch) : withLists([[SKOWN, owned]], _renderSkillsSearch);
  const stats = [...new Set(SKILLS.map(d => d.stat).filter(Boolean))];
  return insertBar(html, `<div class="srch well">
    <label class="srch-q">${ic('search', 14)}<input class="field" id="srchSk" type="search" placeholder="Rechercher une compétence…" value="${esc(f.q)}" data-srch="sk:q" autocomplete="off"></label>
    <select class="field" data-srch="sk:stat" aria-label="Statistique">${opt('', 'Toutes statistiques', f.stat)}${stats.map(s => opt(s, s, f.stat)).join('')}</select>
    <select class="field" data-srch="sk:lvl" aria-label="Niveau minimum">${opt(0, 'Tous niveaux', f.lvl)}${[2, 3, 4, 5].map(n => opt(n, `Niveau ${n}+`, f.lvl)).join('')}</select>
    <select class="field" data-srch="sk:sort" aria-label="Tri">${opt('name', 'Nom A → Z', f.sort)}${opt('za', 'Nom Z → A', f.sort)}${opt('level', 'Niveau', f.sort)}${opt('stat', 'Statistique', f.sort)}${opt('new', 'Plus récentes', f.sort)}</select>
    ${countTag(lib ? defs.length : owned.length, lib ? SKILLS.length : SKOWN.length)}${f.q || f.stat || +f.lvl ? `<button class="btn xs" data-act="srchReset" data-k="sk">Effacer</button>` : ''}</div>`);
};

/* ---------------------------------------------------------------- lore: advanced search */
function parseQuery(q) {
  const phrases = [], excl = [], words = [];
  String(q || '').replace(/(-?)"([^"]+)"|(-?)(\S+)/g, (m, n1, ph, n2, w) => {
    if (ph !== undefined) (n1 ? excl : phrases).push(fold(ph).trim());
    else if (w) (n2 && w.length > 1 ? excl : words).push(fold(n2 && w.length > 1 ? w : (n2 + w)));
    return '';
  });
  return { phrases: phrases.filter(Boolean), excl: excl.filter(Boolean), words: words.filter(Boolean) };
}
// article text without its title heading, images, link targets and Markdown marks (hyphens inside words are kept)
const plainMd = md => String(md || '').replace(/^\s*#\s+.*$/m, '').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/^[\s|:-]*-{2,}[\s|:-]*$/gm, ' ')
  .replace(/^\s*([-*+]|\d+\.)\s+/gm, ' ').replace(/[#>*_`~|]+/g, ' ').replace(/\s+/g, ' ').trim();
function loreHits(a, qq, titlesOnly) {
  const title = fold(a.title), body = titlesOnly ? '' : fold(plainMd(a.md)), all = title + ' ' + body;
  const terms = [...qq.phrases, ...qq.words];
  if (!terms.every(t => all.includes(t)) || qq.excl.some(t => all.includes(t))) return null;
  let score = 0;
  for (const t of terms) { score += (title.includes(t) ? 10 : 0) + Math.min(10, body.split(t).length - 1); if (qq.phrases.includes(t)) score += 3; }
  return { score, first: terms.map(t => body.indexOf(t)).filter(i => i >= 0).sort((x, y) => x - y)[0] ?? -1 };
}
const _renderLoreSearch = renderLore;
renderLore = function () {
  const f = SRCH.lore, qq = parseQuery(f.q), active = qq.phrases.length + qq.words.length + qq.excl.length > 0;
  let list = LORE.filter(a => !f.vis || (f.vis === 'secret' ? a.vis !== 'all' : a.vis === 'all'));
  const hits = new Map();
  if (active) list = list.filter(a => { const h = loreHits(a, qq, f.titles); if (h) hits.set(a.id, h); return !!h; });
  const upd = id => (WD.store.lore_articles.get(id) || {}).$updatedAt || '';
  list.sort(f.sort === 'title' ? (a, b) => a.title.localeCompare(b.title, 'fr') : f.sort === 'new' ? (a, b) => upd(b.id).localeCompare(upd(a.id))
    : active ? (a, b) => hits.get(b.id).score - hits.get(a.id).score : () => 0);
  if (active && list.length && !list.find(a => a.id === S.loreSel)) S.loreSel = list[0].id;
  let html = list.length || !active ? withLists([[LORE, list]], _renderLoreSearch) : _renderLoreSearch().replace(/<nav class="lore-nav well"[^>]*>[\s\S]*?<\/nav>/, '<nav class="lore-nav well"><p class="hint" style="margin:6px">Aucun article ne correspond.</p></nav>');
  // snippets under each title
  if (active && !f.titles) for (const a of list) {
    const h = hits.get(a.id); if (!h || h.first < 0) continue;
    const plain = plainMd(a.md), folded = fold(plain);   // same length as plain for Latin text
    const start = Math.max(0, h.first - 40), snip = plain.slice(start, start + 120);
    const re = new RegExp([...qq.phrases, ...qq.words].map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
    let marked = '', last = 0; const fsnip = folded.slice(start, start + 120);
    fsnip.replace(re, (m, i) => { marked += esc(snip.slice(last, i)) + `<mark>${esc(snip.slice(i, i + m.length))}</mark>`; last = i + m.length; return m; });
    marked += esc(snip.slice(last));
    html = html.replace(new RegExp(`(data-id="${a.id}"[^>]*>[\\s\\S]*?<span>[^<]*</span>)`), `$1<small class="lore-snip">${start ? '…' : ''}${marked}…</small>`);
  }
  const bar = `<div class="srch well lore-srch">
    <label class="srch-q">${ic('search', 14)}<input class="field" id="srchLore" type="search" placeholder='Rechercher : mots, "phrase exacte", -exclure' value="${esc(f.q)}" data-srch="lore:q" autocomplete="off"></label>
    <label class="srch-chk"><input type="checkbox" data-srch="lore:titles" ${f.titles ? 'checked' : ''}>Titres seulement</label>
    ${isMJ() ? `<select class="field" data-srch="lore:vis" aria-label="Visibilité">${opt('', 'Tous les articles', f.vis)}${opt('pub', 'Visibles des joueurs', f.vis)}${opt('secret', 'Secrets (MJ)', f.vis)}</select>` : ''}
    <select class="field" data-srch="lore:sort" aria-label="Tri">${opt('score', 'Pertinence', f.sort)}${opt('title', 'Titre', f.sort)}${opt('new', 'Modifiés récemment', f.sort)}</select>
    ${countTag(list.length, LORE.length)}${f.q || f.vis || f.titles ? `<button class="btn xs" data-act="srchReset" data-k="lore">Effacer</button>` : ''}</div>`;
  return html.replace('<div class="lore">', bar + '<div class="lore">');
};
// highlight the matches in the open article (text nodes only)
function highlightLore() {
  const f = SRCH.lore; if (S.tab !== 'lore' || S.loreEdit || f.titles) return;
  const qq = parseQuery(f.q), terms = [...qq.phrases, ...qq.words]; if (!terms.length) return;
  const root = document.querySelector('#main .article .md'); if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const text = n.nodeValue, folded = fold(text); if (folded.length !== text.length) continue;
    const ranges = [];
    for (const t of terms) for (let i = folded.indexOf(t); i >= 0; i = folded.indexOf(t, i + t.length)) ranges.push([i, i + t.length]);
    if (!ranges.length) continue;
    ranges.sort((a, b) => a[0] - b[0]);
    const frag = document.createDocumentFragment(); let pos = 0;
    for (const [s, e] of ranges) { if (s < pos) continue; frag.append(text.slice(pos, s)); const m = document.createElement('mark'); m.textContent = text.slice(s, e); frag.append(m); pos = e; }
    frag.append(text.slice(pos)); n.replaceWith(frag);
  }
  root.querySelector('mark')?.scrollIntoView({ block: 'nearest' });
}

/* ---------------------------------------------------------------- inputs (focus kept while typing) */
let srchTimer = null;
function srchApply(el) {
  const [k, f] = el.dataset.srch.split(':');
  SRCH[k][f] = el.type === 'checkbox' ? el.checked : el.value;
  saveSearch();
  const id = el.id, pos = el.selectionStart;
  render();
  if (id) { const n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } }
}
document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.srch && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { clearTimeout(srchTimer); const el = e.target; srchTimer = setTimeout(() => srchApply(el), 180); } });
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.srch && (e.target.tagName === 'SELECT' || e.target.type === 'checkbox')) srchApply(e.target); });
ACT.srchReset = d => { const k = d.k; SRCH[k] = k === 'inv' ? { q: '', type: '', rarity: '', slot: '', eq: '', sort: SRCH.inv.sort } : k === 'sk' ? { q: '', stat: '', lvl: 0, sort: SRCH.sk.sort } : { q: '', titles: false, vis: '', sort: SRCH.lore.sort }; saveSearch(); };
const _renderSrch = render;
render = function () { _renderSrch(); highlightLore(); };

const srchCss = document.createElement('style');
srchCss.textContent = `
.srch{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 10px;margin-bottom:14px}
.srch .field{width:auto;min-width:0;padding:7px 9px;font-size:12.5px}
.srch-q{display:flex;align-items:center;gap:6px;flex:1 1 220px;color:var(--mute)}
.srch-q .field{flex:1;width:100%}
.srch-chk{display:flex;align-items:center;gap:6px;font:500 11px var(--f-mono);color:var(--mute);cursor:pointer}
.srch-chk input{accent-color:var(--orange)}
.srch-count{font:600 11px var(--f-mono);color:var(--mute);margin-left:auto;white-space:nowrap}
.lore-snip{display:block;flex-basis:100%;order:9;padding-left:22px;font-size:11px;line-height:1.35;color:var(--dim);margin-top:2px;white-space:normal}
.lore-nav button{flex-wrap:wrap}
.lore-nav button > span{flex:1;min-width:0}
mark{background:rgba(226,103,44,.35);color:inherit;border-radius:2px;padding:0 1px}
.article mark{background:rgba(226,103,44,.4)}`;
document.head.appendChild(srchCss);
