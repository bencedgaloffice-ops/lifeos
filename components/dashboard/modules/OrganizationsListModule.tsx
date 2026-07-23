"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Building2, Pencil, ArrowUpRight } from "lucide-react";
import type { Organization } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ModuleHeader, Panel, Pill, Field, inputClass } from "@/components/dashboard/ui";
import { updateOrganization } from "@/app/dashboard/business/actions";

type Props = {
  organizations: Organization[];
};

export function OrganizationsListModule({ organizations }: Props) {
  const { t } = useLocale();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div>
      <ModuleHeader icon={Building2} title={t("nav.organizations.label")} subtitle={t("business.orgsSubtitle")} />

      <div className="grid gap-4 sm:grid-cols-2">
        {organizations.map((org) => (
          <Panel key={org.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold tracking-tight">{org.name}</p>
                <Pill tone="accent">{t(`business.type.${org.type ?? "own_business"}`)}</Pill>
              </div>
              <button
                onClick={() => setEditingId(editingId === org.id ? null : org.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full glass text-white/60 transition-colors hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>

            {editingId === org.id ? (
              <form
                action={(fd) => {
                  startTransition(() => updateOrganization(org.id, fd));
                  setEditingId(null);
                }}
                className="mt-3 grid gap-3"
              >
                <Field label={t("business.formName")}>
                  <input name="name" defaultValue={org.name} required className={inputClass} />
                </Field>
                <Field label={t("business.formDescription")}>
                  <textarea name="description" defaultValue={org.description ?? ""} rows={2} className={inputClass + " resize-none"} />
                </Field>
                <div className="flex gap-3">
                  <button type="submit" className="rounded-full bg-accent px-5 py-2 text-xs font-medium text-white">
                    {t("business.save")}
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded-full glass px-5 py-2 text-xs text-white/70">
                    {t("business.cancel")}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {org.description && <p className="mt-3 text-sm leading-relaxed text-white/50">{org.description}</p>}
                <Link
                  href={`/dashboard/business/${org.id}`}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full glass px-4 py-2 text-xs font-medium text-white/80 transition-colors hover:text-white"
                >
                  {t("business.openWorkspace")} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
