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
 * `"512 B"`, `"1.5 KB"`, `"847 MB"`, `"2.0 TB"`.
 *
 * Bytes below a kilobyte are whole and unsuffixed by a decimal: nobody wants
 * `0.5 KB` for 512 bytes.
 */
export declare function formatBytes(bytes: number): string;
