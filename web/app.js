/* app.js — the mockup application (sheet, inventory, skills, lore, map, dice, sounds), moved out of index.html
   so the Content-Security-Policy can forbid inline scripts. */
/* ================= helpers ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const P = {
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:'<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  grip:'<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
  star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  sound:'<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  mute:'<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
  map:'<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  d20:'<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 2l-5 9h10zM7 11l5 11 5-11M3 7l4 4M21 7l-4 4"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  layout:'<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>',
  ticket:'<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v12" stroke-dasharray="2 2"/>',
  gift:'<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8S10 3 7.5 4.5 9 8 12 8zm0 0s2-5 4.5-3.5S15 8 12 8z"/>',
  text:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', upload:'<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', move:'<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  pin:'<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  skull:'<path d="M12 3a7 7 0 0 0-7 7c0 2.5 1.2 4 2.5 5v3h9v-3c1.3-1 2.5-2.5 2.5-5a7 7 0 0 0-7-7z"/><circle cx="9.5" cy="10.5" r="1.5"/><circle cx="14.5" cy="10.5" r="1.5"/><path d="M10 18v3M14 18v3"/>',
  house:'<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
  door:'<path d="M6 21V4h12v17M3 21h18"/><circle cx="14.5" cy="12.5" r="1"/>',
  key:'<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/>',
  question:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  warning:'<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17h.01"/>',
  church:'<path d="M12 2v5M10 4h4M6 21v-9l6-5 6 5v9zM10 21v-4h4v4"/>',
  anchor:'<circle cx="12" cy="5" r="2"/><path d="M12 7v14M5 13a7 7 0 0 0 14 0M8 11h8"/>'
};
const ic = (n, s = 14) => `<svg class="i" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const POI_ICONS = ['pin','star','skull','house','door','eye','key','question','warning','book','church','anchor'];
const POI_COLORS = ['#e2672c','#d6a23c','#4f8d89','#86985a','#b8452f','#8d6b9a','#2f2922'];

/* ================= data (exemple de campagne) ================= */
const VIEWERS = { mj:{ who:'MJ', color:'#e2672c' }, owner:{ who:'Inès', color:'#4f8d89' }, other:{ who:'Hugo', color:'#8d6b9a' } };
const SEV = [{ n:'Aucune', c:'#3a3732' }, { n:'Légère', c:'#7f9a4e' }, { n:'Modérée', c:'#d4a935' }, { n:'Grave', c:'#dd7a2e' }, { n:'Critique', c:'#b8362a' }];
const WTYPES = ['Contusion','Coupure','Brûlure','Fracture','Perforation','Morsure','Infection','Engelure','Trouble psychique','Altération','Autre'];
const RARITY = { common:'Commun', uncommon:'Peu commun', rare:'Rare', epic:'Épique', legend:'Légendaire' };
const STATCOL = { FOR:'var(--st-for)', AGI:'var(--st-agi)', INT:'var(--st-int)', PER:'var(--st-per)', VOL:'var(--st-vol)', CHA:'var(--st-cha)' };
const ZONES = {
  crane:'Crâne', tete:'Tête', visage:'Visage', cou:'Cou', nuque:'Nuque',
  epaule_g:'Épaule gauche', epaule_d:'Épaule droite', bras_g:'Haut du bras gauche', bras_d:'Haut du bras droit',
  avbras_g:'Avant-bras gauche', avbras_d:'Avant-bras droit', main_g:'Main gauche', main_d:'Main droite',
  torse:'Torse', ventre:'Ventre', dos:'Dos', hanches:'Hanches', entrejambe:'Entrejambe', fessier:'Fessier',
  cuisse_g:'Cuisse gauche', cuisse_d:'Cuisse droite', jambe_g:'Jambe gauche', jambe_d:'Jambe droite', pied_g:'Pied gauche', pied_d:'Pied droit',
  cerveau:'Cerveau', coeur:'Cœur', poumon:'Poumons', foie:'Foie', estomac:'Estomac', intestin:'Intestins',
  vue:'Vue', gout:'Goût', ouie:'Ouïe', odorat:'Odorat'
};

const S = {
  viewer:'mj', tab:'fiche', layoutEdit:false, statEdit:false, flavorEdit:false, gaugeEdit:false, notesEdit:false,
  anatView:'corps', selZone:null, invMode:'owned', skMode:'owned', flipped:new Set(),
  loreSel:'archives', loreEdit:false, map:'city', addMode:null, mapEdit:false, openItem:null,
  view:{ x:0, y:0, k:1 }, sound:true, dockOpen:false,
  order:['identity','gauges','anatomy','stats','notes','journal','fid_spinner','fid_pads','fid_tama','fid_fader','flavor','fid_panel','fid_timer','fid_radar','fid_instr','fid_counter','fid_scope'],
  spans:{ identity:4, gauges:8, anatomy:7, stats:5, notes:5, journal:8, flavor:12,
    fid_spinner:4, fid_pads:4, fid_tama:5, fid_fader:3, fid_panel:7, fid_timer:4, fid_radar:5, fid_instr:6, fid_counter:4, fid_scope:8 },
  rows:{ anatomy:2 },
  tileVis:{ identity:'all', gauges:'all', anatomy:'all', stats:'all', notes:'owner', journal:'owner', flavor:'all' },
  journalEdit:false, imgPurpose:null, pcDraft:null,
  custom:{}
};
S.tpl = { order:S.order, spans:S.spans }; delete S.order; delete S.spans; S.pl = null; S.fidSound = {};
function L() {
  if (S.viewer === 'mj') return S.tpl;
  if (S.viewer === 'owner' && S.layoutEdit && !S.pl) S.pl = JSON.parse(JSON.stringify(S.tpl));
  if (S.pl) S.tpl.order.forEach(id => { if (!S.pl.order.includes(id) && !id.startsWith('fid_')) S.pl.order.push(id); if (!(id in S.pl.spans)) S.pl.spans[id] = S.tpl.spans[id]; });
  return S.pl || S.tpl;
}

const C = {
  player:'Léa',
  stats:[
    { id:uid(), name:'Force', abbr:'FOR', value:9, max:20, vis:'all' }, { id:uid(), name:'Agilité', abbr:'AGI', value:13, max:20, vis:'all' },
    { id:uid(), name:'Intellect', abbr:'INT', value:16, max:20, vis:'all' }, { id:uid(), name:'Perception', abbr:'PER', value:15, max:20, vis:'all' },
    { id:uid(), name:'Volonté', abbr:'VOL', value:11, max:20, vis:'owner' }, { id:uid(), name:'Charisme', abbr:'CHA', value:12, max:20, vis:'all' }
  ],
  gauges:[
    { id:'hp', label:'Santé', value:14, max:20, step:1, color:'#b8452f', hi:'#d9674e', vis:'all' },
    { id:'mind', label:'Santé mentale', value:9, max:15, step:1, color:'#4f8d89', hi:'#74b1ac', vis:'owner' },
    { id:'res', label:'Résonance', value:3, max:10, step:1, color:'#8d6b9a', hi:'#ad8cba', vis:'all' },
    { id:'money', label:'Argent', value:1240, step:10, unit:'€', counter:true, vis:'owner' }
  ],
  flavor:[
    { id:uid(), label:'Prénom', value:'Inès', vis:'all' }, { id:uid(), label:'Nom', value:'Marchetti', vis:'all' },
    { id:uid(), label:'Âge', value:'34 ans', vis:'all' }, { id:uid(), label:'Taille', value:'1,68 m', vis:'all' },
    { id:uid(), label:'Poids', value:'61 kg', vis:'owner' }, { id:uid(), label:'Origine', value:'Marseille, quartier du Panier', vis:'all' },
    { id:uid(), label:'Métier', value:'Ex-documentaliste, enquêtrice indépendante', vis:'all' },
    { id:uid(), label:'Allégeance', value:'Cellule Hélios (officieuse)', vis:'owner' },
    { id:uid(), label:'Secret', value:'Porte la marque du Veilleur sous l’omoplate gauche.', vis:'mj' },
    { id:uid(), label:'Biographie', value:'Licenciée des archives départementales après avoir « perdu » un registre paroissial de 1871, Inès vit de recherches généalogiques pour des clients pressés. Depuis l’incendie du quai, elle dort mal et note ses rêves dans un carnet relié de cuir. Elle ne croit pas au surnaturel. Elle croit aux documents, et les documents commencent à mentir.', vis:'all', wide:true }
  ],
  notes:'Doit 400 € à Malik (avant vendredi)\nNe pas retourner seule au quai des Brumes\nLe registre de 1871 est caché derrière le radiateur de son studio',
  portrait:{ type:'gen', cfg:{ face:2, hair:2, eyes:1, brows:1, nose:1, mouth:3, acc:0, hc:'#2f2922' } },
  journal:`## Séance 11
- Mme Aubrac ment sur 1871. **Vérifier le registre des entrées.**
- Malik connaît quelqu'un au port.

## Pistes
1. Clé USB : mot de passe de 12 caractères ?
2. Le carillon : *treize* coups, toujours la nuit.

> Ne pas parler du médaillon à Hugo.`,
  wounds:{
    avbras_g:{ sev:2, type:'Coupure', desc:'Entaille nette sur 8 cm, recousue à la va-vite.', mj:'Le verre était enduit. Infection au prochain repos long si non désinfectée.', vis:'all' },
    epaule_d:{ sev:1, type:'Contusion', desc:'Hématome après la chute dans l’escalier.', mj:'', vis:'all' },
    cuisse_g:{ sev:3, type:'Morsure', desc:'Morsure profonde, origine inconnue. Boite légèrement.', mj:'Ce n’était pas un chien. –2 en AGI tant que non soignée.', vis:'all' },
    foie:{ sev:2, type:'Altération', desc:'Douleur sourde au flanc droit.', mj:'Effet secondaire de l’encre noire. Évolue d’un cran par séance.', vis:'mj' },
    ouie:{ sev:1, type:'Trouble psychique', desc:'Entend parfois un carillon lointain.', mj:'Le carillon sonne quand le Veilleur regarde.', vis:'owner' },
    dos:{ sev:2, type:'Brûlure', desc:'Brûlure superficielle en forme de sceau sous l’omoplate.', mj:'C’est la marque.', vis:'owner' }
  }
};

const ART = {
  revolver:'<path d="M12 40h48l6-6h16v11h-9l-3 6H48l-6 27H28l5-27H12z"/><circle cx="51" cy="48" r="6"/><path d="M47 56q3 10 13 7"/>',
  medkit:'<rect x="18" y="32" width="64" height="44" rx="5"/><path d="M38 32v-8h24v8M50 44v22M39 55h22"/>',
  notebook:'<rect x="26" y="16" width="48" height="68" rx="3"/><path d="M35 16v68M44 32h22M44 42h22M44 52h15M60 16v17l5-4 5 4V16"/>',
  usb:'<rect x="36" y="30" width="28" height="48" rx="4"/><path d="M42 16h16v14H42zM46 21v4M54 21v4M44 62h12"/>',
  medallion:'<path d="M50 30V12M42 12h16"/><circle cx="50" cy="56" r="25"/><path d="M33 56q17-15 34 0-17 15-34 0z"/><circle cx="50" cy="56" r="4"/>',
  lighter:'<rect x="32" y="44" width="36" height="40" rx="4"/><path d="M32 57h36M36 44V33h18v11M59 30q-7-10 2-21 8 11 2 21z"/>',
  key:'<circle cx="32" cy="50" r="14"/><path d="M46 50h40M78 50v11M69 50v8"/><circle cx="32" cy="50" r="4"/>',
  photo:'<rect x="22" y="18" width="56" height="64" rx="3"/><rect x="28" y="24" width="44" height="40"/><path d="M28 58l12-14 10 10 8-8 14 12"/>'
};
const ITEMS = [
  { id:'i1', name:'Revolver .38 Spécial', type:'Arme', rarity:'uncommon', value:'650 €', art:'revolver', desc:'Six coups. Hérité d’un oncle douanier. Le barillet accroche un peu.', mj:'Numéro de série limé : volé à la gendarmerie en 1994.' },
  { id:'i2', name:'Trousse de secours', type:'Soin', rarity:'common', value:'45 €', art:'medkit', desc:'Compresses, sutures, antiseptique. Trois usages.', mj:'' },
  { id:'i3', name:'Carnet de rêves', type:'Document', rarity:'rare', value:'—', art:'notebook', desc:'Relié de cuir. Les pages du milieu sont écrites d’une main qui n’est pas la sienne.', mj:'Chaque nuit, une nouvelle page apparaît. Lire la page 41 coûte 1 Santé mentale.' },
  { id:'i4', name:'Clé USB chiffrée', type:'Indice', rarity:'uncommon', value:'—', art:'usb', desc:'Trouvée dans la veste du noyé. Mot de passe de 12 caractères.', mj:'Mot de passe : SAINTROCH1871' },
  { id:'i5', name:'Médaillon du Veilleur', type:'Artefact', rarity:'legend', value:'Inestimable', art:'medallion', desc:'Argent noirci, un œil gravé. Tiède au toucher, toujours.', mj:'Permet de voir à travers les murs 1 fois par séance. Le Veilleur voit aussi.' },
  { id:'i6', name:'Zippo gravé « M. »', type:'Objet', rarity:'common', value:'30 €', art:'lighter', desc:'Appartenait à Malik. Elle a oublié de le rendre.', mj:'' },
  { id:'i7', name:'Clé des archives', type:'Indice', rarity:'epic', value:'—', art:'key', desc:'Clé de laiton, étiquette « Sous-sol B ». Ne devrait plus exister.', mj:'Ouvre aussi la porte murée.' },
  { id:'i8', name:'Polaroïd brûlé', type:'Indice', rarity:'rare', value:'—', art:'photo', desc:'Le quai, de nuit. Une silhouette au bout de la jetée.', mj:'La silhouette est Inès, photographiée dans 3 semaines.' }
];
const INV = [
  { iid:uid(), def:'i1', hidden:false, vis:'all' }, { iid:uid(), def:'i2', hidden:false, vis:'all' }, { iid:uid(), def:'i3', hidden:true, vis:'all' },
  { iid:uid(), def:'i4', hidden:false, vis:'all' }, { iid:uid(), def:'i5', hidden:true, vis:'owner' }, { iid:uid(), def:'i6', hidden:false, vis:'all' }
];
const SKILLS = [
  { id:'k1', name:'Recherche documentaire', stat:'INT', level:5, desc:'Trouve l’information dans n’importe quel fonds d’archives, registre ou base de données, même mal indexé.', mj:'Accès automatique aux registres paroissiaux.' },
  { id:'k2', name:'Crochetage', stat:'AGI', level:2, desc:'Serrures simples et cadenas. Les serrures électroniques restent hors de portée.', mj:'' },
  { id:'k3', name:'Lecture des gens', stat:'PER', level:3, desc:'Repère un mensonge, une hésitation, un regard qui fuit.', mj:'Ne fonctionne pas sur les Marqués.' },
  { id:'k4', name:'Sang-froid', stat:'VOL', level:2, desc:'Garde ses moyens face à l’horreur. Réduit les pertes de santé mentale.', mj:'' },
  { id:'k5', name:'Bagout', stat:'CHA', level:3, desc:'Obtenir une faveur, entrer sans badge, faire parler un concierge.', mj:'' },
  { id:'k6', name:'Tir instinctif', stat:'AGI', level:1, desc:'Tir de réaction au revolver, à courte portée.', mj:'' },
  { id:'k7', name:'Langue morte : latin', stat:'INT', level:4, desc:'Lit et traduit le latin d’église, y compris les abréviations médiévales.', mj:'Les inscriptions du sous-sol ne sont pas en latin.' }
];
const SKOWN = [
  { iid:uid(), def:'k1', hidden:false, vis:'all' }, { iid:uid(), def:'k3', hidden:false, vis:'all' }, { iid:uid(), def:'k4', hidden:true, vis:'all' },
  { iid:uid(), def:'k5', hidden:false, vis:'all' }, { iid:uid(), def:'k7', hidden:false, vis:'all' }
];

const LORE = [
  { id:'archives', title:'Les Archives de Val-Sombre', vis:'all', md:`# Les Archives de Val-Sombre

Installées depuis 1903 dans l'ancien couvent des Ursulines, les **archives municipales** conservent quatre siècles d'état civil, de cadastres et de délibérations. Le bâtiment est ouvert au public du mardi au vendredi.

![Plan du sous-sol](asset:blueprint)

## Le sous-sol B

Officiellement, le sous-sol B a été condamné après l'inondation de 1955. Les plans de 1960 ne le mentionnent plus. Pourtant, le registre des entrées porte encore des signatures datées de *l'année dernière*.

> « On ne range pas ce qui doit être oublié. On le classe. »
> Note manuscrite, carton 1871-B

## Ce que l'on sait

- La conservatrice, **Mme Aubrac**, refuse toute demande concernant 1871.
- Le registre paroissial de Saint-Roch y a été versé en 1922.
- Une porte murée figure sur le relevé des pompiers de 2019.
` },
  { id:'eglise', title:'Église Saint-Roch', vis:'all', md:`# Église Saint-Roch

Église néo-gothique au sommet de la butte, désacralisée en 1978. Son **carillon** est réputé ne plus fonctionner depuis la tempête de 1999.

## Rumeurs

Les riverains affirment l'entendre certaines nuits, toujours *treize coups*. La mairie a fait retirer le battant en 2003. Les nuits de carillon continuent.
` },
  { id:'quai', title:'Le Quai des Brumes', vis:'all', md:`# Le Quai des Brumes

Ancienne zone portuaire au bord du Lez-Noir. Entrepôts désaffectés, un bar ouvert trop tard, et la jetée où l'on a repêché **Dimitri Sorel** le 3 octobre.

![Le quartier sur le plan de 1843](asset:city)

L'incendie de l'entrepôt 7 a eu lieu la même nuit. Aucun lien officiel n'a été établi.
` },
  { id:'marque', title:'La Marque du Veilleur', vis:'mj', md:`# La Marque du Veilleur

*Article réservé au MJ.*

Le Veilleur marque ceux qui ont lu le registre de 1871. La marque apparaît comme une brûlure superficielle, puis s'étend d'un cran à chaque séance où le porteur utilise le médaillon.

## Effets

- Le porteur entend le carillon de Saint-Roch.
- Le Veilleur perçoit tout ce que le porteur voit à travers le médaillon.
- Au cinquième cran, le porteur ne peut plus quitter Val-Sombre.
` }
];

function blueprint() {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1100; const g = c.getContext('2d');
  g.fillStyle = '#21405c'; g.fillRect(0, 0, 1600, 1100);
  g.strokeStyle = 'rgba(220,235,245,.08)'; g.lineWidth = 1;
  for (let x = 0; x < 1600; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1100); g.stroke(); }
  for (let y = 0; y < 1100; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(1600, y); g.stroke(); }
  g.strokeStyle = '#e6eef2'; g.lineWidth = 6; g.font = '500 22px "IBM Plex Mono", monospace'; g.fillStyle = '#e6eef2';
  const rooms = [[120,120,560,460,'REGISTRES'],[720,120,340,280,'RÉSERVE 1871'],[1100,120,380,460,'CHAUFFERIE'],[720,440,340,140,'COULOIR'],[120,640,840,340,'INONDATION 1955'],[1000,640,480,340,'ZONE CONDAMNÉE']];
  rooms.forEach(([x,y,w,h,n]) => { g.strokeRect(x, y, w, h); g.fillText(n, x + 18, y + 38); });
  g.lineWidth = 2; for (let i = 0; i < 7; i++) g.strokeRect(170 + i * 70, 200, 34, 320);
  g.save(); g.strokeStyle = '#e6eef2'; g.setLineDash([10, 8]); g.lineWidth = 3; for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(1000 + i * 36, 640); g.lineTo(1000 + i * 36 + 120, 980); g.stroke(); } g.restore();
  g.fillStyle = '#d9674e'; g.fillRect(1190, 790, 80, 14);
  g.font = '400 18px "IBM Plex Mono", monospace'; g.fillStyle = 'rgba(230,238,242,.7)';
  g.fillText('ARCHIVES MUNICIPALES · SOUS-SOL B · RELEVÉ 1960 · ÉCH. 1/100', 120, 1060);
  return c.toDataURL('image/png');
}

const MAPS = {
  city:{ name:'Région de Val-Sombre', parent:null, img:'assets/map-city.jpg', w:1600, h:1265,
    credit:'Image d’exemple : carte lithographiée de Woerl & Herder (vers 1843), domaine public, via Wikimedia Commons. Remplace-la par ta propre image avec « Importer une image ».',
    pois:[
      { id:uid(), x:560, y:520, label:'Archives municipales', icon:'door', color:'#4f8d89', link:'map:archives', vis:'all', desc:'Ancien couvent des Ursulines.' },
      { id:uid(), x:930, y:420, label:'Église Saint-Roch', icon:'church', color:'#e2672c', link:'lore:eglise', vis:'all', desc:'Le carillon sonne treize coups.' },
      { id:uid(), x:1120, y:800, label:'Quai des Brumes', icon:'anchor', color:'#e2672c', link:'lore:quai', vis:'all', desc:'Là où l’on a repêché Sorel.' },
      { id:uid(), x:700, y:900, label:'Planque d’Inès', icon:'house', color:'#86985a', link:'', vis:'owner', desc:'Studio au 4e, sans ascenseur.' },
      { id:uid(), x:1300, y:300, label:'Entrepôt 7', icon:'skull', color:'#b8452f', link:'lore:marque', vis:'mj', desc:'Incendié la nuit du 3 octobre.' }
    ],
    texts:[
      { id:uid(), x:800, y:150, text:'Val-Sombre', size:54, color:'#2f2922', rot:0, vis:'all' },
      { id:uid(), x:880, y:740, text:'Lez-Noir', size:26, color:'#21405c', rot:-6, vis:'all' }
    ]},
  archives:{ name:'Archives · sous-sol B', parent:'city', img:null, w:1600, h:1100, credit:'Relevé dessiné pour la campagne.',
    pois:[
      { id:uid(), x:400, y:350, label:'Salle des registres', icon:'book', color:'#d6a23c', link:'lore:archives', vis:'all', desc:'Rayonnages 1800-1950.' },
      { id:uid(), x:1230, y:760, label:'Porte murée', icon:'warning', color:'#b8452f', link:'lore:marque', vis:'mj', desc:'Briques plus récentes que le mur.' }
    ], texts:[ { id:uid(), x:890, y:270, text:'Accès interdit', size:30, color:'#f0d9b5', rot:0, vis:'all' } ] }
};
const ASSETS = { blueprint:'', city:'assets/map-city.jpg' };
const INVITES = [ { token:'tn_7QmK2xV9pL', used:'Léa (Inès)' }, { token:'tn_c4RbW8nZ1s', used:'Tom (Hugo)' } ];
const LOG = [
  { who:'MJ', color:'#e2672c', detail:'1d100[37]', total:37, time:'21:42' },
  { who:'Hugo', color:'#8d6b9a', detail:'2d6[4,6] + 3', total:13, time:'21:40' },
  { who:'Inès', color:'#4f8d89', detail:'1d20[18] + 2', total:20, time:'21:37' }
];

/* ================= visibility ================= */
const isMJ = () => S.viewer === 'mj';
const canSee = vis => S.viewer === 'mj' || (S.viewer === 'owner' ? vis !== 'mj' : vis === 'all');
const VISLBL = { all:'Tous', owner:'MJ + joueur', mj:'MJ seul' };
const VISNEXT = { all:'owner', owner:'mj', mj:'all' };
function visBadge(kind, id, vis) {
  if (isMJ()) return `<button class="vis vis-${vis}" data-act="cycleVis" data-kind="${kind}" data-id="${esc(id)}" title="Visible par : ${VISLBL[vis]}. Cliquer pour changer.">${ic(vis==='mj'?'lock':'eye',11)}${VISLBL[vis]}</button>`;
  if (S.viewer === 'owner' && vis !== 'all') return `<span class="vis vis-static vis-${vis}" title="Visible par toi et le MJ">${ic('eyeOff',11)}Privé</span>`;
  return '';
}
const allMapItems = () => Object.values(MAPS).flatMap(m => [...m.pois, ...m.texts]);
function refObj(kind, id) {
  switch (kind) {
    case 'stat': return C.stats.find(s => s.id === id);
    case 'flavor': return C.flavor.find(s => s.id === id);
    case 'gauge': return C.gauges.find(s => s.id === id);
    case 'wound': return C.wounds[id];
    case 'inv': return INV.find(s => s.iid === id);
    case 'skown': return SKOWN.find(s => s.iid === id);
    case 'lore': return LORE.find(s => s.id === id);
    case 'poi': case 'mtext': return allMapItems().find(p => p.id === id);
    case 'tile': return { get vis(){ return S.tileVis[id] || 'all'; }, set vis(v){ S.tileVis[id] = v; } };
  }
}

/* ================= header ================= */
const TABS = [['fiche','Fiche'],['inventaire','Inventaire'],['competences','Compétences'],['lore','Lore'],['carte','Carte']];
function renderHeader() {
  $('#tabs').innerHTML = TABS.map(([k,l]) => `<button data-act="tab" data-tab="${k}" aria-pressed="${S.tab===k}"><span class="dot"></span>${l}</button>`).join('');
  $('#viewerSeg').innerHTML = [['mj','MJ'],['owner','Inès · joueuse'],['other','Hugo · autre joueur']].map(([k,l]) => `<button data-act="viewer" data-v="${k}" aria-pressed="${S.viewer===k}"><span class="dot"></span>${l}</button>`).join('');
  $('#adminSlot').innerHTML = isMJ() ? `<button class="btn" data-act="invites">${ic('ticket')}Invitations</button>` : '';
}

/* ================= split-flap ================= */
function flapHtml(str, cls = '') { return [...String(str)].map(ch => `<span class="flap ${cls}">${esc(ch)}</span>`).join(''); }
function setFlaps(el, str, minLen = 3) {
  const s = String(str).padStart(minLen, ' ');
  let cells = $$('.flap', el);
  if (cells.length !== s.length) { el.innerHTML = flapHtml(s); return; }
  [...s].forEach((ch, i) => { if (cells[i].textContent !== ch) { cells[i].textContent = ch; cells[i].classList.remove('flip'); void cells[i].offsetWidth; cells[i].classList.add('flip'); } });
}

/* ================= fiche ================= */
const PORTRAIT = `<svg viewBox="0 0 100 124" width="100" height="124" fill="none" stroke="#2f2922" stroke-width="1.4" stroke-linecap="round"><path d="M50 18c-13 0-21 10-21 24 0 9 3 17 8 22l-2 10M50 18c13 0 21 10 21 24 0 9-3 17-8 22l2 10"/><path d="M29 40c4-12 14-16 24-14 9 2 16 8 18 16M31 44c-4 10-3 22 2 30M69 44c4 10 3 22-2 30"/><path d="M35 74l-17 9c-6 4-9 10-10 20M65 74l17 9c6 4 9 10 10 20M35 74l15 18 15-18M43 84l7 32M57 84l-7 32"/><path d="M44 58q6 3 12 0M40 45q2-2 4 0M56 45q2-2 4 0"/></svg>`;
/* ---- portrait creator ---- */
const HAIRC = ['#2f2922','#6b4a2b','#a5702b','#d6c08a','#8e8e86','#b8452f'];
const DEFAULT_PT = { face:2, hair:2, eyes:1, brows:1, nose:1, mouth:3, acc:0, hc:'#2f2922' };
const PT = {
  face:{ lbl:'Visage', opts:[['Ovale','M50 22c-14 0-22 11-22 25 0 16 9 30 22 30s22-14 22-30c0-14-8-25-22-25z'],['Carré','M30 34c0-8 8-13 20-13s20 5 20 13v20c0 14-8 24-20 24S30 68 30 54z'],['Fin','M50 22c-13 0-20 10-20 23 0 14 8 25 20 35 12-10 20-21 20-35 0-13-7-23-20-23z']] },
  hair:{ lbl:'Coiffure', opts:[['Rasé',''],['Court','M28 44c0-16 10-24 22-24s22 8 22 24c-4-7-10-11-22-11s-18 4-22 11z'],['Carré','M27 50c-2-20 9-31 23-31s25 11 23 31l-1 14c-2-12-4-20-6-26-6 4-26 4-32 0-2 6-4 14-6 26z'],['Long','M26 48c0-19 10-29 24-29s24 10 24 29v40c-3-3-5-8-6-14l-2-30c-8 4-24 4-32 0l-2 30c-1 6-3 11-6 14z'],['Chignon','M28 44c0-16 10-24 22-24s22 8 22 24c-4-7-10-11-22-11s-18 4-22 11zM50 6a8 8 0 1 0 .1 0z'],['Mèche','M28 46c-1-17 9-27 22-27 14 0 23 9 22 22-10-2-20-8-26-14-3 8-10 15-18 19z']] },
  eyes:{ lbl:'Yeux', opts:[['Ronds','<circle cx="42" cy="48" r="2.3" fill="#2f2922"/><circle cx="58" cy="48" r="2.3" fill="#2f2922"/>'],['Amande','<path d="M37 48q5-4 10 0q-5 3-10 0zM53 48q5-4 10 0q-5 3-10 0z"/><circle cx="42" cy="48" r="1.4" fill="#2f2922"/><circle cx="58" cy="48" r="1.4" fill="#2f2922"/>'],['Cernés','<circle cx="42" cy="48" r="2" fill="#2f2922"/><circle cx="58" cy="48" r="2" fill="#2f2922"/><path d="M38 52q4 2 8 0M54 52q4 2 8 0" stroke-width="1"/>'],['Plissés','<path d="M37 48q5 3 10 0M53 48q5 3 10 0"/>']] },
  brows:{ lbl:'Sourcils', opts:[['Droits','M37 42h10M53 42h10'],['Arqués','M37 43q5-4 10-1M53 42q5-3 10 1'],['Froncés','M37 41l10 3M63 41l-10 3']] },
  nose:{ lbl:'Nez', opts:[['Droit','M50 50v9l-3 2'],['Arrondi','M50 49q-1 8-4 11q4 2 8 0'],['Large','M49 50l-2 10h6']] },
  mouth:{ lbl:'Bouche', opts:[['Neutre','M44 67h12'],['Sourire','M43 66q7 5 14 0'],['Moue','M44 68q6-3 12 0'],['Pincée','M46 67h8M46 67q4 1 8 0']] },
  acc:{ lbl:'Détail', opts:[['Aucun',''],['Lunettes','M36 48a6 5 0 1 0 12 0a6 5 0 1 0-12 0M52 48a6 5 0 1 0 12 0a6 5 0 1 0-12 0M48 48h4'],['Cicatrice','M60 52l6 10M61 55l3-1M63 58l3-1'],['Barbe','M31 56c2 16 9 24 19 24s17-8 19-24c-4 6-9 9-19 9s-15-3-19-9z'],['Boucles d’oreilles','']] }
};
function portraitSvg(c) {
  const o = k => PT[k].opts[c[k]][1], hf = `fill="${c.hc}" fill-opacity=".88"`;
  return `<svg viewBox="0 0 100 124" width="100" height="124" fill="none" stroke="#2f2922" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Portrait">
    <path d="M42 76v8l-22 9c-7 3-10 10-11 22M58 76v8l22 9c7 3 10 10 11 22M42 86q8 6 16 0"/><path d="M28 46q-5 5 0 11M72 46q5 5 0 11"/>
    <path d="${o('face')}" fill="#efe7d5"/>${c.acc === 3 ? `<path d="${o('acc')}" ${hf}/>` : ''}
    ${o('hair') ? `<path d="${o('hair')}" ${hf}/>` : '<path d="M32 36q18-14 36 0" stroke-dasharray="2 2"/>'}
    <path d="${o('brows')}" stroke-width="1.8"/>${o('eyes')}<path d="${o('nose')}"/><path d="${o('mouth')}"/>
    ${c.acc === 1 || c.acc === 2 ? `<path d="${o('acc')}"/>` : ''}${c.acc === 4 ? '<circle cx="28" cy="58" r="2.2" fill="#d6a23c"/><circle cx="72" cy="58" r="2.2" fill="#d6a23c"/>' : ''}</svg>`;
}
function readImage(file, max, cb) {
  const r = new FileReader();
  r.onload = () => { const img = new Image(); img.onload = () => {
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    cb(cv.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', .86));
  }; img.src = r.result; };
  r.readAsDataURL(file);
}

function tile(id, title, inner, actions = '', opts = {}) {
  const span = L().spans[id] || 6, rows = S.rows[id] || 1, vis = S.tileVis[id];
  return `<section class="tile ${S.layoutEdit ? 'editing' : ''} ${opts.cls || ''}" data-tile="${id}" style="--span:${span};--rows:${rows}" ${S.layoutEdit ? 'draggable="true"' : ''}>
    <header class="tile-head"><span class="led" ${opts.led ? `style="background:radial-gradient(circle at 35% 30%,#fff3,${opts.led} 60%)"` : ''}></span><h3 class="tile-title">${title}</h3><span class="grow"></span>
    ${vis ? visBadge('tile', id, vis) : ''}${S.layoutEdit ? `<button class="btn xs" data-act="span" data-id="${id}" title="Largeur de la tuile">↔ ${span}/12</button>${opts.removable ? `<button class="iconbtn" data-act="rmTile" data-id="${id}" aria-label="Supprimer la tuile">${ic('trash',13)}</button>` : ''}<span class="grip">${ic('grip',16)}</span>` : actions}</header>
    <div class="tile-body">${inner}</div></section>`;
}
const flv = label => (C.flavor.find(f => f.label === label) || {}).value || '';
function tIdentity() {
  return tile('identity', 'Identité', `<div class="ident"><div><div class="portrait well">${portraitHtml()}</div>${S.viewer !== 'other' ? `<div class="pt-acts"><button class="btn xs" data-act="portraitCreate">${ic('edit',12)}Créer</button><button class="btn xs" data-act="portraitImport" aria-label="Importer une image de portrait" title="Importer une image">${ic('upload',12)}</button></div>` : ''}</div><div style="min-width:0">
    <div class="ident-name">${esc(flv('Prénom'))}<br>${esc(flv('Nom'))}</div>
    <div class="ident-sub">${esc(flv('Métier').split(',')[0] || 'Personnage')}</div>
    <div class="chips"><span class="chip">Joueuse : ${esc(C.player)}</span><span class="chip">${esc(flv('Âge'))}</span>${canSee('owner') ? `<span class="chip">Cellule Hélios</span>` : ''}</div></div></div>`);
}
function gaugeRow(g) {
  const mj = isMJ(), canStep = S.viewer !== 'other', st = g.step || 1;
  const chip = mj && !g.custom ? `<button class="stepchip" data-act="cycleStep" data-id="${g.id}" title="Pas des boutons ± — cliquer pour changer">pas ${st}</button>` : '';
  if (g.counter) {
    const digits = String(g.value).padStart(5, '0');
    return `<div class="grow-g well"><div class="g-label">${esc(g.label)}<br>${visBadge('gauge', g.id, g.vis)}</div>
      <div class="hbar"><span class="odo">${flapHtml(digits)}<span class="flap unit">${esc(g.unit)}</span></span></div>
      <div class="g-ctrl" style="align-items:center">${chip}${canStep ? `<button class="btn xs" data-act="gstep" data-id="${g.id}" data-d="-1">−${st}</button><button class="btn xs" data-act="gstep" data-id="${g.id}" data-d="1">+${st}</button>` : ''}${mj ? `<input class="numin" type="number" data-bind="gauge:${g.id}:value" value="${g.value}" aria-label="Valeur ${esc(g.label)}" style="width:76px">` : ''}</div></div>`;
  }
  const segs = Math.min(g.max, 30), lit = g.max ? Math.round(g.value / g.max * segs) : 0;
  const ticks = [0, Math.round(g.max / 2), g.max];
  return `<div class="grow-g well" style="--g:${g.color};--gh:${g.hi || g.color}"><div class="g-label">${esc(g.label)}<br>${visBadge('gauge', g.id, g.vis)}</div>
    <div class="hbar"><div class="hseg">${Array.from({length:segs}, (_,i) => `<i class="${i < lit ? 'lit' : ''}"></i>`).join('')}</div><div class="ticks">${ticks.map(t => `<span>${t}</span>`).join('')}</div></div>
    <div class="g-ctrl" style="align-items:center">${chip}${canStep ? `<button class="iconbtn" data-act="gstep" data-id="${g.id}" data-d="-1" aria-label="Diminuer ${esc(g.label)} de ${st}">${ic('minus',13)}</button>` : ''}
      <div class="g-read">${mj ? `<input class="numin" type="number" min="0" data-bind="gauge:${g.id}:value" value="${g.value}" aria-label="Valeur ${esc(g.label)}"><span class="sep">/</span><input class="numin max" type="number" min="1" data-bind="gauge:${g.id}:max" value="${g.max}" aria-label="Maximum ${esc(g.label)}" title="Maximum, modifiable directement">` : `<span class="num">${g.value}</span><span class="sep">/</span><span>${g.max}</span>`}</div>
      ${canStep ? `<button class="iconbtn" data-act="gstep" data-id="${g.id}" data-d="1" aria-label="Augmenter ${esc(g.label)}">${ic('plus',13)}</button>` : ''}</div></div>`;
}
function tGauges() {
  if (S.gaugeEdit && isMJ()) {
    return tile('gauges', 'Jauges principales', `<div class="edit-list">${C.gauges.map(g => `<div class="edit-row">
      <input class="field w-name" data-bind="gauge:${g.id}:label" value="${esc(g.label)}" aria-label="Nom de la jauge">
      ${g.counter ? `<input class="field w-abbr" data-bind="gauge:${g.id}:unit" value="${esc(g.unit)}" aria-label="Unité">` : `<select class="field" data-bind="gauge:${g.id}:color" aria-label="Couleur">${[['#b8452f','Rouille'],['#4f8d89','Sarcelle'],['#8d6b9a','Prune'],['#d6a23c','Moutarde'],['#86985a','Olive'],['#e2672c','Orange']].map(([c,n]) => `<option value="${c}" ${c===g.color?'selected':''}>${n}</option>`).join('')}</select>`}
      <input class="field w-num" type="number" min="1" data-bind="gauge:${g.id}:step" value="${g.step || 1}" aria-label="Pas" title="Pas des boutons ±">
      ${visBadge('gauge', g.id, g.vis)}<button class="iconbtn" data-act="rmGauge" data-id="${g.id}" aria-label="Supprimer">${ic('trash',13)}</button></div>`).join('')}
      <div class="edit-row"><button class="btn xs" data-act="addGauge">${ic('plus',12)}Jauge</button><button class="btn xs" data-act="addCounter">${ic('plus',12)}Compteur</button><span class="grow"></span><button class="btn xs orange" data-act="gaugeEdit">Terminé</button></div></div>`);
  }
  return tile('gauges', 'Jauges principales', `<div class="gauges">${C.gauges.filter(g => canSee(g.vis)).map(gaugeRow).join('')}</div>`,
    isMJ() ? `<button class="btn xs" data-act="gaugeEdit">${ic('edit',12)}Éditer</button>` : '');
}
function dialSvg(v, max, col) {
  const r = 29, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, v / max)) * .75;
  const ticks = Array.from({length:11}, (_, i) => { const a = (135 + i * 27) * Math.PI / 180; return `<line x1="${37 + Math.cos(a) * 33}" y1="${37 + Math.sin(a) * 33}" x2="${37 + Math.cos(a) * 36}" y2="${37 + Math.sin(a) * 36}" stroke="#5a554c" stroke-width="1"/>`; }).join('');
  return `<svg viewBox="0 0 74 74">${ticks}<circle cx="37" cy="37" r="${r}" fill="none" stroke="#12110e" stroke-width="6" stroke-dasharray="${c*.75} ${c}" transform="rotate(135 37 37)"/>
    <circle cx="37" cy="37" r="${r}" fill="none" stroke="${col}" stroke-width="4" stroke-dasharray="${c*f} ${c}" transform="rotate(135 37 37)"/>
    <circle cx="37" cy="37" r="20" fill="url(#knob)" stroke="#0e0d0b"/><text class="num" x="37" y="44" text-anchor="middle">${v}</text></svg>`;
}
function tStats() {
  if (S.statEdit && !isMJ() && S.viewer === 'owner') {
    return tile('stats', 'Statistiques', `<div class="edit-list">${C.stats.filter(s => canSee(s.vis)).map(s => `<div class="edit-row">
      <span class="w-name" style="flex:1">${esc(s.name)}</span>
      <input class="field w-num" type="number" min="0" max="${s.max}" data-bind="stat:${s.id}:value" value="${s.value}" aria-label="Valeur ${esc(s.name)}"><span class="hint">/ ${s.max}</span></div>`).join('')}
      <div class="edit-row"><span class="grow"></span><button class="btn xs orange" data-act="statEdit">Terminé</button></div></div>`);
  }
  if (S.statEdit && isMJ()) {
    return tile('stats', 'Statistiques', `<div class="edit-list">${C.stats.map(s => `<div class="edit-row">
      <input class="field w-name" data-bind="stat:${s.id}:name" value="${esc(s.name)}" aria-label="Nom">
      <input class="field w-abbr" data-bind="stat:${s.id}:abbr" value="${esc(s.abbr)}" aria-label="Abréviation" maxlength="4">
      <input class="field w-num" type="number" data-bind="stat:${s.id}:value" value="${s.value}" aria-label="Valeur">
      <input class="field w-num" type="number" data-bind="stat:${s.id}:max" value="${s.max}" aria-label="Maximum">
      <input class="field" style="width:130px" data-bind="stat:${s.id}:roll" value="${esc(s.roll || '')}" placeholder="Jet (facultatif)" title="Formule du jet au clic, ex. 1d20+{mod} ou (2d6+AGI)*FOR. Vide : formule de la campagne." aria-label="Formule de jet" spellcheck="false">
      ${visBadge('stat', s.id, s.vis)}<button class="iconbtn" data-act="rmStat" data-id="${s.id}" aria-label="Supprimer ${esc(s.name)}">${ic('trash',13)}</button></div>`).join('')}
      <div class="edit-row"><button class="btn xs" data-act="addStat">${ic('plus',12)}Statistique</button><span class="grow"></span><button class="btn xs orange" data-act="statEdit">Terminé</button></div></div>`);
  }
  return tile('stats', 'Statistiques', `<div class="stats">${C.stats.filter(s => canSee(s.vis)).map(s => `<div class="dial well">${dialSvg(s.value, s.max, STATCOL[s.abbr] || 'var(--mustard)')}<div class="dial-name">${esc(s.name)}</div>${s.vis !== 'all' ? visBadge('stat', s.id, s.vis) : ''}</div>`).join('')}</div>`,
    isMJ() || S.viewer === 'owner' ? `<button class="btn xs" data-act="statEdit">${ic('edit',12)}Éditer</button>` : '');
}

/* ---- anatomy plates (coordinates in each image's pixel space) ---- */
const M = s => s.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (m, x, y) => `${(426 - +x).toFixed(0)},${y}`);
const LIMB = {
  epaule:'M110,150 Q126,130 156,138 L158,180 Q128,186 110,176 Z',
  bras:'M106,178 L152,184 L140,298 L98,292 Z',
  avbras:'M98,295 L140,301 L80,428 L46,416 Z',
  main:'M46,416 L80,430 L74,470 L46,505 L10,496 L0,455 Z',
  cuisse:'M134,452 L214,462 L210,642 L160,642 Q136,560 134,452 Z',
  jambe:'M160,645 L210,645 L205,822 L172,822 Z',
  pied:'M170,824 L207,824 L212,887 L163,887 Z'
};
function bodyZones(view) {
  const vl = view === 'front' ? '_d' : '_g', vr = view === 'front' ? '_g' : '_d';
  const z = [];
  for (const [k, d] of Object.entries(LIMB)) { z.push([k + vl, `<path d="${d}"/>`]); z.push([k + vr, `<path d="${M(d)}"/>`]); }
  z.push(['crane', '<path d="M173,46 Q171,2 213,0 Q255,2 253,46 Z"/>']);
  z.push([view === 'front' ? 'visage' : 'tete', '<path d="M175,48 L251,48 Q251,88 233,102 Q213,114 193,102 Q175,88 175,48 Z"/>']);
  z.push([view === 'front' ? 'cou' : 'nuque', '<path d="M189,104 L237,104 L245,142 L181,142 Z"/>']);
  z.push(['hanches', '<path d="M133,398 L293,398 Q303,428 299,452 L127,452 Q123,428 133,398 Z"/>']);
  if (view === 'front') {
    z.push(['torse', '<path d="M155,144 L271,144 Q291,200 287,284 L139,284 Q135,200 155,144 Z"/>']);
    z.push(['ventre', '<path d="M139,287 L287,287 Q291,340 293,396 L133,396 Q135,340 139,287 Z"/>']);
    z.push(['entrejambe', '<path d="M192,448 L234,448 L213,488 Z"/>']);
  } else {
    z.push(['dos', '<path d="M155,144 L271,144 Q291,200 287,284 Q291,340 293,396 L133,396 Q135,340 139,284 Q135,200 155,144 Z"/>']);
    z.push(['fessier', '<path d="M135,420 Q129,486 207,478 L211,422 Z M291,420 Q297,486 219,478 L215,422 Z"/>']);
  }
  return z;
}
const ORGAN_Z = [
  ['poumon', '<ellipse cx="140" cy="175" rx="60" ry="105"/><ellipse cx="305" cy="180" rx="58" ry="105"/>'],
  ['coeur', '<ellipse cx="228" cy="240" rx="38" ry="40"/>'],
  ['foie', '<ellipse cx="158" cy="330" rx="72" ry="30"/>'],
  ['estomac', '<ellipse cx="300" cy="325" rx="55" ry="28"/>'],
  ['intestin', '<ellipse cx="225" cy="455" rx="112" ry="95"/>']
];
const SKULL_Z = [
  ['cerveau', '<path d="M118,108 Q150,45 230,14 Q330,0 420,50 Q482,110 476,190 Q470,240 448,252 L330,246 Q230,240 160,182 Q120,150 118,108 Z"/>'],
  ['vue', '<circle cx="80" cy="210" r="34"/>'],
  ['odorat', '<ellipse cx="45" cy="268" rx="24" ry="28"/>'],
  ['gout', '<ellipse cx="88" cy="345" rx="58" ry="28"/>'],
  ['ouie', '<circle cx="292" cy="300" r="26"/>']
];
function woundOf(z) { const w = C.wounds[z]; return w && canSee(w.vis) ? w : null; }
function sevOf(z) { const w = woundOf(z); return w ? w.sev : 0; }
const zg = ([z, s]) => `<g class="z sev-${sevOf(z)} ${S.selZone===z?'sel':''}" data-z="${z}" tabindex="0" role="button" aria-label="${ZONES[z]}">${s}</g>`;
function plate(img, w, h, zones, cap) {
  return `<div class="plate"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${cap}"><image href="${img}" width="${w}" height="${h}" preserveAspectRatio="none"/>${zones.map(zg).join('')}</svg><div class="plate-cap">${cap}</div></div>`;
}
function platesHtml() {
  if (S.anatView === 'organes') return `<div class="plates">${plate('assets/organs.png', 461, 640, ORGAN_Z, 'Viscères · vue antérieure')}</div>`;
  if (S.anatView === 'crane') return `<div class="plates">${plate('assets/skull.png', 500, 463, SKULL_Z, 'Crâne · profil gauche · cerveau et sens')}</div>`;
  return `<div class="plates corps">${plate('assets/body-front.png', 420, 890, bodyZones('front'), 'Face antérieure')}${plate('assets/body-back.png', 420, 890, bodyZones('back'), 'Face postérieure')}</div>`;
}
function woundList() {
  const ws = Object.entries(C.wounds).filter(([z, w]) => w.sev > 0 && canSee(w.vis)).sort((a, b) => b[1].sev - a[1].sev);
  if (!ws.length) return `<p class="hint">Aucune blessure visible.</p>`;
  return `<ul class="wlist">${ws.map(([z, w]) => `<li data-act="selZone" data-z="${z}"><span class="pip sev-${w.sev}"></span><div><b>${ZONES[z]}</b> ${w.vis!=='all'?`<span class="vis vis-static vis-${w.vis}" style="padding:2px 5px">${VISLBL[w.vis]}</span>`:''}<small>${esc(w.type)} · ${SEV[w.sev].n}</small></div></li>`).join('')}</ul>`;
}
function woundEditor() {
  const z = S.selZone, w = C.wounds[z] || { sev:0, type:'Contusion', desc:'', mj:'', vis:'all' };
  return `<div class="side well"><div style="display:flex;align-items:center;gap:6px"><h4>${ZONES[z]}</h4><span class="grow"></span><button class="iconbtn" data-act="selZone" data-z="" aria-label="Fermer">${ic('x',13)}</button></div>
    <div class="lab">Gravité</div><div class="sevpick">${SEV.map((s, i) => `<button style="--c:${s.c}" data-act="setSev" data-sev="${i}" aria-pressed="${w.sev===i}" title="${s.n}" aria-label="${s.n}"></button>`).join('')}</div>
    <div class="lab">Type</div><select class="field" data-bind="wound:${z}:type">${WTYPES.map(t => `<option ${t===w.type?'selected':''}>${t}</option>`).join('')}</select>
    <div class="lab">Description (visible)</div><textarea class="field" data-bind="wound:${z}:desc" rows="3">${esc(w.desc)}</textarea>
    <div class="lab" style="color:var(--rust)">Note MJ</div><textarea class="field" data-bind="wound:${z}:mj" rows="2">${esc(w.mj)}</textarea>
    <div class="lab">Visible par</div><select class="field" data-bind="wound:${z}:vis">${Object.entries(VISLBL).map(([k, l]) => `<option value="${k}" ${k===w.vis?'selected':''}>${l}</option>`).join('')}</select>
    <button class="btn xs" data-act="setSev" data-sev="0">Soigner complètement</button></div>`;
}
function sensesHtml() { return ['vue','gout','ouie','odorat'].map(z => `<button class="sense sev-${sevOf(z)} ${S.selZone===z?'sel':''}" data-z="${z}"><span class="pip"></span>${ZONES[z]}</button>`).join(''); }
function tAnatomy() {
  const side = S.selZone && isMJ() ? woundEditor() : `<div class="side well"><h4>Blessures actives</h4>${woundList()}<p class="hint">${isMJ() ? 'Clique une zone pour la modifier.' : 'Survole une zone pour le détail.'}</p></div>`;
  return tile('anatomy', 'État physique', `<div class="anat"><div>
      <div class="sheet"><div class="sheet-head"><b>Fiche d’examen</b><span>Sujet : ${esc(flv('Prénom'))} ${esc(flv('Nom'))} · N° 0412</span></div><div id="plates">${platesHtml()}</div></div>
      <div class="senses" id="senses">${sensesHtml()}</div>
      <div class="legend">${SEV.map((s, i) => `<span><span class="pip sev-${i}"></span>${s.n}</span>`).join('')}</div></div>
    <div>${side}</div></div>`,
    `<div class="seg">${[['corps','Corps'],['organes','Organes'],['crane','Crâne']].map(([k, l]) => `<button data-act="anatView" data-v="${k}" aria-pressed="${S.anatView===k}">${l}</button>`).join('')}</div>`, { led:'#b8452f' });
}
function refreshAnatomy() { const p = $('#plates'); if (!p) return; p.innerHTML = platesHtml(); $('#senses').innerHTML = sensesHtml(); }
function tNotes() {
  const body = S.notesEdit && S.viewer !== 'other'
    ? `<div class="carton"><textarea data-bind="notes" aria-label="Notes importantes">${esc(C.notes)}</textarea></div><div class="edit-row" style="margin-top:12px;justify-content:flex-end"><button class="btn xs orange" data-act="notesEdit">Terminé</button></div>`
    : `<div class="carton"><ul>${C.notes.split('\n').filter(Boolean).map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`;
  return tile('notes', 'Carton', body, S.viewer !== 'other' && !S.notesEdit ? `<button class="btn xs" data-act="notesEdit">${ic('edit',12)}Éditer</button>` : '');
}
function tFlavor() {
  if (S.flavorEdit && !isMJ() && S.viewer === 'owner') {
    return tile('flavor', 'Informations', `<div class="edit-list">${C.flavor.filter(f => canSee(f.vis)).map(f => `<div class="edit-row">
      <span style="width:140px" class="hint">${esc(f.label)}</span>
      ${f.wide ? `<textarea class="field w-name" data-bind="flavor:${f.id}:value" rows="3" aria-label="${esc(f.label)}">${esc(f.value)}</textarea>` : `<input class="field w-name" data-bind="flavor:${f.id}:value" value="${esc(f.value)}" aria-label="${esc(f.label)}">`}</div>`).join('')}
      <div class="edit-row"><span class="grow"></span><button class="btn xs orange" data-act="flavorEdit">Terminé</button></div></div>`);
  }
  if (S.flavorEdit && isMJ()) {
    return tile('flavor', 'Informations', `<div class="edit-list">${C.flavor.map(f => `<div class="edit-row">
      <input class="field" style="width:140px" data-bind="flavor:${f.id}:label" value="${esc(f.label)}" aria-label="Libellé">
      ${f.wide ? `<textarea class="field w-name" data-bind="flavor:${f.id}:value" rows="3">${esc(f.value)}</textarea>` : `<input class="field w-name" data-bind="flavor:${f.id}:value" value="${esc(f.value)}" aria-label="Valeur">`}
      ${visBadge('flavor', f.id, f.vis)}<button class="iconbtn" data-act="rmFlavor" data-id="${f.id}" aria-label="Supprimer">${ic('trash',13)}</button></div>`).join('')}
      <div class="edit-row"><button class="btn xs" data-act="addFlavor">${ic('plus',12)}Champ court</button><button class="btn xs" data-act="addFlavorWide">${ic('plus',12)}Champ long</button><span class="grow"></span><button class="btn xs orange" data-act="flavorEdit">Terminé</button></div></div>`);
  }
  return tile('flavor', 'Informations', `<dl class="flavor">${C.flavor.filter(f => canSee(f.vis)).map(f => `<div class="fl ${f.wide?'wide':''} ${f.vis==='mj'?'locked':''}"><dt>${esc(f.label)} ${f.vis!=='all'?visBadge('flavor', f.id, f.vis):''}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>`,
    isMJ() || S.viewer === 'owner' ? `<button class="btn xs" data-act="flavorEdit">${ic('edit',12)}Éditer</button>` : '');
}
function tCustom(id) {
  const t = S.custom[id];
  let inner;
  if (t.type === 'jauge') inner = gaugeRow({ id, label:t.title, value:t.value, max:t.max, color:'#d6a23c', hi:'#e9bd62', vis:'all', custom:true });
  else if (t.type === 'stat') inner = `<div class="dial well" style="max-width:120px">${dialSvg(t.value, t.max, 'var(--mustard)')}<div class="dial-name">${esc(t.title)}</div></div>`;
  else if (t.type === 'carton') inner = `<div class="carton"><ul><li>${esc(t.value)}</li></ul></div>`;
  else inner = `<div class="fl"><dd style="margin:0">${esc(t.value)}</dd></div>`;
  return tile(id, esc(t.title), `${inner}<div style="margin-top:8px"><span class="bindtag">{{${esc(t.bind)}}}</span></div>`, '', { removable:true });
}
function tJournal() {
  const canEdit = S.viewer !== 'other', editing = S.journalEdit && canEdit;
  const body = editing
    ? `<textarea class="field jtext" data-bind="journal" spellcheck="true" aria-label="Notes du joueur en Markdown">${esc(C.journal)}</textarea><div class="notepaper" style="margin-top:10px"><div class="md" id="jPrev">${mdHtml(C.journal)}</div></div>`
    : `<div class="notepaper"><div class="md">${mdHtml(C.journal)}</div></div>`;
  return tile('journal', 'Notes du joueur', body, canEdit ? `<button class="btn xs ${editing?'on':''}" data-act="journalEdit">${ic('edit',12)}${editing ? 'Terminer' : 'Éditer'}</button>` : '');
}

const LIB = [['jauge','Jauge','hp_max'],['stat','Statistique','stat_x'],['texte','Champ texte','texte_x'],['carton','Carton','note_x']];
function renderFiche() {
  const visible = L().order.filter(id => S.custom[id] || canSee(S.tileVis[id] || 'all'));
  const R = { identity:tIdentity, gauges:tGauges, anatomy:tAnatomy, stats:tStats, notes:tNotes, journal:tJournal, flavor:tFlavor };
  return `<div class="toolbar"><div><h2>Fiche · ${esc(flv('Prénom'))} ${esc(flv('Nom'))}</h2><div class="sub">${S.viewer==='other' ? 'Lecture seule : tu vois ce que ce joueur et le MJ ont rendu visible à tous.' : S.viewer==='owner' ? 'Ta fiche. Les éléments « Privé » ne sont visibles que par toi et le MJ.' : 'Vue MJ : tout est visible. Clique un badge de visibilité pour le changer. Les maximums des jauges se modifient directement.'}</div></div><span class="grow"></span>
    ${S.viewer !== 'other' ? `${S.viewer === 'owner' && S.pl && !S.layoutEdit ? '<button class="btn" data-act="resetLayout">Disposition du MJ</button>' : ''}<button class="btn ${S.layoutEdit?'on':''}" data-act="layoutEdit">${ic('layout')}${S.layoutEdit ? 'Terminer la disposition' : (isMJ() ? 'Modifier le modèle de fiche' : 'Réorganiser ma fiche')}</button>` : ''}</div>
    ${S.layoutEdit ? `<div class="library well"><span class="tile-title">${isMJ() ? 'Bibliothèque' : 'Widgets'}</span>${(isMJ() ? LIB : []).map(([t, l, b]) => `<span class="libchip" draggable="true" data-lib="${t}">${l} <code>{{${b}}}</code></span>`).join('')}${typeof fidLibChips === 'function' ? fidLibChips() : ''}<span class="hint">Glisse un champ sur la grille. Glisse une tuile pour la déplacer.</span></div>` : ''}
    <div class="bento" id="bento">${visible.map(id => S.custom[id] ? tCustom(id) : FIDS[id] ? tile(id, FIDS[id].title, FIDS[id].body(), '', { led:'#86985a', removable:true, cls:FIDS[id].compact ? 'compact' : '' }) : R[id]()).join('')}</div>
    <p class="credit">Planches : silhouettes d’après Goran tek-en (CC BY-SA 4.0), crâne et viscères d’après Gray’s Anatomy, 1918 (domaine public), via Wikimedia Commons.</p>`;
}

/* ================= inventaire & compétences ================= */
function cardHtml(def, own, lib) {
  const key = own ? own.iid : 'lib' + def.id, owner = S.viewer === 'owner';
  return `<div class="card r-${def.rarity} ${S.flipped.has(key)?'flipped':''} ${own&&own.hidden?'is-hidden':''}" data-card="${key}" tabindex="0" role="button" aria-label="${esc(def.name)}, retourner la carte">
    <div class="card-inner">
      <div class="face front"><div class="c-top"><div class="c-name">${esc(def.name)}</div><span class="gem" title="${RARITY[def.rarity]}"></span></div>
        <div class="c-art">${def.img ? `<img src="${esc(def.img)}" alt="">` : `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ART[def.art] || ART.photo}</svg>`}${own && own.hidden ? `<span class="stamp">Caché</span>` : ''}</div>
        <div class="c-type"><span>${esc(def.type)}</span><span>${own && own.vis !== 'all' ? VISLBL[own.vis] : ''}</span></div>
        <div class="c-desc">${esc(def.desc)}</div>
        <div class="c-foot"><span class="rar">${RARITY[def.rarity]}</span><span>${esc(def.value)}</span></div></div>
      <div class="face back"><h4>${esc(def.name)}</h4>
        <div class="meta"><span>Type</span><b>${esc(def.type)}</b><span>Valeur</span><b>${esc(def.value)}</b><span>Rareté</span><b>${RARITY[def.rarity]}</b></div>
        <p style="margin:0;font-size:12px;color:#d3cbbb;white-space:pre-line">${esc(def.desc)}</p>
        ${isMJ() && def.mj ? `<div class="mjnote">${ic('lock',12)}<span>${esc(def.mj)}</span></div>` : ''}
        <div class="acts">
          ${own && owner ? `<button class="btn xs" data-act="toggleHide" data-kind="inv" data-id="${own.iid}">${ic(own.hidden?'eye':'eyeOff',12)}${own.hidden?'Montrer':'Cacher aux joueurs'}</button>` : ''}
          ${own && isMJ() ? `${visBadge('inv', own.iid, own.vis)}<button class="btn xs danger" data-act="takeItem" data-id="${own.iid}">Retirer</button>` : ''}
          ${lib && isMJ() ? `<button class="btn xs orange" data-act="giveItem" data-id="${def.id}">${ic('gift',12)}Donner à Inès</button><button class="btn xs" data-act="editItem" data-id="${def.id}" aria-label="Modifier">${ic('edit',12)}</button><button class="iconbtn" data-act="delItem" data-id="${def.id}" aria-label="Supprimer l’objet">${ic('trash',12)}</button>` : ''}
        </div></div></div></div>`;
}
const ownVisible = o => S.viewer === 'other' ? (o.vis === 'all' && !o.hidden) : canSee(o.vis);
function renderInventory() {
  const lib = isMJ() && S.invMode === 'lib';
  const list = lib ? ITEMS.map(d => cardHtml(d, null, true)) : INV.filter(ownVisible).map(o => { const d = ITEMS.find(i => i.id === o.def); return d ? cardHtml(d, o, false) : ''; });
  return `<div class="toolbar"><div><h2>${lib ? 'Bibliothèque d’objets' : 'Inventaire · Inès'}</h2><div class="sub">${lib ? 'Tous les objets créés. Retourne une carte pour la donner.' : 'Clique une carte pour la retourner.'}${S.viewer==='owner' ? ' Tu peux cacher un objet aux autres joueurs.' : ''}</div></div><span class="grow"></span>
    ${isMJ() ? `<div class="seg"><button data-act="invMode" data-m="owned" aria-pressed="${!lib}"><span class="dot"></span>Inès</button><button data-act="invMode" data-m="lib" aria-pressed="${lib}"><span class="dot"></span>Bibliothèque</button></div><button class="btn orange" data-act="newItem">${ic('plus')}Créer un objet</button>` : ''}</div>
    ${list.length ? `<div class="cards">${list.join('')}</div>` : `<div class="empty-note well">Aucun objet visible.</div>`}`;
}
function stars(n) { return `<span class="stars" aria-label="Niveau ${n} sur 5">${[1,2,3,4,5].map(i => `<svg viewBox="0 0 24 24" class="${i<=n?'on':'off'}" stroke-width="1.6" stroke-linejoin="round">${P.star}</svg>`).join('')}</span>`; }
function skillHtml(def, own, lib) {
  const owner = S.viewer === 'owner';
  return `<article class="skill ${own&&own.hidden?'is-hidden':''}" style="--sc:${STATCOL[def.stat] || 'var(--mustard)'}"><div class="band"></div><div class="body">
    <div class="sk-top"><div class="sk-name">${esc(def.name)}</div><span class="sk-stat">${esc(def.stat)}</span></div>
    ${stars(def.level)}<div class="sk-desc">${esc(def.desc)}</div>
    ${isMJ() && def.mj ? `<div class="mjnote">${ic('lock',11)}<span>${esc(def.mj)}</span></div>` : ''}
    <div class="sk-foot">
      ${own && own.hidden ? `<span class="vis vis-static vis-owner">${ic('eyeOff',11)}Caché aux joueurs</span>` : ''}
      ${own && owner ? `<button class="btn xs" data-act="toggleHide" data-kind="skown" data-id="${own.iid}">${ic(own.hidden?'eye':'eyeOff',12)}${own.hidden?'Montrer':'Cacher'}</button>` : ''}
      ${own && isMJ() ? `${visBadge('skown', own.iid, own.vis)}<button class="btn xs danger" data-act="takeSkill" data-id="${own.iid}">Retirer</button>` : ''}
      ${lib && isMJ() ? `<button class="btn xs orange" data-act="giveSkill" data-id="${def.id}">${ic('gift',12)}Donner à Inès</button><button class="btn xs" data-act="editSkill" data-id="${def.id}" aria-label="Modifier">${ic('edit',12)}</button><button class="iconbtn" data-act="delSkill" data-id="${def.id}" aria-label="Supprimer la compétence">${ic('trash',12)}</button>` : ''}
    </div></div></article>`;
}
function renderSkills() {
  const lib = isMJ() && S.skMode === 'lib';
  const list = lib ? SKILLS.map(d => skillHtml(d, null, true)) : SKOWN.filter(ownVisible).map(o => { const d = SKILLS.find(i => i.id === o.def); return d ? skillHtml(d, o, false) : ''; });
  return `<div class="toolbar"><div><h2>${lib ? 'Bibliothèque de compétences' : 'Compétences · Inès'}</h2><div class="sub">La couleur de la carte suit la statistique associée.</div></div><span class="grow"></span>
    ${isMJ() ? `<div class="seg"><button data-act="skMode" data-m="owned" aria-pressed="${!lib}"><span class="dot"></span>Inès</button><button data-act="skMode" data-m="lib" aria-pressed="${lib}"><span class="dot"></span>Bibliothèque</button></div><button class="btn orange" data-act="newSkill">${ic('plus')}Créer une compétence</button>` : ''}</div>
    ${list.length ? `<div class="skills">${list.join('')}</div>` : `<div class="empty-note well">Aucune compétence visible.</div>`}`;
}

/* ================= lore ================= */
function mdHtml(md) {
  const src = md.replace(/\(asset:([a-z0-9_-]+)\)/gi, (m, k) => ASSETS[k] ? `(${ASSETS[k]})` : m);
  return window.marked ? marked.parse(src) : `<pre style="white-space:pre-wrap">${esc(md)}</pre>`;
}
function renderLore() {
  const arts = LORE.filter(a => canSee(a.vis));
  if (!arts.find(a => a.id === S.loreSel)) S.loreSel = arts[0] && arts[0].id;
  const a = LORE.find(x => x.id === S.loreSel), editing = S.loreEdit && isMJ();
  return `<div class="toolbar"><div><h2>Lore</h2><div class="sub">Articles en Markdown, avec images.</div></div><span class="grow"></span>
    ${isMJ() ? `<button class="btn" data-act="newLore">${ic('plus')}Nouvel article</button><button class="btn ${editing?'on':''}" data-act="loreEdit">${ic('edit')}${editing ? 'Terminer' : 'Éditer'}</button>` : ''}</div>
    <div class="lore"><nav class="lore-nav well" aria-label="Articles">${arts.map(x => `<button data-act="loreSel" data-id="${x.id}" aria-current="${x.id===S.loreSel}">${ic('book',14)}<span>${esc(x.title)}</span>${x.vis==='mj'?`<span class="secret">${ic('lock',12)}</span>`:''}</button>`).join('')}</nav>
    ${!a ? `<div class="empty-note well">Aucun article.</div>` : editing ? `<div class="editor"><div class="tile" style="animation:none"><div class="tile-head"><h3 class="tile-title">Markdown</h3><span class="grow"></span>${visBadge('lore', a.id, a.vis)}<button class="btn xs" data-act="insertImg">${ic('plus',12)}Image</button></div><textarea class="field" id="mdArea" data-bind="lore:${a.id}:md" spellcheck="false">${esc(a.md)}</textarea></div><div class="tile article" style="animation:none"><div class="md" id="mdPreview">${mdHtml(a.md)}</div></div></div>`
      : `<article class="tile article"><div class="md">${mdHtml(a.md)}</div></article>`}</div>`;
}

/* ================= carte ================= */
function unitPx() { const svg = $('#mapsvg'), m = MAPS[S.map]; return svg && svg.clientWidth ? Math.max(m.w / svg.clientWidth, m.h / svg.clientHeight) : 1; }
function poiSvg(p) {
  return `<g class="poi ${p.vis!=='all'?'secret':''} ${S.openItem===p.id?'sel':''}" data-poi="${p.id}" style="--pc:${p.color}" transform="translate(${p.x} ${p.y})"><g class="pk" transform="scale(${unitPx()/S.view.k})">
    <ellipse class="shadow" cx="2" cy="18" rx="12" ry="4"/><circle class="ring" r="15"/><g class="ico" transform="translate(-9 -9) scale(.75)"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${P[p.icon] || P.pin}</g></g>
    <text class="lab" y="34" text-anchor="middle">${esc(p.label)}</text></g></g>`;
}
function textSvg(t) {
  return `<text class="mtext ${S.openItem===t.id?'sel':''}" data-mtext="${t.id}" x="${t.x}" y="${t.y}" text-anchor="middle" font-size="${t.size}" fill="${t.color}" stroke-width="${Math.max(3, t.size / 7)}" transform="rotate(${t.rot} ${t.x} ${t.y})" letter-spacing="${t.size * .12}">${esc(t.text)}</text>`;
}
function renderMap() {
  const m = MAPS[S.map];
  const crumbs = []; let cur = S.map; while (cur) { crumbs.unshift(cur); cur = MAPS[cur].parent; }
  return `<div class="toolbar"><div><h2>Carte · ${esc(m.name)}</h2><div class="sub">Glisse pour déplacer, molette pour zoomer. Clique un point pour ouvrir son article ou sa carte locale.</div></div><span class="grow"></span>
    ${isMJ() ? `<button class="btn" data-act="importMap">${ic('upload')}Importer une image</button><button class="btn ${S.mapEdit?'on':''}" data-act="mapEdit">${ic('move')}${S.mapEdit ? 'Terminer l’édition' : 'Éditer la carte'}</button>` : ''}</div>
    ${isMJ() && S.mapEdit ? `<div class="library well"><span class="tile-title">Ajouter</span><button class="btn ${S.addMode==='poi'?'on':''}" data-act="addMode" data-m="poi">${ic('pin')}Point d’intérêt</button><button class="btn ${S.addMode==='text'?'on':''}" data-act="addMode" data-m="text">${ic('text')}Texte</button><span class="hint">En édition, glisse un point ou un texte pour le déplacer.</span></div>` : ''}
    <div class="mapwrap well" id="mapwrap">
      <svg class="mapsvg ${S.addMode?'adding':''}" id="mapsvg" viewBox="0 0 ${m.w} ${m.h}" preserveAspectRatio="xMidYMid meet">
        <g id="world" transform="translate(${S.view.x} ${S.view.y}) scale(${S.view.k})">
          <image href="${esc(m.img || '')}" width="${m.w}" height="${m.h}"/>
          ${m.texts.filter(t => canSee(t.vis)).map(textSvg).join('')}
          ${m.pois.filter(p => canSee(p.vis)).map(poiSvg).join('')}</g></svg>
      <div class="crumbs">${crumbs.map((k, i) => i < crumbs.length - 1 ? `<button data-act="goMap" data-m="${k}">${esc(MAPS[k].name)}</button><span style="color:var(--dim)">›</span>` : `<b>${esc(MAPS[k].name)}</b>`).join('')}</div>
      <div class="mapctrl"><button class="iconbtn" data-act="zoom" data-d="1.25" aria-label="Zoomer">${ic('plus',13)}</button><button class="iconbtn" data-act="zoom" data-d="0.8" aria-label="Dézoomer">${ic('minus',13)}</button><button class="iconbtn" data-act="resetView" aria-label="Recentrer">${ic('target',13)}</button></div>
      ${S.addMode ? `<div class="addbanner">Clique sur la carte pour placer ${S.addMode==='poi' ? 'le point' : 'le texte'}</div>` : ''}
      <div id="popSlot"></div>
    </div><p class="credit">${esc(m.credit || '')}</p>`;
}
function linkLabel(link) {
  if (!link) return 'Aucun lien';
  const [k, v] = link.split(':');
  return k === 'map' ? 'Carte · ' + ((MAPS[v] || {}).name || '?') : 'Article · ' + ((LORE.find(l => l.id === v) || {}).title || '?');
}
function popover() {
  const slot = $('#popSlot'); if (!slot) return;
  const it = S.openItem && refObj('poi', S.openItem);
  if (!it) { slot.innerHTML = ''; return; }
  const isText = 'text' in it;
  const svg = $('#mapsvg'), wrap = $('#mapwrap');
  const pt = svg.createSVGPoint(); pt.x = it.x * S.view.k + S.view.x; pt.y = it.y * S.view.k + S.view.y;
  const sc = pt.matrixTransform(svg.getScreenCTM()), wr = wrap.getBoundingClientRect();
  const left = Math.max(12, Math.min(sc.x - wr.left + 20, wr.width - 274)), top = Math.max(56, Math.min(sc.y - wr.top - 20, wr.height - 330));
  const edit = isMJ() && S.mapEdit;
  let html;
  if (isText) {
    html = edit ? `<input class="field" data-bind="mtext:${it.id}:text" value="${esc(it.text)}" aria-label="Texte">
      <div class="edit-row"><span class="hint">Taille</span><input type="range" min="12" max="90" value="${it.size}" data-bind="mtext:${it.id}:size" aria-label="Taille" style="flex:1"></div>
      <div class="edit-row"><span class="hint">Rotation</span><input type="range" min="-45" max="45" value="${it.rot}" data-bind="mtext:${it.id}:rot" aria-label="Rotation" style="flex:1"></div>
      <div class="swatches">${POI_COLORS.concat(['#f0d9b5']).map(c => `<button style="--sw:${c}" data-act="itemColor" data-c="${c}" aria-pressed="${it.color===c}" aria-label="Couleur ${c}"></button>`).join('')}</div>
      <div class="edit-row">${visBadge('mtext', it.id, it.vis)}<span class="grow"></span><button class="iconbtn" data-act="delItemMap" aria-label="Supprimer">${ic('trash',13)}</button><button class="btn xs orange" data-act="closePop">OK</button></div>`
      : '';
    if (!edit) { slot.innerHTML = ''; return; }
  } else if (edit) {
    html = `<input class="field" data-bind="poi:${it.id}:label" value="${esc(it.label)}" aria-label="Nom du point">
      <input class="field" data-bind="poi:${it.id}:desc" value="${esc(it.desc)}" placeholder="Description courte" aria-label="Description">
      <div class="icopick">${POI_ICONS.map(n => `<button data-act="poiIcon" data-n="${n}" aria-pressed="${it.icon===n}" aria-label="${n}">${ic(n,15)}</button>`).join('')}</div>
      <div class="swatches">${POI_COLORS.map(c => `<button style="--sw:${c}" data-act="itemColor" data-c="${c}" aria-pressed="${it.color===c}" aria-label="Couleur ${c}"></button>`).join('')}</div>
      <select class="field" data-act-change="poiLink" aria-label="Lien"><option value="">Aucun lien</option>${LORE.map(l => `<option value="lore:${l.id}" ${it.link==='lore:'+l.id?'selected':''}>Article · ${esc(l.title)}</option>`).join('')}${Object.entries(MAPS).filter(([k]) => k !== S.map).map(([k, mm]) => `<option value="map:${k}" ${it.link==='map:'+k?'selected':''}>Carte · ${esc(mm.name)}</option>`).join('')}</select>
      <div class="edit-row">${visBadge('poi', it.id, it.vis)}<span class="grow"></span><button class="iconbtn" data-act="delItemMap" aria-label="Supprimer le point">${ic('trash',13)}</button><button class="btn xs orange" data-act="closePop">OK</button></div>`;
  } else {
    html = `<div class="edit-row"><span style="color:${it.color}">${ic(it.icon,16)}</span><h4 style="flex:1">${esc(it.label)}</h4><button class="iconbtn" data-act="closePop" aria-label="Fermer">${ic('x',12)}</button></div>
      <p>${esc(it.desc)}</p>
      ${it.link ? `<div class="edit-row"><button class="btn xs orange" data-act="followLink">${it.link.startsWith('map') ? ic('map',12) + 'Ouvrir la carte locale' : ic('book',12) + 'Lire l’article'}</button></div><span class="hint">→ ${esc(linkLabel(it.link))}</span>` : `<span class="hint">Aucun lien.</span>`}`;
  }
  slot.innerHTML = `<div class="popover" style="left:${left}px;top:${top}px">${html}</div>`;
}
function applyView() {
  const w = $('#world'); if (!w) return;
  w.setAttribute('transform', `translate(${S.view.x} ${S.view.y}) scale(${S.view.k})`);
  const u = unitPx(); $$('.pk', w).forEach(g => g.setAttribute('transform', `scale(${u / S.view.k})`));
  popover();
}
function svgPoint(svg, cx, cy) { const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
const toWorld = p => ({ x:(p.x - S.view.x) / S.view.k, y:(p.y - S.view.y) / S.view.k });
function zoomAt(px, py, f) { const k2 = Math.max(.5, Math.min(5, S.view.k * f)), r = k2 / S.view.k; S.view.x = px - (px - S.view.x) * r; S.view.y = py - (py - S.view.y) * r; S.view.k = k2; applyView(); }
function refreshMapItems() {
  const w = $('#world'); if (!w) return; const m = MAPS[S.map];
  $$('.poi,.mtext', w).forEach(n => n.remove());
  w.insertAdjacentHTML('beforeend', m.texts.filter(t => canSee(t.vis)).map(textSvg).join('') + m.pois.filter(p => canSee(p.vis)).map(poiSvg).join(''));
}
function bindMap() {
  const svg = $('#mapsvg'); if (!svg) return;
  let drag = null;
  svg.addEventListener('pointerdown', e => {
    const el = e.target.closest('.poi,.mtext');
    const item = el && refObj('poi', el.dataset.poi || el.dataset.mtext);
    drag = { sx:e.clientX, sy:e.clientY, vx:S.view.x, vy:S.view.y, moved:false, p0:svgPoint(svg, e.clientX, e.clientY), item: isMJ() && S.mapEdit ? item : null, ix:item?.x, iy:item?.y, el };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;
    if (!drag.moved) return;
    const p = svgPoint(svg, e.clientX, e.clientY);
    if (drag.item) { drag.item.x = drag.ix + (p.x - drag.p0.x) / S.view.k; drag.item.y = drag.iy + (p.y - drag.p0.y) / S.view.k; refreshMapItems(); popover(); }
    else { svg.classList.add('panning'); S.view.x = drag.vx + (p.x - drag.p0.x); S.view.y = drag.vy + (p.y - drag.p0.y); applyView(); }
  });
  svg.addEventListener('pointerup', e => {
    svg.classList.remove('panning');
    if (drag && !drag.moved) {
      if (drag.el) { S.openItem = drag.el.dataset.poi || drag.el.dataset.mtext; refreshMapItems(); popover(); }
      else if (S.addMode) {
        const w = toWorld(svgPoint(svg, e.clientX, e.clientY)), m = MAPS[S.map];
        const it = S.addMode === 'poi'
          ? { id:uid(), x:w.x, y:w.y, label:'Nouveau point', icon:'pin', color:'#e2672c', link:'', vis:'mj', desc:'' }
          : { id:uid(), x:w.x, y:w.y, text:'Nouveau texte', size:32, color:'#2f2922', rot:0, vis:'all' };
        (S.addMode === 'poi' ? m.pois : m.texts).push(it); S.addMode = null; S.openItem = it.id; render();
      } else if (S.openItem) { S.openItem = null; refreshMapItems(); popover(); }
    }
    drag = null;
  });
  svg.addEventListener('wheel', e => { e.preventDefault(); const p = svgPoint(svg, e.clientX, e.clientY); zoomAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive:false });
  refreshMapItems(); popover();
}
$('#mapFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { const img = new Image(); img.onload = () => {
    const id = 'm_' + uid();
    MAPS[id] = { name:f.name.replace(/\.[^.]+$/, ''), parent:S.map, img:r.result, w:img.naturalWidth, h:img.naturalHeight, credit:'Image importée par le MJ.', pois:[], texts:[] };
    S.map = id; S.view = { x:0, y:0, k:1 }; S.mapEdit = true; S.openItem = null; render(); toast('Carte importée');
  }; img.src = r.result; };
  r.readAsDataURL(f); e.target.value = '';
});

/* ================= modal ================= */
function openModal(html) { $('#modalBox').innerHTML = html; $('#modal').hidden = false; const f = $('#modalBox .field'); if (f) f.focus(); }
function closeModal() { $('#modal').hidden = true; }
function itemForm(def) {
  const d = def || { name:'', type:'Objet', rarity:'common', value:'', art:'photo', desc:'', mj:'' };
  openModal(`<h3>${def ? 'Modifier l’objet' : 'Nouvel objet'}</h3><form class="form" id="itemForm" data-id="${def ? def.id : ''}">
    <label class="full">Nom<input class="field" name="name" value="${esc(d.name)}" required></label>
    <label>Type<input class="field" name="type" value="${esc(d.type)}"></label>
    <label>Valeur<input class="field" name="value" value="${esc(d.value)}"></label>
    <label>Rareté<select class="field" name="rarity">${Object.entries(RARITY).map(([k, l]) => `<option value="${k}" ${k===d.rarity?'selected':''}>${l}</option>`).join('')}</select></label>
    <label>Illustration<select class="field" name="art">${Object.keys(ART).map(k => `<option ${k===d.art?'selected':''}>${k}</option>`).join('')}</select></label>
    <label class="full">Image personnalisée (remplace l’illustration)<input type="file" accept="image/png,image/jpeg,image/webp" class="field" data-img-into="itemImg"></label>
    <input type="hidden" name="img" id="itemImg" value="${esc(d.img || '')}">
    <div class="full edit-row"><img id="itemImgPrev" src="${d.img || ''}" ${d.img ? '' : 'hidden'} alt="Aperçu" style="width:64px;height:84px;object-fit:cover;border-radius:5px;box-shadow:0 0 0 1px rgba(255,240,215,.15)"><button type="button" class="btn xs" data-act="clearItemImg">Retirer l’image</button></div>
    <label class="full">Description<textarea class="field" name="desc" rows="3">${esc(d.desc)}</textarea></label>
    <label class="full" style="color:var(--rust)">Note MJ (visible du MJ seul)<textarea class="field" name="mj" rows="2">${esc(d.mj)}</textarea></label>
    <div class="modal-acts full"><button type="button" class="btn" data-act="closeModal">Annuler</button><button class="btn orange" type="submit">Enregistrer</button></div></form>`);
}
function skillForm(def) {
  const d = def || { name:'', stat:'INT', level:1, desc:'', mj:'' };
  openModal(`<h3>${def ? 'Modifier la compétence' : 'Nouvelle compétence'}</h3><form class="form" id="skillForm" data-id="${def ? def.id : ''}">
    <label class="full">Nom<input class="field" name="name" value="${esc(d.name)}" required></label>
    <label>Statistique associée<select class="field" name="stat">${C.stats.map(s => s.abbr).map(s => `<option ${s===d.stat?'selected':''}>${s}</option>`).join('')}</select></label>
    <label>Niveau (1 à 5)<input class="field" type="number" min="1" max="5" name="level" value="${d.level}"></label>
    <label class="full">Description<textarea class="field" name="desc" rows="3">${esc(d.desc)}</textarea></label>
    <label class="full">Formule de jet (facultative)<input class="field" name="roll" value="${esc(d.roll || '')}" maxlength="128" placeholder="ex. 1d20+{mod}+{niv} ou 2d6+AGI" spellcheck="false"></label>
    <label class="full" style="color:var(--rust)">Note MJ (visible du MJ seul)<textarea class="field" name="mj" rows="2">${esc(d.mj)}</textarea></label>
    <div class="modal-acts full"><button type="button" class="btn" data-act="closeModal">Annuler</button><button class="btn orange" type="submit">Enregistrer</button></div></form>`);
}
function invitesModal() {
  openModal(`<h3>Invitations</h3><p class="hint" style="margin:0">Chaque lien sert une seule fois. Le joueur choisit son pseudo et son mot de passe, sans vérification d’e-mail.</p>
    <ul class="invites">${INVITES.map(i => `<li><code>tablenoire://join/${esc(i.token)}</code>${i.used ? `<span class="pill used">Utilisé · ${esc(i.used)}</span>` : `<span class="pill ok">En attente</span><button class="btn xs" data-act="copyInvite" data-t="${esc(i.token)}">Copier</button>`}</li>`).join('')}</ul>
    <div class="modal-acts"><button class="btn" data-act="closeModal">Fermer</button><button class="btn orange" data-act="newInvite">${ic('plus')}Générer un lien</button></div>`);
}

/* ================= main render ================= */
function render() {
  $('#tip').classList.remove('show');
  renderHeader();
  $('#main').innerHTML = S.tab === 'fiche' ? renderFiche() : S.tab === 'inventaire' ? renderInventory() : S.tab === 'competences' ? renderSkills() : S.tab === 'lore' ? renderLore() : renderMap();
  if (S.tab === 'carte') bindMap();
}

/* ================= events ================= */
function setBind(spec, val, committed) {
  const [kind, id, field] = spec.split(':');
  if (kind === 'notes') { C.notes = val; return; }
  if (kind === 'journal') { C.journal = val; const pv = $('#jPrev'); if (pv) pv.innerHTML = mdHtml(val); return; }
  if (kind === 'wound') { const w = C.wounds[id] || (C.wounds[id] = { sev:0, type:'Contusion', desc:'', mj:'', vis:'all' }); w[field] = val; refreshAnatomy(); return; }
  if (kind === 'lore') { refObj('lore', id).md = val; const pv = $('#mdPreview'); if (pv) pv.innerHTML = mdHtml(val); return; }
  const o = refObj(kind, id); if (!o) return;
  const numeric = ['value','max','size','rot','step'].includes(field) && kind !== 'flavor';
  o[field] = numeric ? Number(val) || 0 : val;
  if (kind === 'gauge' && !o.counter) { o.max = Math.max(1, o.max); o.value = Math.max(0, Math.min(o.max, o.value)); }
  if (kind === 'gauge' && committed) render();
  if (kind === 'poi' || kind === 'mtext') refreshMapItems();
}
document.addEventListener('input', e => {
  const b = e.target.dataset.bind;
  if (b && !b.startsWith('gauge:')) setBind(b, e.target.value, false);
  if (e.target.id === 'dFormula') updatePadCounts();
});
document.addEventListener('change', e => {
  const t = e.target, b = t.dataset.bind;
  if (b && b.startsWith('gauge:')) setBind(b, t.value, true);
  if (t.dataset.actChange === 'poiLink') { refObj('poi', S.openItem).link = t.value; }
  if (b && b.startsWith('wound:') && t.tagName === 'SELECT') render();
  if (t.dataset.imgInto && t.files[0]) readImage(t.files[0], 600, url => { $('#' + t.dataset.imgInto).value = url; const pv = $('#itemImgPrev'); pv.src = url; pv.hidden = false; });
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('numin')) e.target.blur(); });

const ACT = {
  tab: d => { S.tab = d.tab; S.openItem = null; S.selZone = null; S.addMode = null; },
  viewer: d => { S.viewer = d.v; S.selZone = null; S.layoutEdit = S.statEdit = S.flavorEdit = S.gaugeEdit = S.loreEdit = S.mapEdit = false; S.addMode = null; S.openItem = null; S.flipped.clear(); },
  cycleVis: d => { const o = refObj(d.kind, d.id); if (o) o.vis = VISNEXT[o.vis]; if (S.tab === 'carte') { refreshMapItems(); popover(); return false; } },
  layoutEdit: () => { S.layoutEdit = !S.layoutEdit; },
  span: d => { const steps = [4,5,6,7,8,12]; const c = L().spans[d.id] || 6; L().spans[d.id] = steps[(steps.indexOf(c) + 1) % steps.length]; },
  rmTile: d => { L().order = L().order.filter(x => x !== d.id); if (isMJ()) delete S.custom[d.id]; },
  resetLayout: () => { S.pl = null; toast('Disposition du MJ rétablie'); },
  statEdit: () => { S.statEdit = !S.statEdit; }, flavorEdit: () => { S.flavorEdit = !S.flavorEdit; },
  gaugeEdit: () => { S.gaugeEdit = !S.gaugeEdit; }, notesEdit: () => { S.notesEdit = !S.notesEdit; },
  addStat: () => C.stats.push({ id:uid(), name:'Nouvelle stat', abbr:'NEW', value:10, max:20, vis:'all' }),
  rmStat: d => { C.stats = C.stats.filter(s => s.id !== d.id); },
  addFlavor: () => C.flavor.splice(C.flavor.length - 1, 0, { id:uid(), label:'Nouveau champ', value:'', vis:'all' }),
  addFlavorWide: () => C.flavor.push({ id:uid(), label:'Texte long', value:'', vis:'all', wide:true }),
  rmFlavor: d => { C.flavor = C.flavor.filter(s => s.id !== d.id); },
  addGauge: () => C.gauges.splice(C.gauges.length - 1, 0, { id:uid(), label:'Nouvelle jauge', value:5, max:10, color:'#d6a23c', hi:'#e9bd62', vis:'all' }),
  addCounter: () => C.gauges.push({ id:uid(), label:'Compteur', value:0, unit:'pts', counter:true, vis:'all' }),
  rmGauge: d => { C.gauges = C.gauges.filter(g => g.id !== d.id); },
  gstep: d => {
    if (S.custom[d.id]) { const t = S.custom[d.id]; t.value = Math.max(0, Math.min(t.max, t.value + +d.d)); sfx.tick(1.4); return; }
    const g = refObj('gauge', d.id), dv = +d.d * (g.step || 1); g.value = g.counter ? Math.max(0, g.value + dv) : Math.max(0, Math.min(g.max, g.value + dv)); sfx.tick(1.4);
  },
  anatView: d => { S.anatView = d.v; },
  selZone: d => { S.selZone = d.z || null; },
  setSev: d => { const z = S.selZone; const w = C.wounds[z] || (C.wounds[z] = { sev:0, type:'Contusion', desc:'', mj:'', vis:'all' }); w.sev = +d.sev; if (!w.sev) delete C.wounds[z]; sfx.tick(1 + +d.sev * .3); },
  invMode: d => { S.invMode = d.m; S.flipped.clear(); }, skMode: d => { S.skMode = d.m; },
  toggleHide: d => { const o = refObj(d.kind, d.id); o.hidden = !o.hidden; },
  takeItem: d => { const i = INV.findIndex(o => o.iid === d.id); if (i > -1) INV.splice(i, 1); },
  giveItem: d => { INV.push({ iid:uid(), def:d.id, hidden:false, vis:'all' }); toast('Objet donné à Inès'); },
  newItem: () => { itemForm(null); return false; }, editItem: d => { itemForm(ITEMS.find(i => i.id === d.id)); return false; },
  delItem: d => { ITEMS.splice(ITEMS.findIndex(o => o.id === d.id), 1); for (let j = INV.length - 1; j >= 0; j--) if (INV[j].def === d.id) INV.splice(j, 1); },
  takeSkill: d => { const i = SKOWN.findIndex(o => o.iid === d.id); if (i > -1) SKOWN.splice(i, 1); },
  giveSkill: d => { SKOWN.push({ iid:uid(), def:d.id, hidden:false, vis:'all' }); toast('Compétence donnée à Inès'); },
  newSkill: () => { skillForm(null); return false; }, editSkill: d => { skillForm(SKILLS.find(i => i.id === d.id)); return false; },
  delSkill: d => { SKILLS.splice(SKILLS.findIndex(o => o.id === d.id), 1); for (let j = SKOWN.length - 1; j >= 0; j--) if (SKOWN[j].def === d.id) SKOWN.splice(j, 1); },
  loreSel: d => { S.loreSel = d.id; }, loreEdit: () => { S.loreEdit = !S.loreEdit; },
  newLore: () => { const id = uid(); LORE.push({ id, title:'Nouvel article', vis:'mj', md:'# Nouvel article\n\nÉcris ici en **Markdown**.\n' }); S.loreSel = id; S.loreEdit = true; },
  insertImg: () => { const ta = $('#mdArea'); ta.setRangeText('\n![Légende](asset:blueprint)\n', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles:true })); ta.focus(); return false; },
  mapEdit: () => { S.mapEdit = !S.mapEdit; S.addMode = null; S.openItem = null; },
  addMode: d => { S.addMode = S.addMode === d.m ? null : d.m; S.openItem = null; },
  importMap: () => { $('#mapFile').click(); return false; },
  closePop: () => { S.openItem = null; refreshMapItems(); popover(); return false; },
  poiIcon: d => { refObj('poi', S.openItem).icon = d.n; refreshMapItems(); popover(); return false; },
  itemColor: d => { refObj('poi', S.openItem).color = d.c; refreshMapItems(); popover(); return false; },
  delItemMap: () => { const m = MAPS[S.map]; m.pois = m.pois.filter(p => p.id !== S.openItem); m.texts = m.texts.filter(p => p.id !== S.openItem); S.openItem = null; },
  followLink: () => { const it = refObj('poi', S.openItem); const [k, v] = it.link.split(':'); S.openItem = null; if (k === 'map') { S.map = v; S.view = { x:0, y:0, k:1 }; } else { S.tab = 'lore'; S.loreSel = v; } },
  goMap: d => { S.map = d.m; S.view = { x:0, y:0, k:1 }; S.openItem = null; },
  zoom: d => { const m = MAPS[S.map]; zoomAt(m.w / 2, m.h / 2, +d.d); return false; },
  resetView: () => { S.view = { x:0, y:0, k:1 }; applyView(); return false; },
  invites: () => { invitesModal(); return false; },
  newInvite: () => { const b = new Uint8Array(10); crypto.getRandomValues(b); INVITES.push({ token:'tn_' + [...b].map(x => 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 57]).join(''), used:null }); invitesModal(); return false; },
  copyInvite: (d, el) => { navigator.clipboard?.writeText('tablenoire://join/' + d.t).then(() => { el.textContent = 'Copié'; }).catch(() => { el.textContent = 'Sélectionne le lien'; }); return false; },
  cycleStep: d => { const g = refObj('gauge', d.id), st = [1,2,5,10,25,50,100,500], i = st.indexOf(g.step || 1); g.step = st[(i + 1) % st.length]; sfx.tick(1.2); },
  journalEdit: () => { S.journalEdit = !S.journalEdit; },
  portraitImport: () => { S.imgPurpose = 'portrait'; $('#imgFile').click(); return false; },
  clearItemImg: () => { $('#itemImg').value = ''; $('#itemImgPrev').hidden = true; return false; },
  closeModal: () => { closeModal(); return false; }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el) { e.stopPropagation(); const r = ACT[el.dataset.act] && ACT[el.dataset.act](el.dataset, el); if (r !== false) render(); return; }
  const zone = e.target.closest('.z,.sense');
  if (zone && isMJ()) { S.selZone = zone.dataset.z; sfx.tick(1.2); render(); return; }
  const card = e.target.closest('.card');
  if (card) { const k = card.dataset.card; S.flipped.has(k) ? S.flipped.delete(k) : S.flipped.add(k); card.classList.toggle('flipped'); sfx.flip(); return; }
  if (e.target.id === 'modal') closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (S.dockOpen) toggleDock(false); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.z,.card')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles:true })); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, fd = Object.fromEntries(new FormData(f));
  if (f.id === 'itemForm') { if (f.dataset.id) Object.assign(ITEMS.find(i => i.id === f.dataset.id), fd); else ITEMS.push({ id:uid(), ...fd }); S.invMode = 'lib'; }
  if (f.id === 'skillForm') { fd.level = Math.max(1, Math.min(5, +fd.level || 1)); if (f.dataset.id) Object.assign(SKILLS.find(i => i.id === f.dataset.id), fd); else SKILLS.push({ id:uid(), ...fd }); S.skMode = 'lib'; }
  closeModal(); render();
});

const tip = $('#tip');
document.addEventListener('pointermove', e => {
  const z = e.target.closest && e.target.closest('.z,.sense');
  if (z) {
    const id = z.dataset.z, w = woundOf(id);
    tip.innerHTML = `<h5>${ZONES[id]}</h5>${w ? `<span class="sevtag" style="background:${SEV[w.sev].c}">${SEV[w.sev].n} · ${esc(w.type)}</span><p>${esc(w.desc) || '<i>Sans description</i>'}</p>${isMJ() && w.mj ? `<p class="mj">${ic('lock',11)} ${esc(w.mj)}</p>` : ''}${isMJ() ? `<p class="hint" style="margin-top:6px">Visible par : ${VISLBL[w.vis]}</p>` : ''}` : `<p class="hint" style="margin:0">Aucune blessure${isMJ() ? ' · cliquer pour ajouter' : ''}</p>`}`;
    tip.style.left = Math.min(e.clientX + 16, innerWidth - 270) + 'px'; tip.style.top = Math.min(e.clientY + 16, innerHeight - tip.offsetHeight - 10) + 'px'; tip.classList.add('show');
  } else tip.classList.remove('show');
  const card = e.target.closest && e.target.closest('.card');
  $$('.card.tilting').forEach(c => { if (c !== card) { c.classList.remove('tilting'); c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); } });
  if (card && e.pointerType === 'mouse') {
    const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.classList.add('tilting');
    card.style.setProperty('--ry', ((px - .5) * 14).toFixed(2) + 'deg'); card.style.setProperty('--rx', ((.5 - py) * 12).toFixed(2) + 'deg');
    card.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
  }
});

let dragSrc = null;
document.addEventListener('dragstart', e => {
  const lib = e.target.closest && e.target.closest('.libchip'), t = e.target.closest && e.target.closest('.tile.editing');
  if (lib) dragSrc = { lib:lib.dataset.lib }; else if (t) dragSrc = { tile:t.dataset.tile }; else return;
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'x');
});
document.addEventListener('dragover', e => { if (!dragSrc) return; const t = e.target.closest('.tile, #bento'); if (t) { e.preventDefault(); $$('.drag-over').forEach(x => x.classList.remove('drag-over')); if (t.classList.contains('tile')) t.classList.add('drag-over'); } });
document.addEventListener('drop', e => {
  if (!dragSrc) return; e.preventDefault();
  const t = e.target.closest('.tile'), before = t ? t.dataset.tile : null;
  let id = dragSrc.tile;
  if (dragSrc.lib && dragSrc.lib.startsWith('fid:')) id = dragSrc.lib.slice(4);
  else if (dragSrc.lib) {
    const [type, label, bind] = LIB.find(l => l[0] === dragSrc.lib);
    id = 'c_' + uid(); S.custom[id] = { type, title:label, bind, value: type === 'jauge' || type === 'stat' ? 5 : 'Valeur à définir', max:10 }; L().spans[id] = type === 'jauge' ? 6 : 4;
  }
  L().order = L().order.filter(x => x !== id);
  const i = before ? L().order.indexOf(before) : -1;
  if (i > -1) L().order.splice(i, 0, id); else L().order.push(id);
  dragSrc = null; render();
});
document.addEventListener('dragend', () => { dragSrc = null; $$('.drag-over').forEach(x => x.classList.remove('drag-over')); });

let toastTimer;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); t.style.cssText = 'position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:90;padding:10px 16px;border-radius:6px;background:#ebe3d0;color:#2f2922;font:500 13px "IBM Plex Mono",monospace;box-shadow:0 3px 0 #0b0a09,0 10px 30px rgba(0,0,0,.6);transition:opacity .25s'; document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = '1'; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 1800);
}

/* ================= sound ================= */
const sfx = (() => {
  let ctx = null;
  const ac = () => { if (!S.sound) return null; try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); return ctx; } catch (_) { return null; } };
  const blip = (f, d, type = 'square', g = .03) => { const c = ac(); if (!c) return; const o = c.createOscillator(), v = c.createGain(); o.type = type; o.frequency.value = f; v.gain.setValueAtTime(g, c.currentTime); v.gain.exponentialRampToValueAtTime(.0001, c.currentTime + d); o.connect(v).connect(c.destination); o.start(); o.stop(c.currentTime + d); };
  return {
    tick: (m = 1) => blip(380 * m + Math.random() * 60, .03, 'square', .015),
    flip: () => blip(240, .07, 'triangle', .04),
    lock: () => blip(700, .06, 'triangle', .045),
    done: () => { blip(523, .16, 'sine', .07); setTimeout(() => blip(784, .28, 'sine', .06), 90); },
    note: f => { const c = ac(); if (!c) return; [[f, 'triangle', .08], [f * 2, 'sine', .025]].forEach(([fr, t, g]) => { const o = c.createOscillator(), v = c.createGain(); o.type = t; o.frequency.value = fr; v.gain.setValueAtTime(0, c.currentTime); v.gain.linearRampToValueAtTime(g, c.currentTime + .01); v.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .7); o.connect(v).connect(c.destination); o.start(); o.stop(c.currentTime + .75); }); },
    noise(d, g, freq) { const c = ac(); if (!c) return; const len = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, len, c.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len); const s = c.createBufferSource(), fl = c.createBiquadFilter(), v = c.createGain(); s.buffer = buf; fl.type = 'bandpass'; fl.frequency.value = freq; v.gain.value = g; s.connect(fl).connect(v).connect(c.destination); s.start(); },
    pop() { this.noise(.06, .6, 1600 + Math.random() * 900); },
    clack() { this.noise(.03, .4, 900); blip(140, .04, 'square', .02); }
  };
})();

/* ================= dice engine ================= */
function secureInt(n) { const lim = 0x100000000 - (0x100000000 % n), b = new Uint32Array(1); let x; do { crypto.getRandomValues(b); x = b[0]; } while (x >= lim); return (x % n) + 1; }
function tokenize(s) {
  const out = []; let i = 0; s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/\d/.test(ch)) { let j = i; while (j < s.length && /\d/.test(s[j])) j++; out.push({ t:'n', v:+s.slice(i, j) }); i = j; continue; }
    if (ch === 'd' || ch === 'D') { if (s[i+1] === '%') { out.push({ t:'d' }, { t:'n', v:100 }); i += 2; continue; } out.push({ t:'d' }); i++; continue; }
    if ('+-*/()'.includes(ch)) { out.push({ t:ch }); i++; continue; }
    throw new Error(`Caractère inattendu « ${ch} »`);
  }
  return out;
}
function parse(src) {
  const tk = tokenize(src); let p = 0;
  const peek = () => tk[p], eat = t => { if (tk[p] && tk[p].t === t) return tk[p++]; throw new Error(t === ')' ? 'Parenthèse fermante manquante' : 'Formule incomplète'); };
  function expr() { let a = term(); while (peek() && (peek().t === '+' || peek().t === '-')) { const op = tk[p++].t; a = { t:'bin', op, a, b:term() }; } return a; }
  function term() { let a = factor(); while (peek() && (peek().t === '*' || peek().t === '/')) { const op = tk[p++].t; a = { t:'bin', op, a, b:factor() }; } return a; }
  function factor() { if (peek() && peek().t === '-') { p++; return { t:'neg', a:factor() }; } return primary(); }
  function primary() {
    const k = peek(); if (!k) throw new Error('Formule incomplète');
    if (k.t === '(') { p++; const e = expr(); eat(')'); return { t:'grp', a:e }; }
    if (k.t === 'd') { p++; return dice(1, eat('n').v); }
    if (k.t === 'n') { p++; if (peek() && peek().t === 'd') { p++; const nf = peek(); if (!nf || nf.t !== 'n') throw new Error('Nombre de faces manquant après « d »'); p++; return dice(k.v, nf.v); } return { t:'num', v:k.v }; }
    throw new Error(`Symbole inattendu « ${k.t} »`);
  }
  function dice(n, f) { if (n < 1 || n > 100) throw new Error('Entre 1 et 100 dés par groupe'); if (f < 2 || f > 1000) throw new Error('Un dé a entre 2 et 1000 faces'); return { t:'dice', n, f }; }
  if (!tk.length) throw new Error('Formule vide');
  const ast = expr(); if (p < tk.length) throw new Error(`Symbole inattendu « ${tk[p].t === 'n' ? tk[p].v : tk[p].t} »`);
  return ast;
}
function diceList(ast, out = []) { if (!ast) return out; if (ast.t === 'dice') for (let i = 0; i < ast.n; i++) out.push(ast.f); else { diceList(ast.a, out); diceList(ast.b, out); } return out; }
function evaluate(ast, vals) {
  let idx = 0;
  const go = n => {
    switch (n.t) {
      case 'num': return { v:n.v, s:String(n.v) };
      case 'dice': { const r = vals.slice(idx, idx + n.n); idx += n.n; return { v:r.reduce((a, b) => a + b, 0), s:`${n.n}d${n.f}[${r.join(',')}]` }; }
      case 'grp': { const a = go(n.a); return { v:a.v, s:`(${a.s})` }; }
      case 'neg': { const a = go(n.a); return { v:-a.v, s:`−${a.s}` }; }
      case 'bin': { const a = go(n.a), b = go(n.b), sym = { '+':'+', '-':'−', '*':'×', '/':'÷' }[n.op];
        const v = n.op === '+' ? a.v + b.v : n.op === '-' ? a.v - b.v : n.op === '*' ? a.v * b.v : (b.v === 0 ? NaN : Math.floor(a.v / b.v));
        return { v, s:`${a.s} ${sym} ${b.s}` }; }
    }
  };
  return go(ast);
}
const DICE = [4,6,8,10,12,20,100];
const dPad = $('#dPad'), dF = $('#dFormula'), dTotal = $('#dTotal');
dPad.innerHTML = DICE.map(f => `<button class="dbtn" data-face="${f}" title="Ajouter un d${f} (Maj+clic pour retirer)">d${f}<span class="cnt" hidden></span></button>`).join('');
function updatePadCounts() {
  $$('.dbtn', dPad).forEach(b => {
    const f = b.dataset.face, re = new RegExp(`(\\d*)d${f}(?!\\d)`, 'gi'); let n = 0, m;
    while ((m = re.exec(dF.value))) n += m[1] ? +m[1] : 1;
    const c = $('.cnt', b); c.hidden = !n; c.textContent = n;
  });
  $('#dErr').textContent = '';
}
dPad.addEventListener('click', e => {
  const b = e.target.closest('.dbtn'); if (!b) return;
  const f = b.dataset.face, re = new RegExp(`(^|[+\\-*/(\\s])(\\d*)d${f}(?!\\d)`, 'i'), v = dF.value.trim(), m = v.match(re);
  if (e.shiftKey) { if (m) { const n = (m[2] ? +m[2] : 1) - 1; dF.value = n > 0 ? v.replace(re, `$1${n}d${f}`) : v.replace(re, '$1').replace(/^\s*\+\s*/, '').replace(/\+\s*\+/g, '+').replace(/[+\-]\s*$/, '').trim(); } }
  else if (m) dF.value = v.replace(re, `$1${(m[2] ? +m[2] : 1) + 1}d${f}`);
  else dF.value = v ? `${v}+1d${f}` : `1d${f}`;
  sfx.tick(.8 + DICE.indexOf(+f) * .12); updatePadCounts();
});
$('#dClear').innerHTML = ic('x', 14);
$('#dClear').addEventListener('click', () => { dF.value = ''; updatePadCounts(); renderTray([], []); dF.focus(); });
dF.addEventListener('keydown', e => { if (e.key === 'Enter') roll(); });
function renderTray(faces, vals, locked = []) {
  const tray = $('#dTray');
  if (!faces.length) { tray.innerHTML = `<span class="empty">Le plateau est vide.</span>`; return; }
  tray.innerHTML = faces.slice(0, 30).map((f, i) => `<span class="die ${locked[i] ? 'locked' : 'rolling'} ${locked[i] && vals[i] === f ? 'max' : ''} ${locked[i] && vals[i] === 1 ? 'min' : ''}">${vals[i]}<small>d${f}</small></span>`).join('') + (faces.length > 30 ? `<span class="empty">+${faces.length - 30} dés</span>` : '');
}
let DURATION = 5000;
let rolling = false;
function roll() {
  if (rolling) return;
  let ast;
  try { ast = parse(dF.value); } catch (err) { $('#dErr').textContent = err.message; return; }
  const faces = diceList(ast);
  if (faces.length > 200) { $('#dErr').textContent = 'Maximum 200 dés par lancer.'; return; }
  const finals = faces.map(f => secureInt(f)), res = evaluate(ast, finals);
  if (!isFinite(res.v)) { $('#dErr').textContent = 'Division par zéro.'; return; }
  rolling = true; $('#dErr').textContent = '';
  const btn = $('#dRoll'), sub = $('#dSub'), who = VIEWERS[S.viewer];
  btn.disabled = true; btn.textContent = 'Les dés roulent…';
  $('#dWho').textContent = who.who; dTotal.classList.remove('idle', 'done'); sub.textContent = dF.value;
  const tray = $('#dTray'); tray.classList.remove('shake'); void tray.offsetWidth; tray.classList.add('shake');
  const cur = faces.map(f => secureInt(f)), locked = faces.map(() => false), start = performance.now();
  const lockAt = faces.map((_, i) => DURATION * (faces.length === 1 ? 1 : .8 + .2 * (i / (faces.length - 1))));
  let next = 0, lastTick = 0;
  function frame(now) {
    const el = now - start, t = Math.min(1, el / DURATION);
    let changed = false;
    faces.forEach((f, i) => { if (!locked[i] && el >= lockAt[i]) { locked[i] = true; cur[i] = finals[i]; changed = true; sfx.lock(); } });
    if (el >= next) {
      faces.forEach((f, i) => { if (!locked[i]) cur[i] = secureInt(f); });
      next = el + 40 + 560 * Math.pow(t, 2.4); changed = true;
      if (now - lastTick > 50) { sfx.tick(1 - t * .5); lastTick = now; }
    }
    if (changed) { renderTray(faces, cur, locked); const v = evaluate(ast, cur).v; setFlaps(dTotal, isFinite(v) ? v : '--'); }
    if (t < 1) return requestAnimationFrame(frame);
    renderTray(faces, finals, faces.map(() => true));
    setFlaps(dTotal, res.v); dTotal.classList.add('done'); sub.textContent = res.s; sfx.done();
    LOG.unshift({ who:who.who, color:who.color, detail:res.s, total:res.v, time:new Date().toTimeString().slice(0, 5), fresh:true });
    renderLog(); $('#fabLast').textContent = res.v;
    btn.disabled = false; btn.textContent = 'Lancer'; rolling = false;
  }
  requestAnimationFrame(frame);
}
$('#dRoll').addEventListener('click', roll);
function renderLog() {
  $('#dLog').innerHTML = LOG.slice(0, 60).map(l => `<li class="${l.fresh ? 'fresh' : ''}"><span class="av" style="background:${l.color}">${esc(l.who[0])}</span><div style="min-width:0"><div class="who">${esc(l.who)}<time>${l.time}</time></div><div class="det">${esc(l.detail)}</div></div><span class="tot">${l.total}</span></li>`).join('');
  LOG.forEach(l => delete l.fresh);
  $('#logCount').textContent = `${LOG.length} lancers`;
}
function toggleDock(open) { S.dockOpen = open; $('#dock').classList.toggle('open', open); $('#scrim').classList.toggle('open', open); }
$('#fab').addEventListener('click', () => toggleDock(true));
$('#scrim').addEventListener('click', () => toggleDock(false));
$('#dockClose').innerHTML = ic('x', 13); $('#dockClose').addEventListener('click', () => toggleDock(false));
$('#fabIco').innerHTML = ic('d20', 22);
const soundBtn = $('#soundBtn');
const paintSound = () => { soundBtn.innerHTML = ic(S.sound ? 'sound' : 'mute', 14); soundBtn.style.color = S.sound ? 'var(--orange-hi)' : ''; };
soundBtn.addEventListener('click', () => { S.sound = !S.sound; paintSound(); });

/* boot */
function boot() { MAPS.archives.img = ASSETS.blueprint = blueprint(); setFlaps(dTotal, '00'); paintSound(); updatePadCounts(); renderLog(); render(); requestAnimationFrame(fidLoop); }
document.addEventListener('DOMContentLoaded', boot);
