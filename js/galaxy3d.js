// Vue 3D de la galaxie : le même esprit que Solun'IA (soleil à rayons, planètes à anneau et icône, étoiles, liens lumineux).
import * as THREE from "three";
import ForceGraph3D from "3d-force-graph";
import SpriteText from "three-spritetext";

export const KIND_COLOR = {
  sun: "#ffcf4a", folder: "#7aa2ff", link: "#38bdf8", note: "#fbbf24", game: "#f472b6",
  pdf: "#ef4444", image: "#34d399", audio: "#a78bfa", video: "#fb923c", text: "#94a3b8", file: "#cbd5e1",
};
export const KIND_ICON = { sun: "☀", folder: "📁", link: "🔗", note: "📝", game: "🎮", pdf: "📕", image: "🖼", audio: "🎵", video: "🎬", text: "📄", file: "📄" };

/** Famille d'un élément (pour la couleur et l'icône). */
export function family(it) {
  if (it.kind !== "file") return it.kind;
  const m = it.mime || "";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("text/")) return "text";
  return "file";
}

const texCache = new Map();
function nodeTexture(fam, color) {
  const key = fam + color;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (fam === "sun") {
    const corona = ctx.createRadialGradient(64, 64, 18, 64, 64, 64);
    corona.addColorStop(0, "rgba(255,244,200,0.95)");
    corona.addColorStop(0.45, color + "88");
    corona.addColorStop(1, color + "00");
    ctx.fillStyle = corona;
    ctx.fillRect(0, 0, 128, 128);
    ctx.save();
    ctx.translate(64, 64);
    ctx.strokeStyle = "rgba(255,230,160,0.35)";
    for (let i = 0; i < 24; i++) {
      ctx.rotate((Math.PI * 2) / 24);
      ctx.lineWidth = i % 2 ? 1 : 2;
      ctx.beginPath();
      ctx.moveTo(30, 0);
      ctx.lineTo(i % 2 ? 50 : 60, 0);
      ctx.stroke();
    }
    ctx.restore();
    const disc = ctx.createRadialGradient(58, 58, 4, 64, 64, 30);
    disc.addColorStop(0, "#fffbe8");
    disc.addColorStop(0.6, "#f7dc8a");
    disc.addColorStop(1, color);
    ctx.beginPath();
    ctx.arc(64, 64, 28, 0, Math.PI * 2);
    ctx.fillStyle = disc;
    ctx.fill();
  } else {
    const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, color + "ff");
    g.addColorStop(0.35, color + "66");
    g.addColorStop(1, color + "00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.beginPath();
    ctx.arc(64, 64, 32, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(8,10,28,0.88)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = "34px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(KIND_ICON[fam] || "📄", 64, 66);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

function glowTexture(inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, outer);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGalaxyView(el, { onSelect }) {
  const touch = matchMedia("(pointer: coarse)").matches;
  const graph = ForceGraph3D({ controlType: "orbit", rendererConfig: { antialias: !touch, alpha: false, powerPreference: "high-performance" } })(el)
    .backgroundColor("#04061a")
    .showNavInfo(false)
    .nodeLabel((n) => n.label)
    .linkColor((l) => (l.hot ? "#fff3b0" : "#9fb4ff"))
    .linkOpacity(0.28)
    .linkWidth((l) => (l.hot ? 1.8 : 0.4))
    .linkDirectionalParticles((l) => (l.hot ? 4 : 0))
    .linkDirectionalParticleWidth(2.6)
    .linkDirectionalParticleSpeed(0.012)
    .d3VelocityDecay(0.32)
    .warmupTicks(30)
    .cooldownTime(9000)
    .enableNodeDrag(!touch);
  const renderer = graph.renderer();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 2));
  const scene = graph.scene();

  // étoiles (3 couches) + lueur du soleil
  const stars = new THREE.Group();
  for (const [n, size, op, r] of [[2600, 1.4, 0.9, 1700], [900, 2.4, 0.8, 1500], [200, 4, 0.6, 1300]]) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const rr = r * (0.55 + Math.random() * 0.45);
      pos.set([rr * s * Math.cos(t), rr * u, rr * s * Math.sin(t)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    stars.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe0ff, size, transparent: true, opacity: op, sizeAttenuation: false, depthWrite: false })));
  }
  scene.add(stars);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(255,244,200,0.9)", "rgba(255,190,90,0.35)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(120, 120, 1);
  scene.add(glow);

  const cache = new Map(); // id -> nœud (garde les positions quand les données changent)
  const objs = new Map();
  let selected = null;
  let sunColor = "#ffcf4a";
  let idle = true;
  let idleTimer = 0;

  function makeObject(n) {
    const fam = n.fam;
    const color = n.id === "sun" ? sunColor : KIND_COLOR[fam] || "#cbd5e1";
    const mat = new THREE.SpriteMaterial({ map: nodeTexture(fam, color), transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    const base = n.id === "sun" ? 34 : n.kind === "folder" ? 14 + Math.min(14, n.weight * 1.2) : 11;
    sprite.scale.set(base, base, 1);
    const group = new THREE.Group();
    group.add(sprite);
    if (n.id === "sun" || n.kind === "folder" || n.alwaysLabel) {
      const t = new SpriteText(n.label, n.id === "sun" ? 6 : 3.4, "#ffffff");
      t.material.depthWrite = false;
      t.backgroundColor = "rgba(4,6,26,0.55)";
      t.padding = 1.2;
      t.borderRadius = 2;
      t.position.set(0, -(base / 2 + 4), 0);
      group.add(t);
    }
    return { group, sprite, mat, base };
  }

  graph.nodeThreeObject((n) => {
    let o = objs.get(n.id);
    if (!o || o.key !== n.key) {
      o = makeObject(n);
      o.key = n.key;
      objs.set(n.id, o);
    }
    const s = o.base * (n.id === selected ? 1.35 : 1);
    o.sprite.scale.set(s, s, 1);
    o.mat.opacity = n.dim ? 0.25 : 1;
    return o.group;
  });
  graph.onNodeClick((n) => {
    pause();
    onSelect(n.id === "sun" ? null : n.id);
  });
  graph.onBackgroundClick(() => {
    pause();
    onSelect(null);
  });

  function pause() {
    idle = false;
    graph.controls().autoRotate = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idle = true;
      if (!selected) graph.controls().autoRotate = true;
    }, 12000);
  }
  graph.controls().autoRotate = true;
  graph.controls().autoRotateSpeed = 0.35;
  graph.controls().addEventListener("start", pause);

  function resize() {
    const r = el.getBoundingClientRect();
    graph.width(Math.max(120, r.width)).height(Math.max(120, r.height));
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  graph.cameraPosition({ x: 0, y: 40, z: 230 });

  return {
    /** nodes : [{id,label,kind,fam,weight,dim,key}], links : [{source,target}] */
    setData(nodes, links, color) {
      sunColor = color || sunColor;
      const out = nodes.map((n) => {
        let c = cache.get(n.id);
        if (!c) {
          c = { id: n.id };
          cache.set(n.id, c);
        }
        Object.assign(c, n);
        if (n.id === "sun") Object.assign(c, { fx: 0, fy: 0, fz: 0 });
        return c;
      });
      const ids = new Set(out.map((n) => n.id));
      for (const id of [...cache.keys()]) if (!ids.has(id)) cache.delete(id);
      for (const id of [...objs.keys()]) if (!ids.has(id)) objs.delete(id);
      graph.graphData({ nodes: out, links: links.map((l) => ({ source: l.source, target: l.target, hot: selected && (l.source === selected || l.target === selected) })) });
      graph.d3ReheatSimulation?.();
    },
    select(id) {
      selected = id;
      graph.controls().autoRotate = !id && idle;
      graph.nodeThreeObject(graph.nodeThreeObject());
      graph.linkColor(graph.linkColor());
    },
    focus(id) {
      const n = cache.get(id);
      if (!n || n.x === undefined) return;
      const d = 90;
      const r = 1 + d / Math.hypot(n.x, n.y, n.z || 1);
      graph.cameraPosition({ x: n.x * r, y: n.y * r, z: (n.z || 0) * r + 20 }, n, 900);
    },
    recenter() {
      graph.zoomToFit(700, 60);
    },
    resize,
    destroy() {
      ro.disconnect();
      graph._destructor?.();
      el.innerHTML = "";
    },
  };
}
