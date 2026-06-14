import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AGENT_NAMES } from "../../shared/config/app";
import CommandCenterWidget from "../../widgets/command-center/CommandCenterWidget";
import IntegrationsOverviewWidget from "../../widgets/integrations-overview/IntegrationsOverviewWidget";
import { useAuth } from "../../shared/providers/useAuth";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { chipFadeUp, pageStagger } from "../../lib/motion";

const QUICK_ACTIONS = [
  { to: "/app/pipelines", label: "Pipeline Explorer", tone: "lavender" },
  { to: "/app/pm-agents", label: AGENT_NAMES.VIRIN, tone: "peach" },
  { to: "/app/codebase", label: AGENT_NAMES.ANANTA, tone: "mint" },
  { to: "/app/settings/integrations/jira", label: "Jira", tone: "butter" },
  { to: "/app/settings/integrations/github", label: "GitHub", tone: "lavender" },
  { to: "/app/qa", label: AGENT_NAMES.NEEL, tone: "mint" },
];

const CHIP_TONES = {
  lavender: "bg-app-lavender/50 border-app-lavender hover:bg-app-lavender/70",
  peach: "bg-app-peach/50 border-app-peach hover:bg-app-peach/70",
  mint: "bg-app-mint/50 border-app-mint hover:bg-app-mint/70",
  butter: "bg-app-butter/60 border-app-butter hover:bg-app-butter/80",
};

function greetingName(user) {
  if (!user) return "there";
  if (user.name?.trim()) return user.name.split(/\s+/)[0];
  return user.email?.split("@")[0] ?? "there";
}

export default function Dashboard() {
  const { user } = useAuth();
  const name = greetingName(user);

  return (
    <AnimatedAppPage className="space-y-6">
      <section className="app-card-interactive p-6 sm:p-8">
        <p className="type-kicker">Workspace overview</p>
        <h1 className="mt-2 type-page-title">Welcome back, {name}</h1>
        <p className="mt-2 type-page-lede">
          Your AI engineering workspace — monitor pipelines, integrations, and delivery
          metrics in one place.
        </p>

        <motion.div
          className="mt-6 flex flex-wrap gap-2"
          variants={pageStagger(0.04)}
          initial="hidden"
          animate="show"
        >
          {QUICK_ACTIONS.map((action) => (
            <motion.div key={action.to} variants={chipFadeUp}>
              <Link
                to={action.to}
                className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-[13px] font-medium text-app-ink transition-all duration-200 ${CHIP_TONES[action.tone]}`}
              >
                {action.label}
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <IntegrationsOverviewWidget />
      <CommandCenterWidget />
    </AnimatedAppPage>
  );
}
