import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "zybble for sales teams",
  description: "Fill pipeline with verified local business contacts \u2014 emails, direct dials and CSV export for your CRM.",
};

import PersonaPage from "@/views/PersonaPage";

export default function Page() {
  return <PersonaPage slug="sales-teams" />;
}
