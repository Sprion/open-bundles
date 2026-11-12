// Settings > Variants pop-ups: "Add swatches" (variant photos or plain colours, shape, size) and
// "Set default variants" (the variant each item of each bar starts on). They write hidden fields of the form:
// sw_type, sw_colors (JSON), st_swatch_shape, st_swatch_size, and each bar's `defaults` (JSON).
import { esc, I, range, select } from "./shared.js";

// A first guess for common colour names; every value stays editable.
const GUESS = { black: "#111111", white: "#f4f4f2", blue: "#2a6f97", navy: "#1f2a44", grey: "#8a8f94", gray: "#8a8f94", green: "#3c6e47",
  red: "#a8321f", beige: "#d8c8a8", cream: "#efe6d2", brown: "#6b4a2e", camel: "#b8875a", olive: "#6b6b3a", petrol: "#1f5f66", pink: "#e3a1ac" };
const guess = (name) => GUESS[Object.keys(GUESS).find((k) => name.toLowerCase().includes(k))] || "#cccccc";

function modal(title, body) {
  const m = document.createElement("div");
  m.className = "imp";
  m.innerHTML = `
    <div class="imp__box vpo" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="imp__head"><b>${esc(title)}</b><button type="button" class="imp__x" data-close aria-label="Close">${I.close}</button></div>
      ${body}
      <div class="imp__foot"><button type="button" class="xbtn xbtn--ghost" data-cancel>Cancel</button><button type="button" class="xbtn xbtn--primary" data-done>Apply</button></div>
    </div>`;
  document.body.append(m);
  return m;
}

const thumb = (url) => esc(url + (url.includes("?") ? "&" : "?") + "width=120");

export function swatches(f, opts, onChange) {
  const colors = opts?.colors || [];
  const cur = JSON.parse(f.elements.sw_colors.value || "{}");
  const m = modal("Add swatches to the variant picker", `
    <div class="imp__cols vpo__cols"><div class="imp__side">
    <p class="vpo__h">Settings</p>
    <div class="vpo__types">
      <label><input type="radio" name="vp_type" value=""${f.elements.sw_type.value !== "color" ? " checked" : ""}>${I.image}<span>Variant photos</span></label>
      <label><input type="radio" name="vp_type" value="color"${f.elements.sw_type.value === "color" ? " checked" : ""}>${I.palette}<span>Colors</span></label>
    </div>
    <div class="vpo__list" data-colors>
      ${colors.map((c) => `<label class="vpo__row"><span class="vpo__sw" data-sw="${esc(c.name)}">${c.image ? `<img src="${thumb(c.image)}" alt="">` : ""}</span><b>${esc(c.name)}</b>
        <span class="be__cpill"><i></i><code></code>${I.updown}<input type="color" data-color="${esc(c.name)}" value="${esc(cur[c.name] || guess(c.name))}"></span></label>`).join("") || `<p class="be__hint">No colour option on this product.</p>`}
    </div>
    <div class="be__grid2">
      <label class="be__field"><span>Shape</span>${select("vp_shape", [["", "Theme default"], ["circle", "Circle"], ["rounded", "Rounded"], ["square", "Square"]], f.elements.st_swatch_shape.value)}</label>
      ${range("vp_size", f.elements.st_swatch_size.value || 38, "Size", 20, 90)}
    </div>
    </div><div class="vpo__pv"><p class="vpo__h">Preview</p><div class="vpo__pvbar"><i class="vpo__radio"></i><div class="vpo__pvbody">
      <div class="vpo__pvtop"><b>2 items</b><span>$229.90</span></div><div class="vpo__pvsw" data-vpv></div></div></div></div></div>`);
  const draw = () => {
    const color = m.querySelector('[name="vp_type"]:checked').value === "color", shape = m.querySelector('[name="vp_shape"]').value, size = m.querySelector('[name="vp_size"]').value;
    m.querySelectorAll(".vpo__types label").forEach((l) => l.classList.toggle("is-on", l.querySelector("input").checked));
    m.querySelectorAll(".vpo__row").forEach((r) => {
      const inp = r.querySelector("[data-color]"), sw = r.querySelector("[data-sw]");
      r.querySelector(".be__cpill").hidden = !color;
      r.querySelector(".be__cpill i").style.background = r.querySelector(".be__cpill code").textContent = inp.value;
      sw.style.cssText = `width:${size}px;height:${shape === "circle" ? size : Math.round(size * 1.2)}px;border-radius:${shape === "circle" ? "50%" : shape === "square" ? "0" : shape === "rounded" ? "10px" : "4px"};background:${color ? inp.value : "#f2f4f6"}`;
      sw.querySelector("img")?.style.setProperty("visibility", color ? "hidden" : "visible");
    });
    // the preview bar shows the swatches as the offer will (the first one selected)
    m.querySelector("[data-vpv]").innerHTML = [...m.querySelectorAll(".vpo__row [data-sw]")].map((sw, i) =>
      `<span class="vpo__sw${i === 0 ? " is-on" : ""}" style="${sw.style.cssText}" title="${esc(sw.dataset.sw)}">${sw.innerHTML}</span>`).join("") || `<span class="be__hint">No colour option on this product.</span>`;
  };
  m.addEventListener("input", (e) => {
    const rg = e.target.closest(".be__range");
    if (rg) rg.querySelectorAll("input").forEach((x) => { if (x !== e.target) x.value = e.target.value; });
    draw();
  });
  m.addEventListener("change", draw);
  m.addEventListener("click", (e) => {
    if (e.target.closest("[data-done]")) {
      f.elements.sw_type.value = m.querySelector('[name="vp_type"]:checked').value;
      f.elements.sw_colors.value = JSON.stringify(Object.fromEntries([...m.querySelectorAll("[data-color]")].map((x) => [x.dataset.color, x.value])));
      f.elements.st_swatch_shape.value = m.querySelector('[name="vp_shape"]').value;
      f.elements.st_swatch_size.value = m.querySelector('[name="vp_size"]').value;
      m.remove(); onChange();
    }
    if (e.target.closest("[data-close],[data-cancel]") || e.target === m) m.remove();
  });
  draw();
}

// bars: [{row, title, units}] in order; oneVariant: a single choice per bar.
export function defaults(f, opts, bars, oneVariant, onChange) {
  const colors = (opts?.colors || []).map((c) => [c.name, c.name]), sizes = (opts?.sizes || []).map((s) => [s, s]);
  const any = [["", "First available"]];
  const m = modal("Set default variants", `
    <p class="be__hint">The variant each item starts on. Shoppers can still change it.</p>
    <div class="vpo__bars">${bars.map((bar, bi) => {
      const d = JSON.parse(bar.row.querySelector('[name="defaults"]').value || "[]"), n = oneVariant ? 1 : bar.units;
      return `<div class="vpo__bar" data-bi="${bi}"><b>Bar #${bi + 1} · ${esc(bar.title)}</b>
        ${Array.from({ length: n }, (_, k) => `<div class="vpo__item" data-k="${k}"><span>#${k + 1}</span>
          ${select("vp_c", any.concat(colors), d[k]?.color || "")}${select("vp_s", any.concat(sizes), d[k]?.size || "")}</div>`).join("")}
      </div>`;
    }).join("")}</div>`);
  m.addEventListener("click", (e) => {
    if (e.target.closest("[data-done]")) {
      m.querySelectorAll("[data-bi]").forEach((b) => {
        const list = [...b.querySelectorAll("[data-k]")].map((it) => {
          const c = it.querySelector('[name="vp_c"]').value, s = it.querySelector('[name="vp_s"]').value;
          return { ...(c ? { color: c } : {}), ...(s ? { size: s } : {}) };
        });
        bars[Number(b.dataset.bi)].row.querySelector('[name="defaults"]').value = list.some((x) => x.color || x.size) ? JSON.stringify(list) : "";
      });
      m.remove(); onChange();
    }
    if (e.target.closest("[data-close],[data-cancel]") || e.target === m) m.remove();
  });
}
