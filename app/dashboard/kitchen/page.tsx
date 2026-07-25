import { createClient } from "@/lib/supabase/server";
import { KitchenModule } from "@/components/dashboard/modules/KitchenModule";
import { suggestMeals } from "./suggestions";
import type { KitchenItem, ShoppingListItem, Store, StorePrice } from "@/lib/types";

export const metadata = { title: "Kitchen" };

export default async function KitchenPage() {
  const supabase = await createClient();

  const [{ data: items }, { data: shoppingList }, { data: stores }, { data: prices }] = await Promise.all([
    supabase.from("kitchen_items").select("*").order("expires_at", { ascending: true, nullsFirst: false }),
    supabase.from("shopping_list_items").select("*").order("created_at", { ascending: true }),
    supabase.from("stores").select("*").order("price_level", { ascending: true }),
    supabase.from("store_prices").select("*").order("observed_at", { ascending: false }),
  ]);

  const allItems = (items as KitchenItem[]) ?? [];
  const suggestions = suggestMeals(allItems.map((i) => i.name));

  return (
    <KitchenModule
      items={allItems}
      shoppingList={(shoppingList as ShoppingListItem[]) ?? []}
      suggestions={suggestions}
      stores={(stores as Store[]) ?? []}
      prices={(prices as StorePrice[]) ?? []}
    />
  );
}
