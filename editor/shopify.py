"""Shopify Admin GraphQL client for the editor, and the store settings.

The store settings (domain, app keys, optional preview theme and stats collector) are typed by you in the editor's
"Connect to store" window and kept in settings.json in your user folder (~/.open-bundles/, or the folder named by the
OPEN_BUNDLES_HOME environment variable): outside the repository, never sent back to the page, never printed.
An environment variable of the same name overrides a saved value (for servers and CI).

Keys: SHOPIFY_STORE (your-store.myshopify.com) and either SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (your app's keys:
a token is fetched with the client credentials grant and kept in memory) or SHOPIFY_ADMIN_TOKEN (an Admin API token).
"""
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

API_VERSION = "2026-10"
HOME = os.environ.get("OPEN_BUNDLES_HOME") or os.path.join(os.path.expanduser("~"), ".open-bundles")
SETTINGS_FILE = os.path.join(HOME, "settings.json")
PUBLIC = ("SHOPIFY_STORE", "SHOPIFY_CLIENT_ID", "SHOPIFY_PREVIEW_THEME_ID", "SHOP_URL", "STATS_URL")
SECRET = ("SHOPIFY_CLIENT_SECRET", "SHOPIFY_ADMIN_TOKEN", "STATS_READ_KEY")
SCOPES = ("read_products", "read_orders", "read_files", "write_discounts")


class ShopifyError(Exception):
    pass


def _saved():
    try:
        with open(SETTINGS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return {}


def setting(name):
    return (os.environ.get(name) or str(_saved().get(name) or "")).strip()


def public_settings():
    """What the page may see: plain values, and only whether each secret is set."""
    return {**{k: setting(k) for k in PUBLIC}, **{k: bool(setting(k)) for k in SECRET}}


def save_settings(values):
    """Merge the Connect window's values. An empty secret field keeps the saved secret."""
    cur = _saved()
    for k in PUBLIC + SECRET:
        if k not in values:
            continue
        v = str(values[k] or "").strip()
        if k in SECRET and not v:
            continue
        if v:
            cur[k] = v
        else:
            cur.pop(k, None)
    store_ = cur.get("SHOPIFY_STORE", "").lower().replace("https://", "").strip("/")
    if store_ and not re.fullmatch(r"[a-z0-9][a-z0-9-]*\.myshopify\.com", store_):
        raise ShopifyError("Store: use the myshopify.com domain (Settings > Domains), e.g. my-store.myshopify.com")
    if store_:
        cur["SHOPIFY_STORE"] = store_
    write_settings(cur)


def write_settings(data):
    os.makedirs(HOME, exist_ok=True)
    tmp = SETTINGS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    try:
        os.chmod(tmp, 0o600)
    except OSError:
        pass
    os.replace(tmp, SETTINGS_FILE)
    _token.update(value="", expires=0)


def forget():
    """Disconnect: delete the saved settings (environment variables, if any, still apply)."""
    if os.path.exists(SETTINGS_FILE):
        os.remove(SETTINGS_FILE)
    _token.update(value="", expires=0)


_token = {"value": "", "expires": 0}


def connected():
    return bool(setting("SHOPIFY_STORE"))


def store():
    s = setting("SHOPIFY_STORE").replace("https://", "").strip("/")
    if not s:
        raise ShopifyError("No store connected: use Connect to store")
    return s


def _request(url, data, headers):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "open-bundles-editor/1.0", **headers})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        title = re.search(r"<title>(.*?)</title>", body, re.S)
        raise ShopifyError(f"Shopify HTTP {e.code}: {(title.group(1) if title else body).strip()[:300]}") from None


def token():
    fixed = setting("SHOPIFY_ADMIN_TOKEN")
    if fixed:
        return fixed
    if _token["value"] and _token["expires"] > time.time() + 300:
        return _token["value"]
    cid, secret = setting("SHOPIFY_CLIENT_ID"), setting("SHOPIFY_CLIENT_SECRET")
    if not cid or not secret:
        raise ShopifyError("Connect to store: add your app's client ID and secret (or an Admin API token)")
    r = _request(f"https://{store()}/admin/oauth/access_token",
                 urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": cid, "client_secret": secret}).encode(),
                 {"Content-Type": "application/x-www-form-urlencoded"})
    _token.update(value=r["access_token"], expires=time.time() + int(r.get("expires_in") or 3600))
    return _token["value"]


def graphql(query, variables=None):
    for attempt in range(3):
        r = _request(f"https://{store()}/admin/api/{API_VERSION}/graphql.json",
                     json.dumps({"query": query, "variables": variables or {}}).encode("utf-8"),
                     {"Content-Type": "application/json", "X-Shopify-Access-Token": token()})
        if any((e.get("extensions") or {}).get("code") == "THROTTLED" for e in r.get("errors") or []) and attempt < 2:
            time.sleep(2)
            continue
        if r.get("errors"):
            raise ShopifyError("GraphQL: " + "; ".join(e.get("message", "") for e in r["errors"]))
        return r["data"]


def check():
    """Test the connection: shop name and the app scopes the editor needs that are missing."""
    d = graphql("{ shop { name } currentAppInstallation { accessScopes { handle } } }")
    have = {x["handle"] for x in ((d.get("currentAppInstallation") or {}).get("accessScopes") or [])}
    implied = {h.replace("write_", "read_") for h in have if h.startswith("write_")}
    return {"shop": d["shop"]["name"], "missingScopes": [x for x in SCOPES if x not in have | implied]}
