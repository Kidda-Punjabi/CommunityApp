import { AdminPeopleSection } from "@/components/admin/sections/admin-people-section";

type AdminPeoplePageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function AdminPeoplePage({ searchParams }: AdminPeoplePageProps) {
  const { tab } = await searchParams;

  return <AdminPeopleSection initialTab={tab} />;
}
