import type { Metadata } from "next";
import SignIn from "@/views/auth/SignIn";

export const metadata: Metadata = {
  title: "Sign in — zybble",
  description: "Sign in to zybble to keep generating verified Google Maps leads.",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <SignIn next={next} />;
}
