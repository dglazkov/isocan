import { useState } from "react";
import type { Actor, Placement } from "@isocan/core";
import { mainThread } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { addBrowserItem } from "../lib/upload.ts";
import { screenToWorld } from "../lib/viewport.ts";
import { openMainPanel } from "./MainThreadPanel.tsx";
import { openFilesPanel } from "./FilesPanel.tsx";
import { unreadCount, useUnreadStore } from "../stores/unreadStore.ts";

/**
 * **What is left here is a panel switch, and that is the whole point.**
 *
 * This file held the "content actions" docked in the top bar. Upload went to
 * the tool rail first; `＋ Site` followed it, for the reason stated a few
 * lines below about its old neighbours — an action makes something and is
 * over, a toggle says what you are looking at and stays put — and because
 * "bring something onto the canvas" is one category with one home. The top
 * bar is now navigation, identity and lookups, with nothing in it that makes
 * an item.
 */
