import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy \u2014 zybble",
  description: "How zybble collects, uses, stores and deletes personal and business data.",
};

import LegalPage from "@/views/legal/LegalPage";

export default function Page() {
  return <LegalPage slug="privacy" />;
}
