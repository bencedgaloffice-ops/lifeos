"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gauge,
  Wrench,
  FileStack,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  Sparkles,
  Link as LinkIcon,
  Car,
} from "lucide-react";
import type { GarageVehicle, GarageServiceRecord, Document } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Panel, Field, inputClass, Numeral } from "@/components/dashboard/ui";
import { useJarvis } from "@/lib/jarvis/useJarvis";
import { carbonWeave, spotlight } from "./carbon";
import {
  updateVehicle,
  deleteVehicle,
  createServiceRecord,
  deleteServiceRecord,
  attachVehicleDocument,
  deleteVehicleDocument,
} from "@/app/dashboard/business/garage/actions";

const ACCENT = "#9BB0C4";

export function VehicleCard({
  vehicle,
  serviceRecords,
  documents,
  currency,
}: {
  vehicle: GarageVehicle;
  serviceRecords: GarageServiceRecord[];
  documents: Document[];
  currency: string;
}) {
  const { t, locale } = useLocale();
  const { runText } = useJarvis();
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingService, setAddingService] = useState(false);
  const [addingDoc, setAddingDoc] = useState(false);
  const fc = (n: number) => formatCurrency(n, currency, { locale });

  const totalServiceCost = serviceRecords.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const appreciation = vehicle.value !== null && vehicle.purchase_price !== null ? vehicle.value - vehicle.purchase_price : null;

  return (
    <Panel className="relative overflow-hidden p-0">
      <div className="relative h-44 w-full overflow-hidden">
        {vehicle.image_url ? (
          <img src={vehicle.image_url} alt={`${vehicle.brand} ${vehicle.model}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={carbonWeave}>
            <Car className="h-10 w-10 text-white/15" strokeWidth={1.25} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0" style={spotlight(ACCENT, 0.28)} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white">
              {vehicle.brand} {vehicle.model}
            </h3>
            {vehicle.year && <p className="text-xs text-white/60">{vehicle.year}</p>}
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="flex items-center justify-center gap-1 text-[0.65rem] uppercase tracking-wider text-white/40">
              <Gauge className="h-3 w-3" /> {t("garage.mileage")}
            </p>
            <Numeral className="mt-1 block text-sm font-semibold text-white/85">
              {vehicle.mileage !== null ? `${vehicle.mileage.toLocaleString(locale === "hu" ? "hu-HU" : "en-US")} km` : "—"}
            </Numeral>
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-white/40">{t("garage.value")}</p>
            <Numeral className="mt-1 block text-sm font-semibold" style={{ color: ACCENT }}>
              {vehicle.value !== null ? fc(vehicle.value) : "—"}
            </Numeral>
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-white/40">{t("garage.sinceBuy")}</p>
            <Numeral className={`mt-1 block text-sm font-semibold ${appreciation !== null && appreciation < 0 ? "text-red-300" : "text-emerald-300"}`}>
              {appreciation !== null ? `${appreciation >= 0 ? "+" : ""}${fc(appreciation)}` : "—"}
            </Numeral>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => runText(`analyze ${vehicle.brand} ${vehicle.model}`)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
            style={{ boxShadow: `0 0 24px -10px ${ACCENT}88` }}
          >
            <Sparkles className="h-3.5 w-3.5" /> {t("garage.askJarvis")}
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" /> {t("garage.edit")}
          </button>
          <button
            onClick={() => startTransition(() => deleteVehicle(vehicle.id))}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
          >
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
                startTransition(() => updateVehicle(vehicle.id, fd));
                setEditing(false);
              }}
              className="mt-4 grid gap-3 overflow-hidden sm:grid-cols-2"
            >
              <Field label={t("garage.formBrand")}><input name="brand" defaultValue={vehicle.brand} required className={inputClass} /></Field>
              <Field label={t("garage.formModel")}><input name="model" defaultValue={vehicle.model} required className={inputClass} /></Field>
              <Field label={t("garage.formYear")}><input name="year" type="number" defaultValue={vehicle.year ?? ""} className={inputClass} /></Field>
              <Field label={t("garage.mileage")}><input name="mileage" type="number" defaultValue={vehicle.mileage ?? ""} className={inputClass} /></Field>
              <Field label={t("garage.value")}><input name="value" type="number" defaultValue={vehicle.value ?? ""} className={inputClass} /></Field>
              <Field label={t("garage.formPurchasePrice")}><input name="purchase_price" type="number" defaultValue={vehicle.purchase_price ?? ""} className={inputClass} /></Field>
              <div className="sm:col-span-2"><Field label={t("garage.formImageUrl")}><input name="image_url" defaultValue={vehicle.image_url ?? ""} className={inputClass} /></Field></div>
              <div className="sm:col-span-2"><Field label={t("garage.formLinks")}><textarea name="links" defaultValue={vehicle.links.join("\n")} rows={2} className={inputClass + " resize-none"} /></Field></div>
              <div className="sm:col-span-2"><Field label={t("garage.formNotes")}><textarea name="notes" defaultValue={vehicle.notes ?? ""} rows={2} className={inputClass + " resize-none"} /></Field></div>
              <div className="flex gap-3 sm:col-span-2">
                <button type="submit" className="rounded-full px-5 py-2 text-xs font-medium text-black" style={{ backgroundColor: ACCENT }}>{t("garage.save")}</button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-full glass px-5 py-2 text-xs text-white/70">{t("garage.cancel")}</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {vehicle.notes && !editing && <p className="mt-4 text-sm leading-relaxed text-white/55">{vehicle.notes}</p>}

        {vehicle.links.length > 0 && !editing && (
          <ul className="mt-3 space-y-1">
            {vehicle.links.map((link) => (
              <li key={link}>
                <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white/70">
                  <LinkIcon className="h-3 w-3" /> {link}
                </a>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 flex w-full items-center justify-between rounded-xl bg-white/[0.02] px-3 py-2 text-xs text-white/50 hover:text-white/75"
        >
          <span className="flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> {t("garage.serviceHistory")} ({serviceRecords.length})
            {totalServiceCost > 0 && <span className="text-white/30">· {fc(totalServiceCost)}</span>}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-3 space-y-2">
                {serviceRecords.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-2 rounded-lg bg-white/[0.02] px-3 py-2 text-xs">
                    <div>
                      <p className="text-white/75">{r.description}</p>
                      <p className="mt-0.5 text-white/35">
                        {formatDate(r.service_date, undefined, locale)}
                        {r.mileage_at_service !== null ? ` · ${r.mileage_at_service.toLocaleString()} km` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.cost !== null && <Numeral className="text-white/60">{fc(r.cost)}</Numeral>}
                      <button onClick={() => startTransition(() => deleteServiceRecord(r.id))} className="text-white/25 hover:text-red-300">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {serviceRecords.length === 0 && <p className="text-xs text-white/30">{t("garage.noServiceHistory")}</p>}

                {addingService ? (
                  <form
                    action={(fd) => {
                      startTransition(() => createServiceRecord(vehicle.id, fd));
                      setAddingService(false);
                    }}
                    className="grid gap-2 rounded-lg bg-white/[0.03] p-3 sm:grid-cols-2"
                  >
                    <input name="description" placeholder={t("garage.formServiceDescription")} required className={inputClass + " text-xs"} />
                    <input name="service_date" type="date" className={inputClass + " text-xs"} />
                    <input name="cost" type="number" placeholder={t("garage.formCost")} className={inputClass + " text-xs"} />
                    <input name="mileage_at_service" type="number" placeholder={t("garage.mileage")} className={inputClass + " text-xs"} />
                    <div className="flex gap-2 sm:col-span-2">
                      <button type="submit" className="rounded-full px-4 py-1.5 text-xs font-medium text-black" style={{ backgroundColor: ACCENT }}>{t("garage.save")}</button>
                      <button type="button" onClick={() => setAddingService(false)} className="rounded-full glass px-4 py-1.5 text-xs text-white/70">{t("garage.cancel")}</button>
                    </div>
                  </form>
                ) : (
                  <button onClick={() => setAddingService(true)} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
                    <Plus className="h-3 w-3" /> {t("garage.addService")}
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2 border-t border-hairline pt-3">
                <p className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-white/40">
                  <FileStack className="h-3.5 w-3.5" /> {t("garage.documents")} ({documents.length})
                </p>
                {documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] px-3 py-2 text-xs">
                    {d.file_path ? (
                      <a href={d.file_path} target="_blank" rel="noreferrer" className="text-white/70 hover:text-white">{d.title}</a>
                    ) : (
                      <span className="text-white/70">{d.title}</span>
                    )}
                    <button onClick={() => startTransition(() => deleteVehicleDocument(d.id))} className="text-white/25 hover:text-red-300">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {addingDoc ? (
                  <form
                    action={(fd) => {
                      startTransition(() => attachVehicleDocument(vehicle.id, fd));
                      setAddingDoc(false);
                    }}
                    className="grid gap-2 rounded-lg bg-white/[0.03] p-3 sm:grid-cols-2"
                  >
                    <input name="title" placeholder={t("garage.formDocTitle")} required className={inputClass + " text-xs"} />
                    <input name="link" placeholder={t("garage.formDocLink")} className={inputClass + " text-xs"} />
                    <div className="flex gap-2 sm:col-span-2">
                      <button type="submit" className="rounded-full px-4 py-1.5 text-xs font-medium text-black" style={{ backgroundColor: ACCENT }}>{t("garage.save")}</button>
                      <button type="button" onClick={() => setAddingDoc(false)} className="rounded-full glass px-4 py-1.5 text-xs text-white/70">{t("garage.cancel")}</button>
                    </div>
                  </form>
                ) : (
                  <button onClick={() => setAddingDoc(true)} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
                    <Plus className="h-3 w-3" /> {t("garage.addDocument")}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Panel>
  );
}
