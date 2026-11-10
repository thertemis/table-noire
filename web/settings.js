/* Table Noire — global admin settings (opened from the orange brand button, GM only).
   In the real app: table settings live in an Appwrite `settings` document; the connection block stays on the device. */

document.head.insertAdjacentHTML('beforeend', `<style>
#brandBtn{border:0;padding:0;cursor:pointer;transition:transform .08s,filter .15s}
#brandBtn:hover{filter:brightness(1.1)}
#brandBtn:active{transform:translateY(2px)}
.setgrid{display:grid;grid-template-columns:180px minmax(0,1fr);gap:16px;align-items:start}
.setnav{display:flex;flex-direction:column;gap:4px}
.setnav button{border:0;text-align:left;padding:9px 10px;border-radius:6px;cursor:pointer;background:transparent;color:var(--mute);font:400 9.5px/1.2 var(--f-display);letter-spacing:.14em;text-transform:uppercase}
.setnav button:hover{color:var(--ink);background:#22201c}
.setnav button[aria-current="true"]{color:var(--ink);background:linear-gradient(#3b3833,#2e2c27);box-shadow:inset 0 1px 0 rgba(255,240,215,.08),0 2px 0 #0b0a09}
.setpane{display:flex;flex-direction:column;gap:12px;min-width:0}
.setpane .form{grid-template-columns:1fr 1fr}
.setnote{font-size:12px;color:var(--mute);line-height:1.5;margin:0}
.setwarn{font-size:12px;color:#e9b7a8;border:1px dashed rgba(184,69,47,.5);border-radius:6px;padding:8px 10px;background:rgba(184,69,47,.07);margin:0}
.connstate{display:flex;align-items:center;gap:8px;font:500 12px var(--f-mono);color:var(--mute)}
.connstate .bulb{width:10px;height:10px}
.accprev{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
@media (max-width:640px){.setgrid{grid-template-columns:1fr}.setnav{flex-direction:row;flex-wrap:wrap}.setpane .form{grid-template-columns:1fr}}
</style>`);

const SET_DEF = {
  appName:'Table Noire', campaign:'Val-Sombre', sessionNo:12, sessionName:'La porte murée',
  accent:'#e2672c', diceSeconds:5, defaultVis:'all', allowPlayerLayout:true,
  endpoint:'', projectId:'', databaseId:'main', teamId:''
};
const SET_KEY = 'tablenoire.settings';
const SETTINGS = (() => { try { return { ...SET_DEF, ...JSON.parse(localStorage.getItem(SET_KEY) || '{}') }; } catch (_) { return { ...SET_DEF }; } })();
const saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(SETTINGS)); } catch (_) {} };
const ACCENTS = ['#e2672c', '#d6a23c', '#4f8d89', '#86985a', '#b8452f', '#8d6b9a', '#5280ad', '#e7dcc4'];
let setTab = 'table', connResult = null;

function applySettings() {
  const st = SETTINGS, root = document.documentElement.style;
  root.setProperty('--orange', st.accent);
  root.setProperty('--orange-hi', mix(st.accent, '#ffffff', .18));
  root.setProperty('--orange-lo', mix(st.accent, '#000000', .3));
  $('#appName').textContent = st.appName.toUpperCase();
  $('#sessLine').textContent = `SÉANCE ${st.sessionNo}${st.sessionName ? ' · ' + st.sessionName.toUpperCase() : ''}`;
  $('#sessLine').title = st.campaign;
  document.title = st.appName;
  DURATION = Math.round(st.diceSeconds * 1000);
}

function settingsModal() {
  const st = SETTINGS, f = (k, label, type = 'text', extra = '') => `<label>${label}<input class="field" type="${type}" data-set="${k}" value="${esc(st[k])}" ${extra}></label>`;
  const panes = {
    table:`<div class="form">${f('appName', 'Nom de l’application')}${f('campaign', 'Campagne / lieu')}${f('sessionNo', 'Numéro de séance', 'number', 'min="0"')}${f('sessionName', 'Nom de la séance')}</div>
      <div class="edit-row"><button class="btn xs" data-act="setNextSession">Séance suivante</button><span class="setnote">Incrémente le numéro et vide le nom.</span></div>`,
    look:`<div class="accprev"><span class="swatches">${ACCENTS.map(c => `<button style="--sw:${c}" data-act="setAccent" data-c="${c}" aria-pressed="${st.accent === c}" aria-label="Accent ${c}"></button>`).join('')}<input type="color" data-set="accent" value="${st.accent}" aria-label="Couleur d’accent personnalisée" style="width:28px;height:26px;border:0;background:none;cursor:pointer"></span>
        <button class="btn orange xs">Aperçu</button><span class="led"></span></div>
      <p class="setnote">L’accent colore les boutons principaux, les voyants, le lanceur de dés et les onglets actifs. Il s’applique à toute la table.</p>`,
    play:`<div class="form"><label>Durée de l’animation des dés (s)<input class="field" type="number" min="1" max="10" step="0.5" data-set="diceSeconds" value="${st.diceSeconds}"></label>
        <label>Visibilité par défaut des nouveaux champs<select class="field" data-set="defaultVis">${Object.entries(VISLBL).map(([k, l]) => `<option value="${k}" ${st.defaultVis === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="full" style="flex-direction:row;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font:13px var(--f-body);color:var(--ink)"><input type="checkbox" data-set="allowPlayerLayout" ${st.allowPlayerLayout ? 'checked' : ''}>Les joueurs peuvent réorganiser leur fiche</label></div>
      <div class="edit-row"><button class="btn" data-act="invites">${ic('ticket')}Gérer les invitations</button></div>`,
    conn:`<div class="form">${f('endpoint', 'Adresse du serveur (endpoint)', 'url', 'placeholder="https://appwrite.mondomaine.fr/v1" spellcheck="false"')}${f('projectId', 'ID du projet', 'text', 'spellcheck="false"')}${f('databaseId', 'ID de la base', 'text', 'spellcheck="false"')}${f('teamId', 'ID de l’équipe de campagne', 'text', 'spellcheck="false"')}</div>
      <div class="edit-row"><button class="btn" data-act="setTestConn">Tester la connexion</button><span class="connstate" id="connState">${connResult ? `<span class="bulb on" style="--bc:${connResult.ok ? 'var(--olive)' : 'var(--rust)'}"></span>${esc(connResult.msg)}` : '<span class="bulb"></span>Non testé'}</span></div>
      <p class="setnote">Ces réglages restent sur cet appareil : l’application en a besoin avant même de pouvoir se connecter.</p>
      <p class="setwarn">Ne saisis jamais la clé API serveur ici. Elle donne tous les droits et reste uniquement dans les Functions Appwrite.</p>`
  };
  const tabs = [['table', 'Table & séance'], ['look', 'Apparence'], ['play', 'Jeu & joueurs'], ['conn', 'Connexion Appwrite']];
  openModal(`<h3>Paramètres de la table</h3><div class="setgrid"><nav class="setnav" aria-label="Sections">${tabs.map(([k, l]) => `<button data-act="setTab" data-t="${k}" aria-current="${setTab === k}">${l}</button>`).join('')}</nav>
    <div class="setpane">${panes[setTab]}</div></div>
    <div class="modal-acts"><button class="btn" data-act="setReset">Valeurs par défaut</button><span class="grow"></span><button class="btn orange" data-act="closeModal">Fermer</button></div>`);
  $('#modalBox').classList.add('wide');
}

$('#brandBtn').addEventListener('click', () => { if (!isMJ()) { toast('Paramètres réservés au MJ'); return; } settingsModal(); });
Object.assign(ACT, {
  setTab: d => { setTab = d.t; settingsModal(); return false; },
  setAccent: d => { SETTINGS.accent = d.c; saveSettings(); applySettings(); settingsModal(); return false; },
  setNextSession: () => { SETTINGS.sessionNo = (+SETTINGS.sessionNo || 0) + 1; SETTINGS.sessionName = ''; saveSettings(); applySettings(); settingsModal(); toast(`Séance ${SETTINGS.sessionNo}`); return false; },
  setReset: () => { const keep = { endpoint:SETTINGS.endpoint, projectId:SETTINGS.projectId, databaseId:SETTINGS.databaseId, teamId:SETTINGS.teamId }; Object.assign(SETTINGS, SET_DEF, keep); saveSettings(); applySettings(); settingsModal(); toast('Paramètres de la table réinitialisés'); return false; },
  setTestConn: () => {
    const ep = (SETTINGS.endpoint || '').replace(/\/+$/, '');
    if (!/^https?:\/\//.test(ep)) { connResult = { ok:false, msg:'Adresse invalide (doit commencer par https://)' }; settingsModal(); return false; }
    const el = $('#connState'); if (el) el.innerHTML = '<span class="bulb"></span>Test en cours…';
    fetch(ep + '/health/version', { headers:SETTINGS.projectId ? { 'X-Appwrite-Project':SETTINGS.projectId } : {} })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { connResult = { ok:true, msg:`Connecté · Appwrite ${j.version || ''}` }; })
      .catch(err => { connResult = { ok:false, msg:`Serveur injoignable (${err.message}). Vérifie l’adresse et le CORS ; l’aperçu en ligne peut aussi bloquer la requête.` }; })
      .finally(() => { if (!$('#modal').hidden && setTab === 'conn') settingsModal(); });
    return false;
  }
});
const setField = t => {
  const k = t.dataset.set; if (!k) return;
  SETTINGS[k] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? +t.value : t.value;
  saveSettings(); applySettings();
};
document.addEventListener('input', e => { if (e.target.dataset.set && e.target.type !== 'checkbox') setField(e.target); });
document.addEventListener('change', e => { if (e.target.dataset.set) { setField(e.target); if (e.target.dataset.set === 'accent') settingsModal(); } });

/* new fields take the default visibility chosen by the GM */
[['addStat', () => C.stats], ['addFlavor', () => C.flavor], ['addFlavorWide', () => C.flavor], ['addGauge', () => C.gauges], ['addCounter', () => C.gauges]].forEach(([k, list]) => {
  const orig = ACT[k];
  ACT[k] = d => { const before = new Set(list().map(x => x.id)), r = orig(d); list().filter(x => !before.has(x.id)).forEach(x => { x.vis = SETTINGS.defaultVis; }); return r; };
});

/* players may reorganise their sheet only when the GM allows it */
const _renderSet = render;
render = function () { _renderSet(); if (!SETTINGS.allowPlayerLayout && S.viewer === 'owner') { const b = $('[data-act="layoutEdit"]'); if (b) b.remove(); } };
applySettings();
