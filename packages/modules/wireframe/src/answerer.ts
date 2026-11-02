/**
 * **The answerer seam lives in core now** (`@isocan/core/jev`, voice-agent
 * phase 6): the talk module's fast path asks Jev the same way the composer
 * does, and one client in core is what keeps that true. This file stays so
 * the composer's imports did not move.
 */
export * from "@isocan/core/jev";
