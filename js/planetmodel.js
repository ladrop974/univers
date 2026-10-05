// Arborescence d'une planète : dossiers, sous-dossiers et modules. Logique pure (testée).
// Nœud dossier : { id, type:"folder", name, children:[] }   Nœud module : { id, type:"module", mod:"api:itunes" }
export const MAX_NODES = 60;
export const MAX_DEPTH = 4;
const nid = () => Math.random().toString(36).slice(2, 9);
const cleanName = (s) => String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 30);

export const makeFolder = (name, children = []) => ({ id: nid(), type: "folder", name: cleanName(name) || "Dossier", children });
export const makeModule = (mod) => ({ id: nid(), type: "module", mod });

export function walk(tree, fn, depth = 1, parent = null) {
  for (const n of tree) {
    fn(n, depth, parent);
    if (n.type === "folder") walk(n.children, fn, depth + 1, n);
  }
}
export const count = (tree) => {
  let c = 0;
  walk(tree, () => c++);
  return c;
};
export const modulesOf = (tree) => {
  const out = [];
  walk(tree, (n) => n.type === "module" && out.push(n.mod));
  return out;
};
export function find(tree, id) {
  let hit = null;
  walk(tree, (n, d, p) => {
    if (n.id === id) hit = { node: n, depth: d, parent: p };
  });
  return hit;
}

/** Valide un arbre venu de l'extérieur (stockage, lien reçu). `known(modId)` dit si un module existe. */
export function sanitizeTree(raw, known, budget = { n: 0 }, depth = 1) {
  if (!Array.isArray(raw) || depth > MAX_DEPTH) return [];
  const out = [];
  for (const n of raw) {
    if (!n || typeof n !== "object" || budget.n >= MAX_NODES) continue;
    const id = typeof n.id === "string" && /^[a-z0-9]{3,12}$/.test(n.id) ? n.id : nid();
    if (n.type === "module" && typeof n.mod === "string" && known(n.mod)) {
      budget.n++;
      out.push({ id, type: "module", mod: n.mod });
    } else if (n.type === "folder") {
      budget.n++;
      out.push({ id, type: "folder", name: cleanName(n.name) || "Dossier", children: sanitizeTree(n.children, known, budget, depth + 1) });
    }
  }
  return out;
}

const clone = (t) => JSON.parse(JSON.stringify(t));

/** Ajoute un nœud sous `parentId` (null = racine). Renvoie le nouvel arbre, ou null si les limites sont dépassées. */
export function addNode(tree, parentId, node) {
  if (count(tree) + 1 + count(node.type === "folder" ? node.children : []) > MAX_NODES) return null;
  const t = clone(tree);
  if (parentId == null) {
    t.push(node);
    return t;
  }
  const hit = find(t, parentId);
  if (!hit || hit.node.type !== "folder" || hit.depth >= MAX_DEPTH) return null;
  hit.node.children.push(node);
  return t;
}
export function removeNode(tree, id) {
  const t = clone(tree);
  const hit = find(t, id);
  if (!hit) return t;
  const list = hit.parent ? hit.parent.children : t;
  list.splice(list.findIndex((n) => n.id === id), 1);
  return t;
}
export function renameNode(tree, id, name) {
  const t = clone(tree);
  const hit = find(t, id);
  if (hit && hit.node.type === "folder") hit.node.name = cleanName(name) || hit.node.name;
  return t;
}

/** Codage compact pour le lien de partage : dossier = [nom, enfants], module = "id". */
export const encodeTree = (tree) => tree.map((n) => (n.type === "module" ? n.mod : [n.name, encodeTree(n.children)]));
export const decodeTree = (raw) =>
  (Array.isArray(raw) ? raw : []).map((n) =>
    typeof n === "string" ? { id: nid(), type: "module", mod: n.includes(":") ? n : `api:${n}` } : Array.isArray(n) ? { id: nid(), type: "folder", name: n[0], children: decodeTree(n[1]) } : null,
  ).filter(Boolean);
