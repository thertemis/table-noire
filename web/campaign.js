/* campaign.js — campaign-wide settings and live campaign updates.
   - The table settings (orange brand button, GM) are the campaign's: name, place, session, accent, dice
     duration, default visibility, player layout permission. They used to stay in each browser.
   - Realtime on the campaign row: players get the GM's settings, sheet layout and equipment spots live.
   - The player's own sheet arrangement is kept in player_prefs.layout.
   - "Utiliser": a player uses up one unit of an item stack (player-action consume). */

const CAMPCFG = { pushTimer: null, unsub: null, applying: false };
const visFromCamp = v => (v === 'gm' ? 'mj' : v || 'all');
function settingsFromCamp() {
  const c = ME.camp; if (!c) return;
  CAMPCFG.applying = true;
  Object.assign(SETTINGS, { appName: c.name || 'Table Noire', campaign: c.description || '', sessionNo: c.sessionNo || 0, sessionName: c.sessionName || '',
    accent: c.accent || SET_DEF.accent, diceSeconds: (c.diceMs || 5000) / 1000, defaultVis: visFromCamp(c.defaultVisibility),
    allowPlayerLayout: c.allowPlayerLayout !== false });
  applySettings();
  CAMPCFG.applying = false;
}
function campFromSettings() { return ({ name: String(SETTINGS.appName || '').trim().slice(0, 128) || ME.camp.name, description: String(SETTINGS.campaign || '').slice(0, 1000),
  sessionNo: Math.max(0, Math.round(+SETTINGS.sessionNo || 0)), sessionName: String(SETTINGS.sessionName || '').slice(0, 128), accent: String(SETTINGS.accent || '').slice(0, 16),
  diceMs: Math.max(1000, Math.min(10000, Math.round((+SETTINGS.diceSeconds || 5) * 1000))), defaultVisibility: SETTINGS.defaultVis === 'mj' ? 'gm' : SETTINGS.defaultVis,
  allowPlayerLayout: !!SETTINGS.allowPlayerLayout }); }

// every settings change ends with applySettings(): push it to the campaign (GM, debounced)
const _applySettingsCamp = applySettings;
applySettings = function () {
  _applySettingsCamp();
  if (ME.camp && !SETTINGS.sessionNo && !ME.camp.sessionNo) $('#sessLine').textContent = isGmHere() ? 'MJ' : 'JOUEUR';
  if (CAMPCFG.applying || !ME.camp || !isGmHere()) return;
  const want = campFromSettings(), cur = ME.camp;
  if (Object.keys(want).every(k => (cur[k] ?? '') === want[k])) return;
  clearTimeout(CAMPCFG.pushTimer);
  CAMPCFG.pushTimer = setTimeout(async () => {
    const data = campFromSettings();
    try { await admin('updateCampaign', { campaignId: ME.camp.$id, ...data }); Object.assign(ME.camp, data); }
    catch (e) { toast('Réglages non enregistrés : ' + errMsg(e)); }
  }, 800);
};

// the settings window: the connection pane makes no sense online; labels follow the campaign
const _settingsModalCamp = settingsModal;
settingsModal = function () {
  if (setTab === 'conn') setTab = 'table';
  _settingsModalCamp();
  $('#modalBox [data-t="conn"]')?.remove();
  const box = $('#modalBox');
  box.innerHTML = box.innerHTML.replace('Nom de l’application', 'Nom de la campagne').replace('Campagne / lieu', 'Lieu / description')
    .replace('<h3>Paramètres de la table</h3>', `<h3>Paramètres de la campagne · ${esc(ME.camp?.name || '')}</h3>`);
};
ACT.setReset = () => {   // back to the look-and-play defaults; the campaign keeps its name and session
  Object.assign(SETTINGS, { accent: SET_DEF.accent, diceSeconds: SET_DEF.diceSeconds, defaultVis: SET_DEF.defaultVis, allowPlayerLayout: SET_DEF.allowPlayerLayout });
  applySettings(); settingsModal(); toast('Apparence et règles par défaut rétablies'); return false;
};

/* ---------------------------------------------------------------- live campaign row */
function subscribeCampaign() {
  if (CAMPCFG.unsub) { CAMPCFG.unsub(); CAMPCFG.unsub = null; }
  if (!ME.camp) return;
  const id = ME.camp.$id;
  CAMPCFG.unsub = AW.c.subscribe(`tablesdb.${TN.db}.tables.campaigns.rows.${id}`, ev => {
    const p = ev.payload || {};
    if (!ME.camp || p.$id !== id || (ev.events || []).some(e => e.endsWith('.delete'))) return;
    const before = { slots: ME.camp.equipSlots, layout: ME.camp.sheetLayout };
    Object.assign(ME.camp, p);
    document.dispatchEvent(new CustomEvent('tn:campaign', { detail: p }));
    if (isGmHere()) return;   // the GM is the source of these changes
    settingsFromCamp();
    if (before.layout !== p.sheetLayout) { applyLayout(p.sheetLayout); if (typeof TPLS !== 'undefined') TPLS.last = layoutSnap(); }
    const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if ((before.slots !== p.equipSlots || before.layout !== p.sheetLayout) && !typing && $('#modal').hidden) render();
  });
}
const _enterCamp = enterCampaign;
enterCampaign = async function (id) {
  await _enterCamp(id);
  if (!ME.camp) return;
  settingsFromCamp();
  subscribeCampaign();
};
const _leaveCamp = leaveCampaign;
leaveCampaign = async function () {
  if (CAMPCFG.unsub) { CAMPCFG.unsub(); CAMPCFG.unsub = null; }
  clearTimeout(CAMPCFG.pushTimer);
  await savePlayerLayout();
  return _leaveCamp();
};

/* ---------------------------------------------------------------- the player's own layout */
const PLAYER_LAYOUT = { last: 'null', timer: null };
async function savePlayerLayout() {
  clearTimeout(PLAYER_LAYOUT.timer);
  if (!ME.camp || isGmHere() || !SH.charId) return;
  const now = JSON.stringify(S.pl); if (now === PLAYER_LAYOUT.last) return;
  PLAYER_LAYOUT.last = now;
  const layout = S.pl ? now : '';
  try {
    if (SH.prefsId) await AW.db.updateRow(T('player_prefs', { rowId: SH.prefsId, data: { layout } }));
    else {
      const me = Appwrite.Role.user(ME.user.$id);
      SH.prefsId = (await AW.db.createRow(T('player_prefs', { rowId: Appwrite.ID.unique(),
        data: { campaignId: ME.camp.$id, userId: ME.user.$id, characterId: SH.charId, layout },
        permissions: [Appwrite.Permission.read(me), Appwrite.Permission.update(me), Appwrite.Permission.delete(me)] }))).$id;
    }
  } catch (e) { PLAYER_LAYOUT.last = null; toast('Disposition non enregistrée : ' + errMsg(e)); }
}
const _renderCamp = render;
render = function () {
  _renderCamp();
  if (ME.camp && !isGmHere() && SH.charId && JSON.stringify(S.pl) !== PLAYER_LAYOUT.last) { clearTimeout(PLAYER_LAYOUT.timer); PLAYER_LAYOUT.timer = setTimeout(savePlayerLayout, 1500); }
};

/* ---------------------------------------------------------------- "Utiliser" (player) */
const _cardHtmlCamp = cardHtml;
cardHtml = function (def, own, lib) {
  const html = _cardHtmlCamp(def, own, lib);
  if (!own || S.viewer !== 'owner' || isMJ() || own.slot) return html;
  return html.replace('<div class="acts">', `<div class="acts"><button class="btn xs" data-act="consume" data-id="${own.iid}" title="Retire un exemplaire">${ic('minus', 12)}Utiliser</button>`);
};
ACT.consume = d => {
  const o = INV.find(x => x.iid === d.id); if (!o) return false;
  const name = (ITEMS.find(i => i.id === o.def) || {}).name || 'cet objet';
  if ((o.qty || 1) <= 1 && !confirm(`Utiliser le dernier exemplaire de « ${name} » ? La carte disparaîtra de ton inventaire.`)) return false;
  (async () => {
    clearTimeout(IV.timer); await syncInventory();
    try { const r = await call('player-action', { action: 'consume', rowId: o.iid }); toast(r.qty ? `${name} : ×${r.qty}` : `${name} : plus aucun exemplaire`); }
    catch (e) { toast(errMsg(e)); }
    await loadInventory(SH.charId);
  })();
  return false;
};

/* logging out reloads the page: the realtime socket keeps the identity it was opened with, so after
   logout + login in the same page the new user would get no live updates */
const _logoutCamp = logout;
logout = async function () { await _logoutCamp(); location.reload(); };

/* ---------------------------------------------------------------- give an item to another character */
const _cardHtmlGive = cardHtml;
cardHtml = function (def, own, lib) {
  const html = _cardHtmlGive(def, own, lib);
  if (!own || !SH.charId || ME.chars.length < 2 || (!isMJ() && S.viewer !== 'owner')) return html;
  return html.replace('<div class="acts">', `<div class="acts"><button class="btn xs" data-act="giveToPick" data-id="${own.iid}" title="Donner à un autre personnage">${ic('gift', 12)}Donner</button>`);
};
ACT.giveToPick = d => {
  const o = INV.find(x => x.iid === d.id), def = o && ITEMS.find(i => i.id === o.def); if (!def) return false;
  const others = ME.chars.filter(c => c.$id !== SH.charId), qty = o.qty || 1;
  openModal(`<h3>Donner · ${esc(def.name)}</h3><form class="form" id="giveForm" data-id="${o.iid}">
    <label class="full">À qui ?<select class="field" name="to">${others.map(c => `<option value="${c.$id}">${esc(c.name)}${c.ownerId && ME.names[c.ownerId] ? ` (${esc(ME.names[c.ownerId])})` : ''}</option>`).join('')}</select></label>
    ${qty > 1 ? `<label>Combien ? (sur ${qty})<input class="field" type="number" name="qty" min="1" max="${qty}" value="1"></label>` : ''}
    ${o.slot ? '<p class="hint full" style="margin:0">L’objet est équipé : il sera déséquipé.</p>' : ''}
    <div class="modal-acts full"><button type="button" class="btn" data-act="closeModal">Annuler</button><button class="btn orange" type="submit">${ic('gift')}Donner</button></div></form>`);
  return false;
};
document.addEventListener('submit', async e => {
  if (e.target.id !== 'giveForm') return;
  e.preventDefault(); e.stopImmediatePropagation();
  const f = e.target, fd = Object.fromEntries(new FormData(f));
  closeModal();
  clearTimeout(IV.timer); await syncInventory();
  try { const r = await call('player-action', { action: 'giveTo', rowId: f.dataset.id, toCharacterId: fd.to, qty: +fd.qty || 1 }); toast(`Donné à ${r.to}${r.given > 1 ? ` (×${r.given})` : ''}`); }
  catch (err) { toast(errMsg(err)); }
  await loadInventory(SH.charId);
}, true);
