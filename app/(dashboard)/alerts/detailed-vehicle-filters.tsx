type Values = Record<string, string | number | null | undefined>;

export default function DetailedVehicleFilters({ values = {} }: { values?: Values }) {
  return (
    <details className="mt-4 rounded-lg border border-line-soft bg-surface-sunken/40 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-brand">Ayrıntılı araç filtreleri</summary>
      <p className="mt-2 text-xs text-ink-faint">İlanda bilgi açıkça varsa kesin filtre uygulanır; kaynak bu bilgiyi vermiyorsa ilan doğrulama için listede tutulur.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Select label="Yakıt" name="fuel_type" value={values.fuel_type} options={[["", "Farketmez"], ["gasoline", "Benzin"], ["diesel", "Dizel"], ["electric", "Elektrik"], ["hybrid", "Hibrit / PHEV"], ["lpg", "LPG"], ["hydrogen", "Hidrojen"]]} />
        <Select label="Şanzıman" name="transmission" value={values.transmission} options={[["", "Farketmez"], ["automatic", "Otomatik"], ["manual", "Manuel"], ["semi_automatic", "Yarı otomatik"]]} />
        <Select label="Kasa tipi" name="body_type" value={values.body_type} options={[["", "Farketmez"], ["sedan", "Sedan"], ["suv", "SUV"], ["station_wagon", "Station wagon / Kombi"], ["hatchback", "Hatchback"], ["coupe", "Coupe"], ["convertible", "Cabrio"], ["pickup", "Pickup"], ["van", "Van"]]} />
        <Select label="Çekiş" name="drive_type" value={values.drive_type} options={[["", "Farketmez"], ["fwd", "Önden çekiş"], ["rwd", "Arkadan itiş"], ["awd", "4x4 / AWD"]]} />
        <Select label="Satıcı tipi" name="seller_type" value={values.seller_type} options={[["", "Farketmez"], ["private", "Bireysel"], ["dealer", "Galeri / Bayi"]]} />
        <Field label="Emisyon sınıfı" name="emission_class" value={values.emission_class} placeholder="Euro 6" />
        <Field label="Min güç (HP/PS)" name="min_power_hp" type="number" value={values.min_power_hp} />
        <Field label="Max güç (HP/PS)" name="max_power_hp" type="number" value={values.max_power_hp} />
        <Field label="Min motor (cc)" name="min_engine_cc" type="number" value={values.min_engine_cc} />
        <Field label="Max motor (cc)" name="max_engine_cc" type="number" value={values.max_engine_cc} />
        <Field label="Min kapı" name="min_doors" type="number" value={values.min_doors} />
        <Field label="Max kapı" name="max_doors" type="number" value={values.max_doors} />
        <Field label="Dış renk" name="exterior_color" value={values.exterior_color} placeholder="Siyah / Black" />
      </div>
    </details>
  );
}

export function detailValuesFromKeywords(keywords: string[]): Values {
  const values: Values = {};
  for (const keyword of keywords) {
    if (!keyword.startsWith("__vehigo_filter:")) continue;
    const [key, ...rest] = keyword.slice("__vehigo_filter:".length).split(":");
    if (key && rest.length) values[key] = rest.join(":");
  }
  return values;
}

const inputClass = "min-h-11 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
function Field({ label, name, type = "text", value, placeholder }: { label: string; name: string; type?: string; value?: string | number | null; placeholder?: string }) {
  return <label className="text-sm"><span className="mb-1 block text-ink-soft">{label}</span><input className={inputClass} name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} /></label>;
}
function Select({ label, name, value, options }: { label: string; name: string; value?: string | number | null; options: string[][] }) {
  return <label className="text-sm"><span className="mb-1 block text-ink-soft">{label}</span><select className={inputClass} name={name} defaultValue={value ?? ""}>{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>;
}
