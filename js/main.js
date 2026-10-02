// Salon d'Univers : choix du jeu, création/ouverture d'une salle par lien, chat, partage de documents.
import { Room, FILE_TYPES, MAX_FILE } from "./net.js";
import { WORLDS, mountGalaxy } from "./galaxy.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

let games = [];
let room = null;
let current = null; // { id, handle, ctx }
let unread = 0;

/* ---------- petits outils ---------- */
function toast(text, ms = 3500) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), ms);
}

const getName = () => {
  let n = "";
  try {
    n = localStorage.getItem("univers.name") || "";
  } catch {
    /* stockage bloqué */
  }
  return n || "Joueur" + Math.floor(100 + Math.random() * 900);
};
function saveName(n) {
  try {
    localStorage.setItem("univers.name", n);
  } catch {
    /* stockage bloqué */
  }
}
const myName = () => ($("#pseudo").value.trim() || getName()).slice(0, 20);

function modal(html, onClose) {
  const m = $("#modal");
  m.innerHTML = `<div class="card">${html}</div>`;
  m.hidden = false;
  m.onclick = (e) => {
    if (e.target === m) closeModal(onClose);
  };
  return m;
}
function closeModal(cb) {
  $("#modal").hidden = true;
  $("#modal").innerHTML = "";
  cb?.();
}

/* ---------- accueil ---------- */
async function init() {
  $("#pseudo").value = getName();
  $("#pseudo").onchange = () => saveName($("#pseudo").value.trim());
  try {
    games = await (await fetch("games/index.json")).json();
  } catch {
    games = [];
    toast("Impossible de charger la liste des jeux.");
  }
  $("#games").innerHTML = games
    .map(
      (g) => `<button class="game" data-id="${esc(g.id)}">
        <span class="emo">${esc(g.emoji || "🎮")}</span>
        <b>${esc(g.name)}</b><small>${esc(g.tagline || "")}</small><em>${esc(g.players || "")}</em></button>`,
    )
    .join("");
  $("#games").onclick = (e) => {
    const b = e.target.closest(".game");
    if (b) chooseMode(games.find((g) => g.id === b.dataset.id));
  };
  $("#worlds-nav").innerHTML = WORLDS.map((w) => `<button type="button" data-w="${w.id}" style="--wc:${w.color}">${w.emoji} ${esc(w.name)}</button>`).join("");
  $("#worlds-nav").onclick = (e) => {
    const b = e.target.closest("button");
    if (b) openWorld(b.dataset.w);
  };
  stopGalaxy = mountGalaxy($("#galaxy"), openWorld);
  $("#btn-chat").onclick = () => togglePanel(true);
  $("#panel-close").onclick = () => togglePanel(false);
  $("#chat-form").onsubmit = (e) => {
    e.preventDefault();
    sendChat();
  };
  $("#file").onchange = shareFile;

  const code = new URLSearchParams(location.search).get("room");
  if (code) joinFromLink(code);
}

function chooseMode(g) {
  if (g.href) {
    window.open(g.href, "_blank", "noopener");
    return;
  }
  const modes = g.modes || ["local"];
  const labels = {
    bot: ["🤖 Solo", g.id === "poules" ? "Contre la poule robot" : "Contre l'ordinateur"],
    local: ["👥 Même écran", "À deux sur cet appareil"],
    online: ["🔗 Duel par lien", "Envoie le lien à un ami : il joue depuis son téléphone ou son PC"],
  };
  modal(`<h2>${esc(g.emoji || "")} ${esc(g.name)}</h2>
    <div class="modes">${modes
      .map((m) => `<button data-m="${m}"><b>${labels[m][0]}</b><small>${labels[m][1]}</small></button>`)
      .join("")}</div>
    <button class="ghost" id="m-cancel">Annuler</button>`);
  $("#m-cancel").onclick = () => closeModal();
  $(".modes").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    closeModal();
    if (b.dataset.m === "online") createOnline(g);
    else startGame(g.id, b.dataset.m, 0, (Math.random() * 1e9) >>> 0);
  };
}

/* ---------- salle en ligne ---------- */
function newRoom() {
  room?.close();
  room = new Room(myName());
  room.on("players", () => updateConn());
  room.on("closed", () => {
    toast("Connexion perdue avec l'hôte.");
    stopGame();
    updateConn();
  });
  room.on("left", ({ seat }) => {
    toast("Un joueur est parti.");
    current?.ctx.dispatch("peer-left", { seat });
  });
  room.on("chat", (m, from) => addChat(m, from));
  room.on("start", (m) => startGame(m.game, "online", room.seat, m.seed));
  room.on("stop", () => {
    stopGame(false);
    toast("L'hôte a quitté la partie.");
  });
  room.onFile((f) => addDoc(f));
  room.on("*", (type, p, from) => {
    if (type.startsWith("g:")) current?.ctx.dispatch(type.slice(2), p, from);
  });
  return room;
}

async function createOnline(g) {
  newRoom();
  modal(`<h2>Création du duel…</h2><p class="muted">Un instant.</p>`);
  let code;
  try {
    code = await room.create();
  } catch (e) {
    closeModal();
    return toast(e.message);
  }
  const link = `${location.origin}${location.pathname}?room=${code}`;
  const m = modal(`<h2>${esc(g.emoji || "")} ${esc(g.name)} : duel</h2>
    <p>Envoie ce lien à ton adversaire :</p>
    <input class="link" readonly value="${esc(link)}" />
    <div class="row">
      <button id="copy">📋 Copier le lien</button>
      <button id="share" ${navigator.share ? "" : "hidden"}>📤 Partager</button>
    </div>
    <p class="muted" id="wait">⏳ En attendant ton adversaire… (garde cette page ouverte)</p>
    <button class="ghost" id="m-cancel">Annuler</button>`);
  $(".link").onclick = (e) => e.target.select();
  $("#copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast("Lien copié !");
    } catch {
      $(".link").select();
      toast("Sélectionne le lien et copie-le.");
    }
  };
  $("#share").onclick = () => navigator.share({ title: "Univers", text: `Viens jouer à ${g.name} contre moi !`, url: link }).catch(() => {});
  $("#m-cancel").onclick = () => {
    closeModal();
    room?.close();
    room = null;
    updateConn();
  };
  updateConn();
  const off = room.on("players", (players) => {
    if (players.length >= 2) {
      off();
      closeModal();
      const seed = (Math.random() * 1e9) >>> 0;
      room.send("start", { game: g.id, seed });
      startGame(g.id, "online", 0, seed);
    }
  });
  if (m) m.querySelector("#wait");
}

async function joinFromLink(code) {
  newRoom();
  history.replaceState(null, "", location.pathname); // le lien ne reste pas dans l'adresse
  modal(`<h2>Connexion au duel…</h2><p class="muted">Salle ${esc(code.toUpperCase())}</p>`);
  try {
    await room.join(code);
  } catch (e) {
    closeModal();
    room?.close();
    room = null;
    updateConn();
    return modal(`<h2>Impossible de rejoindre</h2><p>${esc(e.message)}</p><button id="m-ok">OK</button>`, null) && ($("#m-ok").onclick = () => closeModal());
  }
  closeModal();
  updateConn();
  toast("Connecté ! En attendant que l'hôte lance la partie…", 6000);
  modal(`<h2>✅ Connecté</h2><p>En attendant que l'hôte lance la partie…</p>`);
}

function updateConn() {
  const c = $("#conn");
  const on = room && room.players.length > 0 && room.code;
  c.hidden = !on;
  $("#btn-chat").hidden = !on;
  if (on) {
    c.textContent = `🟢 Salle ${room.code} · ${room.players.length} joueur${room.players.length > 1 ? "s" : ""}`;
    $("#who").textContent = room.players.map((p) => p.name).join(", ");
  }
}

/* ---------- planètes ---------- */
let stopGalaxy = null;
let world = null;
async function openWorld(id) {
  if (world) return;
  let mod;
  try {
    mod = await import(`./worlds/${id}.js`);
  } catch (e) {
    console.error(e);
    return toast("Cette planète n'a pas pu se charger.");
  }
  stopGame(false);
  $("#home").hidden = true;
  stopGalaxy?.();
  stopGalaxy = null;
  const stage = $("#stage");
  stage.hidden = false;
  stage.classList.add("is-world");
  stage.innerHTML = "";
  world = mod.open(stage, {
    quit: closeWorld,
    games,
    playGame: (gid) => {
      closeWorld();
      const g = games.find((x) => x.id === gid);
      if (g) chooseMode(g);
    },
  });
}
function closeWorld() {
  try {
    world?.destroy?.();
  } catch (e) {
    console.error(e);
  }
  world = null;
  const stage = $("#stage");
  stage.hidden = true;
  stage.classList.remove("is-world");
  stage.innerHTML = "";
  $("#home").hidden = false;
  stopGalaxy = mountGalaxy($("#galaxy"), openWorld);
}

/* ---------- lancement d'un jeu ---------- */
async function startGame(id, mode, seat, seed) {
  closeModal();
  stopGame(false);
  let mod;
  try {
    mod = (await import(`../games/${id}/game.js`)).default;
  } catch (e) {
    console.error(e);
    return toast("Ce jeu n'a pas pu se charger.");
  }
  $("#home").hidden = true;
  const stage = $("#stage");
  stage.hidden = false;
  stage.innerHTML = "";
  const handlers = {};
  const queue = [];
  let ready = false;
  const names = room && mode === "online" ? room.players : null;
  const players =
    mode === "online"
      ? [0, 1].map((s) => ({ seat: s, name: names.find((p) => p.seat === s)?.name || `Joueur ${s + 1}` }))
      : mode === "bot"
        ? [{ seat: 0, name: myName() }, { seat: 1, name: id === "poules" ? "Poule robot" : "Ordinateur" }]
        : [{ seat: 0, name: myName() }, { seat: 1, name: "Joueur 2" }];
  const ctx = {
    root: stage,
    mode,
    seat,
    seed,
    isHost: mode !== "online" || room.isHost,
    players,
    name: myName(),
    send: (t, p) => mode === "online" && room?.send("g:" + t, p),
    on: (t, cb) => (handlers[t] ||= []).push(cb),
    quit: () => {
      if (mode === "online" && room?.isHost) room.send("stop", {});
      stopGame();
    },
    dispatch: (t, p, from) => {
      if (!ready) return queue.push([t, p, from]); // messages arrivés pendant le chargement du jeu
      for (const cb of handlers[t] || []) cb(p, from);
    },
  };
  current = { id, ctx, handle: null };
  current.handle = await mod.start(ctx);
  ready = true;
  for (const [t, p, f] of queue.splice(0)) ctx.dispatch(t, p, f);
  if (mode === "online") $("#btn-chat").hidden = false;
}

function stopGame(showHome = true) {
  if (current) {
    try {
      current.handle?.destroy?.();
    } catch (e) {
      console.error(e);
    }
    current = null;
  }
  $("#stage").hidden = true;
  $("#stage").innerHTML = "";
  if (showHome) $("#home").hidden = false;
}

/* ---------- chat et documents ---------- */
function togglePanel(open) {
  $("#panel").hidden = !open;
  if (open) {
    unread = 0;
    $("#chat-badge").hidden = true;
    $("#chat-input").focus();
  }
}
function addChat(m, from) {
  const li = document.createElement("li");
  const who = room?.players.find((p) => p.seat === from)?.name || "?";
  li.innerHTML = `<b>${esc(who)}</b> ${esc(String(m.text || "").slice(0, 300))}`;
  $("#msgs").append(li);
  $("#msgs").scrollTop = 1e9;
  if ($("#panel").hidden && from !== room?.seat) {
    unread++;
    $("#chat-badge").textContent = unread;
    $("#chat-badge").hidden = false;
  }
}
function sendChat() {
  const i = $("#chat-input");
  const text = i.value.trim();
  if (!text || !room) return;
  room.send("chat", { text });
  addChat({ text }, room.seat);
  i.value = "";
}
async function shareFile(e) {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f || !room) return;
  if (!FILE_TYPES.includes(f.type)) return toast("Seuls les PDF et les images sont acceptés.");
  if (f.size > MAX_FILE) return toast("Fichier trop lourd (20 Mo maximum).");
  toast("Envoi de « " + f.name + " »…");
  try {
    await room.sendFile(f);
    addDoc({ name: f.name, type: f.type, blob: f, from: room.seat, mine: true });
    toast("Document envoyé.");
  } catch (err) {
    toast(err.message);
  }
}
function addDoc(d) {
  const li = document.createElement("li");
  const who = d.mine ? "Toi" : room?.players.find((p) => p.seat === d.from)?.name || "?";
  li.innerHTML = `📄 <b>${esc(d.name)}</b> <small>(${esc(who)})</small> <button>Ouvrir</button>`;
  li.querySelector("button").onclick = () => openDoc(d);
  $("#docs").append(li);
  if (!d.mine) {
    toast(`Document reçu : ${d.name}`);
    if ($("#panel").hidden) {
      unread++;
      $("#chat-badge").textContent = unread;
      $("#chat-badge").hidden = false;
    }
  }
}
function openDoc(d) {
  const url = URL.createObjectURL(d.blob);
  const v = $("#viewer");
  const isPdf = d.type === "application/pdf";
  v.innerHTML = `<div class="v-bar"><b>${esc(d.name)}</b><a href="${url}" target="_blank" rel="noopener">Ouvrir à part</a><button id="v-close">✕</button></div>
    ${isPdf ? `<iframe src="${url}" title="${esc(d.name)}"></iframe>` : `<img src="${url}" alt="${esc(d.name)}" />`}`;
  v.hidden = false;
  $("#v-close").onclick = () => {
    v.hidden = true;
    v.innerHTML = "";
    URL.revokeObjectURL(url);
  };
}

init();
