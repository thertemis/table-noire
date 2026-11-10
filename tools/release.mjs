// Prepare (and optionally publish) a new version of the web app (web/).
//   node tools/release.mjs            checks + version bump, then deploy if tn.config.json has "cloudflarePages"
//                                     (GitHub Pages: commit and push after the bump, the workflow deploys)
//   node tools/release.mjs --e2e      same, after running tests/e2e.mjs (do it when Functions or the schema changed)
//   node tools/release.mjs --check    checks only (no bump, no deploy)
// Why the bump: browsers and CDNs may keep files for hours, so every release needs a new BUILD
// (shown on the login screen), new ?v= on the script tags and a new service-worker cache name.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)), WEB = ROOT + 'web/';
const CFG = existsSync(ROOT + 'tn.config.json') ? JSON.parse(readFileSync(ROOT + 'tn.config.json', 'utf8')) : {};
const args = new Set(process.argv.slice(2));
const run = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const fail = msg => { console.error('✗ ' + msg); process.exit(1); };
const ok = msg => console.log('✓ ' + msg);

/* ---------------------------------------------------------------- checks */
try { execSync('node tools/configure.mjs --check', { cwd: ROOT, stdio: 'inherit' }); } catch { process.exit(1); }
const index = readFileSync(WEB + 'index.html', 'utf8'), sw = readFileSync(WEB + 'sw.js', 'utf8'), online = readFileSync(WEB + 'online.js', 'utf8');
const local = [...index.matchAll(/<script src="([a-z0-9-]+\.js)\?v=([^"]+)"/g)].map(m => ({ file: m[1], v: m[2] }));
const build = /const BUILD = '([^']+)'/.exec(online)?.[1];
if (!build) fail('BUILD introuvable dans online.js');
if (/<script>/.test(index)) fail('index.html contient un script intégré : la CSP le bloquerait (mets-le dans un fichier)');
for (const s of local) {
  if (!existsSync(WEB + s.file)) fail(`index.html charge ${s.file}, absent de web/`);
  if (s.v !== build) fail(`${s.file} est chargé en ?v=${s.v}, la version est ${build}`);
}
const shell = [...(/const SHELL = \[([^\]]+)\]/.exec(sw)?.[1] || '').matchAll(/'([^']+)'/g)].map(m => m[1]);
for (const s of local) if (!shell.includes(s.file)) fail(`${s.file} manque dans SHELL (web/sw.js) : il ne serait pas disponible hors ligne`);
const orphans = readdirSync(WEB).filter(f => f.endsWith('.js') && !['sw.js'].includes(f) && !local.some(s => s.file === f));
if (orphans.length) fail(`fichiers JS non chargés par index.html : ${orphans.join(', ')}`);
for (const f of readdirSync(WEB).filter(f => f.endsWith('.js'))) { try { run(`node --check "web/${f}"`); } catch (e) { fail(`erreur de syntaxe dans ${f}\n${e.stderr}`); } }
ok(`${local.length} modules, ordre et versions cohérents, syntaxe OK (version actuelle ${build})`);
if (args.has('--check')) process.exit(0);

if (args.has('--e2e')) {
  console.log('… tests de bout en bout (tests/e2e.mjs)');
  try { const out = run('node tests/e2e.mjs', { timeout: 600000 }); console.log(out.split('\n').filter(l => /FAIL|passed/.test(l)).join('\n')); }
  catch (e) { console.log((e.stdout || '').split('\n').filter(l => /FAIL|passed/.test(l)).join('\n')); fail('tests en échec : publication annulée'); }
}

/* ---------------------------------------------------------------- bump */
const today = new Date().toISOString().slice(0, 10);
const [day, n] = build.split(/\.(?=\d+$)/);
const next = day === today ? `${today}.${+n + 1}` : `${today}.1`;
writeFileSync(WEB + 'index.html', index.replaceAll(`?v=${build}"`, `?v=${next}"`));
writeFileSync(WEB + 'online.js', online.replace(`const BUILD = '${build}'`, `const BUILD = '${next}'`));
writeFileSync(WEB + 'sw.js', sw.replace(/const CACHE = 'tn-shell-v(\d+)'/, (m, v) => `const CACHE = 'tn-shell-v${+v + 1}'`));
ok(`version ${build} → ${next}`);

/* ---------------------------------------------------------------- deploy */
const CF = CFG.cloudflarePages, SITE = (CFG.site || '').replace(/\/$/, '');
if (!CF) { ok('pas de "cloudflarePages" dans tn.config.json : commite et pousse, GitHub Pages publie web/'); process.exit(0); }
const who = run('npx --yes wrangler@4 whoami');
if (!who.includes(CF.account)) fail(`wrangler n'est pas connecté au compte Cloudflare ${CF.account}. Lance : npx wrangler login`);
const dep = run(`npx --yes wrangler@4 pages deploy web --project-name ${CF.project} --branch main --commit-dirty=true`, { timeout: 300000 });
ok('déployé : ' + (/https:\/\/[a-z0-9]+\.[a-z0-9-]+\.pages\.dev/.exec(dep)?.[0] || '?'));
if (!SITE) process.exit(0);
for (let i = 0; i < 40; i++) {
  const body = await fetch(`${SITE}/online.js?v=${next}&x=${Date.now()}`, { headers: { 'User-Agent': 'Mozilla/5.0 (TableNoire release)' } }).then(r => r.text()).catch(() => '');
  if (body.includes(`const BUILD = '${next}'`)) { ok(`en ligne sur ${SITE} (version ${next})`); process.exit(0); }
  await new Promise(r => setTimeout(r, 5000));
}
fail(`déployé, mais ${SITE} ne sert pas encore la nouvelle version après 200 s`);
