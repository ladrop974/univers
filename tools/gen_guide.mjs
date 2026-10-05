// Génère docs/CONNECTEURS.md depuis js/catalog.js : le guide ne peut pas se désynchroniser du code.
// Usage : node tools/gen_guide.mjs
import { writeFileSync } from "node:fs";
import { CONNECTORS, THEMES } from "../js/catalog.js";
import { MODULES, GROUPS, STATUS } from "../js/modules.js";

const age = (n) => (n >= 18 ? "adultes" : `${n} ans et plus`);
const out = [];
out.push(`# Les outils (API) d'Univers : guide d'installation

> Fichier généré par \`node tools/gen_guide.mjs\` : ne le modifie pas à la main, change \`js/catalog.js\`.

Chaque planète utilise des **outils** : des API officielles, gratuites et légales. Dans l'application : **Atelier → Outils et API**. Pour chaque outil : guide, champ de clé (si l'outil en accepte une), bouton **Tester**.

## Les modules d'une planète
Une planète est une arborescence : **dossiers, sous-dossiers** (4 niveaux, 60 éléments) et **modules**. Chaque module affiche son état :
${Object.values(STATUS).map((v) => `- **${v.label}** : ${v.hint}`).join("\n")}

${GROUPS.map((g) => `**${g.label}** (${g.sub})\n${MODULES.filter((m) => m.group === g.id && m.kind !== "api").map((m) => `- ${m.name} : ${m.about} (dès ${age(m.minAge)}, ${STATUS[m.status()].label})`).join("\n") || "- voir la liste des outils plus bas"}`).join("\n\n")}

Gmail et Drive : voir \`docs/GOOGLE.md\`. Les jeux et mondes « Créés par un Soluniarien » sont ceux d'Univers ; la télé OTAKU vit dans SolunIA Network (lien).

## Les thèmes
| Thème | Outils | Dès |
|---|---|---|
${THEMES.map((t) => `| ${t.name} | ${t.conns.map((id) => CONNECTORS.find((c) => c.id === id).name).join(", ")} | ${age(t.minAge)} |`).join("\n")}

## Âge : comment ça protège
- Chaque joueur règle **son âge** (5-8, 9-12, 13-17, adulte) ; chaque planète a **son âge cible**. L'âge appliqué est **le plus bas des deux**.
- Un outil n'est pas utilisable avant son âge minimum (verrouillé). Les recherches libres ont leur propre âge minimum : avant, la planète propose des **sélections choisies à la main**.
- Les recherches sont filtrées (mots inadaptés, liens refusés) et **chaque résultat est filtré aussi**. Les liens non https sont supprimés.
- Limite honnête : un filtre n'est jamais parfait et l'âge est déclaratif. Un adulte doit rester présent avec les plus jeunes.

## Les clés d'API
Les clés restent **dans le navigateur de l'appareil** (jamais dans le lien de partage d'une planète, jamais envoyées à Univers). Sur un appareil partagé, supprime-les à la fin.

`);
for (const c of CONNECTORS) {
  out.push(`## ${c.name}  (dès ${age(c.minAge)})
${c.about}

- **Recherche libre** : ${c.search && c.searchMinAge <= 18 ? age(c.searchMinAge) : "non (sélections du jour seulement)"}
- **Licence** : ${c.license}
- **Mention à afficher** : ${c.attribution}
- **Site officiel** : ${c.official}
- **Conditions** : ${c.terms}
- **Limites** : ${c.limits}
${c.key ? `- **Clé** : ${c.key.label}, ${c.key.optional ? "facultative" : "obligatoire"}${c.key.demo ? ` (valeur par défaut : \`${c.key.demo}\`)` : ""}, à obtenir sur ${c.key.signup}\n` : ""}
**Installation**
${c.guide.map((s, i) => `${i + 1}. ${s}`).join("\n")}
`);
}
out.push(`## Ajouter un nouvel outil (développeurs)
1. **Légal d'abord** : API officielle, offre gratuite, conditions qui autorisent l'usage depuis un site public. Pas de scraping, pas de contenu protégé (personnages, musiques complètes, jeux commerciaux).
2. **CORS** : vérifie qu'un navigateur peut l'appeler directement :
   \`curl -s -D - -o /dev/null -H "Origin: https://ladrop974.github.io" "<url de l'API>" | grep -i access-control-allow-origin\`
   Vérifie aussi que l'API n'est **pas dépréciée** (lis le corps de la réponse, pas seulement le code HTTP).
3. **Code** : copie un connecteur de \`js/catalog.js\`. Renseigne \`minAge\` / \`searchMinAge\`, licence, mention, liens officiels https, \`guide\`, \`limits\`, puis \`search(q, {band, key})\` et \`discover({band, key})\` qui renvoient \`{title, sub, img, audio, url, credit}\`. Ne contourne jamais \`run()\`.
4. **Thème** : ajoute son id dans un thème de \`THEMES\`.
5. **Tests** : \`node --test tests/*.test.mjs\` (structure, âge) puis \`node tests/connectors_live.mjs\` (appels réels).
6. **Régénère ce guide** : \`node tools/gen_guide.mjs\`.
`);
writeFileSync(new URL("../docs/CONNECTEURS.md", import.meta.url), out.join("\n"));
console.log("docs/CONNECTEURS.md écrit :", CONNECTORS.length, "outils");
