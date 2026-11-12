// Style block: layout, design, corner radius and spacing, Colors, Typography, Parts, custom CSS.
// The feature blocks (badges, countdown, gifts unlocked, price summary, first bar link) show their own colours and
// sizes in a Style tab, built here by featureStyle(). Every control is a bundle.style field (st_<key>); only values that
// differ from the design are saved. Empty optional values = the design's own value.
import { esc, PRESETS, designOf, fullStyle, range, colorPill, optPill, select, I, card } from "./shared.js";

const WEIGHTS = [[400, "Normal"], [500, "Medium"], [600, "Semibold"], [700, "Bold"], [800, "Extra bold"]];
// Look options that are not colours or sizes ("" = the design's default).
const LOOKS = {
  banner_style: [["", "Design default"], ["plain", "Plain text"], ["line", "Between two lines"], ["box", "Dashed box"]],
  price_layout: [["", "Design default"], ["inline", "Before the price"], ["stack", "Under the price"], ["after", "After the price"]],
  gift_style: [["", "Coloured strip"], ["line", "Line with icon"], ["check", "Check mark and note"], ["box", "White card with a title"], ["none", "Hidden (still added)"]],
  button_price: [["", "After a dot"], ["pill", "In a pill"], ["plain", "After a space"], ["pipe", "After a | bar"]],
  badge_style: [["", "Design default"], ["floating", "Simple"], ["ribbon", "Strip on top"], ["inline", "Next to the title"], ["tab", "Tab with ears"], ["cap", "Cap"], ["foot", "After the gift line"], ["chip", "Chip on the top border"]],
  badge_case: [["", "Capitals"], ["none", "As typed"]],
  ship_style: [["", "Box"], ["dashed", "Between dashed lines"], ["plain", "Dot and text, centred"], ["caps", "Small capitals"]],
  ship_position: [["", "Above the button"], ["below", "Under the button"]],
  tag_case: [["", "Capitals"], ["none", "As typed"]],
  chip_case: [["", "As typed"], ["upper", "Capitals"]],
  cta_case: [["", "Theme"], ["upper", "Capitals"], ["none", "As typed"]],
  sw_ratio: [["", "Portrait"], ["square", "Square, fixed size"]],
  dd_caret: [["", "Chevron"], ["triangle", "Triangle"]],
  rows_free_style: [["", "FREE under the number"], ["row", "Tinted row, gift icon, chip"]],
  size_label: [["", "Shown"], ["none", "Hidden"]],
  banner_look: [["", "Text"], ["ticket", "Ticket (number from the bar)"]],
  custom_style: [["", "Card with photos and arrow"], ["link", "Text link"], ["button", "Outlined button"]],
  il_size_pos: [["", "At the end of the line"], ["after", "Right after the colours"]],
  tracking: [["", "Theme"], ["normal", "Normal"], ["tight", "Tight"]],
  font: [["", "Theme font"], ["system", "System font"]],
  dot_style: [["", "Dot"], ["fill", "Filled, white ring"], ["solid", "Solid"], ["ring", "Thick ring"]],
  mix_label: [["", "Shown"], ["none", "Hidden"]],
  mix_pic: [["", "Overlapping photos"], ["single", "One photo"], ["none", "No photo"]],
  rows_hint_align: [["", "Centered"], ["left", "Left"]],
  subtitle_style: [["normal", "Normal"], ["italic", "Italic"], ["chip", "Chip next to the title"]],
};

// Labels, by key. The group title gives the context, so labels stay short.
const L = {
  cards_bg: "Background", selected_bg: "Selected", border: "Border", accent: "Selected border", block_title_color: "Block title", text: "Main text", dot_color: "Radio ring",
  title_color: "Title", subtitle_color: "Subtitle", price_color: "Price", strike: "Full price",
  tag_bg: "Label", tag_text: "Label text", save_bg: "Saving pill", save_text_color: "Saving text",
  gift_bg: "Gift strip", gift_text: "Gift text", gift_line: "Divider", gift_note: "Note", plus_color: "+ sign",
  highlight_text: "Highlight text", highlight_icon: "Check mark", banner_bg: "Banner", banner_text: "Banner text",
  rows_line: "Hint line", rows_num_color: "Item number", rows_label_color: "Labels", dd_border: "Drop-down border", mix_badge_bg: "Mix badge", mix_badge_text: "Mix badge text",
  button: "Button", button_text: "Button text", cta_wait: "Before a size", ship_dot: "Delivery dot",
  badge_bg: "Background", badge_text: "Text", badge_ring: "Outline",
  timer_bg: "Background", timer_text: "Text", timer_accent: "Time",
  ladder_bg: "Background", ladder_text: "Text", ladder_accent: "Free text", ladder_label_bg: "Label",
  unit_price_color: "Price per item", deal_bg: "Deal pill", deal_text_color: "Deal pill text", link_color: "Link",
  // looks
  banner_style: "Banner", price_layout: "Struck price", gift_style: "Gift display", button_price: "Total in the button", badge_style: "Style (all bars)",
  badge_case: "Letters", ship_style: "Delivery line", tracking: "Letter spacing", font: "Font", dot_style: "Radio when selected", mix_label: "Mix names",
  rows_hint_align: "Hint", subtitle_style: "Subtitle style",
  // sizes
  bar_pad_y: "Padding, top", bar_pad_b: "Padding, bottom", bar_pad_x: "Padding, sides", sel_border: "Selected border", edge: "Wider by",
  row_gap: "Gap inside", dot_size: "Radio size", dot_border: "Radio ring",
  title_lh: "Title line", price_lh: "Price line", strike_lh: "Full price line", unit_lh: "Per item line", unit_gap: "Per item gap", price_gap: "Price gap",
  save_pad_y: "Padding, top", save_pad_x: "Padding, sides", save_radius: "Corners", save_gap: "Gap to title",
  thumb_size: "Width", thumb_h: "Height", thumb_gap: "Gap", thumb_cap_size: "Caption", free_pad_y: "FREE, top", free_pad_x: "FREE, sides",
  hl_size: "Text", hl_gap: "Line gap", hl_top: "Space above", hl_icon: "Check size",
  gift_note_size: "Note size", gift_top: "Space above", gift_pad: "Under divider",
  row_height: "Row height", rows_hint_size: "Hint size", rows_num_w: "Number column", rows_num_size: "Number size", rows_free_size: "FREE size",
  rows_label_size: "Label size", rows_size_w: "Size column", rows_col_gap: "Column gap", dd_h: "Drop-down height", dd_radius: "Drop-down corners",
  dd_size: "Drop-down text", dd_swatch: "Drop-down picture",
  pill_on_weight: "Selected pill weight", pill_h: "Pill height", pill_pad: "Pill padding", pill_lh: "Pill line", pill_sub_size: "Pill subtitle", mix_w: "Mix width", mix_h: "Mix height",
  mix_gap: "Mix gap", mix_badge_size: "Mix badge", mix_badge_radius: "Mix badge corners",
  size_head_size: "Size title", size_btn_w: "Size width", size_btn_h: "Size height", cta_h: "Button height", cta_radius: "Button corners", ship_halo: "Dot halo",
  badge_lh: "Line height", badge_pad_y: "Padding, top", badge_pad_x: "Padding, sides", badge_radius: "Corners", badge_top: "Raised by",
  badge_right: "From right", badge_left: "From left (pills)", badge_space: "Space above bar", badge_ear: "Tab ears", badge_pad_in: "Inside space (tab)", badge_ring_w: "Outline width",
  chip_size: "Text", chip_pad_y: "Padding, top", chip_pad_x: "Padding, sides", chip_radius: "Corners", chip_top: "Raised by", chips_pad: "Space under chips",
  ladder_item_size: "Item text", ladder_pic: "Picture", unitp_size: "Per item text", deal_radius: "Deal corners", deal_pad_y: "Deal padding, top",
  deal_pad_x: "Deal padding, sides", link_size: "Link size",
  tag_border: "Label outline", sub_chip_bg: "Subtitle chip", sub_chip_border: "Chip outline", rows_free_bg: "Free row", custom_bg: "Background", custom_border: "Border", custom_arrow_bg: "Arrow",
  gift_title_color: "Card title", gift_free_color: "FREE", gift_box_border: "Card border", ship_strong: "Bold words", label_value_color: "Chosen value", btn_was_color: "Struck total",
  ticket_bg: "Ticket", ticket_text: "Ticket text", ticket_accent: "Ticket number", ticket_stub_bg: "Stub", ticket_stub_text: "Stub text", note_color: "Note", dd_text: "Drop-down text",
  tag_case: "Letters", chip_case: "Letters", cta_case: "Letters", sw_ratio: "Swatch shape", dd_caret: "Arrow", rows_free_style: "Free items", ship_position: "Position", size_label: "Size label", banner_look: "Look",
  sw_radius: "Swatch corners", sw_pad: "Swatch inner margin", tag_radius: "Corners", tag_pad_y: "Padding, top", tag_pad_x: "Padding, sides", rows_color_w: "Colour column",
  rows_indent: "Indent", rows_hint_top: "Space above hint", rows_gap: "Row gap", gift_img: "Gift picture", gift_title_size: "Card title", ship_size: "Text size", note_size: "Note size",
  custom_size: "Text size", chips_gap: "Chip gap", price_strike_gap: "Gap to struck price",
  rows_hint_color: "Hint", rows_hint_x: "Hint from left", sub_lh: "Subtitle line", thumb_cap_lh: "Caption line", thumb_stack_x: "Second photo, right", thumb_stack_y: "Second photo, down", mix_name_size: "Mix name size",
  custom_style: "Look", il_size_pos: "Size menu (inline picker)", mix_pic: "Mix picture", pb_bar: "Progress bar", pb_hint: "Next deal text",
  pnum_bg: "Number background", pnum_text: "Number text",
};

// Main Style block: one folding section per element of the offer, each with its looks, colours,
// typography and sizes together. A key appears once; empty = the design's own value.
const SECTIONS = [
  { k: "bars", t: "Bars", looks: "font tracking dot_style", colors: "cards_bg selected_bg border accent text dot_color",
    sizes: "bar_pad_y bar_pad_b bar_pad_x sel_border edge row_gap dot_size dot_border" },
  { k: "head", t: "Block title", colors: "block_title_color", typo: [["Block title", "block_title_size", "block_title_weight"]] },
  { k: "texts", t: "Titles and prices", looks: "subtitle_style price_layout", colors: "title_color subtitle_color price_color strike",
    typo: [["Title", "title_size", "title_weight"], ["Subtitle", "subtitle_size", "subtitle_weight"], ["Price", "price_size", "price_weight"],
      ["Full price", "strike_size", "strike_weight"], ["Price per item", "unit_size", "unit_weight"]],
    sizes: "title_lh sub_lh price_lh strike_lh unit_lh unit_gap price_gap price_strike_gap" },
  { k: "chips", t: "Labels and saving pill", looks: "tag_case", colors: "tag_bg tag_text tag_border sub_chip_bg sub_chip_border save_bg save_text_color",
    typo: [["Label", "label_size", "label_weight"], ["Label (own size)", "tag_size", "tag_weight"], ["Subtitle chip", "sub_chip_size", "sub_chip_weight"], ["Saving pill", "save_size", "save_weight"]],
    sizes: "tag_radius tag_pad_y tag_pad_x chips_gap save_pad_y save_pad_x save_radius save_gap" },
  { k: "photos", t: "Photos", colors: "plus_color pnum_bg pnum_text", typo: [["+ sign", "plus_size", "plus_weight"]],
    sizes: "thumb_size thumb_h thumb_gap thumb_stack_x thumb_stack_y thumb_cap_size thumb_cap_lh free_pad_y free_pad_x" },
  { k: "variants", t: "Variant pickers", looks: "sw_ratio size_label dd_caret il_size_pos rows_free_style rows_hint_align",
    colors: "rows_hint_color rows_line rows_num_color rows_label_color dd_border dd_text label_value_color rows_free_bg",
    typo: [["Item number", "rows_num_size", "rows_num_weight"], ["Drop-down", "dd_size", "dd_weight"], ["Chosen value", "", "label_value_weight"]],
    sizes: "sw_radius sw_pad rows_hint_x rows_indent rows_hint_top rows_gap rows_color_w row_height rows_hint_size rows_num_w rows_free_size rows_label_size rows_size_w rows_col_gap dd_h dd_radius dd_swatch" },
  { k: "pills", t: "Pills and colour mixes", looks: "mix_label mix_pic", colors: "mix_badge_bg mix_badge_text", typo: [["Pill title", "pill_title_size", "pill_weight"]],
    sizes: "pill_on_weight mix_name_size pill_h pill_pad pill_lh pill_sub_size mix_w mix_h mix_gap mix_badge_size mix_badge_radius" },
  { k: "highlights", t: "Highlights", colors: "highlight_text highlight_icon", sizes: "hl_size hl_gap hl_top hl_icon" },
  { k: "banner", t: "Banner", looks: "banner_look banner_style", colors: "banner_bg banner_text ticket_bg ticket_text ticket_accent ticket_stub_bg ticket_stub_text" },
  { k: "button", t: "Button and delivery", looks: "button_price cta_case ship_style ship_position", colors: "button button_text btn_was_color cta_wait ship_dot ship_strong",
    typo: [["Button", "cta_size", "cta_weight"]], sizes: "size_head_size size_btn_w size_btn_h cta_h cta_radius ship_halo ship_size" },
  { k: "note", t: "Note under the bars", colors: "note_color", sizes: "note_size" },
];
const sectionKeys = (x) => [x.looks, x.colors, x.sizes, ...(x.typo || []).flatMap(([, a, b]) => [a, b])].filter(Boolean).join(" ").split(" ").filter(Boolean);
// Style tab of each feature block.
const FEATURES = {
  badges: { colors: "badge_bg badge_text badge_ring", typo: [["Badge", "badge_size", "badge_weight"]],
    parts: [["Shape", "badge_style badge_case badge_lh badge_pad_y badge_pad_x badge_radius badge_ring_w badge_ear"], ["Position", "badge_top badge_right badge_left badge_space badge_pad_in"]] },
  countdown: { colors: "timer_bg timer_text timer_accent", parts: [["Top chips (also the label on the border)", "chip_case chip_size chip_pad_y chip_pad_x chip_radius chip_top chips_pad"]] },
  ladder: { colors: "ladder_bg ladder_text ladder_accent ladder_label_bg", typo: [["Label", "ladder_title_size", "ladder_title_weight"]], parts: [["Items", "ladder_item_size ladder_pic"]] },
  summary: { colors: "unit_price_color deal_bg deal_text_color", typo: [["Total", "totals_size", "totals_weight"], ["Deal line", "deal_size", "deal_weight"]],
    parts: [["Sizes", "unitp_size deal_radius deal_pad_y deal_pad_x"]] },
  firstlink: { colors: "link_color", parts: [["Sizes", "link_size"]] },
  gifts: { colors: "gift_bg gift_text gift_line gift_note gift_title_color gift_free_color gift_box_border",
    typo: [["Gift line", "gift_size", "gift_weight"], ["Gift name (card)", "gift_name_size", "gift_name_weight"], ["Card title", "gift_title_size", "gift_title_weight"]],
    parts: [["Look", "gift_style"], ["Sizes", "gift_note_size gift_top gift_pad gift_img"]] },
  packlink: { colors: "custom_bg custom_border custom_arrow_bg pb_bar pb_hint", typo: [["Text", "custom_size", "custom_weight"]], parts: [["Look", "custom_style"]] },
};

const COLOR_KEYS = new Set([...SECTIONS.map((x) => x.colors || ""), ...Object.values(FEATURES).map((x) => x.colors)].join(" ").split(" "));

// One control for a key: colour pill, look select, weight select or a px box (the kind follows from the key).
function control(k, c) {
  const inPre = k in c.pre, label = L[k] || k;
  if (LOOKS[k]) return `<label class="be__field"><span>${label}</span>${select(`st_${k}`, LOOKS[k], c.s[k] || (k === "subtitle_style" ? "normal" : ""))}</label>`;
  if (k.endsWith("_weight")) return `<label class="be__field"><span>${label}</span>${weight(k, c, label)}</label>`;
  if (COLOR_KEYS.has(k)) return inPre ? colorPill(`st_${k}`, c.st[k], label) : optPill(`st_${k}`, c.s[k], label);
  return px(k, c, label);
}
const px = (k, c, label) => `<label class="be__field"><span>${label}</span><span class="be__num"><input type="number" name="st_${k}" value="${esc(k in c.pre ? c.st[k] : c.s[k] ?? "")}" placeholder="auto" min="-100" max="400" step="0.5" aria-label="${label}"><em>px</em></span></label>`;
const weight = (k, c, label) => k in c.pre
  ? select(`st_${k}`, WEIGHTS, c.st[k]).replace("<select", `<select aria-label="${label}"`)
  : select(`st_${k}`, [["", "Default"], ...WEIGHTS], c.s[k] ?? "").replace("<select", `<select aria-label="${label}"`);
const ctx = (b) => { const d = designOf(b); return { s: b.style || {}, st: fullStyle(b), pre: { ...PRESETS[d].colors, ...PRESETS[d].sizes } }; };
const keys = (str) => str.split(" ");

const colorsHtml = (list, c) => list.map(([g, ks]) => `<div class="st__g"><p class="st__gt">${g}</p><div class="st__colors">${keys(ks).map((k) => control(k, c)).join("")}</div></div>`).join("");
const typoHtml = (list, c) => `<div class="st__typo">${list.map(([el, sk, wk]) => `
  <div class="st__ty"><p>${el}</p><div class="st__tyrow">${!sk ? "<span></span>" : px(sk, c, `${el} size`).replace(/<span>[^<]*<\/span>/, "")}${weight(wk, c, `${el} weight`)}</div></div>`).join("")}</div>`;
const partsHtml = (list, c) => list.map(([g, ks]) => `<div class="st__g"><p class="st__gt">${g}</p><div class="st__nums">${keys(ks).map((k) => control(k, c)).join("")}</div></div>`).join("");

// Style tab of a feature block (badges, countdown, ladder, summary, firstlink).
export function featureStyle(b, key) {
  const c = ctx(b), f = FEATURES[key];
  return `<div data-fstyle="${key}">
    <div class="st__sec"><h4>Colors</h4>${colorsHtml([["", f.colors]], c).replace('<p class="st__gt"></p>', "")}</div>
    ${f.typo ? `<div class="st__sec"><h4>Typography</h4>${typoHtml(f.typo, c)}</div>` : ""}
    <div class="st__sec"><h4>Sizes</h4>${partsHtml(f.parts, c)}</div>
  </div>`;
}

// The layouts (how the bars are arranged), drawn as mini wireframes.
const LAYOUTS = [["list", "List"], ["columns", "Columns"], ["grid", "Grid"], ["compact", "Compact"], ["pills", "Pills"]];
const wireframe = (k) => {
  if (k === "columns") return `<span class="st__wf st__wf--columns">${[0, 1, 2].map((i) => `<i${i === 1 ? ' class="on"' : ""}><b></b><s></s></i>`).join("")}</span>`;
  if (k === "grid") return `<span class="st__wf st__wf--grid">${[0, 1, 2, 3].map((i) => `<i${i === 0 ? ' class="on"' : ""}><b></b><s></s></i>`).join("")}</span>`;
  if (k === "pills") return `<span class="st__wf st__wf--columns st__wf--pills">${[0, 1, 2, 3].map((i) => `<i${i === 1 ? ' class="on"' : ""}><b></b></i>`).join("")}</span>`;
  const row = (on) => `<i${on ? ' class="on"' : ""}>${k === "compact" ? "<em></em>" : ""}<b></b><s></s></i>`;
  return `<span class="st__wf st__wf--${k}">${row(false)}${row(true)}${row(false)}</span>`;
};

const changed = (x, s) => sectionKeys(x).filter((k) => k in s).length;
const section = (x, c, s) => {
  const n = changed(x, s);
  return `<details class="st__acc" data-acc="${x.k}">
    <summary><span class="be__chev">${I.chev}</span><b>${x.t}</b><small data-accn>${n ? `${n} changed` : ""}</small></summary>
    <div class="st__accb">
      ${x.looks ? `<div class="st__nums">${keys(x.looks).map((k) => control(k, c)).join("")}</div>` : ""}
      ${x.colors ? `<div class="st__g"><p class="st__gt">Colors</p><div class="st__colors">${keys(x.colors).map((k) => control(k, c)).join("")}</div></div>` : ""}
      ${x.typo ? `<div class="st__g"><p class="st__gt">Typography</p>${typoHtml(x.typo, c)}</div>` : ""}
      ${x.sizes ? `<div class="st__g"><p class="st__gt">Sizes and spacing <small>Empty = the design's value</small></p><div class="st__nums">${keys(x.sizes).map((k) => control(k, c)).join("")}</div></div>` : ""}
    </div></details>`;
};

function body(b) {
  const c = ctx(b), d = designOf(b), lay = b.layout || "list";
  return `
    <div class="st__layouts" role="radiogroup" aria-label="Layout">
      ${LAYOUTS.map(([k, name]) => `
        <label class="st__layout${k === lay ? " is-on" : ""}" title="${name}"><input type="radio" name="layout" value="${k}"${k === lay ? " checked" : ""} aria-label="${name}">
          ${wireframe(k)}<span>${name}</span></label>`).join("")}
    </div>
    <div class="be__grid2">
      <label class="be__field"><span>Design</span>${select("design", Object.entries(PRESETS).map(([k, p]) => [k, p.name]), d)}</label><span></span>
      ${range("st_radius", c.st.radius, "Corner radius", 0, 30)}${range("st_spacing", c.st.spacing, "Spacing", 0, 30)}
    </div>
    <div class="st__accs">${SECTIONS.map((x) => section(x, c, b.style || {})).join("")}
      <details class="st__acc" data-acc="css"><summary><span class="be__chev">${I.chev}</span><b>Custom CSS</b><small>${b.css ? "In use" : ""}</small></summary>
        <div class="st__accb"><textarea name="css" class="be__css" spellcheck="false" placeholder=".ob__title { letter-spacing: -0.01em; }">${esc(b.css || "")}</textarea></div></details>
    </div>
    <button type="button" class="be__link" data-resetstyle>Reset to the design's defaults</button>`;
}

export const html = (b) => card({ key: "style", icon: I.brush, title: "Style", body: `<div data-stylebody>${body(b)}</div>` });

export function read(f) {
  const design = f.elements.design.value || "boxed", layout = f.querySelector('input[name="layout"]:checked')?.value || "list";
  const defaults = { ...PRESETS[design].colors, ...PRESETS[design].sizes, swatch_shape: "", subtitle_style: "normal", banner_style: "", price_layout: "", gift_style: "", button_price: "" };
  const style = {}, kept = JSON.parse(f.elements.orig?.value || "{}").style || {};
  f.querySelectorAll('[name^="st_"]').forEach((x) => {
    if ((x.type === "radio" && !x.checked) || x.value === "") return;
    const k = x.name.slice(3), val = ["number", "range"].includes(x.type) || k.endsWith("_weight") ? Number(x.value) : x.value.toLowerCase();
    // a value equal to the design's default is not saved, unless the bundle already had it (opening and saving changes nothing)
    if (String(val) !== String(defaults[k]) || k in kept) style[k] = val;
  });
  return { design, layout, style, css: f.elements.css.value };
}

// Every style value on screen (not only the ones that differ from the design's defaults).
function current(f) {
  const out = {};
  f.querySelectorAll("[name^='st_']").forEach((x) => {
    if (x.value === "" || (x.type === "radio" && !x.checked)) return;
    const k = x.name.slice(3);
    out[k] = ["number", "range"].includes(x.type) || k.endsWith("_weight") ? Number(x.value) : x.value.toLowerCase();
  });
  return out;
}

export function wire(f, recalc) {
  const counts = () => {
    const s = read(f).style;
    SECTIONS.forEach((x) => { const el = f.querySelector(`.st__acc[data-acc="${x.k}"] [data-accn]`); if (el) { const n = changed(x, s); el.textContent = n ? `${n} changed` : ""; } });
  };
  // Redraws the Style block and every feature Style tab (a design switch keeps every colour, size and weight).
  const redraw = (b) => {
    const open = [...f.querySelectorAll(".st__acc[open]")].map((x) => x.dataset.acc);
    f.querySelector("[data-stylebody]").innerHTML = body(b);
    open.forEach((k) => { const x = f.querySelector(`.st__acc[data-acc="${k}"]`); if (x) x.open = true; });
    f.querySelectorAll("[data-fstyle]").forEach((x) => { x.outerHTML = featureStyle(b, x.dataset.fstyle); });
    recalc();
  };
  f.addEventListener("change", (e) => {
    if (e.target.name?.startsWith("st_")) counts();
    if (e.target.name === "design") redraw({ design: e.target.value, layout: read(f).layout, style: current(f), css: f.elements.css.value });
  });
  f.addEventListener("input", (e) => {
    if (!e.target.matches("[data-ocolor]")) return;
    const lab = e.target.closest(".be__cp");
    lab.querySelector('input[type="hidden"]').value = e.target.value;
    lab.title = e.target.value;
    recalc();
  });
  f.addEventListener("click", (e) => {
    const x = e.target.closest("[data-oclear]");
    if (x) { e.preventDefault(); const lab = x.closest(".be__cp"); lab.querySelector('input[type="hidden"]').value = ""; lab.title = "Design default"; recalc(); return; }
    if (e.target.closest("[data-resetstyle]")) redraw({ design: read(f).design, layout: read(f).layout, style: {}, css: "" });
  });
}
