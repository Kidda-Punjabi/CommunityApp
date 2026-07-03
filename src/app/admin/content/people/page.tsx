import { redirect } from "next/navigation";
import { AdminPeopleHub } from "@/components/admin/admin-people-hub";

type AdminPeoplePageProps = {
  searchParams: Promise<{ tab?: string }>;
};

const LEGACY_TAB_PATHS: Record<string, string> = {
  cohorts: "/admin/content/people/cohorts",
  members: "/admin/content/people/members",
  payments: "/admin/content/people/payments",
  "student-discounts": "/admin/content/people/discounts",
  staff: "/admin/content/people/staff",
};

export default async function AdminPeoplePage({ searchParams }: AdminPeoplePageProps) {
  const { tab } = await searchParams;

  if (tab && LEGACY_TAB_PATHS[tab]) {
    redirect(LEGACY_TAB_PATHS[tab]);
  }

  return <AdminPeopleHub />;
}
