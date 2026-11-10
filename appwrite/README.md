# Backend Appwrite — Table Noire

Serveur, projet et base : `tn.config.json` à la racine (identifiants publics, pas des secrets). Après l'avoir
modifié : `node tools/configure.mjs`.

## Contenu

- `build_config.py` : schéma lisible (24 tables, 4 buckets, 7 Functions). Génère `appwrite.config.json` et
  `functions/*/src/config.js` (listes de tables partagées par les Functions).
- `functions/` : `admin`, `redeem-invite`, `roll-dice`, `player-action`, `apply-visibility`, `guard-signup`, `image-search` (variable `PIXABAY_KEY` à renseigner dans la console : Functions → image-search → Settings → Variables)
  (Node 22, `node-appwrite` 29.0.0). Voir ARCHITECTURE.md § 4.
- `functions/player-action/src/slots.js` : emplacements d'équipement par défaut, à garder identiques à
  `DEFAULT_SLOTS` dans `web/equipment.js`.

## Déployer

```bash
cd appwrite
python build_config.py                                            # après toute modification du schéma (ou node ../tools/configure.mjs)
appwrite push functions --function-id <id> --force --no-logs      # une Function
cd .. && node tests/e2e.mjs                                       # vérifier
```

Connexion à la CLI : `appwrite login --endpoint https://appwrite.example.com/v1` (aucun mot de passe ni clé API dans le
dépôt). Les Functions reçoivent une clé temporaire avec les scopes déclarés dans `build_config.py`.

## Règles à respecter

- Toute nouvelle table de campagne a un `campaignId` (la suppression de campagne s'appuie dessus) et un index
  `k_campaign`.
- Une table à visibilité doit figurer dans `VIS_TABLES` / `TEAM_TABLES` / `GM_TABLES` pour que `apply-visibility`
  pose ses permissions.
- Les joueurs n'écrivent jamais directement les lignes du MJ : passer par `player-action`.
- Toute valeur écrite par un joueur et affichée chez les autres doit être validée côté serveur (voir le portrait).
