// Build an anonymised copy of this repository, ready to be pushed as a public project.
//   node tools/export-public.mjs <target-folder>
// - copies the tracked (and new, non-ignored) files, except the ones listed in EXCLUDE;
// - replaces tn.config.json by the example and regenerates every configured file with the example values;
// - refuses to finish if a file still contains a string of .export-denylist (local, git-ignored list of your own
//   domains, ids, names), an e-mail address, a private IP, an API key or a private key, or if an image carries
//   metadata (EXIF, text chunks).
// The target gets no git history: initialise it yourself after reading the report.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const target = process.argv[2] && resolve(process.argv[2]);
const fail = msg => { console.error('✗ ' + msg); process.exit(1); };
if (!target) fail('usage : node tools/export-public.mjs <dossier-cible>');
if (target.startsWith(resolve(ROOT))) fail('le dossier cible doit être hors du dépôt');
if (existsSync(target) && readdirSync(target).length) fail(`${target} n'est pas vide`);

const EXCLUDE = [/^tn\.config\.json$/, /^infra\/appwrite\/backup\//, /^infra\/appwrite\/portainer-stack\.yml$/, /^\.claude\//, /^\.export-denylist$/];
const files = execSync('git ls-files -co --exclude-standard', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter(f => existsSync(join(ROOT, f)) && !EXCLUDE.some(re => re.test(f)));
for (const f of files) { mkdirSync(dirname(join(target, f)), { recursive: true }); copyFileSync(join(ROOT, f), join(target, f)); }
copyFileSync(join(ROOT, 'tn.config.example.json'), join(target, 'tn.config.json'));
console.log(`✓ ${files.length} fichiers copiés`);

// generated files with the example values (configure.mjs refuses placeholders unless told otherwise)
execSync('node tools/configure.mjs --example', { cwd: target, stdio: 'inherit' });
rmSync(join(target, 'tn.config.json'));   // users create theirs from tn.config.example.json

/* ---------------------------------------------------------------- scan */
const deny = existsSync(join(ROOT, '.export-denylist'))
  ? readFileSync(join(ROOT, '.export-denylist'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')).map(s => s.toLowerCase())
  : fail('.export-denylist introuvable : crée-le (une chaîne interdite par ligne : tes domaines, identifiants, nom…)');
const RULES = [
  [/[A-Za-z0-9._%+-]+@(?!example\.(com|org|fr)\b|players\.tablenoire\.invalid\b|mondomaine\.fr\b|appwrite\.io\b)[A-Za-z0-9.-]+\.[a-z]{2,}/g, 'adresse e-mail'],
  [/\b(?:10|127|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?:\.\d{1,3})?\b/g, 'IP privée'],
  [/\b(?:standard|secret|sk|pk|ghp|gho|xox[bp])_[A-Za-z0-9]{16,}/g, 'clé API'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, 'clé privée'],
];
// harmless matches (documentation examples, proxy ranges, test addresses checked by the e2e suite)
const ALLOW = [/^192\.168\.1\.(x|20|1)$/, /^192\.168\.0\.0$/, /^127\.0\.0\.1$/, /^10\.0\.0\.0$/, /^172\.16\.0\.0$/, /^192\.168\.1\.1$/,
  /^172\.16\.238\.(0|100)$/, /^127\.0\.0\.11$/, /^10\.89\.0\.0$/];   // Appwrite / Docker internal defaults
const problems = [];
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
for (const abs of walk(target)) {
  const rel = abs.slice(target.length + 1).replaceAll('\\', '/');
  const buf = readFileSync(abs);
  if (/\.(png|jpe?g|webp)$/i.test(rel)) {
    const s = buf.toString('latin1');
    if (/Exif\0\0|tEXt|iTXt|zTXt|<x:xmpmeta/.test(s)) problems.push(`${rel} : métadonnées d'image`);
    continue;
  }
  const txt = buf.toString('utf8'), low = txt.toLowerCase();
  for (const d of deny) if (low.includes(d)) problems.push(`${rel} : contient « ${d} »`);
  for (const [re, what] of RULES) for (const m of txt.matchAll(re)) if (!ALLOW.some(a => a.test(m[0]))) problems.push(`${rel} : ${what} (${m[0]})`);
}
if (problems.length) { console.error(problems.map(p => '  ' + p).join('\n')); fail(`${problems.length} problème(s) : rien n'est publiable en l'état`); }
console.log(`✓ aucune donnée personnelle détectée (${deny.length} termes interdits, e-mails, IP privées, clés, métadonnées d'images)`);
console.log(`→ ${target}`);
