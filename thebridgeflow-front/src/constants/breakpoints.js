/**
 * Single source of truth for the app's breakpoint scale.
 *
 * CSS media queries cannot read JS values (and this project has no Sass/
 * PostCSS custom-media step), so this file is the canonical reference for
 * any *JS-side* width logic (resize listeners, ResizeObserver thresholds,
 * conditional rendering). Any @media rule written in CSS must use one of
 * these exact pixel values — see the matching comment block in index.css.
 *
 * Do not invent a new value for a one-off tweak; pick the closest entry
 * below. If truly nothing fits, add it here first with a comment explaining
 * why, so CSS and JS never drift apart again.
 */
export const BREAKPOINTS = {
  xs: 400,    // last-resort tightening for the narrowest real phones
  sm: 480,    // phase from "phone" spacing to compact-card spacing
  md: 640,    // small-phone -> large-phone
  lg: 768,    // phone -> tablet (most common collapse point in the app)
  xl: 900,    // tablet -> the dashboard's own drawer/topbar breakpoint
  xxl: 1024,  // tablet -> small laptop (grid column counts, public pages)
  xxxl: 1100, // small laptop -> desktop (wide multi-column sections)
};

/**
 * Matches DashboardLayout.jsx / Sidebar.css / Topbar.css: below this width
 * the dashboard sidebar becomes an off-canvas drawer instead of a rail.
 * Keep every window.innerWidth check for this behavior pointed at this
 * constant instead of a bare number.
 */
export const DASHBOARD_MOBILE_BREAKPOINT = BREAKPOINTS.xl;
