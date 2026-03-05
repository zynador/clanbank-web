"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/components/Dashboard";
import AdminPanel from "@/components/AdminPanel";

type PageTab = "dashboard" | "admin";

function DashboardPage() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PageTab>("dashboard");
  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="sticky top-0 z-30 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Image
                src="/logo.svg"
                alt="1Ca - Bank"
                width={120}
                height={29}
                className="shrink-0"
                priority
              />
              <nav className="hidden sm:flex items-center gap-1 ml-4">
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "dashboard"
                      ? "bg-gray-800 text-gray-100"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => router.push("/deposits")}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 transition-all"
                >
                  Einzahlungen
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab("admin")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === "admin"
                        ? "bg-gray-800 text-gray-100"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Verwaltung
                  </button>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 hidden sm:inline">
                {profile?.ingame_name || profile?.display_name}
              </span>
              <button
                onClick={signOut}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-all"
              >
                Abmelden
              </button>
            </div>
          </div>
          <div className="sm:hidden flex gap-1 pb-2 -mt-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === "dashboard"
                  ? "bg-gray-800 text-gray-100"
                  : "text-gray-400"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => router.push("/deposits")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 whitespace-nowrap"
            >
              Einzahlungen
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeTab === "admin"
                    ? "bg-gray-800 text-gray-100"
                    : "text-gray-400"
                }`}
              >
                Verwaltung
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "admin" && isAdmin && <AdminPanel />}
      </main>
    </div>
  );
}

export default function DashboardPageWrapper() {
  return (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  );
}
