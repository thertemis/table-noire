# Table Noire — Architecture

Compagnon de jeu de rôle : fiches de personnage modulaires, inventaire et équipement, compétences, lore, cartes,
lanceur de dés partagé en temps réel. Plusieurs campagnes indépendantes, chacune avec son MJ.

## 1. Vue d'ensemble

```
Navigateur (PWA)                               Serveur (Docker)
app.example.com ── GitHub / Cloudflare Pages ─┐   appwrite.example.com ── proxy HTTPS ── Appwrite
  web/ : HTML + JS, sans build                │     TablesDB (28 tables) · Storage (5 buckets)
  service worker (hors ligne)                 └───► Functions Node 22 (7) · Realtime (WebSocket)
```

- **Client** : `web/` (statique, publié sur GitHub Pages ou Cloudflare Pages). Serveur visé : `tn.config.json`,
  appliqué par `tools/configure.mjs`. Pas d'étape de build : la maquette d'origine
  (`app.js`) est enrichie par des modules qui se branchent sur ses fonctions (voir `web/README.md`).
- **Serveur** : Appwrite (auto-hébergé ou Cloud). Toute la logique sensible est dans des Functions ; le client
  n'a jamais de clé API.
- **Domaine** : le nom d'hôte de l'app doit être déclaré comme plateforme Web du projet Appwrite. Servie depuis le
  même domaine que le serveur (`app.example.com` / `appwrite.example.com`), la session est un cookie du même site ;
  sinon le SDK la garde dans le stockage local du navigateur.

## 2. Modèle multi-campagne

- **Campagne = équipe Appwrite.** L'identifiant de la ligne `campaigns` est celui de l'équipe. Rôles d'équipe :
  `gm` et `player`.
- **Admin global** : label `admin` (gère utilisateurs et campagnes). Les comptes invités portent le label `member`.
- Toutes les lignes de campagne ont un `campaignId`. Permissions (posées par la Function `apply-visibility`) :
  - visibilité `all` → lecture `team:<c>` ; `owner` → `team:<c>/gm` + `user:<propriétaire>` ; `gm` → `team:<c>/gm` ;
  - `hiddenFromPlayers` (objets, compétences) → MJ + propriétaire seulement ;
  - PNJ (`characters.kind = npc`) : invisibles des joueurs hors de la scène (`inScene`) ; dans la scène, seuls leur
    ligne de personnage et leurs champs texte visibles de tous sont lisibles. Les exemplaires ont un `templateId` ;
  - écriture / suppression → `team:<c>/gm`.
- Les joueurs ne modifient jamais directement une ligne du MJ : ils passent par `player-action`.

## 3. Données (TablesDB)

| Domaine | Tables |
|---|---|
| Campagne | `campaigns` (réglages, emplacements d'équipement, disposition de fiche, initiative, révélation, formules de jet) |
| Comptes | `profiles`, `invites`, `invite_claims` |
| Fiches | `characters`, `field_defs` (modèle de fiche de la campagne), `character_values`, `wounds`, `player_prefs` (journal, disposition perso) |
| Inventaire | `item_defs` (bibliothèque, `slot`), `item_instances` (`qty`, `equippedSlot`), `skill_defs`, `skill_instances` |
| Monde | `lore_articles`, `maps` (`fog`, `playerFileId`), `map_pois`, `map_texts` |
| MJ | `gm_notes` (notes MJ des blessures, objets, compétences), `session_log`, `change_log` |
| Jeu | `dice_rolls` (journal de dés, jets secrets) |
| Partagé | `sheet_templates` (modèles de fiche, lisibles par tous les utilisateurs) |
| Interaction | `map_marks` (dessins et pings), `lore_comments`, `polls`, `poll_votes` : créés par les Functions, qui posent les permissions (auteur + MJ) |
| Serveur | `app_settings` (ligne `global` : langue de l’interface `auto`/`fr`/`en`, lisible sans compte, modifiable par l’admin) |
| Joueur | `notebook_pages` (carnet privé : lisible par son auteur seulement) |

Buckets : `portraits`, `item-art`, `lore-images`, `maps`, et `backups` (sauvegardes, admin seulement) (images png / jpg / webp seulement ; le client réduit et
ré-encode en WebP avant envoi, ce qui retire les métadonnées EXIF).

Le schéma est décrit dans `appwrite/build_config.py`, qui génère `appwrite.config.json` et le `config.js` de chaque Function.

## 4. Functions

| Function | Rôle |
|---|---|
| `admin` | sauvegardes et restauration (bucket `backups`), scène (`setScene`), utilisateurs, campagnes (création, copie, suppression avec ses images), membres, invitations, personnages (création, copie), journal de dés, partage d'images |
| `redeem-invite` | inscription par lien à usage unique, réinitialisation de mot de passe |
| `roll-dice` | jet côté serveur (formules, jets nommés et secrets) |
| `player-action` | actions des joueurs : valeurs de jauge, masquage, portrait (validé), équiper / déséquiper, utiliser, donner |
| `apply-visibility` | recalcule les permissions à chaque création / modification de ligne ; pour `maps`, aussi celles des images : sous brouillard l’original est réservé au MJ, les joueurs lisent la copie masquée `playerFileId` dessinée par l’appli du MJ |
| `guard-signup` | supprime les comptes créés hors invitation |
| `image-search` | recherche d'images Pixabay (clé unique du serveur, variable `PIXABAY_KEY`) et DuckDuckGo ; télécharge l'image choisie (adresses publiques seulement, images ≤ 6 Mo) |

## 5. Sécurité

- Content-Security-Policy stricte pour les scripts (site + deux CDN, avec Subresource Integrity), pas de cadre.
- Markdown filtré par DOMPurify ; portraits validés côté serveur et côté client.
- Partage d'images limité aux fichiers déjà accessibles à l'appelant.
- Session expirée détectée (retour à la connexion).
- `tests/e2e.mjs` vérifie les droits et les règles métier contre le serveur réel.

## 6. Temps réel et hors ligne

- Abonnements Realtime par campagne : dés, fiche ouverte, inventaire, monde, ligne de campagne (réglages,
  initiative, révélations, emplacements), journal de séance.
- Les sauvegardes du client sont différées (diff de l'état) ; une coupure réseau garde les modifications en
  attente et les renvoie au retour de la connexion.
- Le service worker sert l'app hors ligne et force la revalidation (la zone Cloudflare met 4 h de cache navigateur).

## 7. Exploitation

Voir `README.md` (publication, Functions, schéma, tests) et `infra/appwrite/INSTALL.md` (serveur).
