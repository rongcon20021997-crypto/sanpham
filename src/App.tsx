import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LoginPage } from "@/pages/LoginPage";
import { Layout, type PageKey } from "@/components/Layout";
import { DashboardPage } from "@/pages/DashboardPage";
import { BlankTypesPage } from "@/pages/BlankTypesPage";
import { BlanksPage } from "@/pages/BlanksPage";
import { PrintDesignsPage } from "@/pages/PrintDesignsPage";
import { LogosPage } from "@/pages/LogosPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { AIPromptsPage } from "@/pages/AIPromptsPage";
import { ProductOptimizePage } from "@/pages/ProductOptimizePage";
import { ShopeeShopsPage } from "@/pages/ShopeeShopsPage";
import { ShopeePublishPage } from "@/pages/ShopeePublishPage";
import { TikTokShopsPage } from "@/pages/TikTokShopsPage";
import { UsersPage } from "@/pages/UsersPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { Loader2 } from "lucide-react";
import { exchangeShopeeAuthCode } from "@/lib/shopee";
import { exchangeTikTokAuthCode } from "@/lib/tiktok";

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [page, setPage] = useState<PageKey>("dashboard");
  const [authProcessingText, setAuthProcessingText] = useState<string | null>(null);

  // Tự động bắt mã ủy quyền Shopee & TikTok Shop khi sàn redirect về
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const shopId = params.get("shop_id");
    const authCode = params.get("auth_code");
    const state = params.get("state") || "";

    // Shopee Callback
    if (code && shopId) {
      setAuthProcessingText("Đang tự động xác thực và kết nối gian hàng Shopee...");
      exchangeShopeeAuthCode(code, shopId)
        .then((newShop) => {
          window.history.replaceState({}, document.title, window.location.pathname);
          setPage("shopee-shops");
          alert(`🎉 Đã kết nối tự động thành công gian hàng Shopee: "${newShop.shopName}" (Shop ID: ${newShop.shopId})!`);
        })
        .catch((err) => {
          alert(`Lỗi tự động kết nối Shopee: ${err.message}`);
        })
        .finally(() => {
          setAuthProcessingText(null);
        });
      return;
    }

    // TikTok Shop Callback
    const tikTokCode = authCode || (code && (state.includes("tiktok") || window.location.pathname.includes("tiktok")) ? code : null);
    if (tikTokCode) {
      setAuthProcessingText("Đang tự động xác thực và kết nối gian hàng TikTok Shop...");
      exchangeTikTokAuthCode(tikTokCode)
        .then((newShop) => {
          window.history.replaceState({}, document.title, window.location.pathname);
          setPage("tiktok-shops");
          alert(`🎉 Đã kết nối tự động thành công gian hàng TikTok Shop: "${newShop.shopName}"!`);
        })
        .catch((err) => {
          alert(`Lỗi tự động kết nối TikTok Shop: ${err.message}`);
        })
        .finally(() => {
          setAuthProcessingText(null);
        });
    }
  }, []);

  if (loading || authProcessingText) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-200 gap-3">
        <Loader2 className="animate-spin text-brand-400" size={36} />
        {authProcessingText && (
          <p className="text-sm font-semibold text-rose-400">{authProcessingText}</p>
        )}
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
      {effectivePage === "ai-prompts" && <AIPromptsPage />}
      {effectivePage === "product-optimize" && (
        <ProductOptimizePage onNavigateToSettings={() => setPage("settings")} />
      )}
      {effectivePage === "shopee-publish" && (
        <ShopeePublishPage onNavigateToSettings={() => setPage("settings")} />
      )}
      {effectivePage === "shopee-shops" && (
        <ShopeeShopsPage onNavigateToSettings={() => setPage("settings")} />
      )}
      {effectivePage === "tiktok-shops" && (
        <TikTokShopsPage onNavigateToSettings={() => setPage("settings")} />
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
