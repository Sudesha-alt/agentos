import { Children } from "react";
import { motion } from "framer-motion";
import { motionSafe, pageStagger, sectionFadeUp } from "../../lib/motion";
import { AppPage } from "./AppChrome";

/**
 * App page wrapper with subtle staggered section entrance.
 */
export function AnimatedAppPage({ children, className = "", wide = false }) {
  const safeStagger = motionSafe(pageStagger());
  const safeSection = motionSafe(sectionFadeUp);

  return (
    <AppPage className={className} wide={wide}>
      <motion.div variants={safeStagger} initial="hidden" animate="show">
        {Children.map(children, (child, index) => {
          if (child == null) return null;
          return (
            <motion.div
              key={child.key ?? index}
              variants={safeSection}
              className={index > 0 ? "mt-5" : undefined}
            >
              {child}
            </motion.div>
          );
        })}
      </motion.div>
    </AppPage>
  );
}

/**
 * Single animated section (for use inside pages without full page wrapper).
 */
export function AnimatedSection({ children, className = "" }) {
  const safeSection = motionSafe(sectionFadeUp);
  return (
    <motion.section
      className={className}
      variants={safeSection}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.section>
  );
}
