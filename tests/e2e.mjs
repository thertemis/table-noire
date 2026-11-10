// End-to-end check of the Table Noire backend (Appwrite Functions + permissions), run before publishing:
//   node tests/e2e.mjs
// Needs: Node 18+, the `appwrite` CLI logged in on this machine (it creates and deletes a throwaway admin account).
// Everything it creates (accounts, campaigns, rows) is deleted at the end, even when a check fails.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const CFG = JSON.parse(readFileSync(new URL('../tn.config.json', import.meta.url), 'utf8')).appwrite;   // see tn.config.example.json
const EP = CFG.endpoint, P = CFG.projectId, DB = CFG.databaseId;
const H = { 'X-Appwrite-Project': P, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (TableNoire e2e)' };   // Cloudflare blocks non-browser agents
const ADMIN_ID = 'e2eadmin' + randomBytes(3).toString('hex'), ADMIN_EMAIL = `${ADMIN_ID}@players.tablenoire.invalid`;
const pw = () => randomBytes(12).toString('base64url');
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + extra : ''}`); };
// run from appwrite/ (project config); arguments are generated here and contain no spaces or quotes
const cli = args => execSync(['appwrite', ...args].join(' '), { encoding: 'utf8', cwd: fileURLToPath(new URL('../appwrite/', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'] });

async function login(email, password) {
  const r = await fetch(EP + '/account/sessions/email', { method: 'POST', headers: H, body: JSON.stringify({ email, password }) });
  const c = (r.headers.getSetCookie() || []).find(x => x.startsWith(`a_session_${P}=`));
  if (!c) throw new Error(`login failed for ${email}: ${r.status}`);
  return c.split(';')[0];
}
const api = (ck, method, path, body) => fetch(EP + path, { method, headers: { ...H, ...(ck ? { Cookie: ck } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  .then(async r => ({ status: r.status, json: r.status === 204 ? {} : await r.json().catch(() => ({})) }));
const fn = async (ck, id, body) => { const r = await api(ck, 'POST', `/functions/${id}/executions`, { body: JSON.stringify(body), async: false }); try { return JSON.parse(r.json.responseBody); } catch { return { ok: false, message: r.json.message || 'no body' }; } };
const q = (method, attribute, values) => encodeURIComponent(JSON.stringify(attribute ? { method, attribute, values } : { method, values }));
const list = (ck, t, ...qs) => api(ck, 'GET', `/tablesdb/${DB}/tables/${t}/rows?${qs.map(x => 'queries[]=' + x).join('&')}`).then(r => r.json.rows || []);
const row = (ck, t, data, permissions) => api(ck, 'POST', `/tablesdb/${DB}/tables/${t}/rows`, { rowId: 'unique()', data, ...(permissions ? { permissions } : {}) }).then(r => r.json);

let admin, player, camp, playerId;
const adminPw = pw(), playerPw = pw(), playerName = 'e2ejoueur' + randomBytes(2).toString('hex');
try {
  cli(['users', 'create', '--user-id', ADMIN_ID, '--email', ADMIN_EMAIL, '--password', adminPw, '--name', ADMIN_ID]);
  cli(['users', 'update-labels', '--user-id', ADMIN_ID, '--labels', 'admin']);
  admin = await login(ADMIN_EMAIL, adminPw);

  // campaign + invited player
  camp = (await fn(admin, 'admin', { action: 'createCampaign', name: 'E2E', gmUserId: ADMIN_ID })).id;
  check('admin creates a campaign', !!camp);
  const inv = await fn(admin, 'admin', { action: 'createInvite', campaignId: camp, role: 'player' });
  const red = await fn(null, 'redeem-invite', { token: inv.invite?.token, username: playerName, password: playerPw });
  check('invite link creates the player', red.ok, red.message);
  const again = await fn(null, 'redeem-invite', { token: inv.invite?.token, username: playerName + 'x', password: playerPw });
  check('invite link works only once', !again.ok);
  player = await login(red.email, playerPw);
  playerId = (await api(player, 'GET', '/account')).json.$id;
  const pc = (await list(player, 'characters', q('equal', 'campaignId', [camp])))[0];
  check('player has a character', pc && pc.ownerId === playerId);

  // permissions
  await row(admin, 'gm_notes', { campaignId: camp, entityType: 'test', entityId: 'x', body: 'secret' });
  await new Promise(r => setTimeout(r, 2500));   // apply-visibility
  check('player cannot read GM notes', (await list(player, 'gm_notes', q('equal', 'campaignId', [camp]))).length === 0);
  check('player reads the campaign row', (await api(player, 'GET', `/tablesdb/${DB}/tables/campaigns/rows/${camp}`)).status === 200);
  check('player cannot update the campaign', (await fn(player, 'admin', { action: 'updateCampaign', campaignId: camp, accent: '#000000' })).ok === false);

  // sheet value: player gauge step + history
  const def = await row(admin, 'field_defs', { campaignId: camp, key: 'hp', label: 'Santé', kind: 'gauge', config: JSON.stringify({ max: 20, min: 0, player_editable: true }), defaultVisibility: 'all', sort: 1 });
  const val = await row(admin, 'character_values', { campaignId: camp, characterId: pc.$id, fieldId: def.$id, value: JSON.stringify({ value: 20, max: 20 }), visibility: 'all' });
  await new Promise(r => setTimeout(r, 2500));
  const sv = await fn(player, 'player-action', { action: 'setValue', rowId: val.$id, value: 25 });
  check('player gauge step is clamped to the max', sv.ok && sv.value === 20, JSON.stringify(sv));
  const sv2 = await fn(player, 'player-action', { action: 'setValue', rowId: val.$id, value: 17 });
  check('player gauge step saved', sv2.ok && sv2.value === 17);
  const hist = await list(admin, 'change_log', q('equal', 'characterId', [pc.$id]));
  check('change history records the player edit', hist.some(h => h.label === 'Santé' && h.after === '17'));
  check('player cannot read the history', (await list(player, 'change_log', q('equal', 'characterId', [pc.$id]))).length === 0);

  // the player edits their own stats and information fields, not GM-only values nor locked fields
  const stDef = await row(admin, 'field_defs', { campaignId: camp, key: 'stat_for', label: 'Force', kind: 'stat', config: JSON.stringify({ abbr: 'FOR', max: 20 }), defaultVisibility: 'all', sort: 2 });
  const txDef = await row(admin, 'field_defs', { campaignId: camp, key: 'f_trade', label: 'Métier', kind: 'text', config: '{}', defaultVisibility: 'all', sort: 3 });
  const lkDef = await row(admin, 'field_defs', { campaignId: camp, key: 'f_rank', label: 'Rang', kind: 'text', config: JSON.stringify({ gm_locked: true }), defaultVisibility: 'all', sort: 4 });
  const stVal = await row(admin, 'character_values', { campaignId: camp, characterId: pc.$id, fieldId: stDef.$id, value: JSON.stringify({ value: 10, max: 20 }), visibility: 'all' });
  const txVal = await row(admin, 'character_values', { campaignId: camp, characterId: pc.$id, fieldId: txDef.$id, value: '""', visibility: 'all' });
  const gmVal = await row(admin, 'character_values', { campaignId: camp, characterId: pc.$id, fieldId: txDef.$id, value: '"secret"', visibility: 'gm' });
  const lkVal = await row(admin, 'character_values', { campaignId: camp, characterId: pc.$id, fieldId: lkDef.$id, value: '"recrue"', visibility: 'all' });
  await new Promise(r => setTimeout(r, 2500));
  const st = await fn(player, 'player-action', { action: 'setValue', rowId: stVal.$id, value: 99 });
  const tx = await fn(player, 'player-action', { action: 'setValue', rowId: txVal.$id, value: 'Archiviste\nà mi-temps' });
  check('player edits their own stat (clamped to its max)', st.ok && st.value === 20, JSON.stringify(st));
  check('player edits their own information field', tx.ok && tx.value === 'Archiviste\nà mi-temps', JSON.stringify(tx));
  check('player cannot edit a GM-only value', (await fn(player, 'player-action', { action: 'setValue', rowId: gmVal.$id, value: 'x' })).ok === false);
  check('player cannot edit a field locked by the GM', (await fn(player, 'player-action', { action: 'setValue', rowId: lkVal.$id, value: 'x' })).ok === false);

  // dice
  const r1 = await fn(player, 'roll-dice', { campaignId: camp, characterId: pc.$id, formula: '2d6+1', label: 'Test' });
  check('roll-dice rolls with a label', r1.ok && r1.total >= 3 && r1.total <= 13 && r1.label === 'Test');
  const r2 = await fn(player, 'roll-dice', { campaignId: camp, characterId: pc.$id, formula: '1d20', secret: true });
  const secretRow = (await list(admin, 'dice_rolls', q('equal', 'campaignId', [camp]))).find(x => x.$id === r2.id);
  check('secret roll readable by GM and roller only', secretRow && secretRow.$permissions.length === 2 && secretRow.$permissions.every(p => /team:[^/]+\/gm|user:/.test(p)));
  // simultaneous rolls by two users: all stored, distinct, each with its own author
  const sim = await Promise.all([fn(admin, 'roll-dice', { campaignId: camp, formula: '1d6' }), fn(player, 'roll-dice', { campaignId: camp, characterId: pc.$id, formula: '1d6' }),
    fn(admin, 'roll-dice', { campaignId: camp, formula: '2d6' }), fn(player, 'roll-dice', { campaignId: camp, characterId: pc.$id, formula: '2d6' })]);
  const simRows = await list(admin, 'dice_rolls', q('equal', 'campaignId', [camp]), q('limit', null, [100]));
  check('simultaneous rolls are all stored once, with the right author', sim.every(x => x.ok) && new Set(sim.map(x => x.id)).size === 4
    && sim.every(x => simRows.some(r => r.$id === x.id && (r.characterName === (x.characterName)))));
  check('player cannot empty the dice log', (await fn(player, 'admin', { action: 'clearDiceLog', campaignId: camp })).ok === false);
  const cl = await fn(admin, 'admin', { action: 'clearDiceLog', campaignId: camp });
  check('GM empties the dice log', cl.ok && cl.deleted === 6);

  // items: stacks, equip, consume, give
  const ring = await row(admin, 'item_defs', { campaignId: camp, name: 'Bague', slot: 'doigt', rarity: 'rare' });
  const stack = await row(admin, 'item_instances', { campaignId: camp, itemDefId: ring.$id, characterId: pc.$id, qty: 3, visibility: 'all', hiddenFromPlayers: false });
  await new Promise(r => setTimeout(r, 2500));
  const eq = await fn(player, 'player-action', { action: 'equip', rowId: stack.$id, slot: 'annulaire_g' });
  const after = await list(admin, 'item_instances', q('equal', 'characterId', [pc.$id]));
  check('equipping one unit splits the stack', eq.ok && after.length === 2 && after.some(x => x.qty === 2 && !x.equippedSlot) && after.some(x => x.equippedSlot === 'annulaire_g'));
  const full = await fn(player, 'player-action', { action: 'equip', rowId: stack.$id, slot: 'annulaire_g' });
  check('a full spot is refused', !full.ok);
  const wrong = await fn(player, 'player-action', { action: 'equip', rowId: stack.$id, slot: 'tete' });
  check('a spot of the wrong type is refused', !wrong.ok);
  const un = await fn(player, 'player-action', { action: 'unequip', rowId: eq.id });
  const merged = await list(admin, 'item_instances', q('equal', 'characterId', [pc.$id]));
  check('unequipping puts it back on the stack', un.ok && merged.length === 1 && merged[0].qty === 3);
  const used = await fn(player, 'player-action', { action: 'consume', rowId: merged[0].$id });
  check('using one unit', used.ok && used.qty === 2);
  const npc = (await fn(admin, 'admin', { action: 'createCharacter', campaignId: camp, name: 'PNJ', kind: 'npc' })).id;
  const give = await fn(player, 'player-action', { action: 'giveTo', rowId: merged[0].$id, toCharacterId: npc, qty: 2 });
  const npcItems = await list(admin, 'item_instances', q('equal', 'characterId', [npc]));
  check('giving the whole stack to another character', give.ok && npcItems.length === 1 && npcItems[0].qty === 2);

  // sheet templates are shared with every user
  const tpl = await row(admin, 'sheet_templates', { name: 'E2E modèle', ownerId: ADMIN_ID, fields: '[]', layout: '{}' });
  check('player reads shared templates', (await list(player, 'sheet_templates', q('equal', 'name', ['E2E modèle']))).length === 1);
  check('player cannot delete another user’s template', (await api(player, 'DELETE', `/tablesdb/${DB}/tables/sheet_templates/rows/${tpl.$id}`)).status >= 400);
  await api(admin, 'DELETE', `/tablesdb/${DB}/tables/sheet_templates/rows/${tpl.$id}`);

  // portraits are rendered into HTML by every client: only safe values are stored
  const evil = await fn(player, 'player-action', { action: 'setPortrait', characterId: pc.$id, portrait: JSON.stringify({ type: 'img', src: 'x" onerror="alert(1)' }) });
  check('a portrait with injected HTML is refused', evil.ok === false);
  const evil2 = await fn(player, 'player-action', { action: 'setPortrait', characterId: pc.$id, portrait: JSON.stringify({ type: 'gen', style: 'a"><script>', p: { skin: 'red;}</style><script>', face: 2 } }) });
  const stored = (await api(admin, 'GET', `/tablesdb/${DB}/tables/characters/rows/${pc.$id}`)).json.portrait || '';
  check('a generated portrait keeps only safe values', evil2.ok && !/script|<|"a"/.test(stored) && JSON.parse(stored).p.face === 2, stored);

  // buckets accept images only; deleting a campaign deletes the images only it uses
  const upload = (name, type, bytes) => { const fd = new FormData(); fd.append('fileId', 'unique()'); fd.append('file', new Blob([bytes], { type }), name);
    fd.append('permissions[]', `read("team:${camp}")`);
    return fetch(`${EP}/storage/buckets/maps/files`, { method: 'POST', headers: { 'X-Appwrite-Project': P, 'User-Agent': H['User-Agent'], Cookie: admin }, body: fd }).then(r => r.json()); };
  const html = await upload('evil.html', 'text/html', '<script>alert(1)</script>');
  check('an HTML file is refused by the buckets', !html.$id, html.type || html.message);
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), c => c.charCodeAt(0));
  const img = await upload('pixel.png', 'image/png', png);
  check('an image is accepted', !!img.$id, img.message);
  globalThis.__e2eFile = img.$id;

  // a GM of another campaign cannot grab that image through shareFiles
  const campB = (await fn(admin, 'admin', { action: 'createCampaign', name: 'E2E B' })).id;
  globalThis.__e2eCampB = campB;
  const invGm = await fn(admin, 'admin', { action: 'createInvite', campaignId: campB, role: 'gm' });
  const gmPw = pw(), gmRed = await fn(null, 'redeem-invite', { token: invGm.invite?.token, username: playerName + 'mj', password: gmPw });
  globalThis.__e2eGmId = gmRed.userId;
  const otherGm = await login(gmRed.email, gmPw);
  globalThis.__e2eGmId = (await api(otherGm, 'GET', '/account')).json.$id;
  const steal = await fn(otherGm, 'admin', { action: 'shareFiles', campaignId: campB, files: [`maps/${img.$id}`] });
  check('a GM cannot share another campaign’s file with theirs', steal.ok && steal.shared === 0 && steal.refused === 1, JSON.stringify(steal));
  const own = await fn(admin, 'admin', { action: 'shareFiles', campaignId: campB, files: [`maps/${img.$id}`] });
  check('the admin can share it', own.ok && own.shared === 1);

  // private notebook
  const page = await row(player, 'notebook_pages', { campaignId: camp, userId: playerId, sort: 10, title: 'Privé', body: 'x' }, [`read("user:${playerId}")`, `update("user:${playerId}")`, `delete("user:${playerId}")`]);
  check('a player notebook is unreadable by the GM', !!page.$id && (await list(admin, 'notebook_pages', q('equal', 'campaignId', [camp]))).length === 0);

  // NPCs: hidden outside the scene, only their information fields inside
  const npcId = (await fn(admin, 'admin', { action: 'createCharacter', campaignId: camp, name: 'PNJ secret', kind: 'npc' })).id;
  const txt = await row(admin, 'field_defs', { campaignId: camp, key: 'f_job', label: 'Métier', kind: 'text', config: '{}', defaultVisibility: 'all', sort: 5 });
  await row(admin, 'character_values', { campaignId: camp, characterId: npcId, fieldId: txt.$id, value: '"Garde"', visibility: 'all' });
  await row(admin, 'character_values', { campaignId: camp, characterId: npcId, fieldId: def.$id, value: '{"value":9,"max":20}', visibility: 'all' });
  await new Promise(r => setTimeout(r, 3000));
  check('an NPC outside the scene is hidden from players', !(await list(player, 'characters', q('equal', 'campaignId', [camp]))).some(c => c.$id === npcId)
    && (await list(player, 'character_values', q('equal', 'characterId', [npcId]))).length === 0);
  await fn(admin, 'admin', { action: 'setScene', campaignId: camp, characterIds: [npcId] });
  const seen = await list(player, 'character_values', q('equal', 'characterId', [npcId]));
  check('in the scene, players read its information fields only', seen.length === 1 && seen[0].fieldId === txt.$id);

  // character copy
  const dup = await fn(admin, 'admin', { action: 'duplicateCharacter', characterId: pc.$id, name: 'Copie' });
  const pcVals = (await list(admin, 'character_values', q('equal', 'characterId', [pc.$id]))).length;
  check('duplicating a character copies its values', dup.ok && dup.copied?.character_values === pcVals, `${dup.copied?.character_values}/${pcVals}`);

  // server settings (interface language): readable before sign-in, written by the admin only
  const guestRead = await api(null, 'GET', `/tablesdb/${DB}/tables/app_settings/rows/global`);
  check('server language readable without an account', [200, 404].includes(guestRead.status), String(guestRead.status));
  const pw1 = await api(player, 'POST', `/tablesdb/${DB}/tables/app_settings/rows`, { rowId: 'global', data: { lang: 'fr' } });
  const pw2 = await api(player, 'PATCH', `/tablesdb/${DB}/tables/app_settings/rows/global`, { data: { lang: 'fr' } });
  check('a player cannot change the server language', pw1.status >= 400 && pw2.status >= 400, `${pw1.status}/${pw2.status}`);

  // lore comments: only on articles the player can read; the GM-only ones refuse them
  const pubArt = await row(admin, 'lore_articles', { campaignId: camp, title: 'Public', bodyMd: 'x', visibility: 'all' });
  const gmArt = await row(admin, 'lore_articles', { campaignId: camp, title: 'Secret', bodyMd: 'x', visibility: 'gm' });
  const com = await fn(player, 'player-action', { action: 'comment', articleId: pubArt.$id, body: 'Bonjour' });
  check('a player comments a public lore article', com.ok, com.message);
  check('a player cannot comment a GM-only article', (await fn(player, 'player-action', { action: 'comment', articleId: gmArt.$id, body: 'x' })).ok === false);

  // polls: one vote per person, changeable while open; audience, anonymity and closing enforced by the server
  const pAll = await fn(admin, 'admin', { action: 'pollSave', campaignId: camp, question: 'Samedi ?', options: ['Oui', 'Non'], audience: [] });
  const v1 = await fn(player, 'player-action', { action: 'vote', pollId: pAll.id, choices: ['o1'] });
  const v2 = await fn(player, 'player-action', { action: 'vote', pollId: pAll.id, choices: ['o2'] });
  check('a player votes and changes their vote (one vote counted)', v1.ok && v2.ok && v2.tally.voters === 1 && v2.tally.counts.o2 === 1 && !v2.tally.counts.o1, JSON.stringify(v2.tally));
  check('one answer only on a single-choice poll', (await fn(player, 'player-action', { action: 'vote', pollId: pAll.id, choices: ['o1', 'o2'] })).ok === false);
  const pGm = await fn(admin, 'admin', { action: 'pollSave', campaignId: camp, question: 'MJ seul', options: ['A', 'B'], audience: [ADMIN_ID] });
  check('a poll for other people is invisible to the player and refuses their vote', !(await list(player, 'polls', q('equal', 'campaignId', [camp]))).some(x => x.$id === pGm.id)
    && (await fn(player, 'player-action', { action: 'vote', pollId: pGm.id, choices: ['o1'] })).ok === false);
  const pAnon = await fn(admin, 'admin', { action: 'pollSave', campaignId: camp, question: 'Anonyme', options: ['A', 'B'], anonymous: true, audience: [] });
  await fn(player, 'player-action', { action: 'vote', pollId: pAnon.id, choices: ['o1'] });
  const anonRows = await list(admin, 'poll_votes', q('equal', 'pollId', [pAnon.id]));
  check('an anonymous vote carries no identity', anonRows.length === 1 && !anonRows[0].userId && !anonRows[0].userName, JSON.stringify(anonRows.map(r => [r.userId, r.userName])));
  check('the player reads their own anonymous vote', (await list(player, 'poll_votes', q('equal', 'pollId', [pAnon.id]))).length === 1);
  await fn(admin, 'admin', { action: 'pollSave', campaignId: camp, pollId: pAll.id, closed: true, audience: [] });
  check('a closed poll refuses votes', (await fn(player, 'player-action', { action: 'vote', pollId: pAll.id, choices: ['o1'] })).ok === false);
  check('a player cannot delete a poll', (await fn(player, 'admin', { action: 'pollDelete', pollId: pAll.id })).ok === false);

  // online image search (server-side: Pixabay key and DuckDuckGo never reach the browser)
  check('image search needs a session', (await fn(null, 'image-search', { action: 'search', source: 'ddg', q: 'chat' })).ok === false);
  const lan = await fn(player, 'image-search', { action: 'fetch', url: 'http://192.168.1.1/a.jpg' });
  const loop = await fn(player, 'image-search', { action: 'fetch', url: 'http://localhost:80/' });
  check('image fetch refuses LAN and loopback addresses', !lan.ok && !loop.ok && /refusée/.test(lan.message + loop.message), lan.message);
  const pix = await fn(player, 'image-search', { action: 'search', source: 'pixabay', q: 'chevalier' });
  check('Pixabay search works or says the key is missing', pix.ok ? pix.results.length > 0 : /PIXABAY_KEY/.test(pix.message), pix.ok ? `${pix.results.length} résultats` : pix.message);
  const dd = await fn(player, 'image-search', { action: 'search', source: 'ddg', q: 'chevalier armure' });
  console.log(`INFO  DuckDuckGo: ${dd.ok ? dd.results.length + ' résultats' : dd.message}`);
  const pick = (pix.ok && pix.results[0]) || (dd.ok && dd.results[0]);
  if (pick) { const got = await fn(player, 'image-search', { action: 'fetch', url: pick.url });
    check('a found image is fetched as a data URL', got.ok && /^data:image\//.test(got.dataUrl), got.ok ? Math.round(got.dataUrl.length / 1024) + ' Ko' : got.message); }
} catch (e) {
  fail++; console.log('FAIL  unexpected error · ' + (e.stack || e.message));
} finally {
  try { if (globalThis.__e2eCampB && admin) await fn(admin, 'admin', { action: 'deleteCampaign', campaignId: globalThis.__e2eCampB }); } catch (_) {}
  try {
    if (camp && admin) {
      const del = await fn(admin, 'admin', { action: 'deleteCampaign', campaignId: camp });
      if (globalThis.__e2eFile) {
        const gone = (await api(admin, 'GET', `/storage/buckets/maps/files/${globalThis.__e2eFile}`)).status === 404;
        check('deleting the campaign deletes its images', del.ok && gone, JSON.stringify(del));
      }
    }
  } catch (_) {}
  try { if (playerId && admin) await fn(admin, 'admin', { action: 'deleteUser', userId: playerId }); } catch (_) {}
  try { if (globalThis.__e2eGmId && admin) await fn(admin, 'admin', { action: 'deleteUser', userId: globalThis.__e2eGmId }); } catch (_) {}
  try { cli(['users', 'delete', '--user-id', ADMIN_ID]); } catch (_) {}
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
