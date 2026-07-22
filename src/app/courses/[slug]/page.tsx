import { ProductLanding } from "@/components/products/product-landing";
import { courseIdsForTiers } from "@/lib/membership/courses";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import {
  getProductContent,
  PRODUCT_SLUGS,
  type ProductSlug,
} from "@/lib/products/content";
import { loadUserStudentDiscountRequests } from "@/lib/student-discounts/load-requests";
import type { StudentDiscountRequestView } from "@/lib/student-discounts/types";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type CoursePageProps = {
  params: Promise<{ slug: string }>;
};

function isProductSlug(slug: string): slug is ProductSlug {
  return PRODUCT_SLUGS.includes(slug as ProductSlug);
}

export async function generateStaticParams() {
  return PRODUCT_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isProductSlug(slug)) return { title: "Course | Kidda" };
  const content = getProductContent(slug);
  return {
    title: `${content.heroTitle} | Kidda`,
    description: content.heroSubtitle,
  };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  if (!isProductSlug(slug)) notFound();

  const content = getProductContent(slug);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let owned = false;
  if (user) {
    const access = await getCourseAccessContext(supabase, user);
    const ids = courseIdsForTiers(access.courses, [content.tier]);
    owned = [...ids].some((id) => access.unlockedCourseIds.has(id));
  }

  let studentDiscountRequests: StudentDiscountRequestView[] = [];
  let studentDiscountRequestsLoadFailed = false;
  if (user && slug === "beginners") {
    const discountLoad = await loadUserStudentDiscountRequests(supabase, user.id);
    studentDiscountRequests = discountLoad.requests;
    studentDiscountRequestsLoadFailed = discountLoad.loadFailed;
  }

  return (
    <ProductLanding
      content={content}
      isLoggedIn={Boolean(user)}
      owned={owned}
      studentDiscountRequests={studentDiscountRequests}
      studentDiscountRequestsLoadFailed={studentDiscountRequestsLoadFailed}
    />
  );
}
