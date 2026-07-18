import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Bot,
  FileCheck2,
  FolderOpen,
  Home as HomeIcon,
  Sparkles,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const nav = [
  { to: "/", label: "Home", icon: HomeIcon, exact: true },
  { to: "/documents", label: "Documents", icon: FolderOpen },
  { to: "/assistant", label: "Assistant", icon: Bot },
  { to: "/report", label: "Report", icon: FileCheck2 },
  { to: "/profile", label: "Profile", icon: User },
] as const;

function useIsActive(to: string, exact?: boolean) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
}

function NavItem({
  to,
  label,
  icon: Icon,
  exact,
  variant,
}: {
  to: string;
  label: string;
  icon: typeof HomeIcon;
  exact?: boolean;
  variant: "side" | "bottom";
}) {
  const active = useIsActive(to, exact);
  if (variant === "side") {
    return (
      <Link
        to={to}
        className="group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {active && (
          <motion.span
            layoutId="side-active"
            className="absolute inset-0 rounded-2xl border border-primary/15"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, #2563EB 12%, transparent), color-mix(in oklab, #3B82F6 6%, transparent))",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
          />
        )}
        <Icon
          className={`relative h-[18px] w-[18px] shrink-0 transition-transform group-hover:translate-x-0.5 ${active ? "text-primary" : ""}`}
          strokeWidth={active ? 2.4 : 2}
        />
        <span className={`relative ${active ? "text-foreground" : ""}`}>{label}</span>
      </Link>
    );
  }
  return (
    <Link
      to={to}
      className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-muted-foreground"
    >
      {active && (
        <motion.span
          layoutId="bottom-active"
          className="absolute inset-x-4 top-1 h-[3px] rounded-full bg-primary"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <Icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
      <span className={active ? "text-foreground" : ""}>{label}</span>
    </Link>
  );
}

export function AppLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-background">
      {/* Ambient gradient */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "var(--gradient-glow)" }}
      />

      <div className="mx-auto flex w-full max-w-[1400px]">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar/70 px-4 py-6 md:flex">
          <Link to="/" className="mb-8 flex items-center gap-2 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight">RentReady</div>
              <div className="text-[11px] text-muted-foreground">AI Copilot</div>
            </div>
          </Link>

          <nav className="flex flex-col gap-1">
            {nav.map((item) => (
              <NavItem key={item.to} {...item} variant="side" />
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-border/60 bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground">
              Rental Confidence
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">94%</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "94%" }}
                transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
                className="h-full rounded-full gradient-primary"
              />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 pb-24 md:pb-8">
          {/* Mobile header */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl md:hidden">
            <Link to="/" className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg gradient-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold tracking-tight">RentReady</div>
            </Link>
            <Link
              to="/profile"
              className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
            >
              JC
            </Link>
          </div>

          <div className="px-4 pt-4 md:px-8 md:pt-8">{children ?? <Outlet />}</div>
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="flex items-stretch">
          {nav.map((item) => (
            <NavItem key={item.to} {...item} variant="bottom" />
          ))}
        </div>
      </nav>

      {/* Floating AI assistant */}
      <FloatingAI />
    </div>
  );
}

function FloatingAI() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/assistant") return null;
  return (
    <Link
      to="/assistant"
      aria-label="Open AI assistant"
      className="fixed right-4 z-50 grid h-14 w-14 place-items-center rounded-full text-primary-foreground breathe md:right-8 md:bottom-8"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 76px)",
        background: "linear-gradient(135deg, #2563EB, #3B82F6)",
      }}
    >
      <motion.span
        animate={{ rotate: [0, 8, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="grid place-items-center"
      >
        <Bot className="h-6 w-6" strokeWidth={2.2} />
      </motion.span>
    </Link>
  );
}

