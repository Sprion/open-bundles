// Feature blocks, one per feature: a switch in the header when it can be off, Content | Style tabs inside:
// Gifts (bar gifts look), Pack link, Countdown, Gifts unlocked, Price summary, First bar as a link. Every value is a plain bundle field (apps/bundles/reference/components.md), so Claude can set the same thing without the editor.
import { UI_TEXTS, esc, I, card, field, input, num, select, check, vfield, toggle, tabs } from "./shared.js";
import { featureStyle } from "./style.js";
import * as gifts from "./gifts.js";

const ONOFF = [["", "Design default"], ["on", "Show"], ["off", "Hide"]];
const CD_MODES = [["midnight", "Until midnight, every day"], ["fixed", "Until a date"], ["evergreen", "Minutes from the first view"]];

// datetime-local wants "YYYY-MM-DDTHH:MM" (local time); the bundle stores ISO with the offset.
const toLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
};
const toIso = (local) => {
  if (!local) return "";
  const d = new Date(local), off = -d.getTimezoneOffset(), z = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  return `${local}:00${off >= 0 ? "+" : "-"}${z(off / 60)}:${z(off % 60)}`;
};

const ladderItem = (g = {}) => `
  <div class="lad__item" data-litem>
    <label class="be__field be__half"><span>Unlocked from bar #</span>${num("l_from", (g.from ?? 0) + 1, "", 1, 10)}</label>
    <div data-gbox>${gifts.card(g)}</div>
  </div>`;

const on3 = (v) => (v === true ? "on" : v === false ? "off" : "");

export const html = (b) => {
  const cd = b.countdown || {}, gl = b.gift_ladder || {};
  return [
    card({ key: "gifts", icon: I.gift, title: "Gifts in the bars", body: tabs(`
      ${field("Card title (look: white card)", input("gift_title", b.gift_title, "Limited Time Gifts"))}
      <div class="be__checks">
        ${check("gifts_selected_only", "Show gifts only in the selected bar", b.gifts_selected_only)}
        ${check("gifts_below_picker", "Show the selected bar's gifts under its variant pickers", b.gifts_below_picker)}
      </div>
      <p class="be__hint">Each bar's gifts are added in the bar (Add a gift). The look (strip, line, check, white card, hidden) is in the Style tab.</p>`, featureStyle(b, "gifts")) }),
    card({ key: "packlink", icon: I.link, title: "Build your own pack", extra: toggle("pl_on", Boolean(b.custom_text), "Build your own pack"), body: tabs(`
      <div class="be__grid2">
        ${field("Link text", input("custom_text", b.custom_text, "Build your own pack"))}
        ${field("Minimum items", `<input type="number" name="pb_min" value="${esc(b.pb_min ?? "")}" min="1" max="20" placeholder="Smallest bar">`)}
      </div>
      <p class="be__hint">Opens a pop-up on the same product page: one size, then + / - per colour, priced like the bars (the largest bar the quantity reaches). Its words are in the Texts card, its look and colours in the Style tab.</p>`, featureStyle(b, "packlink")) }),
    card({ key: "texts", icon: I.text || I.link, title: "Texts", body: `
      <p class="be__hint">Every word the offer shows. Empty = the default in grey. Variables: {{count}}, {{noun}}, {{unit}}, {{price}}, {{saved}}, {{left}}, {{next}}, {{min}}, {{unit_price}}.</p>
      ${UI_TEXTS.map(([g, list]) => `<div class="be__group"><h4>${g}</h4><div class="be__grid2">${list.map(([k, label, def]) => field(label, input(`ui_${k}`, (b.ui || {})[k], def))).join("")}</div></div>`).join("")}` }),
    card({ key: "countdown", icon: I.clock, title: "Countdown", extra: toggle("cd_on", Boolean(cd.mode), "Countdown"), body: tabs(`
      <div class="be__grid2">
        <label class="be__field"><span>Ends</span>${select("cd_mode", CD_MODES, cd.mode || "midnight")}</label>
        ${field("Label", input("cd_label", cd.label, "Ends in"))}
        <label class="be__field" data-cdend><span>Ends at</span><input type="datetime-local" name="cd_end" value="${esc(toLocal(cd.end))}"></label>
        <label class="be__field" data-cdmin><span>Minutes</span>${num("cd_minutes", cd.minutes || 15, "min", 1, 1440)}</label>
      </div>
      <div class="be__checks">${check("cd_in_banner", "Also show it in the banner", cd.in_banner)}</div>
      <p class="be__hint">A bar shows it when its "Countdown on this bar" box is ticked.</p>`, featureStyle(b, "countdown")) }),
    card({ key: "ladder", icon: I.gift, title: "Gifts unlocked", extra: toggle("gl_on", (gl.items || []).length > 0, "Gifts unlocked"), body: tabs(`
      ${field("Title", input("gl_title", gl.title, "Gifts unlocked"))}
      <div class="be__checks">${check("gl_in_bars", "Also list the unlocked gifts in each bar", gl.in_bars)}</div>
      <div data-litems>${(gl.items || []).map(ladderItem).join("")}</div>
      <button type="button" class="be__add be__add--soft" data-ladd>${I.plus}<span>Add a gift</span></button>`, featureStyle(b, "ladder")) }),
    card({ key: "summary", icon: I.receipt, title: "Price summary", body: tabs(`
      <label class="be__field be__half"><span>Show</span>${select("summary", ONOFF, on3(b.summary))}</label>
      <div class="be__grid2">
        ${vfield("deal_text", "Deal pill", b.deal_text, "{{saved_percentage}} OFF")}
        ${field("Deal label", input("deal_label", b.deal_label, "Today's deal"))}
        ${vfield("deal_note", "Right side", b.deal_note, "Saving {{saved_total}}")}
        ${vfield("single_note", "Under a bar without saving ({{pack}} = best pack)", b.single_note, "Save up to {{saved_percentage}} with the {{pack}}")}
      </div>
      <div class="be__checks">${check("hide_nudge", "Hide the link to the best pack under a single item", b.hide_nudge)}</div>`, featureStyle(b, "summary")) }),
    card({ key: "firstlink", icon: I.link, title: "First bar as a link", extra: toggle("first_link", b.first_link, "First bar as a link"), body: tabs(`
      ${vfield("first_link_text", "Link text", b.first_link_text, "Buy once: {{price}} (no savings)")}
      <p class="be__hint">The first bar leaves the list and shows as this text link under the others.</p>`, featureStyle(b, "firstlink")) }),
  ].join("");
};

const tri = (v) => (v === "on" ? true : v === "off" ? false : undefined);

export function read(f) {
  const e = f.elements, v = (n) => e[n].value.trim(), out = {
    summary: tri(e.summary.value), deal_text: v("deal_text"), deal_label: v("deal_label"), deal_note: v("deal_note"), single_note: v("single_note"), hide_nudge: e.hide_nudge.checked,
    first_link: e.first_link.checked, first_link_text: v("first_link_text"),
    countdown: undefined, gift_ladder: undefined,
    gift_title: v("gift_title"), gifts_selected_only: e.gifts_selected_only.checked, gifts_below_picker: e.gifts_below_picker.checked,
    custom_text: e.pl_on.checked ? v("custom_text") : "", custom_url: undefined, pb_min: e.pl_on.checked && v("pb_min") ? Number(v("pb_min")) : undefined,
    ui: Object.fromEntries(UI_TEXTS.flatMap(([, list]) => list).map(([k]) => [k, v(`ui_${k}`)]).filter(([, x]) => x)),
  };
  if (e.cd_on.checked) {
    out.countdown = { mode: e.cd_mode.value, label: v("cd_label"), in_banner: e.cd_in_banner.checked };
    if (e.cd_mode.value === "fixed") out.countdown.end = toIso(e.cd_end.value);
    if (e.cd_mode.value === "evergreen") out.countdown.minutes = Number(e.cd_minutes.value) || 15;
  }
  if (e.gl_on.checked) {
    const items = [...f.querySelectorAll("[data-litem]")].map((it) => {
      const g = gifts.read(it)[0];
      return g ? { ...g, from: Math.max(0, (Number(it.querySelector('[name="l_from"]').value) || 1) - 1) } : null;
    }).filter(Boolean);
    if (items.length) out.gift_ladder = { title: v("gl_title"), in_bars: e.gl_in_bars.checked, items };
  }
  return out;
}

export function sync(f) {
  const mode = f.elements.cd_mode.value;
  f.querySelector("[data-cdend]").hidden = mode !== "fixed";
  f.querySelector("[data-cdmin]").hidden = mode !== "evergreen";
  f.querySelectorAll("[data-litem]").forEach((it) => gifts.sync(it));
}

export function wire(f, recalc) {
  f.addEventListener("click", (e) => {
    if (!e.target.closest("[data-ladd]")) return;
    f.querySelector("[data-litems]").insertAdjacentHTML("beforeend", ladderItem({ type: "product", show_price: true, from: f.querySelectorAll("[data-litem]").length }));
    f.elements.gl_on.checked = true;
    recalc();
  });
  // a removed gift takes its "from" box with it
  f.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-gremove]"), it = rm?.closest("[data-litem]");
    if (it) { e.stopPropagation(); it.remove(); recalc(); }
  }, true);
}
