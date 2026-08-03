import { useState, useLayoutEffect } from "react";

/**
 * Decides whether the desktop nav row still fits its available width, using
 * the real rendered width of an off-screen probe clone instead of a fixed
 * viewport breakpoint — so the switch to the hamburger menu happens exactly
 * when the content stops fitting (longer translations, RTL, browser zoom...),
 * never at an arbitrary px value that can either clip the desktop nav or
 * switch to hamburger while there was still room.
 *
 * @param {React.RefObject} containerRef ref on the row that defines the
 *   available width (e.g. .lp-nav__inner)
 * @param {React.RefObject} probeRef ref on a hidden, absolutely positioned
 *   clone of the full desktop nav (same content, laid out on one line)
 * @param {Array} deps extra dependencies that should trigger a remeasure
 *   (e.g. [lang] since translated labels change length)
 * @returns {boolean} true when the desktop nav no longer fits and the
 *   hamburger/mobile menu should be shown instead
 */
export function useAdaptiveNav(containerRef, probeRef, deps = []) {
  const [collapsed, setCollapsed] = useState(true);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const probe = probeRef.current;
    if (!container || !probe) return undefined;

    const measure = () => {
      const available = container.clientWidth;
      const required = probe.scrollWidth;
      // Small buffer so the switch doesn't flicker right at the boundary.
      setCollapsed(required > available - 4);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    // Also observe the probe itself: its natural width can change after mount
    // independently of the container (e.g. i18next translations still loading
    // on first paint, async web font swap) — without this, a resize of the
    // probe alone would never trigger a remeasure and the collapsed state
    // could get stuck on a stale, too-early reading.
    ro.observe(probe);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return collapsed;
}
