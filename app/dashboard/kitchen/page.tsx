import { createClient } from "@/lib/supabase/server";
import { KitchenModule } from "@/components/dashboard/modules/KitchenModule";
import { suggestMeals } from "./suggestions";
import type { KitchenItem, ShoppingListItem } from "@/lib/types";

export const metadata = { title: "Kitchen" };

export default async function KitchenPage() {
  const supabase = await createClient();

  const [{ data: items }, { data: shoppingList }] = await Promise.all([
    supabase.from("kitchen_items").select("*").order("expires_at", { ascending: true, nullsFirst: false }),
    supabase.from("shopping_list_items").select("*").order("created_at", { ascending: true }),
  ]);

  const allItems = (items as KitchenItem[]) ?? [];
  const suggestions = suggestMeals(allItems.map((i) => i.name));

  return (
    <KitchenModule
      items={allItems}
      shoppingList={(shoppingList as ShoppingListItem[]) ?? []}
      suggestions={suggestions}
    />
  );
}
