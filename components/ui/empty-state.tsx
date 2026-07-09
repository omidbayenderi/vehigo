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
    <div className="flex flex-col items-center justify-center gap-2.5 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-sunken text-ink-faint">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {description ? <p className="max-w-xs text-xs text-ink-faint">{description}</p> : null}
    </div>
  );
}
