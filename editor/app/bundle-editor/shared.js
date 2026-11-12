// Shared by every block of the bundle editor: API call, price maths, {{variables}}, presets, icons, small controls.
import { money, esc } from "../lib/format.js";
export { money, esc };

export async function send(method, path, body) {
  const res = await fetch(`api/bundles${path}`, {
    method, headers: { "Content-Type": "application/json", "X-editor": "1" }, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Same maths as the theme blocks and the discount function. `mult`: struck price = price x mult (bundle compare_multiplier).
export function boxPrice(t, unit, mult = 1) {
  const buy = Number(t.buy) || 0, free = Number(t.free) || 0, paid = unit * buy;
  let off = 0;
  if (t.off?.type === "percent") off = (paid * Math.min(Number(t.off.value) || 0, 100)) / 100;
  if (t.off?.type === "amount") off = Math.min(Number(t.off.value) || 0, paid);
  if (t.off?.type === "price") off = Math.max(0, paid - (Number(t.off.value) || 0));
  const total = paid - off, was = unit * (Number(mult) > 1 ? Number(mult) : 1) * (buy + free);
  return { units: buy + free, total, was, save: was - total };
}

// {{variables}} in bar and badge texts, as the theme fills them.
export const VARS = [["saved_percentage", "Saved percentage", "33%"], ["saved_total", "Saved total", "$50"], ["price", "Price", "$199.90"],
  ["unit_price", "Price per item", "$99.95"], ["quantity", "Quantity", "2"]];
export function fill(text, p) {
  const vars = {
    saved_percentage: `${p.was ? Math.round((p.save / p.was) * 100) : 0}%`, saved_total: p.exact ? money(p.save) : money(p.save).replace(/[.,]00$/, ""),
    price: money(p.total), unit_price: money(p.total / (p.units || 1)), quantity: String(p.units),
  };
  return String(text || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => vars[k] ?? m);
}

// Presets: the design the theme renders + its default values (the bundle's style only stores what differs).
const W = { block_title_weight: 500, title_weight: 600, subtitle_weight: 400, label_weight: 600, badge_weight: 700, unit_weight: 400 };
// Colours of the extra parts (countdown, highlights, Gifts unlocked, links, price summary, banner), same in every preset.
const X = { timer_bg: "#1b1b1b", timer_text: "#ffffff", timer_accent: "#c4c4c4", highlight_text: "#1b1b1b", highlight_icon: "#676767",
  ladder_bg: "#ffffff", ladder_text: "#1b1b1b", ladder_accent: "#606060", link_color: "#1b1b1b", deal_bg: "#606060", deal_text_color: "#ffffff",
  unit_price_color: "#5f5f5f", banner_bg: "#f7f7f7", banner_text: "#1b1b1b" };
export const PRESETS = {
  classic: { name: "Rows",
    colors: { cards_bg: "#ffffff", selected_bg: "#f7f7f7", border: "#e2e2e2", accent: "#111111", block_title_color: "#1b1b1b",
      title_color: "#1b1b1b", subtitle_color: "#5e5e5e", price_color: "#1b1b1b", strike: "#7a7a7a", tag_bg: "#111111", tag_text: "#ffffff",
      badge_bg: "#c4c4c4", badge_text: "#1b1b1b", save_bg: "#eeeeee", button: "#111111", button_text: "#ffffff", gift_bg: "#eeeeee", gift_text: "#1b1b1b", ...X },
    sizes: { radius: 5, spacing: 8, block_title_size: 14, title_size: 14, subtitle_size: 12, price_size: 16, label_size: 10, badge_size: 10, unit_size: 12, swatch_size: 38, ...W } },
  cards: { name: "Cards",
    colors: { cards_bg: "#ffffff", selected_bg: "#f7f7f7", border: "#d8d8d8", accent: "#111111", block_title_color: "#1b1b1b",
      title_color: "#1b1b1b", subtitle_color: "#5e5e5e", price_color: "#535353", strike: "#7a7a7a", tag_bg: "#111111", tag_text: "#ffffff",
      badge_bg: "#c4c4c4", badge_text: "#1b1b1b", save_bg: "#eeeeee", button: "#111111", button_text: "#ffffff", gift_bg: "#eeeeee", gift_text: "#1b1b1b", ...X },
    sizes: { radius: 8, spacing: 14, block_title_size: 14, title_size: 16, subtitle_size: 12, price_size: 20, label_size: 10, badge_size: 10, unit_size: 12, swatch_size: 64, ...W } },
  boxed: { name: "Boxed",
    colors: { cards_bg: "#ffffff", selected_bg: "#f5f5f5", border: "#dadada", accent: "#1b1b1b", block_title_color: "#1b1b1b",
      title_color: "#1b1b1b", subtitle_color: "#111111", price_color: "#1b1b1b", strike: "#606060", tag_bg: "#ececec", tag_text: "#111111",
      badge_bg: "#1b1b1b", badge_text: "#ffffff", save_bg: "#eeeeee", button: "#111111", button_text: "#ffffff", gift_bg: "#eeeeee", gift_text: "#1b1b1b", ...X },
    sizes: { radius: 6, spacing: 10, block_title_size: 16, title_size: 16, subtitle_size: 14, price_size: 17, label_size: 11, badge_size: 11, unit_size: 13, swatch_size: 32,
      ...W, title_weight: 500, subtitle_weight: 500, badge_weight: 600 } },
  pack: { name: "Pack",
    colors: { cards_bg: "#ffffff", selected_bg: "#ffffff", border: "#dadada", accent: "#1b1b1b", block_title_color: "#1b1b1b",
      title_color: "#1b1b1b", subtitle_color: "#535353", price_color: "#535353", strike: "#7a7a7a", tag_bg: "#ececec", tag_text: "#111111",
      badge_bg: "#5f5f5f", badge_text: "#ffffff", save_bg: "#eeeeee", button: "#1b1b1b", button_text: "#ffffff", gift_bg: "#eeeeee", gift_text: "#1b1b1b", ...X },
    sizes: { radius: 6, spacing: 8, block_title_size: 14, title_size: 15, subtitle_size: 12, price_size: 24, label_size: 10, badge_size: 10, unit_size: 12, swatch_size: 36,
      ...W, title_weight: 500 } },
};
export const designOf = (b) => (PRESETS[b.design] ? b.design : "boxed");
export const fullStyle = (b) => ({ badge_style: "floating", swatch_shape: "", subtitle_style: "normal", banner_style: "", price_layout: "", gift_style: "", button_price: "", ...PRESETS[designOf(b)].colors, ...PRESETS[designOf(b)].sizes, ...(b.style || {}) });

const svg = (d, s = 16) => `<svg viewBox="0 0 20 20" width="${s}" height="${s}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const I = {
  up: svg(`<path d="M10 15V5M5.5 9.5 10 5l4.5 4.5"/>`),
  down: svg(`<path d="M10 5v10M5.5 10.5 10 15l4.5-4.5"/>`),
  copy: svg(`<rect x="7" y="7" width="9" height="9" rx="2"/><path d="M13 4.5H6A1.5 1.5 0 0 0 4.5 6v7"/>`),
  trash: svg(`<path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.2a1.5 1.5 0 0 0 1.5 1.3h3.6a1.5 1.5 0 0 0 1.5-1.3L14 6"/>`),
  chev: svg(`<path d="m8 5.5 4.5 4.5L8 14.5"/>`, 14),
  chevdown: svg(`<path d="m6.5 8.5 3.5 3.5 3.5-3.5"/>`, 14),
  updown: svg(`<path d="m7 8 3-3 3 3M7 12l3 3 3-3"/>`, 14),
  tag: svg(`<path d="M3.5 10.2V4.5a1 1 0 0 1 1-1h5.7l6.3 6.3a1 1 0 0 1 0 1.4l-5.3 5.3a1 1 0 0 1-1.4 0z"/><circle cx="7" cy="7" r=".6"/>`),
  brush: svg(`<path d="M12.5 3.5 16.5 7.5 9 15l-4-4zM5 11l-1.5 5.5L9 15"/>`),
  gear: svg(`<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6"/>`),
  badge: svg(`<circle cx="10" cy="8" r="4.5"/><path d="m7.2 11.6-1.2 5 4-2 4 2-1.2-5"/>`),
  plus: svg(`<circle cx="10" cy="10" r="7"/><path d="M10 7v6M7 10h6"/>`),
  image: svg(`<rect x="3.5" y="4" width="13" height="12" rx="2"/><circle cx="8" cy="8.5" r="1.3"/><path d="m4 14 4-4 3 3 2-2 3 3"/>`),
  star: svg(`<path d="M10 3.5 12 8l4.7.4-3.6 3.1 1.1 4.6L10 13.6 5.8 16l1.1-4.6L3.3 8.4 8 8z"/>`),
  bagplus: svg(`<path d="M5 7h10l-.8 9H5.8zM7.5 7V6a2.5 2.5 0 0 1 5 0v1M10 10v4M8 12h4"/>`),
  gift: svg(`<rect x="3.5" y="7.5" width="13" height="3" rx=".8"/><path d="M4.5 10.5v6h11v-6M10 7.5v9M10 7.5S8.8 4 7 4.5 6.5 7.5 10 7.5zm0 0s1.2-3.5 3-3 .5 3-3 3z"/>`),
  pen: svg(`<path d="M13.5 4 16 6.5 7.5 15H5v-2.5z"/>`),
  list: svg(`<rect x="3.5" y="3.5" width="13" height="13" rx="2"/><path d="M7 7.5h6M7 10h6M7 12.5h4"/>`),
  palette: svg(`<path d="M10 3.5a6.5 6.5 0 1 0 0 13c1 0 1.4-.8 1-1.6-.5-.9.1-1.9 1.1-1.9h1.6a2.8 2.8 0 0 0 2.8-2.8C16.5 6.4 13.6 3.5 10 3.5z"/><circle cx="6.8" cy="9" r=".8"/><circle cx="9" cy="6.5" r=".8"/><circle cx="12.3" cy="7" r=".8"/>`),
  swatch: svg(`<rect x="3.5" y="3.5" width="5.5" height="13" rx="1.5"/><path d="m9 6.5 3-1.6 3.4 6.3L9 14.8"/>`),
  sliders: svg(`<path d="M4 6h6M14 6h2M4 14h2M10 14h6"/><circle cx="12" cy="6" r="2"/><circle cx="8" cy="14" r="2"/>`),
  info: svg(`<circle cx="10" cy="10" r="7"/><path d="M10 9v4.5M10 6.6v.1"/>`),
  clock: svg(`<circle cx="10" cy="10" r="6.5"/><path d="M10 6.5V10l2.5 1.5"/>`),
  cart: svg(`<path d="M3 4h2l1.6 8h8.2L16.5 7H6"/><circle cx="8" cy="15.5" r="1"/><circle cx="14" cy="15.5" r="1"/>`),
  link: svg(`<path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-.8.8"/><path d="M11.5 8.5a3 3 0 0 0-4.2 0L5 10.8A3 3 0 0 0 9.2 15l.8-.8"/>`),
  receipt: svg(`<path d="M5 3.5h10v13l-2-1.2-1.7 1.2-1.3-1.2-1.3 1.2L7 15.3l-2 1.2z"/><path d="M7.5 7.5h5M7.5 10.5h5"/>`),
  layers: svg(`<path d="m10 4 6.5 3.5L10 11 3.5 7.5z"/><path d="m3.5 11 6.5 3.5 6.5-3.5"/>`),
  truck: svg(`<path d="M2.5 5.5h9v8h-9zM11.5 8.5h3l2.5 2.5v2.5h-5.5"/><circle cx="6" cy="14.5" r="1.5"/><circle cx="14" cy="14.5" r="1.5"/>`),
  grip: `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="currentColor"><circle cx="7.5" cy="5" r="1.4"/><circle cx="12.5" cy="5" r="1.4"/><circle cx="7.5" cy="10" r="1.4"/><circle cx="12.5" cy="10" r="1.4"/><circle cx="7.5" cy="15" r="1.4"/><circle cx="12.5" cy="15" r="1.4"/></svg>`,
  dots: `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="currentColor"><circle cx="5" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/></svg>`,
  close: svg(`<path d="m6 6 8 8M14 6l-8 8"/>`),
  ext: svg(`<path d="M8 5H5.5A1.5 1.5 0 0 0 4 6.5v8A1.5 1.5 0 0 0 5.5 16h8a1.5 1.5 0 0 0 1.5-1.5V12M11 4h5v5M16 4l-7 7"/>`, 14),
  ruler: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="2" y="7" width="20" height="10" rx="1.5"/><path d="M6 7v3M10 7v4M14 7v3M18 7v4"/></svg>`,
};

// ---------- small controls (one look everywhere) ----------

// Every word the offer block shows, grouped for the Texts card. Same keys and defaults as UI_TEXTS (core.py).
export const UI_TEXTS = [
  ["Button", [["add_one", "One item", "Add to cart"], ["add_many", "Several items", "Add {{count}} {{noun}} to cart"], ["adding", "While adding", "Adding…"],
    ["choose_options", "Options missing", "Choose your options"], ["select_size", "Size missing", "Select a size"], ["choose_sizes", "Sizes missing (packs)", "Choose {{unit}} sizes"],
    ["sold_out", "Sold out", "Sold out"], ["add_error", "Error", "Unable to add to cart. Please try again."]]],
  ["Bars and pickers", [["free", "Free word", "FREE"], ["save_tag", "Saving label", "Save {{saved}}"], ["select", "Empty drop-down", "Select"], ["choose_size", "No size yet", "Choose a size."],
    ["size_guide", "Size guide link", "Size guide"], ["no_size_guide", "No size guide yet", "Size measurements for this product are not available yet. Please contact us before ordering."], ["combo_sold_out", "Sold-out combination", "This combination is sold out. Choose another size or colour."],
    ["custom_mix", "Custom mix", "Custom Pack"], ["more", "More colours", "+{{count}} More"], ["apply_all", "Apply to all", "Apply to all ({{count}})"], ["done", "Done", "Done"], ["locked", "Locked gift", "Locked"]]],
  ["Build your own pack (pop-up)", [["pb_title", "Title", "Build your own pack"], ["pb_size", "Size step", "1. Choose your size"], ["pb_colors", "Colour step", "2. Add your colours"],
    ["pb_count", "Count", "{{count}} {{noun}} in your pack"], ["pb_next", "Next deal", "Add {{left}} more: {{next}}"], ["pb_min", "Minimum", "Add at least {{min}} {{noun}}"],
    ["pb_best", "Best price", "From {{unit_price}} / {{unit}}"], ["pb_cta", "Button", "Add {{count}} {{noun}} to cart · {{price}}"], ["pb_back", "Close", "Close"]]],
];

export const field = (label, control) => `<label class="be__field"><span>${label}</span>${control}</label>`;
export const input = (name, value, placeholder = "", attrs = "") => `<input name="${name}" value="${esc(value ?? "")}" placeholder="${esc(placeholder)}" autocomplete="off" ${attrs}>`;
export const select = (name, options, value) => `<span class="be__select"><select name="${name}">${options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value ?? "") ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>${I.updown}</span>`;
export const num = (name, value, unit, min, max, step = 1) => `<span class="be__num"><input type="number" name="${name}" value="${esc(value ?? "")}" min="${min}" max="${max}" step="${step}"><em>${unit}</em></span>`;
// Slider + number box, kept in sync inside their .be__range (several can share a name, e.g. one per badge).
export const range = (name, value, label, min, max, unit = "px") => `
  <div class="be__range"><span class="be__rlabel">${label}</span>
    <span class="be__rrow"><input type="range" name="${name}" min="${min}" max="${max}" value="${esc(value)}" data-r>
      <span class="be__num"><input type="number" min="${min}" max="${max}" value="${esc(value)}" data-rn aria-label="${label}"><em>${unit}</em></span></span>
  </div>`;
// app-style colour pill: a dot and an up/down mark, the native picker covers it; the hex shows on hover.
export const colorPill = (name, value, label) => `
  <label class="be__cp" title="${esc(value || "")}"><span>${label}</span>
    <span class="be__cpill"><i style="background:${esc(value)}"></i>${I.updown}<input type="color" name="${name}" value="${esc(value || "#000000")}"></span>
  </label>`;
// Same pill for an optional colour: empty = the design's own colour (striped dot); the x puts it back to empty.
export const optPill = (name, value, label) => `
  <label class="be__cp" title="${esc(value || "Design default")}"><span class="be__cphead">${label}<button type="button" class="be__cpx" data-oclear aria-label="Back to the default">${I.close}</button></span>
    <span class="be__cpill${value ? "" : " is-auto"}"><i style="${value ? `background:${esc(value)}` : ""}"></i>${I.updown}<input type="color" value="${esc(value || "#000000")}" data-ocolor aria-label="${label}"></span>
    <input type="hidden" name="${name}" value="${esc(value || "")}">
  </label>`;
// Content | Style tabs inside a feature block.
export const tabs = (content, style) => `
  <div class="be__tabs" role="tablist"><button type="button" class="is-on" data-tab="content">Content</button><button type="button" data-tab="style">Style</button></div>
  <div class="be__pane" data-pane="content">${content}</div><div class="be__pane" data-pane="style" hidden>${style}</div>`;
export const area = (name, label, value, placeholder = "", rows = 3) => `<label class="be__field"><span>${label}</span><textarea name="${name}" rows="${rows}" placeholder="${esc(placeholder)}" spellcheck="false">${esc(value ?? "")}</textarea></label>`;
export const check = (name, label, on) => `<label class="be__check"><input type="checkbox" name="${name}"${on ? " checked" : ""}><span>${label}</span></label>`;
export const toggle = (name, on, label) => `<label class="be__switch" title="${label}"><input type="checkbox" name="${name}"${on ? " checked" : ""} aria-label="${label}"><i></i></label>`;
// Text field with the {{variables}} button.
export const vfield = (name, label, value, placeholder) => `
  <label class="be__field"><span class="be__vlabel">${label}<button type="button" class="be__vbtn" data-vbtn aria-label="Insert a variable">{ }</button></span>
    ${input(name, value, placeholder)}
  </label>`;

// One collapsible block of the editor: chevron, icon, title, optional switch on the right.
export const card = ({ key, icon, title, body, open = false, extra = "" }) => `
  <details class="be__card be__sec"${open ? " open" : ""} data-sec="${key}">
    <summary><span class="be__chev">${I.chev}</span><span class="be__icon">${icon}</span><span class="be__title">${title}</span>${extra}</summary>
    <div class="be__body">${body}</div>
  </details>`;
