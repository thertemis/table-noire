/* polls.js — polls.
   The GM creates a poll (question, answers, one or several choices, anonymous or not) for the whole campaign or for
   chosen players, closes / reopens or deletes it (admin Function: only it can grant reading to given players).
   Players see the polls meant for them (a "Sondages" button in the header shows how many wait for their vote), vote
   once and may change their vote while the poll is open (player-action "vote"). The poll row keeps the tally; a vote
   row is readable by its voter, and by the GMs unless the poll is anonymous. Shared live. */

const POLL = { list: [], votes: [], unsub: null, members: null, form: false };
const pollOpts = p => { try { return JSON.parse(p.options || '[]'); } catch (_) { return []; } };
const pollTally = p => { try { return JSON.parse(p.tally || '{}'); } catch (_) { return {}; } };
// an anonymous vote has no user id: a player only ever reads their own, so it is theirs
const myVote = p => { const v = POLL.votes.find(x => x.pollId === p.$id && (x.userId === ME.user.$id || (!x.userId && p.anonymous && ME.role !== 'gm' && !ME.isAdmin))); try { return v ? JSON.parse(v.choices || '[]') : null; } catch (_) { return null; } };
const pendingPolls = () => POLL.list.filter(p => !p.closed && !myVote(p) && (ME.role !== 'gm'));

async function loadPolls() {
  if (!ME.camp) return;
  const c = ME.camp.$id;
  [POLL.list, POLL.votes] = await Promise.all([rows('polls', [AW.Q.equal('campaignId', c)]).catch(() => []), rows('poll_votes', [AW.Q.equal('campaignId', c)]).catch(() => [])]);
  POLL.list.sort((a, b) => (a.closed - b.closed) || b.$createdAt.localeCompare(a.$createdAt));
  renderHeader();
  if (!$('#modal').hidden && $('#modalBox .polls')) pollsModal();
}
const _enterPolls = enterCampaign;
enterCampaign = async function (id) {
  await _enterPolls(id);
  if (!ME.camp) return;
  await loadPolls();
  if (POLL.unsub) POLL.unsub();
  POLL.unsub = AW.c.subscribe(['polls', 'poll_votes'].map(t => `tablesdb.${TN.db}.tables.${t}.rows`), ev => {
    if (!ev.payload || !ME.camp || ev.payload.campaignId !== ME.camp.$id) return;
    clearTimeout(POLL.t); POLL.t = setTimeout(loadPolls, 300);
  });
};
const _leavePolls = leaveCampaign;
leaveCampaign = function () { if (POLL.unsub) { POLL.unsub(); POLL.unsub = null; } POLL.list = []; POLL.votes = []; POLL.members = null; _leavePolls(); };

// header: the polls button (with the number waiting for this player's vote)
const _renderHeaderPolls = renderHeader;
renderHeader = function () {
  _renderHeaderPolls();
  if (!ME.camp || (!POLL.list.length && ME.role !== 'gm')) return;
  const n = pendingPolls().length;
  $('#adminSlot')?.insertAdjacentHTML('afterbegin', `<button class="btn ${n ? 'orange' : ''}" data-act="pollsOpen">${ic('ticket')}Sondages${n ? ` <b class="poll-badge">${n}</b>` : ''}</button>`);
};
// GM tools hub
const _gmHubPolls = ACT.gmHub;
ACT.gmHub = d => { const r = _gmHubPolls(d); $('#modalBox .hub')?.insertAdjacentHTML('beforeend', `<button class="hub-tool" data-act="pollsOpen"><span class="hub-ico">${ic('ticket', 18)}</span><b>Sondages</b><small>Créer, fermer, résultats</small></button>`); return r; };

function pollHtml(p) {
  const opts = pollOpts(p), t = pollTally(p), counts = t.counts || {}, voters = t.voters || 0, mine = myVote(p), gm = ME.role === 'gm';
  const audience = (() => { try { return JSON.parse(p.audience || '[]'); } catch (_) { return []; } })();
  const forMe = !audience.length || audience.includes(ME.user.$id) || gm;
  const showResults = gm || p.closed || mine;
  const canVote = !p.closed && forMe;
  const who = audience.length ? audience.map(id => ME.names[id] || '?').join(', ') : 'Tous les joueurs';
  const votersOf = id => gm && !p.anonymous ? POLL.votes.filter(v => v.pollId === p.$id && JSON.parse(v.choices || '[]').includes(id)).map(v => v.userName || ME.names[v.userId] || '?') : [];
  return `<article class="poll well ${p.closed ? 'closed' : ''}"><div class="poll-head"><b>${esc(p.question)}</b><span class="grow"></span>
      ${p.closed ? '<span class="chip">Fermé</span>' : '<span class="chip on">Ouvert</span>'}${p.anonymous ? '<span class="chip">Anonyme</span>' : ''}${p.multi ? '<span class="chip">Plusieurs choix</span>' : ''}</div>
    ${gm ? `<p class="hint" style="margin:0">Pour : ${esc(who)} · ${voters} vote${voters > 1 ? 's' : ''}</p>` : ''}
    <form class="poll-form" data-poll="${p.$id}">${opts.map(o => { const n = counts[o.id] || 0, pc = voters ? Math.round(n / voters * 100) : 0, names = votersOf(o.id);
      return `<label class="poll-opt ${mine && mine.includes(o.id) ? 'mine' : ''}">${canVote ? `<input type="${p.multi ? 'checkbox' : 'radio'}" name="c" value="${o.id}" ${mine && mine.includes(o.id) ? 'checked' : ''}>` : ''}
        <span class="po-label">${esc(o.label)}</span>${showResults ? `<span class="po-bar" style="--pc:${pc}%"></span><span class="po-n">${n} · ${pc} %</span>` : ''}
        ${names.length ? `<small class="po-who">${esc(names.join(', '))}</small>` : ''}</label>`; }).join('')}
      ${canVote ? `<div class="edit-row"><span class="hint">${mine ? 'Tu peux changer ton vote tant que le sondage est ouvert.' : ''}</span><span class="grow"></span><button class="btn xs orange" type="submit">${mine ? 'Changer mon vote' : 'Voter'}</button></div>` : ''}</form>
    ${gm ? `<div class="edit-row"><span class="grow"></span><button class="btn xs" data-act="pollClose" data-id="${p.$id}">${p.closed ? 'Rouvrir' : 'Fermer'}</button>
      <button class="iconbtn" data-act="pollDel" data-id="${p.$id}" aria-label="Supprimer le sondage">${ic('trash', 12)}</button></div>` : ''}</article>`;
}
async function pollsModal() {
  const gm = ME.role === 'gm';
  if (gm && !POLL.members) POLL.members = await admin('listMembers', { campaignId: ME.camp.$id }).then(r => r.members.filter(m => !(m.roles || []).includes('gm'))).catch(() => []);
  const form = gm && POLL.form ? `<form class="form poll-new well" id="pollNew">
      <label class="full">Question<input class="field" name="question" maxlength="255" required placeholder="ex. On joue samedi ?"></label>
      <label class="full">Réponses (une par ligne)<textarea class="field" name="options" rows="4" required placeholder="Oui&#10;Non&#10;Peut-être"></textarea></label>
      <label class="chk"><input type="checkbox" name="multi">Plusieurs choix possibles</label>
      <label class="chk"><input type="checkbox" name="anonymous">Vote anonyme (personne ne voit qui a voté quoi)</label>
      <fieldset class="full poll-aud"><legend>Qui peut voir et voter</legend><label class="chk"><input type="checkbox" name="all" checked>Tous les joueurs</label>
        ${(POLL.members || []).map(m => `<label class="chk"><input type="checkbox" name="u" value="${esc(m.userId)}">${esc(m.name || ME.names[m.userId] || '?')}</label>`).join('')}</fieldset>
      <div class="modal-acts full"><button type="button" class="btn" data-act="pollForm">Annuler</button><button class="btn orange" type="submit">Créer le sondage</button></div></form>` : '';
  openModal(`<h3>Sondages</h3>${gm && !POLL.form ? `<div class="edit-row"><button class="btn orange" data-act="pollForm">${ic('plus')}Nouveau sondage</button></div>` : ''}${form}
    <div class="polls">${POLL.list.length ? POLL.list.map(pollHtml).join('') : '<p class="hint">Aucun sondage pour l’instant.</p>'}</div>
    <div class="modal-acts"><span class="grow"></span><button class="btn" data-act="closeModal">Fermer</button></div>`);
  $('#modalBox').classList.add('wide');
}
Object.assign(ACT, {
  pollsOpen: () => { POLL.form = false; pollsModal(); return false; },
  pollForm: () => { POLL.form = !POLL.form; pollsModal(); return false; },
  pollClose: d => { const p = POLL.list.find(x => x.$id === d.id); if (p) admin('pollSave', { campaignId: ME.camp.$id, pollId: p.$id, closed: !p.closed, audience: JSON.parse(p.audience || '[]') }).then(loadPolls).catch(e => toast(errMsg(e))); return false; },
  pollDel: d => {
    const p = POLL.list.find(x => x.$id === d.id); if (!p || !confirm(`Supprimer le sondage « ${p.question} » et ses votes ?`)) return false;
    admin('pollDelete', { pollId: p.$id }).then(loadPolls).catch(e => toast('Suppression impossible : ' + errMsg(e)));
    return false;
  },
});
document.addEventListener('change', e => {   // "all players" and individual players exclude each other
  const f = e.target.closest && e.target.closest('#pollNew'); if (!f) return;
  if (e.target.name === 'all' && e.target.checked) f.querySelectorAll('[name=u]').forEach(x => (x.checked = false));
  if (e.target.name === 'u' && e.target.checked) f.all.checked = false;
});
document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.id === 'pollNew') {
    e.preventDefault(); e.stopImmediatePropagation();
    const audience = f.all.checked ? [] : [...f.querySelectorAll('[name=u]:checked')].map(x => x.value);
    if (!f.all.checked && !audience.length) { toast('Choisis au moins un joueur, ou « Tous les joueurs ».'); return; }
    try {
      await admin('pollSave', { campaignId: ME.camp.$id, question: f.question.value, options: f.options.value.split('\n'), multi: f.multi.checked, anonymous: f.anonymous.checked, audience });
      POLL.form = false; await loadPolls(); pollsModal(); toast('Sondage créé');
    } catch (err) { toast('Sondage non créé : ' + errMsg(err)); }
    return;
  }
  if (f.classList && f.classList.contains('poll-form')) {
    e.preventDefault(); e.stopImmediatePropagation();
    const choices = [...f.querySelectorAll('[name=c]:checked')].map(x => x.value);
    if (!choices.length) { toast('Choisis une réponse.'); return; }
    try { await call('player-action', { action: 'vote', pollId: f.dataset.poll, choices }); await loadPolls(); toast('Vote enregistré'); }
    catch (err) { toast('Vote impossible : ' + errMsg(err)); }
  }
}, true);

const pollCss = document.createElement('style');
pollCss.textContent = `
.poll-badge{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#1b1a17;color:var(--cream);font:600 11px var(--f-mono)}
.polls{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.poll{padding:12px;border-radius:8px;display:flex;flex-direction:column;gap:8px}
.poll.closed{opacity:.8}
.poll-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.poll-head b{font:600 15px var(--f-body)}
.chip.on{color:var(--olive)}
.poll-form{display:flex;flex-direction:column;gap:6px}
.poll-opt{position:relative;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;background:#22201c;cursor:pointer;overflow:hidden}
.poll-opt.mine{box-shadow:inset 0 0 0 1px var(--orange)}
.poll-opt .po-label{position:relative;z-index:1}
.poll-opt .po-bar{position:absolute;inset:0 auto 0 0;width:var(--pc);background:rgba(226,103,44,.18);pointer-events:none}
.poll-opt .po-n{position:relative;z-index:1;font:500 11px var(--f-mono);color:var(--mute);grid-column:3}
.poll-opt .po-who{grid-column:1/-1;position:relative;z-index:1;color:var(--mute)}
.poll-opt input{position:relative;z-index:1;accent-color:var(--orange)}
.poll-new{padding:12px;border-radius:8px;margin-top:8px}
.poll-new .chk,.poll-aud .chk{display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font:13px var(--f-body);color:var(--ink)}
.poll-aud{border:1px solid rgba(255,240,215,.08);border-radius:6px;padding:8px 10px;display:flex;flex-wrap:wrap;gap:6px 16px}
.poll-aud legend{font:500 10px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute);padding:0 4px}`;
document.head.appendChild(pollCss);
