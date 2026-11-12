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
import type { CanvasContents, Comment, CommentThread, Item } from "./model.js";
/**
 * Live items explicitly linked by a message, suitable for current previews.
 * A saved request owns its roots: the writer's comment.items also contains
 * expanded descendants and must not be mistaken for additional references.
 * This neither changes frozen context nor claims that the message made an item.
 */
export declare function commentReferencedItemIds(canvas: CanvasContents, comment: Pick<Comment, "items" | "context">): string[];
/**
 * The live item a thread is working on: its anchor item first, then any
 * explicit item ids carried on the summoning comment, then the most recent
 * comment in the thread that references a live item.
 */
export declare function threadTargetItem(canvas: CanvasContents, thread: CommentThread | undefined, extraItemIds?: readonly string[]): Item | undefined;
