"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Bug, Sparkles } from "lucide-react";
import type { Apiary, CalendarItem, HoneyHarvestLog } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Panel, StatCard, inputClass, EmptyState } from "@/components/dashboard/ui";
import {
  createApiary,
  deleteApiary,
  createHarvestLog,
  deleteHarvestLog,
  applySeasonTemplate,
} from "@/app/dashboard/calendar/actions";

const SUBTYPES = ["movement", "inspection", "harvest", "extraction", "feeding", "queen_replacement", "maintenance"] as const;
const TEMPLATE_KEYS = ["acacia", "rapeseed", "sunflower", "forest"] as const;

function subtypeI18nKey(subtype: string): string {
  return `subtype${subtype
    .split("_")
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("")}`;
}

export function BeekeepingPanel({
  apiaries,
  harvestLog,
  beekeepingItems,
}: {
  apiaries: Apiary[];
  harvestLog: HoneyHarvestLog[];
  beekeepingItems: CalendarItem[];
}) {
  const { t, locale } = useLocale();
  const [pending, startTransition] = useTransition();
  const [addingApiary, setAddingApiary] = useState(false);
  const [addingHarvest, setAddingHarvest] = useState(false);
  const [addedTemplates, setAddedTemplates] = useState<string[]>([]);

  const seasonGroups = useMemo(
    () =>
      SUBTYPES.map((subtype) => ({
        subtype,
        count: beekeepingItems.filter((it) => it.subtype === subtype).length,
      })).filter((g) => g.count > 0),
    [beekeepingItems],
  );

  const totalHoney = harvestLog.reduce((sum, h) => sum + Number(h.quantity_kg), 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label={t("calendar.beekeeping.harvestTotal")} value={`${totalHoney.toFixed(1)} kg`} accent />
        <StatCard label={t("calendar.beekeeping.apiariesTitle")} value={String(apiaries.reduce((s, a) => s + (a.hive_count ?? 0), 0))} hint={t("calendar.beekeeping.hiveCount")} />
      </div>

      {seasonGroups.length > 0 && (
        <Panel className="p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/45">{t("calendar.beekeeping.seasonTitle")}</p>
          <div className="flex flex-wrap gap-2">
            {seasonGroups.map((g) => (
              <span key={g.subtype} className="rounded-full bg-white/6 px-3 py-1.5 text-xs text-white/70">
                {t(`calendar.beekeeping.${subtypeI18nKey(g.subtype)}`)} · {g.count}
              </span>
            ))}
          </div>
        </Panel>
      )}

      <Panel className="p-4">
        <p className="mb-1 text-sm font-medium text-white/80">{t("calendar.beekeeping.templatesTitle")}</p>
        <p className="mb-3 text-xs text-white/40">{t("calendar.beekeeping.templatesHint")}</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_KEYS.map((key) => (
            <button
              key={key}
              disabled={pending || addedTemplates.includes(key)}
              onClick={() =>
                startTransition(async () => {
                  await applySeasonTemplate(key);
                  setAddedTemplates((prev) => [...prev, key]);
                })
              }
              className="flex items-center gap-1.5 rounded-full glass-strong px-3.5 py-2 text-xs font-medium text-white/70 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              {t(`calendar.beekeeping.template${key[0].toUpperCase()}${key.slice(1)}`)}
              {addedTemplates.includes(key) && ` · ${t("calendar.beekeeping.added")}`}
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium uppercase tracking-wider text-white/45">{t("calendar.beekeeping.apiariesTitle")}</h3>
          <button onClick={() => setAddingApiary((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-full glass-strong text-white/60 hover:text-white">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {addingApiary && (
          <form
            action={(fd) => startTransition(async () => { await createApiary(fd); setAddingApiary(false); })}
            className="mb-4 grid grid-cols-2 gap-3 rounded-2xl glass p-4"
          >
            <input name="name" placeholder={t("calendar.beekeeping.apiaryName")} required className={inputClass} />
            <input name="location_text" placeholder={t("calendar.beekeeping.apiaryLocation")} className={inputClass} />
            <input type="number" name="hive_count" placeholder={t("calendar.beekeeping.hiveCount")} className={inputClass} />
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setAddingApiary(false)} className="rounded-full px-3 py-1.5 text-xs text-white/50 hover:text-white">
                {t("calendar.beekeeping.cancel")}
              </button>
              <button type="submit" className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-black">
                {t("calendar.beekeeping.save")}
              </button>
            </div>
          </form>
        )}
        {apiaries.length === 0 ? (
          <EmptyState icon={Bug} title={t("calendar.beekeeping.noApiaries")} />
        ) : (
          <div className="space-y-1.5">
            {apiaries.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
                <span className="flex-1 truncate text-sm text-white/80">{a.name}</span>
                {a.location_text && <span className="text-xs text-white/40">{a.location_text}</span>}
                {a.hive_count != null && <span className="rounded-full bg-white/6 px-2 py-0.5 text-xs text-white/60">{a.hive_count}</span>}
                <button onClick={() => startTransition(() => deleteApiary(a.id))} className="text-white/30 hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium uppercase tracking-wider text-white/45">{t("calendar.beekeeping.harvestTitle")}</h3>
          <button onClick={() => setAddingHarvest((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-full glass-strong text-white/60 hover:text-white">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {addingHarvest && (
          <form
            action={(fd) => startTransition(async () => { await createHarvestLog(fd); setAddingHarvest(false); })}
            className="mb-4 grid grid-cols-2 gap-3 rounded-2xl glass p-4"
          >
            <input type="date" name="harvest_date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
            <input type="number" step="0.1" name="quantity_kg" placeholder={t("calendar.beekeeping.harvestQuantity")} required className={inputClass} />
            {apiaries.length > 0 && (
              <select name="apiary_id" className={inputClass}>
                <option value="" className="bg-base">—</option>
                {apiaries.map((a) => (
                  <option key={a.id} value={a.id} className="bg-base">
                    {a.name}
                  </option>
                ))}
              </select>
            )}
            <div className="col-span-full flex justify-end gap-2">
              <button type="button" onClick={() => setAddingHarvest(false)} className="rounded-full px-3 py-1.5 text-xs text-white/50 hover:text-white">
                {t("calendar.beekeeping.cancel")}
              </button>
              <button type="submit" className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-black">
                {t("calendar.beekeeping.save")}
              </button>
            </div>
          </form>
        )}
        {harvestLog.length === 0 ? (
          <EmptyState icon={Sparkles} title={t("calendar.beekeeping.noHarvest")} />
        ) : (
          <div className="space-y-1.5">
            {harvestLog.slice(0, 20).map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
                <span className="flex-1 text-sm text-white/75">{new Date(h.harvest_date).toLocaleDateString(locale === "hu" ? "hu-HU" : "en-US")}</span>
                <span className="text-sm font-medium text-accent-soft">{Number(h.quantity_kg).toFixed(1)} kg</span>
                <button onClick={() => startTransition(() => deleteHarvestLog(h.id))} className="text-white/30 hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
