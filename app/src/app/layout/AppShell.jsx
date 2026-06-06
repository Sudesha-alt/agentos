import { motion } from "framer-motion";
import { Outlet } from "react-router-dom";
import { EASE } from "../../lib/motion";
import GithubOAuthRedirect from "./GithubOAuthRedirect";
import MobileNav from "./MobileNav";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <GithubOAuthRedirect />
      <div className="grid-bg-fine fixed inset-0 opacity-20 pointer-events-none" />
      <div className="editorial-noise pointer-events-none fixed inset-0 opacity-[0.18]" />
      <div className="relative flex">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col md:pl-60">
          <TopBar />
          <MobileNav />
          <motion.main
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex-1 px-5 pb-16 pt-8 sm:px-8"
          >
            <Outlet />
          </motion.main>
        </div>
      </div>
    </div>
  );
}
