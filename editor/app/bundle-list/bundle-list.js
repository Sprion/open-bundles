// Bundles tab, layout: an overview (revenue, orders, AOV, revenue per visitor), filter chips, then one row
// per bundle. A bundle with an A/B test is one row whose chevron unfolds its versions A, B…; a plain bundle's
// chevron opens its editor (../bundle-editor). Saving publishes to the shop metafield open_bundles.config.
import { money, esc } from "../bundle-editor/shared.js";
import * as editor from "../bundle-editor/editor.js";
import { head, testRows, wireTest, fillResults, totals, xsend, metricCells, day, DOTS, CHEV, NCOLS } from "../test-rows/test-rows.js";
import { send } from "../bundle-editor/shared.js";

export const html = () => `
  <section class="bnd">
    <div class="wrap">
      <div class="kcard">
        <div class="kcard__top"><h2>Overview</h2><span class="kt__soon">Since each test started</span></div>
        <div class="kover" data-overview></div>
      </div>
      <div class="kcard">
        <div class="kcard__top"><h2>Bundles</h2></div>
        <div class="kchips" role="group" aria-label="Filter">
          ${[["all", "All offers"], ["active", "Active"], ["inactive", "Inactive"], ["archive", "A/B test archives"]].map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="${k === "all"}">${l}</button>`).join("")}
        </div>
        <div data-bnewslot></div>
        <div data-bundles><p class="xtest__note">Loading bundles…</p></div>
      </div>
    </div>
  </section>`;

const stat = (label, value, sub) => `<div class="kstat"><span>${label}</span><b>${value}</b><small>${sub}</small></div>`;

export async function mount(root) {
  const box = root.querySelector("[data-bundles]"), newSlot = root.querySelector("[data-bnewslot]"), optionsCache = {};
  let state, tests = [], filter = "all";
  const results = {};

  const byHandle = (h) => state.productList.find((p) => p.handle === h);
  const productsUsing = (id) => Object.values(state.products || {}).filter((p) => p.bundle === id).map((p) => p.handle).filter(Boolean);
  const liveTests = () => tests.filter((t) => t.status !== "concluded");
  const testsOf = (id) => liveTests().filter((t) => t.pages.some((p) => Object.values(p.bundles || {}).includes(id)));
  const productOf = (id) => {
    const handle = id ? (state.bundles[id]?.product || productsUsing(id)[0] || testsOf(id)[0]?.pages[0]?.handle) : "";
    return byHandle(handle) || state.productList.find((p) => !p.unlisted) || { price: 0, handle: "" };
  };
  const optionsFor = (handle) => {
    if (!handle) return Promise.resolve(null);
    optionsCache[handle] ||= fetch(`api/bundles/options/${encodeURIComponent(handle)}`, { cache: "no-store" })
      .then((r) => r.json()).then((x) => (x.error ? null : x)).catch(() => null);
    return optionsCache[handle];
  };
  const SAMPLE = { handle: "", price: 49.95, title: "Sample product" };
  const openEditor = (slot, id, b, onClose) => {
    const product = id || b.product ? productOf(id) : SAMPLE;
    slot.innerHTML = editor.html(id, b, state.productList, product.handle);
    editor.wire(slot.querySelector("form"), { product, options: optionsFor(product.handle), productOf: byHandle, optionsFor, onClose, onSaved: load });
    slot.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const freeId = (base) => { let id = base, n = 2; while (state.bundles[id]) id = `${base}-${n++}`; return id.slice(0, 40); };
  const target = (id) => {
    const p = productOf(id);
    return state.bundles[id]?.product || productsUsing(id).length ? p.title : "No product yet";
  };

  // A bundle that is not part of a running/paused test: one row, chevron = editor.
  const bundleRow = (id) => {
    const b = state.bundles[id], isDefault = productsUsing(id).length > 0;
    return `
    <tbody class="kt" data-bundle="${esc(id)}">
      <tr class="kt__row">
        <td class="kt__chev"><button type="button" class="kt__fold" data-fold aria-expanded="false" aria-label="Edit the bundle">${CHEV}</button></td>
        <td class="kt__name"><b>${esc(b.title || id)}</b>
          <label class="kt__pick">Shown on<select data-assign aria-label="Product page showing ${esc(b.title || id)}">
            <option value="">No product page</option>
            ${state.productList.filter((p) => !p.unlisted).map((p) => `<option value="${esc(p.handle)}"${productsUsing(id).includes(p.handle) ? " selected" : ""}>${esc(p.title)}</option>`).join("")}
          </select></label></td>
        <td class="kt__date">${day(b.created)}</td>
        ${metricCells().replaceAll(`<span class="muted">·</span>`, `<span class="muted">—</span>`)}
        <td class="kt__acts">
          <span class="xmenu"><button type="button" class="xdots" aria-label="Actions" data-menu>${DOTS}</button>
            <span class="xmenu__panel" hidden>
              <button type="button" data-act="edit">Edit</button>
              <button type="button" data-act="abtest">Start an A/B test</button>
              <button type="button" data-act="duplicate">Duplicate</button>
              <button type="button" class="is-danger" data-act="delete">Delete</button>
            </span>
          </span>
        </td>
      </tr>
      <tr class="kt__extra"><td colspan="${NCOLS}"><p class="xtest__msg" data-msg hidden></p><div data-editslot></div></td></tr>
    </tbody>`;
  };

  const bundleLabel = (t) => (k) => {
    const id = t.pages[0]?.bundles?.[k];
    return id ? `${state.bundles[id]?.title || id}` : "";
  };

  function overview() {
    const list = tests.filter((t) => t.type === "bundle" && (filter === "archive" ? t.status === "concluded" : t.status !== "concluded"));
    const sum = list.map((t) => totals(results[t.id])).filter(Boolean);
    const add = (k) => sum.reduce((s, x) => s + (x[k] || 0), 0);
    const visitors = add("visitors"), orders = add("orders"), revenue = add("revenue");
    root.querySelector("[data-overview]").innerHTML = [
      stat("Revenue", money(revenue), `${list.length} test${list.length === 1 ? "" : "s"}`),
      stat("Orders with bundles", String(orders), visitors ? `${((orders / visitors) * 100).toFixed(2)}% of visitors` : "No visitors yet"),
      stat("Average order value", orders ? money(revenue / orders) : money(0), "Per order"),
      stat("Revenue per visitor", visitors ? money(revenue / visitors) : money(0), `${visitors} visitors`),
    ].join("");
  }

  function render() {
    const bundleTests = tests.filter((t) => t.type === "bundle");
    const inTest = new Set(liveTests().flatMap((t) => t.pages.flatMap((p) => Object.values(p.bundles || {}))));
    const plain = Object.keys(state.bundles || {}).filter((id) => !inTest.has(id) && id !== "editor-draft");
    const show = {
      all: [bundleTests.filter((t) => t.status !== "concluded"), plain],
      active: [bundleTests.filter((t) => t.status === "running"), plain.filter((id) => productsUsing(id).length)],
      inactive: [bundleTests.filter((t) => t.status === "paused" || t.status === "draft"), plain.filter((id) => !productsUsing(id).length)],
      archive: [bundleTests.filter((t) => t.status === "concluded"), []],
    }[filter];
    const [ts, ids] = show;
    dispatchEvent(new CustomEvent("ob:bundles", { detail: { count: liveTests().filter((t) => t.type === "bundle").length + plain.length } }));
    box.innerHTML = ts.length || ids.length
      ? `<div class="ktable"><table>${head("Offer")}${ts.map((t) => testRows(t, { target: byHandle(t.pages[0]?.handle)?.title || t.pages[0]?.handle || "", label: bundleLabel(t), edit: true })).join("")}${ids.map(bundleRow).join("")}</table></div>`
      : `<p class="xempty">Nothing here.</p>`;

    for (const t of ts) {
      const el = box.querySelector(`[data-test="${CSS.escape(t.id)}"]`);
      wireTest(el, t, load, (key, slot) => {
        const id = t.pages[0]?.bundles?.[key];
        if (slot.firstElementChild) { slot.innerHTML = ""; return; }
        if (id && state.bundles[id]) openEditor(slot, id, state.bundles[id], () => { slot.innerHTML = ""; });
      });
      if (results[t.id]) fillResults(el, results[t.id]);
    }
    for (const id of ids) wireBundle(box.querySelector(`[data-bundle="${CSS.escape(id)}"]`), id);
    overview();
  }

  function wireBundle(el, id) {
    const slot = el.querySelector("[data-editslot]"), fold = el.querySelector("[data-fold]"), b = state.bundles[id];
    const msg = (text, error) => { const m = el.querySelector("[data-msg]"); m.hidden = !text; m.className = `xtest__msg${error ? " is-error" : ""}`; m.textContent = text || ""; };
    const toggle = (open) => {
      fold.setAttribute("aria-expanded", String(open));
      if (!open) { slot.innerHTML = ""; return; }
      openEditor(slot, id, b, () => toggle(false));
    };
    fold.addEventListener("click", () => toggle(fold.getAttribute("aria-expanded") !== "true"));
    el.querySelector(".kt__name b").addEventListener("click", () => toggle(fold.getAttribute("aria-expanded") !== "true"));
    // One bundle per product page: choosing a product replaces the bundle it had.
    el.querySelector("[data-assign]").addEventListener("change", async (e) => {
      msg("Saving…");
      try {
        const handle = e.target.value;
        for (const h of productsUsing(id)) if (h !== handle) await send("POST", "/assign", { handle: h, bundle: "" });
        if (handle) await send("POST", "/assign", { handle, bundle: id });
        await load();
      } catch (err) { msg(err.message, true); }
    });
    const panel = el.querySelector(".xmenu__panel");
    el.querySelector("[data-menu]").addEventListener("click", (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; });
    document.addEventListener("click", () => { panel.hidden = true; });
    el.querySelectorAll("[data-act]").forEach((btn) => btn.addEventListener("click", async () => {
      panel.hidden = true;
      const act = btn.dataset.act;
      try {
        if (act === "edit") return toggle(true);
        if (act === "duplicate") {
          msg("Duplicating…");
          await send("POST", `/${freeId(`${id}-copy`)}`, { ...b, title: `${b.title} (Copy)` });
        }
        if (act === "abtest") {
          // A = this bundle as it is; B = a copy to change. The test is created OFF.
          const p = productOf(id);
          if (!p.handle) throw new Error("Choose the bundle's product first (Settings > Product).");
          msg("Creating the A/B test (version B is a copy)…");
          const bid = freeId(`${id}-b`);
          await send("POST", `/${bid}`, { ...b, title: `${b.title} (B)` });
          await xsend("POST", "", { type: "bundle", product: p.handle, name: b.title, bundles: { a: id, b: bid } });
        }
        if (act === "delete") {
          if (!confirm(`Delete bundle "${b.title}"?`)) return;
          await send("DELETE", `/${encodeURIComponent(id)}`);
        }
        await load();
      } catch (err) { msg(err.message, true); }
    }));
  }

  async function load() {
    const [res, ex] = await Promise.all([
      fetch("api/bundles", { cache: "no-store" }).then((r) => r.json()).catch((e) => ({ error: e.message })),
      fetch("api/tests", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ tests: [] })),
    ]);
    if (res.error) { box.innerHTML = `<p class="xtest__msg is-error">${esc(res.error)}</p>`; return; }
    state = res;
    tests = (ex.tests || []).slice().reverse();
    newSlot.innerHTML = "";
    render();
    refresh();
  }

  // Numbers from the collector (your stats collector), refreshed every 30 s while the page is open.
  function refresh() {
    tests.filter((t) => t.type === "bundle").forEach((t) => {
      fetch(`api/tests/${encodeURIComponent(t.id)}/results`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ unavailable: "network" }))
        .then((r) => {
          results[t.id] = r;
          const el = box.querySelector(`[data-test="${CSS.escape(t.id)}"]`);
          if (el) fillResults(el, r);
          overview();
        });
    });
  }
  clearInterval(window.obabBundlesTimer);
  window.obabBundlesTimer = setInterval(() => { if (box.isConnected && !document.hidden) refresh(); }, 30000);

  root.querySelectorAll("[data-filter]").forEach((btn) => btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    root.querySelectorAll("[data-filter]").forEach((x) => x.setAttribute("aria-pressed", String(x === btn)));
    render();
  }));

  // Create a bundle: pick a starting style (apps/bundles/data/templates.json), creation page.
  // The new bundle copies the whole preset (design, style, bars, offers); it is saved only with Save.
  const BLANK = { title: "", design: "classic", cta_noun: "items", tiers: [{ label: "{{quantity}} item", buy: 1, default: true }] };
  const startEditor = (b) => {
    newSlot.innerHTML = `<div class="bl__new"></div>`;
    openEditor(newSlot.firstElementChild, "", b, () => { newSlot.innerHTML = ""; });
  };
  const fromPreset = (id) => ({ ...JSON.parse(JSON.stringify(state.templates[id].bundle)), title: "" });
  const presetName = (id) => state.templates?.[id]?.name || id;
  function pickStyle() {
    const ids = Object.keys(state.templates || {});
    if (!ids.length) return startEditor(BLANK);
    const pop = document.createElement("div");
    pop.className = "blp";
    pop.innerHTML = `
      <div class="blp__box" role="dialog" aria-modal="true" aria-labelledby="blp-title">
        <div class="blp__head"><div><h3 id="blp-title">Choose a style</h3><p>Every part can be changed afterwards in the editor.</p></div>
          <button type="button" class="blp__x" data-close aria-label="Close">&times;</button></div>
        <div class="blp__grid">${ids.map((id) => `
          <button type="button" class="blp__card" data-pick="${esc(id)}">
            <span class="blp__img"><img src="/media/looks/${esc(id)}.webp" alt="" loading="lazy" onerror="this.remove()"></span>
            <span class="blp__name">${esc(presetName(id))}</span></button>`).join("")}</div>
        <div class="blp__foot"><button type="button" class="xbtn xbtn--ghost" data-close>Cancel</button>
          <button type="button" class="xbtn xbtn--ghost" data-blank>Start from scratch</button></div>
      </div>`;
    const close = () => { pop.remove(); removeEventListener("keydown", esc_); };
    const esc_ = (e) => { if (e.key === "Escape") close(); };
    addEventListener("keydown", esc_);
    pop.addEventListener("click", (e) => {
      if (e.target === pop || e.target.closest("[data-close]")) return close();
      if (e.target.closest("[data-blank]")) { close(); return startEditor(BLANK); }
      const card = e.target.closest("[data-pick]");
      if (card) { close(); startEditor(fromPreset(card.dataset.pick)); }
    });
    document.body.append(pop);
    pop.querySelector(".blp__card")?.focus();
  }

  addEventListener("ob:newbundle", () => {
    if (newSlot.firstElementChild) return newSlot.scrollIntoView({ behavior: "smooth" });
    pickStyle();
  });

  await load();
}
