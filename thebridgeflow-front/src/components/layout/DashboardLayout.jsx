import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import { notificationsService } from "../../services/notifications.service.js";
import { DASHBOARD_MOBILE_BREAKPOINT } from "../../constants/breakpoints.js";
import "./DashboardLayout.css";

export default function DashboardLayout({ children, title, subtitle }) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // On mobile/tablet the sidebar renders as an off-canvas drawer (see
    // Sidebar.css ≤900px, kept in sync with DASHBOARD_MOBILE_BREAKPOINT), not
    // a collapsible rail — it must always start closed there, regardless of
    // a desktop "expanded" preference saved in localStorage, or a first
    // mobile visit would land with the drawer (and its dark overlay)
    // covering the whole screen.
    if (typeof window !== "undefined" && window.innerWidth <= DASHBOARD_MOBILE_BREAKPOINT) return false;
    const saved = localStorage.getItem("sb_main");
    return saved !== null ? saved !== "false" : true;
  });

  const [notifications, setNotifications] = useState([]);

  const loadNotifications = useCallback(() => {
    notificationsService.getAll()
      .then(({ data }) => setNotifications(data.notifications || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Force the drawer closed the moment the viewport is *live-resized* down
  // into the mobile range (e.g. dragging DevTools' Responsive-mode handle,
  // or shrinking a real browser window) while it happened to be open/expanded
  // from a desktop session — otherwise the drawer + its full-screen dark
  // overlay stay up, silently swallowing every click on the header behind it.
  // The initial-mount check above only covers a fresh page load, not this.
  const wasMobileRef = useRef(typeof window !== "undefined" && window.innerWidth <= DASHBOARD_MOBILE_BREAKPOINT);
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= DASHBOARD_MOBILE_BREAKPOINT;
      if (isMobile && !wasMobileRef.current) {
        setSidebarOpen(false);
      }
      wasMobileRef.current = isMobile;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Lock body scroll while the mobile drawer is open. Harmless on desktop:
  // .dl-shell is height:100vh/overflow:hidden there and .dl-content is the
  // actual scroll container, so the body never scrolls in that layout anyway.
  useEffect(() => {
    if (!sidebarOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [sidebarOpen]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem("sb_main", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleSidebarOpen = useCallback((value) => {
    setSidebarOpen(value);
    localStorage.setItem("sb_main", JSON.stringify(value));
  }, []);

  // Auto-close the drawer after navigating — mobile/tablet only (≤900px, same
  // breakpoint the Sidebar itself switches to the fixed drawer at). On
  // desktop this must NOT collapse the sidebar just because a link was clicked.
  const handleSidebarNavigate = useCallback(() => {
    if (window.innerWidth <= DASHBOARD_MOBILE_BREAKPOINT) handleSidebarOpen(false);
  }, [handleSidebarOpen]);

  const handleMarkAsRead  = async (id) => { await notificationsService.markAsRead(id); loadNotifications(); };
  const handleMarkAllRead = async ()   => { await notificationsService.markAllRead(); loadNotifications(); };
  const handleDelete      = async (id) => { await notificationsService.delete(id); loadNotifications(); };

  return (
    <div className={`dl-shell ${sidebarOpen ? "dl-shell--open" : "dl-shell--closed"}`}>

      {/* Overlay mobile — ferme la sidebar en cliquant à côté */}
      <div
        className={`dl-overlay ${sidebarOpen ? "dl-overlay--visible" : ""}`}
        onClick={() => handleSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sidebar
        isOpen={sidebarOpen}
        onToggle={handleToggleSidebar}
        onNavigate={handleSidebarNavigate}
        unreadNotifCount={unreadCount}
      />

      <div className="dl-main">
        <Topbar
          title={title}
          subtitle={subtitle}
          sidebarOpen={sidebarOpen}
          onSidebarToggle={handleToggleSidebar}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllRead={handleMarkAllRead}
          onDelete={handleDelete}
        />
        <div className="dl-content">
          {children}
        </div>
      </div>
    </div>
  );
}
