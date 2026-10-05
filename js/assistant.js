// Assistant de recherche : comprend des questions courantes en français (sans IA externe, sans clé) et les route
// vers les bons modules. Logique pure (testée). Exemple : « ai-je reçu des mails et quel temps fait-il à Paris ? »
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const RE = {
  weather: /\b(meteo|temps|pleut|pleuvoir|pluie|soleil|chaud|froid|temperature|neige|vent|orage|fait[- ]il beau)\b/,
  mail: /\b(mail|mails|email|emails|e-mail|courrier|courriers|gmail|boite de reception|messagerie)\b/,
  drive: /\b(drive|fichier|fichiers|document|documents|dossier google)\b/,
};

/** Ville demandée : « à Paris », « pour Saint-Denis », « au Japon »… (null si absente). */
export function cityOf(question) {
  const m = String(question).match(/(?:^|\s)(?:à|a|au|en|pour|sur|de)\s+(?:la\s+|le\s+|l')?([\p{L}][\p{L}' -]{1,30}?)\s*[?!.]*\s*$/u);
  const c = m?.[1]?.trim();
  if (!c || /^(?:mon|ma|mes|le|la|les|un|une|des|moi)\b/i.test(fold(c)) || RE.mail.test(fold(c)) || RE.weather.test(fold(c))) return null;
  return c;
}

/** Mot-clé pour le Drive : ce qui suit « sur mon drive », « fichier(s) », « document(s) ». */
export function driveTerm(question) {
  const q = fold(question);
  const m = q.match(/(?:fichiers?|documents?)\s+(?:(?:sur|de|du|des|nommes?|appeles?|contenant)\s+)?([a-z0-9' -]{2,40})\s*\??$/);
  const t = m?.[1]?.replace(/\b(mon|ma|mes|drive|google|le|la|les)\b/g, "").trim();
  return t || "";
}

/** Question -> liste d'intentions ordonnées { kind: "weather" | "mail" | "drive" | "search", ... }. */
export function parse(question) {
  const raw = String(question ?? "").trim().slice(0, 200);
  const q = fold(raw);
  const found = [];
  const at = (re, kind) => {
    const m = q.match(re);
    if (m) found.push({ kind, pos: m.index });
  };
  at(RE.weather, "weather");
  at(RE.mail, "mail");
  at(RE.drive, "drive");
  found.sort((a, b) => a.pos - b.pos);
  const intents = found.map(({ kind }) => {
    if (kind === "weather") return { kind, city: cityOf(raw) };
    if (kind === "drive") return { kind, q: driveTerm(raw) };
    return { kind };
  });
  return intents.length ? intents : [{ kind: "search", q: raw }];
}
