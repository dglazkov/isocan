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

import type { SessionDriver } from "@isocan/core/session-driver";
import { antigravityDriver } from "./antigravity.ts";
import { claudeCodeDriver } from "./claude-code.ts";
import { geminiCliDriver } from "./gemini-cli.ts";
import { ptyDriver } from "./pty.ts";

export class DriverRegistry {
  private readonly drivers = new Map<string, SessionDriver>();

  constructor(initial: readonly SessionDriver[] = []) {
    for (const driver of initial) {
      this.register(driver);
    }
  }

  register(driver: SessionDriver): void {
    this.drivers.set(driver.id, driver);
  }

  unregister(id: string): void {
    this.drivers.delete(id);
  }

  get(id: string): SessionDriver | undefined {
    return this.drivers.get(id);
  }

  list(): SessionDriver[] {
    return [...this.drivers.values()];
  }
}

export function createDefaultDriverRegistry(): DriverRegistry {
  return new DriverRegistry([
    ptyDriver,
    antigravityDriver,
    geminiCliDriver,
    claudeCodeDriver,
  ]);
}
