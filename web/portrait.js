/* Table Noire — portrait creator.
   One face model (parts + colours), drawn by eight hand-built art styles. No external library. */

document.head.insertAdjacentHTML('beforeend', `<style>
.modal-box.wide{width:min(940px,100%)}
.pt{position:relative;width:100%;height:100%;overflow:hidden;background:var(--ptbg,#efe7d5)}
.pt svg,.pt img{width:100%;height:100%;display:block}
.pt img.pix{object-fit:cover;image-rendering:pixelated}
.pt-digital::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 1px,transparent 1px 3px)}
.pcgrid{display:grid;grid-template-columns:250px minmax(0,1fr);gap:18px;align-items:start}
.pcleft{display:flex;flex-direction:column;gap:10px}
.pcprev{aspect-ratio:1;border-radius:6px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,240,215,.12),0 3px 0 #0b0a09}
.pcstyles{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.pcstyles button{display:flex;flex-direction:column;gap:3px;align-items:center;border:0;padding:3px 3px 5px;border-radius:6px;cursor:pointer;background:var(--plate);color:var(--mute);font:500 8.5px/1.15 var(--f-mono);text-align:center;box-shadow:inset 0 1px 2px rgba(0,0,0,.7)}
.pcstyles button .th{width:100%;aspect-ratio:1;border-radius:4px;overflow:hidden}
.pcstyles button[aria-pressed="true"]{color:var(--ink);box-shadow:0 0 0 2px var(--orange)}
.pcopts{display:flex;flex-direction:column;gap:7px;max-height:min(64vh,600px);overflow:auto;padding-right:6px}
.pcrow{display:grid;grid-template-columns:96px 26px minmax(0,1fr) 26px;gap:6px;align-items:center}
.pcrow>span,.pcsec{font:500 10px var(--f-mono);text-transform:uppercase;letter-spacing:.1em;color:var(--mute)}
.pcsec{margin-top:6px;padding-top:6px;border-top:1px solid var(--line);color:var(--cream-lo)}
.pcrow select{font:500 12.5px var(--f-body);padding:5px 6px;min-width:0}
.pccol{display:grid;grid-template-columns:96px minmax(0,1fr);gap:6px;align-items:center}
.pccol>span{font:500 10px var(--f-mono);text-transform:uppercase;letter-spacing:.1em;color:var(--mute)}
.pccol .swatches{flex-wrap:wrap}
.pccol input[type=color]{width:26px;height:24px;border:0;padding:0;background:none;cursor:pointer}
@media (max-width:680px){.pcgrid{grid-template-columns:1fr}}
</style>`);

/* ---------- colour helpers ---------- */
const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgbHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A.map((v, i) => v + (B[i] - v) * t)); };
const shade = (c, t) => mix(c, '#000000', t);
const lum = c => { const [r, g, b] = hexRgb(c); return (r * .3 + g * .59 + b * .11) / 255; };
const gray = c => { const l = Math.round(lum(c) * 255); return rgbHex([l, l, l]); };
function vivid(c, k = .9) { const [r, g, b] = hexRgb(c).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return c; return mix(gray(c), c, 1 + k * .8); }
const RETRO = ['#e2672c', '#4f8d89', '#d6a23c', '#efe0c4', '#8d6b9a', '#3a1f12'];
function retroize(c) { const A = hexRgb(c); let best = RETRO[0], bd = 1e9; RETRO.forEach(r => { const d = hexRgb(r).reduce((s, v, i) => s + (v - A[i]) ** 2, 0); if (d < bd) { bd = d; best = r; } }); return mix(c, best, .45); }
const E = (cx, cy, rx, ry) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;

/* ---------- part catalogue (viewBox 200×200, head centred at 100,90) ---------- */
const TORSO = 'M30 200C32 172 52 158 80 153L120 153C148 158 168 172 170 200Z';
const NECK = 'M87 128L87 157L113 157L113 128Z';
const PP = {
  face:{ lbl:'Visage', opts:[
    ['Ovale','M100 40C130 40 140 62 140 88C140 122 122 140 100 140C78 140 60 122 60 88C60 62 70 40 100 40Z'],
    ['Carré','M64 62C64 46 80 40 100 40C120 40 136 46 136 62L136 104C136 128 120 140 100 140C80 140 64 128 64 104Z'],
    ['Rond','M100 42C128 42 142 62 142 92C142 122 124 138 100 138C76 138 58 122 58 92C58 62 72 42 100 42Z'],
    ['Long','M100 36C126 36 136 58 136 84C136 124 120 146 100 146C80 146 64 124 64 84C64 58 74 36 100 36Z'],
    ['Menton pointu','M100 40C130 40 140 60 140 84C140 112 118 138 100 146C82 138 60 112 60 84C60 60 70 40 100 40Z'] ] },
  hair:{ lbl:'Coiffure', opts:[
    ['Rasé', { front:'M62 74C64 50 80 42 100 42C120 42 136 50 138 74C128 62 116 58 100 58C84 58 72 62 62 74Z', stub:true }],
    ['Court', { front:'M60 82C56 50 76 34 100 34C124 34 144 50 140 82C134 66 124 56 100 56C80 56 66 64 60 82Z', lines:['M84 40Q90 48 88 56','M110 38Q116 46 116 56'] }],
    ['Raie sur le côté', { front:'M60 86C54 48 78 32 102 32C128 32 146 50 140 86C138 70 132 58 118 52C104 62 80 62 66 66C63 72 61 78 60 86Z', lines:['M112 34L118 52'] }],
    ['Banane', { front:'M60 84C56 56 66 30 96 26C126 22 146 40 140 84C136 64 126 58 112 56C94 58 74 60 60 84Z', lines:['M80 40Q96 30 120 34','M84 48Q100 40 124 44'] }],
    ['Crête', { front:'M88 56L91 12L97 30L101 4L106 30L112 12L114 56C106 52 94 52 88 56Z', back:'M62 76C64 54 80 44 100 44C120 44 136 54 138 76C128 64 116 60 100 60C84 60 72 64 62 76Z', backStub:true }],
    ['Carré plongeant', { back:'M56 122C48 70 64 32 100 32C136 32 152 70 144 122L128 122C134 90 132 66 100 60C68 66 66 90 72 122Z', front:'M62 76C64 48 82 36 100 36C118 36 136 48 138 76C120 64 80 64 62 76Z' }],
    ['Long', { back:'M54 162C44 90 60 30 100 30C140 30 156 90 146 162L130 162C136 110 134 72 100 62C66 72 64 110 70 162Z', front:'M62 80C62 50 80 34 104 34C126 36 140 54 138 78C122 58 94 56 62 80Z', lines:['M60 100Q58 130 62 150','M140 100Q142 130 138 150'] }],
    ['Queue de cheval', { front:'M60 82C56 50 76 34 100 34C124 34 144 50 140 82C134 66 124 56 100 56C80 56 66 64 60 82Z', back:'M136 64C160 72 166 116 152 146C148 120 144 96 130 80Z' }],
    ['Chignon', { front:'M60 82C56 50 76 34 100 34C124 34 144 50 140 82C134 66 124 56 100 56C80 56 66 64 60 82Z', back:E(100, 28, 16, 14) }],
    ['Afro', { back:'M100 12C148 12 166 46 164 84C162 110 150 118 142 112C144 80 128 58 100 58C72 58 56 80 58 112C50 118 38 110 36 84C34 46 52 12 100 12Z' }],
    ['Boucles', { front:'M60 88C48 72 54 50 66 44C66 30 82 24 92 30C100 20 116 22 120 32C134 28 146 42 140 54C152 62 150 82 140 88C136 72 128 62 100 60C76 62 64 74 60 88Z', lines:['M74 50q6 4 2 10','M98 34q6 4 2 10','M122 44q6 4 2 10'] }],
    ['Mèche longue', { front:'M62 92C54 52 76 32 104 32C130 32 146 52 140 80C128 66 112 60 100 62C92 80 80 98 66 106C64 100 62 96 62 92Z' }],
    ['Dégarni', { back:'M60 98C58 76 62 64 70 60L74 98Z M140 98C142 76 138 64 130 60L126 98Z' }] ] },
  eyes:{ lbl:'Yeux', opts:[['Ronds','round'],['Amande','almond'],['Mi-clos','half'],['Grands','big'],['Plissés','squint']] },
  brows:{ lbl:'Sourcils', opts:[['Droits',{ d:'M76 79H92M108 79H124', w:1.6 }],['Arqués',{ d:'M76 81Q84 75 92 79M108 79Q116 75 124 81', w:1.6 }],['Froncés',{ d:'M76 76L92 82M124 76L108 82', w:1.7 }],['Épais',{ d:'M75 79Q84 76 93 79M107 79Q116 76 125 79', w:3.2 }],['Fins',{ d:'M77 80Q84 77 91 79M109 79Q116 77 123 80', w:.9 }]] },
  nose:{ lbl:'Nez', opts:[['Droit','M100 96L97 110Q100 112 104 110'],['Rond','M98 97Q96 106 95 110Q100 114 105 110'],['Pointu','M100 94L94 111L102 111'],['Large','M98 96L96 108Q93 112 98 113Q100 115 102 113Q107 112 104 108'],['Retroussé','M100 98Q99 106 96 109Q101 112 106 108']] },
  mouth:{ lbl:'Bouche', opts:[['Neutre',{ d:'M90 122Q100 124 110 122' }],['Sourire',{ d:'M88 119Q100 130 112 119' }],['Grand sourire',{ d:'M86 118Q100 136 114 118Q100 122 86 118Z', fill:true }],['Moue',{ d:'M90 125Q100 119 110 125' }],['Rictus',{ d:'M90 123Q102 124 112 117' }],['Étonnée',{ d:E(100, 123, 5, 6), fill:true }]] },
  beard:{ lbl:'Barbe', opts:[['Aucune',null],['Trois jours',{ d:'M66 100C68 128 84 142 100 142C116 142 132 128 134 100C128 118 114 128 100 128C86 128 72 118 66 100Z', stub:true }],['Courte',{ d:'M64 98C64 130 82 146 100 146C118 146 136 130 136 98C132 114 120 128 100 128C80 128 68 114 64 98Z' }],['Pleine',{ d:'M62 92C60 140 82 162 100 162C118 162 140 140 138 92C134 112 120 126 100 126C80 126 66 112 62 92Z' }],['Bouc',{ d:'M92 128C92 142 96 148 100 148C104 148 108 142 108 128Q100 132 92 128Z' }],['Collier',{ d:'M64 98C66 128 84 142 100 142C116 142 134 128 136 98L132 98C130 122 116 134 100 134C84 134 70 122 68 98Z' }]] },
  mustache:{ lbl:'Moustache', opts:[['Aucune',null],['Fine','M89 116Q100 112 111 116Q100 115 89 116Z'],['Épaisse','M86 118Q92 110 100 113Q108 110 114 118Q100 116 86 118Z'],['Guidon','M80 112Q84 118 92 115Q100 111 108 115Q116 118 120 112Q118 120 108 119Q100 116 92 119Q82 120 80 112Z'],['Pinceau','M90 118L92 111L108 111L110 118Z']] },
  acc:{ lbl:'Accessoire', opts:[['Aucun',null],
    ['Lunettes rondes',{ lines:[E(84, 90, 10, 10), E(116, 90, 10, 10), 'M94 90H106M74 89L62 87M126 89L138 87'] }],
    ['Lunettes carrées',{ lines:['M73 83H95V97H73ZM105 83H127V97H105Z','M95 89H105M73 88L62 86M127 88L138 86'] }],
    ['Lunettes de soleil',{ fills:[['M72 84Q84 80 96 84Q96 98 84 99Q72 98 72 84ZM104 84Q116 80 128 84Q128 98 116 99Q104 98 104 84Z','dark']], lines:['M96 86H104M72 86L62 84M128 86L138 84'] }],
    ['Monocle',{ fills:[[E(116, 90, 9, 9),'lens']], lines:[E(116, 90, 9, 9),'M125 93Q134 122 128 152'] }],
    ['Cache-œil',{ fills:[[E(116, 91, 10, 9),'dark']], lines:['M62 80L106 86M126 94L140 98'] }],
    ['Cicatrice',{ lines:['M120 76L128 106','M120 84L127 82','M122 92L129 90','M124 100L131 98'], lc:'scar' }],
    ['Piercings',{ lines:[E(105, 109, 2.6, 2.6), E(125, 80, 2.2, 2.2)], lc:'metal' }],
    ['Boucles d’oreilles',{ fills:[[E(60, 106, 3.4, 3.4),'metal'],[E(140, 106, 3.4, 3.4),'metal']] }],
    ['Casque audio',{ fills:[[E(57, 94, 8, 13),'cloth2'],[E(143, 94, 8, 13),'cloth2']], lines:['M57 84C52 34 148 34 143 84'], w:2.4 }],
    ['Visière',{ fills:[['M64 81H136Q138 96 128 101H72Q62 96 64 81Z','visor']], lines:['M64 81H136Q138 96 128 101H72Q62 96 64 81Z'] }] ] },
  clothes:{ lbl:'Vêtement', opts:[
    ['T-shirt',{ lines:['M84 155Q100 168 116 155'] }],
    ['Chemise',{ fills:[['M86 152L100 170L92 182L78 160Z','cloth2'],['M114 152L100 170L108 182L122 160Z','cloth2']], lines:['M100 172V200'] }],
    ['Costume cravate',{ fills:[['M86 152L100 192L114 152Z','white'],['M97 160L103 160L106 190L100 198L94 190Z','accent']], lines:['M80 154L100 196L72 200','M120 154L100 196L128 200'] }],
    ['Sweat à capuche',{ fills:[['M64 162C64 138 136 138 136 162C122 150 78 150 64 162Z','cloth']], lines:['M92 162V182','M108 162V182'] }],
    ['Blouson de cuir',{ fills:[['M78 154L92 178L74 188L60 166Z','cloth'],['M122 154L108 178L126 188L140 166Z','cloth']], lines:['M104 158L100 200','M78 154L92 178L74 188','M122 154L108 178L126 188'] }],
    ['Col roulé',{ fills:[['M84 132L84 158Q100 166 116 158L116 132Z','cloth']], lines:['M84 142Q100 148 116 142','M84 150Q100 156 116 150'] }],
    ['Combinaison spatiale',{ fills:[['M72 156Q100 180 128 156L128 165Q100 189 72 165Z','cloth2'],[E(127, 184, 7, 7),'accent']], lines:['M100 177V200','M60 176L76 200','M140 176L124 200'] }],
    ['Marinière',{ lines:['M46 174H154','M38 186H162','M32 197H168'], lc:'cloth2', w:3 }] ] }
};
const PSTY = {
  croquis:{ lbl:'Croquis forensic', line:'#2f2922', lw:1.25, fills:'wash', rough:1.2, sketch:true },
  corporate:{ lbl:'Corporate', line:null, lw:1.4, fills:'soft', simpleEyes:true, decor:'disc' },
  punk:{ lbl:'Punk', line:'#111111', lw:3.2, fills:'punk', rough:2.6, halftone:'#111111', decor:'punk' },
  line:{ lbl:'Trait', line:'#1d1a16', lw:2, fills:'none' },
  mini:{ lbl:'Minimaliste', line:null, lw:1.4, fills:'flat', minimal:true },
  digital:{ lbl:'Digitalisé', raster:true },
  retro:{ lbl:'Rétro-futuriste', line:'#3a1f12', lw:2.8, fills:'retro', halftone:'#a8461a', decor:'sunburst' },
  fifties:{ lbl:'Cartoon années 50', line:'#141210', lw:3.4, fills:'fifties', cartoonEyes:true, cheeks:true, misreg:true, decor:'dots' }
};
const PAL = {
  skin:['#f6dcc3','#eac39e','#d9a77c','#c08559','#9a6440','#74482b','#4e2f1c','#c9d4c5'],
  hairC:['#1d1a16','#2f2922','#5a3a22','#8a5a2b','#c08a3e','#e2c27a','#e7dcc4','#8e8e86','#b8452f','#ff2e7e','#4f8d89'],
  eyeC:['#3a2618','#5a4632','#7a6a3a','#4f7a3a','#3e6a8a','#6a8aa8','#8a8a8a','#b8452f'],
  cloth:['#4f8d89','#21405c','#2f2d29','#e7dcc4','#b8452f','#e2672c','#d6a23c','#86985a','#8d6b9a','#f2ede2','#141312','#6b4a2b'],
  bg:['#efe7d5','#e2d8c2','#2e2c28','#4f8d89','#e2672c','#d6a23c','#b8452f','#8d6b9a','#21405c','#ffffff']
};
const PCOLS = [['skin','Peau','skin'],['hairC','Cheveux & poils','hairC'],['eyeC','Yeux','eyeC'],['cloth','Vêtement','cloth'],['cloth2','Vêtement (2e)','cloth'],['accent','Détail','cloth']];
const PDEF = { face:0, hair:5, eyes:1, brows:1, nose:0, mouth:4, beard:0, mustache:0, acc:0, clothes:5, skin:'#eac39e', hairC:'#2f2922', eyeC:'#5a4632', cloth:'#4f8d89', cloth2:'#e7dcc4', accent:'#b8452f', bg:'#efe7d5' };

/* ---------- face model → layers ---------- */
function eyeLayers(type, cx, cy, st, add) {
  if (st.cartoonEyes) { add(E(cx, cy - 2, 8, 10), 'white', true, null, .9); add(E(cx + 1.5, cy, 4.2, 5.4), 'dark', false); add(`M${cx + 2} ${cy - 3.5}l3.2 -1.6v3.4z`, 'white', false); return; }
  if (st.minimal) { add(E(cx, cy, 2.6, 2.6), 'dark', false); return; }
  if (st.simpleEyes) { add(E(cx, cy, 3, 3.4), 'dark', false); return; }
  const hl = r => add(E(cx - r * .7, cy - r * .8, r * .45, r * .45), 'white', false);
  if (type === 'squint') { add(`M${cx - 7} ${cy + 1}Q${cx} ${cy - 4} ${cx + 7} ${cy + 1}`, null, true, 'dark', 1.4); return; }
  if (type === 'round') { add(E(cx, cy, 6.5, 6), 'white', true, null, .8); add(E(cx, cy, 3.4, 3.4), 'iris', false); add(E(cx, cy, 1.6, 1.6), 'dark', false); hl(2); return; }
  if (type === 'almond') { add(`M${cx - 8} ${cy}Q${cx} ${cy - 6.5} ${cx + 8} ${cy}Q${cx} ${cy + 5} ${cx - 8} ${cy}Z`, 'white', true, null, .8); add(E(cx, cy, 3, 3), 'iris', false); add(E(cx, cy, 1.4, 1.4), 'dark', false); hl(1.6); return; }
  if (type === 'half') { add(E(cx, cy + 1, 7, 4.2), 'white', true, null, .8); add(E(cx, cy + 1.6, 2.8, 2.8), 'iris', false); add(E(cx, cy + 1.6, 1.3, 1.3), 'dark', false); add(`M${cx - 8} ${cy - 1}Q${cx} ${cy - 3} ${cx + 8} ${cy - 1}`, null, true, 'dark', 1.8); return; }
  add(E(cx, cy, 8.5, 8), 'white', true, null, .8); add(E(cx, cy, 4.8, 4.8), 'iris', false); add(E(cx, cy, 2.3, 2.3), 'dark', false); hl(2.6);
}
function layersOf(p, st) {
  const Ls = [], add = (d, f, s = true, lc = null, w = 1, tag = '') => Ls.push({ d, f, s, lc, w, tag });
  const hair = PP.hair.opts[p.hair][1], cl = PP.clothes.opts[p.clothes][1], face = PP.face.opts[p.face][1];
  if (hair.back) add(hair.back, hair.backStub ? 'stub' : 'hair', !hair.backStub, null, 1, 'hair');
  add(TORSO, 'cloth', true, null, 1, 'cloth');
  add(NECK, 'shade', true, null, 1, 'neck');
  (cl.fills || []).forEach(([d, t]) => add(d, t, true));
  (cl.lines || []).forEach(d => add(d, null, true, cl.lc || 'dark', cl.w || .8, 'detail'));
  if (!st.minimal) { add(E(60, 92, 9, 11), 'skin', true); add(E(140, 92, 9, 11), 'skin', true); }
  add(face, 'skin', true, null, 1.1, 'face');
  if (st.cheeks) { add(E(76, 109, 6.5, 5), 'cheek', false); add(E(124, 109, 6.5, 5), 'cheek', false); }
  const bd = PP.beard.opts[p.beard][1]; if (bd) add(bd.d, bd.stub ? 'stub' : 'hair', !bd.stub);
  if (hair.front) add(hair.front, hair.stub ? 'stub' : 'hair', !hair.stub);
  if (!st.minimal) (hair.lines || []).forEach(d => add(d, null, true, 'hairShade', .7));
  if (!st.minimal) { const b = PP.brows.opts[p.brows][1]; add(b.d, null, true, 'hairShade', b.w); }
  const et = PP.eyes.opts[p.eyes][1]; eyeLayers(et, 84, 90, st, add); eyeLayers(et, 116, 90, st, add);
  add(st.minimal ? 'M100 104V110' : PP.nose.opts[p.nose][1], null, true, 'shade2', st.minimal ? .8 : 1);
  const mu = PP.mustache.opts[p.mustache][1]; if (mu) add(mu, 'hair', true);
  const m = PP.mouth.opts[p.mouth][1]; if (m.fill) add(m.d, 'mouthIn', true, null, 1.2); else add(m.d, null, true, 'lipLine', 1.3);
  const ac = PP.acc.opts[p.acc][1];
  if (ac) { (ac.fills || []).forEach(([d, t]) => add(d, t, false)); (ac.lines || []).forEach(d => add(d, null, true, ac.lc || 'dark', ac.w || 1.1)); }
  return Ls;
}
function fillFor(tok, p, st) {
  const base = { skin:p.skin, shade:shade(p.skin, .1), shade2:shade(p.skin, .32), hair:p.hairC, hairShade:shade(p.hairC, .25), stub:p.hairC, iris:p.eyeC, cloth:p.cloth, cloth2:p.cloth2, accent:p.accent, white:'#fbf7ee', dark:'#1d1a16', mouthIn:'#5a1f17', metal:'#c9bc9f', visor:'#4f8d89', lens:'#dfe9ea', cheek:'#e2735a', scar:shade(p.skin, .35), lipLine:shade(p.skin, .5) }[tok];
  if (!base) return null;
  let c = base; const o = tok === 'stub' ? .35 : tok === 'visor' ? .6 : tok === 'lens' ? .35 : tok === 'cheek' ? .55 : 1;
  switch (st.fills) {
    case 'none': return tok === 'dark' ? [st.line, 1] : null;
    case 'wash': if (!['white', 'dark', 'iris', 'mouthIn'].includes(tok)) c = mix(c, '#efe7d5', .55); break;
    case 'soft': c = mix(c, '#ffffff', .1); break;
    case 'flat': c = mix(mix(c, gray(c), .35), '#ffffff', .08); break;
    case 'punk': c = ['skin', 'shade', 'white', 'lens'].includes(tok) ? '#f4efe6' : tok === 'cloth' ? '#151312' : ['cloth2', 'accent', 'visor'].includes(tok) ? '#ff2e7e' : ['hair', 'hairShade', 'stub'].includes(tok) ? vivid(c) : c; break;
    case 'retro': if (!['white', 'dark', 'mouthIn'].includes(tok)) c = retroize(c); break;
    case 'fifties': c = tok === 'skin' || tok === 'shade' ? mix(c, '#f6d7b0', .35) : ['white', 'dark', 'mouthIn'].includes(tok) ? c : vivid(c, .7); break;
  }
  return [c, o];
}
function decorOf(st, p, id) {
  if (st.decor === 'disc') return `<circle cx="100" cy="104" r="82" fill="${mix(p.cloth, '#ffffff', .65)}"/>`;
  if (st.decor === 'punk') return `<path d="M14 26L188 14L182 186L20 194Z" fill="#f2d200"/><path d="M58 6L106 12L102 30L54 24Z" fill="#e7dcc4" opacity=".9"/><path d="M150 168L196 160L194 178L148 186Z" fill="#e7dcc4" opacity=".9"/>`;
  if (st.decor === 'sunburst') return Array.from({length:12}, (_, i) => { const a = i * Math.PI / 6, b = a + Math.PI / 12; return `<path d="M100 96L${(100 + Math.cos(a) * 170).toFixed(1)} ${(96 + Math.sin(a) * 170).toFixed(1)}L${(100 + Math.cos(b) * 170).toFixed(1)} ${(96 + Math.sin(b) * 170).toFixed(1)}Z" fill="#e2672c" opacity=".2"/>`; }).join('') + '<ellipse cx="100" cy="96" rx="94" ry="28" fill="none" stroke="#4f8d89" stroke-width="4" transform="rotate(-16 100 96)"/>';
  if (st.decor === 'dots') return `<pattern id="${id}d" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="2" fill="#b8452f" opacity=".32"/></pattern><rect width="200" height="200" fill="url(#${id}d)"/>`;
  return '';
}
let ptu = 0;
const rasterCache = new Map();
function rasterPortrait(p) {
  const key = JSON.stringify(p); if (rasterCache.has(key)) return rasterCache.get(key);
  const N = 54, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), st = PSTY.corporate, bg = hexRgb(p.bg);
  g.fillStyle = p.bg; g.fillRect(0, 0, N, N); g.save(); g.scale(N / 200, N / 200);
  for (const l of layersOf(p, st)) {
    if (l.f) { const fc = fillFor(l.f, p, st); if (fc) { g.globalAlpha = fc[1]; g.fillStyle = fc[0]; g.fill(new Path2D(l.d)); } }
    else if (l.lc) { g.globalAlpha = 1; g.strokeStyle = (fillFor(l.lc, p, st) || ['#1d1a16'])[0]; g.lineWidth = l.w * 3.4; g.lineCap = 'round'; g.stroke(new Path2D(l.d)); }
  }
  g.restore(); g.globalAlpha = 1;
  const im = g.getImageData(0, 0, N, N), d = im.data, q = v => Math.min(255, Math.round(v / 51) * 51), mask = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) mask[k] = Math.abs(d[k * 4] - bg[0]) + Math.abs(d[k * 4 + 1] - bg[1]) + Math.abs(d[k * 4 + 2] - bg[2]) < 40 ? 1 : 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x, i = k * 4;
    if (mask[k]) { d[i] = bg[0]; d[i + 1] = bg[1]; d[i + 2] = bg[2]; d[i + 3] = 255; continue; }
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx < 0 || yy < 0 || xx >= N || yy >= N || mask[yy * N + xx]; });
    for (let c = 0; c < 3; c++) d[i + c] = edge ? Math.round(q(d[i + c]) * .3) : q(d[i + c]); d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const html = `<img class="pix" src="${cv.toDataURL()}" alt="">`; rasterCache.set(key, html); return html;
}
function portraitSVG(p, style) {
  const st = PSTY[style] || PSTY.croquis;
  if (st.raster) return rasterPortrait(p);
  const id = 'pp' + (++ptu), Ls = layersOf(p, st), faceD = PP.face.opts[p.face][1];
  let defs = '', over = '';
  if (st.rough) defs += `<filter id="${id}r" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="${st.rough}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  if (st.halftone || st.sketch) {
    defs += `<clipPath id="${id}c"><path d="${faceD}"/><path d="${TORSO}"/></clipPath>`;
    defs += st.sketch ? `<pattern id="${id}h" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 5L5 0" stroke="#2f2922" stroke-width=".55"/></pattern>` : `<pattern id="${id}h" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.25" fill="${st.halftone}"/></pattern>`;
    over = `<rect x="108" y="30" width="70" height="170" fill="url(#${id}h)" opacity="${st.sketch ? .4 : .32}" clip-path="url(#${id}c)"/>`;
  }
  // draw layer by layer (fill then its own outline) so hidden parts stay hidden
  const sa = `fill="none" stroke-linecap="round" stroke-linejoin="round"${st.rough ? ` filter="url(#${id}r)"` : ''}`, mis = st.misreg ? ' transform="translate(2.6 2)"' : '';
  let body = '';
  const stroke = (d, col, w) => `<path d="${d}" ${sa} stroke="${col}" stroke-width="${w.toFixed(2)}"/>` + (st.sketch ? `<path d="${d}" ${sa} stroke="${col}" stroke-width="${(w * .7).toFixed(2)}" opacity=".45" transform="translate(.8 -.7)"/>` : '');
  for (const l of Ls) {
    if (l.f) { const fc = fillFor(l.f, p, st); if (fc) body += `<path d="${l.d}" fill="${fc[0]}"${fc[1] < 1 ? ` fill-opacity="${fc[1]}"` : ''}${mis}/>`; }
    if (l.s && st.line) body += stroke(l.d, st.line, st.lw * l.w);
    else if (!l.f && l.lc) body += stroke(l.d, (fillFor(l.lc, p, st) || ['#1d1a16'])[0], (st.lw || 1.4) * l.w * 1.8);
    if (l.tag === 'face') body += over;
  }
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMin slice" role="img" aria-label="Portrait ${st.lbl}"><defs>${defs}</defs>${decorOf(st, p, id)}${body}</svg>`;
}
const prender = (style, p, w) => `<div class="pt pt-${style}" style="--ptbg:${p.bg}">${portraitSVG(p, style)}</div>`;
function portraitHtml() {
  const c = C.portrait;
  if (c.type === 'img') return `<img src="${esc(c.src)}" alt="Portrait de ${esc(flv('Prénom'))}" style="width:100%;height:100%;object-fit:cover">`;
  if (!c.p) { c.style = 'croquis'; c.p = { ...PDEF }; }
  return prender(c.style, c.p);
}

/* ---------- editor ---------- */
function portraitModal() {
  const d = S.pcDraft, p = d.p, keep = $('#pcOpts') ? $('#pcOpts').scrollTop : 0;
  $('#modalBox').classList.add('wide');
  openModal(`<h3>Créateur de portrait</h3><div class="pcgrid">
    <div class="pcleft"><div class="pcprev">${prender(d.style, p)}</div>
      <div class="pcsec" style="border:0;margin:0">Style</div>
      <div class="pcstyles">${Object.entries(PSTY).map(([k, s]) => `<button data-act="pcStyle" data-s="${k}" aria-pressed="${d.style === k}"><span class="th">${prender(k, p)}</span>${s.lbl}</button>`).join('')}</div>
      <div class="pcsec" style="border:0;margin:0">Fond</div><span class="swatches">${PAL.bg.map(b => `<button style="--sw:${b}" data-act="pcColor" data-k="bg" data-c="${b}" aria-pressed="${p.bg === b}" aria-label="Fond ${b}"></button>`).join('')}</span></div>
    <div class="pcopts" id="pcOpts"><div class="pcsec" style="border:0;margin:0;padding:0">Traits</div>
      ${Object.entries(PP).map(([k, part]) => `<div class="pcrow"><span>${part.lbl}</span><button class="iconbtn" data-act="pcPart" data-k="${k}" data-d="-1" aria-label="${part.lbl} précédent">‹</button><select class="field" data-pcpart="${k}" aria-label="${part.lbl}">${part.opts.map((o, i) => `<option value="${i}" ${p[k] === i ? 'selected' : ''}>${o[0]}</option>`).join('')}</select><button class="iconbtn" data-act="pcPart" data-k="${k}" data-d="1" aria-label="${part.lbl} suivant">›</button></div>`).join('')}
      <div class="pcsec">Couleurs</div>
      ${PCOLS.map(([k, l, pal]) => `<div class="pccol"><span>${l}</span><span class="swatches">${PAL[pal].map(c => `<button style="--sw:${c}" data-act="pcColor" data-k="${k}" data-c="${c}" aria-pressed="${p[k] === c}" aria-label="${l} ${c}"></button>`).join('')}<input type="color" data-pccol="${k}" value="${p[k]}" aria-label="${l} : couleur personnalisée"></span></div>`).join('')}
    </div></div>
    <div class="modal-acts"><button class="btn" data-act="pcRandom">Aléatoire</button><span class="grow"></span><button class="btn" data-act="closeModal">Annuler</button><button class="btn orange" data-act="pcSave">Enregistrer</button></div>`);
  const o = $('#pcOpts'); if (o) o.scrollTop = keep;
}
function pcLive() { const d = S.pcDraft, pv = $('.pcprev'); if (pv) pv.innerHTML = prender(d.style, d.p); $$('.pcstyles button').forEach(b => { b.querySelector('.th').innerHTML = prender(b.dataset.s, d.p); }); }

const _closeModal = closeModal;
closeModal = function () { $('#modalBox').classList.remove('wide'); _closeModal(); };

Object.assign(ACT, {
  portraitCreate: () => { const c = C.portrait; S.pcDraft = { style:c.style || 'croquis', p:{ ...(c.p || PDEF) } }; portraitModal(); return false; },
  pcStyle: d => { S.pcDraft.style = d.s; sfx.flip(); portraitModal(); return false; },
  pcPart: d => { const p = S.pcDraft.p, n = PP[d.k].opts.length; p[d.k] = (p[d.k] + +d.d + n) % n; sfx.tick(1.1); portraitModal(); return false; },
  pcColor: d => { S.pcDraft.p[d.k] = d.c; portraitModal(); return false; },
  pcRandom: () => { const p = S.pcDraft.p, pick = a => a[Math.floor(Math.random() * a.length)]; for (const k in PP) p[k] = Math.floor(Math.random() * PP[k].opts.length); p.skin = pick(PAL.skin.slice(0, 7)); p.hairC = pick(PAL.hairC); p.eyeC = pick(PAL.eyeC); p.cloth = pick(PAL.cloth); p.cloth2 = pick(PAL.cloth); p.accent = pick(PAL.cloth); sfx.flip(); portraitModal(); return false; },
  pcSave: () => { C.portrait = { type:'gen', style:S.pcDraft.style, p:{ ...S.pcDraft.p } }; closeModal(); toast('Portrait enregistré'); }
});
document.addEventListener('change', e => { const t = e.target; if (!S.pcDraft) return; if (t.dataset.pcpart) { S.pcDraft.p[t.dataset.pcpart] = +t.value; pcLive(); } if (t.dataset.pccol) { S.pcDraft.p[t.dataset.pccol] = t.value; portraitModal(); } });
document.addEventListener('input', e => { const t = e.target; if (t.dataset.pccol && S.pcDraft) { S.pcDraft.p[t.dataset.pccol] = t.value; pcLive(); } });

$('#imgFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  readImage(f, 600, url => { if (S.imgPurpose === 'portrait') { C.portrait = { type:'img', src:url, style:C.portrait.style, p:C.portrait.p }; render(); toast('Portrait importé'); } });
  e.target.value = '';
});
