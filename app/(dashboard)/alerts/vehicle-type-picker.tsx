"use client";

import { Bus, Car, CarFront, CircleHelp, Construction, Container, Package, Truck, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const VEHICLE_TYPES: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "", label: "Farketmez", icon: CircleHelp },
  { value: "car", label: "Otomobil", icon: Car },
  { value: "van", label: "Hafif ticari", icon: CarFront },
  { value: "truck", label: "Kamyon", icon: Truck },
  { value: "trailer", label: "Dorse", icon: Container },
  { value: "construction", label: "İş makinesi", icon: Construction },
  { value: "spare_part", label: "Yedek parça", icon: Wrench },
  { value: "bus", label: "Otobüs", icon: Bus },
  { value: "other", label: "Diğer", icon: Package },
];

export default function VehicleTypePicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <span className="mb-1 block text-sm text-ink-soft">Araç tipi</span>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {VEHICLE_TYPES.map(({ value: optionValue, label, icon: Icon }) => {
          const selected = value === optionValue;
          return (
            <button
              key={optionValue || "any"}
              type="button"
              onClick={() => onChange(optionValue)}
              aria-pressed={selected}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs transition-colors ${
                selected
                  ? "border-brand bg-brand-wash text-brand-ink"
                  : "border-line bg-surface text-ink-soft hover:border-brand/40 hover:bg-surface-sunken"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-center leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
