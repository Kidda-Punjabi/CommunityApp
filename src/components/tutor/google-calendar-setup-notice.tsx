import { getGoogleCalendarRedirectUri } from "@/lib/calendar/google-oauth";

export function GoogleCalendarSetupNotice() {
  const redirectUri = getGoogleCalendarRedirectUri();

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
      <p className="font-semibold">Connect Google Calendar — one-time setup</p>
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
          Add this <strong>Authorized redirect URI</strong>:
          <code className="mt-1 block break-all rounded-lg bg-white/80 px-2 py-1.5 text-xs">
            {redirectUri}
          </code>
        </li>
        <li>
          Add these to <code className="text-xs">.env.local</code> and restart{" "}
          <code className="text-xs">npm run dev</code>:
          <pre className="mt-1 overflow-x-auto rounded-lg bg-white/80 px-2 py-1.5 text-xs leading-relaxed">
{`GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret`}
          </pre>
        </li>
      </ol>
      <p className="mt-3 text-xs text-amber-800">
        Redirect URI is derived from <code>NEXT_PUBLIC_APP_URL</code> — you only need to set{" "}
        <code>GOOGLE_CALENDAR_REDIRECT_URI</code> if you use a custom callback URL.
      </p>
    </div>
  );
}
