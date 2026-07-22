/**
 * Lightweight className combiner — merges truthy class fragments.
 * Avoids pulling in extra dependencies for a simple concat.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
