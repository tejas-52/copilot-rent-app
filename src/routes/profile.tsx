import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  Briefcase,
  Globe2,
  Home,
  MapPin,
  Pencil,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { SectionHeader, Stagger, StaggerItem } from "@/components/ui-bits";
import { profile } from "@/lib/app-data";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — RentReady AI" },
      { name: "description", content: "Your automatically generated rental profile." },
    ],
  }),
  component: ProfilePage,
});

const fields = [
  { label: "Occupation", value: profile.occupation, icon: Briefcase },
  { label: "Nationality", value: profile.nationality, icon: Globe2 },
  { label: "Monthly Income", value: profile.monthlyIncome, icon: Wallet },
  { label: "Current Address", value: profile.address, icon: MapPin },
  { label: "Employment", value: profile.employment, icon: Briefcase },
  { label: "Visa Status", value: profile.visa, icon: ShieldCheck },
];

function ProfilePage() {
  return (
    <AppLayout>
      <SectionHeader
        eyebrow="Profile"
        title="Your rental identity"
        subtitle="Automatically generated from your verified documents. Fully editable."
      />

      <div className="rounded-3xl border border-border/60 bg-card p-6 md:p-8">
        <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:gap-6 md:text-left">
          <div className="relative">
            <div className="grid h-24 w-24 place-items-center rounded-3xl gradient-primary text-2xl font-semibold text-primary-foreground shadow-glow">
              {profile.photoInitials}
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 grid h-7 w-7 place-items-center rounded-full border-4 border-card bg-success text-success-foreground">
              <BadgeCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold tracking-tight">{profile.name}</h2>
            <p className="text-sm text-muted-foreground">{profile.occupation}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
              <Home className="h-3.5 w-3.5" /> Rental Confidence 94%
            </div>
          </div>
          <button className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent">
            <Pencil className="h-4 w-4" /> Edit
          </button>
        </div>
      </div>

      <Stagger className="mt-6 grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <StaggerItem key={f.label}>
            <div className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-accent/40">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </div>
                <div className="truncate text-sm font-semibold">{f.value}</div>
              </div>
              <Pencil className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </AppLayout>
  );
}
