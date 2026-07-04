export function conversationAudioKey(scenarioId: string, gurmukhi: string): string {
  return `${scenarioId}:${gurmukhi.trim()}`;
}

export function lookupNpcAudio(
  npcAudioByKey: Record<string, string>,
  scenarioId: string,
  gurmukhi: string
): string | null {
  const url = npcAudioByKey[conversationAudioKey(scenarioId, gurmukhi)];
  return url?.trim() ? url : null;
}
