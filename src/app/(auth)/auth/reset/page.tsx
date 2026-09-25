import type { Metadata } from "next";
import ResetPassword from "@/views/auth/ResetPassword";

export const metadata: Metadata = {
  title: "Choose a new password — zybble",
  robots: { index: false, follow: false },
};

/**
 * Requires an authenticated session, which `/auth/callback` establishes from the
 * emailed recovery link. Without one there is nothing to update, so we bounce to
 * the request flow.
 */
export default function Page() {
  return <ResetPassword />;
}
