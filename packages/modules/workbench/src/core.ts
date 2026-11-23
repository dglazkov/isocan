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

import type { Actor, CoreModule, ModuleKind } from "@isocan/core";
import type { OpenNodeEnvelope } from "@isocan/core/open-node-spec";
import type { SessionModelInfo, SessionSummary } from "@isocan/core/session-driver";

export const WORKBENCH_DRIVERS_ROUTE = "/api/m/workbench/drivers";
export const WORKBENCH_SESSIONS_ROUTE = "/api/m/workbench/sessions";
export const WORKBENCH_START_ROUTE = "/api/m/workbench/start";
export const WORKBENCH_SEND_ROUTE = "/api/m/workbench/send";
export const WORKBENCH_APPROVE_ROUTE = "/api/m/workbench/approve";
export const WORKBENCH_CANCEL_ROUTE = "/api/m/workbench/cancel";
export const WORKBENCH_EMIT_ROUTE = "/api/m/workbench/emit";
export const WORKBENCH_DEBUG_ROUTE = "/api/m/workbench/debug";

export const SESSION_MIME = "application/vnd.isocan.session+json";
export const TERMINAL_MIME = "application/vnd.isocan.terminal+json";

export const SESSION_KIND: ModuleKind = {
  id: "session",
  mimes: [SESSION_MIME],
  extensions: ["session"],
  label: "Sessions",
  noun: "session",
  icon: "note",
};

export const TERMINAL_KIND: ModuleKind = {
  id: "terminal",
  mimes: [TERMINAL_MIME],
  extensions: ["terminal"],
  label: "Terminals",
  noun: "terminal",
  icon: "note",
};

export const WORKBENCH_PROPS = {
  driver: "workbench.driver",
  sessionId: "workbench.sessionId",
  workspace: "workbench.workspace",
  status: "workbench.status",
  autoPreview: "workbench.autoPreview",
  sourceRef: "workbench.sourceRef",
} as const;

export const WORKBENCH_PROPERTY_KEYS = Object.values(WORKBENCH_PROPS);

export interface WorkbenchDriverDescriptor {
  id: string;
  label: string;
  available: boolean;
  models: SessionModelInfo[];
}

export interface WorkbenchDriversResponse {
  drivers: WorkbenchDriverDescriptor[];
}

export interface WorkbenchSessionsResponse {
  sessions: SessionSummary[];
}

export interface WorkbenchStartRequest {
  canvasId: string;
  driver: string;
  kind?: "session" | "terminal";
  workspace?: string;
  prompt?: string;
  command?: string;
  model?: string;
  title?: string;
  autoPreview?: boolean;
  actor?: Actor;
}

export interface WorkbenchStartResponse {
  session: SessionSummary;
  itemId: string;
  driver: string;
}

export interface WorkbenchSendRequest {
  canvasId: string;
  driver: string;
  sessionId: string;
  text: string;
}

export interface WorkbenchApproveRequest {
  canvasId: string;
  driver: string;
  sessionId: string;
  interactionId: string;
  decision?: boolean | string;
}

export interface WorkbenchCancelRequest {
  canvasId: string;
  driver: string;
  sessionId: string;
}

export interface WorkbenchEmitRequest {
  canvasId: string;
  spec: OpenNodeEnvelope | unknown;
  trustedProducer?: string;
  actor?: Actor;
}

export interface WorkbenchEmitResponse {
  itemIds: string[];
  updatedIds: string[];
  edgeCount: number;
  patchCount: number;
}

export interface WorkbenchDebugRequest {
  canvasId: string;
  itemId: string;
  driver: string;
  mode?: "plan" | "fix";
  workspace?: string;
  model?: string;
  prompt?: string;
  actor?: Actor;
}

export interface WorkbenchDebugResponse {
  session: SessionSummary;
  itemId: string;
  targetItemId: string;
}

export const workbenchModule: CoreModule = {
  name: "@isocan/workbench",
  propertyKeys: WORKBENCH_PROPERTY_KEYS,
  kinds: [SESSION_KIND, TERMINAL_KIND],
};

export default workbenchModule;
