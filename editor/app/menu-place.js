// "⋮" action menus (bundle and test rows): an open panel is placed in fixed position from its button and
// kept inside the window, opening upward when there is no room below. Nothing is clipped by the table or the card,
// and the last row's menu never needs a scroll. One listener for every list (capture phase: the lists stop the click).
const GAP = 6, EDGE = 8;

function place(panel) {
  const btn = panel.closest(".xmenu")?.querySelector("[data-menu]");
  if (!btn || panel.hidden) return;
  panel.classList.add("xmenu__panel--fixed");
  const b = btn.getBoundingClientRect(), w = panel.offsetWidth, h = panel.offsetHeight;
  const left = Math.min(Math.max(EDGE, b.right - w), innerWidth - w - EDGE);
  let top = b.bottom + GAP;
  if (top + h > innerHeight - EDGE) top = b.top - GAP - h;   // no room below: open upward
  top = Math.max(EDGE, Math.min(top, innerHeight - h - EDGE));
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

const openPanels = () => [...document.querySelectorAll(".xmenu__panel:not([hidden])")];

let wired = false;
export function wireMenus() {
  if (wired) return;
  wired = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.("[data-menu]");
    const mine = btn?.closest(".xmenu")?.querySelector(".xmenu__panel");
    // Only one menu open at a time.
    openPanels().forEach((p) => { if (p !== mine && !p.contains(e.target)) p.hidden = true; });
    if (mine) setTimeout(() => place(mine), 0);   // after the list's own handler has opened it
  }, true);
  const again = () => openPanels().forEach(place);
  addEventListener("resize", again);
  addEventListener("scroll", again, true);
  addEventListener("keydown", (e) => { if (e.key === "Escape") openPanels().forEach((p) => { p.hidden = true; }); });
}
