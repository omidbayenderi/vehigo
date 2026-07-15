import { canonicalCountryCode } from "@/lib/normalization/normalize-listing";

export const REGION_PRESETS = {
  eu: ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"],
  eea: ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS"],
  schengen: ["AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "CH"],
  balkans: ["AL", "BA", "BG", "HR", "GR", "XK", "ME", "MK", "RO", "RS", "SI"],
} as const;

export type RegionPreset = keyof typeof REGION_PRESETS;

export const COUNTRY_OPTIONS = [
  ["DE", "Almanya"], ["NL", "Hollanda"], ["BE", "Belçika"], ["FR", "Fransa"],
  ["IT", "İtalya"], ["ES", "İspanya"], ["AT", "Avusturya"], ["PL", "Polonya"],
  ["PT", "Portekiz"], ["RO", "Romanya"], ["BG", "Bulgaristan"], ["CZ", "Çekya"],
  ["SE", "İsveç"], ["NO", "Norveç"], ["DK", "Danimarka"], ["FI", "Finlandiya"],
  ["GR", "Yunanistan"], ["IE", "İrlanda"], ["GB", "Birleşik Krallık"], ["CH", "İsviçre"],
  ["HR", "Hırvatistan"], ["HU", "Macaristan"], ["SK", "Slovakya"], ["SI", "Slovenya"],
  ["EE", "Estonya"], ["LV", "Letonya"], ["LT", "Litvanya"], ["LU", "Lüksemburg"],
  ["IS", "İzlanda"], ["LI", "Lihtenştayn"], ["RS", "Sırbistan"], ["BA", "Bosna-Hersek"],
  ["ME", "Karadağ"], ["MK", "Kuzey Makedonya"], ["AL", "Arnavutluk"], ["XK", "Kosova"],
] as const;

const COUNTRY_NAME_BY_CODE = Object.fromEntries(COUNTRY_OPTIONS);

// Search providers perform better when the location is written the way sellers
// write it in that market. UI labels stay Turkish; remote queries use native
// country names.
const COUNTRY_SEARCH_NAME_BY_CODE: Record<string, string> = {
  AL: "Shqipëri", AT: "Österreich", BA: "Bosna i Hercegovina", BE: "België Belgique",
  BG: "България", CH: "Schweiz Suisse Svizzera", CY: "Κύπρος", CZ: "Česko",
  DE: "Deutschland", DK: "Danmark", EE: "Eesti", ES: "España", FI: "Suomi",
  FR: "France", GB: "United Kingdom", GR: "Ελλάδα", HR: "Hrvatska", HU: "Magyarország",
  IE: "Ireland", IS: "Ísland", IT: "Italia", LI: "Liechtenstein", LT: "Lietuva",
  LU: "Lëtzebuerg Luxembourg", LV: "Latvija", ME: "Crna Gora", MK: "Северна Македонија",
  NL: "Nederland", NO: "Norge", PL: "Polska", PT: "Portugal", RO: "România",
  RS: "Srbija", SE: "Sverige", SI: "Slovenija", SK: "Slovensko", XK: "Kosovë",
};

export function resolveCountryCodes(input: {
  country_codes?: string[] | null;
  region_preset?: string | null;
  country?: string | null;
}) {
  const explicit = (input.country_codes ?? [])
    .map((code) => code.trim().toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code));
  const preset = input.region_preset && input.region_preset in REGION_PRESETS
    ? REGION_PRESETS[input.region_preset as RegionPreset]
    : [];
  const legacy = canonicalCountryCode(input.country);
  return [...new Set([...explicit, ...preset, ...(legacy ? [legacy] : [])])].sort();
}

export function geographySearchTerms(input: Parameters<typeof resolveCountryCodes>[0]) {
  return resolveCountryCodes(input).map((code) => COUNTRY_SEARCH_NAME_BY_CODE[code] ?? COUNTRY_NAME_BY_CODE[code] ?? code);
}

export function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371.0088;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
