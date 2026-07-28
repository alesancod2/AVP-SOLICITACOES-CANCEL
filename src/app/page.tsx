"use client";

import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PageName } from "@/lib/types";
import LoginPage from "@/components/LoginPage";
import Sidebar from "@/components/Sidebar";
import CancelamentosPage from "@/components/pages/CancelamentosPage";
import SuspensosPage from "@/components/pages/SuspensosPage";
import DashboardPage from "@/components/pages/DashboardPage";
import UsuariosPage from "@/components/pages/UsuariosPage";
import LogsPage from "@/components/pages/LogsPage";

function AppContent() {
  const { user, loading, canAccess } = useAuth();
  const [activePage, setActivePage] = useState<PageName>("cancelamentos");
  const [sidebarPinned, setSidebarPinned] = useState(false);

  // Check sidebar pinned state for layout margin
  useEffect(() => {
    const saved = localStorage.getItem("avp_sidebar_pinned");
    setSidebarPinned(saved === "true");

    const handleStorage = () => {
      const updated = localStorage.getItem("avp_sidebar_pinned");
      setSidebarPinned(updated === "true");
    };

    window.addEventListener("storage", handleStorage);
    // Also poll for changes from same tab
    const interval = setInterval(() => {
      const updated = localStorage.getItem("avp_sidebar_pinned");
      setSidebarPinned(updated === "true");
    }, 500);

    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center animate-pulse">
            <span className="text-white font-bold">AVP</span>
          </div>
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (activePage) {
      case "cancelamentos":
        return <CancelamentosPage />;
      case "suspensos":
        return <SuspensosPage />;
      case "dashboard":
        return <DashboardPage />;
      case "usuarios":
        return <UsuariosPage />;
      case "logs":
        return <LogsPage />;
      default:
        return <CancelamentosPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar activePage={activePage} onPageChange={setActivePage} />

      {/* Main content area */}
      <main
        className={`min-h-screen transition-all duration-300 ${
          sidebarPinned ? "lg:ml-64" : "lg:ml-16"
        }`}
      >
        <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-6">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
