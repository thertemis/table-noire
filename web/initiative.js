/* initiative.js — turn order shared by the table.
   State in campaigns.initiative (JSON): { active, round, turn, list: [{ id, name, init, charId? }] }, written by the GM
   (admin updateCampaign) and received by everyone through the campaign subscription (campaign.js, event tn:campaign).
   A bar under the header shows the order, the round and whose turn it is; the GM builds the order and moves the turns;
   a player is told when their character's turn comes. */

const INI_EMPTY = () => ({ active: false, round: 1, turn: 0, list: [] });
const iniState = () => { try { const s = JSON.parse(ME.camp?.initiative || 'null'); if (s && Array.isArray(s.list)) return s; } catch (_) {} return INI_EMPTY(); };
const myCharIds = () => new Set(ME.chars.filter(c => c.ownerId === ME.user?.$id).map(c => c.$id));

const iniBar = Object.assign(document.createElement('div'), { id: 'iniBar', hidden: true });
document.querySelector('.topbar')?.after(iniBar);
function renderIniBar() {
  const s = iniState();
  if (!ME.camp || !s.active || !s.list.length) { iniBar.hidden = true; iniBar.innerHTML = ''; return; }
  const mine = myCharIds(), gm = isGmHere();
  iniBar.hidden = false;
  iniBar.innerHTML = `<span class="ini-round">Round <b>${s.round}</b></span>
    <ol class="ini-list">${s.list.map((e, i) => `<li class="${i === s.turn ? 'cur' : ''} ${e.charId && mine.has(e.charId) ? 'mine' : ''}"><span class="ini-n">${esc(String(e.init ?? '—'))}</span>${esc(e.name)}</li>`).join('')}</ol>
    ${gm ? `<span class="ini-acts"><button class="iconbtn" data-act="iniStep" data-d="-1" aria-label="Tour précédent">${ic('minus', 13)}</button><button class="btn xs orange" data-act="iniStep" data-d="1">Tour suivant</button><button class="iconbtn" data-act="iniOpen" aria-label="Modifier l’initiative">${ic('edit', 13)}</button></span>` : ''}`;
  iniBar.querySelector('li.cur')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}
async function saveIni(s) {
  const json = JSON.stringify(s);
  try { await admin('updateCampaign', { campaignId: ME.camp.$id, initiative: json }); ME.camp.initiative = json; }
  catch (e) { toast('Initiative non enregistrée : ' + errMsg(e)); }
  renderIniBar();
}

/* GM: header button and editor */
const _renderHeaderIni = renderHeader;
renderHeader = function () {
  _renderHeaderIni();
  const slot = $('#adminSlot');
  if (false && ME.camp && isGmHere() && slot && !slot.querySelector('[data-act="iniOpen"]'))   // now in "Outils MJ" (gmtools.js)
    slot.insertAdjacentHTML('afterbegin', `<button class="btn" data-act="iniOpen" title="Ordre d’initiative">${ic('d20')}Initiative</button>`);
};
ACT.iniOpen = () => { iniModal(iniState()); return false; };
ACT.iniStep = d => {
  const s = iniState(); if (!s.list.length) return false;
  let t = s.turn + +d.d, r = s.round;
  if (t >= s.list.length) { t = 0; r++; } else if (t < 0) { t = s.list.length - 1; r = Math.max(1, r - 1); }
  saveIni({ ...s, turn: t, round: r }); return false;
};
function iniRow(e) {
  return `<li data-id="${esc(e.id)}" data-char="${esc(e.charId || '')}"><input class="field" name="name" value="${esc(e.name)}" aria-label="Nom" required>
    <input class="field" name="init" type="number" value="${e.init ?? ''}" aria-label="Initiative" style="width:80px">
    <button type="button" class="iconbtn" data-act="iniRoll" aria-label="Tirer 1d20">${ic('d20', 13)}</button>
    <button type="button" class="iconbtn" data-act="iniDel" aria-label="Retirer">${ic('trash', 12)}</button></li>`;
}
function iniModal(s) {
  openModal(`<h3>Initiative</h3><p class="hint" style="margin:0">Saisis ou tire l’initiative de chacun ; l’ordre est trié du plus haut au plus bas. Tous les joueurs voient la barre et sont prévenus à leur tour.</p>
    <form class="form" id="iniForm"><ol class="ini-edit full">${s.list.map(iniRow).join('')}</ol>
      <div class="edit-row full"><button type="button" class="btn xs" data-act="iniAddChars">${ic('user', 12)}Ajouter les personnages</button><button type="button" class="btn xs" data-act="iniAddFoe">${ic('plus', 12)}Ajouter un adversaire</button><button type="button" class="btn xs" data-act="iniRollAll">${ic('d20', 12)}Tirer les cases vides</button></div>
      <div class="modal-acts full">${s.active ? `<button type="button" class="btn danger" data-act="iniEnd">Terminer le combat</button><span class="grow"></span>` : ''}<button type="button" class="btn" data-act="closeModal">Annuler</button><button class="btn orange" type="submit">${s.active ? 'Mettre à jour' : 'Commencer le combat'}</button></div></form>`);
}
const iniList = () => $('#iniForm .ini-edit');
ACT.iniAddChars = () => {
  const have = new Set([...iniList().children].map(li => li.dataset.char).filter(Boolean));
  ME.chars.filter(c => !have.has(c.$id) && c.kind !== 'npc').forEach(c => iniList().insertAdjacentHTML('beforeend', iniRow({ id: 'i_' + uid(), name: c.name, charId: c.$id })));
  return false;
};
ACT.iniAddFoe = () => { iniList().insertAdjacentHTML('beforeend', iniRow({ id: 'i_' + uid(), name: 'Adversaire' })); iniList().lastElementChild.querySelector('[name=name]').select(); return false; };
ACT.iniDel = (d, el) => false;
ACT.iniRoll = () => false;
ACT.iniRollAll = () => { iniList().querySelectorAll('[name=init]').forEach(i => { if (i.value === '') i.value = 1 + Math.floor(Math.random() * 20); }); return false; };
ACT.iniEnd = () => { if (!confirm('Terminer le combat ? La barre d’initiative disparaît pour toute la table.')) return false; closeModal(); saveIni(INI_EMPTY()); return false; };
// row buttons need the row: handled here (ACT gets only data-* values)
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#iniForm [data-act="iniDel"], #iniForm [data-act="iniRoll"]'); if (!b) return;
  const li = b.closest('li');
  if (b.dataset.act === 'iniDel') li.remove(); else li.querySelector('[name=init]').value = 1 + Math.floor(Math.random() * 20);
}, true);
document.addEventListener('submit', e => {
  if (e.target.id !== 'iniForm') return;
  e.preventDefault(); e.stopImmediatePropagation();
  const old = iniState();
  const list = [...iniList().children].map(li => ({ id: li.dataset.id, charId: li.dataset.char || undefined, name: li.querySelector('[name=name]').value.trim().slice(0, 64) || '?',
    init: li.querySelector('[name=init]').value === '' ? null : +li.querySelector('[name=init]').value })).sort((a, b) => (b.init ?? -1e9) - (a.init ?? -1e9));
  if (!list.length) { toast('Ajoute au moins un participant.'); return; }
  const curId = old.active ? old.list[old.turn]?.id : null, idx = list.findIndex(x => x.id === curId);
  closeModal();
  saveIni({ active: true, round: old.active ? old.round : 1, turn: idx > -1 ? idx : 0, list });
}, true);

/* everyone: follow the campaign row; tell a player when their turn comes */
let iniLastCur = null;
document.addEventListener('tn:campaign', ev => {
  if (!('initiative' in ev.detail)) return;
  renderIniBar();
  const s = iniState(), cur = s.active ? s.list[s.turn] : null;
  const key = cur ? `${s.round}:${s.turn}:${cur.id}` : null;
  if (key && key !== iniLastCur && cur.charId && myCharIds().has(cur.charId)) { toast(`À toi de jouer : ${cur.name} !`); try { sfx.lock(); } catch (_) {} }
  iniLastCur = key;
});
const _enterIni = enterCampaign;
enterCampaign = async function (id) { await _enterIni(id); const s = iniState(); iniLastCur = s.active && s.list[s.turn] ? `${s.round}:${s.turn}:${s.list[s.turn].id}` : null; renderIniBar(); };
const _leaveIni = leaveCampaign;
leaveCampaign = async function () { iniBar.hidden = true; return _leaveIni(); };

const iniCss = document.createElement('style');
iniCss.textContent = `
#iniBar{display:flex;align-items:center;gap:12px;margin:-4px 0 14px;padding:8px 10px;border-radius:10px;overflow:hidden;
  background:var(--noise),linear-gradient(180deg,var(--panel-a),var(--panel-b));box-shadow:inset 0 1px 0 rgba(255,240,215,.08),0 2px 0 #0d0c0a}
#iniBar[hidden]{display:none}
.ini-round{font:400 9.5px var(--f-display);letter-spacing:.16em;text-transform:uppercase;color:var(--mute);white-space:nowrap}
.ini-round b{font:600 15px var(--f-mono);color:var(--cream);letter-spacing:0;margin-left:4px}
.ini-list{display:flex;gap:6px;list-style:none;margin:0;padding:0;overflow-x:auto;flex:1;scrollbar-width:thin}
.ini-list li{display:flex;align-items:center;gap:6px;white-space:nowrap;padding:5px 9px 5px 5px;border-radius:6px;background:var(--well);font-size:12.5px;color:var(--mute);box-shadow:inset 0 1px 3px rgba(0,0,0,.5)}
.ini-list li.mine{color:var(--ink)}
.ini-list li.cur{color:#24110a;background:linear-gradient(var(--orange-hi),var(--orange));box-shadow:0 2px 0 var(--orange-lo)}
.ini-n{display:inline-grid;place-items:center;min-width:24px;height:20px;padding:0 4px;border-radius:4px;font:600 12px var(--f-mono);color:var(--cream);background:linear-gradient(#2c2a26 50%,#222019 50%)}
.ini-acts{display:flex;gap:6px;align-items:center}
.ini-edit{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;max-height:46vh;overflow:auto}
.ini-edit li{display:flex;gap:6px;align-items:center}
.ini-edit li [name=name]{flex:1}`;
document.head.appendChild(iniCss);
