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
 * **Context budgets and memory packing** (Open Stitch Phase 5, ADR 0035 / 0139 / 0223).
 *
 * Three strict token ceilings keep agent prompts bounded across turns:
 * - `project`: 1,800 tokens (explicit project guidance first, then reflection sections)
 * - `personal`: 1,200 tokens (private observations from the person's "About you" canvas)
 * - `history`: 1,200 tokens (Tier-2 search passages across admitted canvases)
 */

/** Strict token ceilings for project, personal, and history memory tiers. */
export const CONTEXT_BUDGETS = {
  project: 1800,
  personal: 1200,
  history: 1200,
} as const;

type MemoryTier = keyof typeof CONTEXT_BUDGETS;

/** Five facets for personal observations on a person's private "About you" canvas. */
export const MEMORY_FACETS = [
  "identity_and_domains",
  "problem_solving_and_cognition",
  "quality_and_taste_bar",
  "workflow_and_modality_patterns",
  "collaboration_intuition",
] as const;

/** Union of the five personal memory facet keys. */
export type MemoryFacet = (typeof MEMORY_FACETS)[number];

/** Fixed section order of a project reflection document (`role: reflection`). */
export const REFLECTION_SECTIONS = [
  "Your project guidance",
  "Current intent",
  "Goals",
  "Themes & meaning",
  "Canvas state",
  "Decisions and constraints",
  "Open threads",
  "Mode corrections",
] as const;

/** Union of canonical reflection document section headings. */
export type ReflectionSection = (typeof REFLECTION_SECTIONS)[number];

/** Parsed structure of a versioned canvas reflection document. */
export interface ReflectionDoc {
  title?: string;
  updatedAt?: string;
  sections: Partial<Record<ReflectionSection, string>>;
  extraSections?: Array<{ heading: string; body: string }>;
}

interface PersonalObservationInput {
  id?: string;
  facet?: MemoryFacet | string;
  text: string;
  confidence?: number;
  proofs?: number;
}

interface HistoryPassageInput {
  id?: string;
  canvasId?: string;
  itemId?: string;
  title?: string;
  text: string;
  score?: number;
}

interface PackMemoryContextInput {
  projectGuidance?: string | readonly string[];
  reflection?: ReflectionDoc | string;
  personalObservations?: readonly PersonalObservationInput[];
  historyPassages?: readonly HistoryPassageInput[];
  budgets?: Partial<Record<MemoryTier, number>>;
}

interface PackedMemoryContext {
  project: string;
  personal: string;
  history: string;
  tokens: {
    project: number;
    personal: number;
    history: number;
    total: number;
  };
  included: {
    guidanceCount: number;
    reflectionSections: string[];
    personalCount: number;
    historyCount: number;
  };
  truncated: {
    project: boolean;
    personal: boolean;
    history: boolean;
  };
}

/** Deterministic token estimate (~4 characters per token). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Truncate text so `estimateTokens(out) <= maxTokens`. */
function clipToTokenBudget(text: string, maxTokens: number): string {
  if (maxTokens <= 0 || !text) return "";
  if (estimateTokens(text) <= maxTokens) return text;
  const maxChars = maxTokens * 4;
  if (maxChars <= 1) return text.slice(0, maxChars);
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

/** Render a structured {@link ReflectionDoc} into canonical markdown. */
export function renderReflectionDoc(doc: ReflectionDoc): string {
  const lines: string[] = [`# ${doc.title?.trim() || "Project Reflection"}`];
  if (doc.updatedAt?.trim()) {
    lines.push("", `_Updated: ${doc.updatedAt.trim()}_`);
  }
  for (const section of REFLECTION_SECTIONS) {
    const body = doc.sections[section]?.trim();
    if (!body) continue;
    lines.push("", `## ${section}`, "", body);
  }
  for (const extra of doc.extraSections ?? []) {
    const heading = extra.heading.trim();
    const body = extra.body.trim();
    if (!heading || !body) continue;
    lines.push("", `## ${heading}`, "", body);
  }
  return `${lines.join("\n")}\n`;
}

const SECTION_BY_LOWER = new Map<string, ReflectionSection>(
  REFLECTION_SECTIONS.map((s) => [s.toLowerCase(), s]),
);

/** Parse canonical reflection markdown back into a {@link ReflectionDoc}. */
export function parseReflectionDoc(markdown: string): ReflectionDoc {
  const sections: Partial<Record<ReflectionSection, string>> = {};
  const extraSections: Array<{ heading: string; body: string }> = [];
  let title: string | undefined;
  let updatedAt: string | undefined;
  let currentHeading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentHeading) return;
    const body = buffer.join("\n").trim();
    buffer = [];
    if (!body) return;
    const known = SECTION_BY_LOWER.get(currentHeading.toLowerCase());
    if (known) {
      sections[known] = body;
    } else {
      extraSections.push({ heading: currentHeading, body });
    }
  };

  for (const line of markdown.split(/\r?\n/)) {
    const h1 = /^#\s+(.+)$/.exec(line);
    if (h1 && !title && !currentHeading) {
      title = h1[1]!.trim();
      continue;
    }
    const upd = /^_?Updated:\s*(.+?)_?$/i.exec(line.trim());
    if (upd && !currentHeading && !updatedAt) {
      updatedAt = upd[1]!.trim();
      continue;
    }
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      flush();
      currentHeading = h2[1]!.trim();
      continue;
    }
    if (currentHeading) {
      buffer.push(line);
    }
  }
  flush();

  return {
    ...(title ? { title } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    sections,
    ...(extraSections.length > 0 ? { extraSections } : {}),
  };
}

/**
 * Pack Tier-1 (project guidance + reflection, personal) and Tier-2 (history)
 * memory context within strict per-tier token budgets.
 *
 * Explicit project guidance is ALWAYS packed first in the project tier before
 * reflection sections.
 */
export function packMemoryContext(input: PackMemoryContextInput): PackedMemoryContext {
  const budgets = {
    project: input.budgets?.project ?? CONTEXT_BUDGETS.project,
    personal: input.budgets?.personal ?? CONTEXT_BUDGETS.personal,
    history: input.budgets?.history ?? CONTEXT_BUDGETS.history,
  };

  // --- 1. Project tier: explicit guidance FIRST, then reflection sections ---
  const parsedReflection =
    typeof input.reflection === "string"
      ? parseReflectionDoc(input.reflection)
      : input.reflection;

  const guidanceItems: string[] = [];
  if (typeof input.projectGuidance === "string") {
    if (input.projectGuidance.trim()) guidanceItems.push(input.projectGuidance.trim());
  } else if (Array.isArray(input.projectGuidance)) {
    for (const g of input.projectGuidance) {
      if (g.trim()) guidanceItems.push(g.trim());
    }
  }
  if (guidanceItems.length === 0 && parsedReflection?.sections["Your project guidance"]?.trim()) {
    guidanceItems.push(parsedReflection.sections["Your project guidance"]!.trim());
  }

  const projectParts: string[] = [];
  let projectTokens = 0;
  let projectTruncated = false;
  let guidanceCount = 0;
  const reflectionSections: string[] = [];

  if (guidanceItems.length > 0) {
    const guidanceBlock = `## Your project guidance\n\n${guidanceItems.join("\n")}`;
    const cost = estimateTokens(guidanceBlock);
    if (projectTokens + cost <= budgets.project) {
      projectParts.push(guidanceBlock);
      projectTokens += cost;
      guidanceCount = guidanceItems.length;
    } else {
      const clipped = clipToTokenBudget(guidanceBlock, budgets.project - projectTokens);
      if (clipped) {
        projectParts.push(clipped);
        projectTokens += estimateTokens(clipped);
        guidanceCount = guidanceItems.length;
      }
      projectTruncated = true;
    }
  }

  if (parsedReflection && !projectTruncated) {
    for (const section of REFLECTION_SECTIONS) {
      if (section === "Your project guidance") continue;
      const body = parsedReflection.sections[section]?.trim();
      if (!body) continue;
      const block = `## ${section}\n\n${body}`;
      const separatorCost = projectParts.length > 0 ? 1 : 0;
      const cost = estimateTokens(block) + separatorCost;
      if (projectTokens + cost <= budgets.project) {
        projectParts.push(block);
        projectTokens += cost;
        reflectionSections.push(section);
      } else {
        projectTruncated = true;
      }
    }
  }

  // --- 2. Personal tier ---
  const personalParts: string[] = [];
  let personalTokens = 0;
  let personalTruncated = false;
  let personalCount = 0;
  const sortedPersonal = [...(input.personalObservations ?? [])].sort((a, b) => {
    const confDiff = (b.confidence ?? 0) - (a.confidence ?? 0);
    if (confDiff !== 0) return confDiff;
    return (b.proofs ?? 0) - (a.proofs ?? 0);
  });
  for (const obs of sortedPersonal) {
    const text = obs.text.trim();
    if (!text) continue;
    const prefix = obs.facet ? `[${obs.facet}] ` : "";
    const line = `- ${prefix}${text}`;
    const cost = estimateTokens(line);
    if (personalTokens + cost <= budgets.personal) {
      personalParts.push(line);
      personalTokens += cost;
      personalCount++;
    } else {
      personalTruncated = true;
    }
  }

  // --- 3. History tier ---
  const historyParts: string[] = [];
  let historyTokens = 0;
  let historyTruncated = false;
  let historyCount = 0;
  for (const passage of input.historyPassages ?? []) {
    const text = passage.text.trim();
    if (!text) continue;
    const header = [passage.canvasId, passage.itemId, passage.title].filter(Boolean).join(" · ");
    const block = header ? `[${header}] ${text}` : text;
    const cost = estimateTokens(block);
    if (historyTokens + cost <= budgets.history) {
      historyParts.push(block);
      historyTokens += cost;
      historyCount++;
    } else {
      historyTruncated = true;
    }
  }

  const project = projectParts.join("\n\n");
  const personal = personalParts.join("\n");
  const history = historyParts.join("\n\n");

  const actualProject = estimateTokens(project);
  const actualPersonal = estimateTokens(personal);
  const actualHistory = estimateTokens(history);

  return {
    project,
    personal,
    history,
    tokens: {
      project: actualProject,
      personal: actualPersonal,
      history: actualHistory,
      total: actualProject + actualPersonal + actualHistory,
    },
    included: {
      guidanceCount,
      reflectionSections,
      personalCount,
      historyCount,
    },
    truncated: {
      project: projectTruncated,
      personal: personalTruncated,
      history: historyTruncated,
    },
  };
}
