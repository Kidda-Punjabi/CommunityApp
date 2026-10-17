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
