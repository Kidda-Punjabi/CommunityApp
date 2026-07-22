import { NextResponse } from "next/server";
import { saveMatchScoreIfBest } from "@/lib/progress/match-scores";
import { createClient } from "@/lib/supabase/server";

type MatchScoreBody = {
  deckName?: string;
  score?: number;
  timeSeconds?: number;
  totalPairs?: number;
};

export async function POST(request: Request) {
  let body: MatchScoreBody;
  try {
    body = (await request.json()) as MatchScoreBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const deckName = body.deckName?.trim() ?? "";
  const score = body.score;
  const timeSeconds = body.timeSeconds;
  const totalPairs = body.totalPairs;

  if (
    !deckName ||
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < 0 ||
    typeof timeSeconds !== "number" ||
    !Number.isFinite(timeSeconds) ||
    timeSeconds < 0 ||
    typeof totalPairs !== "number" ||
    !Number.isFinite(totalPairs) ||
    totalPairs < 1
  ) {
    return NextResponse.json({ error: "Invalid match score payload." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const outcome = await saveMatchScoreIfBest(
      supabase,
      user.id,
      deckName,
      Math.floor(score),
      Math.floor(timeSeconds),
      Math.floor(totalPairs)
    );

    console.info("[match-score]", {
      userId: user.id,
      deckName,
      score: Math.floor(score),
      isNewBest: outcome.isNewBest,
      saved: outcome.saved,
    });

    return NextResponse.json(outcome);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save score";
    console.error("[match-score] save failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
