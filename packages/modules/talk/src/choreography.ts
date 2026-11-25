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

import {
  DEFAULT_AGENT_DISPOSITION,
  PendingCallGate,
  SpeechBudget,
  detectFollowMeIntent,
  dispositionToPromptHint,
  normalizeAgentDisposition,
  parseMediaControlCommand,
  type AgentDisposition,
  type MediaControlAction,
  type MediaControlCommand,
  type PendingCallGateOptions,
  type PendingCallInput,
  type PendingCallRelease,
  type SpeechBudgetOptions,
  type SpeechClaimResult,
} from "@isocan/core/voice-choreography";

export {
  DEFAULT_AGENT_DISPOSITION,
  PendingCallGate,
  SpeechBudget,
  detectFollowMeIntent,
  dispositionToPromptHint,
  normalizeAgentDisposition,
  parseMediaControlCommand,
  type AgentDisposition,
  type MediaControlAction,
  type MediaControlCommand,
  type PendingCallGateOptions,
  type PendingCallInput,
  type PendingCallRelease,
  type SpeechBudgetOptions,
  type SpeechClaimResult,
};

/* -------------------------------------------------------------------------- */
/* Co-listening ephemeral media controller (never writes to the oplog)        */
/* -------------------------------------------------------------------------- */

export interface MediaTranscriptCue {
  startSec: number;
  endSec?: number;
  text: string;
}

export interface MediaElementLike {
  paused: boolean;
  currentTime: number;
  duration?: number;
  playbackRate: number;
  volume: number;
  play(): Promise<void> | void;
  pause(): void;
}

export interface MediaControlRegistration {
  itemId: string;
  element: MediaElementLike;
  title?: string;
  transcript?: readonly MediaTranscriptCue[];
}

export interface MediaTranscriptMatch {
  itemId: string;
  timeSec: number;
  text: string;
  title?: string;
}

export interface MediaControlResult {
  ok: boolean;
  action: MediaControlAction;
  itemId?: string;
  paused?: boolean;
  currentTime?: number;
  duration?: number;
  playbackRate?: number;
  volume?: number;
  match?: MediaTranscriptMatch;
  error?: string;
  /** Explicit marker: co-listening control never emits canvas operations. */
  ephemeral: true;
}

/**
 * Ephemeral registry over `<video>` / `<audio>` item elements for voice
 * co-listening. Every command mutates only live media element state and
 * never writes an operation to the canvas oplog.
 */
export class MediaControlController {
  private readonly items = new Map<string, MediaControlRegistration>();
  private activeItemId: string | null = null;

  register(
    itemId: string,
    element: MediaElementLike,
    meta?: { title?: string; transcript?: readonly MediaTranscriptCue[] },
  ): () => void {
    const id = itemId.trim();
    if (!id) throw new Error("itemId is required");
    this.items.set(id, {
      itemId: id,
      element,
      ...(meta?.title !== undefined ? { title: meta.title } : {}),
      ...(meta?.transcript !== undefined ? { transcript: meta.transcript } : {}),
    });
    this.activeItemId = id;
    return () => {
      this.unregister(id);
    };
  }

  unregister(itemId: string): boolean {
    const removed = this.items.delete(itemId);
    if (this.activeItemId === itemId) {
      const next = this.items.keys().next();
      this.activeItemId = next.done ? null : next.value;
    }
    return removed;
  }

  list(): string[] {
    return [...this.items.keys()];
  }

  clear(): void {
    this.items.clear();
    this.activeItemId = null;
  }

  findByTranscript(query: string, itemId?: string): MediaTranscriptMatch | null {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    const candidates = itemId
      ? [this.items.get(itemId)].filter((v): v is MediaControlRegistration => Boolean(v))
      : [...this.items.values()];

    for (const reg of candidates) {
      for (const cue of reg.transcript ?? []) {
        if (cue.text.toLowerCase().includes(q)) {
          return {
            itemId: reg.itemId,
            timeSec: Math.max(0, cue.startSec),
            text: cue.text,
            ...(reg.title !== undefined ? { title: reg.title } : {}),
          };
        }
      }
    }
    return null;
  }

  async execute(command: MediaControlCommand): Promise<MediaControlResult> {
    if (command.action === "find_by_transcript") {
      const match = this.findByTranscript(command.query ?? "", command.itemId);
      if (!match) {
        return {
          ok: false,
          action: command.action,
          ...(command.itemId ? { itemId: command.itemId } : {}),
          error: `no transcript match for "${command.query ?? ""}"`,
          ephemeral: true,
        };
      }
      return {
        ok: true,
        action: command.action,
        itemId: match.itemId,
        currentTime: match.timeSec,
        match,
        ephemeral: true,
      };
    }

    const targetId = command.itemId ?? this.activeItemId;
    if (!targetId) {
      return { ok: false, action: command.action, error: "no active media item registered", ephemeral: true };
    }
    const reg = this.items.get(targetId);
    if (!reg) {
      return { ok: false, action: command.action, itemId: targetId, error: `media item "${targetId}" not found`, ephemeral: true };
    }

    this.activeItemId = targetId;
    const el = reg.element;

    switch (command.action) {
      case "play":
        await el.play();
        break;
      case "pause":
        el.pause();
        break;
      case "seek": {
        const target = Math.max(0, command.timeSec ?? 0);
        const bounded =
          typeof el.duration === "number" && Number.isFinite(el.duration)
            ? Math.min(target, el.duration)
            : target;
        el.currentTime = bounded;
        break;
      }
      case "rate": {
        const rate = command.rate ?? 1;
        el.playbackRate = Math.max(0.25, Math.min(4, rate));
        break;
      }
      case "volume": {
        const vol = command.volume ?? 1;
        el.volume = Math.max(0, Math.min(1, vol));
        break;
      }
      case "status":
        break;
    }

    return {
      ok: true,
      action: command.action,
      itemId: targetId,
      paused: el.paused,
      currentTime: el.currentTime,
      ...(typeof el.duration === "number" && Number.isFinite(el.duration) ? { duration: el.duration } : {}),
      playbackRate: el.playbackRate,
      volume: el.volume,
      ephemeral: true,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Vision Share: pull-only inline functionResponse frame helper               */
/* -------------------------------------------------------------------------- */

export interface VisionShareFrame {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  /** Base64-encoded image bytes (no `data:` URL prefix). */
  data: string;
  width: number;
  height: number;
  capturedAt: number;
}

export interface VisionShareFunctionResponse {
  id: string;
  name: string;
  response: Record<string, unknown>;
}

/**
 * Attach a downscaled Vision Share frame strictly as inline `functionResponse`
 * data (pull-only — never pushed unsolicited onto `realtimeInput`).
 */
export function buildVisionShareFunctionResponse(
  call: { id: string; name: string },
  frame: VisionShareFrame | null,
  extra: Record<string, unknown> = {},
): VisionShareFunctionResponse {
  if (!frame) {
    return {
      id: call.id,
      name: call.name,
      response: {
        ok: false,
        available: false,
        reason: "no_screen_share_frame",
        pullOnly: true,
        ...extra,
      },
    };
  }

  return {
    id: call.id,
    name: call.name,
    response: {
      ok: true,
      available: true,
      pullOnly: true,
      width: frame.width,
      height: frame.height,
      capturedAt: frame.capturedAt,
      inlineData: {
        mimeType: frame.mimeType,
        data: frame.data,
      },
      ...extra,
    },
  };
}

export interface DownscaleVisionOptions {
  maxDimension?: number;
  mimeType?: "image/jpeg" | "image/webp";
  quality?: number;
}

/**
 * Downscale a browser video/canvas/image source into a `VisionShareFrame` on
 * demand when the model pulls a screen-share frame. Returns `null` when run
 * outside a DOM canvas environment or when source dimensions are zero.
 */
export async function captureDownscaledVisionFrame(
  source: CanvasImageSource & { videoWidth?: number; videoHeight?: number; width?: number; height?: number },
  options: DownscaleVisionOptions = {},
): Promise<VisionShareFrame | null> {
  if (typeof document === "undefined") return null;
  const rawW = Number(source.videoWidth ?? source.width ?? 0);
  const rawH = Number(source.videoHeight ?? source.height ?? 0);
  if (!Number.isFinite(rawW) || !Number.isFinite(rawH) || rawW <= 0 || rawH <= 0) {
    return null;
  }

  const maxDim = Math.max(64, options.maxDimension ?? 1024);
  const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
  const width = Math.max(1, Math.round(rawW * scale));
  const height = Math.max(1, Math.round(rawH * scale));
  const mimeType = options.mimeType ?? "image/jpeg";
  const quality = Math.max(0.1, Math.min(1, options.quality ?? 0.8));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  const dataUrl = canvas.toDataURL(mimeType, quality);
  const comma = dataUrl.indexOf(",");
  const data = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;

  return {
    mimeType,
    data,
    width,
    height,
    capturedAt: Date.now(),
  };
}
