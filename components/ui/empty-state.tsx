import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line-soft bg-surface-sunken text-ink-faint shadow-sm">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {description ? <p className="max-w-xs text-xs text-ink-faint">{description}</p> : null}
    </div>
  );
}
