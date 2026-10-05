// Stockage local des planètes et du profil (sur l'appareil, sans compte). L'âge est déclaré : une vérification viendra plus tard.
import { store } from "./worlds/common.js";
import { sanitizePlanet, bandOf } from "./policy.js";
import { THEME_IDS } from "./catalog.js";
import { isKnownModule } from "./modules.js";

export const MAX_PLANETS = 12;
const st = store("atelier");
const pr = store("profile");

export const loadPlanets = () => st.get("list", []).map((p) => sanitizePlanet(p, isKnownModule, THEME_IDS)).filter(Boolean);
export const savePlanets = (list) => st.set("list", list.slice(0, MAX_PLANETS));
export function upsertPlanet(p) {
  const list = loadPlanets();
  const i = list.findIndex((x) => x.id === p.id);
  if (i >= 0) list[i] = p;
  else if (list.length < MAX_PLANETS) list.push(p);
  else return false;
  savePlanets(list);
  return true;
}
export const deletePlanet = (id) => savePlanets(loadPlanets().filter((p) => p.id !== id));

export const profile = {
  get band() {
    return bandOf(pr.get("band", 5));
  },
  set band(v) {
    pr.set("band", bandOf(v));
  },
  get onboarded() {
    return pr.get("onboarded", false) === true;
  },
  set onboarded(v) {
    pr.set("onboarded", !!v);
  },
  get welcomeSeen() {
    return pr.get("welcomeSeen", false) === true;
  },
  set welcomeSeen(v) {
    pr.set("welcomeSeen", !!v);
  },
  get ageVerified() {
    return pr.get("ageVerified", false) === true; // toujours faux pour l'instant : vérification prévue plus tard
  },
};
