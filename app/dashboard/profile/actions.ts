"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function str(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

function numOrNull(fd: FormData, key: string): number | null {
  const v = String(fd.get(key) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function list(fd: FormData, key: string): string[] | null {
  const v = String(fd.get(key) ?? "").trim();
  if (!v) return null;
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("profiles").upsert({
    id: user.id,
    display_name: str(formData, "display_name"),
    birthday: str(formData, "birthday"),
    location: str(formData, "location"),
    headline: str(formData, "headline"),
    bio: str(formData, "bio"),
    mission: str(formData, "mission"),
    vision: str(formData, "vision"),
    core_values: list(formData, "core_values"),
    job_title: str(formData, "job_title"),
    company: str(formData, "company"),
    skills: list(formData, "skills"),
    education: str(formData, "education"),
    career_plans: str(formData, "career_plans"),
    preferred_currency: str(formData, "preferred_currency") || "USD",
    current_savings: numOrNull(formData, "current_savings"),
    monthly_income: numOrNull(formData, "monthly_income"),
    monthly_expenses: numOrNull(formData, "monthly_expenses"),
    financial_goal: str(formData, "financial_goal"),
    health_goal: str(formData, "health_goal"),
    spiritual_goal: str(formData, "spiritual_goal"),
    learning_goal: str(formData, "learning_goal"),
    growth_focus: str(formData, "growth_focus"),
    onboarded: true,
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
}
