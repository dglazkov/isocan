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
import type { CanvasState, Item } from "./model.js";
import type { GroupAction } from "./canvas-group-types.js";
/** Shared arrangement targets footprints; attached marks never receive a competing layout slot. */
export declare function groupArrangeAction(state: CanvasState, itemIds: readonly string[], options: {
    kind: "align";
    edge: "left" | "right" | "top" | "bottom" | "center" | "middle" | "hcenter" | "vcenter";
} | {
    kind: "distribute";
    axis: "h" | "v";
} | {
    kind: "tidy";
    perRow?: number;
    gap?: number;
    mode?: "smart" | "grid" | "in-place";
    containerId?: string;
    chrome?: (item: Item) => {
        above: number;
        below: number;
    };
    tolerance?: number;
}): Extract<GroupAction, {
    kind: "transform";
}>;
/** Content-fit settles only normalized targets against sibling placement units in the same scope. */
export declare function groupFitAction(state: CanvasState, targets: readonly {
    itemId: string;
    width?: number;
    height?: number;
}[]): Extract<GroupAction, {
    kind: "frame";
}>;
