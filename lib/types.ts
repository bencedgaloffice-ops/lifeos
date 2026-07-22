/** Row shapes for the LifeOS tables the app reads and writes. */

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  birthday: string | null;
  location: string | null;
  headline: string | null;
  bio: string | null;
  mission: string | null;
  vision: string | null;
  core_values: string[] | null;
  job_title: string | null;
  company: string | null;
  skills: string[] | null;
  education: string | null;
  career_plans: string | null;
  preferred_currency: string;
  current_savings: number | null;
  monthly_income: number | null;
  monthly_expenses: number | null;
  financial_goal: string | null;
  health_goal: string | null;
  spiritual_goal: string | null;
  learning_goal: string | null;
  growth_focus: string | null;
  onboarded: boolean;
  updated_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  category: string | null;
  progress_percent: number;
  created_at: string;
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: string | null;
  currency: string;
  current_balance: number;
  created_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  direction: "in" | "out";
  description: string | null;
  occurred_at: string;
  created_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: string;
  deadline: string | null;
  progress_percent: number;
  created_at: string;
  updated_at: string;
};

export type JournalEntry = {
  id: string;
  user_id: string;
  title: string | null;
  body: string | null;
  mood: string | null;
  entry_date: string;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  category: string | null;
};

export type AiMemory = {
  id: string;
  user_id: string;
  memory_type: string | null;
  content: string;
  importance: number | null;
  created_at: string;
};
