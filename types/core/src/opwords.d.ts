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
export * from "./activity-op.js";
/**
 * The phrase for an operation type, or `undefined` when there is not one.
 *
 * **The fallback belongs to the caller, and deliberately so.** A track drawn
 * for somebody reading history falls back to the raw op type, because naming
 * an unknown thing precisely is more useful there than a vague phrase —
 * `timeline.ts` decided that and a test holds it. A card on a home screen
 * cannot do the same: `item.setCurrentVersion` under a canvas shows a person
 * the vocabulary instead of telling them what happened, so it says "did
 * something" instead.
 *
 * That is not two surfaces disagreeing. Every op the system HAS is in the
 * table — the table is a full `Record<OperationType, string>`, so a new op
 * without a phrase is a compile error rather than a silent gap — and both
 * read the same words from it; they differ only on a type string that is not
 * an op at all (an old log line, a future op read by an older client), where
 * their audiences genuinely want different things.
 */
export declare function opWords(type: string | undefined): string | undefined;
