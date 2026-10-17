import { CHECKIN_ALPHABET } from "@/lib/community/constants";

export function makeCheckinCode(byte: (index: number) => number = () => Math.floor(Math.random() * 256)): string {
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += CHECKIN_ALPHABET[byte(i) % CHECKIN_ALPHABET.length];
  }
  return code;
}

export function isCheckinCode(value: string): boolean {
  return value.length === 4 && [...value].every((char) => CHECKIN_ALPHABET.includes(char));
}

export function takeCheckinChars(value: string, limit = 4): string {
  return [...value.toUpperCase()].filter((char) => CHECKIN_ALPHABET.includes(char)).slice(0, limit).join("");
}

export function pickUnusedCode(taken: ReadonlySet<string>, nextCode: () => string, tries = 8): string {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const code = nextCode();
    if (!taken.has(code)) return code;
  }
  return nextCode();
}
