"use client";

import { Search, X } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useLocale();
  return (
    <div className="relative flex-1 sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("calendar.search.placeholder")}
        className="w-full rounded-full border border-hairline bg-white/[0.03] py-2 pl-10 pr-8 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-accent/60"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
