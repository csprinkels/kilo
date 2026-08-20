"use client";

/** The page headline block every section shares: eyebrow · big value · label · one sentence · meta row. Tinted 8% by `tone`. */
export default function Hero({ eyebrow, value, label, sentence, meta, tone, icon, right, className = "" }: {
  eyebrow?: React.ReactNode; value: React.ReactNode; label?: React.ReactNode; sentence?: React.ReactNode; meta?: React.ReactNode;
  tone?: string; icon?: React.ReactNode; right?: React.ReactNode; className?: string;
}) {
  return (
    <section className={`card-hero mt-s4 ${className}`} style={tone ? ({ ["--cond" as string]: tone } as React.CSSProperties) : undefined}>
      {(eyebrow || right) && (
        <div className="flex items-start justify-between gap-s3">
          <p className="text-micro font-semibold uppercase tracking-[0.12em] text-muted num">{eyebrow}</p>
          {right && <div className="shrink-0 text-right text-body num">{right}</div>}
        </div>
      )}
      <div className="mt-s3 flex min-w-0 items-center gap-s3">
        {icon}
        <span className="display text-hero num leading-none">{value}</span>
      </div>
      {label && <p className="mt-s2 text-body font-medium">{label}</p>}
      {sentence && <p className="mt-s1 text-lead text-ink-2">{sentence}</p>}
      {meta && <p className="mt-s3 flex flex-wrap items-center gap-x-s4 gap-y-s1 text-label text-muted num">{meta}</p>}
    </section>
  );
}
