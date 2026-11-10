/* Table Noire — fidget widgets (loaded after the main script; uses its globals: S, ACT, L, $, $$, esc, ic, flapHtml, setFlaps, tile, toast) */

/* ---------- styles ---------- */
document.head.insertAdjacentHTML('beforeend', `<style>
.fid{display:flex;flex-direction:column;align-items:center;gap:9px;user-select:none;-webkit-user-select:none}
.fid-row{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap}
.readout{font:600 11px var(--f-mono);color:var(--mute);letter-spacing:.1em;text-transform:uppercase;text-align:center}
.readout.dim{color:var(--dim)}
.cv{display:block;width:100%;height:auto;border-radius:8px;touch-action:none}
.cv-dark{background:#11100e;box-shadow:inset 0 3px 8px rgba(0,0,0,.9)}
.engrave{font:400 8.5px/1 var(--f-display);letter-spacing:.2em;text-transform:uppercase;color:var(--dim)}
.sndbtn[aria-pressed="true"]{color:var(--orange-hi)}
@media (max-width:900px) and (min-width:521px){.bento .tile.compact{grid-column:span 6!important}}
.bento{grid-auto-rows:8px;align-items:start}.bento>.tile{grid-row:auto / span var(--rs,30)!important}
.bento.packed>.tile{grid-column:var(--gc)!important;grid-row:var(--gr)!important;align-self:stretch;display:flex;flex-direction:column}
.bento.packed>.tile>.tile-body{flex:1;display:flex;flex-direction:column}
.bento.packed>.tile.fidtile>.tile-body{justify-content:center}
.bento .cv{max-height:var(--cvmax,300px);object-fit:contain}
#cvInstr{--cvmax:190px}#cvScope{--cvmax:280px}#cvRadar{--cvmax:300px}#cvSpin{--cvmax:200px}

/* pads */
.pads{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:100%;max-width:240px}
.pad{aspect-ratio:1;border:0;border-radius:7px;cursor:pointer;background:linear-gradient(#3d3a35,#2c2a26);box-shadow:inset 0 1px 0 rgba(255,240,215,.1),inset 0 -3px 0 rgba(0,0,0,.25),0 3px 0 #0b0a09;transition:transform .05s,background .35s;touch-action:none}
.pad::after{content:"";display:block;width:6px;height:6px;margin:auto;border-radius:50%;background:var(--pc);opacity:.55}
.pad.hit{background:var(--pc);transform:translateY(3px);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 0 0 #0b0a09;transition:transform .05s,background 0s}

/* tamagotchi */
.tbezel{width:100%;max-width:300px;padding:9px;border-radius:9px;background:var(--plate);box-shadow:inset 0 2px 5px rgba(0,0,0,.8),0 1px 0 rgba(255,240,215,.06)}
.tlcd{display:block;width:100%;height:auto;image-rendering:pixelated;border-radius:4px;box-shadow:inset 0 2px 6px rgba(0,0,0,.4)}
.tpick{display:grid;grid-template-columns:26px minmax(0,1fr) 26px;gap:6px;align-items:center;width:100%;max-width:300px}
.tpick b{font:500 12px var(--f-mono);text-align:center;color:var(--cream);letter-spacing:.08em;text-transform:uppercase}
.tmenu{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;width:100%;max-width:300px}
.tmenu .btn{justify-content:center;padding-inline:4px;min-width:0}
.tstats{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;width:100%;max-width:300px;font:600 9.5px var(--f-mono);color:var(--mute);letter-spacing:.08em;align-items:center}
.tstats .sb{height:7px;border-radius:2px;background:#12110e;box-shadow:inset 0 1px 2px rgba(0,0,0,.8);overflow:hidden}
.tstats .sb i{display:block;height:100%;transition:width .5s;background:var(--c)}
.tmsg{font:500 11.5px var(--f-mono);color:var(--cream-lo);min-height:1.5em;text-align:center}

/* switch panel */
.panel{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;width:100%}
.psec{display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 8px;border-radius:8px;background:var(--well);box-shadow:inset 0 2px 5px rgba(0,0,0,.6)}
.prow{display:flex;gap:9px;align-items:flex-end;justify-content:center;flex-wrap:wrap}
.tg{display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;cursor:pointer;padding:0}
.tg .slot{position:relative;width:22px;height:42px;border-radius:11px;background:#0e0d0b;box-shadow:inset 0 2px 5px rgba(0,0,0,.9)}
.tg .lever{position:absolute;left:3px;right:3px;top:21px;height:18px;border-radius:9px;background:linear-gradient(#efe6d2,#bfb294);box-shadow:inset 0 1px 0 #fff,0 2px 3px rgba(0,0,0,.6);transition:top .14s cubic-bezier(.3,1.7,.5,1)}
.tg.on .lever{top:3px}
.bulb{width:8px;height:8px;border-radius:50%;background:#2a2824;box-shadow:inset 0 1px 1px rgba(0,0,0,.7);transition:background .1s}
.on>.bulb,.bulb.on{background:var(--bc,var(--olive));box-shadow:0 0 4px var(--bc,rgba(134,152,90,.8))}
.rock{width:30px;height:44px;border:0;border-radius:5px;cursor:pointer;background:#141310;box-shadow:inset 0 2px 4px rgba(0,0,0,.9);padding:3px;perspective:80px}
.rock i{display:block;height:100%;border-radius:3px;background:linear-gradient(var(--rc) 0 50%,color-mix(in srgb,var(--rc) 70%,#000) 50%);transform:rotateX(14deg);transition:transform .12s cubic-bezier(.3,1.6,.5,1);box-shadow:0 2px 2px rgba(0,0,0,.5)}
.rock.on i{transform:rotateX(-14deg);background:linear-gradient(color-mix(in srgb,var(--rc) 70%,#000) 0 50%,var(--rc) 50%)}
.rot{position:relative;width:62px;height:62px;border-radius:50%;border:0;cursor:pointer;background:radial-gradient(circle at 40% 30%,#4a463f,#24221e 70%);box-shadow:inset 0 2px 1px rgba(255,255,255,.12),0 3px 0 #0b0a09}
.rot::after{content:"";position:absolute;left:50%;top:5px;width:4px;height:16px;margin-left:-2px;border-radius:2px;background:var(--cream);transform-origin:2px 26px;transform:rotate(var(--ra));transition:transform .18s cubic-bezier(.3,1.6,.5,1)}
.rotlab{display:flex;justify-content:space-between;width:86px;font:500 8.5px var(--f-mono);color:var(--dim)}
.rotlab b{color:var(--orange-hi);font-weight:600}
.slide{position:relative;width:78px;height:22px;border:0;border-radius:11px;cursor:pointer;background:#0e0d0b;box-shadow:inset 0 2px 4px rgba(0,0,0,.9)}
.slide i{position:absolute;top:3px;width:24px;height:16px;border-radius:8px;left:calc(3px + var(--sp) * 25px);background:linear-gradient(#efe6d2,#bfb294);box-shadow:inset 0 1px 0 #fff,0 2px 2px rgba(0,0,0,.5);transition:left .15s cubic-bezier(.3,1.6,.5,1)}
.pot{position:relative;width:40px;height:40px;border-radius:50%;cursor:ns-resize;touch-action:none;background:radial-gradient(circle at 40% 30%,#efe6d2,#bfb294 70%);box-shadow:0 3px 0 #6e6555,0 4px 6px rgba(0,0,0,.4)}
.pot::after{content:"";position:absolute;left:50%;top:4px;width:3px;height:12px;margin-left:-1.5px;border-radius:2px;background:#2a241c;transform-origin:1.5px 16px;transform:rotate(var(--pa))}
.push{width:30px;height:30px;border-radius:50%;border:0;cursor:pointer;background:radial-gradient(circle at 40% 30%,color-mix(in srgb,var(--bc) 70%,#fff),var(--bc) 60%,color-mix(in srgb,var(--bc) 60%,#000));box-shadow:0 4px 0 color-mix(in srgb,var(--bc) 40%,#000),0 5px 6px rgba(0,0,0,.4);transition:transform .06s,box-shadow .06s}
.push.on{transform:translateY(3px);box-shadow:0 1px 0 color-mix(in srgb,var(--bc) 40%,#000),0 0 8px var(--bc)}
.keysw{position:relative;width:50px;height:50px;border-radius:50%;border:0;cursor:pointer;background:radial-gradient(circle at 40% 30%,#d9cdb2,#8d8270 70%);box-shadow:0 3px 0 #4a443a,inset 0 0 0 4px #5a554c,inset 0 0 0 6px #2a2824}
.keysw i{position:absolute;left:50%;top:50%;width:8px;height:28px;margin:-14px 0 0 -4px;border-radius:2px;background:linear-gradient(90deg,#f6eedc,#a89c80);box-shadow:0 1px 2px rgba(0,0,0,.5);transform:rotate(-90deg);transition:transform .28s cubic-bezier(.3,1.6,.5,1)}
.keysw i::before{content:"";position:absolute;left:-7px;top:-12px;width:22px;height:14px;border-radius:7px;background:linear-gradient(#f6eedc,#a89c80);box-shadow:0 1px 2px rgba(0,0,0,.4)}
.keysw.on i{transform:rotate(0deg)}
.keylab{display:flex;justify-content:space-between;width:64px;font:500 8.5px var(--f-mono);color:var(--dim)}
.keylab b{color:var(--olive);font-weight:600}
.pmeter{width:124px;height:72px}
.ledbar{display:flex;gap:5px}
.ledbar .bulb{width:10px;height:10px}

/* timer */
.tmflaps .flap{width:30px;height:44px;font-size:28px}
.tmflaps .flap.sep{width:12px;background:none;box-shadow:none}
.tmflaps .flap.sep::after{display:none}
.tmflaps.done .flap{color:var(--orange-hi)}
.tmbar{display:flex;gap:3px;width:100%;max-width:240px;height:12px;padding:2px;border-radius:4px;background:#0e0d0b;box-shadow:inset 0 1px 3px rgba(0,0,0,.9)}
.tmbar i{flex:1;border-radius:1px;background:#24221e}
.tmbar i.lit{background:linear-gradient(#f08046,#e2672c)}
.tile.shaking{animation:shake .4s}

/* radar */
.rdctl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 10px;width:100%;align-items:end}
.rdctl label{display:flex;flex-direction:column;gap:3px;font:500 9.5px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.rdctl input[type=range]{width:100%;accent-color:var(--orange)}

/* instruments */
.instr{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;width:100%;align-items:center}
.iknobs{display:flex;flex-direction:column;gap:10px;align-items:center}
.iknob{position:relative;width:62px;height:62px;border-radius:50%;cursor:ns-resize;touch-action:none;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.04) 0 6deg,transparent 6deg 12deg),radial-gradient(circle at 40% 30%,#4a463f,#24221e 70%);box-shadow:inset 0 2px 1px rgba(255,255,255,.12),0 3px 0 #0b0a09,0 6px 10px rgba(0,0,0,.45)}
.iknob::after{content:"";position:absolute;left:50%;top:5px;width:3px;height:14px;margin-left:-1.5px;border-radius:2px;background:var(--orange);transform-origin:1.5px 26px;transform:rotate(var(--ka))}
.geiger{display:flex;align-items:center;gap:8px;justify-content:center;padding:6px 10px;border-radius:6px;background:#100f0d;box-shadow:inset 0 2px 5px rgba(0,0,0,.9)}
.geiger b{font:600 18px var(--f-mono);color:var(--cream);font-variant-numeric:tabular-nums;min-width:5ch;text-align:right}
.gled{width:10px;height:10px;border-radius:50%;background:#3a1a12;transition:background .05s}
.gled.on{background:#ff6a3d;box-shadow:0 0 6px #ff6a3d}
.ovl{font:600 10px var(--f-mono);letter-spacing:.14em;color:#3a1a12;padding:3px 6px;border-radius:3px;background:#1b1a17}
.ovl.on{color:#fff;background:var(--rust);animation:blink .3s steps(1) infinite}
@keyframes blink{50%{opacity:.35}}

/* counters */
.cnts{display:flex;flex-direction:column;gap:7px;width:100%}
.cnt{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto auto;gap:5px;align-items:center}
.cnt input{min-width:0;font:500 12px var(--f-body);padding:5px 7px}
.cnt .odo .flap{width:16px;height:24px;font-size:14px}

/* fader */
.sfader{position:relative;width:100%;height:40px;touch-action:none;cursor:ew-resize}
.sfader .tr{position:absolute;left:12px;right:12px;top:18px;height:4px;border-radius:2px;background:#0e0d0b;box-shadow:inset 0 1px 2px rgba(0,0,0,.9)}
.sfader .nt{position:absolute;top:28px;width:1px;height:5px;background:#3a3732}
.sfader .cap{position:absolute;top:5px;width:22px;height:30px;margin-left:-11px;border-radius:5px;background:linear-gradient(#efe6d2,#bfb294);box-shadow:inset 0 1px 0 #fff,0 3px 0 #6e6555,0 4px 6px rgba(0,0,0,.4);transform:scaleX(var(--sq,1))}
.sfader .cap::after{content:"";position:absolute;left:4px;right:4px;top:14px;height:2px;background:var(--orange)}
.sled{width:8px;height:8px;border-radius:50%;background:var(--orange);opacity:var(--gl,.15);box-shadow:0 0 calc(var(--gl,0) * 8px) var(--orange)}

/* scope */
.scopectl{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px 10px;width:100%}
.scopectl label{display:flex;flex-direction:column;gap:3px;font:500 9.5px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.scopectl input[type=range]{width:100%;accent-color:var(--orange)}
.scopectl select{font:500 12px var(--f-body)}
.scopectl .chk{flex-direction:row;align-items:center;gap:6px}
</style>`);

/* ---------- audio (each widget is muted until its own speaker button is switched on) ---------- */
const FX = (() => {
  let ctx = null, hum = null;
  const ac = () => { if (!S.sound) return null; try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch (_) { return null; } };
  const tone = (f, d, type = 'sine', g = .05, at = 0) => { const c = ac(); if (!c) return; const t = c.currentTime + at, o = c.createOscillator(), v = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + .005); v.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(v).connect(c.destination); o.start(t); o.stop(t + d + .02); };
  const noise = (d, g, freq, q = 1) => { const c = ac(); if (!c) return; const len = Math.max(1, Math.floor(c.sampleRate * d)), buf = c.createBuffer(1, len, c.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2); const s = c.createBufferSource(), f = c.createBiquadFilter(), v = c.createGain(); s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; v.gain.value = g; s.connect(f).connect(v).connect(c.destination); s.start(); };
  return {
    tone, noise,
    click: (g = .3, f = 2400) => noise(.012, g, f, 2),
    clack: () => { noise(.03, .45, 900); tone(140, .04, 'square', .02); },
    note: f => { tone(f, .7, 'triangle', .08); tone(f * 2, .5, 'sine', .022); },
    hum: (level, freq) => {
      if (!hum && level <= 0) return;
      const c = ac();
      if (!c) { if (hum) hum.g.gain.value = 0; return; }
      if (!hum) { const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 520; g.gain.value = 0; o.connect(f).connect(g).connect(c.destination); o.start(); hum = { o, f, g }; }
      hum.o.frequency.setTargetAtTime(freq, c.currentTime, .05); hum.g.gain.setTargetAtTime(level, c.currentTime, .08);
    }
  };
})();
const NOFX = { tone(){}, noise(){}, click(){}, clack(){}, note(){}, hum(){ FX.hum(0, 40); } };
const sf = id => (S.fidSound && S.fidSound[id]) ? FX : NOFX;

/* ---------- helpers ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cpos = (e, cv) => { const r = cv.getBoundingClientRect(); return { x:(e.clientX - r.left) * cv.width / r.width, y:(e.clientY - r.top) * cv.height / r.height }; };
const rnd = (a, b) => a + Math.random() * (b - a);
function refreshFid(id) { const b = $(`[data-tile="${id}"] .tile-body`); if (b) b.innerHTML = FIDS[id].body(); }
const sndBtn = id => { const on = !!S.fidSound[id]; return `<button class="iconbtn sndbtn" data-act="fidSnd" data-id="${id}" aria-pressed="${on}" title="${on ? 'Couper' : 'Activer'} le son de ce widget" aria-label="${on ? 'Couper' : 'Activer'} le son de ce widget">${ic(on ? 'sound' : 'mute', 13)}</button>`; };
function fidLibChips() { return Object.keys(FIDS).filter(id => !L().order.includes(id)).map(id => `<span class="libchip" draggable="true" data-lib="fid:${id}">${FIDS[id].title}</span>`).join(''); }

/* bento packing: natural heights -> browser placement -> each tile grows to fill the free cells around it */
const BROW = 8, BGAP = 14;
function packBento(pass = 0) {
  const grid = $('#bento'); if (!grid) return;
  grid.classList.remove('packed');
  const tiles = $$('#bento > .tile'); if (!tiles.length) return;
  tiles.forEach(t => t.style.setProperty('--rs', Math.ceil((Math.max(t.offsetHeight, t._minH || 0) + BGAP) / (BROW + BGAP))));
  const gr = grid.getBoundingClientRect(), cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length, colW = (gr.width - (cols - 1) * BGAP) / cols;
  const info = tiles.map(t => { const r = t.getBoundingClientRect(), c0 = Math.round((r.left - gr.left) / (colW + BGAP)), c1 = Math.max(c0 + 1, Math.round((r.right - gr.left + BGAP) / (colW + BGAP))), r0 = Math.round((r.top - gr.top) / (BROW + BGAP)); return { t, c0, c1, r0, r1:r0 + +t.style.getPropertyValue('--rs') }; });
  const bottom = Math.max(...info.map(i => i.r1));
  // grow downward to the next tile in the same columns, or to the grid bottom
  info.forEach(i => { let end = bottom; info.forEach(o => { if (o !== i && o.r0 >= i.r1 && o.c0 < i.c1 && o.c1 > i.c0) end = Math.min(end, o.r0); }); i.r1 = end; });
  // grow sideways into empty columns
  const occ = Array.from({ length:bottom }, () => new Array(cols).fill(null));
  info.forEach(i => { for (let r = i.r0; r < i.r1; r++) for (let c = i.c0; c < i.c1; c++) occ[r][c] = i; });
  const free = (c, i) => c >= 0 && c < cols && occ.slice(i.r0, i.r1).every(row => !row[c]);
  info.forEach(i => { while (free(i.c1, i)) { occ.slice(i.r0, i.r1).forEach(row => { row[i.c1] = i; }); i.c1++; } while (free(i.c0 - 1, i)) { i.c0--; occ.slice(i.r0, i.r1).forEach(row => { row[i.c0] = i; }); } });
  info.forEach(i => { i.t.style.setProperty('--gc', `${i.c0 + 1} / ${i.c1 + 1}`); i.t.style.setProperty('--gr', `${i.r0 + 1} / ${i.r1 + 1}`); });
  grid.classList.add('packed');
  // a tile that got wider may need more height: grow it and pack again (bounded)
  let again = false;
  tiles.forEach(t => { if (t.scrollHeight > t.clientHeight + 2) { t._minH = t.scrollHeight; again = true; } });
  if (again && pass < 3) packBento(pass + 1);
}
let packRaf = 0;
const schedulePack = () => { cancelAnimationFrame(packRaf); packRaf = requestAnimationFrame(() => requestAnimationFrame(packBento)); };
new MutationObserver(ms => { if (ms.some(m => [...m.addedNodes, ...m.removedNodes].some(n => n.nodeType === 1))) schedulePack(); }).observe($('#main'), { childList:true, subtree:true });
window.addEventListener('resize', schedulePack);
document.addEventListener('load', e => { if (e.target.tagName === 'IMG' && e.target.closest('#bento')) schedulePack(); }, true);
if (document.fonts) document.fonts.ready.then(schedulePack);

/* speaker buttons + widget class after each render */
const _renderBase = render;
render = function () {
  _renderBase();
  for (const id in FIDS) { const tl = $(`[data-tile="${id}"]`); if (!tl) continue; tl.classList.add('fidtile'); if (!S.layoutEdit && !FIDS[id].silent) tl.querySelector('.tile-head').insertAdjacentHTML('beforeend', sndBtn(id)); }
  schedulePack();
};

/* ---------- state ---------- */
const F = {
  spin:{ a:0, v:0, drag:null, model:0, color:0, best:0, sparks:[], seg:0, lastT:0 },
  tama:{ animal:0, food:72, joy:66, poop:0, x:26, dir:1, frame:0, anim:null, animT:0, born:Date.now(), clock:20, blink:0, visitor:null, ball:0, msg:'Bip te salue.', lastBday:0 },
  panel:{ tog:[false, true, false], rock:[true, false], rot:1, slide:0, pots:[30, 70], push:[false, true, false], key:true },
  timer:{ mode:'down', total:60, left:60, up:0, running:false, done:false, shown:'' },
  radar:{ a:0, speed:1, range:1, mode:0, contacts:[], pings:[], next:0, seq:11 },
  instr:{ k:[40, 55], drag:null, vu:[0, 0], vuv:[0, 0], g:0, gv:0, cps:0, count:0, flash:0, t:0 },
  counters:[{ label:'Jets ratés', n:3 }, { label:'Cafés', n:2 }],
  fader:{ x:0, v:0, drag:false, notch:0 },
  scope:{ mode:'liss', color:'#e9a64a', fx:3, fy:2, speed:1, persist:.75, width:2.2, noise:0, grid:true, glow:false, t:0 }
};
const PADF = [261.6,311.1,349.2,392,466.2,523.3,622.3,698.5,784,932.3,1046.5,1244.5,1396.9,1568,1864.7,2093];
const PADC = ['#e2672c','#d6a23c','#86985a','#4f8d89','#8d6b9a','#b8452f'];
const SPIN_MODELS = ['Tri', 'Étoile', 'Duo'], SPIN_COLORS = ['#e2672c', '#4f8d89', '#d6a23c', '#b8452f', '#8d6b9a', '#e7dcc4'];
const SCOPE_COLORS = [['#e9a64a','Ambre'],['#8fd16a','Vert P1'],['#5fd3d0','Cyan'],['#f07aa8','Rose'],['#f2ede2','Blanc'],['#ff5a3c','Rouge']];
const RADAR_COLORS = ['#e9a64a', '#5fd3d0'];

/* ---------- Bip: animals (12×11 pixel sprites, two leg frames) ---------- */
const ANIMALS = [
  { n:'Chat', rows:['.X......X...','.XX....XX...','.X.XXXX.X...','.X......X...','X..X..X..X..','X........X.X','X...XX...X.X','.X......X.X.','.XXXXXXXX.X.','.X......X...'], legs:['.X.X..X.X...','..XX..XX....'], eyes:[[3,4],[6,4]] },
  { n:'Chien', rows:['............','.XX....XX...','X.XXXXXX.X..','X........X..','.X.X..X.X...','.X......X...','.X..XX..X...','..X.XX.X....','.XXXXXXXX.X.','.X......XX..'], legs:['.X.X..X.X...','..X.X..X.X..'], eyes:[[3,4],[6,4]] },
  { n:'Blob', rows:['............','............','...XXXXX....','..X.....X...','.X.X...X.X..','.X.......X..','X...XXX...X.','X.........X.','X.........X.','.X.......X..'], legs:['..XXXXXXX...','.XXXXXXXXX..'], eyes:[[3,4],[7,4]] },
  { n:'Panda', rows:['.XX.....XX..','.XXXXXXXXX..','X.........X.','X.XXX.XXX.X.','X.X.X.X.X.X.','X....X....X.','X...XXX...X.','.X.......X..','.XXXXXXXXX..','XX.X...X.XX.'], legs:['XX.......XX.','.XX.....XX..'], eyes:[[3,4],[7,4]], inv:true },
  { n:'Souris', rows:['XX......XX..','X.X....X.X..','XX.XXXX.XX..','..X....X....','.X.X..X.X...','.X......X...','..X.XX.X....','...XXXX.....','..X....X..X.','..XXXXXX.X..'], legs:['..X.X.X.X...','...X.X.X....'], eyes:[[3,4],[6,4]] },
  { n:'Cthulhu', rows:['...XXXXX....','..X.....X...','.X.......X..','.X.X...X.X..','.X.......X..','..X.....X...','...XXXXX....','..X.X.X.X...','.X.X.X.X.X..','X.X.X.X.X.X.'], legs:['X..X...X..X.','.X..X.X..X..'], eyes:[[3,3],[7,3]] }
];
const TPX = {
  poop:['..X..','.X.X.','.XXX.','X.X.X','XXXXX'],
  food:['.XXX.','XXXXX','XX.XX','XXXXX','.XXX.'],
  heart:['X.X','XXX','.X.'],
  cloud:['.XXX..','XXXXXX','.XXXX.'],
  cake:['..X.X..','..X.X..','XXXXXXX','X.X.X.X','XXXXXXX'],
  moon:['.XX','X..','X..','.XX'],
  sun:['.X.X.','..X..','XXXXX','..X..','.X.X.'],
  fly:['X.X','.X.']
};

/* ---------- tile definitions ---------- */
const FIDS = {
  fid_spinner:{ title:'Hand spinner', compact:true, body:() => `<div class="fid"><canvas class="cv" id="cvSpin" width="440" height="440" style="max-width:200px;cursor:grab" aria-label="Hand spinner : lance-le d’un geste, clique pour l’accélérer"></canvas>
    <div class="fid-row"><span class="readout" id="spinRpm">0 tr/min</span><span class="readout dim" id="spinBest">record ${F.spin.best}</span></div>
    <div class="fid-row"><button class="btn xs" data-act="spinModel">${SPIN_MODELS[F.spin.model]}</button><button class="btn xs" data-act="spinColor"><span class="bulb on" style="--bc:${SPIN_COLORS[F.spin.color]}"></span>Couleur</button></div></div>` },
  fid_pads:{ title:'Pads musicaux', compact:true, body:() => `<div class="fid"><div class="pads">${PADF.map((f, i) => `<button class="pad" data-pad="${i}" style="--pc:${PADC[i % 6]}" aria-label="Pad ${i + 1}"></button>`).join('')}</div><div class="readout">Pentatonique · do mineur</div></div>` },
  fid_tama:{ title:'Bip', compact:true, body:() => { const t = F.tama;
    return `<div class="fid" style="width:100%"><div class="tpick"><button class="iconbtn" data-act="tamaAnimal" data-d="-1" aria-label="Animal précédent">‹</button><b>${ANIMALS[t.animal].n}</b><button class="iconbtn" data-act="tamaAnimal" data-d="1" aria-label="Animal suivant">›</button></div>
      <div class="tbezel"><canvas class="tlcd" id="cvTama" width="256" height="160" aria-label="Écran de Bip"></canvas></div>
      <div class="tmenu"><button class="btn xs" data-act="tamaFeed">Nourrir</button><button class="btn xs" data-act="tamaPlay">Jouer</button><button class="btn xs" data-act="tamaClean">Nettoyer</button></div>
      <div class="tstats"><span>Faim</span><div class="sb" style="--c:#d6a23c"><i id="ts-food" style="width:${t.food}%"></i></div><span>Joie</span><div class="sb" style="--c:#e2672c"><i id="ts-joy" style="width:${t.joy}%"></i></div></div>
      <div class="tmsg" id="tamaMsg">${esc(t.msg)}</div></div>`; } },
  fid_fader:{ title:'Ressort', compact:true, body:() => `<div class="fid" style="gap:6px;width:100%"><div class="sfader" id="sFader">${[1,2,3,4,5,6,7,8,9].map(i => `<span class="nt" style="left:calc(12px + (100% - 24px) * ${i / 10})"></span>`).join('')}<div class="tr"></div><div class="cap" id="sCap" style="left:50%"></div></div><span class="sled" id="sLed"></span></div>` },
  fid_panel:{ title:'Tableau de commande', body:() => { const p = F.panel, bits = [...p.tog, ...p.rock, ...p.push];
    return `<div class="panel">
      <div class="psec"><span class="engrave">Circuits</span><div class="prow">${p.tog.map((on, i) => `<button class="tg ${on?'on':''}" data-act="pTog" data-i="${i}" aria-pressed="${on}" aria-label="Interrupteur ${i + 1}"><span class="bulb"></span><span class="slot"><span class="lever"></span></span></button>`).join('')}</div></div>
      <div class="psec"><span class="engrave">Bascules</span><div class="prow">${p.rock.map((on, i) => `<button class="rock ${on?'on':''}" data-act="pRock" data-i="${i}" style="--rc:${i ? '#2f2d29' : '#b8452f'}" aria-pressed="${on}" aria-label="Bascule ${i + 1}"><i></i></button>`).join('')}</div></div>
      <div class="psec"><span class="engrave">Sélecteur</span><button class="rot" data-act="pRot" style="--ra:${-60 + p.rot * 40}deg" aria-label="Sélecteur, position ${['OFF','I','II','III'][p.rot]}"></button><div class="rotlab">${['OFF','I','II','III'].map((l, i) => i === p.rot ? `<b>${l}</b>` : `<span>${l}</span>`).join('')}</div></div>
      <div class="psec"><span class="engrave">Mode</span><button class="slide" data-act="pSlide" style="--sp:${p.slide}" aria-label="Glissière, position ${p.slide + 1}"><i></i></button><span class="readout dim">${['ÉCO','NORM','TURBO'][p.slide]}</span></div>
      <div class="psec"><span class="engrave">Trim</span><div class="prow">${p.pots.map((v, i) => `<div class="pot" data-pot="${i}" style="--pa:${-135 + v * 2.7}deg" role="slider" aria-label="Potentiomètre ${i + 1}" aria-valuenow="${v}"></div>`).join('')}</div><span class="readout dim" id="potVal">${p.pots.join(' · ')}</span></div>
      <div class="psec"><span class="engrave">Mémoires</span><div class="prow">${p.push.map((on, i) => `<button class="push ${on?'on':''}" data-act="pPush" data-i="${i}" style="--bc:${['#b8452f','#86985a','#d6a23c'][i]}" aria-pressed="${on}" aria-label="Bouton ${i + 1}"></button>`).join('')}</div></div>
      <div class="psec" style="grid-column:span 2"><span class="engrave">Alimentation</span><div class="prow" style="align-items:center;gap:18px"><div style="display:flex;flex-direction:column;align-items:center;gap:5px"><button class="keysw ${p.key?'on':''}" data-act="pKey" aria-pressed="${p.key}" aria-label="Clé d’alimentation, ${p.key ? 'sous tension' : 'coupée'}"><i></i></button><div class="keylab">${p.key ? '<span>OFF</span><b>ON</b>' : '<b style="color:var(--rust)">OFF</b><span>ON</span>'}</div></div>${panelMeter()}</div></div>
      <div class="psec"><span class="engrave">Bus</span><div class="ledbar">${bits.map(b => `<span class="bulb ${b && p.key?'on':''}" style="--bc:${['#86985a','#d6a23c','#e2672c'][p.slide]}"></span>`).join('')}</div><span class="readout dim">${parseInt(bits.map(Number).join(''), 2).toString(16).toUpperCase().padStart(2, '0')}h</span></div>
    </div>`; } },
  fid_timer:{ title:'Minuteur de tour', compact:true, body:() => { const t = F.timer, down = t.mode === 'down';
    return `<div class="fid" style="width:100%"><div class="odo tmflaps ${t.done ? 'done' : ''}" id="tmFlaps">${timerFlaps()}</div>
      <div class="tmbar" id="tmBar">${Array.from({length:20}, (_, i) => `<i class="${down && i < Math.round(t.left / t.total * 20) ? 'lit' : ''}"></i>`).join('')}</div>
      ${down ? `<div class="fid-row">${[[30,'30 s'],[60,'1 min'],[120,'2 min'],[300,'5 min']].map(([v, l]) => `<button class="btn xs ${t.total === v ? 'on' : ''}" data-act="tmSet" data-v="${v}">${l}</button>`).join('')}</div>` : ''}
      <div class="fid-row"><button class="btn xs orange" data-act="tmGo">${t.running ? 'Pause' : 'Départ'}</button>${down ? `<button class="btn xs" data-act="tmAdd">+10 s</button>` : ''}<button class="btn xs" data-act="tmReset">Remise à zéro</button><button class="btn xs" data-act="tmMode">${down ? 'Chrono' : 'Minuteur'}</button></div></div>`; } },
  fid_radar:{ title:'Radar', compact:true, body:() => { const r = F.radar;
    return `<div class="fid" style="width:100%"><canvas class="cv cv-dark" id="cvRadar" width="560" height="560" style="max-width:300px;cursor:crosshair;border-radius:50%" aria-label="Écran radar : clique pour émettre une impulsion et identifier les contacts"></canvas>
      <div class="rdctl"><label>Portée<select class="field" data-radar="range">${[5,10,20].map((km, i) => `<option value="${i}" ${r.range===i?'selected':''}>${km} km</option>`).join('')}</select></label>
      <label>Balayage<input type="range" min=".3" max="3" step=".1" value="${r.speed}" data-radar="speed"></label>
      <label>Mode<select class="field" data-radar="mode"><option value="0" ${r.mode===0?'selected':''}>Radar</option><option value="1" ${r.mode===1?'selected':''}>Sonar</option></select></label></div>
      <span class="readout dim" id="rdInfo">${r.contacts.length} contacts</span></div>`; } },
  fid_instr:{ title:'Instruments de mesure', body:() => { const I = F.instr; return `<div class="instr"><div class="iknobs">
      ${I.k.map((v, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div class="iknob" data-iknob="${i}" style="--ka:${-135 + v * 2.7}deg" role="slider" aria-label="${i ? 'Gain' : 'Fréquence'}" aria-valuenow="${v}"></div><span class="engrave">${i ? 'Gain' : 'Fréq.'} <span id="ik${i}">${v}</span></span></div>`).join('')}</div>
      <div style="display:flex;flex-direction:column;gap:8px;min-width:0"><canvas class="cv" id="cvInstr" width="840" height="250"></canvas>
      <div class="fid-row"><div class="geiger"><span class="gled" id="gLed"></span><span class="engrave">Geiger</span><b id="gCpm">0</b><span class="readout dim">cpm</span></div><span class="ovl" id="ovl">Surcharge</span></div></div></div>`; } },
  fid_counter:{ title:'Compteurs', compact:true, body:() => `<div class="cnts">${F.counters.map((c, i) => `<div class="cnt"><input class="field" data-cnt="${i}" value="${esc(c.label)}" aria-label="Nom du compteur"><button class="iconbtn" data-act="cntStep" data-i="${i}" data-d="-1" aria-label="Moins">−</button><span class="odo" id="cnt${i}">${flapHtml(String(c.n).padStart(3, '0'))}</span><button class="iconbtn" data-act="cntStep" data-i="${i}" data-d="1" aria-label="Plus">+</button><button class="iconbtn" data-act="cntDel" data-i="${i}" aria-label="Supprimer le compteur">×</button></div>`).join('')}
    ${F.counters.length < 7 ? `<button class="btn xs" data-act="cntAdd" style="align-self:flex-start">+ Compteur</button>` : ''}</div>` },
  fid_scope:{ title:'Oscilloscope', silent:true, body:() => { const s = F.scope; return `<div class="fid" style="width:100%"><canvas class="cv cv-dark" id="cvScope" width="900" height="380"></canvas>
    <div class="scopectl">
      <label>Mode<select class="field" data-scope="mode">${[['liss','Lissajous'],['wave','Onde'],['rose','Rose polaire'],['harmo','Harmonographe'],['spiro','Spirographe'],['spec','Spectre']].map(([k, l]) => `<option value="${k}" ${s.mode===k?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Couleur<span class="swatches">${SCOPE_COLORS.map(([c, n]) => `<button style="--sw:${c}" data-act="scopeColor" data-c="${c}" aria-pressed="${s.color===c}" aria-label="${n}"></button>`).join('')}</span></label>
      ${[['fx','Fréq. X',1,9,.01],['fy','Fréq. Y',1,9,.01],['speed','Vitesse',0,5,.1],['persist','Persistance',0,.97,.01],['width','Épaisseur',.5,6,.1],['noise','Bruit',0,1,.02]].map(([k, l, a, b, st]) => `<label>${l}<input type="range" min="${a}" max="${b}" step="${st}" value="${s[k]}" data-scope="${k}"></label>`).join('')}
      <label class="chk"><input type="checkbox" data-scope="grid" ${s.grid?'checked':''}>Grille</label>
      <label class="chk"><input type="checkbox" data-scope="glow" ${s.glow?'checked':''}>Lueur</label>
    </div></div>`; } }
};

/* ---------- panel load meter ---------- */
function panelLoad() { const p = F.panel; if (!p.key) return 0; const on = [...p.tog, ...p.rock, ...p.push].filter(Boolean).length; return Math.round(clamp(on / 8 * 55 + (p.pots[0] + p.pots[1]) / 200 * 30 + p.slide * 7 + p.rot * 2, 0, 100)); }
function panelMeter() {
  const v = panelLoad(), ticks = Array.from({length:11}, (_, i) => { const a = Math.PI + i / 10 * Math.PI, r1 = i % 5 ? 44 : 41; return `<line x1="${(62 + Math.cos(a) * r1).toFixed(1)}" y1="${(64 + Math.sin(a) * r1).toFixed(1)}" x2="${(62 + Math.cos(a) * 48).toFixed(1)}" y2="${(64 + Math.sin(a) * 48).toFixed(1)}" stroke="#2f2922" stroke-width="1.4"/>`; }).join('');
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><svg class="pmeter" viewBox="0 0 124 72" role="img" aria-label="Charge ${v} %"><rect x="2" y="2" width="120" height="68" rx="8" fill="#ebe3d0"/><path d="M96 30 A48 48 0 0 1 110 64" fill="none" stroke="#b8452f" stroke-width="5" opacity=".6"/>${ticks}<line id="pNeedle" x1="62" y1="64" x2="62" y2="22" stroke="#1d1a16" stroke-width="2.4" stroke-linecap="round" style="transform-origin:62px 64px;transform:rotate(${-90 + v * 1.8}deg);transition:transform .6s cubic-bezier(.3,1.5,.5,1)"/><circle cx="62" cy="64" r="5" fill="#2f2922"/></svg><span class="readout" id="pLoad">Charge ${v} %</span></div>`;
}
function panelMeterUpdate() { const v = panelLoad(), n = $('#pNeedle'); if (n) n.style.transform = `rotate(${-90 + v * 1.8}deg)`; const l = $('#pLoad'); if (l) l.textContent = `Charge ${v} %`; }

/* ---------- actions ---------- */
const tamaNight = () => F.tama.clock % 120 >= 90;
function tamaSay(msg) { F.tama.msg = msg; const m = $('#tamaMsg'); if (m) m.textContent = msg; }
function tamaAnim(kind, dur = 7) { F.tama.anim = kind; F.tama.animT = dur; }
const fmt = s => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const timerFlaps = () => { const t = F.timer, txt = fmt(t.mode === 'down' ? t.left : t.up); t.shown = txt; return [...txt].map(ch => `<span class="flap ${ch === ':' ? 'sep' : ''}">${ch}</span>`).join(''); };
Object.assign(ACT, {
  fidSnd: (d, el) => { S.fidSound[d.id] = !S.fidSound[d.id]; el.outerHTML = sndBtn(d.id); if (S.fidSound[d.id] && !S.sound) toast('Le son général est coupé (bouton du lanceur de dés)'); if (!S.fidSound[d.id] && d.id === 'fid_spinner') FX.hum(0, 40); return false; },
  spinModel: () => { F.spin.model = (F.spin.model + 1) % SPIN_MODELS.length; refreshFid('fid_spinner'); sf('fid_spinner').clack(); return false; },
  spinColor: () => { F.spin.color = (F.spin.color + 1) % SPIN_COLORS.length; refreshFid('fid_spinner'); sf('fid_spinner').click(.3); return false; },
  tamaAnimal: d => { F.tama.animal = (F.tama.animal + +d.d + ANIMALS.length) % ANIMALS.length; tamaSay(`Voici Bip, version ${ANIMALS[F.tama.animal].n.toLowerCase()}.`); refreshFid('fid_tama'); sf('fid_tama').tone(660, .06, 'square', .03); return false; },
  tamaFeed: () => { const t = F.tama; if (tamaNight()) { tamaSay('Chut… Bip dort.'); return false; } if (t.food > 95) { tamaSay('Bip n’a plus faim.'); return false; } t.food = Math.min(100, t.food + 30); tamaAnim('eat'); sf('fid_tama').tone(660, .1, 'square', .03); sf('fid_tama').tone(880, .1, 'square', .03, .12); tamaSay('Miam !'); return false; },
  tamaPlay: () => { const t = F.tama; if (tamaNight()) { tamaSay('Chut… Bip dort.'); return false; } t.joy = Math.min(100, t.joy + 25); t.food = Math.max(0, t.food - 4); tamaAnim('play', 9); sf('fid_tama').tone(784, .08, 'square', .03); sf('fid_tama').tone(1046, .12, 'square', .03, .1); tamaSay('Bip court après la balle !'); return false; },
  tamaClean: () => { const t = F.tama; if (!t.poop) { tamaSay('Tout est propre.'); return false; } t.poop = 0; t.joy = Math.min(100, t.joy + 5); tamaAnim('clean', 5); sf('fid_tama').noise(.4, .25, 3000, .6); tamaSay('Nickel !'); return false; },
  pTog: d => { F.panel.tog[+d.i] = !F.panel.tog[+d.i]; sf('fid_panel').clack(); refreshFid('fid_panel'); return false; },
  pRock: d => { F.panel.rock[+d.i] = !F.panel.rock[+d.i]; sf('fid_panel').noise(.04, .5, 600); refreshFid('fid_panel'); return false; },
  pRot: () => { F.panel.rot = (F.panel.rot + 1) % 4; sf('fid_panel').click(.5, 1500); sf('fid_panel').tone(90, .05, 'square', .03); refreshFid('fid_panel'); return false; },
  pSlide: () => { F.panel.slide = (F.panel.slide + 1) % 3; sf('fid_panel').noise(.08, .3, 1800, .8); refreshFid('fid_panel'); return false; },
  pPush: d => { F.panel.push[+d.i] = !F.panel.push[+d.i]; sf('fid_panel').click(.5, 1100); sf('fid_panel').tone(F.panel.push[+d.i] ? 880 : 440, .05, 'square', .02); refreshFid('fid_panel'); return false; },
  pKey: () => { const p = F.panel, fx = sf('fid_panel'); p.key = !p.key; fx.clack(); if (p.key) { fx.tone(110, .25, 'sawtooth', .02); fx.tone(220, .3, 'sine', .03, .08); } else fx.tone(160, .3, 'sine', .03); refreshFid('fid_panel'); return false; },
  tmSet: d => { const t = F.timer; t.total = t.left = +d.v; t.running = false; t.done = false; refreshFid('fid_timer'); sf('fid_timer').click(.4, 1500); return false; },
  tmAdd: () => { const t = F.timer; t.left += 10; t.total = Math.max(t.total, t.left); t.done = false; refreshFid('fid_timer'); sf('fid_timer').click(.4, 1500); return false; },
  tmGo: () => { const t = F.timer; if (t.mode === 'down' && t.left <= 0) t.left = t.total; t.running = !t.running; t.done = false; refreshFid('fid_timer'); sf('fid_timer').clack(); return false; },
  tmReset: () => { const t = F.timer; t.running = false; t.done = false; t.left = t.total; t.up = 0; refreshFid('fid_timer'); sf('fid_timer').click(.4, 900); return false; },
  tmMode: () => { const t = F.timer; t.mode = t.mode === 'down' ? 'up' : 'down'; t.running = false; t.done = false; refreshFid('fid_timer'); return false; },
  cntStep: d => { const c = F.counters[+d.i]; c.n = clamp(c.n + +d.d, 0, 999); setFlaps($('#cnt' + d.i), String(c.n).padStart(3, '0'), 3); sf('fid_counter').clack(); return false; },
  cntAdd: () => { F.counters.push({ label:'Compteur ' + (F.counters.length + 1), n:0 }); refreshFid('fid_counter'); return false; },
  cntDel: d => { F.counters.splice(+d.i, 1); refreshFid('fid_counter'); return false; },
  scopeColor: d => { F.scope.color = d.c; refreshFid('fid_scope'); return false; }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.cnt !== undefined) F.counters[+t.dataset.cnt].label = t.value;
  if (t.dataset.scope) { const k = t.dataset.scope; F.scope[k] = t.type === 'checkbox' ? t.checked : t.tagName === 'SELECT' ? t.value : +t.value; }
  if (t.dataset.radar) F.radar[t.dataset.radar] = +t.value;
});
document.addEventListener('change', e => { const t = e.target; if (t.dataset.scope && t.type === 'checkbox') F.scope[t.dataset.scope] = t.checked; if (t.dataset.scope === 'mode') F.scope.mode = t.value; if (t.dataset.radar) F.radar[t.dataset.radar] = +t.value; });

/* ---------- pointer handling ---------- */
document.addEventListener('pointerdown', e => {
  const pad = e.target.closest('.pad');
  if (pad) { sf('fid_pads').note(PADF[+pad.dataset.pad]); pad.classList.remove('hit'); void pad.offsetWidth; pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 170); return; }
  if (S.layoutEdit) return;
  const t = e.target;
  if (t.id === 'cvSpin') { const p = cpos(e, t), c = t.width / 2; F.spin.drag = { ang:Math.atan2(p.y - c, p.x - c) * 180 / Math.PI, moved:0 }; t.setPointerCapture(e.pointerId); e.preventDefault(); return; }
  if (t.id === 'cvRadar') { radarPing(cpos(e, t), t); e.preventDefault(); return; }
  const kn = t.closest('[data-iknob]');
  if (kn) { const i = +kn.dataset.iknob; F.instr.drag = { kind:'ik', i, y:e.clientY, v:F.instr.k[i], el:kn }; kn.setPointerCapture(e.pointerId); e.preventDefault(); return; }
  const pot = t.closest('[data-pot]');
  if (pot) { const i = +pot.dataset.pot; F.instr.drag = { kind:'pot', i, y:e.clientY, v:F.panel.pots[i], el:pot }; pot.setPointerCapture(e.pointerId); e.preventDefault(); return; }
  const sfd = t.closest('#sFader');
  if (sfd) { F.fader.drag = true; faderFrom(e, sfd); sfd.setPointerCapture(e.pointerId); e.preventDefault(); }
});
document.addEventListener('pointermove', e => {
  const s = F.spin.drag, cs = $('#cvSpin');
  if (s && cs) { const p = cpos(e, cs), c = cs.width / 2, a = Math.atan2(p.y - c, p.x - c) * 180 / Math.PI; let d = a - s.ang; if (d > 180) d -= 360; if (d < -180) d += 360; F.spin.a += d; F.spin.v = d * .75 + F.spin.v * .25; s.ang = a; s.moved += Math.abs(d); }
  const dr = F.instr.drag;
  if (dr) {
    const nv = clamp(Math.round(dr.v + (dr.y - e.clientY) / 1.5), 0, 100), arr = dr.kind === 'ik' ? F.instr.k : F.panel.pots;
    if (nv !== arr[dr.i]) { if (Math.floor(nv / 5) !== Math.floor(arr[dr.i] / 5)) sf(dr.kind === 'ik' ? 'fid_instr' : 'fid_panel').click(.25, 1800 + nv * 10); arr[dr.i] = nv;
      if (dr.kind === 'ik') { dr.el.style.setProperty('--ka', (-135 + nv * 2.7) + 'deg'); const l = $('#ik' + dr.i); if (l) l.textContent = nv; }
      else { dr.el.style.setProperty('--pa', (-135 + nv * 2.7) + 'deg'); const l = $('#potVal'); if (l) l.textContent = F.panel.pots.join(' · '); panelMeterUpdate(); } dr.el.setAttribute('aria-valuenow', nv); }
  }
  if (F.fader.drag) { const el = $('#sFader'); if (el) faderFrom(e, el); }
});
const fidEnd = () => { if (F.spin.drag) { if (F.spin.drag.moved < 4) F.spin.v += (F.spin.v < 0 ? -1 : 1) * 14; F.spin.drag = null; } F.instr.drag = null; if (F.fader.drag) F.fader.drag = false; };
document.addEventListener('pointerup', fidEnd); document.addEventListener('pointercancel', fidEnd);

/* ---------- spinner ---------- */
function spinDraw(cv, now) {
  const g = cv.getContext('2d'), W = cv.width, c = W / 2, s = F.spin, col = SPIN_COLORS[s.color];
  g.clearRect(0, 0, W, W);
  const lobes = [3, 6, 2][s.model], speed = Math.abs(s.v), ghosts = Math.min(10, 1 + Math.floor(speed / 3));
  for (let i = ghosts - 1; i >= 0; i--) {
    g.save(); g.globalAlpha = i === 0 ? 1 : .35 * (1 - i / ghosts); g.translate(c, c); g.rotate((s.a - s.v * i / ghosts * 1.3) * Math.PI / 180);
    drawSpinner(g, lobes, col); g.restore();
  }
  // sparks
  if (speed > 26 && Math.random() < .6) { const ang = (s.a + Math.random() * 360) * Math.PI / 180, rr = s.model === 1 ? 170 : 150; s.sparks.push({ x:c + Math.cos(ang) * rr, y:c + Math.sin(ang) * rr, vx:-Math.sin(ang) * Math.sign(s.v) * rnd(4, 9), vy:Math.cos(ang) * Math.sign(s.v) * rnd(4, 9), l:1 }); }
  g.lineCap = 'round';
  s.sparks = s.sparks.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += .25; p.l -= .05; if (p.l <= 0) return false; g.strokeStyle = `rgba(240,160,80,${p.l})`; g.lineWidth = 3; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 2, p.y - p.vy * 2); g.stroke(); return true; });
}
function drawSpinner(g, lobes, col) {
  const dist = lobes === 6 ? 120 : lobes === 2 ? 125 : 112, lr = lobes === 6 ? 34 : 56;
  g.strokeStyle = '#2f2922'; g.lineWidth = 3;
  // body
  g.fillStyle = '#d9cdb2';
  g.beginPath();
  for (let k = 0; k < lobes; k++) { const a = k / lobes * Math.PI * 2; g.moveTo(0, 0); g.arc(Math.cos(a) * dist, Math.sin(a) * dist, lr, 0, Math.PI * 2); }
  g.fill();
  for (let k = 0; k < lobes; k++) {
    const a = k / lobes * Math.PI * 2, x = Math.cos(a) * dist, y = Math.sin(a) * dist;
    g.save(); g.rotate(a); g.fillStyle = '#d9cdb2'; g.beginPath(); g.roundRect(0, -26, dist, 52, 20); g.fill(); g.stroke(); g.restore();
    const gr = g.createRadialGradient(x - lr * .3, y - lr * .3, 4, x, y, lr); gr.addColorStop(0, '#f6eedc'); gr.addColorStop(1, '#bfb294');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, lr, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = col; g.beginPath(); g.arc(x, y, lr * .55, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#2f2922'; g.beginPath(); g.arc(x, y, lr * .22, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(x - lr * .22, y - lr * .22, lr * .12, 0, Math.PI * 2); g.fill();
  }
  const cg = g.createRadialGradient(-10, -10, 4, 0, 0, 48); cg.addColorStop(0, '#f6eedc'); cg.addColorStop(1, '#a89c80');
  g.fillStyle = cg; g.beginPath(); g.arc(0, 0, 46, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = col; g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.fill(); g.stroke();
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); g.lineTo(Math.cos(a) * 42, Math.sin(a) * 42); g.lineWidth = 2; g.stroke(); }
  g.lineWidth = 3;
}


/* ---------- Bip ---------- */
function tamaTick() {
  const t = F.tama, night = tamaNight(); t.clock++;
  if (tamaNight() !== night) { tamaSay(tamaNight() ? 'La nuit tombe, Bip s’endort.' : 'Le jour se lève, Bip s’étire.'); }
  t.food = Math.max(0, t.food - (night ? .15 : .45)); t.joy = Math.max(0, t.joy - (night ? .1 : .35 + t.poop * .3));
  if (!night && t.poop < 3 && Math.random() < .02) { t.poop++; tamaSay('Oups… il faudrait nettoyer.'); }
  const age = Math.floor((Date.now() - t.born) / 300000);
  if (age > t.lastBday) { t.lastBday = age; tamaAnim('bday', 10); tamaSay(`Joyeux anniversaire, Bip ! (${age * 5} min)`); sf('fid_tama').tone(523, .12, 'square', .03); sf('fid_tama').tone(659, .12, 'square', .03, .14); sf('fid_tama').tone(784, .2, 'square', .03, .28); }
  if (!t.visitor && Math.random() < (night ? .04 : .025)) t.visitor = night ? { k:'star', x:64, y:rnd(1, 6), vx:-2.5, vy:.6 } : { k:'fly', x:-3, y:rnd(6, 14), vx:.8, vy:0 };
  const f = $('#ts-food'); if (f) f.style.width = t.food + '%'; const j = $('#ts-joy'); if (j) j.style.width = t.joy + '%';
}
function tamaStep() {
  const t = F.tama; t.frame ^= 1;
  if (t.animT > 0 && !--t.animT) t.anim = null;
  t.blink = Math.random() < .08 ? 1 : 0;
  if (t.visitor) { const v = t.visitor; v.x += v.vx; v.y += v.vy + (v.k === 'fly' ? Math.sin(v.x) * .6 : 0); if (v.x < -6 || v.x > 70) t.visitor = null; }
  if (!tamaNight() && (!t.anim || t.anim === 'play')) { if (Math.random() < .15) t.dir *= -1; t.x = clamp(t.x + t.dir * (t.anim === 'play' ? 3 : 2), 4, 40); }
}
function tamaDraw(cv) {
  const g = cv.getContext('2d'), P = 4, t = F.tama, on = '#2c3322', night = tamaNight(), A = ANIMALS[t.animal];
  const bg = night ? '#6d775c' : '#a7b190';
  g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = 'rgba(44,51,34,.06)'; for (let x = 0; x < 64; x++) for (let y = 0; y < 40; y++) if ((x + y) % 2) g.fillRect(x * P, y * P, P - 1, P - 1);
  const px = (rows, ox, oy, col = on) => { g.fillStyle = col; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'X') g.fillRect((ox + x) * P, (oy + y) * P, P - .5, P - .5); })); };
  // sky
  if (night) { px(TPX.moon, 56, 2); g.fillStyle = on; [[8, 3], [20, 6], [33, 2], [45, 7], [14, 11]].forEach(([x, y], i) => { if ((t.frame + i) % 3) g.fillRect(x * P, y * P, P - 1, P - 1); }); }
  else px(TPX.sun, 2, 2);
  if (t.visitor) { const v = t.visitor; if (v.k === 'fly') px(t.frame ? TPX.fly : ['X.X', 'XXX'], Math.round(v.x), Math.round(v.y)); else { g.fillStyle = on; for (let i = 0; i < 4; i++) g.fillRect((v.x + i * 1.2) * P, (v.y - i * .3) * P, P - 1, P - 1); } }
  g.fillStyle = on; g.fillRect(0, 37 * P, 64 * P, 2);
  // pet
  const rows = [...A.rows, A.legs[night ? 0 : t.frame]], h = rows.length;
  let ox = Math.round(t.x), oy = 37 - h - (!night && t.frame ? 1 : 0);
  if (t.anim === 'play' && t.animT % 2) oy -= 2;
  if (t.anim === 'bday' && t.animT % 2) oy -= 1;
  px(rows, ox, oy);
  A.eyes.forEach(([ex, ey]) => {
    const X = (ox + ex) * P, Y = (oy + ey) * P;
    if (night || t.blink) { g.fillStyle = A.inv ? on : bg; g.fillRect(X, Y, P, P); g.fillStyle = A.inv ? bg : on; g.fillRect(X - P * .25, Y + P * .4, P * 1.5, P * .35); }
    else { g.fillStyle = A.inv ? bg : on; g.fillRect(X, Y, P, P); }
  });
  if (night) { g.fillStyle = on; g.font = '700 14px monospace'; g.fillText(t.frame ? 'z Z' : 'Z z', (ox + 11) * P, (oy - 1) * P); }
  // events
  for (let i = 0; i < t.poop; i++) { const x = 50 - i * 7; px(TPX.poop, x, 32); g.fillStyle = on; const fx = x + 2 + Math.cos((t.frame + i) * 2.4) * 3, fy = 28 + Math.sin((t.frame + i) * 2.4); g.fillRect(fx * P, fy * P, P - 1, P - 1); }
  if (t.anim === 'eat') { const bites = Math.floor((7 - t.animT) / 2); px(TPX.food.map(r => r.slice(0, Math.max(0, 5 - bites)).padEnd(5, '.')), ox + (t.dir > 0 ? 13 : -6), 31); }
  if (t.anim === 'play') { const bx = ox + (t.dir > 0 ? 14 : -4), by = 33 - Math.abs(Math.sin(t.animT * 1.3)) * 8; g.fillStyle = on; g.fillRect(bx * P, by * P, P * 2, P * 2); }
  if (t.anim === 'clean') { g.fillStyle = on; for (let i = 0; i < 8; i++) g.fillRect(rnd(36, 62) * P, rnd(24, 36) * P, P - 1, P - 1); }
  if (t.anim === 'bday') { px(TPX.cake, ox + 13, 32); g.fillStyle = on; for (let i = 0; i < 10; i++) g.fillRect(rnd(2, 62) * P, rnd(2, 20) * P, P - 1, P - 1); }
  if (!night && (t.anim === 'play' || t.anim === 'eat') && t.animT % 3 === 0) px(TPX.heart, ox + 12, oy - 4);
  if (!night && t.joy < 25) { px(TPX.cloud, ox + 3, oy - 7); g.fillStyle = on; if (t.frame) { g.fillRect((ox + 4) * P, (oy - 3) * P, P - 1, P - 1); g.fillRect((ox + 7) * P, (oy - 2) * P, P - 1, P - 1); } }
  if (!night && t.food < 25 && t.frame) { g.fillStyle = on; g.font = '700 16px monospace'; g.fillText('!', (ox - 3) * P, (oy + 2) * P); }
}

/* ---------- timer ---------- */
let tmLast = 0;
function timerStep(now) {
  const t = F.timer, dt = tmLast ? (now - tmLast) / 1000 : 0; tmLast = now;
  if (t.running) {
    if (t.mode === 'down') { t.left -= dt; if (t.left <= 0) { t.left = 0; t.running = false; t.done = true; const fx = sf('fid_timer'); [0, .25, .5].forEach(at => fx.tone(988, .18, 'square', .04, at)); const tl = $('[data-tile="fid_timer"]'); if (tl) { tl.classList.remove('shaking'); void tl.offsetWidth; tl.classList.add('shaking'); } refreshFid('fid_timer'); return; } }
    else t.up += dt;
  }
  const el = $('#tmFlaps'); if (!el) return;
  const txt = fmt(t.mode === 'down' ? t.left : t.up);
  if (txt !== t.shown) { t.shown = txt; $$('.flap', el).forEach((c, i) => { if (c.textContent !== txt[i]) { c.textContent = txt[i]; c.classList.remove('flip'); void c.offsetWidth; c.classList.add('flip'); } }); if (t.running) sf('fid_timer').click(.12, 2600);
    const bar = $('#tmBar'); if (bar && t.mode === 'down') $$('i', bar).forEach((s, i) => s.classList.toggle('lit', i < Math.round(t.left / t.total * 20))); }
}

/* ---------- radar ---------- */
function radarPing(p, cv) {
  const R = F.radar, c = cv.width / 2, x = (p.x - c) / (c * .92), y = (p.y - c) / (c * .92);
  if (Math.hypot(x, y) > 1) return;
  R.pings.push({ x, y, r:0 });
  const fx = sf('fid_radar'); fx.tone(R.mode ? 1150 : 1700, .9, 'sine', .05); fx.tone(R.mode ? 1150 : 1700, .6, 'sine', .015, .45);
  R.contacts.forEach(k => { if (Math.hypot(k.x - x, k.y - y) < .3) k.id = true; });
}
function radarStep(cv, dt, now) {
  const R = F.radar, g = cv.getContext('2d'), W = cv.width, c = W / 2, rad = c * .92, col = RADAR_COLORS[R.mode];
  const prev = R.a; R.a = (R.a + .025 * R.speed * dt) % (Math.PI * 2);
  if (now > R.next) { R.next = now + rnd(1500, 4000); if (R.contacts.length < 9) { const ang = rnd(0, Math.PI * 2), d = rnd(.15, .95), mv = Math.random() < .5; R.contacts.push({ x:Math.cos(ang) * d, y:Math.sin(ang) * d, vx:mv ? rnd(-.0012, .0012) : 0, vy:mv ? rnd(-.0012, .0012) : 0, id:false, name:'K-' + (R.seq++), life:rnd(20000, 50000), born:now, lit:0 }); } }
  R.contacts = R.contacts.filter(k => { k.x += k.vx * dt; k.y += k.vy * dt; return now - k.born < k.life && Math.hypot(k.x, k.y) < 1; });
  g.clearRect(0, 0, W, W);
  g.save(); g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#12110e'; g.fillRect(0, 0, W, W);
  g.strokeStyle = col; g.globalAlpha = .18; g.lineWidth = 1.5;
  for (let i = 1; i <= 4; i++) { g.beginPath(); g.arc(c, c, rad * i / 4, 0, Math.PI * 2); g.stroke(); }
  g.beginPath(); g.moveTo(c - rad, c); g.lineTo(c + rad, c); g.moveTo(c, c - rad); g.lineTo(c, c + rad); g.stroke();
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2, l = i % 3 ? .96 : .92; g.beginPath(); g.moveTo(c + Math.cos(a) * rad * l, c + Math.sin(a) * rad * l); g.lineTo(c + Math.cos(a) * rad, c + Math.sin(a) * rad); g.stroke(); }
  // sweep trail
  for (let i = 0; i < 40; i++) { g.globalAlpha = .28 * (1 - i / 40); g.fillStyle = col; g.beginPath(); g.moveTo(c, c); g.arc(c, c, rad, R.a - (i + 1) * .02, R.a - i * .02); g.closePath(); g.fill(); }
  g.globalAlpha = .9; g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(R.a) * rad, c + Math.sin(R.a) * rad); g.stroke();
  // contacts light up when the sweep passes
  const fx = sf('fid_radar');
  for (const k of R.contacts) {
    const ka = (Math.atan2(k.y, k.x) + Math.PI * 2) % (Math.PI * 2), passed = (prev <= ka && R.a >= ka) || (prev > R.a && (ka >= prev || ka <= R.a));
    if (passed) { k.lit = 1; if (k.id) fx.tone(880, .05, 'sine', .02); }
    k.lit = Math.max(0, k.lit - .006 * dt);
    if (k.lit <= 0) continue;
    const X = c + k.x * rad, Y = c + k.y * rad; g.globalAlpha = k.lit; g.fillStyle = col;
    g.beginPath(); g.arc(X, Y, k.id ? 7 : 5, 0, Math.PI * 2); g.fill();
    if (k.vx || k.vy) { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(X, Y); g.lineTo(X + k.vx * 9000, Y + k.vy * 9000); g.stroke(); }
    if (k.id) { g.font = '500 20px "IBM Plex Mono", monospace'; g.fillText(`${k.name} · ${(Math.hypot(k.x, k.y) * [5, 10, 20][R.range]).toFixed(1)} km`, X + 11, Y - 9); }
  }
  R.pings = R.pings.filter(p => { p.r += .012 * dt; if (p.r > .6) return false; g.globalAlpha = (1 - p.r / .6) * .8; g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.arc(c + p.x * rad, c + p.y * rad, p.r * rad, 0, Math.PI * 2); g.stroke(); return true; });
  g.restore();
  g.globalAlpha = 1; g.strokeStyle = '#2b2925'; g.lineWidth = 10; g.beginPath(); g.arc(c, c, rad + 5, 0, Math.PI * 2); g.stroke();
  const info = $('#rdInfo'); if (info && now - (R.lastTxt || 0) > 500) { R.lastTxt = now; info.textContent = `${R.contacts.length} contacts · ${R.contacts.filter(k => k.id).length} identifiés · portée ${[5, 10, 20][R.range]} km`; }
}

/* ---------- instruments ---------- */
function instrStep(cv, dt, now) {
  const I = F.instr, A = I.k[0] / 100, B = I.k[1] / 100; I.t += .016 * dt;
  const over = A > .85 && B > .85;
  const tgt = [0, 1].map(ch => clamp(B * (.5 + .45 * Math.sin(I.t * (1.2 + A * 9) + ch * 1.7)) * rnd(.75, 1.2) + (over ? rnd(0, .3) : 0), 0, 1.15));
  for (let ch = 0; ch < 2; ch++) { I.vuv[ch] += (tgt[ch] - I.vu[ch]) * .22; I.vuv[ch] *= .68; I.vu[ch] += I.vuv[ch]; }
  const gt = clamp(.6 * A + .4 * B + (over ? .12 * Math.sin(I.t * 22) : 0), 0, 1.05);
  I.gv += (gt - I.g) * .04; I.gv *= .88; I.g += I.gv;
  const rate = .3 + 26 * A * A * B + (over ? 25 : 0);
  if (Math.random() < rate * .016 * dt) { I.count++; I.flash = 3; sf('fid_instr').click(.35, 3500 + Math.random() * 1500); I.cps += 1; }
  I.cps *= Math.pow(.985, dt);
  const led = $('#gLed'); if (led) led.classList.toggle('on', I.flash-- > 0);
  if (now - (I.lastTxt || 0) > 250) { I.lastTxt = now; const c = $('#gCpm'); if (c) c.textContent = Math.round(I.cps * 54); const o = $('#ovl'); if (o) o.classList.toggle('on', over); }
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const face = (x, w, label) => { g.fillStyle = '#ebe3d0'; g.beginPath(); g.roundRect(x, 10, w, H - 20, 10); g.fill(); g.strokeStyle = 'rgba(47,41,34,.35)'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#6b6152'; g.font = '500 17px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.fillText(label, x + w / 2, H - 26); };
  const needle = (cx, cy, len, a0, a1, v, red) => {
    g.lineWidth = 2; for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * i / 10; g.strokeStyle = i >= red ? '#b8362a' : '#2f2922'; g.beginPath(); g.moveTo(cx + Math.cos(a) * len * .82, cy + Math.sin(a) * len * .82); g.lineTo(cx + Math.cos(a) * len * (i % 5 ? .9 : .96), cy + Math.sin(a) * len * (i % 5 ? .9 : .96)); g.stroke(); }
    g.strokeStyle = 'rgba(184,54,42,.5)'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, len * .86, a0 + (a1 - a0) * red / 10, a1); g.stroke();
    const a = a0 + (a1 - a0) * clamp(v, 0, 1.08); g.strokeStyle = '#1d1a16'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * len * .95, cy + Math.sin(a) * len * .95); g.stroke();
    g.fillStyle = '#2f2922'; g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fill();
  };
  face(10, 260, 'VU · G'); needle(140, 200, 150, -Math.PI * .8, -Math.PI * .2, I.vu[0], 8);
  face(285, 260, 'VU · D'); needle(415, 200, 150, -Math.PI * .8, -Math.PI * .2, I.vu[1], 8);
  face(560, 270, 'CHAMP · µT'); needle(695, 150, 110, Math.PI * .75, Math.PI * 2.25, I.g, 8);
  g.fillStyle = '#2f2922'; g.font = '600 20px "IBM Plex Mono", monospace'; g.fillText(Math.round(I.g * 480), 695, 205);
}


/* ---------- fader ---------- */
function faderFrom(e, el) { const r = el.getBoundingClientRect(); F.fader.x = clamp(((e.clientX - r.left) / r.width - .5) / .44, -1, 1); F.fader.v = 0; }
function faderStep(dt) {
  const f = F.fader;
  if (!f.drag) { f.v += -.12 * f.x * dt; f.v *= Math.pow(.9, dt); f.x += f.v * dt; if (Math.abs(f.x) < .001 && Math.abs(f.v) < .001) f.x = f.v = 0; }
  const n = Math.round(f.x * 10); if (n !== f.notch) { f.notch = n; sf('fid_fader').click(.12 + Math.abs(f.x) * .25, 1500 + Math.abs(n) * 180); }
  const cap = $('#sCap'); if (!cap) return;
  cap.style.left = (50 + f.x * 44) + '%'; cap.style.setProperty('--sq', (1 + Math.min(.45, Math.abs(f.v) * 4)).toFixed(3));
  const led = $('#sLed'); if (led) led.style.setProperty('--gl', (.15 + Math.abs(f.x) * .85).toFixed(2));
}


/* ---------- scope ---------- */
function scopeStep(cv, dt) {
  const s = F.scope, g = cv.getContext('2d'), W = cv.width, H = cv.height; s.t += .02 * s.speed * dt;
  g.save(); g.shadowBlur = 0;
  g.fillStyle = `rgba(17,16,14,${(1 - s.persist).toFixed(3)})`; g.fillRect(0, 0, W, H);
  if (s.grid) { g.strokeStyle = 'rgba(231,220,196,.06)'; g.lineWidth = 1; g.beginPath(); for (let x = 0; x <= W; x += W / 10) { g.moveTo(x, 0); g.lineTo(x, H); } for (let y = 0; y <= H; y += H / 8) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke(); g.strokeStyle = 'rgba(231,220,196,.12)'; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke(); }
  g.strokeStyle = s.color; g.fillStyle = s.color; g.lineWidth = s.width; g.lineJoin = 'round'; g.lineCap = 'round';
  if (s.glow) { g.shadowBlur = 10; g.shadowColor = s.color; }
  const nz = () => (Math.random() - .5) * s.noise * 24;
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * .42;
  g.beginPath();
  if (s.mode === 'liss') { for (let i = 0; i <= 600; i++) { const t = i / 600 * Math.PI * 2, x = cx + W * .4 * Math.sin(s.fx * t + s.t) + nz(), y = cy + H * .4 * Math.sin(s.fy * t) + nz(); i ? g.lineTo(x, y) : g.moveTo(x, y); } }
  else if (s.mode === 'wave') { for (let x = 0; x <= W; x += 3) { const u = x / W * Math.PI * 2, y = cy + H * .3 * Math.sin(s.fx * u - s.t * 3) + H * .12 * Math.sin(s.fy * u * 2 + s.t * 5) + nz(); x ? g.lineTo(x, y) : g.moveTo(x, y); } }
  else if (s.mode === 'rose') { const k = s.fx / s.fy, turns = Math.ceil(s.fy) * 2; for (let i = 0; i <= 1600; i++) { const th = i / 1600 * Math.PI * turns, r = R * Math.cos(k * th), x = cx + r * Math.cos(th + s.t * .5) + nz(), y = cy + r * Math.sin(th + s.t * .5) + nz(); i ? g.lineTo(x, y) : g.moveTo(x, y); } }
  else if (s.mode === 'harmo') { for (let i = 0; i <= 2400; i++) { const t = i / 30, d = Math.exp(-.004 * i), x = cx + R * .55 * d * (Math.sin(s.fx * t + s.t) + Math.sin(s.fy * 1.01 * t + 1.3)) + nz(), y = cy + R * .55 * d * (Math.sin(s.fy * t + s.t * .7 + .5) + Math.sin(s.fx * .99 * t)) + nz(); i ? g.lineTo(x, y) : g.moveTo(x, y); } }
  else if (s.mode === 'spiro') { const Rr = 1, r = clamp(s.fy / (s.fx + s.fy), .05, .95), dd = .85; for (let i = 0; i <= 2000; i++) { const th = i / 2000 * Math.PI * 2 * Math.round(10 * r + 4) + s.t * .3, x = cx + R * ((Rr - r) * Math.cos(th) + dd * r * Math.cos((Rr - r) / r * th)) + nz(), y = cy + R * ((Rr - r) * Math.sin(th) - dd * r * Math.sin((Rr - r) / r * th)) + nz(); i ? g.lineTo(x, y) : g.moveTo(x, y); } }
  if (s.mode !== 'spec') g.stroke();
  else { const n = 32, bw = W / n; s.peaks = s.peaks || Array(n).fill(0); for (let i = 0; i < n; i++) { const v = clamp(.5 + .4 * Math.sin(s.t * 2 + i * s.fx * .3) * Math.cos(s.t * 1.3 + i * s.fy * .2) + (Math.random() - .5) * (.15 + s.noise), 0, 1), h = v * H * .9; g.fillRect(i * bw + 2, H - h, bw - 4, h); s.peaks[i] = Math.max(s.peaks[i] - .006 * dt * H, h); g.fillRect(i * bw + 2, H - s.peaks[i] - 6, bw - 4, 3); } }
  g.restore();
}


/* ---------- main loop ---------- */
let fidLast = 0, fidSec = 0, fidStep = 0;
function fidLoop(now) {
  const dt = clamp((now - (fidLast || now)) / 16.67, .2, 3); fidLast = now;
  const s = F.spin;
  if (!s.drag) { s.a += s.v * dt; s.v *= Math.pow(.993, dt); if (Math.abs(s.v) < .02) s.v = 0; }
  const cs = $('#cvSpin');
  if (cs) {
    spinDraw(cs, now);
    const lobes = [3, 6, 2][s.model], seg = Math.floor(s.a / (360 / lobes));
    if (seg !== s.seg) { s.seg = seg; if (Math.abs(s.v) < 18 && now - s.lastT > 30) { sf('fid_spinner').click(.2 + Math.abs(s.v) / 60, 2200); s.lastT = now; } }
    const rpm = Math.round(Math.abs(s.v) * 10); s.best = Math.max(s.best, rpm);
    const r = $('#spinRpm'); if (r) r.textContent = rpm + ' tr/min'; const b = $('#spinBest'); if (b) b.textContent = 'record ' + s.best;
    sf('fid_spinner').hum(Math.min(.03, Math.abs(s.v) / 1000), 35 + Math.abs(s.v) * 4.5);
  } else FX.hum(0, 40);
  const ct = $('#cvTama'); if (now - fidStep > 420) { fidStep = now; tamaStep(); } if (ct) tamaDraw(ct);
  if (now - fidSec > 1000) { fidSec = now; tamaTick(); }
  timerStep(now);
  const cr = $('#cvRadar'); if (cr) radarStep(cr, dt, now);
  const ci = $('#cvInstr'); if (ci) instrStep(ci, dt, now);
  faderStep(dt);
  const sc = $('#cvScope'); if (sc) scopeStep(sc, dt);
  requestAnimationFrame(fidLoop);
}
