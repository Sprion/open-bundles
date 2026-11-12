"""Reference stats collector for bundle A/B tests: counts visitors and add to carts per test version.

It is optional (without it the editor still shows orders and revenue per version) and deliberately tiny: one Python
file, standard library only, data in a SQLite file. Host it wherever suits you, as long as the store can reach it over
HTTPS (a small server or VPS behind a reverse proxy, a container platform...). Or rewrite the two endpoints below on
any serverless platform and database you prefer: the contract is all that matters.

Contract
  POST /            body (text, JSON): {"vid": "<visitor id>", "e": "view" | "atc", "t": [["<test>", "<version>"]], "p": "/products/..."}
                    sent by the theme with navigator.sendBeacon. Always answers 204.
  GET  /stats?test=<test id>   header "Authorization: Bearer <READ_KEY>"
                    answers {"versions": {"a": {"visitors": 120, "atc": 18}, "b": {...}}}  (unique visitors per version)

Run
  READ_KEY=change-me python stats/collector.py 8790        (listens on 0.0.0.0:8790, data in stats/stats.db)
Then in the editor: Connect to store > A/B stats collector, its URL (https://your-collector.example.com) and the read key.
"""
import json
import os
import re
import sqlite3
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

DB = os.environ.get("STATS_DB") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "stats.db")
READ_KEY = os.environ.get("READ_KEY", "")
ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,40}$")
lock = threading.Lock()


def db():
    con = sqlite3.connect(DB)
    con.execute("CREATE TABLE IF NOT EXISTS hits (test TEXT, version TEXT, event TEXT, vid TEXT, PRIMARY KEY (test, version, event, vid))")
    return con


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def _send(self, code, data=None):
        body = json.dumps(data).encode() if data is not None else b""
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        if body:
            self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            n = min(int(self.headers.get("Content-Length") or 0), 4096)
            m = json.loads(self.rfile.read(n) or b"{}")
            vid, event = str(m.get("vid", ""))[:24], m.get("e")
            if event in ("view", "atc") and re.fullmatch(r"[a-z0-9]{4,24}", vid):
                rows = [(t, v, event, vid) for t, v in (m.get("t") or [])[:5] if ID.match(str(t)) and re.fullmatch(r"[a-d]", str(v))]
                with lock, db() as con:
                    con.executemany("INSERT OR IGNORE INTO hits VALUES (?, ?, ?, ?)", rows)
        except (ValueError, TypeError):
            pass
        self._send(204)

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path.rstrip("/") != "/stats":
            return self._send(404, {"error": "not found"})
        if not READ_KEY or self.headers.get("Authorization") != f"Bearer {READ_KEY}":
            return self._send(401, {"error": "unauthorized"})
        test = parse_qs(url.query).get("test", [""])[0]
        if not ID.match(test):
            return self._send(400, {"error": "test id"})
        out = {}
        with lock, db() as con:
            for version, event, count in con.execute("SELECT version, event, COUNT(*) FROM hits WHERE test = ? GROUP BY version, event", (test,)):
                out.setdefault(version, {"visitors": 0, "atc": 0})["visitors" if event == "view" else "atc"] = count
        self._send(200, {"versions": out})


if __name__ == "__main__":
    if not READ_KEY:
        sys.exit("Set READ_KEY (the key the editor sends to read the numbers)")
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
    print(f"Stats collector on :{port}, data in {DB}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
