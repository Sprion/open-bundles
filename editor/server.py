"""Local bundle editor: python editor/server.py, then open http://127.0.0.1:8787

Serves the editor page (editor/app), the theme assets and demo pictures for the preview, and a small JSON API.
Listens on 127.0.0.1 only. Write requests must carry the header X-editor: 1 (the page sends it), so another website
open in your browser cannot change your bundles.

Until you connect a store (button at the top right) the editor runs in demo mode: a sample product, bundles saved in data/ only,
nothing sent to any store. Good for trying it out.
"""
import base64
import hashlib
import json
import mimetypes
import os
import re
import sys
import traceback
from html import escape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bundles  # noqa: E402
import shopify  # noqa: E402
import tests  # noqa: E402

ROOT = os.path.dirname(HERE)
STATIC = {"/app/": os.path.join(HERE, "app"), "/theme/assets/": os.path.join(ROOT, "theme", "assets"), "/media/": os.path.join(ROOT, "media")}
RENDERS = {}  # editor key -> (handle, bundle) of the preview frame, last 20 only
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.shopify.com; "
       "connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'")


def demo():
    return not shopify.connected()


class Handler(SimpleHTTPRequestHandler):
    server_version = "open-bundles"

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            sys.stderr.write("%s\n" % (fmt % args))

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Cache-Control", "no-store" if self.path.startswith("/api/") else "no-cache")
        self.send_header("Content-Security-Policy", getattr(self, "_csp", CSP))
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        super().end_headers()

    # ---------- helpers ----------
    def _json(self, code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html(self, html):
        data = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 2_000_000:
            raise bundles.BundleError("Request too large")
        return json.loads(self.rfile.read(n) or b"{}") if n else {}

    def _file(self, path):
        if not os.path.isfile(path):
            return self._json(404, {"error": "Not found"})
        data = open(path, "rb").read()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(path)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # ---------- routing ----------
    def do_GET(self):
        url = urlsplit(self.path)
        path, qs = url.path, parse_qs(url.query)
        if path in ("/", "/index.html"):
            return self._file(os.path.join(HERE, "app", "index.html"))
        for prefix, base in STATIC.items():
            if path.startswith(prefix):
                full = os.path.realpath(os.path.join(base, path[len(prefix):]))
                if not full.startswith(os.path.realpath(base) + os.sep):
                    return self._json(404, {"error": "Not found"})
                return self._file(full)
        if path.startswith("/api/"):
            return self._api("GET", path[5:].strip("/").split("/"), qs)
        return self._json(404, {"error": "Not found"})

    def do_POST(self):
        return self._write("POST")

    def do_DELETE(self):
        return self._write("DELETE")

    def _write(self, method):
        path = urlsplit(self.path).path
        if not path.startswith("/api/") or self.headers.get("X-editor") != "1":
            return self._json(403, {"error": "Forbidden"})
        return self._api(method, path[5:].strip("/").split("/"), {})

    def _api(self, method, parts, qs):
        try:
            body = self._body() if method == "POST" else {}
            if parts[0] == "bundles":
                return self._bundles(method, parts[1:], qs, body)
            if parts[0] == "tests":
                return self._tests(method, parts[1:], body)
            if parts == ["status"]:
                return self._json(200, {"demo": demo(), "store": "" if demo() else shopify.store(), "settings": shopify.public_settings()})
            if method == "POST" and parts == ["connect"]:
                return self._connect(body)
            if method == "POST" and parts == ["disconnect"]:
                shopify.forget()
                return self._json(200, {"demo": demo()})
            if method == "POST" and parts == ["discount"]:
                return self._json(200, bundles.create_discount())
            return self._json(404, {"error": "Unknown endpoint"})
        except (bundles.BundleError, shopify.ShopifyError) as e:
            return self._json(400, {"error": str(e)})
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            return self._json(500, {"error": f"{type(e).__name__}: {e}"})

    def _connect(self, body):
        """Save the Connect window's values, then test them; a failed test puts the previous settings back.
        Secrets are never sent back to the page."""
        before = shopify._saved()
        shopify.save_settings(body.get("settings") or {})
        try:
            info = shopify.check()
        except Exception as e:  # noqa: BLE001
            shopify.write_settings(before) if before else shopify.forget()
            raise shopify.ShopifyError(f"Could not connect: {e}") from None
        return self._json(200, {**info, "store": shopify.store(), "settings": shopify.public_settings()})

    def _bundles(self, method, p, qs, body):
        if method == "GET":
            if not p:
                data = bundles.load_bundles()
                listed = [{"id": t["id"], "status": t["status"], "pages": tests.public(t)["pages"]} for t in tests.load()["tests"]]
                products = DEMO_PRODUCTS if demo() else bundles.list_products()
                return self._json(200, {**data, "templates": bundles.load_templates(), "productList": products, "tests": listed, "demo": demo()})
            if len(p) == 2 and p[0] == "render":
                handle, bundle = RENDERS.get(p[1], ("", None))
                if bundle is None:
                    return self._json(404, {"error": "Preview expired: change any field to redraw it"})
                try:
                    html = bundles.render_preview("" if demo() else handle, bundle)
                except Exception as e:  # noqa: BLE001
                    html = f"<!doctype html><meta charset='utf-8'><p style='font:14px sans-serif;color:#8c2b22;padding:16px'>Preview failed: {escape(type(e).__name__)}: {escape(str(e))}</p>"
                # The snippets' own inline scripts (countdown, first-bar link, gifts panel) may run: one hash each.
                hashes = " ".join("'sha256-%s'" % base64.b64encode(hashlib.sha256(m.encode("utf-8")).digest()).decode()
                                  for m in re.findall(r"<script>(.*?)</script>", html, re.S))
                self._csp = CSP.replace("script-src 'self'", f"script-src 'self' {hashes}".rstrip())
                return self._html(html)
            if p == ["variants"]:
                return self._json(200, {"products": []} if demo() else bundles.search_variants(qs.get("q", [""])[0]))
            if p == ["images"]:
                return self._json(200, {"images": [], "next": None} if demo() else bundles.list_images(qs.get("q", [""])[0], qs.get("after", [None])[0]))
            if len(p) == 2 and p[0] == "options":
                return self._json(200, DEMO_OPTIONS if demo() else bundles.product_options(p[1]))
            return self._json(404, {"error": "Unknown endpoint"})
        if method == "POST" and len(p) == 2 and p[0] == "render" and re.fullmatch(r"[a-z0-9]{8,32}", p[1]):
            RENDERS.pop(p[1], None)
            RENDERS[p[1]] = (body.get("handle", ""), body.get("bundle") or {})
            while len(RENDERS) > 20:
                RENDERS.pop(next(iter(RENDERS)))
            return self._json(200, {"url": f"api/bundles/render/{p[1]}"})
        if demo() and p and p[0] in ("assign", "preview", "draft"):
            raise bundles.BundleError("Demo mode: connect your store (top right) to put bundles on product pages")
        if method == "POST" and p == ["assign"]:
            return self._json(200, bundles.set_product_bundle(body.get("handle", ""), body.get("bundle", "")))
        if method == "POST" and p == ["preview"]:
            return self._json(200, bundles.preview_bundle(body.get("handle", ""), body.get("bundle", ""), body.get("on", True) is not False))
        if method == "POST" and p == ["draft"]:
            return self._json(200, bundles.preview_draft(body.get("handle", ""), body.get("bundle") or {}))
        if method == "POST" and len(p) == 1:
            return self._json(200, {"bundle": bundles.save_bundle(p[0], body)})
        if method == "DELETE" and len(p) == 1:
            bundles.delete_bundle(p[0])
            return self._json(200, {"deleted": p[0]})
        return self._json(404, {"error": "Unknown endpoint"})

    def _tests(self, method, p, body):
        if method == "GET":
            if not p:
                return self._json(200, {"tests": [tests.public(t) for t in tests.load()["tests"]]})
            if len(p) == 2 and p[1] == "results":
                try:
                    return self._json(200, DEMO_RESULTS.get(p[0]) or tests.results(p[0]) if demo() else tests.results(p[0]))
                except Exception as e:  # noqa: BLE001  store not connected yet, collector down...
                    return self._json(200, {"test": p[0], "unavailable": f"{type(e).__name__}: {e}"})
            return self._json(404, {"error": "Unknown endpoint"})
        if method == "POST" and not p:
            if demo():
                raise bundles.BundleError("Demo mode: connect your store (top right) to run A/B tests")
            return self._json(200, {"test": tests.create(body.get("product", ""), body.get("bundles") or {}, body.get("name", ""))})
        if not p:
            return self._json(404, {"error": "Unknown endpoint"})
        test_id, action = p[0], (p[1] if len(p) > 1 else "")
        if method == "DELETE" and not action:
            tests.delete(test_id)
            return self._json(200, {"deleted": test_id})
        actions = {
            "status": lambda: tests.set_status(test_id, bool(body.get("on"))),
            "weights": lambda: tests.set_weights(test_id, [float(w) for w in body.get("weights") or []]),
            "end": lambda: tests.end(test_id, body.get("winner", "")),
            "keep": lambda: tests.end(test_id, body.get("version", "")),
            "remove": lambda: tests.remove_version(test_id, body.get("version", "")),
        }
        if method != "POST" or action not in actions:
            return self._json(404, {"error": "Unknown endpoint"})
        actions[action]()
        return self._json(200, {"test": tests.public(tests.get(tests.load(), test_id))})


# Demo mode data: one sample product (pictures in media/demo/) and example numbers for a demo test, if any.
DEMO_PRODUCTS = [{"handle": "", "title": "Sample product", "price": 49.95, "image": "/media/demo/black.webp"}]
DEMO_OPTIONS = {"colors": [{"name": c, "image": f"/media/demo/{c.lower()}.webp"} for c in ("Black", "Charcoal", "White", "Grey")],
                "sizes": ["XS", "S", "M", "L", "XL"], "colorName": "Color", "sizeName": "Size"}
DEMO_RESULTS = bundles._read(os.path.join(bundles.DATA, "demo-results.json"), {})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("EDITOR_PORT", 8787))
    mimetypes.add_type("text/javascript", ".js")
    mimetypes.add_type("image/webp", ".webp")
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    mode = "demo mode (no store connected)" if demo() else f"connected to {shopify.store()}"
    print(f"Bundle editor: http://127.0.0.1:{port}  ({mode})", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
