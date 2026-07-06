import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function hashKidsPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(pin, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyKidsPin(pin: string, storedHash: string | null): Promise<boolean> {
  if (!storedHash || !isValidPin(pin)) return false;
  const [salt, hashHex] = storedHash.split(":");
  if (!salt || !hashHex) return false;

  try {
    const derived = (await scryptAsync(pin, salt, KEY_LENGTH)) as Buffer;
    const expected = Buffer.from(hashHex, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
