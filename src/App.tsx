import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet, useLocation, Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Landing from "./pages/Landing";
import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";
import FeaturesPage from "./pages/FeaturesPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import PricingPage from "./pages/PricingPage";
import Changelog from "./pages/Changelog";
import Roadmap from "./pages/Roadmap";
import UseCasesPage from "./pages/UseCasesPage";
import PersonaPage from "./pages/PersonaPage";
import Company from "./pages/Company";
import Careers from "./pages/Careers";
import Contact from "./pages/Contact";
import BlogIndex from "./pages/blog/BlogIndex";
import BlogPost from "./pages/blog/BlogPost";
import LegalPage from "./pages/legal/LegalPage";
import { ArrowLeft } from "lucide-react";

/* scroll to top on route change / smooth-scroll to hash targets */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const t = setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return () => clearTimeout(t);
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);
  return null;
}

function MarketingLayout() {
  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
}

function NotFound() {
  useEffect(() => {
    document.title = "Page not found — zybble";
  }, []);
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-5 pt-28 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-ink/40">error 404</p>
      <h1 className="mt-4 font-display text-6xl font-bold tracking-tight sm:text-8xl">
        Off the <span className="bg-lime px-2 -rotate-1 inline-block rounded-md">map</span>.
      </h1>
      <p className="mt-5 max-w-md text-lg text-ink/60">
        This route doesn't exist — but 12M+ businesses still do.
      </p>
      <Link
        to="/"
        className="group mt-9 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 font-semibold text-paper transition-all hover:bg-ink-3"
      >
        <ArrowLeft className="h-4.5 w-4.5 transition-transform group-hover:-translate-x-1" />
        Back to the map
      </Link>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        {/* auth — standalone split-screen, no chrome */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />

        {/* marketing chrome */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/use-cases" element={<UseCasesPage />} />
          <Route path="/agencies" element={<PersonaPage slug="agencies" />} />
          <Route path="/sales-teams" element={<PersonaPage slug="sales-teams" />} />
          <Route path="/local-services" element={<PersonaPage slug="local-services" />} />
          <Route path="/recruiters" element={<PersonaPage slug="recruiters" />} />
          <Route path="/company" element={<Company />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/privacy" element={<LegalPage slug="privacy" />} />
          <Route path="/terms" element={<LegalPage slug="terms" />} />
          <Route path="/dpa" element={<LegalPage slug="dpa" />} />
          <Route path="/compliance" element={<LegalPage slug="compliance" />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
