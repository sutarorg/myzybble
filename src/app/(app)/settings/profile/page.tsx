import { requireAuthContext } from "@/server/auth";
import { getProfile } from "@/server/services/settings";
import { Card } from "@/components/app/primitives";
import ProfileForm from "@/features/settings/ProfileForm";
import DangerZone from "@/features/settings/DangerZone";
import PasswordSection from "@/features/settings/PasswordSection";

export const metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  const ctx = await requireAuthContext();
  const profile = (await getProfile(ctx.user.id)) ?? ctx.profile;

  return (
    <div className="space-y-6">
      <ProfileForm
        email={ctx.user.email}
        fullName={profile.full_name}
        company={profile.company}
        timezone={profile.timezone}
        productEmailOptIn={profile.product_email_opt_in}
        marketingOptIn={profile.marketing_opt_in}
        dataRetentionDays={Number(profile.data_retention_days)}
      />

      <PasswordSection />

      <Card>
        <h2 className="font-display text-lg font-bold tracking-tight">Sessions</h2>
        <p className="mt-1 text-sm text-ink/60">
          Sessions are stored in httpOnly cookies and refreshed automatically. Signing out on this
          device ends only this session.
        </p>
      </Card>

      <DangerZone hasPendingRequest={Boolean(profile.deletion_requested_at)} />
    </div>
  );
}
