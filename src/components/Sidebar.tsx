"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PageName, NAV_ITEMS } from "@/lib/types";
import {
  FileX,
  PauseCircle,
  BarChart3,
  Users,
  ScrollText,
  Pin,
  PinOff,
  Menu,
  X,
  LogOut,
  ChevronRight,
} from "lucide-react";

interface SidebarProps {
  activePage: PageName;
  onPageChange: (page: PageName) => void;
}

const ICON_MAP: Record<string, any> = {
  "file-x": FileX,
  "pause-circle": PauseCircle,
  "bar-chart-3": BarChart3,
  users: Users,
  "scroll-text": ScrollText,
};

export default function Sidebar({ activePage, onPageChange }: SidebarProps) {
  const { user, logout, canAccess, isAdmin } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Load pinned state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("avp_sidebar_pinned");
    if (saved === "true") {
      setPinned(true);
      setExpanded(true);
    }
  }, []);

  const togglePin = () => {
    const newPinned = !pinned;
    setPinned(newPinned);
    setExpanded(newPinned);
    localStorage.setItem("avp_sidebar_pinned", String(newPinned));
    // Dispatch custom event for same-tab listeners (page.tsx)
    window.dispatchEvent(new CustomEvent("sidebar-pin-change", { detail: { pinned: newPinned } }));
  };

  const handleMouseEnter = () => {
    if (!pinned) setExpanded(true);
  };

  const handleMouseLeave = () => {
    if (!pinned) setExpanded(false);
  };

  const handleNavClick = (page: PageName) => {
    onPageChange(page);
    setMobileOpen(false);
  };

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.permissionKey && !isAdmin && !canAccess(item.name)) return false;
    return true;
  });

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo / Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-800">
        <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">AVP</span>
        </div>
        {(expanded || isMobile) && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-gray-100 whitespace-nowrap">AVP System</h1>
            <p className="text-xs text-gray-500 whitespace-nowrap">Gestao de Cancelamentos</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = ICON_MAP[item.icon] || FileX;
          const isActive = activePage === item.name;

          return (
            <button
              key={item.name}
              onClick={() => handleNavClick(item.name)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-700/50"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
              title={!expanded && !isMobile ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {(expanded || isMobile) && (
                <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
              )}
              {isActive && (expanded || isMobile) && (
                <ChevronRight className="w-4 h-4 ml-auto" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer - User info + Pin */}
      <div className="border-t border-gray-800 p-3 space-y-2">
        {/* Pin Toggle (desktop only) */}
        {!isMobile && (
          <button
            onClick={togglePin}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors"
            title={pinned ? "Desafixar sidebar" : "Fixar sidebar"}
          >
            {pinned ? <PinOff className="w-4 h-4 flex-shrink-0" /> : <Pin className="w-4 h-4 flex-shrink-0" />}
            {expanded && (
              <span className="text-xs whitespace-nowrap">
                {pinned ? "Desafixar" : "Fixar menu"}
              </span>
            )}
          </button>
        )}

        {/* User info */}
        {(expanded || isMobile) && user && (
          <div className="px-3 py-2 rounded-lg bg-gray-800/50">
            <p className="text-sm font-medium text-gray-200 truncate">{user.nome}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
              user.perfil === "Admin"
                ? "bg-purple-900/50 text-purple-300"
                : "bg-gray-700 text-gray-300"
            }`}>
              {user.perfil}
            </span>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
          title="Sair"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {(expanded || isMobile) && (
            <span className="text-sm whitespace-nowrap">Sair</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-gray-200"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 animate-backdrop"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-gray-900 border-r border-gray-800 animate-slide-in">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 text-gray-500 hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent isMobile />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-gray-900 border-r border-gray-800 z-40 sidebar-transition ${
          expanded ? "w-64" : "w-16"
        }`}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
