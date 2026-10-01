import test from "node:test";
import assert from "node:assert/strict";
import * as S from "../games/poules/sim.js";

const playShot = (st, shooter, face, el, power, w = 0) => {
  const el_ = (el * Math.PI) / 180;
  const sp = S.WEAPONS[w].speed * Math.max(0.15, power);
  const p = { x: shooter.x, y: shooter.y + 1.3, vx: face * Math.cos(el_) * sp, vy: Math.sin(el_) * sp, t: 0 };
  let hit = null;
  for (let i = 0; i < 2000 && !hit; i++) hit = S.stepProjectile(p, st, 1 / 120, shooter.id);
  if (hit && (hit.kind === "ground" || hit.kind === "hit")) S.explode(st, hit.x, hit.y, S.WEAPONS[w]);
  for (let i = 0; i < 1200; i++) for (const c of st.chickens) S.stepChicken(c, st.terrain, 1 / 120);
  return hit;
};

test("le terrain est valide et reproductible", () => {
  const a = S.makeTerrain(42);
  const b = S.makeTerrain(42);
  assert.deepEqual(a, b);
  assert.equal(a.length, S.COLS + 1);
  assert.ok(a.every((v) => v >= 7 && v <= 30));
  assert.notDeepEqual(a, S.makeTerrain(43));
});

test("le vent est identique pour tous et borné", () => {
  for (let t = 0; t < 50; t++) {
    const w = S.windFor(123, t);
    assert.equal(w, S.windFor(123, t));
    assert.ok(w >= -10 && w <= 10);
  }
});

test("un cratère creuse seulement dans son rayon", () => {
  const h = S.makeTerrain(7);
  const before = [...h];
  const [i0, i1] = S.carve(h, 60, h[120] , 5);
  for (let i = 0; i <= S.COLS; i++) {
    if (i < i0 || i > i1) assert.equal(h[i], before[i]);
    else assert.ok(h[i] <= before[i]);
  }
  assert.ok(h[120] < before[120]);
  assert.ok(h.every((v) => v >= 0));
});

test("les dégâts diminuent avec la distance et ne descendent pas sous 0", () => {
  const st = S.newState(5);
  const [near, far] = [st.chickens[0], st.chickens[1]];
  near.x = 50; near.y = S.groundY(st.terrain, 50);
  far.x = 50 + 6; far.y = S.groundY(st.terrain, 56);
  const hits = S.explode(st, 50, near.y, S.WEAPONS[0]);
  const dn = hits.find((h) => h.id === near.id)?.dmg ?? 0;
  const df = hits.find((h) => h.id === far.id)?.dmg ?? 0;
  assert.ok(dn > df, `proche ${dn} > loin ${df}`);
  assert.ok(st.chickens.every((c) => c.hp >= 0 && c.hp <= 100));
});

test("une poule qui tombe à l'eau est éliminée", () => {
  const st = S.newState(9);
  const c = st.chickens[0];
  for (let i = 0; i < S.COLS + 1; i++) st.terrain[i] = 0.2;
  for (let i = 0; i < 600 && c.alive; i++) S.stepChicken(c, st.terrain, 1 / 120);
  assert.equal(c.alive, false);
});

test("la simulation est déterministe : mêmes entrées, même résultat", () => {
  const run = () => {
    const st = S.newState(77);
    S.beginTurn(st);
    playShot(st, st.chickens[st.cur], 1, 45, 0.8);
    return JSON.stringify(S.snapshot(st));
  };
  assert.equal(run(), run());
});

test("le robot touche sa cible dans la majorité des cas", () => {
  let ok = 0;
  const N = 24;
  for (let seed = 1; seed <= N; seed++) {
    const st = S.newState(seed * 31);
    st.turn = 1; // équipe 1
    S.beginTurn(st);
    const shooter = st.chickens[st.cur];
    const plan = S.planShot(st, shooter, 0);
    assert.ok(plan, "un plan existe");
    const hit = playShot(st, shooter, plan.face, plan.el, plan.power, 0);
    const damaged = st.chickens.some((c) => c.team === 0 && c.hp < 100);
    if (damaged) ok++;
  }
  assert.ok(ok >= N * 0.7, `touchées : ${ok}/${N}`);
});

test("la fin de partie est détectée", () => {
  const st = S.newState(3);
  assert.equal(S.winner(st), null);
  st.chickens.filter((c) => c.team === 1).forEach((c) => (c.alive = false));
  assert.equal(S.winner(st), 0);
  st.chickens.forEach((c) => (c.alive = false));
  assert.equal(S.winner(st), -1);
});

test("les tours alternent entre les équipes et les poules", () => {
  const st = S.newState(11);
  const order = [];
  for (let i = 0; i < 6; i++) {
    st.turn = i;
    S.beginTurn(st);
    order.push(`${st.team}:${st.cur}`);
  }
  assert.deepEqual(order, ["0:0", "1:3", "0:1", "1:4", "0:2", "1:5"]);
});
