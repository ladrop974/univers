// NEXUS : Lignée Zénith — règles du jeu, sans rendu (testées avec node --test).
// En ligne, l'hôte fait tourner cette simulation ; l'invité reçoit des instantanés (snapshot/applySnapshot).
// Le monde (relief, obstacles, ressources) se déduit de la graine : les deux joueurs le recalculent à l'identique.

export const HALF = 2500; // monde de 5000 x 5000
export const STEP = 1 / 60;
export const SPAWNS = [
  { x: -1900, z: -1600 },
  { x: 1900, z: 1600 },
];
export const ARENA = { x: 0, z: 7000, r: 640 };
export const DUEL_TIME = 150;
export const PREP_TIME = 8;

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const d2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
const angDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

/* ============ BIOMES ============ */
export const BIOMES = [
  { name: "Mer de spores", ground: 0x0a2a3c, accent: 0x1de9ff, fog: 0x04131d, obst: "coral" },
  { name: "Forêt de membranes", ground: 0x2a1438, accent: 0xff5fd2, fog: 0x12081c, obst: "stalk", slow: 0.15 },
  { name: "Canyon cristallin", ground: 0x262c4c, accent: 0x9fb4ff, fog: 0x0e1230, obst: "crystal" },
  { name: "Marais acide", ground: 0x1b2a10, accent: 0x9dff2f, fog: 0x0b1406, obst: "rock" },
  { name: "Plaine des machines organiques", ground: 0x2e2216, accent: 0xffa640, fog: 0x170f08, obst: "pillar" },
  { name: "Cratère Zénith", ground: 0x150f22, accent: 0xffd36b, fog: 0x0a0614, obst: "monolith" },
];
const CRATER_R = 560;

/* ============ HISTOIRE ============ */
export const STORY = [
  "Fragment I — Tu n'as pas de nom. Seulement une faim, et une lumière lointaine qui t'observe.",
  "Fragment II — Les anciens habitants d'Auralis ont fait de leur corps des murs, des ponts, des tours.",
  "Fragment III — Chaque cycle, la planète se replie sur elle-même. Ce qui ne s'adapte pas est oublié.",
  "Fragment IV — Les océans ne sont pas de l'eau : ce sont des réseaux de mémoire qui se souviennent de tout.",
  "Fragment V — Les montagnes de cristal stockent l'énergie des cycles morts. Elles chantent la nuit.",
  "Fragment VI — Une autre lignée grandit, loin d'ici. Elle a la même faim que toi.",
  "Fragment VII — Le Noyau Zénith n'est pas un dieu. C'est un juge. Il provoque la rivalité exprès.",
  "Fragment VIII — Le vainqueur ne règne pas : il devient le gardien d'Auralis jusqu'au prochain effondrement.",
];
export const ACTS = ["", "Acte I — Éveil", "Acte II — Conquête", "Acte III — Ascension", "Acte IV — Duel Zénith"];

/* ============ MUTATIONS ============ */
// s : effets sur les statistiques (multiplicatifs « x » ou additifs « + »). vis : pièce visible sur la créature.
export const ORIENT = [
  { id: "o_speed", name: "Voie du courant", plus: "Vitesse +20 %, accélération +30 %", minus: "Vitalité −10 %", style: "Harceler, fuir, explorer", s: { speed: ["x", 1.2], accel: ["x", 1.3], hp: ["x", 0.9] }, vis: "fins" },
  { id: "o_absorb", name: "Voie de la récolte", plus: "Absorption +40 %, rayon de collecte +40 %", minus: "Attaque −10 %", style: "Grandir vite", s: { absorb: ["x", 1.4], pickup: ["x", 1.4], atk: ["x", 0.9] }, vis: "tentacles" },
  { id: "o_def", name: "Voie de la carapace", plus: "Armure +12 %, vitalité +15 %", minus: "Vitesse −8 %", style: "Tenir le terrain", s: { armor: ["+", 0.12], hp: ["x", 1.15], speed: ["x", 0.92] }, vis: "plates" },
  { id: "o_atk", name: "Voie du croc", plus: "Attaque +25 %", minus: "Vitalité −8 %", style: "Chasser et frapper fort", s: { atk: ["x", 1.25], hp: ["x", 0.92] }, vis: "spikes" },
  { id: "o_sense", name: "Voie du guetteur", plus: "Vision +35 %, signal du rival plus précis", minus: "Énergie −10 %", style: "Lire la carte, surprendre", s: { vision: ["x", 1.35], sense: ["x", 2], en: ["x", 0.9] }, vis: "eyes" },
];
export const MUTS = [
  { id: "cils", name: "Cils vectoriels", plus: "Accélération +50 %, vitesse +8 %", minus: "Armure −4 %", style: "Mobilité nerveuse", s: { accel: ["x", 1.5], speed: ["x", 1.08], armor: ["+", -0.04] }, vis: "fins" },
  { id: "chitine", name: "Bouclier de chitine", plus: "Armure +15 %", minus: "Vitesse −10 %", style: "Encaisser", s: { armor: ["+", 0.15], speed: ["x", 0.9] }, vis: "plates" },
  { id: "machoire", name: "Mâchoire prismatique", plus: "Dégâts au contact +35 %", minus: "Portée −15 %", style: "Corps à corps brutal", s: { atk: ["x", 1.35], range: ["x", 0.85] }, vis: "spikes" },
  { id: "tentacules", name: "Tentacules de collecte", plus: "Collecte +60 %, absorption +25 %", minus: "Attaque −8 %", style: "Ramasser large", s: { pickup: ["x", 1.6], absorb: ["x", 1.25], atk: ["x", 0.92] }, vis: "tentacles" },
  { id: "brouillage", name: "Organe de brouillage", plus: "Ta position est bien plus floue pour le rival", minus: "Énergie max −15 %", style: "Furtivité, embuscade", s: { stealth: ["+", 1], en: ["x", 0.85] }, vis: "cloak", u: 1 },
  { id: "propulsion", name: "Glande de propulsion", plus: "Dash +60 % plus loin, recharge −25 %", minus: "Récupération −30 %", style: "Entrer et sortir du combat", s: { dash: ["x", 1.6], dashCd: ["x", 0.75], regen: ["x", 0.7] }, vis: "jets" },
  { id: "regen", name: "Noyau régénérant", plus: "Récupération +2,5 PV/s", minus: "Vitesse −5 %", style: "Durer", s: { regen: ["+", 2.5], speed: ["x", 0.95] }, vis: "core" },
  { id: "entrave", name: "Spores d'entrave", plus: "Tes coups ralentissent de 35 %", minus: "Attaque −5 %", style: "Contrôle", s: { slow: ["+", 0.35], atk: ["x", 0.95] }, vis: "spores", u: 1 },
  { id: "portail", name: "Portail symbiotique", plus: "Ton dash devient une téléportation (traverse les obstacles)", minus: "Recharge du dash +15 %", style: "Imprévisible", s: { blink: ["+", 1], dashCd: ["x", 1.15] }, vis: "portal", u: 1 },
  { id: "resonance", name: "Résonance Zénith", plus: "Énergie Zénith +25 %, +15 % de puissance en duel", minus: "Vitalité −10 % hors duel", style: "Préparer la finale", s: { zen: ["x", 1.25], duel: ["+", 0.15] }, vis: "rings", u: 1 },
  { id: "membranes", name: "Membranes planantes", plus: "Vitesse +12 %, ignore les ralentissements de biome", minus: "Armure −3 %", style: "Traverser la carte", s: { speed: ["x", 1.12], glide: ["+", 1], armor: ["+", -0.03] }, vis: "wings", u: 1 },
  { id: "sacs", name: "Sacs d'énergie", plus: "Énergie max +30 %, recharge d'énergie +40 %", minus: "Vitesse −5 %", style: "Enchaîner les capacités", s: { en: ["x", 1.3], enRegen: ["x", 1.4], speed: ["x", 0.95] }, vis: "sacs" },
  { id: "epines", name: "Épines réactives", plus: "Renvoie 25 % des dégâts au contact", minus: "Absorption −10 %", style: "Punir les assauts", s: { thorns: ["+", 0.25], absorb: ["x", 0.9] }, vis: "thorns" },
  { id: "oeil", name: "Œil composé", plus: "Vision +40 %, portée +10 %", minus: "Vitalité −5 %", style: "Voir venir", s: { vision: ["x", 1.4], range: ["x", 1.1], hp: ["x", 0.95] }, vis: "eyes" },
];
export const SPECS = [
  { id: "predateur", name: "Prédateur", plus: "Capacité : Bond — fonce et frappe 2,2× ; attaque +15 %", minus: "Armure −5 %", style: "Attaque et poursuite", s: { atk: ["x", 1.15], armor: ["+", -0.05] } },
  { id: "gardien", name: "Gardien", plus: "Capacité : Égide — bouclier 3 s ; vitalité +20 %", minus: "Vitesse −8 %", style: "Bouclier, contrôle, résistance", s: { hp: ["x", 1.2], speed: ["x", 0.92] } },
  { id: "nomade", name: "Nomade", plus: "Capacité : Saut quantique — téléportation ; vitesse +12 %", minus: "Vitalité −8 %", style: "Vitesse et exploration", s: { speed: ["x", 1.12], hp: ["x", 0.92] } },
  { id: "architecte", name: "Architecte", plus: "Capacité : Tourelle (3 max) ; noyau de territoire +50 %", minus: "Attaque −8 %", style: "Structures, production, pièges", s: { build: ["x", 1.5], atk: ["x", 0.92] } },
  { id: "siphonneur", name: "Siphonneur", plus: "Capacité : Drain — vole vitalité et énergie ; absorption +15 %", minus: "Vitalité −5 %", style: "Vol d'énergie et récupération", s: { absorb: ["x", 1.15], hp: ["x", 0.95] } },
];
export const MUT_BY = Object.fromEntries([...ORIENT, ...MUTS, ...SPECS].map((m) => [m.id, m]));
const MAX_STACK = 2;

const BASE = { hp: 100, en: 100, speed: 170, accel: 7, atk: 13, range: 26, armor: 0, absorb: 1, pickup: 1, regen: 1, enRegen: 9, vision: 620, sense: 1, stealth: 0, dash: 1, dashCd: 1, slow: 0, blink: 0, zen: 1, duel: 0, glide: 0, thorns: 0, build: 1 };
const ACT_SCALE = [0, 1, 1.7, 2.6]; // vitalité et attaque selon l'acte

export function recalc(p) {
  const s = { ...BASE };
  for (const id of [...p.muts, p.spec].filter(Boolean)) {
    for (const [k, [op, v]] of Object.entries(MUT_BY[id].s)) s[k] = op === "x" ? s[k] * v : s[k] + v;
  }
  const a = ACT_SCALE[Math.min(3, p.act)];
  const duel = p.inDuel ? 1 + s.duel : 1;
  const res = MUT_BY.resonance && p.muts.includes("resonance") && !p.inDuel ? 0.9 : 1;
  s.armor = clamp(s.armor, 0, 0.6);
  s.hp = Math.round(s.hp * a * duel * res * (p.adv ? 1.1 : 1));
  s.atk = s.atk * a * duel;
  s.en = Math.round(s.en);
  s.speed = s.speed * (p.act === 1 ? 1 : p.act === 2 ? 1.08 : 1.12);
  const oldHp = p.maxHp || s.hp;
  p.st = s;
  p.maxHp = s.hp;
  p.maxEn = s.en;
  p.r = sizeOf(p);
  if (p.hp === undefined) p.hp = s.hp;
  else p.hp = clamp(p.hp * (s.hp / oldHp), 1, s.hp);
  if (p.en === undefined) p.en = s.en;
  p.en = Math.min(p.en, s.en);
}
export function sizeOf(p) {
  if (p.act <= 1) return 9 + 2 * Math.min(p.level, 4);
  if (p.act === 2) return 20 + 2.2 * clamp(p.level - 3, 0, 4);
  return Math.min(48, 32 + 1.6 * Math.max(0, p.level - 6));
}
export const xpNeed = (lv) => 40 + lv * 42;

/* ============ GÉNÉRATION DU MONDE (déterministe) ============ */
const NPC_KINDS = {
  mite: { r: 7, hp: 12, spd: 120, atk: 0, xp: 7, aggro: 0 },
  grazer: { r: 18, hp: 70, spd: 80, atk: 6, xp: 24, aggro: 0 },
  stalker: { r: 13, hp: 45, spd: 150, atk: 7, xp: 26, aggro: 1 },
  brute: { r: 26, hp: 170, spd: 112, atk: 15, xp: 60, aggro: 1 },
  leviathan: { r: 46, hp: 560, spd: 96, atk: 28, xp: 170, aggro: 1 },
};
export { NPC_KINDS };

export function makeWorld(seed) {
  const R = mulberry(seed ^ 0x9e3779b9);
  const W = { seed, centers: [], obstacles: [], hazards: [], nutrients: [], homes: [], relays: [], frags: [] };
  // 5 paires de biomes autour du centre, symétriques (chaque joueur a les mêmes chances)
  const a0 = Math.atan2(SPAWNS[0].z, SPAWNS[0].x);
  for (let k = 0; k < 5; k++) {
    const a = a0 + (k * Math.PI) / 5 + (k ? (R() - 0.5) * 0.25 : 0);
    const rad = k ? 1750 + (R() - 0.5) * 400 : Math.hypot(SPAWNS[0].x, SPAWNS[0].z);
    const x = Math.cos(a) * rad,
      z = Math.sin(a) * rad;
    W.centers.push({ x, z, b: k }, { x: -x, z: -z, b: k });
  }
  W.wf = 0.0016 + R() * 0.0012;
  const ok = (x, z, r, pad = 30) => {
    if (Math.abs(x) > HALF - 80 || Math.abs(z) > HALF - 80) return false;
    for (const s of SPAWNS) if (d2(x, z, s.x, s.z) < 300 * 300) return false;
    for (const o of W.obstacles) if (d2(x, z, o.x, o.z) < (r + o.r + pad) ** 2) return false;
    for (const o of W.relays) if (d2(x, z, o.x, o.z) < (r + 150) ** 2) return false;
    return true;
  };
  const pair = (list, o) => {
    list.push(o, { ...o, x: -o.x, z: -o.z });
  };
  // relais biologiques (3 paires)
  for (const [x, z] of [
    [-1000, 250],
    [-250, -1150],
    [-1650, -350],
  ])
    pair(W.relays, { x: x + (R() - 0.5) * 160, z: z + (R() - 0.5) * 160, r: 70 });
  // obstacles
  const OR = { coral: [28, 64], stalk: [16, 28], crystal: [24, 58], rock: [30, 76], pillar: [20, 38], monolith: [36, 56] };
  for (let i = 0, tries = 0; i < 95 && tries < 4000; tries++) {
    const x = (R() * 2 - 1) * (HALF - 120),
      z = (R() * 2 - 1) * (HALF - 120);
    const b = biomeAt(W, x, z),
      kind = BIOMES[b].obst,
      [lo, hi] = OR[kind];
    const r = lo + R() * (hi - lo);
    if (b === 5 && Math.hypot(x, z) < 330) continue;
    if (!ok(x, z, r) || !ok(-x, -z, r)) continue;
    pair(W.obstacles, { x, z, r, kind, h: 0.6 + R() * 0.9, rot: R() * 6.28 });
    i++;
  }
  // flaques acides du marais
  for (let i = 0, tries = 0; i < 6 && tries < 2000; tries++) {
    const x = (R() * 2 - 1) * HALF,
      z = (R() * 2 - 1) * HALF;
    if (biomeAt(W, x, z) !== 3) continue;
    const r = 80 + R() * 80;
    if (!ok(x, z, r, 10)) continue;
    pair(W.hazards, { x, z, r });
    i++;
  }
  // ressources
  const dens = [1, 0.5, 0.75, 0.45, 0.5, 0.7];
  for (let i = 0, tries = 0; i < 200 && tries < 20000; tries++) {
    const x = (R() * 2 - 1) * (HALF - 60),
      z = (R() * 2 - 1) * (HALF - 60);
    const b = biomeAt(W, x, z);
    if (R() > dens[b]) continue;
    if (W.obstacles.some((o) => d2(x, z, o.x, o.z) < (o.r + 14) ** 2)) continue;
    const roll = R();
    const kind = b === 5 ? (roll < 0.5 ? 2 : 1) : roll < 0.08 ? 1 : 0; // 0 micro, 1 or, 2 zénith
    pair(W.nutrients, { x, z, kind });
    i++;
  }
  // points d'intérêt (fragments de mémoire) : 3 près de chaque départ, 4 paires ailleurs, 1 au centre
  for (let k = 0; k < 3; k++) {
    for (let t = 0; t < 200; t++) {
      const a = R() * 6.28,
        d = 330 + R() * 330;
      const x = SPAWNS[0].x + Math.cos(a) * d,
        z = SPAWNS[0].z + Math.sin(a) * d;
      if (W.obstacles.some((o) => d2(x, z, o.x, o.z) < (o.r + 40) ** 2) || W.frags.some((f) => d2(x, z, f.x, f.z) < 200 * 200)) continue;
      pair(W.frags, { x, z, text: k, poi: 1 });
      break;
    }
  }
  for (let k = 1; k < 5; k++) {
    const c = W.centers[k * 2];
    let x = c.x * 0.85,
      z = c.z * 0.85;
    for (let t = 0; t < 50 && W.obstacles.some((o) => d2(x, z, o.x, o.z) < (o.r + 40) ** 2); t++) {
      x += (R() - 0.5) * 120;
      z += (R() - 0.5) * 120;
    }
    pair(W.frags, { x, z, text: 2 + k, poi: 0 });
  }
  W.frags.push({ x: 0, z: 0, text: 7, poi: 0 });
  // créatures
  const plan = [
    [0, "mite", 10],
    [0, "stalker", 3],
    [1, "grazer", 3],
    [1, "stalker", 2],
    [1, "brute", 1],
    [2, "grazer", 3],
    [2, "brute", 2],
    [3, "stalker", 2],
    [3, "brute", 1],
    [3, "leviathan", 1],
    [4, "grazer", 3],
    [4, "brute", 2],
  ];
  for (const [b, kind, n] of plan) {
    const c = W.centers[b * 2];
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < 60; t++) {
        const spread = b === 0 ? 900 : 650;
        const x = c.x + (R() - 0.5) * spread * 2,
          z = c.z + (R() - 0.5) * spread * 2;
        if (Math.abs(x) > HALF - 100 || Math.abs(z) > HALF - 100) continue;
        if (SPAWNS.some((s) => d2(x, z, s.x, s.z) < 420 * 420)) continue;
        if (W.obstacles.some((o) => d2(x, z, o.x, o.z) < (o.r + 40) ** 2)) continue;
        pair(W.homes, { x, z, kind });
        break;
      }
    }
  }
  W.homes.push({ x: 300, z: 0, kind: "leviathan" }, { x: -300, z: 0, kind: "leviathan" });
  // grille des obstacles pour les collisions
  W.grid = new Map();
  for (const o of W.obstacles) {
    const x0 = Math.floor((o.x - o.r) / 250),
      x1 = Math.floor((o.x + o.r) / 250),
      z0 = Math.floor((o.z - o.r) / 250),
      z1 = Math.floor((o.z + o.r) / 250);
    for (let i = x0; i <= x1; i++)
      for (let j = z0; j <= z1; j++) {
        const k = i * 1000 + j;
        if (!W.grid.has(k)) W.grid.set(k, []);
        W.grid.get(k).push(o);
      }
  }
  return W;
}

export function biomeAt(W, x, z) {
  if (x * x + z * z < CRATER_R * CRATER_R) return 5;
  const wx = x + Math.sin(z * W.wf) * 170,
    wz = z + Math.sin(x * W.wf) * 170;
  let best = 0,
    bd = Infinity;
  for (const c of W.centers) {
    const d = d2(wx, wz, c.x, c.z);
    if (d < bd) {
      bd = d;
      best = c.b;
    }
  }
  return best;
}
export function nearObstacles(W, x, z) {
  return W.grid.get(Math.floor(x / 250) * 1000 + Math.floor(z / 250)) || EMPTY;
}
const EMPTY = [];

/* ============ ÉTAT DE PARTIE ============ */
export function newPlayer(seat, name, bot) {
  const s = SPAWNS[seat];
  const p = {
    seat, name, bot: bot || null,
    x: s.x, z: s.z, vx: 0, vz: 0, ang: seat ? Math.PI * 1.25 : Math.PI * 0.25,
    level: 1, xp: 0, act: 1, zen: 0, muts: [], spec: null, picks: [], specPick: false,
    cd: { atk: 0, dash: 0, abil: 0, wave: 0 }, dashT: 0, inv: 2, hurt: 0, slowT: 0, shieldT: 0, drainT: 0, lungeT: 0, atkT: 0,
    dead: 0, respT: 0, inDuel: 0, adv: 0, frags: 0, story: [], seen: new Set(),
    stat: { res: 0, dmg: 0, zones: 0, kills: 0, deaths: 0 },
    inp: { mx: 0, mz: 0, aim: null, atk: 0, dash: 0, abil: 0, wave: 0, build: 0 },
  };
  recalc(p);
  return p;
}

/** opts : { names: [a,b], bots: [null|"eclaireur"|"rival"|"predateur", …], solo: true si une seule personne joue (pause des choix) } */
export function createSim(seed, opts = {}) {
  const W = makeWorld(seed);
  const names = opts.names || ["Lignée cyan", "Lignée pourpre"];
  const bots = opts.bots || [null, "rival"];
  const S = {
    seed, W, t: 0, phase: "world", phaseT: 0, over: null, solo: !!opts.solo,
    rand: mulberry(seed ^ 0x51ed27),
    players: [0, 1].map((i) => newPlayer(i, names[i], bots[i])),
    nut: W.nutrients.map((n) => ({ ...n, alive: 1, respT: 0 })),
    npcs: W.homes.map((h, i) => spawnNpc(h, i)),
    relays: W.relays.map((r) => ({ ...r, owner: -1, prog: 0, by: -1 })),
    frags: W.frags.map((f) => ({ ...f, got: [0, 0] })),
    cores: [null, null],
    turrets: [],
    shots: [],
    beacons: [],
    ev: [], // événements visuels/sonores, vidés par le rendu
    nutChg: [],
    duelFirst: -1,
  };
  for (const p of S.players) p.prng = mulberry(seed + 77 * (p.seat + 1));
  for (const p of S.players) if (p.bot) p.ai = newAi(p.bot);
  return S;
}
function spawnNpc(h, i) {
  const k = NPC_KINDS[h.kind];
  return { i, kind: h.kind, hx: h.x, hz: h.z, x: h.x, z: h.z, vx: 0, vz: 0, ang: (i * 2.4) % 6.28, hp: k.hp, hpMax: k.hp, r: k.r, alive: 1, respT: 0, mode: 0, tgt: -1, think: (i % 12) * 0.02, cd: 0, slowT: 0, hurt: 0, wx: h.x, wz: h.z };
}
const ev = (S, k, o) => {
  if (S.ev.length < 200) S.ev.push({ k, ...o });
};

/* ============ CHOIX DE MUTATIONS ============ */
function offerChoices(S, p) {
  if (!p.muts.length && !p.picks.some((c) => c.orient)) {
    const c = ORIENT.map((m) => m.id);
    c.orient = 1;
    p.picks.push(c);
    return;
  }
  const pool = MUTS.filter((m) => {
    const n = p.muts.filter((x) => x === m.id).length;
    return m.u ? n === 0 : n < MAX_STACK;
  }).map((m) => m.id);
  const c = [];
  while (c.length < 3 && pool.length) c.push(pool.splice(Math.floor(p.prng() * pool.length), 1)[0]);
  p.picks.push(c);
}
export function pick(S, seat, id) {
  const p = S.players[seat];
  if (p.specPick) {
    if (!SPECS.some((s) => s.id === id)) return false;
    p.spec = id;
    p.specPick = false;
    recalc(p);
    ev(S, "mut", { x: p.x, z: p.z, seat, id });
    return true;
  }
  const c = p.picks[0];
  if (!c || !c.includes(id)) return false;
  p.picks.shift();
  p.muts.push(id);
  recalc(p);
  ev(S, "mut", { x: p.x, z: p.z, seat, id });
  return true;
}
export const waitingChoice = (p) => p.specPick || p.picks.length > 0;
export const currentChoices = (p) => (p.specPick ? SPECS.map((s) => s.id) : p.picks[0] || null);

function gainXp(S, p, xp) {
  if (p.inDuel) return;
  p.xp += xp * p.st.absorb;
  while (p.xp >= xpNeed(p.level)) {
    p.xp -= xpNeed(p.level);
    p.level++;
    offerChoices(S, p);
    ev(S, "level", { x: p.x, z: p.z, seat: p.seat, lv: p.level });
    checkAct(S, p);
    p.r = sizeOf(p);
  }
}
function checkAct(S, p) {
  const old = p.act;
  if (p.act === 1 && ((p.level >= 3 && p.frags >= 3) || p.level >= 5)) p.act = 2;
  if (p.act === 2 && p.level >= 6) {
    p.act = 3;
    if (!p.spec) p.specPick = true;
  }
  if (p.act !== old) {
    recalc(p);
    p.hp = p.maxHp;
    ev(S, "act", { seat: p.seat, act: p.act, x: p.x, z: p.z });
  }
}
function gainZen(S, p, v) {
  if (p.act < 3 || S.phase !== "world" || p.dead) return;
  p.zen = Math.min(100, p.zen + v * p.st.zen * 0.6);
  if (p.zen >= 100 && S.phase === "world") startDuel(S, p.seat);
}

/* ============ DUEL ZÉNITH ============ */
export function startDuel(S, first) {
  S.phase = "prep";
  S.phaseT = PREP_TIME;
  S.duelFirst = first;
  S.shots.length = 0;
  S.turrets.length = 0;
  S.beacons = [0, 1, 2, 3, 4].map((i) => {
    const a = (i / 4) * Math.PI * 2;
    return i === 4 ? { x: ARENA.x, z: ARENA.z, owner: -1, prog: 0, by: -1 } : { x: ARENA.x + Math.cos(a) * 390, z: ARENA.z + Math.sin(a) * 390, owner: -1, prog: 0, by: -1 };
  });
  for (const p of S.players) {
    if (p.act < 3) {
      // le retardataire est mis à niveau pour un vrai duel, mais garde un léger retard
      p.level = Math.max(p.level, 6);
      p.act = 3;
      if (!p.spec) p.specPick = true;
    }
    p.inDuel = 1;
    p.adv = p.seat === first ? 1 : 0;
    recalc(p);
    p.dead = 0;
    p.hp = p.maxHp;
    p.en = p.maxEn;
    p.x = ARENA.x + (p.seat ? 420 : -420);
    p.z = ARENA.z;
    p.vx = p.vz = 0;
    p.ang = p.seat ? -Math.PI / 2 : Math.PI / 2;
    for (const k in p.cd) p.cd[k] = 0;
    p.inv = PREP_TIME;
  }
  ev(S, "duel", { first });
}
function endGame(S, winner, reason) {
  if (S.over) return;
  S.over = { winner, reason, t: S.t };
  S.phase = "over";
  ev(S, "over", { winner, reason });
}
export function forfeit(S, seat) {
  endGame(S, 1 - seat, "abandon du rival");
}

/* ============ COMBAT ============ */
function hurtPlayer(S, p, amount, from, opt = {}) {
  if (p.dead || p.inv > 0 || S.phase === "prep" || S.over) return 0;
  let a = amount * (1 - p.st.armor);
  if (p.shieldT > 0) a *= 0.35;
  p.hp -= a;
  p.hurt = 0.25;
  if (opt.slow) p.slowT = 1.5;
  ev(S, "hit", { x: p.x, z: p.z, v: Math.round(a), seat: p.seat });
  const att = from >= 0 ? S.players[from] : null;
  if (att) {
    att.stat.dmg += a;
    gainZen(S, att, a * 0.04);
    if (p.st.thorns && opt.melee) hurtPlayer(S, att, a * p.st.thorns, -1);
  }
  if (p.hp <= 0) killPlayer(S, p, from);
  return a;
}
function killPlayer(S, p, from) {
  p.hp = 0;
  p.stat.deaths++;
  ev(S, "die", { x: p.x, z: p.z, seat: p.seat });
  if (from >= 0) S.players[from].stat.kills++;
  if (S.phase === "duel") return endGame(S, 1 - p.seat, "vitalité adverse réduite à zéro");
  p.dead = 1;
  p.respT = 5;
  p.zen = Math.max(0, p.zen - 12);
  if (from >= 0) {
    const k = S.players[from];
    gainXp(S, k, 40 + p.level * 6);
    gainZen(S, k, 8);
  }
}
function respawn(S, p) {
  const c = S.cores[p.seat];
  const s = c || SPAWNS[p.seat];
  p.x = s.x + (c ? 60 : 0);
  p.z = s.z;
  p.vx = p.vz = 0;
  p.dead = 0;
  p.hp = p.maxHp;
  p.en = p.maxEn * 0.6;
  p.inv = 2;
  ev(S, "spawn", { x: p.x, z: p.z, seat: p.seat });
}
function hurtNpc(S, n, amount, from, slow) {
  if (!n.alive) return;
  n.hp -= amount;
  n.hurt = 0.2;
  if (slow) n.slowT = 1.5;
  if (from >= 0) {
    n.tgt = from;
    n.mode = 2;
  }
  ev(S, "nhit", { x: n.x, z: n.z, v: Math.round(amount) });
  if (n.hp <= 0) {
    n.alive = 0;
    n.respT = 30;
    ev(S, "ndie", { x: n.x, z: n.z, r: n.r });
    if (from >= 0) {
      const p = S.players[from];
      gainXp(S, p, NPC_KINDS[n.kind].xp);
      p.stat.res++;
      p.en = Math.min(p.maxEn, p.en + 10);
      gainZen(S, p, NPC_KINDS[n.kind].xp * 0.06);
    }
  }
}
function hurtStruct(S, s, amount, from, isCore) {
  s.hp -= amount;
  ev(S, "nhit", { x: s.x, z: s.z, v: Math.round(amount) });
  if (s.hp <= 0) {
    ev(S, "boom", { x: s.x, z: s.z, r: isCore ? 120 : 60 });
    if (isCore) {
      S.cores[s.seat] = null;
      const o = S.players[s.seat];
      o.zen = Math.max(0, o.zen - 10);
      if (from >= 0) gainZen(S, S.players[from], 6);
    } else S.turrets.splice(S.turrets.indexOf(s), 1);
  }
}
// frappe en cône devant la créature
function meleeHit(S, p, mult, reachBonus = 0) {
  const reach = p.r + p.st.range + reachBonus;
  const fx = Math.sin(p.ang),
    fz = Math.cos(p.ang);
  const dmg = p.st.atk * mult;
  const inCone = (x, z, r) => {
    const dx = x - p.x,
      dz = z - p.z,
      d = Math.hypot(dx, dz);
    if (d > reach + r) return false;
    return d < r + p.r * 0.5 || (dx * fx + dz * fz) / (d || 1) > 0.35;
  };
  let hit = 0;
  const o = S.players[1 - p.seat];
  if (!o.dead && inCone(o.x, o.z, o.r)) hit += hurtPlayer(S, o, dmg, p.seat, { slow: p.st.slow > 0, melee: 1 }) ? 1 : 0;
  if (!p.inDuel) {
    for (const n of S.npcs) if (n.alive && Math.abs(n.x - p.x) < 200 && Math.abs(n.z - p.z) < 200 && inCone(n.x, n.z, n.r)) (hurtNpc(S, n, dmg, p.seat, p.st.slow > 0), hit++);
    const c = S.cores[1 - p.seat];
    if (c && inCone(c.x, c.z, 34)) (hurtStruct(S, c, dmg, p.seat, 1), hit++);
    for (const t of [...S.turrets]) if (t.seat !== p.seat && inCone(t.x, t.z, 18)) (hurtStruct(S, t, dmg, p.seat, 0), hit++);
  }
  return hit;
}
function shoot(S, seat, x, z, ang, dmg, opt = {}) {
  if (S.shots.length > 60) return;
  const sp = opt.speed || 720;
  S.shots.push({ seat, x, z, vx: Math.sin(ang) * sp, vz: Math.cos(ang) * sp, dmg, life: opt.life || 0.75, slow: !!opt.slow, r: opt.r || 8 });
}

const ABIL = {
  none: { cd: 1.6, en: 10 },
  predateur: { cd: 5, en: 25 },
  gardien: { cd: 9, en: 30 },
  nomade: { cd: 4, en: 20 },
  architecte: { cd: 6, en: 30 },
  siphonneur: { cd: 7, en: 15 },
};
export const abilityOf = (p) => ABIL[p.spec || "none"];
export const ABIL_NAME = { none: "Dard de spores", predateur: "Bond", gardien: "Égide", nomade: "Saut quantique", architecte: "Tourelle", siphonneur: "Drain" };
export const WAVE = { cd: 8, en: 30 };

function useAbility(S, p) {
  const a = abilityOf(p);
  if (p.cd.abil > 0 || p.en < a.en) return;
  p.en -= a.en;
  p.cd.abil = a.cd;
  const fx = Math.sin(p.ang),
    fz = Math.cos(p.ang);
  switch (p.spec) {
    case "predateur":
      p.lungeT = 0.28;
      p.lunged = 0;
      p.vx = fx * 950;
      p.vz = fz * 950;
      break;
    case "gardien":
      p.shieldT = 3;
      break;
    case "nomade":
      blink(S, p, 330);
      break;
    case "architecte": {
      const mine = S.turrets.filter((t) => t.seat === p.seat);
      if (mine.length >= 3) S.turrets.splice(S.turrets.indexOf(mine[0]), 1);
      S.turrets.push({ seat: p.seat, x: p.x + fx * (p.r + 30), z: p.z + fz * (p.r + 30), hp: 90 * ACT_SCALE[3], cd: 0.5 });
      break;
    }
    case "siphonneur":
      p.drainT = 2;
      break;
    default:
      shoot(S, p.seat, p.x + fx * p.r, p.z + fz * p.r, p.ang, p.st.atk * 0.9, { slow: p.st.slow > 0 });
  }
  ev(S, "abil", { x: p.x, z: p.z, seat: p.seat, kind: p.spec || "none" });
}
function blink(S, p, dist) {
  const fx = Math.sin(p.ang),
    fz = Math.cos(p.ang);
  let d = dist;
  for (; d > 0; d -= 20) {
    const x = p.x + fx * d,
      z = p.z + fz * d;
    if (!blocked(S, x, z, p.r) && inBounds(S, p, x, z)) break;
  }
  ev(S, "blink", { x: p.x, z: p.z, x2: p.x + fx * d, z2: p.z + fz * d, seat: p.seat });
  p.x += fx * d;
  p.z += fz * d;
}
function inBounds(S, p, x, z) {
  if (p.inDuel) return d2(x, z, ARENA.x, ARENA.z) < (ARENA.r - p.r) ** 2;
  return Math.abs(x) < HALF - p.r && Math.abs(z) < HALF - p.r;
}
function blocked(S, x, z, r) {
  for (const o of nearObstacles(S.W, x, z)) if (d2(x, z, o.x, o.z) < (o.r + r) ** 2) return true;
  return false;
}
function collide(S, e) {
  for (const o of nearObstacles(S.W, e.x, e.z)) {
    const dx = e.x - o.x,
      dz = e.z - o.z,
      m = o.r + e.r,
      dd = dx * dx + dz * dz;
    if (dd < m * m) {
      const d = Math.sqrt(dd) || 1;
      e.x = o.x + (dx / d) * m;
      e.z = o.z + (dz / d) * m;
      const vn = (e.vx * dx + e.vz * dz) / d;
      if (vn < 0) {
        e.vx -= (vn * dx) / d;
        e.vz -= (vn * dz) / d;
      }
    }
  }
}

/* ============ BOUCLE DE SIMULATION ============ */
export function step(S, dt = STEP) {
  if (S.over) return;
  S.t += dt;
  // en solo, le monde attend pendant que la personne choisit sa mutation
  if (S.solo && S.players.some((p) => !p.bot && waitingChoice(p))) {
    for (const p of S.players) if (p.bot) botThink(S, p, dt, true);
    return;
  }
  if (S.phase === "prep") {
    S.phaseT -= dt;
    if (S.phaseT <= 0) {
      S.phase = "duel";
      S.phaseT = DUEL_TIME;
      for (const p of S.players) p.inv = 0.5;
      ev(S, "fight", {});
    }
  } else if (S.phase === "duel") {
    S.phaseT -= dt;
    if (S.phaseT <= 0) return duelTimeout(S);
  }
  for (const p of S.players) if (p.bot) botThink(S, p, dt);
  for (const p of S.players) stepPlayer(S, p, dt);
  // poussée entre les deux joueurs
  const [a, b] = S.players;
  if (!a.dead && !b.dead) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      m = a.r + b.r,
      dd = dx * dx + dz * dz;
    if (dd < m * m && dd > 0.01) {
      const d = Math.sqrt(dd),
        push = (m - d) / 2;
      a.x -= (dx / d) * push;
      a.z -= (dz / d) * push;
      b.x += (dx / d) * push;
      b.z += (dz / d) * push;
    }
  }
  if (S.phase === "world") {
    stepNpcs(S, dt);
    stepWorld(S, dt);
  } else stepBeacons(S, dt);
  stepShots(S, dt);
}

function stepPlayer(S, p, dt) {
  if (p.dead) {
    p.respT -= dt;
    if (p.respT <= 0 && S.phase === "world") respawn(S, p);
    return;
  }
  const st = p.st,
    I = p.inp;
  for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt);
  p.inv = Math.max(0, p.inv - dt);
  p.hurt = Math.max(0, p.hurt - dt);
  p.slowT = Math.max(0, p.slowT - dt);
  p.shieldT = Math.max(0, p.shieldT - dt);
  p.atkT = Math.max(0, p.atkT - dt);
  const b = p.inDuel ? 5 : biomeAt(S.W, p.x, p.z);
  let spd = st.speed;
  if (p.slowT > 0) spd *= 0.65;
  if (!st.glide && BIOMES[b].slow) spd *= 1 - BIOMES[b].slow;
  if (!p.inDuel && !st.glide)
    for (const h of S.W.hazards)
      if (d2(p.x, p.z, h.x, h.z) < h.r * h.r) {
        spd *= 0.8;
        if (p.inv <= 0) {
          p.hp -= 7 * dt * (1 - st.armor);
          p.hurt = Math.max(p.hurt, 0.05);
          if (p.hp <= 0) killPlayer(S, p, -1);
        }
      }
  if (p.dead) return;
  let mx = clamp(I.mx, -1, 1),
    mz = clamp(I.mz, -1, 1);
  const ml = Math.hypot(mx, mz);
  if (ml > 1) (mx /= ml, mz /= ml);
  if (p.lungeT > 0) {
    p.lungeT -= dt;
    if (!p.lunged && meleeHit(S, p, 2.2, 10)) p.lunged = 1;
  } else if (p.dashT > 0) p.dashT -= dt;
  else {
    const k = Math.min(1, st.accel * dt);
    p.vx += (mx * spd - p.vx) * k;
    p.vz += (mz * spd - p.vz) * k;
  }
  if (I.aim !== null && I.aim !== undefined && isFinite(I.aim)) p.ang = I.aim;
  else if (ml > 0.15 && p.lungeT <= 0) p.ang = Math.atan2(mx, mz) - angDiff(Math.atan2(mx, mz), p.ang) * Math.exp(-14 * dt);
  // actions (les impulsions sont consommées ici)
  if (I.dash) {
    I.dash = 0;
    if (p.cd.dash <= 0 && p.en >= 12) {
      p.en -= 12;
      p.cd.dash = 2.2 * st.dashCd;
      p.inv = Math.max(p.inv, 0.28);
      const dx = ml > 0.15 ? mx / ml : Math.sin(p.ang),
        dz = ml > 0.15 ? mz / ml : Math.cos(p.ang);
      if (st.blink) {
        const a = p.ang;
        p.ang = Math.atan2(dx, dz);
        blink(S, p, 190 * st.dash);
        p.ang = a;
      } else {
        p.vx = dx * spd * 3.3 * Math.sqrt(st.dash);
        p.vz = dz * spd * 3.3 * Math.sqrt(st.dash);
        p.dashT = 0.2;
      }
      ev(S, "dash", { x: p.x, z: p.z, seat: p.seat });
    }
  }
  if ((I.atk || I.atkQ) && p.cd.atk <= 0 && p.en >= 3) {
    I.atkQ = 0;
    p.en -= 3;
    p.cd.atk = 0.45;
    p.atkT = 0.2;
    meleeHit(S, p, 1);
    ev(S, "atk", { x: p.x, z: p.z, seat: p.seat, a: p.ang, r: p.r + st.range });
  }
  if (I.abil) {
    I.abil = 0;
    useAbility(S, p);
  }
  if (I.wave) {
    I.wave = 0;
    if (p.act >= 2 && p.cd.wave <= 0 && p.en >= WAVE.en) {
      p.en -= WAVE.en;
      p.cd.wave = WAVE.cd;
      const R = 100 + p.r * 1.6;
      ev(S, "wave", { x: p.x, z: p.z, r: R, seat: p.seat });
      const o = S.players[1 - p.seat];
      const kb = (e, f) => {
        const dx = e.x - p.x,
          dz = e.z - p.z,
          d = Math.hypot(dx, dz) || 1;
        e.vx += (dx / d) * f;
        e.vz += (dz / d) * f;
      };
      if (!o.dead && d2(o.x, o.z, p.x, p.z) < (R + o.r) ** 2) {
        hurtPlayer(S, o, st.atk * 1.2, p.seat, { slow: st.slow > 0 });
        kb(o, 520);
      }
      if (!p.inDuel)
        for (const n of S.npcs)
          if (n.alive && d2(n.x, n.z, p.x, p.z) < (R + n.r) ** 2) {
            hurtNpc(S, n, st.atk * 1.2, p.seat, st.slow > 0);
            kb(n, 400);
          }
    }
  }
  if (I.build) {
    I.build = 0;
    if (p.act >= 3 && !p.inDuel && !S.cores[p.seat]) {
      const oc = S.cores[1 - p.seat];
      if (!oc || d2(oc.x, oc.z, p.x, p.z) > 600 * 600) {
        S.cores[p.seat] = { seat: p.seat, x: p.x, z: p.z, hp: 320 * st.build };
        ev(S, "core", { x: p.x, z: p.z, seat: p.seat });
      } else ev(S, "deny", { seat: p.seat, msg: "Trop près du noyau rival" });
    }
  }
  if (p.drainT > 0) {
    p.drainT -= dt;
    const o = S.players[1 - p.seat];
    let tgt = null;
    if (!o.dead && d2(o.x, o.z, p.x, p.z) < (260 + p.r) ** 2) tgt = o;
    else if (!p.inDuel) {
      let bd = (260 + p.r) ** 2;
      for (const n of S.npcs)
        if (n.alive) {
          const d = d2(n.x, n.z, p.x, p.z);
          if (d < bd) (bd = d, tgt = n);
        }
    }
    if (tgt) {
      const v = st.atk * 1.1 * dt;
      if (tgt === o) {
        const got = hurtPlayer(S, o, v, p.seat);
        o.en = Math.max(0, o.en - 14 * dt);
        p.hp = Math.min(p.maxHp, p.hp + got);
      } else {
        hurtNpc(S, tgt, v, p.seat);
        p.hp = Math.min(p.maxHp, p.hp + v * 0.8);
      }
      p.en = Math.min(p.maxEn, p.en + 10 * dt);
      p.drainTo = { x: tgt.x, z: tgt.z };
    } else p.drainTo = null;
  } else p.drainTo = null;
  // déplacement + collisions
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  if (!p.inDuel) {
    collide(S, p);
    p.x = clamp(p.x, -HALF + p.r, HALF - p.r);
    p.z = clamp(p.z, -HALF + p.r, HALF - p.r);
  } else {
    const dx = p.x - ARENA.x,
      dz = p.z - ARENA.z,
      d = Math.hypot(dx, dz),
      m = ARENA.r - p.r;
    if (d > m) (p.x = ARENA.x + (dx / d) * m, p.z = ARENA.z + (dz / d) * m);
  }
  // récupération
  let regen = st.regen;
  const core = S.cores[p.seat];
  if (core && d2(core.x, core.z, p.x, p.z) < 220 * 220) regen += 6;
  p.hp = Math.min(p.maxHp, p.hp + regen * dt * (p.act > 1 ? 1.5 : 1));
  p.en = Math.min(p.maxEn, p.en + st.enRegen * dt);
  if (p.inDuel) return;
  // ramassage
  const pr = p.r + 8 * st.pickup + (st.pickup - 1) * 20;
  for (let i = 0; i < S.nut.length; i++) {
    const n = S.nut[i];
    if (!n.alive || Math.abs(n.x - p.x) > pr + 10 || Math.abs(n.z - p.z) > pr + 10) continue;
    if (d2(n.x, n.z, p.x, p.z) < pr * pr) {
      n.alive = 0;
      n.respT = 22;
      S.nutChg.push(i);
      const big = n.kind > 0;
      gainXp(S, p, n.kind === 0 ? 3 + p.act : n.kind === 1 ? 14 : 8);
      p.en = Math.min(p.maxEn, p.en + (big ? 12 : 4));
      p.hp = Math.min(p.maxHp, p.hp + (big ? 6 : 1));
      p.stat.res++;
      gainZen(S, p, n.kind === 2 ? 2.5 : big ? 1 : 0.18);
      ev(S, "eat", { x: n.x, z: n.z, seat: p.seat, kind: n.kind });
    }
  }
  for (const f of S.frags) {
    if (f.got[p.seat] || d2(f.x, f.z, p.x, p.z) > (p.r + 46) ** 2) continue;
    f.got[p.seat] = 1;
    if (!p.story.includes(f.text)) p.story.push(f.text);
    if (f.poi) p.frags++;
    gainXp(S, p, 12);
    gainZen(S, p, 2);
    ev(S, "frag", { x: f.x, z: f.z, seat: p.seat, text: f.text });
    checkAct(S, p);
  }
}

function stepWorld(S, dt) {
  for (let i = 0; i < S.nut.length; i++) {
    const n = S.nut[i];
    if (!n.alive && (n.respT -= dt) <= 0) {
      n.alive = 1;
      S.nutChg.push(i);
    }
  }
  // relais : se tenir seul dessus pour le capturer
  for (const r of S.relays) {
    const inside = S.players.filter((p) => !p.dead && p.act >= 2 && d2(p.x, p.z, r.x, r.z) < (r.r + p.r) ** 2);
    if (inside.length === 1) {
      const p = inside[0];
      if (r.owner !== p.seat) {
        if (r.by !== p.seat) (r.by = p.seat, r.prog = 0);
        r.prog += dt / 4;
        if (r.prog >= 1) {
          r.owner = p.seat;
          r.prog = 0;
          p.stat.zones++;
          gainXp(S, p, 30);
          ev(S, "cap", { x: r.x, z: r.z, seat: p.seat });
        }
      }
    } else if (!inside.length) r.prog = Math.max(0, r.prog - dt / 8);
    if (r.owner >= 0) {
      const o = S.players[r.owner];
      if (o.act === 2) gainXp(S, o, 1.2 * dt);
      gainZen(S, o, 0.13 * dt);
    }
  }
  for (const p of S.players) {
    gainZen(S, p, 0.08 * dt);
    const c = S.cores[p.seat];
    if (c) gainZen(S, p, 0.22 * p.st.build * dt);
  }
  // tourelles
  for (const t of S.turrets) {
    t.cd -= dt;
    if (t.cd > 0) continue;
    const o = S.players[1 - t.seat];
    let tgt = null;
    if (!o.dead && d2(o.x, o.z, t.x, t.z) < 340 * 340) tgt = o;
    else
      for (const n of S.npcs)
        if (n.alive && NPC_KINDS[n.kind].aggro && d2(n.x, n.z, t.x, t.z) < 300 * 300) {
          tgt = n;
          break;
        }
    if (tgt) {
      t.cd = 0.8;
      shoot(S, t.seat, t.x, t.z, Math.atan2(tgt.x - t.x, tgt.z - t.z), S.players[t.seat].st.atk * 0.45, { speed: 800, life: 0.5 });
    } else t.cd = 0.2;
  }
}

function stepShots(S, dt) {
  for (let i = S.shots.length - 1; i >= 0; i--) {
    const s = S.shots[i];
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    s.life -= dt;
    let hit = s.life <= 0 || (S.phase === "world" && blocked(S, s.x, s.z, s.r));
    const o = S.players[1 - s.seat];
    if (!hit && !o.dead && d2(o.x, o.z, s.x, s.z) < (o.r + s.r) ** 2) {
      hurtPlayer(S, o, s.dmg, s.seat, { slow: s.slow });
      hit = true;
    }
    if (!hit && S.phase === "world") {
      for (const n of S.npcs)
        if (n.alive && d2(n.x, n.z, s.x, s.z) < (n.r + s.r) ** 2) {
          hurtNpc(S, n, s.dmg, s.seat, s.slow);
          hit = true;
          break;
        }
      const c = S.cores[1 - s.seat];
      if (!hit && c && d2(c.x, c.z, s.x, s.z) < 40 * 40) {
        hurtStruct(S, c, s.dmg, s.seat, 1);
        hit = true;
      }
    }
    if (hit) {
      if (s.life > 0) ev(S, "spark", { x: s.x, z: s.z, seat: s.seat });
      S.shots.splice(i, 1);
    }
  }
}

function stepBeacons(S, dt) {
  if (S.phase !== "duel") return;
  for (const b of S.beacons) {
    const inside = S.players.filter((p) => !p.dead && d2(p.x, p.z, b.x, b.z) < (60 + p.r) ** 2);
    if (inside.length === 1 && b.owner !== inside[0].seat) {
      const p = inside[0];
      if (b.by !== p.seat) (b.by = p.seat, b.prog = 0);
      b.prog += dt / 2.6;
      if (b.prog >= 1) {
        b.owner = p.seat;
        b.prog = 0;
        p.stat.zones++;
        ev(S, "cap", { x: b.x, z: b.z, seat: p.seat });
      }
    } else if (!inside.length) b.prog = Math.max(0, b.prog - dt / 5);
  }
  for (const s of [0, 1]) if (S.beacons.filter((b) => b.owner === s).length >= 3) return endGame(S, s, "trois balises Zénith capturées");
}
function duelTimeout(S) {
  const n = [0, 1].map((s) => S.beacons.filter((b) => b.owner === s).length);
  if (n[0] !== n[1]) return endGame(S, n[0] > n[1] ? 0 : 1, "majorité de l'arène à la fin du temps");
  const h = S.players.map((p) => p.hp / p.maxHp);
  if (Math.abs(h[0] - h[1]) > 0.01) return endGame(S, h[0] > h[1] ? 0 : 1, "plus de vitalité à la fin du temps");
  endGame(S, -1, "égalité parfaite");
}

/* ============ CRÉATURES NEUTRES ============ */
function stepNpcs(S, dt) {
  for (const n of S.npcs) {
    if (!n.alive) {
      if ((n.respT -= dt) <= 0) {
        const near = S.players.some((p) => d2(p.x, p.z, n.hx, n.hz) < 500 * 500);
        if (near) n.respT = 4;
        else Object.assign(n, spawnNpc(S.W.homes[n.i], n.i));
      }
      continue;
    }
    const K = NPC_KINDS[n.kind];
    n.hurt = Math.max(0, n.hurt - dt);
    n.slowT = Math.max(0, n.slowT - dt);
    n.cd = Math.max(0, n.cd - dt);
    n.think -= dt;
    if (n.think <= 0) {
      n.think = 0.2;
      npcThink(S, n, K);
    }
    let tx = n.wx - n.x,
      tz = n.wz - n.z;
    let spd = K.spd * (n.mode === 0 ? 0.35 : 1) * (n.slowT > 0 ? 0.6 : 1);
    if (n.mode === 2 || n.mode === 1) {
      const p = S.players[n.tgt];
      if (p && !p.dead) {
        tx = p.x - n.x;
        tz = p.z - n.z;
        if (n.mode === 1) (tx = -tx, tz = -tz);
        if (n.mode === 2 && n.cd <= 0 && K.atk && Math.hypot(p.x - n.x, p.z - n.z) < n.r + p.r + 10) {
          n.cd = 1.2;
          hurtPlayer(S, p, K.atk * (1 + (p.act - 1) * 0.35), -1, { melee: 1 });
          if (p.st.thorns) hurtNpc(S, n, K.atk * p.st.thorns, -1);
          ev(S, "bite", { x: n.x, z: n.z });
        }
      }
    }
    const l = Math.hypot(tx, tz);
    if (l > 4) {
      const k = Math.min(1, 4 * dt);
      n.vx += ((tx / l) * spd - n.vx) * k;
      n.vz += ((tz / l) * spd - n.vz) * k;
      n.ang = Math.atan2(n.vx, n.vz);
    } else (n.vx *= 0.9, n.vz *= 0.9);
    n.x += n.vx * dt;
    n.z += n.vz * dt;
    collide(S, n);
    n.x = clamp(n.x, -HALF + n.r, HALF - n.r);
    n.z = clamp(n.z, -HALF + n.r, HALF - n.r);
  }
}
function npcThink(S, n, K) {
  let best = -1,
    bd = 320 * 320;
  for (const p of S.players) {
    if (p.dead) continue;
    const d = d2(p.x, p.z, n.x, n.z);
    if (d < bd) (bd = d, best = p.seat);
  }
  const leash = d2(n.x, n.z, n.hx, n.hz) > 750 * 750;
  if (best >= 0 && !leash) {
    const p = S.players[best];
    if (n.mode === 2 && n.tgt === best && n.hp < n.hpMax * 0.25 && !K.aggro) n.mode = 1;
    else if (n.mode !== 2 || n.tgt !== best) {
      if (K.aggro && p.r < n.r * 1.7) n.mode = 2;
      else if (p.r > n.r * 0.9) n.mode = 1;
      else n.mode = 0;
      n.tgt = best;
    }
  } else {
    if (n.mode !== 0) n.mode = 0;
    if (leash || d2(n.x, n.z, n.wx, n.wz) < 30 * 30 || S.rand() < 0.02) {
      n.wx = n.hx + (S.rand() - 0.5) * 500;
      n.wz = n.hz + (S.rand() - 0.5) * 500;
    }
  }
}

/* ============ SIGNAL DU RIVAL ============ */
// Ce que tu sais du rival : rien s'il est loin, sauf une impulsion régulière avec une direction imprécise.
export function rivalSignal(S, seat) {
  const me = S.players[seat],
    o = S.players[1 - seat];
  if (o.dead) return null;
  const dist = Math.hypot(o.x - me.x, o.z - me.z);
  const vis = me.st.vision * (o.st.stealth ? 0.65 : 1);
  if (S.phase !== "world" || dist < vis) return { exact: 1, x: o.x, z: o.z, ang: Math.atan2(o.x - me.x, o.z - me.z), dist };
  const period = me.act === 1 ? 7 : me.act === 2 ? 5 : 3.5;
  const ph = S.t % period;
  if (ph > 1.6) return { exact: 0, active: 0 };
  const bucket = Math.floor(S.t / period);
  const R = mulberry(S.seed + bucket * 31 + seat * 7);
  const noise = (0.55 / me.st.sense) * (o.st.stealth ? 2.5 : 1) * (1 + 0.3 * (dist / 4000));
  const ang = Math.atan2(o.x - me.x, o.z - me.z) + (R() - 0.5) * 2 * noise;
  const dr = dist * (0.75 + R() * 0.5);
  return { exact: 0, active: 1, ang, dist: dr, noise, ph: ph / 1.6 };
}

/* ============ ROBOT ADVERSE (ne voit que ce qui est dans son rayon de vision) ============ */
const DIFF = {
  eclaireur: { react: 1.1, skip: 0.3, hunt: 0.25, fight: 0.6, smart: 0, dodge: 0.1, abil: 0.3 },
  rival: { react: 0.5, skip: 0.1, hunt: 0.5, fight: 1.15, smart: 1, dodge: 0.35, abil: 0.7 },
  predateur: { react: 0.25, skip: 0, hunt: 0.85, fight: 0.85, smart: 2, dodge: 0.6, abil: 1 },
};
function newAi(diff) {
  const D = DIFF[diff] || DIFF.rival;
  return { D, think: 0, state: "exploration", tx: 0, tz: 0, mem: new Map(), seenRival: null, seenT: 0, choiceT: 0, explore: null, plan: null, wantAtk: 0, stuck: 0, lx: 0, lz: 0 };
}
const PLANS = {
  predateur: { orient: "o_atk", spec: "predateur", pref: ["machoire", "cils", "propulsion", "entrave", "oeil", "resonance", "chitine", "regen"] },
  gardien: { orient: "o_def", spec: "gardien", pref: ["chitine", "regen", "epines", "sacs", "resonance", "entrave", "machoire"] },
  siphon: { orient: "o_absorb", spec: "siphonneur", pref: ["tentacules", "regen", "sacs", "entrave", "resonance", "chitine", "cils"] },
  nomade: { orient: "o_speed", spec: "nomade", pref: ["cils", "membranes", "propulsion", "portail", "brouillage", "machoire", "resonance"] },
};
function botChoose(S, p) {
  const ai = p.ai,
    ch = currentChoices(p);
  if (!ch) return;
  if (!ai.plan) {
    const keys = Object.keys(PLANS);
    ai.plan = PLANS[ai.D.smart === 2 ? (S.rand() < 0.5 ? "predateur" : "siphon") : keys[Math.floor(S.rand() * keys.length)]];
  }
  let id;
  if (ai.D.smart === 0) id = ch[Math.floor(S.rand() * ch.length)];
  else if (p.specPick) id = ai.plan.spec;
  else if (ch.includes(ai.plan.orient)) id = ai.plan.orient;
  else id = ai.plan.pref.find((x) => ch.includes(x)) || ch[0];
  pick(S, p.seat, id);
}

function botThink(S, p, dt, frozen) {
  const ai = p.ai,
    D = ai.D,
    I = p.inp;
  if (waitingChoice(p)) {
    ai.choiceT += dt;
    if (ai.choiceT > 0.7) {
      ai.choiceT = 0;
      botChoose(S, p);
    }
  }
  if (frozen) return;
  ai.think -= dt;
  if (ai.think > 0 || p.dead) return;
  ai.think = 0.2;
  const V = p.st.vision,
    V2 = V * V;
  const o = S.players[1 - p.seat];
  const duel = S.phase === "duel" || S.phase === "prep";
  // perception : seulement ce qui est à portée de vision
  const rivalVis = !o.dead && d2(o.x, o.z, p.x, p.z) < (V * (o.st.stealth ? 0.65 : 1)) ** 2;
  if (rivalVis) {
    if (!ai.seenRival) ai.seenT = S.t;
    ai.seenRival = { x: o.x, z: o.z, t: S.t };
  } else if (ai.seenRival && S.t - ai.seenRival.t > 6) ai.seenRival = null;
  const engageOk = rivalVis && S.t - ai.seenT >= D.react;
  if (!duel)
    for (let i = 0; i < S.nut.length; i++) {
      const n = S.nut[i];
      if (Math.abs(n.x - p.x) < V && Math.abs(n.z - p.z) < V && d2(n.x, n.z, p.x, p.z) < V2) {
        if (n.alive && !ai.mem.has(i) && S.rand() >= D.skip) ai.mem.set(i, 1);
        else if (!n.alive) ai.mem.delete(i);
      }
    }
  let tx = null,
    tz = null,
    fight = false,
    flee = null;
  const myPow = p.hp * p.st.atk * (1 + p.st.armor),
    oPow = o.hp * o.st.atk * (1 + o.st.armor);
  // menaces
  if (!duel) {
    for (const n of S.npcs) {
      if (!n.alive || !NPC_KINDS[n.kind].aggro || n.r * 1.0 < p.r * 0.8) continue;
      const d = d2(n.x, n.z, p.x, p.z);
      if (d < 260 * 260 && d < V2 && n.hp * NPC_KINDS[n.kind].atk > myPow * 0.6) flee = n;
    }
  }
  if (duel) {
    ai.state = S.phase === "prep" ? "préparation du duel" : "duel final";
    if (S.phase === "prep") {
      tx = ARENA.x + (p.seat ? 200 : -200);
      tz = ARENA.z;
    } else {
      const free = S.beacons.filter((b) => b.owner !== p.seat).sort((a, b) => d2(a.x, a.z, p.x, p.z) - d2(b.x, b.z, p.x, p.z));
      const oDist = Math.hypot(o.x - p.x, o.z - p.z);
      if (free.length && (oDist > 260 || p.hp < p.maxHp * 0.3) && myPow < oPow * 1.3) (tx = free[0].x, tz = free[0].z);
      else (tx = o.x, tz = o.z, fight = true);
    }
  } else if (flee && !(engageOk && myPow > oPow * 2)) {
    ai.state = "fuite";
    tx = p.x + (p.x - flee.x);
    tz = p.z + (p.z - flee.z);
    if (d2(flee.x, flee.z, p.x, p.z) < 120 * 120 && S.rand() < D.dodge) I.dash = 1;
  } else if (engageOk && (o.hp < o.maxHp * D.hunt * 0.6 || myPow > oPow * D.fight) && (D.hunt > 0.3 || o.hp < o.maxHp * 0.25)) {
    ai.state = "poursuite";
    tx = o.x;
    tz = o.z;
    fight = true;
  } else if (engageOk && myPow < oPow * 0.6 && d2(o.x, o.z, p.x, p.z) < 300 * 300) {
    ai.state = "fuite";
    tx = p.x + (p.x - o.x);
    tz = p.z + (p.z - o.z);
  } else {
    const myCore = S.cores[p.seat];
    if (p.act >= 3 && !myCore) {
      ai.state = "défense";
      I.build = 1;
    }
    // proie visible plus petite
    let prey = null,
      pd = (p.act >= 2 ? 520 : 260) ** 2;
    for (const n of S.npcs) {
      if (!n.alive || n.r > p.r * (p.act >= 2 ? 1.3 : 0.9)) continue;
      const d = d2(n.x, n.z, p.x, p.z);
      if (d < pd && d < V2) (pd = d, prey = n);
    }
    // relais à prendre
    let relay = null;
    if (p.act >= 2) {
      let rd = Infinity;
      for (const r of S.relays) {
        if (r.owner === p.seat) continue;
        const d = d2(r.x, r.z, p.x, p.z);
        if (d < rd) (rd = d, relay = r);
      }
    }
    // fragments à découvrir (points d'intérêt affichés sur la carte)
    let frag = null;
    if (p.act === 1 || p.frags < 3) {
      let fd = Infinity;
      for (const f of S.frags) {
        if (!f.poi || f.got[p.seat]) continue;
        const d = d2(f.x, f.z, p.x, p.z);
        if (d < fd && d < 900 * 900) (fd = d, frag = f);
      }
    }
    let food = null,
      fdd = Infinity;
    for (const i of ai.mem.keys()) {
      const n = S.nut[i];
      const d = d2(n.x, n.z, p.x, p.z) / (n.kind ? 4 : 1);
      if (d < fdd) (fdd = d, food = n);
    }
    if (frag && (p.level >= 2 || !food)) ((ai.state = "exploration"), (tx = frag.x), (tz = frag.z));
    else if (relay && (p.act === 3 || d2(relay.x, relay.z, p.x, p.z) < 1100 * 1100 || !food) && S.rand() < 0.98) ((ai.state = "capture"), (tx = relay.x), (tz = relay.z));
    else if (prey && (p.act >= 2 || !food || pd < fdd)) ((ai.state = "chasse"), (tx = prey.x), (tz = prey.z), (fight = d2(prey.x, prey.z, p.x, p.z) < (p.r + prey.r + p.st.range + 10) ** 2));
    else if (food && fdd < 1500 * 1500) ((ai.state = "récolte"), (tx = food.x), (tz = food.z));
    else if (myCore && p.hp < p.maxHp * 0.35) ((ai.state = "défense"), (tx = myCore.x), (tz = myCore.z));
    else {
      ai.state = "exploration";
      if (!ai.explore || d2(ai.explore.x, ai.explore.z, p.x, p.z) < 120 * 120) {
        const base = SPAWNS[p.seat];
        const rad = p.act === 1 ? 900 : 2200;
        ai.explore = { x: clamp(base.x * (p.act === 1 ? 1 : 0.2) + (S.rand() - 0.5) * rad * 2, -HALF + 150, HALF - 150), z: clamp(base.z * (p.act === 1 ? 1 : 0.2) + (S.rand() - 0.5) * rad * 2, -HALF + 150, HALF - 150) };
      }
      tx = ai.explore.x;
      tz = ai.explore.z;
    }
  }
  // pilotage avec évitement d'obstacles
  let dx = tx - p.x,
    dz = tz - p.z;
  const dl = Math.hypot(dx, dz) || 1;
  dx /= dl;
  dz /= dl;
  if (!duel) {
    for (const ob of nearObstacles(S.W, p.x + dx * 80, p.z + dz * 80)) {
      const ox = ob.x - p.x,
        oz = ob.z - p.z,
        ahead = ox * dx + oz * dz;
      if (ahead < 0 || ahead > ob.r + 140) continue;
      const side = ox * dz - oz * dx;
      if (Math.abs(side) < ob.r + p.r + 20) {
        const s = side > 0 ? -1 : 1;
        dx += dz * s * 1.2;
        dz += -dx * s * 1.2;
      }
    }
    // bloqué ? on part de côté un moment
    const moved = Math.hypot(p.x - ai.lx, p.z - ai.lz);
    ai.lx = p.x;
    ai.lz = p.z;
    ai.stuck = moved < 6 && dl > 40 ? ai.stuck + 1 : 0;
    if (ai.stuck > 4) {
      ai.explore = null;
      const a = Math.atan2(dx, dz) + Math.PI / 2;
      dx = Math.sin(a);
      dz = Math.cos(a);
    }
  }
  const l = Math.hypot(dx, dz) || 1;
  const close = dl < 8;
  I.mx = close ? 0 : dx / l;
  I.mz = close ? 0 : dz / l;
  I.aim = null;
  I.atk = 0;
  if (fight || duel) {
    const tgtD = Math.hypot(o.x - p.x, o.z - p.z);
    if ((duel || ai.state === "poursuite") && !o.dead) {
      const reach = p.r + p.st.range + o.r + 6;
      if (tgtD < reach + 30) {
        I.aim = Math.atan2(o.x - p.x, o.z - p.z);
        I.atk = 1;
      }
      if (tgtD < reach * 0.6) (I.mx *= 0.2, I.mz *= 0.2);
      if (S.rand() < D.abil * 0.25 && p.cd.abil <= 0) {
        const range = { predateur: 280, siphonneur: 240, nomade: 500, gardien: 120, architecte: 300 }[p.spec] || 420;
        if (tgtD < range) (I.aim = Math.atan2(o.x - p.x, o.z - p.z), (I.abil = 1));
      }
      if (p.act >= 2 && tgtD < 100 + p.r * 1.6 && S.rand() < D.abil * 0.3) I.wave = 1;
      if (o.atkT > 0 && tgtD < 120 && S.rand() < D.dodge) I.dash = 1;
    } else I.atk = 1;
  }
}

/* ============ INSTANTANÉS RÉSEAU ============ */
const r1 = (v) => Math.round(v * 10) / 10;
const PK = ["x", "z", "vx", "vz", "ang", "hp", "en", "zen", "xp", "level", "act", "dead", "respT", "inv", "hurt", "slowT", "shieldT", "drainT", "lungeT", "atkT", "dashT", "frags", "inDuel", "adv"];
export function snapshot(S, forSeat = 1, full = false) {
  const me = S.players[forSeat];
  const P = S.players.map((p) => ({
    v: PK.map((k) => r1(+p[k] || 0)),
    cd: [r1(p.cd.atk), r1(p.cd.dash), r1(p.cd.abil), r1(p.cd.wave)],
    muts: p.muts,
    spec: p.spec,
    picks: p.picks,
    specPick: p.specPick,
    story: p.story,
    stat: p.stat,
    dt: p.drainTo ? [p.drainTo.x | 0, p.drainTo.z | 0] : 0,
  }));
  const n = [];
  for (const e of S.npcs) if (full || (e.alive && Math.abs(e.x - me.x) < 1700 && Math.abs(e.z - me.z) < 1700) || !e.alive) n.push([e.i, e.x | 0, e.z | 0, r1(e.ang), e.alive ? Math.max(1, Math.round((e.hp / e.hpMax) * 100)) : 0, e.mode, e.hurt > 0 ? 1 : 0]);
  const out = {
    t: r1(S.t), ph: S.phase, pt: r1(S.phaseT), P, n,
    R: S.relays.map((r) => [r.owner, r.by, Math.round(r.prog * 100) / 100]),
    F: S.frags.map((f) => f.got[0] + 2 * f.got[1]),
    C: S.cores.map((c) => (c ? [c.x | 0, c.z | 0, c.hp | 0] : 0)),
    T: S.turrets.map((t) => [t.seat, t.x | 0, t.z | 0, t.hp | 0]),
    X: S.shots.map((s) => [s.seat, s.x | 0, s.z | 0, r1(s.vx), r1(s.vz)]),
    B: S.beacons.map((b) => [b.x | 0, b.z | 0, b.owner, b.by, Math.round(b.prog * 100) / 100]),
    O: S.over,
    df: S.duelFirst,
  };
  if (full) out.nut = S.nut.map((x) => x.alive);
  else out.nc = [...new Set(S.nutChg)].map((i) => [i, S.nut[i].alive]);
  return out;
}
export function clearNutChanges(S) {
  S.nutChg.length = 0;
}
const num = (v, a, b) => clamp(+v || 0, a, b);
const ids = (arr, set) => (Array.isArray(arr) ? arr.filter((x) => set[x]).slice(0, 40) : []);
export function applySnapshot(S, d) {
  if (!d || typeof d !== "object") return;
  S.t = num(d.t, 0, 1e6);
  if (["world", "prep", "duel", "over"].includes(d.ph)) S.phase = d.ph;
  S.phaseT = num(d.pt, 0, 999);
  S.duelFirst = num(d.df, -1, 1) | 0;
  (Array.isArray(d.P) ? d.P : []).slice(0, 2).forEach((q, i) => {
    if (!q || !Array.isArray(q.v)) return;
    const p = S.players[i];
    PK.forEach((k, j) => {
      const v = num(q.v[j], -1e5, 1e5);
      if (k === "x" || k === "z") p["n" + k] = v;
      else p[k] = v;
    });
    if (!p.synced || Math.hypot(p.nx - p.x, p.nz - p.z) > 300) (p.x = p.nx, p.z = p.nz, (p.synced = 1));
    if (Array.isArray(q.cd)) ["atk", "dash", "abil", "wave"].forEach((k, j) => (p.cd[k] = num(q.cd[j], 0, 99)));
    const muts = ids(q.muts, MUT_BY),
      spec = SPECS.some((s) => s.id === q.spec) ? q.spec : null;
    const changed = muts.join() !== p.muts.join() || spec !== p.spec;
    p.muts = muts;
    p.spec = spec;
    p.picks = Array.isArray(q.picks) ? q.picks.slice(0, 20).map((c) => ids(c, MUT_BY)) : [];
    p.specPick = !!q.specPick;
    p.story = Array.isArray(q.story) ? q.story.filter((x) => Number.isInteger(x) && x >= 0 && x < STORY.length) : [];
    if (q.stat && typeof q.stat === "object") for (const k of ["res", "dmg", "zones", "kills", "deaths"]) p.stat[k] = num(q.stat[k], 0, 1e7);
    p.drainTo = Array.isArray(q.dt) ? { x: num(q.dt[0], -1e5, 1e5), z: num(q.dt[1], -1e5, 1e5) } : null;
    const hp = p.hp;
    if (changed || p._act !== p.act || p._duel !== p.inDuel) {
      recalc(p);
      p._act = p.act;
      p._duel = p.inDuel;
    }
    p.hp = hp;
    p.r = sizeOf(p);
  });
  if (Array.isArray(d.n))
    for (const a of d.n) {
      const e = S.npcs[a?.[0] | 0];
      if (!e || !Array.isArray(a)) continue;
      e.nx = num(a[1], -HALF, HALF);
      e.nz = num(a[2], -HALF, HALF);
      e.ang = num(a[3], -99, 99);
      const h = num(a[4], 0, 100);
      if (!h) e.alive = 0;
      else {
        if (!e.alive || Math.hypot(e.nx - e.x, e.nz - e.z) > 400) (e.x = e.nx, e.z = e.nz);
        e.alive = 1;
        e.hp = (e.hpMax * h) / 100;
      }
      e.mode = a[5] | 0;
      e.hurt = a[6] ? 0.2 : 0;
    }
  if (Array.isArray(d.nut)) d.nut.forEach((v, i) => S.nut[i] && (S.nut[i].alive = v ? 1 : 0));
  if (Array.isArray(d.nc)) for (const [i, v] of d.nc) if (S.nut[i]) S.nut[i].alive = v ? 1 : 0;
  if (Array.isArray(d.R)) d.R.forEach((a, i) => S.relays[i] && Array.isArray(a) && ((S.relays[i].owner = num(a[0], -1, 1) | 0), (S.relays[i].by = num(a[1], -1, 1) | 0), (S.relays[i].prog = num(a[2], 0, 1))));
  if (Array.isArray(d.F)) d.F.forEach((v, i) => S.frags[i] && (S.frags[i].got = [v & 1 ? 1 : 0, v & 2 ? 1 : 0]));
  if (Array.isArray(d.C)) S.cores = [0, 1].map((i) => (Array.isArray(d.C[i]) ? { seat: i, x: num(d.C[i][0], -HALF, HALF), z: num(d.C[i][1], -HALF, HALF), hp: num(d.C[i][2], 0, 1e5) } : null));
  if (Array.isArray(d.T)) S.turrets = d.T.slice(0, 6).map((a) => ({ seat: num(a[0], 0, 1) | 0, x: num(a[1], -HALF, HALF), z: num(a[2], -HALF, HALF), hp: num(a[3], 0, 1e5), cd: 0 }));
  if (Array.isArray(d.X)) S.shots = d.X.slice(0, 60).map((a) => ({ seat: num(a[0], 0, 1) | 0, x: num(a[1], -1e5, 1e5), z: num(a[2], -1e5, 1e5), vx: num(a[3], -3000, 3000), vz: num(a[4], -3000, 3000), life: 0.3, r: 8 }));
  if (Array.isArray(d.B)) S.beacons = d.B.slice(0, 5).map((a) => ({ x: num(a[0], -1e5, 1e5), z: num(a[1], -1e5, 1e5), owner: num(a[2], -1, 1) | 0, by: num(a[3], -1, 1) | 0, prog: num(a[4], 0, 1) }));
  if (d.O && typeof d.O === "object") S.over = { winner: num(d.O.winner, -1, 1) | 0, reason: String(d.O.reason || "").slice(0, 80), t: num(d.O.t, 0, 1e6) };
}
/** Côté invité : avance l'affichage entre deux instantanés (interpolation). */
export function guestStep(S, dt) {
  S.t += dt;
  const k = Math.min(1, dt * 10);
  for (const p of S.players) {
    if (p.nx === undefined) continue;
    p.nx += p.vx * dt;
    p.nz += p.vz * dt;
    p.x += (p.nx - p.x) * k;
    p.z += (p.nz - p.z) * k;
    for (const c in p.cd) p.cd[c] = Math.max(0, p.cd[c] - dt);
    for (const c of ["inv", "hurt", "atkT", "shieldT", "drainT", "lungeT", "dashT"]) p[c] = Math.max(0, p[c] - dt);
  }
  for (const n of S.npcs) {
    if (n.nx === undefined || !n.alive) continue;
    n.x += (n.nx - n.x) * k;
    n.z += (n.nz - n.z) * k;
    n.hurt = Math.max(0, n.hurt - dt);
  }
  for (const s of S.shots) (s.x += s.vx * dt, (s.z += s.vz * dt));
  if (S.phase === "duel" || S.phase === "prep") S.phaseT = Math.max(0, S.phaseT - dt);
}
