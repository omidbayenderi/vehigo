import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVehicle } from "@/lib/services/vehicles";
import { PageHeader } from "@/components/ui/page-header";
import EditVehicleForm from "./edit-form";
import ImageGallery from "./image-gallery";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  let vehicle;
  try {
    vehicle = await getVehicle(supabase, id);
  } catch {
    notFound();
  }
  if (!vehicle) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Araç" title={`${vehicle.brand} ${vehicle.model}`} />
      <EditVehicleForm vehicle={vehicle} />
      <ImageGallery vehicleId={vehicle.id} images={vehicle.vehicle_images} />
    </div>
  );
}
