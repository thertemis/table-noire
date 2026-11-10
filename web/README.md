# Client web — modules

Pas de build : `index.html` charge des scripts classiques, **dans cet ordre**. Ils partagent la même portée
globale (les `function` et `const` de haut niveau d'un fichier sont visibles des suivants).

## Le mécanisme

`app.js` est la maquette d'origine : elle tient l'état (`S`, `C`, `ITEMS`, `INV`, `SKILLS`, `SKOWN`, `LORE`,
`MAPS`, `LOG`), les actions `ACT.*` et les fonctions de rendu (`render`, `renderFiche`, `renderInventory`,
`renderSkills`, `renderLore`, `renderMap`, `cardHtml`, `skillHtml`…).

Chaque module suivant **enveloppe** ces fonctions plutôt que de les modifier :

```js
const _renderX = renderX;                       // garder la version précédente
renderX = function () { const html = _renderX(); /* compléter */ return html; };
```

Les appels internes passent par le nom global : ils prennent toujours la dernière enveloppe. Le dernier module
chargé est donc la couche la plus externe. Les modules communiquent aussi par l'événement `tn:campaign`
(mise à jour en direct de la ligne de campagne).

## Ordre de chargement

| # | Fichier | Rôle | Enveloppe / ajoute |
|---|---|---|---|
| 0 | `config.js` | serveur Appwrite (généré par `tools/configure.mjs` depuis `tn.config.json`) | — |
| 0 | `i18n-en.js` | dictionnaire anglais : texte français affiché → anglais (`{0}` pour les valeurs) | — |
| 0 | `i18n.js` | langue (FR/EN), traduction de la page (MutationObserver), `tr()`, `LOCALE` | `confirm`, `alert`, `prompt` |
| 1 | `app.js` | maquette : état, rendu, actions, dés | — |
| 2 | `fidgets.js` | widgets de la fiche, grille bento (`packBento`) | tuiles |
| 3 | `portrait.js` | portraits générés / importés | |
| 4 | `settings.js` | réglages de table (bouton orange) | `applySettings`, `settingsModal` |
| 5 | SDK Appwrite (CDN) | | |
| 6 | `online.js` | connexion, campagnes, membres, utilisateurs, dés serveur et journal | `renderHeader`, `roll`, `enterCampaign`, `leaveCampaign`, `logout` |
| 7 | `security.js` | DOMPurify sur le Markdown, validation des portraits, `toWebp`, session expirée | `mdHtml`, `AW.c.call` |
| 8 | `sheet.js` | fiche ↔ Appwrite (diff, temps réel, historique) | `render`, `tIdentity`, `ACT.pickChar` |
| 9 | `inventory.js` | objets et compétences ↔ Appwrite | `loadSheet`, `renderInventory`, `renderSkills` |
| 10 | `world.js` | lore et cartes ↔ Appwrite, `flushSaves` | `renderMap`, `renderLore`, `leaveCampaign`, `logout` |
| 11 | `equipment.js` | piles, équipement, onglet Équipement | `cardHtml`, `itemForm`, `renderMap` (route) |
| 12 | `templates.js` | modèles de fiche, disposition de campagne | `renderFiche`, `enterCampaign` |
| 13 | `campaign.js` | réglages de campagne, temps réel de la campagne, disposition joueur, Utiliser, Donner | `applySettings`, `settingsModal`, `cardHtml` |
| 14 | `rolls.js` | jets depuis la fiche, jets secrets | `skillHtml`, `renderLog` |
| 15 | `initiative.js` | ordre d'initiative | `renderHeader` |
| 16 | `reveal.js` | révélations du MJ | `renderLore`, `renderMap` |
| 17 | `fog.js` | brouillard de guerre | `renderMap`, `refreshMapItems` |
| 18 | `gmtools.js` | Outils MJ, PNJ, copies, historique, onglet Séances | `renderHeader`, `renderMap` (route) |
| 19 | `backup.js` | export / import de campagne | `ACT.gmHub` |
| 20 | `comfort.js` | hors ligne, notifications | `loadInventory` |
| 21 | `search.js` | recherche, filtres, tris (bibliothèques, lore) | `renderInventory`, `renderSkills`, `renderLore` |
| 22 | `library.js` | export / import de bibliothèques | idem |
| 23 | `notebook.js` | onglet Carnet (carnet de notes privé, paginé) | `renderMap` (route) |
| 24 | `npc.js` | bibliothèque de PNJ, exemplaires, barre de scène | `renderIniBar`, `saveIni`, `renderHeader`, `renderMap` (route) |
| 24b | `lore.js` | page Lore : vue liste / grille, catégories (MJ), article avec titre, tableaux, commentaires | `renderLore` (remplacé), `newLore`, `deleteLore` |
| 24c | `polls.js` | sondages : création (MJ, public choisi), vote, résultats, fermeture | `renderHeader`, `gmHub` |
| 25 | `images.js` | recadrage des images importées, recherche d'images en onglets Wikimedia / Pixabay / DuckDuckGo | `readImage`, `tIdentity`, `itemForm` |
| 26 | `stable.js` | anti-scintillement (dernier), vérification des modules | `render` |
| 27 | `sw-register.js` | service worker (`sw.js`) | |

## Ajouter un module

1. L'insérer **avant** `stable.js` dans `index.html` (même `?v=` que les autres) et dans `SHELL` de `sw.js`.
2. Ajouter son nom de fonction témoin dans la vérification de `stable.js`.
3. `node tools/release.mjs --check` contrôle ordre, versions, cache et syntaxe.
4. Pas de script intégré dans `index.html` : la CSP les bloque.
