import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "zybble for recruiters",
  description: "Source hiring companies by niche and city, with verified contact data for outreach.",
};

import PersonaPage from "@/views/PersonaPage";

export default function Page() {
  return <PersonaPage slug="recruiters" />;
}
