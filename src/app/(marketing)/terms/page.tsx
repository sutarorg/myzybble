import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service \u2014 zybble",
  description: "The terms that govern your use of the zybble platform, subscriptions and data.",
};

import LegalPage from "@/views/legal/LegalPage";

export default function Page() {
  return <LegalPage slug="terms" />;
}
