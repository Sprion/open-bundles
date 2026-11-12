"""Bundles: local data (data/bundles.json), validation, and the shop metafield the theme and the discount function read.

data/bundles.json is the source of truth:
  bundles:  { "<id>": { title, design, tiers: [...], style: {...}, ... } }
  products: { "gid://shopify/Product/<id>": { "handle", "bundle": "<default bundle>", "previews": [ids] } }
Every change is published at once to the shop metafield open_bundles.config (no theme push needed), together with
the running A/B tests (tests.py) and the optional stats URL (Connect to store window).
"""
import json
import os
import re
from datetime import datetime, timezone

import shopify

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
BUNDLES_FILE = os.path.join(DATA, "bundles.json")
TEMPLATES_FILE = os.path.join(DATA, "templates.json")
NAMESPACE, KEY = "open_bundles", "config"
DRAFT_ID = "editor-draft"
SAMPLE_MEDIA = "/media/demo/"


class BundleError(Exception):
    pass


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _read(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def _write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, path)


def load_bundles():
    data = _read(BUNDLES_FILE, {})
    data.setdefault("bundles", {})
    data.setdefault("products", {})
    return data


def load_templates():
    """Starting styles of the "Create a bundle" pop-up. Local only, never sent to the shop."""
    return _read(TEMPLATES_FILE, {}).get("templates", {})


BUNDLE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,40}$")


HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
STYLE_COLORS = ("text", "border", "selected_bg", "accent", "subtitle_color", "badge_bg", "badge_text", "tag_bg", "tag_text",
                "save_bg", "strike", "button", "button_text", "cards_bg", "block_title_color", "title_color", "price_color",
                "gift_bg", "gift_text", "timer_bg", "timer_text", "timer_accent", "highlight_text", "highlight_icon",
                "ladder_bg", "ladder_text", "ladder_accent", "link_color", "deal_bg", "deal_text_color", "unit_price_color", "banner_bg", "banner_text", "gift_line", "gift_note",
                "ladder_label_bg", "ship_dot", "plus_color", "save_text_color", "dot_color", "rows_line", "rows_num_color", "rows_label_color", "dd_border", "badge_ring", "mix_badge_bg", "mix_badge_text", "cta_wait",
                "tag_border", "sub_chip_bg", "sub_chip_border", "rows_free_bg", "custom_bg", "custom_border", "custom_arrow_bg", "gift_title_color", "gift_free_color",
                "gift_box_border", "ship_strong", "label_value_color", "btn_was_color", "ticket_bg", "ticket_text", "ticket_accent", "ticket_stub_bg", "ticket_stub_text", "note_color", "dd_text", "rows_hint_color", "pb_bar", "pb_hint", "pnum_bg", "pnum_text")
STYLE_SIZES = {"radius": (0, 30), "title_size": (10, 30), "subtitle_size": (9, 24), "price_size": (10, 32),
               "block_title_size": (10, 30), "spacing": (0, 30), "label_size": (8, 20), "badge_size": (8, 20),
               "unit_size": (9, 20), "swatch_size": (20, 90), "thumb_size": (24, 80), "plus_size": (8, 30), "dot_size": (12, 30), "badge_pad_in": (0, 30), "dot_border": (1, 4), "link_size": (10, 18), "gift_top": (0, 30), "chips_pad": (0, 40), "bar_pad_b": (0, 30), "gift_pad": (0, 20), "rows_num_w": (16, 50), "rows_size_w": (50, 160), "rows_col_gap": (0, 20), "chip_pad_y": (0, 12), "chip_pad_x": (0, 20), "chip_radius": (0, 20), "chip_size": (8, 16), "chip_top": (0, 24),
               "thumb_cap_size": (8, 16), "free_pad_y": (0, 8), "free_pad_x": (0, 12), "rows_hint_size": (9, 18), "dd_h": (28, 60), "rows_num_size": (9, 22),
               "rows_free_size": (7, 14), "rows_label_size": (9, 16), "dd_radius": (0, 16), "dd_size": (10, 18), "dd_swatch": (12, 40), "size_btn_w": (30, 80), "badge_ring_w": (0, 3), "pill_h": (30, 90), "pill_title_size": (10, 24), "pill_sub_size": (9, 18),
               "badge_left": (0, 40), "size_btn_h": (28, 60), "size_head_size": (10, 20), "mix_w": (50, 140), "mix_h": (50, 160), "mix_gap": (0, 20),
               "mix_badge_size": (8, 16), "pill_lh": (10, 30), "pill_pad": (0, 20), "mix_badge_radius": (0, 100), "cta_h": (36, 80), "cta_radius": (0, 40), "cta_size": (12, 22), "unitp_size": (10, 24), "totals_size": (12, 28), "deal_size": (10, 20),
               "deal_radius": (0, 20), "deal_pad_y": (0, 12), "deal_pad_x": (0, 20), "save_pad_y": (0, 12), "save_pad_x": (0, 20), "save_radius": (0, 20), "save_size": (9, 18), "save_gap": (0, 20),
               "hl_gap": (0, 20), "hl_top": (0, 24), "hl_size": (10, 20), "hl_icon": (10, 28), "badge_ear": (0, 16), "thumb_gap": (-20, 12), "ship_halo": (0, 8),
               "sel_border": (1, 4), "strike_size": (9, 24), "bar_pad_y": (4, 30), "bar_pad_x": (4, 30), "badge_radius": (0, 20),
               "badge_pad_x": (2, 24), "badge_top": (0, 20), "gift_size": (10, 20), "gift_note_size": (9, 18), "ladder_title_size": (9, 18),
               "ladder_item_size": (8, 16), "ladder_pic": (24, 80), "row_height": (0, 140), "row_gap": (0, 30), "badge_space": (0, 30),
               "title_lh": (10, 40), "unit_lh": (10, 40), "unit_gap": (0, 20), "price_lh": (10, 40), "strike_lh": (10, 40), "price_gap": (0, 20),
               "badge_pad_y": (0, 12), "badge_lh": (10, 30), "badge_right": (0, 40), "thumb_h": (20, 120), "edge": (0, 24),
               "sw_radius": (0, 30), "sw_pad": (0, 8), "tag_radius": (0, 20), "tag_pad_y": (0, 10), "tag_pad_x": (0, 16), "tag_size": (8, 18), "rows_color_w": (60, 260), "rows_indent": (0, 60),
               "gift_img": (20, 80), "gift_title_size": (10, 20), "gift_name_size": (10, 20), "ship_size": (9, 20), "note_size": (9, 18), "custom_size": (10, 22), "chips_gap": (0, 16), "sub_chip_size": (8, 18), "price_strike_gap": (0, 16), "rows_hint_top": (0, 30), "rows_gap": (0, 24), "thumb_stack_x": (0, 40), "thumb_stack_y": (0, 30), "mix_name_size": (8, 14), "rows_hint_x": (0, 40), "sub_lh": (10, 40), "thumb_cap_lh": (8, 24)}
STYLE_ENUMS = {"badge_style": ("floating", "inline", "ribbon", "tab", "cap", "foot", "chip"), "subtitle_style": ("normal", "italic", "chip"), "swatch_shape": ("circle", "rounded", "square"),
               "banner_style": ("plain", "line", "box"),
               "price_layout": ("inline", "stack", "after"), "gift_style": ("strip", "line", "check", "none", "box"), "button_price": ("text", "pill", "plain", "pipe"), "ship_style": ("box", "dashed", "plain", "caps"),
               "tracking": ("theme", "normal", "tight"), "font": ("theme", "system"), "badge_case": ("upper", "none"), "mix_label": ("name", "none"), "mix_pic": ("stack", "single", "none"), "dot_style": ("dot", "fill", "solid", "ring"), "rows_hint_align": ("center", "left"),
               "tag_case": ("upper", "none"), "chip_case": ("upper", "none"), "cta_case": ("upper", "none"), "sw_ratio": ("portrait", "square"), "dd_caret": ("chevron", "triangle"),
               "rows_free_style": ("number", "row"), "ship_position": ("above", "below"), "size_label": ("show", "none"), "banner_look": ("text", "ticket"), "il_size_pos": ("end", "after"), "custom_style": ("card", "link", "button"),
               **{k: (400, 500, 600, 700, 800) for k in ("block_title_weight", "title_weight", "subtitle_weight", "label_weight",
                                                    "badge_weight", "unit_weight", "gift_weight", "ladder_title_weight", "plus_weight", "save_weight", "strike_weight", "price_weight", "pill_weight", "pill_on_weight", "totals_weight", "deal_weight", "cta_weight", "tag_weight", "rows_num_weight", "gift_name_weight", "sub_chip_weight", "custom_weight", "dd_weight", "label_value_weight", "gift_title_weight")}}
BUNDLE_FLAGS = ("hide_title", "cta_no_mark", "gifts_below_picker", "hide_nudge", "hide_compare", "total_in_button", "skip_cart", "hide_save", "one_variant", "hide_unavailable", "require_selection")
DESIGNS = ("classic", "cards", "boxed", "pack")
LAYOUTS = ("columns", "grid", "compact", "pills")
ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$")


def _clean_gift(g):
    """One gift (bar gift or Gifts unlocked panel): free product variant or free shipping."""
    text = str(g.get("text") or "").strip()[:80]
    note = str(g.get("note") or "").strip()[:80]
    if g.get("type") == "shipping":
        gift = {"type": "shipping", "text": text or "+ FREE shipping", **({"note": note} if note else {}), **({"in_bar": False} if g.get("in_bar") is False else {})}
        if str(g.get("value") or "").strip():
            gift["value"] = round(max(0.0, float(g["value"])), 2)
        return gift
    if g.get("type") == "product" and g.get("sample"):
        gift = {"type": "product", "variant": 0, "sample": True, "handle": "", "title": str(g.get("title") or "Sample gift")[:120],
                "price": round(float(g.get("price") or 0), 2), "text": text or "+ FREE Gift", "image": "/media/demo/gift.webp?s=1",
                "image_size": max(16, min(80, int(float(g.get("image_size") or 30))))}
        if note:
            gift["note"] = note
        for k in ("show_price", "in_compare"):
            if g.get(k):
                gift[k] = True
        if g.get("in_bar") is False:
            gift["in_bar"] = False
        return gift
    if g.get("type") != "product" or not str(g.get("variant") or "").isdigit():
        return None
    gift = {"type": "product", "variant": int(g["variant"]), "handle": str(g.get("handle") or "")[:120],
            "title": str(g.get("title") or "")[:120], "price": round(float(g.get("price") or 0), 2),
            "text": text or "+ FREE Gift", "image_size": max(16, min(80, int(float(g.get("image_size") or 30))))}
    if note:
        gift["note"] = note
    if g.get("in_bar") is False:  # still added and free, only not listed in the bar
        gift["in_bar"] = False
    if str(g.get("image") or "").startswith("https://cdn.shopify.com/"):
        gift["image"] = str(g["image"])[:500]
    for k in ("show_price", "in_compare"):
        if g.get(k):
            gift[k] = True
    # the shopper picks the gift's variant (size, colour) on the product page
    if g.get("choose") and str(g.get("product") or "").isdigit():
        gift["choose"], gift["product"] = True, int(g["product"])
    return gift


# Words the bundle block shows (theme defaults, English). bundle.ui overrides any of them from the editor, so a store in
# another language or tone never edits Liquid or JS. Value: (default, max length).
UI_TEXTS = {
    "free": ("FREE", 20), "sold_out": ("Sold out", 30), "locked": ("Locked", 20), "select": ("Select", 20),
    "add_one": ("Add to cart", 40), "add_many": ("Add {{count}} {{noun}} to cart", 60), "adding": ("Adding…", 30),
    "add_error": ("Unable to add to cart. Please try again.", 100), "choose_options": ("Choose your options", 40),
    "select_size": ("Select a size", 40), "choose_sizes": ("Choose {{unit}} sizes", 40), "choose_size": ("Choose a size.", 40),
    "size_guide": ("Size guide", 30), "done": ("Done", 20), "apply_all": ("Apply to all ({{count}})", 40),
    "custom_mix": ("Custom Pack", 30), "no_size_guide": ("Size measurements for this product are not available yet. Please contact us before ordering.", 200), "more": ("+{{count}} More", 20), "combo_sold_out": ("This combination is sold out. Choose another size or colour.", 120),
    "pb_title": ("Build your own pack", 50), "pb_size": ("1. Choose your size", 50), "pb_colors": ("2. Add your colours", 50),
    "pb_count": ("{{count}} {{noun}} in your pack", 60), "pb_next": ("Add {{left}} more: {{next}}", 80), "pb_min": ("Add at least {{min}} {{noun}}", 60),
    "pb_best": ("From {{unit_price}} / {{unit}}", 50), "save_tag": ("Save {{saved}}", 30), "pb_cta": ("Add {{count}} {{noun}} to cart · {{price}}", 60), "pb_back": ("Close", 20),
}


def _clean_bundle(b):
    """Validate a bundle from the editor. Boxes are free-form: bought + free units, and an optional saving on
    the bought units: percent, amount off, or a fixed total price. Style values are hex colours and numbers only,
    since the theme writes them into CSS."""
    tiers = []
    for t in b.get("tiers") or []:
        buy, free = int(t.get("buy") or 0), int(t.get("free") or 0)
        if buy < 1 or free < 0 or buy + free > 50:
            raise BundleError("Each box needs 1+ bought units (and at most 50 units)")
        tier = {"buy": buy, "label": str(t.get("label") or "").strip()[:60] or f"{buy + free}"}
        if free:
            tier["free"] = free
        off = t.get("off") or {}
        if off.get("type") in ("percent", "amount", "price") and float(off.get("value") or 0) > 0:
            value = float(off["value"])
            if off["type"] == "percent" and value > 100:
                raise BundleError("A percent saving is at most 100")
            tier["off"] = {"type": off["type"], "value": round(value, 2)}
        for k in ("sub", "badge", "tag", "save_text", "short"):  # short: name after the block title ("Quantity: 3"); save_text: this bar's saving pill, over the bundle's
            if str(t.get(k) or "").strip():
                tier[k] = str(t[k]).strip()[:80]
        # Per-bar badge look (the Badges section of the editor); empty keys fall back to the bundle style.
        if tier.get("badge"):
            if t.get("badge_style") in STYLE_ENUMS["badge_style"]:
                tier["badge_style"] = t["badge_style"]
            for k in ("badge_color", "badge_bg"):
                if t.get(k):
                    if not HEX_RE.match(str(t[k])):
                        raise BundleError(f"Badge colour {k}: use #RRGGBB")
                    tier[k] = str(t[k]).lower()
            if t.get("badge_size") not in (None, ""):
                tier["badge_size"] = max(8, min(20, int(float(t["badge_size"]))))
        if t.get("default"):
            tier["default"] = True
        # Value shown in the ticket banner while this bar is selected ("3" tickets); empty hides the banner.
        if str(t.get("banner_value") or "").strip():
            tier["banner_value"] = str(t["banner_value"]).strip()[:12]
        # Image in place of the radio dot (picked from the store's Files), and "show as sold out".
        img = t.get("image") or {}
        if str(img.get("url") or "").startswith(("https://cdn.shopify.com/", "/media/demo/")):
            tier["image"] = {"url": str(img["url"])[:500], "size": max(20, min(120, int(float(img.get("size") or 48)))),
                             "radius": max(0, min(60, int(float(img.get("radius") or 6))))}
        if t.get("sold_out"):
            tier["sold_out"] = True
        # Default variant of each item of the bar [{color, size}].
        defaults = [{k: str(d.get(k) or "")[:60] for k in ("color", "size") if d.get(k)} for d in (t.get("defaults") or [])[:50] if isinstance(d, dict)]
        if any(defaults):
            tier["defaults"] = defaults
        gifts = [x for x in (_clean_gift(g) for g in (t.get("gifts") or [])[:3]) if x]
        if gifts:
            tier["gifts"] = gifts
        # Highlights: check list under the bar (shown when it is selected, or always: bundle highlights_mode).
        hl = [str(x).strip()[:80] for x in (t.get("highlights") or [])[:6] if str(x).strip()]
        if hl:
            tier["highlights"] = hl
        # Countdown chip on this bar (the timer itself is the bundle's countdown).
        if t.get("countdown"):
            tier["countdown"] = True
        # Pack design: preset colour mixes of this bar (one colour per item, photo tiles).
        mixes = []
        for m in (t.get("mixes") or [])[:8]:
            colors = [str(c).strip()[:60] for c in (m.get("colors") or [])[:50] if str(c).strip()]
            if colors:
                mx = {"name": str(m.get("name") or "").strip()[:30], "badge": str(m.get("badge") or "").strip()[:24], "colors": colors}
                if str(m.get("image") or "").startswith("https://cdn.shopify.com/"):
                    mx["image"] = str(m["image"])[:500]
                mixes.append(mx)
        if mixes:
            tier["mixes"] = mixes
        tiers.append(tier)
    if not 1 <= len(tiers) <= 10:
        raise BundleError("A bundle has 1 to 10 boxes")
    style = {}
    for k, v in (b.get("style") or {}).items():
        if k in STYLE_COLORS and v:
            if not HEX_RE.match(str(v)):
                raise BundleError(f"Colour {k}: use #RRGGBB")
            style[k] = str(v).lower()
        elif k in STYLE_ENUMS and (v in STYLE_ENUMS[k] or str(v).isdigit() and int(v) in STYLE_ENUMS[k]):
            style[k] = int(v) if str(v).isdigit() else v
        elif k in STYLE_SIZES and v not in (None, ""):
            lo, hi = STYLE_SIZES[k]
            x = max(lo, min(hi, round(float(v) * 2) / 2))
            style[k] = int(x) if float(x).is_integer() else x
    out = {"title": str(b.get("title") or "").strip()[:60] or "Bundle", "banner": str(b.get("banner") or "").strip()[:80],
           "block_title": str(b.get("block_title") or "").strip()[:60] or "Choose your offer",
           "cta_noun": str(b.get("cta_noun") or "items").strip()[:20], "unit_noun": str(b.get("unit_noun") or "item").strip()[:20],
           "show_unit": b.get("show_unit", True) is not False, "tiers": tiers,
           # Designs: classic (rows), cards, boxed, pack.
           "design": b.get("design") if b.get("design") in DESIGNS else "cards"}
    if style:
        out["style"] = style
    for k in BUNDLE_FLAGS:
        if b.get(k):
            out[k] = True
    # Swatches: variant photos (default) or plain colours per option value.
    sw = b.get("swatches") or {}
    if sw.get("type") == "color":
        colors = {str(k)[:60]: str(v).lower() for k, v in (sw.get("colors") or {}).items() if HEX_RE.match(str(v))}
        if colors:
            out["swatches"] = {"type": "color", "colors": colors}
    # Preselected variant (option values, e.g. "Black" / "M").
    for k in ("default_color", "default_size"):
        if str(b.get(k) or "").strip():
            out[k] = str(b[k]).strip()[:60]
    # Line above the product title (render ob-offer-promo... optional), follows the visitor's bundle version.
    if str(b.get("page_line") or "").strip():
        out["page_line"] = str(b["page_line"]).strip()[:140]
    # Saving pill: text (Boxed design default "You save {{saved_total}}"; the other layouts show it only when
    # a text is set) and where it sits: below the title, inline next to it, or under the price.
    if str(b.get("save_text") or "").strip():
        out["save_text"] = str(b["save_text"]).strip()[:80]
    # Product the bundle is set up on: the editor preview, prices and variant lists use it.
    if re.fullmatch(r"[a-z0-9][a-z0-9-]{0,120}", str(b.get("product") or "")):
        out["product"] = b["product"]
    # Layout of the bars : list (default, stacked), columns (side by side), grid (2 per row), compact.
    if b.get("layout") in LAYOUTS:
        out["layout"] = b["layout"]
    if b.get("save_position") in ("inline", "price"):
        out["save_position"] = b["save_position"]
    for k in ("size_first", "cta_arrow", "gifts_selected_only"):  # sizes chosen once above the bars; arrow at the end of the button
        if b.get(k) is True:
            out[k] = True
    for k, n in (("unit_text", 60), ("deal_label", 60), ("cta_text", 40), ("cta_wait_text", 40)):  # cta_text: button text ({{quantity}}, {{price}})  # "{{unit_price}} per item"; middle text of the deal line
        if isinstance(b.get(k), str) and b[k].strip():
            out[k] = b[k].strip()[:n]
    # Picture at the start of each bar: "" = the bar's own image (chosen in the editor), stack = the product's photos of the
    # bar's items (+ free items), number = "#1", dot = a small dot, none = nothing.
    if b.get("bar_thumbs") in ("stack", "photo", "number", "dot", "none"):
        out["bar_thumbs"] = b["bar_thumbs"]
    ui = {}
    for k, v in (b.get("ui") or {}).items():
        if k in UI_TEXTS and isinstance(v, str) and v.strip() and v.strip() != UI_TEXTS[k][0]:
            ui[k] = v.strip()[:UI_TEXTS[k][1]]
    if ui:
        out["ui"] = ui
    # Build your own pack (pop-up on the same product page): smallest number of items it accepts.
    if b.get("pb_min") not in (None, ""):
        out["pb_min"] = max(1, min(20, int(float(b["pb_min"]))))
    if b.get("apply_all") == "both":  # "Apply to all" in the item sheet copies the colour too (default: the size only)
        out["apply_all"] = "both"
    if b.get("rows_labels") is True:  # drop-down rows with Color / Size labels, item number, FREE under free items
        out["rows_labels"] = True
    if isinstance(b.get("rows_hint"), str) and b["rows_hint"].strip():
        out["rows_hint"] = b["rows_hint"].strip()[:140]
    if b.get("tag_position") == "top":  # tag as a chip on the bar's top border, next to its countdown
        out["tag_position"] = "top"
    # Countdown: midnight (visitor's local midnight, every day), fixed (end date) or evergreen (N minutes per visitor).
    cd = b.get("countdown") or {}
    if cd.get("mode") in ("midnight", "fixed", "evergreen"):
        c = {"mode": cd["mode"], "label": str(cd.get("label") or "Ends in").strip()[:40]}
        if cd["mode"] == "fixed":
            if not ISO_RE.match(str(cd.get("end") or "")):
                raise BundleError("Countdown end: use YYYY-MM-DDTHH:MM")
            c["end"] = str(cd["end"])
        if cd["mode"] == "evergreen":
            c["minutes"] = max(1, min(10080, int(float(cd.get("minutes") or 15))))
        if cd.get("in_banner"):
            c["in_banner"] = True
        out["countdown"] = c
    if b.get("highlights_mode") == "always":
        out["highlights_mode"] = "always"
    # First bar shown as a text link under the bars ("Buy once: $90 (no savings)").
    if b.get("first_link"):
        out["first_link"] = True
        out["first_link_text"] = str(b.get("first_link_text") or "").strip()[:80] or "Buy once: {{price}}"
    # Gifts unlocked panel: gifts defined once, each unlocked from a bar (0 = first). At sync they are added to the
    # gifts of every bar from that one, so the cart and the discount function treat them as bar gifts.
    gl = b.get("gift_ladder") or {}
    items = []
    for g in (gl.get("items") or [])[:6]:
        x = _clean_gift(g)
        if x:
            x.pop("choose", None)
            x.pop("product", None)
            x["from"] = max(0, min(len(tiers) - 1, int(float(g.get("from") or 0))))
            items.append(x)
    if items:
        out["gift_ladder"] = {"title": str(gl.get("title") or "").strip()[:40] or "Gifts unlocked", "items": items}
        if gl.get("in_bars"):
            out["gift_ladder"]["in_bars"] = True
    # Pack design texts: deal line under the price, title and hint of the item tiles.
    for k, n in (("deal_text", 80), ("deal_note", 80), ("single_note", 80), ("items_title", 40), ("items_hint", 40), ("ship_text", 100), ("ship_note", 80),
                 ("gift_title", 40), ("size_guide_text", 30), ("custom_text", 60), ("bars_note", 120), ("banner_title", 40), ("banner_unit", 20), ("rows_free_text", 20)):
        if str(b.get(k) or "").strip():
            out[k] = str(b[k]).strip()[:n]
    # Link card under the bars ("Build your own pack"): a store path or an https link.
    url = str(b.get("custom_url") or "").strip()
    if re.fullmatch(r"(/[\w\-/?=&%.]*|https://[\w\-.]+(/[\w\-/?=&%.]*)?)", url):
        out["custom_url"] = url[:200]
    # Delivery date words: English (default) or another language, short (Mon, Nov 16) or long (Monday 16 November).
    if b.get("ship_locale") in ("en", "fr", "de", "es", "it", "nl"):
        out["ship_locale"] = b["ship_locale"]
    if b.get("ship_date") in ("short", "long"):
        out["ship_date"] = b["ship_date"]
    # Item picker (default from the design: swatches for Rows/Cards, rows for Boxed, tiles for Pack),
    # price summary under the pickers (default on for Pack) and shipping line (default on for Boxed and Pack).
    if b.get("picker") in ("swatches", "rows", "tiles", "inline"):
        out["picker"] = b["picker"]
    for k in ("summary", "ship_line"):
        if b.get(k) in (True, False):
            out[k] = b[k]
    # Struck price = price x N on every bar (the red "was" price of the Boxed page); 1 = the product's own.
    mult = float(b.get("compare_multiplier") or 1)
    if mult > 1:
        out["compare_multiplier"] = round(min(mult, 5), 2)
    # Custom CSS goes into a <style> tag on the product page: no closing tags.
    css = str(b.get("css") or "").replace("</", "").strip()[:5000]
    if css:
        out["css"] = css
    # Size guide (handle of a store page), delivery days of the delivery line, reassurance lines under the button.
    if re.fullmatch(r"[a-z0-9][a-z0-9-]{0,120}", str(b.get("size_guide_page") or "")):
        out["size_guide_page"] = b["size_guide_page"]
    if b.get("ship_days") not in (None, "", 5):
        out["ship_days"] = max(1, min(60, int(float(b["ship_days"]))))
    for k in ("assure_1", "assure_2"):
        if str(b.get(k) or "").strip():
            out[k] = str(b[k]).strip()[:60]
    return out

# ---------- saving and publishing ----------

def save_bundle(bundle_id, bundle):
    """Create or replace a bundle, then publish the config (live on the theme at once)."""
    if not BUNDLE_ID_RE.match(bundle_id or ""):
        raise BundleError("Bundle id: lowercase letters, digits and dashes")
    clean = _clean_bundle(bundle or {})
    left = _samples_left(clean) if bundle_id != DRAFT_ID else []
    if left:
        raise BundleError("Replace the template's sample items with your own first: " + ", ".join(left))
    cfg = load_bundles()
    created = (cfg["bundles"].get(bundle_id) or {}).get("created") or now()
    cfg["bundles"][bundle_id] = {**clean, "created": created}
    _write(BUNDLES_FILE, cfg)
    sync()
    return cfg["bundles"][bundle_id]


def delete_bundle(bundle_id):
    import tests
    cfg = load_bundles()
    used = [p.get("handle") or pid for pid, p in cfg["products"].items() if p.get("bundle") == bundle_id]
    used += [t["id"] for t in tests.load()["tests"] if t["status"] != "concluded" and bundle_id in t["bundles"].values()]
    if used:
        raise BundleError("Bundle in use (product or test): " + ", ".join(used))
    cfg["bundles"].pop(bundle_id, None)
    for pid in list(cfg["products"]):
        p = cfg["products"][pid]
        if p.get("previews"):
            p["previews"] = [x for x in p["previews"] if x != bundle_id]
        _tidy(cfg, pid)
    _write(BUNDLES_FILE, cfg)
    sync()


def product_id(handle):
    p = shopify.graphql("query($h: String!) { productByIdentifier(identifier: {handle: $h}) { id } }", {"h": handle}).get("productByIdentifier")
    if not p:
        raise BundleError(f"No product '{handle}'")
    return p["id"]


def _tidy(cfg, pid):
    p = cfg["products"].get(pid)
    if p is not None:
        if not p.get("previews"):
            p.pop("previews", None)
        if not p.get("bundle") and not p.get("previews"):
            cfg["products"].pop(pid)


def set_product_bundle(handle, bundle_id):
    """Default bundle of a product page (empty = no bundle on that page)."""
    cfg = load_bundles()
    pid = product_id(handle)
    if bundle_id:
        if bundle_id not in cfg["bundles"]:
            raise BundleError(f"No bundle '{bundle_id}'")
        cfg["products"].setdefault(pid, {})["bundle"] = bundle_id
        cfg["products"][pid]["handle"] = handle
    elif pid in cfg["products"]:
        cfg["products"][pid].pop("bundle", None)
        _tidy(cfg, pid)
    _write(BUNDLES_FILE, cfg)
    sync()
    return cfg


def preview_bundle(handle, bundle_id, on=True):
    """Make a bundle viewable on a product page with ?ob=<bundle id>, without assigning it (looks only:
    checkout charges the product's own bundle)."""
    cfg = load_bundles()
    if bundle_id not in cfg["bundles"]:
        raise BundleError(f"No bundle '{bundle_id}'")
    pid = product_id(handle)
    prod = cfg["products"].setdefault(pid, {"handle": handle})
    prev = [x for x in prod.get("previews", []) if x != bundle_id and x in cfg["bundles"]]
    if on:
        prev.append(bundle_id)
    prod["previews"] = prev[-8:]
    _tidy(cfg, pid)
    _write(BUNDLES_FILE, cfg)
    sync()
    return prod


def preview_draft(handle, bundle):
    """The editor's "Open" button: the unsaved bundle is stored as the editor-draft bundle and shown alone on the
    product page with ?ob=editor-draft&ob_solo=editor-draft. Returns that URL."""
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,120}", handle or ""):
        raise BundleError("Pick a product for the preview")
    save_bundle(DRAFT_ID, {**(bundle or {}), "title": "Editor draft (preview only)"})
    cfg = load_bundles()
    if not any(DRAFT_ID in (p.get("previews") or []) and p.get("handle") == handle for p in cfg["products"].values()):
        preview_bundle(handle, DRAFT_ID, True)
    theme = shopify.setting("SHOPIFY_PREVIEW_THEME_ID")
    base = shopify.setting("SHOP_URL").rstrip("/") or f"https://{shopify.store()}"
    query = (f"preview_theme_id={theme}&" if theme else "") + f"ob={DRAFT_ID}&ob_solo={DRAFT_ID}"
    return {"url": f"{base}/products/{handle}?{query}"}


def _expand_ladder(b):
    """Gifts unlocked panel -> bar gifts: every bar gets the panel's gifts unlocked at or before it (flag ladder)."""
    for i, t in enumerate(b.get("tiers") or []):
        for g in (b.get("gift_ladder") or {}).get("items", []):
            if g["from"] > i:
                continue
            if not any(x.get("type") == g["type"] and x.get("variant") == g.get("variant") for x in t.get("gifts", [])):
                t.setdefault("gifts", []).append({**{k: v for k, v in g.items() if k != "from"}, "ladder": True})


def config():
    """What the theme and the discount function read: bundles, product pages, running tests, stats URL."""
    import tests
    cfg = load_bundles()
    for b in cfg["bundles"].values():
        _expand_ladder(b)
    out = {"bundles": cfg["bundles"], "products": json.loads(json.dumps(cfg["products"])), "tests": {}}
    for t in tests.load()["tests"]:
        if t["status"] != "running":
            continue
        prod = out["products"].setdefault(t["productId"], {"handle": t["handle"], "bundle": t["bundles"].get("a")})
        prod.setdefault("tests", {})[t["id"]] = dict(t["bundles"])
        out["tests"][t["id"]] = {v["key"]: v["weight"] for v in t["versions"]}
    stats = shopify.setting("STATS_URL")
    if stats:
        out["collector"] = stats
    return out


def sync():
    """Publish config() to the shop metafield open_bundles.config (demo mode: nothing is sent)."""
    data = config()
    if not shopify.connected():
        return data
    shop = shopify.graphql("{ shop { id } }")["shop"]["id"]
    r = shopify.graphql("mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { message } } }",
                        {"m": [{"ownerId": shop, "namespace": NAMESPACE, "key": KEY, "type": "json", "value": json.dumps(data)}]})["metafieldsSet"]
    if r["userErrors"]:
        raise BundleError("Metafield: " + "; ".join(e["message"] for e in r["userErrors"]))
    return data


# ---------- store data for the editor (read only) ----------

PRODUCTS_QUERY = """query($after: String) { products(first: 250, after: $after, sortKey: TITLE) {
  pageInfo { hasNextPage endCursor }
  nodes { handle title status featuredImage { url } priceRangeV2 { minVariantPrice { amount } } } } }"""


def list_products():
    """Products a visitor can open (active and unlisted)."""
    out, after = [], None
    while True:
        page = shopify.graphql(PRODUCTS_QUERY, {"after": after})["products"]
        out += [{"handle": n["handle"], "title": n["title"], "unlisted": n["status"] == "UNLISTED",
                 "price": float(((n.get("priceRangeV2") or {}).get("minVariantPrice") or {}).get("amount") or 0),
                 "image": (n.get("featuredImage") or {}).get("url")}
                for n in page["nodes"] if n["status"] in ("ACTIVE", "UNLISTED")]
        if not page["pageInfo"]["hasNextPage"]:
            return out
        after = page["pageInfo"]["endCursor"]


OPTIONS_QUERY = """query($h: String!) { productByIdentifier(identifier: {handle: $h}) {
  featuredImage { url } options { name values } variants(first: 100) { nodes { selectedOptions { name value } image { url } } } } }"""


def product_options(handle):
    """Colour and size choices of a product, with one photo per colour."""
    p = shopify.graphql(OPTIONS_QUERY, {"h": handle}).get("productByIdentifier") or {}
    opts = p.get("options") or []
    color = next((o for o in opts if re.search(r"colou?r|couleur|farbe", o["name"], re.I)), None)
    size = next((o for o in opts if o is not color), None)
    images = {}
    for v in (p.get("variants") or {}).get("nodes") or []:
        for so in v["selectedOptions"]:
            if color and so["name"] == color["name"] and v.get("image"):
                images.setdefault(so["value"], v["image"]["url"])
    fallback = (p.get("featuredImage") or {}).get("url")
    return {"colors": [{"name": c, "image": images.get(c) or fallback} for c in (color or {}).get("values", [])],
            "sizes": (size or {}).get("values", []), "colorName": (color or {}).get("name", "Color"), "sizeName": (size or {}).get("name", "Size")}


IMAGES_QUERY = """query($q: String, $after: String) { files(first: 40, after: $after, query: $q, sortKey: CREATED_AT, reverse: true) {
  pageInfo { hasNextPage endCursor } nodes { ... on MediaImage { id alt image { url width height } } } } }"""


def list_images(search="", after=None):
    """Images of the store's Files (Content > Files), newest first, for the bar image picker."""
    q = "media_type:IMAGE" + (f" {search.strip()}" if search.strip() else "")
    page = shopify.graphql(IMAGES_QUERY, {"q": q, "after": after})["files"]
    return {"images": [{"url": n["image"]["url"], "alt": n.get("alt") or ""} for n in page["nodes"] if n.get("image")],
            "next": page["pageInfo"]["endCursor"] if page["pageInfo"]["hasNextPage"] else None}


VARIANTS_QUERY = """query($q: String) { products(first: 20, query: $q, sortKey: TITLE) { nodes { legacyResourceId handle title
  featuredImage { url } variants(first: 30) { nodes { legacyResourceId title price image { url } } } } } }"""


def search_variants(search=""):
    """Products and their variants for the gift picker."""
    q = "status:active OR status:unlisted" + (f" AND {search.strip()}" if search.strip() else "")
    out = []
    for p in shopify.graphql(VARIANTS_QUERY, {"q": q})["products"]["nodes"]:
        img = (p.get("featuredImage") or {}).get("url")
        out.append({"id": int(p["legacyResourceId"]), "handle": p["handle"], "title": p["title"], "variants": [
            {"id": int(v["legacyResourceId"]), "title": v["title"], "price": float(v["price"]), "image": (v.get("image") or {}).get("url") or img}
            for v in p["variants"]["nodes"]]})
    return {"products": out}


# ---------- preview (drawn locally by the theme's own snippets, render.py) ----------

RENDER_QUERY = """query($h: String!) { productByIdentifier(identifier: {handle: $h}) { featuredImage { url } images(first: 60) { nodes { url altText } }
  options { name optionValues { name } } variants(first: 100) { nodes { legacyResourceId title availableForSale price compareAtPrice
  selectedOptions { name value } image { url } } } } }"""


def sample_product():
    """Neutral sample product of the preview when a bundle has no product yet (pictures in media/demo/)."""
    colors, sizes, price = ["Black", "Charcoal", "White", "Grey"], ["XS", "S", "M", "L", "XL"], 4995
    variants, vid = [], 9000000000
    for c in colors:
        for s in sizes:
            vid += 1
            variants.append({"id": vid, "title": f"{c} / {s}", "available": True, "price": price, "compare_at_price": None,
                             "options": [c, s], "option1": c, "option2": s, "featured_image": {"src": f"{SAMPLE_MEDIA}{c.lower()}.webp?s=1"}})
    return {"title": "Sample product", "options": ["Color", "Size"], "images": [{"src": f"{SAMPLE_MEDIA}{c.lower()}.webp?s=1", "alt": c} for c in colors],
            "options_with_values": [{"name": "Color", "values": [{"name": c} for c in colors]}, {"name": "Size", "values": [{"name": s} for s in sizes]}],
            "variants": variants, "selected_or_first_available_variant": variants[0], "featured_image": {"src": f"{SAMPLE_MEDIA}black.webp?s=1"}}


def _samples_left(b):
    """Template placeholders still in a bundle (sample gifts, sample bar pictures): replaced before saving."""
    left = []
    for i, t in enumerate(b.get("tiers") or []):
        if any(g.get("sample") for g in t.get("gifts") or []):
            left.append(f"bar {i + 1}: sample gift")
        if str((t.get("image") or {}).get("url") or "").startswith(SAMPLE_MEDIA):
            left.append(f"bar {i + 1}: sample picture")
    if any(g.get("sample") for g in (b.get("gift_ladder") or {}).get("items") or []):
        left.append("Gifts unlocked: sample gift")
    return left


def render_preview(handle, bundle):
    """Editor preview: the unsaved bundle drawn by the theme's snippets for this product (reads the product only)."""
    import render
    if handle and not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,120}", handle):
        raise BundleError("Invalid product handle")
    b = _clean_bundle(bundle or {})
    _expand_ladder(b)
    if not handle:
        return render.page(sample_product(), b)
    p = shopify.graphql(RENDER_QUERY, {"h": handle}).get("productByIdentifier")
    if not p:
        raise BundleError(f"No product '{handle}'")
    return render.page(render.product_data(p), b)


DISCOUNT_TITLE = "Open Bundles"


def create_discount():
    """The automatic discount that runs the bundle function (handle open-bundles): bundle prices (product discount) and
    the free shipping of bundles that offer it. Created once; does nothing if it already exists."""
    found = shopify.graphql("""{ discountNodes(first: 50, query: "title:'Open Bundles'") { nodes { id discount { __typename
      ... on DiscountAutomaticApp { title status } } } } }""")["discountNodes"]["nodes"]
    for n in found:
        d = n.get("discount") or {}
        if d.get("__typename") == "DiscountAutomaticApp" and d.get("title") == DISCOUNT_TITLE:
            return {"created": False, "status": d.get("status"), "message": "The bundle discount already exists"}
    r = shopify.graphql("""mutation($d: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $d) { automaticAppDiscount { discountId status } userErrors { message } } }""",
                        {"d": {"title": DISCOUNT_TITLE, "functionHandle": "open-bundles", "startsAt": now(),
                               "discountClasses": ["PRODUCT", "SHIPPING"],
                               "combinesWith": {"orderDiscounts": True, "productDiscounts": False, "shippingDiscounts": False}}})
    out = r["discountAutomaticAppCreate"]
    if out["userErrors"]:
        raise BundleError("Shopify: " + "; ".join(e["message"] for e in out["userErrors"]) +
                          " (is the function deployed with shopify app deploy and the app installed?)")
    return {"created": True, "status": out["automaticAppDiscount"]["status"], "message": "Bundle discount created"}
