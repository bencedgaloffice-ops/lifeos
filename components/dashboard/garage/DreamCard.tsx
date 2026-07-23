"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Pencil, Trash2, Target, ArrowUpRight, Car } from "lucide-react";
import type { GarageDreamVehicle } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Panel, Field, inputClass, Numeral } from "@/components/dashboard/ui";
import { carbonWeave, spotlight } from "./carbon";
import { updateDreamVehicle, deleteDreamVehicle } from "@/app/dashboard/business/garage/actions";

const ACCENT = "#F5D68A";

export function DreamCard({ dream, currency }: { dream: GarageDreamVehicle; currency: string }) {
  const { t, locale } = useLocale();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const fc = (n: number) => formatCurrency(n, currency, { locale });

  return (
    <Panel className="relative overflow-hidden p-0">
      <div className="relative h-40 w-full overflow-hidden">
        {dream.image_url ? (
          <img src={dream.image_url} alt={`${dream.brand} ${dream.model}`} className="h-full w-full object-cover opacity-90" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={carbonWeave}>
            <Car className="h-9 w-9 text-white/15" strokeWidth={1.25} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0" style={spotlight(ACCENT, 0.22)} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute right-3 top-3 flex gap-0.5 rounded-full bg-black/50 px-2 py-1 backdrop-blur">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3 w-3" strokeWidth={1.5} fill={i < dream.priority_rating ? ACCENT : "transparent"} style={{ color: ACCENT }} />
          ))}
        </div>
        <div className="absolute bottom-3 left-4">
          <h3 className="text-base font-semibold tracking-tight text-white">
            {dream.brand} {dream.model}
          </h3>
          {dream.year && <p className="text-xs text-white/60">{dream.year}</p>}
        </div>
      </div>

      <div className="p-5">
        <p className="text-[0.65rem] uppercase tracking-wider text-white/40">{t("garage.estimatedPrice")}</p>
        <Numeral className="mt-1 block text-lg font-semibold" style={{ color: ACCENT }}>
          {dream.estimated_price !== null ? fc(dream.estimated_price) : "—"}
        </Numeral>

        {dream.purchase_goal && (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-white/55">
            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {dream.purchase_goal}
          </p>
        )}
        {dream.target_date && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-white/35">
            <ArrowUpRight className="h-3 w-3" /> {formatDate(dream.target_date, undefined, locale)}
          </p>
        )}
        {dream.notes && <p className="mt-3 text-sm leading-relaxed text-white/50">{dream.notes}</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 hover:text-white">
            <Pencil className="h-3.5 w-3.5" /> {t("garage.edit")}
          </button>
          <button onClick={() => startTransition(() => deleteDreamVehicle(dream.id))} className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20">
            <Trash2 className="h-3.5 w-3.5" /> {t("garage.delete")}
          </button>
        </div>

        <AnimatePresence>
          {editing && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              action={(fd) => {
                startTransition(() => updateDreamVehicle(dream.id, fd));
                setEditing(false);
              }}
              className="mt-4 grid gap-3 overflow-hidden sm:grid-cols-2"
            >
              <Field label={t("garage.formBrand")}><input name="brand" defaultValue={dream.brand} required className={inputClass} /></Field>
              <Field label={t("garage.formModel")}><input name="model" defaultValue={dream.model} required className={inputClass} /></Field>
              <Field label={t("garage.formYear")}><input name="year" type="number" defaultValue={dream.year ?? ""} className={inputClass} /></Field>
              <Field label={t("garage.estimatedPrice")}><input name="estimated_price" type="number" defaultValue={dream.estimated_price ?? ""} className={inputClass} /></Field>
              <Field label={t("garage.formPriority")}>
                <select name="priority_rating" defaultValue={dream.priority_rating} className={inputClass}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n} className="bg-base">{n}</option>)}
                </select>
              </Field>
              <Field label={t("garage.formTargetDate")}><input name="target_date" type="date" defaultValue={dream.target_date ?? ""} className={inputClass} /></Field>
              <div className="sm:col-span-2"><Field label={t("garage.formImageUrl")}><input name="image_url" defaultValue={dream.image_url ?? ""} className={inputClass} /></Field></div>
              <div className="sm:col-span-2"><Field label={t("garage.formPurchaseGoal")}><input name="purchase_goal" defaultValue={dream.purchase_goal ?? ""} className={inputClass} /></Field></div>
              <div className="sm:col-span-2"><Field label={t("garage.formNotes")}><textarea name="notes" defaultValue={dream.notes ?? ""} rows={2} className={inputClass + " resize-none"} /></Field></div>
              <div className="flex gap-3 sm:col-span-2">
                <button type="submit" className="rounded-full px-5 py-2 text-xs font-medium text-black" style={{ backgroundColor: ACCENT }}>{t("garage.save")}</button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-full glass px-5 py-2 text-xs text-white/70">{t("garage.cancel")}</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </Panel>
  );
}
