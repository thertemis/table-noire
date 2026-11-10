"""Build a self-contained Portainer stack for Appwrite (PostgreSQL, combined workers).

Usage:
    python make_stack.py appwrite.mondomaine.fr [--http-port 8880] [--https-port 8443] [--email noreply@mondomaine.fr]

Reads base/compose.base.yml + base/env.base (Appwrite's official compose data) and writes
portainer-stack.yml where:
  - every environment variable is embedded (one YAML anchor shared by the Appwrite services),
  - values are switched to production for a server behind Nginx Proxy Manager,
  - fresh random secrets are generated (run once and keep the result: changing
    _APP_OPENSSL_KEY_V1 later makes existing data unreadable),
  - the ClickHouse config files are inlined as compose `configs`, so no file is needed on the host.

The output contains secrets: it is git-ignored, store it in your password manager / Portainer only.
"""
import argparse, pathlib, re, secrets, string

HERE = pathlib.Path(__file__).parent
BASE = HERE / 'base'

ap = argparse.ArgumentParser()
ap.add_argument('domain', help='sous-domaine public d\'Appwrite, ex. appwrite.mondomaine.fr')
ap.add_argument('--http-port', default='8880', help='port du NAS vers lequel Nginx Proxy Manager transfère le trafic')
ap.add_argument('--https-port', default='8443', help='port HTTPS interne de Traefik (inutilisé derrière NPM, doit juste être libre)')
ap.add_argument('--mqtt-port', default='8883')
ap.add_argument('--mqtt-wss-port', default='8084')
ap.add_argument('--nas-ip', default='IP_DU_NAS', help='IP locale du NAS (sert seulement aux commentaires / NPM)')
ap.add_argument('--email', default=None, help='adresse d\'expéditeur système (défaut : noreply@<domaine parent>)')
ap.add_argument('--out', default=str(HERE / 'portainer-stack.yml'))
a = ap.parse_args()

domain = re.sub(r'^https?://', '', a.domain.strip().lower()).strip('/')
parent = domain.split('.', 1)[1] if domain.count('.') >= 2 else domain
alnum = string.ascii_letters + string.digits
rnd = lambda n=48: ''.join(secrets.choice(alnum) for _ in range(n))

# ---------- environment ----------
env = {}
for line in (BASE / 'env.base').read_text(encoding='utf-8').splitlines():
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        env[k.strip()] = v

env.update({
    '_APP_ENV': 'production',
    '_APP_LOCALE': 'fr',
    '_APP_DOMAIN': domain,
    '_APP_CONSOLE_DOMAIN': domain,
    '_APP_CONSOLE_HOSTNAMES': domain,
    '_APP_CONSOLE_URL': '',
    '_APP_CONSOLE_TRUSTED_PROJECTS': '',
    '_APP_CONSOLE_COUNTRIES_DENYLIST': '',
    '_APP_CONSOLE_WHITELIST_ROOT': 'enabled',      # only the first account may administrate the console
    '_APP_DOMAIN_TARGET_CNAME': domain,
    '_APP_DOMAIN_TARGET_A': '',
    '_APP_DOMAIN_TARGET_AAAA': '',
    '_APP_DOMAIN_FUNCTIONS': f'functions.{parent}',
    '_APP_DOMAIN_SITES': f'sites.{parent}',
    '_APP_OPTIONS_FORCE_HTTPS': 'disabled',        # TLS is terminated (and forced) by Nginx Proxy Manager
    '_APP_OPTIONS_ROUTER_FORCE_HTTPS': 'disabled',
    '_APP_DNS': '8.8.8.8',
    '_APP_HTTP_PORT': a.http_port,
    '_APP_HTTPS_PORT': a.https_port,
    '_APP_MQTT_PORT': a.mqtt_port,
    '_APP_MQTT_WSS_PORT': a.mqtt_wss_port,
    '_APP_SMTP_HOST': '',                          # no mail server: Table Noire does not send e-mails
    '_APP_SMTP_PORT': '',
    '_APP_SMTP_USERNAME': '',
    '_APP_SMTP_PASSWORD': '',
    '_APP_SYSTEM_EMAIL_NAME': 'Appwrite',
    '_APP_SYSTEM_EMAIL_ADDRESS': a.email or f'noreply@{parent}',
    '_APP_SYSTEM_TEAM_EMAIL': a.email or f'noreply@{parent}',
    '_APP_EMAIL_SECURITY': a.email or f'noreply@{parent}',
    '_APP_EMAIL_CERTIFICATES': a.email or f'noreply@{parent}',
    '_APP_DB_USER': 'appwrite',
    '_APP_PWNED_PASSWORDS_DSN': 'none://localhost',
})
for k in ['_APP_OPENSSL_KEY_V1', '_APP_EXECUTOR_SECRET', '_APP_JOBS_SECRET', '_APP_DB_PASS', '_APP_DB_ROOT_PASS',
          '_APP_USAGE_PASS', '_APP_GEO_SECRET', '_APP_NOTIFICATIONS_TRACKING_SECRET',
          '_APP_VCS_GITHUB_WEBHOOK_SECRET', '_APP_VCS_GITEA_WEBHOOK_SECRET']:
    if k in env:
        env[k] = rnd(64 if k == '_APP_OPENSSL_KEY_V1' else 40)

esc = lambda v: v.replace('$', '$$')                       # compose interpolates "$"
yq = lambda v: '"' + esc(v).replace('\\', '\\\\').replace('"', '\\"') + '"'

# ---------- compose ----------
src = (BASE / 'compose.base.yml').read_text(encoding='utf-8')
# 1. ${VAR} / ${VAR:-default} interpolations -> literal values (leave $${...} runtime escapes alone)
def interp(m):
    name, default = m.group(1), m.group(2)
    return esc(env[name]) if name in env else (default or '')
src = re.sub(r'(?<!\$)\$\{([A-Z0-9_]+)(?::-([^}]*))?\}', interp, src)
src = re.sub(r'(?<!\$)\$([A-Z_][A-Z0-9_]*)', lambda m: esc(env.get(m.group(1), '')), src)   # unbraced $VAR

# 2. environment blocks
lines, out, i = src.split('\n'), [], 0
while i < len(lines):
    line = lines[i]
    m = re.match(r'^(\s+)environment:\s*$', line)
    if not m:
        out.append(line); i += 1; continue
    ind = m.group(1); items = []; j = i + 1
    while j < len(lines) and (re.match(rf'^{ind}  - ', lines[j]) or re.match(rf'^{ind}  #', lines[j])):
        if lines[j].strip().startswith('- '): items.append(lines[j].strip()[2:])
        j += 1
    passthrough = [it for it in items if '=' not in it]
    if not passthrough:                      # third-party service with fixed values: keep as is
        out.extend(lines[i:j])
    else:                                    # Appwrite service: shared values + its own fixed overrides
        out.append(line)
        out.append(f'{ind}  <<: *appwrite-env')
        for it in items:
            if '=' in it:
                k, v = it.split('=', 1)
                out.append(f'{ind}  {k}: "{v}"')
    i = j
src = '\n'.join(out)

# 2b. annotate the published ports (traefik)
for port, inner, note in [(a.http_port, '80', f'port NPM (= _APP_HTTP_PORT) : NPM transfère vers {a.nas_ip}:{a.http_port}'),
                          (a.https_port, '443', 'HTTPS interne inutilisé (= _APP_HTTPS_PORT), port libre'),
                          (a.mqtt_port, '8883', 'MQTT inutilisé (= _APP_MQTT_PORT), port libre'),
                          (a.mqtt_wss_port, '8084', 'MQTT WebSocket inutilisé (= _APP_MQTT_WSS_PORT), port libre')]:
    src = src.replace(f'      - {port}:{inner}\n', f'      - "{port}:{inner}"   # ← {note}\n', 1)

# 2c. runtimes network: fixed subnet + executor attached, so Docker creates it at deploy time
#     (on hosts whose default address pools are exhausted, the executor cannot create it itself)
src = src.replace('  runtimes:\n    name: runtimes\n', '  runtimes:\n    name: runtimes\n    ipam:\n      config:\n        - subnet: 10.89.0.0/24   # ← plage réservée aux Functions ; change-la si elle chevauche un réseau existant\n', 1)
src = src.replace('    image: openruntimes/executor:1.1.2\n    restart: unless-stopped\n    networks:\n      - appwrite\n',
                  '    image: openruntimes/executor:1.1.2\n    restart: unless-stopped\n    networks:\n      - appwrite\n      - runtimes\n', 1)
assert 'subnet: 10.89.0.0/24' in src and '      - runtimes\n' in src, 'runtimes network patch failed'
# Behind NPM, Traefik must trust X-Forwarded-Proto, otherwise Appwrite sees HTTP and drops the cookie
# `Secure` flag; Dart/Flutter then rejects `SameSite=None` cookies and sessions never stick.
src = src.replace('      - --entrypoints.appwrite_web.address=:80\n',
                  '      - --entrypoints.appwrite_web.address=:80\n'
                  '      - --entrypoints.appwrite_web.forwardedHeaders.trustedIPs=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16   # ← fait confiance au X-Forwarded-Proto de NPM (cookies Secure)\n', 1)
assert 'forwardedHeaders.trustedIPs' in src, 'traefik forwarded headers patch failed'

# 3. ClickHouse files -> inline configs
src = src.replace('      - ./clickhouse-config.xml:/etc/clickhouse-server/config.d/appwrite.xml:ro\n', '')
src = src.replace('      - ./clickhouse-init.sh:/docker-entrypoint-initdb.d/clickhouse-init.sh:ro\n', '')
src = src.replace('    image: clickhouse/clickhouse-server:', '''    configs:
      - source: clickhouse_config
        target: /etc/clickhouse-server/config.d/appwrite.xml
      - source: clickhouse_init
        target: /docker-entrypoint-initdb.d/clickhouse-init.sh
    image: clickhouse/clickhouse-server:''', 1)
assert './clickhouse' not in src, 'unexpected ClickHouse mount left'

def block(path):
    return '\n'.join('      ' + l if l else '' for l in esc((BASE / path).read_text(encoding='utf-8')).splitlines())
configs = f"""configs:
  clickhouse_config:
    content: |
{block('clickhouse-config.xml')}
  clickhouse_init:
    content: |
{block('clickhouse-init.sh')}
"""

EDIT = [  # (variable, comment) — shown first, in this order
    ('# --- Adresse publique ---', None),
    ('_APP_DOMAIN', 'sous-domaine public SANS https:// (celui que NPM sert en HTTPS)'),
    ('_APP_CONSOLE_DOMAIN', 'même valeur que _APP_DOMAIN'),
    ('_APP_CONSOLE_HOSTNAMES', 'même valeur que _APP_DOMAIN (plusieurs possibles, séparés par des virgules)'),
    ('_APP_DOMAIN_TARGET_CNAME', 'même valeur que _APP_DOMAIN'),
    ('_APP_DOMAIN_FUNCTIONS', 'optionnel : domaine des URL publiques des Functions (inutile pour Table Noire)'),
    ('_APP_DOMAIN_SITES', 'optionnel : domaine des sites hébergés (inutile pour Table Noire)'),
    ('# --- Ports sur le NAS (doivent être libres) ---', None),
    ('_APP_HTTP_PORT', f'port vers lequel NPM transfère : http://{a.nas_ip}:{a.http_port}'),
    ('_APP_HTTPS_PORT', 'HTTPS interne, inutilisé derrière NPM : juste un port libre'),
    ('_APP_MQTT_PORT', 'temps réel MQTT, inutilisé par Table Noire : juste un port libre'),
    ('_APP_MQTT_WSS_PORT', 'MQTT via WebSocket, inutilisé : juste un port libre'),
    ('# --- Divers ---', None),
    ('_APP_LOCALE', 'langue des messages système'),
    ('_APP_CONSOLE_WHITELIST_ROOT', 'enabled = seul le 1er compte créé administre la console'),
    ('_APP_SYSTEM_EMAIL_ADDRESS', 'expéditeur des e-mails système (aucun mail envoyé tant que _APP_SMTP_HOST est vide)'),
    ('_APP_SMTP_HOST', 'vide = pas d\'envoi d\'e-mails (suffisant pour Table Noire)'),
    ('# --- Secrets générés : NE PLUS MODIFIER après le premier démarrage ---', None),
    ('_APP_OPENSSL_KEY_V1', 'clé de chiffrement des données : la perdre = données illisibles'),
    ('_APP_DB_PASS', 'mot de passe PostgreSQL (fixé au premier démarrage)'),
    ('_APP_DB_ROOT_PASS', 'mot de passe administrateur PostgreSQL'),
    ('_APP_EXECUTOR_SECRET', 'secret partagé avec le service des Functions'),
    ('_APP_USAGE_PASS', 'mot de passe ClickHouse (statistiques)'),
    ('_APP_JOBS_SECRET', 'secret interne des tâches'),
]
w = max(len(k) for k, c in EDIT if c) + 2
lines_env, done = [], set()
for k, c in EDIT:
    if c is None:
        lines_env.append(f'  {k}'); continue
    if k in env:
        lines_env.append(f'  {k + ":":<{w}} {yq(env[k])}   # ← {c}'); done.add(k)
lines_env.append('  # --- Réglages internes d\'Appwrite : rien à modifier en dessous ---')
lines_env += [f'  {k}: {yq(v)}' for k, v in env.items() if k not in done]
anchor = 'x-appwrite-env: &appwrite-env\n' + '\n'.join(lines_env) + '\n'
header = f"""# ==========================================================================================
#  APPWRITE — stack Portainer autonome (PostgreSQL, workers regroupés), générée par make_stack.py
# ==========================================================================================
#  CE QUE TU PEUX MODIFIER : uniquement les lignes marquées « ← » juste en dessous
#  (bloc x-appwrite-env). Tout le reste du fichier s'y réfère automatiquement.
#
#  Valeurs actuelles :
#    Sous-domaine public ......... https://{domain}
#    Port sur le NAS (pour NPM) .. {a.http_port}   (aussi écrit dans traefik > ports, plus bas)
#    IP du NAS ................... {a.nas_ip}   (ne sert pas ici : à saisir dans Nginx Proxy Manager)
#
#  Nginx Proxy Manager → Proxy Host :
#    Domain : {domain}   Scheme : http   Forward : {a.nas_ip}   Port : {a.http_port}
#    Websockets Support : ON   ·   SSL : Let's Encrypt + Force SSL
#
#  Si tu changes un port ici, change-le AUSSI dans traefik > ports (lignes marquées « ← »).
#  CE FICHIER CONTIENT DES SECRETS : ne le partage pas, garde une copie en lieu sûr.
# ==========================================================================================
"""
src = header + anchor + src.rstrip('\n') + '\n' + configs
leftover = re.findall(r'(?<!\$)\$\{?[A-Z_][A-Z0-9_]*', src)
assert not leftover, f'interpolations left: {leftover[:5]}'
pathlib.Path(a.out).write_text(src, encoding='utf-8')
print(f'OK -> {a.out}')
print(f'  {sum(1 for _ in env)} variables intégrées, ClickHouse inline, secrets générés.')
print('  Garde ce fichier (ou au moins _APP_OPENSSL_KEY_V1) en lieu sûr : il est nécessaire pour relire les sauvegardes.')
