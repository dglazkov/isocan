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

import { useState, type ComponentType, type FormEvent } from "react";
import type { DialogFacts, WebModule } from "@isocan/core";
import {
  IMAGE_GENERATE_ROUTE,
  imageModule,
  type ImageGenerateRequest,
  type ImageGenerateResponse,
} from "./core.ts";

/** Generate or edit a single image on this canvas via the home route. */
export async function requestImageGenerate(
  req: ImageGenerateRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ImageGenerateResponse> {
  const res = await fetchImpl(IMAGE_GENERATE_ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = (await res.json().catch(() => null)) as (Partial<ImageGenerateResponse> & { error?: string }) | null;
  if (!res.ok || !body?.itemId || !body?.versionId) {
    throw new Error(body?.error ?? `the home answered ${res.status}`);
  }
  return body as ImageGenerateResponse;
}

function ImageGenerateDialog({ canvasId, selection, args, canEdit, host }: DialogFacts) {
  const [prompt, setPrompt] = useState(args.trim());
  const [model, setModel] = useState("");
  const [editSelected, setEditSelected] = useState(selection.length === 1);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const selectedId = selection.length === 1 ? selection[0] : undefined;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || busy || !prompt.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await requestImageGenerate({
        canvasId,
        prompt: prompt.trim(),
        ...(selectedId && editSelected ? { editItem: selectedId } : {}),
        ...(model.trim() ? { model: model.trim() } : {}),
        actor: host.viewer,
      });
      host.select([res.itemId]);
      host.reveal([res.itemId]);
      host.close();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not generate image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="image-dialog" onSubmit={(e) => void onSubmit(e)}>
      {selectedId ? (
        <label className="image-edit-toggle">
          <input
            type="checkbox"
            checked={editSelected}
            onChange={(e) => setEditSelected(e.target.checked)}
            disabled={!canEdit || busy}
          />
          <span>
            Edit selected item <code>{selectedId}</code> (stacks a new version)
          </span>
        </label>
      ) : null}
      <label className="image-field">
        Prompt
        <textarea
          rows={3}
          aria-label="Image prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Isometric studio render of a ceramic teapot on pale oak"
          disabled={!canEdit || busy}
        />
      </label>
      <label className="image-field">
        Model (optional)
        <input
          type="text"
          aria-label="Image model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="default from manifest"
          disabled={!canEdit || busy}
        />
      </label>
      {problem ? (
        <p className="image-problem" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="image-actions">
        <button type="button" className="btn" onClick={host.close} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={!canEdit || busy || !prompt.trim()}>
          {busy ? "Generating…" : selectedId && editSelected ? "Edit image" : "Generate image"}
        </button>
      </div>
    </form>
  );
}

export const imageWeb: WebModule<
  never,
  never,
  never,
  never,
  never,
  ComponentType<DialogFacts>
> = {
  core: imageModule,
  actions: [
    {
      id: "image.generate",
      name: "Generate image",
      hint: "generate a new image or edit the selected image item",
      opens: "image-generate",
    },
  ],
  dialogs: [
    {
      id: "image-generate",
      title: "Generate image",
      component: ImageGenerateDialog,
    },
  ],
};

export default imageWeb;
