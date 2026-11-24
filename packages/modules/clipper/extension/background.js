/* global chrome */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "clipper:capture") return false;

  (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) throw new Error("No active tab to clip");

    let selection = "";
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString() ?? "",
      });
      if (typeof result === "string") selection = result;
    } catch {
      // Restricted pages may disallow script injection; fall back to bookmark clip.
    }

    const base = String(message.home || "http://127.0.0.1:4173").replace(/\/+$/, "");
    const headers = { "content-type": "application/json" };
    if (message.token) headers["authorization"] = `Bearer ${message.token}`;

    const res = await fetch(`${base}/api/m/clipper/capture`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        canvasId: message.canvasId,
        url: tab.url,
        title: tab.title,
        ...(selection ? { selection } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    sendResponse({ ok: true, itemId: body.itemId });
  })().catch((err) => {
    sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
  });

  return true;
});
