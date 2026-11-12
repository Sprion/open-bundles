// Live preview of one bar (image picker, swatches pop-up): same layout as the theme block, with the product's real colours
// and photos. Clicking a bar selects it (as on the site) and opens its block in the editor.
import { money, esc, boxPrice, fill, designOf, fullStyle, I } from "./shared.js";

export function cssVars(st) {
  return Object.entries(st).filter(([k, v]) => v !== "" && v != null && typeof v !== "boolean" && k !== "swatch_shape" && k !== "badge_style" && k !== "subtitle_style")
    .map(([k, v]) => `--${k}:${typeof v === "number" && !k.endsWith("_weight") ? `${v}px` : v}`).join(";");
}

const DEMO = { colors: [{ name: "Black" }, { name: "Charcoal" }, { name: "White" }], sizes: ["XS", "S", "M"], colorName: "Color", sizeName: "Size" };
const sized = (url, w) => esc(url + (url.includes("?") ? "&" : "?") + `width=${w}`);

// The site's own pickers: colour photos + size menu (product page layouts) or the drop-down rows.
function pickers(design, units, opts, b = {}, t = {}) {
  const o = opts || DEMO, colors = o.colors.length ? o.colors : DEMO.colors, req = b.require_selection;
  const first = Math.max(0, colors.findIndex((c) => c.name === b.default_color));
  const sw = b.swatches?.type === "color" ? b.swatches.colors || {} : null;
  if (b.one_variant) units = 1;
  // item i: its bar default, else the bundle default, else the first values
  const colorAt = (i) => colors.find((c) => c.name === t.defaults?.[i]?.color) || colors[(first + i) % colors.length];
  const sizeAt = (i) => (req ? "Select" : t.defaults?.[i]?.size || b.default_size || o.sizes[0] || "M");
  const thumb = (c) => sw?.[c.name] ? `<i class="pv__swc" style="background:${esc(sw[c.name])}"></i>`
    : c.image ? `<img src="${sized(c.image, 160)}" alt="" loading="lazy">` : `<span>${esc(c.name.slice(0, 2))}</span>`;
  const n = Math.min(units, 3), more = units > 3 ? `<small>+ ${units - 3} more</small>` : "";
  if (design === "boxed") {
    return `<span class="pv__items"><small>${esc(o.sizeName)}, ${esc(o.colorName)}</small>${Array.from({ length: n }, (_, i) => {
      const c = colorAt(i);
      return `<span class="pv__bfrow"><small>#${i + 1}</small><span class="pv__dd">${esc(sizeAt(i))}</span><span class="pv__dd pv__dd--c">${req ? "Select" : `${thumb(c)}${esc(c.name)}`}</span></span>`;
    }).join("")}${more}</span>`;
  }
  return `<span class="pv__items pv__items--sw">${Array.from({ length: n }, (_, i) => {
    const c = colorAt(i);
    return `<span class="pv__item"><span class="pv__col"><small>${esc(o.colorName)}: <b>${req ? "" : esc(c.name)}</b></small>
      <span class="pv__sws">${colors.slice(0, 6).map((x) => `<span class="pv__sw${!req && x === c ? " is-on" : ""}">${thumb(x)}</span>`).join("")}</span></span>
      <span class="pv__siz"><small>${esc(o.sizeName)}:</small><span class="pv__dd">${esc(sizeAt(i))}</span></span></span>`;
  }).join("")}${more}</span>`;
}

// A bar's badge: its own style and colours (Badges block), else the bundle's.
function badgeOf(t, st, p) {
  if (!t.badge) return null;
  const css = [t.badge_color && `color:${t.badge_color}`, t.badge_bg && `background:${t.badge_bg}`, t.badge_size && `font-size:${t.badge_size}px`].filter(Boolean).join(";");
  return { text: fill(t.badge, p), style: t.badge_style || st.badge_style || "floating", css: esc(css) };
}

// One bar. on = selected, editing = its block is open, withPickers = draw the colour/size pickers under it.
export function bar(b, t, i, unit, { on = false, editing = false, opts = null, withPickers = true } = {}) {
  const design = designOf(b), st = fullStyle(b), p = boxPrice(t, unit, b.compare_multiplier), bd = badgeOf(t, st, p);
  // gifts "included in the compare-at price" raise the struck total
  p.was += (t.gifts || []).filter((g) => g.type === "product" && g.in_compare).reduce((s, g) => s + (Number(g.price) || 0), 0);
  p.save = p.was - p.total;
  const giftStrip = (t.gifts || []).length ? `<span class="pv__gifts">${t.gifts.map((g) => `<span class="pv__gift">${g.type === "product" && g.image
    ? `<img src="${sized(g.image, 120)}" alt="" style="width:${g.image_size}px;height:${g.image_size}px">` : ""}<span>${esc(g.text)}</span>${g.choose ? `<span class="pv__gsel">Select${I.updown}</span>` : ""}${g.type === "product" && g.show_price && g.price > 0
    ? `<span class="pv__giftp"><s>${money(g.price)}</s> <b>FREE</b></span>` : ""}</span>`).join("")}</span>` : "";
  const auto = design !== "boxed" && p.save > 0 ? (t.off?.type === "amount" && !t.free ? `Save ${fill("{{saved_total}}", p)}` : `Save ${fill("{{saved_percentage}}", p)}`) : "";
  const tag = t.sold_out ? "Sold out" : t.tag ? fill(t.tag, p) : auto;
  const unitLine = p.units > 1 && b.show_unit !== false ? `${money(p.total / p.units)} / ${esc(b.unit_noun || "item")}` : "";
  const was = !b.hide_compare && p.was > p.total ? `<s>${money(p.was)}</s>` : "";
  const lead = t.image?.url
    ? `<img class="pv__img" src="${sized(t.image.url, 240)}" alt="" style="width:${t.image.size}px;height:${t.image.size}px;border-radius:${t.image.radius}px">`
    : `<span class="pv__dot"></span>`;
  const saveText = t.save_text || b.save_text || (design === "boxed" ? "You save {{saved_total}}" : "");
  const save = p.save > 0 && !b.hide_save && saveText ? `<span class="pv__save">${esc(fill(saveText, { ...p, exact: true }))}</span>` : "";
  const pos = b.save_position || "below", at = (where) => (pos === where ? save : "");
  return `
    <div class="pv__bar${on && !t.sold_out ? " is-on" : ""}${editing ? " is-editing" : ""}${t.sold_out ? " is-soldout" : ""}${bd && bd.style !== "inline" ? ` has-${bd.style}` : ""}" data-pvbar="${i}" title="Edit this bar">
      ${bd?.style === "ribbon" ? `<span class="pv__ribbon" style="${bd.css}">${esc(bd.text)}</span>` : ""}
      ${bd?.style === "floating" ? `<span class="pv__badge" style="${bd.css}">${esc(bd.text)}</span>` : ""}
      <span class="pv__row">
        ${lead}
        <span class="pv__text">
          <span class="pv__title">${esc(fill(t.label || p.units, p))}${tag ? `<span class="pv__label">${esc(tag)}</span>` : ""}${bd?.style === "inline" ? `<span class="pv__badge pv__badge--inline" style="${bd.css}">${esc(bd.text)}</span>` : ""}${at("inline")}</span>
          ${t.sub ? `<span class="pv__sub">${esc(fill(t.sub, p))}</span>` : ""}
          ${design === "boxed" ? `<span class="pv__pills">${at("below")}${unitLine ? `<span class="pv__unit">${unitLine}</span>` : ""}</span>`
            : `${at("below") ? `<span class="pv__pills">${at("below")}</span>` : ""}${unitLine ? `<span class="pv__unit">${unitLine}</span>` : ""}`}
        </span>
        <span class="pv__price">${design !== "boxed" && !at("price") ? was : ""}<b>${money(p.total)}</b>${design === "boxed" || at("price") ? was : ""}${at("price")}</span>
      </span>
      ${on && withPickers && !t.sold_out ? pickers(design, p.units, opts, b, t) : ""}
      ${giftStrip}
    </div>`;
}

export function preview(b, unit, open = -1, opts = null) {
  const design = designOf(b), st = fullStyle(b), tiers = b.tiers || [];
  const sel = open >= 0 && open < tiers.length ? open : Math.max(0, tiers.findIndex((t) => t.default));
  const cur = tiers[sel] ? boxPrice(tiers[sel], unit) : { units: 1, total: unit };
  // columns and grid: the selected bar's pickers sit under all the bars (full width)
  const lay = b.layout || "list", split = lay === "columns" || lay === "grid";
  return `
    <div class="pv pv--${design} pv--sw-${st.swatch_shape || "default"}" style="${cssVars(st)};--subtitle_style:${st.subtitle_style === "italic" ? "italic" : "normal"}">
      <div class="pv__top"><b>${esc(b.block_title || "Choose your offer")}</b><span class="pv__sg">${I.ruler}Size guide</span></div>
      ${b.banner ? `<p class="pv__banner"><span>${esc(b.banner)}</span></p>` : ""}
      <div class="pv__list pv__list--${lay}" style="--n:${Math.min(Math.max(tiers.length, 1), 4)}">
        ${tiers.map((t, i) => bar(b, t, i, unit, { on: i === sel, editing: i === open, opts, withPickers: !split })).join("")}
      </div>
      ${split && tiers[sel] && !tiers[sel].sold_out ? `<div class="pv__slot">${pickers(design, boxPrice(tiers[sel], unit, b.compare_multiplier).units, opts, b, tiers[sel])}</div>` : ""}
      <div class="pv__cta">${cur.units > 1 ? `Add ${cur.units} ${esc(b.cta_noun || "items")} to cart` : "Add to cart"}${b.total_in_button ? ` · ${money(cur.total)}` : ""}</div>
    </div>`;
}
