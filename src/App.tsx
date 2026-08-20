import { useState } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LoginPage } from "@/pages/LoginPage";
import { Layout, type PageKey } from "@/components/Layout";
import { DashboardPage } from "@/pages/DashboardPage";
import { BlankTypesPage } from "@/pages/BlankTypesPage";
import { BlanksPage } from "@/pages/BlanksPage";
import { PrintDesignsPage } from "@/pages/PrintDesignsPage";
import { LogosPage } from "@/pages/LogosPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProductOptimizePage } from "@/pages/ProductOptimizePage";
import { UsersPage } from "@/pages/UsersPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { Loader2 } from "lucide-react";

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [page, setPage] = useState<PageKey>("dashboard");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-sky-400" size={32} />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  // If a staff user lands on the users page but isn't admin, redirect
  const effectivePage = page === "users" && profile?.role !== "admin" ? "dashboard" : page;

  return (
    <Layout current={effectivePage} onNavigate={setPage}>
      {effectivePage === "dashboard" && <DashboardPage />}
      {effectivePage === "blank-types" && <BlankTypesPage />}
      {effectivePage === "blanks" && <BlanksPage />}
      {effectivePage === "print-designs" && <PrintDesignsPage />}
      {effectivePage === "logos" && <LogosPage />}
      {effectivePage === "products" && <ProductsPage />}
      {effectivePage === "product-optimize" && (
        <ProductOptimizePage onNavigateToSettings={() => setPage("settings")} />
      )}
      {effectivePage === "users" && <UsersPage />}
      {effectivePage === "settings" && <SettingsPage />}
    </Layout>
  );
}

import { SyncProvider } from "@/context/SyncContext";

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <AppContent />
      </SyncProvider>
    </AuthProvider>
  );
}
