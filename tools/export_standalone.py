"""Exporte chaque jeu d'Univers en un fichier HTML autonome (double-clic pour jouer).

Le jeu et ses règles sont intégrés dans le fichier (modules en data:). Three.js est chargé depuis le CDN
jsdelivr comme sur le site : les jeux 3D ont donc besoin d'Internet. Modes proposés : robot et même écran
(le duel en ligne reste sur le site, il a besoin du salon).
Usage : python tools/export_standalone.py <dossier_de_sortie>
"""
import base64
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THREE = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
ADDONS = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"


def data_js(src):
    return "data:text/javascript;base64," + base64.b64encode(src.encode("utf-8")).decode()


def safe_name(n):
    return re.sub(r'\s*[<>:"/\\|?*]\s*', " - ", n).strip()


def export(game, out_dir, css):
    gid = game["id"]
    folder = os.path.join(ROOT, "games", gid)
    if os.path.exists(os.path.join(folder, "index.html")):  # déjà un fichier unique (SPORE)
        dst = os.path.join(out_dir, safe_name(game["name"]) + ".html")
        shutil.copyfile(os.path.join(folder, "index.html"), dst)
        return dst
    imports = {"three": THREE, "three/addons/": ADDONS}
    game_src = open(os.path.join(folder, "game.js"), encoding="utf-8").read()
    sim_path = os.path.join(folder, "sim.js")
    if os.path.exists(sim_path):
        imports["univers-sim"] = data_js(open(sim_path, encoding="utf-8").read())
        game_src = re.sub(r"""from\s+["']\./sim\.js["']""", 'from "univers-sim"', game_src)
    imports["univers-game"] = data_js(game_src)
    modes = [m for m in game.get("modes", []) if m in ("bot", "local")]
    buttons = "".join(
        f'<button class="sa-btn" data-mode="{m}">{"▶ Contre le robot" if m == "bot" else "⚔ Deux joueurs (même écran)"}</button>'
        for m in modes)
    title = game["name"]
    html = f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>{title}</title>
<style>{css}</style>
<style>
#sa-home{{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 30%,#1b2a55,#05070f);color:#e8f4ff;font-family:system-ui,sans-serif;padding:16px}}
.sa-card{{max-width:440px;width:100%;text-align:center;background:rgba(8,14,30,.8);border:1px solid rgba(120,200,255,.25);border-radius:18px;padding:24px}}
.sa-card h1{{font-size:28px;margin:0 0 6px}}.sa-card p{{color:#9fb3c8;font-size:14px;margin:0 0 18px}}
.sa-btn{{display:block;width:100%;margin:8px 0;padding:14px;font-size:16px;font-weight:700;border-radius:12px;border:1px solid rgba(120,200,255,.4);background:rgba(40,80,130,.6);color:#fff;cursor:pointer}}
.sa-btn:hover{{background:rgba(60,120,190,.8)}}
.sa-note{{font-size:12px;color:#7f93aa;margin-top:14px}}
</style>
<script type="importmap">{json.dumps({"imports": imports})}</script>
</head><body>
<div id="sa-home"><div class="sa-card"><h1>{game.get("emoji", "")} {title}</h1><p>{game.get("tagline", "")}</p>{buttons}
<div class="sa-note">Fichier autonome. Les graphismes 3D se chargent depuis Internet. Le duel en ligne se joue sur le site Univers.</div></div></div>
<div id="stage" hidden></div>
<script type="module">
import game from "univers-game";
const home=document.getElementById("sa-home"),stage=document.getElementById("stage");let cur=null;
function stop(){{try{{cur&&cur.destroy&&cur.destroy()}}catch(e){{console.error(e)}}cur=null;stage.innerHTML="";stage.hidden=true;home.hidden=false}}
async function start(mode){{home.hidden=true;stage.hidden=false;stage.innerHTML="";
 const ctx={{root:stage,mode,seat:0,seed:(Math.random()*1e9)>>>0,isHost:true,name:"Joueur 1",
  players:mode==="bot"?[{{seat:0,name:"Joueur 1"}},{{seat:1,name:"Ordinateur"}}]:[{{seat:0,name:"Joueur 1"}},{{seat:1,name:"Joueur 2"}}],
  send:()=>{{}},on:()=>{{}},quit:stop}};
 try{{cur=await game.start(ctx)}}catch(e){{console.error(e);alert("Ce jeu n'a pas pu démarrer (connexion Internet nécessaire pour la 3D).");stop()}}}}
document.querySelectorAll(".sa-btn").forEach(b=>b.onclick=()=>start(b.dataset.mode));
</script>
</body></html>
"""
    dst = os.path.join(out_dir, safe_name(title) + ".html")
    open(dst, "w", encoding="utf-8").write(html)
    return dst


def main():
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)
    css = open(os.path.join(ROOT, "css", "style.css"), encoding="utf-8").read()
    games = json.load(open(os.path.join(ROOT, "games", "index.json"), encoding="utf-8"))
    ids = {g["id"] for g in games}
    if "spore" not in ids and os.path.exists(os.path.join(ROOT, "games", "spore", "index.html")):
        games.append({"id": "spore", "name": "SPORE - Fractale Vivante"})
    for g in games:
        p = export(g, out_dir, css)
        print(f"{os.path.getsize(p):>9} {os.path.basename(p)}")


if __name__ == "__main__":
    main()
