// Catalogue des connecteurs : API officielles, gratuites, utilisables depuis un navigateur (CORS vérifié le 2026-10-05).
// Chaque connecteur déclare son âge minimum, sa licence, son guide d'installation et ses fonctions search/discover.
// Les résultats passent TOUJOURS par run() : filtre d'âge, liens https uniquement, textes tronqués.
import { getJSON } from "./worlds/common.js";
import { bandOf, cleanQuery, sanitizeItem } from "./policy.js";

const enc = encodeURIComponent;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const cache = {};
const once = (k, fn) => (cache[k] ??= fn().catch((e) => { delete cache[k]; throw e; }));

const NO_KEY = ["Rien à installer : cette API est ouverte, elle n'a besoin d'aucune clé.", "Coche l'outil quand tu crées ou modifies ta planète.", "Clique « Tester » pour vérifier qu'elle répond depuis ton appareil."];

/** Fabrique discover() à partir de search() et d'une liste de mots choisis à la main (sûrs pour les enfants). */
const seeded = (search, seeds) => (ctx) => search(pick(seeds), ctx);

const WMO = (c) =>
  c === 0 ? ["sun", "Ciel dégagé"] : c <= 3 ? ["cloudsun", "Nuageux"] : c <= 48 ? ["fog", "Brouillard"] : c <= 57 ? ["rain", "Bruine"] : c <= 67 ? ["rain", "Pluie"]
    : c <= 77 ? ["snow", "Neige"] : c <= 82 ? ["rain", "Averses"] : ["storm", "Orage"];

/* ---------------- Musique ---------------- */
const itunes = {
  id: "itunes", name: "Extraits Apple Music", glyph: "headphones", minAge: 5, searchMinAge: 9,
  about: "Extraits de 30 secondes de millions de chansons (via l'iTunes Search API d'Apple).",
  official: "https://performance-partners.apple.com/search-api", terms: "https://www.apple.com/legal/internet-services/itunes/",
  license: "Extraits fournis par Apple ; liens vers Apple Music", attribution: "Extraits et pochettes : Apple (iTunes Search API)",
  guide: NO_KEY, limits: "Environ 20 requêtes par minute et par appareil. Seuls des extraits de 30 s sont lisibles.",
  async search(q, { band }) {
    const d = await getJSON(`https://itunes.apple.com/search?term=${enc(q)}&media=music&entity=song&limit=12&country=FR&explicit=${band < 18 ? "No" : "Yes"}`);
    return (d.results || []).map((r) => ({
      title: r.trackName, sub: `${r.artistName} · ${r.collectionName || ""}`, img: (r.artworkUrl100 || "").replace("100x100", "300x300"), audio: r.previewUrl, url: r.trackViewUrl,
    }));
  },
};
itunes.discover = seeded(itunes.search, ["comptine", "lullaby", "piano classique", "disney", "jack johnson"]);

const openverseAudio = {
  id: "openverse_audio", name: "Sons libres", glyph: "piano", minAge: 5, searchMinAge: 9,
  about: "Musiques et bruitages sous licences Creative Commons (Openverse, WordPress.org).",
  official: "https://api.openverse.org/", terms: "https://docs.openverse.org/api/reference/made_with_ov.html",
  license: "Creative Commons (variable selon l'œuvre)", attribution: "Openverse : œuvres sous licences Creative Commons, auteur indiqué sur chaque carte",
  guide: NO_KEY, limits: "Sans clé : quelques requêtes par minute. Respecte la licence indiquée sur chaque carte (auteur à citer).",
  async search(q) {
    const d = await getJSON(`https://api.openverse.org/v1/audio/?q=${enc(q)}&page_size=12&mature=false`);
    return (d.results || []).map((r) => ({
      title: r.title, sub: `${r.creator || "Auteur inconnu"} · CC ${String(r.license || "").toUpperCase()} ${r.license_version || ""}`.trim(),
      img: r.thumbnail, audio: r.url, url: r.foreign_landing_url, credit: r.creator, license: `CC ${String(r.license || "").toUpperCase()}`,
    }));
  },
};
openverseAudio.discover = seeded(openverseAudio.search, ["piano", "guitar", "flute", "lullaby", "birds", "rain", "drums"]);

const musicbrainz = {
  id: "musicbrainz", name: "Encyclopédie musicale", glyph: "disc", minAge: 9, searchMinAge: 9,
  about: "Albums, artistes et années de sortie (MusicBrainz, base ouverte).",
  official: "https://musicbrainz.org/doc/MusicBrainz_API", terms: "https://metabrainz.org/api",
  license: "Données CC0 ; pochettes Cover Art Archive", attribution: "Données : MusicBrainz (CC0) · Pochettes : Cover Art Archive",
  guide: NO_KEY, limits: "1 requête par seconde. L'API demande un nom d'application : le navigateur n'en envoie pas, reste raisonnable.",
  async search(q) {
    const d = await getJSON(`https://musicbrainz.org/ws/2/release-group/?query=${enc(q)}&fmt=json&limit=12`);
    return (d["release-groups"] || []).map((r) => ({
      title: r.title,
      sub: [(r["artist-credit"] || []).map((a) => a.name).join(", "), r["primary-type"], (r["first-release-date"] || "").slice(0, 4)].filter(Boolean).join(" · "),
      img: `https://coverartarchive.org/release-group/${r.id}/front-250`, url: `https://musicbrainz.org/release-group/${r.id}`,
    }));
  },
};
musicbrainz.discover = seeded(musicbrainz.search, ["Mozart", "Vivaldi", "Beatles", "Stromae", "Daft Punk", "Ravel"]);

const radio = {
  id: "radiobrowser", name: "Radios du monde", glyph: "radio", minAge: 13, searchMinAge: 13,
  about: "Des milliers de radios en direct (Radio Browser). Contenu non filtré : réservé aux 13 ans et plus.",
  official: "https://www.radio-browser.info/", terms: "https://api.radio-browser.info/",
  license: "Annuaire libre ; chaque radio reste à son diffuseur", attribution: "Annuaire : Radio Browser",
  guide: NO_KEY, limits: "Seules les radios en https sont lues (le navigateur bloque les autres).",
  async search(q) {
    const d = await getJSON(`https://de1.api.radio-browser.info/json/stations/search?name=${enc(q)}&limit=24&hidebroken=true&order=clickcount&reverse=true`);
    return radioItems(d);
  },
  async discover() {
    return radioItems(await getJSON(`https://de1.api.radio-browser.info/json/stations/search?tag=${pick(["jazz", "classical", "pop", "lofi"])}&limit=24&hidebroken=true&order=clickcount&reverse=true`));
  },
};
const radioItems = (d) =>
  (d || []).filter((r) => String(r.url_resolved).startsWith("https://")).slice(0, 12).map((r) => ({
    title: r.name, sub: `${r.country || ""} · ${String(r.tags || "").split(",").slice(0, 3).join(", ")}`, audio: r.url_resolved, img: r.favicon, url: r.homepage,
  }));

/* ---------------- Nature & animaux ---------------- */
let breeds;
const dog = {
  id: "dogceo", name: "Chiens du monde", glyph: "paw", minAge: 5, searchMinAge: 5,
  about: "Des photos de chiens, par race (Dog CEO, images du Stanford Dogs Dataset).",
  official: "https://dog.ceo/dog-api/", terms: "https://dog.ceo/dog-api/about",
  license: "Images libres du Stanford Dogs Dataset", attribution: "Photos : Dog CEO API / Stanford Dogs Dataset",
  guide: NO_KEY, limits: "Aucune limite annoncée. Les noms de races sont en anglais (ex. : poodle, husky, beagle).",
  async search(q) {
    breeds ||= await once("breeds", async () => {
      const d = (await getJSON("https://dog.ceo/api/breeds/list/all")).message || {};
      return Object.entries(d).flatMap(([b, subs]) => (subs.length ? subs.map((s) => ({ path: `${b}/${s}`, name: `${s} ${b}` })) : [{ path: b, name: b }]));
    });
    const k = fold(q);
    const hit = breeds.filter((b) => fold(b.name).includes(k)).slice(0, 2);
    const lists = await Promise.all(hit.map((h) => getJSON(`https://dog.ceo/api/breed/${h.path}/images/random/6`).then((r) => r.message.map((img) => ({ img, name: h.name })))));
    return lists.flat().map((x) => ({ title: x.name, sub: "Dog CEO", img: x.img, url: "https://dog.ceo/dog-api/" }));
  },
  async discover() {
    const d = await getJSON("https://dog.ceo/api/breeds/image/random/9");
    return d.message.map((img) => {
      const b = (img.split("/breeds/")[1] || "").split("/")[0].split("-").reverse().join(" ");
      return { title: b || "Chien", sub: "Dog CEO", img, url: "https://dog.ceo/dog-api/" };
    });
  },
};

const inat = {
  id: "inaturalist", name: "Vivants de la planète", glyph: "flower", minAge: 5, searchMinAge: 5,
  about: "Animaux, plantes et champignons avec photos (iNaturalist, science participative).",
  official: "https://api.inaturalist.org/v1/docs/", terms: "https://www.inaturalist.org/pages/api+recommended+practices",
  license: "Photos sous licences ouvertes (auteur indiqué sur chaque carte)", attribution: "Observations et photos : iNaturalist, auteurs cités sur chaque carte",
  guide: NO_KEY, limits: "Environ 60 requêtes par minute. Les photos ont chacune leur licence : l'auteur est affiché.",
  async search(q) {
    const d = await getJSON(`https://api.inaturalist.org/v1/taxa?q=${enc(q)}&per_page=12&locale=fr&is_active=true`);
    return (d.results || []).filter((t) => t.default_photo).map((t) => ({
      title: t.preferred_common_name || t.name, sub: `${t.name} · ${t.rank || ""}`, img: t.default_photo.medium_url || t.default_photo.square_url,
      url: `https://www.inaturalist.org/taxa/${t.id}`, credit: t.default_photo.attribution,
    }));
  },
};
inat.discover = seeded(inat.search, ["lion", "dauphin", "panda", "toucan", "papillon", "tortue", "baleine", "hibou"]);

const wiki = {
  id: "wikipedia", name: "Encyclopédie", glyph: "book", minAge: 9, searchMinAge: 9,
  about: "Les articles de Wikipédia en français : résumé, image et lien.",
  official: "https://www.mediawiki.org/wiki/API:Main_page", terms: "https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use",
  license: "CC BY-SA 4.0", attribution: "Textes : Wikipédia (CC BY-SA 4.0), auteurs sur la page de chaque article",
  guide: NO_KEY, limits: "Reste raisonnable (moins de 200 requêtes par seconde pour toute l'application !). Le contenu est écrit par des volontaires : un adulte peut vérifier.",
  async search(q) {
    const d = await getJSON(`https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${enc(q)}&gsrlimit=10&prop=pageimages%7Cextracts&exintro=1&explaintext=1&exchars=180&exlimit=10&piprop=thumbnail&pithumbsize=300&format=json&origin=*`);
    return Object.values(d.query?.pages || {}).sort((a, b) => a.index - b.index).map((p) => ({
      title: p.title, sub: p.extract, img: p.thumbnail?.source, url: `https://fr.wikipedia.org/?curid=${p.pageid}`, license: "CC BY-SA 4.0",
    }));
  },
};
wiki.discover = seeded(wiki.search, ["Lion", "Volcan", "Système solaire", "Dinosaure", "Baleine bleue", "Pyramide", "Arc-en-ciel", "Tortue"]);

/* ---------------- Espace & météo ---------------- */
const nasaImages = {
  id: "nasa_images", name: "Photos de la NASA", glyph: "rocket", minAge: 5, searchMinAge: 5,
  about: "La photothèque de la NASA : Lune, Mars, étoiles, astronautes.",
  official: "https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf", terms: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
  license: "Images NASA, en général libres d'usage (voir la page de chaque image)", attribution: "Images : NASA Image and Video Library",
  guide: NO_KEY, limits: "Aucune clé requise. Les descriptions sont souvent en anglais.",
  async search(q) {
    const d = await getJSON(`https://images-api.nasa.gov/search?q=${enc(q)}&media_type=image`);
    return (d.collection?.items || []).slice(0, 12).map((it) => {
      const m = it.data?.[0] || {};
      return { title: m.title, sub: String(m.description || "").slice(0, 160), img: it.links?.[0]?.href, url: `https://images.nasa.gov/details/${enc(m.nasa_id || "")}`, credit: m.center ? `NASA / ${m.center}` : "NASA" };
    });
  },
};
nasaImages.discover = seeded(nasaImages.search, ["moon", "mars", "saturn", "galaxy", "astronaut", "earth from space"]);

const apod = {
  id: "nasa_apod", name: "Image du jour (NASA)", glyph: "telescope", minAge: 9, searchMinAge: 99,
  about: "L'image astronomique du jour, choisie par la NASA. Exemple d'API qui accepte une clé personnelle.",
  official: "https://api.nasa.gov/", terms: "https://api.nasa.gov/",
  license: "Images NASA (certaines appartiennent à des auteurs, indiqués)", attribution: "Astronomy Picture of the Day : NASA",
  key: { id: "nasa", label: "Clé NASA (facultative)", optional: true, demo: "DEMO_KEY", signup: "https://api.nasa.gov/" },
  guide: [
    "Sans rien faire, l'outil marche avec la clé de démonstration DEMO_KEY (limitée : environ 30 requêtes par heure et 50 par jour pour tout le monde).",
    "Pour ta propre clé gratuite : ouvre https://api.nasa.gov/ puis « Generate API Key ».",
    "Remplis prénom, nom et e-mail. La clé s'affiche tout de suite (et arrive par e-mail).",
    "Dans l'onglet « Outils » de l'Atelier, colle la clé dans le champ de cet outil puis « Enregistrer ». Elle reste sur ton appareil, jamais dans le lien de partage.",
    "Clique « Tester » : tu dois voir l'image du jour.",
  ],
  limits: "Avec une clé personnelle : 1 000 requêtes par heure. Les textes sont en anglais.",
  async discover({ key }) {
    const d = await getJSON(`https://api.nasa.gov/planetary/apod?api_key=${enc(key || "DEMO_KEY")}`);
    return [{ title: d.title, sub: String(d.explanation || "").slice(0, 200), img: d.media_type === "image" ? d.url : d.thumbnail_url, url: "https://apod.nasa.gov/apod/astropix.html", credit: d.copyright ? `© ${String(d.copyright).trim()}` : "NASA" }];
  },
};

const meteo = {
  id: "openmeteo", name: "Météo des villes", glyph: "cloudsun", minAge: 5, searchMinAge: 5,
  about: "La météo en direct d'une ville du monde (Open-Meteo).",
  official: "https://open-meteo.com/en/docs", terms: "https://open-meteo.com/en/terms",
  license: "Données CC BY 4.0", attribution: "Météo : Open-Meteo.com (CC BY 4.0)",
  guide: NO_KEY, limits: "Usage non commercial uniquement, moins de 10 000 requêtes par jour.",
  async search(q) {
    const g = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${enc(q)}&count=3&language=fr`);
    const out = await Promise.all((g.results || []).map(async (c) => {
      const w = (await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${c.latitude}&longitude=${c.longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`)).current;
      const [glyph, txt] = WMO(w.weather_code);
      return { title: `${c.name}${c.country ? ", " + c.country : ""}`, sub: `${Math.round(w.temperature_2m)} °C · ${txt} · vent ${Math.round(w.wind_speed_10m)} km/h`, glyph, url: "https://open-meteo.com/" };
    }));
    return out;
  },
};
meteo.discover = seeded(meteo.search, ["Paris", "Saint-Denis", "Tokyo", "Montréal", "Dakar", "Rio de Janeiro"]);

/* ---------------- Livres ---------------- */
const books = {
  id: "openlibrary", name: "Livres", glyph: "library", minAge: 5, searchMinAge: 9,
  about: "Des millions de livres (Open Library, Internet Archive). Pour les moins de 13 ans, seuls les livres jeunesse sont cherchés.",
  official: "https://openlibrary.org/developers/api", terms: "https://openlibrary.org/developers/api",
  license: "Catalogue ouvert ; couvertures et livres selon leur statut", attribution: "Catalogue : Open Library (Internet Archive)",
  guide: NO_KEY, limits: "Environ 1 requête par seconde. Un livre peut être emprunté en ligne gratuitement sur Open Library.",
  async search(q, { band }) {
    const d = await getJSON(`https://openlibrary.org/search.json?q=${enc(band < 13 ? `${q} subject:juvenile` : q)}&limit=12&fields=key,title,author_name,cover_i,first_publish_year`);
    return (d.docs || []).map((b) => ({
      title: b.title, sub: `${(b.author_name || []).slice(0, 2).join(", ")} ${b.first_publish_year ? "· " + b.first_publish_year : ""}`.trim(),
      img: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : "", url: `https://openlibrary.org${b.key}`,
    }));
  },
  async discover() {
    const d = await getJSON(`https://openlibrary.org/subjects/juvenile_fiction.json?limit=12&offset=${Math.floor(Math.random() * 150)}`);
    return (d.works || []).map((b) => ({
      title: b.title, sub: (b.authors || []).map((a) => a.name).slice(0, 2).join(", "), img: b.cover_id ? `https://covers.openlibrary.org/b/id/${b.cover_id}-M.jpg` : "", url: `https://openlibrary.org${b.key}`,
    }));
  },
};

/* ---------------- Art & images ---------------- */
const artic = {
  id: "artic", name: "Musée de Chicago", glyph: "image", minAge: 9, searchMinAge: 13,
  about: "Chefs-d'œuvre du domaine public de l'Art Institute of Chicago. Les œuvres peuvent montrer des nus : sélection guidée avant 13 ans.",
  official: "https://api.artic.edu/docs/", terms: "https://www.artic.edu/terms",
  license: "Domaine public (œuvres filtrées)", attribution: "Œuvres du domaine public : Art Institute of Chicago",
  guide: NO_KEY, limits: "Environ 60 requêtes par minute. Seules les œuvres du domaine public sont affichées.",
  async search(q) {
    const d = await getJSON(`https://api.artic.edu/api/v1/artworks/search?q=${enc(q)}&limit=12&fields=id,title,artist_display,image_id,date_display&query%5Bterm%5D%5Bis_public_domain%5D=true`);
    return (d.data || []).filter((a) => a.image_id).map((a) => ({
      title: a.title, sub: `${String(a.artist_display || "").split("\n")[0]} ${a.date_display ? "· " + a.date_display : ""}`.trim(),
      img: `https://www.artic.edu/iiif/2/${a.image_id}/full/400,/0/default.jpg`, url: `https://www.artic.edu/artworks/${a.id}`, license: "Domaine public",
    }));
  },
};
artic.discover = seeded(artic.search, ["cat", "flower", "landscape", "boat", "horse", "bird"]);

const cleveland = {
  id: "cleveland", name: "Musée de Cleveland", glyph: "crown", minAge: 9, searchMinAge: 13,
  about: "Œuvres en CC0 (libres de tout droit) du Cleveland Museum of Art.",
  official: "https://openaccess-api.clevelandart.org/", terms: "https://www.clevelandart.org/open-access",
  license: "CC0 (domaine public)", attribution: "Œuvres CC0 : The Cleveland Museum of Art",
  guide: NO_KEY, limits: "Aucune clé. Sélection guidée avant 13 ans.",
  async search(q) {
    const d = await getJSON(`https://openaccess-api.clevelandart.org/api/artworks/?q=${enc(q)}&limit=12&has_image=1&cc0=1`);
    return (d.data || []).filter((a) => a.images?.web?.url).map((a) => ({
      title: a.title, sub: `${a.creators?.[0]?.description?.split("(")[0].trim() || ""} ${a.creation_date ? "· " + a.creation_date : ""}`.trim(), img: a.images.web.url, url: a.url, license: "CC0",
    }));
  },
};
cleveland.discover = seeded(cleveland.search, ["cat", "flower", "bird", "ship", "horse", "mask"]);

const openverseImages = {
  id: "openverse_images", name: "Images libres", glyph: "sparkles", minAge: 5, searchMinAge: 9,
  about: "Photos et dessins sous licences Creative Commons (Openverse). Contenu pour adultes exclu.",
  official: "https://api.openverse.org/", terms: "https://docs.openverse.org/api/reference/made_with_ov.html",
  license: "Creative Commons (variable selon l'image)", attribution: "Openverse : images Creative Commons, auteur indiqué sur chaque carte",
  guide: NO_KEY, limits: "Sans clé : quelques requêtes par minute. Cite l'auteur si tu réutilises une image.",
  async search(q) {
    const d = await getJSON(`https://api.openverse.org/v1/images/?q=${enc(q)}&page_size=12&mature=false`);
    return (d.results || []).map((r) => ({
      title: r.title || q, sub: `${r.creator || "Auteur inconnu"} · CC ${String(r.license || "").toUpperCase()} ${r.license_version || ""}`.trim(),
      img: r.thumbnail || r.url, url: r.foreign_landing_url, credit: r.creator, license: `CC ${String(r.license || "").toUpperCase()}`,
    }));
  },
};
openverseImages.discover = seeded(openverseImages.search, ["cat", "mountain", "ocean", "flower", "castle", "butterfly"]);

/* ---------------- Cuisine ---------------- */
const meal = {
  id: "mealdb", name: "Recettes du monde", glyph: "chef", minAge: 5, searchMinAge: 9,
  about: "Des recettes de partout avec photos (TheMealDB). Textes en anglais.",
  official: "https://www.themealdb.com/api.php", terms: "https://www.themealdb.com/api.php",
  license: "Base communautaire ; clé de test publique « 1 » pour le développement", attribution: "Recettes : TheMealDB",
  key: { id: "mealdb", label: "Clé TheMealDB (facultative)", optional: true, demo: "1", signup: "https://www.themealdb.com/api.php" },
  guide: [
    "Sans rien faire, l'outil utilise la clé de test publique « 1 », prévue par TheMealDB pour le développement et les essais.",
    "Pour un usage public et durable, ouvre https://www.themealdb.com/api.php et suis la section qui explique comment obtenir une clé personnelle (soutien au projet).",
    "Colle ta clé dans le champ de cet outil, onglet « Outils » de l'Atelier, puis « Enregistrer ». Elle reste sur ton appareil.",
    "Clique « Tester » : tu dois voir des recettes.",
  ],
  limits: "La clé « 1 » est partagée par tous : prévois que l'outil puisse être indisponible.",
  async search(q, { key }) {
    const d = await getJSON(`https://www.themealdb.com/api/json/v1/${enc(key || "1")}/search.php?s=${enc(q)}`);
    return (d.meals || []).slice(0, 12).map((m) => ({ title: m.strMeal, sub: `${m.strCategory || ""} · ${m.strArea || ""}`, img: m.strMealThumb, url: `https://www.themealdb.com/meal/${m.idMeal}` }));
  },
};
meal.discover = seeded(meal.search, ["chicken", "cake", "pasta", "soup", "rice", "fish", "pancake"]);

/* ---------------- Quiz et jeux ---------------- */
const trivia = {
  id: "opentdb", name: "Quiz", glyph: "brain", minAge: 5, searchMinAge: 99,
  about: "Des questions à choix multiples (Open Trivia Database). Questions en anglais, difficulté facile avant 13 ans.",
  official: "https://opentdb.com/api_config.php", terms: "https://opentdb.com/",
  license: "CC BY-SA 4.0", attribution: "Questions : Open Trivia Database (CC BY-SA 4.0)",
  guide: NO_KEY, limits: "1 requête toutes les 5 secondes. Catégories limitées : culture, sciences, maths, géographie, histoire, art, animaux.",
  async discover({ band }) {
    const cat = pick([9, 17, 19, 22, 23, 25, 27]);
    const d = await getJSON(`https://opentdb.com/api.php?amount=5&category=${cat}&difficulty=${band < 13 ? "easy" : "medium"}&type=multiple&encode=url3986`);
    if (d.response_code === 5) throw new Error("Trop de quiz d'un coup : réessaie dans 5 secondes.");
    const dec = (s) => decodeURIComponent(s);
    return (d.results || []).map((r) => ({ kind: "quiz", q: dec(r.question), correct: dec(r.correct_answer), answers: shuffle([r.correct_answer, ...r.incorrect_answers].map(dec)) }));
  },
};

const f2p = {
  id: "freetogame", name: "Jeux gratuits", glyph: "gamepad", minAge: 13, searchMinAge: 13,
  about: "Jeux gratuits sur PC et navigateur (FreeToGame). Certains sont violents : réservé aux 13 ans et plus.",
  official: "https://www.freetogame.com/api-doc", terms: "https://www.freetogame.com/api-doc",
  license: "Catalogue ; les jeux restent à leurs éditeurs", attribution: "Catalogue : FreeToGame.com (lien obligatoire vers le site)",
  guide: NO_KEY, limits: "Maximum 10 requêtes par seconde. L'API demande de citer FreeToGame.com et de lier vers lui.",
  async all() {
    return once("f2p", () => getJSON("https://www.freetogame.com/api/games?sort-by=popularity", 20000));
  },
  card: (g) => ({ title: g.title, sub: `${g.genre} · ${g.platform}`, img: g.thumbnail, url: g.game_url }),
  async search(q) {
    const k = fold(q);
    return (await this.all()).filter((g) => fold(`${g.title} ${g.genre}`).includes(k)).slice(0, 12).map(this.card);
  },
  async discover() {
    return (await this.all()).slice(0, 12).map(this.card);
  },
};

export const CONNECTORS = [itunes, openverseAudio, musicbrainz, radio, dog, inat, wiki, nasaImages, apod, meteo, books, artic, cleveland, openverseImages, meal, trivia, f2p];
export const byId = (id) => CONNECTORS.find((c) => c.id === id);
export const CONNECTOR_IDS = CONNECTORS.map((c) => c.id);

const T = (id, name, glyph, color, conns) => ({ id, name, glyph, color, conns, minAge: Math.min(...conns.map((c) => byId(c).minAge)) });
/** Thèmes proposés : un thème = une sélection d'outils prête à l'emploi. */
export const THEMES = [
  T("musique", "Musique", "music", "#f472b6", ["itunes", "openverse_audio", "musicbrainz", "radiobrowser"]),
  T("nature", "Nature et animaux", "leaf", "#34d399", ["dogceo", "inaturalist", "wikipedia", "openmeteo"]),
  T("espace", "Espace et science", "rocket", "#38bdf8", ["nasa_images", "nasa_apod", "wikipedia", "openmeteo"]),
  T("livres", "Livres et histoires", "book", "#a78bfa", ["openlibrary", "wikipedia"]),
  T("art", "Art et images", "palette", "#fbbf24", ["openverse_images", "artic", "cleveland"]),
  T("cuisine", "Cuisine du monde", "chef", "#fb923c", ["mealdb", "wikipedia"]),
  T("quiz", "Quiz et culture", "brain", "#facc15", ["opentdb", "wikipedia"]),
  T("monde", "Tour du monde", "globe", "#22d3ee", ["openmeteo", "wikipedia", "inaturalist", "nasa_images"]),
  T("jeux", "Jeux", "gamepad", "#e879f9", ["freetogame"]),
];
export const THEME_IDS = THEMES.map((t) => t.id);

/**
 * Seule porte d'entrée vers les API : applique l'âge, nettoie la recherche, filtre et assainit les résultats.
 * mode = "search" | "discover". Lance une Error lisible si l'API est indisponible.
 */
export async function run(conn, mode, q, ctx) {
  const band = bandOf(ctx.band);
  if (conn.minAge > band) return [];
  let raw;
  if (mode === "search") {
    if (!conn.search || conn.searchMinAge > band) return [];
    const c = cleanQuery(q, band);
    if (!c.ok) throw new Error(c.reason);
    raw = await conn.search(c.q, { ...ctx, band });
  } else {
    raw = await conn.discover({ ...ctx, band });
  }
  return (Array.isArray(raw) ? raw : []).map((r) => sanitizeItem(r, conn.name, band)).filter(Boolean);
}
