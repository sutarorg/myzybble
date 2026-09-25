export interface Persona {
  slug: string;
  label: string;
  icon: "Building2" | "Users" | "Wrench" | "UserSearch";
  tagline: string;
  headline: string;
  sub: string;
  searches: string[];
  pains: { t: string; d: string }[];
  playbook: { t: string; d: string }[];
  metrics: { v: string; l: string }[];
  quote: { text: string; name: string; role: string };
}

export const PERSONAS: Persona[] = [
  {
    slug: "agencies",
    label: "Agencies",
    icon: "Building2",
    tagline: "For lead-gen, cold email & growth agencies",
    headline: "Fill client rosters on autopilot",
    sub: "Every client wants a different niche in a different city. zybble turns that chaos into a repeatable machine: fresh lists in minutes, white-label exports, and AI-written first touches that make your agency look huge.",
    searches: ["med spas · miami", "orthodontists · dallas", "boutique gyms · nyc", "roofers · denver"],
    pains: [
      { t: "List building eats your margin", d: "VAs and manual scraping burn hours per client — and the data still bounces. zybble outputs verified lists in minutes, so research budget becomes profit." },
      { t: "Every client needs a new niche", d: "Dentists in May, med spas in June. With 12M+ businesses indexed, a fresh niche is a search away, not a new vendor contract." },
      { t: "Generic openers kill reply rates", d: "Clients judge you on meetings booked. Review-aware AI icebreakers lift replies without your copywriters touching 5,000 rows." },
    ],
    playbook: [
      { t: "Pick a niche pack", d: "Start from 38 proven packs — dentists, med spas, roofers, gyms — or define your own niche + city combo." },
      { t: "Sweep the territory", d: "Chain cities into one run. zybble crawls every listing and attaches ratings, review counts, and hours." },
      { t: "Enrich & verify", d: "Emails and direct dials verified in real time. Bounced credits return automatically." },
      { t: "White-label & deliver", d: "Export branded CSVs per client, or launch the campaign yourself with AI sequences and proof-of-work reporting." },
    ],
    metrics: [
      { v: "38", l: "niche packs ready" },
      { v: "4 min", l: "avg to first list" },
      { v: "9.1%", l: "avg reply rate w/ AI" },
    ],
    quote: {
      text: "As a two-person agency, zybble is our entire list-building team. Clients think we have a research department.",
      name: "Sofia Marino",
      role: "Partner · Marino & Vale",
    },
  },
  {
    slug: "sales-teams",
    label: "Sales teams",
    icon: "Users",
    tagline: "For SDR, BDR & field sales teams selling to local business",
    headline: "Territory lists in minutes, not months",
    sub: "Stop fighting over the same stale CRM records. Carve territories by niche and geography, dedupe across every rep automatically, and put sequenced outreach in motion the same day.",
    searches: ["hvac · ohio valley", "auto dealers · texas", "clinics · socal", "logistics · atlanta"],
    pains: [
      { t: "Reps prospect in a dead CRM", d: "Reps burn calling hours on numbers that changed hands years ago. zybble verifies at export time, so dials connect." },
      { t: "Territory wars", d: "Duplicate protection runs across the whole team — two reps never pitch the same owner twice." },
      { t: "Quotas don't wait for research", d: "A territory that took an ops team a month now takes one rep an afternoon, follow-ups included." },
    ],
    playbook: [
      { t: "Carve the territory", d: "Define niches + regions per rep. Filter by rating, review count and category to match your ICP." },
      { t: "Enrich the whole patch", d: "Verified emails, mobiles vs. landlines, and owner names — confidence-scored per record." },
      { t: "Launch sequences", d: "AI writes the opener per business; follow-ups run automatically with reply pause." },
      { t: "Sync wins to CRM", d: "Push everything to HubSpot, Pipedrive or Salesforce with territory and owner fields intact." },
    ],
    metrics: [
      { v: "6.2×", l: "more meetings / rep" },
      { v: "2.1%", l: "avg bounce rate" },
      { v: "92%", l: "mobile match on owners" },
    ],
    quote: {
      text: "Pulled every roofer in Texas before lunch. My CRM has never been this full, and my reps have never been this calm.",
      name: "Josh Weber",
      role: "Sales Director · Summit Exteriors",
    },
  },
  {
    slug: "local-services",
    label: "Local services",
    icon: "Wrench",
    tagline: "For roofers, cleaners, landscapers & home-service pros",
    headline: "Win your city before competitors wake up",
    sub: "New businesses open near you every week — and your competitors will find them eventually. zybble watches your service area, flags new listings the week they appear, and drafts the first touch for you.",
    searches: ["new openings · phoenix", "restaurants · austin", "salons · denver", "property mgmt · tampa"],
    pains: [
      { t: "You hear about new businesses too late", d: "By the time a new café calls three contractors, the job's gone. New-listing alerts land in your inbox the week they open." },
      { t: "Marketing agencies cost a job a month", d: "A zybble plan costs less than one small job — and it runs every single week, not just when the agency remembers you." },
      { t: "You're a pro, not a copywriter", d: "The AI writes friendly, local-sounding outreach that references their actual business. You just answer the phone." },
    ],
    playbook: [
      { t: "Mark your service area", d: "Draw your coverage by city or radius. zybble watches it continuously, not once." },
      { t: "Get new-listing alerts", d: "The moment a matching business appears on the map, it's enriched and queued for you." },
      { t: "Send the first touch", d: "AI drafts a plain-spoken intro referencing their opening. Email, or call with the direct dial attached." },
      { t: "Track replies in one place", d: "Replies pause follow-ups instantly. You handle the conversation, zybble handles the chasing." },
    ],
    metrics: [
      { v: "48h", l: "first-mover window" },
      { v: "5×", l: "cheaper than an agency" },
      { v: "92%", l: "city coverage in 1 sweep" },
    ],
    quote: {
      text: "I'm a plumber, not a marketer. zybble found me 14 new commercial accounts in my first month — I just answered my phone.",
      name: "Ray Delgado",
      role: "Owner · Delgado Plumbing Co.",
    },
  },
  {
    slug: "recruiters",
    label: "Recruiters",
    icon: "UserSearch",
    tagline: "For staffing agencies & talent sourcers",
    headline: "Spot hiring before it's posted",
    sub: "Companies signal hiring long before the job ad: review velocity spikes, new locations open, teams expand. zybble surfaces those signals and connects you straight to the decision-maker.",
    searches: ["clinics expanding · ohio", "logistics · atlanta", "hospitality · vegas", "dental groups · florida"],
    pains: [
      { t: "Job boards mean you're already late", d: "When the ad is live, five agencies are already pitching. Growth signals get you in weeks earlier." },
      { t: "InMails vanish into the void", d: "Owner and ops-manager direct dials change the conversation — real phone numbers, line-type checked." },
      { t: "Geography is your edge", d: "Lock talent pools and client maps to specific regions and own them before national firms notice." },
    ],
    playbook: [
      { t: "Define growth signals", d: "Target businesses by category, review momentum, and multi-location expansion in your region." },
      { t: "Find the decision-maker", d: "Owners, GMs, and ops leads with direct emails and mobiles — not front-desk gatekeepers." },
      { t: "Open with context", d: "AI drafts outreach referencing their expansion or hiring signals, so you don't sound like a job board." },
      { t: "Build the pool", d: "Export territory-locked lists of growing companies and keep them refreshed on a rolling cycle." },
    ],
    metrics: [
      { v: "3.4×", l: "faster first convos" },
      { v: "71%", l: "owner match rate" },
      { v: "14 days", l: "earlier than job ads" },
    ],
    quote: {
      text: "zybble shows me which clinics are expanding before they post jobs. I'm having conversations two weeks ahead of every other agency.",
      name: "Hannah Kim",
      role: "Managing Director · Keystone Talent",
    },
  },
];

export function getPersona(slug: string) {
  return PERSONAS.find((p) => p.slug === slug) ?? PERSONAS[0];
}
