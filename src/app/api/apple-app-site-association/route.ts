import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const teamId = process.env.APPLE_TEAM_ID?.trim() || "TEAM_ID";
  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.app.kidda`,
          paths: ["/auth/*", "/reset-password*", "/forgot-password*", "/login*"],
        },
      ],
    },
  };

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
