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

/** Fixtures supply their own model settings after setup; the developer's
 * environment must not override the empty test keystore. */
export function isolateModelEnv(env: NodeJS.ProcessEnv): void {
  for (const name of ["TYPESAFE_API_KEY", "GEMINI_API_KEY", "ISOCAN_TEXT_API_KEY", "ISOCAN_TEXT_PROVIDER", "ISOCAN_TEXT_MODEL"]) {
    delete env[name];
  }
}
