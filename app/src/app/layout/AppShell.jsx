import { Suspense, useEffect } from "react";
import { motion } from "framer-motion";
import { EASE } from "../../lib/motion";
import { SidebarProvider, useSidebarCollapsed } from "../../shared/hooks/useSidebarCollapsed";
import AppPageFallback from "../../shared/ui/AppPageFallback";
import AppPageTransition from "../../shared/ui/AppPageTransition";
import { CodebaseCommandPaletteProvider } from "../../widgets/codebase-search/CodebaseCommandPalette";
import GithubOAuthRedirect from "./GithubOAuthRedirect";
import MobileNav from "./MobileNav";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

function AppShellContent() {
  const { collapsed } = useSidebarCollapsed();

  return (
    <div className="relative flex">
      <Sidebar />
      <div
        className={`flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          collapsed ? "md:pl-16" : "md:pl-[17.5rem]"
        }`}
      >
        <TopBar />
        <MobileNav />
        <motion.main
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="flex-1 scroll-smooth px-4 pb-24 pt-4 sm:px-6 sm:pb-20 sm:pt-6 lg:px-8"
        >
          <Suspense fallback={<AppPageFallback />}>
            <AppPageTransition />
          </Suspense>
        </motion.main>
      </div>
    </div>
  );
}

export default function AppShell() {
  useEffect(() => {
    document.documentElement.classList.add("app-theme");
    return () => document.documentElement.classList.remove("app-theme");
  }, []);

  return (
    <CodebaseCommandPaletteProvider>
      <SidebarProvider>
        <div className="app-shell app-shell-gradient min-h-screen text-app-ink">
          <GithubOAuthRedirect />
          <AppShellContent />
        </div>
      </SidebarProvider>
    </CodebaseCommandPaletteProvider>
  );
}
