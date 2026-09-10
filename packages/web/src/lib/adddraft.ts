import { classifyAddable, looksLikeSite, type Addable } from "@isocan/core";

/** A field is an unfinished paste. Keep an incomplete address as a draft;
 * submit still validates it through normalizeSiteUrl before any request.
 * Only a site-like draft falls back to kind "site" (normalizeSiteUrl is the
 * one thrower, and only for input that reads as an address) — any other
 * error is a real bug and propagates. */
export function classifyAddableDraft(...args: Parameters<typeof classifyAddable>): Addable {
  try {
    return classifyAddable(...args);
  } catch (error) {
    const draft = args[0].trim();
    if (looksLikeSite(draft)) return { kind: "site", url: draft };
    throw error;
  }
}
