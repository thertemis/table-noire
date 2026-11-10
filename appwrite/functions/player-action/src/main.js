// player-action — the few changes a player may make to rows the GM owns.
// Appwrite permissions cover whole rows, so players never get `update` on GM data; they go through here.
// Body: { "action": "toggleHidden", "tableId": "item_instances" | "skill_instances", "rowId": "..." }
//       { "action": "setValue", "rowId": "<character_values id>", "value": <number|string> }
//         (gauges/counters with config.player_editable; on their own character, also stats, information fields and the
//          card, unless the value is GM-only or the field has config.gm_locked)
import { Client, TablesDB, Query, ID, Permission, Role } from 'node-appwrite';
import { DATABASE_ID, PUBLIC_ENDPOINT } from './config.js';
import { campaignSlots } from './slots.js';

const deny = (res, message, status = 403) => res.json({ ok: false, message }, status);

// The portrait JSON is rendered into HTML / SVG attributes by every client: only known, harmless values pass.
const PORTRAIT_SRC = new RegExp('^(' + PUBLIC_ENDPOINT.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  + String.raw`\/storage\/buckets\/portraits\/files\/[A-Za-z0-9._-]{1,36}\/view\?project=[A-Za-z0-9]+|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$`);
function cleanPortrait(p) {
  if (!p || typeof p !== 'object') return null;
  if (p.type === 'img') return PORTRAIT_SRC.test(String(p.src || '')) ? { type: 'img', src: p.src, ...(p.fileId && /^[A-Za-z0-9._-]{1,36}$/.test(p.fileId) ? { fileId: p.fileId } : {}) } : null;
  const out = { type: 'gen', style: /^[a-z]{2,16}$/.test(p.style || '') ? p.style : 'croquis', p: {} };
  for (const [k, v] of Object.entries(p.p || {})) {
    if (!/^[A-Za-z0-9]{1,16}$/.test(k)) continue;
    if (Number.isInteger(v) && v >= 0 && v <= 99) out.p[k] = v;
    else if (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v)) out.p[k] = v;
  }
  return out;
}

export default async ({ req, res }) => {
  const userId = req.headers['x-appwrite-user-id'];
  if (!userId) return deny(res, 'Connexion requise.', 401);
  let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { return deny(res, 'Requête illisible.', 400); }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);
  const db = new TablesDB(client);
  const ownsCharacter = async characterId => {
    const ch = await db.getRow({ databaseId: DATABASE_ID, tableId: 'characters', rowId: characterId }).catch(() => null);
    return !!ch && ch.ownerId === userId;
  };

  if (b.action === 'toggleHidden') {
    if (!['item_instances', 'skill_instances'].includes(b.tableId)) return deny(res, 'Table non autorisée.', 400);
    const row = await db.getRow({ databaseId: DATABASE_ID, tableId: b.tableId, rowId: String(b.rowId) }).catch(() => null);
    if (!row || !(await ownsCharacter(row.characterId))) return deny(res, 'Cet élément ne t’appartient pas.');
    if (row.visibility === 'gm') return deny(res, 'Élément réservé au MJ.');
    const updated = await db.updateRow({ databaseId: DATABASE_ID, tableId: b.tableId, rowId: row.$id, data: { hiddenFromPlayers: !row.hiddenFromPlayers } });
    return res.json({ ok: true, hiddenFromPlayers: updated.hiddenFromPlayers });   // apply-visibility then fixes the permissions
  }

  if (b.action === 'setValue') {
    const row = await db.getRow({ databaseId: DATABASE_ID, tableId: 'character_values', rowId: String(b.rowId) }).catch(() => null);
    if (!row || !(await ownsCharacter(row.characterId))) return deny(res, 'Cette valeur ne t’appartient pas.');
    const field = await db.getRow({ databaseId: DATABASE_ID, tableId: 'field_defs', rowId: row.fieldId }).catch(() => null);
    let cfg = {}; try { cfg = JSON.parse(field?.config || '{}'); } catch { /* keep empty */ }
    const ownerKinds = ['stat', 'text', 'longtext', 'card'];
    const ownerEdit = ownerKinds.includes(field?.kind) && row.visibility !== 'gm' && !cfg.gm_locked;
    if (!cfg.player_editable && !ownerEdit) return deny(res, 'Seul le MJ peut modifier ce champ.');
    let value = b.value;
    if (field?.kind !== 'stat' && ownerKinds.includes(field?.kind)) value = String(value ?? '').slice(0, 5000);
    else if (field?.kind === 'stat') { value = Number(value); if (!Number.isFinite(value)) return deny(res, 'Valeur numérique attendue.', 400); value = Math.max(0, Math.round(value)); }
    if (typeof cfg.min === 'number' || typeof cfg.max === 'number') {
      value = Number(value); if (!Number.isFinite(value)) return deny(res, 'Valeur numérique attendue.', 400);
      if (typeof cfg.min === 'number') value = Math.max(cfg.min, value);
      let max = cfg.max;
      try { const cur = JSON.parse(row.value || '{}'); if (typeof cur.max === 'number') max = cur.max; } catch { /* plain value */ }
      if (typeof max === 'number') value = Math.min(max, value);
    }
    let stored; try { const cur = JSON.parse(row.value || 'null'); stored = cur && typeof cur === 'object' ? JSON.stringify({ ...cur, value }) : JSON.stringify(value); } catch { stored = JSON.stringify(value); }
    await db.updateRow({ databaseId: DATABASE_ID, tableId: 'character_values', rowId: row.$id, data: { value: stored } });
    // history (GM only): who changed what
    const shown = v => { try { const o = JSON.parse(v || 'null'); return String(o && typeof o === 'object' ? o.value : o ?? ''); } catch { return String(v ?? ''); } };
    const who = await db.listRows({ databaseId: DATABASE_ID, tableId: 'profiles', queries: [Query.equal('userId', userId), Query.limit(1)] }).then(r => r.rows[0]?.username).catch(() => '');
    const gm = Role.team(row.campaignId, 'gm');
    await db.createRow({ databaseId: DATABASE_ID, tableId: 'change_log', rowId: ID.unique(), permissions: [Permission.read(gm), Permission.delete(gm)],
      data: { campaignId: row.campaignId, characterId: row.characterId, fieldId: row.fieldId, label: (field?.label || '').slice(0, 128),
        before: shown(row.value).slice(0, 1000), after: shown(stored).slice(0, 1000), userName: (who || '').slice(0, 64) } }).catch(() => {});
    return res.json({ ok: true, value });
  }

  if (b.action === 'ensureValues') {
    // creates the missing character_values of the player's own character (the GM's client does it for others)
    const ch = await db.getRow({ databaseId: DATABASE_ID, tableId: 'characters', rowId: String(b.characterId) }).catch(() => null);
    if (!ch || ch.ownerId !== userId) return deny(res, 'Ce personnage ne t’appartient pas.');
    const q = (tableId, queries) => db.listRows({ databaseId: DATABASE_ID, tableId, queries: [...queries, Query.limit(500)] }).then(r => r.rows);
    const [defs, vals] = await Promise.all([q('field_defs', [Query.equal('campaignId', ch.campaignId)]), q('character_values', [Query.equal('characterId', ch.$id)])]);
    const have = new Set(vals.map(v => v.fieldId));
    let created = 0;
    for (const d of defs.filter(d => !have.has(d.$id))) {
      let cfg = {}; try { cfg = JSON.parse(d.config || '{}'); } catch { /* empty */ }
      const value = d.kind === 'stat' ? { value: cfg.default ?? 10, max: cfg.max ?? 20 }
        : d.kind === 'gauge' ? { value: cfg.max ?? 10, max: cfg.max ?? 10, step: cfg.step ?? 1 }
        : d.kind === 'counter' ? { value: cfg.default ?? 0, step: cfg.step ?? 1 } : '';
      await db.createRow({ databaseId: DATABASE_ID, tableId: 'character_values', rowId: ID.unique(),
        data: { campaignId: ch.campaignId, characterId: ch.$id, fieldId: d.$id, value: JSON.stringify(value), visibility: d.defaultVisibility || 'all' },
        // same permissions apply-visibility would compute, so the player can read them right away
        permissions: (() => {
          const gm = Role.team(ch.campaignId, 'gm'), vis = d.defaultVisibility || 'all';
          const p = [Permission.update(gm), Permission.delete(gm)];
          if (vis === 'all') p.push(Permission.read(Role.team(ch.campaignId)));
          else { p.push(Permission.read(gm)); if (vis === 'owner') p.push(Permission.read(Role.user(userId))); }
          return p;
        })() }).then(() => created++).catch(() => {});
    }
    return res.json({ ok: true, created });
  }

  if (b.action === 'setPortrait') {
    const ch = await db.getRow({ databaseId: DATABASE_ID, tableId: 'characters', rowId: String(b.characterId) }).catch(() => null);
    if (!ch || ch.ownerId !== userId) return deny(res, 'Ce personnage ne t’appartient pas.');
    let raw; try { raw = typeof b.portrait === 'string' ? JSON.parse(b.portrait) : b.portrait; } catch { raw = null; }
    const clean = cleanPortrait(raw);
    if (!clean) return deny(res, 'Portrait invalide.', 400);
    const portrait = JSON.stringify(clean);
    if (portrait.length > 60000) return deny(res, 'Portrait trop lourd : importe l’image comme fichier.', 400);
    await db.updateRow({ databaseId: DATABASE_ID, tableId: 'characters', rowId: ch.$id, data: { portrait } });
    return res.json({ ok: true });
  }

  if (b.action === 'giveTo') {
    // the owner (or the GM) hands n units of an item to another character of the campaign
    const row = await db.getRow({ databaseId: DATABASE_ID, tableId: 'item_instances', rowId: String(b.rowId) }).catch(() => null);
    if (!row) return deny(res, 'Objet introuvable.', 404);
    const [from, to, camp] = await Promise.all([
      db.getRow({ databaseId: DATABASE_ID, tableId: 'characters', rowId: row.characterId }).catch(() => null),
      db.getRow({ databaseId: DATABASE_ID, tableId: 'characters', rowId: String(b.toCharacterId) }).catch(() => null),
      db.getRow({ databaseId: DATABASE_ID, tableId: 'campaigns', rowId: row.campaignId }).catch(() => null)]);
    if (!from || !camp || (from.ownerId !== userId && camp.gmUserId !== userId)) return deny(res, 'Cet objet ne t’appartient pas.');
    if (!to || to.campaignId !== row.campaignId || to.$id === from.$id) return deny(res, 'Destinataire invalide.', 400);
    const have = row.qty || 1, n = Math.max(1, Math.min(have, Math.round(+b.qty || 1)));
    const T = { databaseId: DATABASE_ID, tableId: 'item_instances' };
    const theirs = await db.listRows({ ...T, queries: [Query.equal('characterId', to.$id), Query.equal('itemDefId', row.itemDefId), Query.limit(100)] }).then(r => r.rows);
    const stack = theirs.find(r => !r.equippedSlot && r.visibility === row.visibility && !r.hiddenFromPlayers);
    if (stack) await db.updateRow({ ...T, rowId: stack.$id, data: { qty: (stack.qty || 1) + n } });
    else if (n === have) {   // the whole card moves (apply-visibility then gives it to its new owner)
      await db.updateRow({ ...T, rowId: row.$id, data: { characterId: to.$id, equippedSlot: null, hiddenFromPlayers: false } });
      return res.json({ ok: true, given: n, to: to.name });
    } else await db.createRow({ ...T, rowId: ID.unique(), data: { campaignId: row.campaignId, itemDefId: row.itemDefId, characterId: to.$id, qty: n, visibility: row.visibility, hiddenFromPlayers: false } });
    if (n === have) await db.deleteRow({ ...T, rowId: row.$id }); else await db.updateRow({ ...T, rowId: row.$id, data: { qty: have - n } });
    return res.json({ ok: true, given: n, to: to.name });
  }

  if (b.action === 'consume') {
    // the owner uses up one unit of a stack (the last one removes the card)
    const row = await db.getRow({ databaseId: DATABASE_ID, tableId: 'item_instances', rowId: String(b.rowId) }).catch(() => null);
    if (!row || !(await ownsCharacter(row.characterId))) return deny(res, 'Cet objet ne t’appartient pas.');
    const T = { databaseId: DATABASE_ID, tableId: 'item_instances' };
    if ((row.qty || 1) > 1) { await db.updateRow({ ...T, rowId: row.$id, data: { qty: row.qty - 1 } }); return res.json({ ok: true, qty: row.qty - 1 }); }
    await db.deleteRow({ ...T, rowId: row.$id });
    return res.json({ ok: true, qty: 0 });
  }

  if (b.action === 'equip' || b.action === 'unequip') {
    // owner of the character or GM of the campaign. Equipping one unit of a stack splits it off;
    // unequipping puts it back on a matching unequipped stack.
    const row = await db.getRow({ databaseId: DATABASE_ID, tableId: 'item_instances', rowId: String(b.rowId) }).catch(() => null);
    if (!row) return deny(res, 'Objet introuvable.', 404);
    const [ch, camp] = await Promise.all([
      db.getRow({ databaseId: DATABASE_ID, tableId: 'characters', rowId: row.characterId }).catch(() => null),
      db.getRow({ databaseId: DATABASE_ID, tableId: 'campaigns', rowId: row.campaignId }).catch(() => null)]);
    if (!ch || !camp || (ch.ownerId !== userId && camp.gmUserId !== userId)) return deny(res, 'Cet objet ne t’appartient pas.');
    const same = await db.listRows({ databaseId: DATABASE_ID, tableId: 'item_instances',
      queries: [Query.equal('characterId', row.characterId), Query.limit(500)] }).then(r => r.rows);
    const T = { databaseId: DATABASE_ID, tableId: 'item_instances' };

    if (b.action === 'unequip') {
      if (!row.equippedSlot) return res.json({ ok: true });
      const stack = same.find(r => r.$id !== row.$id && r.itemDefId === row.itemDefId && !r.equippedSlot
        && r.visibility === row.visibility && !!r.hiddenFromPlayers === !!row.hiddenFromPlayers);
      if (stack) {
        await db.updateRow({ ...T, rowId: stack.$id, data: { qty: (stack.qty || 1) + (row.qty || 1) } });
        await db.deleteRow({ ...T, rowId: row.$id });
        return res.json({ ok: true, id: stack.$id });
      }
      await db.updateRow({ ...T, rowId: row.$id, data: { equippedSlot: null } });
      return res.json({ ok: true, id: row.$id });
    }

    const def = await db.getRow({ databaseId: DATABASE_ID, tableId: 'item_defs', rowId: row.itemDefId }).catch(() => null);
    if (!def || !def.slot) return deny(res, 'Cet objet ne s’équipe pas.', 400);
    const spot = campaignSlots(camp).find(s => s.id === String(b.slot));
    if (!spot || spot.type !== def.slot) return deny(res, 'Cet emplacement ne convient pas à cet objet.', 400);
    if (row.equippedSlot === spot.id) return res.json({ ok: true, id: row.$id });
    const used = same.filter(r => r.equippedSlot === spot.id && r.$id !== row.$id).length;
    if (used >= (spot.cap || 1)) return deny(res, `Emplacement « ${spot.label} » plein.`, 409);
    if ((row.qty || 1) > 1 && !row.equippedSlot) {
      await db.updateRow({ ...T, rowId: row.$id, data: { qty: row.qty - 1 } });
      const one = await db.createRow({ ...T, rowId: ID.unique(), permissions: row.$permissions,
        data: { campaignId: row.campaignId, itemDefId: row.itemDefId, characterId: row.characterId, qty: 1,
          visibility: row.visibility, hiddenFromPlayers: !!row.hiddenFromPlayers, equippedSlot: spot.id } });
      return res.json({ ok: true, id: one.$id });
    }
    await db.updateRow({ ...T, rowId: row.$id, data: { equippedSlot: spot.id } });
    return res.json({ ok: true, id: row.$id });
  }

  return deny(res, 'Action inconnue.', 400);
};
