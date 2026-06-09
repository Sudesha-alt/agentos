import { useEffect } from "react";
import { motion } from "framer-motion";
import { Outlet } from "react-router-dom";
import { EASE } from "../../lib/motion";
import { CodebaseCommandPaletteProvider } from "../../widgets/codebase-search/CodebaseCommandPalette";
import GithubOAuthRedirect from "./GithubOAuthRedirect";
import MobileNav from "./MobileNav";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell() {
  useEffect(() => {
    document.documentElement.classList.add("app-theme");
    return () => document.documentElement.classList.remove("app-theme");
  }, []);

  return (
    <CodebaseCommandPaletteProvider>
      <div className="app-shell app-shell-gradient min-h-screen text-app-ink">
        <GithubOAuthRedirect />
        <div className="relative flex">
          <Sidebar />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col md:pl-[17.5rem]">
            <TopBar />
            <MobileNav />
            <motion.main
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="flex-1 px-4 pb-24 pt-4 sm:px-6 sm:pb-20 sm:pt-6 lg:px-8"
            >
              <Outlet />
            </motion.main>
          </div>
        </div>
      </div>
    </CodebaseCommandPaletteProvider>
  );
}
