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
  relationships_note: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  fitness_goal: string | null;
  calorie_target: number | null;
  protein_target_g: number | null;
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

export type Document = {
  id: string;
  user_id: string;
  title: string;
  file_path: string;
  category: string | null;
  expires_at: string | null;
  reminder_days_before: number | null;
  uploaded_at: string;
};

export type Responsibility = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  due_date: string | null;
  recurrence: string | null;
  completed: boolean;
  created_at: string;
};

export type SecurityNote = {
  id: string;
  user_id: string;
  label: string;
  value: string;
  created_at: string;
};

export type Dream = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  order_index: number;
  created_at: string;
};

export type Milestone = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  date: string;
  category: string | null;
  created_at: string;
};

export type Asset = {
  id: string;
  user_id: string;
  name: string;
  category: "property" | "vehicle" | "business" | "other";
  estimated_value: number;
  notes: string | null;
  created_at: string;
};

export type KitchenItem = {
  id: string;
  user_id: string;
  name: string;
  quantity: string | null;
  expires_at: string | null;
  location: "fridge" | "pantry" | "freezer";
  category: string | null;
  created_at: string;
};

export type ShoppingListItem = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  quantity: string | null;
  checked: boolean;
  created_at: string;
};

export type NutritionEntry = {
  id: string;
  user_id: string;
  logged_at: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  water_ml: number | null;
  created_at: string;
};

export type WeightLogEntry = {
  id: string;
  user_id: string;
  logged_date: string;
  weight_kg: number;
  created_at: string;
};
