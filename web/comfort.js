/* comfort.js — offline resilience and player notifications.
   - Offline: a banner shows when the connection drops; edits that could not be saved stay pending (sheet.js,
     inventory.js, world.js keep their snapshot) and are sent again when the connection comes back, or every 15 s.
   - Notifications (players): a received item or a stack growing, a wound added / changed / healed on their character.
     Toast + sound, and an "(n)" counter in the tab title while the tab is in the background. */

/* ---------------------------------------------------------------- offline */
const netBar = Object.assign(document.createElement('div'), { id: 'netBar', hidden: true, role: 'status' });
netBar.innerHTML = `<span class="bulb on" style="--bc:var(--rust)"></span><span>Hors ligne : tes modifications sont gardées et seront envoyées au retour de la connexion.</span>`;
document.body.appendChild(netBar);
function retryPending() {
  if (!ME.camp || !navigator.onLine) return;
  const was = NET.pending; NET.pending = false;
  scheduleSync(100); scheduleInv(150); if (isGmHere()) scheduleWorld(200);
  if (was) toast('Connexion rétablie : enregistrement des modifications…');
}
window.addEventListener('offline', () => { netBar.hidden = false; });
window.addEventListener('online', () => { netBar.hidden = true; retryPending(); });
setInterval(() => { if (NET.pending) retryPending(); netBar.hidden = navigator.onLine && !NET.pending; }, 15000);
if (!navigator.onLine) netBar.hidden = false;

/* ---------------------------------------------------------------- notifications */
const NOTIF = { count: 0, title: null, wUnsub: null, known: new Set() };
function notify(msg) {
  toast(msg);
  try { sfx.flip(); } catch (_) {}
  if (document.hidden) { NOTIF.title = NOTIF.title || document.title; NOTIF.count++; document.title = `(${NOTIF.count}) ${NOTIF.title}`; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && NOTIF.title) { document.title = NOTIF.title; NOTIF.title = null; NOTIF.count = 0; } });

// items: compare the inventory before / after a live reload
const _loadInvNotif = loadInventory;
loadInventory = async function (charId, quiet = false) {
  const before = new Map(INV.map(o => [o.iid, o.qty || 1])), sameChar = charId === IV.charId;
  await _loadInvNotif(charId, quiet);
  if (!quiet || !sameChar || isGmHere() || S.viewer !== 'owner') return;
  for (const o of INV) {
    const was = before.get(o.iid), name = (ITEMS.find(i => i.id === o.def) || {}).name || 'objet';
    if (was === undefined) notify(`Nouvel objet : ${name}${(o.qty || 1) > 1 ? ` (×${o.qty})` : ''}`);
    else if ((o.qty || 1) > was) notify(`${name} : ×${o.qty}`);
  }
};

// wounds of the player's open character
function subscribeWoundNotes() {
  if (NOTIF.wUnsub) { NOTIF.wUnsub(); NOTIF.wUnsub = null; }
  if (!ME.camp || isGmHere()) return;
  NOTIF.known = new Set([...SH.wounds.values()].map(w => w.rowId));
  NOTIF.wUnsub = AW.c.subscribe(`tablesdb.${TN.db}.tables.wounds.rows`, ev => {
    const p = ev.payload || {};
    if (p.characterId !== SH.charId || !p.zone) return;
    const zone = ZONES[p.zone] || p.zone, evs = ev.events || [];
    // the player first sees a new wound through apply-visibility's update (the create event is not readable yet)
    const known = NOTIF.known.has(p.$id); NOTIF.known.add(p.$id);
    if (evs.some(e => e.endsWith('.delete'))) { NOTIF.known.delete(p.$id); notify(`Blessure soignée : ${zone}`); }
    else if (!known) notify(`Nouvelle blessure : ${zone}${SEV[p.severity] ? ` (${SEV[p.severity].n})` : ''}`);
    else notify(`Blessure modifiée : ${zone}${SEV[p.severity] ? ` (${SEV[p.severity].n})` : ''}`);
  });
}
const _enterNotif = enterCampaign;
enterCampaign = async function (id) { await _enterNotif(id); subscribeWoundNotes(); };
const _leaveNotif = leaveCampaign;
leaveCampaign = async function () { if (NOTIF.wUnsub) { NOTIF.wUnsub(); NOTIF.wUnsub = null; } return _leaveNotif(); };

const comfortCss = document.createElement('style');
comfortCss.textContent = `
#netBar{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:97;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px;
  font:500 12px var(--f-mono);color:#f1d9cf;background:linear-gradient(#3a2620,#2a1c18);box-shadow:inset 0 0 0 1px rgba(184,69,47,.6),0 3px 0 #0b0a09,0 10px 24px rgba(0,0,0,.5);max-width:calc(100vw - 24px)}
#netBar[hidden]{display:none}`;
document.head.appendChild(comfortCss);
