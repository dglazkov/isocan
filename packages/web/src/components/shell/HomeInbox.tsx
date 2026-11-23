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

import "./HomeInbox.css";
import { useMemo, useState, type FormEvent } from "react";
import { ago, type Actor, type Canvas } from "@isocan/core";
import {
  buildInlineReplyPayload,
  homeInboxFromResponse,
  type AskedAgentPresence,
  type HomeInboxItem,
  type HomeInboxModel,
  type InlineReplyPayload,
} from "@isocan/core/inbox-model";
import { sendOp } from "../../lib/api.ts";
import { useInboxStore } from "../../stores/inboxStore.ts";

/** Props for the lazy Home waiting Inbox. */
export interface HomeInboxProps {
  actor: Actor;
  canvases?: readonly Canvas[];
  /** Optional active `asked` agent presence rows from across canvases. */
  askedAgents?: readonly AskedAgentPresence[];
  /** Optional pre-built model override (for isolated component tests). */
  model?: HomeInboxModel;
  /** Optional inline reply submit override (defaults to `sendOp`). */
  onReply?: (payload: InlineReplyPayload) => Promise<void> | void;
}

const KIND_LABEL: Record<HomeInboxItem["kind"], string> = {
  ask: "Asked",
  mention: "Mention",
  thread: "Thread",
  chat: "Chat",
};

/**
 * Collapsible cross-canvas waiting Inbox shown at the top of Home when open
 * mentions or live agent asks are waiting on the viewer. Supports inline quick
 * reply via ordinary `thread.reply` ops without leaving Home.
 */
export function HomeInbox({ actor, canvases = [], askedAgents = [], model: modelOverride, onReply }: HomeInboxProps) {
  const store = useInboxStore();
  const [collapsed, setCollapsed] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canvasTitles = useMemo(
    () => Object.fromEntries(canvases.map((c) => [c.id, c.title])),
    [canvases],
  );

  const model = useMemo<HomeInboxModel>(() => {
    if (modelOverride) return modelOverride;
    const data = store.actorId === actor.id ? store.data : null;
    if (!data && askedAgents.length === 0) {
      return { items: [], unreadCount: 0, askCount: 0, mentionCount: 0 };
    }
    return homeInboxFromResponse(
      data ?? { entries: [], marks: {}, homes: {}, unavailable: [] },
      { askedAgents, canvasTitles },
    );
  }, [modelOverride, store.actorId, store.data, actor.id, askedAgents, canvasTitles]);

  if (model.items.length === 0) return null;

  const now = Date.now();

  async function submitReply(e: FormEvent, item: HomeInboxItem): Promise<void> {
    e.preventDefault();
    const draft = drafts[item.id] ?? "";
    const payload = buildInlineReplyPayload(item, draft);
    if (!payload || sending[item.id]) return;

    setSending((prev) => ({ ...prev, [item.id]: true }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    try {
      if (onReply) {
        await onReply(payload);
      } else {
        await sendOp(payload.canvasId, actor, payload.op);
      }
      setDrafts((prev) => ({ ...prev, [item.id]: "" }));
      setSent((prev) => ({ ...prev, [item.id]: true }));
      store.refresh();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [item.id]: err instanceof Error ? err.message : "Could not send reply",
      }));
    } finally {
      setSending((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  return (
    <section className="shell-home-inbox" aria-label="Waiting on you">
      <button
        type="button"
        className="shell-home-inbox-head"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((was) => !was)}
      >
        <span aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
        <span>Waiting on you</span>
        <span className="shell-home-inbox-badge">{model.items.length}</span>
      </button>

      {!collapsed && (
        <div className="shell-home-inbox-list">
          {model.items.map((item) => {
            const draft = drafts[item.id] ?? "";
            const isSending = Boolean(sending[item.id]);
            const wasSent = Boolean(sent[item.id]);
            const err = errors[item.id];
            return (
              <div key={item.id} className="shell-home-inbox-row">
                <div className="shell-home-inbox-meta">
                  <span className="shell-home-inbox-kind" data-kind={item.kind}>
                    {KIND_LABEL[item.kind]}
                  </span>
                  <strong>{item.authorName}</strong>
                  <a className="shell-home-inbox-link" href={item.href}>
                    {item.canvasTitle}
                  </a>
                  <time className="shell-home-inbox-when" dateTime={item.createdAt}>
                    {ago(item.createdAt, now) || "just now"}
                  </time>
                </div>
                <div className="shell-home-inbox-body">{item.body}</div>
                {item.threadId && (
                  <form className="shell-home-inbox-reply" onSubmit={(e) => void submitReply(e, item)}>
                    <input
                      type="text"
                      className="shell-home-inbox-input"
                      placeholder={`Reply to ${item.authorName}…`}
                      aria-label={`Reply to ${item.authorName} in ${item.canvasTitle}`}
                      value={draft}
                      disabled={isSending}
                      onChange={(e) => {
                        setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }));
                        if (wasSent) setSent((prev) => ({ ...prev, [item.id]: false }));
                      }}
                    />
                    <button
                      type="submit"
                      className="btn primary"
                      disabled={!draft.trim() || isSending}
                    >
                      {isSending ? "Sending…" : "Reply"}
                    </button>
                  </form>
                )}
                {wasSent && <span className="shell-home-inbox-sent" role="status">Reply sent</span>}
                {err && <span className="shell-home-inbox-err" role="alert">{err}</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default HomeInbox;
