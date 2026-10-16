import { FORUM_RULES } from "@/lib/forum/safety";

export function ForumGuidelinesContent() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-zinc-700">
      <p>These are the Kidda Community rules. Please read them before you post, reply, like, or vote.</p>
      <ol className="list-decimal space-y-2 pl-5">
        {FORUM_RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>
    </div>
  );
}
