// Accès au serveur d'Univers (Supabase). La clé ci-dessous est « publique » par conception :
// elle n'ouvre rien toute seule. Les droits viennent de la clé maître / de la clé de galaxie, vérifiées dans la base.
export const SERVER = "https://dhegecuktqhrnjcdlokd.supabase.co";
const PUBLIC_KEY = "sb_publishable_71DnfuXPO0_DZ626vA47uQ_TcrgC987";

async function post(path, body) {
  let res;
  try {
    res = await fetch(SERVER + path, {
      method: "POST",
      headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Pas de connexion au serveur d'Univers.");
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text.slice(0, 200) };
  }
  if (!res.ok) throw new Error(data.message || data.error || `Erreur ${res.status}`);
  if (data && data.error) throw new Error(data.error);
  return data;
}

export const rpc = (name, args) => post("/rest/v1/rpc/" + name, args);
export const files = (body) => post("/functions/v1/files", body);

const EXT_MIME = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  txt: "text/plain", md: "text/plain", mp3: "audio/mpeg", mp4: "video/mp4", webm: "video/webm",
};
export const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.mp3,.mp4,.webm";
export const MAX_FILE = 10 * 1024 * 1024;

export function mimeOf(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return EXT_MIME[ext] || (Object.values(EXT_MIME).includes(file.type) ? file.type : "");
}

/** Envoie un fichier : lien d'envoi → dépôt → validation. Renvoie l'élément créé. */
export async function uploadFile(slug, secret, file, { parent_id = null, label, visibility = "private" } = {}) {
  const mime = mimeOf(file);
  if (!mime) throw new Error("Type non accepté (PDF, images, texte, mp3, mp4, webm).");
  if (file.size > MAX_FILE) throw new Error("Fichier trop lourd (10 Mo maximum).");
  const prep = await files({
    action: "prepare", slug, secret,
    item: { label: label || file.name, mime, size: file.size, visibility, parent_id },
  });
  const fd = new FormData();
  fd.append("cacheControl", "3600");
  fd.append("", file);
  const up = await fetch(prep.upload.url, { method: "PUT", body: fd, headers: { apikey: PUBLIC_KEY } });
  if (!up.ok) throw new Error("L'envoi du fichier a échoué.");
  const done = await files({ action: "finish", slug, secret, item_id: prep.item_id });
  return done.item;
}

/** Lien temporaire (60 s) vers un fichier visible par ce visiteur. */
export const downloadUrl = (slug, key, itemId) => files({ action: "download", slug, key: key || null, item_id: itemId });
