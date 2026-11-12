// "Add an image" pop-up of a bar: pick an image from the store's Files, set its size and corner radius,
// see the bar change live. The image replaces the radio dot. Values go to the bar's hidden fields img_url/size/radius.
import { esc, I, range } from "./shared.js";
import { bar, cssVars } from "./preview.js";
import { designOf, fullStyle } from "./shared.js";

let cache = null;
const library = async (q = "") => {
  if (!q && cache) return cache;
  const res = await fetch(`api/bundles/images${q ? `?q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" })
    .then((r) => r.json()).catch((e) => ({ error: e.message }));
  if (!q && !res.error) cache = res;
  return res;
};
const thumb = (url) => esc(url + (url.includes("?") ? "&" : "?") + "width=200");

// row: the bar's <details>; ctx: () => ({ b, i, unit }) the bundle as read now, this bar's index, product price.
export function open(row, ctx, onChange) {
  const f = row.closest("form"), el = (n) => row.querySelector(`[name="${n}"]`);
  const start = { url: el("img_url").value, size: el("img_size").value, radius: el("img_radius").value };
  const m = document.createElement("div");
  m.className = "imp";
  m.innerHTML = `
    <div class="imp__box" role="dialog" aria-modal="true" aria-label="Add an image">
      <div class="imp__head"><b>Add an image</b><button type="button" class="imp__x" data-close aria-label="Close">${I.close}</button></div>
      <div class="imp__cols">
        <div class="imp__side">
          <button type="button" class="imp__current" data-current title="Choose another image"></button>
          <div class="imp__lib" data-lib>
            <p class="imp__src">Your Shopify files (Content › Files)</p>
            <input type="search" placeholder="Search your files" data-q autocomplete="off">
            <div class="imp__grid" data-grid><p class="be__hint">Loading your images…</p></div>
          </div>
          ${range("imp_size", start.size || 48, "Size", 20, 120)}
          ${range("imp_radius", start.radius || 6, "Corner radius", 0, 60)}
        </div>
        <div class="imp__pv"><span>Preview</span><div data-pv></div></div>
      </div>
      <div class="imp__foot"><button type="button" class="xbtn xbtn--ghost" data-cancel>Cancel</button><button type="button" class="xbtn xbtn--primary" data-done>Done</button></div>
    </div>`;
  document.body.append(m);
  let url = start.url;
  const val = (n) => m.querySelector(`[name="${n}"]`).value;
  const draw = () => {
    m.querySelector("[data-current]").innerHTML = url
      ? `<img src="${thumb(url)}" alt="" style="width:${val("imp_size")}px;height:${val("imp_size")}px;border-radius:${val("imp_radius")}px"><span class="imp__del" data-del role="button" aria-label="Remove the image">${I.trash}</span>`
      : `<span class="imp__empty">${I.image}<b>Select an image</b><small>From your Shopify files</small></span>`;
    const { b, i, unit } = ctx(), t = { ...b.tiers[i], image: url ? { url, size: Number(val("imp_size")), radius: Number(val("imp_radius")) } : undefined };
    m.querySelector("[data-pv]").innerHTML = `<div class="pv pv--${designOf(b)}" style="${cssVars(fullStyle(b))}">${bar(b, t, i, unit, { on: true, withPickers: false })}</div>`;
    m.querySelectorAll("[data-pick]").forEach((x) => x.classList.toggle("is-on", x.dataset.pick === url));
  };
  const fillGrid = async (q) => {
    const res = await library(q), grid = m.querySelector("[data-grid]");
    grid.innerHTML = res.error ? `<p class="xtest__msg is-error">${esc(res.error)}</p>`
      : res.images.length ? res.images.map((x) => `<button type="button" class="imp__pick" data-pick="${esc(x.url)}" title="${esc(x.alt)}"><img src="${thumb(x.url)}" alt="" loading="lazy"></button>`).join("")
        : `<p class="be__hint">No image found.</p>`;
    draw();
  };
  const close = (keep) => {
    if (keep) { el("img_url").value = url; el("img_size").value = val("imp_size"); el("img_radius").value = val("imp_radius"); onChange(); }
    m.remove();
  };
  let timer;
  m.addEventListener("input", (e) => {
    const rg = e.target.closest(".be__range");
    if (rg) rg.querySelectorAll("input").forEach((x) => { if (x !== e.target) x.value = e.target.value; });
    if (e.target.matches("[data-q]")) { clearTimeout(timer); timer = setTimeout(() => fillGrid(e.target.value.trim()), 300); }
    draw();
  });
  m.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-pick]");
    if (pick) { url = pick.dataset.pick; m.querySelector("[data-lib]").hidden = true; draw(); }
    if (e.target.closest("[data-current]") && !e.target.closest("[data-del]")) { const lib = m.querySelector("[data-lib]"); lib.hidden = !lib.hidden; }
    if (e.target.closest("[data-del]")) { url = ""; draw(); }
    if (e.target.closest("[data-close],[data-cancel]") || e.target === m) close(false);
    if (e.target.closest("[data-done]")) close(true);
  });
  m.addEventListener("keydown", (e) => { if (e.key === "Escape") close(false); });
  m.querySelector("[data-lib]").hidden = Boolean(url); // : the library opens from the image box
  draw();
  fillGrid("");
  return f;
}
