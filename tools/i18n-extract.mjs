// Find the French interface strings of the app and check that web/i18n-en.js translates all of them.
//   node tools/i18n-extract.mjs            list the strings missing from the English dictionary
//   node tools/i18n-extract.mjs --json     print every string found (source text, or pattern with {0}, {1}…)
//   node tools/i18n-extract.mjs --check    exit 1 when some are missing (used by tools/release.mjs)
// Sources: web/*.js, web/index.html, appwrite/functions/*/src/*.js (their messages reach the screen).
// A string is a text run between HTML tags, or a title / placeholder / aria-label / alt value, found in a JS string,
// a template literal (each ${…} becomes {0}, {1}…) or the HTML of index.html. Demo data of the mockup is skipped.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MODE = process.argv[2] || '';

/* ---------------------------------------------------------------- JS lexer: string and template literals */
// returns [{ parts: [string, null, string, …] }] — null marks a ${…} hole; nested literals are returned too
const unesc = c => ({ n: '\n', t: '\t', r: '' })[c] ?? c;
function literals(src) {
  const out = [];
  let i = 0, prev = '';   // prev: last significant char, to tell a regex literal from a division
  const skipRegex = () => { i++; let cls = false; while (i < src.length) { const c = src[i]; if (c === '\\') { i += 2; continue; } if (c === '[') cls = true; else if (c === ']') cls = false; else if (c === '/' && !cls) { i++; break; } else if (c === '\n') break; i++; } while (/[a-z]/i.test(src[i] || '')) i++; };
  function readTemplate() {   // at the backtick
    i++; const parts = [''];
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { parts[parts.length - 1] += unesc(src[i + 1]); i += 2; continue; }
      if (c === '`') { i++; break; }
      if (c === '$' && src[i + 1] === '{') { i += 2; scanCode('}'); parts.push(null, ''); continue; }
      parts[parts.length - 1] += c; i++;
    }
    out.push({ parts });
  }
  function scanCode(close) {   // scan code until the matching close brace (or end of file)
    let depth = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? src.length : i + 2; continue; }
      if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]|^$|return|typeof/.test(prev)) { skipRegex(); prev = 'x'; continue; }
      if (c === '"' || c === "'") {
        let s = ''; i++;
        while (i < src.length && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') { s += unesc(src[i + 1]); i += 2; continue; } s += src[i++]; }
        i++; out.push({ parts: [s] }); prev = 'x'; continue;
      }
      if (c === '`') { readTemplate(); prev = 'x'; continue; }
      if (c === '{') depth++;
      if (c === '}') { if (depth === 0 && close === '}') { i++; return; } depth--; }
      if (!/\s/.test(c)) { prev = /[A-Za-z0-9_$]/.test(c) ? (/[A-Za-z]/.test(c) ? (prev.length < 8 && /^[a-z]+$/.test(prev) ? prev + c : c) : 'x') : c; }
      i++;
    }
  }
  scanCode(null);
  return out;
}

/* ---------------------------------------------------------------- strings from a literal */
const FRENCH = /[a-zà-ÿ]/i;
const looksUi = s => {
  const t = s.trim();
  if (!FRENCH.test(t) || t.length < 2) return false;
  if (/^[\w.-]+$/.test(t) && !/^[A-ZÀ-Ý]/.test(t) && !/[à-ÿ]/.test(t)) return false;   // identifiers, keys, css classes
  if (/^[a-z]+([A-Z][a-z]+)+$/.test(t)) return false;                                    // camelCase
  if (/^(https?:|data:|#|\.|\/|[a-z-]+:[^ ])/.test(t)) return false;                     // urls, selectors, css
  if (/[{}]|[^ ];|;[^ ]|=>|\bvar\(|\bpx\b|^\d/.test(t)) return false;   // (French " ; " is text)                                  // code, css values
  if (/^[MLHVCSQTAZ][\d\s.,MLHVCSQTAZ-]*$/i.test(t) && /\d/.test(t)) return false;           // svg path data
  if (/^[\w.-]+\/[\w./-]+$/.test(t)) return false;                                         // file paths
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(t)) return false;                                            // no word (dice notation…)
  if (/^[A-Z_]{2,}$/.test(t) && !/^(FOR|AGI|INT|PER|VOL|CHA|MJ|PNJ|PV|JOUEUR|SÉANCE)$/.test(t)) return false;
  return true;
};
// "pas {0}", "{0} lancers": a word next to a value is text even when it looks like an identifier
const ok = p => looksUi(p.replace(/\{\d+\}/g, '')) || /^\{\d+\}\s+[a-zà-ÿ]{2,}$|^[a-zà-ÿ]{2,}\s+\{\d+\}$/i.test(p);
const ATTR = /\b(title|placeholder|aria-label|alt)="([^"]*)"/g;
function strings(parts) {
  // join the parts, holes as \u0001, then cut text runs between tags and pick attribute values
  const s = parts.map(p => p === null ? '\u0001' : p).join('');
  const found = [];
  const add = raw => {
    let t = raw.replace(/\s+/g, ' ').trim().replace(/^(\u0001\s*)+|(\s*\u0001)+$/g, '').trim();   // edge holes are markup or icons
    if (!t) return;
    let n = 0; t = t.replace(/\u0001/g, () => `{${n++}}`);
    // "pas {0}", "{0} lancers": a word next to a value is text even when it looks like an identifier
    if (ok(t)) found.push(t);
    // a run with a trailing value ("Rôle : {0}") is also needed as a pattern
    const full = raw.replace(/\s+/g, ' ').trim().replace(/^(\u0001\s*)+/, '');
    // a leading value followed by a space ("${n} contacts…", "${on ? 'Couper' : 'Activer'} le son…") is text, not an icon
    const lead = raw.replace(/\s+/g, ' ').trim();
    if (/^\u0001 \S/.test(lead)) {
      let m = 0; const p = lead.replace(/(\s*\u0001)+$/, '').replace(/\u0001/g, () => `{${m++}}`); if (p !== t && ok(p)) found.push(p);
      if (/\S\s*\u0001$/.test(lead)) { let k = 0; const b = lead.replace(/\u0001/g, () => `{${k++}}`); if (b !== t && b !== p && ok(b)) found.push(b); }   // value at both ends
    }
    if (/\u0001$/.test(full) && /\S\s*\u0001$/.test(full)) { let m = 0; const p = full.replace(/\u0001/g, () => `{${m++}}`); if (p !== t && ok(p)) found.push(p); }
  };
  for (const m of s.matchAll(ATTR)) add(m[2]);
  const text = s.replace(/<[^>]*>/g, '\u0002');
  for (const run of text.split('\u0002')) add(run.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"'));
  return found;
}

/* ---------------------------------------------------------------- sources */
const DEMO = /^const (P|S|C|ART|ITEMS|INV|SKILLS|SKOWN|LORE|MAPS|ASSETS|INVITES|LOG|PT|LIMB|ORGAN_Z|SKULL_Z) = /;
function jsSource(file) {
  let src = readFileSync(file, 'utf8');
  if (file.endsWith('web/app.js')) {   // drop the mockup demo data (top-level constants listed in DEMO)
    const lines = src.split('\n'); let skip = false;
    src = lines.map(l => { if (/^(const|let|function|\/\*|\S)/.test(l) && !/^[\]}]/.test(l)) skip = DEMO.test(l); return skip ? '' : l; }).join('\n');
  }
  return src;
}
const all = new Map();   // string -> first place found
const note = (s, where) => { if (!all.has(s)) all.set(s, where); };
const web = ROOT + 'web/';
for (const f of readdirSync(web).filter(f => f.endsWith('.js') && !/^(i18n|config|sw)/.test(f))) {
  for (const lit of literals(jsSource(web + f))) for (const s of strings(lit.parts)) note(s, 'web/' + f);
}
const html = readFileSync(web + 'index.html', 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
for (const s of strings([html])) note(s, 'web/index.html');
const fnDir = ROOT + 'appwrite/functions/';
for (const fn of readdirSync(fnDir)) {
  const d = fnDir + fn + '/src/';
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter(f => f.endsWith('.js') && f !== 'config.js'))
    for (const lit of literals(readFileSync(d + f, 'utf8'))) for (const s of strings(lit.parts)) note(s, `appwrite/functions/${fn}/${f}`);
}

/* ---------------------------------------------------------------- compare with the dictionary */
const [dict, same] = existsSync(web + 'i18n-en.js') ? new Function(readFileSync(web + 'i18n-en.js', 'utf8') + '; return [I18N_EN, I18N_SAME];')() : [{}, []];
const known = new Set([...Object.keys(dict), ...same]);
const missing = [...all].filter(([s]) => !known.has(s));
const unused = [...known].filter(s => !all.has(s));
if (MODE === '--json') { console.log(JSON.stringify(Object.fromEntries(all), null, 1)); process.exit(0); }
if (MODE === '--check') {
  if (missing.length) { console.error(`✗ ${missing.length} texte(s) sans traduction anglaise (node tools/i18n-extract.mjs) :\n` + missing.slice(0, 15).map(([s, w]) => `  ${w} : ${s}`).join('\n')); process.exit(1); }
  console.log(`✓ ${all.size} textes, tous traduits en anglais`); process.exit(0);
}
for (const [s, w] of missing) console.log(`${w}\t${s}`);
console.error(`${missing.length} manquant(s) sur ${all.size}` + (unused.length ? ` · plus utilisé(s) dans le code : ${unused.join(' | ')}` : ''));
