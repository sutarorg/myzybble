"use client";

import Hero from "@/components/marketing/Hero";
import LogoMarquee from "@/components/marketing/LogoMarquee";
import Features from "@/components/marketing/Features";
import HowItWorks from "@/components/marketing/HowItWorks";
import UseCases from "@/components/marketing/UseCases";
import Testimonials from "@/components/marketing/Testimonials";
import Pricing from "@/components/marketing/Pricing";
import FAQ from "@/components/marketing/FAQ";
import { CTA } from "@/components/marketing/Footer";
import { usePageMeta } from "@/components/marketing/PageShell";

export default function Landing() {
  usePageMeta(
    "zybble — Turn Google Maps into verified leads",
    "zybble finds businesses on Google Maps, verifies their emails & phone numbers, and runs AI-powered outreach campaigns. Export clean CSVs from $19/mo.",
  );
  return (
    <main>
      <Hero />
      <LogoMarquee />
      <Features />
      <HowItWorks />
      <UseCases />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTA />
    </main>
  );
}
