"""Connect the editor to your store using the app you deployed with the Shopify CLI, without anyone seeing its keys.

    python scripts/connect.py --store my-store.myshopify.com [--preview-theme 123456789]

It reads the app's client ID from app/shopify.app.toml, asks the Shopify CLI for the app's secret
(`shopify app env show`), saves both in ~/.open-bundles/settings.json (outside the repository) and prints no key.
Then it tests the connection, lists missing app scopes, and creates the automatic bundle discount if it is missing.
Exit code 0 when the editor is ready.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "app")
sys.path.insert(0, os.path.join(ROOT, "editor"))
import bundles  # noqa: E402
import shopify  # noqa: E402


def client_id():
    toml = open(os.path.join(APP, "shopify.app.toml"), encoding="utf-8").read()
    m = re.search(r'^client_id\s*=\s*"([^"]+)"', toml, re.M)
    if not m:
        sys.exit("No client_id in app/shopify.app.toml: run `shopify app config link --path app` first (INSTALL.md, step 3).")
    return m.group(1)


def client_secret():
    cli = shutil.which("shopify")
    if not cli:
        sys.exit("Shopify CLI not found: npm install -g @shopify/cli")
    r = subprocess.run([cli, "app", "env", "show", "--path", APP], capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.search(r"SHOPIFY_API_SECRET\W+([A-Za-z0-9_\-]{16,})", r.stdout + r.stderr)
    if not m:
        sys.exit("The Shopify CLI did not return the app secret (logged in? app deployed?). "
                 "Run `shopify app env show --path app` yourself to see why; it prints the secret, so do not paste its output anywhere.")
    return m.group(1)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--store", required=True, help="my-store.myshopify.com")
    ap.add_argument("--preview-theme", default="", help="ID of an unpublished theme for the editor's Open links")
    ap.add_argument("--shop-url", default="", help="Public store URL, e.g. https://www.my-store.com")
    a = ap.parse_args()

    values = {"SHOPIFY_STORE": a.store, "SHOPIFY_CLIENT_ID": client_id(), "SHOPIFY_CLIENT_SECRET": client_secret()}
    if a.preview_theme:
        values["SHOPIFY_PREVIEW_THEME_ID"] = a.preview_theme
    if a.shop_url:
        values["SHOP_URL"] = a.shop_url
    before = shopify._saved()
    try:
        shopify.save_settings(values)
        info = shopify.check()
    except Exception as e:  # noqa: BLE001
        shopify.write_settings(before) if before else shopify.forget()
        sys.exit(f"Could not connect: {e}\nIs the app installed on {a.store}? (INSTALL.md, step 5)")
    print(f"Connected to {info['shop']} ({shopify.store()}). Keys saved outside the repository.")
    if a.preview_theme:
        print(f"Preview theme saved: {a.preview_theme} (the editor's previews open it).")
    if info["missingScopes"]:
        sys.exit("Missing app scopes: " + ", ".join(info["missingScopes"]) +
                 ". Check [access_scopes] in app/shopify.app.toml, run `shopify app deploy --path app`, then accept the update in the store admin.")
    try:
        print(bundles.create_discount()["message"] + ".")
    except Exception as e:  # noqa: BLE001
        sys.exit(f"Discount not created: {e}")
    print("Editor ready: python editor/server.py, then http://127.0.0.1:8787")


if __name__ == "__main__":
    main()
