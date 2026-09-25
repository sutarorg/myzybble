import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "zybble for local services",
  description: "Find and contact the businesses around you. zybble turns Google Maps into a targeted outreach list.",
};

import PersonaPage from "@/views/PersonaPage";

export default function Page() {
  return <PersonaPage slug="local-services" />;
}
