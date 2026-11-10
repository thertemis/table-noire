/* rolls.js — rolls started from the sheet, and secret rolls.
   - Click a statistic dial, or "Lancer" on an owned skill card: the dice roller rolls the campaign's formula
     and the shared log shows what it was for ("Crochetage · AGI").
   - Formulas are campaign settings (Jeu & joueurs): placeholders {val} (stat value), {mod} = floor((val - 10) / 2),
     {niv} (skill level). Defaults: stat 1d20+{mod}, skill 1d20+{mod}+{niv}.
   - "Secret" in the roller: the roll is only seen by the campaign's GMs and the roller (roll-dice secret). */

SET_DEF.rollStat = '1d20+{mod}'; SET_DEF.rollSkill = '1d20+{mod}+{niv}';
if (!SETTINGS.rollStat) SETTINGS.rollStat = SET_DEF.rollStat;
if (!SETTINGS.rollSkill) SETTINGS.rollSkill = SET_DEF.rollSkill;

// campaign <-> settings mapping for the two formulas (campaign.js handles the other settings)
const _fromCampRolls = settingsFromCamp;
settingsFromCamp = function () {
  if (ME.camp) { SETTINGS.rollStat = ME.camp.rollStat || SET_DEF.rollStat; SETTINGS.rollSkill = ME.camp.rollSkill || SET_DEF.rollSkill; }
  _fromCampRolls();
};
const _toCampRolls = campFromSettings;
campFromSettings = () => ({ ..._toCampRolls(), rollStat: String(SETTINGS.rollStat || '').slice(0, 128), rollSkill: String(SETTINGS.rollSkill || '').slice(0, 128) });

const _settingsModalRolls = settingsModal;
settingsModal = function () {
  _settingsModalRolls();
  if (setTab !== 'play') return;
  $('#modalBox .setpane .form')?.insertAdjacentHTML('beforeend', `
    <label>Formule d’un test de statistique<input class="field" data-set="rollStat" value="${esc(SETTINGS.rollStat)}" spellcheck="false"></label>
    <label>Formule d’un test de compétence<input class="field" data-set="rollSkill" value="${esc(SETTINGS.rollSkill)}" spellcheck="false"></label>
    <p class="setnote full" style="grid-column:1/-1">{val} = valeur de la statistique, {mod} = (valeur − 10) ÷ 2 arrondi en dessous, {niv} = niveau de la compétence. Exemples : 1d20+{mod} · 1d100 · {val}d6 · 1d20+{mod}+{niv}.</p>`);
};

function rollFormula(tpl, vars) {
  return String(tpl || '').replace(/\{(val|mod|niv)\}/g, (m, k) => String(vars[k] ?? 0))
    .replace(/\+\s*-/g, '-').replace(/-\s*-/g, '+').replace(/-\s*\+/g, '-').replace(/\+\s*0(?!\d|d)/g, '').trim();
}
const modOf = v => Math.floor(((+v || 0) - 10) / 2);
async function sheetRoll(label, formula) {
  if (!ME.camp) return;
  if (typeof rolling !== 'undefined' && rolling) { toast('Un lancer est déjà en cours.'); return; }
  if (!isGmHere() && S.viewer !== 'owner') return;
  dF.value = formula; dF.dispatchEvent(new Event('input', { bubbles: true }));
  ONLINE.next = { label, charId: SH.charId };
  if (matchMedia('(max-width:1100px)').matches && typeof toggleDock === 'function') toggleDock(true);
  roll();
}

/* stats: the dials become buttons */
const _renderRolls = render;
render = function () {
  _renderRolls();
  if (S.tab !== 'fiche' || S.statEdit || !ME.camp || (!isGmHere() && S.viewer !== 'owner')) return;
  const stats = C.stats.filter(s => canSee(s.vis));
  document.querySelectorAll('[data-tile="stats"] .dial').forEach((d, i) => {
    const s = stats[i]; if (!s) return;
    d.dataset.rollStat = s.id; d.classList.add('rollable'); d.title = `Lancer un test de ${s.name}`; d.tabIndex = 0; d.setAttribute('role', 'button');
  });
};
document.addEventListener('click', e => {
  const d = e.target.closest && e.target.closest('.dial[data-roll-stat]'); if (!d) return;
  const s = C.stats.find(x => x.id === d.dataset.rollStat); if (!s) return;
  sheetRoll(`${s.name}`, rollFormula(SETTINGS.rollStat, { val: s.value, mod: modOf(s.value) }));
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.dial[data-roll-stat]')) { e.preventDefault(); e.target.click(); } });

/* skills: "Lancer" on owned cards */
const _skillHtmlRolls = skillHtml;
skillHtml = function (def, own, lib) {
  const html = _skillHtmlRolls(def, own, lib);
  if (!own || !ME.camp || (!isGmHere() && S.viewer !== 'owner')) return html;
  return html.replace('<div class="sk-foot">', `<div class="sk-foot"><button class="btn xs orange" data-act="rollSkill" data-id="${def.id}">${ic('d20', 12)}Lancer</button>`);
};
ACT.rollSkill = d => {
  const k = SKILLS.find(x => x.id === d.id); if (!k) return false;
  const st = C.stats.find(s => s.abbr === k.stat);
  sheetRoll(`${k.name}${k.stat ? ' · ' + k.stat : ''}`, rollFormula(SETTINGS.rollSkill, { val: st ? st.value : 10, mod: st ? modOf(st.value) : 0, niv: k.level || 1 }));
  return false;
};

/* the "Secret" toggle in the roller */
$('#dFormula').closest('.frow').insertAdjacentHTML('afterend', `<label class="dsecret" title="Visible seulement par le MJ et toi"><input type="checkbox" id="dSecret"><span>Lancer secret</span></label>`);
const rollCss = document.createElement('style');
rollCss.textContent = `
.dial.rollable{cursor:pointer;transition:transform .08s,box-shadow .15s}
.dial.rollable:hover{box-shadow:inset 0 0 0 1px var(--orange)}
.dial.rollable:active{transform:translateY(1px)}
.dsecret{display:flex;align-items:center;gap:7px;font:500 11px var(--f-mono);letter-spacing:.06em;color:var(--mute);cursor:pointer;margin-top:-2px}
.dsecret input{accent-color:var(--orange)}
.dsecret:has(input:checked){color:var(--orange-hi)}
#dLog li.secret{box-shadow:inset 0 0 0 1px rgba(184,69,47,.55),inset 0 1px 3px rgba(0,0,0,.5)}`;
document.head.appendChild(rollCss);

/* the shared log marks secret rolls */
const _renderLogRolls = renderLog;
renderLog = function () { _renderLogRolls(); const lis = document.querySelectorAll('#dLog li'); LOG.slice(0, 60).forEach((l, i) => lis[i]?.classList.toggle('secret', !!l.secret)); };
