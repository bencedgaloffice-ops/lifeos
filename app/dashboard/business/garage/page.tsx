import { createClient } from "@/lib/supabase/server";
import { GarageModule } from "@/components/dashboard/modules/GarageModule";
import type { GarageVehicle, GarageServiceRecord, GarageDreamVehicle, GarageImportDeal, Document } from "@/lib/types";

export const metadata = { title: "My Garage" };

export default async function GaragePage() {
  const supabase = await createClient();

  const [
    { data: profile },
    { data: vehicles },
    { data: serviceRecords },
    { data: dreamVehicles },
    { data: deals },
    { data: vehicleDocuments },
  ] = await Promise.all([
    supabase.from("profiles").select("preferred_currency").maybeSingle(),
    supabase.from("garage_vehicles").select("*").order("created_at", { ascending: false }),
    supabase.from("garage_service_records").select("*").order("service_date", { ascending: false }),
    supabase.from("garage_dream_vehicles").select("*").order("priority_rating", { ascending: false }),
    supabase.from("garage_import_deals").select("*").order("created_at", { ascending: false }),
    supabase.from("documents").select("*").not("garage_vehicle_id", "is", null),
  ]);

  return (
    <GarageModule
      currency={profile?.preferred_currency || "USD"}
      vehicles={(vehicles as GarageVehicle[]) ?? []}
      serviceRecords={(serviceRecords as GarageServiceRecord[]) ?? []}
      dreamVehicles={(dreamVehicles as GarageDreamVehicle[]) ?? []}
      deals={(deals as GarageImportDeal[]) ?? []}
      vehicleDocuments={(vehicleDocuments as Document[]) ?? []}
    />
  );
}
