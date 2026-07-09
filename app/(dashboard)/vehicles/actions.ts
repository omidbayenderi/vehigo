"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import {
  createVehicle,
  importVehiclesFromCsv,
  updateVehicle,
  type CsvImportReport,
} from "@/lib/services/vehicles";
import { logAudit } from "@/lib/services/audit";
import { formDataToObject } from "@/lib/utils";

export type FormState = { error?: string };

export async function createVehicleAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const input = formDataToObject(formData);

  try {
    const vehicle = await createVehicle(supabase, input, user.id);
    await logAudit(supabase, user.id, "create", "vehicle", vehicle.id);
    revalidatePath("/vehicles");
    redirect(`/vehicles/${vehicle.id}`);
  } catch (err) {
    if (err instanceof Error && err.message !== "NEXT_REDIRECT") {
      return { error: err.message };
    }
    throw err;
  }
}

export async function updateVehicleAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const input = formDataToObject(formData);

  try {
    await updateVehicle(supabase, id, input);
    await logAudit(supabase, user.id, "update", "vehicle", id);
    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${id}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bilinmeyen hata" };
  }
}

export type ImportState = { report?: CsvImportReport; error?: string };

export async function importVehiclesCsvAction(
  _prevState: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "CSV dosyası seçin" };
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    return { error: `CSV ayrıştırma hatası: ${parsed.errors[0].message}` };
  }

  const report = await importVehiclesFromCsv(supabase, parsed.data, user.id);
  await logAudit(supabase, user.id, "csv_import", "vehicle", null, {
    inserted: report.inserted,
    errorCount: report.errors.length,
  });
  revalidatePath("/vehicles");
  return { report };
}
