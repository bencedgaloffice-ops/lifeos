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
  icsb_hourly_rate: number | null;
  onboarded: boolean;
  updated_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  life_area_id: string | null;
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
  organization_id: string | null;
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
  life_area_id: string | null;
  organization_id: string | null;
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
  organization_id: string | null;
  life_area_id: string | null;
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
  life_area_id: string | null;
  organization_id: string | null;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  source: "manual" | "google";
  category: string | null;
  priority: "low" | "medium" | "high" | null;
  location: string | null;
  reminder_minutes_before: number | null;
  subtype: string | null;
  recurrence_rule: string | null;
  parent_event_id: string | null;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GoogleCalendarConnection = {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  google_calendar_id: string;
  sync_token: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LifeArea = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Shift = {
  id: string;
  user_id: string;
  shift_type: "morning" | "afternoon" | "night" | "holiday" | "vacation" | "training";
  start_at: string;
  end_at: string;
  hourly_rate: number | null;
  notes: string | null;
  google_event_id: string | null;
  created_at: string;
};

export type Apiary = {
  id: string;
  user_id: string;
  organization_id: string | null;
  name: string;
  location_text: string | null;
  hive_count: number | null;
  notes: string | null;
  created_at: string;
};

export type HoneyHarvestLog = {
  id: string;
  user_id: string;
  apiary_id: string | null;
  hive_id: string | null;
  honey_type: string | null;
  harvest_date: string;
  quantity_kg: number;
  notes: string | null;
  created_at: string;
};

/* ---------------- Business Hub ---------------- */

export type Organization = {
  id: string;
  user_id: string;
  name: string;
  type: "employment" | "own_business" | "grant_project" | "future_venture" | null;
  description: string | null;
  logo: string | null;
  created_at: string;
  updated_at: string;
};

export type OrgLicense = {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  license_number: string | null;
  issuing_body: string | null;
  issued_date: string | null;
  expires_at: string | null;
  status: "active" | "pending_renewal" | "expired";
  notes: string | null;
  created_at: string;
};

export type Hive = {
  id: string;
  user_id: string;
  apiary_id: string;
  label: string;
  colony_status: "thriving" | "stable" | "weak" | "dead" | "split";
  queen_marked: boolean;
  queen_color: string | null;
  queen_installed_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type HiveInspection = {
  id: string;
  user_id: string;
  hive_id: string;
  inspection_date: string;
  findings: string | null;
  actions_taken: string | null;
  varroa_load: "none" | "low" | "moderate" | "high";
  disease_flag: boolean;
  feeding_needed: boolean;
  temperament: "calm" | "moderate" | "aggressive" | null;
  created_at: string;
};

export type Product = {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  category: "honey" | "wax" | "other";
  unit: string;
  price: number;
  stock_qty: number;
  created_at: string;
};

export type Customer = {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  contact_info: string | null;
  notes: string | null;
  created_at: string;
};

export type Order = {
  id: string;
  user_id: string;
  organization_id: string;
  customer_id: string | null;
  order_date: string;
  status: "pending" | "fulfilled" | "cancelled";
  total_amount: number;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
};

export type GrantApplication = {
  id: string;
  user_id: string;
  organization_id: string;
  program_name: string;
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected";
  submitted_date: string | null;
  decision_date: string | null;
  amount_requested: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GrantCorrespondence = {
  id: string;
  user_id: string;
  grant_application_id: string;
  contact_name: string | null;
  direction: "incoming" | "outgoing";
  subject: string | null;
  body: string | null;
  occurred_at: string;
};

export type MasterplanPhase = {
  id: string;
  user_id: string;
  organization_id: string;
  phase_number: number;
  title: string;
  description: string | null;
  status: "not_started" | "in_progress" | "done";
  target_date: string | null;
  created_at: string;
};

/* ---------------- Life modules ---------------- */

export type LegacyIdentity = {
  id: string;
  user_id: string;
  emblem_name: string | null;
  emblem_meaning: string | null;
  emblem_image_url: string | null;
  scripture_reference: string | null;
  scripture_text: string | null;
  scripture_language: "en" | "hu";
  family_story: string | null;
  updated_at: string;
};

export type FamilyMember = {
  id: string;
  user_id: string;
  name: string;
  relation: string | null;
  birth_year: number | null;
  death_year: number | null;
  story: string | null;
  photo_url: string | null;
  order_index: number;
  created_at: string;
};

export type Relationship = {
  id: string;
  user_id: string;
  partner_name: string | null;
  relationship_start_date: string | null;
  engagement_date: string | null;
  wedding_date: string | null;
  notes: string | null;
  updated_at: string;
};

export type WeddingTask = {
  id: string;
  user_id: string;
  relationship_id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  status: "todo" | "in_progress" | "done";
  notes: string | null;
  created_at: string;
};

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  cadence: "daily" | "weekly" | "custom";
  target_per_period: number;
  icon: string | null;
  color: string | null;
  active: boolean;
  created_at: string;
};

export type HabitLog = {
  id: string;
  user_id: string;
  habit_id: string;
  log_date: string;
  completed: boolean;
  notes: string | null;
  created_at: string;
};

export type LifeMapLocation = {
  id: string;
  user_id: string;
  name: string;
  category: "home" | "agriculture" | "work" | "travel" | "other";
  description: string | null;
  position_x: number;
  position_y: number;
  life_area_id: string | null;
  organization_id: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type VisionCard = {
  id: string;
  user_id: string;
  goal_id: string | null;
  organization_id: string | null;
  title: string;
  image_url: string | null;
  target_date: string | null;
  category: "personal" | "business";
  progress_override: number | null;
  notes: string | null;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  z_index: number;
  created_at: string;
  updated_at: string;
};

export type HabitEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  bible_study: boolean;
  workout: boolean;
  water_ml: number | null;
  mood: number | null;
  energy: number | null;
  focus_score: number | null;
  notes: string | null;
  created_at: string;
};

/** A single concrete occurrence rendered on the calendar, merged from every
 * source module. `editable` is false for read-only linked items (e.g. a
 * goal's target date) — dragging those calls back into their own module's
 * update action rather than mutating calendar_events. */
export type CalendarItem = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  icon: string;
  kind: "event" | "shift" | "goal" | "project" | "document" | "responsibility" | "milestone";
  editable: boolean;
  sourceTable: string;
  sourceId: string;
  priority: "low" | "medium" | "high" | null;
  location: string | null;
  description: string | null;
  recurrenceRule: string | null;
  isRecurringInstance: boolean;
  lifeAreaId: string | null;
  organizationId: string | null;
  reminderMinutesBefore: number | null;
  subtype: string | null;
  fromGoogle: boolean;
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
  life_area_id: string | null;
  title: string;
  file_path: string;
  category: string | null;
  expires_at: string | null;
  reminder_days_before: number | null;
  organization_id: string | null;
  garage_vehicle_id: string | null;
  tags: string[];
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
  /** When it was bought — drives freshness/aging, not just the expiry date. */
  purchase_date: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  /** What it cost, in HUF — feeds the Treasury grocery-spend link. */
  price_huf: number | null;
  /** Which chain it came from. */
  store_id: string | null;
};

/** A Hungarian grocery chain (shared reference data, read-only to users). */
export type Store = {
  id: string;
  slug: string;
  name: string;
  kind: "hypermarket" | "discount" | "wholesale" | "supermarket";
  /** 1 = cheapest .. 3 = priciest */
  price_level: number;
  color: string;
  country: string;
  strengths: string | null;
  created_at: string;
};

/** A price the user actually observed for an item at a given chain. */
export type StorePrice = {
  id: string;
  user_id: string;
  store_id: string;
  item_name: string;
  unit: string | null;
  price_huf: number;
  observed_at: string;
  created_at: string;
  /** 'observed' = the user saw this on a shelf. 'ai_estimate' = researched. */
  source: "observed" | "ai_estimate";
  /** How sure the research was, 0–100. Null for observed prices. */
  confidence: number | null;
  note: string | null;
};

/** A saved YouTube / YouTube Music station for the Kitchen player. */
export type MusicStation = {
  id: string;
  user_id: string;
  label: string;
  kind: "video" | "playlist";
  youtube_id: string;
  sort_order: number;
  created_at: string;
};

export type Recipe = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  steps: string[];
  minutes: number | null;
  servings: number;
  calories: number | null;
  protein_g: number | null;
  cuisine: string | null;
  is_favourite: boolean;
  created_at: string;
};

export type RecipeIngredient = {
  id: string;
  recipe_id: string;
  name: string;
  quantity: string | null;
  optional: boolean;
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
  /** Which chain to buy this at (cheapest known, or user's choice). */
  store_id: string | null;
  estimated_price_huf: number | null;
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

/** Free-form, data-driven vehicle specifications. The 3D engine and the
 * holographic panel read whatever keys are present, so the catalog can grow
 * to thousands of vehicles with no code change — new fields are just data. */
export type VehicleSpecs = {
  country?: string;
  fuel?: string;
  transmission?: string;
  engine?: string;
  horsepower?: number;
  vin?: string;
  drivetrain?: string;
  color?: string;
  [key: string]: string | number | undefined;
};

export type GarageVehicle = {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  year: number | null;
  mileage: number | null;
  value: number | null;
  purchase_price: number | null;
  image_url: string | null;
  /** URL of a standardized GLB model loaded dynamically by the 3D engine. */
  model_url: string | null;
  specs: VehicleSpecs;
  notes: string | null;
  links: string[];
  created_at: string;
  updated_at: string;
};

export type GarageServiceRecord = {
  id: string;
  user_id: string;
  vehicle_id: string;
  service_date: string;
  description: string;
  cost: number | null;
  mileage_at_service: number | null;
  created_at: string;
};

export type GarageDreamVehicle = {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  year: number | null;
  image_url: string | null;
  model_url: string | null;
  estimated_price: number | null;
  priority_rating: number;
  purchase_goal: string | null;
  target_date: string | null;
  notes: string | null;
  created_at: string;
};

export type GarageDealStage = "found" | "inspection" | "purchase" | "transport" | "registration" | "ready_for_sale" | "sold";

export type GarageImportDeal = {
  id: string;
  user_id: string;
  organization_id: string | null;
  brand: string;
  model: string;
  year: number | null;
  image_url: string | null;
  model_url: string | null;
  stage: GarageDealStage;
  purchase_price: number;
  transport_cost: number;
  registration_cost: number;
  repair_cost: number;
  expected_selling_price: number;
  actual_selling_price: number | null;
  notes: string | null;
  links: string[];
  created_at: string;
  updated_at: string;
};
