// Poules Armageddon : duel d'artillerie en 3D (Three.js). 3 poules contre 3 poules, œufs explosifs.
// Modes : "bot" (contre la poule robot), "local" (même écran), "online" (duel par lien).
// En ligne : le tireur fait foi. Chaque tour, il envoie son tir ; à la fin il envoie l'état complet.
import * as THREE from "three";
import * as SIM from "./sim.js";

const { W, COLS, DX, WATER_Y, WEAPONS } = SIM;
const STEP = 1 / 120;
const TEAM_COLORS = [0x3b82f6, 0xef4444];
const DEPTH = 3; // demi-profondeur du terrain (3D)

export default {
  id: "poules",
  name: "Poules Armageddon",
  start(ctx) {
    return new Poules(ctx);
  },
};

class Poules {
  constructor(ctx) {
    this.ctx = ctx;
    if (location.search.includes("debug")) window.__poules = this; // pour les tests
    this.mode = ctx.mode;
    this.seat = ctx.seat;
    this.keys = { left: false, right: false, up: false, down: false, fire: false, jump: false };
    this.off = [];
    this.meshes = new Map();
    this.particles = [];
    this.phase = "wait";
    this.el = 45;
    this.power = 0;
    this.weapon = 0;
    this.charging = false;
    this.posTimer = 0;
    this.shake = 0;
    this.overview = false;
    this.buildDom();
    this.buildScene();
    this.bindInput();
    this.bindNet();
    if (this.mode === "online" && !ctx.isHost) this.setMsg("Connexion à la partie…");
    else this.newGame(ctx.seed);
    this.last = performance.now();
    this.acc = 0;
    this.fpsT = 0;
    this.fpsN = 0;
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  /* ---------------------------------- interface ---------------------------------- */
  buildDom() {
    const root = this.ctx.root;
    root.innerHTML = `
      <canvas class="pa-canvas"></canvas>
      <div class="pa-hud">
        <div class="pa-team pa-t0"><b class="pa-n0"></b><i><u class="pa-hp0"></u></i></div>
        <div class="pa-mid"><div class="pa-turn"></div><div class="pa-wind"></div><div class="pa-time"></div></div>
        <div class="pa-team pa-t1"><b class="pa-n1"></b><i><u class="pa-hp1"></u></i></div>
      </div>
      <div class="pa-msg" hidden></div>
      <div class="pa-controls">
        <div class="pa-left">
          <button data-k="left" aria-label="Aller à gauche">◀</button>
          <button data-k="right" aria-label="Aller à droite">▶</button>
          <button data-k="jump" aria-label="Sauter">⤒</button>
        </div>
        <div class="pa-right">
          <button data-k="up" aria-label="Viser plus haut">▲</button>
          <button data-k="down" aria-label="Viser plus bas">▼</button>
          <button class="pa-weapon" aria-label="Changer d'arme"></button>
          <button class="pa-fire" data-k="fire" aria-label="Tirer (maintenir pour la puissance)">🥚<span class="pa-pow"><u></u></span></button>
        </div>
      </div>
      <div class="pa-tools">
        <button class="pa-view" aria-label="Vue d'ensemble">🔭</button>
        <button class="pa-quit" aria-label="Quitter">✕</button>
      </div>
      <div class="pa-end" hidden><div><h2></h2><p></p><button class="pa-again">Rejouer</button> <button class="pa-leave">Quitter</button></div></div>
      <div class="pa-help">PC : ◀ ▶ marcher · ▲ ▼ viser · Espace maintenu = puissance · J sauter · E arme · V vue</div>`;
    this.$ = (s) => root.querySelector(s);
    this.canvas = this.$(".pa-canvas");
    this.$(".pa-quit").onclick = () => this.ctx.quit();
    this.$(".pa-leave").onclick = () => this.ctx.quit();
    this.$(".pa-again").onclick = () => this.rematch();
    this.$(".pa-view").onclick = () => (this.overview = !this.overview);
    this.$(".pa-weapon").onclick = () => this.switchWeapon();
    this.refreshWeaponButton();
  }

  setMsg(text, ms = 0) {
    const m = this.$(".pa-msg");
    m.textContent = text;
    m.hidden = !text;
    clearTimeout(this.msgT);
    if (text && ms) this.msgT = setTimeout(() => (m.hidden = true), ms);
  }

  refreshWeaponButton() {
    const S = this.S;
    const wp = WEAPONS[this.weapon];
    const left = S ? S.ammo[S.team ?? 0][this.weapon] : -1;
    this.$(".pa-weapon").textContent = `${wp.name}${left >= 0 ? " ×" + left : ""}`;
  }

  /* ------------------------------------ scène 3D ------------------------------------ */
  buildScene() {
    const touch = matchMedia("(pointer: coarse)").matches;
    this.touch = touch;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !touch, powerPreference: "high-performance" });
    this.ratio = Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 2);
    this.renderer.setPixelRatio(this.ratio);
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x8fd0ff);
    scene.fog = new THREE.Fog(0x8fd0ff, 90, 260);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b8f5a, 1.05));
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.15);
    sun.position.set(-30, 60, 40);
    scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 400);
    this.camPos = new THREE.Vector3(W / 2, 20, 60);
    this.camLook = new THREE.Vector3(W / 2, 14, 0);

    // eau
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(W + 200, WATER_Y, 90),
      new THREE.MeshLambertMaterial({ color: 0x2f7fd1, transparent: true, opacity: 0.8 }),
    );
    water.position.set(W / 2, WATER_Y / 2, 0);
    scene.add(water);

    // collines au loin + nuages (décor)
    const hills = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 260, 40, 80, 1),
      new THREE.MeshLambertMaterial({ color: 0x5fa86a, side: THREE.DoubleSide }),
    );
    const pos = hills.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) pos.setY(i, 8 + 9 * Math.sin(pos.getX(i) * 0.05) + 5 * Math.sin(pos.getX(i) * 0.13));
      else pos.setY(i, 0);
    }
    hills.geometry.computeVertexNormals();
    hills.position.set(W / 2, 0, -45);
    scene.add(hills);
    this.clouds = [];
    const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    for (let k = 0; k < 6; k++) {
      const g = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(4 + j * 1.2, 8, 6), cm);
        s.position.set(j * 4, (j % 2) * 1.2, 0);
        g.add(s);
      }
      g.position.set(k * 40 - 30, 48 + (k % 3) * 8, -30 - (k % 2) * 15);
      scene.add(g);
      this.clouds.push(g);
    }

    // terrain 3D (surface herbe + face de terre), mis à jour colonne par colonne
    const n = COLS + 1;
    this.tPos = new Float32Array(n * 4 * 3);
    this.tCol = new Float32Array(n * 4 * 3);
    const idx = [];
    for (let i = 0; i < COLS; i++) {
      const a = 4 * i;
      const b = 4 * (i + 1);
      idx.push(a, a + 1, b, a + 1, b + 1, b); // dessus
      idx.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2); // face
    }
    const g = (this.tGeo = new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.BufferAttribute(this.tPos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.tCol, 3));
    g.setIndex(idx);
    this.terrainMesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    scene.add(this.terrainMesh);

    // œuf, viseur, flash
    this.egg = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshLambertMaterial({ color: 0xfff4e0 }));
    this.egg.scale.set(0.8, 1, 0.8);
    this.egg.visible = false;
    scene.add(this.egg);
    this.aimDot = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    scene.add(this.aimDot);
    this.aimBar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.18, 0.18), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
    scene.add(this.aimBar);
    this.featherGeo = new THREE.BoxGeometry(0.4, 0.4, 0.1);
    this.featherMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9 });

    this.onResize = () => this.resize();
    window.addEventListener("resize", this.onResize);
    this.off.push(() => window.removeEventListener("resize", this.onResize));
    this.resize();
  }

  resize() {
    const r = this.ctx.root.getBoundingClientRect();
    const w = Math.max(160, r.width);
    const h = Math.max(120, r.height);
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  updateTerrain(i0 = 0, i1 = COLS) {
    const h = this.S.terrain;
    const P = this.tPos;
    const C = this.tCol;
    for (let i = Math.max(0, i0 - 1); i <= Math.min(COLS, i1 + 1); i++) {
      const x = i * DX;
      const y = h[i];
      const o = 12 * i;
      P.set([x, y, DEPTH, x, y, -DEPTH, x, y, DEPTH, x, 0, DEPTH], o);
      // herbe (dessus), terre dégradée (face)
      const gr = [0.36, 0.72, 0.28];
      C.set([...gr, ...gr, 0.52, 0.36, 0.2, 0.3, 0.2, 0.12], o);
    }
    this.tGeo.attributes.position.needsUpdate = true;
    this.tGeo.attributes.color.needsUpdate = true;
    this.tGeo.computeVertexNormals();
    this.tGeo.computeBoundingSphere();
  }

  makeChicken(team) {
    const g = new THREE.Group();
    const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), white);
    body.scale.set(1.05, 0.95, 0.85);
    body.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), white);
    head.position.set(0.85, 2.0, 0);
    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.2), new THREE.MeshLambertMaterial({ color: 0xe11d2e }));
    comb.position.set(0.85, 2.55, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 6), new THREE.MeshLambertMaterial({ color: 0xf59e0b }));
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(1.4, 1.95, 0);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    eye.position.set(1.12, 2.15, 0.36);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 6), new THREE.MeshLambertMaterial({ color: TEAM_COLORS[team] }));
    tail.rotation.z = Math.PI / 2 + 0.4;
    tail.position.set(-1.05, 1.6, 0);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.12, 6, 12), new THREE.MeshLambertMaterial({ color: TEAM_COLORS[team] }));
    band.position.set(0.85, 1.7, 0);
    band.rotation.y = Math.PI / 2;
    const legMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
    for (const z of [-0.25, 0.25]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 5), legMat);
      leg.position.set(0, 0.35, z);
      g.add(leg);
    }
    g.add(body, head, comb, beak, eye, tail, band);
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 56;
    const tex = new THREE.CanvasTexture(canvas);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    label.scale.set(6.4, 2.24, 1);
    label.position.set(0, 4.6, 0);
    label.renderOrder = 10;
    g.add(label);
    return { group: g, canvas, tex, label, key: "" };
  }

  drawLabel(m, c, isCur) {
    const key = `${c.hp}|${isCur}|${c.name}`;
    if (m.key === key) return;
    m.key = key;
    const ctx = m.canvas.getContext("2d");
    ctx.clearRect(0, 0, 160, 56);
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.beginPath();
    ctx.roundRect(4, 4, 152, 48, 10);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((isCur ? "▼ " : "") + c.name, 80, 24);
    ctx.fillStyle = "#222";
    ctx.fillRect(16, 32, 128, 10);
    ctx.fillStyle = c.hp > 50 ? "#3ddc84" : c.hp > 25 ? "#f5b301" : "#ef4444";
    ctx.fillRect(16, 32, 1.28 * c.hp, 10);
    m.tex.needsUpdate = true;
  }

  syncMeshes() {
    for (const c of this.S.chickens) {
      let m = this.meshes.get(c.id);
      if (!m) {
        m = this.makeChicken(c.team);
        this.meshes.set(c.id, m);
        this.scene.add(m.group);
      }
      m.group.visible = c.alive;
    }
  }

  /* ----------------------------------- partie ----------------------------------- */
  newGame(seed) {
    const names = this.ctx.players;
    const S = SIM.newState(seed, [names[0]?.name || "Joueur 1", names[1]?.name || "Joueur 2"]);
    if (this.mode === "online") this.ctx.send("init", SIM.snapshot(S));
    this.setState(S);
  }

  setState(S) {
    if (!this.S) this.camSnap = true; // première image : caméra directement sur la bonne poule
    this.S = S;
    this.syncMeshes();
    this.updateTerrain();
    this.$(".pa-end").hidden = true;
    this.beginTurn();
  }

  beginTurn() {
    const S = this.S;
    const w = SIM.winner(S);
    if (w !== null) return this.gameOver(w);
    SIM.beginTurn(S);
    this.phase = "aim";
    this.power = 0;
    this.charging = false;
    this.weapon = 0; // chaque tour commence avec l'œuf normal
    this.timer = 40;
    this.activeLocal = this.mode === "online" ? S.team === this.seat : this.mode === "bot" ? S.team === 0 : true;
    this.bot = this.mode === "bot" && S.team === 1 ? { state: "think", t: 1.0, moved: false, dir: 1, plan: null } : null;
    const c = this.chick(S.cur);
    this.el = 45;
    const who = this.teamName(S.team);
    this.setMsg(this.activeLocal && this.mode !== "bot" ? `À toi, ${who} !` : `Tour de ${who}`, 1800);
    this.refreshWeaponButton();
    return c;
  }

  teamName(team) {
    const p = this.ctx.players[team];
    return p?.name || (team === 0 ? "Joueur 1" : "Joueur 2");
  }

  chick(id) {
    return this.S.chickens.find((c) => c.id === id);
  }

  gameOver(w) {
    this.phase = "over";
    const e = this.$(".pa-end");
    e.hidden = false;
    this.$(".pa-end h2").textContent = w === -1 ? "Égalité !" : `🏆 ${this.teamName(w)} gagne !`;
    this.$(".pa-end p").textContent = w === -1 ? "Plus aucune poule debout." : "Les poules adverses sont éliminées.";
  }

  rematch() {
    if (this.mode === "online" && !this.ctx.isHost) {
      this.ctx.send("rematch", {});
      this.setMsg("Demande de revanche envoyée…", 2500);
    } else this.newGame((Math.random() * 1e9) >>> 0);
  }

  /* ------------------------------------ tirs ------------------------------------ */
  switchWeapon() {
    if (this.phase !== "aim" || !this.activeLocal) return;
    const S = this.S;
    for (let k = 1; k <= WEAPONS.length; k++) {
      const w = (this.weapon + k) % WEAPONS.length;
      if (S.ammo[S.team][w] !== 0) {
        this.weapon = w;
        break;
      }
    }
    this.refreshWeaponButton();
  }

  fire() {
    const S = this.S;
    const c = this.chick(S.cur);
    if (S.ammo[c.team][this.weapon] === 0) return;
    const wp = WEAPONS[this.weapon];
    const el = (this.el * Math.PI) / 180;
    const sp = wp.speed * Math.max(0.15, this.power);
    const msg = {
      vx: c.face * Math.cos(el) * sp,
      vy: Math.sin(el) * sp,
      w: this.weapon,
      x: c.x,
      y: c.y,
      face: c.face,
      el: this.el,
      turn: S.turn,
    };
    if (this.mode === "online") this.ctx.send("fire", msg);
    this.launch(msg);
  }

  launch(m) {
    const S = this.S;
    const c = this.chick(S.cur);
    c.x = m.x;
    c.y = m.y;
    c.face = m.face;
    this.el = m.el;
    if (S.ammo[c.team][m.w] > 0) S.ammo[c.team][m.w]--;
    this.shotWeapon = m.w;
    this.proj = { x: m.x, y: m.y + 1.3, vx: m.vx, vy: m.vy, t: 0 };
    this.phase = "flying";
    this.charging = false;
    this.power = 0;
    this.egg.visible = true;
    this.refreshWeaponButton();
  }

  explodeAt(x, y, kind) {
    const S = this.S;
    if (kind === "ground" || kind === "hit") {
      const wp = WEAPONS[this.shotWeapon];
      const [i0, i1] = SIM.carve(new Array(COLS + 1).fill(99), x, y, wp.r); // plage touchée (sans modifier S)
      SIM.explode(S, x, y, wp);
      this.updateTerrain(i0, i1);
      this.boom(x, y, wp.r);
      this.shake = 0.5 + wp.r * 0.05;
      navigator.vibrate?.(40);
    } else if (kind === "water") {
      this.splash(x, WATER_Y);
    }
    this.egg.visible = false;
    this.proj = null;
    this.phase = "settle";
    this.settleT = 0;
  }

  finishTurn() {
    const S = this.S;
    const authority = this.mode !== "online" || S.team === this.seat;
    if (authority) this.endTurn();
    else this.phase = "waitsync"; // l'autre joueur nous envoie l'état exact
  }

  endTurn() {
    const S = this.S;
    S.turn++;
    if (this.mode === "online") this.ctx.send("sync", SIM.snapshot(S));
    this.beginTurn();
  }

  /* --------------------------------- boucle de jeu --------------------------------- */
  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.acc += dt;
    while (this.acc >= STEP) {
      this.step(STEP);
      this.acc -= STEP;
    }
    this.visuals(dt);
    this.renderer.render(this.scene, this.camera);
    this.adaptQuality(dt);
    this.raf = requestAnimationFrame((tt) => this.frame(tt));
  }

  step(dt) {
    if (!this.S) return;
    if (this.phase === "aim") this.stepAim(dt);
    else if (this.phase === "flying") this.stepFlight(dt);
    else if (this.phase === "settle") this.stepSettle(dt);
  }

  stepAim(dt) {
    const S = this.S;
    const c = this.chick(S.cur);
    this.timer -= dt;
    if (this.bot) return this.botTick(dt, c);
    if (this.activeLocal) {
      const k = this.keys;
      const dir = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      if (dir) SIM.walk(c, S.terrain, dir, dt);
      if (k.up) this.el = Math.min(85, this.el + 45 * dt);
      if (k.down) this.el = Math.max(5, this.el - 45 * dt);
      if (k.jump) {
        SIM.jump(c);
        k.jump = false;
      }
      SIM.stepChicken(c, S.terrain, dt);
      if (!c.alive) return this.finishTurn();
      if (k.fire) {
        if (!this.charging) {
          this.charging = true;
          this.power = 0;
        }
        this.power = Math.min(1, this.power + dt / 1.5);
        if (this.power >= 1) this.fire();
      } else if (this.charging) {
        if (this.power > 0.04) this.fire();
        else this.charging = false;
      }
      this.posTimer += dt;
      if (this.mode === "online" && this.posTimer > 0.08) {
        this.posTimer = 0;
        this.ctx.send("pos", { x: c.x, y: c.y, face: c.face, el: this.el, turn: S.turn });
      }
      if (this.timer <= 0) {
        this.setMsg("Temps écoulé !", 1500);
        this.endTurn();
      }
    }
  }

  botTick(dt, c) {
    const S = this.S;
    const b = this.bot;
    b.t -= dt;
    if (b.state === "walk") {
      SIM.walk(c, S.terrain, b.dir, dt);
      SIM.stepChicken(c, S.terrain, dt);
      if (b.t <= 0) {
        b.state = "think";
        b.t = 0.3;
      }
      return;
    }
    if (b.t > 0) return;
    if (b.state === "think") {
      const w = S.ammo[1][1] !== 0 && Math.random() < 0.3 ? 1 : 0;
      this.weapon = w;
      const plan = SIM.planShot(S, c, w);
      if (!plan) return this.endTurn();
      if (plan.score > 14 && !b.moved) {
        const target = S.chickens.filter((e) => e.alive && e.team === 0).sort((p, q) => Math.abs(p.x - c.x) - Math.abs(q.x - c.x))[0];
        b.moved = true;
        b.dir = target && target.x < c.x ? -1 : 1;
        b.state = "walk";
        b.t = 1.2;
        return;
      }
      plan.el += (Math.random() - 0.5) * 3.5;
      plan.power = Math.max(0.2, Math.min(1, plan.power + (Math.random() - 0.5) * 0.06));
      b.plan = plan;
      c.face = plan.face;
      this.el = plan.el;
      b.state = "aim";
      b.t = 0.9;
      return;
    }
    if (b.state === "aim") {
      this.power = b.plan.power;
      this.fire();
    }
  }

  stepFlight(dt) {
    const hit = SIM.stepProjectile(this.proj, this.S, dt, this.S.cur);
    if (hit) this.explodeAt(hit.x, hit.y, hit.kind);
  }

  stepSettle(dt) {
    const S = this.S;
    this.settleT += dt;
    let rest = true;
    for (const c of S.chickens) {
      if (!c.alive) continue;
      SIM.stepChicken(c, S.terrain, dt);
      if (!c.grounded || Math.abs(c.vx) > 0.3) rest = false;
    }
    if ((this.settleT > 0.7 && rest) || this.settleT > 6) {
      this.finishTurn();
    }
  }

  /* ------------------------------------ visuels ------------------------------------ */
  visuals(dt) {
    const S = this.S;
    for (const cl of this.clouds) {
      cl.position.x += dt * 1.2;
      if (cl.position.x > W + 90) cl.position.x = -70;
    }
    if (!S) return;
    for (const c of S.chickens) {
      const m = this.meshes.get(c.id);
      if (!m) continue;
      const wasVisible = m.group.visible;
      m.group.visible = c.alive;
      if (c.alive) m.poofed = false;
      if (wasVisible && !c.alive && !m.poofed) {
        m.poofed = true;
        this.poof(c);
      }
      m.group.position.set(c.x, c.y, 0);
      m.group.rotation.y = c.face > 0 ? 0 : Math.PI;
      m.label.material.rotation = 0;
      this.drawLabel(m, c, c.id === S.cur && this.phase === "aim");
    }
    // viseur
    const c = this.chick(S.cur);
    const showAim = c && c.alive && this.phase === "aim";
    this.aimDot.visible = this.aimBar.visible = !!showAim;
    if (showAim) {
      const a = (this.el * Math.PI) / 180;
      const dx = c.face * Math.cos(a);
      const dy = Math.sin(a);
      this.aimDot.position.set(c.x + dx * 7, c.y + 1.4 + dy * 7, 0.2);
      const len = 1 + this.power * 5;
      this.aimBar.scale.x = len;
      this.aimBar.position.set(c.x + dx * (2 + len / 2), c.y + 1.4 + dy * (2 + len / 2), 0.2);
      this.aimBar.rotation.z = Math.atan2(dy, dx);
    }
    if (this.proj) this.egg.position.set(this.proj.x, this.proj.y, 0);
    // particules
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.mesh.position.x += p.v.x * dt;
      p.mesh.position.y += p.v.y * dt;
      p.mesh.position.z += p.v.z * dt;
      p.v.y -= 22 * dt;
      p.mesh.rotation.x += dt * 6;
      if (p.flash) {
        p.mesh.scale.multiplyScalar(1 + dt * 4);
        p.mesh.material.opacity = Math.max(0, p.life * 2);
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        if (p.flash) p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }
    this.updateCamera(dt);
    this.updateHud();
  }

  updateCamera(dt) {
    const S = this.S;
    const aspect = this.camera.aspect;
    let target;
    if (this.overview) target = new THREE.Vector3(W / 2, 16, 0);
    else if (this.proj) target = new THREE.Vector3(this.proj.x, this.proj.y, 0);
    else {
      const c = this.chick(S.cur) || S.chickens[0];
      target = new THREE.Vector3(c.x, c.y + 4, 0);
    }
    const visW = this.overview ? W + 20 : aspect < 1 ? 36 : 54;
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360);
    const dist = visW / (2 * halfH * aspect);
    const half = visW / 2;
    target.x = this.overview ? W / 2 : Math.max(half - 4, Math.min(W - half + 4, target.x));
    const want = new THREE.Vector3(target.x, target.y + 9 + (this.overview ? 6 : 0), dist);
    const k = this.camSnap ? 1 : 1 - Math.pow(0.0015, dt);
    this.camSnap = false;
    this.camPos.lerp(want, k);
    this.camLook.lerp(target, k);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    this.camera.lookAt(this.camLook);
  }

  updateHud() {
    const S = this.S;
    const hp = [0, 0];
    for (const c of S.chickens) hp[c.team] += c.hp;
    this.$(".pa-hp0").style.width = hp[0] / 3 + "%";
    this.$(".pa-hp1").style.width = hp[1] / 3 + "%";
    this.$(".pa-n0").textContent = this.teamName(0);
    this.$(".pa-n1").textContent = this.teamName(1);
    this.$(".pa-turn").textContent = this.phase === "over" ? "" : `Tour de ${this.teamName(S.team)}`;
    const w = S.wind;
    this.$(".pa-wind").textContent = `Vent ${w < -0.4 ? "◀".repeat(Math.ceil(Math.abs(w) / 4)) : w > 0.4 ? "▶".repeat(Math.ceil(w / 4)) : "—"} ${Math.abs(w)}`;
    this.$(".pa-time").textContent = this.phase === "aim" ? `${Math.max(0, Math.ceil(this.timer))} s` : "";
    this.$(".pa-pow u").style.width = this.power * 100 + "%";
    const controls = this.$(".pa-controls");
    controls.classList.toggle("off", !(this.activeLocal && this.phase === "aim" && !this.bot));
  }

  boom(x, y, r) {
    const flash = new THREE.Mesh(new THREE.SphereGeometry(r * 0.7, 12, 8), this.flashMat.clone());
    flash.position.set(x, y, 0.5);
    this.scene.add(flash);
    this.particles.push({ mesh: flash, v: new THREE.Vector3(), life: 0.45, flash: true });
    for (let i = 0; i < 12; i++) this.feather(x, y);
  }

  feather(x, y) {
    const m = new THREE.Mesh(this.featherGeo, this.featherMat);
    m.position.set(x, y + 1, 0);
    this.scene.add(m);
    this.particles.push({
      mesh: m,
      v: new THREE.Vector3((Math.random() - 0.5) * 16, 6 + Math.random() * 12, (Math.random() - 0.5) * 8),
      life: 0.9 + Math.random() * 0.5,
    });
  }

  poof(c) {
    for (let i = 0; i < 14; i++) this.feather(c.x, c.y);
  }

  splash(x, y) {
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(this.featherGeo, new THREE.MeshBasicMaterial({ color: 0x9bd1ff }));
      m.position.set(x, y, 0);
      this.scene.add(m);
      this.particles.push({ mesh: m, v: new THREE.Vector3((Math.random() - 0.5) * 8, 6 + Math.random() * 8, 0), life: 0.8 });
    }
  }

  adaptQuality(dt) {
    this.fpsT += dt;
    this.fpsN++;
    if (this.fpsT >= 2) {
      const fps = this.fpsN / this.fpsT;
      this.fpsT = 0;
      this.fpsN = 0;
      if (fps < 40 && this.ratio > 0.75) {
        this.ratio = Math.max(0.75, this.ratio * 0.8); // fluidité d'abord : moins de pixels
        this.resize();
      }
    }
  }

  /* ----------------------------------- commandes ----------------------------------- */
  bindInput() {
    const map = { ArrowLeft: "left", a: "left", q: "left", ArrowRight: "right", d: "right", ArrowUp: "up", w: "up", z: "up", ArrowDown: "down", s: "down", " ": "fire", j: "jump", Enter: "jump" };
    const down = (e) => {
      if (e.target.closest?.("input,textarea")) return;
      const k = map[e.key] || map[e.key.toLowerCase?.()];
      if (k) {
        this.keys[k] = true;
        e.preventDefault();
      } else if (e.key.toLowerCase() === "e") this.switchWeapon();
      else if (e.key.toLowerCase() === "v") this.overview = !this.overview;
    };
    const up = (e) => {
      const k = map[e.key] || map[e.key.toLowerCase?.()];
      if (k && k !== "jump") this.keys[k] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    this.off.push(() => window.removeEventListener("keydown", down), () => window.removeEventListener("keyup", up));
    for (const b of this.ctx.root.querySelectorAll("[data-k]")) {
      const k = b.dataset.k;
      const on = (e) => {
        this.keys[k] = true;
        b.classList.add("on");
        e.preventDefault();
      };
      const offf = () => {
        if (k !== "jump") this.keys[k] = false;
        b.classList.remove("on");
      };
      b.addEventListener("pointerdown", on);
      b.addEventListener("pointerup", offf);
      b.addEventListener("pointerleave", offf);
      b.addEventListener("pointercancel", offf);
      b.addEventListener("contextmenu", (e) => e.preventDefault());
    }
  }

  bindNet() {
    const ctx = this.ctx;
    ctx.on("init", (snap) => {
      this.setState(snap);
      this.setMsg("", 0);
    });
    ctx.on("pos", (p) => {
      if (!this.S || p.turn !== this.S.turn || this.activeLocal || this.phase !== "aim") return;
      const c = this.chick(this.S.cur);
      c.x = p.x;
      c.y = p.y;
      c.face = p.face;
      this.el = p.el;
    });
    ctx.on("fire", (m) => {
      if (!this.S || m.turn !== this.S.turn || this.phase !== "aim") return;
      this.launch(m);
    });
    ctx.on("sync", (snap) => {
      this.setState(snap); // l'état du tireur fait foi
    });
    ctx.on("rematch", () => {
      if (ctx.isHost) this.newGame((Math.random() * 1e9) >>> 0);
    });
    ctx.on("peer-left", () => this.setMsg("L'autre joueur est parti."));
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    for (const f of this.off) f();
    clearTimeout(this.msgT);
    this.renderer.dispose();
    this.ctx.root.innerHTML = "";
  }
}
