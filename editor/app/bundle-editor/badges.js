// Badges block (under the bars, switch on the right): one card per badge, linked to a bar. Each badge has its own
// style, text, size and colours, saved on its bar: tier.badge, badge_style, badge_size, badge_color, badge_bg.
import { esc, fullStyle, I, card, field, select, vfield, range, colorPill, toggle, tabs } from "./shared.js";
import { read as readStyle, featureStyle } from "./style.js";

const STYLES = [["floating", "Simple"], ["ribbon", "Strip on top"], ["inline", "Next to the title"], ["tab", "Tab with ears"], ["cap", "Cap"], ["foot", "After the gift line"], ["chip", "Chip on the top border"]];

const one = (t, key, st) => `
  <div class="bdg" data-badge>
    <div class="bdg__head"><b>Badge</b><button type="button" class="be__link is-danger" data-bremove>Remove</button></div>
    <div class="be__grid2">
      ${field("Style", select("b_style", STYLES, t.badge_style || st.badge_style || "floating").replace("<select", `<select data-init="${t.badge_style || st.badge_style || "floating"}" data-own="${t.badge_style || ""}"`))}
      ${field("Linked to", `<span class="be__select"><select name="b_bar" data-bkey="${esc(key)}"></select>${I.updown}</span>`)}
    </div>
    ${vfield("b_text", "Text", t.badge || "", "MOST POPULAR")}
    ${range("b_size", t.badge_size || st.badge_size, "Text size", 8, 20)}
    <div class="be__grid2">
      ${colorPill("b_color", t.badge_color || st.badge_text, "Text color")}
      ${colorPill("b_bg", t.badge_bg || st.badge_bg, "Background")}
    </div>
  </div>`;

export const html = (b, keys) => {
  const st = fullStyle(b), list = (b.tiers || []).map((t, i) => (t.badge ? one(t, keys[i], st) : "")).join("");
  return card({ key: "badges", icon: I.badge, title: "Badges", extra: toggle("badges_on", Boolean(list), "Show badges"), body: tabs(`
    <div class="bdg__list" data-blist>${list}</div>
    <button type="button" class="be__add be__add--soft" data-badd>${I.plus}<span>Add a badge</span></button>`, featureStyle(b, "badges")) });
};

// Writes the badges onto the bars they are linked to (tiers in the same order as `keys`).
export function apply(f, tiers, keys) {
  if (!f.elements.badges_on.checked) return tiers;
  const st = fullStyle({ ...readStyle(f), style: { ...(JSON.parse(f.elements.orig?.value || "{}").style || {}), ...readStyle(f).style } });
  f.querySelectorAll("[data-badge]").forEach((c) => {
    const v = (n) => c.querySelector(`[name="${n}"]`).value, t = tiers[keys.indexOf(v("b_bar"))];
    if (!t || !v("b_text").trim()) return;
    t.badge = v("b_text").trim();
    // untouched style: the bar keeps what it had; changed: saved on the bar unless it equals the bundle's style
    const bs = c.querySelector('[name="b_style"]');
    if (bs.value === bs.dataset.init) { if (bs.dataset.own) t.badge_style = bs.dataset.own; } else { if (bs.value !== (st.badge_style || "floating")) t.badge_style = bs.value; else delete t.badge_style; }
    if (Number(v("b_size")) !== st.badge_size) t.badge_size = Number(v("b_size"));
    if (v("b_color").toLowerCase() !== st.badge_text) t.badge_color = v("b_color").toLowerCase();
    if (v("b_bg").toLowerCase() !== st.badge_bg) t.badge_bg = v("b_bg").toLowerCase();
  });
  return tiers;
}

// "Linked to" lists the current bars by title; a bar already taken by another badge is disabled.
export function sync(f, bars) {
  const cards = [...f.querySelectorAll("[data-badge]")];
  const taken = cards.map((c) => c.querySelector('[name="b_bar"]').value || c.querySelector('[name="b_bar"]').dataset.bkey);
  cards.forEach((c, ci) => {
    const s = c.querySelector('[name="b_bar"]'), cur = taken[ci];
    s.innerHTML = bars.map((b, i) => `<option value="${esc(b.key)}"${b.key === cur ? " selected" : ""}${taken.includes(b.key) && b.key !== cur ? " disabled" : ""}>Bar #${i + 1} · ${esc(b.title)}</option>`).join("");
    if (!bars.some((b) => b.key === cur)) s.value = bars.find((b) => !taken.includes(b.key))?.key || bars[0]?.key || "";
    s.dataset.bkey = s.value;
  });
  f.querySelector("[data-badd]").disabled = cards.length >= bars.length;
}

export function wire(f, recalc, keysNow) {
  f.addEventListener("click", (e) => {
    if (e.target.closest("[data-bremove]")) { e.target.closest("[data-badge]").remove(); recalc(); return; }
    if (!e.target.closest("[data-badd]")) return;
    const used = [...f.querySelectorAll('[name="b_bar"]')].map((s) => s.value), key = keysNow().find((k) => !used.includes(k));
    if (!key) return;
    const st = fullStyle({ design: f.elements.design.value, style: {} });
    f.querySelector("[data-blist]").insertAdjacentHTML("beforeend", one({ badge: "MOST POPULAR" }, key, st));
    f.elements.badges_on.checked = true;
    f.querySelector('[data-sec="badges"]').open = true;
    recalc();
  });
}
