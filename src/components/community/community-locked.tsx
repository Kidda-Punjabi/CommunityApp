/**
 * Shown on the Community tab (and forum) to anyone without a Community membership.
 *
 * App store rules: in the native apps there is no button, link or mention of where to buy.
 * Apple guideline 3.1.1 forbids calls to action that send people to buy outside in-app purchase
 * (outside the US storefront), and live group classes count as one-to-many services. Members who
 * bought on the website can still use Community in the app (multiplatform services).
 * The "Find out more" button is for the web app only.
 */
export function CommunityLocked({ native }: { native: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3.5 px-3 text-center">
      <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#F3EEFF]">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5B21B6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="5" y="11" width="14" height="10" rx="2.5" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <h2 className="font-heading text-[22px] font-extrabold text-[#1F1640]">Community is locked</h2>
      <p className="max-w-sm text-base leading-relaxed text-[#4A3F66]">
        Weekly live sessions with Kidda tutors, where you practise speaking Punjabi in small groups at your level.
      </p>
      {native ? null : (
        <a
          href="https://kidda.app/community"
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex min-h-[54px] w-full max-w-[300px] items-center justify-center rounded-[18px] bg-[#5B21B6] text-base font-extrabold text-white"
        >
          Find out more
        </a>
      )}
    </div>
  );
}
