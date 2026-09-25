import type { Metadata } from "next";
import SignUp from "@/views/auth/SignUp";

export const metadata: Metadata = {
  title: "Create your account — zybble",
  description:
    "Start free with zybble: 100 verified Google Maps leads — email & phone data, CSV export, AI Assistant and Campaigns included.",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <SignUp next={next} />;
}
