// admin — privileged actions. Executable by signed-in users; every action checks the caller's rights.
//   Platform admin (label `admin`): users, campaigns, any campaign.
//   Campaign GM (team role `gm`): members, invites and characters of their own campaign.
// Body: { "action": "...", ...params }   Response: { ok: true, ... } | { ok: false, message }
import { randomBytes } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { InputFile } from 'node-appwrite/file';
import { Client, Users, Teams, TablesDB, Storage, Query, ID, Permission, Role, AppwriteException } from 'node-appwrite';
import { DATABASE_ID, CAMPAIGN_TABLES } from './config.js';

const fail = (res, status, message) => res.json({ ok: false, message }, status);
const DAY = 86_400_000;

export default async ({ req, res, log, error }) => {
  const uid = req.headers['x-appwrite-user-id'];
  if (!uid) return fail(res, 401, 'Connexion requise.');
  let b;
  try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { return fail(res, 400, 'Requête illisible.'); }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);
  const users = new Users(client), teams = new Teams(client), db = new TablesDB(client);
  const T = (tableId, extra) => ({ databaseId: DATABASE_ID, tableId, ...extra });

  const me = await users.get({ userId: uid });
  const isAdmin = (me.labels || []).includes('admin');
  const membership = async (teamId, userId) =>
    (await teams.listMemberships({ teamId, queries: [Query.equal('userId', userId)] }).catch(() => null))?.memberships?.[0] || null;
  const isGmOf = async c => isAdmin || (await membership(c, uid))?.roles?.includes('gm');
  const needAdmin = () => { if (!isAdmin) throw Object.assign(new Error('Réservé à l’administrateur.'), { status: 403 }); };
  const needGm = async c => { if (!c || !(await isGmOf(c))) throw Object.assign(new Error('Réservé au MJ de cette campagne.'), { status: 403 }); };
  const campaignPerms = c => [Permission.read(Role.team(c)), Permission.update(Role.team(c, 'gm')), Permission.delete(Role.team(c, 'gm'))];
  const listAll = async (tableId, queries) => {
    const out = []; let cursor = null;
    for (;;) {
      const r = await db.listRows(T(tableId, { queries: [...queries, Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])] }));
      out.push(...r.rows); if (r.rows.length < 100) return out; cursor = r.rows.at(-1).$id;
    }
  };
  const newInvite = async ({ kind, userId = null, campaignId = null, role = 'player', note = '', days = 7 }) => {
    const token = randomBytes(16).toString('hex');
    const perms = campaignId ? [Permission.read(Role.team(campaignId, 'gm')), Permission.delete(Role.team(campaignId, 'gm'))] : [];
    const row = await db.createRow(T('invites', { rowId: ID.unique(), permissions: perms,
      data: { token, kind, userId, campaignId, role, note: String(note).slice(0, 128), createdBy: uid, expiresAt: new Date(Date.now() + days * DAY).toISOString() } }));
    return { id: row.$id, token, kind, expiresAt: row.expiresAt };
  };
  const setGm = async (c, newGm) => {
    const all = await teams.listMemberships({ teamId: c, queries: [Query.limit(100)] });
    for (const m of all.memberships.filter(m => m.roles.includes('gm') && m.userId !== newGm)) {
      await teams.updateMembership({ teamId: c, membershipId: m.$id, roles: ['player'] });
    }
    if (newGm) {
      const cur = all.memberships.find(m => m.userId === newGm);
      if (cur) await teams.updateMembership({ teamId: c, membershipId: cur.$id, roles: ['gm'] });
      else await teams.createMembership({ teamId: c, roles: ['gm'], userId: newGm });
    }
    await db.updateRow(T('campaigns', { rowId: c, data: { gmUserId: newGm || null } }));
  };
  const deleteCharacterCascade = async id => {
    for (const t of ['character_values', 'wounds', 'item_instances', 'skill_instances']) {
      for (const r of await listAll(t, [Query.equal('characterId', id)])) await db.deleteRow(T(t, { rowId: r.$id }));
    }
    await db.deleteRow(T('characters', { rowId: id }));
  };

  try {
    switch (b.action) {
      // ------------------------------------------------------------ users (admin)
      case 'listUsers': {
        needAdmin();
        const r = await users.list({ queries: [Query.limit(500)] });
        return res.json({ ok: true, users: r.users.map(u => ({ id: u.$id, name: u.name, email: u.email, status: u.status, labels: u.labels, createdAt: u.$createdAt, accessedAt: u.accessedAt })) });
      }
      case 'updateUser': {
        needAdmin();
        const userId = String(b.userId);
        if (typeof b.name === 'string' && b.name.trim()) {
          const name = b.name.trim().slice(0, 64);
          await users.updateName({ userId, name });
          for (const p of await listAll('profiles', [Query.equal('userId', userId)])) await db.updateRow(T('profiles', { rowId: p.$id, data: { username: name } }));
        }
        if (typeof b.status === 'boolean') {
          if (userId === uid && !b.status) return fail(res, 400, 'Tu ne peux pas te bloquer toi-même.');
          await users.updateStatus({ userId, status: b.status });
        }
        return res.json({ ok: true });
      }
      case 'deleteUser': {
        needAdmin();
        const userId = String(b.userId);
        if (userId === uid) return fail(res, 400, 'Tu ne peux pas supprimer ton propre compte.');
        for (const p of await listAll('profiles', [Query.equal('userId', userId)])) await db.deleteRow(T('profiles', { rowId: p.$id }));
        for (const ch of await listAll('characters', [Query.equal('ownerId', userId)])) await db.updateRow(T('characters', { rowId: ch.$id, data: { ownerId: null } }));
        await users.delete({ userId });
        log(`Utilisateur supprimé : ${userId}`);
        return res.json({ ok: true });
      }
      case 'resetLink': {
        needAdmin();
        const u = await users.get({ userId: String(b.userId) });
        return res.json({ ok: true, invite: await newInvite({ kind: 'reset', userId: u.$id, note: u.name, days: b.days || 2 }) });
      }

      // ------------------------------------------------------------ campaigns
      case 'createCampaign': {
        needAdmin();
        const name = String(b.name || '').trim().slice(0, 128);
        if (!name) return fail(res, 400, 'Nom requis.');
        const id = ID.unique();
        await teams.create({ teamId: id, name, roles: ['gm', 'player'] });
        // the server-key team creation adds no member; the admin is not auto-joined
        await db.createRow(T('campaigns', { rowId: id, data: { name, description: String(b.description || '').slice(0, 1000), sessionNo: 0 }, permissions: campaignPerms(id) }));
        if (b.gmUserId) await setGm(id, String(b.gmUserId));
        log(`Campagne créée : ${name} (${id})`);
        return res.json({ ok: true, id });
      }
      case 'updateCampaign': {
        const c = String(b.campaignId);
        await needGm(c);
        const data = {};
        for (const k of ['name', 'description', 'sessionName', 'accent', 'rollStat', 'rollSkill']) if (typeof b[k] === 'string') data[k] = b[k].slice(0, k === 'description' ? 1000 : 128);
        for (const k of ['sessionNo', 'diceMs']) if (Number.isInteger(b[k])) data[k] = b[k];
        for (const k of ['allowPlayerLayout', 'archived']) if (typeof b[k] === 'boolean') data[k] = b[k];
        if (b.defaultVisibility) data.defaultVisibility = b.defaultVisibility;
        if (typeof b.reveal === 'string') {   // what the GM is showing the table right now (JSON)
          if (b.reveal.length > 60000) return fail(res, 400, 'Contenu trop lourd.');
          data.reveal = b.reveal;
        }
        if (typeof b.initiative === 'string') {   // turn order shared with the table (JSON)
          if (b.initiative.length > 20000) return fail(res, 400, 'Initiative trop lourde.');
          data.initiative = b.initiative;
        }
        if (typeof b.sheetLayout === 'string') {   // tile order, widths, custom tiles of the campaign sheet (JSON)
          if (b.sheetLayout.length > 60000) return fail(res, 400, 'Disposition trop lourde.');
          data.sheetLayout = b.sheetLayout;
        }
        if (Array.isArray(b.loreCategories)) {   // lore categories: [{ name, color }]
          const seen = new Set();
          const clean = b.loreCategories.slice(0, 60).map(x => ({ name: String(x.name || '').trim().slice(0, 64), color: /^#[0-9a-fA-F]{3,8}$/.test(x.color || '') ? x.color : '#8d6b9a' }))
            .filter(x => x.name && !seen.has(x.name.toLowerCase()) && seen.add(x.name.toLowerCase()));
          data.loreCategories = JSON.stringify(clean);
        }
        if (Array.isArray(b.equipSlots)) {   // equipment spots: [{ id, label, type, view, x, y, cap }]
          const clean = b.equipSlots.slice(0, 200).map(s => ({ id: String(s.id).slice(0, 64), label: String(s.label || '').slice(0, 64), type: String(s.type || '').slice(0, 64),
            view: s.view === 'back' ? 'back' : 'front', x: Math.round(+s.x || 0), y: Math.round(+s.y || 0), cap: Math.max(1, Math.min(20, Math.round(+s.cap || 1))) })).filter(s => s.id && s.type);
          data.equipSlots = JSON.stringify(clean);
        }
        if (Object.keys(data).length) await db.updateRow(T('campaigns', { rowId: c, data }));
        if (data.name) await teams.updateName({ teamId: c, name: data.name });
        if ('gmUserId' in b) { needAdmin(); await setGm(c, b.gmUserId ? String(b.gmUserId) : null); }
        return res.json({ ok: true });
      }
      case 'deleteCampaign': {
        needAdmin();
        const c = String(b.campaignId);
        for (const t of CAMPAIGN_TABLES) for (const r of await listAll(t, [Query.equal('campaignId', c)])) await db.deleteRow(T(t, { rowId: r.$id }));
        for (const r of await listAll('invites', [Query.equal('campaignId', c)])) await db.deleteRow(T('invites', { rowId: r.$id }));
        await db.deleteRow(T('campaigns', { rowId: c })).catch(() => {});
        await teams.delete({ teamId: c }).catch(() => {});
        // images readable by this campaign: deleted, or only unshared when another campaign still uses them (copies)
        const storage = new Storage(client), ofMine = x => x.includes(`"team:${c}"`) || x.includes(`"team:${c}/gm"`);
        let filesDeleted = 0, filesUnshared = 0;
        for (const bucketId of ['maps', 'item-art', 'lore-images', 'portraits']) {
          for (let cursor = null; ;) {
            const page = await storage.listFiles({ bucketId, queries: [Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])] }).catch(() => ({ files: [] }));
            for (const f of page.files) {
              if (!f.$permissions.some(ofMine)) continue;
              const rest = f.$permissions.filter(x => !ofMine(x));
              if (rest.some(x => x.startsWith('read("team:'))) { await storage.updateFile({ bucketId, fileId: f.$id, permissions: rest }).then(() => filesUnshared++).catch(() => {}); }
              else await storage.deleteFile({ bucketId, fileId: f.$id }).then(() => filesDeleted++).catch(() => {});
            }
            if (page.files.length < 100) break; cursor = page.files.at(-1).$id;
          }
        }
        log(`Campagne supprimée : ${c} (${filesDeleted} fichiers supprimés, ${filesUnshared} gardés pour d’autres campagnes)`);
        return res.json({ ok: true, filesDeleted, filesUnshared });
      }

      // ------------------------------------------------------------ members (campaign GM)
      case 'clearDiceLog': {
        // empties the campaign's shared dice log (rows are deleted one by one so every client gets the realtime event)
        const c = String(b.campaignId);
        await needGm(c);
        const rolls = await listAll('dice_rolls', [Query.equal('campaignId', c)]);
        for (const r of rolls) await db.deleteRow(T('dice_rolls', { rowId: r.$id })).catch(() => {});
        return res.json({ ok: true, deleted: rolls.length });
      }
      case 'pollSave': {
        // create a poll, or change an existing one (question / audience / closed; options only while nobody voted)
        const c = String(b.campaignId);
        await needGm(c);
        const members = (await teams.listMemberships({ teamId: c, queries: [Query.limit(100)] })).memberships;
        const audience = [...new Set((Array.isArray(b.audience) ? b.audience : []).map(String))].filter(id => members.some(m => m.userId === id)).slice(0, 100);
        const gm = Role.team(c, 'gm');
        const permissions = [Permission.read(gm), Permission.update(gm), Permission.delete(gm),
          ...(audience.length ? audience.map(id => Permission.read(Role.user(id))) : [Permission.read(Role.team(c))])];
        const old = b.pollId ? await db.getRow(T('polls', { rowId: String(b.pollId) })).catch(() => null) : null;
        if (b.pollId && (!old || old.campaignId !== c)) return fail(res, 404, 'Sondage introuvable.');
        const question = String(b.question ?? old?.question ?? '').trim().slice(0, 255);
        if (!question) return fail(res, 400, 'Question requise.');
        let options = old ? JSON.parse(old.options || '[]') : [];
        const voted = old ? (JSON.parse(old.tally || '{}').voters || 0) > 0 : false;
        if (Array.isArray(b.options) && !voted) {
          options = b.options.map(x => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 20).map((label, i) => ({ id: 'o' + (i + 1), label }));
          if (options.length < 2) return fail(res, 400, 'Au moins deux réponses.');
        }
        const data = { campaignId: c, question, options: JSON.stringify(options), audience: JSON.stringify(audience),
          multi: typeof b.multi === 'boolean' ? b.multi : !!old?.multi, anonymous: typeof b.anonymous === 'boolean' && !voted ? b.anonymous : !!old?.anonymous,
          closed: typeof b.closed === 'boolean' ? b.closed : !!old?.closed };
        const row = old ? await db.updateRow(T('polls', { rowId: old.$id, data, permissions }))
          : await db.createRow(T('polls', { rowId: ID.unique(), data: { ...data, tally: '{}' }, permissions }));
        return res.json({ ok: true, id: row.$id });
      }
      case 'pollDelete': {
        const p = await db.getRow(T('polls', { rowId: String(b.pollId) })).catch(() => null);
        if (!p) return fail(res, 404, 'Sondage introuvable.');
        await needGm(p.campaignId);
        let n = 0;
        for (;;) {
          const votes = (await db.listRows(T('poll_votes', { queries: [Query.equal('pollId', p.$id), Query.limit(100)] }))).rows;
          if (!votes.length) break;
          for (const v of votes) { await db.deleteRow(T('poll_votes', { rowId: v.$id })); n++; }
        }
        await db.deleteRow(T('polls', { rowId: p.$id }));
        return res.json({ ok: true, votes: n });
      }
      case 'listMembers': {
        const c = String(b.campaignId);
        await needGm(c);
        const r = await teams.listMemberships({ teamId: c, queries: [Query.limit(100)] });
        return res.json({ ok: true, members: r.memberships.map(m => ({ membershipId: m.$id, userId: m.userId, name: m.userName, roles: m.roles })) });
      }
      case 'addMember': {
        const c = String(b.campaignId), userId = String(b.userId), role = b.role === 'gm' ? 'gm' : 'player';
        await needGm(c);
        if (role === 'gm') needAdmin();
        if (await membership(c, userId)) return fail(res, 409, 'Déjà membre de cette campagne.');
        await teams.createMembership({ teamId: c, roles: [role], userId });
        if (role === 'gm') await db.updateRow(T('campaigns', { rowId: c, data: { gmUserId: userId } }));
        if (role === 'player' && b.withCharacter !== false) {
          const u = await users.get({ userId });
          await db.createRow(T('characters', { rowId: ID.unique(), data: { campaignId: c, ownerId: userId, name: u.name, kind: 'pc' }, permissions: campaignPerms(c) }));
        }
        return res.json({ ok: true });
      }
      case 'removeMember': {
        const c = String(b.campaignId), userId = String(b.userId);
        await needGm(c);
        const m = await membership(c, userId);
        if (!m) return fail(res, 404, 'Pas membre de cette campagne.');
        if (m.roles.includes('gm')) needAdmin();
        await teams.deleteMembership({ teamId: c, membershipId: m.$id });
        // their characters stay in the campaign, unassigned (GM can reassign or delete them)
        for (const ch of await listAll('characters', [Query.equal('campaignId', c), Query.equal('ownerId', userId)])) {
          await db.updateRow(T('characters', { rowId: ch.$id, data: { ownerId: null } }));
        }
        return res.json({ ok: true });
      }

      // ------------------------------------------------------------ invites
      case 'createInvite': {
        const c = b.campaignId ? String(b.campaignId) : null;
        const role = b.role === 'gm' ? 'gm' : 'player';
        if (c) await needGm(c); else needAdmin();
        if (role === 'gm') needAdmin();
        return res.json({ ok: true, invite: await newInvite({ kind: 'signup', campaignId: c, role, note: b.note || '', days: Math.min(30, Math.max(1, b.days || 7)) }) });
      }
      case 'listInvites': {
        const c = b.campaignId ? String(b.campaignId) : null;
        if (c) await needGm(c); else needAdmin();
        const rows = await listAll('invites', c ? [Query.equal('campaignId', c), Query.orderDesc('$createdAt')] : [Query.orderDesc('$createdAt')]);
        return res.json({ ok: true, invites: rows.map(r => ({ id: r.$id, token: r.token, kind: r.kind, role: r.role, campaignId: r.campaignId, note: r.note, userId: r.userId, expiresAt: r.expiresAt, usedBy: r.usedBy, usedAt: r.usedAt, createdAt: r.$createdAt })) });
      }
      case 'revokeInvite': {
        const row = await db.getRow(T('invites', { rowId: String(b.inviteId) }));
        if (row.campaignId) await needGm(row.campaignId); else needAdmin();
        await db.deleteRow(T('invites', { rowId: row.$id }));
        return res.json({ ok: true });
      }

      // ------------------------------------------------------------ characters (campaign GM)
      case 'createCharacter': {
        const c = String(b.campaignId);
        await needGm(c);
        const ownerId = b.ownerId ? String(b.ownerId) : null;
        if (ownerId && !(await membership(c, ownerId))) return fail(res, 400, 'Ce joueur n’est pas dans la campagne.');
        const name = String(b.name || '').trim().slice(0, 128) || 'Sans nom';
        const row = await db.createRow(T('characters', { rowId: ID.unique(), data: { campaignId: c, ownerId, name, kind: b.kind === 'npc' ? 'npc' : 'pc' }, permissions: campaignPerms(c) }));
        return res.json({ ok: true, id: row.$id });
      }
      // ------------------------------------------------------------ backups (admin): data, accounts, teams; images stay on the NAS
      case 'backupCreate': {
        needAdmin();
        const GLOBAL = ['campaigns', 'profiles', 'invite_claims', 'sheet_templates'];
        const strip = r => { const d = {}; for (const [k, v] of Object.entries(r)) if (!k.startsWith('$')) d[k] = v; return d; };
        const data = { format: 'table-noire/backup', version: 1, createdAt: new Date().toISOString(), tables: {}, users: [], teams: [], files: [] };
        for (const t of [...GLOBAL, ...CAMPAIGN_TABLES]) data.tables[t] = (await listAll(t, [])).map(r => ({ $id: r.$id, $permissions: r.$permissions, data: strip(r) }));
        for (let cursor = null; ;) {
          const page = await users.list({ queries: [Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])] });
          data.users.push(...page.users.map(u => ({ $id: u.$id, email: u.email, name: u.name, labels: u.labels, status: u.status, password: u.password, hash: u.hash, hashOptions: u.hashOptions })));
          if (page.users.length < 100) break; cursor = page.users.at(-1).$id;
        }
        for (const t of (await teams.list({ queries: [Query.limit(100)] })).teams) {
          const ms = (await teams.listMemberships({ teamId: t.$id, queries: [Query.limit(100)] })).memberships;
          data.teams.push({ $id: t.$id, name: t.name, members: ms.map(m => ({ userId: m.userId, roles: m.roles })) });
        }
        const storage = new Storage(client);
        for (const bucketId of ['maps', 'item-art', 'lore-images', 'portraits'])
          for (const f of (await storage.listFiles({ bucketId, queries: [Query.limit(100)] })).files) data.files.push({ bucketId, $id: f.$id, name: f.name, size: f.sizeOriginal, $permissions: f.$permissions });
        const gz = gzipSync(Buffer.from(JSON.stringify(data)));
        const name = `table-noire-${data.createdAt.slice(0, 16).replace(/[:T]/g, '-')}.json.gz`;
        const f = await storage.createFile({ bucketId: 'backups', fileId: ID.unique(), file: InputFile.fromBuffer(gz, name) });
        const counts = Object.fromEntries(Object.entries(data.tables).map(([k, v]) => [k, v.length]));
        return res.json({ ok: true, fileId: f.$id, name, size: gz.length, counts, users: data.users.length, campaigns: data.tables.campaigns.length });
      }
      case 'backupList': {
        needAdmin();
        const files = (await new Storage(client).listFiles({ bucketId: 'backups', queries: [Query.orderDesc('$createdAt'), Query.limit(100)] })).files;
        return res.json({ ok: true, backups: files.map(f => ({ id: f.$id, name: f.name, size: f.sizeOriginal, createdAt: f.$createdAt })) });
      }
      case 'backupRead':
      case 'backupRestore': {
        needAdmin();
        const raw = await new Storage(client).getFileDownload({ bucketId: 'backups', fileId: String(b.fileId) });
        const bk = JSON.parse(gunzipSync(Buffer.from(raw)).toString('utf8'));
        if (bk.format !== 'table-noire/backup') return fail(res, 400, 'Ce fichier n’est pas une sauvegarde Table Noire.');
        const camps = bk.tables.campaigns.map(r => ({ id: r.$id, name: r.data.name }));
        if (b.action === 'backupRead') return res.json({ ok: true, createdAt: bk.createdAt, campaigns: camps, users: bk.users.length });
        // restore the chosen campaigns: their rows become exactly those of the backup; accounts and memberships are added back if missing
        const chosen = (Array.isArray(b.campaignIds) ? b.campaignIds : []).map(String).filter(id => camps.some(c => c.id === id));
        if (!chosen.length) return fail(res, 400, 'Choisis au moins une campagne.');
        const upsert = async (t, r) => {
          const cur = await db.getRow(T(t, { rowId: r.$id })).catch(() => null);
          if (cur) await db.updateRow(T(t, { rowId: r.$id, data: r.data, permissions: r.$permissions }));
          else await db.createRow(T(t, { rowId: r.$id, data: r.data, permissions: r.$permissions }));
        };
        const report = { rows: 0, deleted: 0, users: 0, members: 0 };
        const existingUser = async id => !!(await users.get({ userId: id }).catch(() => null));
        for (const c of chosen) {
          const team = bk.teams.find(t => t.$id === c);
          if (!(await teams.get({ teamId: c }).catch(() => null))) await teams.create({ teamId: c, name: team?.name || c, roles: ['gm', 'player'] });
          for (const m of team?.members || []) {
            if (!(await existingUser(m.userId))) {
              const u = bk.users.find(x => x.$id === m.userId); if (!u) continue;
              if (u.hash === 'argon2') await users.createArgon2User({ userId: u.$id, email: u.email, password: u.password, name: u.name }).catch(() => null);
              else await users.create({ userId: u.$id, email: u.email, name: u.name }).catch(() => null);
              if (u.labels?.length) await users.updateLabels({ userId: u.$id, labels: u.labels }).catch(() => {});
              report.users++;
              const prof = bk.tables.profiles.find(p => p.data.userId === u.$id); if (prof) await upsert('profiles', prof).catch(() => {});
            }
            if (!(await membership(c, m.userId))) { await teams.createMembership({ teamId: c, roles: m.roles, userId: m.userId }).catch(() => {}); report.members++; }
          }
          await upsert('campaigns', bk.tables.campaigns.find(r => r.$id === c));
          for (const t of CAMPAIGN_TABLES) {
            const want = (bk.tables[t] || []).filter(r => r.data.campaignId === c), keep = new Set(want.map(r => r.$id));
            for (const r of await listAll(t, [Query.equal('campaignId', c)])) if (!keep.has(r.$id)) { await db.deleteRow(T(t, { rowId: r.$id })).catch(() => {}); report.deleted++; }
            for (const r of want) { await upsert(t, r); report.rows++; }
          }
        }
        log(`Restauration de ${chosen.length} campagne(s) depuis ${b.fileId}`);
        return res.json({ ok: true, restored: chosen.length, ...report });
      }
      case 'shareFiles': {
        // give a campaign read access to images it references (after an import); GM of that campaign
        const c = String(b.campaignId);
        await needGm(c);
        const storage = new Storage(client), teamRead = Permission.read(Role.team(c)), gmRole = Role.team(c, 'gm');
        const fogged = new Set((await listAll('maps', [Query.equal('campaignId', c)])).filter(r => { try { return !!JSON.parse(r.fog || 'null')?.on; } catch (_) { return false; } }).map(r => r.imageFileId));
        let shared = 0, refused = 0;
        for (const f of (Array.isArray(b.files) ? b.files : []).slice(0, 500)) {
          const [bucketId, fileId] = String(f).split('/');
          if (!['maps', 'item-art', 'lore-images', 'portraits'].includes(bucketId) || !fileId) continue;
          const cur = await storage.getFile({ bucketId, fileId }).catch(() => null); if (!cur) continue;
          const perm = bucketId === 'maps' && (fogged.has(fileId) || b.gmOnly === true) ? Permission.read(gmRole) : teamRead;
          if (cur.$permissions.includes(perm)) continue;
          // only files the caller could already reach: readable by a campaign they run (or any file for the admin)
          const teamsOf = cur.$permissions.map(x => /^read\("team:([^"/]+)(?:\/gm)?"\)$/.exec(x)?.[1]).filter(Boolean);
          let allowed = isAdmin;
          for (const t of teamsOf) if (!allowed && (await isGmOf(t).catch(() => false))) allowed = true;
          if (!allowed) { refused++; continue; }
          const extra = perm === teamRead ? [perm] : [perm, Permission.update(gmRole), Permission.delete(gmRole)];
          await storage.updateFile({ bucketId, fileId, permissions: [...new Set([...cur.$permissions, ...extra])] }).then(() => shared++).catch(() => {});
        }
        return res.json({ ok: true, shared, refused });
      }
      case 'duplicateCharacter': {
        // a copy of a character (sheet values, wounds and their GM notes, items, skills, portrait), without owner
        const src = await db.getRow(T('characters', { rowId: String(b.characterId) }));
        const c = src.campaignId;
        await needGm(c);
        const name = String(b.name || '').trim().slice(0, 128) || `${src.name} (copie)`;
        const ch = await db.createRow(T('characters', { rowId: ID.unique(), permissions: campaignPerms(c),
          data: { campaignId: c, ownerId: null, name, kind: b.kind === 'pc' ? 'pc' : 'npc', portrait: src.portrait || null, layout: src.layout || null,
            templateId: b.asCopy ? (src.templateId || src.$id) : null } }));
        const strip = r => { const d = { ...r }; for (const k of Object.keys(d)) if (k.startsWith('$')) delete d[k]; return d; };
        const copied = {};
        for (const t of ['character_values', 'wounds', 'item_instances', 'skill_instances']) {
          const rows = await listAll(t, [Query.equal('characterId', src.$id)]);
          copied[t] = rows.length;
          for (const r of rows) {
            const nr = await db.createRow(T(t, { rowId: ID.unique(), data: { ...strip(r), characterId: ch.$id } }));   // apply-visibility sets the permissions
            if (t === 'wounds') {
              const notes = await listAll('gm_notes', [Query.equal('entityType', 'wound'), Query.equal('entityId', r.$id)]);
              for (const n of notes) await db.createRow(T('gm_notes', { rowId: ID.unique(), data: { ...strip(n), entityId: nr.$id } }));
            }
          }
        }
        return res.json({ ok: true, id: ch.$id, name, copied });
      }
      case 'duplicateCampaign': {
        // a new campaign with the same sheet template, item / skill libraries, lore, maps and settings;
        // no characters, members, dice log or invitations. Images are shared with the new campaign.
        needAdmin();
        const c = String(b.campaignId);
        const src = await db.getRow(T('campaigns', { rowId: c }));
        const name = String(b.name || '').trim().slice(0, 128) || `${src.name} (copie)`;
        const id = ID.unique();
        await teams.create({ teamId: id, name, roles: ['gm', 'player'] });
        const keep = ['description', 'accent', 'diceMs', 'defaultVisibility', 'allowPlayerLayout', 'equipSlots', 'sheetLayout', 'rollStat', 'rollSkill'];
        await db.createRow(T('campaigns', { rowId: id, permissions: campaignPerms(id),
          data: { name, sessionNo: 0, ...Object.fromEntries(keep.filter(k => src[k] !== undefined && src[k] !== null).map(k => [k, src[k]])) } }));
        const strip = r => { const d = { ...r }; for (const k of Object.keys(d)) if (k.startsWith('$')) delete d[k]; return d; };
        const map = new Map();   // old row id -> new row id
        const copyTable = async (t, fix = d => d) => {
          const rows = await listAll(t, [Query.equal('campaignId', c)]);
          for (const r of rows) { const nid = ID.unique(); map.set(r.$id, nid); r.__new = nid; }
          return rows;
        };
        const counts = {};
        // ids first (references between tables), then rows
        const tables = ['field_defs', 'item_defs', 'skill_defs', 'lore_articles', 'maps', 'map_pois', 'map_texts'];
        const all = {}; for (const t of tables) all[t] = await copyTable(t);
        const remap = v => (v && map.has(v) ? map.get(v) : v);
        for (const t of tables) {
          counts[t] = all[t].length;
          for (const r of all[t]) {
            const d = { ...strip(r), campaignId: id }; delete d.__new;
            if (t === 'skill_defs') d.statFieldId = remap(d.statFieldId);
            if (t === 'maps') d.parentMapId = remap(d.parentMapId);
            if (t === 'map_pois' || t === 'map_texts') d.mapId = remap(d.mapId);
            if (t === 'map_pois') d.targetId = remap(d.targetId);
            await db.createRow(T(t, { rowId: r.__new, data: d }));   // apply-visibility sets the permissions
          }
        }
        // GM notes of the copied definitions
        for (const n of await listAll('gm_notes', [Query.equal('campaignId', c)])) {
          if (!['item_def', 'skill_def'].includes(n.entityType) || !map.has(n.entityId)) continue;
          await db.createRow(T('gm_notes', { rowId: ID.unique(), data: { ...strip(n), campaignId: id, entityId: map.get(n.entityId) } }));
        }
        // let the new campaign read the images it uses
        const storage = new Storage(client), files = new Set();
        for (const m of all.maps) if (m.imageFileId) files.add(`maps/${m.imageFileId}`);
        for (const i of all.item_defs) if (i.artFileId) files.add(`item-art/${i.artFileId}`);
        for (const a of all.lore_articles) for (const x of String(a.bodyMd || '').matchAll(/buckets\/(lore-images|item-art|maps)\/files\/([A-Za-z0-9._-]+)\//g)) files.add(`${x[1]}/${x[2]}`);
        let shared = 0;
        for (const f of files) {
          const [bucketId, fileId] = f.split('/');
          const cur = await storage.getFile({ bucketId, fileId }).catch(() => null); if (!cur) continue;
          const perm = Permission.read(Role.team(id));
          if (!cur.$permissions.includes(perm)) await storage.updateFile({ bucketId, fileId, permissions: [...cur.$permissions, perm] }).then(() => shared++).catch(() => {});
        }
        if (b.gmUserId) await setGm(id, String(b.gmUserId));
        return res.json({ ok: true, id, name, counts, shared });
      }
      case 'assignCharacter': {
        const ch = await db.getRow(T('characters', { rowId: String(b.characterId) }));
        await needGm(ch.campaignId);
        const ownerId = b.ownerId ? String(b.ownerId) : null;
        if (ownerId && !(await membership(ch.campaignId, ownerId))) return fail(res, 400, 'Ce joueur n’est pas dans la campagne.');
        await db.updateRow(T('characters', { rowId: ch.$id, data: { ownerId } }));
        // owner-visible rows must follow the new owner: touching them re-runs apply-visibility
        for (const t of ['character_values', 'wounds', 'item_instances', 'skill_instances']) {
          for (const r of await listAll(t, [Query.equal('characterId', ch.$id), Query.equal('visibility', 'owner')])) {
            await db.updateRow(T(t, { rowId: r.$id, data: { visibility: 'owner' } }));
          }
        }
        return res.json({ ok: true });
      }
      case 'setScene': {
        // NPCs present in the scene become visible to the players (identity and "Informations" only); the others are hidden
        const c = String(b.campaignId);
        await needGm(c);
        const want = new Set((Array.isArray(b.characterIds) ? b.characterIds : []).map(String));
        let changed = 0;
        for (const ch of await listAll('characters', [Query.equal('campaignId', c), Query.equal('kind', 'npc')])) {
          const on = want.has(ch.$id);
          if (!!ch.inScene === on && !b.force) continue;   // force: reapply the permissions (migration of older NPCs)
          await db.updateRow(T('characters', { rowId: ch.$id, data: { inScene: on }, permissions: [...campaignPerms(c).filter(x => !x.startsWith('read(')), Permission.read(on ? Role.team(c) : Role.team(c, 'gm'))] }));
          // same rule as apply-visibility, set here directly (an update that changes nothing fires no event):
          // in the scene, only its text fields visible to all are readable by the players; everything else stays GM-only
          const gmR = Role.team(c, 'gm'), base = [Permission.update(gmR), Permission.delete(gmR)];
          const textDefs = new Set((await listAll('field_defs', [Query.equal('campaignId', c)])).filter(d => ['text', 'longtext'].includes(d.kind)).map(d => d.$id));
          for (const t of ['character_values', 'wounds', 'item_instances', 'skill_instances'])
            for (const r of await listAll(t, [Query.equal('characterId', ch.$id)])) {
              const shown = on && t === 'character_values' && r.visibility === 'all' && textDefs.has(r.fieldId);
              await db.updateRow(T(t, { rowId: r.$id, data: {}, permissions: [...base, Permission.read(shown ? Role.team(c) : gmR)] })).catch(() => {});
            }
          changed++;
        }
        return res.json({ ok: true, changed });
      }
      case 'deleteCopies': {
        // removes every copy made from an NPC model, keeps the model
        const model = await db.getRow(T('characters', { rowId: String(b.characterId) }));
        await needGm(model.campaignId);
        const copies = await listAll('characters', [Query.equal('campaignId', model.campaignId), Query.equal('templateId', model.$id)]);
        for (const ch of copies) await deleteCharacterCascade(ch.$id);
        return res.json({ ok: true, deleted: copies.length });
      }
      case 'deleteCharacter': {
        const ch = await db.getRow(T('characters', { rowId: String(b.characterId) }));
        await needGm(ch.campaignId);
        await deleteCharacterCascade(ch.$id);
        return res.json({ ok: true });
      }
      default:
        return fail(res, 400, 'Action inconnue.');
    }
  } catch (e) {
    if (e.status) return fail(res, e.status, e.message);
    if (e instanceof AppwriteException) { error(`${b.action}: ${e.message}`); return fail(res, e.code || 500, e.message); }
    error(`${b.action}: ${e.stack || e}`); return fail(res, 500, 'Erreur interne.');
  }
};
