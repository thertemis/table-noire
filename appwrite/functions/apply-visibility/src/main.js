// apply-visibility — normalises the permissions of campaign rows (create/update events on WATCHED tables).
//   VIS tables   all   -> read team:<c>        (hiddenFromPlayers -> owner only)
//                owner -> read team:<c>/gm + user:<owner>
//                gm    -> read team:<c>/gm
//   TEAM tables  read team:<c>
//   GM tables    read team:<c>/gm
// Always: update + delete team:<c>/gm. The admin reads everything through table-level label:admin.
import { Client, TablesDB, Permission, Role } from 'node-appwrite';
import { DATABASE_ID, VIS_TABLES, TEAM_TABLES, GM_TABLES } from './config.js';

export default async ({ req, res, log }) => {
  const row = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const tableId = row.$tableId, c = row.campaignId;
  if (!tableId || !c || ![...VIS_TABLES, ...TEAM_TABLES, ...GM_TABLES].includes(tableId)) return res.json({ skipped: true });

  const db = new TablesDB(new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']));

  const team = Role.team(c), gm = Role.team(c, 'gm');
  const wanted = [Permission.update(gm), Permission.delete(gm)];
  if (TEAM_TABLES.includes(tableId)) {
    // NPCs are known to the players only while they are in the scene
    wanted.push(Permission.read(tableId === 'characters' && row.kind === 'npc' && !row.inScene ? gm : team));
  } else if (GM_TABLES.includes(tableId)) {
    wanted.push(Permission.read(gm));
  } else {
    let ownerId = null, npc = null;
    if (row.characterId) {
      const ch = await db.getRow({ databaseId: DATABASE_ID, tableId: 'characters', rowId: row.characterId }).catch(() => null);
      if (ch && ch.campaignId === c) { ownerId = ch.ownerId || null; if (ch.kind === 'npc') npc = ch; }
    }
    // NPC data: only their "Informations" fields (text visible to all) while they are in the scene; the rest is GM-only
    let npcShown = false;
    if (npc && npc.inScene && tableId === 'character_values' && row.visibility === 'all') {
      const def = await db.getRow({ databaseId: DATABASE_ID, tableId: 'field_defs', rowId: row.fieldId }).catch(() => null);
      npcShown = !!def && ['text', 'longtext'].includes(def.kind);
    }
    const vis = npc ? (npcShown ? 'all' : 'gm') : (row.visibility || 'gm');
    if (vis === 'all' && !row.hiddenFromPlayers) wanted.push(Permission.read(team));
    else {
      wanted.push(Permission.read(gm));
      if ((vis === 'all' || vis === 'owner') && ownerId) wanted.push(Permission.read(Role.user(ownerId)));
    }
  }

  const current = [...(row.$permissions || [])].sort().join('|');
  if (current === [...wanted].sort().join('|')) return res.json({ unchanged: true });   // stops the event loop
  await db.updateRow({ databaseId: DATABASE_ID, tableId, rowId: row.$id, data: {}, permissions: wanted });
  log(`${tableId}/${row.$id} -> ${row.visibility || 'team'}`);
  return res.json({ updated: true });
};
