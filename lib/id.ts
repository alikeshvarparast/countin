import { nanoid } from "nanoid";

export function createId() {
  return nanoid(16);
}

export function now() {
  return Date.now();
}
