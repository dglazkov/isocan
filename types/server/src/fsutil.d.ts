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
 * Crash-safe write: temp file in the same directory, fsync, rename over the
 * target. Readers see either the old or the new content, never a torn write.
 * Credential callers supply a mode to preserve the replaced file's access.
 */
export declare function writeFileAtomic(filePath: string, data: string | Buffer, mode?: number): Promise<void>;
/** Append one line with fsync — the oplog's durability guarantee. */
export declare function appendLineDurable(filePath: string, line: string): Promise<void>;
export declare function readJson<T>(filePath: string): Promise<T | null>;
export declare function readJsonLines<T>(filePath: string): Promise<T[]>;
