// Bundle editor, order: Settings, Style, the bars, Add a bar, Badges, then one block per feature (extras.js); preview on the right.
// Each block lives in its own file (settings, style, bars, badges, preview) with html / read / wire / sync.
// Every value is a plain field of the bundle, so Claude can set it too (apps/bundles/CONTEXT.md).
import { VARS, send, I } from "./shared.js";
import * as settings from "./settings.js";
import * as style from "./style.js";
import * as bars from "./bars.js";
import * as badges from "./badges.js";
import * as extras from "./extras.js";
import { esc } from "./shared.js";
import * as imagePicker from "./image-picker.js";
import * as variants from "./variants.js";
import { productOptions } from "./settings.js";
import { liveUses, confirmLive } from "../live.js";

export function html(id, b, products = [], current = "") {
  const keys = (b.tiers || []).map(() => bars.newKey());
  return `
  <form class="be" data-editor>
    <div class="be__side">
      ${settings.html(id, b, products, current)}
      ${style.html(b)}
      ${bars.html(b, keys)}
      ${badges.html(b, keys)}
      ${extras.html(b)}
      <input type="hidden" name="orig" value="${esc(JSON.stringify(b || {}))}">
    </div>
    <div class="be__pvcol">
      <div class="be__pvcard">
        <div class="be__pvhead"><span>Preview</span>
          <button type="button" class="be__pvopen" data-realpv>Open ${I.ext}</button>
          <a class="be__pvopen" data-reallink target="ob-real-preview" rel="noopener" hidden>Open ${I.ext}</a></div>
        <span class="be__select"><select data-pvproduct aria-label="Preview product">${productOptions(products, current)}</select>${I.updown}</span>
        <div class="be__pvbox"><iframe class="be__pvframe" data-pvframe title="Bundle preview, drawn by the theme's own code"></iframe><p class="be__pvwait" data-pvwait>Drawing the preview…</p></div>
        <p class="be__hint" data-realmsg>Open shows the exact offer on the development theme, in its own tab. Nothing is saved until you press Save.</p>
      </div>
      <div class="be__save">
        <p class="xtest__msg" data-msg hidden></p>
        ${id ? `<button type="button" class="be__link is-danger" data-delete>Delete bundle</button>` : ""}
        <span class="bnd__spacer"></span>
        <button type="button" class="xbtn xbtn--ghost" data-cancel>Cancel</button>
        <button type="submit" class="xbtn xbtn--primary">Save</button>
      </div>
    </div>
    <div class="be__vmenu" data-vmenu hidden>${VARS.map(([k, l, ex]) => `<button type="button" data-var="${k}"><span>${l}</span><small>${ex}</small></button>`).join("")}</div>
  </form>`;
}

const keysOf = (f) => bars.rows(f).map((r) => r.dataset.key);

export function read(f) {
  const tiers = badges.apply(f, bars.read(f), keysOf(f));
  // Fields the editor does not show are kept as they were (set by Claude or a newer editor), never dropped on save.
  const orig = JSON.parse(f.elements.orig.value || "{}"), st = style.read(f);
  const keptStyle = Object.fromEntries(Object.entries(orig.style || {}).filter(([k]) => !f.elements[`st_${k}`]));
  const { tiers: _t, style: _s, created: _c, ...rest } = orig;
  return { ...rest, ...settings.read(f), ...st, style: { ...keptStyle, ...st.style }, ...extras.read(f), tiers };
}

// f: the form; product: { price, handle }; options: Promise of the product's colours/photos;
// productOf(handle) / optionsFor(handle): switch product; onSaved / onClose.
export function wire(f, { product, options, productOf, optionsFor, onClose, onSaved }) {
  let unit = product.price;
  const vmenu = f.querySelector("[data-vmenu]");
  let vTarget = null, lastFocus = null, opts = null;

  const recalc = () => {
    const b = read(f);
    bars.sync(f, b, unit);
    badges.sync(f, bars.rows(f).map((r) => ({ key: r.dataset.key, title: r.querySelector("[data-bt]").textContent })));
    settings.sync(f, b.design);
    extras.sync(f);
    f.querySelectorAll(".st__layout").forEach((l) => l.classList.toggle("is-on", l.querySelector("input").checked));
    f.querySelectorAll(".be__cpill").forEach((p) => { // optional colours: empty = striped dot (the design's own colour)
      const h = p.parentElement.querySelector('input[type="hidden"]'), v = h ? h.value : p.querySelector("input").value;
      p.classList.toggle("is-auto", !v); p.querySelector("i").style.background = v || "";
      if (!h) p.parentElement.title = v;
    });
    queueFrame();
    queueReal();
  };

  // editor preview: the theme's own ob-bundle code, rendered by the editor for this product (nothing is saved or pushed).
  const frame = f.querySelector("[data-pvframe]"), wait = f.querySelector("[data-pvwait]");
  const pvKey = Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => (x % 36).toString(36)).join("") + "pv";
  // lastFrame / lastReal: the bundle last drawn / pushed. Opening or closing a block (clicking a bar in the preview opens
  // its block) changes nothing, so the preview is not reloaded and the bar switch animation plays out.
  let frameTimer = 0, frameBusy = false, frameAgain = false, frameRO = null, lastFrame = "", lastReal = "";
  const fit = () => { try { frame.style.height = `${frame.contentDocument.documentElement.scrollHeight}px`; } catch { /* not loaded yet */ } };
  frame.addEventListener("load", () => {
    wait.hidden = true; fit();
    try { frameRO?.disconnect(); frameRO = new ResizeObserver(fit); frameRO.observe(frame.contentDocument.body); } catch { /* error page */ }
    // Click a part of the preview: the block that sets it opens (the preview still reacts as on the site).
    frame.contentDocument?.addEventListener("click", (e) => {
      const t = e.target, bar = t.closest("[data-ob-bar]");
      const sec = t.closest(".ob__deal, .ob__summary, .ob__unitp, .ob__totals") ? "summary" : t.closest(".ob__badge") ? "badges"
        : t.closest(".ob__gifts") ? "gifts" : t.closest(".ob__custom") ? "packlink"
        : t.closest(".ob__countdown, .ob-cd") ? "countdown" : t.closest(".ob__ladder") ? "ladder" : t.closest(".ob-firstlink") ? "firstlink"
        : t.closest(".ob__cta, .ob__ship, .ob__top, .ob__banner, .ob__gsize") ? "settings" : "";
      const card = bar && !sec ? bars.rows(f)[Number(bar.dataset.obBar)] : sec && f.querySelector(`[data-sec="${sec}"]`);
      if (!card) return;
      if (bar && !sec) bars.rows(f).forEach((r) => { r.open = r === card; }); else card.open = true;
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      card.classList.add("is-flash"); setTimeout(() => card.classList.remove("is-flash"), 900);
    }, true);
  });
  const drawFrame = async () => {
    if (frameBusy) { frameAgain = true; return; }
    const body = { handle: f.elements.product.value, bundle: read(f) }, key = JSON.stringify(body);
    if (key === lastFrame) return;
    frameBusy = true; lastFrame = key;
    try {
      const { url } = await send("POST", `/render/${pvKey}`, body);
      const y = frame.contentWindow?.scrollY || 0;
      frame.addEventListener("load", () => frame.contentWindow?.scrollTo(0, y), { once: true });
      frame.contentWindow ? frame.contentWindow.location.replace(`${url}?v=${Date.now()}`) : (frame.src = url);
    } catch (err) { lastFrame = ""; wait.hidden = false; wait.textContent = `Preview failed: ${err.message}`; }
    frameBusy = false;
    if (frameAgain) { frameAgain = false; drawFrame(); }
  };
  const queueFrame = () => { clearTimeout(frameTimer); frameTimer = setTimeout(drawFrame, 350); };

  // Real preview: once turned on, every change sends the unsaved bundle to the "editor-draft" bundle (dev theme only).
  // The preview tab reloads itself when it comes back to the front (and at once when the editor opened it as a window).
  let realOn = false, realWin = null, realTimer = 0, realBusy = false, realAgain = false;
  const realMsg = f.querySelector("[data-realmsg]"), realLink = f.querySelector("[data-reallink]");
  const pushReal = async () => {
    if (!realOn) return;
    if (realBusy) { realAgain = true; return; }
    const body = { handle: f.elements.product.value, bundle: read(f) }, key = JSON.stringify(body);
    if (key === lastReal) return;
    realBusy = true; lastReal = key; realMsg.textContent = "Updating the preview…";
    try {
      const { url } = await send("POST", "/draft", body);
      realLink.href = url; realLink.hidden = false;
      if (realWin && !realWin.closed) realWin.location.href = `${url}&t=${Date.now()}`;
      realMsg.textContent = `Updated at ${new Date().toLocaleTimeString()}. Nothing is saved until you press Save.`;
    } catch (err) { lastReal = ""; realMsg.textContent = `Preview failed: ${err.message}`; }
    realBusy = false;
    if (realAgain) { realAgain = false; pushReal(); }
  };
  const queueReal = () => { if (realOn) { clearTimeout(realTimer); realTimer = setTimeout(pushReal, 1000); } };
  f.querySelector("[data-realpv]").addEventListener("click", (e) => {
    realOn = true; lastReal = ""; e.currentTarget.hidden = true;
    realWin = window.open("about:blank", "ob-real-preview", "width=440,height=900");
    pushReal();
  });
  settings.wire(f);
  style.wire(f, recalc);
  bars.wire(f, recalc, () => settings.read(f));
  badges.wire(f, recalc, () => keysOf(f));
  extras.wire(f, recalc);
  options.then((o) => { opts = o; recalc(); });
  const pvSel = f.querySelector("[data-pvproduct]");
  const switchProduct = (handle) => { // prices, colours and sizes follow the chosen product
    f.elements.product.value = pvSel.value = handle;
    const p = productOf?.(handle);
    if (p) unit = p.price; else if (!handle) unit = 49.95; // no product yet: the sample product's price
    opts = null; recalc();
    optionsFor?.(handle).then((o) => { if (f.elements.product.value === handle) { opts = o; recalc(); } });
  };
  pvSel.addEventListener("change", (e) => { e.stopPropagation(); switchProduct(pvSel.value); });
  f.elements.product.addEventListener("change", () => switchProduct(f.elements.product.value));

  // Content | Style tabs of a feature block.
  f.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (!t) return;
    const box = t.closest(".be__body");
    box.querySelectorAll(":scope > .be__tabs [data-tab]").forEach((x) => x.classList.toggle("is-on", x === t));
    box.querySelectorAll(":scope > [data-pane]").forEach((x) => { x.hidden = x.dataset.pane !== t.dataset.tab; });
  });
  // A switch in a block header turns the feature on or off without opening or closing the block.
  f.addEventListener("click", (e) => {
    const sw = e.target.closest("summary .be__switch");
    if (!sw) return;
    const d = sw.closest("details"), wasOpen = d.open;
    setTimeout(() => { d.open = wasOpen; }, 0);
  });
  f.addEventListener("focusin", (e) => { if (e.target.matches("input, textarea")) lastFocus = e.target; });
  f.addEventListener("input", (e) => {
    // slider and number box of one .be__range follow each other
    const rg = e.target.closest(".be__range");
    if (rg) rg.querySelectorAll("input").forEach((x) => { if (x !== e.target) x.value = e.target.value; });
    recalc();
  });
  f.addEventListener("change", recalc);
  f.addEventListener("toggle", recalc, true);
  f.addEventListener("click", (e) => {
    const vb = e.target.closest("[data-vbtn]");
    if (vb) { // the variable menu opens under the field
      e.preventDefault();
      vTarget = vb.closest(".be__field").querySelector("input");
      const r = vb.getBoundingClientRect(), fr = f.getBoundingClientRect();
      vmenu.style.top = `${r.bottom - fr.top + 4}px`; vmenu.style.left = `${r.right - fr.left - 200}px`;
      vmenu.hidden = !vmenu.hidden;
      return;
    }
    const v = e.target.closest("[data-var]");
    if (v && vTarget) { // at the caret if the field was being edited, else at the end
      const pos = lastFocus === vTarget ? vTarget.selectionStart ?? vTarget.value.length : vTarget.value.length, ins = `{{${v.dataset.var}}}`;
      vTarget.value = vTarget.value.slice(0, pos) + ins + vTarget.value.slice(pos);
      vmenu.hidden = true; vTarget.focus(); recalc();
      return;
    }
    if (!vmenu.hidden && !e.target.closest("[data-vmenu]")) vmenu.hidden = true;
    if (e.target.closest("[data-swbtn]")) { variants.swatches(f, opts, recalc); return; }
    if (e.target.closest("[data-dvbtn]")) {
      const b = read(f);
      variants.defaults(f, opts, bars.rows(f).map((row, i) => ({ row, title: row.querySelector("[data-bt]").textContent, units: (b.tiers[i].buy || 0) + (b.tiers[i].free || 0) })), b.one_variant, recalc);
      return;
    }
    const act = e.target.closest('[data-act="image"]');
    if (act) { // the bar's image pop-up
      const row = act.closest("[data-row]");
      imagePicker.open(row, () => ({ b: read(f), i: bars.rows(f).indexOf(row), unit }), recalc);
      return;
    }
    const pvb = e.target.closest("[data-pvbar]");
    if (pvb) { // clicking a bar in the preview opens its block
      bars.rows(f).forEach((x, i) => { x.open = i === Number(pvb.dataset.pvbar); });
      bars.rows(f)[Number(pvb.dataset.pvbar)]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      recalc();
    }
  });

  f.querySelector("[data-cancel]").addEventListener("click", onClose);
  const msg = f.querySelector("[data-msg]");
  const show = (text, error) => { msg.hidden = !text; msg.textContent = text || ""; msg.className = `xtest__msg${error ? " is-error" : ""}`; };
  f.querySelector("[data-delete]")?.addEventListener("click", async () => {
    if (!confirm(`Delete bundle "${f.elements.id.value}"?`)) return;
    try { await send("DELETE", `/${encodeURIComponent(f.elements.id.value)}`); await onSaved(); } catch (err) { show(err.message, true); }
  });
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = read(f);
    const uses = await liveUses(b.id).catch(() => ({ any: false }));
    if (uses.any) {
      const ok = await confirmLive({
        title: "Save changes to a live bundle?",
        lines: [...uses.pages.map((p) => `Visitors of "${p}" see the changes right away.`),
                ...uses.tests.map((t) => `It is a version of the running A/B test "${t}".`)],
        action: "Save and go live",
        preview: async () => (await send("POST", "/draft", { handle: f.elements.product.value, bundle: b })).url,
      });
      if (!ok) return;
    }
    show("Saving…");
    try { await send("POST", `/${encodeURIComponent(b.id)}`, b); await onSaved(); } catch (err) { show(err.message, true); }
  });
  if (bars.rows(f).length === 1) bars.rows(f)[0].open = true;
  recalc();
}
