/* images.js — manual cropping and online image search for portraits (characters, NPCs) and item illustrations.
   - Every imported image (file or search) goes through a cropper with the aspect of the place it is shown in:
     portrait 104:128 (520×640), item illustration 3:2 (600×400). Drag the frame, resize it with the slider or the wheel.
   - Search: Wikimedia Commons (free licences, no key, CORS); the author and licence are shown before importing. */

const CROP_KINDS = { portrait: { w: 520, h: 640, label: 'Portrait' }, item: { w: 600, h: 400, label: 'Illustration d’objet' } };
const cropKind = () => ($('#itemForm') && !$('#modal').hidden ? 'item' : 'portrait');

/* ---------------------------------------------------------------- cropper */
const cropBox = Object.assign(document.createElement('div'), { id: 'cropBox', hidden: true });
document.body.appendChild(cropBox);
function openCropper(src, kind, cb, credit = '') {
  const K = CROP_KINDS[kind], img = new Image();
  img.onload = () => {
    const maxW = Math.min(640, innerWidth - 48), maxH = Math.min(innerHeight * 0.6, 520), k = Math.min(maxW / img.width, maxH / img.height, 1);
    const W = Math.round(img.width * k), H = Math.round(img.height * k), ar = K.w / K.h;
    let fw = Math.min(W, H * ar), fh = fw / ar; const st = { x: (W - fw) / 2, y: (H - fh) / 2, s: 1 };
    cropBox.innerHTML = `<div class="crop-card"><div class="crop-head"><span class="led"></span><b>Recadrer · ${K.label}</b><span class="grow"></span><button class="iconbtn" data-crop="cancel" aria-label="Annuler">${ic('x', 14)}</button></div>
      <div class="crop-stage" style="width:${W}px;height:${H}px"><img src="${esc(src)}" alt="" draggable="false"><div class="crop-frame"></div></div>
      <div class="crop-row"><label>Taille du cadre<input type="range" min="20" max="100" value="100" data-crop="size"></label><span class="grow"></span>
        ${credit ? `<small class="crop-credit">${credit}</small>` : ''}</div>
      <div class="modal-acts"><button class="btn" data-crop="cancel">Annuler</button><button class="btn orange" data-crop="ok">Utiliser</button></div></div>`;
    cropBox.hidden = false;
    const frame = cropBox.querySelector('.crop-frame'), full = Math.min(W, H * ar);
    const draw = () => { fw = full * st.s; fh = fw / ar; st.x = Math.max(0, Math.min(W - fw, st.x)); st.y = Math.max(0, Math.min(H - fh, st.y));
      Object.assign(frame.style, { left: st.x + 'px', top: st.y + 'px', width: fw + 'px', height: fh + 'px' }); };
    draw();
    let drag = null;
    frame.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, sx: st.x, sy: st.y }; frame.setPointerCapture(e.pointerId); };
    frame.onpointermove = e => { if (!drag) return; st.x = drag.sx + e.clientX - drag.x; st.y = drag.sy + e.clientY - drag.y; draw(); };
    frame.onpointerup = () => { drag = null; };
    const size = cropBox.querySelector('[data-crop="size"]');
    const resize = v => { const cx = st.x + fw / 2, cy = st.y + fh / 2; st.s = Math.max(.2, Math.min(1, v)); fw = full * st.s; fh = fw / ar; st.x = cx - fw / 2; st.y = cy - fh / 2; size.value = Math.round(st.s * 100); draw(); };
    size.oninput = () => resize(+size.value / 100);
    cropBox.querySelector('.crop-stage').onwheel = e => { e.preventDefault(); resize(st.s * (e.deltaY < 0 ? 1.05 : 0.95)); };
    cropBox.onclick = e => {
      const a = e.target.closest('[data-crop]')?.dataset.crop;
      if (a === 'cancel') { cropBox.hidden = true; cropBox.innerHTML = ''; }
      if (a === 'ok') {
        const cv = Object.assign(document.createElement('canvas'), { width: K.w, height: K.h });
        cv.getContext('2d').drawImage(img, st.x / k, st.y / k, fw / k, fh / k, 0, 0, K.w, K.h);
        cropBox.hidden = true; cropBox.innerHTML = '';
        cb(cv.toDataURL('image/jpeg', 0.88));
      }
    };
  };
  img.onerror = () => toast('Image illisible.');
  img.src = src;
}

// every file import of a portrait or an item illustration is cropped first
readImage = function (file, max, cb) {
  const kind = cropKind(), r = new FileReader();
  r.onload = () => openCropper(r.result, kind, cb);
  r.readAsDataURL(file);
};

/* ---------------------------------------------------------------- online search (Wikimedia Commons) */
const imgSearchBox = Object.assign(document.createElement('div'), { id: 'imgSearch', hidden: true });
document.body.appendChild(imgSearchBox);
let imgSearchCb = null, imgSearchKind = 'portrait', imgResults = [], imgSource = 'wikimedia';
const IMG_SOURCES = { wikimedia: 'Wikimedia', pixabay: 'Pixabay', ddg: 'DuckDuckGo' };
function openImageSearch(kind, cb) {
  imgSearchKind = kind; imgSearchCb = cb;
  imgSearchBox.innerHTML = `<div class="crop-card"><div class="crop-head"><span class="led"></span><b>Rechercher une image · ${CROP_KINDS[kind].label}</b><span class="grow"></span><button class="iconbtn" data-is="close" aria-label="Fermer">${ic('x', 14)}</button></div>
    <div class="seg is-tabs">${Object.entries(IMG_SOURCES).map(([k, l]) => `<button type="button" data-is="src" data-src="${k}" aria-pressed="${imgSource === k}"><span class="dot"></span>${l}</button>`).join('')}</div>
    <form class="srch-q" id="isForm">${ic('search', 14)}<input class="field" name="q" placeholder="ex. portrait chevalier, lanterne ancienne…" autocomplete="off" required><button class="btn orange" type="submit">Chercher</button></form>
    <p class="hint" style="margin:0" id="isNote"></p>
    <div class="is-grid" id="isGrid"></div></div>`;
  imgSearchBox.hidden = false; imgSearchBox.querySelector('input').focus(); isNote();
}
function isNote() {
  const n = $('#isNote'); if (!n) return;
  n.textContent = imgSource === 'wikimedia' ? 'Images libres de droits de Wikimedia Commons ; auteur et licence sous chaque image.'
    : imgSource === 'pixabay' ? 'Images Pixabay, utilisables librement (licence Pixabay).'
    : 'Résultats de tout le web : droits d’auteur inconnus, à réserver à un usage privé entre joueurs. DuckDuckGo peut refuser la recherche par moments.';
}
imgSearchBox.addEventListener('submit', async e => {
  e.preventDefault(); e.stopImmediatePropagation();
  const q = e.target.q.value.trim(), grid = $('#isGrid'); if (!q) return;
  grid.innerHTML = '<p class="hint">Recherche…</p>';
  if (imgSource !== 'wikimedia') {
    try { imgResults = (await call('image-search', { action: 'search', source: imgSource, q })).results; }
    catch (err) { grid.innerHTML = `<p class="hint">${esc(errMsg(err))}</p>`; return; }
    grid.innerHTML = imgResults.length ? imgResults.map((r, n) => `<button class="is-item" data-is="pick" data-n="${n}" title="${esc(r.title)}"><img src="${esc(r.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer"><small>${esc(r.author)} · ${esc(r.licence)}</small></button>`).join('') : '<p class="hint">Aucun résultat.</p>';
    return;
  }
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent('filetype:bitmap ' + q)}&gsrlimit=24&prop=imageinfo&iiprop=url|extmetadata&iiextmetadatafilter=LicenseShortName|Artist&iiurlwidth=900&format=json&origin=*`;
    const j = await fetch(url).then(r => r.json());
    const strip = h => { const d = document.createElement('div'); d.innerHTML = DOMPurify.sanitize(String(h || '')); return d.textContent.trim(); };
    imgResults = Object.values(j.query?.pages || {}).map(p => { const i = p.imageinfo?.[0] || {}; return { thumb: i.thumburl, title: p.title.replace(/^File:|\.[a-z]+$/gi, ''),
      licence: strip(i.extmetadata?.LicenseShortName?.value) || 'licence inconnue', author: strip(i.extmetadata?.Artist?.value).slice(0, 60) || 'auteur inconnu', page: i.descriptionurl }; })
      .filter(r => r.thumb && /^https:\/\/[a-z.]*wikimedia\.org\//.test(r.thumb));
    grid.innerHTML = imgResults.length ? imgResults.map((r, n) => `<button class="is-item" data-is="pick" data-n="${n}" title="${esc(r.title)}"><img src="${esc(r.thumb)}" alt="" loading="lazy"><small>${esc(r.author)} · ${esc(r.licence)}</small></button>`).join('') : '<p class="hint">Aucun résultat.</p>';
  } catch (err) { grid.innerHTML = `<p class="hint">Recherche impossible : ${esc(errMsg(err))}</p>`; }
}, true);
imgSearchBox.addEventListener('click', async e => {
  const b = e.target.closest('[data-is]'); if (!b) return;
  if (b.dataset.is === 'close') { imgSearchBox.hidden = true; return; }
  if (b.dataset.is === 'src') { imgSource = b.dataset.src; imgSearchBox.querySelectorAll('[data-is="src"]').forEach(x => x.setAttribute('aria-pressed', x === b)); isNote(); $('#isGrid').innerHTML = ''; const f = $('#isForm'); if (f.q.value.trim()) f.requestSubmit(); return; }
  const r = imgResults[+b.dataset.n]; if (!r) return;
  try {
    toast('Chargement de l’image…');
    let dataUrl;
    if (r.url && imgSource !== 'wikimedia') dataUrl = (await call('image-search', { action: 'fetch', url: r.url })).dataUrl;   // via the server: these hosts refuse the browser
    else { const blob = await fetch(r.thumb).then(x => { if (!x.ok) throw new Error('HTTP ' + x.status); return x.blob(); });
      dataUrl = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); }); }
    imgSearchBox.hidden = true;
    openCropper(dataUrl, imgSearchKind, imgSearchCb, `${esc(r.author)} · ${esc(r.licence)} · ${IMG_SOURCES[imgSource]}`);
  } catch (err) { toast('Image indisponible : ' + errMsg(err)); }
});

/* ---------------------------------------------------------------- buttons */
const setPortrait = url => { C.portrait = { type: 'img', src: url, style: C.portrait?.style, p: C.portrait?.p }; render(); toast('Portrait importé'); };
const _tIdentityImg = tIdentity;
tIdentity = function () {
  const html = _tIdentityImg();
  return html.replace('</div></div><div style="min-width:0">', `<button class="btn xs" data-act="portraitSearch" title="Rechercher une image en ligne">${ic('search', 12)}</button></div></div><div style="min-width:0">`);
};
ACT.portraitSearch = () => { openImageSearch('portrait', setPortrait); return false; };
const _itemFormImg = itemForm;
itemForm = function (def) {
  _itemFormImg(def);
  $('#itemForm [data-act="clearItemImg"]')?.insertAdjacentHTML('beforebegin', `<button type="button" class="btn xs" data-act="itemImgSearch">${ic('search', 12)}Rechercher en ligne</button>`);
};
ACT.itemImgSearch = () => {
  openImageSearch('item', url => { const h = $('#itemImg'), pv = $('#itemImgPrev'); if (h) h.value = url; if (pv) { pv.src = url; pv.hidden = false; } });
  return false;
};

const imgCss = document.createElement('style');
imgCss.textContent = `
#cropBox,#imgSearch{position:fixed;inset:0;z-index:105;display:grid;place-items:center;padding:16px;background:rgba(10,9,8,.82)}
#cropBox[hidden],#imgSearch[hidden]{display:none}
.crop-card{width:min(720px,100%);max-height:calc(100dvh - 32px);overflow:auto;display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:12px;
  background:var(--noise),linear-gradient(180deg,var(--panel-a),var(--panel-b));box-shadow:inset 0 1px 0 rgba(255,240,215,.08),0 3px 0 #0b0a09,0 30px 60px rgba(0,0,0,.7)}
.crop-head{display:flex;align-items:center;gap:8px}
.crop-head b{font:400 11px var(--f-display);letter-spacing:.14em;text-transform:uppercase;color:var(--cream)}
.crop-stage{position:relative;margin:0 auto;user-select:none;touch-action:none}
.crop-stage img{width:100%;height:100%;display:block;opacity:.45}
.crop-frame{position:absolute;cursor:move;box-shadow:0 0 0 9999px rgba(10,9,8,.55),inset 0 0 0 2px var(--orange-hi);background:transparent;touch-action:none}
.crop-stage{overflow:hidden}
.crop-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.crop-row label{display:flex;align-items:center;gap:8px;font:500 10.5px var(--f-mono);color:var(--mute);text-transform:uppercase;letter-spacing:.08em}
.crop-row input[type=range]{width:160px;accent-color:var(--orange)}
.crop-credit{font:500 10.5px var(--f-mono);color:var(--mute)}
#isForm{display:flex;gap:8px;align-items:center}
.is-tabs{align-self:flex-start}
.is-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;max-height:56vh;overflow:auto}
.is-item{display:flex;flex-direction:column;gap:4px;border:0;padding:4px;border-radius:6px;cursor:pointer;background:var(--well);color:var(--mute);text-align:left}
.is-item img{width:100%;height:110px;object-fit:cover;border-radius:4px}
.is-item small{font-size:10px;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.is-item:hover{outline:2px solid var(--orange)}`;
document.head.appendChild(imgCss);
