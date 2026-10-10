# Univers — contexte du projet

Site de **jeux à plusieurs en duel par simple lien** (sans compte ni installation) et de « planètes » personnalisables. En ligne : https://ladrop974.github.io/univers/ (GitHub Pages — se met à jour dès qu'on pousse sur `main`, donc ne pousser sur `main` que sur demande du propriétaire).

## Technique
- Aucun build : fichiers statiques (HTML/CSS/JS). Dépendances par CDN : Three.js, PeerJS (WebRTC pair-à-pair, pas de serveur).
- `js/` : `main`, `catalog`, `modules`, `policy` (règles d'âge), `planetmodel`, `assistant`, `google`, `orbit`, `glyphs`, `worlds/*` (Fréquence Orion, Bibliotheca Nova, Observatoire Terra, Arcadia Prime…).
- `games/` : `nexus` (Lignée Zénith, 3D), `poules` (Poules Armageddon), `morpion`, `spore`, `vortex` ; ajout d'un jeu : `docs/AJOUTER_UN_JEU.md` (un dossier + une ligne dans `games/index.json`).
- `emulator.html` : lecteur EmulatorJS isolé utilisé par SolunIA Network (aucune ROM fournie).
- `docs/CONNECTEURS.md` généré par `node tools/gen_guide.mjs` ; `docs/GOOGLE.md` pour Gmail/Drive (mode Démo sans Client ID dans `js/config.js`).

## Règles du projet
- **Aucun emoji dans l'interface** : icônes uniquement via `js/glyphs.js` (généré par `node tools/gen_glyphs.mjs`, Lucide) ; un test l'impose.
- Public mixte/jeune : respecter les filtres d'âge de `js/policy.js`.

## Commandes
`python -m http.server 8092` puis http://localhost:8092 · `node --test tests/*.test.mjs` · `node tests/connectors_live.mjs` (réseau).

## Limites connues
Pas de relais TURN (connexion directe peut échouer sur réseaux fermés) ; mode « clé » (IA personnelle) inactif ; pas de bac à sable pour jeux tiers ; film synchronisé non fait.

## Travail à deux comptes (important)
Ce projet est repris par **deux comptes Claude Code** (propriétaire GitHub : `ladrop974`). Tout passe par GitHub :
1. Au début d'une session : `git fetch`, puis lire la section « Journal de passation » ci-dessous.
2. Travailler sur une branche `claude/<sujet>` (jamais de force-push, rebase ou amend sur ce qui est déjà poussé).
3. Commits clairs en français, poussés souvent : c'est ce qui permet à l'autre compte de reprendre.
4. À la fin d'une session : ajouter 2-3 lignes au « Journal de passation » (fait / en cours / prochaine étape), commiter, pousser.
5. Ne pas créer de pull request ni fusionner dans `main` sans demande du propriétaire.
6. Le déploiement en ligne est fait **par le propriétaire lui-même** (Lovable ou GitHub Pages) : ne pas tenter de publier.
7. Ne jamais écrire de clé secrète dans le dépôt (clés Stripe, tokens, mots de passe) : les demander au propriétaire, qui les enregistre lui-même côté service.

## Journal de passation
<!-- Ajouter les entrées les plus récentes en haut : date — compte — fait / en cours / prochaine étape -->
- 2026-10-10 — création du contexte. Prochaine étape : à décider avec le propriétaire.
