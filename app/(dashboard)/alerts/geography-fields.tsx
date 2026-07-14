import { COUNTRY_OPTIONS } from "@/lib/search/geography";

export default function GeographyFields({
  countryCodes = [],
  regionPreset,
  centerLatitude,
  centerLongitude,
  radiusKm,
}: {
  countryCodes?: string[];
  regionPreset?: string | null;
  centerLatitude?: number | null;
  centerLongitude?: number | null;
  radiusKm?: number | null;
}) {
  return (
    <fieldset className="rounded-lg border border-line-soft p-4 md:col-span-3">
      <legend className="px-1 text-sm font-medium text-ink">Coğrafi kapsam</legend>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-ink-soft">Bölge hazır ayarı</span>
          <select name="region_preset" defaultValue={regionPreset ?? ""} className={inputClass}>
            <option value="">Özel ülke seçimi / tüm Avrupa</option>
            <option value="eu">Avrupa Birliği</option>
            <option value="eea">Avrupa Ekonomik Alanı</option>
            <option value="schengen">Schengen</option>
            <option value="balkans">Balkanlar</option>
          </select>
        </label>
        <details className="rounded-md border border-line bg-surface p-3">
          <summary className="cursor-pointer text-sm font-medium text-brand">Ülkeleri tek tek seç</summary>
          <div className="mt-3 grid max-h-48 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {COUNTRY_OPTIONS.map(([code, label]) => (
              <label key={code} className="inline-flex min-h-11 items-center gap-2 text-xs text-ink">
                <input type="checkbox" name="country_codes" value={code} defaultChecked={countryCodes.includes(code)} />
                {label} <span className="text-ink-faint">{code}</span>
              </label>
            ))}
          </div>
        </details>
      </div>
      <details className="mt-3 rounded-md bg-surface-sunken/50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-brand">Merkez ve yarıçapla sınırla</summary>
        <p className="mt-2 text-xs text-ink-faint">Üç alan birlikte girilir. Strict mod koordinatı olmayan ilanı eler; discovery mod doğrulama etiketiyle tutar.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Merkez enlem" name="center_latitude" value={centerLatitude} step="any" />
          <Field label="Merkez boylam" name="center_longitude" value={centerLongitude} step="any" />
          <Field label="Yarıçap (km)" name="radius_km" value={radiusKm} step="1" />
        </div>
      </details>
    </fieldset>
  );
}

const inputClass = "min-h-11 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
function Field({ label, name, value, step }: { label: string; name: string; value?: number | null; step: string }) {
  return <label className="text-sm"><span className="mb-1 block text-ink-soft">{label}</span><input className={inputClass} type="number" step={step} name={name} defaultValue={value ?? ""} /></label>;
}
