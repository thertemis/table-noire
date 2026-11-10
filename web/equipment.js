/* equipment.js — stacks, equipping and the "Équipement" tab.
   - item_defs.slot: the kind of spot an item goes on (tete, doigt, oreille…); '' = not equippable.
   - item_instances.qty: stack size; item_instances.equippedSlot: id of the spot it is worn on.
   - campaigns.equipSlots: the campaign's spots [{ id, label, type, view, x, y, cap }] (DEFAULT_SLOTS while empty),
     x / y in the pixel space of the 420x890 body plates (front view: image left = character's right).
   Equip / unequip go through player-action (owner or GM): equipping one unit of a stack splits it off,
   unequipping puts it back on the matching stack. */

// keep in sync with appwrite/functions/player-action/src/slots.js
const fingerSlots = (side, xs) => [['pouce', 'Pouce'], ['index', 'Index'], ['majeur', 'Majeur'], ['annulaire', 'Annulaire'], ['auriculaire', 'Auriculaire']]
  .map(([k, l], i) => ({ id: `${k}_${side}`, label: `${l} ${side === 'd' ? 'droit' : 'gauche'}`, type: 'doigt', view: 'front', x: xs[i], y: [452, 498, 506, 502, 490][i], cap: 1 }));
const DEFAULT_SLOTS = [
  { id: 'tete', label: 'Tête', type: 'tete', view: 'front', x: 213, y: 28, cap: 1 },
  { id: 'oreille_d', label: 'Oreille droite', type: 'oreille', view: 'front', x: 172, y: 72, cap: 3 },
  { id: 'oreille_g', label: 'Oreille gauche', type: 'oreille', view: 'front', x: 254, y: 72, cap: 3 },
  { id: 'cou', label: 'Cou', type: 'cou', view: 'front', x: 213, y: 124, cap: 2 },
  { id: 'teton_d', label: 'Téton droit', type: 'teton', view: 'front', x: 180, y: 205, cap: 1 },
  { id: 'teton_g', label: 'Téton gauche', type: 'teton', view: 'front', x: 246, y: 205, cap: 1 },
  { id: 'haut', label: 'Haut', type: 'haut', view: 'front', x: 213, y: 252, cap: 2 },
  { id: 'corps', label: 'Corps', type: 'corps', view: 'front', x: 213, y: 330, cap: 1 },
  { id: 'ceinture', label: 'Taille', type: 'ceinture', view: 'front', x: 213, y: 410, cap: 1 },
  { id: 'bas', label: 'Bas', type: 'bas', view: 'front', x: 213, y: 545, cap: 2 },
  { id: 'pieds', label: 'Pieds', type: 'pieds', view: 'front', x: 213, y: 862, cap: 2 },
  { id: 'poignet_d', label: 'Poignet droit', type: 'poignet', view: 'front', x: 74, y: 414, cap: 2 },
  { id: 'poignet_g', label: 'Poignet gauche', type: 'poignet', view: 'front', x: 352, y: 414, cap: 2 },
  ...fingerSlots('d', [78, 64, 46, 28, 12]),
  ...fingerSlots('g', [348, 362, 380, 398, 414]),
  { id: 'dos', label: 'Dos', type: 'dos', view: 'back', x: 213, y: 240, cap: 1 },
  { id: 'tenu_g', label: 'Main gauche (tenu)', type: 'tenu', view: 'back', x: 40, y: 462, cap: 1 },
  { id: 'tenu_d', label: 'Main droite (tenu)', type: 'tenu', view: 'back', x: 386, y: 462, cap: 1 },
];
const SLOT_TYPES = { tete: 'Tête (chapeau, cagoule…)', oreille: 'Oreille (boucle, piercing…)', cou: 'Cou (collier, écharpe…)', teton: 'Téton (piercing…)',
  haut: 'Haut (pull, t-shirt…)', corps: 'Corps (robe, tunique…)', ceinture: 'Taille (ceinture…)', bas: 'Bas (pantalon, jupe…)', pieds: 'Pieds (chaussures…)',
  poignet: 'Poignet (montre, bracelet…)', doigt: 'Doigt (bague, anneau…)', dos: 'Dos (sac, cape…)', tenu: 'Tenu en main (arme, outil…)' };

const EQ = { sel: null, edit: false };
const eqSlots = () => { try { const s = JSON.parse(ME.camp?.equipSlots || 'null'); if (Array.isArray(s) && s.length) return s; } catch (_) {} return DEFAULT_SLOTS; };
const slotById = id => eqSlots().find(s => s.id === id);
const slotTypes = () => { const t = {}; for (const s of eqSlots()) t[s.type] = SLOT_TYPES[s.type] || s.type; return t; };
const typeLabel = t => (SLOT_TYPES[t] || t || '').split(' (')[0];
const defOf = o => ITEMS.find(i => i.id === o.def);
const equippedIn = id => INV.filter(o => o.slot === id && ownVisible(o));
const canEquip = () => isMJ() || S.viewer === 'owner';

/* ---------------------------------------------------------------- styles */
const eqCss = document.createElement('style');
eqCss.textContent = `
.card.stacked{isolation:isolate}
.card.stacked::before,.card.stacked::after{content:"";position:absolute;inset:0;border-radius:10px;z-index:-1;pointer-events:none;
  background:var(--noise),linear-gradient(165deg,color-mix(in srgb,var(--rc) 80%,#fff 8%),color-mix(in srgb,var(--rc) 45%,#0d0c0a));
  box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--rc) 55%,#000),inset 0 0 0 4px rgba(231,220,196,.25),0 3px 0 #0b0a09,0 10px 18px -10px rgba(0,0,0,.8);
  transform:translate(9px,7px) rotate(3deg);filter:brightness(.82)}
.card.stacked::after{transform:translate(16px,13px) rotate(6deg);filter:brightness(.66)}
.card.stacked.s2::after{display:none}
.qty{position:absolute;right:6px;top:6px;z-index:2;display:inline-flex;align-items:center;gap:1px;font:600 13px/1 var(--f-mono);color:var(--cream);
  background:linear-gradient(#2c2a26 50%,#222019 50%);border-radius:4px;padding:5px 7px;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 2px 0 #0b0a09}
.qty small{font-size:9px;color:var(--mute);margin-right:2px}
.eq-tag{position:absolute;left:6px;bottom:6px;z-index:2;font:500 9px/1 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;color:#24110a;
  background:linear-gradient(var(--orange-hi),var(--orange));padding:4px 6px;border-radius:3px;box-shadow:0 1px 0 var(--orange-lo)}
.qtyctl{display:inline-flex;align-items:center;gap:4px;font:600 12px var(--f-mono)}
.equip{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,280px);gap:14px;align-items:start}
.spot{cursor:pointer}
.spot circle{fill:rgba(239,231,213,.85);stroke:#2f2922;stroke-width:2.5;transition:r .15s}
.spot.on circle{fill:url(#eqKnob);stroke:#6b2f12}
.spot.full circle{stroke:#8e2419;stroke-width:3.5}
.spot.sel circle{stroke:#1d1a16;stroke-width:4;stroke-dasharray:4 3}
.spot:hover circle{r:15}
.spot text{font:700 12px var(--f-mono);fill:#24110a;pointer-events:none;text-anchor:middle;dominant-baseline:central}
.plate svg.editing{cursor:crosshair}
#eqTip{position:fixed;z-index:85;pointer-events:none;max-width:min(560px,92vw);padding:10px;border-radius:8px;opacity:0;transition:opacity .12s;
  background:var(--noise),linear-gradient(#34312c,#26241f);box-shadow:inset 0 1px 0 rgba(255,240,215,.1),0 3px 0 #0b0a09,0 18px 36px rgba(0,0,0,.6)}
#eqTip.show{opacity:1}
#eqTip h5{margin:0 0 8px;font:400 11px var(--f-display);letter-spacing:.12em;text-transform:uppercase;color:var(--cream)}
#eqTip .cards{grid-template-columns:repeat(auto-fill,150px);gap:10px}
#eqTip .card{width:150px}
.eq-groups{display:flex;flex-direction:column;gap:16px;margin-top:16px}
.eq-group h3{display:flex;align-items:center;gap:8px;margin:0 0 10px;font:400 11px var(--f-display);letter-spacing:.14em;text-transform:uppercase;color:var(--cream)}
.eq-group h3 small{font:500 10px var(--f-mono);color:var(--mute);letter-spacing:.06em}
.eq-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.eq-list li{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:6px;background:#22201c;font-size:12.5px}
.eq-list li .grow{flex:1}
@media (max-width:900px){.equip{grid-template-columns:1fr}}`;
document.head.appendChild(eqCss);
const eqTip = Object.assign(document.createElement('div'), { id: 'eqTip' });
document.body.appendChild(eqTip);
// orange knob for occupied spots, declared inside each plate (a gradient in a display:none svg is not painted)
const KNOB = '<defs><radialGradient id="eqKnob" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#f08046"/><stop offset=".55" stop-color="#e2672c"/><stop offset="1" stop-color="#a8461a"/></radialGradient></defs>';

/* ---------------------------------------------------------------- inventory cards: stacks, equip */
const _cardHtml = cardHtml;
cardHtml = function (def, own, lib) {
  let html = _cardHtml(def, own, lib);
  if (!own) {
    if (lib && def.slot) html = html.replace('<span class="rar">', `<span class="rar">${esc(typeLabel(def.slot))} · `);
    return html;
  }
  const qty = own.qty || 1, spot = own.slot ? slotById(own.slot) : null;
  if (qty > 1) html = html.replace('class="card ', `class="card stacked ${qty === 2 ? 's2' : ''} `);
  const badges = (qty > 1 ? `<span class="qty"><small>×</small>${qty}</span>` : '') + (own.slot ? `<span class="eq-tag">Équipé · ${esc(spot ? spot.label : 'emplacement supprimé')}</span>` : '');
  html = html.replace('<div class="c-art">', `<div class="c-art">${badges}`);
  let acts = '';
  if (def.slot && canEquip()) acts += own.slot
    ? `<button class="btn xs" data-act="unequip" data-id="${own.iid}">${ic('x', 12)}Déséquiper</button>`
    : `<button class="btn xs orange" data-act="equipPick" data-id="${own.iid}">${ic('user', 12)}Équiper</button>`;
  if (isMJ() && !own.slot) acts += `<span class="qtyctl"><button class="iconbtn" data-act="qty" data-id="${own.iid}" data-d="-1" aria-label="Retirer un exemplaire">${ic('minus', 12)}</button>×${qty}<button class="iconbtn" data-act="qty" data-id="${own.iid}" data-d="1" aria-label="Ajouter un exemplaire">${ic('plus', 12)}</button></span>`;
  return html.replace('<div class="acts">', `<div class="acts">${acts}`);
};

// item form: which kind of spot the item goes on
const _itemForm = itemForm;
itemForm = function (def) {
  _itemForm(def);
  const desc = $('#itemForm textarea[name="desc"]')?.closest('label'); if (!desc) return;
  const cur = (def && def.slot) || '';
  desc.insertAdjacentHTML('beforebegin', `<label class="full">S’équipe sur<select class="field" name="slot"><option value="">Ne s’équipe pas</option>${Object.entries(slotTypes())
    .map(([k, l]) => `<option value="${esc(k)}" ${k === cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`);
};

ACT.qty = d => {
  const o = INV.find(x => x.iid === d.id); if (!o) return false;
  const n = (o.qty || 1) + +d.d;
  if (n < 1) { if (!confirm('Retirer le dernier exemplaire de l’inventaire ?')) return false; INV.splice(INV.indexOf(o), 1); } else o.qty = n;
};
async function equipCall(action, rowId, slot) {
  clearTimeout(IV.timer); await syncInventory();   // the server works on saved rows
  try { await call('player-action', { action, rowId, slot }); }
  catch (e) { toast(errMsg(e)); }
  await loadInventory(SH.charId);
}
ACT.unequip = d => { equipCall('unequip', d.id); return false; };
ACT.equipPick = d => {
  const o = INV.find(x => x.iid === d.id), def = o && defOf(o); if (!def) return false;
  const spots = eqSlots().filter(s => s.type === def.slot);
  if (!spots.length) { toast('Aucun emplacement de ce type dans la campagne.'); return false; }
  openModal(`<h3>Équiper · ${esc(def.name)}</h3><p class="hint" style="margin:0">${esc(typeLabel(def.slot))}${(o.qty || 1) > 1 ? ' · un exemplaire sera retiré de la pile' : ''}</p>
    <div class="eq-pick" style="display:flex;flex-wrap:wrap;gap:8px">${spots.map(s => { const n = INV.filter(x => x.slot === s.id).length, full = n >= (s.cap || 1);
      return `<button class="btn ${full ? '' : 'orange'}" data-act="equipTo" data-id="${o.iid}" data-slot="${esc(s.id)}" ${full ? 'disabled' : ''}>${esc(s.label)} <small style="opacity:.7">${n}/${s.cap || 1}</small></button>`; }).join('')}</div>
    <div class="modal-acts"><button class="btn" data-act="closeModal">Annuler</button></div>`);
  return false;
};
ACT.equipTo = d => { closeModal(); equipCall('equip', d.id, d.slot); return false; };

/* ---------------------------------------------------------------- the tab */
TABS.splice(TABS.findIndex(t => t[0] === 'inventaire') + 1, 0, ['equipement', 'Équipement']);
const _renderMapEq = renderMap;
renderMap = function () { return S.tab === 'equipement' ? renderEquipment() : _renderMapEq(); };

function spotSvg(s) {
  const n = equippedIn(s.id).length, cap = s.cap || 1;
  return `<g class="spot ${n ? 'on' : ''} ${n >= cap ? 'full' : ''} ${EQ.sel === s.id ? 'sel' : ''}" data-spot="${esc(s.id)}" transform="translate(${s.x} ${s.y})" tabindex="0" role="button" aria-label="${esc(s.label)}, ${n} sur ${cap}">
    <circle r="11"/>${n ? `<text>${n}</text>` : ''}</g>`;
}
function eqPlate(view, img, cap) {
  return `<div class="plate"><svg viewBox="0 0 420 890" class="${EQ.edit ? 'editing' : ''}" data-view="${view}" role="img" aria-label="${cap}">${KNOB}<image href="${img}" width="420" height="890" preserveAspectRatio="none"/>
    ${eqSlots().filter(s => (s.view || 'front') === view).map(spotSvg).join('')}</svg><div class="plate-cap">${cap}</div></div>`;
}
function eqSide() {
  const s = EQ.sel && slotById(EQ.sel);
  if (!s) {
    const total = INV.filter(o => o.slot && ownVisible(o)).length;
    return `<h4>Emplacements</h4><p class="hint" style="margin:0">${total} objet${total > 1 ? 's' : ''} équipé${total > 1 ? 's' : ''}. Survole un point pour voir les cartes, clique-le pour équiper ou retirer.</p>
      ${EQ.edit ? `<p class="hint" style="margin:0;color:var(--mustard)">Mode édition : clique sur le dessin pour ajouter un emplacement, sur un point pour le modifier.</p>` : ''}`;
  }
  const on = equippedIn(s.id), cap = s.cap || 1;
  const free = INV.filter(o => !o.slot && ownVisible(o) && defOf(o)?.slot === s.type);
  return `<div style="display:flex;align-items:center;gap:6px"><h4>${esc(s.label)}</h4><span class="grow"></span><button class="iconbtn" data-act="eqSel" data-id="" aria-label="Fermer">${ic('x', 13)}</button></div>
    <p class="hint" style="margin:0">${esc(typeLabel(s.type))} · ${on.length}/${cap}</p>
    <ul class="eq-list">${on.map(o => `<li><b class="grow">${esc(defOf(o)?.name || '?')}</b>${canEquip() ? `<button class="btn xs" data-act="unequip" data-id="${o.iid}">Retirer</button>` : ''}</li>`).join('') || '<li class="hint">Rien d’équipé.</li>'}</ul>
    ${canEquip() && on.length < cap && free.length ? `<div class="lab">Équiper ici</div><ul class="eq-list">${free.map(o => `<li><span class="grow">${esc(defOf(o).name)}${(o.qty || 1) > 1 ? ` <small>×${o.qty}</small>` : ''}</span><button class="btn xs orange" data-act="equipTo" data-id="${o.iid}" data-slot="${esc(s.id)}">Équiper</button></li>`).join('')}</ul>` : ''}
    ${isMJ() ? `<button class="btn xs" data-act="slotEditOpen" data-id="${esc(s.id)}">${ic('edit', 12)}Modifier l’emplacement</button>` : ''}`;
}
function renderEquipment() {
  const name = esc(charName());
  if (!SH.charId) return `<div class="toolbar"><div><h2>Équipement</h2><div class="sub">Choisis d’abord un personnage.</div></div></div>`;
  const slots = eqSlots(), groups = [];
  for (const s of slots) { const on = equippedIn(s.id); if (on.length) groups.push([s.label, `${on.length}/${s.cap || 1}`, on]); }
  const lost = INV.filter(o => o.slot && !slotById(o.slot) && ownVisible(o));
  if (lost.length) groups.push(['Emplacement supprimé', '', lost]);
  return `<div class="toolbar"><div><h2>Équipement · ${name}</h2><div class="sub">Ce que ${name} porte sur lui, et où.</div></div><span class="grow"></span>
    ${isMJ() ? `<button class="btn ${EQ.edit ? 'on' : ''}" data-act="slotEdit">${ic('edit')}${EQ.edit ? 'Terminer' : 'Emplacements'}</button>${EQ.edit ? `<button class="btn" data-act="slotReset">Emplacements par défaut</button>` : ''}` : ''}</div>
    <div class="equip"><div class="sheet"><div class="sheet-head"><b>Fiche d’équipement</b><span>Sujet : ${name}</span></div>
      <div class="plates corps">${eqPlate('front', 'assets/body-front.png', 'Face antérieure')}${eqPlate('back', 'assets/body-back.png', 'Face postérieure')}</div></div>
      <div class="side well" id="eqSide">${eqSide()}</div></div>
    <div class="eq-groups">${groups.length ? groups.map(([l, c, list]) => `<section class="eq-group"><h3>${esc(l)} <small>${c}</small></h3>
      <div class="cards">${list.map(o => { const d = defOf(o); return d ? cardHtml(d, o, false) : ''; }).join('')}</div></section>`).join('')
      : `<div class="empty-note well">Rien d’équipé pour l’instant. Retourne une carte dans l’inventaire et choisis « Équiper ».</div>`}</div>`;
}

/* hover: the spot's equipped cards */
document.addEventListener('pointerover', e => {
  const g = e.target.closest && e.target.closest('.spot');
  if (!g) { eqTip.classList.remove('show'); return; }
  const s = slotById(g.dataset.spot); if (!s) return;
  const on = equippedIn(s.id);
  eqTip.innerHTML = `<h5>${esc(s.label)} · ${on.length}/${s.cap || 1}</h5>${on.length ? `<div class="cards">${on.map(o => { const d = defOf(o); return d ? cardHtml(d, o, false) : ''; }).join('')}</div>` : '<p class="hint" style="margin:0">Libre</p>'}`;
  const r = g.getBoundingClientRect();
  eqTip.classList.add('show');
  const w = eqTip.offsetWidth, h = eqTip.offsetHeight;
  eqTip.style.left = Math.max(8, Math.min(r.right + 12, innerWidth - w - 8)) + 'px';
  eqTip.style.top = Math.max(8, Math.min(r.top - 20, innerHeight - h - 8)) + 'px';
});

/* click: select a spot, or (GM editing) add / edit spots */
document.addEventListener('click', e => {
  if (S.tab !== 'equipement') return;
  const g = e.target.closest('.spot'), svg = e.target.closest('.plate svg');
  if (g) { e.stopPropagation(); if (EQ.edit) slotForm(slotById(g.dataset.spot)); else { EQ.sel = EQ.sel === g.dataset.spot ? null : g.dataset.spot; render(); } return; }
  if (svg && EQ.edit) {
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const w = p.matrixTransform(svg.getScreenCTM().inverse());
    slotForm(null, { view: svg.dataset.view, x: Math.round(w.x), y: Math.round(w.y) });
  }
}, true);

ACT.eqSel = d => { EQ.sel = d.id || null; };
ACT.slotEdit = () => { EQ.edit = !EQ.edit; EQ.sel = null; };
ACT.slotEditOpen = d => { slotForm(slotById(d.id)); return false; };
ACT.slotReset = () => { if (confirm('Revenir aux emplacements par défaut ? Les emplacements ajoutés seront supprimés.')) saveSlots([]); return false; };
ACT.slotDel = d => {
  const s = slotById(d.id); if (!s) return false;
  const n = INV.filter(o => o.slot === s.id).length;
  if (!confirm(`Supprimer l’emplacement « ${s.label} » ?${n ? ` ${n} objet(s) y sont équipés : ils resteront listés jusqu’à ce qu’on les retire.` : ''}`)) return false;
  closeModal(); saveSlots(eqSlots().filter(x => x.id !== s.id)); return false;
};

function slotForm(slot, at) {
  const s = slot || { id: '', label: '', type: '', cap: 1, ...at };
  const types = slotTypes();
  openModal(`<h3>${slot ? 'Modifier l’emplacement' : 'Nouvel emplacement'}</h3><form class="form" id="slotForm" data-id="${esc(s.id)}" data-view="${s.view || 'front'}" data-x="${s.x}" data-y="${s.y}">
    <label class="full">Nom<input class="field" name="label" value="${esc(s.label)}" placeholder="ex. Nombril, Cheville gauche…" required></label>
    <label>Type d’emplacement<input class="field" name="type" list="slotTypes" value="${esc(s.type)}" placeholder="ex. doigt, oreille, piercing…" required>
      <datalist id="slotTypes">${Object.entries(types).map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join('')}</datalist></label>
    <label>Objets équipables<input class="field" type="number" name="cap" min="1" max="20" value="${s.cap || 1}"></label>
    <p class="hint full" style="margin:0">Un objet s’équipe sur tous les emplacements de son type : une bague (type « doigt ») va sur n’importe quel doigt libre.</p>
    <div class="modal-acts full">${slot ? `<button type="button" class="btn danger" data-act="slotDel" data-id="${esc(s.id)}">${ic('trash', 12)}Supprimer</button><span class="grow"></span>` : ''}<button type="button" class="btn" data-act="closeModal">Annuler</button><button class="btn orange" type="submit">Enregistrer</button></div></form>`);
}
document.addEventListener('submit', e => {
  if (e.target.id !== 'slotForm') return;
  e.preventDefault(); e.stopImmediatePropagation();
  const f = e.target, fd = Object.fromEntries(new FormData(f));
  const type = String(fd.type).trim().toLowerCase().replace(/\s+/g, '_').slice(0, 64), cap = Math.max(1, Math.min(20, +fd.cap || 1));
  const list = eqSlots().map(x => ({ ...x }));
  if (f.dataset.id) Object.assign(list.find(x => x.id === f.dataset.id), { label: fd.label.trim(), type, cap });
  else list.push({ id: 's_' + uid(), label: fd.label.trim(), type, view: f.dataset.view, x: +f.dataset.x, y: +f.dataset.y, cap });
  closeModal(); saveSlots(list);
}, true);
async function saveSlots(list) {
  try {
    await admin('updateCampaign', { campaignId: ME.camp.$id, equipSlots: list });
    ME.camp.equipSlots = list.length ? JSON.stringify(list) : '';
    toast('Emplacements enregistrés');
  } catch (e) { toast('Enregistrement impossible : ' + errMsg(e)); }
  render();
}
