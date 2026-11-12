/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Where a skill comes from.
 *
 * A slash command's body is a skill, which is why any published one can become
 * a command here. What stands between "one pipe away" and "one word away" is
 * this: turning what a person actually has — a repo path they read in a
 * README, or a URL they copied out of the address bar — into the file itself.
 *
 * It refuses anything it cannot name a source for. Installing a skill is
 * putting instructions in front of every future agent on this canvas, so
 * "where did this come from" has to have an answer, and that answer has to be
 * shown to somebody before it lands.
 */
interface SkillSource {
    /** The raw file to fetch. */
    url: string;
    /** How to describe the origin to a person, e.g. "mattpocock/skills". */
    label: string;
}
/**
 * Accepts:
 *   owner/repo/path/to/SKILL.md          — the default branch
 *   https://github.com/o/r/blob/ref/p.md — what the address bar gives you
 *   https://…/anything.md                — any https URL
 */
export declare function skillSource(ref: string): SkillSource | null;
/** A name for the command, when the person did not give one: the skill's own
 * directory (`…/grilling/SKILL.md` → `grilling`), else the filename. */
export declare function skillNameFrom(ref: string): string | null;
export {};
