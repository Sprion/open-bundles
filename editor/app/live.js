// Safety step before anything visitors see changes: a bundle put on (or taken off) a product page, a live bundle
// saved with changes, an A/B test switched on. The window says what changes, where, and offers a store preview first.
// In demo mode nothing reaches a store, so it never asks.

let demo = null;
async function isDemo() {
  if (demo === null) demo = await fetch("/api/status").then((r) => r.json()).then((s) => s.demo).catch(() => false);
  return demo;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Where a bundle is live now: product pages showing it, and running tests using it.
export async function liveUses(id) {
  const [b, t] = await Promise.all([fetch("api/bundles").then((r) => r.json()), fetch("api/tests").then((r) => r.json())]);
  const titles = Object.fromEntries((b.productList || []).map((p) => [p.handle, p.title]));
  const pages = Object.values(b.products || {}).filter((p) => p.bundle === id).map((p) => titles[p.handle] || p.handle);
  const tests = (t.tests || []).filter((x) => x.status === "running" && Object.values(x.bundles || {}).includes(id)).map((x) => x.name);
  return { pages, tests, any: pages.length + tests.length > 0 };
}

// confirmLive({ title, lines: [...], action: "Confirm", preview: async () => url }) -> true / false
export async function confirmLive({ title, lines, action = "Confirm", preview }) {
  if (await isDemo()) return true;
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "cx lv";
    dlg.innerHTML = `<div class="cx__box">
      <div class="cx__head"><h2>${esc(title)}</h2></div>
      <ul class="lv__list">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
      <p class="cx__msg" data-lv-msg></p>
      <div class="cx__foot">
        ${preview ? `<button type="button" class="xbtn" data-lv-preview>Preview</button>` : ""}
        <span class="cx__spacer"></span>
        <button type="button" class="xbtn xbtn--ghost" data-lv-cancel>Cancel</button>
        <button type="button" class="xbtn xbtn--primary" data-lv-ok>${esc(action)}</button>
      </div></div>`;
    document.body.append(dlg);
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); done(false); });
    dlg.querySelector("[data-lv-cancel]").addEventListener("click", () => done(false));
    dlg.querySelector("[data-lv-ok]").addEventListener("click", () => done(true));
    dlg.querySelector("[data-lv-preview]")?.addEventListener("click", async () => {
      const m = dlg.querySelector("[data-lv-msg]");
      const tab = window.open("about:blank", "_blank");
      m.textContent = "Opening the preview…";
      try {
        const url = await preview();
        if (tab) tab.location = url; else window.open(url, "_blank");
        m.textContent = "Preview opened in a new tab.";
      } catch (err) { tab?.close(); m.textContent = err.message; m.classList.add("cx__msg--bad"); }
    });
    dlg.showModal();
  });
}
