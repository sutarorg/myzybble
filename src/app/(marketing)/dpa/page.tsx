import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Processing Addendum \u2014 zybble",
  description: "The zybble data processing addendum, including sub-processors and retention terms.",
};

import LegalPage from "@/views/legal/LegalPage";

export default function Page() {
  return <LegalPage slug="dpa" />;
}
