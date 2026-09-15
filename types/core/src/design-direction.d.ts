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
