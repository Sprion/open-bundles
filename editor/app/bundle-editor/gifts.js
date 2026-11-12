// Gifts of a bar: a framed Gifts box under the bar's actions, one card per gift.
// Free gift = a real product variant, added to the cart with the bundle and made free by the open-bundles discount
// once the bar is reached. Free shipping = delivery at 0. Saved as tier.gifts [{type, variant, handle, title, price,
// image, image_size, text, show_price, in_compare}].
import { esc, money, I, range, vfield, check } from "./shared.js";

const info = `<p class="gf__info">${I.info}We automatically apply a 100% discount to gifts.</p>`;

export const card = (g = {}) => {
  const type = g.type === "shipping" ? "shipping" : "product", gname = `g_type_${Math.random().toString(36).slice(2, 9)}`;
  return `
  <div class="gf" data-gift>
    <div class="gf__head"><span>${I.gift}<b data-gtitle>${type === "shipping" ? "Free shipping" : "Free gift"}</b></span><button type="button" class="be__link is-danger" data-gremove>Remove</button></div>
    <div class="gf__types">
      <label><input type="radio" name="${gname}" value="product"${type === "product" ? " checked" : ""} data-gtype>${I.gift}<span>Free gift</span></label>
      <label><input type="radio" name="${gname}" value="shipping"${type === "shipping" ? " checked" : ""} data-gtype>${I.truck}<span>Free shipping</span></label>
    </div>
    ${info}
    <div class="gf__product" data-gproduct>
      <input type="hidden" data-g="variant" value="${esc(g.variant || "")}"><input type="hidden" data-g="handle" value="${esc(g.handle || "")}">
      <input type="hidden" data-g="title" value="${esc(g.title || "")}"><input type="hidden" data-g="price" value="${esc(g.price ?? "")}">
      <input type="hidden" data-g="image" value="${esc(g.image || "")}"><input type="hidden" data-g="value" value="${esc(g.value ?? "")}"><input type="hidden" data-g="product" value="${esc(g.product || "")}"><input type="hidden" data-g="sample" value="${g.sample && !g.variant ? "1" : ""}">
      <div class="gf__chosen" data-gchosen></div>
      <button type="button" class="gf__select" data-gselect>${g.variant ? "Change the product" : "Select a product"}</button>
    </div>
    ${vfield("g_text", "Text", g.text || (type === "shipping" ? "+ FREE shipping" : "+ FREE Gift"), "+ FREE Gift")}
    <div class="be__checks">${check("g_hide_bar", "Don't list it in the bar (still added for free)", g.in_bar === false)}</div>
    <label class="be__field"><span>Small line under the text</span><input name="g_note" value="${esc(g.note || "")}" placeholder="$64.95 value" autocomplete="off"></label>
    <div class="gf__img" data-gproductonly>${range("g_image_size", g.image_size || 30, "Image size", 16, 80)}</div>
    <div class="be__checks" data-gproductonly>
      ${check("g_choose", "Let the customer choose the variant (size, colour)", g.choose)}
      ${check("g_show_price", "Show the original price", g.show_price === true)}
      ${check("g_in_compare", "Include in the compare-at (struck) price", g.in_compare)}
    </div>
  </div>`;
};

export const box = (t) => `
  <div class="gf__box" data-gbox${(t.gifts || []).length ? "" : " hidden"}>
    <div class="gf__boxhead">${I.gift}<b>Gifts</b></div>
    <div class="gf__list" data-glist>${(t.gifts || []).map(card).join("")}</div>
  </div>`;

export function read(row) {
  return [...row.querySelectorAll("[data-gift]")].map((c) => {
    const v = (k) => c.querySelector(`[data-g="${k}"]`).value, type = c.querySelector("[data-gtype]:checked").value;
    const text = c.querySelector('[name="g_text"]').value.trim(), note = c.querySelector('[name="g_note"]').value.trim();
    const nt = { ...(note ? { note } : {}), ...(c.querySelector('[name="g_hide_bar"]').checked ? { in_bar: false } : {}) };
    if (type === "shipping") return { type, text, ...nt, ...(Number(v("value")) > 0 ? { value: Number(v("value")) } : {}) };
    // template placeholder: kept for the preview until a real product is picked (the editor refuses to save it)
    if (!v("variant") && v("sample")) return { type, sample: true, title: v("title") || "Sample gift", price: Number(v("price")) || 0, text, ...nt,
      image_size: Number(c.querySelector('[name="g_image_size"]').value) || 30, show_price: c.querySelector('[name="g_show_price"]').checked, in_compare: c.querySelector('[name="g_in_compare"]').checked };
    if (!v("variant")) return null;
    return { type, variant: Number(v("variant")), handle: v("handle"), title: v("title"), price: Number(v("price")) || 0, image: v("image"),
      text, ...nt, image_size: Number(c.querySelector('[name="g_image_size"]').value) || 30,
      show_price: c.querySelector('[name="g_show_price"]').checked, in_compare: c.querySelector('[name="g_in_compare"]').checked,
      ...(c.querySelector('[name="g_choose"]').checked && v("product") ? { choose: true, product: Number(v("product")) } : {}) };
  }).filter(Boolean);
}

export function sync(row) {
  row.querySelectorAll("[data-gift]").forEach((c) => {
    const ship = c.querySelector("[data-gtype]:checked").value === "shipping";
    c.querySelector("[data-gtitle]").textContent = ship ? "Free shipping" : "Free gift";
    c.querySelector("[data-gproduct]").hidden = ship;
    c.querySelectorAll("[data-gproductonly]").forEach((x) => { x.hidden = ship; });
    c.querySelectorAll(".gf__types label").forEach((l) => l.classList.toggle("is-on", l.querySelector("input").checked));
    const v = (k) => c.querySelector(`[data-g="${k}"]`).value;
    c.querySelector("[data-gchosen]").innerHTML = !v("variant") && v("sample")
      ? `<span class="gf__sample"><b>Sample gift</b><small>Select one of your products to replace it</small></span>`
      : v("variant")
      ? `${v("image") ? `<img src="${esc(v("image") + (v("image").includes("?") ? "&" : "?") + "width=120")}" alt="">` : ""}<span><b>${esc(v("title"))}</b><small>${money(Number(v("price")) || 0)}</small></span>` : "";
    c.querySelector("[data-gselect]").textContent = v("variant") ? "Change the product" : "Select a product";
  });
  row.querySelector("[data-gbox]").hidden = !row.querySelector("[data-gift]");
}

// Product picker: search the store, pick one variant.
let timer;
export function pickProduct(c, onPick) {
  const m = document.createElement("div");
  m.className = "imp";
  m.innerHTML = `
    <div class="imp__box gp" role="dialog" aria-modal="true" aria-label="Select a product">
      <div class="imp__head"><b>Select a product</b><button type="button" class="imp__x" data-close aria-label="Close">${I.close}</button></div>
      <input type="search" class="gp__q" placeholder="Search products" data-q autocomplete="off">
      <div class="gp__list" data-list><p class="be__hint">Loading…</p></div>
    </div>`;
  document.body.append(m);
  const load = async (q) => {
    const res = await fetch(`api/bundles/variants${q ? `?q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" }).then((r) => r.json()).catch((e) => ({ error: e.message }));
    m.querySelector("[data-list]").innerHTML = res.error ? `<p class="xtest__msg is-error">${esc(res.error)}</p>` : res.products.map((p) => `
      <div class="gp__p"><b>${esc(p.title)}</b>
        <div class="gp__vs">${p.variants.map((v) => `<button type="button" class="gp__v" data-v='${esc(JSON.stringify({ variant: v.id, product: p.id, handle: p.handle, title: `${p.title}${v.title === "Default Title" ? "" : ` · ${v.title}`}`, price: v.price, image: v.image || "" }))}'>
          ${v.image ? `<img src="${esc(v.image + (v.image.includes("?") ? "&" : "?") + "width=80")}" alt="" loading="lazy">` : ""}<span>${esc(v.title)}</span><small>${money(v.price)}</small></button>`).join("")}</div>
      </div>`).join("") || `<p class="be__hint">No product found.</p>`;
  };
  m.addEventListener("input", (e) => { if (e.target.matches("[data-q]")) { clearTimeout(timer); timer = setTimeout(() => load(e.target.value.trim()), 300); } });
  m.addEventListener("click", (e) => {
    const v = e.target.closest("[data-v]");
    if (v) {
      const x = JSON.parse(v.dataset.v);
      Object.entries(x).forEach(([k, val]) => { c.querySelector(`[data-g="${k}"]`).value = val; });
      c.querySelector('[data-g="sample"]').value = "";
      m.remove(); onPick();
    }
    if (e.target.closest("[data-close]") || e.target === m) m.remove();
  });
  load("");
  m.querySelector("[data-q]").focus();
}
