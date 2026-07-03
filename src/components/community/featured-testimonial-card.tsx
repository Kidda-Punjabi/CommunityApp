import { EyebrowLabel, HubCard } from "@/components/ui/hub-primitives";
import type { FeaturedTestimonial } from "@/lib/community/load-featured-testimonial";

type FeaturedTestimonialCardProps = {
  testimonial: FeaturedTestimonial;
};

export function FeaturedTestimonialCard({ testimonial }: FeaturedTestimonialCardProps) {
  return (
    <HubCard className="border-violet-200 bg-violet-50">
      <EyebrowLabel>Featured story of the week</EyebrowLabel>
      <blockquote className="mt-3 text-sm leading-relaxed text-zinc-800">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <p className="mt-4 text-sm font-medium text-zinc-900">{testimonial.authorName}</p>
      <p className="mt-0.5 text-sm text-zinc-600">{testimonial.contextLine}</p>
    </HubCard>
  );
}
