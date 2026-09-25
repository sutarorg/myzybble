import Hero from "../components/Hero";
import LogoMarquee from "../components/LogoMarquee";
import Features from "../components/Features";
import HowItWorks from "../components/HowItWorks";
import UseCases from "../components/UseCases";
import Testimonials from "../components/Testimonials";
import Pricing from "../components/Pricing";
import FAQ from "../components/FAQ";
import { CTA } from "../components/Footer";
import { usePageMeta } from "../components/PageShell";

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
