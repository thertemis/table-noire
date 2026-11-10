# Installer Appwrite sur le NAS (Portainer + Nginx Proxy Manager)

Une seule installation d'Appwrite, qui servira à Table Noire et à tes futures applications (un projet par app). Tout tient dans **un seul fichier de stack Portainer** : toutes les variables du `.env` et les fichiers ClickHouse sont intégrés.

Remplace dans tout le guide :
- `appwrite.mondomaine.fr` par le sous-domaine que tu choisis ;
- `IP_NAS` par l'adresse IP locale du NAS (ex. `192.168.1.20`).

---

## 0. Prérequis

- **Mémoire** : 4 Go de RAM libres pour Appwrite et 2 Go de swap (exigence officielle), 2 cœurs CPU.
- **Docker Engine 25 ou plus récent (API ≥ 1.44)** : sinon l'orchestrateur ne peut pas créer les conteneurs de build et toutes les Functions échouent en 0 s (« requires API version 1.44 »). Le paquet Debian `docker.io` (20.10) est trop vieux : installe `docker-ce` depuis le dépôt officiel `download.docker.com` (`apt remove`, jamais `purge` : `/var/lib/docker` est conservé). Vérifie avec `docker version --format "{{.Server.APIVersion}}"`. Docker 29 refuse les clients trop anciens (API < 1.40) : remplace `containrrr/watchtower` par `ghcr.io/nicholas-fedor/watchtower`.
- **Portainer 2.20 ou plus récent** : la stack utilise des `configs` avec contenu intégré, qui demandent Docker Compose 2.23 ou plus.
- **DNS** : un enregistrement `A` `appwrite.mondomaine.fr` → l'IP publique de ta box. Avec une IP qui change, utilise un `CNAME` vers ton DNS dynamique.
- **Box** : ports 80 et 443 redirigés vers Nginx Proxy Manager (c'est sans doute déjà le cas).
- **Ports libres sur le NAS** : 8880, 8443, 8883 et 8084.

## 1. Générer le fichier de stack (sur ce PC)

Depuis le dossier du projet :

```bash
python infra/appwrite/make_stack.py appwrite.mondomaine.fr
```

Options : `--http-port 8880`, `--https-port 8443`, `--mqtt-port 8883`, `--mqtt-wss-port 8084`, `--nas-ip 192.168.1.x` (commentaires uniquement), `--email noreply@mondomaine.fr`.

Exemple avec d'autres ports :

```bash
python infra/appwrite/make_stack.py https://appwrite.mondomaine.fr --http-port 8744 --https-port 8745 --nas-ip 192.168.1.20
```

Le haut du fichier généré indique quoi modifier : un encadré récapitule les valeurs et la config NPM, puis viennent les variables modifiables, chacune marquée `# ← explication`. Les ports publiés de Traefik sont annotés de la même façon.

Le script crée `infra/appwrite/portainer-stack.yml`, qui contient :
- les 204 variables d'Appwrite, partagées entre les services par une ancre YAML (`x-appwrite-env`) ;
- des réglages de production adaptés à un serveur derrière NPM : `_APP_ENV=production`, ton domaine, HTTPS laissé à NPM, ports 8880/8443, pas de serveur mail, console réservée au premier compte ;
- des **secrets aléatoires neufs** (clé de chiffrement, mots de passe de la base, secret de l'executor…) ;
- les fichiers de config ClickHouse, intégrés au fichier.

> ⚠️ **Ce fichier contient tes secrets.** Il est exclu de Git (`.gitignore`). Copie-le dans ton gestionnaire de mots de passe : sans `_APP_OPENSSL_KEY_V1`, une sauvegarde de la base est illisible. Génère-le **une seule fois** : relancer le script crée de nouveaux secrets, incompatibles avec une installation existante.

Base utilisée : le compose officiel d'Appwrite **2.6.2** (PostgreSQL, workers regroupés), lu depuis le générateur de la documentation Appwrite (`base/`).

## 2. Créer la stack dans Portainer

1. **Stacks** → **Add stack** → nom : `appwrite`.
2. **Web editor** : colle tout le contenu de `portainer-stack.yml`.
3. Ne mets **aucune** variable d'environnement dans Portainer : tout est déjà dans le fichier.
4. **Deploy the stack**. Au premier démarrage, Appwrite prépare sa base : compte 2 à 5 minutes avant qu'il réponde.

## 3. Nginx Proxy Manager

**Hosts** → **Proxy Hosts** → **Add Proxy Host** :

- **Details**
  - Domain Names : `appwrite.mondomaine.fr`
  - Scheme : `http`, Forward Hostname/IP : `IP_NAS`, Forward Port : `8880`
  - **Websockets Support : activé** (sinon le journal de dés en temps réel ne marchera pas)
  - Block Common Exploits : activé
- **SSL**
  - Request a new SSL Certificate (Let's Encrypt)
  - Force SSL, HTTP/2 Support : activés
- **Advanced** → Custom Nginx Configuration :

  ```nginx
  client_max_body_size 64m;
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
  ```

  Le premier réglage autorise l'envoi de cartes et d'illustrations jusqu'à 64 Mo ; les deux autres laissent le temps aux Functions de répondre.

## 4. Vérifier et créer ton compte

1. Ouvre `https://appwrite.mondomaine.fr/v1/health/version` : tu dois obtenir `{"version":"2.6.2"}`.
2. Ouvre `https://appwrite.mondomaine.fr` et **crée immédiatement ton compte** (e-mail + mot de passe). Le premier compte devient l'administrateur de la console. Ensuite, plus personne ne peut s'inscrire (`_APP_CONSOLE_WHITELIST_ROOT=enabled`).

En cas de problème (Portainer → stack `appwrite` → conteneur → **Logs**) :

| Symptôme | Cause probable |
|---|---|
| 502 Bad Gateway dans NPM | Appwrite démarre encore (attendre quelques minutes), ou mauvais port (doit être 8880) |
| Boucle de redirection | Force SSL activé ailleurs que dans NPM : le proxy host doit viser `http://IP_NAS:8880` |
| Erreur au déploiement sur `configs` / `content` | Portainer trop ancien : mets-le à jour (2.20+). Sinon voir l'annexe |
| ClickHouse redémarre en boucle | consulter ses logs ; le plus souvent un manque de mémoire |
| Conteneurs qui s'arrêtent seuls | mémoire insuffisante : vérifie les 4 Go de RAM et le swap |
| Port déjà utilisé | 8880, 8443, 8883 ou 8084 occupé : régénère avec `--http-port` / `--https-port`, ou libère le port |

## 5. Préparer le projet Table Noire dans la console

1. À la première connexion, la console crée l'organisation et un projet initial : renomme-le **Table Noire**, puis note son **Project ID**.
2. **Overview** → **Add platform** :
   - **Flutter** → Windows, nom `Table Noire PC`, package `fr.tablenoire.app` ;
   - **Flutter** → Android, nom `Table Noire Android`, package `fr.tablenoire.app`.
3. **Auth** → **Settings** : laisse **Email/Password** activé, désactive les autres méthodes.
4. **Auth** → **Teams** → **Create team** : `Campagne`. Note son **Team ID**.

Les collections, buckets et Functions seront créés depuis le dépôt avec l'Appwrite CLI, pas à la main.

## 6. Relier la maquette et l'app

Dans Table Noire, bouton orange → **Connexion Appwrite** :

| Champ | Valeur |
|---|---|
| Adresse du serveur | `https://appwrite.mondomaine.fr/v1` |
| ID du projet | le Project ID noté à l'étape 5 |
| ID de la base | `main` |
| ID de l'équipe de campagne | le Team ID noté à l'étape 5 |

## 7. Sauvegardes

Liste les volumes de la stack :

```bash
docker volume ls | grep appwrite
```

À sauvegarder régulièrement : `appwrite-postgresql` (la base), les volumes uploads, functions, builds, sites et config, ainsi que **ton `portainer-stack.yml`**, qui contient la clé de chiffrement.

## 8. Mettre à jour plus tard

Avant toute mise à jour : sauvegarde complète. Ensuite, suis le guide de mise à jour officiel d'Appwrite (nouvelle version des images, puis migration). Ne change jamais `_APP_OPENSSL_KEY_V1` ni les mots de passe de la base dans la stack existante.

---

## Annexe — Portainer trop ancien pour les `configs` intégrés

1. Crée le dossier `/opt/appwrite` sur le NAS et copies-y `base/clickhouse-config.xml` et `base/clickhouse-init.sh`.
2. Dans `portainer-stack.yml` :
   - supprime le bloc `configs:` à la fin du fichier ;
   - dans le service `clickhouse`, remplace le bloc `configs:` par ces deux lignes sous `volumes:` :
     ```yaml
           - /opt/appwrite/clickhouse-config.xml:/etc/clickhouse-server/config.d/appwrite.xml:ro
           - /opt/appwrite/clickhouse-init.sh:/docker-entrypoint-initdb.d/clickhouse-init.sh:ro
     ```

## Annexe — Assistant d'installation officiel (version 2.7.1)

Pour partir de la toute dernière version avec l'assistant web d'Appwrite, au lieu de ce fichier : lance `docker run -it --rm --publish 20080:20080 --volume /var/run/docker.sock:/var/run/docker.sock --volume /opt/appwrite:/usr/src/code/appwrite:rw --entrypoint="install" appwrite/appwrite:2.7.1` en SSH sur le NAS. Ouvre ensuite `http://IP_NAS:20080` et choisis : HTTPS activé, PostgreSQL, ports 8880/8443.

L'assistant génère un `.env` séparé et démarre lui-même la stack, hors de Portainer.
