import { requireAuthContext } from "@/server/auth";
import SettingsNav from "@/features/settings/SettingsNav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuthContext();
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Settings</h1>
        <p className="mt-1 text-sm text-ink/55">
          Signed in as <span className="font-medium text-ink">{ctx.user.email}</span>
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <SettingsNav role={ctx.role} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
