export type LegalBlock = { p?: string; list?: string[] };

export interface LegalDoc {
  slug: string;
  title: string;
  updated: string;
  intro: string;
  note?: string;
  sections: { h: string; body: LegalBlock[] }[];
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    updated: "February 1, 2026",
    intro:
      "This policy explains what zybble inc. (\"zybble\", \"we\", \"us\") collects when you use the zybble platform and website, why we collect it, and the rights you have over it.",
    sections: [
      {
        h: "Who we are and scope",
        body: [
          {
            p: "zybble inc., registered in Delaware, USA, is the data controller for the personal data of our customers and website visitors, and a data processor for the campaign and lead data our customers upload or generate. This policy covers the zybble web app, marketing site, APIs, and support channels.",
          },
        ],
      },
      {
        h: "Data we collect",
        body: [
          { p: "We collect the minimum required to run the service:" },
          {
            list: [
              "Account data: name, work email, password hash, company, billing details (processed by our payment provider, never stored on our servers).",
              "Usage data: searches run, exports made, feature usage, device/browser metadata, and IP-based region — used for security, analytics, and product improvement.",
              "Lead data you process: business contact records (business name, category, address, business email, business phone) retrieved or enriched at your request, plus any data you upload.",
              "Communications: messages you send us, support tickets, and campaign feedback.",
            ],
          },
        ],
      },
      {
        h: "Where lead data comes from",
        body: [
          {
            p: "Business records in zybble originate from publicly accessible business listings (published by the businesses themselves), licensed B2B data providers, and publicly available web sources. Every record is re-verified on a rolling 30-day cycle. We never source data from behind logins, paywalled databases, or private accounts.",
          },
        ],
      },
      {
        h: "How we use data",
        body: [
          {
            list: [
              "Provide, maintain, and secure the zybble service.",
              "Process and verify the lead records you request.",
              "Send product updates, invoices, and (opt-in) marketing communications.",
              "Detect abuse, prevent fraud, and enforce our Terms.",
              "Improve verification accuracy using aggregated, de-identified results.",
            ],
          },
          { p: "We do not sell customer account data. Lead-record databases are licensed to customers under our Terms; customers act as independent controllers for their own outreach." },
        ],
      },
      {
        h: "Cookies",
        body: [
          {
            p: "We use strictly necessary cookies (session, security), preference cookies (your UI settings), and privacy-respecting analytics. No third-party advertising trackers run on the app. You can control non-essential cookies via the consent banner and your browser settings without losing core functionality.",
          },
        ],
      },
      {
        h: "Sharing and sub-processors",
        body: [
          {
            p: "We share data only with service providers that process it on our behalf under data-processing agreements: cloud hosting (US/EU regions), payment processing, email delivery, and abuse-prevention tooling. A current list of sub-processors is maintained in our DPA. We never sell personal data, and we disclose data to authorities only where legally required and, where lawful, with prior notice to you.",
          },
        ],
      },
      {
        h: "Retention",
        body: [
          {
            p: "Account data is kept while your account is active and deleted within 30 days of account closure (billing records are retained as required by tax law). Exported lead records stored in your workspace are deleted on request. Hard-bounced contacts are suppressed permanently to protect future deliverability.",
          },
        ],
      },
      {
        h: "Security",
        body: [
          {
            p: "All data is encrypted in transit (TLS 1.2+) and at rest (AES-256). Access is least-privilege, logged, and MFA-enforced. We run continuous vulnerability scanning and annual third-party penetration tests. Security incidents affecting your data are disclosed without undue delay.",
          },
        ],
      },
      {
        h: "Your rights",
        body: [
          { p: "Depending on your jurisdiction (GDPR, UK GDPR, CCPA/CPRA and similar), you may have the right to:" },
          {
            list: [
              "Access, correct, or delete your personal data.",
              "Export your data in a portable format.",
              "Object to or restrict certain processing, including direct marketing.",
              "Withdraw consent where processing is based on consent.",
              "Lodge a complaint with your local supervisory authority.",
            ],
          },
          { p: "Exercise any right by emailing privacy@zybble.io — we respond within 30 days, and identity verification applies where legally required." },
        ],
      },
      {
        h: "International transfers",
        body: [
          {
            p: "Where data moves outside the EEA/UK, we rely on Standard Contractual Clauses and the EU-US and UK-US Data Privacy Frameworks as applicable. Details and copies of transfer safeguards are available on request at dpa@zybble.io.",
          },
        ],
      },
      {
        h: "Changes & contact",
        body: [
          {
            p: "Material changes to this policy are announced by email and in-app notice at least 14 days before taking effect. Questions: privacy@zybble.io · zybble inc., 800 Congress Ave, Austin, TX 78701, USA.",
          },
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Service",
    updated: "February 1, 2026",
    intro:
      "These terms govern your use of the zybble platform. By creating an account or using zybble, you agree to them. The short version: use the data responsibly, pay for what you use, and we'll run a fast, honest service.",
    sections: [
      {
        h: "1. The service",
        body: [
          {
            p: "zybble provides lead discovery, enrichment, verification, and outreach tooling based on public business listings and licensed B2B data, including CSV export, the AI Assistant, and Campaigns. We may improve or modify features over time; we won't materially reduce the core functionality of a paid plan mid-term.",
          },
        ],
      },
      {
        h: "2. Accounts & eligibility",
        body: [
          {
            list: [
              "You must be 18+ and able to form a binding contract on behalf of your organization.",
              "Account credentials are personal — you're responsible for all activity under your account.",
              "One free trial per person/organization; abuse (multi-accounting, card cycling) voids the trial.",
            ],
          },
        ],
      },
      {
        h: "3. Plans, credits & billing",
        body: [
          {
            p: "Paid plans are billed monthly in advance. A lead credit is consumed when a unique business record is enriched for your workspace. Duplicates are never charged twice; records that hard-bounce within the campaign window are automatically re-credited. Unused credits do not roll over. You may upgrade, downgrade, or cancel at any time — changes apply to the next billing cycle and we don't refund partial months except where required by law.",
          },
        ],
      },
      {
        h: "4. Acceptable use",
        body: [
          { p: "You may not use zybble: " },
          {
            list: [
              "For illegal, deceptive, or harassing outreach, including spam as defined by CAN-SPAM, CASL, or applicable anti-spam law.",
              "To contact individuals about non-business matters, or to target sensitive categories (health, minors, political affiliation).",
              "To resell raw lead databases, create a competing data product, or share access outside your organization.",
              "To probe, scan, or disrupt our infrastructure, or access the service via automated means outside the provided API.",
              "To process data you have no lawful basis to use.",
            ],
          },
          { p: "Violations may lead to suspension or termination. We act on valid complaints from recipients and regulators." },
        ],
      },
      {
        h: "5. Your responsibilities for outreach",
        body: [
          {
            p: "You are the controller of your campaigns. You must have a lawful basis for every contact, include accurate sender identification and a physical address in commercial email, honor opt-outs immediately, and comply with all applicable marketing and privacy laws. zybble provides suppression tools — you must use them.",
          },
        ],
      },
      {
        h: "6. Intellectual property",
        body: [
          {
            p: "zybble, the crawler, verification pipeline, AI models, and the platform itself remain our property. Your uploads remain yours. Exported lead records are licensed to you for use in your own business outreach, not for redistribution. Feedback you give us may be used to improve the product without obligation.",
          },
        ],
      },
      {
        h: "7. AI features",
        body: [
          {
            p: "The AI Assistant generates outreach content from business data. You are responsible for reviewing content before sending, ensuring its accuracy, and complying with laws on automated content in your jurisdiction. We don't use your campaign content to train models shared across customers without consent.",
          },
        ],
      },
      {
        h: "8. Warranties & liability",
        body: [
          {
            p: "The service is provided \"as is\" with commercially reasonable skill and care. We warrant that verified email records will meet a minimum 95% deliverability rate at export; failure triggers automatic re-credit. To the maximum extent permitted by law, our aggregate liability is limited to the fees you paid in the 12 months preceding the claim. Nothing limits liability for fraud, gross negligence, or willful misconduct.",
          },
        ],
      },
      {
        h: "9. Term & termination",
        body: [
          {
            p: "These terms apply while you use zybble. You can cancel anytime and export your data for 30 days after closure. We may suspend accounts for non-payment (after notice), security risk, or acceptable-use violations. Sections on IP, liability, and disputes survive termination.",
          },
        ],
      },
      {
        h: "10. Governing law & disputes",
        body: [
          {
            p: "These terms are governed by the laws of Delaware, USA, excluding conflict-of-law rules. Disputes will be resolved in the state or federal courts of Delaware, unless mandatory local law gives you another forum. EU/UK consumers keep their statutory protections.",
          },
        ],
      },
    ],
  },
  {
    slug: "dpa",
    title: "Data Processing Addendum",
    updated: "February 1, 2026",
    intro:
      "This DPA forms part of the zybble Terms where zybble processes personal data on your behalf. It reflects Article 28 GDPR requirements and covers transfers under Chapter V GDPR. Executed automatically upon account creation where applicable.",
    note: "Annex I (processing details) and Annex II (security measures) are summarized inline below.",
    sections: [
      {
        h: "1. Roles & subject matter",
        body: [
          {
            p: "You (the customer) are the controller; zybble is the processor for lead records, campaign content, and contact lists you process through the platform. Processing covers discovery, enrichment, verification, storage, and delivery of business contact records, for the duration of your subscription plus the retention periods in Annex I.",
          },
        ],
      },
      {
        h: "2. Processing details (Annex I)",
        body: [
          {
            list: [
              "Data subjects: business contact persons contained in public business listings and licensed B2B sources; your end-users.",
              "Data categories: business name, role/category, business email, business phone, address, ratings/public review metadata, and records you upload.",
              "Special categories: none. zybble must not be used to process special-category data.",
              "Operations: collection from public/licensed sources, verification, structuring, storage, retrieval, export, erasure.",
              "Retention: active records for the subscription term; deletion within 30 days of account closure or upon erasure request.",
            ],
          },
        ],
      },
      {
        h: "3. Our obligations",
        body: [
          {
            list: [
              "Process personal data only on your documented instructions, including this DPA and your in-product actions.",
              "Ensure confidentiality undertakings for all personnel with access.",
              "Maintain the technical and organizational measures in Annex II.",
              "Assist you with data-subject requests, DPIAs, and consultations with supervisory authorities.",
              "Notify you of personal-data breaches without undue delay (target: within 72 hours of confirmation).",
              "Delete or return data at the end of the engagement, at your choice, subject to legal retention duties.",
              "Make available information necessary to demonstrate compliance and allow audits as described below.",
            ],
          },
        ],
      },
      {
        h: "4. Sub-processors",
        body: [
          {
            p: "You authorize the sub-processors listed below (current list at zybble.io/legal/sub-processors). We give 14 days' notice of new sub-processors; you may object on reasonable data-protection grounds, and we'll work toward a resolution or permit termination of the affected service.",
          },
          {
            list: [
              "Cloud infrastructure & storage — AWS (us-east-1, eu-central-1).",
              "Payment processing — Stripe, Inc. (controller for billing data).",
              "Transactional email delivery — Resend, Inc.",
              "Abuse & security monitoring — Cloudflare, Inc.",
              "Support tooling — Plain, Inc. (tickets only, no lead records).",
            ],
          },
        ],
      },
      {
        h: "5. International transfers",
        body: [
          {
            p: "Transfers of EEA/UK personal data to third countries are covered by the 2021 EU Standard Contractual Clauses (Module 2) and the UK Addendum, with supplementary measures including encryption in transit/at rest, pseudonymization where feasible, and contractual government-access protections. Where available, we rely on the EU-US Data Privacy Framework for participating US providers.",
          },
        ],
      },
      {
        h: "6. Security measures (Annex II)",
        body: [
          {
            list: [
              "Encryption: TLS 1.2+ in transit; AES-256 at rest; envelope encryption for stored lead archives.",
              "Access control: least-privilege RBAC, mandatory MFA, quarterly access reviews, full audit logging.",
              "Application security: code review, dependency scanning, annual third-party penetration testing.",
              "Operations: tested backups (encrypted, 35-day retention), documented incident-response plan, security training for all staff.",
              "Vendor management: security review and DPAs for all sub-processors; annual reassessment.",
            ],
          },
        ],
      },
      {
        h: "7. Audits & liability",
        body: [
          {
            p: "We satisfy audit requests through our security documentation, penetration-test summaries, and compliance reports. On-site or questionnaire-based audits are available once per 12-month period on 30 days' notice unless a breach is suspected. Liability under this DPA follows the caps and exclusions in the Terms.",
          },
        ],
      },
      {
        h: "8. Contact & execution",
        body: [
          {
            p: "Data-protection contact: dpa@zybble.io. This DPA is effective when you accept the Terms and remains in force while zybble processes personal data for you. A countersigned PDF copy is available on request.",
          },
        ],
      },
    ],
  },
  {
    slug: "compliance",
    title: "Compliance Center",
    updated: "February 1, 2026",
    intro:
      "How zybble keeps lead generation lawful and deliverable by default: the regulations we build for, the product mechanics that enforce them, and your part of the deal.",
    sections: [
      {
        h: "GDPR & UK GDPR",
        body: [
          {
            p: "zybble supports B2B outreach under legitimate interest (Art. 6(1)(f)). We provide: data-proportionate records (business contact data only), rolling 30-day re-verification for accuracy (Art. 5), instant global suppression lists, DPA + SCCs for transfers, and data-subject request assistance. You remain the controller of your campaigns; we give you the mechanics to act like one.",
          },
        ],
      },
      {
        h: "CAN-SPAM, CCPA & CASL",
        body: [
          {
            list: [
              "CAN-SPAM (US): sequence templates include sender identity, physical address, and one-click unsubscribe; unsubscribes process within seconds, globally.",
              "CCPA/CPRA (California): access, deletion and opt-out of sale honored via privacy@zybble.io; we do not sell personal information.",
              "CASL (Canada): implied-consent flags and conspicuous-publication sourcing records are attached to Canadian records so you can document your basis before sending.",
            ],
          },
        ],
      },
      {
        h: "Deliverability as compliance",
        body: [
          {
            p: "Mailbox providers are the practical regulators. Verified-at-export data (98.2% average), automatic hard-bounce refunds, human-like send pacing, and enforced SPF/DKIM/DMARC checks keep complaint and bounce rates inside provider thresholds. Campaigns that drift above 0.1% complaint rate are paused automatically — for your domain's own protection.",
          },
        ],
      },
      {
        h: "Data sourcing ethics",
        body: [
          {
            list: [
              "Public business listings only — never behind logins, paywalls, or technical barriers.",
              "Licensed B2B providers under contract with onward-use rights.",
              "Respectful crawl rates; robots directives honored on third-party sites.",
              "Sensitive-category exclusion by default (health-diagnosis markers, minors, political/religious signals).",
              "Suppression is permanent and global across all zybble customers' exports.",
            ],
          },
        ],
      },
      {
        h: "Security certifications & posture",
        body: [
          {
            list: [
              "SOC 2 Type II audit in progress (completion target: Q3 2026); report available under NDA.",
              "Annual third-party penetration testing; summaries available to customers.",
              "Encryption everywhere: TLS 1.2+ in transit, AES-256 at rest.",
              "EU and US data-region options for lead archives.",
            ],
          },
        ],
      },
      {
        h: "Your responsibilities",
        body: [
          {
            p: "Compliance is shared. You must document your lawful basis (we provide LIA templates), keep targeting role-relevant, include accurate identity and address in every email, honor opt-outs, and follow the laws of the jurisdictions you email into — not just the one you sit in. Our compliance team reviews edge cases daily: compliance@zybble.io.",
          },
        ],
      },
    ],
  },
];

export function getLegal(slug: string) {
  return LEGAL_DOCS.find((d) => d.slug === slug) ?? LEGAL_DOCS[0];
}
