import { hash, verify } from "@node-rs/argon2";

// Algorithm.Argon2id — const enum ambiente, inacessível com isolatedModules
const ARGON2ID = 2;

// RNF-06 — argon2id (parâmetros OWASP: m=19456 KiB, t=2, p=1)
const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password, OPTIONS);
  } catch {
    return false;
  }
}
