// editor preview only (added by apps/experiments/bundle_render.py; the theme is not changed): smooth bar switch.
// The theme's ob-bundle.js moves the colour/size pickers under the newly chosen bar at once, so every bar jumped by the
// pickers' height and the next click could land on the other bar. Here, after the theme's own update, the old pickers
// fold away where they were (a copy that shrinks and fades) while the new ones unfold under the chosen bar.
(() => {
  const D = 280, EASE = "cubic-bezier(.4,0,.2,1)";
  const FLAT = { height: "0px", marginTop: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px", borderTopWidth: "0px", borderBottomWidth: "0px", opacity: 0 };
  let anims = [];
  document.addEventListener("change", (e) => {
    const input = e.target, bar = input.type === "radio" && input.closest("[data-ob-bar]");
    const panel = bar && bar.closest(".ob")?.querySelector("[data-ob-panel]");
    if (!panel || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    anims.forEach((a) => a.finish()); anims = [];
    // Capture phase: runs before the theme's listener, so this is the state before the switch.
    const prev0 = panel.previousElementSibling, parent0 = panel.parentNode, disp0 = getComputedStyle(panel).display;
    const h0 = disp0 === "none" ? 0 : panel.offsetHeight, ghost = h0 ? panel.cloneNode(true) : null;
    requestAnimationFrame(() => { // after every change listener, before the next paint
      const same = panel.parentNode === parent0 && panel.previousElementSibling === prev0;
      const cs = getComputedStyle(panel), h1 = cs.display === "none" ? 0 : panel.offsetHeight;
      const box = (el) => { el.style.boxSizing = "border-box"; el.style.overflow = "hidden"; };
      if (!same && ghost && prev0?.isConnected) {
        ghost.removeAttribute("data-ob-panel");
        ghost.querySelectorAll("[id],[name]").forEach((el) => { el.removeAttribute("id"); el.removeAttribute("name"); });
        ghost.setAttribute("aria-hidden", "true"); ghost.inert = true; ghost.style.pointerEvents = "none"; ghost.style.display = disp0; box(ghost);
        prev0.after(ghost);
        const ga = ghost.animate([{ height: `${h0}px`, opacity: 1 }, FLAT], { duration: D, easing: EASE });
        ga.onfinish = ga.oncancel = () => ghost.remove(); anims.push(ga);
      }
      if (h1 && (!same || Math.abs(h1 - h0) > 1)) {
        box(panel);
        const to = { height: `${h1}px`, marginTop: cs.marginTop, marginBottom: cs.marginBottom, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom,
          borderTopWidth: cs.borderTopWidth, borderBottomWidth: cs.borderBottomWidth, opacity: 1 };
        const pa = panel.animate(same ? [{ height: `${h0}px` }, { height: `${h1}px` }] : [FLAT, to], { duration: D, easing: EASE });
        pa.onfinish = pa.oncancel = () => { panel.style.boxSizing = ""; panel.style.overflow = ""; }; anims.push(pa);
      }
    });
  }, true);
})();
