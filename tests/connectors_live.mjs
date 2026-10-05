// Test réel (réseau requis) : chaque connecteur doit répondre avec de vrais résultats à son âge minimum.
// Usage : node tests/connectors_live.mjs   (≈ 40 s : on respecte les limites de débit des API)
import { CONNECTORS, run } from "../js/catalog.js";
// MusicBrainz refuse l'agent « node » par défaut ; un navigateur envoie le sien.
const realFetch = globalThis.fetch;
globalThis.fetch = (u, o = {}) => realFetch(u, { ...o, headers: { "User-Agent": "UniversTest/1.0 (https://ladrop974.github.io/univers/)", ...(o.headers || {}) } });
const QUERY = { openmeteo: "Paris", dogceo: "poodle", mealdb: "chicken", freetogame: "war", musicbrainz: "Mozart" };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
for (const c of CONNECTORS) {
  const rows = [];
  try {
    const d = await run(c, "discover", "", { band: c.minAge });
    rows.push(["discover", d]);
    if (c.search && c.searchMinAge <= 18) {
      await wait(c.id === "opentdb" ? 5200 : 1200);
      rows.push(["search", await run(c, "search", QUERY[c.id] || "lion", { band: Math.max(c.minAge, c.searchMinAge) })]);
    }
    for (const [mode, items] of rows) {
      const ok = items.length > 0 && items.every((i) => i.title && (!i.img || i.img.startsWith("https://")));
      if (!ok) bad++;
      console.log(`${ok ? "OK " : "KO "} ${c.id.padEnd(16)} ${mode.padEnd(8)} ${items.length} résultat(s)  ${items[0]?.title?.slice(0, 50) || ""}`);
    }
  } catch (e) {
    bad++;
    console.log(`KO  ${c.id.padEnd(16)} erreur : ${e.message}`);
  }
  await wait(1200);
}
console.log(bad ? `\n${bad} échec(s)` : "\nTout répond.");
process.exit(bad ? 1 : 0);
