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

import { useEffect, useState, type ComponentType } from "react";
import type { RendererFacts, WebModule } from "@isocan/core";
import {
  DESIGN_SYSTEM_MIME,
  designSystemModule,
  parseDesignSystemSpec,
  type DesignSystemSpec,
} from "./core.ts";

export function DesignSystemCard(facts: RendererFacts) {
  const [spec, setSpec] = useState<DesignSystemSpec | null>(null);
  const [failed, setFailed] = useState(false);
  // The effect answers to the blob and its reader, not to the facts object,
  // which is new on every render.
  const { blobHash, readText } = facts;

  useEffect(() => {
    let alive = true;
    readText()
      .then((text) => {
        if (!alive) return;
        const parsed = parseDesignSystemSpec(text);
        setSpec(parsed);
        setFailed(!parsed);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [blobHash, readText]);

  if (failed) {
    return (
      <div className="design-system-card" style={{ padding: "12px", fontSize: "12px" }}>
        <strong>{facts.item?.title ?? facts.filename}</strong>
        <p style={{ opacity: 0.7 }}>Design system spec could not be parsed.</p>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="design-system-card" style={{ padding: "12px", fontSize: "12px", opacity: 0.7 }}>
        Loading sticker sheet…
      </div>
    );
  }

  return (
    <div
      className="design-system-card"
      data-testid="design-system-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        height: "100%",
        padding: "14px",
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      <div>
        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.65 }}>
          Design System
        </div>
        <h3 style={{ margin: "2px 0 4px", fontSize: "16px" }}>{spec.name}</h3>
        {spec.summary ? <p style={{ margin: 0, fontSize: "12px", opacity: 0.8 }}>{spec.summary}</p> : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: "6px" }}>
        {spec.palette.map((swatch) => (
          <div
            key={`${swatch.name}-${swatch.hex}`}
            style={{
              border: "1px solid rgba(128,128,128,0.25)",
              borderRadius: "6px",
              overflow: "hidden",
              fontSize: "10px",
            }}
          >
            <div style={{ height: "28px", backgroundColor: swatch.hex }} />
            <div style={{ padding: "4px 6px" }}>
              <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {swatch.name}
              </div>
              <code style={{ opacity: 0.75 }}>{swatch.hex}</code>
            </div>
          </div>
        ))}
      </div>

      {spec.typography.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {spec.typography.slice(0, 4).map((t) => (
            <div
              key={t.role}
              style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", opacity: 0.85 }}
            >
              <strong>{t.role}</strong>
              <span>
                {t.family} · {t.size}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const designSystemWeb: WebModule<never, ComponentType<RendererFacts>> = {
  core: designSystemModule,
  renderers: [
    {
      mimes: [DESIGN_SYSTEM_MIME],
      component: DesignSystemCard,
    },
  ],
};

export default designSystemWeb;
