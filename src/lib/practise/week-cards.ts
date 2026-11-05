/** Turns flashcard text into something a practice round can use. Anything unclear is left out. */
export type WeekCard = { id: string; front_text: string; back_text: string; romanised: string | null };
export type WeekItem = { id: string; kind: "word" | "sentence"; e: string; g: string; r: string };

const GURMUKHI = /[਀-੿]/;
const NOT_A_TRANSLATION = /___|→|\[|\bAux\b|definition|formula|\bWhy\b|How do you|irregular|marker|ending|\brule\b/i;

/** "ਕਰਦਾ/ਕਰਦੀ" and "karda / kardi" become the first form. Unrelated alternatives return null. */
function firstForm(text: string): string | null {
  if (!text.includes("/")) return text.trim();
  let unclear = false;
  const out = text.replace(/(\S+)\s*\/\s*(\S+)/g, (_, a: string, b: string) => {
    if (a[0] !== b[0]) unclear = true;
    return a;
  });
  return unclear ? null : out.replace(/\s+/g, " ").trim();
}

function build(id: string, e: string, rawG: string, rawR: string): WeekItem | null {
  const g = firstForm(rawG);
  const r = firstForm(rawR) ?? "";
  if (!e.trim() || !g || !GURMUKHI.test(g) || /[A-Za-z]/.test(g)) return null;
  return { id, kind: g.split(/\s+/).length <= 2 ? "word" : "sentence", e: e.trim(), g, r };
}

export function parseWeekCard(card: WeekCard): WeekItem | null {
  const front = card.front_text.trim();
  const back = card.back_text.trim();
  if (back.includes("→") || back.includes("[")) return null;

  // Week 1 style: "ਤੁਹਾਡਾ ਨਾਮ ਕੀ ਹੈ? (Tuhada naam ki hai?) — What's your name?"
  const asked = front.match(/^([^()]+)\(([^)]+)\)\s*—\s*(.+)$/);
  if (asked && GURMUKHI.test(asked[1]) && !front.includes("[")) return build(card.id, asked[3], asked[1], asked[2]);

  if (GURMUKHI.test(front) || NOT_A_TRANSLATION.test(front)) return null;

  // Numbers: "੨੫ — ਪੱਚੀ"
  const number = back.match(/^[੦-੯]+\s*—\s*(.+)$/);
  if (number) return build(card.id, front, number[1], card.romanised ?? "");

  if (back.includes("—")) return null;
  const bracket = back.indexOf("(");
  const g = bracket > 0 ? back.slice(0, bracket) : back;
  const fromBrackets = bracket > 0 ? (back.slice(bracket + 1).match(/^[^)]*/)?.[0] ?? "") : "";
  return build(card.id, front, g, card.romanised ?? fromBrackets);
}

/** One entry per English prompt, so duplicate decks don't count twice. */
export function weekItemsFromCards(cards: WeekCard[]): WeekItem[] {
  const seen = new Set<string>();
  const out: WeekItem[] = [];
  for (const card of cards) {
    const item = parseWeekCard(card);
    if (!item) continue;
    const key = item.e.toLowerCase().replace(/[.?!\s]+$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
