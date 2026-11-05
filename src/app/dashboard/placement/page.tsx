import { redirect } from "next/navigation";

/** The old test is gone. Practice sends anyone without a level to the level questions. */
export default function PlacementPage() {
  redirect("/dashboard/home");
}
