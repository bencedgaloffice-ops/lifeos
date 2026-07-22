import { cookies } from "next/headers";
import { translations, type Locale } from "./translations";

/** Reads the persisted locale cookie in a Server Component / Route Handler. */
export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get("lifeos_locale")?.value;
  return value === "hu" ? "hu" : "en";
}

function readValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** Translate a dot-path key on the server (e.g. for route metadata). */
export function tServer(locale: Locale, path: string): string {
  const value = readValue(translations[locale], path) ?? readValue(translations.en, path);
  return typeof value === "string" ? value : path;
}
