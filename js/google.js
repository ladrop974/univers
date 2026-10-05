// Messagerie et fichiers personnels : Gmail et Google Drive, en LECTURE SEULE, directement depuis l'appareil.
// Protection : jeton gardé en mémoire uniquement (jamais écrit sur le disque, effacé à la fermeture ou à la déconnexion),
// aucun serveur intermédiaire, rien n'est stocké ni partagé, absent des liens de partage. Réservé aux adultes.
// Demande une identité OAuth « Client ID » Google : voir docs/GOOGLE.md. Tant qu'elle manque, seul le mode Démo existe.
import { GOOGLE_CLIENT_ID } from "./config.js";

export const SCOPES = {
  mail: "https://www.googleapis.com/auth/gmail.readonly",
  drive: "https://www.googleapis.com/auth/drive.metadata.readonly",
};
const GIS = "https://accounts.google.com/gsi/client";
const tokens = {}; // { mail: {token, exp}, drive: {...} } : mémoire seulement

export const isConfigured = () => /^[\w.-]+\.apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID || "");
export const isConnected = (kind) => !!tokens[kind] && tokens[kind].exp > Date.now();
export function disconnect(kind) {
  const t = tokens[kind]?.token;
  delete tokens[kind];
  try {
    if (t && globalThis.google?.accounts?.oauth2) globalThis.google.accounts.oauth2.revoke(t, () => {});
  } catch {
    /* révocation best-effort */
  }
}

function loadGis() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = GIS;
    s.async = true;
    s.onload = res;
    s.onerror = () => rej(new Error("Impossible de charger la connexion Google."));
    document.head.appendChild(s);
  });
}

/** Ouvre la fenêtre officielle Google. Doit être appelé depuis un clic. */
export async function connect(kind) {
  if (!isConfigured()) throw new Error("La connexion Google n'est pas encore activée sur cette installation (voir docs/GOOGLE.md).");
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = globalThis.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES[kind],
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error("Connexion Google refusée ou annulée."));
        tokens[kind] = { token: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3000) * 1000 - 30000 };
        resolve(true);
      },
      error_callback: () => reject(new Error("Connexion Google annulée.")),
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

async function gget(kind, url) {
  if (!isConnected(kind)) throw new Error("Connecte-toi d'abord à Google.");
  const r = await fetch(url, { headers: { Authorization: `Bearer ${tokens[kind].token}` } });
  if (r.status === 401 || r.status === 403) {
    delete tokens[kind];
    throw new Error("Google a refusé l'accès : reconnecte-toi.");
  }
  if (!r.ok) throw new Error(`Google a répondu ${r.status}.`);
  return r.json();
}

const header = (msg, name) => msg?.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value || "";
/** « Nom <adresse> » -> « Nom ». */
export const senderName = (from) => String(from).replace(/<.*>/, "").replace(/["']/g, "").trim() || String(from);
export const mailItem = (msg) => ({
  id: msg.id,
  from: senderName(header(msg, "from")),
  subject: header(msg, "subject") || "(sans objet)",
  date: header(msg, "date") ? new Date(header(msg, "date")).toISOString() : "",
  unread: (msg.labelIds || []).includes("UNREAD"),
});

/** Boîte de réception : nombre de non lus + 5 derniers messages (expéditeur, objet, date seulement : jamais le corps). */
export async function mailSummary() {
  const base = "https://gmail.googleapis.com/gmail/v1/users/me";
  const [label, list] = await Promise.all([gget("mail", `${base}/labels/INBOX`), gget("mail", `${base}/messages?labelIds=INBOX&maxResults=5`)]);
  const msgs = await Promise.all((list.messages || []).map((m) => gget("mail", `${base}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)));
  return { unread: Number(label.messagesUnread) || 0, items: msgs.map(mailItem), demo: false };
}

export const driveItem = (f) => ({ id: f.id, name: f.name, type: String(f.mimeType || "").split(".").pop().split("/").pop(), modified: f.modifiedTime || "", url: f.webViewLink || "" });
const escQ = (q) => String(q).replace(/\\/g, "\\\\").replace(/'/g, "\\'").slice(0, 80);

/** Recherche de fichiers par nom (métadonnées seulement : jamais le contenu). Sans mot : les plus récents. */
export async function driveSearch(q = "") {
  const query = q ? `name contains '${escQ(q)}' and trashed=false` : "trashed=false";
  const d = await gget("drive", `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=10&orderBy=modifiedTime%20desc&fields=files(id,name,mimeType,modifiedTime,webViewLink)`);
  return { items: (d.files || []).map(driveItem), demo: false };
}

/** Données d'exemple, toujours signalées « Démo » à l'écran. */
export const DEMO_MAIL = {
  demo: true,
  unread: 2,
  items: [
    { id: "d1", from: "Camille (exemple)", subject: "Sortie au parc samedi ?", date: "2026-10-05T08:12:00Z", unread: true },
    { id: "d2", from: "Boutique (exemple)", subject: "Ta commande est en route", date: "2026-10-04T17:40:00Z", unread: true },
    { id: "d3", from: "Mairie (exemple)", subject: "Inscription à la bibliothèque", date: "2026-10-03T10:05:00Z", unread: false },
  ],
};
export const DEMO_DRIVE = {
  demo: true,
  items: [
    { id: "f1", name: "Exemple - Photos de vacances", type: "folder", modified: "2026-09-28T12:00:00Z", url: "" },
    { id: "f2", name: "Exemple - Devoirs.docx", type: "document", modified: "2026-10-02T09:30:00Z", url: "" },
  ],
};
