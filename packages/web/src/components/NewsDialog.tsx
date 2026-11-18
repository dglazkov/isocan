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

import "./news-dialog.css";

import { useEffect, useState } from "react";
import { newestDay, type NewsDay } from "@isocan/core";
import { fetchNews } from "../lib/api.ts";
import { markSeen } from "../lib/news.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { Modal } from "./Modal.tsx";

/**
 * **What changed, for the person using this.**
 *
 * `docs/changelog/` is the other document and is deliberately not this one:
 * it names functions, records the arguments that were had, and keeps the
 * roads not taken. Right for whoever maintains this, wrong to put in front of
 * somebody who wants to know whether the canvas does anything new today.
 *
 * The entries come from the home this canvas is on, so what you are told is
 * new is what you are actually running — a home a week behind has nothing
 * newer to show, and says so by being quiet.
 */
export function NewsDialog() {
  const open = useUiStore((s) => s.newsOpen);
  const setOpen = useUiStore((s) => s.setNewsOpen);
  const [days, setDays] = useState<NewsDay[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    fetchNews()
      .then((r) => {
        if (!live) return;
        setDays(r.days);
        // Read on OPEN, not on close: a panel you opened and skimmed has been
        // seen, and making somebody scroll to the bottom to clear a dot is a
        // toll rather than a record.
        markSeen(newestDay(r.days));
      })
      .catch(() => live && setDays([]));
    return () => {
      live = false;
    };
  }, [open]);

  if (!open) return null;
  return (
    /**
     * **A modal across the top of the canvas, not a column down its side.**
     *
     * It was a right-hand panel first and that was wrong twice: it sat on top
     * of the Chat rail, and release notes are SENTENCES — in a 380px column
     * every line wrapped three times and the panel was mostly empty below the
     * fold. Wide, the day is a label in the margin and the notes read as
     * prose, which is what they are.
     */
    <Modal label="What's new" title="What's new" onClose={() => setOpen(false)} wide>
      {days === null && <p className="canvas-none">Reading…</p>}
      {days?.length === 0 && (
        /* Not an error: a home with no notes is a home with nothing to say. */
        <p className="canvas-none">Nothing noted yet.</p>
      )}
      {days?.map((d) => (
        <section className="news-day" key={d.day}>
          <h3>{d.title}</h3>
          <ul>
            {d.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </Modal>
  );
}

