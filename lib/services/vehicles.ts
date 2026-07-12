import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, VehicleType, AvailabilityStatus } from "@/lib/supabase/types";
import { vehicleSchema } from "@/lib/validation/schemas";
import { partialUpdateFields } from "@/lib/utils";

type Client = SupabaseClient<Database>;
type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];

export async function listVehicles(
  supabase: Client,
  filters: { vehicle_type?: string; availability_status?: string; search?: string } = {},
) {
  let query = supabase.from("vehicles").select("*").order("created_at", { ascending: false });

  if (filters.vehicle_type) {
    query = query.eq("vehicle_type", filters.vehicle_type as VehicleType);
  }
  if (filters.availability_status) {
    query = query.eq("availability_status", filters.availability_status as AvailabilityStatus);
  }
  if (filters.search) {
    query = query.or(`brand.ilike.%${filters.search}%,model.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getVehicle(supabase: Client, id: string) {
  const { data: vehicle, error } = await supabase.from("vehicles").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);

  const { data: images, error: imagesError } = await supabase
    .from("vehicle_images")
    .select("*")
    .eq("vehicle_id", id)
    .order("sort_order", { ascending: true });
  if (imagesError) throw new Error(imagesError.message);

  return { ...vehicle, vehicle_images: images ?? [] };
}

export async function createVehicle(
  supabase: Client,
  input: Record<string, unknown>,
  userId: string,
) {
  const parsed = vehicleSchema.parse(input);
  const row: VehicleInsert = { ...parsed, created_by: userId };
  const { data, error } = await supabase.from("vehicles").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateVehicle(supabase: Client, id: string, input: Record<string, unknown>) {
  const parsed = partialUpdateFields(vehicleSchema, input);
  const { data, error } = await supabase.from("vehicles").update(parsed).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteVehicle(supabase: Client, id: string) {
  const { data: offer } = await supabase.from("offers").select("id").eq("vehicle_id", id).limit(1).maybeSingle();
  if (offer) throw new Error("Bu araca bağlı teklif var. Önce ilgili teklifi silin.");
  const { data, error } = await supabase.from("vehicles").delete().eq("id", id).select("id").single();
  if (error) throw new Error(error.message);
  return data;
}

export type CsvImportRow = Record<string, string>;
export type CsvImportReport = {
  inserted: number;
  errors: { row: number; message: string }[];
};

const CSV_COLUMN_MAP: Record<string, keyof VehicleInsert> = {
  brand: "brand",
  model: "model",
  year: "year",
  mileage_km: "mileage_km",
  price: "price",
  currency: "currency",
  vehicle_type: "vehicle_type",
  vat_status: "vat_status",
  euro_class: "euro_class",
  condition: "condition",
  source_site: "source_site",
  listing_url: "listing_url",
  seller_name: "seller_name",
  seller_country: "seller_country",
  notes: "notes",
};

export async function importVehiclesFromCsv(
  supabase: Client,
  rows: CsvImportRow[],
  userId: string,
): Promise<CsvImportReport> {
  const report: CsvImportReport = { inserted: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const mapped: Record<string, unknown> = {};
    for (const [csvKey, field] of Object.entries(CSV_COLUMN_MAP)) {
      if (raw[csvKey] !== undefined && raw[csvKey] !== "") {
        mapped[field] = raw[csvKey];
      }
    }

    const parsed = vehicleSchema.safeParse(mapped);
    if (!parsed.success) {
      report.errors.push({
        row: i + 2, // +1 header +1 1-index
        message: parsed.error.issues.map((issue) => issue.message).join(", "),
      });
      continue;
    }

    const { error } = await supabase
      .from("vehicles")
      .insert({ ...parsed.data, created_by: userId });

    if (error) {
      report.errors.push({ row: i + 2, message: error.message });
      continue;
    }
    report.inserted++;
  }

  return report;
}
