import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Globe,
  Lock,
  LogOut,
  Moon,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { SectionHeader } from "@/components/ui-bits";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "Settings — RentReady AI" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { profile, displayName, isDemo, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  const notImplemented = () => toast("Coming soon", { description: "This setting will be available shortly." });

  const sections = [
    {
      icon: UserIcon,
      title: "Account",
      body: (
        <div className="space-y-3">
          <Row label="Name" value={displayName} />
          <Row label="Email" value={profile?.email ?? (isDemo ? "Demo mode" : "—")} />
          <Row label="Country" value={profile?.country ?? "—"} />
          <button
            onClick={() => navigate({ to: "/profile" })}
            className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent/50"
          >
            Edit profile
          </button>
        </div>
      ),
    },
    {
      icon: Bell,
      title: "Notifications",
      body: (
        <Toggle
          label="Email me when documents are verified"
          defaultChecked
          onChange={notImplemented}
        />
      ),
    },
    {
      icon: Moon,
      title: "Theme",
      body: (
        <Toggle
          label="Use dark mode"
          onChange={(v) => {
            if (typeof document !== "undefined") {
              document.documentElement.classList.toggle("dark", v);
            }
            toast.success(`Switched to ${v ? "dark" : "light"} mode`);
          }}
        />
      ),
    },
    {
      icon: Lock,
      title: "Privacy",
      body: (
        <Toggle
          label="Share anonymized data to improve AI"
          onChange={notImplemented}
        />
      ),
    },
    {
      icon: Globe,
      title: "Language",
      body: (
        <select
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
          onChange={notImplemented}
          defaultValue="en"
        >
          <option value="en">English</option>
          <option value="de">Deutsch</option>
          <option value="fr">Français</option>
          <option value="es">Español</option>
        </select>
      ),
    },
  ];

  return (
    <AppLayout>
      <SectionHeader
        eyebrow="Settings"
        title="Manage your account"
        subtitle="Fine-tune your RentReady AI experience."
      />

      <div className="space-y-4 pb-8">
        {sections.map((s) => (
          <div
            key={s.title}
            className="rounded-3xl border border-border/60 bg-card p-5 md:p-6"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold">{s.title}</div>
            </div>
            {s.body}
          </div>
        ))}

        <div className="rounded-3xl border border-destructive/30 bg-card p-5 md:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <Trash2 className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold">Danger zone</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-accent/50"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
            <button
              onClick={() =>
                toast("Contact support to delete your account", {
                  description: "We keep this manual to keep your data safe.",
                })
              }
              className="flex items-center gap-2 rounded-xl border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Delete account
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3.5 py-2.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function Toggle({
  label,
  defaultChecked,
  onChange,
}: {
  label: string;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3.5 py-3">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-muted transition-all checked:bg-primary relative after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] checked:after:left-[18px]"
      />
    </label>
  );
}
