/* lore.js — the lore page.
   - Overview: the articles as a list or a grid, with the advanced search of search.js (words, "exact phrase", -exclude),
     a category filter, visibility filter (GM) and sort. No side menu: an article opens from the overview, "Retour" goes back.
   - Article: title field (no longer taken from the first heading), category, Markdown with images and tables, and
     comments under it.
   - Categories (name + colour) are campaign settings kept in campaigns.loreCategories, managed by the GM.
   - Comments: table lore_comments, created by player-action "comment" (same readers as the article; the author and the
     GMs can delete them), shared live. */

const LR = { comments: new Map(), unsub: null };
Object.assign(SRCH.lore, { cat: '', view: (() => { try { return localStorage.getItem('tn-lore-view') || 'list'; } catch (_) { return 'list'; } })() });
const loreCats = () => { try { const l = JSON.parse(ME.camp?.loreCategories || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } };
const catColor = n => (loreCats().find(c => c.name === n) || {}).color || '#655f55';
const catChip = n => n ? `<span class="lore-cat" style="--cc:${esc(catColor(n))}">${esc(n)}</span>` : '';
const snippetOf = (a, n = 170) => { const t = plainMd(a.md); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; };
const commentsOf = id => LR.comments.get(id) || [];
// an article written before the title field starts with "# its title": not shown twice
const bodyWithoutTitle = a => String(a.md || '').replace(/^\s*#\s+(.+)\s*\n?/, (m, h) => h.trim() === String(a.title || '').trim() ? '' : m);

function loreList() {
  const f = SRCH.lore, qq = parseQuery(f.q), active = qq.phrases.length + qq.words.length + qq.excl.length > 0;
  let list = LORE.filter(a => canSee(a.vis));
  if (isMJ() && f.vis === 'pub') list = list.filter(a => a.vis === 'all');
  if (isMJ() && f.vis === 'secret') list = list.filter(a => a.vis !== 'all');
  if (f.cat === '-') list = list.filter(a => !a.cat); else if (f.cat) list = list.filter(a => a.cat === f.cat);
  const hits = new Map();
  if (active) list = list.filter(a => { const h = loreHits(a, qq, f.titles); if (h) hits.set(a.id, h); return !!h; });
  const upd = id => (WD.store.lore_articles.get(id) || {}).$updatedAt || '';
  const byTitle = (a, b) => String(a.title).localeCompare(String(b.title), LOCALE);
  list.sort(f.sort === 'title' ? byTitle : f.sort === 'new' ? (a, b) => upd(b.id).localeCompare(upd(a.id))
    : f.sort === 'cat' ? (a, b) => String(a.cat || '~').localeCompare(String(b.cat || '~'), LOCALE) || byTitle(a, b)
    : active ? (a, b) => hits.get(b.id).score - hits.get(a.id).score : byTitle);
  return { list, active };
}

function loreOverview() {
  const f = SRCH.lore, { list } = loreList(), cats = loreCats(), total = LORE.filter(a => canSee(a.vis)).length;
  const bar = `<div class="srch well lore-srch">
    <label class="srch-q">${ic('search', 14)}<input class="field" id="srchLore" type="search" placeholder='Rechercher : mots, "phrase exacte", -exclure' value="${esc(f.q)}" data-srch="lore:q" autocomplete="off"></label>
    <label class="srch-chk"><input type="checkbox" data-srch="lore:titles" ${f.titles ? 'checked' : ''}>Titres seulement</label>
    <select class="field" data-srch="lore:cat" aria-label="Catégorie">${opt('', 'Toutes les catégories', f.cat)}${cats.map(c => opt(c.name, c.name, f.cat)).join('')}${opt('-', 'Sans catégorie', f.cat)}</select>
    ${isMJ() ? `<select class="field" data-srch="lore:vis" aria-label="Visibilité">${opt('', 'Tous les articles', f.vis)}${opt('pub', 'Visibles des joueurs', f.vis)}${opt('secret', 'Secrets (MJ)', f.vis)}</select>` : ''}
    <select class="field" data-srch="lore:sort" aria-label="Tri">${opt('score', 'Pertinence', f.sort)}${opt('title', 'Titre', f.sort)}${opt('cat', 'Catégorie', f.sort)}${opt('new', 'Modifiés récemment', f.sort)}</select>
    <span class="seg lore-view" role="group" aria-label="Affichage"><button data-act="loreView" data-v="list" aria-pressed="${f.view !== 'grid'}">${ic('text', 13)}Liste</button><button data-act="loreView" data-v="grid" aria-pressed="${f.view === 'grid'}">${ic('layout', 13)}Grille</button></span>
    ${countTag(list.length, total)}${f.q || f.vis || f.titles || f.cat ? `<button class="btn xs" data-act="srchReset" data-k="lore">Effacer</button>` : ''}</div>`;
  const lock = a => a.vis !== 'all' ? `<span class="secret" title="Secret (MJ)">${ic('lock', 12)}</span>` : '';
  const ncom = a => { const n = commentsOf(a.id).length; return n ? `<span class="lore-ncom" title="Commentaires">${ic('text', 11)}${n}</span>` : ''; };
  const items = !list.length ? `<div class="empty-note well">${total ? 'Aucun article ne correspond.' : 'Aucun article.'}</div>`
    : f.view === 'grid'
      ? `<div class="lore-grid">${list.map(a => `<button class="lore-card" data-act="loreOpen" data-id="${a.id}" style="--cc:${esc(catColor(a.cat))}">
          <span class="lc-band"></span><b>${esc(a.title)}</b><span class="lc-meta">${catChip(a.cat)}${lock(a)}${ncom(a)}</span><span class="lc-snip">${esc(snippetOf(a, 140))}</span></button>`).join('')}</div>`
      : `<div class="lore-list">${list.map(a => `<button class="lore-row" data-act="loreOpen" data-id="${a.id}" style="--cc:${esc(catColor(a.cat))}">
          <span class="lr-head"><b>${esc(a.title)}</b>${catChip(a.cat)}${lock(a)}<span class="grow"></span>${ncom(a)}</span><span class="lc-snip">${esc(snippetOf(a))}</span></button>`).join('')}</div>`;
  return `<div class="toolbar"><div><h2>Lore</h2><div class="sub">Articles en Markdown, avec images et tableaux.</div></div><span class="grow"></span>
    ${isMJ() ? `<button class="btn" data-act="loreCats">${ic('layout')}Catégories</button><button class="btn" data-act="newLore">${ic('plus')}Nouvel article</button>` : ''}</div>${bar}${items}`;
}

function loreArticle(a) {
  const editing = S.loreEdit && isMJ();
  const head = `<div class="toolbar"><button class="btn" data-act="loreBack">‹ Retour</button><span class="grow"></span>
    ${isMJ() ? `<button class="btn ${editing ? 'on' : ''}" data-act="loreEdit">${ic('edit')}${editing ? 'Terminer' : 'Éditer'}</button>${editing ? `<button class="btn danger" data-act="deleteLore">${ic('trash')}Supprimer</button>` : ''}` : ''}</div>`;
  if (editing) {
    const cats = loreCats();
    return `${head}<div class="lore-edit-meta well">
        <label class="grow">Titre<input class="field" data-bind="lore:${a.id}:title" value="${esc(a.title)}" maxlength="255" aria-label="Titre de l’article"></label>
        <label>Catégorie<select class="field" data-bind="lore:${a.id}:cat">${opt('', '— aucune —', a.cat || '')}${cats.map(c => opt(c.name, c.name, a.cat || '')).join('')}</select></label>
        <span class="lore-vis">${visBadge('lore', a.id, a.vis)}</span></div>
      <div class="editor"><div class="tile" style="animation:none"><div class="tile-head"><h3 class="tile-title">Markdown</h3><span class="grow"></span>
        <button class="btn xs" data-act="insertImg">${ic('plus', 12)}Image</button><button class="btn xs" data-act="insertTable">${ic('plus', 12)}Tableau</button></div>
        <textarea class="field" id="mdArea" data-bind="lore:${a.id}:md" spellcheck="false">${esc(a.md)}</textarea></div>
        <div class="tile article" style="animation:none"><div class="md" id="mdPreview">${mdHtml(a.md)}</div></div></div>`;
  }
  const com = commentsOf(a.id), canComment = a.vis === 'all' || isMJ();
  return `${head}<article class="tile article lore-read"><header class="lore-title"><h1>${esc(a.title)}</h1><span class="lc-meta">${catChip(a.cat)}${a.vis !== 'all' ? `<span class="secret">${ic('lock', 12)}Secret (MJ)</span>` : ''}</span></header>
      <div class="md">${mdHtml(bodyWithoutTitle(a))}</div></article>
    <section class="lore-comments tile"><div class="tile-head"><span class="led"></span><h3 class="tile-title">Commentaires</h3><small class="hint">${com.length || ''}</small></div>
      ${com.map(c => `<div class="lcom"><div class="lcom-head"><b>${esc(c.authorName || '?')}</b><small>${fmtDate(c.$createdAt)}</small><span class="grow"></span>
        ${c.authorId === ME.user.$id || isMJ() ? `<button class="iconbtn" data-act="loreComDel" data-id="${c.$id}" aria-label="Supprimer le commentaire">${ic('trash', 12)}</button>` : ''}</div>
        <div class="md">${mdHtml(c.body || '')}</div></div>`).join('') || '<p class="hint" style="margin:0">Aucun commentaire.</p>'}
      ${canComment ? `<form id="loreComment" data-id="${a.id}" class="lcom-form"><textarea class="field" name="body" rows="3" maxlength="4000" placeholder="Écrire un commentaire (Markdown)…" required></textarea>
        <button class="btn orange" type="submit">Publier</button></form>` : ''}</section>`;
}

renderLore = function () {
  if (!ME.camp) return loreOverview();
  const a = S.loreOpen && LORE.find(x => x.id === S.loreSel && canSee(x.vis));
  if (!a) { S.loreOpen = false; S.loreEdit = false; return loreOverview(); }
  return loreArticle(a);
};

Object.assign(ACT, {
  loreOpen: d => { S.loreSel = d.id; S.loreOpen = true; S.loreEdit = false; scrollTo(0, 0); },
  loreBack: () => { S.loreOpen = false; S.loreEdit = false; },
  loreView: d => { SRCH.lore.view = d.v; try { localStorage.setItem('tn-lore-view', d.v); } catch (_) {} },
  newLore: () => { const id = uid(); LORE.push({ id, title: 'Nouvel article', vis: 'mj', cat: SRCH.lore.cat && SRCH.lore.cat !== '-' ? SRCH.lore.cat : '', md: tr('Écris ici en **Markdown**.') + '\n' });
    S.loreSel = id; S.loreOpen = true; S.loreEdit = true; },
  insertTable: () => { const ta = $('#mdArea'); if (!ta) return false;
    const col = tr('Colonne');   // the template goes into the article: in the interface language
    ta.setRangeText(`\n| ${col} 1 | ${col} 2 | ${col} 3 |\n|---|---|---|\n| … | … | … |\n| … | … | … |\n`, ta.selectionStart, ta.selectionEnd, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); return false; },
  loreComDel: d => {
    if (!confirm('Supprimer ce commentaire ?')) return false;
    AW.db.deleteRow({ databaseId: TN.db, tableId: 'lore_comments', rowId: d.id }).then(() => { dropComment(d.id); render(); }).catch(e => toast('Suppression impossible : ' + errMsg(e)));
    return false;
  },
  loreCats: () => { catsModal(); return false; },
});
// deleting an article goes back to the overview
ACT.deleteLore = (orig => () => { const r = orig(); if (!LORE.find(x => x.id === S.loreSel)) S.loreOpen = false; return r; })(ACT.deleteLore);

/* ---------------------------------------------------------------- comments */
function dropComment(id) { for (const [k, l] of LR.comments) LR.comments.set(k, l.filter(c => c.$id !== id)); }
function addComment(r) { const l = LR.comments.get(r.articleId) || []; if (!l.some(c => c.$id === r.$id)) { l.push(r); l.sort((a, b) => a.$createdAt.localeCompare(b.$createdAt)); } LR.comments.set(r.articleId, l); }
async function loadComments() {
  LR.comments.clear();
  if (!ME.camp) return;
  (await rows('lore_comments', [AW.Q.equal('campaignId', ME.camp.$id)]).catch(() => [])).forEach(addComment);
  if (LR.unsub) LR.unsub();
  LR.unsub = AW.c.subscribe(`tablesdb.${TN.db}.tables.lore_comments.rows`, ev => {
    const r = ev.payload; if (!r || !ME.camp || r.campaignId !== ME.camp.$id) return;
    if (ev.events.some(x => x.endsWith('.delete'))) dropComment(r.$id); else if (ev.events.some(x => x.endsWith('.create'))) addComment(r);
    if (S.tab === 'lore' && !$('#loreComment textarea')?.value) render();
  });
  if (S.tab === 'lore') render();
}
document.addEventListener('submit', async e => {
  if (e.target.id !== 'loreComment') return;
  e.preventDefault(); e.stopImmediatePropagation();
  const f = e.target, btn = f.querySelector('button[type=submit]'); btn.disabled = true;
  try { await call('player-action', { action: 'comment', articleId: f.dataset.id, body: f.body.value }); f.body.value = ''; await loadComments(); }
  catch (err) { toast('Commentaire non publié : ' + errMsg(err)); }
  btn.disabled = false;
}, true);
const _enterLore = enterCampaign;
enterCampaign = async function (id) { S.loreOpen = false; await _enterLore(id); if (ME.camp) loadComments(); };
const _leaveLore = leaveCampaign;
leaveCampaign = function () { if (LR.unsub) { LR.unsub(); LR.unsub = null; } LR.comments.clear(); _leaveLore(); };

/* ---------------------------------------------------------------- categories (GM) */
let CATS_EDIT = [];
function catsModal(keep) {
  if (!keep) CATS_EDIT = loreCats().map(c => ({ ...c, was: c.name }));
  openModal(`<h3>Catégories du lore</h3><p class="hint" style="margin:0">Une couleur par catégorie. Renommer une catégorie renomme celle de ses articles.</p>
    <div class="cat-list">${CATS_EDIT.map((c, i) => `<div class="edit-row"><input type="color" value="${esc(c.color)}" data-cat="${i}:color" aria-label="Couleur">
      <input class="field" style="flex:1" value="${esc(c.name)}" maxlength="64" data-cat="${i}:name" aria-label="Nom de la catégorie">
      <button class="iconbtn" data-act="catDel" data-i="${i}" aria-label="Supprimer la catégorie">${ic('trash', 12)}</button></div>`).join('') || '<p class="hint">Aucune catégorie.</p>'}</div>
    <div class="modal-acts"><button class="btn" data-act="catAdd">${ic('plus')}Catégorie</button><span class="grow"></span><button class="btn" data-act="closeModal">Annuler</button><button class="btn orange" data-act="catSave">Enregistrer</button></div>`);
}
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.cat; if (!k) return;
  const [i, f] = k.split(':'); if (CATS_EDIT[+i]) CATS_EDIT[+i][f] = e.target.value;
});
Object.assign(ACT, {
  catAdd: () => { CATS_EDIT.push({ name: '', color: ['#8d6b9a', '#4f8d89', '#d6a23c', '#b8452f', '#86985a', '#e2672c'][CATS_EDIT.length % 6], was: null }); catsModal(true); return false; },
  catDel: d => { CATS_EDIT.splice(+d.i, 1); catsModal(true); return false; },
  catSave: async () => {
    const list = CATS_EDIT.filter(c => c.name.trim()).map(c => ({ name: c.name.trim(), color: c.color, was: c.was }));
    try {
      await admin('updateCampaign', { campaignId: ME.camp.$id, loreCategories: list.map(({ name, color }) => ({ name, color })) });
      ME.camp.loreCategories = JSON.stringify(list.map(({ name, color }) => ({ name, color })));
      const names = new Set(list.map(c => c.name));
      for (const c of list) if (c.was && c.was !== c.name) LORE.forEach(a => { if (a.cat === c.was) a.cat = c.name; });   // renamed
      LORE.forEach(a => { if (a.cat && !names.has(a.cat)) a.cat = ''; });   // deleted
      closeModal(); render(); toast('Catégories enregistrées');
    } catch (err) { toast('Catégories non enregistrées : ' + errMsg(err)); }
    return false;
  },
});

const loreCss = document.createElement('style');
loreCss.textContent = `
.lore-view button{display:inline-flex;align-items:center;gap:5px}
.lore-cat{display:inline-flex;align-items:center;gap:5px;font:500 10px/1 var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--cream);padding:4px 7px;border-radius:4px;
  background:color-mix(in srgb,var(--cc) 30%,#1b1a17);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--cc) 60%,transparent)}
.lore-cat::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--cc)}
.lore-list{display:flex;flex-direction:column;gap:8px}
.lore-row{display:flex;flex-direction:column;gap:6px;text-align:left;padding:12px 14px 12px 16px;border:0;border-radius:8px;cursor:pointer;color:var(--ink);
  background:linear-gradient(90deg,var(--cc) 0 4px,#24221e 4px);box-shadow:inset 0 1px 0 rgba(255,240,215,.05),0 2px 0 #0b0a09}
.lore-row:hover{background:linear-gradient(90deg,var(--cc) 0 4px,#2c2a25 4px)}
.lr-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.lr-head b{font:600 15px var(--f-body)}
.lc-snip{font-size:12.5px;color:var(--mute);line-height:1.45}
.lore-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.lore-card{position:relative;display:flex;flex-direction:column;gap:8px;text-align:left;padding:14px;padding-top:20px;min-height:150px;border:0;border-radius:10px;cursor:pointer;color:var(--ink);overflow:hidden;
  background:#24221e;box-shadow:inset 0 1px 0 rgba(255,240,215,.05),0 2px 0 #0b0a09}
.lore-card:hover{background:#2c2a25}
.lore-card .lc-band{position:absolute;left:0;right:0;top:0;height:6px;background:var(--cc)}
.lore-card b{font:600 15px var(--f-body)}
.lc-meta{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
.lore-ncom{display:inline-flex;align-items:center;gap:3px;font:500 11px var(--f-mono);color:var(--mute)}
.lore .secret,.lore-row .secret,.lore-card .secret,.lore-title .secret{display:inline-flex;align-items:center;gap:4px;color:var(--rust);font:500 11px var(--f-mono)}
.lore-title{display:flex;flex-direction:column;gap:8px;margin-bottom:6px}
.lore-title h1{margin:0;font:400 26px/1.2 var(--f-display);letter-spacing:.04em}
.lore-read{max-width:900px}
.lore-edit-meta{display:flex;flex-wrap:wrap;gap:12px;align-items:end;padding:12px;margin-bottom:12px;border-radius:8px}
.lore-edit-meta label{display:flex;flex-direction:column;gap:5px;font:500 10px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute);min-width:180px}
.lore-comments{max-width:900px;margin-top:14px}
.lcom{padding:10px 12px;border-radius:8px;background:#22201c;margin-top:8px}
.lcom-head{display:flex;align-items:center;gap:8px;font-size:12.5px}
.lcom-head small{color:var(--mute);font-family:var(--f-mono)}
.lcom .md{font-size:13.5px}
.lcom-form{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.lcom-form .btn{align-self:flex-end}
.md table{border-collapse:collapse;margin:10px 0;font-size:13px;width:auto;max-width:100%;display:block;overflow-x:auto}
.md th,.md td{border:1px solid rgba(47,41,34,.28);padding:6px 10px;text-align:left;vertical-align:top}
.md th{background:rgba(47,41,34,.09);font-weight:600}
.lcom .md th,.lcom .md td{border-color:rgba(255,240,215,.14)}
.lcom .md th{background:rgba(255,240,215,.06)}
.cat-list{display:flex;flex-direction:column;gap:6px;margin:10px 0}
.cat-list input[type=color]{width:40px;height:32px;padding:0;border:0;background:none;cursor:pointer}`;
document.head.appendChild(loreCss);
