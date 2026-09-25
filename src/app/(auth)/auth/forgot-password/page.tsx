import type { Metadata } from "next";
import ForgotPassword from "@/views/auth/ForgotPassword";

export const metadata: Metadata = {
  title: "Reset password — zybble",
  description: "Reset your zybble password.",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <ForgotPassword mode={mode === "verify" ? "verify" : "reset"} />;
}
