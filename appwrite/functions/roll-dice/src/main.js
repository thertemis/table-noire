// roll-dice — server-side dice roll, written to the campaign's shared log (realtime).
// Executable by signed-in users who belong to the campaign. Body: { "campaignId", "characterId"?, "formula", "label"?, "secret"? }
import { randomInt } from 'node:crypto';
import { Client, TablesDB, Users, Teams, Permission, Role, ID, Query } from 'node-appwrite';
import { DATABASE_ID } from './config.js';

// Same grammar as the client: NdF, d%, + - * /, parentheses, unary minus. Division is floored.
function parse(src) {
  const tk = []; let i = 0; const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/\d/.test(c)) { let j = i; while (j < s.length && /\d/.test(s[j])) j++; tk.push({ t: 'n', v: +s.slice(i, j) }); i = j; continue; }
    if (c === 'd' || c === 'D') { if (s[i + 1] === '%') { tk.push({ t: 'd' }, { t: 'n', v: 100 }); i += 2; } else { tk.push({ t: 'd' }); i++; } continue; }
    if ('+-*/()'.includes(c)) { tk.push({ t: c }); i++; continue; }
    throw new Error(`Caractère inattendu « ${c} »`);
  }
  let p = 0;
  const peek = () => tk[p], eat = t => { if (tk[p] && tk[p].t === t) return tk[p++]; throw new Error('Formule incomplète'); };
  const dice = (n, f) => { if (n < 1 || n > 100) throw new Error('Entre 1 et 100 dés par groupe'); if (f < 2 || f > 1000) throw new Error('Un dé a entre 2 et 1000 faces'); return { t: 'dice', n, f }; };
  function expr() { let a = term(); while (peek() && (peek().t === '+' || peek().t === '-')) { const op = tk[p++].t; a = { t: 'bin', op, a, b: term() }; } return a; }
  function term() { let a = factor(); while (peek() && (peek().t === '*' || peek().t === '/')) { const op = tk[p++].t; a = { t: 'bin', op, a, b: factor() }; } return a; }
  function factor() { if (peek() && peek().t === '-') { p++; return { t: 'neg', a: factor() }; } return primary(); }
  function primary() {
    const k = peek(); if (!k) throw new Error('Formule incomplète');
    if (k.t === '(') { p++; const e = expr(); eat(')'); return { t: 'grp', a: e }; }
    if (k.t === 'd') { p++; return dice(1, eat('n').v); }
    if (k.t === 'n') { p++; if (peek() && peek().t === 'd') { p++; return dice(k.v, eat('n').v); } return { t: 'num', v: k.v }; }
    throw new Error('Symbole inattendu');
  }
  if (!tk.length) throw new Error('Formule vide');
  const ast = expr(); if (p < tk.length) throw new Error('Symbole inattendu');
  return ast;
}
function evaluate(ast) {
  const rolls = []; let count = 0;
  const go = n => {
    switch (n.t) {
      case 'num': return { v: n.v, s: String(n.v) };
      case 'dice': {
        count += n.n; if (count > 200) throw new Error('Maximum 200 dés par lancer');
        const r = Array.from({ length: n.n }, () => randomInt(1, n.f + 1));   // CSPRNG, unbiased
        rolls.push({ faces: n.f, values: r });
        return { v: r.reduce((a, b) => a + b, 0), s: `${n.n}d${n.f}[${r.join(',')}]` };
      }
      case 'grp': { const a = go(n.a); return { v: a.v, s: `(${a.s})` }; }
      case 'neg': { const a = go(n.a); return { v: -a.v, s: `−${a.s}` }; }
      case 'bin': {
        const a = go(n.a), b = go(n.b);
        if (n.op === '/' && b.v === 0) throw new Error('Division par zéro');
        const v = n.op === '+' ? a.v + b.v : n.op === '-' ? a.v - b.v : n.op === '*' ? a.v * b.v : Math.floor(a.v / b.v);
        return { v, s: `${a.s} ${{ '+': '+', '-': '−', '*': '×', '/': '÷' }[n.op]} ${b.s}` };
      }
    }
  };
  const r = go(ast);
  return { total: r.v, text: r.s, rolls };
}

export default async ({ req, res }) => {
  const userId = req.headers['x-appwrite-user-id'];
  if (!userId) return res.json({ ok: false, message: 'Connexion requise.' }, 401);
  let b;
  try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { return res.json({ ok: false, message: 'Requête illisible.' }, 400); }
  const formula = String(b.formula || '').slice(0, 200), campaignId = String(b.campaignId || '');
  // label: what the roll is for ("Crochetage · AGI"); secret: hidden from the other players
  const label = String(b.label || '').slice(0, 80), secret = b.secret === true;
  if (!campaignId) return res.json({ ok: false, message: 'Campagne manquante.' }, 400);

  let result;
  try { result = evaluate(parse(formula)); } catch (e) { return res.json({ ok: false, message: e.message }, 400); }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);
  const db = new TablesDB(client);
  const user = await new Users(client).get({ userId });
  const isAdmin = (user.labels || []).includes('admin');
  const m = await new Teams(client).listMemberships({ teamId: campaignId, queries: [Query.equal('userId', userId)] }).catch(() => null);
  const roles = m?.memberships?.[0]?.roles || [];
  if (!roles.length && !isAdmin) return res.json({ ok: false, message: 'Tu ne fais pas partie de cette campagne.' }, 403);
  const isGm = isAdmin || roles.includes('gm');

  let characterId = null, characterName = isGm ? 'MJ' : user.name;
  if (b.characterId) {
    const ch = await db.getRow({ databaseId: DATABASE_ID, tableId: 'characters', rowId: String(b.characterId) }).catch(() => null);
    if (!ch || ch.campaignId !== campaignId) return res.json({ ok: false, message: 'Personnage introuvable.' }, 404);
    if (ch.ownerId !== userId && !isGm) return res.json({ ok: false, message: 'Ce personnage n’est pas le tien.' }, 403);
    characterId = ch.$id; characterName = ch.name;
  }

  const row = await db.createRow({
    databaseId: DATABASE_ID, tableId: 'dice_rolls', rowId: ID.unique(),
    data: { campaignId, userId, username: user.name, characterId, characterName, formula, total: result.total,
      detail: JSON.stringify({ text: result.text, rolls: result.rolls, label, secret }) },
    // a secret roll is only seen by the GMs of the campaign and the roller
    permissions: secret ? [Permission.read(Role.team(campaignId, 'gm')), Permission.read(Role.user(userId))] : [Permission.read(Role.team(campaignId))],
  });
  return res.json({ ok: true, id: row.$id, total: result.total, text: result.text, rolls: result.rolls, characterName, label, secret });
};
