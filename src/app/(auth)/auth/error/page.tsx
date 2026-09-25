import type { Metadata } from "next";
import AuthError from "./AuthError";

export const metadata: Metadata = {
  title: "Authentication error — zybble",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return <AuthError reason={reason} />;
}
