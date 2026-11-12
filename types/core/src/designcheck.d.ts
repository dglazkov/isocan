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
import { type DesignDoc } from "./designmd.js";
/**
 * Is this design system usable, or just written down?
 *
 * A style guide fails quietly: a colour that no longer parses, a reference to
 * a token somebody renamed, an accent that cannot carry text on its own
 * ground. None of it announces itself — the screens simply drift, and by then
 * the guide is the thing nobody trusts.
 *
 * So the checks are the ones a machine can be right about: shapes, references,
 * and arithmetic. Whether a palette is any GOOD is not in here and should not
 * be; that is what the prose and a person are for.
 */
type DesignSeverity = "error" | "warning" | "note";
interface DesignFinding {
    severity: DesignSeverity;
    /** Where it is: a token path, a section name, or "front matter". */
    where: string;
    what: string;
    /** What to do, when there is a single obvious answer. */
    fix?: string;
}
/**
 * **Read board tile citations from `tokens.isocan.sources`** (moodboard phase 3,
 * design §5) — maps token paths (`colors.<name>`) and direction fields
 * (`direction.<field>`, `direction.treatments.<name>`) to the `itemId` of the
 * kept or reference tile each came from. Returns `{}` when absent or malformed.
 */
export declare function readDesignSources(doc: DesignDoc | undefined | null): Record<string, string>;
export declare function checkDesign(doc: DesignDoc, options?: {
    boardTileIds?: ReadonlySet<string>;
}): DesignFinding[];
/** Worst first, so a report leads with what matters. */
export declare function bySeverity(findings: DesignFinding[]): DesignFinding[];
export {};
