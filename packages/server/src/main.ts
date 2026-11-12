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

import { runDaemon } from "./daemon.ts";

// `npm run dev` means "the daemon I just started is the one serving". Bowing
// out to whoever already holds the port is how you end up talking to a stale
// daemon for an hour without a single error to show for it — so take the
// port instead, and say whose it was.
runDaemon({
  takeover: true,
  ...(process.env.ISOCAN_PORT ? { port: Number(process.env.ISOCAN_PORT) } : {}),
}).catch((err: unknown) => {
  console.error(`isocan daemon: ${(err as Error).message}`);
  process.exit(1);
});
