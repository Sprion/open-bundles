"""A/B tests of bundles: one product page, version A shows one bundle, B (C, D) another. data/tests.json.

The theme picks each visitor's version (theme/snippets/ob-ab.liquid), the discount function charges that version's
bundle, and every order carries the cart attribute _obab ("test:version"). Results:
  - orders, revenue, AOV per version: read back from Shopify orders (needs read_orders);
  - visitors and add to carts per version: from your stats collector (collector URL and read key in the Connect to store window, optional,
    see stats/collector.py). Without one, compare orders and revenue only (traffic is split by the weights).
"""
import json
import math
import os
import re
import urllib.request
from datetime import datetime, timezone

import bundles
import shopify

FILE = os.path.join(bundles.DATA, "tests.json")
VERSION_KEYS = "abcd"
MIN_ORDERS = 10  # per version before a winner can be called


class TestError(bundles.BundleError):
    pass


def load():
    data = bundles._read(FILE, {})
    data.setdefault("tests", [])
    return data


def save(data):
    bundles._write(FILE, data)


def get(data, test_id):
    for t in data["tests"]:
        if t["id"] == test_id:
            return t
    raise TestError(f"No test '{test_id}'")


def public(t):
    """Shape the editor's list expects (pages[0].handle / .bundles)."""
    return {**t, "type": "bundle", "pages": [{"handle": t["handle"], "bundles": t["bundles"]}]}


def create(handle, bundle_map, name=""):
    """Created OFF: switch it on in the list."""
    bundle_map = {k: v for k, v in (bundle_map or {}).items() if v}
    known = bundles.load_bundles()["bundles"]
    keys = sorted(bundle_map)
    if not keys or keys[0] != "a" or len(keys) < 2 or any(k not in VERSION_KEYS for k in keys) or any(b not in known for b in bundle_map.values()):
        raise TestError("A test needs versions a and b (c, d) mapped to existing bundles")
    data = load()
    base = re.sub(r"[^a-z0-9-]", "", handle.lower())[:20].strip("-") or "test"
    n, ids = 1, {t["id"] for t in data["tests"]}
    while f"{base}-offer-{n}" in ids:
        n += 1
    test = {"id": f"{base}-offer-{n}", "name": name or handle, "handle": handle, "productId": bundles.product_id(handle),
            "status": "draft", "bundles": dict(bundle_map),
            "versions": [{"key": k, "weight": round(100 / len(keys))} for k in keys],
            "created": bundles.now(), "started": None, "stopped": None, "winner": None}
    data["tests"].append(test)
    save(data)
    return test


def set_status(test_id, on):
    data = load()
    t = get(data, test_id)
    if t["status"] == "concluded":
        raise TestError("This test has ended")
    if on and any(x["status"] == "running" and x["handle"] == t["handle"] and x["id"] != test_id for x in data["tests"]):
        raise TestError("This product already has a running test")
    t["status"] = "running" if on else "paused"
    if on and not t["started"]:
        t["started"] = bundles.now()
    save(data)
    bundles.sync()
    return t


def set_weights(test_id, weights):
    data = load()
    t = get(data, test_id)
    if len(weights) != len(t["versions"]) or any(w < 0 for w in weights) or sum(weights) <= 0:
        raise TestError("One weight (0 or more) per version")
    for v, w in zip(t["versions"], weights):
        v["weight"] = int(round(w))
    save(data)
    bundles.sync()
    return t


def end(test_id, winner):
    """Stop the test; the winner's bundle becomes the product's bundle."""
    data = load()
    t = get(data, test_id)
    if winner not in t["bundles"]:
        raise TestError(f"Winner must be one of {sorted(t['bundles'])}")
    t.update(status="concluded", winner=winner, stopped=bundles.now())
    save(data)
    bundles.set_product_bundle(t["handle"], t["bundles"][winner])  # also syncs
    return t


def remove_version(test_id, key):
    data = load()
    t = get(data, test_id)
    keys = [v["key"] for v in t["versions"]]
    if key not in keys:
        raise TestError(f"Version must be one of {keys}")
    if len(keys) <= 2:
        return end(test_id, next(k for k in keys if k != key))
    if key == "a":
        raise TestError("Keep another version instead of removing A")
    t["versions"] = [v for v in t["versions"] if v["key"] != key]
    t["bundles"].pop(key, None)
    save(data)
    bundles.sync()
    return t


def delete(test_id):
    data = load()
    get(data, test_id)
    data["tests"] = [t for t in data["tests"] if t["id"] != test_id]
    save(data)
    bundles.sync()


# ---------- results ----------

ORDERS_QUERY = """query($after: String, $q: String) { orders(first: 100, after: $after, query: $q, sortKey: CREATED_AT) {
  pageInfo { hasNextPage endCursor }
  nodes { createdAt cancelledAt test customAttributes { key value } currentSubtotalPriceSet { shopMoney { amount } }
          lineItems(first: 50) { nodes { quantity variant { inventoryItem { unitCost { amount } } } } } } } }"""


def fetch_orders(since):
    """Orders since a date: subtotal after discounts (no shipping, no taxes), units, and cost when Shopify knows it."""
    out, after = [], None
    while True:
        page = shopify.graphql(ORDERS_QUERY, {"after": after, "q": f"created_at:>={since[:10]}"})["orders"]
        for o in page["nodes"]:
            if o.get("cancelledAt") or o.get("test"):
                continue
            attrs = {a["key"]: a["value"] for a in o.get("customAttributes") or []}
            items = o["lineItems"]["nodes"]
            costs = [((i.get("variant") or {}).get("inventoryItem") or {}).get("unitCost") for i in items]
            cost = None if any(c is None for c in costs) else sum(float(c["amount"]) * i["quantity"] for c, i in zip(costs, items))
            out.append({"ab": attrs.get("_obab", ""), "total": float(o["currentSubtotalPriceSet"]["shopMoney"]["amount"]),
                        "units": sum(i["quantity"] for i in items), "cost": cost})
        if not page["pageInfo"]["hasNextPage"]:
            return out
        after = page["pageInfo"]["endCursor"]


def fetch_stats(test_id):
    """Visitors and add to carts per version from your collector: GET <STATS_URL>/stats?test=<id>
    with "Authorization: Bearer <STATS_READ_KEY>", answering {"versions": {"a": {"visitors": n, "atc": n}}}."""
    url = shopify.setting("STATS_URL").rstrip("/")
    if not url:
        return None
    req = urllib.request.Request(f"{url}/stats?test={test_id}", headers={
        "Authorization": f"Bearer {shopify.setting('STATS_READ_KEY')}", "User-Agent": "open-bundles-editor/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())


def _ztest(o1, n1, o2, n2):
    """Two-proportion z-test on conversion rate: two-sided p-value."""
    if not n1 or not n2:
        return None
    p = (o1 + o2) / (n1 + n2)
    se = math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
    if se == 0:
        return None
    return math.erfc(abs((o2 / n2 - o1 / n1) / se) / math.sqrt(2))


def parse_attr(value):
    out = {}
    for part in (value or "").split(","):
        if ":" in part:
            k, v = part.split(":", 1)
            out[k.strip()] = v.strip()
    return out


def analyse(test, orders, stats=None):
    keys = [v["key"] for v in test["versions"]]
    res = {k: {"visitors": None, "orders": 0, "revenue": 0.0, "units": 0, "cost": 0.0, "costKnown": True} for k in keys}
    for o in orders:
        v = parse_attr(o.get("ab")).get(test["id"])
        if v in res:
            r = res[v]
            r["orders"] += 1
            r["revenue"] += o["total"]
            r["units"] += o.get("units", 0)
            if o.get("cost") is None:
                r["costKnown"] = False
            else:
                r["cost"] += o["cost"]
    if stats:
        for r in res.values():
            r["visitors"], r["addToCart"] = 0, 0
        for k, s in (stats.get("versions") or {}).items():
            if k in res:
                res[k]["visitors"], res[k]["addToCart"] = int(s.get("visitors", 0)), int(s.get("atc", 0))
    for r in res.values():
        n = r["visitors"]
        r["revenue"] = round(r["revenue"], 2)
        r["aov"] = round(r["revenue"] / r["orders"], 2) if r["orders"] else None
        r["unitsPerOrder"] = round(r["units"] / r["orders"], 2) if r["orders"] else None
        r["grossProfit"] = round(r["revenue"] - r["cost"], 2) if r["costKnown"] and r["orders"] else None
        r["conversionRate"] = round(100 * r["orders"] / n, 2) if n else None
        r["addToCartRate"] = round(100 * r.get("addToCart", 0) / n, 2) if n else None
        r["revenuePerVisitor"] = round(r["revenue"] / n, 2) if n else None
        r["profitPerVisitor"] = round(r["grossProfit"] / n, 2) if n and r["grossProfit"] is not None else None
        r["cpa"] = None
        del r["cost"], r["costKnown"]
    a = res.get("a", {})
    for k, r in res.items():
        if k != "a":
            r["uplift"] = {m: (round(100 * (r[m] - a[m]) / a[m], 1) if r.get(m) is not None and a.get(m) else None)
                           for m in ("conversionRate", "aov", "revenuePerVisitor", "profitPerVisitor")}
    winner, short = None, [k for k in keys if res[k]["orders"] < MIN_ORDERS]
    has_visitors = all(res[k]["visitors"] for k in keys)
    if any(res[k]["visitors"] for k in keys) and not has_visitors:
        verdict = "Waiting for visitors on every version."
    elif not has_visitors:
        verdict = "No stats collector connected: compare orders and revenue (traffic is split by the weights)."
    elif short:
        verdict = f"Keep running: at least {MIN_ORDERS} orders per version needed (missing " + ", ".join(f"{k.upper()} {MIN_ORDERS - res[k]['orders']}" for k in short) + ")."
    else:
        best, best_p = None, None
        for k in keys[1:]:
            p = _ztest(res["a"]["orders"], res["a"]["visitors"], res[k]["orders"], res[k]["visitors"])
            res[k]["pValue"] = round(p, 4) if p is not None else None
            if p is not None and p < 0.05 and (best_p is None or p < best_p):
                best, best_p = k, p
        if best:
            winner = best if res[best]["conversionRate"] > res["a"]["conversionRate"] else "a"
            verdict = f"Winner: {winner.upper()} (conversion rate, z-test p = {best_p:.3f})."
        else:
            verdict = "No significant difference yet: keep running."
    return {"test": test["id"], "name": test["name"], "status": test["status"], "started": test["started"],
            "versions": res, "verdict": verdict, "winner": winner, "minOrders": MIN_ORDERS}


def results(test_id):
    t = get(load(), test_id)
    if not t["started"]:
        return {"test": test_id, "status": t["status"], "verdict": "Not started: no results yet."}
    note = None
    try:
        stats = fetch_stats(test_id)
    except Exception as e:  # stats are optional; orders still show
        stats, note = None, f"Visitor counts unavailable: {type(e).__name__}: {e}"
    out = analyse(t, fetch_orders(t["started"]), stats)
    if note:
        out["note"] = note
    return out
