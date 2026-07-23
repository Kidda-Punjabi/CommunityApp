# kidda.app domain cutover — verification checklist

Prep work in this repo only. DNS, Vercel domain settings, Supabase Auth URLs,
Stripe webhook endpoint, and Google OAuth client config are handled outside
the repo (Gurupma). Use this list after `kidda.app` is pointed at this Next.js
app and `NEXT_PUBLIC_APP_URL=https://kidda.app` is set in Vercel production.

## Before traffic cutover

- [ ] Vercel: custom domain `kidda.app` (+ `www` if used) attached to this project; TLS valid
- [ ] Vercel env: `NEXT_PUBLIC_APP_URL=https://kidda.app` (Production; Preview if testing on a custom preview host)
- [ ] Supabase Auth: Site URL + Redirect URLs include `https://kidda.app` and `https://kidda.app/auth/callback`
- [ ] Stripe: webhook endpoint URL updated to `https://kidda.app/api/stripe/webhook` (or dual-write briefly)
- [ ] Google Calendar OAuth: authorized redirect URI includes `https://kidda.app/api/google/calendar/callback`; JavaScript origin `https://kidda.app`
- [ ] Confirm GHL funnels are no longer served from `kidda.app` (moved e.g. to `kidda.co.uk`) so app routes are not hijacked
- [ ] If still using `NEXT_PUBLIC_COURSE_URL_*`, point them at the new GHL host (or leave empty to use in-app `/courses/*`)

## Staging / smoke on kidda.app

### Marketing & legal

- [ ] `https://kidda.app/` loads this app’s marketing home (not GHL)
- [ ] `https://kidda.app/courses`, `/courses/foundational`, `/beginners`, `/community` load product pages
- [ ] `https://kidda.app/privacy` loads the Privacy Policy page
- [ ] Product page footer “Privacy Policy” link goes to `/privacy` (same origin)

### Auth

- [ ] Signup with a new email; confirmation link lands on `https://kidda.app/auth/callback` and completes
- [ ] Login / logout
- [ ] Forgot password email link uses `kidda.app` and completes reset
- [ ] Account invite email (if used) redirect uses `kidda.app`

### Checkout & Stripe

- [ ] Start checkout from a course page; success/cancel return to `kidda.app` URLs
- [ ] Embedded checkout return (if used) returns to `kidda.app`
- [ ] Billing portal return URL is `https://kidda.app/dashboard/profile/billing`
- [ ] Stripe Dashboard → Webhooks: recent events deliver `2xx` to the `kidda.app` endpoint
- [ ] After a test purchase, course access unlocks in the dashboard

### Calendar OAuth (tutors)

- [ ] Tutor “Connect Google Calendar” starts OAuth and returns to `https://kidda.app/api/google/calendar/callback`
- [ ] Reconnect / disconnect still works after cutover

### Referrals & share links

- [ ] Referral share URL is `https://kidda.app/signup?ref=...` (or current host via `getShareAppUrl`)
- [ ] Opening that link pre-fills / attributes referral correctly
- [ ] Battle invite link (client `window.location.origin`) shares as `https://kidda.app/dashboard/battle?code=...`

### Book a call

- [ ] `/book-call` still embeds the LeadConnector widget (third-party; independent of kidda.app host)

### Regression spot-checks

- [ ] Dashboard home, Learn, membership/courses list
- [ ] Mobile + desktop login
- [ ] No mixed redirects back to `*.vercel.app` for auth or Stripe returns when using the custom domain

## After cutover

- [ ] Monitor Stripe webhook failures for 24–48h
- [ ] Monitor Supabase auth email delivery / bounce for wrong redirect hosts
- [ ] Remove or keep Vercel default URL as fallback only; ensure emails and Stripe no longer prefer the old host
- [ ] Update any external docs/bookmarks that still cite the Vercel URL as “the app”

## Out of scope for this checklist (handled externally)

- Cloudflare / DNS records for `kidda.app`
- Moving GHL sites to `kidda.co.uk` (or elsewhere)
- Stripe Dashboard webhook secret rotation (unless endpoint changes require it)
- Google Cloud Console OAuth client edits
- Supabase dashboard Auth URL edits
