"""Editor preview of a bundle, drawn by the theme's own code (theme/snippets/ob-bundle*.liquid run with python-liquid,
theme/assets/ob-bundle.js), so the editor shows what the store shows, without asking the storefront.

Only the Shopify filters the bundle snippets use are added: money, money_without_trailing_zeros, image_url,
asset_url, json, date. The preview uses a neutral system font; on the store the block inherits the theme's font."""
import datetime as dt
import json
from html import escape
from pathlib import Path

import liquid

THEME = Path(__file__).resolve().parents[1] / "theme"
ASSETS = "/theme/assets/"


def _money(v):
    try:
        return f"${float(v or 0) / 100:,.2f}"
    except (TypeError, ValueError):
        return str(v)


def _money_nz(v):
    s = _money(v)
    return s[:-3] if s.endswith(".00") else s


def _image_url(v, width=None, height=None, **_):
    url = (v.get("src") or v.get("url")) if isinstance(v, dict) else v
    if not url:
        return ""
    return f"{url}{'&' if '?' in url else '?'}width={width}" if width else url


def _date(v, fmt=None):
    """Shopify's date filter ('now', timestamps, ISO dates; %-d, %s, %u work on every OS)."""
    if isinstance(v, dt.datetime):
        d = v
    elif str(v) in ("now", "today"):
        d = dt.datetime.now()
    elif isinstance(v, (int, float)) or str(v).lstrip("-").isdigit():
        d = dt.datetime.fromtimestamp(int(v))
    else:
        try:
            d = dt.datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        except ValueError:
            return v
    if not fmt:
        return str(v)
    for k, x in (("%-d", d.day), ("%-m", d.month), ("%-H", d.hour), ("%-I", d.hour % 12 or 12), ("%s", int(d.timestamp())), ("%u", d.isoweekday())):
        fmt = fmt.replace(k, str(x))
    return d.strftime(fmt)


def _json(v):
    # Same as Shopify: valid JSON, safe inside a <script> tag.
    return json.dumps(v, ensure_ascii=False).replace("</", "<\\/")


def _shopify_blank():
    """Shopify Liquid: nil, false and missing values are `blank` (python-liquid says they are not). Patched once."""
    from liquid.builtin.expressions import logical, primitive
    if getattr(logical, "_ob_orig_eq", None):
        return
    orig = logical._ob_orig_eq = logical._eq

    def eq(left, right):
        if isinstance(left, primitive.Blank) or isinstance(right, primitive.Blank):
            other = right if isinstance(left, primitive.Blank) else left
            if liquid.is_undefined(other) or other is None or other is False:
                return True
        return orig(left, right)
    logical._eq = eq


def _env():
    _shopify_blank()
    env = liquid.Environment(loader=liquid.CachingFileSystemLoader(THEME / "snippets", ext=".liquid"))
    env.filters.update({"money": _money, "money_without_trailing_zeros": _money_nz, "image_url": _image_url,
                        "asset_url": lambda name: ASSETS + str(name), "json": _json, "date": _date})
    return env


def page(product, bundle, bundle_id="editor-draft"):
    """Full HTML document: the bundle block in a 430 px column (phone width)."""
    shop = {"currency": "USD", "metafields": {"open_bundles": {"config": {"value": {"bundles": {bundle_id: bundle}}}}}}
    pages = {}
    if bundle.get("size_guide_page"):
        pages[bundle["size_guide_page"]] = {"content": "<p>Your size guide page shows here.</p>"}
    html = _env().get_template("ob-bundle").render(shop=shop, cart={"currency": {"iso_code": "USD"}}, product=product, pages=pages,
                                                   bundle_id=bundle_id, uid="", section=None, current_variant=None)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(bundle.get('title') or bundle_id)}</title>
<style>
*, *::before, *::after {{ box-sizing: border-box; }}
html, body {{ margin: 0; background: #fff; color: #121212; font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }}
button, input, select {{ font: inherit; }}
.editorpv {{ max-width: 430px; margin: 0 auto; padding: 16px 15px 40px; }}
</style></head><body><div class="editorpv">{html}</div>
<script src="/app/bundle-editor/preview-motion.js"></script></body></html>"""


def product_data(p):
    """Admin API product (bundles.RENDER_QUERY) -> the Liquid product object the snippets read."""
    opts = p.get("options") or []
    names = [o["name"] for o in opts]
    cents = lambda m: None if m in (None, "") else round(float(m) * 100)  # noqa: E731
    variants = []
    for v in (p.get("variants") or {}).get("nodes") or []:
        sel = {so["name"]: so["value"] for so in v.get("selectedOptions") or []}
        values = [sel.get(n) for n in names]
        variants.append({"id": int(v.get("legacyResourceId") or 0), "title": v.get("title"), "available": bool(v.get("availableForSale")),
                         "price": cents(v.get("price")) or 0, "compare_at_price": cents(v.get("compareAtPrice")), "options": values,
                         **{f"option{i + 1}": x for i, x in enumerate(values)},
                         "featured_image": {"src": v["image"]["url"]} if v.get("image") else None})
    first = next((v for v in variants if v["available"]), variants[0] if variants else None)
    images = [{"src": i["url"], "alt": i.get("altText") or ""} for i in (p.get("images") or {}).get("nodes") or []]
    return {"options": names, "images": images,
            "options_with_values": [{"name": o["name"], "values": [{"name": x["name"]} for x in o.get("optionValues") or []]} for o in opts],
            "variants": variants, "selected_or_first_available_variant": first,
            "featured_image": {"src": (p.get("featuredImage") or {}).get("url")} if p.get("featuredImage") else None}
