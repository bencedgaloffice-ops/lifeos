import { redirect } from "next/navigation";

/** The Life Map moved onto the home screen (/dashboard) as the default
 * "Map" tab — this route just forwards old links/bookmarks there. */
export default function LifeMapPageRedirect() {
  redirect("/dashboard");
}
