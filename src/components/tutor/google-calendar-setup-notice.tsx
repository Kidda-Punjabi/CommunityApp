import { getGoogleCalendarRedirectUri } from "@/lib/calendar/google-oauth";
import { getPublicAppUrl } from "@/lib/app-url";

type GoogleCalendarSetupNoticeProps = {
  /** Show Google Cloud + env var instructions (admins / local dev). */
  showAdminSetup?: boolean;
};

export function GoogleCalendarSetupNotice({
  showAdminSetup = false,
}: GoogleCalendarSetupNoticeProps) {
  const appUrl = getPublicAppUrl();
  const redirectUri = getGoogleCalendarRedirectUri();
  const isLocalDev = appUrl.includes("localhost");

  if (!showAdminSetup) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
        <p className="font-semibold">Google Calendar isn&apos;t available yet</p>
        <p className="mt-2">
          Calendar sync hasn&apos;t been turned on for this site. Please contact your Kidda admin —
          they need to complete a one-time Google setup on the server.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
      <p className="font-semibold">Google Calendar — one-time server setup</p>
      <p className="mt-2 text-amber-900">
        Tutors connect their own Google accounts after this is configured. These steps are for
        whoever deploys the app (Vercel / server admin), not for individual tutors.
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          In{" "}
          <a
            href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            Google Cloud Console
          </a>
          , enable the <strong>Google Calendar API</strong>.
        </li>
        <li>
          Create an <strong>OAuth client ID</strong> (type: Web application) under Credentials.
        </li>
        <li>
          Add this <strong>Authorized JavaScript origin</strong>:
          <code className="mt-1 block break-all rounded-lg bg-white/80 px-2 py-1.5 text-xs">
            {appUrl}
          </code>
        </li>
        <li>
          Add this <strong>Authorized redirect URI</strong>:
          <code className="mt-1 block break-all rounded-lg bg-white/80 px-2 py-1.5 text-xs">
            {redirectUri}
          </code>
        </li>
        <li>
          {isLocalDev ? (
            <>
              Add these to <code className="text-xs">.env.local</code> and restart{" "}
              <code className="text-xs">npm run dev</code>:
            </>
          ) : (
            <>
              In <strong>Vercel → Project → Settings → Environment Variables</strong>, add:
            </>
          )}
          <pre className="mt-1 overflow-x-auto rounded-lg bg-white/80 px-2 py-1.5 text-xs leading-relaxed">
{`GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_APP_URL=${appUrl}`}
          </pre>
          {isLocalDev ? null : (
            <p className="mt-1 text-xs text-amber-800">
              Redeploy after saving. Apply to Production (and Preview if tutors test on preview URLs).
            </p>
          )}
        </li>
      </ol>
      <p className="mt-3 text-xs text-amber-800">
        Redirect URI defaults to <code>{redirectUri}</code> from{" "}
        <code>NEXT_PUBLIC_APP_URL</code>. Set <code>GOOGLE_CALENDAR_REDIRECT_URI</code> only if you
        use a custom callback URL.
      </p>
    </div>
  );
}
