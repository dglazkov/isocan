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

import "./SettingsShell.css";
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Actor } from "@isocan/core";
import { STITCH_PRESETS, type StitchPresetId } from "@isocan/core/stitch-tokens";
import { EXPERIMENTS } from "../../lib/experiments.ts";
import { DISPLAY_SWITCHES, HIDEABLE, showAllChrome } from "../../lib/hideable.ts";
import { type ThemePref, useTheme } from "../../lib/theme.ts";
import { openUiDevtools } from "../../lib/uitweaks.ts";
import { useUiStore } from "../../stores/uiStore.ts";

const KeysDialog = lazy(() => import("../KeysDialog.tsx").then((m) => ({ default: m.KeysDialog })));

/** Built-in section ids for the Stitch centred Settings modal. */
export type CoreSettingsSectionId =
  | "preferences"
  | "appearance"
  | "api-keys"
  | "connections"
  | "experimental";

/** A settings section registered by core or by a module. */
export interface SettingsSectionDef {
  id: string;
  label: string;
  render: () => ReactNode;
}

const CORE_NAV_ORDER: readonly { id: CoreSettingsSectionId; label: string }[] = [
  { id: "preferences", label: "Preferences" },
  { id: "appearance", label: "Appearance" },
  { id: "api-keys", label: "API keys" },
  { id: "connections", label: "Connections" },
  { id: "experimental", label: "Experimental" },
];

const THEME_OPTIONS: readonly { value: ThemePref; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const moduleSections = new Map<string, SettingsSectionDef>();

/** Register a module-provided section into the Settings modal left nav. */
export function registerSettingsSection(section: SettingsSectionDef): () => void {
  moduleSections.set(section.id, section);
  return () => {
    if (moduleSections.get(section.id) === section) {
      moduleSections.delete(section.id);
    }
  };
}

/** Snapshot currently registered module sections. */
export function registeredSettingsSections(): SettingsSectionDef[] {
  return [...moduleSections.values()];
}

export interface SettingsShellProps {
  open: boolean;
  actor: Actor;
  initialSection?: string;
  /** Additional sections provided directly by callers or modules. */
  extraSections?: readonly SettingsSectionDef[];
  /** Optional custom renderers overriding any built-in section. */
  sectionOverrides?: Partial<Record<CoreSettingsSectionId, () => ReactNode>>;
  /** Optional Stitch surface preset selection handler. */
  onSelectPreset?: (preset: StitchPresetId) => void;
  activePreset?: StitchPresetId;
  onClose: () => void;
}

/**
 * Centred Stitch Settings modal dialog with a 210px left navigation rail
 * (`Preferences · Appearance · API keys · Connections · Experimental`) plus
 * module-registered sections. Loaded lazily via `React.lazy`.
 */
export function SettingsShell({
  open,
  actor,
  initialSection = "preferences",
  extraSections = [],
  sectionOverrides,
  onSelectPreset,
  activePreset = "frosted",
  onClose,
}: SettingsShellProps) {
  const [activeId, setActiveId] = useState<string>(initialSection);
  const [keysModalOpen, setKeysModalOpen] = useState(false);
  const theme = useTheme((s) => s.pref);
  const setTheme = useTheme((s) => s.setPref);
  const experiments = useUiStore((s) => s.experiments);
  const setExperiment = useUiStore((s) => s.setExperiment);
  const cursorGlow = useUiStore((s) => s.cursorGlow);
  const setCursorGlow = useUiStore((s) => s.setCursorGlow);
  const minimapOpen = useUiStore((s) => s.minimapOpen);
  const setMinimapOpen = useUiStore((s) => s.setMinimapOpen);
  const stickyHeader = useUiStore((s) => s.stickyHeader);
  const setStickyHeader = useUiStore((s) => s.setStickyHeader);
  const hiddenChrome = useUiStore((s) => s.hiddenChrome);
  const setChromeHidden = useUiStore((s) => s.setChromeHidden);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  const sections = useMemo<SettingsSectionDef[]>(() => {
    const core: SettingsSectionDef[] = CORE_NAV_ORDER.map(({ id, label }) => {
      const override = sectionOverrides?.[id];
      if (override) return { id, label, render: override };

      switch (id) {
        case "preferences":
          return {
            id,
            label,
            render: () => (
              <div className="shell-settings-group">
                <div className="shell-settings-group-label">Canvas controls</div>
                {DISPLAY_SWITCHES.map((sw) => {
                  const checked = sw.id === "cursor.glow" ? cursorGlow : minimapOpen;
                  return (
                    <label key={sw.id} className="shell-settings-row">
                      <span>
                        <strong>{sw.name}</strong>
                        <span className="shell-settings-hint"> — {sw.what}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (sw.id === "cursor.glow") setCursorGlow(e.target.checked);
                          else if (sw.id === "canvas.minimap") setMinimapOpen(e.target.checked);
                        }}
                      />
                    </label>
                  );
                })}
                <label className="shell-settings-row">
                  <span>
                    <strong>Sticky header</strong>
                    <span className="shell-settings-hint"> — pin all top pills into a single full-width bar along the top edge</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={stickyHeader}
                    onChange={(e) => setStickyHeader(e.target.checked)}
                  />
                </label>
                {HIDEABLE.map((entry) => {
                  const visible = !hiddenChrome.includes(entry.id);
                  return (
                    <label key={entry.id} className="shell-settings-row">
                      <span>
                        <strong>{entry.name}</strong>
                        <span className="shell-settings-hint"> — {entry.stillReachable}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={(e) => setChromeHidden(entry.id, !e.target.checked)}
                      />
                    </label>
                  );
                })}
                <div className="shell-settings-row">
                  <span>Restore any hidden interface chrome</span>
                  <button type="button" className="btn" onClick={() => showAllChrome()}>
                    Show all chrome
                  </button>
                </div>
              </div>
            ),
          };

        case "appearance":
          return {
            id,
            label,
            render: () => (
              <div className="shell-settings-group">
                <div className="shell-settings-group-label">Colour theme</div>
                <div className="shell-settings-pills" role="group" aria-label="Colour theme">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="shell-settings-pill"
                      aria-pressed={theme === opt.value}
                      onClick={() => setTheme(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="shell-settings-group-label">Stitch surface preset</div>
                <div className="shell-settings-pills" role="group" aria-label="Stitch surface preset">
                  {STITCH_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="shell-settings-pill"
                      title={preset.description}
                      aria-pressed={activePreset === preset.id}
                      onClick={() => onSelectPreset?.(preset.id)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="shell-settings-row">
                  <span>UI Devtools — edit all 33 Stitch tokens live</span>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      openUiDevtools();
                      onClose();
                    }}
                  >
                    Open Devtools
                  </button>
                </div>
              </div>
            ),
          };

        case "api-keys":
          return {
            id,
            label,
            render: () => (
              <div className="shell-settings-group">
                <p className="shell-settings-hint">
                  Manage sealed personal or home provider keys (`anthropic`, `openai`, `gemini`, `typesafe`).
                </p>
                <div className="shell-settings-row">
                  <span>Provider keys</span>
                  <button type="button" className="btn primary" onClick={() => setKeysModalOpen(true)}>
                    Manage keys…
                  </button>
                </div>
                {keysModalOpen && (
                  <Suspense fallback={<p className="shell-settings-hint">Loading keys…</p>}>
                    <KeysDialog onClose={() => setKeysModalOpen(false)} />
                  </Suspense>
                )}
              </div>
            ),
          };

        case "connections":
          return {
            id,
            label,
            render: () => (
              <div className="shell-settings-group">
                <div className="shell-settings-row">
                  <span>Signed in as</span>
                  <strong>{actor.name}</strong>
                </div>
                <p className="shell-settings-hint">
                  CLI agents join this canvas with <code>isocan wait</code> or your local daemon pass.
                </p>
              </div>
            ),
          };

        case "experimental":
          return {
            id,
            label,
            render: () => (
              <div className="shell-settings-group">
                <div className="shell-settings-group-label">Experiments</div>
                {EXPERIMENTS.map((exp) => {
                  const enabled = experiments.includes(exp.id);
                  return (
                    <label key={exp.id} className="shell-settings-row">
                      <span>
                        <strong>{exp.name}</strong>
                        {exp.what && <span className="shell-settings-hint"> — {exp.what}</span>}
                      </span>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => setExperiment(exp.id, !enabled)}
                      />
                    </label>
                  );
                })}
              </div>
            ),
          };
      }
    });

    const seen = new Set(core.map((s) => s.id));
    const extras: SettingsSectionDef[] = [];
    for (const sec of [...registeredSettingsSections(), ...extraSections]) {
      if (seen.has(sec.id)) continue;
      seen.add(sec.id);
      extras.push(sec);
    }
    return [...core, ...extras];
  }, [
    sectionOverrides,
    cursorGlow,
    setCursorGlow,
    minimapOpen,
    setMinimapOpen,
    theme,
    setTheme,
    activePreset,
    onSelectPreset,
    onClose,
    keysModalOpen,
    actor.name,
    experiments,
    setExperiment,
    stickyHeader,
    setStickyHeader,
    hiddenChrome,
    setChromeHidden,
    extraSections,
  ]);

  if (!open) return null;

  const active = sections.find((s) => s.id === activeId) ?? sections[0]!;

  return (
    <div
      className="shell-settings-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="shell-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <nav className="shell-settings-nav" aria-label="Settings sections">
          <h3 className="shell-settings-nav-title">Settings</h3>
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className="shell-settings-nav-btn"
              aria-current={active.id === section.id ? "page" : undefined}
              onClick={() => setActiveId(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="shell-settings-main">
          <header className="shell-settings-head">
            <h2>{active.label}</h2>
            <button
              type="button"
              className="shell-settings-close"
              aria-label="Close settings"
              onClick={onClose}
            >
              ×
            </button>
          </header>
          <div className="shell-settings-content" data-settings-section={active.id}>
            {active.render()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsShell;
