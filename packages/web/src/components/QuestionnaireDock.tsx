import { useState, useRef, useMemo, type ReactNode } from "react";
import type { CommentThread, Comment } from "@isocan/core";
import { isSystemActor } from "@isocan/core";

export interface QuestionOptionSpec {
  id: string;
  title: string;
  body?: string;
  eyebrow?: string;
  colors?: string[];
  description?: string;
}

export type QuestionRendererType =
  | "choice-list"
  | "visual-cards"
  | "upload"
  | "url-collection"
  | "freeform";

export interface QuestionSpec {
  id: string;
  title: string;
  description?: string;
  renderer: QuestionRendererType;
  label?: string;
  multiSelect?: boolean;
  skippable?: boolean;
  placeholder?: string;
  options?: QuestionOptionSpec[];
}

export interface InferredAnswer {
  questionId: string;
  displayValue: string;
}

export interface QuestionContextPayload {
  headline?: string;
  inferredAnswers?: InferredAnswer[];
  questions: QuestionSpec[];
}

export function parseQuestionPayload(body: string): QuestionContextPayload | null {
  if (!body.startsWith("/ask")) return null;
  const raw = body.slice(4).trim();
  if (!raw.startsWith("{") || !raw.endsWith("}")) return null;
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === "object") {
      let questions = Array.isArray(data.questions) ? data.questions : [];
      if (questions.length === 0) {
        // Provide default clarifying questions if the model provided only a headline/inferredAnswers
        questions = [
          {
            id: "primaryFocus",
            title: "What is the primary focus of this application?",
            description: "Clarify the target audience and core value proposition.",
            renderer: "choice-list",
            options: [
              { id: "consumer", title: "Consumer Experience", body: "Engaging, visual, rich interactions and high polish." },
              { id: "productivity", title: "Productivity & Utility", body: "Fast, density-optimized workflows, data tables, and shortcuts." },
              { id: "dashboard", title: "Overview & Analytics", body: "Clean metrics, charts, status cards, and high-level health." },
            ],
          },
          {
            id: "vibe",
            title: "What visual vibe best matches your vision?",
            description: "Choose an aesthetic tone and color palette.",
            renderer: "visual-cards",
            options: [
              { id: "clean-light", title: "Clean Light", eyebrow: "Minimalist", colors: ["#ffffff", "#3b82f6", "#0f172a"] },
              { id: "sleek-dark", title: "Sleek Dark", eyebrow: "Modern", colors: ["#0f172a", "#38bdf8", "#f8fafc"] },
              { id: "warm-editorial", title: "Warm Editorial", eyebrow: "Refined", colors: ["#fef3c7", "#d97706", "#78350f"] },
            ],
          },
        ];
      }
      return {
        ...data,
        questions,
      } as QuestionContextPayload;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Finds the active, unanswered structured question payload in the thread.
 */
export function activeQuestion(thread: CommentThread | null): {
  payload: QuestionContextPayload;
  comment: Comment;
} | null {
  if (!thread || thread.comments.length === 0) return null;
  for (let i = thread.comments.length - 1; i >= 0; i--) {
    const comment = thread.comments[i]!;
    const payload = parseQuestionPayload(comment.body);
    if (payload) {
      // It is open iff no human user (or answer submission) has replied after it.
      // An agent followup or notification should NOT mark the questionnaire as answered.
      const answered = thread.comments
        .slice(i + 1)
        .some((later) => {
          const body = later.body.trim();
          // Did the user answer or skip?
          if (body.startsWith("[Questionnaire Answer]") || body.startsWith("[Questionnaire Skipped]")) {
            return true;
          }
          // Is it an agent/bot comment?
          const authorName = later.author.name.toLowerCase();
          const isAgent = authorName.includes("hiro") || isSystemActor(later.author.id);
          // Only a human message after the question counts as closing it
          return !isAgent;
        });
      return answered ? null : { payload, comment };
    }
  }
  return null;
}

interface QuestionnaireDockProps {
  payload: QuestionContextPayload;
  onAnswer: (responseBody: string) => Promise<void>;
  onDismiss: () => void;
}

export function QuestionnaireDock({ payload, onAnswer, onDismiss }: QuestionnaireDockProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [uploadFiles, setUploadFiles] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [urlList, setUrlList] = useState<string[]>([]);
  const [freeformText, setFreeformText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const questions = payload.questions;
  const q = questions[currentIdx];

  if (!q) return null;

  const currentSelection: string[] = answers[q.id] || [];

  function handleSelectOption(optId: string) {
    if (q.multiSelect) {
      const exists = currentSelection.includes(optId);
      const next = exists
        ? currentSelection.filter((id) => id !== optId)
        : [...currentSelection, optId];
      setAnswers({ ...answers, [q.id]: next });
    } else {
      setAnswers({ ...answers, [q.id]: [optId] });
    }
  }

  function handleAddUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const next = [...urlList, trimmed];
    setUrlList(next);
    setUrlInput("");
    setAnswers({ ...answers, [q.id]: next });
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const names = Array.from(files).map((f) => f.name);
    const next = [...uploadFiles, ...names];
    setUploadFiles(next);
    setAnswers({ ...answers, [q.id]: next });
  }

  async function finish(finalAnswers: Record<string, any>) {
    // Build human-readable formatted markdown reply for Hiro
    const lines: string[] = [];
    lines.push("Here are my answers to shape the project:\n");

    for (const question of questions) {
      const ans = finalAnswers[question.id];
      if (!ans || (Array.isArray(ans) && ans.length === 0)) {
        lines.push(`- **${question.label || question.title}**: *(Skipped)*`);
        continue;
      }

      if (question.renderer === "choice-list" || question.renderer === "visual-cards") {
        const titles = (question.options || [])
          .filter((opt) => ans.includes(opt.id))
          .map((opt) => opt.title);
        lines.push(`- **${question.label || question.title}**: ${titles.join(", ")}`);
      } else if (question.renderer === "url-collection") {
        lines.push(`- **${question.label || question.title}**: ${ans.join(", ")}`);
      } else if (question.renderer === "upload") {
        lines.push(`- **${question.label || question.title}**: ${ans.join(", ")}`);
      } else if (question.renderer === "freeform") {
        lines.push(`- **${question.label || question.title}**: ${ans}`);
      }
    }

    lines.push("\nPlease proceed with the designs based on these selections!");
    await onAnswer(lines.join("\n"));
  }

  function handleNext(isSkip = false) {
    let updatedAnswers = { ...answers };
    if (isSkip) {
      delete updatedAnswers[q.id];
    } else {
      if (q.renderer === "freeform" && freeformText.trim()) {
        updatedAnswers[q.id] = freeformText.trim();
      }
    }
    setAnswers(updatedAnswers);

    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setFreeformText("");
    } else {
      finish(updatedAnswers);
    }
  }

  const isLast = currentIdx === questions.length - 1;
  const hasSelection =
    (currentSelection && currentSelection.length > 0) ||
    (q.renderer === "freeform" && freeformText.trim().length > 0) ||
    (q.renderer === "url-collection" && urlList.length > 0) ||
    (q.renderer === "upload" && uploadFiles.length > 0);

  return (
    <div className="q-dock-container floats">
      {/* Top Header */}
      <div className="q-dock-head">
        <div className="q-dock-title-group">
          <h3 className="q-dock-title">{q.title}</h3>
          {q.description && <p className="q-dock-desc">{q.description}</p>}
        </div>
        <button
          type="button"
          className="q-dock-close"
          onClick={onDismiss}
          title="Dismiss questionnaire"
          aria-label="Close questionnaire"
        >
          ✕
        </button>
      </div>

      {/* Progress Dots / Steps */}
      {questions.length > 1 && (
        <div className="q-dock-steps">
          {questions.map((stepQ, idx) => (
            <button
              key={stepQ.id}
              type="button"
              className={`q-dock-step-pill ${idx === currentIdx ? "active" : ""} ${
                answers[stepQ.id] ? "answered" : ""
              }`}
              onClick={() => setCurrentIdx(idx)}
              title={stepQ.label || stepQ.title}
            >
              {idx + 1}. {stepQ.label || `Q${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Question Body per Renderer */}
      <div className="q-dock-body">
        {/* 1. Choice List */}
        {q.renderer === "choice-list" && (
          <div className="q-choice-list">
            {(q.options || []).map((opt, i) => {
              const selected = currentSelection.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`q-choice-card ${selected ? "selected" : ""}`}
                  onClick={() => handleSelectOption(opt.id)}
                >
                  <span className="q-opt-num">{i + 1}</span>
                  <div className="q-opt-text">
                    {opt.eyebrow && <span className="q-opt-eyebrow">{opt.eyebrow}</span>}
                    <span className="q-opt-title">{opt.title}</span>
                    {opt.body && <p className="q-opt-body">{opt.body}</p>}
                  </div>
                  {q.multiSelect && (
                    <span className={`q-opt-checkbox ${selected ? "checked" : ""}`}>
                      {selected ? "✓" : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 2. Visual Cards (3-color palette swatches) */}
        {q.renderer === "visual-cards" && (
          <div className="q-visual-cards-grid">
            {(q.options || []).map((opt) => {
              const selected = currentSelection.includes(opt.id);
              const colors = opt.colors || ["#333", "#666", "#999"];
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`q-visual-card ${selected ? "selected" : ""}`}
                  onClick={() => handleSelectOption(opt.id)}
                >
                  <div className="q-swatch-box">
                    <div
                      className="q-swatch-primary"
                      style={{ backgroundColor: colors[0] }}
                    />
                    <div className="q-swatch-sub-column">
                      <div
                        className="q-swatch-sub"
                        style={{ backgroundColor: colors[1] || colors[0] }}
                      />
                      <div
                        className="q-swatch-sub"
                        style={{ backgroundColor: colors[2] || colors[1] || colors[0] }}
                      />
                    </div>
                  </div>
                  <span className="q-visual-card-title">{opt.title}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 3. Drag-and-drop File Upload */}
        {q.renderer === "upload" && (
          <div className="q-upload-area">
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              multiple
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div
              className="q-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
            >
              <div className="q-dropzone-icon">🖼️</div>
              <p className="q-dropzone-primary">Drop images, wireframes, or sketches</p>
              <p className="q-dropzone-secondary">or click to browse your files</p>
            </div>
            {uploadFiles.length > 0 && (
              <div className="q-chip-list">
                {uploadFiles.map((fn, idx) => (
                  <span key={idx} className="q-file-chip">
                    📎 {fn}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. URL Collection */}
        {q.renderer === "url-collection" && (
          <div className="q-url-area">
            <div className="q-url-input-row">
              <input
                type="url"
                className="q-text-input"
                placeholder={q.placeholder || "https://..."}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddUrl();
                  }
                }}
              />
              <button
                type="button"
                className="btn secondary"
                onClick={handleAddUrl}
                disabled={!urlInput.trim()}
              >
                Add URL
              </button>
            </div>
            {urlList.length > 0 && (
              <div className="q-chip-list">
                {urlList.map((u, idx) => (
                  <span key={idx} className="q-url-chip">
                    🔗 {u}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Freeform text input */}
        {q.renderer === "freeform" && (
          <div className="q-freeform-area">
            <textarea
              className="q-textarea"
              rows={3}
              placeholder={q.placeholder || "Type your thoughts..."}
              value={freeformText}
              onChange={(e) => setFreeformText(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="q-dock-foot">
        <button
          type="button"
          className="q-btn-ghost"
          onClick={() => handleNext(true)}
        >
          Skip for now
        </button>

        <button
          type="button"
          className="btn primary q-btn-continue"
          onClick={() => handleNext(false)}
        >
          {isLast ? (hasSelection ? "Submit Answers" : "Finish") : "Continue →"}
        </button>
      </div>
    </div>
  );
}
