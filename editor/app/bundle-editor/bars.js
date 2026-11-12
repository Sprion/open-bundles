// Bars block: one card per bar (quantity bought, free units, price, texts, selected by default), add / move /
// duplicate / delete. A bar's badge is set in the Badges block, linked to the bar by its key (data-key).
import { esc, money, boxPrice, fill, I, field, input, num, select, vfield, toggle, area, check } from "./shared.js";
import * as gifts from "./gifts.js";

// bar actions. Image is built; the others are listed in their place and come next.
const ACTIONS = [["image", I.image, "Add an image"], ["featured", I.star, "Featured image"], ["upsell", I.bagplus, "Add an upsell"],
  ["gift", I.gift, "Add a gift"], ["custom", I.pen, "Add personalisation"], ["highlights", I.list, "Add highlights"]];
const READY = ["image", "gift", "highlights"];
// Tier fields this block (and the Badges block) write; any other field of the bar is kept as it was (hidden "extra").
const OWNED = ["banner_value", "label", "sub", "tag", "buy", "free", "save_text", "off", "default", "image", "sold_out", "defaults", "gifts", "highlights", "countdown", "mixes", "short",
  "badge", "badge_style", "badge_size", "badge_color", "badge_bg"];
const extraOf = (t) => Object.fromEntries(Object.entries(t || {}).filter(([k]) => !OWNED.includes(k)));
// Colour mixes, one per line: "Top Seller | Hot Deal: Black, Charcoal, White" (name | badge: colours)
const mixesText = (m = []) => m.map((x) => `${x.name}${x.badge ? ` | ${x.badge}` : ""}: ${(x.colors || []).join(", ")}${x.image ? ` @ ${x.image}` : ""}`).join("\n");
const mixesRead = (txt) => txt.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
  const [main, image = ""] = l.split(" @ "), i = main.indexOf(":"), head = i < 0 ? main : main.slice(0, i), cols = i < 0 ? "" : main.slice(i + 1);
  const [name, badge] = head.split("|").map((x) => x.trim());
  return { name, ...(badge ? { badge } : {}), colors: cols.split(",").map((c) => c.trim()).filter(Boolean), ...(image.trim() ? { image: image.trim() } : {}) };
}).filter((x) => x.name && x.colors.length);

let seq = 0;
export const newKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;
const PRICE = [["", "Full price"], ["percent", "Percentage off"], ["amount", "Amount off"], ["price", "Fixed total price"]];

export const bar = (t, i, key = newKey()) => `
  <details class="be__card be__bar" data-row data-key="${key}">
    <summary>
      <span class="bar__grip" data-grip title="Drag to reorder" aria-hidden="true">${I.grip}</span>
      <span class="be__chev">${I.chev}</span><span class="be__icon">${I.tag}</span>
      <span class="be__title">Bar #<span data-n>${i + 1}</span><span class="be__sep">·</span><span data-bt>${esc(t.label || "")}</span></span>
      <span class="bar__more-wrap">
        <button type="button" class="bar__dots" data-dots aria-label="Bar actions">${I.dots}</button>
        <span class="bar__menu" data-barmenu hidden>
          <button type="button" data-up>${I.up}<span>Move up</span></button><button type="button" data-down>${I.down}<span>Move down</span></button>
          <button type="button" data-dup>${I.copy}<span>Duplicate</span></button><button type="button" data-remove class="is-danger">${I.trash}<span>Delete</span></button>
        </span>
      </span>
    </summary>
    <div class="be__body">
      <div class="bar__qty">
        ${field("Buy", num("buy", t.buy ?? 1, "", 1, 50))}
        ${field("Get free", num("free", t.free ?? 0, "", 0, 50))}
        ${field("Price", select("offType", PRICE, t.off?.type || ""))}
        <label class="be__field" data-offwrap><span data-offlabel>Discount</span>${num("offValue", t.off?.value ?? "", "", 0, 100000, 0.01).replace("<em></em>", "<em data-offunit></em>")}</label>
      </div>
      <div class="be__grid2">
        ${vfield("label", "Title", t.label, "{{quantity}} items")}
        ${vfield("sub", "Subtitle", t.sub, "You save {{saved_percentage}}")}
        ${vfield("tag", "Label", t.tag, "SAVE {{saved_percentage}}")}
        ${vfield("bar_save", "Saving pill", t.save_text, "Same as the bundle")}
        ${field("Short name (pills, Quantity line)", input("short", t.short, "3-Pack"))}
        ${field("Ticket banner number", input("banner_value", t.banner_value, "3"))}
      </div>
      <div class="bar__foot">
        <label class="be__check"><input type="radio" name="default" value="${i}"${t.default ? " checked" : ""}><span>Selected by default</span></label>
        <span class="bar__calc" data-calc></span>
      </div>
      <input type="hidden" name="defaults" value="${esc(t.defaults?.length ? JSON.stringify(t.defaults) : "")}"><input type="hidden" name="img_url" value="${esc(t.image?.url || "")}"><input type="hidden" name="img_size" value="${t.image?.size || 48}"><input type="hidden" name="img_radius" value="${t.image?.radius ?? 6}">
      <div class="bar__actions">${ACTIONS.map(([k, icon, l]) => `<button type="button" class="bar__act" data-act="${k}"${READY.includes(k) ? "" : ' disabled title="Coming next"'}>${icon}<span>${k === "image" && t.image?.url ? "Edit the image" : l}</span>${k === "gift" ? I.chevdown : ""}</button>`).join("")}
        <div class="bar__gmenu" data-gmenu hidden><button type="button" data-gadd="product">${I.gift}Free gift</button><button type="button" data-gadd="shipping">${I.truck}Free shipping</button></div>
      </div>
      ${gifts.box(t)}
      <div class="bar__more" data-hlbox${(t.highlights || []).length ? "" : " hidden"}>${area("highlights", "Highlights (one per line, max 6)", (t.highlights || []).join("\n"), "Wind and rain protection\nRoom for winter layers")}</div>
      <div class="be__checks">${check("cd_bar", "Countdown on this bar (set it in the Countdown block)", t.countdown)}</div>
      ${area("mixes", "Colour mixes (tiles picker), one per line. Own picture: add @ and the image link", mixesText(t.mixes), "Top Seller | Hot Deal: Black, Charcoal, White @ https://cdn.shopify.com/...", 2)}
      <input type="hidden" name="extra" value="${esc(JSON.stringify(extraOf(t)))}">
      <div class="bar__sold"><span>Show as sold out</span>${toggle("sold_out", t.sold_out, "Show as sold out")}</div>
    </div>
  </details>`;

export const html = (b, keys) => `
  <div class="be__bars" data-rows>${(b.tiers || []).map((t, i) => bar(t, i, keys[i])).join("")}</div>
  <div class="bar__addzone"><button type="button" class="bar__addbtn" data-addrow>${I.plus}<span>Add a bar</span></button></div>`;

export const rows = (f) => [...f.querySelectorAll("[data-row]")];

export function read(f) {
  const def = f.querySelector('input[name="default"]:checked')?.value;
  return rows(f).map((r, i) => {
    const v = (n) => r.querySelector(`[name="${n}"]`).value;
    const t = { label: v("label"), sub: v("sub"), tag: v("tag"), buy: Number(v("buy")) || 0, free: Number(v("free")) || 0 };
    if (v("bar_save").trim()) t.save_text = v("bar_save").trim();
    if (v("short").trim()) t.short = v("short").trim();
    t.banner_value = v("banner_value").trim() || undefined;
    if (v("offType") && Number(v("offValue")) > 0) t.off = { type: v("offType"), value: Number(v("offValue")) };
    if (String(i) === def) t.default = true;
    if (v("img_url")) t.image = { url: v("img_url"), size: Number(v("img_size")) || 48, radius: Number(v("img_radius")) || 0 };
    if (r.querySelector('[name="sold_out"]').checked) t.sold_out = true;
    if (v("defaults")) t.defaults = JSON.parse(v("defaults"));
    const hl = v("highlights").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 6);
    if (hl.length && !r.querySelector("[data-hlbox]").hidden) t.highlights = hl;
    if (r.querySelector('[name="cd_bar"]').checked) t.countdown = true;
    const mx = mixesRead(v("mixes"));
    if (mx.length) t.mixes = mx;
    const g = gifts.read(r);
    if (g.length) t.gifts = g;
    return { ...JSON.parse(v("extra") || "{}"), ...t };
  });
}

// Headers, price fields and totals follow the form (b = the bundle as read, unit = product price).
export function sync(f, b, unit) {
  rows(f).forEach((r, i) => {
    const p = boxPrice(b.tiers[i], unit, b.compare_multiplier);
    r.querySelector("[data-n]").textContent = i + 1;
    r.querySelector("[data-bt]").textContent = fill(r.querySelector('[name="label"]').value, p) || "Untitled";
    r.querySelector('[name="default"]').value = String(i);
    const type = r.querySelector('[name="offType"]').value;
    r.querySelector("[data-offwrap]").hidden = !type;
    r.querySelector("[data-offlabel]").textContent = type === "price" ? "Total" : "Discount";
    r.querySelector("[data-offunit]").textContent = type === "percent" ? "%" : "$";
    gifts.sync(r);
    r.querySelector('[data-act="image"] span').textContent = r.querySelector('[name="img_url"]').value ? "Edit the image" : "Add an image";
    r.querySelector("[data-calc]").innerHTML = `${p.units} item${p.units > 1 ? "s" : ""} · <b>${money(p.total)}</b>${p.save > 0 ? ` <s>${money(p.was)}</s>` : ""}`;
  });
}

export function wire(f, recalc, current) {
  f.addEventListener("click", (e) => {
    const gr = e.target.closest("[data-row]");
    if (gr && e.target.closest('[data-act="highlights"]')) { const hb = gr.querySelector("[data-hlbox]"); hb.hidden = !hb.hidden; if (!hb.hidden) hb.querySelector("textarea").focus(); recalc(); return; }
    if (gr && e.target.closest('[data-act="gift"]')) { const mn = gr.querySelector("[data-gmenu]"); mn.hidden = !mn.hidden; return; }
    const add = e.target.closest("[data-gadd]");
    if (add) { gr.querySelector("[data-glist]").insertAdjacentHTML("beforeend", gifts.card({ type: add.dataset.gadd, show_price: true })); add.parentElement.hidden = true; recalc(); return; }
    if (e.target.closest("[data-gremove]")) { e.target.closest("[data-gift]").remove(); recalc(); return; }
    if (e.target.closest("[data-gselect]")) { gifts.pickProduct(e.target.closest("[data-gift]"), recalc); return; }
    const r = e.target.closest("[data-row]"), tool = e.target.closest("[data-up],[data-down],[data-dup],[data-remove]");
    // the ... menu of a bar (opening it never opens or closes the bar)
    const dots = e.target.closest("[data-dots]");
    f.querySelectorAll("[data-barmenu]").forEach((m) => { if (!dots || m !== dots.nextElementSibling) m.hidden = true; });
    if (dots) { e.preventDefault(); dots.nextElementSibling.hidden = !dots.nextElementSibling.hidden; return; }
    if (e.target.closest("[data-grip]")) { e.preventDefault(); return; }
    if (!tool || !r) return;
    e.preventDefault();
    if (tool.matches("[data-up]") && r.previousElementSibling) r.previousElementSibling.before(r);
    if (tool.matches("[data-down]") && r.nextElementSibling) r.nextElementSibling.after(r);
    if (tool.matches("[data-dup]") && rows(f).length < 10) r.insertAdjacentHTML("afterend", bar({ ...read(f)[rows(f).indexOf(r)], default: false }, rows(f).length));
    if (tool.matches("[data-remove]") && rows(f).length > 1) r.remove();
    recalc();
  });
  // Drag a bar by its handle (left of the card) to reorder; the bar follows the mouse between the others.
  const list = f.querySelector("[data-rows]");
  let dragged = null;
  list.addEventListener("mousedown", (e) => { const g = e.target.closest("[data-grip]"); if (g) g.closest("[data-row]").draggable = true; });
  list.addEventListener("dragstart", (e) => {
    dragged = e.target.closest("[data-row]");
    if (!dragged) return;
    e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "");
    requestAnimationFrame(() => dragged?.classList.add("is-dragging"));
  });
  list.addEventListener("dragover", (e) => {
    if (!dragged) return;
    e.preventDefault();
    const over = e.target.closest("[data-row]");
    if (!over || over === dragged) return;
    const box = over.getBoundingClientRect();
    if (e.clientY < box.top + box.height / 2) over.before(dragged); else over.after(dragged);
  });
  list.addEventListener("dragend", () => {
    if (!dragged) return;
    dragged.classList.remove("is-dragging"); dragged.draggable = false; dragged = null;
    recalc();
  });
  list.addEventListener("drop", (e) => e.preventDefault());
  f.querySelector("[data-addrow]").addEventListener("click", () => {
    if (rows(f).length >= 10) return;
    const last = read(f).at(-1) || { buy: 0 };
    rows(f).forEach((x) => { x.open = false; });
    f.querySelector("[data-rows]").insertAdjacentHTML("beforeend", bar({ label: `{{quantity}} ${current().cta_noun || "items"}`, buy: (last.buy || 0) + 1 }, rows(f).length));
    rows(f).at(-1).open = true;
    recalc();
  });
}
