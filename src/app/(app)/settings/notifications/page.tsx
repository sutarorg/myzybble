import { requireAuthContext } from "@/server/auth";
import { getNotificationPrefs } from "@/server/services/settings";
import { SectionTitle } from "@/components/app/primitives";
import NotificationPrefsForm from "@/features/settings/NotificationPrefsForm";

export const metadata = { title: "Notifications" };

export default async function NotificationSettingsPage() {
  const ctx = await requireAuthContext();
  const prefs = await getNotificationPrefs(ctx.user.id);

  return (
    <div className="space-y-6">
      <SectionTitle sub="Choose which events email you. Every send is checked against these settings server-side.">
        Notifications
      </SectionTitle>
      <NotificationPrefsForm initial={prefs} />
    </div>
  );
}
