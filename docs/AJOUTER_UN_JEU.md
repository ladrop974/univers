# Ajouter un jeu à Univers (5 minutes)

Un jeu = **un dossier** + **une ligne** dans le catalogue. Claude Code peut l'écrire pour toi : donne-lui ce fichier.

## 1. Le dossier
`games/<id>/game.js` : un module qui exporte un objet avec `start(ctx)`.

```js
export default {
  id: "monjeu",
  name: "Mon jeu",
  start(ctx) {
    return new MonJeu(ctx);          // doit avoir une méthode destroy()
  },
};
```

## 2. Ce que le jeu reçoit : `ctx`
| Champ | Rôle |
|---|---|
| `ctx.root` | l'élément plein écran où dessiner (DOM ou canvas). Vide au départ. |
| `ctx.mode` | `"bot"` (solo), `"local"` (même écran) ou `"online"` (duel par lien) |
| `ctx.seat` | ton numéro de joueur : 0 (l'hôte) ou 1 |
| `ctx.isHost` | `true` pour l'hôte (ou hors ligne) |
| `ctx.players` | `[{seat, name}, …]` |
| `ctx.seed` | nombre aléatoire commun aux deux joueurs (pour un terrain ou un tirage identique) |
| `ctx.send(type, données)` | envoie un message à l'autre joueur (ignoré hors ligne) |
| `ctx.on(type, (données) => …)` | reçoit les messages de l'autre joueur |
| `ctx.on("peer-left", …)` | l'autre joueur est parti |
| `ctx.quit()` | retour au salon |

## 3. Règles d'or pour que ça marche à deux
1. **Chaque joueur envoie ses actions, pas l'écran.** Exemple : « j'ai joué la case 4 », pas une image.
2. **Même règles chez les deux joueurs**, ou l'état complet envoyé par celui dont c'est le tour.
3. **Pour l'aléatoire, utilise `ctx.seed`**, jamais `Math.random()` pour ce qui doit être pareil des deux côtés.
4. **Tour par tour = le plus simple.** Temps réel : envoie la position 10 à 15 fois par seconde, pas plus.
5. **Tout au doigt ET à la souris/clavier.** Gros boutons (50 px minimum), pas de survol obligatoire.
6. **Fluide** : une seule boucle `requestAnimationFrame`, `devicePixelRatio` limité à 1,5 sur téléphone, peu de lumières,
   pas d'ombres, géométries simples.
7. Nettoie tout dans `destroy()` (écouteurs, boucle d'animation).

## 4. Le catalogue
Ajoute dans `games/index.json` :
```json
{ "id": "monjeu", "name": "Mon jeu", "tagline": "Une phrase", "emoji": "🎲",
  "modes": ["bot", "local", "online"], "players": "1 à 2 joueurs" }
```
Il apparaît tout seul sur l'accueil.

## 5. Exemple minimal complet : le Morpion
Voir `games/morpion/game.js` (≈ 130 lignes, avec robot et duel en ligne).
Un exemple 3D plus riche : `games/poules/` (règles dans `sim.js`, testées avec `node --test tests/`).

## 6. Jeux écrits par d'autres
Un jeu publié par un inconnu doit tourner dans un **bac à sable isolé** (iframe `sandbox`) : ce n'est pas encore
en place. Aujourd'hui, ne mets dans `games/` que du code que tu as écrit ou relu.
