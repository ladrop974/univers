// NEXUS : Lignée Zénith — roguelite évolutif en 3D (Three.js). Règles dans sim.js.
// Modes : "bot" (contre le robot), "local" (écran partagé), "online" (duel par lien : l'hôte fait foi).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import * as N from "./sim.js";

export default {
  id: "nexus",
  name: "NEXUS : Lignée Zénith",
  start(ctx) {
    return new Nexus(ctx);
  },
};

/* ============ CONFIGURATION ============ */
const COL = [
  { main: 0x22e6ff, b: 0x1de9b6, glow: 0xaefcff, css: "#22e6ff" },
  { main: 0xff6a1a, b: 0xff2bd6, glow: 0xffb36b, css: "#ff7a2a" },
];
const NEUTRAL = 0xb9c2d8;
const QUALITY = [
  { name: "Bas", dpr: 0.85, shadow: 0, bloom: 0, parts: 50, spores: 250 },
  { name: "Moyen", dpr: 1.25, shadow: 0, bloom: 0, parts: 120, spores: 700 },
  { name: "Élevé", dpr: 1.5, shadow: 1024, bloom: 1, parts: 220, spores: 1300 },
  { name: "Ultra", dpr: 2, shadow: 2048, bloom: 1, parts: 400, spores: 2200 },
];
const ACTIONS = { up: "Avancer", down: "Reculer", left: "Gauche", right: "Droite", atk: "Attaque", dash: "Dash", abil: "Capacité", wave: "Onde de zone", build: "Noyau de territoire", c1: "Choix 1", c2: "Choix 2", c3: "Choix 3", c4: "Choix 4", c5: "Choix 5", map: "Grande carte", pause: "Pause" };
const DEF_KEYS = [
  { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", atk: "Space", dash: "ShiftLeft", abil: "KeyE", wave: "KeyF", build: "KeyC", c1: "Digit1", c2: "Digit2", c3: "Digit3", c4: "Digit4", c5: "Digit5", map: "Tab", pause: "Escape" },
  { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", atk: "Enter", dash: "KeyP", abil: "KeyO", wave: "KeyL", build: "KeyK", c1: "Numpad1", c2: "Numpad2", c3: "Numpad3", c4: "Numpad4", c5: "Numpad5", map: "", pause: "" },
];
const EDGE = ["dash", "abil", "wave", "build"];
const DIFFS = { eclaireur: ["Éclaireur", "Explore, récolte, attaque rarement"], rival: ["Rival", "S'adapte, surveille les relais, punit tes faiblesses"], predateur: ["Prédateur", "Choisit une stratégie et prépare le duel"] };
const VIS_ICON = { fins: "🐟", plates: "🛡️", spikes: "🦷", tentacles: "🦑", cloak: "🌫️", jets: "🚀", core: "💗", spores: "✨", portal: "🌀", rings: "🪐", wings: "🪽", sacs: "🫧", thorns: "🌵", eyes: "👁️" };
const SPEC_ICON = { predateur: "🐺", gardien: "🛡️", nomade: "🌠", architecte: "🏗️", siphonneur: "🩸" };

const LS = {
  get(k, d) {
    try {
      const v = localStorage.getItem("nexus." + k);
      return v ? JSON.parse(v) : d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("nexus." + k, JSON.stringify(v));
    } catch {
      /* stockage bloqué */
    }
  },
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/* relief (purement visuel ; les règles sont en 2D) */
function heightAt(x, z) {
  if (z > 5000) return 0;
  let h = 7 * Math.sin(x * 0.0093 + 1.3) * Math.cos(z * 0.011) + 11 * Math.sin(x * 0.0027) * Math.sin(z * 0.0031 + 0.7) + 4 * Math.sin((x + z) * 0.021);
  const d = Math.hypot(x, z);
  if (d < 700) h -= 60 * (1 - d / 700) ** 2;
  return h;
}

/* ============ TEXTURES GÉNÉRÉES ============ */
function canvasTex(size, draw, repeat = true) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function glowTexture() {
  return canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.25, "rgba(255,255,255,.55)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  }, false);
}
function veinTexture(seed) {
  const R = N.mulberry(seed);
  const s = 256,
    pts = Array.from({ length: 22 }, () => [R() * s, R() * s]);
  return canvasTex(s, (g) => {
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        let f1 = 1e9,
          f2 = 1e9;
        for (const [px, py] of pts) {
          let dx = Math.abs(x - px),
            dy = Math.abs(y - py);
          dx = Math.min(dx, s - dx);
          dy = Math.min(dy, s - dy);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < f1) (f2 = f1, (f1 = d));
          else if (d < f2) f2 = d;
        }
        const v = Math.max(0, 1 - (f2 - f1) / 3.2) ** 2 * 255;
        const i = (y * s + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  });
}
function detailTexture(seed) {
  const R = N.mulberry(seed + 5);
  return canvasTex(256, (g, s) => {
    g.fillStyle = "#d8d8d8";
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const v = 150 + R() * 105;
      g.fillStyle = `rgba(${v},${v},${v},${0.25 + R() * 0.4})`;
      const r = 1 + R() * 5;
      g.beginPath();
      g.arc(R() * s, R() * s, r, 0, 7);
      g.fill();
    }
  });
}
function beamTexture() {
  return canvasTex(8, (g, s) => {
    const r = g.createLinearGradient(0, 0, 0, s);
    r.addColorStop(0, "rgba(255,255,255,0)");
    r.addColorStop(0.7, "rgba(255,255,255,.5)");
    r.addColorStop(1, "rgba(255,255,255,1)");
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  }, false);
}

/* matériau « fresnel » additif (boucliers, halos, dômes) */
function fresnelMat(color, o = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(color) }, o: { value: o } },
    vertexShader: "varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}",
    fragmentShader: "uniform vec3 c;uniform float o;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(vN,vV)),2.2);gl_FragColor=vec4(c*(f*1.6+.08),(f+.04)*o);}",
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}
function addMat(color, opacity = 1, map = null) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map });
}

/* ============ SYSTÈME DE PARTICULES ============ */
class Particles {
  constructor(scene, tex, max) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.life0 = new Float32Array(max);
    this.base = new Float32Array(max * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("col", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("size", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = pointsMat(tex);
    this.pts = new THREE.Points(g, this.mat);
    this.pts.frustumCulled = false;
    this.geo = g;
    scene.add(this.pts);
    this.tmp = new THREE.Color();
  }
  emit(x, y, z, n, color, speed = 120, life = 0.6, size = 10, up = 0.5) {
    const c = this.tmp.set(color);
    for (let k = 0; k < n; k++) {
      let i = this.n;
      if (i >= this.max) i = Math.floor(Math.random() * this.max);
      else this.n++;
      const a = Math.random() * 6.283,
        e = (Math.random() - 0.3) * up,
        s = speed * (0.3 + Math.random() * 0.7);
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.cos(a) * s;
      this.vel[i * 3 + 1] = e * s + 20;
      this.vel[i * 3 + 2] = Math.sin(a) * s;
      this.life[i] = this.life0[i] = life * (0.6 + Math.random() * 0.6);
      this.base[i * 4] = c.r;
      this.base[i * 4 + 1] = c.g;
      this.base[i * 4 + 2] = c.b;
      this.base[i * 4 + 3] = size * (0.6 + Math.random() * 0.8);
    }
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        for (let k = 0; k < 3; k++) {
          this.pos[i * 3 + k] = this.pos[j * 3 + k];
          this.vel[i * 3 + k] = this.vel[j * 3 + k];
        }
        for (let k = 0; k < 4; k++) this.base[i * 4 + k] = this.base[j * 4 + k];
        this.life[i] = this.life[j];
        this.life0[i] = this.life0[j];
        i--;
        continue;
      }
      const f = this.life[i] / this.life0[i];
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
      this.vel[i * 3] *= 0.96;
      this.vel[i * 3 + 2] *= 0.96;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * 0.96 - 30 * dt;
      this.col[i * 4] = this.base[i * 4];
      this.col[i * 4 + 1] = this.base[i * 4 + 1];
      this.col[i * 4 + 2] = this.base[i * 4 + 2];
      this.col[i * 4 + 3] = f;
      this.size[i] = this.base[i * 4 + 3] * (0.4 + 0.6 * f);
    }
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.col.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}
function pointsMat(tex) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, scale: { value: 600 } },
    vertexShader: "attribute float size;attribute vec4 col;varying vec4 vC;uniform float scale;void main(){vC=col;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=min(256.,size*scale/-mv.z);gl_Position=projectionMatrix*mv;}",
    fragmentShader: "uniform sampler2D map;varying vec4 vC;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vC.rgb,t.a*vC.a);}",
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/* ============ AUDIO (Web Audio, sons synthétiques) ============ */
class Sound {
  constructor(prefs) {
    this.prefs = prefs;
    this.ac = null;
    this.last = {};
  }
  init() {
    if (this.ac) return this.ac.state === "suspended" && this.ac.resume();
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain();
      this.master.connect(this.ac.destination);
      this.vol();
      // nappe d'ambiance très douce
      const f = this.ac.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 420;
      this.amb = this.ac.createGain();
      this.amb.gain.value = 0.035;
      f.connect(this.amb).connect(this.master);
      this.drone = [55, 82.4, 110.3].map((fr) => {
        const o = this.ac.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = fr;
        o.connect(f);
        o.start();
        return o;
      });
      this.filt = f;
    } catch {
      this.ac = null;
    }
  }
  vol() {
    if (this.master) this.master.gain.value = this.prefs.mute ? 0 : this.prefs.vol;
  }
  mood(intensity) {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    this.filt.frequency.setTargetAtTime(300 + intensity * 900, t, 0.8);
    this.drone[2].frequency.setTargetAtTime(110 * (1 + intensity * 0.5), t, 1.5);
  }
  play(k, gain = 1) {
    if (!this.ac || this.prefs.mute) return;
    const now = this.ac.currentTime;
    if (this.last[k] && now - this.last[k] < 0.05) return;
    this.last[k] = now;
    const S = { eat: [880, 1320, 0.06, "sine", 0.05], atk: [240, 110, 0.1, "square", 0.035], dash: [300, 900, 0.14, "sawtooth", 0.03], mut: [520, 1040, 0.3, "sine", 0.08], level: [330, 990, 0.45, "triangle", 0.07], hit: [160, 60, 0.15, "square", 0.06], die: [200, 40, 0.7, "sawtooth", 0.07], cap: [440, 880, 0.35, "triangle", 0.07], alert: [900, 500, 0.3, "square", 0.04], win: [440, 1760, 1.1, "triangle", 0.08], lose: [300, 80, 1.1, "sawtooth", 0.06], frag: [660, 1980, 0.6, "sine", 0.06], wave: [90, 30, 0.5, "sine", 0.12], blink: [200, 1600, 0.3, "sine", 0.05], shot: [700, 300, 0.12, "triangle", 0.03], boom: [120, 30, 0.45, "square", 0.08] }[k];
    if (!S) return;
    try {
      const o = this.ac.createOscillator(),
        g = this.ac.createGain();
      o.type = S[3];
      o.frequency.setValueAtTime(S[0], now);
      o.frequency.exponentialRampToValueAtTime(S[1], now + S[2]);
      g.gain.setValueAtTime(S[4] * gain, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + S[2]);
      o.connect(g).connect(this.master);
      o.start(now);
      o.stop(now + S[2] + 0.02);
    } catch {
      /* audio indisponible */
    }
  }
  destroy() {
    try {
      this.ac?.close();
    } catch {
      /* déjà fermé */
    }
  }
}

/* ============ LE JEU ============ */
class Nexus {
  constructor(ctx) {
    this.ctx = ctx;
    this.mode = ctx.mode;
    this.isHost = ctx.isHost;
    if (location.search.includes("debug")) (window.__nexus = this, (this.N = N));
    this.prefs = Object.assign({ quality: "auto", effects: true, touch: "auto", sens: 1, invert: false, mouseAim: true, mute: false, vol: 0.7, diff: "rival", pad: true }, LS.get("prefs", {}));
    const keys = LS.get("keys", null);
    this.keys = [0, 1].map((i) => Object.assign({}, DEF_KEYS[i], keys?.[i] || {}));
    this.keyNames = {};
    this.down = new Set();
    this.edges = [{}, {}];
    this.off = [];
    this.timers = [];
    this.paused = false;
    this.sound = new Sound(this.prefs);
    this.S = null;
    this.mouse = { x: 0, y: 0, t: -1e9, l: 0, r: 0 };
    this.touchState = new Map();
    this.fpsLog = [];
    this.buildDom();
    if (!this.initGL()) return;
    this.bindInput();
    if (this.mode === "online") this.bindNet();
    if (navigator.keyboard?.getLayoutMap)
      navigator.keyboard
        .getLayoutMap()
        .then((m) => {
          this.layout = m;
          this.refreshHints();
        })
        .catch(() => {});
    this.views = [];
    if (this.mode === "online" && !this.isHost) {
      this.newGame(ctx.seed);
      this.msg("Connexion à la partie…");
    } else if (this.mode === "online") this.newGame(ctx.seed);
    else this.showStart();
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
    // l'hôte continue de faire tourner la partie même si son onglet passe en arrière-plan
    if (this.mode === "online" && this.isHost) this.bg = setInterval(() => document.hidden && this.tickHidden(), 50);
  }
  tickHidden() {
    const S = this.S;
    if (!S || this.dead) return;
    const now = performance.now();
    const dt = Math.min(1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    for (let n = 0; this.acc >= N.STEP && n < 70; n++) {
      N.step(S);
      this.acc -= N.STEP;
    }
    this.acc = Math.min(this.acc, N.STEP);
    this.netEv.push(...S.ev.filter((e) => e.k !== "eat" || e.seat === 1));
    S.ev.length = 0;
    this.netTick(dt);
  }

  /* ---------- interface ---------- */
  buildDom() {
    const root = this.ctx.root;
    root.classList.add("nx-root");
    root.innerHTML = `<style>${CSS}</style>
      <canvas class="nx-cv"></canvas>
      <div class="nx-views"></div>
      <div class="nx-top">
        <button data-a="pause" title="Pause (Échap)">⏸</button>
        <button data-a="opts" title="Options">⚙</button>
        <button data-a="mute" title="Son">🔊</button>
        <button data-a="full" title="Plein écran">⛶</button>
      </div>
      <div class="nx-center"></div>
      <div class="nx-panel" hidden></div>
      <div class="nx-msg" hidden></div>`;
    this.$ = (s) => root.querySelector(s);
    this.canvas = this.$(".nx-cv");
    this.$(".nx-top").onclick = (e) => {
      const a = e.target.closest("button")?.dataset.a;
      this.sound.init();
      if (a === "pause") this.togglePause();
      else if (a === "opts") {
        if (this.S && !this.S.over && this.$(".nx-panel").hidden) {
          if (this.mode !== "online") this.paused = true;
          this.showOptions(() => this.showPause());
        } else if (!this.S) this.showOptions(() => this.showStart());
      }
      else if (a === "mute") {
        this.prefs.mute = !this.prefs.mute;
        this.savePrefs();
      } else if (a === "full") {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else root.requestFullscreen?.().catch(() => {});
      }
    };
    this.refreshTop();
  }
  refreshTop() {
    this.$('[data-a="mute"]').textContent = this.prefs.mute ? "🔇" : "🔊";
  }
  msg(t, ms = 0) {
    const m = this.$(".nx-msg");
    m.textContent = t;
    m.hidden = !t;
    clearTimeout(this.msgT);
    if (t && ms) this.msgT = setTimeout(() => (m.hidden = true), ms);
  }
  panel(html) {
    const p = this.$(".nx-panel");
    p.innerHTML = `<div class="nx-card">${html}</div>`;
    p.hidden = !html;
    return p;
  }
  savePrefs() {
    LS.set("prefs", this.prefs);
    this.sound.vol();
    this.refreshTop();
  }
  keyLabel(code) {
    if (!code) return "—";
    const lm = this.layout?.get?.(code);
    if (lm) return lm.toUpperCase();
    const map = { Space: "Espace", ShiftLeft: "Maj", ShiftRight: "Maj D", Escape: "Échap", Enter: "Entrée", Tab: "Tab", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", ControlLeft: "Ctrl", AltLeft: "Alt", Backspace: "⌫" };
    if (map[code]) return map[code];
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Numpad")) return "Pavé " + code.slice(6);
    return code;
  }

  showStart() {
    const bot = this.mode === "bot";
    const p = this.panel(`<h2 class="nx-logo">NEXUS<small>Lignée Zénith</small></h2>
      <p class="nx-muted">Une graine sans mémoire sur la planète Auralis. Absorbe, mute, conquiers, puis affronte l'autre lignée au Duel Zénith.</p>
      ${bot ? `<div class="nx-seg" data-k="diff">${Object.entries(DIFFS).map(([k, [n, d]]) => `<button data-v="${k}" class="${this.prefs.diff === k ? "on" : ""}"><b>${n}</b><small>${d}</small></button>`).join("")}</div>` : `<p>👥 <b>Écran partagé</b> : joueur 1 (cyan) au clavier gauche, joueur 2 (orange) aux flèches — ou une manette chacun.</p>`}
      <div class="nx-row"><button class="nx-big" data-go>▶ Jouer</button></div>
      <div class="nx-row"><button data-guide>📖 Guide</button><button data-opt>⚙ Options et touches</button><button data-quit>✕ Quitter</button></div>`);
    p.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      this.sound.init();
      if (b.dataset.v) {
        this.prefs.diff = b.dataset.v;
        this.savePrefs();
        this.showStart();
      } else if (b.hasAttribute("data-go")) {
        this.panel("");
        this.newGame((Math.random() * 1e9) >>> 0);
      } else if (b.hasAttribute("data-guide")) this.showGuide(() => this.showStart());
      else if (b.hasAttribute("data-opt")) this.showOptions(() => this.showStart());
      else if (b.hasAttribute("data-quit")) this.ctx.quit();
    };
  }
  showGuide(back) {
    const k = (a, s = 0) => `<kbd>${esc(this.keyLabel(this.keys[s][a]))}</kbd>`;
    const p = this.panel(`<h2>📖 Guide</h2>
      <ol class="nx-guide">
        <li><b>Éveil</b> — absorbe les nutriments, évite les prédateurs, trouve 3 <b>fragments</b> (« ? » sur la carte).</li>
        <li><b>Conquête</b> — chasse, reste seul sur un <b>relais</b> pour le capturer, trouve le rival.</li>
        <li><b>Ascension</b> — choisis une <b>spécialisation</b>, pose ton <b>noyau de territoire</b> ${k("build")} : il produit l'énergie Zénith.</li>
        <li><b>Duel Zénith</b> — à 100 % d'énergie Zénith, l'arène s'ouvre. Gagne par KO, en tenant 3 balises, ou en ayant la majorité à la fin.</li>
      </ol>
      <p>Chaque niveau propose des <b>mutations</b> : un bonus, un coût, un style. Choix avec ${k("c1")} ${k("c2")} ${k("c3")} ou en cliquant.</p>
      <table class="nx-keys"><tr><th></th><th>PC</th><th>Manette</th><th>Tactile</th></tr>
        <tr><td>Déplacement</td><td>${k("up")}${k("left")}${k("down")}${k("right")}</td><td>stick gauche</td><td>joystick gauche</td></tr>
        <tr><td>Attaque</td><td>${k("atk")} ou clic</td><td>A</td><td>⚔</td></tr>
        <tr><td>Dash</td><td>${k("dash")}</td><td>B</td><td>💨</td></tr>
        <tr><td>Capacité</td><td>${k("abil")}</td><td>X</td><td>✦</td></tr>
        <tr><td>Onde de zone</td><td>${k("wave")}</td><td>Y</td><td>◎</td></tr>
        <tr><td>Noyau</td><td>${k("build")}</td><td>RB</td><td>⬢</td></tr>
        <tr><td>Caméra</td><td>clic droit glissé · molette</td><td>stick droit</td><td>glisser à droite</td></tr>
        <tr><td>Carte / pause</td><td>${k("map")} / ${k("pause")}</td><td>Select / Start</td><td>🗺 / ⏸</td></tr></table>
      <p class="nx-muted">Le rival commence à l'autre bout du monde : tu ne perçois qu'un signal imprécis, de plus en plus fréquent. Toutes les touches se changent dans ⚙ Options.</p>
      <div class="nx-row"><button data-back>Retour</button></div>`);
    p.onclick = (e) => e.target.closest("[data-back]") && (back ? back() : this.panel(""));
  }

  showOptions(back) {
    const P = this.prefs;
    const seg = (k, opts) => `<div class="nx-seg sm" data-k="${k}">${opts.map(([v, n]) => `<button data-v="${v}" class="${String(P[k]) === String(v) ? "on" : ""}">${n}</button>`).join("")}</div>`;
    const two = this.mode === "local";
    const rows = Object.keys(ACTIONS)
      .filter((a) => two || !["c4", "c5"].includes(a) || true)
      .map((a) => `<tr><td>${ACTIONS[a]}</td>${[0, 1].map((s) => (s && (a === "map" || a === "pause") ? "<td></td>" : `<td><button class="nx-key" data-bind="${s}:${a}">${esc(this.keyLabel(this.keys[s][a]))}</button></td>`)).join("")}</tr>`)
      .join("");
    const p = this.panel(`<h2>⚙ Options</h2>
      <div class="nx-opts">
        <label>Qualité graphique</label>${seg("quality", [["auto", "Auto"], [0, "Bas"], [1, "Moyen"], [2, "Élevé"], [3, "Ultra"]])}
        <label>Effets (lueurs, particules)</label>${seg("effects", [[true, "Oui"], [false, "Non (performance)"]])}
        <label>Commandes tactiles</label>${seg("touch", [["auto", "Auto"], ["on", "Toujours"], ["off", "Masquer"]])}
        <label>Visée à la souris</label>${seg("mouseAim", [[true, "Oui"], [false, "Non"]])}
        <label>Manette</label>${seg("pad", [[true, "Activée"], [false, "Désactivée"]])}
        <label>Caméra : sensibilité <b>${P.sens.toFixed(1)}</b></label><input type="range" min="0.3" max="2.5" step="0.1" value="${P.sens}" data-r="sens">
        <label>Inverser la caméra</label>${seg("invert", [[false, "Non"], [true, "Oui"]])}
        <label>Volume <b>${Math.round(P.vol * 100)} %</b></label><input type="range" min="0" max="1" step="0.05" value="${P.vol}" data-r="vol">
      </div>
      <h3>Touches <small class="nx-muted">(clique puis appuie sur la touche voulue)</small></h3>
      <div class="nx-scroll"><table class="nx-keys nx-bind"><tr><th>Action</th><th>Joueur 1</th><th>Joueur 2${two ? "" : " (aussi pour toi)"}</th></tr>${rows}</table></div>
      <p class="nx-muted">🎮 ${this.padNames() || "Aucune manette détectée (appuie sur un bouton pour l'activer)."}</p>
      <div class="nx-row"><button data-reset>Touches par défaut</button><button data-back class="nx-big">OK</button></div>`);
    p.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const sk = b.parentElement.dataset.k;
      if (sk && b.dataset.v !== undefined) {
        const v = b.dataset.v;
        P[sk] = v === "true" ? true : v === "false" ? false : /^\d$/.test(v) ? +v : v;
        this.savePrefs();
        if (sk === "quality" || sk === "effects") this.applyQuality();
        if (sk === "touch") this.buildViews();
        return this.showOptions(back);
      }
      if (b.dataset.bind) {
        const [s, a] = b.dataset.bind.split(":");
        b.textContent = "…";
        b.classList.add("wait");
        this.binding = { seat: +s, action: a, done: () => this.showOptions(back) };
        return;
      }
      if (b.hasAttribute("data-reset")) {
        this.keys = [0, 1].map((i) => ({ ...DEF_KEYS[i] }));
        LS.set("keys", this.keys);
        this.refreshHints();
        return this.showOptions(back);
      }
      if (b.hasAttribute("data-back")) {
        this.binding = null;
        if (back) back();
        else this.panel("");
      }
    };
    p.oninput = (e) => {
      const r = e.target.dataset.r;
      if (!r) return;
      P[r] = +e.target.value;
      e.target.previousElementSibling.querySelector("b").textContent = r === "vol" ? Math.round(P.vol * 100) + " %" : P.sens.toFixed(1);
      this.savePrefs();
    };
  }
  padNames() {
    const pads = [...(navigator.getGamepads?.() || [])].filter(Boolean);
    return pads.map((p, i) => `Manette ${i + 1} : ${p.id.slice(0, 40)}`).join(" · ");
  }

  togglePause() {
    if (!this.S || this.S.over) return;
    if (this.mode === "online") return this.showPause();
    this.paused = !this.paused;
    if (this.paused) this.showPause();
    else this.panel("");
  }
  showPause() {
    if (this.mode !== "online") this.paused = true;
    const p = this.panel(`<h2>⏸ Pause</h2>${this.mode === "online" ? '<p class="nx-muted">En ligne, la partie continue pendant ce menu.</p>' : ""}
      <div class="nx-col"><button class="nx-big" data-r>▶ Reprendre</button><button data-o>⚙ Options et touches</button><button data-g>📖 Guide</button><button data-q>🏳 Abandonner et quitter</button></div>`);
    p.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-r")) {
        this.paused = false;
        this.panel("");
      } else if (b.hasAttribute("data-o")) this.showOptions(() => this.showPause());
      else if (b.hasAttribute("data-g")) this.showGuide(() => this.showPause());
      else if (b.hasAttribute("data-q")) {
        if (this.mode === "online") this.ctx.send(this.isHost ? "s" : "quit", this.isHost ? { O: { winner: 1, reason: "abandon du rival" } } : {});
        this.ctx.quit();
      }
    };
  }

  /* ---------- WebGL et scène ---------- */
  initGL() {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !matchMedia("(pointer: coarse)").matches, powerPreference: "high-performance" });
    } catch {
      this.panel(`<h2>WebGL indisponible</h2><p>NEXUS a besoin de la 3D (WebGL), désactivée ou non prise en charge sur cet appareil.</p>
        <p class="nx-muted">Essaie un autre navigateur (Chrome, Edge, Firefox, Safari récent) ou active l'accélération matérielle.</p>
        <div class="nx-row"><button data-quit>Retour</button></div>`).onclick = (e) => e.target.closest("[data-quit]") && this.ctx.quit();
      return false;
    }
    const R = this.renderer;
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = 1.15;
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x04131d, 300, 1400);
    this.scene.background = new THREE.Color(0x04131d);
    this.hemi = new THREE.HemisphereLight(0x9fd4ff, 0x2a1238, 0.85);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0dd, 1.7);
    this.sun.position.set(300, 600, 200);
    this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -650;
    this.sun.shadow.camera.right = this.sun.shadow.camera.top = 650;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 1600;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);
    this.glowTex = glowTexture();
    this.beamTex = beamTexture();
    this.cam0 = new THREE.PerspectiveCamera(55, 1, 5, 4000);
    this.composer = new EffectComposer(R);
    this.renderPass = new RenderPass(this.scene, this.cam0);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.62);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.ctx.root);
    const onLost = (e) => {
      e.preventDefault();
      this.msg("Le contexte 3D a été perdu, il revient…");
    };
    this.canvas.addEventListener("webglcontextlost", onLost);
    this.off.push(() => this.canvas.removeEventListener("webglcontextlost", onLost));
    return true;
  }
  get Q() {
    let q = this.prefs.quality;
    if (q === "auto") q = this.autoQ ?? (matchMedia("(pointer: coarse)").matches ? 1 : 2);
    const base = QUALITY[q];
    return this.prefs.effects ? base : { ...base, bloom: 0, parts: 50, spores: Math.min(base.spores, 300) };
  }
  applyQuality() {
    if (!this.renderer) return;
    const Q = this.Q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.dpr));
    this.renderer.shadowMap.enabled = !!Q.shadow;
    this.sun.castShadow = !!Q.shadow;
    if (Q.shadow) {
      this.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.scene.traverse((o) => o.material && (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true)));
    if (this.parts && this.parts.max !== Q.parts) {
      this.scene.remove(this.parts.pts);
      this.parts.geo.dispose();
      this.parts = new Particles(this.scene, this.glowTex, Q.parts);
    }
    if (this.spores) this.spores.geometry.setDrawRange(0, Q.spores);
    this.resize();
  }
  resize() {
    if (!this.renderer) return;
    const r = this.ctx.root.getBoundingClientRect();
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.renderer.setSize(this.W, this.H, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(this.W, this.H);
    this.ctx.root.classList.toggle("nx-compact", this.H < 650 || this.W < 560);
    if (this.views?.length) this.layoutViews();
  }

  /* ---------- monde 3D ---------- */
  buildWorld() {
    const S = this.S,
      W = S.W,
      sc = this.scene;
    if (this.world) {
      sc.remove(this.world);
      this.world.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    }
    const G = (this.world = new THREE.Group());
    sc.add(G);
    // sol : couleurs de biome, veines lumineuses animées
    const seg = 170,
      size = 5400;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position,
      cols = new Float32Array(pos.count * 3),
      acc = new Float32Array(pos.count * 3);
    const c = new THREE.Color(),
      a = new THREE.Color(),
      t = new THREE.Color(),
      R = N.mulberry(S.seed + 1);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
      c.setRGB(0, 0, 0);
      a.setRGB(0, 0, 0);
      for (const [ox, oz] of [[0, 0], [45, 0], [-45, 0], [0, 45], [0, -45]]) {
        const b = N.BIOMES[N.biomeAt(W, x + ox, z + oz)];
        c.add(t.setHex(b.ground).multiplyScalar(0.2));
        a.add(t.setHex(b.accent).multiplyScalar(0.2));
      }
      const v = 0.8 + R() * 0.35;
      c.multiplyScalar(v);
      const out = Math.max(Math.abs(x), Math.abs(z)) > N.HALF;
      if (out) c.multiplyScalar(0.35);
      cols.set([c.r, c.g, c.b], i * 3);
      acc.set([a.r, a.g, a.b].map((q) => q * (out ? 0.2 : 1)), i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    geo.setAttribute("accent", new THREE.BufferAttribute(acc, 3));
    geo.computeVertexNormals();
    const detail = detailTexture(S.seed);
    detail.repeat.set(70, 70);
    detail.colorSpace = THREE.SRGBColorSpace;
    const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.92, metalness: 0.05 });
    const vein = veinTexture(S.seed);
    this.groundU = { uTime: { value: 0 }, veinMap: { value: vein }, veinI: { value: 0.55 } };
    groundMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.groundU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec3 accent;varying vec3 vAccent;varying vec2 vWp;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvAccent=accent;vWp=position.xz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform sampler2D veinMap;uniform float uTime;uniform float veinI;varying vec3 vAccent;varying vec2 vWp;")
        .replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\nfloat msk=smoothstep(.25,.75,texture2D(veinMap,vWp/1900.+.17).r*1.6+.25*sin(vWp.x*.002)*sin(vWp.y*.0023));float vn=texture2D(veinMap,vWp/260.).r*(.25+.75*msk)+texture2D(veinMap,vWp/95.+.3).r*.18*msk;float pl=.6+.4*sin(uTime*1.4-length(vWp)*.012);totalEmissiveRadiance+=vAccent*vn*veinI*pl;",
        );
    };
    const ground = new THREE.Mesh(geo, groundMat);
    ground.receiveShadow = true;
    G.add(ground);
    // bordure du monde : rideau d'énergie
    const wallMat = addMat(0x6fd8ff, 0.35, this.beamTex);
    for (let k = 0; k < 4; k++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(5000, 220), wallMat);
      w.position.set(k < 2 ? 0 : (k === 2 ? 1 : -1) * N.HALF, 60, k < 2 ? (k ? 1 : -1) * N.HALF : 0);
      if (k >= 2) w.rotation.y = Math.PI / 2;
      w.rotation.z = Math.PI;
      G.add(w);
    }
    // obstacles (instanciés par type)
    const kinds = {
      coral: { geo: new THREE.IcosahedronGeometry(1, 1), mat: new THREE.MeshStandardMaterial({ color: 0x2bb3c9, roughness: 0.6, emissive: 0x0a4f66, emissiveIntensity: 0.6, flatShading: true }), sy: 1.1 },
      stalk: { geo: new THREE.CylinderGeometry(0.35, 1, 1, 7).translate(0, 0.5, 0), mat: new THREE.MeshStandardMaterial({ color: 0x7a2f8f, roughness: 0.5, emissive: 0x5a1460, emissiveIntensity: 0.5 }), sy: 7, base: 1 },
      crystal: { geo: new THREE.OctahedronGeometry(1, 0), mat: new THREE.MeshStandardMaterial({ color: 0xb8c8ff, roughness: 0.08, metalness: 0.3, emissive: 0x4a62ff, emissiveIntensity: 0.55, transparent: true, opacity: 0.88, flatShading: true }), sy: 2.4 },
      rock: { geo: new THREE.DodecahedronGeometry(1, 0), mat: new THREE.MeshStandardMaterial({ color: 0x3e4a2a, roughness: 0.95, flatShading: true }), sy: 0.6 },
      pillar: { geo: new THREE.CylinderGeometry(0.8, 1, 1, 8).translate(0, 0.5, 0), mat: new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.4, metalness: 0.6, emissive: 0xff8a1a, emissiveIntensity: 0.25 }), sy: 4, base: 1 },
      monolith: { geo: new THREE.BoxGeometry(1.3, 1, 0.7).translate(0, 0.5, 0), mat: new THREE.MeshStandardMaterial({ color: 0x1a1428, roughness: 0.25, metalness: 0.8, emissive: 0xffc04a, emissiveIntensity: 0.18 }), sy: 5, base: 1 },
    };
    const m4 = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler(),
      v = new THREE.Vector3(),
      s = new THREE.Vector3();
    for (const [k, K] of Object.entries(kinds)) {
      const list = W.obstacles.filter((o) => o.kind === k);
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(K.geo, K.mat, list.length);
      im.castShadow = im.receiveShadow = true;
      list.forEach((o, i) => {
        const hy = K.sy * o.h;
        e.set(K.base ? 0 : o.rot * 0.3, o.rot, K.base ? 0 : o.rot * 0.2);
        q.setFromEuler(e);
        v.set(o.x, heightAt(o.x, o.z) + (K.base ? -2 : o.r * hy * 0.35), o.z);
        s.set(o.r, o.r * hy, o.r);
        im.setMatrixAt(i, m4.compose(v, q, s));
        im.setColorAt(i, c.setHSL(0, 0, 0.8 + (i % 5) * 0.06));
      });
      G.add(im);
      if (k === "stalk") {
        // bulbes lumineux au sommet des tiges
        const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff7ae0, emissive: 0xff3fd0, emissiveIntensity: 1.6, transparent: true, opacity: 0.85 }), list.length);
        list.forEach((o, i) => caps.setMatrixAt(i, m4.compose(v.set(o.x, heightAt(o.x, o.z) + o.r * 7 * o.h, o.z), q.identity(), s.setScalar(o.r * 0.9))));
        G.add(caps);
      }
      if (k === "pillar") {
        const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1.15, 0.08, 6, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffa640 }), list.length);
        list.forEach((o, i) => rings.setMatrixAt(i, m4.compose(v.set(o.x, heightAt(o.x, o.z) + o.r * 4 * o.h * 0.7, o.z), q.identity(), s.setScalar(o.r))));
        G.add(rings);
      }
    }
    // flaques acides
    this.pools = W.hazards.map((h) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(h.r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9dff2f, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set(h.x, heightAt(h.x, h.z) + 2, h.z);
      G.add(m);
      return m;
    });
    // nutriments : cristaux instanciés + halos
    const nutGeo = new THREE.IcosahedronGeometry(1, 0);
    const nutMat = new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0xffb020, emissiveIntensity: 1.4, roughness: 0.3, flatShading: true });
    this.nutMesh = new THREE.InstancedMesh(nutGeo, nutMat, S.nut.length);
    this.nutMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const NC = [0xffe08a, 0xffb81c, 0xfff2b0];
    S.nut.forEach((n, i) => this.nutMesh.setColorAt(i, c.setHex(NC[n.kind])));
    G.add(this.nutMesh);
    const hg = new THREE.BufferGeometry();
    const hp = new Float32Array(S.nut.length * 3),
      hc = new Float32Array(S.nut.length * 4),
      hs = new Float32Array(S.nut.length);
    S.nut.forEach((n, i) => {
      hp.set([n.x, heightAt(n.x, n.z) + 12, n.z], i * 3);
      c.setHex(n.kind === 2 ? 0xfff0a0 : 0xffb020);
      hc.set([c.r, c.g, c.b, 0.55], i * 4);
      hs[i] = n.kind ? 70 : 34;
    });
    hg.setAttribute("position", new THREE.BufferAttribute(hp, 3));
    hg.setAttribute("col", new THREE.BufferAttribute(hc, 4));
    hg.setAttribute("size", new THREE.BufferAttribute(hs, 1));
    this.halos = new THREE.Points(hg, pointsMat(this.glowTex));
    this.halos.frustumCulled = false;
    G.add(this.halos);
    // orbes d'énergie lâchés par les créatures tuées
    this.orbMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x8dfff0, emissive: 0x2affd5, emissiveIntensity: 2.2, roughness: 0.2 }),
      200,
    );
    this.orbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.orbMesh.frustumCulled = false;
    G.add(this.orbMesh);
    // spores d'ambiance (autour de la caméra)
    const SP = 2200,
      sg = new THREE.BufferGeometry(),
      sp = new Float32Array(SP * 3),
      scol = new Float32Array(SP * 4),
      ss = new Float32Array(SP);
    const SC = [0x6ff5ff, 0xffd36b, 0xff7ae0, 0xb6ff6b];
    for (let i = 0; i < SP; i++) {
      sp.set([(R() - 0.5) * 1600, 10 + R() * 260, (R() - 0.5) * 1600], i * 3);
      c.setHex(SC[i % 4]);
      scol.set([c.r, c.g, c.b, 0.25 + R() * 0.5], i * 4);
      ss[i] = 3 + R() * 7;
    }
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    sg.setAttribute("col", new THREE.BufferAttribute(scol, 4));
    sg.setAttribute("size", new THREE.BufferAttribute(ss, 1));
    this.sporeBase = sp.slice();
    this.spores = new THREE.Points(sg, pointsMat(this.glowTex));
    this.spores.frustumCulled = false;
    sg.setDrawRange(0, this.Q.spores);
    G.add(this.spores);
    // fragments de mémoire
    this.fragM = S.frags.map((f) => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(9, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8ff6ff, emissiveIntensity: 2, flatShading: true }));
      core.position.y = 30;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(4, 10, 220, 10, 1, true).translate(0, 110, 0), addMat(0x8ff6ff, 0.35, this.beamTex));
      beam.rotation.x = Math.PI;
      beam.position.y = 220;
      g.add(core, beam);
      g.position.set(f.x, heightAt(f.x, f.z), f.z);
      g.userData = { core, beam };
      G.add(g);
      return g;
    });
    // relais biologiques
    this.relayM = S.relays.map((r) => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(28, 40, 26, 10), new THREE.MeshStandardMaterial({ color: 0x2a2f45, metalness: 0.7, roughness: 0.3 }));
      base.position.y = 8;
      base.castShadow = true;
      const ringMat = new THREE.MeshStandardMaterial({ color: NEUTRAL, emissive: NEUTRAL, emissiveIntensity: 1.2 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(34, 3, 8, 40), ringMat);
      ring.position.y = 46;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(12, 20, 14), ringMat);
      orb.position.y = 46;
      const zone = new THREE.Mesh(new THREE.RingGeometry(r.r - 4, r.r, 64).rotateX(-Math.PI / 2), addMat(NEUTRAL, 0.6));
      zone.position.y = 3;
      const prog = new THREE.Mesh(new THREE.CircleGeometry(r.r, 48).rotateX(-Math.PI / 2), addMat(0xffffff, 0.25));
      prog.position.y = 2.5;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(8, 22, 400, 12, 1, true).translate(0, 200, 0), addMat(NEUTRAL, 0.25, this.beamTex));
      beam.rotation.x = Math.PI;
      beam.position.y = 400;
      g.add(base, ring, orb, zone, prog, beam);
      g.position.set(r.x, heightAt(r.x, r.z), r.z);
      g.userData = { ring, ringMat, zone, prog, beam };
      G.add(g);
      return g;
    });
    // arène finale
    this.buildArena(G);
    // pools dynamiques
    this.npcM = S.npcs.map((n) => {
      const m = this.buildNpc(n.kind);
      G.add(m);
      return m;
    });
    this.coreM = [0, 1].map((s) => {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: COL[s].main, emissive: COL[s].main, emissiveIntensity: 1.3, flatShading: true, roughness: 0.2 });
      for (let k = 0; k < 6; k++) {
        const cr = new THREE.Mesh(new THREE.OctahedronGeometry(10 + (k % 3) * 5, 0), mat);
        const a = (k / 6) * 6.28;
        cr.position.set(Math.cos(a) * 18, 18 + (k % 2) * 14, Math.sin(a) * 18);
        cr.scale.y = 2.2;
        cr.castShadow = true;
        g.add(cr);
      }
      const heart = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: COL[s].glow }));
      heart.position.y = 34;
      const aura = new THREE.Mesh(new THREE.RingGeometry(212, 220, 80).rotateX(-Math.PI / 2), addMat(COL[s].main, 0.4));
      aura.position.y = 3;
      g.add(heart, aura);
      g.userData = { heart };
      g.visible = false;
      G.add(g);
      return g;
    });
    this.turM = Array.from({ length: 6 }, () => {
      const g = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.ConeGeometry(9, 40, 6).translate(0, 20, 0), new THREE.MeshStandardMaterial({ color: 0x333a55, metalness: 0.6, roughness: 0.3 }));
      const eye = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      eye.position.y = 44;
      g.add(stem, eye);
      g.userData = { eye };
      g.visible = false;
      G.add(g);
      return g;
    });
    this.shotM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), 60);
    this.shotM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shotM.frustumCulled = false;
    G.add(this.shotM);
    // effets réutilisables
    this.rings = Array.from({ length: 10 }, () => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 64).rotateX(-Math.PI / 2), addMat(0xffffff, 0));
      m.visible = false;
      G.add(m);
      return { m, t: 0, d: 1, r0: 1, r1: 2 };
    });
    this.swipes = Array.from({ length: 6 }, () => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.55, 1, 24, 1, -0.75, 1.5).rotateX(-Math.PI / 2), addMat(0xffffff, 0));
      m.visible = false;
      G.add(m);
      return { m, t: 0 };
    });
    this.beams = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 1, 8, 1, true).rotateX(Math.PI / 2), addMat(0xff2b6b, 0.7));
      m.visible = false;
      G.add(m);
      return m;
    });
    if (!this.parts) this.parts = new Particles(sc, this.glowTex, this.Q.parts);
    this.creatures = [null, null];
    this.lights = [0, 1].map((s) => {
      const l = new THREE.PointLight(COL[s].main, 2.5, 260, 1.6);
      sc.add(l);
      G.userData[`l${s}`] = l;
      return l;
    });
    this.lights.forEach((l) => G.add(l));
    this.minimapBase = this.renderMiniBase();
    this.explored = [new Uint8Array(50 * 50), new Uint8Array(50 * 50)];
  }

  buildArena(G) {
    const A = N.ARENA,
      g = new THREE.Group();
    g.position.set(A.x, 0, A.z);
    const ringTex = canvasTex(512, (c, s) => {
      c.fillStyle = "#07051a";
      c.fillRect(0, 0, s, s);
      for (let i = 1; i < 9; i++) {
        c.strokeStyle = `rgba(255,${190 + i * 6},90,${0.25 + (i % 2) * 0.35})`;
        c.lineWidth = i % 3 ? 2 : 5;
        c.beginPath();
        c.arc(s / 2, s / 2, (i / 9) * (s / 2), 0, 7);
        c.stroke();
      }
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * 6.283;
        c.strokeStyle = "rgba(255,200,90,.25)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(s / 2, s / 2);
        c.lineTo(s / 2 + Math.cos(a) * s, s / 2 + Math.sin(a) * s);
        c.stroke();
      }
    }, false);
    ringTex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(A.r + 300, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9a8a70, map: ringTex, emissive: 0xffc04a, emissiveMap: ringTex, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.5 }));
    floor.receiveShadow = true;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(A.r, A.r, 180, 96, 1, true).translate(0, 90, 0), addMat(0xffc04a, 0.55, this.beamTex));
    wall.rotation.x = Math.PI;
    wall.position.y = 180;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(A.r, 3, 8, 128).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
    halo.position.y = 2;
    g.add(floor, wall, halo);
    // noyau Zénith flottant au-dessus de l'arène
    const nz = new THREE.Mesh(new THREE.IcosahedronGeometry(60, 2), new THREE.MeshStandardMaterial({ color: 0x1a1030, emissive: 0xffc04a, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.2, flatShading: true }));
    nz.position.y = 420;
    const nzAura = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 24), fresnelMat(0xffd36b, 1));
    nzAura.position.y = 420;
    g.add(nz, nzAura);
    this.arenaCore = nz;
    this.beaconM = Array.from({ length: 5 }, () => {
      const b = new THREE.Group();
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(10, 16, 70, 6).translate(0, 35, 0), new THREE.MeshStandardMaterial({ color: 0x2a2236, metalness: 0.8, roughness: 0.25 }));
      const crMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd36b, emissiveIntensity: 1.5, flatShading: true });
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(16, 0), crMat);
      cr.position.y = 95;
      const zone = new THREE.Mesh(new THREE.RingGeometry(56, 62, 48).rotateX(-Math.PI / 2), addMat(0xffd36b, 0.7));
      zone.position.y = 2;
      const prog = new THREE.Mesh(new THREE.CircleGeometry(60, 40).rotateX(-Math.PI / 2), addMat(0xffffff, 0.3));
      prog.position.y = 1.5;
      b.add(pil, cr, zone, prog);
      b.userData = { cr, crMat, zone, prog };
      g.add(b);
      return b;
    });
    g.visible = false;
    this.arena = g;
    G.add(g);
  }

  buildNpc(kind) {
    const K = N.NPC_KINDS[kind];
    const g = new THREE.Group();
    const palette = { mite: [0xa8f0c8, 0x2fd08a], grazer: [0x8fa8d8, 0x3a5aa0], stalker: [0x9dff2f, 0x5a1aa0], brute: [0x7a3aa8, 0x9dff2f], leviathan: [0x2a1040, 0xb44aff] }[kind];
    const mat = new THREE.MeshStandardMaterial({ color: palette[0], emissive: palette[1], emissiveIntensity: 0.35, roughness: 0.45, flatShading: kind === "brute" || kind === "leviathan" });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat);
    body.scale.set(0.85, 0.75, 1.25);
    body.castShadow = true;
    g.add(body);
    const eyeM = new THREE.MeshBasicMaterial({ color: K.aggro ? 0xff3355 : 0xffffff });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), eyeM);
      eye.position.set(sx * 0.38, 0.3, 1.05);
      g.add(eye);
    }
    const accent = new THREE.MeshStandardMaterial({ color: palette[1], emissive: palette[1], emissiveIntensity: 0.8 });
    if (kind === "mite" || kind === "grazer") {
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 6).rotateX(-Math.PI / 2), accent);
      tail.position.z = -1.4;
      g.add(tail);
      g.userData.tail = tail;
    }
    if (kind === "grazer") {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 3), accent);
      fin.position.y = 0.8;
      fin.scale.z = 0.3;
      g.add(fin);
    }
    if (kind === "stalker" || kind === "brute" || kind === "leviathan") {
      const n = kind === "leviathan" ? 9 : 5;
      for (let k = 0; k < n; k++) {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.8, 5), accent);
        sp.position.set(0, 0.65, 0.8 - k * (1.8 / n));
        sp.rotation.x = -0.5;
        g.add(sp);
      }
      for (const sx of [-1, 1]) {
        const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 5).rotateX(Math.PI / 2), accent);
        jaw.position.set(sx * 0.3, -0.15, 1.3);
        jaw.rotation.y = -sx * 0.4;
        g.add(jaw);
      }
    }
    if (kind === "leviathan") {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 6, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb44aff }));
      g.add(ring);
      g.userData.ring = ring;
    }
    g.scale.setScalar(K.r);
    g.userData.mat = mat;
    g.userData.base = palette[1];
    return g;
  }

  /* créature du joueur, façonnée par ses mutations */
  buildCreature(p) {
    const C = COL[p.seat],
      g = new THREE.Group(),
      U = (g.userData = { anim: [] });
    const count = (vis) => p.muts.filter((m) => N.MUT_BY[m].vis === vis).length;
    const cloak = count("cloak");
    const bodyGeo = new THREE.SphereGeometry(1, 40, 28);
    const bp = bodyGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i),
        y = bp.getY(i),
        z = bp.getZ(i);
      const w = 1 + 0.06 * Math.sin(x * 7 + z * 5) + 0.04 * Math.sin(y * 9);
      bp.setXYZ(i, x * w * 0.92, y * w * 0.8, z * w * (1.2 + (z > 0 ? 0.1 : 0)));
    }
    bodyGeo.computeVertexNormals();
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: C.main, emissive: C.main, emissiveIntensity: 0.28, roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.2, sheen: 1, sheenColor: new THREE.Color(C.b), transparent: true, opacity: p.act === 1 ? 0.72 : cloak ? 0.55 : 0.92 });
    if (cloak) bodyMat.color.multiplyScalar(0.45);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    g.add(body);
    U.body = body;
    U.bodyMat = bodyMat;
    const coreSz = count("core") ? 0.55 : 0.4;
    const core = new THREE.Mesh(new THREE.SphereGeometry(coreSz, 20, 14), new THREE.MeshBasicMaterial({ color: C.glow }));
    g.add(core);
    U.core = core;
    U.corePulse = count("core") ? 2 : 1;
    const eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.2 });
    const pupil = new THREE.MeshBasicMaterial({ color: 0x050510 });
    const addEye = (x, y, z, s) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 12, 8), eyeW);
      e.position.set(x, y, z);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 8, 6), pupil);
      pu.position.set(x * 1.05, y, z + 0.12 * s);
      g.add(e, pu);
    };
    addEye(-0.36, 0.3, 1.02, 1);
    addEye(0.36, 0.3, 1.02, 1);
    if (count("eyes")) {
      addEye(0, 0.62, 0.78, 0.8);
      if (count("eyes") > 1) (addEye(-0.55, 0.55, 0.55, 0.6), addEye(0.55, 0.55, 0.55, 0.6));
    }
    const accent = new THREE.MeshStandardMaterial({ color: C.b, emissive: C.b, emissiveIntensity: 0.7, roughness: 0.35, side: THREE.DoubleSide });
    const memb = new THREE.MeshStandardMaterial({ color: C.b, emissive: C.b, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c2438, metalness: 0.7, roughness: 0.3, emissive: C.main, emissiveIntensity: 0.12, flatShading: true });
    if (count("fins")) {
      for (const sx of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2 + 0.3 * count("fins"), 3), accent);
        fin.scale.z = 0.25;
        fin.rotation.set(Math.PI / 2, 0, sx * 1.2);
        fin.position.set(sx * 0.85, 0, -0.2);
        g.add(fin);
        U.anim.push((t) => (fin.rotation.z = sx * (1.2 + Math.sin(t * 10) * 0.25)));
      }
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 3), accent);
      tail.scale.x = 0.25;
      tail.rotation.x = -Math.PI / 2;
      tail.position.z = -1.45;
      g.add(tail);
      U.anim.push((t) => (tail.rotation.y = Math.sin(t * 8) * 0.4));
    }
    if (count("plates")) {
      const n = 3 + count("plates") * 2;
      for (let k = 0; k < n; k++) {
        const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.1, 6), dark);
        const a = -0.9 + (k / (n - 1)) * 1.8;
        pl.position.set(Math.sin(a) * 0.15, 0.72 - Math.abs(a) * 0.1, Math.sin(a) * 0.95);
        pl.rotation.x = a * 0.6;
        g.add(pl);
      }
      if (count("plates") > 1)
        for (const sx of [-1, 1]) {
          const side = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 6), dark);
          side.position.set(sx * 0.82, 0.15, 0);
          side.rotation.z = (sx * Math.PI) / 2.3;
          g.add(side);
        }
    }
    if (count("spikes")) {
      const prism = new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: C.glow, emissiveIntensity: 0.6, roughness: 0, metalness: 0.2, clearcoat: 1, flatShading: true });
      const n = 2 + count("spikes") * 2;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 6.283;
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.75, 4).rotateX(Math.PI / 2), prism);
        sp.position.set(Math.cos(a) * 0.32, Math.sin(a) * 0.25, 1.25);
        sp.rotation.set(-Math.sin(a) * 0.4, Math.cos(a) * 0.4, 0);
        g.add(sp);
      }
    }
    if (count("thorns"))
      for (let k = 0; k < 14; k++) {
        const v = new THREE.Vector3(Math.sin(k * 2.4) * Math.cos(k * 1.1), Math.abs(Math.cos(k * 2.4)) * 0.8, Math.sin(k * 1.1) * 1.1).normalize();
        const th = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 4), accent);
        th.position.copy(v).multiplyScalar(0.95);
        th.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
        g.add(th);
      }
    if (count("tentacles")) {
      const n = 2 + count("tentacles") * 2;
      for (let k = 0; k < n; k++) {
        const chain = [];
        const off = (k / (n - 1) - 0.5) * 1.3;
        for (let j = 0; j < 6; j++) {
          const s = new THREE.Mesh(new THREE.SphereGeometry(0.13 - j * 0.015, 8, 6), accent);
          g.add(s);
          chain.push(s);
        }
        U.anim.push((t) => chain.forEach((s, j) => s.position.set(off + Math.sin(t * 5 + j * 0.8 + k) * 0.12 * j, -0.35 - j * 0.03, -0.9 - j * 0.28)));
      }
    }
    if (count("wings"))
      for (const sx of [-1, 1]) {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0);
        sh.quadraticCurveTo(1.2, 0.9, 2.2, 0.3);
        sh.quadraticCurveTo(1.4, -0.1, 1.6, -0.6);
        sh.quadraticCurveTo(0.8, -0.3, 0, -0.4);
        const w = new THREE.Mesh(new THREE.ShapeGeometry(sh, 10), memb);
        w.rotation.x = -Math.PI / 2;
        w.scale.x = sx;
        w.position.set(sx * 0.5, 0.35, 0);
        const piv = new THREE.Group();
        piv.add(w);
        g.add(piv);
        U.anim.push((t) => (piv.rotation.z = sx * Math.sin(t * 6) * 0.35));
      }
    if (count("rings"))
      for (let k = 0; k < 2; k++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(1.55 + k * 0.25, 0.035, 6, 64), new THREE.MeshBasicMaterial({ color: k ? 0xffd36b : C.glow }));
        g.add(r);
        U.anim.push((t) => r.rotation.set(1.2 + Math.sin(t * 0.7 + k) * 0.3, t * (k ? -1.4 : 1.1), 0));
      }
    if (count("portal")) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 48), new THREE.MeshBasicMaterial({ color: 0xb46bff }));
      r.position.z = -1.55;
      g.add(r);
      U.anim.push((t) => (r.rotation.z = t * 3));
    }
    if (count("jets"))
      for (const sx of [-1, 1]) {
        const j = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8).rotateX(-Math.PI / 2), dark);
        j.position.set(sx * 0.35, -0.1, -1.25);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.7, 8).rotateX(Math.PI / 2), addMat(C.glow, 0.8));
        fl.position.set(sx * 0.35, -0.1, -1.7);
        g.add(j, fl);
        U.anim.push((t) => (fl.scale.z = 0.6 + Math.random() * 0.6 + (U.speed || 0) * 1.2));
      }
    if (count("sacs"))
      for (let k = 0; k < 3; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshPhysicalMaterial({ color: C.glow, transparent: true, opacity: 0.6, emissive: C.glow, emissiveIntensity: 0.5, roughness: 0.1 }));
        s.position.set((k - 1) * 0.5, -0.45, -0.3);
        g.add(s);
        U.anim.push((t) => s.scale.setScalar(1 + Math.sin(t * 3 + k) * 0.15));
      }
    if (count("spores")) {
      const sp = [];
      for (let k = 0; k < 7; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: 0xb6ff6b }));
        g.add(s);
        sp.push(s);
      }
      U.anim.push((t) => sp.forEach((s, k) => s.position.set(Math.cos(t * 1.5 + k) * 1.4, Math.sin(t * 2 + k * 2) * 0.4, Math.sin(t * 1.5 + k) * 1.4)));
    }
    // spécialisation : marque distinctive
    if (p.spec === "predateur")
      for (const sx of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.9, 6), dark);
        h.position.set(sx * 0.35, 0.8, 0.5);
        h.rotation.set(0.8, 0, -sx * 0.4);
        g.add(h);
      }
    if (p.spec === "gardien") {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.12, 6, 6).rotateX(Math.PI / 2), dark);
      halo.position.y = 0.1;
      g.add(halo);
    }
    if (p.spec === "nomade")
      for (const sx of [-1, 1]) {
        const st = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 2.2).translate(0, -1.1, 0), memb);
        st.position.set(sx * 0.3, 0.2, -1);
        st.rotation.x = -1.3;
        g.add(st);
        U.anim.push((t) => (st.rotation.y = Math.sin(t * 7 + sx) * 0.4));
      }
    if (p.spec === "architecte")
      for (let k = 0; k < 3; k++) {
        const a = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd36b, emissiveIntensity: 1.2, flatShading: true }));
        a.position.set((k - 1) * 0.35, 1.05, 0.1);
        a.scale.y = 2;
        g.add(a);
      }
    if (p.spec === "siphonneur") {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.12, 0.5, 12, 1, true).rotateX(Math.PI / 2), accent);
      f.position.z = 1.3;
      g.add(f);
    }
    // bouclier
    const sh = new THREE.Mesh(new THREE.SphereGeometry(1.7, 32, 20), fresnelMat(C.glow, 1.2));
    sh.visible = false;
    g.add(sh);
    U.shield = sh;
    const aura = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 16), fresnelMat(C.main, 0.35));
    g.add(aura);
    U.aura = aura;
    const outer = new THREE.Group();
    outer.add(g);
    outer.userData = U;
    U.inner = g;
    return outer;
  }

  /* ---------- démarrage d'une partie ---------- */
  newGame(seed) {
    this.panel("");
    this.paused = false;
    const names = this.ctx.players.map((p) => p.name);
    const bots = this.mode === "bot" ? [null, this.prefs.diff] : [null, null];
    if (this.mode === "bot") names[1] = `Robot ${DIFFS[this.prefs.diff][0]}`;
    this.S = N.createSim(seed, { names, bots, solo: this.mode === "bot" });
    this.seed = seed;
    this.buildWorld();
    this.applyQuality();
    this.acc = 0;
    this.snapT = 0;
    this.fullT = 0;
    this.inT = 0;
    this.netEv = [];
    this.endShown = false;
    this.lastActs = [1, 1];
    this.storyQ = [];
    this.buildViews();
    this.sound.init();
    if (this.mode === "online" && !this.isHost) this.waiting = true;
    else this.banner(N.ACTS[1], "Absorbe, survis, trouve 3 fragments", 4);
    if (this.mode === "online" && this.isHost) this.ctx.send("seed", { seed });
  }

  buildViews() {
    if (!this.S) return;
    const box = this.$(".nx-views");
    box.innerHTML = "";
    const seats = this.mode === "local" ? [0, 1] : [this.mode === "online" ? this.ctx.seat : 0];
    const touch = this.prefs.touch === "on" || (this.prefs.touch === "auto" && (matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && !matchMedia("(pointer: fine)").matches)));
    this.touchOn = touch;
    const old = this.views || [];
    this.views = seats.map((seat, i) => {
      const p = this.S.players[seat];
      const el = document.createElement("div");
      el.className = "nx-view";
      el.innerHTML = `
        <div class="nx-hud">
          <div class="nx-id" style="--c:${COL[seat].css}"><b class="nx-name"></b><span class="nx-lv"></span></div>
          <div class="nx-bar hp"><u></u><span></span></div>
          <div class="nx-bar en"><u></u><span></span></div>
          <div class="nx-bar zen"><u></u><span></span></div>
          <div class="nx-bar xp"><u></u></div>
          <div class="nx-obj"></div>
          <div class="nx-muts"></div>
        </div>
        <canvas class="nx-mini" width="180" height="180" title="Carte (${esc(this.keyLabel(this.keys[0].map))})"></canvas>
        <div class="nx-rival"><i>➤</i><span></span></div>
        <div class="nx-cds"></div>
        <div class="nx-choice" hidden></div>
        <div class="nx-story" hidden></div>
        <div class="nx-floats"></div>
        ${touch ? `<div class="nx-touch">
          <div class="nx-joyzone"></div><div class="nx-camzone"></div>
          <div class="nx-joy" hidden><i></i></div>
          <button class="tb atk" data-t="atk">⚔</button><button class="tb dash" data-t="dash">💨</button>
          <button class="tb abil" data-t="abil">✦</button><button class="tb wave" data-t="wave">◎</button><button class="tb build" data-t="build">⬢</button>
          <div class="nx-tsmall"><button data-t="map">🗺</button><button data-t="recenter" title="Recentrer la caméra">🎯</button><button data-t="hide" title="Masquer les contrôles">👁</button></div>
        </div>` : ""}`;
      box.appendChild(el);
      const v = {
        seat, el, i,
        cam: new THREE.PerspectiveCamera(55, 1, 5, 4200),
        yaw: old[i]?.yaw ?? p.ang,
        zoom: old[i]?.zoom ?? 1,
        mini: el.querySelector(".nx-mini"),
        q: (s) => el.querySelector(s),
        joy: { id: null, ox: 0, oy: 0, x: 0, y: 0, sx: 0, sy: 0 },
        camDrag: null,
        tbtn: {},
        shake: 0,
        big: false,
      };
      v.q(".nx-name").textContent = p.name;
      v.mini.onclick = () => (v.big = !v.big);
      if (touch) this.bindTouch(v);
      return v;
    });
    this.layoutViews();
    this.refreshHints();
  }
  layoutViews() {
    const n = this.views.length;
    const side = this.W >= this.H;
    this.views.forEach((v, i) => {
      const r = n === 1 ? { x: 0, y: 0, w: this.W, h: this.H } : side ? { x: i * (this.W / 2), y: 0, w: this.W / 2, h: this.H } : { x: 0, y: i * (this.H / 2), w: this.W, h: this.H / 2 };
      v.rect = r;
      Object.assign(v.el.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
      v.el.classList.toggle("split", n > 1);
      v.cam.aspect = r.w / r.h;
      v.cam.updateProjectionMatrix();
    });
  }
  refreshHints() {
    if (!this.views) return;
    for (const v of this.views) {
      const s = this.mode === "local" ? v.seat : 0;
      const k = (a) => this.keyLabel(this.keys[s][a]);
      v.hints = { atk: k("atk"), dash: k("dash"), abil: k("abil"), wave: k("wave"), build: k("build") };
      v.cdBuilt = false;
    }
  }

  /* ---------- entrées ---------- */
  bindInput() {
    const on = (t, ev, f, o) => {
      t.addEventListener(ev, f, o);
      this.off.push(() => t.removeEventListener(ev, f, o));
    };
    const typing = (e) => e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !this.ctx.root.contains(e.target);
    on(window, "keydown", (e) => {
      if (typing(e)) return;
      if (this.binding) {
        e.preventDefault();
        const { seat, action, done } = this.binding;
        this.binding = null;
        if (e.code !== "Escape" || action === "pause") {
          // échange si la touche est déjà prise
          for (const s of [0, 1]) for (const a in this.keys[s]) if (this.keys[s][a] === e.code && !(s === seat && a === action)) this.keys[s][a] = this.keys[seat][action];
          this.keys[seat][action] = e.code;
          LS.set("keys", this.keys);
          this.refreshHints();
        }
        return done();
      }
      const hit = this.actionsFor(e.code);
      if (hit.length || ["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      this.sound.init();
      if (e.repeat) return;
      this.down.add(e.code);
      for (const [seat, a] of hit) {
        if (a === "pause") {
          if (!this.$(".nx-panel").hidden && !this.paused) continue;
          this.togglePause();
        } else if (a === "map") this.views.forEach((v) => (v.big = !v.big));
        else if (a[0] === "c" && a.length === 2) this.choose(seat, +a[1] - 1);
        else if (EDGE.includes(a)) this.edges[seat][a] = 1;
      }
    });
    on(window, "keyup", (e) => this.down.delete(e.code));
    on(window, "blur", () => this.releaseAll());
    on(document, "visibilitychange", () => {
      this.releaseAll();
      if (document.hidden && this.S && !this.S.over && this.mode !== "online" && !this.paused && this.$(".nx-panel").hidden) this.showPause();
    });
    const cv = this.ctx.root;
    on(cv, "contextmenu", (e) => e.preventDefault());
    on(cv, "pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.target.closest("button,.nx-card,.nx-choice,.nx-mini")) return;
      this.sound.init();
      if (e.button === 0) this.mouse.l = 1;
      if (e.button === 2) {
        this.mouse.r = 1;
        this.mouse.dragX = e.clientX;
      }
    });
    on(window, "pointerup", (e) => {
      if (e.pointerType !== "mouse") return;
      if (e.button === 0) this.mouse.l = 0;
      if (e.button === 2) this.mouse.r = 0;
    });
    on(window, "pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = this.ctx.root.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.t = performance.now();
      if (this.mouse.r && this.views?.length) {
        const v = this.viewAt(this.mouse.x, this.mouse.y) || this.views[0];
        v.yaw -= (e.clientX - this.mouse.dragX) * 0.006 * this.prefs.sens * (this.prefs.invert ? -1 : 1);
        this.mouse.dragX = e.clientX;
      }
    });
    on(cv, "wheel", (e) => {
      if (e.target.closest(".nx-card")) return;
      e.preventDefault();
      const v = this.viewAt(this.mouse.x, this.mouse.y) || this.views?.[0];
      if (v) v.zoom = clamp(v.zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.55, 1.8);
    }, { passive: false });
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }
  viewAt(x, y) {
    return this.views?.find((v) => x >= v.rect.x && x < v.rect.x + v.rect.w && y >= v.rect.y && y < v.rect.y + v.rect.h);
  }
  actionsFor(code) {
    const out = [];
    const local = this.mode === "local";
    for (const s of [0, 1])
      for (const a in this.keys[s])
        if (this.keys[s][a] === code) {
          if (local) out.push([s, a]);
          else out.push([this.views?.[0]?.seat ?? 0, a]); // en solo, les deux jeux de touches pilotent ta créature
        }
    return out;
  }
  held(seat, a) {
    if (this.mode === "local") return this.down.has(this.keys[seat][a]);
    return this.down.has(this.keys[0][a]) || this.down.has(this.keys[1][a]);
  }
  releaseAll() {
    this.down.clear();
    this.mouse.l = this.mouse.r = 0;
    for (const v of this.views || []) {
      v.joy.id = null;
      v.joy.x = v.joy.y = 0;
      v.camDrag = null;
      v.tbtn = {};
      v.q(".nx-joy")?.setAttribute("hidden", "");
    }
  }

  bindTouch(v) {
    const T = v.q(".nx-touch"),
      J = v.q(".nx-joy"),
      knob = J.querySelector("i");
    const R = () => (this.H < 650 ? 52 : 62);
    const end = (e) => {
      if (v.joy.id === e.pointerId) {
        v.joy.id = null;
        v.joy.x = v.joy.y = 0;
        J.hidden = true;
      }
      if (v.camDrag?.id === e.pointerId) v.camDrag = null;
      for (const k in v.tbtn) if (v.tbtn[k] === e.pointerId) delete v.tbtn[k];
      e.target.classList?.remove("on");
    };
    T.addEventListener("pointerdown", (e) => {
      this.sound.init();
      const b = e.target.closest("[data-t]");
      e.preventDefault();
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {
        /* pointeur déjà relâché */
      }
      if (b) {
        const t = b.dataset.t;
        b.classList.add("on");
        if (t === "atk") v.tbtn.atk = e.pointerId;
        else if (EDGE.includes(t)) this.edges[v.seat][t] = 1;
        else if (t === "map") v.big = !v.big;
        else if (t === "recenter") v.yaw = this.S.players[v.seat].ang;
        else if (t === "hide") {
          this.prefs.touch = "off";
          this.savePrefs();
          this.buildViews();
          this.msg("Contrôles tactiles masqués : ⚙ Options pour les réafficher.", 3500);
        }
        return;
      }
      const r = v.el.getBoundingClientRect();
      const x = e.clientX - r.left,
        y = e.clientY - r.top;
      if (e.target.classList.contains("nx-joyzone") && v.joy.id === null) {
        Object.assign(v.joy, { id: e.pointerId, ox: x, oy: y, x: 0, y: 0 });
        J.hidden = false;
        J.style.left = x + "px";
        J.style.top = y + "px";
        knob.style.transform = "translate(-50%,-50%)";
      } else if (!v.camDrag) v.camDrag = { id: e.pointerId, lx: e.clientX };
    });
    T.addEventListener("pointermove", (e) => {
      if (v.joy.id === e.pointerId) {
        const r = v.el.getBoundingClientRect();
        let dx = e.clientX - r.left - v.joy.ox,
          dy = e.clientY - r.top - v.joy.oy;
        const d = Math.hypot(dx, dy),
          m = R();
        if (d > m) (dx *= m / d, (dy *= m / d));
        knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
        let jx = dx / m,
          jy = -dy / m;
        const l = Math.hypot(jx, jy);
        if (l < 0.12) jx = jy = 0;
        else {
          const k = (l - 0.12) / 0.88 / l;
          jx *= k;
          jy *= k;
        }
        v.joy.x = jx;
        v.joy.y = jy;
      } else if (v.camDrag?.id === e.pointerId) {
        v.yaw -= (e.clientX - v.camDrag.lx) * 0.008 * this.prefs.sens * (this.prefs.invert ? -1 : 1);
        v.camDrag.lx = e.clientX;
      }
    });
    T.addEventListener("pointerup", end);
    T.addEventListener("pointercancel", end);
    T.addEventListener("lostpointercapture", end);
  }

  pollPads(dt) {
    if (!this.prefs.pad || !navigator.getGamepads) return [];
    const pads = [...navigator.getGamepads()].filter((p) => p && p.connected);
    this.prevPad ||= [];
    return pads.slice(0, 2).map((p, i) => {
      const prev = this.prevPad[i] || [];
      const btn = (k) => !!p.buttons[k]?.pressed;
      const edge = (k) => btn(k) && !prev[k];
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
      const out = { mx: dz(p.axes[0] || 0), my: -dz(p.axes[1] || 0), cx: dz(p.axes[2] || 0), atk: btn(0) || btn(7), edges: {}, choose: -1 };
      if (edge(1)) out.edges.dash = 1;
      if (edge(2)) out.edges.abil = 1;
      if (edge(3)) out.edges.wave = 1;
      if (edge(5)) out.edges.build = 1;
      if (edge(9)) this.togglePause();
      if (edge(8)) this.views.forEach((v) => (v.big = !v.big));
      [[14, 0], [12, 1], [15, 2], [13, 3]].forEach(([b, c]) => edge(b) && (out.choose = c));
      this.prevPad[i] = p.buttons.map((b) => b.pressed);
      return out;
    });
  }

  /** Construit l'intention de chaque joueur local à partir clavier + souris + manette + tactile. */
  gatherInput(dt) {
    const pads = this.pollPads(dt);
    for (const v of this.views) {
      const s = v.seat,
        p = this.S.players[s];
      let ix = (this.held(s, "right") ? 1 : 0) - (this.held(s, "left") ? 1 : 0);
      let iy = (this.held(s, "up") ? 1 : 0) - (this.held(s, "down") ? 1 : 0);
      ix += v.joy.x;
      iy += v.joy.y;
      const pad = pads[this.mode === "local" ? v.i : 0];
      let atk = this.held(s, "atk") || v.tbtn.atk !== undefined;
      if (pad) {
        ix += pad.mx;
        iy += pad.my;
        v.yaw -= pad.cx * 2.4 * dt * this.prefs.sens * (this.prefs.invert ? -1 : 1);
        atk ||= pad.atk;
        Object.assign(this.edges[s], pad.edges);
        if (pad.choose >= 0) this.choose(s, pad.choose);
      }
      const l = Math.hypot(ix, iy);
      if (l > 1) (ix /= l, (iy /= l));
      // lissage pour éviter les tremblements
      v.joy.sx = lerp(v.joy.sx, ix, Math.min(1, dt * 14));
      v.joy.sy = lerp(v.joy.sy, iy, Math.min(1, dt * 14));
      const fx = Math.sin(v.yaw),
        fz = Math.cos(v.yaw);
      // droite de la caméra = (−fz, fx) ; avant = (fx, fz)
      const mx = -fz * v.joy.sx + fx * v.joy.sy,
        mz = fx * v.joy.sx + fz * v.joy.sy;
      // visée souris (PC, une seule vue)
      let aim = null;
      if (this.mode !== "local" && this.prefs.mouseAim && performance.now() - this.mouse.t < 2500 && !this.touchOn) {
        const nd = new THREE.Vector2(((this.mouse.x - v.rect.x) / v.rect.w) * 2 - 1, -((this.mouse.y - v.rect.y) / v.rect.h) * 2 + 1);
        this.ray.setFromCamera(nd, v.cam);
        this.plane.constant = -(heightAt(p.x, p.z) + p.r * 0.8);
        const hit = new THREE.Vector3();
        if (this.ray.ray.intersectPlane(this.plane, hit) && Math.hypot(hit.x - p.x, hit.z - p.z) > p.r * 0.6) aim = Math.atan2(hit.x - p.x, hit.z - p.z);
      }
      if (this.mode !== "local" && this.mouse.l) atk = true;
      const I = { mx, mz, aim, atk: atk ? 1 : 0, ...this.edges[s] };
      this.edges[s] = {};
      if (this.mode === "online" && !this.isHost) {
        const q = (this.pendingIn ||= { dash: 0, abil: 0, wave: 0, build: 0 });
        for (const k of EDGE) q[k] ||= I[k] || 0;
        Object.assign(q, { mx, mz, aim, atk: I.atk });
        // prédiction locale légère du déplacement
        if (!p.dead && p.st) {
          const k = Math.min(1, p.st.accel * dt);
          p.vx += (mx * p.st.speed - p.vx) * k;
          p.vz += (mz * p.st.speed - p.vz) * k;
        }
      } else {
        const P = p.inp;
        P.mx = mx;
        P.mz = mz;
        P.aim = aim;
        P.atk = I.atk;
        for (const k of EDGE) if (I[k]) P[k] = 1;
      }
    }
  }

  choose(seat, idx) {
    const S = this.S;
    if (!S) return;
    const p = S.players[seat];
    const ch = N.currentChoices(p);
    if (!ch || idx < 0 || idx >= ch.length || p._picking) return;
    const id = ch[idx];
    this.sound.play("mut");
    if (this.mode === "online" && !this.isHost) {
      p._picking = id;
      this.ctx.send("pick", { id });
      setTimeout(() => (p._picking = null), 1500);
    } else N.pick(S, seat, id);
  }

  /* ---------- réseau ---------- */
  bindNet() {
    const c = this.ctx;
    if (this.isHost) {
      c.on("in", (d) => {
        const p = this.S?.players[1];
        if (!p || !d) return;
        const I = p.inp;
        I.mx = clamp(+d.mx || 0, -1, 1);
        I.mz = clamp(+d.mz || 0, -1, 1);
        I.aim = d.aim === null || d.aim === undefined || !isFinite(+d.aim) ? null : +d.aim;
        I.atk = d.atk ? 1 : 0;
        if (d.atk) I.atkQ = 1; // un appui court n'est jamais perdu
        for (const k of EDGE) if (d[k]) I[k] = 1;
      });
      c.on("pick", (d) => this.S && N.pick(this.S, 1, String(d?.id || "")));
      c.on("rematch", () => this.S?.over && this.rematch());
      c.on("quit", () => this.S && !this.S.over && N.forfeit(this.S, 1));
      c.on("hello", () => this.S && (this.fullT = 0));
    } else {
      c.on("seed", (d) => {
        const seed = +d?.seed >>> 0;
        if (seed && seed !== this.seed) this.newGame(seed);
        this.waiting = true;
      });
      c.on("s", (d) => {
        if (!this.S) return;
        N.applySnapshot(this.S, d);
        if (this.waiting) {
          this.waiting = false;
          this.msg("");
          this.banner(N.ACTS[1], "Absorbe, survis, trouve 3 fragments", 4);
        }
        if (Array.isArray(d.e)) for (const e of d.e.slice(0, 60)) if (e && typeof e.k === "string") this.S.ev.push(e);
      });
      c.send("hello", {});
    }
    c.on("peer-left", () => {
      if (this.S && !this.S.over) {
        this.S.over = { winner: this.views[0].seat, reason: "le rival a quitté la partie", t: this.S.t };
        this.S.phase = "over";
      }
      this.msg("L'autre joueur est parti.", 5000);
    });
  }
  netTick(dt) {
    const S = this.S;
    if (this.isHost) {
      this.snapT -= dt;
      this.fullT -= dt;
      if (this.snapT <= 0 || S.over) {
        this.snapT = 1 / 15;
        const full = this.fullT <= 0;
        if (full) this.fullT = 2;
        const snap = N.snapshot(S, 1, full);
        snap.e = this.netEv.splice(0, 60).map((e) => {
          const o = {};
          for (const k in e) o[k] = typeof e[k] === "number" ? Math.round(e[k] * 10) / 10 : e[k];
          return o;
        });
        this.ctx.send("s", snap);
        N.clearNutChanges(S);
      }
    } else {
      this.inT -= dt;
      if (this.inT <= 0 && this.pendingIn) {
        this.inT = 0.05;
        const q = this.pendingIn;
        this.ctx.send("in", { mx: Math.round(q.mx * 100) / 100, mz: Math.round(q.mz * 100) / 100, aim: q.aim === null ? null : Math.round(q.aim * 100) / 100, atk: q.atk, dash: q.dash, abil: q.abil, wave: q.wave, build: q.build });
        q.dash = q.abil = q.wave = q.build = 0;
      }
    }
  }

  /* ---------- boucle de jeu ---------- */
  frame(t) {
    if (this.dead) return;
    this.raf = requestAnimationFrame((x) => this.frame(x));
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0);
    this.last = t;
    this.fps(dt);
    const S = this.S;
    if (!S || !this.views.length) return this.renderIdle(dt);
    this.gatherInput(dt);
    if (this.mode === "online" && !this.isHost) N.guestStep(S, dt);
    else if (!this.paused) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= N.STEP && n < 5) {
        N.step(S);
        this.acc -= N.STEP;
        n++;
      }
      if (n === 5) this.acc = 0;
    }
    if (this.mode === "online") {
      if (this.isHost) this.netEv.push(...S.ev.filter((e) => !["eat"].includes(e.k) || e.seat === 1));
      this.netTick(dt);
    }
    this.handleEvents();
    this.updateScene(dt, t / 1000);
    this.render();
    this.updateHud(dt);
  }
  fps(dt) {
    if (this.prefs.quality !== "auto" || !this.S || this.autoLocked) return;
    this.fpsLog.push(dt);
    if (this.fpsLog.length >= 120) {
      const avg = this.fpsLog.reduce((a, b) => a + b, 0) / this.fpsLog.length;
      this.fpsLog.length = 0;
      const q = this.autoQ ?? (matchMedia("(pointer: coarse)").matches ? 1 : 2);
      if (avg > 1 / 40 && q > 0) {
        this.autoQ = q - 1;
        this.applyQuality();
      } else if (avg < 1 / 58 && q < 2 && !this.raised) {
        this.autoQ = q + 1;
        this.raised = true;
        this.applyQuality();
      } else this.autoLocked = this.autoQ !== undefined && avg < 1 / 45;
    }
  }
  renderIdle() {
    if (!this.renderer || !this.W) return;
    this.renderer.setClearColor(0x04131d);
    this.renderer.clear();
  }

  handleEvents() {
    const S = this.S,
      P = this.parts,
      mine = (seat) => this.views.some((v) => v.seat === seat);
    const near = (x, z) => this.views.some((v) => {
      const p = S.players[v.seat];
      return Math.abs(p.x - x) < 900 && Math.abs(p.z - z) < 900;
    });
    for (const e of S.ev) {
      const y = (e.z > 5000 ? 0 : heightAt(e.x || 0, e.z || 0)) + 20;
      const col = e.seat === 0 || e.seat === 1 ? COL[e.seat].main : 0xffffff;
      switch (e.k) {
        case "eat":
          P.emit(e.x, y, e.z, e.kind ? 12 : 5, e.kind ? 0xffd36b : 0xffe08a, 80, 0.4, 9);
          if (mine(e.seat)) this.sound.play("eat");
          break;
        case "orb":
          P.emit(e.x, y, e.z, 8, 0x5affe0, 120, 0.5, 10);
          if (mine(e.seat)) this.sound.play("eat");
          break;
        case "hit":
          P.emit(e.x, y, e.z, 10, 0xff4466, 160, 0.4, 12);
          this.float(e.x, e.z, "-" + e.v, "#ff6b8a");
          if (mine(e.seat)) {
            this.sound.play("hit");
            this.views.forEach((v) => v.seat === e.seat && (v.shake = 0.25));
          }
          break;
        case "nhit":
          P.emit(e.x, y, e.z, 6, 0xb6ff6b, 120, 0.3, 9);
          if (near(e.x, e.z)) this.float(e.x, e.z, e.v, "#ffe08a");
          break;
        case "ndie":
          P.emit(e.x, y, e.z, 26, 0xb6ff6b, 220, 0.8, 14);
          this.ring(e.x, e.z, 0xb6ff6b, e.r, e.r * 3, 0.5);
          break;
        case "die":
          P.emit(e.x, y, e.z, 60, col, 320, 1.2, 18);
          this.ring(e.x, e.z, col, 20, 260, 0.9);
          if (near(e.x, e.z)) this.sound.play("die");
          break;
        case "spawn":
          this.ring(e.x, e.z, col, 10, 120, 0.7);
          P.emit(e.x, y, e.z, 30, col, 140, 0.9, 12);
          break;
        case "atk": {
          const sw = this.swipes.find((s) => s.t <= 0) || this.swipes[0];
          sw.t = 0.22;
          sw.m.visible = true;
          sw.m.material.color.setHex(COL[e.seat].glow);
          sw.m.position.set(e.x, y - 8, e.z);
          sw.m.rotation.y = e.a - Math.PI / 2;
          sw.m.scale.setScalar(e.r);
          if (near(e.x, e.z)) this.sound.play("atk", 0.8);
          break;
        }
        case "dash":
          P.emit(e.x, y, e.z, 14, col, 90, 0.5, 14);
          if (mine(e.seat)) this.sound.play("dash");
          break;
        case "blink":
          P.emit(e.x, y, e.z, 24, 0xb46bff, 160, 0.6, 14);
          P.emit(e.x2, y, e.z2, 24, 0xb46bff, 160, 0.6, 14);
          this.ring(e.x2, e.z2, 0xb46bff, 10, 90, 0.4);
          if (near(e.x, e.z)) this.sound.play("blink");
          break;
        case "wave":
          this.ring(e.x, e.z, col, 10, e.r, 0.5);
          this.ring(e.x, e.z, 0xffffff, 10, e.r * 0.8, 0.4);
          P.emit(e.x, y, e.z, 40, col, e.r * 2, 0.5, 14, 0.1);
          if (near(e.x, e.z)) this.sound.play("wave");
          break;
        case "abil":
          if (near(e.x, e.z)) this.sound.play(e.kind === "none" ? "shot" : "blink", 0.8);
          if (e.kind === "gardien") this.ring(e.x, e.z, COL[e.seat].glow, 20, 80, 0.4);
          break;
        case "spark":
          P.emit(e.x, y, e.z, 8, col, 120, 0.3, 10);
          break;
        case "boom":
          P.emit(e.x, y, e.z, 50, 0xffa640, 300, 0.9, 18);
          this.ring(e.x, e.z, 0xffa640, 10, e.r * 2, 0.6);
          if (near(e.x, e.z)) this.sound.play("boom");
          break;
        case "cap":
          this.ring(e.x, e.z, col, 20, 260, 1);
          this.ring(e.x, e.z, col, 20, 180, 0.7);
          P.emit(e.x, y, e.z, 40, col, 200, 1, 14);
          this.sound.play("cap", near(e.x, e.z) ? 1 : 0.4);
          if (mine(e.seat)) this.toastView(e.seat, S.phase === "world" ? "Relais capturé" : "Balise capturée");
          else if (this.views.length === 1) this.toastView(this.views[0].seat, S.phase === "world" ? "⚠ Le rival a capturé un relais" : "⚠ Le rival prend une balise");
          break;
        case "core":
          this.ring(e.x, e.z, col, 20, 220, 1);
          if (mine(e.seat)) (this.toastView(e.seat, "Noyau de territoire établi : il produit l'énergie Zénith et te soigne"), this.sound.play("cap"));
          break;
        case "deny":
          if (mine(e.seat)) this.toastView(e.seat, e.msg);
          break;
        case "mut":
          this.ring(e.x, e.z, COL[e.seat].glow, 10, 90, 0.6);
          P.emit(e.x, y, e.z, 30, COL[e.seat].glow, 120, 0.8, 12, 1.5);
          break;
        case "level":
          if (mine(e.seat)) (this.sound.play("level"), this.toastView(e.seat, `Niveau ${e.lv} : choisis une mutation`));
          break;
        case "act":
          if (mine(e.seat)) {
            const sub = { 2: "Le monde s'ouvre : capture les relais, chasse, trouve le rival", 3: "Choisis ta spécialisation et pose ton noyau de territoire" }[e.act];
            this.banner(N.ACTS[e.act], sub, 4, this.mode === "local" ? e.seat : null);
            this.sound.play("level");
          }
          break;
        case "frag":
          if (mine(e.seat)) {
            this.sound.play("frag");
            this.storyView(e.seat, N.STORY[e.text]);
          }
          P.emit(e.x, y + 10, e.z, 30, 0x8ff6ff, 160, 1, 14, 2);
          break;
        case "duel":
          this.banner(N.ACTS[4], `${S.players[e.first].name} a atteint le Zénith ! L'arène s'ouvre…`, N.PREP_TIME - 1);
          this.sound.play("alert");
          break;
        case "fight":
          this.banner("COMBAT !", "KO, 3 balises, ou majorité à la fin", 2);
          this.sound.play("alert");
          break;
        case "bite":
          if (near(e.x, e.z)) this.sound.play("hit", 0.5);
          break;
      }
    }
    S.ev.length = 0;
  }
  ring(x, z, color, r0, r1, d) {
    const r = this.rings.find((q) => q.t <= 0) || this.rings[0];
    Object.assign(r, { t: d, d, r0, r1 });
    r.m.material.color.setHex(color);
    r.m.position.set(x, (z > 5000 ? 0 : heightAt(x, z)) + 4, z);
    r.m.visible = true;
  }
  float(x, z, text, color) {
    if (!this.floats) this.floats = [];
    if (this.floats.length > 24) this.floats.shift().el.remove();
    for (const v of this.views) {
      const me = this.S.players[v.seat];
      if (Math.abs(me.x - x) > 900 || Math.abs(me.z - z) > 900) continue;
      const el = document.createElement("span");
      el.textContent = text;
      el.style.color = color;
      v.q(".nx-floats").appendChild(el);
      this.floats.push({ el, v, x, z, t: 0.9 });
    }
  }
  toastView(seat, text) {
    const v = this.views.find((w) => w.seat === seat);
    if (!v) return;
    const o = v.q(".nx-obj");
    o.dataset.toast = text;
    o.dataset.until = performance.now() + 3000;
  }
  storyView(seat, text) {
    const v = this.views.find((w) => w.seat === seat);
    if (!v) return;
    const el = v.q(".nx-story");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(v.storyT);
    v.storyT = setTimeout(() => (el.hidden = true), 7000);
  }
  banner(title, sub, sec, seat = null) {
    const c = this.$(".nx-center");
    const el = document.createElement("div");
    el.className = "nx-banner";
    el.innerHTML = `<b>${esc(title)}</b><small>${esc(sub || "")}</small>`;
    if (seat !== null && this.views.length > 1) {
      const v = this.views.find((w) => w.seat === seat);
      Object.assign(el.style, { left: v.rect.x + v.rect.w / 2 + "px", top: v.rect.y + v.rect.h * 0.3 + "px" });
    }
    c.appendChild(el);
    setTimeout(() => el.remove(), sec * 1000);
  }

  /* ---------- mise à jour de la scène ---------- */
  updateScene(dt, time) {
    const S = this.S;
    const arena = S.phase !== "world" && S.phase !== "over" ? true : S.phase === "over" && S.players[0].inDuel;
    this.arena.visible = arena;
    this.groundU.uTime.value = time;
    // nutriments
    const m4 = this.m4 || (this.m4 = new THREE.Matrix4()),
      q = this.q4 || (this.q4 = new THREE.Quaternion()),
      v3 = this.v3 || (this.v3 = new THREE.Vector3()),
      s3 = this.s3 || (this.s3 = new THREE.Vector3()),
      e3 = this.e3 || (this.e3 = new THREE.Euler());
    const hc = this.halos.geometry.attributes.col;
    S.nut.forEach((n, i) => {
      const sz = n.alive ? (n.kind ? 7 : 4) : 0;
      e3.set(time * 0.7 + i, time + i, 0);
      q.setFromEuler(e3);
      this.nutMesh.setMatrixAt(i, m4.compose(v3.set(n.x, heightAt(n.x, n.z) + 12 + Math.sin(time * 2 + i) * 3, n.z), q, s3.setScalar(sz)));
      hc.array[i * 4 + 3] = n.alive ? 0.5 + Math.sin(time * 3 + i) * 0.15 : 0;
    });
    this.nutMesh.instanceMatrix.needsUpdate = true;
    hc.needsUpdate = true;
    const orbs = S.orbs || [];
    for (let i = 0; i < 200; i++) {
      const o = orbs[i];
      if (o) this.orbMesh.setMatrixAt(i, m4.compose(v3.set(o.x, heightAt(o.x, o.z) + 16 + Math.sin(time * 4 + o.id) * 4, o.z), q.identity(), s3.setScalar(5 + Math.sin(time * 6 + o.id) * 1.2)));
      else this.orbMesh.setMatrixAt(i, m4.compose(v3.set(0, -9999, 0), q.identity(), s3.setScalar(0)));
    }
    this.orbMesh.instanceMatrix.needsUpdate = true;
    // fragments, relais, flaques
    const vs = this.views.map((v) => v.seat);
    S.frags.forEach((f, i) => {
      const g = this.fragM[i];
      const got = vs.every((s) => f.got[s]);
      g.visible = !got && !arena;
      g.userData.core.rotation.y = time * 1.5;
      g.userData.core.position.y = 30 + Math.sin(time * 2 + i) * 6;
    });
    S.relays.forEach((r, i) => {
      const U = this.relayM[i].userData,
        c = r.owner >= 0 ? COL[r.owner].main : NEUTRAL;
      U.ringMat.color.setHex(c);
      U.ringMat.emissive.setHex(c);
      U.zone.material.color.setHex(c);
      U.beam.material.color.setHex(c);
      U.ring.rotation.set(Math.PI / 2 + Math.sin(time) * 0.3, time, 0);
      U.prog.scale.setScalar(Math.max(0.001, r.prog));
      U.prog.material.color.setHex(r.by >= 0 ? COL[r.by].main : 0xffffff);
      this.relayM[i].visible = !arena;
    });
    for (const m of this.pools) m.material.opacity = 0.35 + Math.sin(time * 2 + m.position.x) * 0.1;
    // créatures neutres
    S.npcs.forEach((n, i) => {
      const g = this.npcM[i];
      g.visible = n.alive && !arena && this.views.some((v) => Math.abs(S.players[v.seat].x - n.x) < 1500 && Math.abs(S.players[v.seat].z - n.z) < 1500);
      if (!g.visible) return;
      g.position.set(n.x, heightAt(n.x, n.z) + n.r * 0.8 + Math.sin(time * 3 + i) * n.r * 0.08, n.z);
      g.rotation.y = n.ang;
      g.rotation.z = Math.sin(time * 6 + i) * 0.08;
      g.userData.mat.emissive.setHex(n.hurt > 0 ? 0xffffff : g.userData.base);
      g.userData.mat.emissiveIntensity = n.hurt > 0 ? 1.2 : n.mode === 2 ? 0.7 : 0.35;
      if (g.userData.tail) g.userData.tail.rotation.y = Math.sin(time * 10 + i) * 0.5;
      if (g.userData.ring) g.userData.ring.rotation.y = time;
    });
    // noyaux, tourelles, tirs
    S.cores.forEach((c, s) => {
      const g = this.coreM[s];
      g.visible = !!c && !arena;
      if (c) {
        g.position.set(c.x, heightAt(c.x, c.z), c.z);
        g.rotation.y = time * 0.3;
        g.userData.heart.scale.setScalar(1 + Math.sin(time * 4) * 0.15);
      }
    });
    this.turM.forEach((g, i) => {
      const t = S.turrets[i];
      g.visible = !!t;
      if (t) {
        g.position.set(t.x, heightAt(t.x, t.z), t.z);
        g.userData.eye.material.color.setHex(COL[t.seat].glow);
      }
    });
    for (let i = 0; i < 60; i++) {
      const sh = S.shots[i];
      if (sh) {
        this.shotM.setMatrixAt(i, m4.compose(v3.set(sh.x, (sh.z > 5000 ? 0 : heightAt(sh.x, sh.z)) + 22, sh.z), q.identity(), s3.setScalar(7)));
        this.shotM.setColorAt(i, (this.tc ||= new THREE.Color()).setHex(COL[sh.seat].glow));
        if (Math.random() < 0.5) this.parts.emit(sh.x, heightAt(sh.x, sh.z) + 22, sh.z, 1, COL[sh.seat].main, 20, 0.3, 10);
      } else this.shotM.setMatrixAt(i, m4.makeScale(0, 0, 0));
    }
    this.shotM.instanceMatrix.needsUpdate = true;
    if (this.shotM.instanceColor) this.shotM.instanceColor.needsUpdate = true;
    // balises de l'arène
    if (arena) {
      this.arenaCore.rotation.y = time * 0.2;
      this.arenaCore.rotation.x = time * 0.13;
      S.beacons.forEach((b, i) => {
        const g = this.beaconM[i],
          U = g.userData,
          c = b.owner >= 0 ? COL[b.owner].main : 0xffd36b;
        g.position.set(b.x - N.ARENA.x, 0, b.z - N.ARENA.z);
        U.crMat.emissive.setHex(c);
        U.zone.material.color.setHex(c);
        U.cr.rotation.y = time * 2;
        U.cr.position.y = 95 + Math.sin(time * 2 + i) * 6;
        U.prog.scale.setScalar(Math.max(0.001, b.prog));
        U.prog.material.color.setHex(b.by >= 0 ? COL[b.by].main : 0xffffff);
      });
    }
    // joueurs
    S.players.forEach((p, s) => this.updateCreature(p, s, dt, time));
    // effets
    for (const r of this.rings) {
      if (r.t <= 0) continue;
      r.t -= dt;
      const k = 1 - r.t / r.d;
      r.m.scale.setScalar(lerp(r.r0, r.r1, 1 - (1 - k) ** 3));
      r.m.material.opacity = Math.max(0, 1 - k) * 0.9;
      if (r.t <= 0) r.m.visible = false;
    }
    for (const w of this.swipes) {
      if (w.t <= 0) continue;
      w.t -= dt;
      w.m.material.opacity = Math.max(0, w.t / 0.22) * 0.9;
      if (w.t <= 0) w.m.visible = false;
    }
    this.parts.update(dt);
    this.sound.mood(S.phase === "duel" ? 1 : S.players.some((p) => p.hurt > 0) ? 0.6 : 0.2);
  }
  updateCreature(p, s, dt, time) {
    const sig = [p.muts.join(), p.spec, p.act > 1 ? 1 : 0].join("|");
    let c = this.creatures[s];
    if (!c || c.userData.sig !== sig) {
      if (c) {
        this.scene.remove(c);
        c.traverse((o) => {
          o.geometry?.dispose();
          if (o.material && !o.material.map) o.material.dispose?.();
        });
      }
      c = this.creatures[s] = this.buildCreature(p);
      c.userData.sig = sig;
      c.userData.sz = p.r;
      this.scene.add(c);
    }
    const U = c.userData;
    c.visible = !p.dead;
    const L = this.lights[s];
    L.visible = !p.dead;
    if (p.dead) return;
    U.sz = lerp(U.sz, p.r, Math.min(1, dt * 3));
    const y = (p.z > 5000 ? 0 : heightAt(p.x, p.z)) + U.sz * 0.95 + Math.sin(time * 2.4 + s) * U.sz * 0.08;
    c.position.set(p.x, y, p.z);
    c.scale.setScalar(U.sz);
    U.inner.rotation.y = p.ang;
    const sp = Math.hypot(p.vx, p.vz);
    U.speed = sp / 400;
    U.inner.rotation.x = Math.min(0.25, sp / 1500);
    U.inner.rotation.z = Math.sin(time * 3 + s) * 0.05;
    const sq = 1 + Math.sin(time * 5) * 0.03;
    U.body.scale.set(sq, 2 - sq, 1 + (p.atkT > 0 ? 0.12 : 0));
    U.core.scale.setScalar(1 + Math.sin(time * 4 * U.corePulse) * 0.12 * U.corePulse);
    for (const f of U.anim) f(time);
    U.bodyMat.emissive.setHex(p.hurt > 0 ? 0xffffff : COL[s].main);
    U.bodyMat.emissiveIntensity = p.hurt > 0 ? 1.4 : 0.45 + (p.act === 1 ? 0.25 : 0);
    c.visible = !(p.inv > 0 && p.inv < 3 && Math.floor(time * 12) % 2 === 0 && p.hurt <= 0) || p.inv > 3;
    U.shield.visible = p.shieldT > 0;
    U.aura.visible = p.act === 1 || p.inDuel;
    L.position.set(p.x, y + p.r * 1.5, p.z);
    L.distance = 140 + p.r * 5;
    if (p.dashT > 0 || p.lungeT > 0 || sp > p.st.speed * 1.4) this.parts.emit(p.x, y, p.z, 2, COL[s].b, 30, 0.45, p.r * 0.7, 0.2);
    // rayon de drain
    const B = this.beams[s];
    if (p.drainTo && p.drainT > 0) {
      const tx = p.drainTo.x,
        tz = p.drainTo.z,
        ty = heightAt(tx, tz) + 20;
      const d = Math.hypot(tx - p.x, ty - y, tz - p.z);
      B.visible = true;
      B.position.set((p.x + tx) / 2, (y + ty) / 2, (p.z + tz) / 2);
      B.lookAt(tx, ty, tz);
      B.scale.set(1 + Math.random() * 0.6, 1 + Math.random() * 0.6, d);
      if (Math.random() < 0.6) this.parts.emit(tx, ty, tz, 1, 0xff2b6b, 60, 0.4, 10);
    } else B.visible = false;
  }

  /* ---------- rendu ---------- */
  render() {
    const S = this.S,
      R = this.renderer,
      Q = this.Q;
    const split = this.views.length > 1;
    for (const v of this.views) this.placeCamera(v);
    const v0 = this.views[0];
    const me = S.players[v0.seat];
    // le soleil (et ses ombres) suit le joueur
    this.sun.position.set(me.x + 300, 600, me.z + 200);
    this.sun.target.position.set(me.x, 0, me.z);
    const ps = Math.min(this.renderer.getPixelRatio(), 2);
    const spPos = this.spores.geometry.attributes.position;
    const b = this.sporeBase,
      t = S.t;
    for (let i = 0, n = Math.min(Q.spores, spPos.count); i < n; i++) {
      const bx = b[i * 3] + Math.sin(t * 0.3 + i) * 20,
        bz = b[i * 3 + 2] + t * 6;
      spPos.array[i * 3] = me.x + ((((bx - me.x) % 1600) + 2400) % 1600) - 800;
      spPos.array[i * 3 + 2] = me.z + ((((bz - me.z) % 1600) + 2400) % 1600) - 800;
      spPos.array[i * 3 + 1] = (me.z > 5000 ? 0 : heightAt(me.x, me.z)) + b[i * 3 + 1] + Math.sin(t + i) * 8;
    }
    spPos.needsUpdate = true;
    if (!split && Q.bloom) {
      this.setAtmos(v0);
      this.renderPass.camera = v0.cam;
      this.bloom.strength = Q.shadow >= 2048 ? 0.95 : 0.8;
      this.setPointScale(this.H * ps, v0.cam);
      R.setScissorTest(false);
      R.setViewport(0, 0, this.W, this.H);
      this.composer.render();
      return;
    }
    R.setScissorTest(true);
    for (const v of this.views) {
      const r = v.rect;
      const y = this.H - r.y - r.h;
      R.setViewport(r.x, y, r.w, r.h);
      R.setScissor(r.x, y, r.w, r.h);
      this.setAtmos(v);
      this.setPointScale(r.h * ps, v.cam);
      R.render(this.scene, v.cam);
    }
    R.setScissorTest(false);
  }
  setPointScale(hpx, cam) {
    const sc = hpx / (2 * Math.tan((cam.fov * Math.PI) / 360));
    for (const o of [this.parts.pts, this.halos, this.spores]) o.material.uniforms.scale.value = sc;
  }
  setAtmos(v) {
    const S = this.S,
      p = S.players[v.seat];
    const arena = p.inDuel;
    const b = N.BIOMES[arena ? 5 : N.biomeAt(S.W, p.x, p.z)];
    v.fogC ||= new THREE.Color(b.fog);
    v.fogC.lerp(this.tmpC ? this.tmpC.setHex(arena ? 0x0a0614 : b.fog) : (this.tmpC = new THREE.Color(b.fog)), 0.03);
    this.scene.fog.color.copy(v.fogC);
    this.scene.background.copy(v.fogC);
    const dist = v.dist || 400;
    this.scene.fog.near = dist * 0.75;
    this.scene.fog.far = dist + (arena ? 1400 : p.st.vision * 1.35);
    this.groundU.veinI.value = arena ? 0 : 0.55;
  }
  placeCamera(v) {
    const p = this.S.players[v.seat];
    const r = v.camR ?? p.r;
    v.camR = lerp(r, p.r, 0.05);
    const dist = (120 + v.camR * 11) * v.zoom;
    v.dist = dist;
    const pitch = 0.82;
    const fx = Math.sin(v.yaw),
      fz = Math.cos(v.yaw);
    const gy = p.z > 5000 ? 0 : heightAt(p.x, p.z);
    v.tx = v.tx === undefined || Math.hypot(v.tx - p.x, v.tz - p.z) > 600 ? p.x : lerp(v.tx, p.x, 0.15);
    v.tz = v.tz === undefined || Math.hypot(v.tx - p.x, v.tz - p.z) > 600 ? p.z : lerp(v.tz, p.z, 0.15);
    v.shake = Math.max(0, v.shake - 1 / 60);
    const sh = v.shake * 14;
    v.cam.position.set(v.tx - fx * dist * Math.cos(pitch) + (Math.random() - 0.5) * sh, gy + dist * Math.sin(pitch), v.tz - fz * dist * Math.cos(pitch) + (Math.random() - 0.5) * sh);
    v.cam.lookAt(v.tx + fx * 40, gy + p.r * 0.6, v.tz + fz * 40);
  }

  /* ---------- interface en jeu ---------- */
  updateHud(dt) {
    const S = this.S;
    const now = performance.now();
    for (const v of this.views) {
      const p = S.players[v.seat],
        st = p.st;
      v.q(".nx-lv").textContent = `Niv ${p.level} · ${S.phase === "world" ? N.ACTS[p.act].split(" — ")[1] : "Duel Zénith"}`;
      const bar = (cls, val, max, label) => {
        const b = v.q(".nx-bar." + cls);
        b.firstElementChild.style.width = clamp((val / max) * 100, 0, 100) + "%";
        if (label !== undefined) b.lastElementChild.textContent = label;
      };
      bar("hp", p.hp, p.maxHp, `${Math.ceil(p.hp)} / ${p.maxHp}`);
      bar("en", p.en, p.maxEn, `Énergie ${Math.floor(p.en)}`);
      bar("zen", p.zen, 100, p.act >= 3 ? `Zénith ${Math.floor(p.zen)} %` : "Zénith : dès l'acte III");
      bar("xp", p.xp, N.xpNeed(p.level));
      v.q(".nx-bar.zen").classList.toggle("off", p.act < 3);
      v.q(".nx-bar.zen").classList.toggle("hot", p.zen > 80);
      // objectif
      const o = v.q(".nx-obj");
      let obj;
      if (+o.dataset.until > now) obj = o.dataset.toast;
      else if (S.phase === "prep") obj = `Préparation : ${Math.ceil(S.phaseT)} s`;
      else if (S.phase === "duel") {
        const n = [0, 1].map((x) => S.beacons.filter((b) => b.owner === x).length);
        obj = `⏱ ${fmtT(S.phaseT)} · Balises : toi ${n[v.seat]} / rival ${n[1 - v.seat]} (3 = victoire)`;
      } else if (p.dead) obj = `Renaissance dans ${Math.ceil(p.respT)} s…`;
      else if (p.act === 1) obj = `Absorbe et explore · fragments ${p.frags}/3 · niveau ${p.level}/3`;
      else if (p.act === 2) obj = `Capture des relais (${S.relays.filter((r) => r.owner === v.seat).length}/6), chasse · niveau ${p.level}/6`;
      else obj = S.cores[v.seat] ? `Accumule l'énergie Zénith : relais (${S.relays.filter((r) => r.owner === v.seat).length}/6), noyau, combats` : `Pose ton noyau de territoire [${v.hints.build}]`;
      if (o.textContent !== obj) o.textContent = obj;
      // mutations actives
      const ms = p.muts.map((m) => VIS_ICON[N.MUT_BY[m].vis] || "•").join("") + (p.spec ? " " + SPEC_ICON[p.spec] : "");
      const mEl = v.q(".nx-muts");
      if (mEl.dataset.v !== ms) {
        mEl.dataset.v = ms;
        mEl.innerHTML = p.muts.map((m) => `<i title="${esc(N.MUT_BY[m].name)}">${VIS_ICON[N.MUT_BY[m].vis] || "•"}</i>`).join("") + (p.spec ? `<i class="spec" title="${esc(N.MUT_BY[p.spec].name)}">${SPEC_ICON[p.spec]}</i>` : "");
      }
      this.updateCds(v, p);
      this.updateChoice(v, p);
      this.updateRival(v);
      this.drawMini(v);
      if (this.touchOn) {
        v.q(".tb.wave").hidden = p.act < 2;
        v.q(".tb.build").hidden = p.act < 3 || !!S.cores[v.seat] || p.inDuel;
      }
    }
    // nombres flottants
    if (this.floats)
      for (let i = this.floats.length - 1; i >= 0; i--) {
        const f = this.floats[i];
        f.t -= dt;
        if (f.t <= 0) {
          f.el.remove();
          this.floats.splice(i, 1);
          continue;
        }
        const pv = (this.pv ||= new THREE.Vector3()).set(f.x, (f.z > 5000 ? 0 : heightAt(f.x, f.z)) + 40 + (0.9 - f.t) * 60, f.z).project(f.v.cam);
        const vis = pv.z < 1 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1;
        f.el.style.display = vis ? "" : "none";
        if (vis) {
          f.el.style.transform = `translate(${((pv.x + 1) / 2) * f.v.rect.w}px,${((1 - pv.y) / 2) * f.v.rect.h}px) translate(-50%,-50%)`;
          f.el.style.opacity = Math.min(1, f.t * 2);
        }
      }
    if (S.over && !this.endShown) {
      this.endShown = true;
      setTimeout(() => this.showEnd(), 1400);
    }
  }
  updateCds(v, p) {
    const box = v.q(".nx-cds");
    const ab = N.abilityOf(p);
    const items = [
      ["atk", "⚔", "Attaque", 0.45, p.cd.atk],
      ["dash", "💨", "Dash", 2.2 * p.st.dashCd, p.cd.dash],
      ["abil", "✦", N.ABIL_NAME[p.spec || "none"], ab.cd, p.cd.abil],
      ["wave", "◎", "Onde", N.WAVE.cd, p.cd.wave, p.act < 2],
      ["build", "⬢", "Noyau", 1, 0, p.act < 3 || !!this.S.cores[v.seat] || p.inDuel],
    ];
    if (!v.cdBuilt || box.dataset.spec !== String(p.spec)) {
      box.dataset.spec = String(p.spec);
      v.cdBuilt = true;
      box.innerHTML = items.map(([k, ic, name]) => `<div class="cd" data-c="${k}"><i>${ic}</i><b>${esc(name)}</b>${this.touchOn ? "" : `<kbd>${esc(v.hints[k])}</kbd>`}<u></u></div>`).join("");
      v.cdEls = Object.fromEntries([...box.children].map((e) => [e.dataset.c, e]));
    }
    for (const [k, , , max, cur, hide] of items) {
      const e = v.cdEls[k];
      e.hidden = !!hide;
      e.lastElementChild.style.height = clamp((cur / max) * 100, 0, 100) + "%";
      const cost = { dash: 12, abil: ab.en, wave: N.WAVE.en }[k] || 0;
      e.classList.toggle("low", p.en < cost);
      const tb = this.touchOn && v.q(".tb." + k);
      if (tb) {
        tb.style.setProperty("--cd", clamp((cur / max) * 100, 0, 100) + "%");
        tb.classList.toggle("low", p.en < cost);
      }
    }
  }
  updateChoice(v, p) {
    const box = v.q(".nx-choice");
    const ch = N.currentChoices(p);
    const key = ch ? (p.specPick ? "spec" : "") + ch.join() : "";
    if (box.dataset.key === key && !p._picking === !box.dataset.pk) return;
    box.dataset.key = key;
    box.dataset.pk = p._picking ? 1 : "";
    if (!ch || p._picking) return (box.hidden = true);
    const s = this.mode === "local" ? v.seat : 0;
    box.hidden = false;
    const title = p.specPick ? "Acte III — choisis ta spécialisation" : p.muts.length ? `Mutation (niveau ${p.level - p.picks.length + 1})` : "Première orientation de ta lignée";
    box.innerHTML = `<h4>${title}${this.mode === "bot" ? " · le monde attend" : ""}</h4><div class="cards">${ch
      .map((id, i) => {
        const m = N.MUT_BY[id];
        const ic = p.specPick ? SPEC_ICON[id] : VIS_ICON[m.vis] || "•";
        const kb = this.touchOn ? "" : `<kbd>${esc(this.keyLabel(this.keys[s]["c" + (i + 1)]))}</kbd>`;
        return `<button data-i="${i}"><span class="ic">${ic}</span><b>${esc(m.name)}</b><span class="plus">＋ ${esc(m.plus)}</span><span class="minus">− ${esc(m.minus)}</span><em>${esc(m.style)}</em>${kb}</button>`;
      })
      .join("")}</div>`;
    box.onclick = (e) => {
      const b = e.target.closest("button[data-i]");
      if (b) this.choose(v.seat, +b.dataset.i);
    };
  }
  updateRival(v) {
    const S = this.S,
      el = v.q(".nx-rival");
    const sig = N.rivalSignal(S, v.seat);
    if (!sig || (!sig.exact && !sig.active)) {
      el.classList.remove("on", "exact");
      return;
    }
    el.classList.add("on");
    el.classList.toggle("exact", !!sig.exact);
    const rel = sig.ang - v.yaw;
    el.firstElementChild.style.transform = `rotate(${-rel * (180 / Math.PI) - 90}deg)`;
    el.lastElementChild.textContent = sig.exact ? `Rival · ${Math.round(sig.dist)} u` : `Signal du rival · ~${Math.round(sig.dist / 100) * 100} u`;
    el.style.opacity = sig.exact ? 1 : 0.4 + 0.6 * (1 - sig.ph);
    el.style.filter = sig.exact ? "" : `blur(${Math.min(3, sig.noise * 2)}px)`;
  }
  renderMiniBase() {
    const c = document.createElement("canvas");
    c.width = c.height = 100;
    const g = c.getContext("2d"),
      img = g.createImageData(100, 100);
    const col = new THREE.Color();
    for (let y = 0; y < 100; y++)
      for (let x = 0; x < 100; x++) {
        const wx = (x / 100) * 5000 - 2500 + 25,
          wz = (y / 100) * 5000 - 2500 + 25;
        col.setHex(N.BIOMES[N.biomeAt(this.S.W, wx, wz)].accent).multiplyScalar(0.35);
        const i = (y * 100 + x) * 4;
        img.data.set([col.r * 255, col.g * 255, col.b * 255, 255], i);
      }
    g.putImageData(img, 0, 0);
    for (const o of this.S.W.obstacles) {
      g.fillStyle = "rgba(0,0,0,.45)";
      g.beginPath();
      g.arc(((o.x + 2500) / 5000) * 100, ((o.z + 2500) / 5000) * 100, Math.max(0.6, (o.r / 5000) * 100), 0, 7);
      g.fill();
    }
    return c;
  }
  drawMini(v) {
    const S = this.S,
      p = S.players[v.seat],
      c = v.mini;
    const size = v.big ? Math.min(v.rect.w, v.rect.h) * 0.8 : this.H < 650 || this.W < 560 || this.views.length > 1 ? 110 : 150;
    if (c.width !== Math.round(size)) {
      c.width = c.height = Math.round(size);
      c.classList.toggle("big", v.big);
    }
    const g = c.getContext("2d"),
      W = c.width;
    v.miniT = (v.miniT || 0) + 1;
    if (!v.big && v.miniT % 3) return;
    // brouillard de guerre
    const ex = this.explored[v.seat];
    if (!p.inDuel) {
      const R = Math.ceil(p.st.vision / 100);
      const cx = Math.floor((p.x + 2500) / 100),
        cz = Math.floor((p.z + 2500) / 100);
      for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) if (i * i + j * j <= R * R && cx + i >= 0 && cx + i < 50 && cz + j >= 0 && cz + j < 50) ex[(cz + j) * 50 + cx + i] = 1;
    }
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath();
    g.arc(W / 2, W / 2, W / 2, 0, 7);
    g.clip();
    g.fillStyle = "#03060f";
    g.fillRect(0, 0, W, W);
    const tm = (x, z) => [((x + 2500) / 5000) * W, ((z + 2500) / 5000) * W];
    const me = this.views.find((w) => w.seat === v.seat);
    // carte orientée comme la caméra
    g.translate(W / 2, W / 2);
    g.rotate(me.yaw + Math.PI);
    g.translate(-W / 2, -W / 2);
    if (p.inDuel) {
      const k = W / (N.ARENA.r * 2.4),
        ax = (x) => W / 2 + (x - N.ARENA.x) * k,
        az = (z) => W / 2 + (z - N.ARENA.z) * k;
      g.fillStyle = "#1a1206";
      g.beginPath();
      g.arc(W / 2, W / 2, N.ARENA.r * k, 0, 7);
      g.fill();
      for (const b of S.beacons) {
        g.fillStyle = b.owner >= 0 ? COL[b.owner].css : "#ffd36b";
        g.beginPath();
        g.arc(ax(b.x), az(b.z), 5, 0, 7);
        g.fill();
      }
      for (const q of S.players) {
        if (q.dead) continue;
        g.fillStyle = COL[q.seat].css;
        g.beginPath();
        g.arc(ax(q.x), az(q.z), 4, 0, 7);
        g.fill();
      }
    } else {
      g.imageSmoothingEnabled = true;
      g.drawImage(this.minimapBase, 0, 0, W, W);
      g.fillStyle = "rgba(2,4,12,.82)";
      const cs = W / 50;
      for (let j = 0; j < 50; j++) for (let i = 0; i < 50; i++) if (!ex[j * 50 + i]) g.fillRect(i * cs - 0.5, j * cs - 0.5, cs + 1, cs + 1);
      for (const r of S.relays) {
        const [x, y] = tm(r.x, r.z);
        g.fillStyle = r.owner >= 0 ? COL[r.owner].css : "#c8d0e8";
        g.fillRect(x - 3, y - 3, 6, 6);
      }
      g.font = `bold ${Math.max(9, W / 16)}px system-ui`;
      g.textAlign = "center";
      for (const f of S.frags) {
        if (!f.poi || f.got[v.seat] || Math.hypot(f.x - p.x, f.z - p.z) > 1400) continue;
        const [x, y] = tm(f.x, f.z);
        g.fillStyle = "#8ff6ff";
        g.fillText("?", x, y + 4);
      }
      const core = S.cores[v.seat];
      if (core) {
        const [x, y] = tm(core.x, core.z);
        g.strokeStyle = COL[v.seat].css;
        g.lineWidth = 2;
        g.strokeRect(x - 4, y - 4, 8, 8);
      }
      const sig = N.rivalSignal(S, v.seat);
      const [px, py] = tm(p.x, p.z);
      if (sig?.exact) {
        const [x, y] = tm(sig.x, sig.z);
        g.fillStyle = COL[1 - v.seat].css;
        g.beginPath();
        g.arc(x, y, 4, 0, 7);
        g.fill();
      } else if (sig?.active) {
        const a = Math.PI / 2 - sig.ang;
        g.fillStyle = `rgba(255,120,60,${0.35 * (1 - sig.ph)})`;
        g.beginPath();
        g.moveTo(px, py);
        g.arc(px, py, W, a - sig.noise, a + sig.noise);
        g.fill();
      }
      g.fillStyle = COL[v.seat].css;
      g.beginPath();
      g.arc(px, py, 3.5, 0, 7);
      g.fill();
      g.strokeStyle = "#fff";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + Math.sin(p.ang) * 9, py + Math.cos(p.ang) * 9);
      g.stroke();
      if (this.mode === "local") {
        const o = S.players[1 - v.seat];
        if (sig?.exact && !o.dead) void 0;
      }
    }
    g.restore();
  }

  showEnd() {
    const S = this.S,
      O = S.over;
    if (!O) return;
    const meSeat = this.views[0].seat;
    const solo = this.views.length === 1;
    const win = O.winner === meSeat;
    const title = O.winner < 0 ? "Égalité" : solo ? (win ? "Victoire : ta lignée devient gardienne d'Auralis" : "Défaite") : `${S.players[O.winner].name} l'emporte`;
    this.sound.play(O.winner < 0 || win || !solo ? "win" : "lose");
    const col = (p) => `<td style="color:${COL[p.seat].css}"><b>${esc(p.name)}</b><br>
      <span class="nx-form">${p.muts.map((m) => VIS_ICON[N.MUT_BY[m].vis]).join("")} ${p.spec ? SPEC_ICON[p.spec] + " " + N.MUT_BY[p.spec].name : ""}</span><br>
      <small>${p.muts.map((m) => N.MUT_BY[m].name).join(", ") || "—"}</small></td>`;
    const row = (label, f) => `<tr><th>${label}</th>${S.players.map((p) => `<td>${f(p)}</td>`).join("")}</tr>`;
    const p = this.panel(`<h2 class="${win || !solo ? "nx-win" : "nx-lose"}">${esc(title)}</h2><p class="nx-muted">${esc(O.reason)} · durée ${fmtT(O.t)}</p>
      <div class="nx-scroll"><table class="nx-stats"><tr><th>Forme finale</th>${S.players.map(col).join("")}</tr>
      ${row("Niveau", (q) => q.level)}${row("Ressources", (q) => q.stat.res)}${row("Dégâts infligés", (q) => Math.round(q.stat.dmg))}${row("Zones capturées", (q) => q.stat.zones)}${row("Éliminations / chutes", (q) => `${q.stat.kills} / ${q.stat.deaths}`)}${row("Fragments de mémoire", (q) => `${q.story.length}/${N.STORY.length}`)}</table></div>
      <div class="nx-row"><button class="nx-big" data-again>↻ Revanche</button><button data-menu>Retour au menu</button></div>`);
    p.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-again")) this.rematch();
      else if (b.hasAttribute("data-menu")) this.ctx.quit();
    };
  }
  rematch() {
    if (this.mode === "online" && !this.isHost) {
      this.ctx.send("rematch", {});
      this.panel(`<h2>Revanche demandée</h2><p class="nx-muted">En attente de l'hôte…</p>`);
      return;
    }
    this.newGame((Math.random() * 1e9) >>> 0);
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    clearInterval(this.bg);
    for (const f of this.off) f();
    this.ro?.disconnect();
    this.sound.destroy();
    this.scene?.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.());
    });
    this.composer?.dispose?.();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    this.ctx.root.classList.remove("nx-root", "nx-compact");
    this.ctx.root.innerHTML = "";
    if (window.__nexus === this) delete window.__nexus;
  }
}

/* ============ STYLES ============ */
const CSS = `
.nx-root{background:#04131d;color:#eef6ff;font:14px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden;touch-action:none}
.nx-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
.nx-views{position:absolute;inset:0;pointer-events:none}
.nx-view{position:absolute;overflow:hidden}
.nx-view.split{outline:1px solid rgba(255,255,255,.12)}
.nx-hud{position:absolute;left:max(12px,env(safe-area-inset-left));top:max(10px,env(safe-area-inset-top));width:min(300px,46%);display:grid;gap:4px;text-shadow:0 1px 3px #000}
.nx-id{display:flex;gap:8px;align-items:baseline}.nx-id b{color:var(--c);font-size:15px}.nx-id span{opacity:.8;font-size:12px}
.nx-bar{position:relative;height:15px;background:rgba(5,10,25,.7);border:1px solid rgba(255,255,255,.15);border-radius:8px;overflow:hidden}
.nx-bar u{position:absolute;inset:0 auto 0 0;transition:width .15s;border-radius:8px}
.nx-bar span{position:relative;font-size:10.5px;padding-left:7px;line-height:14px;font-weight:600}
.nx-bar.hp u{background:linear-gradient(90deg,#ff2b6b,#ff7aa0)}.nx-bar.en u{background:linear-gradient(90deg,#0aa5ff,#7af2ff)}
.nx-bar.zen u{background:linear-gradient(90deg,#ff9d00,#ffe28a)}.nx-bar.zen.off{opacity:.45}.nx-bar.zen.hot{box-shadow:0 0 12px #ffc04a}
.nx-bar.xp{height:5px}.nx-bar.xp u{background:#c6a8ff}
.nx-obj{font-size:12.5px;background:rgba(5,10,25,.55);padding:4px 8px;border-radius:8px;border-left:3px solid #ffd36b}
.nx-muts{display:flex;flex-wrap:wrap;gap:2px;font-size:15px}.nx-muts i{font-style:normal}.nx-muts .spec{margin-left:6px;filter:drop-shadow(0 0 4px #ffd36b)}
.nx-mini{position:absolute;right:max(12px,env(safe-area-inset-right));top:max(56px,calc(env(safe-area-inset-top) + 50px));border-radius:50%;border:2px solid rgba(255,255,255,.25);box-shadow:0 0 18px rgba(0,0,0,.6);pointer-events:auto;cursor:pointer;background:#000}
.nx-mini.big{right:50%;top:50%;transform:translate(50%,-50%);z-index:3}
.nx-rival{position:absolute;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);display:flex;align-items:center;gap:6px;background:rgba(40,10,5,.55);padding:3px 10px 3px 6px;border-radius:20px;opacity:0;transition:opacity .3s;font-size:12px;color:#ffb38a}
.nx-rival.on{opacity:1}.nx-rival.exact{background:rgba(120,20,10,.7);color:#fff}
.nx-rival i{font-style:normal;display:inline-block;font-size:16px;color:#ff7a2a}
.nx-cds{position:absolute;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:6px}
.nx-cds .cd{position:relative;width:58px;height:58px;border-radius:14px;background:rgba(5,10,25,.7);border:1px solid rgba(255,255,255,.18);display:grid;place-items:center;overflow:hidden;text-align:center}
.nx-cds .cd i{font-style:normal;font-size:18px;margin-top:-8px}.nx-cds .cd b{position:absolute;bottom:13px;font-size:8.5px;font-weight:600;width:100%;opacity:.85;white-space:nowrap;overflow:hidden}
.nx-cds .cd kbd{position:absolute;bottom:2px;font:600 9px system-ui;background:rgba(255,255,255,.15);padding:0 4px;border-radius:4px}
.nx-cds .cd u{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.65)}.nx-cds .cd.low{border-color:#ff2b6b}
.nx-choice{position:absolute;left:50%;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 70px);transform:translateX(-50%);width:min(820px,96%);pointer-events:auto;text-align:center}
.nx-choice h4{margin:0 0 6px;font-size:13px;color:#ffd36b;text-shadow:0 1px 4px #000}
.nx-choice .cards{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.nx-choice button{flex:1 1 140px;max-width:200px;min-height:56px;background:linear-gradient(160deg,rgba(25,40,80,.92),rgba(10,15,35,.92));border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:8px;color:#fff;display:grid;gap:3px;text-align:left;position:relative;animation:nxIn .25s both}
.nx-choice button:hover{border-color:#ffd36b;transform:translateY(-2px)}
.nx-choice .ic{font-size:20px}.nx-choice b{font-size:13px}.nx-choice .plus{color:#7dffb0;font-size:11.5px}.nx-choice .minus{color:#ff8aa5;font-size:11.5px}.nx-choice em{color:#9fb4ff;font-size:11px}
.nx-choice kbd{position:absolute;top:6px;right:8px;font:700 11px system-ui;background:#ffd36b;color:#000;border-radius:5px;padding:1px 6px}
.nx-story{position:absolute;left:50%;top:22%;transform:translateX(-50%);width:min(520px,90%);background:rgba(4,20,30,.8);border:1px solid #8ff6ff;color:#cffcff;border-radius:14px;padding:12px 16px;font-style:italic;text-align:center;box-shadow:0 0 30px rgba(143,246,255,.25);animation:nxIn .4s both}
.nx-floats{position:absolute;inset:0}.nx-floats span{position:absolute;left:0;top:0;font:800 15px system-ui;text-shadow:0 1px 3px #000;white-space:nowrap}
.nx-top{position:absolute;right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top));display:flex;gap:6px;z-index:4}
.nx-top button,.nx-tsmall button{width:40px;height:40px;border-radius:12px;background:rgba(5,10,25,.65);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:16px;display:grid;place-items:center;padding:0}
.nx-center{position:absolute;inset:0;pointer-events:none;z-index:5}
.nx-banner{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);text-align:center;animation:nxBan 4s both;white-space:nowrap}
.nx-banner b{display:block;font:900 clamp(24px,5vw,52px)/1.1 system-ui;letter-spacing:.04em;background:linear-gradient(90deg,#8ff6ff,#fff,#ffd36b);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 18px rgba(143,246,255,.5))}
.nx-banner small{font-size:clamp(12px,2vw,17px);color:#e8f4ff;text-shadow:0 1px 4px #000;white-space:normal}
.nx-msg{position:absolute;left:50%;top:45%;transform:translateX(-50%);background:rgba(5,10,25,.85);padding:12px 18px;border-radius:12px;z-index:6}
.nx-panel{position:absolute;inset:0;z-index:8;display:grid;place-items:center;background:rgba(2,5,15,.62);backdrop-filter:blur(5px);padding:12px;overflow:auto}
.nx-card{width:min(640px,100%);max-height:calc(100% - 10px);overflow:auto;background:linear-gradient(170deg,#101a3c,#080d22);border:1px solid rgba(143,246,255,.25);border-radius:20px;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.6);display:grid;gap:10px;animation:nxIn .25s both}
.nx-card h2{margin:0}.nx-card h3{margin:6px 0 0;font-size:15px}.nx-card p{margin:0}
.nx-logo{font:900 44px/1 system-ui;letter-spacing:.12em;background:linear-gradient(90deg,#22e6ff,#fff 45%,#ffd36b 60%,#ff2bd6);-webkit-background-clip:text;background-clip:text;color:transparent;text-align:center}
.nx-logo small{display:block;font-size:15px;letter-spacing:.5em;-webkit-text-fill-color:#ffd36b;margin-top:4px}
.nx-muted{color:#9aa6d6;font-size:13px}
.nx-card button{min-height:44px;background:#1d2a5c;border:1px solid rgba(255,255,255,.18);border-radius:12px;color:#fff;padding:8px 12px}
.nx-card button:hover{border-color:#ffd36b}
.nx-big{background:linear-gradient(90deg,#0aa5ff,#22e6ff)!important;color:#001!important;font-weight:800;font-size:16px}
.nx-row{display:flex;gap:8px;flex-wrap:wrap}.nx-row button{flex:1}.nx-col{display:grid;gap:8px}
.nx-seg{display:flex;gap:6px;flex-wrap:wrap}.nx-seg button{flex:1;display:grid;gap:2px;text-align:left}.nx-seg button small{color:#9aa6d6;font-size:11.5px}
.nx-seg button.on{border-color:#ffd36b;background:#2b3a7a;box-shadow:0 0 0 1px #ffd36b inset}
.nx-seg.sm button{min-height:36px;text-align:center;padding:4px 8px;font-size:13px}
.nx-opts{display:grid;grid-template-columns:minmax(120px,auto) 1fr;gap:8px 12px;align-items:center}.nx-opts label{font-size:13px;color:#c8d0f0}
.nx-opts input[type=range]{width:100%}
.nx-scroll{overflow:auto;max-height:42vh}
.nx-keys{width:100%;border-collapse:collapse;font-size:13px}.nx-keys td,.nx-keys th{padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}
.nx-keys kbd,.nx-guide kbd{background:#2b3a7a;border-radius:5px;padding:1px 6px;font:600 12px system-ui;margin-right:2px}
.nx-key{min-height:32px!important;min-width:84px;padding:2px 8px!important;font-weight:700}.nx-key.wait{background:#ffd36b!important;color:#000!important}
.nx-guide{margin:0;padding-left:20px;display:grid;gap:4px}
.nx-stats{width:100%;border-collapse:collapse;font-size:13px}.nx-stats th{text-align:left;color:#9aa6d6;font-weight:500;padding:4px}.nx-stats td{padding:4px;vertical-align:top}
.nx-form{font-size:20px}.nx-win{color:#ffd36b}.nx-lose{color:#ff8aa5}
.nx-touch{position:absolute;inset:0;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none}
.nx-joyzone{position:absolute;left:0;bottom:0;width:48%;height:72%}
.nx-camzone{position:absolute;right:0;top:15%;width:52%;height:85%}
.nx-joy{position:absolute;width:124px;height:124px;margin:-62px 0 0 -62px;border-radius:50%;border:2px solid rgba(143,246,255,.45);background:radial-gradient(rgba(143,246,255,.12),rgba(143,246,255,.03));pointer-events:none}
.nx-joy i{position:absolute;left:50%;top:50%;width:54px;height:54px;border-radius:50%;background:rgba(143,246,255,.55);box-shadow:0 0 18px #22e6ff;transform:translate(-50%,-50%)}
.tb{position:absolute;border-radius:50%;background:rgba(10,20,45,.6);border:2px solid rgba(255,255,255,.3);color:#fff;font-size:22px;display:grid;place-items:center;padding:0;touch-action:none}
.tb.on{background:rgba(143,246,255,.4);transform:scale(.94)}
.tb.atk{width:84px;height:84px;right:calc(max(18px,env(safe-area-inset-right)) + 0px);bottom:calc(max(22px,env(safe-area-inset-bottom)) + 10px);font-size:30px;border-color:#ff7aa0}
.tb.dash{width:60px;height:60px;right:calc(max(18px,env(safe-area-inset-right)) + 96px);bottom:calc(max(22px,env(safe-area-inset-bottom)) + 4px)}
.tb.abil{width:60px;height:60px;right:calc(max(18px,env(safe-area-inset-right)) + 10px);bottom:calc(max(22px,env(safe-area-inset-bottom)) + 104px);border-color:#ffd36b}
.tb.wave{width:56px;height:56px;right:calc(max(18px,env(safe-area-inset-right)) + 84px);bottom:calc(max(22px,env(safe-area-inset-bottom)) + 76px)}
.tb.build{width:56px;height:56px;right:calc(max(18px,env(safe-area-inset-right)) + 150px);bottom:calc(max(22px,env(safe-area-inset-bottom)) + 40px)}
.nx-tsmall{position:absolute;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));display:flex;gap:6px}
.nx-root:has(.nx-touch) .nx-cds{display:none}
.tb::after{content:"";position:absolute;inset:0;border-radius:50%;background:conic-gradient(rgba(0,0,0,.6) var(--cd,0%),transparent 0);pointer-events:none}
.tb.low{border-color:#ff2b6b;opacity:.75}
.nx-root:has(.nx-touch) .nx-choice{bottom:auto;top:24%}
@media (max-width:560px){.nx-choice .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:5px}.nx-choice button{max-width:none;padding:6px 7px;gap:1px;min-height:48px}
.nx-choice b{font-size:11.5px}.nx-choice .plus,.nx-choice .minus{font-size:10px}.nx-choice em{display:none}.nx-choice .ic{font-size:16px}.nx-choice h4{font-size:11.5px}}
.nx-compact .nx-hud{width:min(230px,44%);gap:3px}.nx-compact .nx-bar{height:13px}.nx-compact .nx-bar span{font-size:9.5px;line-height:11px}
.nx-compact .nx-obj{font-size:11px}.nx-compact .nx-muts{display:none}
.nx-compact .nx-cds .cd{width:48px;height:48px}.nx-compact .nx-choice button{min-height:56px;padding:6px;flex-basis:120px}.nx-compact .nx-choice em{display:none}
.nx-compact .tb.atk{width:76px;height:76px}.nx-compact .tb.dash,.nx-compact .tb.abil{width:56px;height:56px}
.nx-compact .nx-joy{width:104px;height:104px;margin:-52px 0 0 -52px}
.nx-view.split .nx-hud{width:min(250px,60%)}.nx-view.split .nx-choice{width:98%}.nx-view.split .nx-choice button{flex-basis:110px}
.nx-view.split .tb.build,.nx-view.split .tb.wave{display:none}
@media (orientation:portrait) and (pointer:coarse){.nx-choice .cards{flex-wrap:wrap}.nx-choice button{flex-basis:30%}}
@keyframes nxIn{from{opacity:0;transform:translateY(8px)}}
.nx-choice button{animation-name:nxIn}
@keyframes nxBan{0%{opacity:0;transform:translate(-50%,-40%) scale(.9)}12%{opacity:1;transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0}}
`;
