// redeem-invite — consumes a single-use link. Executable by anyone (guests).
//   signup: { token, username, password }  -> creates the account (label `member`), its profile and,
//           when the invite targets a campaign, the team membership (+ a character for players).
//   reset:  { token, password }            -> sets a new password on the invite's user.
import { Client, TablesDB, Users, Teams, Permission, Role, ID, Query, AppwriteException } from 'node-appwrite';
import { DATABASE_ID } from './config.js';

const fail = (res, status, message) => res.json({ ok: false, message }, status);

export default async ({ req, res, log, error }) => {
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { return fail(res, 400, 'Requête illisible.'); }
  const token = String(body.token || '').trim();
  const password = String(body.password || '');
  if (!/^[A-Za-z0-9_-]{8,36}$/.test(token)) return fail(res, 400, 'Lien invalide.');
  if (password.length < 10) return fail(res, 400, 'Mot de passe : 10 caractères minimum.');

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);
  const db = new TablesDB(client), users = new Users(client), teams = new Teams(client);

  // 1. find a valid invite
  const found = await db.listRows({ databaseId: DATABASE_ID, tableId: 'invites', queries: [Query.equal('token', token), Query.limit(1)] });
  const invite = found.rows[0];
  if (!invite || invite.usedAt) return fail(res, 404, 'Ce lien n’existe pas ou a déjà servi.');
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return fail(res, 410, 'Ce lien a expiré.');
  const kind = invite.kind || 'signup';
  const username = String(body.username || '').trim();
  if (kind === 'signup' && !/^[A-Za-z0-9_-]{3,24}$/.test(username)) return fail(res, 400, 'Pseudo : 3 à 24 caractères (lettres, chiffres, - ou _).');

  // 2. claim it atomically: the row id IS the token, so a second claim fails with 409
  try {
    await db.createRow({ databaseId: DATABASE_ID, tableId: 'invite_claims', rowId: token, data: { username: username || 'reset' }, permissions: [] });
  } catch (e) {
    if (e instanceof AppwriteException && e.code === 409) return fail(res, 409, 'Ce lien a déjà servi.');
    throw e;
  }
  const markUsed = userId => db.updateRow({ databaseId: DATABASE_ID, tableId: 'invites', rowId: invite.$id, data: { usedBy: userId, usedAt: new Date().toISOString() } });

  // ---- password reset
  if (kind === 'reset') {
    const user = invite.userId ? await users.get({ userId: invite.userId }).catch(() => null) : null;
    if (!user) return fail(res, 404, 'Ce compte n’existe plus.');
    await users.updatePassword({ userId: user.$id, password });
    await users.deleteSessions({ userId: user.$id }).catch(() => {});
    await markUsed(user.$id);
    log(`Mot de passe réinitialisé pour ${user.name}`);
    return res.json({ ok: true, email: user.email, username: user.name });
  }

  // ---- signup
  const userId = ID.unique();
  const email = `${username.toLowerCase()}@players.tablenoire.invalid`;
  try {
    await users.create({ userId, email, password, name: username });
  } catch (e) {
    await db.deleteRow({ databaseId: DATABASE_ID, tableId: 'invite_claims', rowId: token }).catch(() => {});
    if (e instanceof AppwriteException && e.code === 409) return fail(res, 409, 'Ce pseudo est déjà pris.');
    error(e.message); return fail(res, 500, 'Création du compte impossible.');
  }
  await users.updateLabels({ userId, labels: ['member'] });
  await db.updateRow({ databaseId: DATABASE_ID, tableId: 'invite_claims', rowId: token, data: { userId } });
  await db.createRow({ databaseId: DATABASE_ID, tableId: 'profiles', rowId: ID.unique(), data: { userId, username, color: '#4f8d89' },
    permissions: [Permission.read(Role.users())] });

  const c = invite.campaignId;
  if (c) {
    const role = invite.role === 'gm' ? 'gm' : 'player';
    await teams.createMembership({ teamId: c, roles: [role], userId });
    if (role === 'gm') {
      await db.updateRow({ databaseId: DATABASE_ID, tableId: 'campaigns', rowId: c, data: { gmUserId: userId } }).catch(() => {});
    } else {
      const team = Role.team(c), gm = Role.team(c, 'gm');
      const character = await db.createRow({ databaseId: DATABASE_ID, tableId: 'characters', rowId: ID.unique(),
        data: { campaignId: c, ownerId: userId, name: username, kind: 'pc' },
        permissions: [Permission.read(team), Permission.update(gm), Permission.delete(gm)] });
      await db.createRow({ databaseId: DATABASE_ID, tableId: 'player_prefs', rowId: ID.unique(),
        data: { campaignId: c, userId, characterId: character.$id },
        permissions: [Permission.read(Role.user(userId)), Permission.update(Role.user(userId))] });
    }
  }
  await markUsed(userId);
  log(`Compte créé pour ${username} (${userId})${c ? ` dans ${c}` : ''}`);
  return res.json({ ok: true, email, username });
};
