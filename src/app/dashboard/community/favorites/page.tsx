import { BackLink } from "@/components/navigation/back-link";
import { TutorFavoritesBrowser } from "@/components/community/tutor-favorites-browser";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import {
  loadRecommendedCatalog,
  loadTutorFavorites,
} from "@/lib/community/recommendations";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function CommunityFavoritesPage() {
  const { user, supabase } = await requireNoKidCommunityAccess();
  const isTutor = await canAccessTutorDashboard(supabase, user.id);
  if (!isTutor) redirect("/dashboard/community");

  const [{ media, recipes }, favorites] = await Promise.all([
    loadRecommendedCatalog(supabase),
    loadTutorFavorites(supabase, user.id),
  ]);

  return (
    <div className={ui.page}>
      <BackLink
        fallbackHref="/dashboard/community"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to Community
      </BackLink>

      <div className="mt-4 mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">My favorites</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Choose movies, books, and recipes to share with your students.
        </p>
      </div>

      <TutorFavoritesBrowser media={media} recipes={recipes} favorites={favorites} />
    </div>
  );
}
