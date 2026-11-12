// One A/B test as a row: a summary line (chevron, name, target, created, totals, ON/OFF, ⋮) and, unfolded,
// one line per version (A, B…) with its traffic split and numbers. Shared by the Landing pages and Bundles tabs.
import { money, num, esc } from "../lib/format.js";

const dash = `<span class="muted">—</span>`;
const v = (x, fmt) => (x == null ? dash : fmt(x));
const pc = (n) => `${num(n)}%`;
export const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const DOTS = `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="16" cy="10" r="1.6"/></svg>`;
export const CHEV = `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg>`;

// performance metrics. Version rows show the change against A under the rate metrics.
export const COLS = [
  ["Visitors", (r) => v(r.visitors, (n) => num(n, 0))],
  ["ATC", (r) => v(r.addToCartRate, pc)],
  ["CR", (r) => v(r.conversionRate, pc), "conversionRate"],
  ["Orders", (r) => num(r.orders || 0, 0)],
  ["AOV", (r) => v(r.aov, money), "aov"],
  ["RPV", (r) => v(r.revenuePerVisitor, money), "revenuePerVisitor"],
  ["Revenue", (r) => money(r.revenue || 0)],
  ["Profit / visitor", (r) => v(r.profitPerVisitor, money), "profitPerVisitor"],
];
export const NCOLS = 4 + COLS.length;

export const head = (first = "Offer") => `
  <thead><tr><th class="kt__chev"></th><th>${first}</th><th>Created</th>${COLS.map(([l]) => `<th>${l}</th>`).join("")}<th class="kt__acts">Actions</th></tr></thead>`;

export const metricCells = () => COLS.map(() => `<td class="kt__m" data-m><span class="muted">·</span></td>`).join("");

// Totals of a test (all versions together), for its summary line.
export function totals(res) {
  const rs = Object.values(res?.versions || {});
  if (!rs.length) return null;
  const sum = (k) => rs.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const visitors = sum("visitors"), orders = sum("orders"), revenue = sum("revenue");
  const wavg = (k) => (visitors ? rs.reduce((s, r) => s + (Number(r[k]) || 0) * (Number(r.visitors) || 0), 0) / visitors : null);
  return { visitors, orders, revenue, addToCartRate: wavg("addToCartRate"), conversionRate: visitors ? (orders / visitors) * 100 : null,
    aov: orders ? revenue / orders : null, revenuePerVisitor: visitors ? revenue / visitors : null, profitPerVisitor: wavg("profitPerVisitor") };
}

const lift = (r, key) => {
  const x = key && r.uplift ? r.uplift[key] : null;
  if (x == null) return "";
  return `<i class="${x >= 0 ? "is-up" : "is-down"}" title="vs A">${x >= 0 ? "+" : ""}${num(x, 0)}%</i>`;
};
const fill = (row, r, withLift) => row.querySelectorAll("[data-m]").forEach((c, i) => {
  const [, f, key] = COLS[i];
  c.innerHTML = r ? `${f(r)}${withLift ? lift(r, key) : ""}` : dash;
});

const previews = (t) => {
  const page = Object.values(t.previewLinks || {})[0] || {};
  return t.versions.map((x) => page[x.key] ? `<a href="${esc(page[x.key])}" target="_blank" rel="noopener">Preview ${x.key.toUpperCase()}</a>` : "").join("");
};

/**
 * t: the test; opts.target: what it runs on ("Classic Tee"); opts.label(key): what a version shows;
 * opts.edit: version lines get an Edit button (bundle tests).
 */
export function testRows(t, { target = "", label = () => "", edit = false } = {}) {
  const ended = t.status === "concluded";
  return `
  <tbody class="kt${ended ? " is-ended" : ""}" data-test="${esc(t.id)}">
    <tr class="kt__row" data-sum>
      <td class="kt__chev"><button type="button" class="kt__fold" data-fold aria-expanded="false" aria-label="Show the versions">${CHEV}</button></td>
      <td class="kt__name"><b>${esc(t.name)}${t.live ? " <em>Live</em>" : ""}</b><small>${esc(target)}${target ? " · " : ""}A/B test · ${t.versions.length} versions${ended ? ` · ended${t.winner ? `, kept ${t.winner.toUpperCase()}` : ""}` : ""}</small></td>
      <td class="kt__date">${day(t.created || t.started)}</td>
      ${metricCells()}
      <td class="kt__acts">
        ${ended ? `<span class="kt__ended">Ended</span>` : `<button type="button" class="kswitch" role="switch" aria-checked="${t.status === "running"}" aria-label="Test on or off" data-toggle ${t.live ? "disabled" : ""}><i></i></button>`}
        <span class="xmenu"><button type="button" class="xdots" aria-label="Actions" data-menu>${DOTS}</button>
          <span class="xmenu__panel" hidden>${previews(t)}${t.live ? "" : `${ended ? "" : `<button type="button" data-end>End test…</button>`}<button type="button" class="is-danger" data-delete>Delete test</button>`}</span>
        </span>
      </td>
    </tr>
    ${t.versions.map((x, i) => `
      <tr class="kt__v" data-ver="${x.key}" hidden>
        <td></td>
        <td class="kt__vname"><b>Version ${x.key.toUpperCase()}</b><small>${esc(label(x.key))}</small>
          <span class="kt__vacts">${edit ? `<button type="button" class="be__link" data-editver="${x.key}">Edit</button>` : ""}${ended || t.live ? "" : `<button type="button" class="be__link" data-keepver="${x.key}">Keep only this</button><button type="button" class="be__link is-danger" data-removever="${x.key}">Remove</button>`}</span></td>
        <td class="kt__traffic">${ended ? "" : `<input type="number" min="0" max="100" step="5" value="${num(x.weight, 0)}" data-weight="${i}" aria-label="Traffic ${x.key.toUpperCase()} %" ${t.live ? "disabled" : ""}>% traffic`}</td>
        ${metricCells()}
        <td></td>
      </tr>`).join("")}
    <tr class="kt__extra"><td colspan="${NCOLS}">
      <div class="xend" data-endbar hidden><span>Keep which version?</span>
        ${t.versions.map((x) => `<button type="button" class="xbtn" data-keep="${x.key}">Keep ${x.key.toUpperCase()}</button>`).join("")}
        <button type="button" class="xbtn xbtn--ghost" data-cancel>Cancel</button></div>
      <p class="xtest__msg" data-msg hidden></p>
      <div data-editslot></div>
    </td></tr>
  </tbody>`;
}

// Winner: rule (at least 10 orders per version, z-test on conversion rate), shown as a badge.
export function fillResults(el, res) {
  el.querySelectorAll("[data-resmsg], .kt__vname em").forEach((x) => x.remove());
  fill(el.querySelector("[data-sum]"), totals(res), false);
  el.querySelectorAll("[data-ver]").forEach((row) => {
    row.classList.toggle("is-winner", res.winner === row.dataset.ver);
    if (res.winner === row.dataset.ver) row.querySelector(".kt__vname b").insertAdjacentHTML("beforeend", " <em>Winner</em>");
    fill(row, res.versions?.[row.dataset.ver], true);
  });
  const msg = res.unavailable ? `Results unavailable: ${res.unavailable}` : !res.versions ? "No results yet" : "";
  if (msg) el.querySelector(".kt__name").insertAdjacentHTML("beforeend", `<small class="muted" data-resmsg>${esc(msg)}</small>`);
}

export async function xsend(method, path, body) {
  const res = await fetch(`api/tests${path}`, {
    method, headers: { "Content-Type": "application/json", "X-editor": "1" }, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function say(el, text, error) {
  const msg = el.querySelector("[data-msg]");
  el.classList.toggle("is-busy", !!text && !error);
  if (msg) { msg.hidden = !text; msg.className = `xtest__msg${error ? " is-error" : ""}`; msg.textContent = text || ""; }
}

const PUSH = "Saving and pushing to the dev theme (about 20 s)…";

// Chevron, ON/OFF, traffic, menu, end, delete. onEdit(key, slot): open a version's editor.
export function wireTest(el, t, reload, onEdit) {
  const run = async (method, path, body) => {
    say(el, PUSH);
    try { await xsend(method, path, body); await reload(); } catch (e) { say(el, e.message, true); }
  };
  const id = `/${encodeURIComponent(t.id)}`;
  const fold = el.querySelector("[data-fold]");
  fold.addEventListener("click", () => {
    const open = fold.getAttribute("aria-expanded") !== "true";
    fold.setAttribute("aria-expanded", String(open));
    el.classList.toggle("is-open", open);
    el.querySelectorAll("[data-ver]").forEach((r) => { r.hidden = !open; });
  });
  el.querySelector("[data-toggle]")?.addEventListener("click", () => run("POST", `${id}/status`, { on: t.status !== "running" }));
  let timer;
  el.querySelectorAll("[data-weight]").forEach((input) => input.addEventListener("change", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const weights = [...el.querySelectorAll("[data-weight]")].map((i) => Math.max(0, Number(i.value) || 0));
      if (!weights.some((w) => w > 0)) return say(el, "At least one version needs traffic.", true);
      run("POST", `${id}/weights`, { weights });
    }, 600);
  }));
  const panel = el.querySelector(".xmenu__panel");
  el.querySelector("[data-menu]").addEventListener("click", (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; });
  document.addEventListener("click", () => { panel.hidden = true; });
  const endbar = el.querySelector("[data-endbar]");
  el.querySelector("[data-end]")?.addEventListener("click", () => { endbar.hidden = false; });
  el.querySelector("[data-cancel]")?.addEventListener("click", () => { endbar.hidden = true; });
  el.querySelectorAll("[data-keep]").forEach((b) => b.addEventListener("click", () => run("POST", `${id}/end`, { winner: b.dataset.keep })));
  el.querySelector("[data-delete]")?.addEventListener("click", () => {
    if (confirm(`Delete "${t.name}"? Its results disappear from this page.`)) run("DELETE", id);
  });
  // Keep only one version (test ends, it stays on the page) or drop one (with two left, the other one stays).
  el.querySelectorAll("[data-keepver]").forEach((b) => b.addEventListener("click", () => {
    if (confirm(`Keep only version ${b.dataset.keepver.toUpperCase()}? The test ends and this version stays on the page.`)) run("POST", `${id}/keep`, { version: b.dataset.keepver });
  }));
  el.querySelectorAll("[data-removever]").forEach((b) => b.addEventListener("click", () => {
    if (confirm(`Remove version ${b.dataset.removever.toUpperCase()}?${t.versions.length <= 2 ? " The test ends and the other version stays on the page." : ""}`)) run("POST", `${id}/remove`, { version: b.dataset.removever });
  }));
  el.querySelectorAll("[data-editver]").forEach((b) => b.addEventListener("click", () => onEdit?.(b.dataset.editver, el.querySelector("[data-editslot]"))));
}

export function loadResults(el) {
  fetch(`api/tests/${encodeURIComponent(el.dataset.test)}/results`, { cache: "no-store" }).then((r) => r.json())
    .then((r) => fillResults(el, r)).catch(() => fillResults(el, { unavailable: "network" }));
}
