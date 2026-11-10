/* backup.js — campaign export / import (JSON file), from the GM tools panel.
   Export (GM): everything the GM can read of the campaign — settings, sheet template, characters with their values,
   wounds, items, skills, libraries, lore, maps (points, texts, fog), GM notes, session journal.
   Images stay on the server: the file only references them.
   Import (admin): creates a NEW campaign from such a file (ids remapped, characters without owner), then gives the
   new campaign read access to the referenced images (admin shareFiles). */

const BACKUP_TABLES = ['field_defs', 'characters', 'character_values', 'wounds', 'item_defs', 'item_instances', 'skill_defs', 'skill_instances',
  'lore_articles', 'maps', 'map_pois', 'map_texts', 'gm_notes', 'session_log'];
const CAMP_KEEP = ['description', 'sessionNo', 'sessionName', 'accent', 'diceMs', 'defaultVisibility', 'allowPlayerLayout', 'equipSlots', 'sheetLayout', 'rollStat', 'rollSkill'];
const stripRow = r => { const d = {}; for (const [k, v] of Object.entries(r)) if (!k.startsWith('$')) d[k] = v; return d; };

async function exportCampaign() {
  const c = ME.camp.$id;
  toast('Export en cours…');
  await flushSaves();
  const data = { format: 'table-noire/campaign', version: 1, exportedAt: new Date().toISOString(), campaign: { name: ME.camp.name,
    ...Object.fromEntries(CAMP_KEEP.map(k => [k, ME.camp[k] ?? null])) }, tables: {} };
  for (const t of BACKUP_TABLES) {
    const list = [];
    for (let cursor = null; ;) {
      const r = await AW.db.listRows({ databaseId: TN.db, tableId: t, queries: [AW.Q.equal('campaignId', c), AW.Q.limit(100), ...(cursor ? [AW.Q.cursorAfter(cursor)] : [])] });
      list.push(...r.rows.map(x => ({ $id: x.$id, ...stripRow(x) }))); if (r.rows.length < 100) break; cursor = r.rows.at(-1).$id;
    }
    data.tables[t] = list;
  }
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob),
    download: `${ME.camp.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'campagne'}-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  const n = Object.values(data.tables).reduce((s, l) => s + l.length, 0);
  toast(`Campagne exportée (${n} éléments). Les images restent sur le serveur.`);
}

async function importCampaign(file) {
  let data; try { data = JSON.parse(await file.text()); } catch (_) { toast('Fichier illisible.'); return; }
  if (data.format !== 'table-noire/campaign' || !data.tables) { toast('Ce fichier n’est pas un export Table Noire.'); return; }
  const name = (prompt('Nom de la campagne importée', `${data.campaign?.name || 'Campagne'} (import)`) || '').trim(); if (!name) return;
  toast('Import en cours…');
  try {
    const { id } = await admin('createCampaign', { name, gmUserId: ME.user.$id });
    const settings = {}; for (const k of CAMP_KEEP) if (data.campaign[k] !== null && data.campaign[k] !== undefined) settings[k] = data.campaign[k];
    if (typeof settings.equipSlots === 'string') { try { settings.equipSlots = JSON.parse(settings.equipSlots) || []; } catch (_) { delete settings.equipSlots; } }
    await admin('updateCampaign', { campaignId: id, ...settings });
    const map = new Map(); for (const t of BACKUP_TABLES) for (const r of data.tables[t] || []) map.set(r.$id, Appwrite.ID.unique());
    const re = v => (v && map.has(v) ? map.get(v) : v);
    const gm = Appwrite.Role.team(id, 'gm'), files = new Set();
    let n = 0;
    for (const t of BACKUP_TABLES) for (const r of data.tables[t] || []) {
      const d = { ...stripRow(r), campaignId: id };
      for (const k of ['characterId', 'fieldId', 'itemDefId', 'skillDefId', 'statFieldId', 'mapId', 'parentMapId', 'targetId', 'entityId']) if (k in d) d[k] = re(d[k]);
      if (t === 'characters') d.ownerId = null;   // players of the old campaign are not members of the new one
      if (t === 'maps' && d.imageFileId) files.add(`maps/${d.imageFileId}`);
      if (t === 'item_defs' && d.artFileId) files.add(`item-art/${d.artFileId}`);
      for (const x of JSON.stringify(d).matchAll(/buckets\/(lore-images|item-art|maps|portraits)\/files\/([A-Za-z0-9._-]+)\//g)) files.add(`${x[1]}/${x[2]}`);
      // session journal rows are not normalised by apply-visibility: permissions here
      const permissions = t === 'session_log' ? [Appwrite.Permission.read(d.visibility === 'all' ? Appwrite.Role.team(id) : gm), Appwrite.Permission.update(gm), Appwrite.Permission.delete(gm)] : undefined;
      await AW.db.createRow(T(t, { rowId: map.get(r.$id), data: d, ...(permissions ? { permissions } : {}) }));
      n++;
    }
    let shared = 0; if (files.size) shared = (await admin('shareFiles', { campaignId: id, files: [...files] })).shared || 0;
    toast(`« ${name} » importée : ${n} éléments${files.size ? `, ${shared} image(s) partagée(s)` : ''}.`);
    if (confirm(`Campagne « ${name} » importée. L’ouvrir maintenant ?`)) { await leaveCampaign(); await enterCampaign(id); }
  } catch (e) { toast('Import interrompu : ' + errMsg(e)); }
}

/* hub entries */
const _gmHubBackup = ACT.gmHub;
ACT.gmHub = d => {
  const r = _gmHubBackup(d);
  const tool = (act, title, sub) => `<button class="hub-tool" data-act="${act}"><span class="hub-ico">${ic('upload', 18)}</span><b>${title}</b><small>${sub}</small></button>`;
  $('#modalBox .hub')?.insertAdjacentHTML('beforeend', tool('campExport', 'Exporter la campagne', 'Sauvegarde en fichier JSON')
    + (ME.isAdmin ? tool('campImport', 'Importer une campagne', 'Nouvelle campagne depuis un export') : ''));
  return r;
};
ACT.campExport = () => { closeModal(); exportCampaign().catch(e => toast('Export impossible : ' + errMsg(e))); return false; };
ACT.campImport = () => {
  closeModal();
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
  input.onchange = () => { if (input.files[0]) importCampaign(input.files[0]); };
  input.click();
  return false;
};

/* ---------------------------------------------------------------- server backups (admin): data, accounts, teams */
async function backupsModal(note = '') {
  openModal(`<h3>Sauvegardes du serveur</h3>
    <p class="hint" style="margin:0">Une sauvegarde contient toutes les données (campagnes, fiches, bibliothèques, lore, cartes, journaux, carnets), les comptes et les équipes. Les images restent sur le NAS : la sauvegarde des volumes Docker les couvre. La restauration se fait campagne par campagne.</p>
    ${note ? `<p class="setwarn">${esc(note)}</p>` : ''}
    <div id="bkList" class="hist"><p class="hint">Chargement…</p></div>
    <div class="modal-acts"><button class="btn" data-act="closeModal">Fermer</button><button class="btn orange" data-act="bkCreate">${ic('plus')}Créer une sauvegarde</button></div>`);
  $('#modalBox').classList.add('wide');
  try {
    const { backups } = await admin('backupList');
    $('#bkList').innerHTML = backups.length ? `<ul class="eq-list">${backups.map(b => `<li><span class="grow"><b>${fmtDate(b.createdAt)}</b> <small style="color:var(--mute)">· ${Math.max(1, Math.round(b.size / 1024))} Ko</small></span>
      <a class="btn xs" href="${TN.endpoint}/storage/buckets/backups/files/${b.id}/download?project=${TN.project}" download>Télécharger</a>
      <button class="btn xs orange" data-act="bkRestore" data-id="${b.id}">Restaurer…</button>
      <button class="iconbtn" data-act="bkDel" data-id="${b.id}" aria-label="Supprimer">${ic('trash', 12)}</button></li>`).join('')}</ul>` : '<p class="hint">Aucune sauvegarde.</p>';
  } catch (e) { $('#bkList').innerHTML = `<p class="hint">${esc(errMsg(e))}</p>`; }
}
ACT.bkOpen = () => { backupsModal(); return false; };
ACT.bkCreate = () => {
  toast('Sauvegarde en cours…');
  admin('backupCreate').then(r => backupsModal(`Sauvegarde créée : ${r.campaigns} campagne(s), ${r.users} compte(s), ${Math.round(r.size / 1024)} Ko.`)).catch(e => toast('Sauvegarde impossible : ' + errMsg(e)));
  return false;
};
ACT.bkDel = d => {
  if (!confirm('Supprimer cette sauvegarde ? C’est définitif.')) return false;
  new Appwrite.Storage(AW.c).deleteFile({ bucketId: 'backups', fileId: d.id }).then(() => backupsModal()).catch(e => toast(errMsg(e)));
  return false;
};
ACT.bkRestore = d => {
  (async () => {
    let info; try { info = await admin('backupRead', { fileId: d.id }); } catch (e) { toast(errMsg(e)); return; }
    openModal(`<h3>Restaurer · ${fmtDate(info.createdAt)}</h3>
      <p class="setwarn">Les campagnes cochées redeviennent exactement ce qu’elles étaient à cette date : ce qui a été ajouté ou modifié depuis y est perdu. Les comptes et membres manquants sont recréés. Les autres campagnes ne sont pas touchées.</p>
      <form class="form" id="bkForm" data-id="${d.id}"><div class="full" style="display:flex;flex-direction:column;gap:6px">${info.campaigns.map(c => `<label class="dsecret" style="margin:0"><input type="checkbox" name="c" value="${esc(c.id)}"><span>${esc(c.name)}</span></label>`).join('')}</div>
      <div class="modal-acts full"><button type="button" class="btn" data-act="bkOpen">Retour</button><button class="btn danger" type="submit">Restaurer</button></div></form>`);
  })();
  return false;
};
document.addEventListener('submit', async e => {
  if (e.target.id !== 'bkForm') return;
  e.preventDefault(); e.stopImmediatePropagation();
  const ids = [...e.target.querySelectorAll('input[name=c]:checked')].map(i => i.value);
  if (!ids.length) { toast('Coche au moins une campagne.'); return; }
  if (!confirm(`Restaurer ${ids.length} campagne(s) ? Les modifications faites depuis la sauvegarde seront perdues.`)) return;
  await flushSaves().catch(() => {});
  toast('Restauration en cours…');
  try {
    const r = await admin('backupRestore', { fileId: e.target.dataset.id, campaignIds: ids });
    backupsModal(`Restauré : ${r.restored} campagne(s), ${r.rows} éléments remis, ${r.deleted} retirés, ${r.users} compte(s) et ${r.members} membre(s) recréés. Recharge la page pour voir le résultat.`);
  } catch (err) { toast('Restauration interrompue : ' + errMsg(err)); }
}, true);
// entries: the campaign manager and the GM tools (admin)
const _campaignsModalBk = campaignsModal;
campaignsModal = async function (...a) {
  const r = await _campaignsModalBk(...a);
  if (ME.isAdmin && !$('#modalBox [data-act="bkOpen"]')) $('#modalBox .modal-acts')?.insertAdjacentHTML('afterbegin', `<button class="btn" data-act="bkOpen">${ic('upload')}Sauvegardes</button>`);
  return r;
};
const _gmHubBk = ACT.gmHub;
ACT.gmHub = d => { const r = _gmHubBk(d); if (ME.isAdmin) $('#modalBox .hub')?.insertAdjacentHTML('beforeend', `<button class="hub-tool" data-act="bkOpen"><span class="hub-ico">${ic('upload', 18)}</span><b>Sauvegardes</b><small>Serveur entier, restauration par campagne</small></button>`); return r; };
