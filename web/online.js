/* online.js — connects the Table Noire mockup to the self-hosted Appwrite backend.
   Loaded after the mockup scripts (shared global scope): it adds the login gate, the campaign
   selector, the admin/GM managers, and replaces the local dice roller by the server roll + a
   realtime log per campaign. The sheet itself still shows the mockup data (next step). */

const TN = TN_CONFIG;   // web/config.js, generated from tn.config.json by tools/configure.mjs
const AW = (() => {
  const c = new Appwrite.Client().setEndpoint(TN.endpoint).setProject(TN.project);
  return { c, account: new Appwrite.Account(c), fn: new Appwrite.Functions(c), db: new Appwrite.TablesDB(c), teams: new Appwrite.Teams(c), Q: Appwrite.Query };
})();
const ME = { user: null, isAdmin: false, camp: null, role: null, chars: [], charId: null, names: {} };
const ONLINE = { unsub: null, holding: false, held: [] };

/* ---------------------------------------------------------------- helpers */
const BUILD = '2026-11-10.27';
const loginEmail = id => (id.includes('@') ? id.trim() : `${id.trim().toLowerCase()}@players.tablenoire.invalid`);
const appLink = (kind, token) => `${location.origin}${location.pathname}?${kind}=${token}`;
async function call(functionId, body) {
  const ex = await AW.fn.createExecution({ functionId, body: JSON.stringify(body), async: false });
  let r; try { r = JSON.parse(ex.responseBody || '{}'); } catch (_) { throw new Error(`Réponse inattendue (${ex.responseStatusCode}).`); }
  if (!r.ok) throw new Error(r.message || 'Action refusée.');
  return r;
}
const admin = (action, params = {}) => call('admin', { action, ...params });
async function rows(tableId, queries = []) {
  return (await AW.db.listRows({ databaseId: TN.db, tableId, queries: [...queries, AW.Q.limit(500)] })).rows;
}
const errMsg = e => (e && (e.message || e.type)) || String(e);
const fmtDate = s => (s ? new Date(s).toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const COLORS = ['#4f8d89', '#8d6b9a', '#d6a23c', '#86985a', '#5280ad', '#c4523a', '#e7dcc4'];
const colorFor = id => COLORS[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
function copy(text, el) {
  navigator.clipboard?.writeText(text).then(() => { if (el) el.textContent = 'Copié'; toast('Lien copié'); }).catch(() => prompt('Copie ce lien :', text));
}

/* ---------------------------------------------------------------- gate (login / invite / reset / campaigns) */
const gateCss = document.createElement('style');
gateCss.textContent = `
body.gated{overflow:hidden}
body.gated .app,body.gated .fab{display:none}
/* modals (campaigns, users, members) must open above the gate */
.modal{z-index:100}
#toast{z-index:110!important}
#logClear[hidden]{display:none}
#gate{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:16px;overflow:auto;
  background:var(--noise),radial-gradient(900px 500px at 30% -10%,#2a2823 0%,transparent 60%),var(--bg)}
#gate[hidden]{display:none!important}
.gate-box{width:min(440px,100%);display:flex;flex-direction:column;gap:14px}
.gate-box.wide{width:min(760px,100%)}
.gate-brand{display:flex;align-items:center;gap:12px;justify-content:center;margin-bottom:6px}
.gate-brand .brand-mark{cursor:default}
.gate-brand b{font:400 20px/1 var(--f-display);letter-spacing:.16em}
.gate-form{display:flex;flex-direction:column;gap:10px}
.gate-form label{display:flex;flex-direction:column;gap:5px;font:400 9px/1 var(--f-display);letter-spacing:.18em;text-transform:uppercase;color:var(--cream-lo)}
.gate-form .field{font:14px var(--f-body);color:var(--ink);padding:10px}
.gate-err{color:#e6a593;font-size:13px;min-height:1em}
.gate-links{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
.linkbtn{border:0;background:none;color:var(--mute);cursor:pointer;font:13px var(--f-body);padding:4px 0}
.linkbtn:hover{color:var(--ink)}
.camp-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.camp{text-align:left;border:0;cursor:pointer;color:var(--ink);padding:14px;border-radius:12px;display:flex;flex-direction:column;gap:8px;min-height:120px;
  background:linear-gradient(180deg,var(--panel-a),var(--panel-b));box-shadow:inset 0 1px 0 rgba(255,240,215,.08),0 2px 0 #0d0c0a,0 10px 20px -12px rgba(0,0,0,.8);transition:transform .1s}
.camp:hover{transform:translateY(-2px)}
.camp b{font:400 14px/1.25 var(--f-display);letter-spacing:.06em}
.camp p{margin:0;color:var(--mute);font-size:12.5px;flex:1}
.camp .chips{margin-top:auto}
.mgr{display:flex;flex-direction:column;gap:8px;max-height:min(56vh,520px);overflow:auto;margin:6px 0}
.mgr-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:9px 11px;border-radius:8px;background:var(--well);box-shadow:inset 0 1px 3px rgba(0,0,0,.5)}
.mgr-row .t{font-weight:600;font-size:13px}.mgr-row .s{color:var(--mute);font:11px var(--f-mono);margin-top:2px;overflow-wrap:anywhere}
.mgr-row .a{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
.mgr h4{font:400 9.5px/1 var(--f-display);letter-spacing:.2em;text-transform:uppercase;color:var(--cream-lo);margin:10px 0 2px}
.inline-form{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.inline-form .field{flex:1;min-width:120px}
.linkbox{font:11px var(--f-mono);padding:8px;border-radius:6px;background:var(--plate);overflow-wrap:anywhere;color:var(--cream)}
.viewer .lbl.online{color:var(--cream-lo)}
`;
document.head.appendChild(gateCss);
document.body.classList.add('gated');
const gate = document.createElement('div');
gate.id = 'gate';
document.body.appendChild(gate);

const brandHtml = `<div class="gate-brand"><span class="brand-mark"></span><b>TABLE NOIRE</b></div>`;
function gateScreen(html, wide = false) {
  gate.hidden = false; document.body.classList.add('gated');
  gate.innerHTML = `<div class="gate-box ${wide ? 'wide' : ''}">${brandHtml}${html}${langSwitchHtml()}</div>`;
  const f = gate.querySelector('.field'); if (f) f.focus();
}
const gateErr = m => { const e = gate.querySelector('.gate-err'); if (e) e.textContent = m || ''; };
const busy = (form, on) => form.querySelectorAll('button,input').forEach(x => (x.disabled = on));

function showLogin(msg = '') {
  gateScreen(`<div class="tile"><div class="tile-head"><span class="led"></span><h3 class="tile-title">Connexion</h3></div>
    <form class="gate-form" id="gLogin">
      <label>Pseudo, ou e-mail pour l’admin<input class="field" name="ident" autocomplete="username" required></label>
      <label>Mot de passe<input class="field" type="password" name="pw" autocomplete="current-password" required></label>
      <div class="gate-err">${esc(msg)}</div>
      <button class="btn orange" type="submit" style="justify-content:center;padding:12px">Entrer</button>
    </form></div>
    <p class="hint" style="text-align:center;margin:0">Pas de compte ? Demande un lien d’invitation au MJ ou à l’admin.<br><span style="opacity:.5">version ${BUILD}</span></p>`);
}
function showRedeem(kind, token) {
  const reset = kind === 'reset';
  gateScreen(`<div class="tile"><div class="tile-head"><span class="led"></span><h3 class="tile-title">${reset ? 'Nouveau mot de passe' : 'Rejoindre la table'}</h3></div>
    <form class="gate-form" id="gRedeem" data-kind="${kind}" data-token="${esc(token)}">
      ${reset ? '' : '<label>Pseudo (3 à 24 caractères : lettres, chiffres, - ou _)<input class="field" name="username" autocomplete="username" required pattern="[A-Za-z0-9_-]{3,24}"></label>'}
      <label>Mot de passe (10 caractères minimum)<input class="field" type="password" name="pw" autocomplete="new-password" minlength="10" required></label>
      <label>Confirmer<input class="field" type="password" name="pw2" autocomplete="new-password" minlength="10" required></label>
      <div class="gate-err"></div>
      <button class="btn orange" type="submit" style="justify-content:center;padding:12px">${reset ? 'Changer le mot de passe' : 'Créer mon compte'}</button>
    </form></div>
    <div class="gate-links"><button class="linkbtn" data-gate="login">J’ai déjà un compte</button></div>`);
}

async function showCampaigns() {
  gateScreen(`<p class="hint" style="text-align:center">Chargement des campagnes…</p>`, true);
  let list = [];
  try {
    if (ME.isAdmin) list = await rows('campaigns', [AW.Q.orderAsc('name')]);
    else {
      const t = await AW.teams.list({ queries: [AW.Q.limit(100)] });
      const ids = t.teams.map(x => x.$id);
      list = ids.length ? await rows('campaigns', [AW.Q.equal('$id', ids)]) : [];
    }
  } catch (e) { toast(errMsg(e)); }
  await loadNames();
  const active = list.filter(c => !c.archived), archived = list.filter(c => c.archived);
  const card = c => `<button class="camp" data-gate="enter" data-id="${c.$id}"><b>${esc(c.name)}</b><p>${esc(c.description || '')}</p>
    <div class="chips"><span class="chip">MJ : ${esc(ME.names[c.gmUserId] || '—')}</span>${c.sessionNo ? `<span class="chip">Séance ${c.sessionNo}</span>` : ''}${c.archived ? '<span class="chip">Archivée</span>' : ''}</div></button>`;
  gateScreen(`<div class="tile"><div class="tile-head"><span class="led"></span><h3 class="tile-title">Campagnes</h3><span class="grow"></span>
      ${ME.isAdmin ? `<button class="btn" data-gate="campaigns">${ic('grid')}Gestionnaire</button><button class="btn" data-gate="users">${ic('user')}Utilisateurs</button>` : ''}
      <button class="btn" data-gate="logout">Déconnexion</button></div>
    ${active.length ? `<div class="camp-list">${active.map(card).join('')}</div>` : `<p class="hint">${ME.isAdmin ? 'Aucune campagne. Ouvre le gestionnaire pour en créer une.' : 'Tu ne fais encore partie d’aucune campagne. Le MJ doit t’y ajouter.'}</p>`}
    ${archived.length ? `<h4 class="tile-title" style="display:inline-block;margin-top:14px">Archivées</h4><div class="camp-list" style="margin-top:10px">${archived.map(card).join('')}</div>` : ''}
    </div><p class="hint" style="text-align:center;margin:0">Connecté : ${esc(ME.user.name)}${ME.isAdmin ? ' · admin' : ''}</p>`, true);
}

async function loadNames() {
  try { (await rows('profiles')).forEach(p => (ME.names[p.userId] = p.username)); } catch (_) {}
  if (ME.user) ME.names[ME.user.$id] = ME.user.name;
}

async function enterCampaign(id) {
  gateScreen(`<p class="hint" style="text-align:center">Ouverture de la campagne…</p>`);
  try {
    const camp = await AW.db.getRow({ databaseId: TN.db, tableId: 'campaigns', rowId: id });
    let role = null;
    try {
      const m = await AW.teams.listMemberships({ teamId: id, queries: [AW.Q.equal('userId', ME.user.$id)] });
      role = m.memberships[0]?.roles?.includes('gm') ? 'gm' : (m.memberships[0] ? 'player' : null);
    } catch (_) {}
    if (!role && ME.isAdmin) role = 'gm';
    if (!role) throw new Error('Tu ne fais pas partie de cette campagne.');
    ME.camp = camp; ME.role = role;
    try { localStorage.setItem('tn.lastCampaign', id); } catch (_) {}
    await loadCharacters();
    S.viewer = role === 'gm' ? 'mj' : 'owner';
    const mine = ME.chars.find(c => c.ownerId === ME.user.$id);
    ME.charId = role === 'gm' ? null : (mine ? mine.$id : null);
    $('#appName').textContent = (camp.name || 'TABLE NOIRE').toUpperCase();
    $('#sessLine').textContent = camp.sessionNo ? `SÉANCE ${camp.sessionNo}${camp.sessionName ? ' · ' + camp.sessionName.toUpperCase() : ''}` : (role === 'gm' ? 'MJ' : 'JOUEUR');
    await startDiceLog();
    gate.hidden = true; document.body.classList.remove('gated');
    if (typeof schedulePack === 'function') schedulePack();   // tiles were measured while the app was hidden
    render();
  } catch (e) { toast(errMsg(e)); showCampaigns(); }
}
async function loadCharacters() {
  ME.chars = await rows('characters', [AW.Q.equal('campaignId', ME.camp.$id), AW.Q.orderAsc('name')]).catch(() => []);
}
function leaveCampaign() {
  if (ONLINE.unsub) { ONLINE.unsub(); ONLINE.unsub = null; }
  ME.camp = null; ME.role = null; closeModal(); showCampaigns();
}

gate.addEventListener('click', async e => {
  const b = e.target.closest('[data-gate]'); if (!b) return;
  const a = b.dataset.gate;
  if (a === 'login') { history.replaceState(null, '', location.pathname); showLogin(); }
  if (a === 'logout') logout();
  if (a === 'enter') enterCampaign(b.dataset.id);
  if (a === 'campaigns') campaignsModal();
  if (a === 'users') usersModal();
});
gate.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, fd = Object.fromEntries(new FormData(f));
  const form = f.getAttribute('id');   // not f.id: a field named "id" would shadow it
  gateErr(''); busy(f, true);
  try {
    if (form === 'gLogin') {
      const creds = { email: loginEmail(fd.ident), password: fd.pw };
      try { await AW.account.createEmailPasswordSession(creds); }
      catch (err) {   // an old session is still open (maybe another account): close it and retry
        if (err.type !== 'user_session_already_exists') throw err;
        await AW.account.deleteSession({ sessionId: 'current' }).catch(() => {});
        await AW.account.createEmailPasswordSession(creds);
      }
      await afterLogin();
    }
    if (form === 'gRedeem') {
      if (fd.pw !== fd.pw2) throw new Error('Les mots de passe diffèrent.');
      const r = await call('redeem-invite', { token: f.dataset.token, username: fd.username, password: fd.pw });
      history.replaceState(null, '', location.pathname);
      try { await AW.account.deleteSession({ sessionId: 'current' }); } catch (_) {}
      await AW.account.createEmailPasswordSession({ email: r.email, password: fd.pw });
      await afterLogin();
    }
  } catch (err) {
    busy(f, false);
    gateErr(err.type === 'user_invalid_credentials' ? 'Identifiant ou mot de passe incorrect.' : errMsg(err));
  }
});

async function afterLogin() {
  ME.user = await AW.account.get();
  ME.isAdmin = (ME.user.labels || []).includes('admin');
  let last = null; try { last = localStorage.getItem('tn.lastCampaign'); } catch (_) {}
  if (last) { try { await AW.db.getRow({ databaseId: TN.db, tableId: 'campaigns', rowId: last }); return enterCampaign(last); } catch (_) {} }
  showCampaigns();
}
async function logout() {
  if (ONLINE.unsub) { ONLINE.unsub(); ONLINE.unsub = null; }
  try { await AW.account.deleteSession({ sessionId: 'current' }); } catch (_) {}
  try { localStorage.removeItem('tn.lastCampaign'); } catch (_) {}
  ME.user = null; ME.camp = null; closeModal(); showLogin();
}

/* ---------------------------------------------------------------- header inside a campaign */
const _renderHeaderOffline = renderHeader;
renderHeader = function () {
  _renderHeaderOffline();
  logClearBtn.hidden = !(ME.camp && ME.role === 'gm');
  if (!ME.camp) return;
  const lbl = $('.viewer .lbl'); if (lbl) { lbl.textContent = 'Personnage'; lbl.classList.add('online'); }
  const opts = ME.role === 'gm' ? [[null, 'MJ'], ...ME.chars.filter(c => c.kind !== 'npc').map(c => [c.$id, c.name])] : ME.chars.filter(c => c.ownerId === ME.user.$id).map(c => [c.$id, c.name]);
  $('#viewerSeg').innerHTML = opts.length ? opts.map(([id, n]) => `<button data-act="pickChar" data-id="${id || ''}" aria-pressed="${(ME.charId || null) === id}"><span class="dot"></span>${esc(n)}</button>`).join('')
    : `<button disabled><span class="dot"></span>Aucun personnage</button>`;
  $('#adminSlot').innerHTML = [
    ME.role === 'gm' ? `<button class="btn" data-act="membersMgr">${ic('ticket')}Joueurs &amp; invitations</button>` : '',
    ME.isAdmin ? `<button class="btn" data-act="campaignsMgr">${ic('grid')}Campagnes</button><button class="btn" data-act="usersMgr">${ic('user')}Utilisateurs</button>` : '',
    `<button class="btn" data-act="switchCampaign" title="Changer de campagne">${ic('swap')}Changer</button>`,
    `<button class="btn" data-act="logout" title="Se déconnecter">${ic('logout')}</button>`,
  ].join('');
};
Object.assign(ACT, {
  pickChar: d => { ME.charId = d.id || null; },
  membersMgr: () => { membersModal(); return false; },
  campaignsMgr: () => { campaignsModal(); return false; },
  usersMgr: () => { usersModal(); return false; },
  switchCampaign: () => { leaveCampaign(); return false; },
  logout: () => { logout(); return false; },
  invites: () => { membersModal(); return false; },
});
// icons the mockup may not have
['grid', 'user', 'swap', 'logout'].forEach(n => {
  if (!P[n]) P[n] = { grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    swap: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>' }[n];
});

/* ---------------------------------------------------------------- managers (modals) */
async function usersModal(created) {
  openModal(`<h3>Utilisateurs</h3><p class="hint">Chargement…</p>`);
  let users = [];
  try { users = (await admin('listUsers')).users; } catch (e) { return openModal(`<h3>Utilisateurs</h3><p class="gate-err">${esc(errMsg(e))}</p><div class="modal-acts"><button class="btn" data-act="closeModal">Fermer</button></div>`); }
  const row = u => `<div class="mgr-row"><div><div class="t">${esc(u.name)} ${u.labels.includes('admin') ? '<span class="chip">admin</span>' : ''} ${u.status ? '' : '<span class="chip" style="color:var(--rust)">bloqué</span>'}</div>
      <div class="s">${esc(u.email.endsWith('@players.tablenoire.invalid') ? 'pseudo : ' + u.name : u.email)} · dernier accès ${fmtDate(u.accessedAt)}</div></div>
    <div class="a"><button class="btn xs" data-um="rename" data-id="${u.id}" data-n="${esc(u.name)}">Renommer</button>
      <button class="btn xs" data-um="reset" data-id="${u.id}">Lien mot de passe</button>
      ${u.id === ME.user.$id ? '' : `<button class="btn xs" data-um="status" data-id="${u.id}" data-s="${u.status ? 0 : 1}">${u.status ? 'Bloquer' : 'Débloquer'}</button><button class="btn xs danger" data-um="delete" data-id="${u.id}" data-n="${esc(u.name)}">Supprimer</button>`}</div></div>`;
  openModal(`<h3>Utilisateurs</h3>
    ${created ? `<p class="hint" style="margin:0">${esc(created.label)}</p><div class="linkbox">${esc(created.link)}</div><div class="modal-acts" style="margin-top:6px"><button class="btn xs" data-um="copy" data-l="${esc(created.link)}">Copier le lien</button></div>` : ''}
    <div class="mgr">${users.map(row).join('')}</div>
    <h4 class="tile-title" style="display:inline-block">Nouvel utilisateur</h4>
    <p class="hint" style="margin:4px 0">Crée un lien à usage unique : la personne choisit son pseudo et son mot de passe. Tu pourras l’ajouter ensuite à une campagne.</p>
    <div class="modal-acts"><button class="btn" data-act="closeModal">Fermer</button><button class="btn orange" data-um="invite">${ic('plus')}Créer un lien d’inscription</button></div>`);
}
async function campaignsModal(msg) {
  openModal(`<h3>Gestionnaire de campagnes</h3><p class="hint">Chargement…</p>`);
  let list = [], users = [];
  try { [list, users] = await Promise.all([rows('campaigns', [AW.Q.orderAsc('name')]), admin('listUsers').then(r => r.users)]); } catch (e) { toast(errMsg(e)); }
  await loadNames();
  const opts = sel => `<option value="">— aucun —</option>${users.map(u => `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}`;
  openModal(`<h3>Gestionnaire de campagnes</h3>${msg ? `<p class="hint" style="margin:0">${esc(msg)}</p>` : ''}
    <div class="mgr">${list.map(c => `<form class="mgr-row" data-cm="save" data-id="${c.$id}"><div class="inline-form">
        <input class="field" name="name" value="${esc(c.name)}" aria-label="Nom" required>
        <select class="field" name="gm" aria-label="MJ" style="max-width:170px">${opts(c.gmUserId)}</select>
        <input class="field" name="description" value="${esc(c.description || '')}" placeholder="Description" aria-label="Description" style="flex-basis:100%">
      </div><div class="a"><button class="btn xs" type="submit">Enregistrer</button>
        <button class="btn xs" type="button" data-cm="archive" data-id="${c.$id}" data-v="${c.archived ? 0 : 1}">${c.archived ? 'Désarchiver' : 'Archiver'}</button>
        <button class="btn xs danger" type="button" data-cm="delete" data-id="${c.$id}" data-n="${esc(c.name)}">Supprimer</button></div></form>`).join('') || '<p class="hint">Aucune campagne.</p>'}</div>
    <h4 class="tile-title" style="display:inline-block">Nouvelle campagne</h4>
    <form class="inline-form" data-cm="create" style="margin-top:8px"><input class="field" name="name" placeholder="Nom de la campagne" required>
      <select class="field" name="gm" aria-label="MJ" style="max-width:190px">${opts(ME.user.$id)}</select>
      <button class="btn orange" type="submit">${ic('plus')}Créer</button></form>
    <p class="hint" style="margin:6px 0 0">Le MJ choisi gère ses joueurs, ses invitations et ses personnages. Tu restes admin de toutes les campagnes.</p>
    <div class="modal-acts"><button class="btn" data-act="closeModal">Fermer</button></div>`);
}
async function membersModal(created) {
  const c = ME.camp; if (!c) return;
  openModal(`<h3>Joueurs &amp; invitations</h3><p class="hint">Chargement…</p>`);
  let members = [], invites = [];
  try { [members, invites] = await Promise.all([admin('listMembers', { campaignId: c.$id }).then(r => r.members), admin('listInvites', { campaignId: c.$id }).then(r => r.invites)]); } catch (e) { toast(errMsg(e)); }
  await loadNames(); await loadCharacters();
  const memberIds = new Set(members.map(m => m.userId));
  const candidates = Object.entries(ME.names).filter(([id]) => !memberIds.has(id));
  const playerOpts = sel => `<option value="">— non attribué —</option>${members.map(m => `<option value="${m.userId}" ${m.userId === sel ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}`;
  const pending = invites.filter(i => !i.usedAt && new Date(i.expiresAt) > new Date());
  openModal(`<h3>Joueurs &amp; invitations · ${esc(c.name)}</h3>
    ${created ? `<p class="hint" style="margin:0">${esc(created.label)}</p><div class="linkbox">${esc(created.link)}</div><div class="modal-acts" style="margin-top:6px"><button class="btn xs" data-mm="copy" data-l="${esc(created.link)}">Copier le lien</button></div>` : ''}
    <div class="mgr">
      <h4>Membres</h4>
      ${members.map(m => `<div class="mgr-row"><div><div class="t">${esc(m.name)} <span class="chip">${m.roles.includes('gm') ? 'MJ' : 'joueur'}</span></div></div>
        <div class="a">${m.roles.includes('gm') && !ME.isAdmin ? '' : `<button class="btn xs danger" data-mm="remove" data-id="${m.userId}" data-n="${esc(m.name)}">Exclure</button>`}</div></div>`).join('') || '<p class="hint">Aucun membre.</p>'}
      ${candidates.length ? `<form class="inline-form" data-mm="add"><select class="field" name="userId" aria-label="Utilisateur">${candidates.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}</select>
        ${ME.isAdmin ? '<select class="field" name="role" style="max-width:120px"><option value="player">joueur</option><option value="gm">MJ</option></select>' : ''}
        <button class="btn" type="submit">${ic('plus')}Ajouter un compte existant</button></form>` : ''}
      <h4>Personnages</h4>
      ${ME.chars.map(ch => `<form class="mgr-row" data-mm="assign" data-id="${ch.$id}"><div class="inline-form"><span class="t" style="min-width:120px">${esc(ch.name)}${ch.kind === 'npc' ? ' <span class="chip">PNJ</span>' : ''}</span>
          <select class="field" name="ownerId" aria-label="Joueur" style="max-width:180px">${playerOpts(ch.ownerId)}</select></div>
        <div class="a"><button class="btn xs" type="submit">Attribuer</button><button class="btn xs danger" type="button" data-mm="delchar" data-id="${ch.$id}" data-n="${esc(ch.name)}">Supprimer</button></div></form>`).join('') || '<p class="hint">Aucun personnage.</p>'}
      <form class="inline-form" data-mm="newchar"><input class="field" name="name" placeholder="Nom du personnage" required>
        <select class="field" name="ownerId" style="max-width:170px">${playerOpts(null)}</select>
        <select class="field" name="kind" style="max-width:90px"><option value="pc">PJ</option><option value="npc">PNJ</option></select>
        <button class="btn" type="submit">${ic('plus')}Créer</button></form>
      <h4>Invitations en attente</h4>
      ${pending.map(i => `<div class="mgr-row"><div><div class="t">${i.role === 'gm' ? 'MJ' : 'Joueur'} · expire ${fmtDate(i.expiresAt)}</div><div class="s">…${esc(i.token.slice(-8))}</div></div>
        <div class="a"><button class="btn xs" data-mm="copy" data-l="${esc(appLink('invite', i.token))}">Copier</button><button class="btn xs danger" data-mm="revoke" data-id="${i.id}">Révoquer</button></div></div>`).join('') || '<p class="hint">Aucune.</p>'}
    </div>
    <div class="modal-acts"><button class="btn" data-act="closeModal">Fermer</button><button class="btn orange" data-mm="invite">${ic('plus')}Inviter un nouveau joueur</button></div>`);
}

const modalBox = $('#modalBox');
modalBox.addEventListener('click', async e => {
  const b = e.target.closest('[data-um],[data-cm],[data-mm]'); if (!b || b.tagName === 'FORM') return;
  e.stopPropagation();
  const d = b.dataset;
  try {
    // users
    if (d.um === 'copy' || d.mm === 'copy') return copy(d.l, b);
    if (d.um === 'rename') { const n = prompt('Nouveau pseudo', d.n); if (n && n.trim()) { await admin('updateUser', { userId: d.id, name: n.trim() }); usersModal(); } }
    if (d.um === 'status') { await admin('updateUser', { userId: d.id, status: d.s === '1' }); usersModal(); }
    if (d.um === 'delete') { if (confirm(`Supprimer définitivement le compte « ${d.n} » ? Ses personnages restent dans leurs campagnes, sans joueur. Action irréversible.`)) { await admin('deleteUser', { userId: d.id }); usersModal(); } }
    if (d.um === 'reset') { const r = await admin('resetLink', { userId: d.id }); usersModal({ label: 'Lien de réinitialisation (valable 2 jours, usage unique) :', link: appLink('reset', r.invite.token) }); }
    if (d.um === 'invite') { const r = await admin('createInvite', {}); usersModal({ label: 'Lien d’inscription (valable 7 jours, usage unique) :', link: appLink('invite', r.invite.token) }); }
    // campaigns
    if (d.cm === 'archive') { await admin('updateCampaign', { campaignId: d.id, archived: d.v === '1' }); campaignsModal(); }
    if (d.cm === 'delete') {
      if (confirm(`Supprimer la campagne « ${d.n} » et TOUTES ses données (personnages, lore, cartes, journal) ? Action irréversible.`) && prompt('Tape le nom de la campagne pour confirmer') === d.n) {
        await admin('deleteCampaign', { campaignId: d.id }); campaignsModal('Campagne supprimée.');
      }
    }
    // members
    if (d.mm === 'remove') { if (confirm(`Exclure ${d.n} de la campagne ? Ses personnages restent, sans joueur.`)) { await admin('removeMember', { campaignId: ME.camp.$id, userId: d.id }); membersModal(); } }
    if (d.mm === 'delchar') { if (confirm(`Supprimer le personnage « ${d.n} » et toutes ses données ? Action irréversible.`)) { await admin('deleteCharacter', { characterId: d.id }); await loadCharacters(); membersModal(); render(); } }
    if (d.mm === 'revoke') { await admin('revokeInvite', { inviteId: d.id }); membersModal(); }
    if (d.mm === 'invite') { const r = await admin('createInvite', { campaignId: ME.camp.$id, role: 'player' }); membersModal({ label: 'Lien d’invitation joueur (valable 7 jours, usage unique) :', link: appLink('invite', r.invite.token) }); }
  } catch (err) { toast(errMsg(err)); }
}, true);
modalBox.addEventListener('submit', async e => {
  const f = e.target; if (!f.dataset.cm && !f.dataset.mm) return;
  e.preventDefault(); e.stopPropagation();
  const fd = Object.fromEntries(new FormData(f));
  try {
    if (f.dataset.cm === 'create') { await admin('createCampaign', { name: fd.name, gmUserId: fd.gm || null }); campaignsModal('Campagne créée.'); }
    if (f.dataset.cm === 'save') { await admin('updateCampaign', { campaignId: f.dataset.id, name: fd.name, description: fd.description, gmUserId: fd.gm || null }); campaignsModal('Enregistré.'); }
    if (f.dataset.mm === 'add') { await admin('addMember', { campaignId: ME.camp.$id, userId: fd.userId, role: fd.role || 'player' }); await loadCharacters(); membersModal(); render(); }
    if (f.dataset.mm === 'assign') { await admin('assignCharacter', { characterId: f.dataset.id, ownerId: fd.ownerId || null }); await loadCharacters(); membersModal(); render(); }
    if (f.dataset.mm === 'newchar') { await admin('createCharacter', { campaignId: ME.camp.$id, name: fd.name, ownerId: fd.ownerId || null, kind: fd.kind }); await loadCharacters(); membersModal(); render(); }
  } catch (err) { toast(errMsg(err)); }
}, true);

/* ---------------------------------------------------------------- dice: server roll + realtime log per campaign */
const toLog = r => {
  let text = r.formula, d = {}; try { d = JSON.parse(r.detail || '{}'); text = d.text || text; } catch (_) {}
  const t = new Date(r.$createdAt || Date.now());
  const head = `${d.secret ? 'Secret · ' : ''}${d.label ? d.label + ' · ' : ''}`;
  return { id: r.$id, who: r.characterName || r.username || '?', color: colorFor(r.characterId || r.userId), detail: `${head}${r.formula}  →  ${text}`, total: r.total, time: t.toTimeString().slice(0, 5), ts: t.getTime(), secret: !!d.secret };
};
function pushLog(entry, fresh = true) {
  if (LOG.some(l => l.id === entry.id)) return;
  // ordered by the server's creation time, so every player sees the same order even when rolls cross
  // (your own roll is held back during its animation and would otherwise land on top)
  LOG.push({ ...entry, fresh }); LOG.sort((a, b) => (b.ts || 0) - (a.ts || 0)); if (LOG.length > 120) LOG.length = 120; renderLog();
}
async function startDiceLog() {
  if (ONLINE.unsub) { ONLINE.unsub(); ONLINE.unsub = null; }
  LOG.length = 0;
  try {
    const list = await rows('dice_rolls', [AW.Q.equal('campaignId', ME.camp.$id), AW.Q.orderDesc('$createdAt'), AW.Q.limit(60)]);
    list.forEach(r => LOG.push(toLog(r)));
  } catch (e) { toast('Journal indisponible : ' + errMsg(e)); }
  renderLog();
  const campId = ME.camp.$id;
  ONLINE.unsub = AW.c.subscribe(`tablesdb.${TN.db}.tables.dice_rolls.rows`, ev => {
    const p = ev.payload || {};
    if (p.campaignId !== campId) return;
    if ((ev.events || []).some(x => x.endsWith('.delete'))) {   // the GM emptied the log (one event per roll)
      const i = LOG.findIndex(l => l.id === p.$id); if (i > -1) { LOG.splice(i, 1); scheduleLogRender(); }
      return;
    }
    if (!(ev.events || []).some(x => x.endsWith('.create'))) return;
    if (ONLINE.holding && p.userId === ME.user.$id) ONLINE.held.push(toLog(p)); else pushLog(toLog(p));
  });
}
let logRaf = 0;
const scheduleLogRender = () => { cancelAnimationFrame(logRaf); logRaf = requestAnimationFrame(renderLog); };

/* GM only: empty the campaign's shared dice log */
const logClearBtn = Object.assign(document.createElement('button'), { className: 'iconbtn', id: 'logClear', hidden: true,
  title: 'Vider le journal (MJ)', innerHTML: ic('trash', 13) });
logClearBtn.setAttribute('aria-label', 'Vider le journal des lancers');
$('#logCount').after(logClearBtn);
logClearBtn.addEventListener('click', async () => {
  if (!ME.camp || ME.role !== 'gm') return;
  if (!confirm(`Vider le journal des lancers de « ${ME.camp.name} » pour toute la table ? C’est définitif.`)) return;
  logClearBtn.disabled = true;
  try {
    const r = await admin('clearDiceLog', { campaignId: ME.camp.$id });
    LOG.length = 0; renderLog(); toast(`Journal vidé (${r.deleted} lancer${r.deleted > 1 ? 's' : ''}).`);
  } catch (e) { toast('Impossible de vider le journal : ' + errMsg(e)); }
  logClearBtn.disabled = false;
});

roll = async function onlineRoll() {
  if (rolling || !ME.camp) return;
  let ast;
  try { ast = parse(dF.value); } catch (err) { $('#dErr').textContent = err.message; return; }
  const faces = diceList(ast);
  if (faces.length > 200) { $('#dErr').textContent = 'Maximum 200 dés par lancer.'; return; }
  rolling = true; ONLINE.holding = true; ONLINE.held = []; $('#dErr').textContent = '';
  const btn = $('#dRoll'), sub = $('#dSub'), formula = dF.value.trim();
  // a roll started from the sheet carries its label and character; the dock toggle makes it secret
  const sheetRoll = ONLINE.next || {}; ONLINE.next = null;
  const rollChar = sheetRoll.charId || ME.charId, secret = !!$('#dSecret')?.checked;
  const ch = ME.chars.find(c => c.$id === rollChar);
  btn.disabled = true; btn.textContent = 'Les dés roulent…';
  $('#dWho').textContent = ch ? ch.name : (ME.role === 'gm' ? 'MJ' : ME.user.name);
  dTotal.classList.remove('idle', 'done'); sub.textContent = formula;
  const tray = $('#dTray'); tray.classList.remove('shake'); void tray.offsetWidth; tray.classList.add('shake');

  let result = null, finals = null, failed = null;
  call('roll-dice', { campaignId: ME.camp.$id, characterId: rollChar, formula, label: sheetRoll.label || '', secret })
    .then(r => { result = r; finals = r.rolls.flatMap(g => g.values); if (finals.length !== faces.length) failed = 'Désaccord client/serveur sur les dés.'; })
    .catch(e => { failed = errMsg(e); });

  const cur = faces.map(f => secureInt(f)), locked = faces.map(() => false), start = performance.now();
  const lockAt = faces.map((_, i) => DURATION * (faces.length === 1 ? 1 : .8 + .2 * (i / (faces.length - 1))));
  let next = 0, lastTick = 0;
  const finish = () => {
    btn.disabled = false; btn.textContent = 'Lancer'; rolling = false; ONLINE.holding = false;
    ONLINE.held.forEach(e => pushLog(e)); ONLINE.held = [];
  };
  function frame(now) {
    if (failed) { $('#dErr').textContent = failed; dTotal.classList.add('idle'); setFlaps(dTotal, '--'); finish(); return; }
    const el = now - start, t = Math.min(finals ? 1 : .95, el / DURATION);
    let changed = false;
    if (finals) faces.forEach((f, i) => { if (!locked[i] && el >= lockAt[i]) { locked[i] = true; cur[i] = finals[i]; changed = true; sfx.lock(); } });
    if (el >= next) {
      faces.forEach((f, i) => { if (!locked[i]) cur[i] = secureInt(f); });
      next = el + 40 + 560 * Math.pow(t, 2.4); changed = true;
      if (now - lastTick > 50) { sfx.tick(1 - t * .5); lastTick = now; }
    }
    if (changed) { renderTray(faces, cur, locked); const v = evaluate(ast, cur).v; setFlaps(dTotal, isFinite(v) ? v : '--'); }
    if (!finals || el < DURATION || !locked.every(Boolean)) return requestAnimationFrame(frame);
    renderTray(faces, finals, faces.map(() => true));
    setFlaps(dTotal, result.total); dTotal.classList.add('done'); sub.textContent = result.text; sfx.done();
    if (!ONLINE.held.length) pushLog({ id: result.id, who: result.characterName, color: colorFor(ME.charId || ME.user.$id), detail: `${formula}  →  ${result.text}`, total: result.total, time: new Date().toTimeString().slice(0, 5) });
    $('#fabLast').textContent = result.total;
    finish();
  }
  requestAnimationFrame(frame);
};
// the mockup bound its own roll() to the button: swap the button to drop that listener
(() => { const old = $('#dRoll'), b = old.cloneNode(true); old.replaceWith(b); b.addEventListener('click', () => roll()); })();

/* ---------------------------------------------------------------- start */
async function startOnline() {
  const q = new URLSearchParams(location.search);
  if (q.get('invite')) return showRedeem('invite', q.get('invite'));
  if (q.get('reset')) return showRedeem('reset', q.get('reset'));
  try { await AW.account.get(); await afterLogin(); } catch (_) { showLogin(); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(startOnline, 0)); else startOnline();
