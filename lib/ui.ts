export type PillTone = "neutral" | "brand" | "success" | "warning" | "danger";

const toneClasses: Record<PillTone, string> = {
  neutral: "bg-surface-sunken text-ink-soft",
  brand: "bg-brand-wash text-brand-ink",
  success: "bg-success-wash text-success",
  warning: "bg-warning-wash text-warning",
  danger: "bg-danger-wash text-danger",
};

export function pillClasses(tone: PillTone = "neutral") {
  return `inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`;
}

export const cardClass = "rounded-lg border border-line-soft bg-surface shadow-[0_1px_2px_rgba(23,24,43,0.04)]";
