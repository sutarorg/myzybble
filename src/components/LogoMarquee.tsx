const BRANDS = [
  { name: "Northbeam", prefix: "▲" },
  { name: "coldcraft", prefix: "✶" },
  { name: "PIPEFRAME", prefix: "◼" },
  { name: "LocalLift", prefix: "◉" },
  { name: "outboundly", prefix: "↗" },
  { name: "BrightFunnel", prefix: "◆" },
  { name: "Territory", prefix: "✦" },
  { name: "Leadforge", prefix: "⬡" },
];

export default function LogoMarquee() {
  const row = [...BRANDS, ...BRANDS];
  return (
    <section className="relative mt-20 border-y border-ink/10 bg-cream/60 py-8 lg:mt-24">
      <div className="mx-auto max-w-6xl px-5">
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-ink/45">
          Powering outbound teams at 2,300+ companies
        </p>
      </div>
      <div className="marquee relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="marquee-track flex w-max items-center gap-14 pr-14" style={{ ["--marquee-speed" as string]: "36s" }}>
          {row.map((b, i) => (
            <span
              key={i}
              aria-hidden={i >= BRANDS.length}
              className="flex items-center gap-2 whitespace-nowrap font-display text-xl font-semibold tracking-tight text-ink/35 transition-colors hover:text-ink"
            >
              <span className="text-base text-ink/25">{b.prefix}</span>
              {b.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
