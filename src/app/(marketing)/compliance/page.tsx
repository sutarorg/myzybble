import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compliance \u2014 zybble",
  description: "How zybble approaches data protection, marketing consent and platform compliance.",
};

import LegalPage from "@/views/legal/LegalPage";

export default function Page() {
  return <LegalPage slug="compliance" />;
}
