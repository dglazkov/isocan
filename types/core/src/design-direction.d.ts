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
/** Authored direction documents reusable decisions; its declared stage does not authenticate a human preference. */
export interface DesignDirection {
    version: 1;
    stage: "provisional" | "accepted";
    requestId?: string;
    rationale: string;
    taskHierarchy: string[];
    layout: string;
    density: string;
    typography: string;
    palettePurpose: string;
    treatments: Array<{
        name: string;
        guidance: string;
        states: string[];
    }>;
}
/** Unknown direction versions or fields are refused instead of being mistaken for supported design guidance. */
export declare function parseDesignDirection(value: unknown): DesignDirection;
/** Reading never upgrades a malformed or agent-authored declaration into an accepted human decision. */
export declare function readDesignDirection(doc: DesignDoc): {
    status: "absent";
} | {
    status: "valid";
    direction: DesignDirection;
} | {
    status: "malformed";
    problems: string[];
};
/** Updates only the native direction extension; lint contracts, opaque sibling data and document prose survive. */
export declare function withDesignDirection(doc: DesignDoc, direction: DesignDirection): DesignDoc;
