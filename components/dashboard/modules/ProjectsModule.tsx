"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { FolderKanban, Plus, Trash2, Minus } from "lucide-react";
import type { Project } from "@/lib/types";
import { formatDate, relativeDays } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  ModuleHeader,
  Panel,
  Progress,
  Pill,
  EmptyState,
  Field,
  inputClass,
} from "@/components/dashboard/ui";
import {
  createProject,
  updateProjectProgress,
  deleteProject,
} from "@/app/dashboard/projects/actions";

export function ProjectsModule({ projects }: { projects: Project[] }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const { t } = useLocale();

  return (
    <div>
      <ModuleHeader
        icon={FolderKanban}
        title={t("projects.title")}
        subtitle={t("projects.subtitle")}
        action={
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> {t("projects.newProject")}
          </button>
        }
      />

      {open && (
        <Panel className="mb-6">
          <form
            action={(fd) => {
              startTransition(() => createProject(fd));
              setOpen(false);
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <Field label={t("projects.formName")}>
                <input name="name" required placeholder={t("projects.formNamePlaceholder")} className={inputClass} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t("projects.formDescription")}>
                <input
                  name="description"
                  placeholder={t("projects.formDescriptionPlaceholder")}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label={t("projects.formDeadline")}>
              <input type="date" name="deadline" className={inputClass} />
            </Field>
            <Field label={t("projects.formProgress")}>
              <input
                type="number"
                name="progress_percent"
                min={0}
                max={100}
                defaultValue={0}
                className={inputClass}
              />
            </Field>
            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
              >
                {t("projects.create")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full glass px-5 py-2.5 text-sm text-white/70"
              >
                {t("projects.cancel")}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={t("projects.noProjects")}
          hint={t("projects.noProjectsHint")}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const [pending, startTransition] = useTransition();
  const { t, locale } = useLocale();
  const step = (delta: number) =>
    startTransition(() => updateProjectProgress(project.id, project.progress_percent + delta));

  const overdue =
    project.deadline &&
    new Date(project.deadline) < new Date() &&
    project.status !== "completed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Panel className="group h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              {project.status === "completed" ? (
                <Pill tone="green">{t("projects.complete")}</Pill>
              ) : overdue ? (
                <Pill tone="amber">{t("projects.overdue")}</Pill>
              ) : (
                <Pill tone="accent">{t("projects.active")}</Pill>
              )}
            </div>
            <h3 className="text-lg font-semibold tracking-tight">{project.name}</h3>
            {project.description && (
              <p className="mt-1 text-sm leading-relaxed text-white/50">{project.description}</p>
            )}
          </div>
          <form action={() => startTransition(() => deleteProject(project.id))}>
            <button
              className="text-white/30 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
              aria-label="Delete project"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="tabular-nums font-medium text-white/70">
              {project.progress_percent}%
            </span>
            {project.deadline && (
              <span className="text-xs text-white/40">
                {formatDate(project.deadline, undefined, locale)} · {relativeDays(project.deadline, locale)}
              </span>
            )}
          </div>
          <Progress value={project.progress_percent} />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => step(-10)}
              disabled={pending || project.progress_percent <= 0}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full glass text-white/70 transition-colors hover:text-white disabled:opacity-40"
              aria-label="Decrease progress"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => step(10)}
              disabled={pending || project.progress_percent >= 100}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full glass text-white/70 transition-colors hover:text-white disabled:opacity-40"
              aria-label="Increase progress"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-white/35">{t("projects.adjustProgress")}</span>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}
