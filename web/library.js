/* library.js — export / import of a library (GM): items, skills, lore articles, maps.
   Export: a JSON file with the entries of that library (GM notes included; images referenced, not embedded).
   Import: MERGE — entries whose name / title already exists in the campaign (ignoring accents and case), or that
   appear twice in the file, are skipped; nothing is replaced or deleted. New entries go through the usual saving
   (inventory.js / world.js); the images they reference are shared with this campaign (admin shareFiles).
   Maps keep their points, texts, fog and nesting; point links to articles follow the article titles. */

const LIB_KINDS = { items: 'Objets', skills: 'Compétences', lore: 'Articles de lore', maps: 'Cartes' };
const libKey = s => fold(String(s || '').trim()).replace(/\s+/g, ' ');
const fileRef = url => { const m = /buckets\/(maps|item-art|lore-images|portraits)\/files\/([A-Za-z0-9._-]+)\//.exec(url || ''); return m ? `${m[1]}/${m[2]}` : null; };

function downloadJson(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campagne';

/* ---------------------------------------------------------------- export */
function libExport(kind) {
  let entries = [];
  if (kind === 'items') entries = ITEMS.map(d => ({ name: d.name, type: d.type, rarity: d.rarity, value: d.value, art: d.art, desc: d.desc, mj: d.mj || '', slot: d.slot || '', img: d.img && !d.img.startsWith('data:') ? d.img : '' }));
  if (kind === 'skills') entries = SKILLS.map(d => ({ name: d.name, stat: d.stat, level: d.level, desc: d.desc, mj: d.mj || '' }));
  if (kind === 'lore') entries = LORE.map(a => ({ title: a.title, md: a.md, vis: a.vis }));
  if (kind === 'maps') {
    const loreTitle = id => (LORE.find(a => a.id === id) || {}).title || '';
    entries = Object.entries(MAPS).map(([id, m]) => ({ ref: id, name: m.name, parent: m.parent || '', img: m.img && !m.img.startsWith('data:') ? m.img : '', w: m.w, h: m.h, vis: m.vis || 'all', fog: m.fog || null,
      pois: m.pois.map(p => { const [k, v] = (p.link || '').split(':'); return { x: p.x, y: p.y, label: p.label, icon: p.icon, color: p.color, vis: p.vis, desc: p.desc,
        link: k === 'lore' ? { lore: loreTitle(v) } : k === 'map' ? { map: v } : null }; }),
      texts: m.texts.map(t => ({ x: t.x, y: t.y, text: t.text, size: t.size, color: t.color, rot: t.rot, vis: t.vis })) }));
  }
  downloadJson({ format: 'table-noire/library', kind, version: 1, exportedAt: new Date().toISOString(), from: ME.camp.name, entries },
    `${slug(ME.camp.name)}-${kind}-${new Date().toISOString().slice(0, 10)}.json`);
  toast(`${LIB_KINDS[kind]} exportés : ${entries.length}`);
}

/* ---------------------------------------------------------------- import (merge, no duplicates) */
async function libImport(kind, file) {
  let data; try { data = JSON.parse(await file.text()); } catch (_) { toast('Fichier illisible.'); return; }
  if (data.format !== 'table-noire/library' || !Array.isArray(data.entries)) { toast('Ce fichier n’est pas un export de bibliothèque Table Noire.'); return; }
  if (data.kind !== kind) { toast(`Ce fichier contient : ${LIB_KINDS[data.kind] || data.kind}. Ouvre la bonne bibliothèque pour l’importer.`); return; }
  const seen = new Set(), files = new Set(); let added = 0, skipped = 0;
  const fresh = key => { if (!key || seen.has(key)) return false; seen.add(key); return true; };
  const s = v => String(v ?? '');

  if (kind === 'items') {
    ITEMS.forEach(d => seen.add(libKey(d.name)));
    for (const e of data.entries) {
      if (!fresh(libKey(e.name))) { skipped++; continue; }
      const ref = fileRef(e.img); if (ref) files.add(ref);
      ITEMS.push({ id: uid(), name: s(e.name).slice(0, 128), type: s(e.type).slice(0, 64), rarity: RARITY[e.rarity] ? e.rarity : 'common', value: s(e.value).slice(0, 64),
        art: ART[e.art] ? e.art : 'photo', desc: s(e.desc), mj: s(e.mj), slot: s(e.slot).slice(0, 64), img: ref ? e.img : '', fileId: ref ? ref.split('/')[1] : '' });
      added++;
    }
  }
  if (kind === 'skills') {
    SKILLS.forEach(d => seen.add(libKey(d.name)));
    for (const e of data.entries) {
      if (!fresh(libKey(e.name))) { skipped++; continue; }
      SKILLS.push({ id: uid(), name: s(e.name).slice(0, 128), stat: s(e.stat).slice(0, 8), level: Math.max(1, Math.min(5, +e.level || 1)), desc: s(e.desc), mj: s(e.mj) });
      added++;
    }
  }
  if (kind === 'lore') {
    LORE.forEach(a => seen.add(libKey(a.title)));
    for (const e of data.entries) {
      if (!fresh(libKey(e.title))) { skipped++; continue; }
      for (const x of s(e.md).matchAll(/buckets\/(lore-images|item-art|maps)\/files\/([A-Za-z0-9._-]+)\//g)) files.add(`${x[1]}/${x[2]}`);
      LORE.push({ id: uid(), title: s(e.title).slice(0, 255), md: s(e.md), vis: ['all', 'owner', 'mj'].includes(e.vis) ? e.vis : 'mj' });
      added++;
    }
  }
  if (kind === 'maps') {
    Object.values(MAPS).forEach(m => seen.add(libKey(m.name)));
    const newId = new Map(), loreByTitle = new Map(LORE.map(a => [libKey(a.title), a.id]));
    const keep = data.entries.filter(e => { if (fresh(libKey(e.name))) return true; skipped++; return false; });
    keep.forEach(e => newId.set(e.ref, 'm_' + uid()));
    for (const e of keep) {
      const ref = fileRef(e.img); if (ref) files.add(ref);
      const link = l => l && l.lore && loreByTitle.has(libKey(l.lore)) ? `lore:${loreByTitle.get(libKey(l.lore))}` : l && l.map && newId.has(l.map) ? `map:${newId.get(l.map)}` : '';
      MAPS[newId.get(e.ref)] = { name: s(e.name).slice(0, 128), parent: newId.get(e.parent) || null, img: ref ? e.img : '', fileId: ref ? ref.split('/')[1] : '',
        w: +e.w || 1600, h: +e.h || 1100, vis: ['all', 'owner', 'mj'].includes(e.vis) ? e.vis : 'all', credit: '',
        fog: e.fog && Array.isArray(e.fog.holes) ? { on: !!e.fog.on, holes: e.fog.holes.filter(h => Array.isArray(h) && (h.length === 3 || h.length === 4)).map(h => h.map(Number)) } : null,
        pois: (e.pois || []).map(p => ({ id: uid(), x: +p.x || 0, y: +p.y || 0, label: s(p.label).slice(0, 128), icon: s(p.icon || 'pin').slice(0, 32), color: s(p.color).slice(0, 16), link: link(p.link), vis: ['all', 'owner', 'mj'].includes(p.vis) ? p.vis : 'mj', desc: s(p.desc) })),
        texts: (e.texts || []).map(t => ({ id: uid(), x: +t.x || 0, y: +t.y || 0, text: s(t.text).slice(0, 255), size: +t.size || 32, color: s(t.color).slice(0, 16), rot: +t.rot || 0, vis: ['all', 'owner', 'mj'].includes(t.vis) ? t.vis : 'all' })) };
      added++;
    }
    if (!MAPS[S.map]) S.map = rootMap();
  }
  if (files.size) await admin('shareFiles', { campaignId: ME.camp.$id, files: [...files] }).catch(() => {});
  render();   // the usual saving picks the new entries up
  toast(`${LIB_KINDS[kind]} : ${added} ajouté${added > 1 ? 's' : ''}, ${skipped} déjà présent${skipped > 1 ? 's' : ''} (ignoré${skipped > 1 ? 's' : ''}).`);
}
function libPick(kind) {
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
  input.onchange = () => { if (input.files[0]) libImport(kind, input.files[0]).catch(e => toast('Import interrompu : ' + errMsg(e))); };
  input.click();
}
ACT.libExport = d => { libExport(d.k); return false; };
ACT.libImport = d => { libPick(d.k); return false; };

/* ---------------------------------------------------------------- buttons (GM) */
const libBtns = k => `<button class="btn" data-act="libImport" data-k="${k}" title="Ajouter les entrées d’un export (sans doublon)">${ic('upload')}Importer</button><button class="btn" data-act="libExport" data-k="${k}" title="Télécharger cette bibliothèque">Exporter</button>`;
const _renderInventoryLib = renderInventory;
renderInventory = function () { const h = _renderInventoryLib(); return isMJ() && S.invMode === 'lib' ? h.replace('Créer un objet</button>', 'Créer un objet</button>' + libBtns('items')) : h; };
const _renderSkillsLib = renderSkills;
renderSkills = function () { const h = _renderSkillsLib(); return isMJ() && S.skMode === 'lib' ? h.replace('Créer une compétence</button>', 'Créer une compétence</button>' + libBtns('skills')) : h; };
const _renderLoreLib = renderLore;
renderLore = function () { const h = _renderLoreLib(); return isMJ() && !S.loreEdit ? h.replace('Nouvel article</button>', 'Nouvel article</button>' + libBtns('lore')) : h; };
const _renderMapLib = renderMap;
renderMap = function () {
  const h = _renderMapLib();
  if (S.tab !== 'carte' || !isMJ() || S.mapEdit) return h;
  return h.replace(/<button class="btn( orange)?" data-act="importMap">/, m => libBtns('maps') + m);   // also on the "no map yet" screen
};
