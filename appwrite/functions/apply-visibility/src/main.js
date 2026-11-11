// apply-visibility — normalises the permissions of campaign rows (create/update events on WATCHED tables).
//   VIS tables   all   -> read team:<c>        (hiddenFromPlayers -> owner only)
//                owner -> read team:<c>/gm + user:<owner>
//                gm    -> read team:<c>/gm
//   TEAM tables  read team:<c>
//   GM tables    read team:<c>/gm
// Always: update + delete team:<c>/gm. The admin reads everything through table-level label:admin.
// maps: also the permissions of the map image files (see below).
import { Client, TablesDB, Storage, Permission, Role, Query } from 'node-appwrite';
import { DATABASE_ID, VIS_TABLES, TEAM_TABLES, GM_TABLES } from './config.js';

export default async ({ req, res, log }) => {
  const row = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const tableId = row.$tableId, c = row.campaignId;
  if (!tableId || !c || ![...VIS_TABLES, ...TEAM_TABLES, ...GM_TABLES].includes(tableId)) return res.json({ skipped: true });

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);
  const db = new TablesDB(client);

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

  // lore comments follow their article: readable by the campaign when it is public, by the GMs otherwise
  if (tableId === 'lore_articles') {
    const reader = row.visibility === 'all' ? team : gm;
    const comments = await db.listRows({ databaseId: DATABASE_ID, tableId: 'lore_comments', queries: [Query.equal('articleId', row.$id), Query.limit(500)] }).then(r => r.rows).catch(() => []);
    for (const cm of comments) {
      const want = [Permission.read(reader), Permission.delete(gm), ...(cm.authorId ? [Permission.delete(Role.user(cm.authorId))] : [])];
      if ([...(cm.$permissions || [])].sort().join('|') !== [...want].sort().join('|'))
        await db.updateRow({ databaseId: DATABASE_ID, tableId: 'lore_comments', rowId: cm.$id, data: {}, permissions: want }).catch(() => {});
    }
  }

  // map images: under fog the original is readable by the GMs only, the players get the masked copy (playerFileId,
  // drawn by the GM's app); without fog the original follows the map's visibility. Only files that already belong to
  // this campaign are touched (a row cannot pull another campaign's image in).
  if (tableId === 'maps') {
    const storage = new Storage(client), reads = wanted.filter(p => p.startsWith('read('));
    let fogOn = false; try { fogOn = !!JSON.parse(row.fog || 'null')?.on; } catch (_) {}
    const ours = p => p.includes(`"team:${c}"`) || p.includes(`"team:${c}/gm"`);
    for (const [fileId, rd] of [[row.imageFileId, fogOn ? [Permission.read(gm)] : reads], [fogOn ? row.playerFileId : '', reads]]) {
      if (!fileId) continue;
      const f = await storage.getFile({ bucketId: 'maps', fileId }).catch(() => null);
      if (!f || !f.$permissions.some(ours)) continue;
      const want = [...rd, Permission.update(gm), Permission.delete(gm)];
      if ([...f.$permissions].sort().join('|') !== [...want].sort().join('|'))
        await storage.updateFile({ bucketId: 'maps', fileId, permissions: want }).then(() => log(`maps file ${fileId} -> ${fogOn && fileId === row.imageFileId ? 'gm' : 'map'}`)).catch(e => log('file: ' + e.message));
    }
  }

  const current = [...(row.$permissions || [])].sort().join('|');
  if (current === [...wanted].sort().join('|')) return res.json({ unchanged: true });   // stops the event loop
  await db.updateRow({ databaseId: DATABASE_ID, tableId, rowId: row.$id, data: {}, permissions: wanted });
  log(`${tableId}/${row.$id} -> ${row.visibility || 'team'}`);
  return res.json({ updated: true });
};
