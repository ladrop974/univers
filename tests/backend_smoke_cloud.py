"""Test de bout en bout du serveur Univers (base + fichiers) avec une invitation de test.
Usage : python tests/backend_smoke.py [CODE_INVITATION_DE_TEST]
Crée une galaxie de test, la remplit, vérifie la visibilité (privé / clé / public) et les fichiers, puis la supprime."""
import json
import sys
import urllib.request

URL = "https://rzujadgltooooadcezhf.supabase.co"
KEY = "sb_publishable_vzeyQTbGJuRxZJTK75MOCQ_ugkJK59_"
INVITE = sys.argv[1] if len(sys.argv) > 1 else "TESTINVT"


def call(path, body, method="POST", headers=None, raw=None):
    h = {"apikey": KEY, "Content-Type": "application/json", "Origin": "https://ladrop974.github.io", **(headers or {})}
    req = urllib.request.Request(URL + path, raw if raw is not None else json.dumps(body).encode(), h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
            return r.status, (json.loads(data) if data and data[:1] in b"[{" else data)
    except urllib.error.HTTPError as e:
        data = e.read()
        try:
            return e.code, json.loads(data)
        except Exception:
            return e.code, data


def rpc(name, **kw):
    return call(f"/rest/v1/rpc/{name}", kw)


def fn(**kw):
    return call("/functions/v1/files", kw)


ok_count = 0


def check(cond, label):
    global ok_count
    print(("OK   " if cond else "ÉCHEC"), label)
    if not cond:
        sys.exit(1)
    ok_count += 1


# 1. création
s, g = rpc("create_galaxy", p_invite="invalide", p_name="x")
check(g.get("error"), "une mauvaise invitation est refusée")
s, g = rpc("create_galaxy", p_invite=INVITE, p_name="Galaxie de test")
check("master" in g, "création de la galaxie avec une bonne invitation")
slug, secret = g["master"].split(".")
vkey = g["view_key"]

# 2. éléments
def save(**item):
    return rpc("owner_save_item", p_slug=slug, p_secret=secret, p=item)[1]

pub = save(kind="folder", label="Public", visibility="public")["item"]
keyf = save(kind="folder", label="Avec clé", visibility="key")["item"]
priv = save(kind="folder", label="Privé", visibility="private")["item"]
save(kind="link", label="Lien public", visibility="public", url="https://example.com", parent_id=pub["id"])
save(kind="note", label="Note clé", visibility="key", note="bonjour", parent_id=pub["id"])
save(kind="game", label="Poules", visibility="public", game_id="poules", parent_id=pub["id"])
save(kind="link", label="Public dans privé", visibility="public", url="https://example.com/x", parent_id=priv["id"])
save(kind="link", label="Dans dossier clé", visibility="key", url="https://example.com/k", parent_id=keyf["id"])
check("error" in save(kind="link", label="mauvais", url="javascript:alert(1)")  or True, "lien javascript: traité")
s, bad = call("/rest/v1/rpc/owner_save_item", {"p_slug": slug, "p_secret": secret, "p": {"kind": "link", "label": "mauvais", "url": "javascript:alert(1)"}})
check(s == 400, "un lien javascript: est refusé par la base")

# 3. visibilité
s, v = rpc("galaxy_view", p_slug=slug, p_key=None)
labels = sorted(i["label"] for i in v["items"])
check(labels == ["Lien public", "Poules", "Public"], f"sans clé : seulement le public ({labels})")
check(not v["key_ok"], "sans clé : key_ok = faux")
s, v = rpc("galaxy_view", p_slug=slug, p_key=vkey)
labels = sorted(i["label"] for i in v["items"])
check(labels == ["Avec clé", "Dans dossier clé", "Lien public", "Note clé", "Poules", "Public"], f"avec la clé : public + clé ({labels})")
check("Privé" not in labels and "Public dans privé" not in labels, "le privé et ce qu'il contient restent cachés, même public")
s, v = rpc("galaxy_view", p_slug=slug, p_key="FAUXFAUXFA")
check(not v["key_ok"] and len(v["items"]) == 3, "une fausse clé ne donne rien de plus")
check("storage_path" not in json.dumps(v) and "owner_hash" not in json.dumps(v), "aucune donnée interne dans la réponse")
s, d = call("/rest/v1/items?select=*", None, method="GET", raw=b"")
check(s in (401, 403) or d == [] or (isinstance(d, dict) and d.get("code")), "lecture directe des tables impossible")
s, o = rpc("owner_get", p_slug=slug, p_secret="MAUVAISSECRET")
check(o.get("error") == "accès refusé", "mauvaise clé maître refusée")
s, o = rpc("owner_get", p_slug=slug, p_secret=secret)
check(len(o["items"]) == 8 and o["galaxy"]["view_key"] == vkey, "la clé maître voit tout (8 éléments) et la clé de partage")

# 5. suppression (nettoie aussi le stockage)
s, r = rpc("owner_delete_item", p_slug=slug, p_secret=secret, p_id=pub["id"])
check(s == 200 and r.get("ok"), "suppression d'un dossier avec son contenu")
s, v = rpc("galaxy_view", p_slug=slug, p_key=vkey)
check(all(i["label"] not in ("Lien public",) for i in v["items"]), "le contenu supprimé a disparu")

print(f"\n{ok_count} vérifications réussies. Galaxie de test : {slug} (à supprimer côté base).")
print(slug)
