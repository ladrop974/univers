// Poules Armageddon : règles du jeu, sans DOM ni 3D (testable avec Node).
// Déterministe : seulement + - * / et Math.sqrt dans la simulation (identique sur tous les appareils).

export const W = 120; // largeur du monde
export const COLS = 240; // colonnes du terrain
export const DX = W / COLS;
export const G = 32; // gravité
export const WATER_Y = 1; // sous cette hauteur : eau
export const SPEED = 9; // vitesse de marche
export const WEAPONS = [
  { id: "egg", name: "Œuf", r: 5, dmg: 45, speed: 58 },
  { id: "big", name: "Gros œuf", r: 8, dmg: 70, speed: 58 },
];
/** Munitions par arme (-1 = illimité). */
export const freshAmmo = () => [-1, 2];

/** Générateur pseudo-aléatoire (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Vent du tour (même valeur chez les deux joueurs, sans message). Entre -10 et 10. */
export function windFor(seed, turn) {
  const r = rng((seed ^ Math.imul(turn + 1, 2654435761)) >>> 0);
  r();
  return Math.round((r() * 2 - 1) * 100) / 10;
}

/** Terrain : hauteur de chaque colonne. Créé par l'hôte puis envoyé tel quel à l'autre joueur. */
export function makeTerrain(seed) {
  const r = rng(seed);
  const p1 = r() * 6.283;
  const p2 = r() * 6.283;
  const p3 = r() * 6.283;
  const h = new Array(COLS + 1);
  for (let i = 0; i <= COLS; i++) {
    const x = i / COLS;
    let v =
      15 +
      7 * Math.sin(x * 6.283 * 1.5 + p1) +
      4 * Math.sin(x * 6.283 * 3.2 + p2) +
      2 * Math.sin(x * 6.283 * 7 + p3);
    v = Math.max(7, Math.min(30, v));
    h[i] = Math.round(v * 100) / 100;
  }
  return h;
}

export function groundY(h, x) {
  const f = Math.max(0, Math.min(W, x)) / DX;
  const i = Math.floor(f);
  const t = f - i;
  const j = Math.min(COLS, i + 1);
  return h[i] * (1 - t) + h[j] * t;
}

/** Creuse un cratère (cercle). Renvoie les colonnes touchées [i0, i1]. */
export function carve(h, cx, cy, r) {
  const i0 = Math.max(0, Math.floor((cx - r) / DX));
  const i1 = Math.min(COLS, Math.ceil((cx + r) / DX));
  for (let i = i0; i <= i1; i++) {
    const dx = i * DX - cx;
    if (dx <= -r || dx >= r) continue;
    const low = cy - Math.sqrt(r * r - dx * dx);
    if (low < h[i]) h[i] = Math.max(0, low);
  }
  return [i0, i1];
}

export function newChicken(id, team, x, h, name) {
  return {
    id,
    team,
    name,
    x,
    y: groundY(h, x),
    vx: 0,
    vy: 0,
    hp: 100,
    alive: true,
    face: team === 0 ? 1 : -1,
    grounded: true,
  };
}

export function walk(c, h, dir, dt) {
  c.face = dir;
  if (!c.grounded) return;
  const nx = Math.max(1, Math.min(W - 1, c.x + dir * SPEED * dt));
  const ny = groundY(h, nx);
  if (ny - c.y > SPEED * dt * 1.4) return; // trop raide
  c.x = nx;
  if (c.y - ny > 0.5) c.grounded = false;
  else c.y = ny;
}

export function jump(c) {
  if (!c.grounded) return;
  c.vy = 15;
  c.vx = c.face * 6;
  c.grounded = false;
}

export function stepChicken(c, h, dt) {
  if (!c.alive) return;
  c.vy -= G * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  if (c.x < 1) {
    c.x = 1;
    c.vx = 0;
  } else if (c.x > W - 1) {
    c.x = W - 1;
    c.vx = 0;
  }
  const gy = groundY(h, c.x);
  if (c.y <= gy) {
    if (c.vy < -20) {
      c.hp = Math.max(0, c.hp - Math.round((-c.vy - 20) * 1.2));
      if (c.hp === 0) c.alive = false;
    }
    c.y = gy;
    c.vy = 0;
    c.grounded = true;
    c.vx *= Math.max(0, 1 - 8 * dt);
    if (Math.abs(c.vx) < 0.05) c.vx = 0;
  } else {
    c.grounded = false;
  }
  if (c.y < WATER_Y) {
    c.alive = false;
    c.hp = 0;
    c.drowned = true;
  }
}

/** Explosion : cratère + dégâts + recul. Renvoie ce que chaque poule a reçu. */
export function explode(S, x, y, wp) {
  carve(S.terrain, x, y, wp.r);
  const reach = wp.r * 1.7;
  const hits = [];
  for (const c of S.chickens) {
    if (!c.alive) continue;
    const dx = c.x - x;
    const dy = c.y + 0.9 - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= reach) continue;
    const f = 1 - d / reach;
    const dmg = Math.round(wp.dmg * f);
    c.hp = Math.max(0, c.hp - dmg);
    const nx = d > 0.001 ? dx / d : 0;
    const ny = d > 0.001 ? dy / d : 1;
    c.vx += nx * f * 26;
    c.vy += ny * f * 26 + f * 8;
    c.grounded = false;
    if (c.hp === 0) c.alive = false;
    hits.push({ id: c.id, dmg });
  }
  return hits;
}

/** Un pas du projectile. Renvoie null en vol, sinon l'impact {kind, x, y}. */
export function stepProjectile(p, S, dt, shooterId) {
  p.vx += S.wind * 0.5 * dt;
  p.vy -= G * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.t += dt;
  if (p.x < -3 || p.x > W + 3 || p.t > 14) return { kind: "out", x: p.x, y: p.y };
  const gy = groundY(S.terrain, p.x);
  if (p.y <= gy) {
    return gy >= WATER_Y
      ? { kind: "ground", x: p.x, y: Math.max(p.y, gy - 0.3) }
      : { kind: "water", x: p.x, y: p.y };
  }
  if (p.y < WATER_Y && gy < WATER_Y) return { kind: "water", x: p.x, y: p.y };
  for (const c of S.chickens) {
    if (!c.alive || (c.id === shooterId && p.t < 0.4)) continue;
    const dx = p.x - c.x;
    const dy = p.y - (c.y + 0.9);
    if (dx * dx + dy * dy < 1.2) return { kind: "hit", x: p.x, y: p.y };
  }
  return null;
}

/** Simule un tir complet (pour le robot). Renvoie l'impact. */
export function simulateShot(S, shooter, face, elDeg, power, wIdx, dt = 1 / 60) {
  const el = (elDeg * Math.PI) / 180;
  const sp = WEAPONS[wIdx].speed * Math.max(0.15, power);
  const p = {
    x: shooter.x,
    y: shooter.y + 1.3,
    vx: face * Math.cos(el) * sp,
    vy: Math.sin(el) * sp,
    t: 0,
  };
  for (let i = 0; i < 1200; i++) {
    const hit = stepProjectile(p, S, dt, shooter.id);
    if (hit) return hit;
  }
  return { kind: "out", x: p.x, y: p.y };
}

/** Le robot cherche le meilleur tir. Renvoie {face, el, power, score} (score = distance à la cible). */
export function planShot(S, shooter, wIdx) {
  const enemies = S.chickens.filter((c) => c.alive && c.team !== shooter.team);
  const friends = S.chickens.filter((c) => c.alive && c.team === shooter.team && c.id !== shooter.id);
  if (!enemies.length) return null;
  const wp = WEAPONS[wIdx];
  let best = null;
  for (const face of [1, -1]) {
    for (let el = 10; el <= 80; el += 2.5) {
      for (let power = 0.35; power <= 1.0001; power += 0.05) {
        const im = simulateShot(S, shooter, face, el, power, wIdx);
        if (im.kind === "out" || im.kind === "water") continue;
        let score = Infinity;
        for (const e of enemies) {
          const d = Math.hypot(im.x - e.x, im.y - (e.y + 0.9));
          if (d < score) score = d;
        }
        for (const f of friends) if (Math.hypot(im.x - f.x, im.y - f.y) < wp.r * 1.5) score += 40;
        if (Math.hypot(im.x - shooter.x, im.y - shooter.y) < wp.r * 1.4) score += 60;
        if (!best || score < best.score) best = { face, el, power, score };
      }
    }
  }
  return best;
}

export const teamAlive = (S, team) => S.chickens.filter((c) => c.team === team && c.alive).length;

/** 0 ou 1 = équipe gagnante, -1 = égalité, null = la partie continue. */
export function winner(S) {
  const a = teamAlive(S, 0);
  const b = teamAlive(S, 1);
  if (a && b) return null;
  if (!a && !b) return -1;
  return a ? 0 : 1;
}

export function newState(seed, names = ["Équipe 1", "Équipe 2"]) {
  const terrain = makeTerrain(seed);
  const xs = [
    [10, 24, 38],
    [82, 96, 110],
  ];
  const chickens = [];
  for (let team = 0; team < 2; team++)
    for (let k = 0; k < 3; k++)
      chickens.push(newChicken(team * 3 + k, team, xs[team][k], terrain, `${names[team]} ${k + 1}`));
  return { terrain, chickens, seed, turn: 0, teamTurn: [0, 0], ammo: [freshAmmo(), freshAmmo()], wind: 0, team: 0, cur: 0 };
}

/** Prépare le tour : équipe, poule qui joue, vent. */
export function beginTurn(S) {
  S.team = S.turn % 2;
  const alive = S.chickens.filter((c) => c.team === S.team && c.alive);
  S.cur = alive[S.teamTurn[S.team] % alive.length].id;
  S.teamTurn[S.team]++;
  S.wind = windFor(S.seed, S.turn);
}

/** Copie transmissible (envoyée à la fin de chaque tour : le tireur fait foi). */
export const snapshot = (S) =>
  JSON.parse(
    JSON.stringify({
      terrain: S.terrain,
      chickens: S.chickens,
      seed: S.seed,
      turn: S.turn,
      teamTurn: S.teamTurn,
      ammo: S.ammo,
    }),
  );
