import { AdminPublicFormsView } from "@/components/admin/public-forms/admin-public-forms-view";
import { loadPublicFormCatalog } from "@/lib/admin/load-public-form-catalog";

export const dynamic = "force-dynamic";

export default async function AdminPublicFormsPage() {
  const catalog = await loadPublicFormCatalog();
  return <AdminPublicFormsView catalog={catalog} />;
}
