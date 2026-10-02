# 🪐 Univers

Des jeux à plusieurs, en duel **par simple lien** : sans compte, sans rien installer, sur téléphone comme sur PC.

**Jouer : https://ladrop974.github.io/univers/**

## Ce qui marche aujourd'hui
- **Planètes** (grandes, animées, sur l'accueil) : **📡 Fréquence Orion** (radios du monde, Radio Browser), **📚 Bibliotheca Nova** (livres, Open Library + lecture Internet Archive), **🌍 Observatoire Terra** (météo Open-Meteo, séismes USGS, Station spatiale, globe jour/nuit). **🎮 Arcadia Prime** (jeux : rubrique « Créés par des Soluniariens », Free-to-Game, RAWG avec ta clé gratuite). Toutes les API sont gratuites et sans clé ; code dans `js/worlds/`.
- **NEXUS : Lignée Zénith** (3D) : roguelite évolutif. Une graine absorbe, mute (bonus + coût à chaque niveau),
  conquiert des relais, choisit une spécialisation, puis affronte l'autre lignée au Duel Zénith (KO, 3 balises ou
  majorité). Solo contre un robot (3 difficultés), écran partagé à deux, ou duel en ligne par lien.
  Qualité graphique réglable (Bas → Ultra, lueurs, ombres), **toutes les touches se changent** (⚙ Options),
  manette, visée à la souris, commandes tactiles sur téléphone.
- **Poules Armageddon** (3D) : 3 poules contre 3 poules, œufs explosifs, terrain destructible, vent.
  Solo contre la poule robot, duel sur le même écran, ou duel en ligne par lien.
- **Morpion** : solo, même écran ou en ligne.
- **Chat** et **partage de PDF / images** pendant un duel (envoi direct d'un joueur à l'autre, rien n'est stocké).
- **Ajouter un jeu** : un dossier + une ligne (voir `docs/AJOUTER_UN_JEU.md`).

## Comment ça marche
Le duel en ligne est en **pair-à-pair** (WebRTC via PeerJS) : aucun serveur à toi, rien à payer. Le créateur de la
salle est l'hôte ; l'autre joueur ouvre le lien. Dans Poules Armageddon, le tireur fait foi : il envoie son tir, puis
l'état complet à la fin du tour.

## Limites connues
- Si les deux joueurs sont derrière des réseaux très fermés (certains 4G, Wi-Fi d'entreprise), la connexion directe
  peut échouer : change de réseau Wi-Fi/4G. (Pas de relais TURN pour l'instant.)
- Le mode « clé » (IA personnelle de chacun) n'est **pas encore actif**.
- Pas de bac à sable pour les jeux écrits par d'autres : n'ajoute que du code relu.
- Regarder un film ensemble : pas encore (prévu : chacun sa copie, lecture synchronisée).

## Développer
```bash
python -m http.server 8092        # puis http://localhost:8092
node --test tests/sim.test.mjs tests/nexus.test.mjs   # règles des jeux
```
Pas de compilation : des fichiers statiques. Hébergement : GitHub Pages.
Dépendances chargées depuis un CDN : Three.js (3D) et PeerJS (réseau).
