// Réseau pair-à-pair (WebRTC via PeerJS) : aucun serveur à toi, rien à payer.
// Le créateur de la salle est l'« hôte » : les autres se connectent à lui et il relaie les messages.
// Messages : { t: type, p: contenu, from: numéro de joueur }.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PREFIX = "univers-";
const ICE = {
  debug: 0,
  config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.cloudflare.com:3478" }] },
};
const MAX_GUESTS = 3;
export const MAX_FILE = 20 * 1024 * 1024;
export const FILE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
const CHUNK = 16 * 1024;

const randomCode = () =>
  Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

export class Room {
  constructor(name) {
    this.name = name;
    this.isHost = false;
    this.seat = 0;
    this.players = [];
    this.code = null;
    this.peer = null;
    this.conns = new Map(); // hôte : seat -> connexion
    this.hostConn = null; // invité : connexion vers l'hôte
    this.h = {};
    this.incoming = new Map();
  }

  on(type, cb) {
    (this.h[type] ||= []).push(cb);
    return () => this.off(type, cb);
  }
  off(type, cb) {
    this.h[type] = (this.h[type] || []).filter((f) => f !== cb);
  }
  _emit(type, p, from) {
    for (const cb of [...(this.h[type] || [])])
      try {
        cb(p, from);
      } catch (e) {
        console.error(e);
      }
    for (const cb of [...(this.h["*"] || [])])
      try {
        cb(type, p, from);
      } catch (e) {
        console.error(e);
      }
  }

  /** Crée la salle. Renvoie le code (5 caractères). */
  create() {
    return new Promise((resolve, reject) => {
      const attempt = (n) => {
        const code = randomCode();
        const peer = new Peer(PREFIX + code, ICE);
        let opened = false;
        peer.on("open", () => {
          opened = true;
          this.peer = peer;
          this.code = code;
          this.isHost = true;
          this.seat = 0;
          this.players = [{ seat: 0, name: this.name }];
          peer.on("connection", (c) => this._accept(c));
          resolve(code);
        });
        peer.on("error", (e) => {
          if (opened) return this._emit("error", e.type || String(e));
          peer.destroy();
          if (e.type === "unavailable-id" && n < 5) attempt(n + 1);
          else reject(new Error(e.type === "network" ? "Pas de connexion à Internet" : "Impossible de créer la salle"));
        });
      };
      attempt(0);
    });
  }

  _accept(conn) {
    conn.on("data", (d) => this._hostData(conn, d));
    conn.on("close", () => this._hostLeft(conn));
    conn.on("error", () => this._hostLeft(conn));
    conn.on("open", () => {
      if (this.conns.size >= MAX_GUESTS) {
        conn.send({ t: "full" });
        setTimeout(() => conn.close(), 300);
      }
    });
  }

  _hostData(conn, d) {
    if (!d || typeof d.t !== "string") return;
    if (d.t === "hello") {
      if (conn.seat || this.conns.size >= MAX_GUESTS) return;
      let seat = 1;
      while (this.conns.has(seat)) seat++;
      conn.seat = seat;
      this.conns.set(seat, conn);
      this.players.push({ seat, name: String(d.p?.name || "Joueur").slice(0, 24) });
      conn.send({ t: "welcome", p: { seat, players: this.players, code: this.code } });
      this._broadcast({ t: "players", p: this.players }, null);
      this._emit("players", this.players);
      return;
    }
    if (!conn.seat) return;
    d.from = conn.seat; // l'hôte impose l'expéditeur
    this._broadcast(d, conn.seat); // relais aux autres invités
    this._emit(d.t, d.p, d.from);
  }

  _hostLeft(conn) {
    if (!conn.seat || !this.conns.has(conn.seat)) return;
    const seat = conn.seat;
    this.conns.delete(seat);
    this.players = this.players.filter((p) => p.seat !== seat);
    this._broadcast({ t: "players", p: this.players }, null);
    this._emit("players", this.players);
    this._emit("left", { seat });
  }

  _broadcast(msg, exceptSeat) {
    for (const [seat, c] of this.conns) if (seat !== exceptSeat && c.open) c.send(msg);
  }

  /** Rejoint une salle avec son code. */
  join(code) {
    code = String(code || "").trim().toUpperCase();
    return new Promise((resolve, reject) => {
      const peer = new Peer(ICE);
      this.peer = peer;
      let done = false;
      const fail = (m) => {
        if (done) return;
        done = true;
        peer.destroy();
        reject(new Error(m));
      };
      const timer = setTimeout(
        () => fail("Connexion impossible (réseau bloqué ou salle fermée). Réessaie, ou change de réseau Wi-Fi/4G."),
        15000,
      );
      peer.on("error", (e) =>
        fail(e.type === "peer-unavailable" ? "Salle introuvable : vérifie le lien." : "Erreur réseau : " + (e.type || e)),
      );
      peer.on("open", () => {
        const conn = peer.connect(PREFIX + code, { reliable: true });
        this.hostConn = conn;
        conn.on("open", () => conn.send({ t: "hello", p: { name: this.name } }));
        conn.on("data", (d) => {
          if (!d || typeof d.t !== "string") return;
          if (d.t === "welcome") {
            clearTimeout(timer);
            done = true;
            this.seat = d.p.seat;
            this.players = d.p.players;
            this.code = code;
            resolve(code);
          } else if (d.t === "full") fail("La salle est pleine.");
          else if (d.t === "players") {
            this.players = d.p;
            this._emit("players", this.players);
          } else this._emit(d.t, d.p, d.from);
        });
        conn.on("close", () => {
          if (!done) fail("Connexion fermée.");
          else this._emit("closed", {});
        });
      });
    });
  }

  /** Envoie à tous les autres (l'hôte relaie). */
  send(type, payload) {
    const msg = { t: type, p: payload, from: this.seat };
    if (this.isHost) this._broadcast(msg, null);
    else if (this.hostConn?.open) this.hostConn.send(msg);
  }

  /** Partage un PDF ou une image (envoyé en morceaux, jamais hébergé). */
  async sendFile(file) {
    if (!FILE_TYPES.includes(file.type)) throw new Error("Seuls les PDF et les images sont acceptés.");
    if (file.size > MAX_FILE) throw new Error("Fichier trop lourd (20 Mo maximum).");
    const id = Math.random().toString(36).slice(2);
    const n = Math.max(1, Math.ceil(file.size / CHUNK));
    for (let i = 0; i < n; i++) {
      const data = await file.slice(i * CHUNK, (i + 1) * CHUNK).arrayBuffer();
      this.send("file", { id, name: file.name.slice(0, 120), type: file.type, size: file.size, i, n, data });
      if (i % 16 === 15) await new Promise((r) => setTimeout(r, 0)); // laisse respirer le canal
    }
  }

  /** Reçoit les fichiers : cb({name, type, blob, from}) quand un fichier est complet. */
  onFile(cb) {
    return this.on("file", (m, from) => {
      if (!m || !FILE_TYPES.includes(m.type) || m.size > MAX_FILE) return;
      let f = this.incoming.get(m.id);
      if (!f) this.incoming.set(m.id, (f = { parts: new Array(m.n), got: 0, n: m.n }));
      if (f.parts[m.i] === undefined) {
        f.parts[m.i] = m.data;
        f.got++;
      }
      if (f.got === f.n) {
        this.incoming.delete(m.id);
        cb({ name: m.name, type: m.type, blob: new Blob(f.parts, { type: m.type }), from });
      }
    });
  }

  close() {
    try {
      this.peer?.destroy();
    } catch {
      /* déjà fermé */
    }
  }
}
