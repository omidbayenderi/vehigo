export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between lg:mb-10">
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
            <span className="h-px w-5 bg-brand/60" aria-hidden="true" />
            {eyebrow}
          </span>
        ) : null}
        <h1 className="text-balance font-serif text-3xl font-semibold tracking-[-0.035em] text-ink sm:text-4xl lg:text-[2.65rem] lg:leading-[1.05]">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-faint sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
