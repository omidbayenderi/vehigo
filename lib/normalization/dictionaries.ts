import type {
  BodyType,
  DriveType,
  FuelType,
  SellerType,
  TransmissionType,
} from "@/lib/domain/listings";
import type { VehicleCondition, VehicleType } from "@/lib/supabase/types";

export const BRAND_ALIASES: Record<string, string> = {
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
  "mercedes benz": "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  "mercedes-benz": "Mercedes-Benz",
  man: "MAN",
  daf: "DAF",
  bmw: "BMW",
  iveco: "Iveco",
  scania: "Scania",
  volvo: "Volvo",
  toyota: "Toyota",
  renault: "Renault",
  peugeot: "Peugeot",
  citroen: "Citroën",
  "citroën": "Citroën",
  skoda: "Škoda",
  "škoda": "Škoda",
};

export const COUNTRY_ALIASES: Record<string, string> = {
  germany: "DE",
  deutschland: "DE",
  almanya: "DE",
  netherlands: "NL",
  nederland: "NL",
  holland: "NL",
  hollanda: "NL",
  belgium: "BE",
  belgique: "BE",
  belgie: "BE",
  "belgië": "BE",
  belcika: "BE",
  "belçika": "BE",
  france: "FR",
  frankreich: "FR",
  fransa: "FR",
  italy: "IT",
  italia: "IT",
  italien: "IT",
  italya: "IT",
  spain: "ES",
  espana: "ES",
  "españa": "ES",
  spanien: "ES",
  ispanya: "ES",
  poland: "PL",
  polska: "PL",
  polen: "PL",
  polonya: "PL",
  austria: "AT",
  osterreich: "AT",
  "österreich": "AT",
  avusturya: "AT",
  switzerland: "CH",
  schweiz: "CH",
  suisse: "CH",
  isvicre: "CH",
  "isviçre": "CH",
};

export const FUEL_TERMS: Record<FuelType, string[]> = {
  gasoline: ["gasoline", "petrol", "benzin", "benzine", "essence", "benzina"],
  diesel: ["diesel", "tdi", "cdi", "hdi", "dci", "jtd"],
  electric: ["electric", "elektrisch", "electrique", "électrique", "elektrikli", "bev"],
  hybrid: ["hybrid", "hybride", "hibrit", "phev", "mhev"],
  lpg: ["lpg", "autogas", "gpl"],
  hydrogen: ["hydrogen", "wasserstoff", "hydrogene", "hydrogène", "hidrojen"],
  other: [],
};

export const TRANSMISSION_TERMS: Record<TransmissionType, string[]> = {
  automatic: ["automatic", "automatik", "automaat", "automatique", "otomatik", "dsg", "tiptronic"],
  manual: ["manual", "manuel", "schaltgetriebe", "handschakel", "handgeschakeld", "mecanique", "mécanique"],
  semi_automatic: ["semi automatic", "semi-automatic", "halbautomatik", "yarı otomatik"],
  other: [],
};

export const CONDITION_TERMS: Record<VehicleCondition, string[]> = {
  damaged: ["damaged", "accident", "accidente", "unfall", "schaden", "schade", "kazali", "kazalı", "hasarli", "hasarlı"],
  new: ["brand new", "new vehicle", "neuwagen", "nieuw", "sifir", "sıfır"],
  used_excellent: ["like new", "excellent condition", "topzustand", "zo goed als nieuw", "comme neuf"],
  used_good: ["used", "occasion", "gebraucht", "gebruikt", "tweedehands", "d'occasion"],
  used_fair: ["fair condition", "fahrbereit", "rijdbaar", "roulant"],
};

export const SELLER_TERMS: Record<Exclude<SellerType, "unknown">, string[]> = {
  private: ["private seller", "privatanbieter", "particulier", "particulare", "bireysel", "particulier aanbod"],
  dealer: ["dealer", "handler", "händler", "garage", "concessionnaire", "galeri", "gewerblich"],
};

export const DRIVE_TERMS: Record<Exclude<DriveType, "other">, string[]> = {
  fwd: ["fwd", "front wheel drive", "frontantrieb", "traction avant"],
  rwd: ["rwd", "rear wheel drive", "heckantrieb", "propulsion"],
  awd: ["awd", "all wheel drive", "allrad", "4x4", "4wd", "quattro"],
};

export const BODY_TERMS: Record<Exclude<BodyType, "other">, string[]> = {
  sedan: ["sedan", "saloon", "limousine"],
  suv: ["suv", "gelandewagen", "geländewagen", "crossover"],
  station_wagon: ["station wagon", "estate", "kombi", "break"],
  hatchback: ["hatchback", "hatch"],
  coupe: ["coupe", "coupé"],
  convertible: ["convertible", "cabrio", "cabriolet"],
  pickup: ["pickup", "pick-up"],
  van: ["van", "transporter", "bestelwagen", "camionnette"],
  tractor_unit: ["tractor unit", "sattelzugmaschine", "trekker", "çekici"],
  rigid_truck: ["rigid truck", "solo truck", "motorwagen", "kamyon"],
};

export const VEHICLE_TYPE_TERMS: Record<VehicleType, string[]> = {
  car: ["car", "passenger car", "personenwagen", "voiture", "automobile", "otomobil"],
  van: ["van", "transporter", "bestelwagen", "camionnette", "hafif ticari"],
  truck: ["truck", "lorry", "vrachtwagen", "camion", "lastwagen", "kamyon"],
  tractor_unit: ["tractor unit", "articulated truck", "semi truck", "sattelzugmaschine", "tracteur routier", "trekker", "çekici"],
  trailer: ["trailer", "semi trailer", "auflieger", "remorque", "dorse"],
  construction: ["excavator", "wheel loader", "construction machine", "baumaschine", "iş makinesi"],
  spare_part: ["spare parts", "truck parts", "ersatzteile", "yedek parça"],
  bus: ["bus", "coach", "reisebus", "otobüs"],
  other: [],
};
