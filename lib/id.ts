import { nanoid, customAlphabet } from "nanoid";

export function createId() {
  return nanoid(16);
}

export function now() {
  return Date.now();
}

const communityUid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

export function createCommunityUid() {
  return communityUid();
}

export function createInviteToken() {
  return nanoid(12);
}

export function normalizeCommunityUid(raw: string) {
  return raw.trim().replace(/[\s-]/g, "").toUpperCase();
}

export function looksLikeCommunityUid(raw: string) {
  const uid = normalizeCommunityUid(raw);
  return uid.length >= 4 && uid.length <= 6 && /^[2-9A-HJ-NP-Z]+$/.test(uid);
}
