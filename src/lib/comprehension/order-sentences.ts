import type { ComprehensionParagraph, ComprehensionSentence } from "./types";

/** Playback/read order: paragraphs in order, then sentences within each paragraph. Legacy orphan sentences last. */
export function orderSentencesForScript(
  paragraphs: ComprehensionParagraph[],
  sentences: ComprehensionSentence[]
): ComprehensionSentence[] {
  const paragraphsSorted = [...paragraphs].sort((a, b) => a.sequence_order - b.sequence_order);
  const byParagraph = new Map<string, ComprehensionSentence[]>();
  const orphans: ComprehensionSentence[] = [];

  for (const sentence of sentences) {
    if (sentence.paragraph_id) {
      const bucket = byParagraph.get(sentence.paragraph_id) ?? [];
      bucket.push(sentence);
      byParagraph.set(sentence.paragraph_id, bucket);
    } else {
      orphans.push(sentence);
    }
  }

  const ordered: ComprehensionSentence[] = [];
  for (const paragraph of paragraphsSorted) {
    const paragraphSentences = (byParagraph.get(paragraph.id) ?? []).sort(
      (a, b) => a.sequence_order - b.sequence_order
    );
    ordered.push(...paragraphSentences);
  }

  ordered.push(...orphans.sort((a, b) => a.sequence_order - b.sequence_order));
  return ordered;
}
