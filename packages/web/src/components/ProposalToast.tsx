import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./proposal-marks.css";

/** How long an untouched toast stays before it closes on its own — and the note goes without a reason. */
const QUIET_MS = 8000;

interface ToastRequest {
  title: string;
  author: string;
  /** Whether anything can answer for the author right now. */
  answerable: boolean;
  /** Called once, with the reason typed (or ""), when the toast closes. */
  onClose: (reason: string) => void;
}

/**
 * **The toast after a proposal's Delete** (`lib/proposalDelete.ts`): what
 * happened, whether the note was taken, and a field for the reason. Its own
 * root on `document.body`, like the Compare inspector, so the entry chunk
 * pays nothing; one per delete, replacing the last.
 */
export function showProposalToast(request: ToastRequest): void {
  const host = document.createElement("div");
  host.dataset.proposalToast = "";
  document.body.querySelectorAll("[data-proposal-toast]").forEach((old) => old.dispatchEvent(new Event("proposal-toast-close")));
  document.body.appendChild(host);
  const root = createRoot(host);
  const done = () => {
    root.unmount();
    host.remove();
  };
  root.render(<ProposalToast {...request} host={host} done={done} />);
}

function ProposalToast({ title, author, answerable, onClose, host, done }: ToastRequest & { host: HTMLElement; done: () => void }) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const closed = useRef(false);
  const reasonRef = useRef("");
  reasonRef.current = reason;

  const close = () => {
    if (closed.current) return;
    closed.current = true;
    onClose(reasonRef.current);
    done();
  };

  useEffect(() => {
    // A newer delete's toast closes this one, sending what it has.
    const replaced = () => close();
    host.addEventListener("proposal-toast-close", replaced);
    // Leaving the page still writes the note.
    window.addEventListener("pagehide", replaced);
    return () => {
      host.removeEventListener("proposal-toast-close", replaced);
      window.removeEventListener("pagehide", replaced);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (touched) return;
    const timer = setTimeout(close, QUIET_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched]);

  return (
    <div className="proposal-toast" role="status" aria-live="polite" data-untaken={answerable ? undefined : ""}>
      <p>
        {answerable
          ? `Deleted “${title}”. ${author} will note what it taught.`
          : `Deleted “${title}”. Nothing can answer for ${author} right now, so the note was not taken.`}
      </p>
      <div className="proposal-toast-row">
        <input
          aria-label="Why? (optional)"
          placeholder="Why? (optional)"
          value={reason}
          onFocus={() => setTouched(true)}
          onChange={(e) => {
            setTouched(true);
            setReason(e.target.value);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              if (e.key === "Escape") reasonRef.current = "";
              close();
            }
          }}
        />
        <button type="button" className="btn" onClick={close}>
          {reason.trim() ? "Send" : "Close"}
        </button>
      </div>
    </div>
  );
}
