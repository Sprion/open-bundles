"""Thumbnails of the "Create a bundle" pop-up: each template of data/templates.json drawn by the editor preview with
the sample product, from the top of the block to its button, 480 px wide, saved as media/looks/<id>.webp.
Needs the editor running (python editor/server.py) and Playwright (pip install playwright && playwright install chromium).
Nothing is saved: the pop-up only opens an unsaved editor."""
import io
import os
import sys

from PIL import Image, ImageOps
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "media", "looks")
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787/"
CLIP = """() => {
  const b = document.querySelector('.ob'); const btns = [...document.querySelectorAll('.ob__cta')].filter((x) => x.offsetHeight);
  const r = b.getBoundingClientRect(); let bottom = r.bottom;
  for (const x of btns) { const q = x.getBoundingClientRect(); if (q.top >= r.top && q.top - r.bottom < 160) bottom = Math.max(bottom, q.bottom); }
  return {x: r.left - 2, y: r.top - 16, width: r.width + 4, height: bottom - r.top + 16};
}"""

os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    br = p.chromium.launch(channel=os.environ.get("PW_CHANNEL") or None)  # PW_CHANNEL=msedge / chrome: use an installed browser
    pg = br.new_page(viewport={"width": 1280, "height": 1000}, device_scale_factor=2)
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.route("**/api/bundles/**", lambda r, q: r.abort() if q.method == "POST" and "/render/" not in q.url else r.continue_())
    pg.goto(URL, wait_until="networkidle")
    ids = pg.evaluate("fetch('/api/bundles').then((r) => r.json()).then((x) => Object.keys(x.templates || {}))")
    for tid in ids:
        pg.goto(URL, wait_until="networkidle")
        pg.click("[data-new]")
        pg.click(f'[data-pick="{tid}"]')
        pg.wait_for_timeout(2500)
        el = pg.locator(".bl__new [data-pvframe]")
        box = el.bounding_box()
        f = el.element_handle().content_frame()
        if f.evaluate("document.body.innerText.includes('Preview failed')"):
            print(tid, "PREVIEW FAILED:", f.evaluate("document.body.innerText")[:300])
            continue
        f.evaluate("document.querySelector('.ob').scrollIntoView({block: 'start'})")
        pg.wait_for_timeout(300)
        c = f.evaluate(CLIP)
        im = Image.open(io.BytesIO(el.screenshot())).convert("RGB")
        k = im.width / box["width"]
        crop = im.crop((round(c["x"] * k), round(max(0, c["y"]) * k), round((c["x"] + c["width"]) * k), round(min(box["height"], c["y"] + c["height"]) * k)))
        crop = ImageOps.expand(crop, border=(0, 8, 0, 24), fill="white")
        crop = crop.resize((480, round(crop.height * 480 / crop.width)), Image.LANCZOS)
        crop.save(os.path.join(OUT, tid + ".webp"), quality=82)
        print(tid, crop.size)
    br.close()
print("page errors:", errors or "none")
