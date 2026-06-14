import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { motionSafe, pageRouteFade } from "../../lib/motion";

export default function AppPageTransition() {
  const location = useLocation();
  const variants = motionSafe(pageRouteFade);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="hidden"
        animate="show"
        exit="exit"
        className="app-page-transition min-w-0"
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
