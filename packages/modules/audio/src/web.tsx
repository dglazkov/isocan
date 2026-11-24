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

import { useState, type ComponentType } from "react";
import type { InspectorFacts, RendererFacts, WebModule } from "@isocan/core";
import {
  AUDIO_KIND,
  AUDIO_MIMES,
  AUDIO_PROPS,
  AUDIO_TRANSCRIBE_ROUTE,
  audioModule,
  transcriptPreview,
  type AudioTranscribeRequest,
  type AudioTranscribeResponse,
} from "./core.ts";

/** Ask the home to transcribe an audio item and store `audio.transcript`. */
export async function requestAudioTranscribe(
  req: AudioTranscribeRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<AudioTranscribeResponse> {
  const res = await fetchImpl(AUDIO_TRANSCRIBE_ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = (await res.json().catch(() => null)) as (Partial<AudioTranscribeResponse> & { error?: string }) | null;
  if (!res.ok || typeof body?.transcript !== "string") {
    throw new Error(body?.error ?? `the home answered ${res.status}`);
  }
  return body as AudioTranscribeResponse;
}

function AudioCardRenderer(facts: RendererFacts) {
  const props = facts.item?.properties ?? {};
  const audioKind = props[AUDIO_PROPS.kind] || "audio";
  const voice = props[AUDIO_PROPS.voice];
  const transcript = props[AUDIO_PROPS.transcript]?.trim() ?? "";
  const prompt = props[AUDIO_PROPS.prompt]?.trim() ?? "";

  return (
    <div
      className="audio-card"
      data-audio-kind={audioKind}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "12px",
        height: "100%",
        boxSizing: "border-box",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", opacity: 0.85 }}>
        <span
          className="audio-kind-badge"
          style={{
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            border: "1px solid currentColor",
          }}
        >
          {audioKind}
        </span>
        {voice ? <span className="audio-voice-badge">{voice}</span> : null}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {facts.filename}
        </span>
      </div>

      <audio controls preload="metadata" src={facts.url} style={{ width: "100%" }} />

      {transcript ? (
        <p
          className="audio-transcript-preview"
          style={{ margin: 0, fontSize: "12px", lineHeight: 1.4, opacity: 0.9 }}
        >
          {transcriptPreview(transcript, 140)}
        </p>
      ) : prompt ? (
        <p
          className="audio-prompt-preview"
          style={{ margin: 0, fontSize: "12px", lineHeight: 1.4, opacity: 0.7 }}
        >
          {transcriptPreview(prompt, 120)}
        </p>
      ) : null}
    </div>
  );
}

function AudioInspector({ canvasId, item, host }: InspectorFacts) {
  const audioKind = item.properties[AUDIO_PROPS.kind] ?? "";
  const voice = item.properties[AUDIO_PROPS.voice] ?? "";
  const prompt = item.properties[AUDIO_PROPS.prompt] ?? "";
  const transcript = item.properties[AUDIO_PROPS.transcript]?.trim() ?? "";
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function onTranscribe() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await requestAudioTranscribe({
        canvasId,
        itemId: item.id,
        actor: host.viewer,
      });
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not transcribe audio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="audio-inspector" aria-label="Audio details">
      {(audioKind || voice) && (
        <p className="audio-meta">
          {audioKind ? <strong>{audioKind}</strong> : null}
          {audioKind && voice ? " · " : null}
          {voice ? <span>voice: {voice}</span> : null}
        </p>
      )}
      {prompt ? <p className="audio-prompt">{prompt}</p> : null}
      {transcript ? (
        <p className="audio-transcript" data-testid="audio-transcript-text">
          {transcript}
        </p>
      ) : (
        <p className="audio-empty">No transcript yet. Transcribe this clip so agents can read it in canvas context.</p>
      )}
      {problem ? (
        <p className="audio-problem" role="alert">
          {problem}
        </p>
      ) : null}
      <button type="button" className="btn" disabled={busy} onClick={() => void onTranscribe()}>
        {busy ? "Transcribing…" : transcript ? "Re-transcribe audio" : "Transcribe audio"}
      </button>
    </section>
  );
}

export const audioWeb: WebModule<
  never,
  ComponentType<RendererFacts>,
  ComponentType<InspectorFacts>
> = {
  core: audioModule,
  renderers: [
    {
      mimes: [...AUDIO_MIMES],
      component: AudioCardRenderer,
    },
  ],
  inspectors: [
    {
      kinds: [AUDIO_KIND.id],
      label: "Audio",
      component: AudioInspector,
    },
  ],
};

export default audioWeb;
