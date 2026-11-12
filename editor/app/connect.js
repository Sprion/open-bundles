// "Connect to store" window: store domain, app keys, optional preview theme and stats collector.
// You type the keys here; the server keeps them in your user folder (~/.open-bundles/), outside the repository,
// and never sends a secret back: a saved secret only shows as "saved", and an empty field keeps it.

const PUBLIC = ["SHOPIFY_STORE", "SHOPIFY_CLIENT_ID", "SHOPIFY_PREVIEW_THEME_ID", "SHOP_URL", "STATS_URL"];
const SECRET = ["SHOPIFY_CLIENT_SECRET", "SHOPIFY_ADMIN_TOKEN", "STATS_READ_KEY"];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function post(path, body) {
  return fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "X-editor": "1" }, body: JSON.stringify(body || {}) })
    .then((r) => r.json().then((d) => (r.ok ? d : Promise.reject(new Error(d.error || `HTTP ${r.status}`)))));
}

function field(key, label, s, opts = {}) {
  const secret = SECRET.includes(key);
  const ph = secret ? (s[key] ? "Saved: leave empty to keep it" : opts.ph || "") : opts.ph || "";
  return `<label class="cx__field"><span>${label}</span>
    <input name="${key}" ${secret ? 'type="password" autocomplete="new-password"' : 'type="text" autocomplete="off"'} spellcheck="false"
      value="${secret ? "" : esc(s[key])}" placeholder="${esc(ph)}">${opts.hint ? `<small>${opts.hint}</small>` : ""}</label>`;
}

function html(s, connected) {
  return `<form class="cx__box" method="dialog">
    <div class="cx__head"><h2>Connect to store</h2><button type="button" class="xbtn xbtn--icon xbtn--ghost" data-cx-close aria-label="Close">×</button></div>
    <p class="cx__lead">Type your keys here yourself: they are saved on this computer only (in <code>~/.open-bundles/</code>, outside
      the project folder) and are never shown again, so you never need to give them to anyone, AI assistants included.</p>
    ${field("SHOPIFY_STORE", "Store domain", s, { ph: "my-store.myshopify.com", hint: "Shopify admin: Settings > Domains, the myshopify.com one" })}
    <div class="cx__grid">
      ${field("SHOPIFY_CLIENT_ID", "App client ID", s, { hint: "Dev Dashboard > your app > Settings" })}
      ${field("SHOPIFY_CLIENT_SECRET", "App client secret", s)}
    </div>
    <details class="cx__more"${s.SHOPIFY_ADMIN_TOKEN ? " open" : ""}><summary>Use an Admin API access token instead</summary>
      ${field("SHOPIFY_ADMIN_TOKEN", "Admin API access token", s, { ph: "shpat_..." })}
    </details>
    <details class="cx__more"${s.SHOPIFY_PREVIEW_THEME_ID || s.SHOP_URL ? " open" : ""}><summary>Preview links (optional)</summary>
      <div class="cx__grid">
        ${field("SHOPIFY_PREVIEW_THEME_ID", "Unpublished theme ID", s, { hint: "The editor's Open links show this theme" })}
        ${field("SHOP_URL", "Public store URL", s, { ph: "https://www.my-store.com" })}
      </div>
    </details>
    <details class="cx__more"${s.STATS_URL ? " open" : ""}><summary>A/B stats collector (optional)</summary>
      <div class="cx__grid">
        ${field("STATS_URL", "Collector URL", s, { ph: "https://stats.my-site.com" })}
        ${field("STATS_READ_KEY", "Read key", s)}
      </div>
    </details>
    <p class="cx__msg" data-cx-msg role="status" aria-live="polite"></p>
    <div class="cx__foot">
      ${connected ? `<button type="button" class="xbtn xbtn--ghost cx__danger" data-cx-forget>Disconnect</button>
        <button type="button" class="xbtn" data-cx-discount>Create the bundle discount</button>` : ""}
      <span class="cx__spacer"></span>
      <button type="submit" class="xbtn xbtn--primary" data-cx-save>${connected ? "Save and test" : "Connect"}</button>
    </div>
  </form>`;
}

export function mount(button, tag) {
  let status = { demo: true, settings: {} };
  const dlg = document.createElement("dialog");
  dlg.className = "cx";
  document.body.append(dlg);

  const paint = () => {
    tag.textContent = status.demo ? "Demo mode: no store connected" : status.store;
    tag.hidden = false;
    button.textContent = status.demo ? "Connect to store" : "Store settings";
  };
  const say = (text, bad) => {
    const m = dlg.querySelector("[data-cx-msg]");
    m.textContent = text;
    m.classList.toggle("cx__msg--bad", !!bad);
  };
  const busy = (on) => dlg.querySelectorAll("button, input").forEach((x) => { x.disabled = on; });

  fetch("/api/status").then((r) => r.json()).then((s) => { status = s; paint(); }).catch(() => {});

  button.addEventListener("click", () => {
    dlg.innerHTML = html(status.settings || {}, !status.demo);
    dlg.showModal();
    dlg.querySelector("[data-cx-close]").addEventListener("click", () => dlg.close());
    dlg.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const settings = {};
      for (const k of [...PUBLIC, ...SECRET]) settings[k] = dlg.querySelector(`[name="${k}"]`).value.trim();
      busy(true);
      say("Testing the connection…");
      post("/api/connect", { settings }).then((r) => {
        say(`Connected to ${r.shop}.` + (r.missingScopes.length ? ` Missing app scopes: ${r.missingScopes.join(", ")} (add them to shopify.app.toml, deploy, then accept the update on the store).` : " Reloading…"),
          r.missingScopes.length > 0);
        dlg.querySelectorAll("input[type=password]").forEach((x) => { x.value = ""; });
        if (!r.missingScopes.length) setTimeout(() => location.reload(), 900);
        else busy(false);
      }).catch((err) => { say(err.message, true); busy(false); });
    });
    dlg.querySelector("[data-cx-forget]")?.addEventListener("click", () => {
      if (!confirm("Delete the saved store settings from this computer? Your bundles and tests stay in data/.")) return;
      post("/api/disconnect").then(() => location.reload()).catch((err) => say(err.message, true));
    });
    dlg.querySelector("[data-cx-discount]")?.addEventListener("click", () => {
      busy(true);
      say("Creating the discount…");
      post("/api/discount").then((r) => say(`${r.message} (${String(r.status || "").toLowerCase()}).`))
        .catch((err) => say(err.message, true)).finally(() => busy(false));
    });
  });
}
