/* i18n.js — interface language. The code is written in French; in English the dictionary of i18n-en.js
   (French source text → English) is applied to what the page shows:
   - text nodes, and the title / placeholder / aria-label / alt attributes, as soon as they are added or changed
     (MutationObserver: callbacks run before the next paint, so the French text is never seen);
   - #main is translated by render itself (stable.js) before packBento measures the tiles;
   - window.confirm / prompt / alert messages.
   A dictionary key may contain {0}, {1}… for values inside the text ("Rôle : {0}"); a captured value is translated
   too when the dictionary knows it. What players and GMs write (Markdown in .md, fields, [data-noi18n]) is left alone.
   tools/i18n-extract.mjs lists the texts missing from the dictionary (tools/release.mjs refuses to publish then). */

const LANGS = { fr: 'Français', en: 'English' };
const LANG = (() => {
  try { const s = localStorage.getItem('tn-lang'); if (s in LANGS) return s; } catch (_) {}
  return /^fr\b/i.test(navigator.language || '') ? 'fr' : 'en';
})();
document.documentElement.lang = LANG;
function setLang(l) { if (!(l in LANGS) || l === LANG) return; try { localStorage.setItem('tn-lang', l); } catch (_) {} location.reload(); }

const I18N = (() => {
  const dict = LANG === 'en' && typeof I18N_EN === 'object' ? I18N_EN : null;
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const exact = new Map(), pats = [], miss = new Set();
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (dict) for (const [fr, en] of Object.entries(dict)) {
    if (!/\{\d+\}/.test(fr)) { exact.set(norm(fr), en); continue; }
    const bits = fr.split(/\{(\d+)\}/), order = [];
    const re = new RegExp('^' + bits.map((b, i) => i % 2 ? (order.push(+b), '(.*?)') : reEsc(norm(b) === '' ? b : b.replace(/\s+/g, ' '))).join('') + '$', 's');
    pats.push({ re, order, en, lit: bits.filter((_, i) => !(i % 2)).join('').length, dot: fr.includes(' · ') });
  }
  pats.sort((a, b) => b.lit - a.lit);   // most specific first
  const word = /[A-Za-zÀ-ÿ]{2}/;

  function core(c) {
    const hit = exact.get(c);
    if (hit !== undefined) return hit;
    if (miss.has(c)) return null;
    for (const p of pats) {
      const m = p.re.exec(c);
      if (!m || (!p.dot && m.some((v, i) => i && v.includes(' · ')))) continue;   // "a · b" joins are split below
      return p.en.replace(/\{(\d+)\}/g, (_, n) => { const v = m[p.order.indexOf(+n) + 1] ?? ''; const t = v.trim() && v.trim() !== c ? core(v.trim()) : null; return t != null ? v.replace(v.trim(), t) : v; });
    }
    // "Coupure · Modérée", "Compétences · ce personnage": parts joined by a middle dot, translated one by one
    if (c.includes(' · ')) {
      const parts = c.split(' · '), tr = parts.map(p => p.includes(' · ') ? null : core(p));
      if (tr.some(x => x != null)) return parts.map((p, i) => tr[i] ?? p).join(' · ');
    }
    // "Vêtement #4f8d89", "Accent 3": a label followed by a colour or a number
    const tail = /^(.+?) (#[0-9a-f]{3,8}|\d+)$/i.exec(c);
    if (tail) { const l = exact.get(tail[1]); if (l !== undefined) return `${l} ${tail[2]}`; }
    if (miss.size > 20000) miss.clear();
    miss.add(c);
    return null;
  }
  /** Translate a French string shown to the user (returns it unchanged in French or when unknown). */
  function t(s) {
    if (!dict || typeof s !== 'string' || !word.test(s)) return s;
    const c = norm(s);
    const r = core(c);
    if (r == null) return s;
    return s.match(/^\s*/)[0] + r + s.match(/\s*$/)[0];
  }

  const SKIP = 'script,style,textarea,code,pre,.md,[contenteditable],[data-noi18n]';
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const done = new WeakMap();   // text node -> value we wrote (to ignore our own mutation)
  function text(n) {
    const v = n.nodeValue;
    if (done.get(n) === v || !word.test(v)) return;
    const p = n.parentElement;
    if (!p || p.closest(SKIP)) return;
    const r = t(v);
    if (r !== v) n.nodeValue = r;
    done.set(n, r);
  }
  function attrs(el) {
    if (el.closest(SKIP) && !el.matches('textarea,[contenteditable]')) return;
    for (const a of ATTRS) { const v = el.getAttribute(a); if (v && word.test(v)) { const r = t(v); if (r !== v) el.setAttribute(a, r); } }
  }
  /** Translate a whole subtree now (used by render before the bento is packed). */
  function translate(root) {
    if (!dict || !root) return;
    if (root.nodeType === 3) return text(root);
    if (root.nodeType !== 1) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) text(n);
    if (root.matches('[title],[placeholder],[aria-label],[alt]')) attrs(root);
    for (const el of root.querySelectorAll('[title],[placeholder],[aria-label],[alt]')) attrs(el);
  }
  if (dict) {
    const obs = new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'childList') m.addedNodes.forEach(translate);
        else if (m.type === 'characterData') text(m.target);
        else if (m.type === 'attributes') attrs(m.target);
      }
    });
    const start = () => { translate(document.body); obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
    document.title = t(document.title);
    for (const f of ['confirm', 'alert', 'prompt']) { const orig = window[f].bind(window); window[f] = (msg, ...rest) => orig(t(String(msg ?? '')), ...rest); }
  }
  return { t, translate, lang: LANG };
})();
/** Translate a French text for display (identity in French). */
const tr = I18N.t;
/** Language buttons (login and campaign screens). */
const langSwitchHtml = () => `<div class="seg lang-switch" data-noi18n role="group" aria-label="Language">${Object.entries(LANGS).map(([k, l]) =>
  `<button type="button" data-lang="${k}" aria-pressed="${k === LANG}"><span class="dot"></span>${l}</button>`).join('')}</div>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); });
/** Locale for dates, numbers and sorting. */
const LOCALE = LANG === 'fr' ? 'fr-FR' : 'en-GB';
