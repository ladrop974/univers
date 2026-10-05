# Les outils (API) d'Univers : guide d'installation

> Fichier généré par `node tools/gen_guide.mjs` : ne le modifie pas à la main, change `js/catalog.js`.

Chaque planète utilise des **outils** : des API officielles, gratuites et légales. Dans l'application : **Atelier → Outils et API**. Pour chaque outil : guide, champ de clé (si l'outil en accepte une), bouton **Tester**.

## Les modules d'une planète
Une planète est une arborescence : **dossiers, sous-dossiers** (4 niveaux, 60 éléments) et **modules**. Chaque module affiche son état :
- **Fonctionnel** : Données réelles, utilisable maintenant.
- **Démo** : Données d'exemple : rien de réel tant que tu ne connectes pas ton compte.
- **À configurer** : Demande une étape de réglage avant de fonctionner.

**Outils ouverts** (API officielles, gratuites, sans clé (ou clé facultative))
- voir la liste des outils plus bas

**Créés par des Soluniariens** (Ce que la communauté a déjà construit, prêt à brancher)
- Observatoire Terra : Météo, séismes en direct, Station spatiale et globe jour/nuit. (dès 5 ans et plus, Fonctionnel)
- Fréquence Orion : Les radios du monde. Contenu non filtré : dès 13 ans. (dès 13 ans et plus, Fonctionnel)
- Bibliotheca Nova : Livres et archives (Open Library, Internet Archive). Recherche non filtrée : dès 13 ans. (dès 13 ans et plus, Fonctionnel)
- Arcadia Prime : Le monde du jeu : Soluniariens, jeux gratuits, jeux offerts. Dès 13 ans. (dès 13 ans et plus, Fonctionnel)
- Morpion : Le classique, en duel. (dès 5 ans et plus, Fonctionnel)
- NEXUS : Lignée Zénith : Roguelite évolutif en 3D, solo, à deux ou en duel par lien. (dès 9 ans et plus, Fonctionnel)
- Poules Armageddon : Duel d'artillerie en 3D : 3 poules contre 3 poules. (dès 9 ans et plus, Fonctionnel)
- SPORE : Fractale Vivante : Fais évoluer ton organisme, seul ou en meute de 1 à 5. (dès 9 ans et plus, Fonctionnel)
- SolunIA Network : Galaxies sociales, dossiers, salons de jeu avec vocal, chat. S'ouvre dans l'application SolunIA. (dès 13 ans et plus, Fonctionnel)
- Télé et anime OTAKU : Télévision en direct, anime et manga. Dans SolunIA Network : ouvre ta galaxie puis la planète OTAKU. Contenu non filtré : dès 13 ans. (dès 13 ans et plus, Fonctionnel)

**Messagerie et fichiers** (Tes propres comptes, en lecture seule, protégés (adultes))
- Ma messagerie (Gmail) : Combien de mails non lus, qui t'a écrit, depuis ton Gmail. Lecture seule : jamais le contenu des messages. (dès adultes, Démo)
- Mes fichiers (Google Drive) : Retrouve un fichier par son nom. Lecture seule : jamais le contenu. (dès adultes, Démo)

Gmail et Drive : voir `docs/GOOGLE.md`. Les jeux et mondes « Créés par un Soluniarien » sont ceux d'Univers ; la télé OTAKU vit dans SolunIA Network (lien).

## Les thèmes
| Thème | Outils | Dès |
|---|---|---|
| Musique | Extraits Apple Music, Sons libres, Encyclopédie musicale, Radios du monde | 5 ans et plus |
| Nature et animaux | Chiens du monde, Vivants de la planète, Encyclopédie, Météo des villes | 5 ans et plus |
| Espace et science | Photos de la NASA, Image du jour (NASA), Encyclopédie, Météo des villes | 5 ans et plus |
| Livres et histoires | Livres, Encyclopédie | 5 ans et plus |
| Art et images | Images libres, Musée de Chicago, Musée de Cleveland | 5 ans et plus |
| Cuisine du monde | Recettes du monde, Encyclopédie | 5 ans et plus |
| Quiz et culture | Quiz, Encyclopédie | 5 ans et plus |
| Tour du monde | Météo des villes, Encyclopédie, Vivants de la planète, Photos de la NASA | 5 ans et plus |
| Jeux | Jeux gratuits | 13 ans et plus |

## Âge : comment ça protège
- Chaque joueur règle **son âge** (5-8, 9-12, 13-17, adulte) ; chaque planète a **son âge cible**. L'âge appliqué est **le plus bas des deux**.
- Un outil n'est pas utilisable avant son âge minimum (verrouillé). Les recherches libres ont leur propre âge minimum : avant, la planète propose des **sélections choisies à la main**.
- Les recherches sont filtrées (mots inadaptés, liens refusés) et **chaque résultat est filtré aussi**. Les liens non https sont supprimés.
- Limite honnête : un filtre n'est jamais parfait et l'âge est déclaratif. Un adulte doit rester présent avec les plus jeunes.

## Les clés d'API
Les clés restent **dans le navigateur de l'appareil** (jamais dans le lien de partage d'une planète, jamais envoyées à Univers). Sur un appareil partagé, supprime-les à la fin.


## Extraits Apple Music  (dès 5 ans et plus)
Extraits de 30 secondes de millions de chansons (via l'iTunes Search API d'Apple).

- **Recherche libre** : 9 ans et plus
- **Licence** : Extraits fournis par Apple ; liens vers Apple Music
- **Mention à afficher** : Extraits et pochettes : Apple (iTunes Search API)
- **Site officiel** : https://performance-partners.apple.com/search-api
- **Conditions** : https://www.apple.com/legal/internet-services/itunes/
- **Limites** : Environ 20 requêtes par minute et par appareil. Seuls des extraits de 30 s sont lisibles.

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Sons libres  (dès 5 ans et plus)
Musiques et bruitages sous licences Creative Commons (Openverse, WordPress.org).

- **Recherche libre** : 9 ans et plus
- **Licence** : Creative Commons (variable selon l'œuvre)
- **Mention à afficher** : Openverse : œuvres sous licences Creative Commons, auteur indiqué sur chaque carte
- **Site officiel** : https://api.openverse.org/
- **Conditions** : https://docs.openverse.org/api/reference/made_with_ov.html
- **Limites** : Sans clé : quelques requêtes par minute. Respecte la licence indiquée sur chaque carte (auteur à citer).

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Encyclopédie musicale  (dès 9 ans et plus)
Albums, artistes et années de sortie (MusicBrainz, base ouverte).

- **Recherche libre** : 9 ans et plus
- **Licence** : Données CC0 ; pochettes Cover Art Archive
- **Mention à afficher** : Données : MusicBrainz (CC0) · Pochettes : Cover Art Archive
- **Site officiel** : https://musicbrainz.org/doc/MusicBrainz_API
- **Conditions** : https://metabrainz.org/api
- **Limites** : 1 requête par seconde. L'API demande un nom d'application : le navigateur n'en envoie pas, reste raisonnable.

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Radios du monde  (dès 13 ans et plus)
Des milliers de radios en direct (Radio Browser). Contenu non filtré : réservé aux 13 ans et plus.

- **Recherche libre** : 13 ans et plus
- **Licence** : Annuaire libre ; chaque radio reste à son diffuseur
- **Mention à afficher** : Annuaire : Radio Browser
- **Site officiel** : https://www.radio-browser.info/
- **Conditions** : https://api.radio-browser.info/
- **Limites** : Seules les radios en https sont lues (le navigateur bloque les autres).

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Chiens du monde  (dès 5 ans et plus)
Des photos de chiens, par race (Dog CEO, images du Stanford Dogs Dataset).

- **Recherche libre** : 5 ans et plus
- **Licence** : Images libres du Stanford Dogs Dataset
- **Mention à afficher** : Photos : Dog CEO API / Stanford Dogs Dataset
- **Site officiel** : https://dog.ceo/dog-api/
- **Conditions** : https://dog.ceo/dog-api/about
- **Limites** : Aucune limite annoncée. Les noms de races sont en anglais (ex. : poodle, husky, beagle).

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Vivants de la planète  (dès 5 ans et plus)
Animaux, plantes et champignons avec photos (iNaturalist, science participative).

- **Recherche libre** : 5 ans et plus
- **Licence** : Photos sous licences ouvertes (auteur indiqué sur chaque carte)
- **Mention à afficher** : Observations et photos : iNaturalist, auteurs cités sur chaque carte
- **Site officiel** : https://api.inaturalist.org/v1/docs/
- **Conditions** : https://www.inaturalist.org/pages/api+recommended+practices
- **Limites** : Environ 60 requêtes par minute. Les photos ont chacune leur licence : l'auteur est affiché.

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Encyclopédie  (dès 9 ans et plus)
Les articles de Wikipédia en français : résumé, image et lien.

- **Recherche libre** : 9 ans et plus
- **Licence** : CC BY-SA 4.0
- **Mention à afficher** : Textes : Wikipédia (CC BY-SA 4.0), auteurs sur la page de chaque article
- **Site officiel** : https://www.mediawiki.org/wiki/API:Main_page
- **Conditions** : https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use
- **Limites** : Reste raisonnable (moins de 200 requêtes par seconde pour toute l'application !). Le contenu est écrit par des volontaires : un adulte peut vérifier.

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Photos de la NASA  (dès 5 ans et plus)
La photothèque de la NASA : Lune, Mars, étoiles, astronautes.

- **Recherche libre** : 5 ans et plus
- **Licence** : Images NASA, en général libres d'usage (voir la page de chaque image)
- **Mention à afficher** : Images : NASA Image and Video Library
- **Site officiel** : https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf
- **Conditions** : https://www.nasa.gov/nasa-brand-center/images-and-media/
- **Limites** : Aucune clé requise. Les descriptions sont souvent en anglais.

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Image du jour (NASA)  (dès 9 ans et plus)
L'image astronomique du jour, choisie par la NASA. Exemple d'API qui accepte une clé personnelle.

- **Recherche libre** : non (sélections du jour seulement)
- **Licence** : Images NASA (certaines appartiennent à des auteurs, indiqués)
- **Mention à afficher** : Astronomy Picture of the Day : NASA
- **Site officiel** : https://api.nasa.gov/
- **Conditions** : https://api.nasa.gov/
- **Limites** : Avec une clé personnelle : 1 000 requêtes par heure. Les textes sont en anglais.
- **Clé** : Clé NASA (facultative), facultative (valeur par défaut : `DEMO_KEY`), à obtenir sur https://api.nasa.gov/

**Installation**
1. Sans rien faire, l'outil marche avec la clé de démonstration DEMO_KEY (limitée : environ 30 requêtes par heure et 50 par jour pour tout le monde).
2. Pour ta propre clé gratuite : ouvre https://api.nasa.gov/ puis « Generate API Key ».
3. Remplis prénom, nom et e-mail. La clé s'affiche tout de suite (et arrive par e-mail).
4. Dans l'onglet « Outils » de l'Atelier, colle la clé dans le champ de cet outil puis « Enregistrer ». Elle reste sur ton appareil, jamais dans le lien de partage.
5. Clique « Tester » : tu dois voir l'image du jour.

## Météo des villes  (dès 5 ans et plus)
La météo en direct d'une ville du monde (Open-Meteo).

- **Recherche libre** : 5 ans et plus
- **Licence** : Données CC BY 4.0
- **Mention à afficher** : Météo : Open-Meteo.com (CC BY 4.0)
- **Site officiel** : https://open-meteo.com/en/docs
- **Conditions** : https://open-meteo.com/en/terms
- **Limites** : Usage non commercial uniquement, moins de 10 000 requêtes par jour.

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Livres  (dès 5 ans et plus)
Des millions de livres (Open Library, Internet Archive). Pour les moins de 13 ans, seuls les livres jeunesse sont cherchés.

- **Recherche libre** : 9 ans et plus
- **Licence** : Catalogue ouvert ; couvertures et livres selon leur statut
- **Mention à afficher** : Catalogue : Open Library (Internet Archive)
- **Site officiel** : https://openlibrary.org/developers/api
- **Conditions** : https://openlibrary.org/developers/api
- **Limites** : Environ 1 requête par seconde. Un livre peut être emprunté en ligne gratuitement sur Open Library.

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Musée de Chicago  (dès 9 ans et plus)
Chefs-d'œuvre du domaine public de l'Art Institute of Chicago. Les œuvres peuvent montrer des nus : sélection guidée avant 13 ans.

- **Recherche libre** : 13 ans et plus
- **Licence** : Domaine public (œuvres filtrées)
- **Mention à afficher** : Œuvres du domaine public : Art Institute of Chicago
- **Site officiel** : https://api.artic.edu/docs/
- **Conditions** : https://www.artic.edu/terms
- **Limites** : Environ 60 requêtes par minute. Seules les œuvres du domaine public sont affichées.

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Musée de Cleveland  (dès 9 ans et plus)
Œuvres en CC0 (libres de tout droit) du Cleveland Museum of Art.

- **Recherche libre** : 13 ans et plus
- **Licence** : CC0 (domaine public)
- **Mention à afficher** : Œuvres CC0 : The Cleveland Museum of Art
- **Site officiel** : https://openaccess-api.clevelandart.org/
- **Conditions** : https://www.clevelandart.org/open-access
- **Limites** : Aucune clé. Sélection guidée avant 13 ans.

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Images libres  (dès 5 ans et plus)
Photos et dessins sous licences Creative Commons (Openverse). Contenu pour adultes exclu.

- **Recherche libre** : 9 ans et plus
- **Licence** : Creative Commons (variable selon l'image)
- **Mention à afficher** : Openverse : images Creative Commons, auteur indiqué sur chaque carte
- **Site officiel** : https://api.openverse.org/
- **Conditions** : https://docs.openverse.org/api/reference/made_with_ov.html
- **Limites** : Sans clé : quelques requêtes par minute. Cite l'auteur si tu réutilises une image.

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Recettes du monde  (dès 5 ans et plus)
Des recettes de partout avec photos (TheMealDB). Textes en anglais.

- **Recherche libre** : 9 ans et plus
- **Licence** : Base communautaire ; clé de test publique « 1 » pour le développement
- **Mention à afficher** : Recettes : TheMealDB
- **Site officiel** : https://www.themealdb.com/api.php
- **Conditions** : https://www.themealdb.com/api.php
- **Limites** : La clé « 1 » est partagée par tous : prévois que l'outil puisse être indisponible.
- **Clé** : Clé TheMealDB (facultative), facultative (valeur par défaut : `1`), à obtenir sur https://www.themealdb.com/api.php

**Installation**
1. Sans rien faire, l'outil utilise la clé de test publique « 1 », prévue par TheMealDB pour le développement et les essais.
2. Pour un usage public et durable, ouvre https://www.themealdb.com/api.php et suis la section qui explique comment obtenir une clé personnelle (soutien au projet).
3. Colle ta clé dans le champ de cet outil, onglet « Outils » de l'Atelier, puis « Enregistrer ». Elle reste sur ton appareil.
4. Clique « Tester » : tu dois voir des recettes.

## Quiz  (dès 5 ans et plus)
Des questions à choix multiples (Open Trivia Database). Questions en anglais, difficulté facile avant 13 ans.

- **Recherche libre** : non (sélections du jour seulement)
- **Licence** : CC BY-SA 4.0
- **Mention à afficher** : Questions : Open Trivia Database (CC BY-SA 4.0)
- **Site officiel** : https://opentdb.com/api_config.php
- **Conditions** : https://opentdb.com/
- **Limites** : 1 requête toutes les 5 secondes. Catégories limitées : culture, sciences, maths, géographie, histoire, art, animaux.

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Jeux gratuits  (dès 13 ans et plus)
Jeux gratuits sur PC et navigateur (FreeToGame). Certains sont violents : réservé aux 13 ans et plus.

- **Recherche libre** : 13 ans et plus
- **Licence** : Catalogue ; les jeux restent à leurs éditeurs
- **Mention à afficher** : Catalogue : FreeToGame.com (lien obligatoire vers le site)
- **Site officiel** : https://www.freetogame.com/api-doc
- **Conditions** : https://www.freetogame.com/api-doc
- **Limites** : Maximum 10 requêtes par seconde. L'API demande de citer FreeToGame.com et de lier vers lui.

**Installation**
1. Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.
2. Coche l'outil quand tu crées ou modifies ta planète.
3. Clique « Tester » pour vérifier qu'elle répond depuis ton appareil.

## Ajouter un nouvel outil (développeurs)
1. **Légal d'abord** : API officielle, offre gratuite, conditions qui autorisent l'usage depuis un site public. Pas de scraping, pas de contenu protégé (personnages, musiques complètes, jeux commerciaux).
2. **CORS** : vérifie qu'un navigateur peut l'appeler directement :
   `curl -s -D - -o /dev/null -H "Origin: https://ladrop974.github.io" "<url de l'API>" | grep -i access-control-allow-origin`
   Vérifie aussi que l'API n'est **pas dépréciée** (lis le corps de la réponse, pas seulement le code HTTP).
3. **Code** : copie un connecteur de `js/catalog.js`. Renseigne `minAge` / `searchMinAge`, licence, mention, liens officiels https, `guide`, `limits`, puis `search(q, {band, key})` et `discover({band, key})` qui renvoient `{title, sub, img, audio, url, credit}`. Ne contourne jamais `run()`.
4. **Thème** : ajoute son id dans un thème de `THEMES`.
5. **Tests** : `node --test tests/*.test.mjs` (structure, âge) puis `node tests/connectors_live.mjs` (appels réels).
6. **Régénère ce guide** : `node tools/gen_guide.mjs`.
