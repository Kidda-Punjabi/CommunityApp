# webapp.kidda.app — additive custom domain (GHL keeps kidda.app)

Prep after `webapp.kidda.app` is attached in Vercel and
`NEXT_PUBLIC_APP_URL=https://webapp.kidda.app` is set in Production (and Preview if needed).

Root `kidda.app` stays on GoHighLevel — do not point app traffic there.
`community-app-v2-eosin.vercel.app` must keep working in parallel (no forced redirect away yet).

- [ ] If still using `NEXT_PUBLIC_COURSE_URL_*`, point them at the new GHL host (or leave empty to use in-app `/courses/*`)
## Before sharing with students

- [ ] Vercel: custom domain `webapp.kidda.app` attached; TLS valid
- [ ] Vercel env: `NEXT_PUBLIC_APP_URL=https://webapp.kidda.app` (Production)
- [ ] Supabase Auth Site URL: `https://webapp.kidda.app`
- [ ] Supabase Auth Redirect URLs include (keep vercel.app entries too):
  - `https://webapp.kidda.app/**`
  - `https://webapp.kidda.app/auth/callback`
  - `https://community-app-v2-eosin.vercel.app/**`
  - `https://community-app-v2-eosin.vercel.app/auth/callback`
- [ ] Google Calendar OAuth authorized redirect URI (add, do not remove old):
  - `https://webapp.kidda.app/api/google/calendar/callback`
  - keep `https://community-app-v2-eosin.vercel.app/api/google/calendar/callback` if tutors still connect via vercel.app
- [ ] Google OAuth JavaScript origin: `https://webapp.kidda.app`
- [ ] Stripe checkout success/cancel already use `getPublicAppUrl()` — no code change once env is set
- [ ] Stripe webhook can stay on vercel.app until you dual-add webapp (optional; webhooks hit whichever URL Stripe is configured with)

## Smoke on webapp.kidda.app

### Auth
- [ ] Signup → confirmation email → lands on `https://webapp.kidda.app/auth/callback` and completes
- [ ] Login / logout
- [ ] Forgot password link uses `webapp.kidda.app`

### Checkout
- [ ] Start checkout; success/cancel return to `webapp.kidda.app` URLs
- [ ] Billing portal return is `https://webapp.kidda.app/dashboard/profile/billing`

### Calendar
- [ ] Tutor Connect Google Calendar returns to `https://webapp.kidda.app/api/google/calendar/callback`

### Referrals
- [ ] Share / invite links use `https://webapp.kidda.app/...` when generated from server env

### Parallel host
- [ ] `https://community-app-v2-eosin.vercel.app` still loads and can log in (additive only)

## Out of scope here
- GHL / `kidda.app` DNS
- Removing the Vercel default hostname
