"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import type { LifeArea } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CategoryPicker, inputClass } from "@/components/dashboard/ui";
import { resolveIcon } from "@/lib/icon-registry";
import { createLifeArea, updateLifeArea, deleteLifeArea } from "@/app/dashboard/calendar/actions";

export function CategoryManager({
  open,
  onClose,
  lifeAreas,
}: {
  open: boolean;
  onClose: () => void;
  lifeAreas: LifeArea[];
}) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newIcon, setNewIcon] = useState("CalendarDays");
  const [newColor, setNewColor] = useState("#3B82F6");
  const [reassignFor, setReassignFor] = useState<{ id: string; blocked: number } | null>(null);
  const [editing, setEditing] = useState<Record<string, { icon: string; color: string }>>({});

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-md overflow-y-auto glass-strong p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{t("calendar.categories.title")}</h2>
                <p className="text-xs text-white/45">{t("calendar.categories.subtitle")}</p>
              </div>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {lifeAreas.map((area) => {
                const edit = editing[area.id] ?? { icon: area.icon ?? "CalendarDays", color: area.color ?? "#3B82F6" };
                return (
                  <div key={area.id} className="flex items-center gap-3 rounded-2xl glass p-3">
                    <CategoryPicker
                      icon={edit.icon}
                      color={edit.color}
                      onIconChange={(icon) => {
                        setEditing((prev) => ({ ...prev, [area.id]: { ...edit, icon } }));
                        const fd = new FormData();
                        fd.set("name", area.name);
                        fd.set("icon", icon);
                        fd.set("color", edit.color);
                        startTransition(() => updateLifeArea(area.id, fd));
                      }}
                      onColorChange={(color) => {
                        setEditing((prev) => ({ ...prev, [area.id]: { ...edit, color } }));
                        const fd = new FormData();
                        fd.set("name", area.name);
                        fd.set("icon", edit.icon);
                        fd.set("color", color);
                        startTransition(() => updateLifeArea(area.id, fd));
                      }}
                    />
                    <span className="flex-1 truncate text-sm text-white/85">{area.name}</span>
                    <button
                      disabled={pending}
                      onClick={async () => {
                        const result = await deleteLifeArea(area.id);
                        if (result?.blocked) setReassignFor({ id: area.id, blocked: result.blocked });
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {reassignFor && (
              <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                <p className="mb-3 text-sm text-amber-200">
                  {t("calendar.categories.deleteBlocked", { n: reassignFor.blocked })}
                </p>
                <select
                  className={inputClass}
                  defaultValue=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    startTransition(async () => {
                      await deleteLifeArea(reassignFor.id, e.target.value);
                      setReassignFor(null);
                    });
                  }}
                >
                  <option value="" className="bg-base">—</option>
                  {lifeAreas
                    .filter((a) => a.id !== reassignFor.id)
                    .map((a) => (
                      <option key={a.id} value={a.id} className="bg-base">
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {adding ? (
              <form
                action={(fd) => {
                  fd.set("icon", newIcon);
                  fd.set("color", newColor);
                  startTransition(async () => {
                    await createLifeArea(fd);
                    setAdding(false);
                    setNewIcon("CalendarDays");
                    setNewColor("#3B82F6");
                  });
                }}
                className="mt-3 space-y-3 rounded-2xl glass p-4"
              >
                <div className="flex items-center gap-3">
                  <CategoryPicker icon={newIcon} color={newColor} onIconChange={setNewIcon} onColorChange={setNewColor} />
                  <input name="name" placeholder={t("calendar.categories.namePlaceholder")} required className={inputClass} />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setAdding(false)} className="rounded-full px-3 py-1.5 text-xs text-white/50 hover:text-white">
                    {t("calendar.categories.cancel")}
                  </button>
                  <button type="submit" disabled={pending} className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-black">
                    {t("calendar.categories.save")}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline py-3 text-sm text-white/50 transition-colors hover:text-white"
              >
                <Plus className="h-4 w-4" />
                {t("calendar.categories.add")}
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
