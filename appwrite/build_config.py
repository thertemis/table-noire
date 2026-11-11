"""Build appwrite.config.json (Appwrite CLI 27.x, server 2.6.x) from the readable schema below,
and write functions/*/src/config.js with the project identifiers (public, not secrets).

    python appwrite/build_config.py      (or node tools/configure.mjs, which also configures web/)

Then, from the appwrite/ folder:  appwrite push tables · appwrite push buckets · appwrite push functions

Multi-campaign model (v2)
-------------------------
* Accounts are global. The platform admin carries the label `admin` (user management, campaign manager).
  Every invited account carries the label `member` (guard-signup deletes accounts with neither label).
* A campaign is an Appwrite **team**; the campaign row id == the team id. Team roles: `gm`, `player`.
  A user can be GM of one campaign and player in another.
* Every campaign-scoped row has `campaignId`. Row permissions are written by the client (GM) or by
  Functions and normalised by apply-visibility:
      read   team:<c> | team:<c>/gm + user:<owner> | team:<c>/gm     (visibility all / owner / gm)
      update team:<c>/gm        delete team:<c>/gm
  Table-level permissions only grant `create` to signed-in users (rows are useless without team rights)
  and full access to label:admin.
"""
import json, pathlib

HERE = pathlib.Path(__file__).parent
# Server identifiers come from tn.config.json at the repository root (see tn.config.example.json).
_CFG = json.loads((HERE.parent / 'tn.config.json').read_text(encoding='utf-8'))['appwrite']
PROJECT_ID, ENDPOINT, DATABASE_ID = _CFG['projectId'], _CFG['endpoint'], _CFG['databaseId']

ADMIN, USERS = 'label:admin', 'users'
def perms(read=(), create=(), update=(), delete=()):
    out = []
    for verb, roles in (('create', create), ('read', read), ('update', update), ('delete', delete)):
        out += [f'{verb}("{r}")' for r in roles]
    return out
ADMIN_ALL = dict(read=[ADMIN], create=[ADMIN], update=[ADMIN], delete=[ADMIN])
# Campaign tables: anyone signed in may create (GM client writes), admin sees all; rows carry team permissions.
CAMPAIGN = perms(read=[ADMIN], create=[USERS, ADMIN], update=[ADMIN], delete=[ADMIN])

# ---------- column helpers ----------
def vc(key, size=255, required=False, default=None): return dict(key=key, type='varchar', size=size, required=required, array=False, default=None if required else default)
def tx(key): return dict(key=key, type='text', required=False, array=False, default=None)
def it(key, mn=None, mx=None, default=None):
    d = dict(key=key, type='integer', required=False, array=False, default=default)
    if mn is not None: d['min'] = mn
    if mx is not None: d['max'] = mx
    return d
def bl(key, default=False): return dict(key=key, type='boolean', required=False, array=False, default=default)
def dt(key): return dict(key=key, type='datetime', required=False, array=False, default=None)
def en(key, elements, default): return dict(key=key, type='string', format='enum', elements=elements, required=False, array=False, default=default)
VIS = lambda: en('visibility', ['gm', 'owner', 'all'], 'all')
CAMP = lambda: vc('campaignId', 36, True)
def ix(key, cols, kind='key'): return dict(key=key, type=kind, columns=cols, orders=['ASC'] * len(cols))

# ---------- tables ----------
TABLES = [
    # Global
    ('campaigns', 'Campagnes', True, perms(read=[ADMIN], create=[ADMIN], update=[ADMIN], delete=[ADMIN]),
     [vc('name', 128, True), vc('gmUserId', 36), vc('description', 1000), it('sessionNo', 0, None, 0), vc('sessionName', 128),
      vc('accent', 16), it('diceMs', 1000, 10000, 5000), en('defaultVisibility', ['gm', 'owner', 'all'], 'all'),
      bl('allowPlayerLayout', True), bl('archived'), tx('equipSlots'), tx('sheetLayout'), vc('rollStat', 128), vc('rollSkill', 128), tx('initiative'), tx('reveal'), tx('loreCategories')], []),
    ('profiles', 'Profils', True, perms(read=[USERS], create=[ADMIN], update=[ADMIN], delete=[ADMIN]),
     [vc('userId', 36, True), vc('username', 64, True), vc('color', 16)], [ix('u_user', ['userId'], 'unique')]),
    # server-wide settings, one row 'global' (interface language): readable before sign-in, written by the admin only
    ('app_settings', 'Réglages du serveur', False, perms(read=['any'], create=[ADMIN], update=[ADMIN], delete=[ADMIN]),
     [en('lang', ['auto', 'fr', 'en'], 'auto')], []),
    ('invites', 'Invitations', True, perms(**ADMIN_ALL),
     [vc('token', 64, True), en('kind', ['signup', 'reset'], 'signup'), vc('userId', 36), vc('campaignId', 36),
      en('role', ['player', 'gm'], 'player'), vc('note', 128), vc('createdBy', 36), dt('expiresAt'), vc('usedBy', 36), dt('usedAt')],
     [ix('u_token', ['token'], 'unique'), ix('k_campaign', ['campaignId'])]),
    ('invite_claims', 'Invitations utilisées', False, perms(read=[ADMIN]), [vc('username', 64, True), vc('userId', 36)], [ix('k_username', ['username'])]),
    # Campaign-scoped
    ('characters', 'Personnages', True, CAMPAIGN,
     [CAMP(), vc('ownerId', 36), vc('name', 128, True), en('kind', ['pc', 'npc'], 'pc'), tx('portrait'), tx('layout'), bl('archived'),
      vc('templateId', 36), bl('inScene'), vc('displayName', 128), bl('useAlias')],   # NPC copies point to their model; NPCs are visible to players only in the scene
     [ix('k_campaign', ['campaignId']), ix('k_owner', ['ownerId'])]),
    ('player_prefs', 'Préférences joueur', True, CAMPAIGN,
     [CAMP(), vc('userId', 36, True), vc('characterId', 36), tx('layout'), tx('widgetPrefs'), tx('journal')],
     [ix('u_user_camp', ['userId', 'campaignId'], 'unique')]),
    ('field_defs', 'Bibliothèque de champs', True, CAMPAIGN,
     [CAMP(), vc('key', 64, True), vc('label', 128, True), en('kind', ['stat', 'gauge', 'counter', 'text', 'longtext', 'list', 'card'], 'text'),
      tx('config'), en('defaultVisibility', ['gm', 'owner', 'all'], 'all'), it('sort', default=0)],
     [ix('u_camp_key', ['campaignId', 'key'], 'unique')]),
    ('character_values', 'Valeurs de fiche', True, CAMPAIGN,
     [CAMP(), vc('characterId', 36, True), vc('fieldId', 36, True), tx('value'), VIS()],
     [ix('u_char_field', ['characterId', 'fieldId'], 'unique'), ix('k_campaign', ['campaignId']), ix('k_field', ['fieldId'])]),
    ('wounds', 'Blessures', True, CAMPAIGN,
     [CAMP(), vc('characterId', 36, True), vc('zone', 32, True), it('severity', 0, 4, 0), vc('type', 64), tx('description'), VIS()],
     [ix('k_char', ['characterId']), ix('k_campaign', ['campaignId'])]),
    ('item_defs', 'Catalogue d’objets', True, CAMPAIGN,
     [CAMP(), vc('name', 128, True), vc('type', 64), en('rarity', ['common', 'uncommon', 'rare', 'epic', 'legend'], 'common'),
      vc('valueLabel', 64), tx('description'), vc('art', 32), vc('artFileId', 36), vc('slot', 64), vc('modifiers', 500)], [ix('k_campaign', ['campaignId'])]),
    ('item_instances', 'Objets possédés', True, CAMPAIGN,
     [CAMP(), vc('itemDefId', 36, True), vc('characterId', 36, True), it('qty', 0, None, 1), VIS(), bl('hiddenFromPlayers'), vc('equippedSlot', 64)],
     [ix('k_char', ['characterId']), ix('k_campaign', ['campaignId'])]),
    ('skill_defs', 'Catalogue de compétences', True, CAMPAIGN,
     [CAMP(), vc('name', 128, True), vc('statFieldId', 36), it('defaultLevel', 1, 5, 1), tx('description'), vc('formula', 128)], [ix('k_campaign', ['campaignId'])]),
    ('skill_instances', 'Compétences possédées', True, CAMPAIGN,
     [CAMP(), vc('skillDefId', 36, True), vc('characterId', 36, True), it('level', 1, 5, 1), VIS(), bl('hiddenFromPlayers')],
     [ix('k_char', ['characterId']), ix('k_campaign', ['campaignId'])]),
    ('lore_articles', 'Lore', True, CAMPAIGN, [CAMP(), vc('title', 255, True), tx('bodyMd'), vc('category', 64), VIS()], [ix('k_campaign', ['campaignId'])]),
    ('maps', 'Cartes', True, CAMPAIGN,
     [CAMP(), vc('name', 128, True), vc('imageFileId', 36), it('width', 1), it('height', 1), vc('parentMapId', 36), VIS(), tx('fog'), vc('playerFileId', 36)], [ix('k_campaign', ['campaignId'])]),
    ('map_pois', 'Points d’intérêt', True, CAMPAIGN,
     [CAMP(), vc('mapId', 36, True), it('x'), it('y'), vc('label', 128), tx('description'), vc('icon', 32), vc('color', 16),
      en('targetType', ['none', 'lore', 'map'], 'none'), vc('targetId', 36), VIS()], [ix('k_map', ['mapId']), ix('k_campaign', ['campaignId'])]),
    ('map_texts', 'Textes de carte', True, CAMPAIGN,
     [CAMP(), vc('mapId', 36, True), it('x'), it('y'), vc('text', 255), it('size', 6, 200, 32), vc('color', 16), it('rotation', -180, 180, 0), VIS()],
     [ix('k_map', ['mapId']), ix('k_campaign', ['campaignId'])]),
    # drawings and pings on maps, by anyone in the campaign; created by player-action (read: campaign; delete: author + GM)
    ('map_marks', 'Dessins et pings', True, perms(**ADMIN_ALL),
     [CAMP(), vc('mapId', 36, True), en('kind', ['draw', 'ping'], 'draw'), tx('points'), vc('color', 16), it('width', 1, 60, 4),
      vc('authorId', 36), vc('authorName', 64)], [ix('k_map', ['mapId']), ix('k_campaign', ['campaignId'])]),
    # comments under lore articles, by anyone who can read the article; created by player-action (read: like the article; delete: author + GM)
    ('lore_comments', 'Commentaires du lore', True, perms(**ADMIN_ALL),
     [CAMP(), vc('articleId', 36, True), tx('body'), vc('authorId', 36), vc('authorName', 64)], [ix('k_article', ['articleId']), ix('k_campaign', ['campaignId'])]),
    # polls (GM): readable by the GMs and the chosen players (or the whole campaign); written by the admin Function
    ('polls', 'Sondages', True, perms(**ADMIN_ALL),
     [CAMP(), vc('question', 255, True), tx('options'), tx('audience'), bl('multi'), bl('anonymous'), bl('closed'), tx('tally')], [ix('k_campaign', ['campaignId'])]),
    # one vote per person and poll, written by player-action; read by the voter (and the GMs unless the poll is anonymous)
    ('poll_votes', 'Votes', True, perms(**ADMIN_ALL),
     [CAMP(), vc('pollId', 36, True), vc('userId', 36), vc('userName', 64), tx('choices')], [ix('k_campaign', ['campaignId']), ix('k_poll', ['pollId'])]),
    ('gm_notes', 'Notes MJ', True, CAMPAIGN, [CAMP(), vc('entityType', 32, True), vc('entityId', 36, True), tx('body')],
     [ix('u_entity', ['entityType', 'entityId'], 'unique'), ix('k_campaign', ['campaignId'])]),
    # sheet templates shared by every user (fields + layout of a campaign sheet); the creator owns the row
    ('sheet_templates', 'Modèles de fiche', True, perms(read=[USERS], create=[USERS], update=[ADMIN], delete=[ADMIN]),
     [vc('name', 128, True), vc('description', 1000), vc('ownerId', 36), vc('ownerName', 64), tx('fields'), tx('layout')], []),
    # GM session journal (entries readable by the GM only, or by the whole table) and value change history (GM)
    ('session_log', 'Journal de séance', True, perms(read=[ADMIN], create=[USERS], update=[ADMIN], delete=[ADMIN]),
     [CAMP(), it('sessionNo', 0), tx('body'), vc('visibility', 8), vc('authorName', 64)], [ix('k_campaign', ['campaignId'])]),
    ('change_log', 'Historique des modifications', True, perms(read=[ADMIN], create=[USERS], update=[ADMIN], delete=[ADMIN]),
     [CAMP(), vc('characterId', 36), vc('fieldId', 36), vc('label', 128), vc('before', 1000), vc('after', 1000), vc('userName', 64)], [ix('k_char', ['characterId']), ix('k_campaign', ['campaignId'])]),
    # private paginated notebook of each user (rows readable by their author only)
    ('notebook_pages', 'Carnets de notes', True, perms(create=[USERS]),
     [CAMP(), vc('userId', 36, True), it('sort'), vc('title', 128), tx('body')], [ix('k_user_camp', ['userId', 'campaignId'])]),
    ('dice_rolls', 'Journal de dés', True, perms(read=[ADMIN]),
     [CAMP(), vc('userId', 36, True), vc('username', 64), vc('characterId', 36), vc('characterName', 128), vc('formula', 255, True), tx('detail'), it('total')],
     [ix('k_campaign', ['campaignId'])]),
]

BUCKETS = [
    ('portraits', 'Portraits', 5_000_000),
    ('item-art', 'Illustrations d’objets', 5_000_000),
    ('lore-images', 'Images de lore', 15_000_000),
    ('maps', 'Cartes', 30_000_000),   # server limit (_APP_STORAGE_LIMIT) is 30 MB
]

# Rows whose read permissions follow a `visibility` column (apply-visibility).
VIS_TABLES = ['character_values', 'wounds', 'item_instances', 'skill_instances', 'lore_articles', 'maps', 'map_pois', 'map_texts']
# Campaign rows that are always readable by the whole campaign (apply-visibility just normalises them).
TEAM_TABLES = ['characters', 'field_defs', 'item_defs', 'skill_defs']
# GM-only rows.
GM_TABLES = ['gm_notes']
WATCHED = VIS_TABLES + TEAM_TABLES + GM_TABLES

FUNCTIONS = [
    ('redeem-invite', ['any'], [], 30, ['users.read', 'users.write', 'teams.read', 'teams.write', 'rows.read', 'rows.write']),
    ('admin', [USERS], [], 120, ['users.read', 'users.write', 'teams.read', 'teams.write', 'rows.read', 'rows.write', 'files.read', 'files.write']),
    ('roll-dice', [USERS], [], 15, ['users.read', 'teams.read', 'rows.read', 'rows.write']),
    ('player-action', [USERS], [], 15, ['teams.read', 'rows.read', 'rows.write']),
    ('apply-visibility', [], [f'databases.{DATABASE_ID}.tables.{t}.rows.*.{e}' for t in WATCHED for e in ('create', 'update')], 15, ['rows.read', 'rows.write', 'files.read', 'files.write']),
    ('guard-signup', [], ['users.*.create'], 45, ['users.read', 'users.write']),
    # image search for portraits / item art: Pixabay (key in the PIXABAY_KEY variable, set in the console) and DuckDuckGo
    ('image-search', [USERS], [], 20, []),
]

cfg = {
    'projectId': PROJECT_ID,
    'endpoint': ENDPOINT,
    'projectName': 'Table Noire',
    'tablesDB': [{'$id': DATABASE_ID, 'name': 'main', 'enabled': True}],
    'tables': [{'$id': tid, '$permissions': p, 'databaseId': DATABASE_ID, 'name': name, 'enabled': True, 'rowSecurity': rs, 'columns': cols, 'indexes': idx}
               for tid, name, rs, p, cols, idx in TABLES],
    'buckets': [{'$id': bid, '$permissions': perms(read=[ADMIN], create=[USERS, ADMIN], update=[ADMIN], delete=[ADMIN]), 'fileSecurity': True, 'name': name, 'enabled': True,
                 'maximumFileSize': size, 'allowedFileExtensions': ['png', 'jpg', 'jpeg', 'webp'], 'compression': 'none', 'encryption': True, 'antivirus': False}
                for bid, name, size in BUCKETS],
    'functions': [{'$id': fid, 'name': fid, 'runtime': 'node-22', 'execute': ex, 'events': ev, 'schedule': '', 'timeout': to, 'enabled': True, 'logging': True,
                   'entrypoint': 'src/main.js', 'commands': 'npm install', 'path': f'functions/{fid}', 'scopes': sc}
                  for fid, ex, ev, to, sc in FUNCTIONS],
}
(HERE / 'appwrite.config.json').write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

shared = f"""// Généré par build_config.py — identifiants publics du projet (pas des secrets).
export const DATABASE_ID = '{DATABASE_ID}';
export const PUBLIC_ENDPOINT = '{ENDPOINT}';
export const VIS_TABLES = {json.dumps(VIS_TABLES)};
export const TEAM_TABLES = {json.dumps(TEAM_TABLES)};
export const GM_TABLES = {json.dumps(GM_TABLES)};
export const CAMPAIGN_TABLES = {json.dumps([t[0] for t in TABLES if any(c['key'] == 'campaignId' for c in t[4])])};
"""
for fid, *_ in FUNCTIONS:
    d = HERE / 'functions' / fid / 'src'
    d.mkdir(parents=True, exist_ok=True)
    (d / 'config.js').write_text(shared, encoding='utf-8')
print(f'appwrite.config.json : {len(TABLES)} tables, {len(BUCKETS)} buckets, {len(FUNCTIONS)} functions')
