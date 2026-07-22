/**
 * Public Supabase connection details.
 *
 * The URL and the *publishable* anon key are designed to be shipped to the
 * browser — every table is protected by Row Level Security, so a user can only
 * ever read or write their own rows. Real secrets (service role key) are never
 * referenced here. Values can be overridden with NEXT_PUBLIC_* env vars.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://aeatdolnaevmkkgvrffs.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_z9-NnuFSm7XGgd5d3-Vhlw_k2G7R96V";
