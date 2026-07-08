import type { Database } from "@/lib/supabase/types";

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
type Lead = Database["public"]["Tables"]["leads"]["Row"];

export type MatchReasoning = {
  criterion: string;
  matched: boolean;
  detail: string;
}[];

export type MatchResult = {
  score: number;
  reasoning: MatchReasoning;
};

/**
 * Kural tabanlı eşleştirme skoru (0-100). Her kriter ağırlıklandırılır;
 * eksik veri kriteri es geçer (ne artı ne eksi puan).
 */
export function scoreMatch(lead: Lead, vehicle: Vehicle): MatchResult {
  const reasoning: MatchReasoning = [];
  let earned = 0;
  let possible = 0;

  const addCriterion = (
    weight: number,
    applicable: boolean,
    matched: boolean,
    label: string,
    detail: string,
  ) => {
    if (!applicable) return;
    possible += weight;
    if (matched) earned += weight;
    reasoning.push({ criterion: label, matched, detail });
  };

  addCriterion(
    30,
    !!lead.desired_vehicle_type && !!vehicle.vehicle_type,
    lead.desired_vehicle_type === vehicle.vehicle_type,
    "vehicle_type",
    `istenen: ${lead.desired_vehicle_type ?? "-"}, araç: ${vehicle.vehicle_type ?? "-"}`,
  );

  const budgetMin = lead.budget_min ?? undefined;
  const budgetMax = lead.budget_max ?? undefined;
  addCriterion(
    30,
    (budgetMin !== undefined || budgetMax !== undefined) && vehicle.price !== null,
    (budgetMin === undefined || vehicle.price! >= budgetMin) &&
      (budgetMax === undefined || vehicle.price! <= budgetMax),
    "budget",
    `bütçe: ${budgetMin ?? "?"}-${budgetMax ?? "?"} ${lead.budget_currency}, fiyat: ${vehicle.price ?? "-"} ${vehicle.currency}`,
  );

  addCriterion(
    15,
    vehicle.availability_status !== null,
    vehicle.availability_status === "available",
    "availability",
    `durum: ${vehicle.availability_status ?? "-"}`,
  );

  addCriterion(
    15,
    vehicle.condition !== null,
    vehicle.condition === "new" || vehicle.condition === "used_excellent" || vehicle.condition === "used_good",
    "condition",
    `durum: ${vehicle.condition ?? "-"}`,
  );

  addCriterion(
    10,
    vehicle.year !== null,
    vehicle.year !== null && vehicle.year >= new Date().getFullYear() - 10,
    "year",
    `yıl: ${vehicle.year ?? "-"}`,
  );

  const score = possible === 0 ? 0 : Math.round((earned / possible) * 100);
  return { score, reasoning };
}

export function rankVehiclesForLead(
  lead: Lead,
  vehicles: Vehicle[],
): (MatchResult & { vehicle: Vehicle })[] {
  return vehicles
    .filter((v) => v.availability_status === "available")
    .map((vehicle) => ({ vehicle, ...scoreMatch(lead, vehicle) }))
    .sort((a, b) => b.score - a.score);
}
