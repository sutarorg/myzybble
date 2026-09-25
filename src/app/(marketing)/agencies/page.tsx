import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "zybble for agencies",
  description: "Give every client a fresh, verified Google Maps lead list. Agencies use zybble to replace data vendors and manual prospecting.",
};

import PersonaPage from "@/views/PersonaPage";

export default function Page() {
  return <PersonaPage slug="agencies" />;
}
