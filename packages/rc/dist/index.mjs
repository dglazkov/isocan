var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e2) {
    throw err = [e2], e2;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// packages/core/src/model.ts
function isSystemActor(actorId) {
  return actorId.startsWith("sys_");
}
function mainThread(canvas) {
  return Object.values(canvas.threads).find((thread) => thread.main) ?? null;
}
var SYSTEM_ACTOR;
var init_model = __esm({
  "packages/core/src/model.ts"() {
    "use strict";
    SYSTEM_ACTOR = { id: "sys_isocan", name: "isocan" };
  }
});

// packages/core/src/comment-references.ts
function commentReferencedItemIds(canvas, comment) {
  const context = comment.context;
  const entries = new Map(context?.entries.map((entry) => [entry.itemId, entry]));
  return [...new Set(context ? context.rootIds : comment.items ?? [])].filter((id) => {
    if (context) {
      const entry = entries.get(id);
      if (!entry || entry.excluded || entry.unavailable || !entry.version) return false;
    }
    const item = canvas.items[id];
    return !!item?.versions.some((version) => version.id === item.currentVersionId);
  });
}
function threadTargetItem(canvas, thread, extraItemIds) {
  if (thread?.anchorItemId && canvas.items[thread.anchorItemId]) {
    return canvas.items[thread.anchorItemId];
  }
  if (extraItemIds) {
    for (const id of extraItemIds) {
      if (canvas.items[id]) return canvas.items[id];
    }
  }
  if (!thread) return void 0;
  for (let i = thread.comments.length - 1; i >= 0; i--) {
    const comment = thread.comments[i];
    const refs = commentReferencedItemIds(canvas, comment);
    for (const id of refs) {
      if (canvas.items[id]) return canvas.items[id];
    }
    for (const id of comment.items ?? []) {
      if (canvas.items[id]) return canvas.items[id];
    }
  }
  return void 0;
}
var init_comment_references = __esm({
  "packages/core/src/comment-references.ts"() {
    "use strict";
  }
});

// packages/core/src/errors.ts
var ApiError, OpValidationError;
var init_errors = __esm({
  "packages/core/src/errors.ts"() {
    "use strict";
    ApiError = class extends Error {
      constructor(status, message, code, reason) {
        super(message);
        this.status = status;
        this.code = code;
        this.reason = reason;
        this.name = "ApiError";
      }
      status;
      code;
      reason;
    };
    OpValidationError = class extends Error {
      constructor(code, message, reason) {
        super(message);
        this.code = code;
        this.reason = reason;
        this.name = "OpValidationError";
      }
      code;
      reason;
    };
  }
});

// packages/core/src/drawing.ts
function isDrawingItem(item) {
  return item.properties.kind === DRAWING_KIND;
}
var DRAWING_KIND;
var init_drawing = __esm({
  "packages/core/src/drawing.ts"() {
    "use strict";
    DRAWING_KIND = "drawing";
  }
});

// packages/core/src/annotation.ts
var init_annotation = __esm({
  "packages/core/src/annotation.ts"() {
    "use strict";
    init_drawing();
  }
});

// packages/core/src/canvas-group-context.ts
function canvasContextRoute(canvasId) {
  return `/api/projects/${encodeURIComponent(canvasId)}/context`;
}
function commentContextRoute(canvasId, threadId, commentId) {
  return `/api/projects/${encodeURIComponent(canvasId)}/threads/${encodeURIComponent(threadId)}/comments/${encodeURIComponent(commentId)}/context`;
}
var init_canvas_group_context = __esm({
  "packages/core/src/canvas-group-context.ts"() {
    "use strict";
    init_errors();
    init_annotation();
  }
});

// packages/core/src/design-record.ts
var init_design_record = __esm({
  "packages/core/src/design-record.ts"() {
    "use strict";
    init_errors();
  }
});

// packages/core/src/canvas-group-context-resolve.ts
var init_canvas_group_context_resolve = __esm({
  "packages/core/src/canvas-group-context-resolve.ts"() {
    "use strict";
    init_model();
    init_errors();
    init_annotation();
    init_design_record();
    init_canvas_group_context();
  }
});

// packages/core/src/canvas-group-kit.ts
function fail(message) {
  throw new OpValidationError("bad-op", `canvas group: ${message}`);
}
function itemIn(canvas, id) {
  const item = canvas.items[id];
  if (!item) throw new OpValidationError("unknown-item", `unknown item: ${id}`);
  return item;
}
function isGroupItem(item) {
  return item.properties.kind === GROUP_KIND;
}
var GROUP_KIND;
var init_canvas_group_kit = __esm({
  "packages/core/src/canvas-group-kit.ts"() {
    "use strict";
    init_annotation();
    init_errors();
    GROUP_KIND = "group";
  }
});

// packages/core/src/zoomrule.ts
var init_zoomrule = __esm({
  "packages/core/src/zoomrule.ts"() {
    "use strict";
  }
});

// packages/core/src/textnode.ts
function isTextItem(item) {
  return item.properties.kind === TEXT_KIND;
}
var TEXT_KIND, TEXT_WIDTH, TEXT_STYLES, TEXT_COLUMN, TEXT_COLUMN_MAX;
var init_textnode = __esm({
  "packages/core/src/textnode.ts"() {
    "use strict";
    init_zoomrule();
    TEXT_KIND = "text";
    TEXT_WIDTH = 320;
    TEXT_STYLES = ["body", "heading", "title", "display"];
    TEXT_COLUMN = {
      body: TEXT_WIDTH,
      heading: 480,
      title: 640,
      display: 880
    };
    TEXT_COLUMN_MAX = Object.fromEntries(
      TEXT_STYLES.map((style) => [style, TEXT_COLUMN[style] * 2])
    );
  }
});

// packages/core/src/placement.ts
var init_placement = __esm({
  "packages/core/src/placement.ts"() {
    "use strict";
    init_drawing();
    init_annotation();
    init_textnode();
    init_errors();
  }
});

// packages/core/src/canonical-json.ts
var init_canonical_json = __esm({
  "packages/core/src/canonical-json.ts"() {
    "use strict";
  }
});

// packages/core/src/design-partner-values.ts
var init_design_partner_values = __esm({
  "packages/core/src/design-partner-values.ts"() {
    "use strict";
  }
});

// packages/core/src/design-brief.ts
var init_design_brief = __esm({
  "packages/core/src/design-brief.ts"() {
    "use strict";
    init_canvas_group_context();
    init_design_partner_values();
  }
});

// packages/core/src/design-partner.ts
var init_design_partner = __esm({
  "packages/core/src/design-partner.ts"() {
    "use strict";
    init_design_partner_values();
    init_design_partner_values();
    init_design_brief();
    init_design_brief();
  }
});

// packages/core/src/design-request-parse.ts
var init_design_request_parse = __esm({
  "packages/core/src/design-request-parse.ts"() {
    "use strict";
    init_canonical_json();
    init_design_partner_values();
    init_design_partner_values();
    init_design_partner();
  }
});

// packages/core/src/design-decision-parse.ts
var init_design_decision_parse = __esm({
  "packages/core/src/design-decision-parse.ts"() {
    "use strict";
    init_canonical_json();
    init_design_partner();
    init_design_request_parse();
    init_design_partner_values();
  }
});

// packages/core/src/design-repair-parse.ts
var init_design_repair_parse = __esm({
  "packages/core/src/design-repair-parse.ts"() {
    "use strict";
    init_canonical_json();
    init_design_partner();
    init_design_decision_parse();
    init_design_request_parse();
    init_design_partner_values();
  }
});

// packages/core/src/design-retention.ts
var init_design_retention = __esm({
  "packages/core/src/design-retention.ts"() {
    "use strict";
    init_canvas_group_context();
    init_design_partner();
    init_errors();
  }
});

// packages/core/src/area.ts
function isArea(item) {
  return item.properties.kind === AREA_KIND;
}
function inArea(area, item) {
  if (item.id === area.id || isArea(item)) return false;
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  return cx >= area.x && cx < area.x + area.width && cy >= area.y && cy < area.y + area.height;
}
var AREA_KIND, AREA_TITLE_HEIGHT, AREA_CARD_HEIGHT, AREA_HEAD;
var init_area = __esm({
  "packages/core/src/area.ts"() {
    "use strict";
    init_placement();
    init_textnode();
    AREA_KIND = "area";
    AREA_TITLE_HEIGHT = 56;
    AREA_CARD_HEIGHT = 120;
    AREA_HEAD = AREA_TITLE_HEIGHT + AREA_CARD_HEIGHT;
  }
});

// packages/core/src/canvas-scope.ts
function inCanvasScope(canvas, scope, item) {
  return isGroupItem(scope) ? groupAncestors(canvas, item.id).some((parent) => parent.id === scope.id) : inArea(scope, item);
}
var init_canvas_scope = __esm({
  "packages/core/src/canvas-scope.ts"() {
    "use strict";
    init_area();
    init_canvas_groups();
  }
});

// packages/core/src/design-decision-state.ts
var init_design_decision_state = __esm({
  "packages/core/src/design-decision-state.ts"() {
    "use strict";
    init_design_decision_parse();
    init_design_partner();
    init_design_partner_values();
    init_errors();
    init_design_retention();
    init_canvas_scope();
  }
});

// packages/core/src/design-repair-state.ts
var init_design_repair_state = __esm({
  "packages/core/src/design-repair-state.ts"() {
    "use strict";
    init_design_repair_parse();
    init_design_partner_values();
    init_design_decision_state();
    init_design_retention();
    init_errors();
  }
});

// packages/core/src/text-anchor.ts
var init_text_anchor = __esm({
  "packages/core/src/text-anchor.ts"() {
    "use strict";
    init_errors();
  }
});

// packages/core/src/ceiling.ts
var init_ceiling = __esm({
  "packages/core/src/ceiling.ts"() {
    "use strict";
  }
});

// packages/core/src/identity.ts
function resolveActor(joined, actorId) {
  if (!joined) return actorId;
  let current = actorId;
  const seen = /* @__PURE__ */ new Set([current]);
  for (; ; ) {
    const next = joined[current];
    if (next === void 0 || seen.has(next)) return current;
    seen.add(next);
    current = next;
  }
}
function sameActor(joined, a, b) {
  return a === b || resolveActor(joined, a) === resolveActor(joined, b);
}
function actorNameIn(names, actor) {
  const current = names?.[actor.id];
  return current && current.trim() ? current : actor.name;
}
var init_identity = __esm({
  "packages/core/src/identity.ts"() {
    "use strict";
  }
});

// packages/core/src/questionnaire-adoption.ts
var init_questionnaire_adoption = __esm({
  "packages/core/src/questionnaire-adoption.ts"() {
    "use strict";
    init_errors();
    init_design_partner();
    init_questionnaire();
  }
});

// packages/core/src/questionnaire.ts
var questionnaireActorsRoute;
var init_questionnaire = __esm({
  "packages/core/src/questionnaire.ts"() {
    "use strict";
    init_design_retention();
    init_errors();
    init_design_partner();
    init_identity();
    init_design_decision_state();
    init_questionnaire_adoption();
    questionnaireActorsRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/questionnaire/actors`;
  }
});

// packages/core/src/design-partner-plan.ts
var init_design_partner_plan = __esm({
  "packages/core/src/design-partner-plan.ts"() {
    "use strict";
    init_canonical_json();
    init_model();
    init_design_partner();
  }
});

// node_modules/nanoid/url-alphabet/index.js
var urlAlphabet;
var init_url_alphabet = __esm({
  "node_modules/nanoid/url-alphabet/index.js"() {
    urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  }
});

// node_modules/nanoid/index.browser.js
var nanoid;
var init_index_browser = __esm({
  "node_modules/nanoid/index.browser.js"() {
    init_url_alphabet();
    nanoid = (size = 21) => {
      let id = "";
      let bytes = crypto.getRandomValues(new Uint8Array(size |= 0));
      while (size--) {
        id += urlAlphabet[bytes[size] & 63];
      }
      return id;
    };
  }
});

// packages/core/src/ids.ts
function newId(prefix) {
  return `${prefix}_${nanoid(10)}`;
}
var newThreadId, newCommentId;
var init_ids = __esm({
  "packages/core/src/ids.ts"() {
    "use strict";
    init_index_browser();
    newThreadId = () => newId("thr");
    newCommentId = () => newId("cmt");
  }
});

// packages/core/src/itemthread.ts
var init_itemthread = __esm({
  "packages/core/src/itemthread.ts"() {
    "use strict";
  }
});

// packages/core/src/prototype-click.ts
var init_prototype_click = __esm({
  "packages/core/src/prototype-click.ts"() {
    "use strict";
    init_errors();
    init_ids();
    init_itemthread();
    init_placement();
  }
});

// packages/core/src/lineage.ts
var PARENT_PROP;
var init_lineage = __esm({
  "packages/core/src/lineage.ts"() {
    "use strict";
    PARENT_PROP = "parent";
  }
});

// packages/core/src/proposal.ts
var init_proposal = __esm({
  "packages/core/src/proposal.ts"() {
    "use strict";
    init_lineage();
  }
});

// packages/core/src/reducer.ts
var init_reducer = __esm({
  "packages/core/src/reducer.ts"() {
    "use strict";
    init_design_repair_state();
    init_text_anchor();
    init_canvas_group_context();
    init_model();
    init_errors();
    init_ceiling();
    init_questionnaire();
    init_design_partner();
    init_design_partner_plan();
    init_placement();
    init_canvas_groups();
    init_design_record();
    init_prototype_click();
    init_proposal();
    init_design_decision_state();
  }
});

// packages/core/src/activity-op.ts
var init_activity_op = __esm({
  "packages/core/src/activity-op.ts"() {
    "use strict";
  }
});

// packages/core/src/opwords.ts
var init_opwords = __esm({
  "packages/core/src/opwords.ts"() {
    "use strict";
    init_activity_op();
  }
});

// packages/core/src/canvas-groups.ts
function groupAncestors(canvas, itemId) {
  return ancestors(canvas, itemIn(canvas, itemId)).map((id) => itemIn(canvas, id));
}
function ancestors(canvas, item) {
  const found = [];
  const seen = /* @__PURE__ */ new Set([item.id]);
  let parent = item.containerId;
  while (parent) {
    if (seen.has(parent)) fail("membership cycle");
    seen.add(parent);
    found.push(parent);
    parent = itemIn(canvas, parent).containerId;
  }
  return found;
}
function groupChangeItemIds(op) {
  if (op.action.kind === "migrate") return [];
  if (op.action.kind === "apply") return op.action.change.writes.map((write) => write.kind === "create" ? write.item.id : write.itemId);
  if (op.action.kind === "create") return [op.action.group.id, ...op.action.itemIds ?? []];
  if (op.action.kind === "insert") return [op.action.item.itemId];
  if (op.action.kind === "content") return [op.action.operation.itemId];
  if (op.action.kind === "copy") return op.action.rootIds;
  return "itemIds" in op.action ? op.action.itemIds : "moves" in op.action ? op.action.moves.map((move) => move.itemId) : "targets" in op.action ? op.action.targets.map((target) => target.itemId) : [op.action.itemId];
}
var init_canvas_groups = __esm({
  "packages/core/src/canvas-groups.ts"() {
    "use strict";
    init_model();
    init_annotation();
    init_drawing();
    init_errors();
    init_canvas_group_kit();
    init_placement();
    init_reducer();
    init_opwords();
  }
});

// packages/core/src/duplicate.ts
var init_duplicate = __esm({
  "packages/core/src/duplicate.ts"() {
    "use strict";
    init_lineage();
    init_placement();
  }
});

// packages/core/src/edges.ts
var init_edges = __esm({
  "packages/core/src/edges.ts"() {
    "use strict";
  }
});

// packages/core/src/modules.ts
function modules() {
  return [...REGISTRY.values()];
}
function moduleKinds() {
  return modules().flatMap((m) => m.kinds ?? []);
}
function moduleKindOf(mime) {
  return moduleKinds().find((k) => k.mimes.includes(mime)) ?? null;
}
var REGISTRY, JUDGMENT_ROUTE;
var init_modules = __esm({
  "packages/core/src/modules.ts"() {
    "use strict";
    init_canvas_scope();
    REGISTRY = /* @__PURE__ */ new Map();
    JUDGMENT_ROUTE = "/api/judgment";
  }
});

// packages/core/src/canvas-group-copy.ts
var init_canvas_group_copy = __esm({
  "packages/core/src/canvas-group-copy.ts"() {
    "use strict";
    init_canvas_groups();
    init_duplicate();
    init_edges();
    init_modules();
    init_errors();
  }
});

// packages/core/src/canvas-group-migration.ts
var init_canvas_group_migration = __esm({
  "packages/core/src/canvas-group-migration.ts"() {
    "use strict";
    init_area();
    init_annotation();
    init_canvas_groups();
    init_errors();
  }
});

// packages/core/src/ops.ts
var init_ops = __esm({
  "packages/core/src/ops.ts"() {
    "use strict";
  }
});

// packages/core/src/badge.ts
function formatDotToken(id, secret) {
  return `${id}.${secret}`;
}
function formatBadgeToken(badgeId, secret) {
  return formatDotToken(badgeId, secret);
}
async function askTheDoor(base2, timeoutMs = 1e4, signal, fetchFn = fetch) {
  try {
    const res = await fetchFn(`${base2}${DOOR_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier: "bearer" }),
      signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...signal ? [signal] : []])
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        refused: {
          status: res.status,
          error: body?.error ?? `the door refused: HTTP ${res.status}`,
          ...body?.code ? { code: body.code } : {}
        }
      };
    }
    if (!body?.secret) {
      return { refused: { status: res.status, error: "the door handed back no secret" } };
    }
    return { badge: { badgeId: body.badgeId, secret: body.secret, at: (/* @__PURE__ */ new Date()).toISOString() } };
  } catch (err) {
    return { refused: { status: 0, error: `could not reach the door at ${base2}: ${err.message}` } };
  }
}
function bearerHeader(badge) {
  return { Authorization: `${BADGE_SCHEME} ${formatBadgeToken(badge.badgeId, badge.secret)}` };
}
var BADGE_SCHEME, DOOR_ROUTE, BADGES_ROUTE, badgeRoute;
var init_badge = __esm({
  "packages/core/src/badge.ts"() {
    "use strict";
    BADGE_SCHEME = "Bearer";
    DOOR_ROUTE = "/api/door";
    BADGES_ROUTE = "/api/badges";
    badgeRoute = (badgeId) => `${BADGES_ROUTE}/${encodeURIComponent(badgeId)}`;
  }
});

// packages/core/src/rungs.ts
function narrowed(capability) {
  return capability !== void 0 && capability !== "edit";
}
var init_rungs = __esm({
  "packages/core/src/rungs.ts"() {
    "use strict";
  }
});

// packages/core/src/grants.ts
var grantsRoute, grantRoute, grantRevokeRoute, SPACES_ROUTE, spaceRoute, spaceCanvasRoute, spaceGrantsRoute, spaceGrantRoute, spaceGrantRevokeRoute, spaceLinkRoute, spaceActingRoute, GROUPS_ROUTE, groupRoute, groupMemberRoute, groupActingRoute;
var init_grants = __esm({
  "packages/core/src/grants.ts"() {
    "use strict";
    init_identity();
    init_rungs();
    grantsRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/grants`;
    grantRoute = (canvasId, grantId) => `${grantsRoute(canvasId)}/${encodeURIComponent(grantId)}`;
    grantRevokeRoute = (canvasId, grantId, options = {}) => {
      const query = new URLSearchParams();
      if (options.actorId) query.set("actorId", options.actorId);
      if (options.bar) query.set("bar", "1");
      const route = grantRoute(canvasId, grantId);
      const tail = query.toString();
      return tail ? `${route}?${tail}` : route;
    };
    SPACES_ROUTE = "/api/spaces";
    spaceRoute = (spaceId) => `${SPACES_ROUTE}/${encodeURIComponent(spaceId)}`;
    spaceCanvasRoute = (spaceId, canvasId) => `${spaceRoute(spaceId)}/canvases/${encodeURIComponent(canvasId)}`;
    spaceGrantsRoute = (spaceId) => `${spaceRoute(spaceId)}/grants`;
    spaceGrantRoute = (spaceId, grantId) => `${spaceGrantsRoute(spaceId)}/${encodeURIComponent(grantId)}`;
    spaceGrantRevokeRoute = (spaceId, grantId, options = {}) => {
      const query = new URLSearchParams();
      if (options.actorId) query.set("actorId", options.actorId);
      if (options.bar) query.set("bar", "1");
      const route = spaceGrantRoute(spaceId, grantId);
      const tail = query.toString();
      return tail ? `${route}?${tail}` : route;
    };
    spaceLinkRoute = (spaceId) => `${spaceRoute(spaceId)}/link`;
    spaceActingRoute = (route, actorId) => actorId ? `${route}?${new URLSearchParams({ actorId }).toString()}` : route;
    GROUPS_ROUTE = "/api/groups";
    groupRoute = (groupId) => `${GROUPS_ROUTE}/${encodeURIComponent(groupId)}`;
    groupMemberRoute = (groupId, attribute) => `${groupRoute(groupId)}/members/${encodeURIComponent(attribute)}`;
    groupActingRoute = spaceActingRoute;
  }
});

// packages/core/src/public.ts
function publicListingRoute(canvasId, grantId) {
  return `/api/projects/${encodeURIComponent(canvasId)}/grants/${encodeURIComponent(grantId)}/listing`;
}
var PUBLIC_CANVASES_ROUTE;
var init_public = __esm({
  "packages/core/src/public.ts"() {
    "use strict";
    init_grants();
    PUBLIC_CANVASES_ROUTE = "/api/public";
  }
});

// packages/core/src/personal.ts
function parseSourcePolicyHeader(value) {
  if (value.length > 4096) throw new Error("source policy is too large");
  const row = JSON.parse(value);
  if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).some((key) => key !== "policy" && key !== "expectedHome") || row.expectedHome !== void 0 && (typeof row.expectedHome !== "string" || !row.expectedHome)) {
    throw new Error("invalid source policy");
  }
  const policy = row.policy;
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) throw new Error("invalid source policy");
  if (policy.mode === "exclude" && Object.keys(policy).length === 1) {
    return Object.freeze({
      policy: Object.freeze({ mode: "exclude" }),
      ...typeof row.expectedHome === "string" ? { expectedHome: row.expectedHome } : {}
    });
  }
  if (policy.mode !== "direct" || Object.keys(policy).length !== 3 || typeof policy.actorId !== "string" || !policy.actorId || policy.actorId.length > 256 || policy.intent !== "read" && policy.intent !== "edit" && policy.intent !== "own") {
    throw new Error("invalid source policy");
  }
  return Object.freeze({
    policy: Object.freeze({ mode: "direct", actorId: policy.actorId, intent: policy.intent }),
    ...typeof row.expectedHome === "string" ? { expectedHome: row.expectedHome } : {}
  });
}
function sourcePolicyHeader(context) {
  return JSON.stringify(parseSourcePolicyHeader(JSON.stringify({
    policy: context.policy,
    ...context.expectedHome !== void 0 ? { expectedHome: context.expectedHome } : {}
  })));
}
function sourceClassificationRoute(request) {
  return `/api/source-classification?${new URLSearchParams(request)}`;
}
function personalRoute(actorId, destinationCanvasId) {
  const params = new URLSearchParams({ ...actorId === void 0 ? {} : { actorId }, ...destinationCanvasId === void 0 ? {} : { destinationCanvasId } });
  return `/api/personal${params.size ? `?${params}` : ""}`;
}
function personalCanvasRoute(canvasId, action, actorId) {
  return `/api/projects/${encodeURIComponent(canvasId)}/personal${action ? `/${action}` : ""}${actorId === void 0 ? "" : `?actorId=${encodeURIComponent(actorId)}`}`;
}
function personalDelegatesRoute(sourceCanvasId, agentId, actorId) {
  return `/api/personal/sources/${encodeURIComponent(sourceCanvasId)}/delegates${agentId === void 0 ? "" : `/${encodeURIComponent(agentId)}`}${actorId === void 0 ? "" : `?actorId=${encodeURIComponent(actorId)}`}`;
}
var SOURCE_POLICY_HEADER, SOURCE_ACCESS_ROUTE;
var init_personal = __esm({
  "packages/core/src/personal.ts"() {
    "use strict";
    SOURCE_POLICY_HEADER = "X-Isocan-Source-Policy";
    SOURCE_ACCESS_ROUTE = "/api/source-access";
  }
});

// packages/core/src/passes.ts
var PASS_TTL_MS, passesRoute, passRoute, PASS_REDEEM_ROUTE;
var init_passes = __esm({
  "packages/core/src/passes.ts"() {
    "use strict";
    init_badge();
    PASS_TTL_MS = 15 * 60 * 1e3;
    passesRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/passes`;
    passRoute = (canvasId, passId) => `${passesRoute(canvasId)}/${encodeURIComponent(passId)}`;
    PASS_REDEEM_ROUTE = "/api/passes/redeem";
  }
});

// packages/core/src/address.ts
function canvasPath(canvasId) {
  return `${CANVAS_PATH_PREFIX}/${encodeURIComponent(canvasId)}`;
}
function canvasUrl(origin, canvasId) {
  return `${origin.replace(/\/+$/, "")}${canvasPath(canvasId)}`;
}
function canvasUrlWithPass(origin, canvasId, token) {
  return urlWithPass(canvasUrl(origin, canvasId), token);
}
function urlWithPass(url2, token) {
  return `${url2}#${token}`;
}
function splitPassFragment(address) {
  const hash2 = address.indexOf("#");
  if (hash2 < 0) return { address };
  const pass = address.slice(hash2 + 1);
  const rest = address.slice(0, hash2);
  return pass ? { address: rest, pass } : { address: rest };
}
function parseCanvasAddress(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const { address, pass } = splitPassFragment(trimmed);
  const schemed = /^[a-z][a-z0-9+.-]*:\/\//i.test(address) ? address : `${/^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(address) ? "http" : "https"}://${address}`;
  let url2;
  try {
    url2 = new URL(schemed);
  } catch {
    return null;
  }
  if (url2.protocol !== "http:" && url2.protocol !== "https:") return null;
  if (!url2.hostname) return null;
  const parts = url2.pathname.replace(/\/+$/, "").split("/");
  if (parts.length !== 3 || parts[0] !== "" || `/${parts[1]}` !== CANVAS_PATH_PREFIX) return null;
  const canvasId = decodeSegment(parts[2]);
  if (!canvasId) return null;
  return { origin: url2.origin, canvasId, ...pass !== void 0 ? { pass } : {} };
}
function decodeSegment(segment) {
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
function normalizeHomeUrl(raw) {
  const trimmed = raw.trim();
  try {
    const url2 = new URL(trimmed);
    if (url2.protocol !== "http:" && url2.protocol !== "https:") return trimmed.replace(/\/+$/, "");
    return url2.origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}
var CANVAS_PATH_PREFIX, CANVAS_ROUTE, ITEM_ROUTE, DECK_PATH_SEGMENT, DECK_ROUTE, MODULE_PAGE_PATH_SEGMENT, MODULE_PAGE_ROUTE, WORKBENCH_PATH_SEGMENT, WORKBENCH_ROUTE, WORKBENCH_ITEM_ROUTE;
var init_address = __esm({
  "packages/core/src/address.ts"() {
    "use strict";
    CANVAS_PATH_PREFIX = "/p";
    CANVAS_ROUTE = `${CANVAS_PATH_PREFIX}/:canvasId`;
    ITEM_ROUTE = `${CANVAS_ROUTE}/i/:itemId`;
    DECK_PATH_SEGMENT = "deck";
    DECK_ROUTE = `${CANVAS_ROUTE}/${DECK_PATH_SEGMENT}`;
    MODULE_PAGE_PATH_SEGMENT = "x";
    MODULE_PAGE_ROUTE = `${CANVAS_ROUTE}/${MODULE_PAGE_PATH_SEGMENT}/:segment`;
    WORKBENCH_PATH_SEGMENT = "w";
    WORKBENCH_ROUTE = `${CANVAS_ROUTE}/${WORKBENCH_PATH_SEGMENT}`;
    WORKBENCH_ITEM_ROUTE = `${WORKBENCH_ROUTE}/:wbItemId`;
  }
});

// packages/core/src/emoji.ts
var e, EMOJI_GROUPS;
var init_emoji = __esm({
  "packages/core/src/emoji.ts"() {
    "use strict";
    e = (emoji, name, ...keywords) => ({
      emoji,
      name,
      keywords
    });
    EMOJI_GROUPS = [
      {
        name: "Verdicts",
        entries: [
          e("\u{1F44D}", "thumbs up", "yes", "approve", "ok", "good", "like", "+1"),
          e("\u{1F44E}", "thumbs down", "no", "reject", "bad", "-1"),
          e("\u2705", "check", "done", "shipped", "approved", "yes", "tick", "complete"),
          e("\u274C", "cross", "no", "wrong", "reject", "fail"),
          e("\u{1F6A7}", "construction", "wip", "progress", "blocked", "working", "hold"),
          e("\u{1F440}", "eyes", "review", "looking", "watch", "seen", "attention"),
          e("\u{1F914}", "thinking", "hmm", "unsure", "question", "maybe"),
          e("\u2753", "question", "ask", "unclear", "what"),
          e("\u2757", "exclamation", "important", "urgent", "attention"),
          e("\u26A0\uFE0F", "warning", "careful", "risk", "caution"),
          e("\u{1F6D1}", "stop", "halt", "blocked", "no"),
          e("\u{1F3C1}", "finish", "done", "end", "goal", "ship"),
          e("\u2B50", "star", "favourite", "favorite", "keep", "best", "pick"),
          e("\u{1F947}", "first place", "winner", "best", "gold", "one"),
          e("\u{1F195}", "new", "fresh", "latest"),
          e("\u{1F512}", "locked", "frozen", "final", "closed"),
          e("\u{1F513}", "unlocked", "open", "editable"),
          e("\u267B\uFE0F", "recycle", "redo", "rework", "again", "iterate"),
          e("\u23F3", "hourglass", "waiting", "later", "pending", "soon"),
          e("\u{1F4CC}", "pin", "keep", "important", "save"),
          e("\u{1F516}", "bookmark", "save", "later", "keep"),
          e("\u{1F680}", "rocket", "ship", "launch", "fast", "go")
        ]
      },
      {
        name: "Feelings",
        entries: [
          e("\u{1F600}", "grin", "happy", "smile"),
          e("\u{1F602}", "tears of joy", "lol", "funny", "laugh", "haha"),
          e("\u{1F923}", "rolling", "lol", "funny", "laugh", "rofl"),
          e("\u{1F60A}", "blush", "happy", "smile", "warm"),
          e("\u{1F60D}", "heart eyes", "love", "want", "adore", "gorgeous"),
          e("\u{1F929}", "starstruck", "wow", "amazing", "excited"),
          e("\u{1F60E}", "cool", "sunglasses", "slick", "smooth"),
          e("\u{1F973}", "party face", "celebrate", "yay", "hooray"),
          e("\u{1F605}", "sweat smile", "phew", "close", "awkward"),
          e("\u{1F62C}", "grimace", "yikes", "awkward", "oof"),
          e("\u{1F62D}", "sobbing", "crying", "sad", "hurts"),
          e("\u{1F631}", "screaming", "shock", "scared", "omg"),
          e("\u{1F92F}", "mind blown", "wow", "whoa", "exploding"),
          e("\u{1F643}", "upside down", "irony", "sarcasm", "oh well"),
          e("\u{1F634}", "sleeping", "boring", "tired", "zzz"),
          e("\u{1F972}", "tear", "bittersweet", "holding it together"),
          e("\u{1FAE0}", "melting", "overwhelmed", "dying", "help"),
          e("\u{1F910}", "zipper mouth", "quiet", "no comment", "secret"),
          e("\u{1F648}", "see no evil", "cringe", "hiding", "monkey"),
          e("\u{1F480}", "skull", "dead", "killed me", "fatal", "rip"),
          e("\u{1FAE1}", "salute", "on it", "yes sir", "acknowledged"),
          e("\u{1F91D}", "handshake", "agreed", "deal", "together"),
          e("\u{1F64F}", "please", "thanks", "pray", "hope"),
          e("\u{1F44F}", "clap", "bravo", "well done", "applause"),
          e("\u{1F64C}", "raised hands", "yay", "praise", "celebrate"),
          e("\u{1F4AA}", "flex", "strong", "muscle", "can do"),
          e("\u{1FAF6}", "heart hands", "love", "care", "thanks"),
          e("\u{1F90C}", "chef kiss", "perfect", "italian", "precise")
        ]
      },
      {
        name: "Hearts",
        entries: [
          e("\u2764\uFE0F", "red heart", "love", "like", "yes"),
          e("\u{1F9E1}", "orange heart", "love", "warm"),
          e("\u{1F49B}", "yellow heart", "love", "bright"),
          e("\u{1F49A}", "green heart", "love", "go"),
          e("\u{1F499}", "blue heart", "love", "calm"),
          e("\u{1F49C}", "purple heart", "love"),
          e("\u{1F5A4}", "black heart", "love", "dark", "goth"),
          e("\u{1F90D}", "white heart", "love", "clean", "pure"),
          e("\u{1FA76}", "grey heart", "gray", "love", "neutral"),
          e("\u{1F496}", "sparkling heart", "love", "special"),
          e("\u{1F498}", "cupid", "love", "arrow", "smitten"),
          e("\u{1F494}", "broken heart", "sad", "no", "hurts"),
          e("\u{1F525}", "fire", "hot", "great", "lit", "burning"),
          e("\u2728", "sparkles", "magic", "polish", "shiny", "delight"),
          e("\u{1F4AB}", "dizzy", "sparkle", "wow"),
          e("\u26A1", "zap", "fast", "power", "lightning", "energy")
        ]
      },
      {
        name: "Craft",
        entries: [
          e("\u{1F3A8}", "palette", "design", "art", "colour", "color", "paint"),
          e("\u{1F58C}\uFE0F", "brush", "paint", "design", "art"),
          e("\u270F\uFE0F", "pencil", "edit", "write", "draft", "change"),
          e("\u{1F4D0}", "triangle ruler", "layout", "measure", "geometry", "align"),
          e("\u{1F4CF}", "ruler", "measure", "spacing", "size"),
          e("\u{1F524}", "letters", "type", "font", "typography", "text"),
          e("\u{1F5BC}\uFE0F", "picture", "image", "frame", "art"),
          e("\u{1F4F7}", "camera", "photo", "screenshot", "shot"),
          e("\u{1F3AC}", "clapper", "video", "motion", "film", "action"),
          e("\u{1F3AF}", "target", "on point", "goal", "bullseye", "exact"),
          e("\u{1F9E9}", "puzzle", "piece", "fits", "component", "part"),
          e("\u{1FA84}", "wand", "magic", "auto", "generate"),
          e("\u{1F528}", "hammer", "build", "fix", "make"),
          e("\u{1F6E0}\uFE0F", "tools", "build", "fix", "wip", "maintenance"),
          e("\u{1F527}", "wrench", "fix", "tune", "config", "adjust"),
          e("\u2699\uFE0F", "gear", "settings", "config", "machine", "system"),
          e("\u{1F9EA}", "test tube", "experiment", "test", "try", "lab"),
          e("\u{1F52C}", "microscope", "detail", "inspect", "research", "close"),
          e("\u{1F50D}", "magnify", "search", "find", "look", "zoom"),
          e("\u{1F9F9}", "broom", "cleanup", "tidy", "sweep", "refactor"),
          e("\u{1F5D1}\uFE0F", "trash", "delete", "bin", "remove", "junk"),
          e("\u{1F4E6}", "package", "ship", "box", "bundle", "release"),
          e("\u{1F3D7}\uFE0F", "crane", "building", "wip", "construction", "scaffold"),
          e("\u{1FA9C}", "ladder", "step", "climb", "levels")
        ]
      },
      {
        name: "Signals",
        entries: [
          e("\u{1F41B}", "bug", "defect", "broken", "issue", "problem"),
          e("\u{1F534}", "red circle", "stop", "bad", "critical", "record"),
          e("\u{1F7E0}", "orange circle", "warning", "medium"),
          e("\u{1F7E1}", "yellow circle", "caution", "middling"),
          e("\u{1F7E2}", "green circle", "good", "go", "healthy", "pass"),
          e("\u{1F535}", "blue circle", "info", "neutral"),
          e("\u{1F7E3}", "purple circle", "other"),
          e("\u26AB", "black circle", "off", "dead", "none"),
          e("\u26AA", "white circle", "empty", "blank", "unset"),
          e("\u{1F4C8}", "chart up", "growth", "better", "improved", "win"),
          e("\u{1F4C9}", "chart down", "worse", "regression", "loss", "drop"),
          e("\u{1F4CA}", "bar chart", "data", "metrics", "numbers", "stats"),
          e("\u{1F53A}", "up triangle", "increase", "more", "higher"),
          e("\u{1F53B}", "down triangle", "decrease", "less", "lower"),
          e("\u{1F4AF}", "hundred", "perfect", "full marks", "all the way"),
          e("\u{1F197}", "ok", "fine", "acceptable"),
          e("\u{1F501}", "repeat", "loop", "again", "cycle"),
          e("\u{1F500}", "shuffle", "random", "mix", "swap"),
          e("\u23F8\uFE0F", "pause", "hold", "wait", "stop for now"),
          e("\u25B6\uFE0F", "play", "go", "run", "start"),
          e("\u23ED\uFE0F", "next", "skip", "forward"),
          e("\u{1F514}", "bell", "notify", "alert", "ping"),
          e("\u{1F4E3}", "megaphone", "announce", "shout", "broadcast"),
          e("\u{1F9ED}", "compass", "direction", "navigate", "wayfinding", "north")
        ]
      },
      {
        name: "People",
        entries: [
          e("\u{1F44B}", "wave", "hi", "hello", "bye"),
          e("\u{1FAF5}", "pointing at you", "you", "yours", "this one"),
          e("\u{1F447}", "point down", "below", "this", "under"),
          e("\u{1F446}", "point up", "above", "that", "over"),
          e("\u{1F448}", "point left", "previous", "back", "before"),
          e("\u{1F449}", "point right", "next", "forward", "after"),
          e("\u{1F9D1}\u200D\u{1F4BB}", "person at computer", "dev", "engineer", "coding", "work"),
          e("\u{1F9D1}\u200D\u{1F3A8}", "artist", "designer", "design", "creative"),
          e("\u{1F575}\uFE0F", "detective", "investigate", "find", "search", "spy"),
          e("\u{1F9D9}", "wizard", "magic", "expert", "guru"),
          e("\u{1F916}", "robot", "agent", "bot", "ai", "automated"),
          e("\u{1F47B}", "ghost", "gone", "vanished", "spooky", "haunting"),
          e("\u{1F9BE}", "robot arm", "strong", "machine", "power"),
          e("\u{1F9E0}", "brain", "smart", "think", "idea", "clever"),
          e("\u{1F451}", "crown", "best", "king", "queen", "top", "royal"),
          e("\u{1F393}", "graduate", "learned", "teach", "school", "lesson"),
          e("\u{1FAC2}", "hug", "support", "together", "care"),
          e("\u{1F9D1}\u200D\u{1F680}", "astronaut", "space", "explorer", "moon")
        ]
      },
      {
        name: "Life",
        entries: [
          e("\u{1F389}", "party popper", "celebrate", "yay", "launch", "hooray"),
          e("\u{1F38A}", "confetti", "celebrate", "party"),
          e("\u{1F942}", "cheers", "toast", "celebrate", "drinks"),
          e("\u{1F37E}", "champagne", "celebrate", "pop", "launch"),
          e("\u2615", "coffee", "morning", "caffeine", "break"),
          e("\u{1F355}", "pizza", "food", "lunch", "friday"),
          e("\u{1F370}", "cake", "birthday", "sweet", "treat"),
          e("\u{1F331}", "seedling", "new", "growing", "start", "sprout"),
          e("\u{1F333}", "tree", "grown", "mature", "stable"),
          e("\u{1F30A}", "wave", "ocean", "flow", "water"),
          e("\u{1F308}", "rainbow", "colour", "color", "pride", "bright"),
          e("\u2600\uFE0F", "sun", "day", "light", "bright", "clear"),
          e("\u{1F319}", "moon", "night", "late", "dark", "overnight"),
          e("\u26C8\uFE0F", "storm", "trouble", "rough", "bad weather"),
          e("\u2744\uFE0F", "snowflake", "frozen", "cold", "freeze", "winter"),
          e("\u{1F3D4}\uFE0F", "mountain", "big", "hard", "climb", "peak"),
          e("\u{1F422}", "turtle", "slow", "sluggish", "performance"),
          e("\u{1F407}", "rabbit", "fast", "quick", "speed"),
          e("\u{1F984}", "unicorn", "rare", "special", "magic", "impossible"),
          e("\u{1F409}", "dragon", "big", "epic", "beast"),
          e("\u{1F98B}", "butterfly", "transform", "change", "pretty"),
          e("\u{1F41D}", "bee", "busy", "buzz", "work"),
          e("\u{1F335}", "cactus", "dry", "prickly", "desert"),
          e("\u{1F340}", "clover", "luck", "lucky", "fortune")
        ]
      },
      {
        name: "Objects",
        entries: [
          e("\u{1F4A1}", "bulb", "idea", "insight", "suggestion", "light"),
          e("\u{1F4DD}", "memo", "note", "write", "notes", "doc"),
          e("\u{1F4C4}", "page", "document", "file", "doc", "text"),
          e("\u{1F4DA}", "books", "docs", "reading", "reference", "library"),
          e("\u{1F5C2}\uFE0F", "dividers", "organize", "sort", "files", "index"),
          e("\u{1F517}", "link", "url", "connect", "chain", "reference"),
          e("\u{1F4CE}", "paperclip", "attach", "file", "clip"),
          e("\u{1F5D3}\uFE0F", "calendar", "date", "schedule", "when", "plan"),
          e("\u23F0", "alarm", "time", "deadline", "urgent", "clock"),
          e("\u{1F4B0}", "money", "cost", "price", "budget", "cash"),
          e("\u{1F48E}", "gem", "precious", "quality", "diamond", "valuable"),
          e("\u{1F511}", "key", "access", "auth", "secret", "unlock"),
          e("\u{1F9F2}", "magnet", "attract", "pull", "draw"),
          e("\u{1FA9E}", "mirror", "reflect", "same", "copy"),
          e("\u{1F5A5}\uFE0F", "monitor", "desktop", "screen", "display"),
          e("\u{1F4F1}", "phone", "mobile", "device", "responsive"),
          e("\u2328\uFE0F", "keyboard", "type", "input", "keys"),
          e("\u{1F5B1}\uFE0F", "mouse", "click", "pointer", "cursor"),
          e("\u{1F50C}", "plug", "connect", "power", "integration"),
          e("\u{1F9F5}", "thread", "sewing", "series", "chain"),
          e("\u{1FA9F}", "window", "pane", "view", "frame"),
          e("\u{1F6AA}", "door", "entry", "exit", "way in", "leave")
        ]
      },
      {
        name: "Nature",
        entries: [
          e("\u{1F436}", "dog", "puppy", "pet", "animal"),
          e("\u{1F431}", "cat", "kitten", "pet", "animal"),
          e("\u{1F42D}", "mouse", "animal"),
          e("\u{1F439}", "hamster", "animal"),
          e("\u{1F430}", "rabbit", "bunny", "animal"),
          e("\u{1F98A}", "fox", "animal"),
          e("\u{1F43B}", "bear", "animal"),
          e("\u{1F43C}", "panda", "animal"),
          e("\u{1F428}", "koala", "animal"),
          e("\u{1F42F}", "tiger", "animal"),
          e("\u{1F981}", "lion", "animal"),
          e("\u{1F42E}", "cow", "animal"),
          e("\u{1F437}", "pig", "animal"),
          e("\u{1F438}", "frog", "animal"),
          e("\u{1F435}", "monkey", "animal"),
          e("\u{1F414}", "chicken", "hen", "animal"),
          e("\u{1F427}", "penguin", "animal"),
          e("\u{1F426}", "bird", "animal"),
          e("\u{1F986}", "duck", "animal"),
          e("\u{1F989}", "owl", "wise", "night", "animal"),
          e("\u{1F987}", "bat", "animal"),
          e("\u{1F43A}", "wolf", "animal"),
          e("\u{1F417}", "boar", "animal"),
          e("\u{1F434}", "horse", "animal"),
          e("\u{1F40C}", "snail", "slow", "animal"),
          e("\u{1F41E}", "ladybug", "beetle", "animal"),
          e("\u{1F41C}", "ant", "animal"),
          e("\u{1F577}\uFE0F", "spider", "animal"),
          e("\u{1F982}", "scorpion", "animal"),
          e("\u{1F40D}", "snake", "animal"),
          e("\u{1F98E}", "lizard", "animal"),
          e("\u{1F419}", "octopus", "animal"),
          e("\u{1F991}", "squid", "animal"),
          e("\u{1F980}", "crab", "animal"),
          e("\u{1F41F}", "fish", "animal"),
          e("\u{1F420}", "tropical fish", "animal"),
          e("\u{1F42C}", "dolphin", "animal"),
          e("\u{1F433}", "whale", "animal"),
          e("\u{1F988}", "shark", "animal"),
          e("\u{1F40A}", "crocodile", "alligator", "animal"),
          e("\u{1F418}", "elephant", "animal"),
          e("\u{1F992}", "giraffe", "animal"),
          e("\u{1F993}", "zebra", "animal"),
          e("\u{1F42A}", "camel", "animal"),
          e("\u{1F411}", "sheep", "animal"),
          e("\u{1F410}", "goat", "animal"),
          e("\u{1F98C}", "deer", "animal"),
          e("\u{1F332}", "evergreen", "tree", "forest", "pine"),
          e("\u{1F334}", "palm tree", "beach", "holiday", "vacation"),
          e("\u{1F33F}", "herb", "leaf", "plant"),
          e("\u{1F341}", "maple leaf", "autumn", "fall", "canada"),
          e("\u{1F342}", "fallen leaves", "autumn", "fall"),
          e("\u{1F337}", "tulip", "flower"),
          e("\u{1F339}", "rose", "flower"),
          e("\u{1F33B}", "sunflower", "flower"),
          e("\u{1F338}", "cherry blossom", "flower", "sakura"),
          e("\u{1F33C}", "blossom", "flower", "daisy"),
          e("\u{1F490}", "bouquet", "flowers", "thanks"),
          e("\u{1F30D}", "globe europe", "earth", "world", "planet"),
          e("\u{1F30E}", "globe americas", "earth", "world", "planet"),
          e("\u{1F30F}", "globe asia", "earth", "world", "planet"),
          e("\u{1F311}", "new moon", "dark", "night"),
          e("\u{1F317}", "half moon", "night"),
          e("\u26C5", "partly cloudy", "weather"),
          e("\u2601\uFE0F", "cloud", "cloudy", "weather"),
          e("\u{1F327}\uFE0F", "rain", "rainy", "weather", "wet"),
          e("\u{1F328}\uFE0F", "snow", "snowy", "weather", "cold"),
          e("\u26C4", "snowman", "winter", "cold"),
          e("\u{1F32A}\uFE0F", "tornado", "chaos", "disaster"),
          e("\u{1F4A7}", "droplet", "water", "drop")
        ]
      },
      {
        name: "Food",
        entries: [
          e("\u{1F34E}", "apple", "fruit"),
          e("\u{1F34A}", "orange", "fruit", "tangerine"),
          e("\u{1F34B}", "lemon", "fruit", "sour"),
          e("\u{1F34C}", "banana", "fruit"),
          e("\u{1F349}", "watermelon", "fruit"),
          e("\u{1F347}", "grapes", "fruit"),
          e("\u{1F353}", "strawberry", "fruit"),
          e("\u{1FAD0}", "blueberries", "fruit"),
          e("\u{1F352}", "cherries", "fruit"),
          e("\u{1F351}", "peach", "fruit"),
          e("\u{1F96D}", "mango", "fruit"),
          e("\u{1F34D}", "pineapple", "fruit"),
          e("\u{1F965}", "coconut", "fruit"),
          e("\u{1F951}", "avocado", "fruit"),
          e("\u{1F345}", "tomato", "vegetable"),
          e("\u{1F955}", "carrot", "vegetable"),
          e("\u{1F33D}", "corn", "vegetable"),
          e("\u{1F336}\uFE0F", "hot pepper", "chilli", "chili", "spicy"),
          e("\u{1F966}", "broccoli", "vegetable"),
          e("\u{1F96C}", "leafy green", "salad", "vegetable"),
          e("\u{1F344}", "mushroom", "fungus"),
          e("\u{1F954}", "potato", "vegetable"),
          e("\u{1F35E}", "bread", "loaf", "bakery"),
          e("\u{1F950}", "croissant", "bakery", "pastry"),
          e("\u{1F956}", "baguette", "bread", "bakery"),
          e("\u{1F9C0}", "cheese", "dairy"),
          e("\u{1F95A}", "egg", "breakfast"),
          e("\u{1F953}", "bacon", "breakfast"),
          e("\u{1F95E}", "pancakes", "breakfast"),
          e("\u{1F9C7}", "waffle", "breakfast"),
          e("\u{1F354}", "hamburger", "burger", "lunch"),
          e("\u{1F35F}", "fries", "chips", "lunch"),
          e("\u{1F32D}", "hot dog", "lunch"),
          e("\u{1F96A}", "sandwich", "lunch"),
          e("\u{1F32E}", "taco", "lunch"),
          e("\u{1F32F}", "burrito", "lunch"),
          e("\u{1F957}", "salad", "healthy", "lunch"),
          e("\u{1F35D}", "spaghetti", "pasta", "dinner"),
          e("\u{1F35C}", "ramen", "noodles", "dinner"),
          e("\u{1F363}", "sushi", "dinner"),
          e("\u{1F371}", "bento", "lunch"),
          e("\u{1F35A}", "rice", "dinner"),
          e("\u{1F35B}", "curry", "dinner"),
          e("\u{1F958}", "paella", "dinner"),
          e("\u{1F372}", "stew", "pot", "dinner"),
          e("\u{1F366}", "ice cream", "dessert", "sweet"),
          e("\u{1F369}", "doughnut", "donut", "dessert", "sweet"),
          e("\u{1F36A}", "cookie", "biscuit", "dessert", "sweet"),
          e("\u{1F382}", "birthday cake", "cake", "celebrate"),
          e("\u{1F9C1}", "cupcake", "dessert", "sweet"),
          e("\u{1F36B}", "chocolate", "sweet", "dessert"),
          e("\u{1F36C}", "candy", "sweet"),
          e("\u{1F37F}", "popcorn", "cinema", "movie", "watching"),
          e("\u{1F9C2}", "salt", "seasoning"),
          e("\u{1FAD6}", "teapot", "tea", "brew"),
          e("\u{1F375}", "tea", "green tea", "brew"),
          e("\u{1F9C3}", "juice box", "drink"),
          e("\u{1F964}", "soft drink", "soda", "cup", "drink"),
          e("\u{1F37A}", "beer", "pint", "drink", "pub"),
          e("\u{1F37B}", "cheers", "beers", "celebrate", "drink"),
          e("\u{1F377}", "wine", "drink"),
          e("\u{1F378}", "cocktail", "drink"),
          e("\u{1F943}", "whisky", "whiskey", "drink"),
          e("\u{1F37D}\uFE0F", "plate", "cutlery", "dinner", "eat"),
          e("\u{1F944}", "spoon", "cutlery")
        ]
      },
      {
        name: "Travel",
        entries: [
          e("\u2693", "anchor", "ship", "port", "harbour", "harbor", "sail", "moor", "stable"),
          e("\u26F5", "sailboat", "sailing", "boat", "yacht"),
          e("\u{1F6A4}", "speedboat", "boat", "fast"),
          e("\u{1F6E5}\uFE0F", "motor boat", "boat"),
          e("\u{1F6A2}", "ship", "cargo", "boat", "freight"),
          e("\u26F4\uFE0F", "ferry", "boat"),
          e("\u{1F6F6}", "canoe", "paddle", "boat"),
          e("\u2708\uFE0F", "plane", "aeroplane", "airplane", "flight", "fly", "travel"),
          e("\u{1F6EB}", "takeoff", "departure", "plane", "launch"),
          e("\u{1F6EC}", "landing", "arrival", "plane"),
          e("\u{1F681}", "helicopter", "fly"),
          e("\u{1F6F0}\uFE0F", "satellite", "orbit", "space"),
          e("\u{1FA90}", "ringed planet", "saturn", "space"),
          e("\u{1F697}", "car", "drive", "auto"),
          e("\u{1F695}", "taxi", "cab", "car"),
          e("\u{1F699}", "suv", "car"),
          e("\u{1F68C}", "bus", "transit"),
          e("\u{1F68E}", "trolleybus", "transit"),
          e("\u{1F3CE}\uFE0F", "racing car", "fast", "race"),
          e("\u{1F693}", "police car", "police"),
          e("\u{1F691}", "ambulance", "emergency"),
          e("\u{1F692}", "fire engine", "emergency"),
          e("\u{1F69A}", "truck", "delivery", "lorry"),
          e("\u{1F69B}", "lorry", "truck", "freight", "haul"),
          e("\u{1F69C}", "tractor", "farm"),
          e("\u{1F3CD}\uFE0F", "motorcycle", "motorbike", "bike"),
          e("\u{1F6F5}", "scooter", "moped"),
          e("\u{1F6B2}", "bicycle", "bike", "cycle"),
          e("\u{1F6F4}", "kick scooter", "scooter"),
          e("\u{1F682}", "locomotive", "train", "steam"),
          e("\u{1F686}", "train", "rail"),
          e("\u{1F687}", "metro", "subway", "underground", "tube"),
          e("\u{1F68A}", "tram", "transit"),
          e("\u{1F689}", "station", "train", "rail"),
          e("\u{1F5FA}\uFE0F", "map", "atlas", "plan", "route"),
          e("\u{1F5FF}", "moai", "statue", "stone"),
          e("\u{1F5FD}", "statue of liberty", "new york", "usa"),
          e("\u{1F5FC}", "tower", "tokyo"),
          e("\u{1F3F0}", "castle", "fortress"),
          e("\u{1F3EF}", "japanese castle", "shiro", "pagoda", "fortress"),
          e("\u{1F3DF}\uFE0F", "stadium", "arena"),
          e("\u{1F3A1}", "ferris wheel", "fair"),
          e("\u{1F3A2}", "roller coaster", "fair", "ride"),
          e("\u26F2", "fountain", "park"),
          e("\u{1F3D6}\uFE0F", "beach", "holiday", "vacation", "sand"),
          e("\u{1F3DD}\uFE0F", "desert island", "island", "holiday", "alone"),
          e("\u26F0\uFE0F", "mountain", "peak", "climb"),
          e("\u{1F30B}", "volcano", "eruption", "hot"),
          e("\u{1F3D5}\uFE0F", "camping", "tent", "outdoors"),
          e("\u{1F3DE}\uFE0F", "national park", "nature", "outdoors"),
          e("\u{1F305}", "sunrise", "dawn", "morning", "start"),
          e("\u{1F307}", "sunset", "dusk", "evening", "end"),
          e("\u{1F303}", "night city", "evening", "late"),
          e("\u{1F306}", "city dusk", "skyline", "city"),
          e("\u{1F3D9}\uFE0F", "cityscape", "skyline", "city", "urban"),
          e("\u{1F309}", "bridge", "night", "crossing"),
          e("\u{1F3E0}", "house", "home"),
          e("\u{1F3E1}", "house with garden", "home"),
          e("\u{1F3E2}", "office", "building", "work", "company"),
          e("\u{1F3ED}", "factory", "industry", "plant"),
          e("\u{1F3E5}", "hospital", "health"),
          e("\u{1F3E6}", "bank", "money"),
          e("\u{1F3EB}", "school", "education"),
          e("\u{1F3E8}", "hotel", "stay", "travel"),
          e("\u26FA", "tent", "camp"),
          e("\u{1F6A6}", "traffic light", "signal", "wait"),
          e("\u{1F17F}\uFE0F", "parking", "park"),
          e("\u{1F6C2}", "passport control", "border", "immigration"),
          e("\u{1F9F3}", "luggage", "suitcase", "travel", "packing"),
          e("\u{1F3AB}", "ticket", "admission", "entry"),
          e("\u{1F6CE}\uFE0F", "bell hop", "service", "reception")
        ]
      },
      {
        name: "Activity",
        entries: [
          e("\u26BD", "football", "soccer", "ball", "sport"),
          e("\u{1F3C0}", "basketball", "ball", "sport"),
          e("\u{1F3C8}", "american football", "ball", "sport"),
          e("\u26BE", "baseball", "ball", "sport"),
          e("\u{1F3BE}", "tennis", "ball", "sport"),
          e("\u{1F3D0}", "volleyball", "ball", "sport"),
          e("\u{1F3C9}", "rugby", "ball", "sport"),
          e("\u{1F3B1}", "pool", "8 ball", "billiards", "snooker"),
          // Unicode has no pickleball, so the paddle answers for it — asked for by
          // name (1 Oct 2026), and a search that finds nothing reads as broken.
          e("\u{1F3D3}", "table tennis", "ping pong", "pickleball", "paddle", "sport"),
          e("\u{1F3F8}", "badminton", "sport"),
          e("\u{1F3CF}", "cricket", "bat", "ball", "sport"),
          e("\u{1F94E}", "softball", "ball", "sport"),
          e("\u{1F3D1}", "field hockey", "hockey", "stick", "sport"),
          e("\u{1F3D2}", "ice hockey", "hockey", "stick", "puck", "sport"),
          e("\u{1F94D}", "lacrosse", "stick", "ball", "sport"),
          e("\u{1F94F}", "flying disc", "frisbee", "ultimate", "sport"),
          e("\u{1F94C}", "curling", "stone", "winter", "sport"),
          e("\u{1F3CC}\uFE0F", "golfer", "golf", "swing", "sport"),
          e("\u{1F3C4}", "surfing", "surf", "wave", "beach"),
          e("\u{1F6A3}", "rowing", "row", "boat", "crew"),
          e("\u{1F93A}", "fencing", "sword", "duel", "sport"),
          e("\u{1F93E}", "handball", "throw", "sport"),
          e("\u{1F3C7}", "horse racing", "jockey", "race"),
          e("\u{1F93F}", "diving", "snorkel", "scuba", "dive"),
          e("\u{1F6FC}", "roller skate", "skating", "roller derby"),
          e("\u{1F6F7}", "sled", "sledge", "winter", "snow"),
          e("\u{1FA81}", "kite", "fly", "wind"),
          e("\u{1FA83}", "boomerang", "return", "throw"),
          e("\u{1F945}", "goal", "net", "sport", "score"),
          e("\u26F3", "golf", "hole", "sport"),
          e("\u{1F3F9}", "bow and arrow", "archery", "aim", "target"),
          e("\u{1F3A3}", "fishing", "angling", "catch"),
          e("\u{1F94A}", "boxing", "fight", "glove"),
          e("\u{1F94B}", "martial arts", "judo", "karate"),
          e("\u26F8\uFE0F", "ice skate", "skating", "winter"),
          e("\u{1F3BF}", "ski", "skiing", "winter", "snow"),
          e("\u{1F6F9}", "skateboard", "skating"),
          e("\u{1F3C2}", "snowboard", "winter", "snow"),
          e("\u{1F3CB}\uFE0F", "lifting", "gym", "weights", "strong", "workout"),
          e("\u{1F938}", "cartwheel", "gymnastics", "flexible"),
          e("\u{1F3CA}", "swimming", "swim", "pool"),
          e("\u{1F6B4}", "cycling", "bike", "ride"),
          e("\u{1F3C3}", "running", "run", "fast", "go"),
          e("\u{1F6B6}", "walking", "walk", "slow"),
          e("\u{1F9D8}", "meditation", "calm", "zen", "yoga", "breathe"),
          e("\u{1F9D7}", "climbing", "climb", "hard"),
          e("\u{1F3C6}", "trophy", "win", "won", "champion", "prize"),
          e("\u{1F948}", "silver medal", "second", "runner up"),
          e("\u{1F949}", "bronze medal", "third"),
          e("\u{1F396}\uFE0F", "medal", "honour", "honor", "award"),
          e("\u{1F3BD}", "running shirt", "race", "marathon"),
          e("\u{1F3AE}", "game controller", "gaming", "play", "video game"),
          e("\u{1F579}\uFE0F", "joystick", "arcade", "game"),
          e("\u{1F3B2}", "dice", "random", "chance", "luck", "roll"),
          e("\u265F\uFE0F", "chess pawn", "chess", "strategy", "move"),
          e("\u{1F0CF}", "joker", "wildcard", "card"),
          e("\u{1F3B0}", "slot machine", "gamble", "luck"),
          e("\u{1F3B3}", "bowling", "strike"),
          e("\u{1F3AA}", "circus", "tent", "show"),
          e("\u{1F3AD}", "theatre", "theater", "drama", "masks", "acting"),
          e("\u{1F3A4}", "microphone", "mic", "sing", "speak", "podcast"),
          e("\u{1F3A7}", "headphones", "listen", "music", "focus"),
          e("\u{1F3B5}", "note", "music", "song"),
          e("\u{1F3B6}", "notes", "music", "song", "tune"),
          e("\u{1F3B8}", "guitar", "music", "rock"),
          e("\u{1F3B9}", "piano", "keyboard", "music"),
          e("\u{1F941}", "drum", "drums", "music", "beat"),
          e("\u{1F3BA}", "trumpet", "music", "brass", "fanfare"),
          e("\u{1F3BB}", "violin", "music", "strings"),
          e("\u{1FA95}", "banjo", "music"),
          e("\u{1F39F}\uFE0F", "admission ticket", "event", "entry")
        ]
      },
      {
        name: "Symbols",
        entries: [
          e("\u269B\uFE0F", "atom", "science", "physics", "react"),
          e("\u267E\uFE0F", "infinity", "endless", "loop", "forever"),
          e("\u{1F531}", "trident", "emblem"),
          e("\u269C\uFE0F", "fleur de lis", "emblem"),
          e("\u{1F530}", "beginner", "new", "learner", "novice"),
          e("\u2B55", "circle", "o", "correct", "hollow"),
          e("\u{1F6AB}", "prohibited", "no", "forbidden", "banned", "denied"),
          e("\u26D4", "no entry", "stop", "blocked", "forbidden"),
          e("\u{1F4DB}", "name badge", "name", "identity"),
          e("\u{1F51E}", "eighteen", "adult", "restricted"),
          e("\u2714\uFE0F", "tick", "check", "done", "yes"),
          e("\u2611\uFE0F", "ballot check", "checked", "done", "tick"),
          e("\u2716\uFE0F", "multiply", "times", "cross", "no"),
          e("\u2795", "plus", "add", "more", "new"),
          e("\u2796", "minus", "subtract", "less", "remove"),
          e("\u2797", "divide", "division"),
          e("\u{1F7F0}", "equals", "same", "equal"),
          e("\u3030\uFE0F", "wavy dash", "squiggle", "approx"),
          e("\u203C\uFE0F", "double exclamation", "urgent", "very important"),
          e("\u2049\uFE0F", "interrobang", "what", "surprise", "confused"),
          e("\u{1F520}", "letters", "uppercase", "abc", "text"),
          e("\u{1F522}", "numbers", "digits", "1234", "count"),
          e("\u{1F523}", "symbols", "special characters"),
          e("\u{1F170}\uFE0F", "a button", "blood a", "letter a"),
          e("\u{1F18E}", "ab button", "blood ab"),
          e("\u{1F191}", "cl button", "clear"),
          e("\u{1F192}", "cool button", "cool", "nice"),
          e("\u{1F193}", "free button", "free", "no cost"),
          e("\u{1F196}", "ng button", "no good", "bad"),
          e("\u{1F199}", "up button", "level up", "upgrade", "improve"),
          e("\u{1F19A}", "versus", "vs", "against", "compare"),
          e("\u{1F51F}", "ten", "10"),
          e("\u23F9\uFE0F", "stop", "halt", "end"),
          e("\u23FA\uFE0F", "record", "recording", "capture"),
          e("\u23EE\uFE0F", "previous track", "back", "rewind"),
          e("\u23E9", "fast forward", "faster", "speed up"),
          e("\u23EA", "rewind", "back", "slower"),
          e("\u{1F502}", "repeat one", "loop once", "again"),
          e("\u{1F503}", "cycle", "refresh", "sync", "reload"),
          e("\u{1F504}", "refresh", "sync", "reload", "update", "again"),
          e("\u{1F53C}", "up", "increase", "raise"),
          e("\u{1F53D}", "down", "decrease", "lower"),
          e("\u2B06\uFE0F", "arrow up", "up", "north", "increase"),
          e("\u2B07\uFE0F", "arrow down", "down", "south", "decrease"),
          e("\u2B05\uFE0F", "arrow left", "left", "west", "back"),
          e("\u27A1\uFE0F", "arrow right", "right", "east", "forward", "next"),
          e("\u21A9\uFE0F", "return", "back", "undo", "reply"),
          e("\u21AA\uFE0F", "forward", "redo", "onward"),
          e("\u{1F519}", "back", "previous", "return"),
          e("\u{1F51A}", "end", "finish", "over"),
          e("\u{1F51B}", "on", "active", "enabled"),
          e("\u{1F51C}", "soon", "upcoming", "later", "next"),
          e("\u{1F51D}", "top", "best", "highest", "above"),
          e("\u{1F7E5}", "red square", "block", "bad"),
          e("\u{1F7E9}", "green square", "block", "ok", "pass"),
          e("\u{1F7E6}", "blue square", "block", "info"),
          e("\u{1F7E8}", "yellow square", "block", "warn"),
          e("\u2B1B", "black square", "filled", "dark"),
          e("\u2B1C", "white square", "empty", "light"),
          e("\u{1F536}", "orange diamond", "shape"),
          e("\u{1F537}", "blue diamond", "shape")
        ]
      },
      {
        name: "Flags",
        entries: [
          e("\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", "England", "english", "st george"),
          e("\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}", "Scotland", "scottish", "saltire"),
          e("\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}", "Wales", "welsh", "dragon"),
          e("\u{1F3F3}\uFE0F\u200D\u{1F308}", "pride flag", "rainbow", "lgbt", "pride"),
          e("\u{1F3F4}\u200D\u2620\uFE0F", "pirate flag", "jolly roger", "pirate"),
          e("\u{1F6A9}", "triangular flag", "flagged", "marker", "attention"),
          e("\u{1F3F3}\uFE0F", "white flag", "surrender", "give up"),
          e("\u{1F3F4}", "black flag", "flag"),
          e("\u{1F1EC}\u{1F1E7}", "United Kingdom", "uk", "gb", "britain", "british", "england", "union jack"),
          e("\u{1F1FA}\u{1F1F8}", "United States", "usa", "us", "america", "american"),
          e("\u{1F1E8}\u{1F1E6}", "Canada", "canadian", "ca"),
          e("\u{1F1F2}\u{1F1FD}", "Mexico", "mexican", "mx"),
          e("\u{1F1E7}\u{1F1F7}", "Brazil", "brazilian", "br"),
          e("\u{1F1E6}\u{1F1F7}", "Argentina", "argentinian", "ar"),
          e("\u{1F1E8}\u{1F1F1}", "Chile", "chilean", "cl"),
          e("\u{1F1E8}\u{1F1F4}", "Colombia", "colombian", "co"),
          e("\u{1F1F5}\u{1F1EA}", "Peru", "peruvian", "pe"),
          e("\u{1F1FA}\u{1F1FE}", "Uruguay", "uy"),
          e("\u{1F1FB}\u{1F1EA}", "Venezuela", "ve"),
          e("\u{1F1EE}\u{1F1EA}", "Ireland", "irish", "ie", "eire"),
          e("\u{1F1EB}\u{1F1F7}", "France", "french", "fr"),
          e("\u{1F1E9}\u{1F1EA}", "Germany", "german", "de", "deutschland"),
          e("\u{1F1EA}\u{1F1F8}", "Spain", "spanish", "es", "espana"),
          e("\u{1F1F5}\u{1F1F9}", "Portugal", "portuguese", "pt"),
          e("\u{1F1EE}\u{1F1F9}", "Italy", "italian", "it"),
          e("\u{1F1F3}\u{1F1F1}", "Netherlands", "dutch", "holland", "nl"),
          e("\u{1F1E7}\u{1F1EA}", "Belgium", "belgian", "be"),
          e("\u{1F1E8}\u{1F1ED}", "Switzerland", "swiss", "ch"),
          e("\u{1F1E6}\u{1F1F9}", "Austria", "austrian", "at"),
          e("\u{1F1F8}\u{1F1EA}", "Sweden", "swedish", "se"),
          e("\u{1F1F3}\u{1F1F4}", "Norway", "norwegian", "no"),
          e("\u{1F1E9}\u{1F1F0}", "Denmark", "danish", "dk"),
          e("\u{1F1EB}\u{1F1EE}", "Finland", "finnish", "fi"),
          e("\u{1F1EE}\u{1F1F8}", "Iceland", "icelandic", "is"),
          e("\u{1F1F5}\u{1F1F1}", "Poland", "polish", "pl"),
          e("\u{1F1E8}\u{1F1FF}", "Czechia", "czech", "cz"),
          e("\u{1F1F8}\u{1F1F0}", "Slovakia", "slovak", "sk"),
          e("\u{1F1ED}\u{1F1FA}", "Hungary", "hungarian", "hu"),
          e("\u{1F1F7}\u{1F1F4}", "Romania", "romanian", "ro"),
          e("\u{1F1E7}\u{1F1EC}", "Bulgaria", "bulgarian", "bg"),
          e("\u{1F1EC}\u{1F1F7}", "Greece", "greek", "gr"),
          e("\u{1F1ED}\u{1F1F7}", "Croatia", "croatian", "hr"),
          e("\u{1F1F7}\u{1F1F8}", "Serbia", "serbian", "rs"),
          e("\u{1F1F8}\u{1F1EE}", "Slovenia", "slovenian", "si"),
          e("\u{1F1FA}\u{1F1E6}", "Ukraine", "ukrainian", "ua"),
          e("\u{1F1EA}\u{1F1EA}", "Estonia", "estonian", "ee"),
          e("\u{1F1F1}\u{1F1FB}", "Latvia", "latvian", "lv"),
          e("\u{1F1F1}\u{1F1F9}", "Lithuania", "lithuanian", "lt"),
          e("\u{1F1F9}\u{1F1F7}", "Turkey", "turkish", "tr", "turkiye"),
          e("\u{1F1F7}\u{1F1FA}", "Russia", "russian", "ru"),
          e("\u{1F1EE}\u{1F1F1}", "Israel", "israeli", "il"),
          e("\u{1F1E6}\u{1F1EA}", "United Arab Emirates", "uae", "dubai", "abu dhabi"),
          e("\u{1F1F8}\u{1F1E6}", "Saudi Arabia", "saudi", "sa"),
          e("\u{1F1F6}\u{1F1E6}", "Qatar", "qa"),
          e("\u{1F1EA}\u{1F1EC}", "Egypt", "egyptian", "eg"),
          e("\u{1F1FF}\u{1F1E6}", "South Africa", "south african", "za"),
          e("\u{1F1F3}\u{1F1EC}", "Nigeria", "nigerian", "ng"),
          e("\u{1F1F0}\u{1F1EA}", "Kenya", "kenyan", "ke"),
          e("\u{1F1EC}\u{1F1ED}", "Ghana", "ghanaian", "gh"),
          e("\u{1F1F2}\u{1F1E6}", "Morocco", "moroccan", "ma"),
          e("\u{1F1EA}\u{1F1F9}", "Ethiopia", "ethiopian", "et"),
          e("\u{1F1EE}\u{1F1F3}", "India", "indian", "in"),
          e("\u{1F1F5}\u{1F1F0}", "Pakistan", "pakistani", "pk"),
          e("\u{1F1E7}\u{1F1E9}", "Bangladesh", "bd"),
          e("\u{1F1F1}\u{1F1F0}", "Sri Lanka", "lk"),
          e("\u{1F1F3}\u{1F1F5}", "Nepal", "np"),
          e("\u{1F1E8}\u{1F1F3}", "China", "chinese", "cn"),
          e("\u{1F1EF}\u{1F1F5}", "Japan", "japanese", "jp", "nippon"),
          e("\u{1F1F0}\u{1F1F7}", "South Korea", "korea", "korean", "kr"),
          e("\u{1F1F9}\u{1F1FC}", "Taiwan", "taiwanese", "tw"),
          e("\u{1F1ED}\u{1F1F0}", "Hong Kong", "hk"),
          e("\u{1F1F8}\u{1F1EC}", "Singapore", "singaporean", "sg"),
          e("\u{1F1F2}\u{1F1FE}", "Malaysia", "malaysian", "my"),
          e("\u{1F1F9}\u{1F1ED}", "Thailand", "thai", "th"),
          e("\u{1F1FB}\u{1F1F3}", "Vietnam", "vietnamese", "vn"),
          e("\u{1F1F5}\u{1F1ED}", "Philippines", "filipino", "ph"),
          e("\u{1F1EE}\u{1F1E9}", "Indonesia", "indonesian", "id"),
          e("\u{1F1E6}\u{1F1FA}", "Australia", "australian", "au", "aussie"),
          e("\u{1F1F3}\u{1F1FF}", "New Zealand", "kiwi", "nz", "aotearoa"),
          e("\u{1F1EB}\u{1F1EF}", "Fiji", "fj")
        ]
      }
    ];
  }
});

// packages/core/src/reactions.ts
var init_reactions = __esm({
  "packages/core/src/reactions.ts"() {
    "use strict";
  }
});

// packages/core/src/docket.ts
var init_docket = __esm({
  "packages/core/src/docket.ts"() {
    "use strict";
    init_reactions();
  }
});

// packages/core/src/touches.ts
function itemsTouchedBy(op, canvas) {
  const anchorOf = (threadId) => {
    const anchor = canvas?.threads[threadId]?.anchorItemId;
    return anchor ? [anchor] : [];
  };
  switch (op.type) {
    case "design.decide":
      return [op.decision.basis.target.artifact.itemId, ...anchorOf(op.threadId)];
    case "design.restore":
      return [op.effect.item.itemId, ...anchorOf(op.effect.threadId)];
    case "design.repair":
      return [op.repair.target.artifact.itemId];
    case "design.compare":
    case "design.respond":
      return anchorOf(op.threadId);
    case "design.request":
    case "design.receipt":
      return op.effect ? itemsTouchedBy(op.effect, canvas) : [op.type === "design.receipt" ? op.itemId : op.action.kind === "start" ? op.action.itemId : op.action.brief.itemId];
    case "group.change":
      return groupChangeItemIds(op);
    case "item.add":
    case "item.move":
    case "item.resize":
    case "item.update":
    case "item.addVersion":
    case "item.edit":
    case "item.setCurrentVersion":
    case "item.removeVersion":
    case "item.restoreVersion":
    case "item.pruneVersions":
    case "item.delete":
    case "item.restore":
      return [op.itemId];
    case "items.move":
      return op.moves.map((move) => move.itemId);
    case "items.delete":
    case "items.restore":
      return [...op.itemIds];
    case "thread.create":
    case "thread.setAnchor":
      return op.anchorItemId ? [op.anchorItemId] : [];
    case "thread.reply":
    case "questionnaire.ask":
    case "questionnaire.answer":
    case "thread.delete":
    case "comment.remove":
    case "comment.restore":
      return anchorOf(op.threadId);
    case "thread.restore":
      return op.thread.anchorItemId ? [op.thread.anchorItemId] : [];
    default:
      return [];
  }
}
function opTypeMatches(type, wanted) {
  if (wanted.length === 0) return true;
  return wanted.some((pattern) => {
    if (pattern === type) return true;
    if (pattern.endsWith(".*")) return type.startsWith(pattern.slice(0, -1));
    if (pattern.endsWith("*")) return type.startsWith(pattern.slice(0, -1));
    return false;
  });
}
function opTouchesAreas(op, areaIds, canvas) {
  if (!canvas || areaIds.length === 0) return false;
  const areas = areaIds.map((id) => canvas.items[id]).filter((a) => a !== void 0);
  if (areas.length === 0) return false;
  const inside = (x, y) => areas.some((a) => !isGroupItem(a) && x >= a.x && x < a.x + a.width && y >= a.y && y < a.y + a.height);
  for (const id of itemsTouchedBy(op, canvas)) {
    const item = canvas.items[id];
    if (item && areas.some((area) => isGroupItem(area) && area.id === item.id || inCanvasScope(canvas, area, item))) return true;
  }
  if (op.type === "thread.create" || op.type === "thread.reply" || op.type === "questionnaire.ask" || op.type === "questionnaire.answer") {
    const thread = canvas.threads[op.threadId];
    if (thread && thread.anchorItemId === null && inside(thread.x, thread.y)) return true;
  }
  return false;
}
function opMatchesFilters(op, filters, canvas) {
  if (!opTypeMatches(op.type, filters.types ?? [])) return false;
  const items = filters.items ?? [];
  if (items.length === 0) return true;
  const touched = itemsTouchedBy(op, canvas);
  return touched.some((id) => items.includes(id));
}
var init_touches = __esm({
  "packages/core/src/touches.ts"() {
    "use strict";
    init_canvas_scope();
    init_canvas_groups();
    init_canvas_groups();
  }
});

// packages/core/src/recap-window.ts
var init_recap_window = __esm({
  "packages/core/src/recap-window.ts"() {
    "use strict";
    init_touches();
  }
});

// packages/core/src/recap.ts
var init_recap = __esm({
  "packages/core/src/recap.ts"() {
    "use strict";
    init_recap_window();
  }
});

// packages/core/src/recap-head.ts
function recapHeadRoute(canvasId) {
  return `/api/projects/${encodeURIComponent(canvasId)}/context/recap`;
}
var init_recap_head = __esm({
  "packages/core/src/recap-head.ts"() {
    "use strict";
    init_canvas_group_context();
    init_recap_window();
  }
});

// packages/core/src/mentions.ts
function findMentionSpans(body, candidates) {
  const names = resolvableNames(candidates);
  const spans = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "@") continue;
    if (i > 0 && isWordChar(body[i - 1])) continue;
    const hit = names.find((candidate) => matchesAt(body, i + 1, candidate.name));
    if (!hit) continue;
    const end = i + 1 + hit.name.length;
    spans.push({ start: i, end, actorId: hit.id, name: body.slice(i + 1, end) });
    i = end - 1;
  }
  return spans;
}
function extractMentions(body, candidates) {
  const mentioned = new Set(findMentionSpans(body, candidates).map((span) => span.actorId));
  const ids2 = [];
  for (const candidate of candidates) {
    if (mentioned.has(candidate.id) && !ids2.includes(candidate.id)) ids2.push(candidate.id);
  }
  return ids2;
}
function resolvableNames(candidates) {
  const names = [];
  for (const candidate of candidates) {
    const full = candidate.name.trim();
    if (!full) continue;
    for (const name of /* @__PURE__ */ new Set([full, full.split(/\s+/)[0]])) {
      if (!names.some((n) => n.id === candidate.id && n.name === name)) {
        names.push({ id: candidate.id, name });
      }
    }
  }
  return names.sort((a, b) => b.name.length - a.name.length);
}
function matchesAt(body, index, name) {
  const slice = body.slice(index, index + name.length);
  if (slice.toLowerCase() !== name.toLowerCase()) return false;
  const after = body[index + name.length];
  return after === void 0 || !isWordChar(after);
}
function isWordChar(ch) {
  return /[\p{L}\p{N}_]/u.test(ch);
}
function* canvasActors(canvas) {
  for (const enrolled of Object.values(canvas.agents ?? {})) {
    if (enrolled?.actor) yield enrolled.actor;
  }
  const items = [
    ...Object.values(canvas.items ?? {}),
    ...(canvas.trash ?? []).map((entry) => entry.item)
  ];
  const person = function* (actor) {
    if (actor && !isSystemActor(actor.id)) yield actor;
  };
  for (const item of items) {
    if (!item) continue;
    yield* person(item.createdBy);
    yield* person(item.updatedBy);
    for (const version of item.versions ?? []) yield* person(version.createdBy);
  }
  for (const thread of Object.values(canvas.threads ?? {})) {
    if (!thread) continue;
    yield* person(thread.createdBy);
    for (const comment of thread.comments ?? []) yield* person(comment.author);
  }
}
function collectCanvasActors(canvas) {
  const seen = /* @__PURE__ */ new Map();
  for (const actor of canvasActors(canvas)) {
    if (!seen.has(actor.id)) seen.set(actor.id, actor);
  }
  return [...seen.values()];
}
function collectCanvasNames(canvas) {
  const seen = /* @__PURE__ */ new Map();
  for (const actor of canvasActors(canvas)) {
    const key = `${actor.id} ${actor.name}`;
    if (!seen.has(key)) seen.set(key, { id: actor.id, name: actor.name });
  }
  return [...seen.values()];
}
var init_mentions = __esm({
  "packages/core/src/mentions.ts"() {
    "use strict";
    init_identity();
    init_model();
  }
});

// packages/core/src/activity.ts
var init_activity = __esm({
  "packages/core/src/activity.ts"() {
    "use strict";
  }
});

// packages/core/src/roster.ts
var init_roster = __esm({
  "packages/core/src/roster.ts"() {
    "use strict";
    init_questionnaire();
    init_mentions();
    init_activity();
  }
});

// packages/core/src/claims.ts
var PERSON_HARNESSES, isAgentHarness, CLAIM_STANDS_MS, CLAIM_REFUSAL;
var init_claims = __esm({
  "packages/core/src/claims.ts"() {
    "use strict";
    init_errors();
    init_ids();
    init_identity();
    PERSON_HARNESSES = /* @__PURE__ */ new Set(["web", "home", "cli", "person"]);
    isAgentHarness = (harness) => harness !== null && harness !== void 0 && harness !== "" && !PERSON_HARNESSES.has(harness.toLowerCase()) && // **A relay is not a kind** (14 Oct 2026). `replica:` is the key a daemon
    // claims under when it carries its person up to a home: transport custody,
    // not a harness. `bindName` stopped recording it on 14 Sep, and the file
    // store repaired the rows it had already written, but a hosted home's cloud
    // store never did — so a person announced by their own laptop before then
    // still read as an agent there, and folding their browser into that id
    // turned the browser into one too ("personal canvases belong to people").
    harness.toLowerCase() !== "replica";
    CLAIM_STANDS_MS = 30 * 60 * 1e3;
    CLAIM_REFUSAL = {
      heldElsewhere: "held-elsewhere",
      claimedJustNow: "claimed-just-now",
      live: "live"
    };
  }
});

// packages/core/src/invert.ts
var init_invert = __esm({
  "packages/core/src/invert.ts"() {
    "use strict";
    init_errors();
    init_canvas_groups();
    init_design_decision_state();
  }
});

// packages/core/src/canvas-group-types.ts
var init_canvas_group_types = __esm({
  "packages/core/src/canvas-group-types.ts"() {
    "use strict";
  }
});

// packages/core/src/browseritem.ts
var BROWSER_MIME;
var init_browseritem = __esm({
  "packages/core/src/browseritem.ts"() {
    "use strict";
    BROWSER_MIME = "text/uri-list";
  }
});

// packages/core/src/canvasitem.ts
function isCanvasItem(item) {
  return item.properties.kind === CANVAS_KIND;
}
var CANVAS_KIND;
var init_canvasitem = __esm({
  "packages/core/src/canvasitem.ts"() {
    "use strict";
    init_address();
    init_browseritem();
    CANVAS_KIND = "canvas";
  }
});

// packages/core/src/kinds.ts
function itemKind(item) {
  if (isDrawingItem(item)) return "drawing";
  if (isTextItem(item)) return "text";
  if (isCanvasItem(item)) return "canvas";
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  const mime = current?.mimeType ?? "";
  const added = moduleKindOf(mime);
  if (added) return added.id;
  if (mime === BROWSER_MIME) return "site";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "text/html") return "screen";
  if (mime.startsWith("text/") || mime === "application/pdf") return "document";
  return "other";
}
var init_kinds = __esm({
  "packages/core/src/kinds.ts"() {
    "use strict";
    init_browseritem();
    init_canvasitem();
    init_drawing();
    init_modules();
    init_textnode();
  }
});

// packages/core/src/tidy.ts
var init_tidy = __esm({
  "packages/core/src/tidy.ts"() {
    "use strict";
    init_annotation();
    init_placement();
  }
});

// packages/core/src/format.ts
var init_format = __esm({
  "packages/core/src/format.ts"() {
    "use strict";
    init_annotation();
    init_kinds();
    init_lineage();
    init_tidy();
  }
});

// packages/core/src/canvas-group-arrange.ts
var init_canvas_group_arrange = __esm({
  "packages/core/src/canvas-group-arrange.ts"() {
    "use strict";
    init_annotation();
    init_placement();
    init_format();
    init_tidy();
    init_canvas_group_kit();
    init_canvas_groups();
  }
});

// packages/core/src/group-aim.ts
var init_group_aim = __esm({
  "packages/core/src/group-aim.ts"() {
    "use strict";
    init_canvas_groups();
  }
});

// packages/core/src/group-stack.ts
var init_group_stack = __esm({
  "packages/core/src/group-stack.ts"() {
    "use strict";
    init_canvas_groups();
    init_annotation();
  }
});

// packages/core/src/canvas-group-create.ts
var init_canvas_group_create = __esm({
  "packages/core/src/canvas-group-create.ts"() {
    "use strict";
  }
});

// packages/core/src/bench.ts
var init_bench = __esm({
  "packages/core/src/bench.ts"() {
    "use strict";
    init_roster();
  }
});

// packages/core/src/benchjoin.ts
var init_benchjoin = __esm({
  "packages/core/src/benchjoin.ts"() {
    "use strict";
    init_mentions();
  }
});

// packages/core/src/filenames.ts
var init_filenames = __esm({
  "packages/core/src/filenames.ts"() {
    "use strict";
  }
});

// packages/core/src/googledoc.ts
var init_googledoc = __esm({
  "packages/core/src/googledoc.ts"() {
    "use strict";
    init_canvasitem();
    init_filenames();
  }
});

// packages/core/src/addable.ts
var init_addable = __esm({
  "packages/core/src/addable.ts"() {
    "use strict";
    init_address();
    init_googledoc();
    init_browseritem();
  }
});

// packages/core/src/titleroom.ts
var init_titleroom = __esm({
  "packages/core/src/titleroom.ts"() {
    "use strict";
  }
});

// packages/core/src/whatsnew.ts
var init_whatsnew = __esm({
  "packages/core/src/whatsnew.ts"() {
    "use strict";
  }
});

// packages/core/src/protocol.ts
function isLoopbackBase(base2) {
  return LOOPBACK.test(hostOf(base2) ?? "");
}
function hostOf(base2) {
  try {
    return new URL(base2).hostname;
  } catch {
    try {
      return new URL(`http://${base2}`).hostname;
    } catch {
      return null;
    }
  }
}
function healthPath(base2) {
  return isLoopbackBase(base2) ? "/healthz" : "/api/healthz";
}
var CANVAS_GROUPS_FEATURE, QUESTIONNAIRES_FEATURE, DESIGN_REQUESTS_FEATURE, DESIGN_DECISIONS_FEATURE, DESIGN_REPAIRS_FEATURE, CURRENT_CLIENT_FEATURES, CLIENT_FEATURES_HEADER, PARK_ADOPTED_CODE, rcAnsweringRoute, FILENAME_HEADER, MAX_DIRECT_UPLOAD_BYTES, encodeFilename, LOOPBACK, HOME_JOIN_ROUTE, HOME_FORGET_ROUTE, HOMES_ROUTE, PRESENCE_WHERE_ROUTE, NEWS_ROUTE, ACTOR_KINDS_ROUTE, SERVING_ROUTE, HOME_GC_ROUTE;
var init_protocol = __esm({
  "packages/core/src/protocol.ts"() {
    "use strict";
    init_address();
    CANVAS_GROUPS_FEATURE = "canvas-groups-v4";
    QUESTIONNAIRES_FEATURE = "questionnaires-v1";
    DESIGN_REQUESTS_FEATURE = "design-requests-v2";
    DESIGN_DECISIONS_FEATURE = "design-decisions-v1";
    DESIGN_REPAIRS_FEATURE = "design-repairs-v1";
    CURRENT_CLIENT_FEATURES = `${CANVAS_GROUPS_FEATURE},${QUESTIONNAIRES_FEATURE},design-requests-v1,${DESIGN_REQUESTS_FEATURE},${DESIGN_DECISIONS_FEATURE},${DESIGN_REPAIRS_FEATURE}`;
    CLIENT_FEATURES_HEADER = "x-isocan-features";
    PARK_ADOPTED_CODE = "park-adopted";
    rcAnsweringRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/rc`;
    FILENAME_HEADER = "X-Isocan-Filename";
    MAX_DIRECT_UPLOAD_BYTES = 24 * 1024 * 1024;
    encodeFilename = (filename) => encodeURIComponent(filename);
    LOOPBACK = /^(\[::1\]|::1|localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;
    HOME_JOIN_ROUTE = "/api/home/join";
    HOME_FORGET_ROUTE = "/api/home/forget";
    HOMES_ROUTE = "/api/homes";
    PRESENCE_WHERE_ROUTE = "/api/presence/where";
    NEWS_ROUTE = "/api/news";
    ACTOR_KINDS_ROUTE = "/api/kinds";
    SERVING_ROUTE = "/api/serving";
    HOME_GC_ROUTE = "/api/gc";
  }
});

// packages/core/src/itemrefs.ts
var init_itemrefs = __esm({
  "packages/core/src/itemrefs.ts"() {
    "use strict";
  }
});

// packages/core/src/blobrefs.ts
var init_blobrefs = __esm({
  "packages/core/src/blobrefs.ts"() {
    "use strict";
  }
});

// packages/core/src/design-role.ts
var init_design_role = __esm({
  "packages/core/src/design-role.ts"() {
    "use strict";
  }
});

// packages/core/src/designsystem.ts
var DESIGN_SYSTEM_AFTER, DESIGN_SYSTEM_LIMIT;
var init_designsystem = __esm({
  "packages/core/src/designsystem.ts"() {
    "use strict";
    init_area();
    init_canvas_scope();
    init_design_role();
    init_design_role();
    DESIGN_SYSTEM_AFTER = 2;
    DESIGN_SYSTEM_LIMIT = DESIGN_SYSTEM_AFTER * 3;
  }
});

// packages/core/src/capabilities.ts
var init_capabilities = __esm({
  "packages/core/src/capabilities.ts"() {
    "use strict";
    init_area();
    init_browseritem();
    init_canvas_groups();
    init_canvasitem();
    init_designsystem();
    init_drawing();
    init_googledoc();
    init_kinds();
    init_modules();
    init_textnode();
  }
});

// packages/core/src/image-metadata.ts
var init_image_metadata = __esm({
  "packages/core/src/image-metadata.ts"() {
    "use strict";
  }
});

// packages/core/src/elapsed.ts
function ago(iso, nowMs, seconds) {
  const ms = nowMs - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (seconds && ms < 6e4) return `${Math.max(1, Math.round(ms / 1e3))}s`;
  const h = ms / 36e5;
  if (h < 1) return `${Math.max(1, Math.round(ms / 6e4))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}
var init_elapsed = __esm({
  "packages/core/src/elapsed.ts"() {
    "use strict";
  }
});

// packages/core/src/layout.ts
var init_layout = __esm({
  "packages/core/src/layout.ts"() {
    "use strict";
  }
});

// packages/core/src/zoomfade.ts
var init_zoomfade = __esm({
  "packages/core/src/zoomfade.ts"() {
    "use strict";
  }
});

// packages/core/src/backing.ts
var init_backing = __esm({
  "packages/core/src/backing.ts"() {
    "use strict";
  }
});

// packages/core/src/commands.ts
var init_commands = __esm({
  "packages/core/src/commands.ts"() {
    "use strict";
  }
});

// packages/core/src/preference.ts
var init_preference = __esm({
  "packages/core/src/preference.ts"() {
    "use strict";
  }
});

// packages/core/src/undone.ts
function undoneSeqs(entries) {
  const undoneBy = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    if (entry.cause?.kind === "undo") undoneBy.set(entry.cause.targetSeq, entry.seq);
    else if (entry.cause?.kind === "redo") undoneBy.delete(entry.cause.targetSeq);
  }
  return undoneBy;
}
var init_undone = __esm({
  "packages/core/src/undone.ts"() {
    "use strict";
  }
});

// packages/core/src/evals.ts
var KEPT_AFTER_MS;
var init_evals = __esm({
  "packages/core/src/evals.ts"() {
    "use strict";
    init_commands();
    init_preference();
    init_undone();
    KEPT_AFTER_MS = 12 * 60 * 60 * 1e3;
  }
});

// packages/core/src/command-catalogue.ts
var init_command_catalogue = __esm({
  "packages/core/src/command-catalogue.ts"() {
    "use strict";
  }
});

// packages/core/src/slop.ts
var init_slop = __esm({
  "packages/core/src/slop.ts"() {
    "use strict";
  }
});

// packages/core/src/command-bodies.ts
var init_command_bodies = __esm({
  "packages/core/src/command-bodies.ts"() {
    "use strict";
    init_slop();
    init_command_catalogue();
  }
});

// packages/core/src/shortcuts.ts
var init_shortcuts = __esm({
  "packages/core/src/shortcuts.ts"() {
    "use strict";
  }
});

// packages/core/src/shortcut.ts
var init_shortcut = __esm({
  "packages/core/src/shortcut.ts"() {
    "use strict";
  }
});

// packages/core/src/shortcuttext.ts
var init_shortcuttext = __esm({
  "packages/core/src/shortcuttext.ts"() {
    "use strict";
    init_shortcut();
    init_modules();
    init_shortcuts();
  }
});

// packages/core/src/bytes.ts
var init_bytes = __esm({
  "packages/core/src/bytes.ts"() {
    "use strict";
  }
});

// packages/core/src/merge.ts
var init_merge = __esm({
  "packages/core/src/merge.ts"() {
    "use strict";
    init_drawing();
  }
});

// packages/core/src/onit.ts
var init_onit = __esm({
  "packages/core/src/onit.ts"() {
    "use strict";
    init_commands();
  }
});

// packages/core/src/skillsource.ts
var init_skillsource = __esm({
  "packages/core/src/skillsource.ts"() {
    "use strict";
  }
});

// packages/core/src/contextmark.ts
var init_contextmark = __esm({
  "packages/core/src/contextmark.ts"() {
    "use strict";
  }
});

// packages/core/src/context-source.ts
var init_context_source = __esm({
  "packages/core/src/context-source.ts"() {
    "use strict";
    init_canvas_group_context();
  }
});

// packages/core/src/context-report.ts
var init_context_report = __esm({
  "packages/core/src/context-report.ts"() {
    "use strict";
    init_elapsed();
    init_recap_head();
  }
});

// packages/core/src/context.ts
var init_context = __esm({
  "packages/core/src/context.ts"() {
    "use strict";
    init_model();
    init_designsystem();
    init_modules();
    init_contextmark();
    init_canvas_group_context();
    init_context_source();
    init_context_report();
  }
});

// packages/core/src/memory-link.ts
var init_memory_link = __esm({
  "packages/core/src/memory-link.ts"() {
    "use strict";
    init_canvasitem();
  }
});

// packages/core/src/memory.ts
var init_memory = __esm({
  "packages/core/src/memory.ts"() {
    "use strict";
    init_canvasitem();
    init_area();
    init_canvas_groups();
    init_placement();
    init_designsystem();
    init_canvas_group_context();
    init_context();
    init_memory_link();
    init_memory_link();
  }
});

// packages/core/src/design-scope.ts
var init_design_scope = __esm({
  "packages/core/src/design-scope.ts"() {
    "use strict";
    init_canvas_scope();
    init_designsystem();
    init_memory();
  }
});

// packages/core/src/extensions.ts
var panelActorRoute;
var init_extensions = __esm({
  "packages/core/src/extensions.ts"() {
    "use strict";
    init_commands();
    init_identity();
    panelActorRoute = (canvasId, itemId) => `/api/projects/${encodeURIComponent(canvasId)}/panels/${encodeURIComponent(itemId)}/actor`;
  }
});

// packages/core/src/media.ts
var init_media = __esm({
  "packages/core/src/media.ts"() {
    "use strict";
    init_filenames();
    init_modules();
  }
});

// packages/core/src/designmd.ts
var init_designmd = __esm({
  "packages/core/src/designmd.ts"() {
    "use strict";
  }
});

// packages/core/src/contrast.ts
var init_contrast = __esm({
  "packages/core/src/contrast.ts"() {
    "use strict";
  }
});

// packages/core/src/colour.ts
var init_colour = __esm({
  "packages/core/src/colour.ts"() {
    "use strict";
    init_contrast();
    init_textnode();
    init_area();
    init_drawing();
  }
});

// packages/core/src/textsurfaces.ts
var init_textsurfaces = __esm({
  "packages/core/src/textsurfaces.ts"() {
    "use strict";
  }
});

// packages/core/src/textcolour.ts
var init_textcolour = __esm({
  "packages/core/src/textcolour.ts"() {
    "use strict";
    init_contrast();
    init_textsurfaces();
    init_textnode();
  }
});

// packages/core/src/theme.ts
var init_theme = __esm({
  "packages/core/src/theme.ts"() {
    "use strict";
  }
});

// packages/core/src/groundtone.ts
var init_groundtone = __esm({
  "packages/core/src/groundtone.ts"() {
    "use strict";
    init_contrast();
    init_textsurfaces();
    init_theme();
  }
});

// packages/core/src/groundsample.ts
var init_groundsample = __esm({
  "packages/core/src/groundsample.ts"() {
    "use strict";
    init_theme();
  }
});

// packages/core/src/design-contract.ts
var sides, corners, ownedProperties;
var init_design_contract = __esm({
  "packages/core/src/design-contract.ts"() {
    "use strict";
    init_designmd();
    sides = ["top", "right", "bottom", "left"];
    corners = ["top-left", "top-right", "bottom-right", "bottom-left"];
    ownedProperties = /* @__PURE__ */ new Set(["padding", ...sides.map((side) => `padding-${side}`), "border-radius", ...corners.map((corner) => `border-${corner}-radius`), "font-size", "font-weight"]);
  }
});

// packages/core/src/design-direction.ts
var init_design_direction = __esm({
  "packages/core/src/design-direction.ts"() {
    "use strict";
    init_designmd();
  }
});

// packages/core/src/designcheck.ts
var init_designcheck = __esm({
  "packages/core/src/designcheck.ts"() {
    "use strict";
    init_design_contract();
    init_contrast();
    init_design_direction();
    init_designmd();
  }
});

// packages/core/src/tokens.ts
var init_tokens = __esm({
  "packages/core/src/tokens.ts"() {
    "use strict";
    init_designmd();
    init_contrast();
  }
});

// packages/core/src/fit.ts
var init_fit = __esm({
  "packages/core/src/fit.ts"() {
    "use strict";
    init_placement();
  }
});

// packages/core/src/attest.ts
function parseSessionHeader(raw) {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== "string") return null;
  if (/[\r\n\0]/.test(first)) return null;
  const trimmed = first.trim();
  if (!trimmed || trimmed.length > 256 || !/^[\x21-\x7e]+$/.test(trimmed)) return null;
  const colon = trimmed.indexOf(":");
  if (colon <= 0 || colon === trimmed.length - 1) return null;
  const harness = trimmed.slice(0, colon);
  const sessionId = trimmed.slice(colon + 1);
  if (!isAgentHarness(harness) || !sessionId) return null;
  return trimmed;
}
var SESSION_HEADER;
var init_attest = __esm({
  "packages/core/src/attest.ts"() {
    "use strict";
    init_claims();
    SESSION_HEADER = "x-isocan-session";
  }
});

// packages/core/src/authaction.ts
var init_authaction = __esm({
  "packages/core/src/authaction.ts"() {
    "use strict";
  }
});

// packages/core/src/prove-path.ts
var init_prove_path = __esm({
  "packages/core/src/prove-path.ts"() {
    "use strict";
  }
});

// packages/core/src/operator.ts
var OPERATOR_PROOF_HEADER, OPERATOR_PROOF_WINDOW_MS, OPERATOR_LOG_ROUTE;
var init_operator = __esm({
  "packages/core/src/operator.ts"() {
    "use strict";
    init_prove_path();
    init_prove_path();
    OPERATOR_PROOF_HEADER = "x-isocan-operator-proof";
    OPERATOR_PROOF_WINDOW_MS = 10 * 60 * 1e3;
    OPERATOR_LOG_ROUTE = "/api/operator/log";
  }
});

// packages/core/src/takedown.ts
var TAKEDOWNS_ROUTE, TAKEDOWNS_CANVAS_PARAM, OPERATOR_LOOK_MS;
var init_takedown = __esm({
  "packages/core/src/takedown.ts"() {
    "use strict";
    init_address();
    TAKEDOWNS_ROUTE = "/api/takedowns";
    TAKEDOWNS_CANVAS_PARAM = "canvas";
    OPERATOR_LOOK_MS = 60 * 60 * 1e3;
  }
});

// packages/core/src/purge.ts
var init_purge = __esm({
  "packages/core/src/purge.ts"() {
    "use strict";
  }
});

// packages/core/src/ended.ts
var BADGE_ENDED;
var init_ended = __esm({
  "packages/core/src/ended.ts"() {
    "use strict";
    init_takedown();
    BADGE_ENDED = "badge-ended";
  }
});

// packages/core/src/revoked.ts
var init_revoked = __esm({
  "packages/core/src/revoked.ts"() {
    "use strict";
    init_grants();
    init_takedown();
  }
});

// packages/core/src/refusal.ts
var NET_REFUSAL_DEFAULT_MS;
var init_refusal = __esm({
  "packages/core/src/refusal.ts"() {
    "use strict";
    init_takedown();
    init_grants();
    init_errors();
    NET_REFUSAL_DEFAULT_MS = 24 * 60 * 60 * 1e3;
  }
});

// packages/core/src/lane.ts
var init_lane = __esm({
  "packages/core/src/lane.ts"() {
    "use strict";
  }
});

// packages/core/src/frameable.ts
var init_frameable = __esm({
  "packages/core/src/frameable.ts"() {
    "use strict";
  }
});

// packages/core/src/judgment.ts
var JUDGMENT_MAX_BYTES;
var init_judgment = __esm({
  "packages/core/src/judgment.ts"() {
    "use strict";
    init_modules();
    JUDGMENT_MAX_BYTES = 64 * 1024;
  }
});

// packages/core/src/modulemarks.ts
var init_modulemarks = __esm({
  "packages/core/src/modulemarks.ts"() {
    "use strict";
  }
});

// packages/core/src/moduleassets.ts
var ASSET_MAX_BYTES, ASSETS_MAX_BYTES;
var init_moduleassets = __esm({
  "packages/core/src/moduleassets.ts"() {
    "use strict";
    init_modules();
    ASSET_MAX_BYTES = 256 * 1024;
    ASSETS_MAX_BYTES = 2 * 1024 * 1024;
  }
});

// packages/core/src/designimport.ts
var init_designimport = __esm({
  "packages/core/src/designimport.ts"() {
    "use strict";
    init_designmd();
    init_tokens();
  }
});

// packages/core/src/converge.ts
var init_converge = __esm({
  "packages/core/src/converge.ts"() {
    "use strict";
    init_lineage();
    init_preference();
    init_proposal();
  }
});

// packages/core/src/brief-card.ts
var init_brief_card = __esm({
  "packages/core/src/brief-card.ts"() {
    "use strict";
    init_kinds();
    init_lineage();
    init_proposal();
  }
});

// packages/core/src/proposal-words.ts
var init_proposal_words = __esm({
  "packages/core/src/proposal-words.ts"() {
    "use strict";
    init_lineage();
    init_contextmark();
    init_brief_card();
    init_proposal();
  }
});

// packages/core/src/inbox.ts
function addressesActor(comment, names, joined) {
  const self = names[0]?.id;
  if (self && (comment.mentions ?? []).some((id) => sameActor(joined, id, self))) return true;
  return extractMentions(comment.body, names).length > 0;
}
function addressesOthers(comment, names, joined, candidates) {
  if (addressesActor(comment, names, joined)) return false;
  if ((comment.mentions ?? []).length > 0) return true;
  if (candidates && extractMentions(comment.body, candidates).length > 0) {
    return true;
  }
  return false;
}
function inYourThread(thread, actorId, names, joined) {
  return thread.comments.some(
    (c) => sameActor(joined, c.author.id, actorId) || addressesActor(c, names, joined)
  );
}
function reasonFor(comment, thread, actorId, names, joined, candidates) {
  if (comment.record) return null;
  if (addressesActor(comment, names, joined)) return "mentioned";
  if (addressesOthers(comment, names, joined, candidates)) return null;
  if (thread?.main) return "main-thread";
  if (thread && inYourThread(thread, actorId, names, joined)) return "in-your-thread";
  return null;
}
function parseListen(entry) {
  if (typeof entry === "string") return { id: entry };
  const until = entry.until;
  return until !== void 0 && Number.isFinite(Date.parse(until)) ? { id: entry.id, until } : { id: entry.id };
}
function grantLapsed(grant, now = Date.now()) {
  return grant.until !== void 0 && Date.parse(grant.until) <= now;
}
function listenGrants(listen, now = Date.now()) {
  return (listen ?? []).filter((entry) => entry !== LISTEN_ANYONE).map((entry) => {
    const grant = parseListen(entry);
    return { ...grant, lapsed: grantLapsed(grant, now) };
  });
}
function lapsedFor(policy, actorId, joined, now = Date.now()) {
  for (const grant of listenGrants(policy.listen, now)) {
    if (grant.lapsed && sameActor(joined, grant.id, actorId)) return grant.until;
  }
  return void 0;
}
function untilWords(until, now = Date.now()) {
  const left = Date.parse(until) - now;
  if (!Number.isFinite(left)) return "";
  if (left <= 0) return `lapsed ${ago(until, now)} ago`;
  if (left < 36e5) return `for ${Math.max(1, Math.round(left / 6e4))}m`;
  const tonight = new Date(now);
  tonight.setHours(24, 0, 0, 0);
  if (Date.parse(until) <= tonight.getTime()) return "until tonight";
  if (left < 864e5) return `for ${Math.round(left / 36e5)}h`;
  return `for ${Math.round(left / 864e5)}d`;
}
function rulesOf(raw) {
  if (raw === null || typeof raw !== "object") return {};
  const strings = (value) => Array.isArray(value) ? value.filter((v) => typeof v === "string") : void 0;
  const entries = (value) => Array.isArray(value) ? value.filter(
    (v) => typeof v === "string" || typeof v === "object" && v !== null && typeof v.id === "string"
  ) : void 0;
  const items = strings(raw.items);
  const ops = strings(raw.ops);
  const listen = entries(raw.listen);
  const areas = strings(raw.areas);
  return {
    ...items ? { items } : {},
    ...ops ? { ops } : {},
    ...listen ? { listen } : {},
    ...areas ? { areas } : {}
  };
}
function listensTo(rules, authorId, joined, now = Date.now()) {
  const listen = rules?.listen ?? [];
  if (listen.length === 0 || listen.includes(LISTEN_ANYONE)) return true;
  return listenGrants(listen, now).some((g) => !g.lapsed && sameActor(joined, g.id, authorId));
}
function ownersWord(keeping, actorId, joined) {
  if (sameActor(joined, actorId, keeping.owner.id)) return true;
  return (keeping.hands ?? []).some((id) => sameActor(joined, id, actorId));
}
function answerPolicy(rules, keeping, writtenBy, joined) {
  const trusted = writtenBy === void 0 || ownersWord(keeping, writtenBy, joined);
  const listen = trusted ? rules?.listen ?? [] : [];
  if (listen.includes(LISTEN_ANYONE)) return { owner: keeping.owner, listen: [LISTEN_ANYONE] };
  const others = listen.filter((entry) => !sameActor(joined, parseListen(entry).id, keeping.owner.id));
  const byId = /* @__PURE__ */ new Map();
  for (const entry of others) {
    const { id, until } = parseListen(entry);
    const had = byId.get(id);
    if (had === void 0) byId.set(id, entry);
    else if (until === void 0) byId.set(id, entry);
    else {
      const kept = parseListen(had).until;
      if (kept !== void 0 && Date.parse(until) > Date.parse(kept)) byId.set(id, entry);
    }
  }
  return { owner: keeping.owner, listen: [...byId.values()] };
}
function gateSetAside(rules, keeping, writtenBy, joined) {
  if (writtenBy === void 0 || ownersWord(keeping, writtenBy, joined)) return false;
  return (rules?.listen ?? []).some((e2) => !sameActor(joined, parseListen(e2).id, keeping.owner.id));
}
function mayWake(policy, authorId, joined, hands, now = Date.now()) {
  if (ownersWord({ owner: policy.owner, ...hands ? { hands } : {} }, authorId, joined)) return true;
  if (policy.listen.includes(LISTEN_ANYONE)) return true;
  return listenGrants(policy.listen, now).some((g) => !g.lapsed && sameActor(joined, g.id, authorId));
}
function admits(policy, authorId, agent) {
  const speakers = agent.onBehalfOf && agent.onBehalfOf.length > 0 ? agent.onBehalfOf : [authorId];
  return speakers.some((id) => mayWake(policy, id, agent.joined, agent.hands));
}
function speakersFor(authorIds, carried) {
  const out = /* @__PURE__ */ new Set();
  for (const id of authorIds) {
    const through = carried(id);
    if (through && through.size > 0) for (const s of through) out.add(s);
    else out.add(id);
  }
  return out;
}
function policyWords(policy, nameOf, viewerId, joined, now = Date.now()) {
  if (policy.listen.includes(LISTEN_ANYONE)) return null;
  const you = (id) => viewerId !== void 0 && sameActor(joined, id, viewerId);
  const called = (id, fallback) => nameOf(id) ?? fallback;
  const said = (id, fallback) => you(id) ? `you (${called(id, fallback)})` : called(id, fallback);
  const owner = said(policy.owner.id, policy.owner.name);
  const live = listenGrants(policy.listen, now).filter((g) => !g.lapsed);
  if (live.length === 0) return `listens only to ${owner}`;
  const others = live.map((g) => said(g.id, g.id));
  if (others.length === 1) return `listens to ${owner} and ${others[0]}`;
  return `listens to ${owner} and ${others.length} others`;
}
function turnedAway(op, authorId, agent) {
  if (op.type !== "thread.create" && op.type !== "thread.reply") return false;
  if (op.comment.record) return false;
  if (isSystemActor(authorId) || sameActor(agent.joined, authorId, agent.actorId)) return false;
  if (admits(agent.policy, authorId, agent)) return false;
  return addressesActor(op.comment, agent.names, agent.joined);
}
function turnedAwayLine(agentName, policy, nameOf, asker, opts) {
  const now = opts?.now ?? Date.now();
  const owner = nameOf(policy.owner.id) ?? policy.owner.name;
  const gate = policyWords(policy, nameOf, void 0, void 0, now) ?? `listens only to ${owner}`;
  const names = [
    ...listenGrants(policy.listen, now).filter((g) => !g.lapsed).map((g) => nameOf(g.id) ?? g.id),
    asker
  ];
  const to = names.join(",");
  const quoted = /[\s"'$`\\]/.test(to) ? `"${to.replace(/(["$`\\])/g, "\\$1")}"` : to;
  const ran = opts?.lapsed ? ` ${asker}'s access ${untilWords(opts.lapsed, now)}.` : "";
  return `${agentName} ${gate} \u2014 ${turnedAwayMark(agentName)}${ran} ${owner} can widen it: isocan rc listen ${/\s/.test(agentName) ? `"${agentName}"` : agentName} --to ${quoted}`;
}
function turnedAwayMark(agentName) {
  return `this did not wake ${agentName}, and spent nothing.`;
}
function mentionsOnly(canvas, actorId) {
  return canvas?.agents?.[actorId]?.ceiling === "note";
}
function dispatchReason(op, authorId, agent, canvas) {
  if (sameActor(agent.joined, authorId, agent.actorId)) return null;
  if (isSystemActor(authorId)) return null;
  if (op.comment?.record) return null;
  const admitted = agent.policy ? admits(agent.policy, authorId, agent) : listensTo(agent.rules, authorId, agent.joined);
  if (!admitted) return null;
  const capped = mentionsOnly(canvas, agent.actorId);
  if (op.type === "thread.create" || op.type === "thread.reply") {
    const thread = canvas?.threads[op.threadId];
    const candidates = canvas ? collectCanvasNames(canvas) : void 0;
    const reason = reasonFor(op.comment, thread, agent.actorId, agent.names, agent.joined, candidates);
    if (reason && (!capped || reason === "mentioned")) return reason;
  }
  if (op.type === "questionnaire.ask" || op.type === "questionnaire.answer") {
    const thread = canvas?.threads[op.threadId];
    const comment = thread?.comments.find((c) => c.id === op.commentId);
    const candidates = canvas ? collectCanvasNames(canvas) : void 0;
    const reason = comment && reasonFor(comment, thread, agent.actorId, agent.names, agent.joined, candidates);
    if (reason && (!capped || reason === "mentioned")) return reason;
  }
  if (capped) return null;
  const rules = agent.rules;
  if (!rules) return null;
  const items = rules.items ?? [];
  const ops = rules.ops ?? [];
  const areas = rules.areas ?? [];
  if (items.length === 0 && ops.length === 0 && areas.length === 0) return null;
  if (!opMatchesFilters(op, { items, types: ops }, canvas ?? null)) return null;
  if (areas.length > 0 && !opTouchesAreas(op, areas, canvas ?? null)) return null;
  return "change";
}
var LISTEN_ANYONE;
var init_inbox = __esm({
  "packages/core/src/inbox.ts"() {
    "use strict";
    init_mentions();
    init_identity();
    init_model();
    init_elapsed();
    init_touches();
    LISTEN_ANYONE = "*";
  }
});

// packages/core/src/goodnight.ts
var init_goodnight = __esm({
  "packages/core/src/goodnight.ts"() {
    "use strict";
    init_identity();
    init_lineage();
    init_proposal();
    init_designsystem();
    init_roster();
    init_undone();
    init_commands();
    init_inbox();
    init_onit();
    init_tidy();
    init_textnode();
    init_placement();
  }
});

// packages/core/src/morning.ts
var init_morning = __esm({
  "packages/core/src/morning.ts"() {
    "use strict";
    init_model();
    init_identity();
    init_proposal();
    init_goodnight();
  }
});

// packages/core/src/design-words.ts
var init_design_words = __esm({
  "packages/core/src/design-words.ts"() {
    "use strict";
  }
});

// packages/core/src/explain.ts
var init_explain = __esm({
  "packages/core/src/explain.ts"() {
    "use strict";
    init_lineage();
    init_lane();
    init_proposal();
    init_preference();
    init_designsystem();
    init_design_scope();
    init_design_words();
    init_goodnight();
    init_tidy();
    init_placement();
    init_textnode();
  }
});

// packages/core/src/claim.ts
var init_claim = __esm({
  "packages/core/src/claim.ts"() {
    "use strict";
  }
});

// packages/core/src/persona.ts
var init_persona = __esm({
  "packages/core/src/persona.ts"() {
    "use strict";
  }
});

// packages/core/src/homage.ts
var init_homage = __esm({
  "packages/core/src/homage.ts"() {
    "use strict";
  }
});

// packages/core/src/roll.ts
function rollDue(facts) {
  const { last, seen, now } = facts;
  if (last?.kind === "away") return "back";
  const evidence = Math.max(seen ?? -Infinity, last?.at ?? -Infinity);
  const gone = now - evidence > ROLL_AWAY_MS;
  if (!last) return seen === void 0 || gone ? "here" : null;
  return gone ? "back" : null;
}
function lastRoll(canvas, actorId) {
  const chat = mainThread(canvas);
  if (!chat) return null;
  for (let i = chat.comments.length - 1; i >= 0; i--) {
    const c = chat.comments[i];
    if (typeof c.record === "string" && c.author.id === actorId) return { kind: c.record, at: Date.parse(c.createdAt) };
  }
  return null;
}
function rollWords(kind, name, listens) {
  if (kind === "away") return `${name} stepped away \u2014 not answering here until it is back.`;
  const verb = kind === "here" ? "is here" : "is back";
  return `${name} ${verb} \u2014 answering a mention or the Chat; ${listens}.`;
}
function rollOp(canvas, kind, body) {
  const comment = { id: newCommentId(), body, record: kind };
  const chat = mainThread(canvas);
  if (chat) return { type: "thread.reply", threadId: chat.id, comment };
  return { type: "thread.create", threadId: newThreadId(), x: 80, y: 80, anchorItemId: null, main: true, comment };
}
var ROLL_AWAY_MS;
var init_roll = __esm({
  "packages/core/src/roll.ts"() {
    "use strict";
    init_model();
    init_ids();
    ROLL_AWAY_MS = 5 * 6e4;
  }
});

// packages/core/src/summons.ts
var init_summons = __esm({
  "packages/core/src/summons.ts"() {
    "use strict";
    init_inbox();
    init_onit();
  }
});

// packages/core/src/docstatus.ts
var init_docstatus = __esm({
  "packages/core/src/docstatus.ts"() {
    "use strict";
    init_persona();
  }
});

// packages/core/src/jsoncanvas.ts
var init_jsoncanvas = __esm({
  "packages/core/src/jsoncanvas.ts"() {
    "use strict";
    init_edges();
    init_modules();
    init_browseritem();
  }
});

// packages/core/src/context-pin.ts
var init_context_pin = __esm({
  "packages/core/src/context-pin.ts"() {
    "use strict";
    init_canvasitem();
    init_contextmark();
    init_context_source();
    init_canvas_group_context();
    init_canvas_groups();
    init_designsystem();
  }
});

// packages/core/src/slides.ts
var init_slides = __esm({
  "packages/core/src/slides.ts"() {
    "use strict";
    init_canvas_group_context();
  }
});

// packages/core/src/slidewrites.ts
var init_slidewrites = __esm({
  "packages/core/src/slidewrites.ts"() {
    "use strict";
    init_textnode();
    init_slides();
  }
});

// packages/core/src/deckexport.ts
var init_deckexport = __esm({
  "packages/core/src/deckexport.ts"() {
    "use strict";
    init_slides();
    init_slidewrites();
    init_filenames();
  }
});

// packages/core/src/shelf.ts
var init_shelf = __esm({
  "packages/core/src/shelf.ts"() {
    "use strict";
  }
});

// packages/core/src/sprint.ts
var PHASES;
var init_sprint = __esm({
  "packages/core/src/sprint.ts"() {
    "use strict";
    init_canvas_groups();
    init_model();
    init_commands();
    init_area();
    PHASES = [
      { name: "map", label: "Map", kind: "group", mark: null, defaultSeconds: 45 * 60, area: "map" },
      { name: "experts", label: "Ask the Experts", kind: "group", mark: null, defaultSeconds: 20 * 60, area: "experts" },
      { name: "hmw", label: "How Might We", kind: "silent", mark: null, defaultSeconds: 10 * 60, area: "experts" },
      { name: "target", label: "Pick a target", kind: "decide", mark: "\u{1F3AF}", defaultSeconds: null, area: "target" },
      { name: "demos", label: "Lightning Demos", kind: "group", mark: null, defaultSeconds: 3 * 60, area: "demos" },
      { name: "notes", label: "Notes", kind: "silent", mark: null, defaultSeconds: 20 * 60, area: "sketches" },
      { name: "ideas", label: "Ideas", kind: "silent", mark: null, defaultSeconds: 20 * 60, area: "sketches" },
      { name: "crazy8s", label: "Crazy 8s", kind: "silent", mark: null, defaultSeconds: 8 * 60, area: "sketches" },
      { name: "sketch", label: "Solution sketch", kind: "silent", mark: null, defaultSeconds: 30 * 60, area: "sketches" },
      { name: "museum", label: "Art Museum", kind: "group", mark: null, defaultSeconds: null, area: "vote" },
      { name: "heatmap", label: "Heat Map", kind: "vote", mark: "\u{1F534}", defaultSeconds: 5 * 60, area: "vote" },
      { name: "critique", label: "Speed Critique", kind: "group", mark: null, defaultSeconds: 3 * 60, area: "vote" },
      { name: "poll", label: "Straw Poll", kind: "vote", mark: "\u2B50", defaultSeconds: 2 * 60, area: "vote" },
      { name: "supervote", label: "Supervote", kind: "decide", mark: "\u{1F3C6}", defaultSeconds: null, area: "vote" },
      { name: "storyboard", label: "Storyboard", kind: "group", mark: null, defaultSeconds: 60 * 60, area: "storyboard" },
      { name: "prototype", label: "Prototype", kind: "group", mark: null, defaultSeconds: null, area: "prototype" },
      { name: "test", label: "Test", kind: "group", mark: null, defaultSeconds: null, area: "test" },
      { name: "wrap", label: "Wrap-up", kind: "group", mark: null, defaultSeconds: 30 * 60, area: "wrap" }
    ];
  }
});

// packages/core/src/timeline.ts
var HOUR, DAY;
var init_timeline = __esm({
  "packages/core/src/timeline.ts"() {
    "use strict";
    init_opwords();
    init_reducer();
    init_canvas_groups();
    HOUR = 36e5;
    DAY = 24 * HOUR;
  }
});

// packages/core/src/canvassort.ts
var init_canvassort = __esm({
  "packages/core/src/canvassort.ts"() {
    "use strict";
  }
});

// packages/core/src/canvasswitch.ts
var init_canvasswitch = __esm({
  "packages/core/src/canvasswitch.ts"() {
    "use strict";
    init_canvassort();
    init_shelf();
  }
});

// packages/core/src/seen.ts
function seenMarksRoute(actorId, canvasId) {
  const query = new URLSearchParams();
  if (actorId !== void 0) query.set("actorId", actorId);
  if (canvasId !== void 0) query.set("canvasId", canvasId);
  return `${SEEN_ROUTE}${query.size ? `?${query}` : ""}`;
}
function seenRoute(canvasId) {
  return `${SEEN_ROUTE}/${canvasId}`;
}
var SEEN_ROUTE;
var init_seen = __esm({
  "packages/core/src/seen.ts"() {
    "use strict";
    SEEN_ROUTE = "/api/seen";
  }
});

// packages/core/src/lens.ts
var LENS_WINDOWS;
var init_lens = __esm({
  "packages/core/src/lens.ts"() {
    "use strict";
    init_kinds();
    init_opwords();
    LENS_WINDOWS = [
      { label: "Today", hours: 24 },
      { label: "This week", hours: 24 * 7 },
      { label: "This month", hours: 24 * 30 }
    ];
  }
});

// packages/core/src/export.ts
var init_export = __esm({
  "packages/core/src/export.ts"() {
    "use strict";
    init_media();
    init_address();
  }
});

// packages/core/src/text-attention.ts
var init_text_attention = __esm({
  "packages/core/src/text-attention.ts"() {
    "use strict";
  }
});

// packages/core/src/live-drag.ts
var init_live_drag = __esm({
  "packages/core/src/live-drag.ts"() {
    "use strict";
  }
});

// packages/core/src/markdown-resources.ts
var init_markdown_resources = __esm({
  "packages/core/src/markdown-resources.ts"() {
    "use strict";
    init_address();
    init_backing();
    init_model();
  }
});

// packages/core/src/inbox-api.ts
function inboxRoute(actorId, options = {}) {
  const query = new URLSearchParams({ actorId });
  if (options.canvasId !== void 0) query.set("canvasId", options.canvasId);
  if (options.label !== void 0) query.set("label", options.label);
  return `${INBOX_ROUTE}?${query}`;
}
var INBOX_ROUTE;
var init_inbox_api = __esm({
  "packages/core/src/inbox-api.ts"() {
    "use strict";
    INBOX_ROUTE = "/api/inbox";
  }
});

// packages/core/src/loop.ts
var init_loop = __esm({
  "packages/core/src/loop.ts"() {
    "use strict";
    init_docstatus();
    init_filenames();
    init_persona();
  }
});

// packages/core/src/index.ts
var init_src = __esm({
  "packages/core/src/index.ts"() {
    "use strict";
    init_model();
    init_comment_references();
    init_errors();
    init_canvas_group_context();
    init_canvas_group_context_resolve();
    init_canvas_group_copy();
    init_canvas_group_migration();
    init_ops();
    init_reducer();
    init_badge();
    init_grants();
    init_public();
    init_personal();
    init_passes();
    init_address();
    init_emoji();
    init_reactions();
    init_docket();
    init_recap();
    init_recap_head();
    init_roster();
    init_claims();
    init_invert();
    init_placement();
    init_area();
    init_canvas_group_types();
    init_canvas_groups();
    init_canvas_group_arrange();
    init_group_aim();
    init_group_stack();
    init_canvas_scope();
    init_canvas_group_create();
    init_canvasitem();
    init_bench();
    init_benchjoin();
    init_googledoc();
    init_addable();
    init_titleroom();
    init_whatsnew();
    init_protocol();
    init_ids();
    init_mentions();
    init_browseritem();
    init_itemrefs();
    init_identity();
    init_filenames();
    init_blobrefs();
    init_kinds();
    init_capabilities();
    init_image_metadata();
    init_touches();
    init_elapsed();
    init_layout();
    init_drawing();
    init_duplicate();
    init_textnode();
    init_zoomrule();
    init_zoomfade();
    init_annotation();
    init_backing();
    init_activity();
    init_evals();
    init_undone();
    init_lineage();
    init_commands();
    init_command_catalogue();
    init_command_bodies();
    init_shortcuts();
    init_shortcuttext();
    init_bytes();
    init_format();
    init_tidy();
    init_merge();
    init_onit();
    init_slop();
    init_skillsource();
    init_designsystem();
    init_design_scope();
    init_preference();
    init_extensions();
    init_media();
    init_designmd();
    init_contrast();
    init_colour();
    init_textcolour();
    init_groundtone();
    init_groundsample();
    init_shortcut();
    init_designcheck();
    init_tokens();
    init_fit();
    init_attest();
    init_authaction();
    init_operator();
    init_takedown();
    init_purge();
    init_ended();
    init_revoked();
    init_refusal();
    init_lane();
    init_frameable();
    init_modules();
    init_judgment();
    init_modulemarks();
    init_moduleassets();
    init_designimport();
    init_context();
    init_memory();
    init_converge();
    init_proposal();
    init_proposal_words();
    init_goodnight();
    init_morning();
    init_explain();
    init_design_words();
    init_itemthread();
    init_claim();
    init_persona();
    init_homage();
    init_inbox();
    init_roll();
    init_prototype_click();
    init_summons();
    init_docstatus();
    init_jsoncanvas();
    init_contextmark();
    init_context_source();
    init_context_pin();
    init_slides();
    init_slidewrites();
    init_deckexport();
    init_shelf();
    init_theme();
    init_sprint();
    init_timeline();
    init_opwords();
    init_ceiling();
    init_canonical_json();
    init_canvassort();
    init_canvasswitch();
    init_seen();
    init_lens();
    init_export();
    init_text_attention();
    init_live_drag();
    init_edges();
    init_text_anchor();
    init_markdown_resources();
    init_inbox_api();
    init_loop();
  }
});

// packages/core/src/stuck.ts
var stuck_exports = {};
__export(stuck_exports, {
  STUCK_AXES: () => STUCK_AXES,
  STUCK_QUICK_MS: () => STUCK_QUICK_MS,
  STUCK_TRIES: () => STUCK_TRIES,
  STUCK_WINDOW_MS: () => STUCK_WINDOW_MS,
  stuckAll: () => stuckAll,
  stuckAnswerBody: () => stuckAnswerBody,
  stuckAnswered: () => stuckAnswered,
  stuckAxis: () => stuckAxis,
  stuckOn: () => stuckOn,
  stuckQuestionBody: () => stuckQuestionBody,
  stuckQuestionOf: () => stuckQuestionOf,
  stuckQuestionRefusal: () => stuckQuestionRefusal,
  stuckSections: () => stuckSections
});
function words(body) {
  return body.replace(/@[\w'’.-]+/g, " ").replace(/#[\w'’.-]+/g, " ").replace(/[^\p{L}\p{N}']+/gu, " ").trim().split(" ").filter(Boolean);
}
function asksIn(entries, undone) {
  const anchor = /* @__PURE__ */ new Map();
  const main = /* @__PURE__ */ new Map();
  const last = /* @__PURE__ */ new Map();
  const out = [];
  for (const entry of entries) {
    const op = entry.envelope.op;
    if (op.type === "thread.setAnchor") anchor.set(op.threadId, op.anchorItemId ?? null);
    if (op.type === "thread.setMain" && op.threadId) main.set(op.threadId, true);
    if (op.type !== "thread.create" && op.type !== "thread.reply") continue;
    if (op.type === "thread.create") {
      anchor.set(op.threadId, op.anchorItemId);
      if (op.main) main.set(op.threadId, true);
    }
    if (entry.cause || undone.has(entry.seq)) continue;
    const comment = op.comment;
    if (comment.record || comment.click || comment.deleted || comment.goodnight) continue;
    const inMain = main.get(op.threadId);
    const summons = (comment.mentions?.length ?? 0) > 0 || inMain === true || inMain === void 0 && (comment.items?.length ?? 0) > 0;
    if (!summons) continue;
    const person = entry.envelope.actor;
    const key = `${person.id} ${op.threadId}`;
    const named = /* @__PURE__ */ new Set([...comment.items ?? [], ...anchor.get(op.threadId) ? [anchor.get(op.threadId)] : []]);
    const items = named.size ? named : new Set(last.get(key) ?? []);
    if (named.size) last.set(key, named);
    out.push({ seq: entry.seq, commentId: comment.id, ts: Date.parse(entry.envelope.ts), at: entry.envelope.ts, body: comment.body, person, items, answer: comment.body.includes(`${ANSWER_MARK} (`) });
  }
  return out;
}
function resultOf(entry, itemId) {
  const op = entry.envelope.op;
  const base2 = { seq: entry.seq, ts: Date.parse(entry.envelope.ts), itemId, by: entry.envelope.actor };
  if ((op.type === "item.addVersion" || op.type === "item.edit") && op.itemId === itemId) return { ...base2, versionId: op.version.id };
  if (op.type === "item.add" && op.properties?.[PARENT_PROP] === itemId) return { ...base2, childId: op.itemId };
  return null;
}
function goneAt(entries, undone, r, horizon) {
  const undo = undone.get(r.seq);
  let best = null;
  const take = (fate, ts) => {
    if (!best || ts < best.ts) best = { fate, ts };
  };
  if (undo !== void 0) {
    const e2 = entries.find((x) => x.seq === undo);
    if (e2) take("undone", Date.parse(e2.envelope.ts));
  }
  for (const e2 of entries) {
    if (e2.seq <= r.seq || e2.seq >= horizon || e2.cause || undone.has(e2.seq)) continue;
    const op = e2.envelope.op;
    if (r.versionId && op.type === "item.setCurrentVersion" && op.itemId === r.itemId && op.versionId !== r.versionId) take("set aside", Date.parse(e2.envelope.ts));
    if (r.childId && (op.type === "item.delete" && op.itemId === r.childId || op.type === "items.delete" && op.itemIds.includes(r.childId))) take("deleted", Date.parse(e2.envelope.ts));
  }
  return best;
}
function triesAt(entries, itemId, actorId) {
  const undone = undoneSeqs(entries);
  const asks = asksIn(entries, undone).filter((a) => a.person.id === actorId && a.items.has(itemId));
  const tries = [];
  const answered = asks.map((ask, i) => {
    const next = asks[i + 1];
    const results = [];
    for (const e2 of entries) {
      if (e2.seq <= ask.seq || next && e2.seq >= next.seq) continue;
      if (e2.cause || e2.envelope.actor.id === actorId) continue;
      const r = resultOf(e2, itemId);
      if (r) results.push(r);
    }
    return results;
  });
  for (const [i, ask] of asks.entries()) {
    const next = asks[i + 1];
    const results = answered[i];
    if (!results.length) continue;
    const horizon = answered.slice(i + 1).find((r) => r.length)?.[0]?.seq ?? Infinity;
    const lastTs = Math.max(...results.map((r) => r.ts));
    const gone = results.map((r) => goneAt(entries, undone, r, horizon));
    let fate = null;
    let afterMs = 0;
    if (gone.every((g) => g !== null)) {
      const latest = gone.reduce((a, b) => b.ts > a.ts ? b : a);
      fate = latest.fate;
      afterMs = Math.max(0, latest.ts - lastTs);
    } else if (next && next.ts - lastTs <= STUCK_QUICK_MS) {
      fate = "asked again";
      afterMs = Math.max(0, next.ts - lastTs);
    } else if (next && !next.answer && words(next.body).length < words(ask.body).length) {
      fate = "asked shorter";
      afterMs = Math.max(0, next.ts - lastTs);
    }
    tries.push({
      askId: ask.commentId,
      askSeq: ask.seq,
      ask: ask.body,
      at: ask.at,
      by: results[0].by,
      versionIds: results.flatMap((r) => r.versionId ? [r.versionId] : []),
      childIds: results.flatMap((r) => r.childId ? [r.childId] : []),
      fate: fate ?? "asked again",
      afterMs,
      kept: fate === null,
      answer: ask.answer
    });
  }
  return { tries, asks };
}
function stuckOn(entries, itemId, actorId, now) {
  const { tries, asks } = triesAt(entries, itemId, actorId);
  let start = tries.length;
  while (start > 0) {
    const t = tries[start - 1];
    if (t.kept) break;
    start -= 1;
    if (t.answer) break;
  }
  const run = tries.slice(start);
  if (run.length < STUCK_TRIES) return null;
  const lastTry = run.at(-1);
  const after = asks.filter((a) => a.seq > lastTry.askSeq);
  if (after.some((a) => a.answer)) return null;
  const pendingAsk = after.find((a) => !tries.some((t) => t.askSeq === a.seq)) ?? null;
  const counted = run.slice(-STUCK_TRIES);
  const first = Date.parse(counted[0].at);
  const newest = pendingAsk ? pendingAsk.ts : Date.parse(lastTry.at) + lastTry.afterMs;
  if (newest - first > STUCK_WINDOW_MS) return null;
  const clock = now ?? Date.parse(entries.at(-1)?.envelope.ts ?? (/* @__PURE__ */ new Date(0)).toISOString());
  if (clock - newest > STUCK_WINDOW_MS) return null;
  const said = [...run.map((t) => t.ask), ...pendingAsk ? [pendingAsk.body] : []].map((b) => words(b).length);
  const shorter = said.length > 1 && said.every((n, i) => i === 0 || n <= said[i - 1]) && said.at(-1) < said[0];
  const person = asks[0].person;
  const fates = /* @__PURE__ */ new Map();
  for (const t of run) fates.set(t.fate, (fates.get(t.fate) ?? 0) + 1);
  const how = [...fates].map(([f, n]) => `${count(n)} ${FATE_WORDS[f]}`).join(", ");
  const quickest = Math.min(...run.map((t) => t.afterMs));
  const facts = [
    `${count(run.length).replace(/^./, (c) => c.toUpperCase())} tries in ${plural(minutes(newest - Date.parse(run[0].at)), "minute")}, and none of them landed: ${how}.`,
    `The quickest went after ${quickest < 6e4 ? plural(Math.max(1, Math.round(quickest / 1e3)), "second") : plural(minutes(quickest), "minute")}.`,
    ...shorter ? [`The asks got shorter: ${[...run.map((t) => t.ask), ...pendingAsk ? [pendingAsk.body] : []].map((b) => quote(words(b).join(" ") || b)).join(" \u2192 ")}.`] : []
  ];
  return {
    itemId,
    person,
    tries: run.map(({ askSeq: _s, kept: _k, answer: _a, ...t }) => t),
    pending: pendingAsk ? { commentId: pendingAsk.commentId, at: pendingAsk.at, ask: pendingAsk.body } : null,
    shorter,
    at: `${itemId} \xB7 ${pendingAsk?.commentId ?? lastTry.askId}`,
    facts
  };
}
function stuckAll(entries, now) {
  const undone = undoneSeqs(entries);
  const pairs = /* @__PURE__ */ new Map();
  for (const ask of asksIn(entries, undone)) for (const itemId of ask.items) pairs.set(`${ask.person.id} ${itemId}`, { itemId, actorId: ask.person.id });
  return [...pairs.values()].flatMap(({ itemId, actorId }) => {
    const s = stuckOn(entries, itemId, actorId, now);
    return s ? [s] : [];
  }).sort((a, b) => Date.parse(b.pending?.at ?? b.tries.at(-1).at) - Date.parse(a.pending?.at ?? a.tries.at(-1).at));
}
function stuckAxis(raw) {
  const k = raw.trim().toLowerCase();
  return STUCK_AXES.find((a) => a.id === k || a.name.toLowerCase() === k || a.name.toLowerCase().split(" ")[0] === k)?.id ?? null;
}
function stuckQuestionRefusal(stuck, title, q) {
  if (!stuck) return `nobody is stuck on \u201C${title}\u201D: ask a question when ${STUCK_TRIES} tries in a row have missed \u2014 until then, answer the ask with a take`;
  if (!q.observations.length) return 'say what you noticed in what they kept and undid: --observe "You kept the photo every time." (one to three)';
  if (q.observations.length > 3) return "three observations at most \u2014 what you noticed, not everything that happened";
  for (const o of q.observations) {
    if (o.length > 160 || (o.match(/[.!?](\s|$)/g) ?? []).length > 1) return "an observation is one sentence";
    if (/\b(you|you're|you are|they|they're)\b[^.!?]*\bstuck\b/i.test(o)) return "never say the person is stuck \u2014 you have been guessing; say what you noticed";
  }
  const seen = /* @__PURE__ */ new Set();
  for (const t of q.tiles) {
    if (seen.has(t.axis)) return `\u201C${axisName(t.axis)}\u201D is asked twice`;
    seen.add(t.axis);
    if (!t.now.trim() || !t.instead.trim()) return `\u201C${axisName(t.axis)}\u201D says both sides: now and instead`;
    if (t.now.length > 80 || t.instead.length > 80) return `\u201C${axisName(t.axis)}\u201D is a tile, not a paragraph \u2014 eighty characters a side`;
    if ([t.now, t.instead].some((s) => s.includes(" \xB7 ") || s.includes("\n"))) return "a tile's words are one line, without \u201C \xB7 \u201D";
  }
  const missing = STUCK_AXES.filter((a) => !seen.has(a.id));
  if (missing.length) return `the question has four pairs \u2014 ${missing.map((a) => a.name).join(", ")} ${missing.length === 1 ? "is" : "are"} missing: --tile "${missing[0].id} | now | instead" --guess ${missing[0].id}=now|instead`;
  return null;
}
function stuckQuestionBody(stuck, title, q) {
  const one = (s) => s.replace(/\s+/g, " ").trim();
  const tiles = STUCK_AXES.map((a) => q.tiles.find((t) => t.axis === a.id));
  return [
    `${STUCK_MARK} (${stuck.at})`,
    `I've been guessing at \u201C${one(title)}\u201D, so I've stopped making new takes. Here is what I noticed, and a question instead.`,
    ...q.observations.map((o) => `Noticed: ${one(o)}`),
    ...tiles.map((t) => `${axisName(t.axis)} \u2014 now: ${one(t.now)} \xB7 instead: ${one(t.instead)} \xB7 my guess: ${t.guess}`),
    "Or: show me extremes \xB7 name a product that gets it right"
  ].join("\n");
}
function comments(canvas) {
  return Object.values(canvas.threads).flatMap((t) => t.comments).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
function stuckQuestionOf(canvas, at) {
  const head = `${STUCK_MARK} (${at})`;
  const c = comments(canvas).filter((one) => one.record && one.body.startsWith(head)).at(-1);
  if (!c) return null;
  const lines = c.body.split("\n");
  const tiles = [];
  for (const l of lines) {
    const m = /^(.+?) — now: (.*) · instead: (.*) · my guess: (now|instead)$/.exec(l);
    const axis = m && STUCK_AXES.find((a) => a.name === m[1])?.id;
    if (m && axis) tiles.push({ axis, now: m[2], instead: m[3], guess: m[4] });
  }
  return { by: c.author, commentId: c.id, observations: lines.filter((l) => l.startsWith("Noticed: ")).map((l) => l.slice(9)), tiles };
}
function stuckAnswerBody(lead, at, q, a) {
  const head = `@${lead.name} ${ANSWER_MARK} (${at}):`;
  if (a.kind === "extremes") return `${head} show me extremes \u2014 one take at each end of every pair, side by side, so I can point.`;
  if (a.kind === "product") return `${head} a product that gets it right \u2014 ${a.name.replace(/\s+/g, " ").trim()}. Work from what it does, not from my last asks.`;
  const said = a.picks.map((p) => {
    const tile = q?.tiles.find((t) => t.axis === p.axis);
    return `${axisName(p.axis)}: ${p.side}${tile ? ` (${p.side === "now" ? tile.now : tile.instead})` : ""}`;
  });
  return `${head} ${said.join("; ")}. Make one take from these.`;
}
function stuckAnswered(canvas, at) {
  return comments(canvas).some((c) => c.body.includes(`${ANSWER_MARK} (${at})`));
}
function stuckSections(stuck, title, q, lead, waits) {
  const who = q ? "I've" : `${stuck.tries.at(-1).by.name} has`;
  const out = [{ key: "guessing", heading: `${who} been guessing at \u201C${title}\u201D`, lines: stuck.facts.map((text2) => ({ text: text2 })) }];
  if (!q) {
    out.push({ key: "waits", heading: "The question", lines: [{ text: waits ? `The question waits: ${waits}` : `Asked ${lead ?? "the lead"}: a question instead of another take, on its way.` }] });
    return out;
  }
  out.push({ key: "noticed", heading: "What I noticed \u2014 say if I'm wrong", lines: q.observations.map((text2) => ({ text: text2 })) });
  out.push({
    key: "tiles",
    heading: "Now, or instead?",
    lines: STUCK_AXES.flatMap((a) => {
      const t = q.tiles.find((x) => x.axis === a.id);
      return t ? [{ text: `${a.name} \u2014 now: ${t.now} \xB7 instead: ${t.instead} \xB7 my guess: ${t.guess}`, axis: a.id, now: t.now, instead: t.instead, guess: t.guess }] : [];
    })
  });
  out.push({ key: "ways", heading: "Or", lines: [{ text: "Show me extremes" }, { text: "Name a product that gets it right" }] });
  return out;
}
var STUCK_TRIES, STUCK_WINDOW_MS, STUCK_QUICK_MS, STUCK_AXES, STUCK_MARK, ANSWER_MARK, FATE_WORDS, minutes, plural, quote, COUNT, count, axisName;
var init_stuck = __esm({
  "packages/core/src/stuck.ts"() {
    "use strict";
    init_src();
    STUCK_TRIES = 3;
    STUCK_WINDOW_MS = 15 * 6e4;
    STUCK_QUICK_MS = 2 * 6e4;
    STUCK_AXES = [
      { id: "density", name: "Density" },
      { id: "brand", name: "Brand expression" },
      { id: "layout", name: "Layout" },
      { id: "tone", name: "Tone of voice" }
    ];
    STUCK_MARK = "Stuck question";
    ANSWER_MARK = "Stuck answer";
    FATE_WORDS = {
      undone: "undone",
      "set aside": "set aside",
      deleted: "deleted",
      "asked again": "asked for again within two minutes",
      "asked shorter": "asked for again in fewer words"
    };
    minutes = (ms) => Math.max(1, Math.round(ms / 6e4));
    plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"}`;
    quote = (s) => `\u201C${s.replace(/\s+/g, " ").trim().slice(0, 60)}${s.trim().length > 60 ? "\u2026" : ""}\u201D`;
    COUNT = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    count = (n) => COUNT[n] ?? String(n);
    axisName = (id) => STUCK_AXES.find((a) => a.id === id).name;
  }
});

// packages/api/src/routes.ts
init_src();
init_src();
init_src();
init_src();
init_questionnaire();

// packages/core/src/design-request.ts
init_design_request_parse();
init_design_request_parse();
var designRequestsRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/design/requests`;

// packages/core/src/design-decision.ts
init_design_decision_state();
init_identity();
init_design_decision_parse();
var designDecisionsRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/design/decisions`;

// packages/core/src/design-repair.ts
init_design_repair_parse();
var designRepairsRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/design/repairs`;

// packages/api/src/routes.ts
init_src();
init_src();
init_src();
var imagePath = "/api/image";
var swatchesPath = "/api/image/swatches";
var summariesPath = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/summaries`;
var OPERATIONS_ROUTE = "/api/ops";
var platformFetch = (input, init) => fetch(input, init);
var DaemonRoutes = class {
  constructor(base2, badgeStore, lifetime, sourceContext) {
    this.base = base2;
    this.badgeStore = badgeStore;
    this.lifetime = lifetime;
    if (sourceContext) this.sourceContext = Object.freeze({
      ...parseSourcePolicyHeader(sourcePolicyHeader(sourceContext)),
      ...sourceContext.signal ? { signal: sourceContext.signal } : {}
    });
  }
  base;
  badgeStore;
  lifetime;
  /** Loaded once per instance, from the badge store it was handed. */
  badge;
  /**
   * How to make the home vouch for whoever this command speaks as: claim the
   * actor under the session key it belongs to. Registered by
   * `resolveIdentity` — knowing who you are is knowing how to prove it.
   *
   * Two refusals need it, and they are the two landmines mechanism 5 laid:
   *
   * - **401.** The door mints a badge whose claims are EMPTY, and the request
   *   about to be replayed asserts an actor. Re-claim, then replay.
   * - **`not-your-actor`.** The home identity in `~/.isocan/identity.json` is
   *   a local file that nothing ever claimed — so the first time a machine
   *   speaks for its person, the home has never heard the claim. Making it on
   *   demand is what turns "refused, for every solo human at once" into one
   *   extra round trip, once per badge, that nobody sees.
   */
  reclaim = null;
  reclaiming = false;
  /** The last observed mode is captured into each request body before retries.
   * Callers holding an older placement preview pass its mode explicitly. */
  observedGroupModes = /* @__PURE__ */ new Map();
  sourceContext;
  requestSignal(signal) {
    const signals = [this.lifetime, this.sourceContext?.signal, signal].filter((value) => !!value);
    return signals.length > 1 ? AbortSignal.any(signals) : signals[0];
  }
  policyHeaders() {
    return this.sourceContext ? { [SOURCE_POLICY_HEADER]: sourcePolicyHeader(this.sourceContext) } : {};
  }
  /**
   * **The fetch this surface makes its requests with**, so that the half of
   * the client which is allowed to know about Node can bound them.
   *
   * It is a field rather than an import for the reason the whole class exists
   * (`boundary.test.ts`): a connect deadline is `undici`, `undici` is Node,
   * and the moment this file imports it the browser build of the transport
   * kernel stops being possible. So the mechanism lives in `client.ts` —
   * `DaemonClient` replaces this with a connect-bounded, bounded-retry fetch
   * when the base is loopback — and what is written here is only that the
   * requests go through something replaceable.
   *
   * The default is the platform's own fetch, which is what every surface
   * without a Node half keeps: one attempt, no deadline, exactly today.
   */
  fetcher = platformFetch;
  /** Transport fetcher used for unretried probes (`healthz`); matches `platformFetch` on loopback
   * so probes never trigger retry budgets, while routing through configured proxies/gateways. */
  probeFetcher = platformFetch;
  /**
   * Optional session key provider (`<harness>:<sessionId>`) for stateless
   * per-session agent attribution (`X-Isocan-Session`). Populated by
   * `DaemonClient` from the ambient harness session when not overridden by
   * `isBadgeUpstream`, `--as`, or an enrolled `agent:` identity.
   */
  sessionKey;
  /** Configure or suppress the `X-Isocan-Session` header sent on HTTP requests. */
  useSessionKey(provider) {
    this.sessionKey = typeof provider === "function" ? provider : () => provider;
  }
  async sessionHeaders() {
    const raw = await this.sessionKey?.();
    const valid = parseSessionHeader(raw);
    return valid ? { [SESSION_HEADER]: valid } : {};
  }
  /**
   * Every request carries the badge, and a refused one heals itself and comes
   * straight back. This is what makes neither the door nor the membership
   * check a breaking change: a CLI that has never seen a badge, whose home was
   * wiped, or whose person the home has never been told about, recovers in one
   * extra round trip with nobody told anything.
   *
   * Exactly one recovery per request, and never a loop: a 401 goes to the
   * door (which re-claims on the way back), and a `not-your-actor` claims.
   */
  async request(method, url2, body, signal, extra) {
    signal = this.requestSignal(signal);
    signal?.throwIfAborted();
    const isClaimOp = body !== null && typeof body === "object" && body.op?.type === "actor.claim";
    const send = async () => {
      const headers = {
        ...await this.authHeader(),
        ...isClaimOp ? {} : await this.sessionHeaders(),
        [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES,
        ...extra,
        ...this.policyHeaders()
      };
      signal?.throwIfAborted();
      if (body !== void 0) headers["Content-Type"] = "application/json";
      return this.fetcher(`${this.base}${url2}`, {
        method,
        ...signal !== void 0 ? { signal } : {},
        ...Object.keys(headers).length > 0 ? { headers } : {},
        ...body !== void 0 ? { body: JSON.stringify(body) } : {}
      });
    };
    let res = await send();
    let json = await res.json().catch(() => null);
    signal?.throwIfAborted();
    if (res.status === 401 && json?.code === BADGE_ENDED && json?.reason === "operator") {
      throw new ApiError(401, json.error, BADGE_ENDED, "operator");
    }
    const recovered = res.status === 401 ? await this.reBadge(signal) : json?.code === "not-your-actor" && await this.reclaimIdentity();
    if (recovered) {
      signal?.throwIfAborted();
      res = await send();
      json = await res.json().catch(() => null);
    }
    signal?.throwIfAborted();
    if (!res.ok) {
      throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code, json?.reason);
    }
    return json;
  }
  /** `Authorization: Bearer <badgeId>.<secret>`, when we hold one. */
  async authHeader() {
    const badge = await this.storedBadge();
    return badge ? bearerHeader(badge) : {};
  }
  async storedBadge() {
    if (this.badge === void 0) this.badge = await this.badgeStore.read();
    return this.badge;
  }
  /** Go to the door and keep what it hands over. Returns false if the door
   * itself refused, so a caller does not loop.
   *
   * **A definitive door refusal is reported**: a metered door's 429 (phase
   * 13.7) or an operator's network refusal, 403. Printing the original 401 —
   * "a badge is required — ask the door for one" — would advise repeating
   * the act the door just refused. Carry its status, code and words instead;
   * other recovery failures leave the original answer intact. */
  async reBadge(signal = this.lifetime) {
    if (this.badgeStore.upstream) return false;
    signal?.throwIfAborted();
    const answer = await askTheDoor(this.base, 1e4, signal, this.fetcher);
    signal?.throwIfAborted();
    if ("refused" in answer) {
      if (answer.refused.status === 403 || answer.refused.status === 429) {
        throw new ApiError(answer.refused.status, answer.refused.error, answer.refused.code);
      }
      return false;
    }
    const badge = answer.badge;
    this.badge = badge;
    await this.badgeStore.keep(badge);
    signal?.throwIfAborted();
    await this.reclaimIdentity();
    return true;
  }
  /** How to prove who this command speaks as, if the home asks. Registered by
   * `resolveIdentity` the moment that is known. */
  reclaimWith(reclaim) {
    this.reclaim = reclaim;
  }
  /** Claim the identity this command speaks as. False when there is nothing
   * to claim or the home refused, so a caller does not replay into the same
   * refusal twice. The guard is against the claim's OWN request coming back
   * around here. */
  async reclaimIdentity() {
    if (!this.reclaim || this.reclaiming) return false;
    this.reclaiming = true;
    try {
      await this.reclaim();
      return true;
    } catch {
      return false;
    } finally {
      this.reclaiming = false;
    }
  }
  /** The badge this client is presenting, for `whoami` to print. Never the
   * secret. */
  async badgeId() {
    return (await this.storedBadge())?.badgeId ?? null;
  }
  async health(timeoutMs = 300) {
    return await this.healthz(timeoutMs) !== null;
  }
  /**
   * **Wait for a daemon that is coming back, rather than asking once.**
   *
   * `health()` is a single probe, and a single probe is the right question
   * for "is anything there right now". It is the WRONG question after
   * something restarted the daemon, because the honest answer for the next
   * second or two is "not yet" — and a caller that treats that as "no" goes
   * on to skip whatever it was going to do.
   *
   * `isocan setup` did exactly that: it restarted the daemon to point it at a
   * home, asked once with a 2s budget, and on a busy machine got `false` — so
   * it skipped redeeming the pass, wrote no identity, admitted nobody, and
   * exited 0. Found through a flaky test that was a witness rather than a
   * nuisance.
   *
   * Polls to a deadline, the way `ensureDaemon`'s own startup loop does, and
   * deliberately starts nothing: this is for a daemon that already exists and
   * is on its way up, and spawning a second one to race it is how a restart
   * becomes two daemons fighting for a port.
   */
  async awaitHealth(deadlineMs = 1e4) {
    const deadline = Date.now() + deadlineMs;
    for (; ; ) {
      if (await this.health(1e3)) return true;
      if (Date.now() >= deadline) return false;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  /** Probe the health route through `probeFetcher`, returning either the
   * verified `Health` body (`ok: true`) or why the address did not answer as a
   * home (non-2xx status, HTML login redirect / non-JSON body, or timeout). */
  async probeHealth(timeoutMs = 5e3) {
    try {
      this.lifetime?.throwIfAborted();
      const res = await this.probeFetcher(`${this.base}${healthPath(this.base)}`, {
        signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...this.lifetime ? [this.lifetime] : []])
      });
      if (!res.ok) {
        return { ok: false, why: `it answered ${res.status} \u2014 is that address a home?` };
      }
      const body = await res.json().catch(() => null);
      if (body?.ok !== true) {
        return {
          ok: false,
          why: "it answered 200 without a health payload \u2014 is that address behind a login page or not a home?"
        };
      }
      return { ok: true, health: body };
    } catch (err) {
      this.lifetime?.throwIfAborted();
      const why = err.name === "TimeoutError" ? `no answer in ${Math.round(timeoutMs / 1e3)}s` : err.message;
      return { ok: false, why };
    }
  }
  /** The daemon's own account of itself — pid, when it started, and which
   * copy of isocan it is running. Null when nothing answers.
   *
   * The path is a property of `this.base`, not a constant: against 127.0.0.1
   * it is `/healthz` as it has always been, and against a hosted home it is
   * `/api/healthz`, because Google's frontend swallows the bare path and this
   * one call sits under `health()`, `ensureDaemon`'s startup poll and
   * `warnIfStale` — all three of which would otherwise report a live home as
   * dead. See `healthPath`. */
  async healthz(timeoutMs = 300) {
    const res = await this.probeHealth(timeoutMs);
    return res.ok ? res.health : null;
  }
  /** Name (or resume) the actor behind a session key — the one op sent
   * without an actor: the response envelope says who you are. */
  claimActor(op) {
    return this.request("POST", OPERATIONS_ROUTE, { canvasId: null, op });
  }
  /** Who the given session keys speak as (everyone, when omitted). */
  actorBindings(keys2) {
    const query = keys2?.length ? `?keys=${keys2.map(encodeURIComponent).join(",")}` : "";
    return this.request("GET", `/api/actors${query}`);
  }
  /** Claims for these session keys held by a badge that is not this one —
   * what a client whose badge was lost needs in order to be told the truth
   * about why it has no identity. Never adopts; only reports. */
  orphanedActors(keys2) {
    const query = keys2.length ? `?keys=${keys2.map(encodeURIComponent).join(",")}` : "";
    return this.request("GET", `/api/actors/orphaned${query}`);
  }
  /**
   * One op, to this daemon.
   *
   * `home` is **where a canvas being born belongs** and is meaningful for
   * nothing else — the daemon refuses it on any other op rather than ignoring
   * it (`PostOpRequest.home` carries the whole argument). What the CLI puts
   * there is never a flag: it is the directory marker's own assertion, or the
   * birth default when the marker makes none. Phase 7.5 refused a
   * per-invocation `--home` override and that refusal stands — this is the
   * committed configuration of the directory a command is standing in, which
   * is why an agent can say "the canvas I am creating right now is born at X"
   * and can never say "send this command somewhere else".
   */
  sendOp(canvasId, actor, op, clientId, home, group, originGroupMode, spaceId, opId) {
    const origin = originGroupMode ?? (canvasId ? this.observedGroupModes.get(canvasId) : void 0);
    return this.request("POST", OPERATIONS_ROUTE, {
      canvasId,
      actor,
      op,
      ...clientId !== void 0 ? { clientId } : {},
      ...home !== void 0 ? { home } : {},
      ...spaceId !== void 0 ? { spaceId } : {},
      ...opId !== void 0 ? { opId } : {},
      ...group !== void 0 ? { group } : {},
      ...origin !== void 0 ? { originGroupMode: origin } : {}
    });
  }
  /** Refusing questionnaire acts retain their canonical type and caller-owned retry ID. */
  questionnaire(canvasId, actor, op, opId, originGroupMode) {
    const origin = originGroupMode ?? this.observedGroupModes.get(canvasId);
    return this.request("POST", OPERATIONS_ROUTE, { canvasId, actor, op, opId, ...origin === void 0 ? {} : { originGroupMode: origin } });
  }
  /** Writer-resolved eligibility; a missing agent display badge does not imply a human. */
  questionnaireActors(canvasId) {
    return this.request("GET", questionnaireActorsRoute(canvasId));
  }
  /** Only canonical admitted records contribute continuation, budget and lifecycle eligibility. */
  designRequests(canvasId, signal) {
    return this.request("GET", designRequestsRoute(canvasId), void 0, signal);
  }
  /** Canonical comparisons and decision history keep actual authorship separate from currentness. */
  designDecisions(canvasId, signal) {
    return this.request("GET", designDecisionsRoute(canvasId), void 0, signal);
  }
  /** Canonical repair history includes archived acceptances and current continuation standing. */
  designRepairs(canvasId, signal) {
    return this.request("GET", designRepairsRoute(canvasId), void 0, signal);
  }
  /** Stable comparison, non-adopting response and paired adoption intents use the existing writer. */
  designDecision(canvasId, actor, op, opId, signal) {
    const origin = this.observedGroupModes.get(canvasId);
    return this.request("POST", OPERATIONS_ROUTE, { canvasId, actor, op, opId, ...origin === void 0 ? {} : { originGroupMode: origin } }, signal);
  }
  /** Stable public request/receipt intent reaches the ordinary serialized operation writer. */
  designRecord(canvasId, actor, op, opId, originGroupMode) {
    const origin = originGroupMode ?? this.observedGroupModes.get(canvasId);
    return this.request("POST", OPERATIONS_ROUTE, { canvasId, actor, op, opId, ...origin === void 0 ? {} : { originGroupMode: origin } });
  }
  // ---- presence sessions ----
  /** Semantic group request; canonical resolved patches belong to the
   * authoritative writer. Pass a stable opId when retrying one intent. */
  async changeGroup(canvasId, actor, action, opId, originGroupMode) {
    const origin = originGroupMode ?? this.observedGroupModes.get(canvasId);
    const response = await this.request("POST", OPERATIONS_ROUTE, { canvasId, actor, op: { type: "group.change", action }, ...opId ? { opId } : {}, ...origin !== void 0 ? { originGroupMode: origin } : {} });
    const op = response.envelope?.op;
    if (op?.type === "group.change" && op.action.kind === "apply" && op.action.change.migration) this.observedGroupModes.set(canvasId, op.action.change.migration.mode);
    return response;
  }
  /** Authoritative, read-only legacy conversion plan, including the undo boundary. */
  async groupMigrationPreview(canvasId) {
    const preview = await this.request("GET", `/api/projects/${encodeURIComponent(canvasId)}/groups/migration`);
    this.observedGroupModes.set(canvasId, preview.fromMode);
    return preview;
  }
  createSession(canvasId, actor, label, harness, kind) {
    return this.request("POST", `/api/projects/${canvasId}/sessions`, {
      actor,
      ...label !== void 0 ? { label } : {},
      ...harness !== void 0 ? { harness } : {},
      ...kind !== void 0 ? { kind } : {}
    });
  }
  updateSession(canvasId, sessionId, patch) {
    return this.request("PUT", `/api/projects/${canvasId}/sessions/${sessionId}`, patch);
  }
  endSession(canvasId, sessionId) {
    return this.request("DELETE", `/api/projects/${canvasId}/sessions/${sessionId}`);
  }
  listSessions(canvasId) {
    return this.request("GET", `/api/projects/${canvasId}/sessions`);
  }
  /** End every session an actor holds — the daemon-side truth, for when the
   * local session pointer has been lost. */
  endActorSessions(actorId, kind) {
    const query = kind ? `?kind=${kind}` : "";
    return this.request("DELETE", `/api/presence/actors/${actorId}${query}`);
  }
  /** Authoritative inbox entries and seen marks across the canvases held here. */
  inbox(actorId, options = {}) {
    return this.request("GET", inboxRoute(actorId, options));
  }
  listCanvases() {
    return this.request("GET", "/api/projects");
  }
  // ---- what you have already seen (#147, #134) ----
  //
  // Desk state at the home, so this asks the daemon rather than keeping a
  // local record: the point of the feature is that your other machine finds
  // what this one saw. `docs/research/2026-09-12-seen-marks.md`.
  /** Your own marks, or one canvas's prior mark at its authoritative home.
   *  There is deliberately no way to ask for anybody else's. */
  seen(actorId, canvasId) {
    return this.request("GET", seenMarksRoute(actorId, canvasId));
  }
  /** Move the mark for one canvas to the head you had in front of you. The
   *  answer may be AHEAD of what you sent: another machine of yours may have
   *  got further, and the merge never goes backwards. */
  markSeen(canvasId, seq, actorId) {
    return this.request("PUT", seenRoute(canvasId), {
      seq,
      ...actorId ? { actorId } : {}
    });
  }
  // ---- who may enter a canvas: `isocan share`'s three calls ----
  //
  // The same three routes the Share dialog drives, built from the same core
  // helpers — house rule 2's "button and verb, one endpoint", taken literally
  // enough that neither surface spells a URL. On a replica the daemon forwards
  // all three to the home, because the row that decides who may enter lives
  // there; nothing here has to know that.
  /** Classify before automatic previews or target resolution; unknown remains redacted. */
  classifySource(request, signal) {
    return this.request("GET", sourceClassificationRoute(request), void 0, signal);
  }
  /** Check an explicit tool source without borrowing a stored badge admission. */
  sourceAccess(request, signal) {
    return this.request("POST", SOURCE_ACCESS_ROUTE, request, signal);
  }
  /** Inspect the selected person's binding without creating a canvas. */
  personalStatus(actorId, signal, destinationCanvasId) {
    return this.request("GET", personalRoute(actorId, destinationCanvasId), void 0, signal);
  }
  /** Lazily reserve and create the person's private source at this home. */
  ensurePersonal(actorId, signal, destinationCanvasId) {
    return this.request("POST", `${personalRoute()}/ensure`, { actorId, ...destinationCanvasId ? { destinationCanvasId } : {} }, signal);
  }
  /** Visible personal cards and this caller's current availability, without source bytes. */
  personalLinks(canvasId, actorId, signal) {
    return this.request("GET", personalCanvasRoute(canvasId, void 0, actorId), void 0, signal);
  }
  /** One concrete consent and one undoable native operation per new link. */
  linkPersonal(canvasId, request, signal) {
    return this.request("POST", personalCanvasRoute(canvasId, "link"), request, signal);
  }
  /** Delete the concrete card while retaining its identity-bound consent for undo. */
  unlinkPersonal(canvasId, request, signal) {
    return this.request("POST", personalCanvasRoute(canvasId, "unlink"), request, signal);
  }
  /** The selected owner's source-specific agent access controls. */
  personalDelegates(sourceCanvasId, actorId, signal) {
    return this.request("GET", personalDelegatesRoute(sourceCanvasId, void 0, actorId), void 0, signal);
  }
  /** Explicitly allow or revoke one agent on this exact dataset. */
  setPersonalDelegate(sourceCanvasId, agentId, request, signal) {
    return this.request("PUT", personalDelegatesRoute(sourceCanvasId, agentId), request, signal);
  }
  /** Authoritative owner/delegate reading, with a blob-free summary mode. */
  readPersonal(canvasId, request, signal) {
    return this.request("POST", personalCanvasRoute(canvasId, "read"), request, signal);
  }
  /** The connected home's catalogue, without canvas admission or identity claims. */
  publicCanvases() {
    return this.request("GET", PUBLIC_CANVASES_ROUTE);
  }
  /** Publish or unlist the concrete link an owner inspected. */
  setPublicListing(canvasId, grantId, listed, actorId) {
    return this.request("PUT", publicListingRoute(canvasId, grantId), {
      listed,
      ...actorId ? { actorId } : {}
    });
  }
  grants(canvasId) {
    return this.request("GET", grantsRoute(canvasId));
  }
  /** Provision or re-read a panel extension's actor, badge, and standing grant on `canvasId`. */
  panelActor(canvasId, itemId) {
    return this.request("POST", panelActorRoute(canvasId, itemId), {});
  }
  createGrant(canvasId, subject, capability, actorId) {
    return this.request("POST", grantsRoute(canvasId), {
      subject,
      // Sent whenever it is not edit (`narrowed`), so an older home never
      // meets the field for the one value it has always meant by omission.
      ...narrowed(capability) ? { capability } : {},
      ...actorId ? { actorId } : {}
    });
  }
  /**
   * Keep somebody out (roles phase 3): a bar, written directly. The same
   * POST as an invitation with `bars: true` and no rung; the home replaces
   * any live row naming them and sweeps, so a person inside on the link is
   * put out by the write.
   */
  bar(canvasId, subject, actorId) {
    return this.request("POST", grantsRoute(canvasId), {
      subject,
      bars: true,
      ...actorId ? { actorId } : {}
    });
  }
  /** No body, deliberately: a DELETE that declares `application/json` and
   * sends nothing is a Fastify parse error, and a request with nothing to say
   * should not announce a content type. `bar` is `?bar=1` — revoke and keep
   * them out in one request (roles phase 3); the route's spelling is core's. */
  revokeGrant(canvasId, grantId, actorId, bar) {
    return this.request(
      "DELETE",
      grantRevokeRoute(canvasId, grantId, { ...actorId ? { actorId } : {}, ...bar ? { bar } : {} })
    );
  }
  // ---- the space: a named set of canvases access is set on once (roles phase 4) ----
  //
  // The same routes the canvas list's headings and the space's Share dialog
  // drive, built from core's spellings. All at the home; on a replica the
  // daemon forwards through its one home and refuses on a mixed rig.
  spaces() {
    return this.request("GET", SPACES_ROUTE);
  }
  createSpace(name, actorId) {
    return this.request("POST", SPACES_ROUTE, { name, ...actorId ? { actorId } : {} });
  }
  /** No body, for `revokeGrant`'s reason; the actor rides the query. */
  deleteSpace(spaceId, actorId) {
    return this.request("DELETE", spaceActingRoute(spaceRoute(spaceId), actorId));
  }
  addToSpace(spaceId, canvasId, actorId) {
    return this.request("PUT", spaceCanvasRoute(spaceId, canvasId), actorId ? { actorId } : {});
  }
  removeFromSpace(spaceId, canvasId, actorId) {
    return this.request("DELETE", spaceActingRoute(spaceCanvasRoute(spaceId, canvasId), actorId));
  }
  spaceGrants(spaceId) {
    return this.request("GET", spaceGrantsRoute(spaceId));
  }
  createSpaceGrant(spaceId, subject, capability, actorId) {
    return this.request("POST", spaceGrantsRoute(spaceId), {
      subject,
      ...narrowed(capability) ? { capability } : {},
      ...actorId ? { actorId } : {}
    });
  }
  barOnSpace(spaceId, subject, actorId) {
    return this.request("POST", spaceGrantsRoute(spaceId), {
      subject,
      bars: true,
      ...actorId ? { actorId } : {}
    });
  }
  revokeSpaceGrant(spaceId, grantId, actorId, bar) {
    return this.request(
      "DELETE",
      spaceGrantRevokeRoute(spaceId, grantId, { ...actorId ? { actorId } : {}, ...bar ? { bar } : {} })
    );
  }
  /** **Every canvas in this space**: the link on each canvas set to a rung,
   * or turned off, in one request; the answer says how many it reached. */
  setSpaceLink(spaceId, capability, actorId) {
    return this.request("POST", spaceLinkRoute(spaceId), {
      capability,
      ...actorId ? { actorId } : {}
    });
  }
  // ---- the group: a named set of people access is given to once (roles phase 5) ----
  //
  // `isocan group` and `isocan share group:<name>` drive these; the Groups
  // panel on the canvas list and the Share dialog's picker drive the same
  // routes. All at the home.
  /** The groups this badge's actors made, members and all. */
  groups() {
    return this.request("GET", GROUPS_ROUTE);
  }
  createGroup(name, actorId) {
    return this.request("POST", GROUPS_ROUTE, { name, ...actorId ? { actorId } : {} });
  }
  /** One group: members for its maker; name and size for anybody a live
   * row naming it lets see it. */
  group(groupId) {
    return this.request("GET", groupRoute(groupId));
  }
  addGroupMember(groupId, attribute, actorId) {
    return this.request("PUT", groupMemberRoute(groupId, attribute), actorId ? { actorId } : {});
  }
  /** No body; the actor rides the query. */
  removeGroupMember(groupId, attribute, actorId) {
    return this.request("DELETE", groupActingRoute(groupMemberRoute(groupId, attribute), actorId));
  }
  deleteGroup(groupId, actorId) {
    return this.request("DELETE", groupActingRoute(groupRoute(groupId), actorId));
  }
  // ---- your own surfaces: kill-a-badge (phase 9) ----
  //
  // Not canvas-scoped, unlike the grant routes above, because a badge is not
  // about one canvas: ending one ends that holder's recognition everywhere at
  // once. On a replica the daemon forwards both to the home, which is where
  // the badge that matters lives — see `HomeConnection.badges`.
  badges() {
    return this.request("GET", BADGES_ROUTE);
  }
  /** No body, for `revokeGrant`'s reason. */
  killBadge(badgeId) {
    return this.request("DELETE", badgeRoute(badgeId));
  }
  // ---- passes: the escalation credential (Scene 5) ----
  //
  // Two routes, deliberately different shapes, and the CLI does not get to
  // decide which: `passesRoute` is canvas-scoped so the door has already
  // asked whether this badge may mint for this canvas, and `PASS_REDEEM_ROUTE`
  // is flat because the redeemer is BY DEFINITION not admitted yet. Both
  // spellings come from `@isocan/core`, like the grant routes above and for
  // the same reason — stage 3's dialog drives the identical pair.
  //
  // On a replica both forward to the home. That is not an optimization: a pass
  // is desk state, single-use is only single across the desk that holds the
  // row, and the badge a redeemed pass endows has to be the one the HOME will
  // see presented. Nothing here has to know that, which is the point.
  /** Mint one for this canvas. `actorId` endows the claim; omitting it mints
   * the admission-only shape. The token comes back exactly once. */
  mintPass(canvasId, actorId) {
    return this.request("POST", passesRoute(canvasId), actorId ? { actorId } : {});
  }
  /** One pass this badge minted, read back without its secret: whether it
   * was spent, and by which badge (`redeemedBy`). `unknown-pass` for any
   * pass this badge did not mint. */
  pass(canvasId, passId) {
    return this.request("GET", passRoute(canvasId, passId));
  }
  /**
   * Redeem one: this daemon's badge comes away admitted at the home and, when
   * the pass named a claim, holding it.
   *
   * **The answer is the only announcement there will ever be.** The handoff
   * row carries no session key by design, and `GET /api/actors` is keyed by
   * session key — so a caller that throws this response away cannot ask for
   * it again, and the identity the pass endowed becomes unreachable from this
   * machine even though the badge still holds it. Replica setup opts into
   * local adoption so the daemon saves it alongside its badge writes. Direct
   * setup leaves the remote machine alone and saves it in the CLI process.
   */
  redeemPass(token, home, adoptIdentity = false) {
    const elsewhere = home !== void 0 && normalizeHomeUrl(home) !== normalizeHomeUrl(this.base);
    return this.request("POST", PASS_REDEEM_ROUTE, {
      token,
      ...adoptIdentity ? { adoptIdentity: true } : {},
      ...elsewhere ? { home: normalizeHomeUrl(home) } : {}
    });
  }
  /**
   * Ask this daemon to fetch one canvas from its home — the arrival that
   * carries an ADDRESS and no admission (a cloned marker, a pass-less
   * `setup`). `HOME_JOIN_ROUTE` in core carries the reasoning.
   *
   * Refuses `not-a-replica` (409) on a home, which is a fine answer to get:
   * callers that ask speculatively — binding resolution does — carry on and
   * report whatever they were going to report anyway.
   *
   * **`home` is the address the MARKER names**, and passing it is what makes
   * phase 10.3's good case work: a repo cloned onto a machine that has never
   * dialled the home its `.isocan/project.json` names. That used to be refused
   * outright, because joining meant repointing the whole machine; now the
   * daemon opens a link to that address, is tested at its door, and writes the
   * row — and nothing else on this machine moves. Omitting it falls back to
   * the birth default, which is what a marker naming no home deserves.
   */
  async joinFromHome(canvasId, home) {
    const { canvas } = await this.request("POST", HOME_JOIN_ROUTE, {
      canvasId,
      ...home !== void 0 ? { home } : {}
    });
    return canvas;
  }
  /** Drop this machine's copy of a canvas its home no longer has
   *  (`HOME_FORGET_ROUTE` in core says when the daemon refuses). */
  forgetCanvas(canvasId) {
    return this.request("POST", HOME_FORGET_ROUTE, { canvasId });
  }
  /**
   * **Which canvas lives where, and which homes are answering.**
   *
   * The one read behind every per-canvas home question (`HOMES_ROUTE` in core
   * has the list). It replaces the health route's `home` field for everything
   * except "where would the next canvas be born", which is the only thing that
   * field still means.
   */
  homes() {
    return this.request("GET", HOMES_ROUTE);
  }
  /**
   * **Semantic Zoom's cached summaries, by content key** (an experiment;
   * `docs/projects/semantic-zoom/design.md` §5). `sourceIds`, in the keys'
   * order, lets the home answer a key it has no entry for with the newest
   * entry for that source, marked `stale`. A read never makes one.
   *
   * The path is spelled here rather than imported from core's
   * `summariesRoute`, on purpose and measured: any runtime import of
   * `@isocan/core/semantic-zoom` from this file, static or lazy, re-cuts the
   * CLI bundle's chunks and costs `isocan --version` a module past its budget
   * (`test/cli-bundle.test.ts`; 40 → 41, 14 Oct 2026). The CLI's summary
   * tests read and make through these two methods against a real home, so a
   * drift from core's spelling fails there.
   */
  summaries(canvasId, keys2, sourceIds) {
    const query = `keys=${keys2.join(",")}&for=${sourceIds.map(encodeURIComponent).join(",")}`;
    return this.request("GET", `${summariesPath(canvasId)}?${query}`);
  }
  /**
   * **Ask the home to make one summary** — the route the web's fetcher asks,
   * under the same rules (edit capability, the key's own spend rules, rate,
   * the quiet period). The home collects the words; the client names only the
   * kind and the source. A 202 is `summary-quiet`, carrying `retryAfterMs`.
   */
  makeSummary(canvasId, make) {
    return this.request("POST", summariesPath(canvasId), make);
  }
  /**
   * **What a canvas's summaries have cost** (`GET …/summaries/stats`, phase
   * 3): calls, tokens, makes and hits per day, the hour's budget, the cache.
   * Editors only — it says what somebody's key spent. `days` defaults to 30
   * at the home, at most 90.
   */
  summaryStats(canvasId, days) {
    return this.request("GET", `${summariesPath(canvasId)}/stats${days ? `?days=${days}` : ""}`);
  }
  /** Complete current scope; omitted roots read ambient pins. Reads never move presence. */
  contextManifest(canvasId, request) {
    const query = new URLSearchParams();
    if (request) {
      query.set("roots", request.rootIds.join(","));
      if (request.includeExcluded !== void 0) query.set("includeExcluded", String(request.includeExcluded));
      if (request.expectedRevision !== void 0) query.set("expectedRevision", String(request.expectedRevision));
    }
    return this.request("GET", `${canvasContextRoute(canvasId)}${query.size ? `?${query}` : ""}`);
  }
  /** Frozen provenance belongs to the saved comment, not today's membership. */
  commentContext(canvasId, threadId, commentId) {
    return this.request("GET", commentContextRoute(canvasId, threadId, commentId));
  }
  contextContentPage(canvasId, options) {
    if (!!options.threadId !== !!options.commentId) throw new Error("a saved context requires both thread and comment IDs");
    if (options.threadId && (options.rootIds !== void 0 || options.includeExcluded !== void 0 || options.expectedRevision !== void 0)) throw new Error("saved context already fixes its roots, exclusion policy and revision");
    if (!options.threadId && options.expectedRevision === void 0) throw new Error("live context paging requires expectedRevision from its manifest");
    const query = new URLSearchParams();
    if (options.rootIds !== void 0) query.set("roots", options.rootIds.join(","));
    for (const field of ["offset", "limit", "face", "includeExcluded", "expectedRevision"]) {
      if (options[field] !== void 0) query.set(field, String(options[field]));
    }
    const route = options.threadId ? commentContextRoute(canvasId, options.threadId, options.commentId) : canvasContextRoute(canvasId);
    return this.request("GET", `${route}/content${query.size ? `?${query}` : ""}`);
  }
  /** A bounded ordinary-source history head; the authority refuses personal sources before reads. */
  recapHead(canvasId, signal) {
    return this.request("GET", recapHeadRoute(canvasId), void 0, signal);
  }
  async snapshot(canvasId, signal) {
    const snapshot = await this.request("GET", `/api/projects/${canvasId}/canvas`, void 0, signal);
    this.observedGroupModes.set(canvasId, snapshot.project.groupMode ?? "legacy");
    return snapshot;
  }
  /** How this home serves — today, only whether a content origin exists. */
  serving() {
    return this.request("GET", SERVING_ROUTE);
  }
  /** The name each actor goes by now. A snapshot already carries this; it is
   * fetched on its own for commands that print names without one. */
  actorNames() {
    return this.request("GET", "/api/names");
  }
  /** Who is an agent — actor id → "agent" for every actor whose last claim
   * came from a harness that is not a person's; people absent. A daemon from
   * before the route answers its SPA fallback, which parses to nothing. */
  actorKinds() {
    return this.request("GET", ACTOR_KINDS_ROUTE);
  }
  /** Who is on which canvas right now, across every room this daemon can see
   * and the caller may enter — see `PRESENCE_WHERE_ROUTE`. */
  presenceWhere() {
    return this.request("GET", PRESENCE_WHERE_ROUTE);
  }
  /** What changed, for the person using this — release notes from the home
   *  this CLI is talking to, so what it lists is what that home is running. */
  news() {
    return this.request("GET", NEWS_ROUTE);
  }
  /**
   * **Ask the home's judge** (`JUDGMENT_ROUTE`) — a question file in the
   * judge's request shape, answered with the home's key, in the judge's answer
   * shape. Refused with `judgment-unavailable` when the home holds no key.
   */
  judgment(request) {
    return this.request("POST", JUDGMENT_ROUTE, request);
  }
  /**
   * **Draw a mood-board spread** (`POST /api/image`, moodboard phase 0): the
   * home wraps the words in its template, spends its Gemini key, and adds the
   * tiles as `actor`; the answer names them. Refusals arrive as the home's
   * codes (`image-refused`, `image-owner-only`, `image-unavailable`, …).
   */
  image(request) {
    return this.request("POST", imagePath, request);
  }
  /**
   * **Read dominant colour swatches from an image item** (`POST /api/image/swatches`,
   * moodboard phase 2): uses `sharp` when the home has it, or falls back to a
   * picture-capable text model (`estimated: true`).
   */
  imageSwatches(request) {
    return this.request("POST", swatchesPath, request);
  }
  /** Every slash command available here: built-ins under this home's own. */
  commands() {
    return this.request("GET", `/api/commands`);
  }
  /** Write one for this home. `text` is the file, frontmatter and all. */
  saveCommand(name, text2) {
    return this.request("PUT", `/api/commands/${encodeURIComponent(name)}`, { text: text2 });
  }
  /** Remove one of this home's; the built-in of that name comes back. */
  deleteCommand(name) {
    return this.request("DELETE", `/api/commands/${encodeURIComponent(name)}`);
  }
  /** With waitMs, the daemon long-polls: holds until an entry lands past
   * `since` or the window closes (empty array). */
  /** The bound directory's listing — owner-scoped, answered only by the
   * canvas's own local daemon (`tree.ts` has the rules). */
  getTree(canvasId) {
    return this.request("GET", `/api/projects/${canvasId}/tree`);
  }
  /** Write an item's current version out to the directory bound here — the
   * other direction from `＋` (`docs/projects/workbench/files-on-disk.md`). */
  writeItem(canvasId, itemId, force = false) {
    return this.request("POST", `/api/projects/${canvasId}/write`, { itemId, force });
  }
  /** What this machine's disk says about the canvas's tracked items. */
  getBacking(canvasId) {
    return this.request("GET", `/api/projects/${canvasId}/backing`);
  }
  getLog(canvasId, since, waitMs) {
    const wait = waitMs !== void 0 ? `&waitMs=${waitMs}` : "";
    return this.request("GET", `/api/projects/${canvasId}/oplog?since=${since}${wait}`);
  }
  /** What `gc` compacted out of the live log, oldest first — empty until a
   * compaction has happened. `getLog` + this is the complete history. */
  getArchivedLog(canvasId) {
    return this.request("GET", `/api/projects/${canvasId}/oplog/archive`);
  }
  /** Every canvas at once. Omit `cursors` to seed at "now"; otherwise the
   * daemon long-polls until an op lands on any canvas. `signal` aborts a held
   * poll — what lets `tail()` stop listening mid-window instead of after it. */
  watchLog(request, signal) {
    return this.request("POST", "/api/oplog/watch", request, signal);
  }
  // ---- the durable park cursor (on-demand phase 1) ----
  /** Adopt (or create) this actor's cursor row on a canvas. The returned
   * `parkId` is the lease every delivery and advance must carry. */
  parkClaim(request) {
    return this.request("POST", "/api/park/claim", request);
  }
  /** A wake handed entries out — record the high-water. Refused with
   * `PARK_ADOPTED_CODE` when another park has adopted the row. */
  parkDelivered(request) {
    return this.request("POST", "/api/park/delivered", request);
  }
  /** A lap matched nothing — settle the noise without a turn. Same refusal. */
  parkAdvance(request) {
    return this.request("POST", "/api/park/advance", request);
  }
  /** The rc's connection-bound liveness (phase 6): held open for `waitMs`,
   * during which these agents read as answerable. Re-issue back-to-back;
   * the fact dies with the socket, which is the whole point. The response
   * carries any web asks that arrived while held (agent-custody) — the rc
   * enrolls each and keeps holding. */
  rcHold(request, signal) {
    return this.request("POST", "/api/rc/hold", request, signal);
  }
  /** Explicit release when an rc stops (issue #308), beside socket close:
   * on a hosted home an aborted fetch's close can take seconds to cross
   * Cloud Run's front end, so `stop()` releases the hold at once before
   * aborting its long polls. */
  rcRelease(request) {
    return this.request("POST", "/api/rc/release", request);
  }
  /** Who a live rc answers for on this canvas — and whether any is parked at
   * all — as the canvas's home has it: a daemon that is not the home asks the
   * home and folds in its own holds (issue #306). */
  rcAnswering(canvasId) {
    return this.request("GET", rcAnsweringRoute(canvasId));
  }
  undo(canvasId, actor) {
    return this.request("POST", `/api/projects/${canvasId}/undo`, { actor });
  }
  redo(canvasId, actor) {
    return this.request("POST", `/api/projects/${canvasId}/redo`, { actor });
  }
  /** Ask whether the home holds every blob this canvas names, and optionally
   *  send the ones it does not. */
  reconcileBlobs(canvasId, push) {
    return this.request("POST", `/api/projects/${canvasId}/blobs/reconcile`, { push });
  }
  /** Send a canvas to another home, or ask what that would move. */
  teleport(canvasId, to, dryRun) {
    return this.request("POST", `/api/projects/${canvasId}/teleport`, { to, dryRun });
  }
  /** Hand a home a whole canvas as somebody else's log — teleport's far end,
   *  and what `isocan import` restores a backup through. Creates, never
   *  merges: a canvas already at the home is refused. */
  adopt(canvasId, entries) {
    return this.request("POST", `/api/projects/${canvasId}/adopt`, { entries });
  }
  gc(canvasId, request) {
    return this.request("POST", `/api/projects/${canvasId}/gc`, request);
  }
  /** Every canvas this badge is admitted to at this home, in one sweep — the
   * same per-canvas policy, aggregated (phase 13.7). Names no canvas, so it
   * works in a directory that is bound to none. */
  gcHome(request) {
    return this.request("POST", HOME_GC_ROUTE, request);
  }
  // ---- the operator (docs/projects/operator/design.md, phase 1) ----
  //
  // **Two reads, and each one presents a proof that was made a moment ago in a
  // browser.** They are here, on the typed route surface, rather than in the
  // CLI's own `fetch`, for this class's whole reason: everything a surface can
  // ask a daemon is one method with one shape, and a second spelling of the
  // proof header is a second place for it to drift from the server's.
  //
  // Nothing here holds the token. It is a parameter, used for one request and
  // dropped with the stack frame — decision D2's "the CLI holds the token in
  // memory for one invocation", expressed as the absence of a field.
  /** What this home holds under that id (journey 1 step 4). Changes nothing. */
  async operatorShow(canvasId, proof) {
    return this.request(
      "GET",
      `/api/operator/canvases/${encodeURIComponent(canvasId)}`,
      void 0,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /** The ledger, newest first — the operator reads it and nobody else does. */
  async operatorLog(proof, options = {}) {
    const query = new URLSearchParams();
    if (options.target) query.set("target", options.target);
    if (options.limit !== void 0) query.set("limit", String(options.limit));
    const suffix = query.toString();
    return this.request(
      "GET",
      `${OPERATOR_LOG_ROUTE}${suffix ? `?${suffix}` : ""}`,
      void 0,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  // ---- operator phase 2: the look and the takedown ----
  //
  // The first operator methods that CHANGE anything, so they are POSTs, and
  // they carry the proof in exactly the header the two reads above carry it
  // in. Nothing here holds the token: a parameter, one request, dropped with
  // the stack frame (decision D2).
  /** Mint the look — a pass this home redeems into the operator's browser as
   * an admission at `view` until `until`. The address to open is built by
   * `operatorLookUrl` in core, from the home the caller proved at. */
  async operatorLook(canvasId, proof, request) {
    return this.request(
      "POST",
      `/api/operator/canvases/${encodeURIComponent(canvasId)}/look`,
      request,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /** Take it down, or lift it. One method and one route for both, because
   * they are one act with a direction: the reach, the row and the refusals are
   * the same shape either way, and a second verb would be a second place for
   * the ledger's `act` to be spelled. */
  async operatorTakedown(canvasId, proof, request) {
    return this.request(
      "POST",
      `/api/operator/canvases/${encodeURIComponent(canvasId)}/takedown`,
      request,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /**
   * **End a surface** (operator phase 4) — by badge id, actor id or
   * `email:` address, which is the id a report names. Sent twice by the verb:
   * once with `preview` to read the reach, once to act on it. Same header,
   * same proof, same shape as the takedown.
   */
  async operatorEnd(target, proof, request) {
    return this.request(
      "POST",
      `/api/operator/end/${encodeURIComponent(target)}`,
      request,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /**
   * **Turn off a grant** (operator phase 5) — on a canvas or a space, by the
   * subject a report names, with `bar` to keep them out as the owner's
   * `?bar=1` does. Same header, same proof, same shape as the takedown.
   */
  async operatorRevoke(target, proof, request) {
    return this.request(
      "POST",
      `/api/operator/revoke/${encodeURIComponent(target)}`,
      request,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /**
   * **Refuse at the door** (operator phase 6) — a subject a report names:
   * `email:…`, `repo:…`, `actor:…` or `net:<cidr>`, with `for` to expire it
   * and `lift` to end it early. Same header, same proof, same shape as the
   * takedown. The subject rides in the path, URL-encoded, because a `net:`
   * carries a slash.
   */
  async operatorRefuse(subject, proof, request) {
    return this.request(
      "POST",
      `/api/operator/refuse/${encodeURIComponent(subject)}`,
      request,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /**
   * **Erase the bytes** (operator phase 3) — the one operator act that cannot
   * be lifted, and the one whose body is a single word. The route refuses
   * without `force`, and refuses on a canvas that is not taken down whatever
   * `force` says. Same header, same proof, same shape as the takedown.
   */
  async operatorPurge(canvasId, proof, request) {
    return this.request(
      "POST",
      `/api/operator/canvases/${encodeURIComponent(canvasId)}/purge`,
      request,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /**
   * **The sentence, for the people it happened to** — not an operator read.
   *
   * With a canvas id: that one, answered to anybody, because the door already
   * says it in its refusal. Without: the ones in force among the canvases this
   * badge may see, which is what a canvas list draws beside its rows.
   */
  async takedowns(canvasId) {
    const suffix = canvasId ? `?${TAKEDOWNS_CANVAS_PARAM}=${encodeURIComponent(canvasId)}` : "";
    return this.request("GET", `${TAKEDOWNS_ROUTE}${suffix}`);
  }
  async uploadBlob(canvasId, data, mimeType, filename, signal) {
    signal = this.requestSignal(signal);
    signal?.throwIfAborted();
    const send = async () => {
      const [auth, session] = await Promise.all([this.authHeader(), this.sessionHeaders()]);
      signal?.throwIfAborted();
      return this.fetcher(`${this.base}/api/projects/${canvasId}/blobs`, {
        method: "POST",
        headers: {
          ...auth,
          ...session,
          ...this.policyHeaders(),
          "Content-Type": mimeType,
          [FILENAME_HEADER]: encodeFilename(filename)
        },
        body: new Uint8Array(data),
        ...signal ? { signal } : {}
      });
    };
    let res = await send();
    if (res.status === 401 && await this.reBadge(signal)) res = await send();
    const json = await res.json().catch(() => null);
    signal?.throwIfAborted();
    if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    return json;
  }
  async downloadBlob(canvasId, blobHash, signal) {
    signal = this.requestSignal(signal);
    signal?.throwIfAborted();
    const send = async () => {
      const headers = { ...await this.authHeader(), ...await this.sessionHeaders(), ...this.policyHeaders() };
      signal?.throwIfAborted();
      return this.fetcher(`${this.base}/api/projects/${canvasId}/blobs/${blobHash}`, {
        headers,
        ...signal ? { signal } : {}
      });
    };
    let res = await send();
    if (res.status === 401 && await this.reBadge(signal)) res = await send();
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new ApiError(res.status, json?.error ?? `blob not found: ${blobHash}`, json?.code, json?.reason);
    }
    return new Uint8Array(await res.arrayBuffer());
  }
};

// packages/rc/src/index.ts
init_src();

// packages/rc/src/guards.ts
function gateTurn(state, hasPersonWord, limits, now) {
  if (!hasPersonWord && state.agentChain >= limits.agentChain) {
    const announce = state.held !== "cycle";
    state.held = "cycle";
    return { verdict: "hold-cycle", announce };
  }
  const hourAgo = now - 36e5;
  state.turnTimes = state.turnTimes.filter((t) => t > hourAgo);
  if (state.turnTimes.length >= limits.turnsPerHour) {
    const freesAt = state.turnTimes[0] + 36e5;
    const announce = state.held !== "ceiling";
    state.held = "ceiling";
    return {
      verdict: "hold-ceiling",
      announce,
      freesAt,
      retryAfter: Math.min(freesAt, now + 6e4)
    };
  }
  state.held = null;
  state.turnTimes.push(now);
  state.agentChain = hasPersonWord ? 0 : state.agentChain + 1;
  return { verdict: "dispatch" };
}

// packages/rc/src/helpers.ts
init_src();
function itemCenter(item) {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
}
function threadLocus(snapshot, thread) {
  const anchor = thread.anchorItemId ? snapshot.canvas.items[thread.anchorItemId] : void 0;
  return anchor ? { x: anchor.x + thread.x, y: anchor.y + thread.y } : { x: thread.x, y: thread.y };
}
function actorNamesOn(snapshot) {
  const names = new Map(Object.entries(snapshot.names ?? {}));
  for (const actor of collectCanvasActors(snapshot.canvas)) {
    if (!names.has(actor.id)) names.set(actor.id, actorNameIn(snapshot.names, actor));
  }
  return names;
}
function nameResolver(snapshot) {
  const names = actorNamesOn(snapshot);
  return (actorId) => names.get(actorId);
}
var summonsPrompt = (canvasTitle, agentName, payload, context) => {
  const standing = context?.wokenBy ? `You were woken by ${context.wokenBy.asker}, who is not your owner. ${context.wokenBy.owner}'s machine is running this turn and paying for it, and ${context.wokenBy.asker}'s grant covers replying on this thread. ` : "";
  const fullPayload = {
    ...payload,
    ...context?.item ? { item: context.item } : {},
    ...context?.thread ? { thread: context.thread } : {},
    ...context?.stuck ? { stuck: context.stuck } : {}
  };
  const stuck = context?.stuck ? `The payload's \`stuck\` says your last tries at "${context.stuck.title}" all missed: do NOT make another take. Say you have been guessing and ask instead \u2014 \`isocan stuck ${context.stuck.itemId} --question \u2026\` (\`isocan --agent-help proactive\`, "Stuck"). ` : "";
  return `You are ${agentName}, an agent enrolled on the isocan canvas "${canvasTitle}". This is a summons: activity addressed to you arrived while nothing was running for you. ` + standing + `Work from this directory through the \`isocan\` CLI \u2014 \`isocan --agent-help\` is the full protocol if you need orientation, and \`isocan comment reply <threadId> "\u2026"\` answers a comment. For a designed screen, HTML node or connected app, run \`isocan design workflow\` for the shared procedure, canvas policy and existing work; precise edits and archive imports do not start a new interview. ` + stuck + `Address what the payload below carries, reply on its thread, and then simply finish your turn: do NOT run \`isocan wait\` \u2014 your session rests when you stop, and new activity summons you again.

The payload (the same shape \`isocan wait --json\` returns):
` + JSON.stringify(fullPayload, null, 2);
};
function clipStatus(text2, max = 64) {
  const clean = text2.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const word = cut.lastIndexOf(" ");
  return `${(word >= max * 0.6 ? cut.slice(0, word) : cut).trimEnd()}\u2026`;
}
function formatThoughtStatus(buffer) {
  const tail = buffer.slice(-500);
  const stripped = tail.replace(/```[\s\S]*?```/g, " ").replace(/[`*_~]/g, "").replace(/^\s*#+\s*/gm, "").replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "");
  const parts = stripped.split(/\n+|(?<=[.!?])\s+/).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line.length >= 12 && line.split(" ").length >= 3);
  const chosen = parts.at(-1);
  if (!chosen) return null;
  const bare = chosen.replace(/[.!?:;,]+$/, "").trim();
  if (!bare) return null;
  return `\u{1F4AD} ${clipStatus(bare, 64)}${bare.endsWith("\u2026") ? "" : "\u2026"}`;
}
function humanizeToolStatus(rawTitle, canvasItems) {
  const raw = rawTitle.replace(/\s+/g, " ").trim();
  if (!raw) return null;
  let itemId;
  let item;
  if (canvasItems) {
    for (const match of raw.matchAll(/\bitm_[a-zA-Z0-9_-]+\b/g)) {
      const candidate = match[0];
      if (canvasItems[candidate]) {
        itemId = candidate;
        item = canvasItems[candidate];
        break;
      }
    }
  }
  const itemLabel = item ? clipStatus(item.title || item.id, 28) : null;
  if (/(?:SKILL\.md|--agent-help|agent-guide\.md)/i.test(raw)) {
    return { status: "checking canvas guide\u2026", ...itemId ? { itemId } : {} };
  }
  const cliMatch = raw.match(/\bisocan\s+(?:--[a-z-]+\s+)*([a-z-]+)/i);
  if (cliMatch) {
    const verb = cliMatch[1].toLowerCase();
    if (verb === "show" || verb === "get" || verb === "words") {
      return {
        status: itemLabel ? `looking at "${itemLabel}"\u2026` : "reading canvas item\u2026",
        ...itemId ? { itemId } : {}
      };
    }
    if (verb === "edit" || verb === "set" || verb === "mv" || verb === "resize" || verb === "face") {
      return {
        status: itemLabel ? `updating "${itemLabel}"\u2026` : "updating canvas item\u2026",
        ...itemId ? { itemId } : {}
      };
    }
    if (verb === "add" || verb === "new" || verb === "text" || verb === "draw") {
      return { status: "adding to the canvas\u2026", ...itemId ? { itemId } : {} };
    }
    if (verb === "comment") {
      return { status: "writing a reply\u2026", ...itemId ? { itemId } : {} };
    }
    if (verb === "ls" || verb === "list" || verb === "status" || verb === "summary") {
      return { status: "surveying the canvas\u2026", ...itemId ? { itemId } : {} };
    }
  }
  const fileRead = raw.match(/^(?:File|Read|View|Cat)\s+(.+)$/i);
  if (fileRead) {
    const base2 = fileRead[1].trim().replace(/['"]/g, "").split(/[\\/]/).pop() ?? fileRead[1].trim();
    return { status: `reading ${clipStatus(base2, 36)}\u2026`, ...itemId ? { itemId } : {} };
  }
  const fileWrite = raw.match(/^(?:Write|Edit|Update|Patch)\s+(.+)$/i);
  if (fileWrite) {
    const base2 = fileWrite[1].trim().replace(/['"]/g, "").split(/[\\/]/).pop() ?? fileWrite[1].trim();
    return { status: `editing ${clipStatus(base2, 36)}\u2026`, ...itemId ? { itemId } : {} };
  }
  if (/^(?:Search|Grep|Find|Glob)\b/i.test(raw)) {
    return { status: "searching workspace\u2026", ...itemId ? { itemId } : {} };
  }
  const cleaned = raw.replace(/^(?:Terminal|Bash|Run|Command):?\s*/i, "").trim();
  if (!cleaned) return null;
  if (itemLabel && itemId) {
    return { status: `working on "${itemLabel}"\u2026`, itemId };
  }
  return { status: clipStatus(cleaned, 64) };
}

// packages/rc/src/room.ts
init_src();

// packages/rc/src/budget.ts
var freshRun = () => ({ turns: 0, usd: null, session: null, said: false });
function runKeyOf(thread, commentId) {
  if (thread && !thread.main) return thread.id;
  return commentId ?? thread?.id ?? "none";
}
function capMet(spend, budget) {
  if (budget.usdPerRun !== void 0 && spend.usd !== null && spend.usd >= budget.usdPerRun) return "usd";
  if (budget.turnsPerRun !== void 0 && spend.turns >= budget.turnsPerRun) return "turns";
  return null;
}
var dollars = (n) => `$${n.toFixed(2)}`;
function spendWords(spend, budget, harness) {
  const turns = budget.turnsPerRun !== void 0 ? `${spend.turns} of ${budget.turnsPerRun} turns` : `${spend.turns} ${spend.turns === 1 ? "turn" : "turns"}`;
  if (spend.usd !== null) return `${turns}, ${dollars(spend.usd)}${budget.usdPerRun !== void 0 ? ` of ${dollars(budget.usdPerRun)}` : ""}`;
  return `${turns}; ${harness} reports no spend, so turns are the only bound`;
}
function capLine(name, cap, spend, budget) {
  return cap === "usd" ? `${name} stopped at its budget \u2014 ${dollars(spend.usd ?? 0)} of ${dollars(budget.usdPerRun ?? 0)} for this run. Ask again in a new thread for a new run.` : `${name} stopped at its budget \u2014 ${spend.turns} of ${budget.turnsPerRun} turns for this run. Ask again in a new thread for a new run.`;
}

// packages/rc/src/room.ts
var RoomHold = class extends Error {
  constructor(line, retryAfter) {
    super(line);
    this.line = line;
    this.retryAfter = retryAfter;
    this.name = "RoomHold";
  }
  line;
  retryAfter;
};
function mapState(map = /* @__PURE__ */ new Map()) {
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value);
    },
    delete: async (key) => {
      map.delete(key);
    }
  };
}
var keys = {
  guard: (actorId) => `guard:${actorId}`,
  session: (actorId) => `session:${actorId}`,
  /** What one run of a budgeted agent has spent (`budget.ts`). */
  run: (actorId, runKey) => `run:${actorId}:${runKey}`,
  origins: (actorId) => `origins:${actorId}`,
  gateSaid: (canvasId, key) => `said:${canvasId}:gate:${key}`,
  turnedAwaySaid: (canvasId, key) => `said:${canvasId}:turned-away:${key}`,
  /** An agent another badge holds: its cursor was refused `not-your-actor`,
   * and that was said. Deleted when a later start parks it. */
  notHeldSaid: (canvasId, actorId) => `said:${canvasId}:not-held:${actorId}`,
  /** When this agent was last held on this canvas (ms) — the roll call's
   * memory across a restart, written at most once a minute. */
  seen: (canvasId, actorId) => `seen:${canvasId}:${actorId}`
};
var SEEN_EVERY_MS = 6e4;
var STUCK_LOOKBACK = 2e3;
var NOT_YOUR_ACTOR = "not-your-actor";
var heldElsewhere = (err) => err instanceof ApiError && err.code === "name-taken" && err.reason === CLAIM_REFUSAL.heldElsewhere;
function suppliedWords(row) {
  if (row.harness === null) return row.cwd;
  return `${row.cwd} \xB7 ${row.harness}${row.model ? ` (${row.model})` : ""}`;
}
function runRoom(deps) {
  const life = new AbortController();
  let announcement = null;
  let leave = null;
  const stop = async () => {
    life.abort();
    const announced = announcement;
    announcement = null;
    const leaving = leave;
    leave = null;
    await Promise.all([
      deps.routes.rcRelease?.({ canvasId: deps.canvas.id }).catch(() => {
      }),
      announced ? deps.routes.endSession(deps.canvas.id, announced.sessionId).catch(() => {
      }) : void 0,
      leaving?.().catch(() => {
      })
    ]);
  };
  const done = room(
    deps,
    life.signal,
    (made) => {
      announcement = made;
    },
    (say) => {
      leave = say;
    }
  );
  return { stop, done };
}
async function room(deps, life, announce, onLeave) {
  const { routes, rows, state, clock } = deps;
  const p = deps.canvas;
  const narrate = deps.narrate;
  const sleep = (ms) => deps.sleep(ms, life);
  const rosterOf = async () => {
    const snapshot = await routes.snapshot(p.id);
    return snapshot.canvas.agents ?? {};
  };
  const rcCwd = deps.cwd;
  const reap = async (roster2) => {
    for (const row of await rows.list()) {
      if (row.canvasId === p.id && !roster2[row.actorId]) await rows.remove(p.id, row.actorId);
    }
  };
  const adoptionRow = async (actorId, name) => {
    const elsewhere = (await rows.list()).filter((r) => r.actorId === actorId && r.canvasId !== p.id);
    const named = elsewhere.filter((r) => r.harness !== null);
    const from = (named.length > 0 ? named : elsewhere).at(-1);
    return {
      canvasId: p.id,
      actorId,
      name,
      harness: from?.harness ?? null,
      ...from?.model ? { model: from.model } : {},
      cwd: from?.cwd ?? rcCwd,
      sessionId: null
    };
  };
  const reconcile = async (roster2) => {
    for (const record2 of Object.values(roster2)) {
      if (notHeld.has(record2.actor.id)) continue;
      await rows.adopt(await adoptionRow(record2.actor.id, record2.actor.name));
    }
    await reap(roster2);
  };
  const known = /* @__PURE__ */ new Map();
  const opening = await rosterOf();
  for (const [id, row] of Object.entries(opening)) known.set(id, row.actor.name);
  const dispatches = /* @__PURE__ */ new Map();
  const notHeld = /* @__PURE__ */ new Set();
  const sayNotHeld = async (actorId) => {
    const key = keys.notHeldSaid(p.id, actorId);
    if (await state.get(key)) return;
    await state.set(key, true);
    const name = known.get(actorId) ?? actorId;
    narrate(`${name} is not held by this machine \u2014 a pass from whoever holds ${name} hands it over`);
  };
  const standDownNotHeld = async (actorId) => {
    dispatches.delete(actorId);
    notHeld.add(actorId);
    await sayNotHeld(actorId);
  };
  const enrolSeqs = /* @__PURE__ */ new Map();
  for (const entry of await routes.getLog(p.id, 0)) {
    if (entry.envelope.op.type === "agent.enroll") {
      enrolSeqs.set(entry.envelope.op.agent.id, entry.seq);
    }
  }
  const parkAgent = async (actorId, own, seedAt) => {
    if (dispatches.has(actorId)) return "held";
    if (notHeld.has(actorId)) return "not-held";
    const name = known.get(actorId);
    if (own && name !== void 0) {
      let elsewhere = false;
      await deps.agentKey(name).then((sessionKey) => routes.claimActor({ type: "actor.claim", sessionKey, as: actorId })).catch((err) => {
        elsewhere = heldElsewhere(err);
      });
      if (elsewhere) {
        notHeld.add(actorId);
        return "not-held";
      }
    }
    try {
      const floor = seedAt ?? enrolSeqs.get(actorId);
      const claim = await routes.parkClaim({
        canvasId: p.id,
        actorId,
        ...floor !== void 0 ? { seedAt: floor } : {}
      });
      dispatches.set(actorId, {
        parkId: claim.parkId,
        cursor: claim.cursor,
        redeliverUpTo: claim.redeliverUpTo,
        pending: [],
        scannedTip: claim.cursor,
        busy: false,
        retryAfter: 0
      });
      await state.delete(keys.notHeldSaid(p.id, actorId));
      return "held";
    } catch (err) {
      if (err instanceof ApiError && err.code === NOT_YOUR_ACTOR) {
        notHeld.add(actorId);
        return "not-held";
      }
      return { error: err };
    }
  };
  const couldNotHold = (actorId, error) => narrate(`could not hold ${known.get(actorId) ?? actorId}'s cursor \u2014 ${error.message}`);
  const ownRow = async (actorId) => (await rows.list()).some((r) => r.canvasId === p.id && r.actorId === actorId);
  const openingSays = [];
  {
    const mine = new Set((await rows.list()).filter((r) => r.canvasId === p.id).map((r) => r.actorId));
    for (const actorId of Object.keys(opening)) {
      const parked = await parkAgent(actorId, mine.has(actorId));
      if (parked === "not-held") openingSays.push(() => sayNotHeld(actorId));
      else if (parked !== "held") openingSays.push(async () => couldNotHold(actorId, parked.error));
    }
  }
  await reconcile(opening);
  const owner = { id: deps.owner.id, name: deps.owner.name };
  const keeping = { owner, hands: [owner.id] };
  let handsAt = 0;
  const refreshHands = async () => {
    if (clock.now() - handsAt < 1e4) return;
    handsAt = clock.now();
    const bound = await routes.actorBindings().catch(() => []);
    const mine = await rows.list().catch(() => []);
    keeping.hands = [.../* @__PURE__ */ new Set([owner.id, ...mine.map((r) => r.actorId), ...bound.map((b) => b.actor.id)])];
  };
  await refreshHands();
  const policyState = {
    roster: opening,
    joined: void 0,
    nameOf: (id) => known.get(id)
  };
  {
    const first = await routes.snapshot(p.id).catch(() => null);
    policyState.joined = first?.joined;
    if (first) policyState.nameOf = nameResolver(first);
  }
  const policyOf = (record2) => answerPolicy(rulesOf(record2.rules), keeping, record2.writtenBy?.id, policyState.joined);
  const policyLine = (record2) => policyWords(policyOf(record2), (id) => known.get(id) ?? policyState.nameOf(id), owner.id, policyState.joined) ?? "listens to everyone";
  const sayPolicy = async (record2) => {
    const key = keys.gateSaid(
      p.id,
      `${record2.actor.id} ${record2.writtenBy?.id ?? ""} ${JSON.stringify(rulesOf(record2.rules).listen ?? null)}`
    );
    if (await state.get(key)) return;
    await state.set(key, true);
    if (gateSetAside(rulesOf(record2.rules), keeping, record2.writtenBy?.id, policyState.joined)) {
      narrate(
        `${record2.actor.name}'s gate was last written by ${record2.writtenBy?.name ?? "somebody else"}, not you \u2014 answering only you until you say otherwise: isocan rc listen ${record2.actor.name} --to <names|everyone>`
      );
    }
  };
  const announced = await routes.createSession(p.id, deps.owner, void 0, void 0, "rc").catch(() => null);
  if (announced && life.aborted) {
    await routes.endSession(p.id, announced.sessionId).catch(() => {
    });
    return;
  }
  announce(announced);
  narrate(`answering on "${p.title}" \u2014 ${canvasUrl(deps.origin, p.id)}`);
  const enrolledCount = Object.keys(opening).length;
  narrate(
    enrolledCount === 0 ? "nobody is enrolled yet \u2014 Add an agent in the tray at that address; this rc picks it up without a restart" : `${enrolledCount} ${enrolledCount === 1 ? "agent" : "agents"} enrolled (\`isocan who\` names them) \u2014 quiet until something arrives (Ctrl-C stops answering)`
  );
  if (enrolledCount > 0) {
    const byWords = /* @__PURE__ */ new Map();
    for (const record2 of Object.values(opening)) {
      if (notHeld.has(record2.actor.id)) continue;
      const words2 = policyLine(record2);
      byWords.set(words2, [...byWords.get(words2) ?? [], record2.actor.name]);
      await sayPolicy(record2);
    }
    for (const [words2, names] of byWords) {
      const narrowed2 = words2 !== "listens to everyone";
      narrate(
        `${names.join(", ")} ${names.length === 1 ? words2 : words2.replace(/^listens/, "listen")}` + (narrowed2 ? " \u2014 `isocan rc listen <name> --to <names|everyone>` widens one" : "")
      );
    }
  }
  for (const say of openingSays) await say();
  const guardOf = async (actorId) => await state.get(keys.guard(actorId)) ?? { turnTimes: [], agentChain: 0, held: null };
  const originsOf = async (actorId) => {
    const said = await state.get(keys.origins(actorId));
    return said ? new Set(said) : void 0;
  };
  const TURNS_PER_HOUR = deps.limits.turnsPerHour;
  const AGENT_CHAIN = deps.limits.agentChain;
  const sayInThread = async (threadId, body) => {
    if (!threadId) return;
    await routes.sendOp(p.id, SYSTEM_ACTOR, {
      type: "thread.reply",
      threadId,
      comment: { id: newId("cmt"), body }
    }).catch(() => {
    });
  };
  const threadOf = (entries) => {
    const comment = entries.find(
      (e2) => e2.envelope.op.type === "thread.create" || e2.envelope.op.type === "thread.reply"
    );
    return comment ? comment.envelope.op.threadId : null;
  };
  const withdrawnHere = async (actorId) => {
    const snapshot = await routes.snapshot(p.id).catch(() => null);
    return snapshot !== null && !snapshot.canvas.agents?.[actorId];
  };
  const rolls = /* @__PURE__ */ new Map();
  const sayRoll = async (record2, kind, canvas) => {
    const words2 = policyWords(policyOf(record2), (id) => known.get(id) ?? policyState.nameOf(id), void 0, policyState.joined) ?? "listens to everyone";
    const body = rollWords(kind, record2.actor.name, words2);
    for (let attempt = 0; attempt < 2; attempt++) {
      const at = attempt === 0 && canvas ? canvas : (await routes.snapshot(p.id).catch(() => null))?.canvas;
      if (!at) break;
      try {
        await routes.sendOp(p.id, record2.actor, rollOp(at, kind, body));
        narrate(`${record2.actor.name} \xB7 said in the Chat \u2014 ${body}`);
        return true;
      } catch (err) {
        if (attempt === 1 || !(err instanceof ApiError && err.code === "main-exists")) {
          narrate(`${record2.actor.name} \xB7 could not say "${kind}" in the Chat \u2014 ${err.message}`);
          return false;
        }
      }
    }
    return false;
  };
  const rollCall = async (actorIds, began) => {
    if (!deps.announce) return;
    const ended = clock.now();
    let canvas = null;
    for (const actorId of actorIds) {
      const record2 = policyState.roster[actorId];
      if (!record2 || !dispatches.has(actorId)) continue;
      let mine = rolls.get(actorId);
      if (!mine) {
        canvas ??= (await routes.snapshot(p.id).catch(() => null))?.canvas ?? null;
        if (!canvas) continue;
        const seen = await state.get(keys.seen(p.id, actorId));
        mine = { last: lastRoll(canvas, actorId), seen: typeof seen === "number" ? seen : void 0, kept: 0 };
        rolls.set(actorId, mine);
      }
      const due = deps.announce(record2.actor) ? rollDue({ last: mine.last, seen: mine.seen, now: began }) : null;
      if (due && await sayRoll(record2, due, canvas)) {
        mine.last = { kind: due, at: ended };
        canvas = null;
      }
      mine.seen = ended;
      if (ended - mine.kept >= SEEN_EVERY_MS) {
        mine.kept = ended;
        await state.set(keys.seen(p.id, actorId), ended);
      }
    }
  };
  let rolling = Promise.resolve();
  onLeave(async () => {
    if (!deps.announce) return;
    await rolling;
    const now = clock.now();
    for (const [actorId, mine] of rolls) {
      const record2 = policyState.roster[actorId];
      if (!record2) continue;
      await state.set(keys.seen(p.id, actorId), now);
      if (mine.last && mine.last.kind !== "away" && deps.announce(record2.actor)) {
        await sayRoll(record2, "away", null);
      }
    }
  });
  const holdOnce = (actorIds = [...dispatches.keys()]) => {
    const policies = {};
    for (const actorId of actorIds) {
      const record2 = policyState.roster[actorId];
      if (record2) policies[actorId] = policyOf(record2);
    }
    return routes.rcHold({ canvasId: p.id, actorIds, waitMs: 1e4, owner, policies }, life);
  };
  let holdRefusedSaid = false;
  const holdAfterRefusal = async () => {
    const mine = (await rows.list().catch(() => [])).filter(
      (r) => r.canvasId === p.id && dispatches.has(r.actorId)
    );
    for (const row of mine) {
      const name = known.get(row.actorId) ?? row.name;
      let elsewhere = false;
      await deps.agentKey(name).then((sessionKey) => routes.claimActor({ type: "actor.claim", sessionKey, as: row.actorId })).catch((err) => {
        elsewhere = heldElsewhere(err);
      });
      if (elsewhere) await standDownNotHeld(row.actorId);
    }
    try {
      return await holdOnce();
    } catch (again) {
      if (life.aborted) return null;
      if (!holdRefusedSaid) {
        holdRefusedSaid = true;
        const why = again.message;
        const named = [...dispatches.keys()].find((id) => why.includes(id));
        const who = named ? known.get(named) ?? named : [...dispatches.keys()].map((id) => known.get(id) ?? id).join(", ");
        narrate(`could not hold ${who}'s cursor \u2014 ${why}`);
      }
      await sleep(1e4);
      return null;
    }
  };
  void (async () => {
    while (!life.aborted) {
      try {
        let held;
        const began = clock.now();
        const holding = [...dispatches.keys()];
        try {
          held = await holdOnce(holding);
        } catch (err) {
          if (!(err instanceof ApiError && err.code === NOT_YOUR_ACTOR) || life.aborted) throw err;
          held = await holdAfterRefusal();
        }
        if (!held) continue;
        holdRefusedSaid = false;
        if (!life.aborted) rolling = rolling.then(() => rollCall(holding, began)).catch(() => {
        });
        for (const ask of held.asks ?? []) {
          if (!ownersWord(keeping, ask.from.id, policyState.joined)) {
            narrate(`${ask.from.name} asked from the canvas to add ${ask.name} \u2014 this rc takes that only from you; nothing enrolled`);
            continue;
          }
          const via = ask.template ? ` from the template ${ask.template}` : "";
          narrate(`${ask.from.name} asked from the canvas to add ${ask.name}${via} \u2014 enrolling here`);
          try {
            await deps.enrol(ask);
          } catch (err) {
            narrate(`could not enrol ${ask.name} \u2014 ${err.message}`);
          }
        }
      } catch {
        if (life.aborted) return;
        await sleep(400);
      }
    }
  })();
  const stuckModule = Promise.resolve().then(() => (init_stuck(), stuck_exports)).catch(() => null);
  const stuckContext = async (flagged, tip, snapshot) => {
    const said = flagged.flatMap((e2) => e2.envelope.op.type === "thread.create" || e2.envelope.op.type === "thread.reply" ? [{ id: e2.envelope.op.comment.id, by: e2.envelope.actor.id }] : []);
    const log = await routes.getLog(p.id, Math.max(0, tip - STUCK_LOOKBACK)).catch(() => null);
    if (!log) return {};
    const asked = (by) => log.filter((e2) => e2.envelope.actor.id === by && (e2.envelope.op.type === "thread.create" || e2.envelope.op.type === "thread.reply")).length;
    if (!said.some((c) => asked(c.by) > 3)) return {};
    const mod = await stuckModule;
    const asks = new Set(said.map((c) => c.id));
    const found = mod?.stuckAll(log).find((s) => s.pending && asks.has(s.pending.commentId));
    if (!found) return {};
    const title = snapshot?.canvas.items[found.itemId]?.title || "Untitled";
    return { stuck: { itemId: found.itemId, title, person: found.person.name, at: found.at, facts: found.facts } };
  };
  const runSummons = async (record2, dispatch) => {
    const entries = dispatch.pending.splice(0);
    const tip = dispatch.scannedTip;
    try {
      await runSummonsInner(record2, dispatch, entries, tip);
    } catch (err) {
      dispatch.pending.unshift(...entries);
      throw err;
    }
  };
  const runSummonsInner = async (record2, dispatch, entries, tip) => {
    const flagged = dispatch.redeliverUpTo === null ? entries : entries.map((e2) => e2.seq <= dispatch.redeliverUpTo ? { ...e2, redelivered: true } : e2);
    dispatch.redeliverUpTo = null;
    const summoned = flagged.some(
      (e2) => e2.envelope.op.type === "thread.create" || e2.envelope.op.type === "thread.reply"
    );
    const reason = summoned ? "summons" : "change";
    const from = flagged[0]?.envelope.actor.name ?? "someone";
    const authors = flagged.map((e2) => e2.envelope.actor.id);
    const carried = /* @__PURE__ */ new Map();
    for (const id of new Set(authors)) carried.set(id, await originsOf(id));
    const speakers = [...speakersFor(authors, (id) => carried.get(id))];
    await state.set(keys.origins(record2.actor.id), speakers);
    const say = (line) => narrate(`${record2.actor.name} \xB7 ${line}`);
    try {
      await routes.claimActor({
        type: "actor.claim",
        sessionKey: await deps.agentKey(record2.actor.name),
        as: record2.actor.id
      });
    } catch (err) {
      if (!heldElsewhere(err)) throw err;
      await standDownNotHeld(record2.actor.id);
      return;
    }
    say(`${reason} from ${from}, ${flagged.length} ${flagged.length === 1 ? "entry" : "entries"} \u2014 starting a session`);
    try {
      await routes.parkDelivered({
        canvasId: p.id,
        actorId: record2.actor.id,
        parkId: dispatch.parkId,
        tip
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === PARK_ADOPTED_CODE) {
        narrate(`another park adopted ${record2.actor.name}'s cursor \u2014 standing down for it`);
        dispatches.delete(record2.actor.id);
        return;
      }
      throw err;
    }
    const row = (await rows.list()).find((r) => r.canvasId === p.id && r.actorId === record2.actor.id) ?? {
      canvasId: p.id,
      actorId: record2.actor.id,
      name: record2.actor.name,
      harness: null,
      cwd: rcCwd,
      sessionId: null
    };
    const harness = await deps.adapterFor({ ...row, name: record2.actor.name });
    const firstComment = flagged.find(
      (e2) => e2.envelope.op.type === "thread.create" || e2.envelope.op.type === "thread.reply"
    );
    const threadId = firstComment ? firstComment.envelope.op.threadId : null;
    const changedItemId = (flagged[0]?.envelope.op).itemId ?? null;
    const snapshot = await routes.snapshot(p.id).catch(() => null);
    const thread = threadId ? snapshot?.canvas.threads[threadId] : void 0;
    const budget = row.budget ?? null;
    const runKey = budget ? runKeyOf(thread ?? (threadId ? { id: threadId } : null), firstComment?.envelope.op?.comment?.id ?? null) : null;
    const spend = runKey ? await state.get(keys.run(record2.actor.id, runKey)) ?? freshRun() : null;
    const keepSpend = () => runKey && spend ? state.set(keys.run(record2.actor.id, runKey), spend) : Promise.resolve();
    if (budget && spend) {
      const met = capMet(spend, budget);
      if (met) {
        if (!spend.said) {
          spend.said = true;
          await keepSpend();
          await sayInThread(threadId, capLine(record2.actor.name, met, spend, budget));
        }
        say(`run at its budget \u2014 ${spendWords(spend, budget, harness.harness)}; no turn`);
        await routes.parkAdvance({ canvasId: p.id, actorId: record2.actor.id, parkId: dispatch.parkId, to: tip }).then(() => {
          dispatch.cursor = tip;
        }).catch(() => {
        });
        return;
      }
      spend.turns += 1;
      await keepSpend();
    }
    const face = await routes.createSession(p.id, record2.actor, void 0, harness.harness).catch(() => null);
    const commentItems = firstComment?.envelope.op?.comment?.items;
    const targetedItem = snapshot ? threadTargetItem(snapshot.canvas, thread, commentItems) : void 0;
    const item = !threadId && changedItemId ? snapshot?.canvas.items[changedItemId] : void 0;
    const contextItem = targetedItem ?? item;
    let working = null;
    if (face) {
      working = contextItem ? { kind: "working", itemId: contextItem.id } : threadId ? { kind: "working", threadId } : null;
      const initialCursor = contextItem ? itemCenter(contextItem) : snapshot && thread ? threadLocus(snapshot, thread) : null;
      await routes.updateSession(p.id, face.sessionId, {
        status: threadId ? "reading your comment\u2026" : "looking at what changed\u2026",
        statusSource: "lifecycle",
        ...working ? { activity: working } : {},
        ...threadId ? { onThread: threadId } : {},
        ...initialCursor ? { cursor: initialCursor } : {}
      }).catch(() => {
      });
    }
    const guestSpeakerId = speakers.find((id) => !ownersWord(keeping, id, policyState.joined));
    const guestAsker = guestSpeakerId !== void 0 ? flagged.find((e2) => e2.envelope.actor.id === guestSpeakerId)?.envelope.actor.name ?? known.get(guestSpeakerId) ?? policyState.nameOf(guestSpeakerId) ?? from : void 0;
    const summonsContext = {
      ...thread ? {
        thread: {
          id: thread.id,
          comments: thread.comments.map((c) => ({
            id: c.id,
            author: c.author.name,
            body: c.body
          }))
        }
      } : {},
      ...contextItem ? {
        item: {
          id: contextItem.id,
          kind: itemKind({ ...contextItem, properties: contextItem.properties ?? {} }),
          title: contextItem.title
        }
      } : {},
      ...guestAsker ? { wokenBy: { asker: guestAsker, owner: owner.name } } : {},
      ...firstComment ? await stuckContext(flagged, tip, snapshot) : {}
    };
    const beat = (patch) => {
      if (!face) return;
      void routes.updateSession(p.id, face.sessionId, { actor: record2.actor, ...patch }).catch(() => {
      });
    };
    const heartbeat = new AbortController();
    const endHeartbeat = () => heartbeat.abort();
    life.addEventListener("abort", endHeartbeat, { once: true });
    void (async () => {
      for (; ; ) {
        await deps.sleep(6e4, heartbeat.signal);
        if (heartbeat.signal.aborted) return;
        beat({});
      }
    })();
    let agent = null;
    try {
      agent = await harness.open({
        canvasId: p.id,
        agent: record2.actor,
        owner,
        face: face?.sessionId ?? null,
        threadId,
        narrate: say
      });
      const storedSession = await state.get(keys.session(record2.actor.id));
      const session = await agent.ensureSession(row.cwd, spend ? spend.session : row.sessionId ?? storedSession ?? null);
      if (spend) {
        spend.session = session.sessionId;
        await keepSpend();
      } else {
        await state.set(keys.session(record2.actor.id), session.sessionId);
        await rows.setSessionId(p.id, record2.actor.id, session.sessionId);
      }
      say(`session ${session.resumed ? "resumed" : "started"} in ${row.cwd}`);
      const usdBefore = spend?.usd ?? null;
      let turnUsd = null;
      let cancelled = false;
      let lastStatusBeat = 0;
      let lastStatusText = "";
      let thoughtBuffer = "";
      const turn = await agent.prompt(
        session.sessionId,
        summonsPrompt(p.title, record2.actor.name, { reason, entries: flagged }, summonsContext),
        (event) => {
          if (event.kind === "usage" && typeof event.usd === "number" && spend && budget) {
            turnUsd = Math.max(turnUsd ?? 0, event.usd);
            spend.usd = (usdBefore ?? 0) + turnUsd;
            if (!cancelled && capMet(spend, budget) === "usd") {
              cancelled = true;
              say(`at its budget mid-turn \u2014 ${spendWords(spend, budget, harness.harness)}; stopping the turn`);
              agent?.cancel?.(session.sessionId);
            }
          }
          if (event.kind === "permission") say(`permission ${event.detail}`);
          if (event.kind === "thought" && event.text) {
            thoughtBuffer = (thoughtBuffer + event.text).slice(-600);
            if (clock.now() - lastStatusBeat >= 1400) {
              const status = formatThoughtStatus(thoughtBuffer);
              if (status && status !== lastStatusText) {
                lastStatusBeat = clock.now();
                lastStatusText = status;
                beat({
                  status,
                  statusSource: "inferred",
                  ...working ? { activity: working } : {}
                });
              }
            }
          }
          if (event.kind === "tool" && event.detail) {
            const parsed = humanizeToolStatus(event.detail, snapshot?.canvas.items);
            if (!parsed) return;
            const nextItem = parsed.itemId ? snapshot?.canvas.items[parsed.itemId] : void 0;
            const itemChanged = nextItem !== void 0 && !(working?.kind === "working" && "itemId" in working && working.itemId === nextItem.id);
            if (nextItem) {
              working = { kind: "working", itemId: nextItem.id };
            }
            if (itemChanged || clock.now() - lastStatusBeat >= 1400) {
              lastStatusBeat = clock.now();
              lastStatusText = parsed.status;
              beat({
                status: parsed.status,
                statusSource: "inferred",
                ...working ? { activity: working } : {},
                ...itemChanged && nextItem ? { cursor: itemCenter(nextItem) } : {}
              });
            }
          }
        }
      );
      if (!dispatches.has(record2.actor.id) || turn.stopReason !== "end_turn" && await withdrawnHere(record2.actor.id)) {
        say(`turn stopped \u2014 ${record2.actor.name} was withdrawn`);
        return;
      }
      say(`turn ended \u2014 ${turn.stopReason}`);
      if (spend && budget) {
        say(`run so far \u2014 ${spendWords(spend, budget, harness.harness)}`);
        const met = capMet(spend, budget);
        if (met && (cancelled || met === "usd") && !spend.said) {
          spend.said = true;
          await sayInThread(threadId, capLine(record2.actor.name, met, spend, budget));
        }
        await keepSpend();
      }
      await routes.parkAdvance({ canvasId: p.id, actorId: record2.actor.id, parkId: dispatch.parkId, to: tip }).then(() => {
        dispatch.cursor = tip;
      }).catch(() => {
      });
    } finally {
      endHeartbeat();
      life.removeEventListener("abort", endHeartbeat);
      if (agent) await agent.close();
      if (face) await routes.endSession(p.id, face.sessionId).catch(() => {
      });
    }
  };
  let cursors = { [p.id]: 0 };
  const lapFrom = () => {
    let from = startTip;
    for (const d of dispatches.values()) if (d.scannedTip < from) from = d.scannedTip;
    return from;
  };
  const takeUp = async (roster2) => {
    for (const record2 of Object.values(roster2)) {
      if (dispatches.has(record2.actor.id) || notHeld.has(record2.actor.id)) continue;
      known.set(record2.actor.id, record2.actor.name);
      const parked = await parkAgent(record2.actor.id, await ownRow(record2.actor.id));
      if (parked === "not-held") {
        await sayNotHeld(record2.actor.id);
        continue;
      }
      const row = await adoptionRow(record2.actor.id, record2.actor.name);
      const adopted = await rows.adopt(row);
      if (adopted) narrate(`${record2.actor.name} \xB7 where and how supplied \u2014 ${suppliedWords(row)}`);
      if (parked !== "held") couldNotHold(record2.actor.id, parked.error);
    }
  };
  const startTip = (await routes.watchLog({ only: [p.id] })).cursors[p.id] ?? 0;
  const settled = await rosterOf();
  policyState.roster = settled;
  for (const [id, row] of Object.entries(settled)) known.set(id, row.actor.name);
  await reap(settled);
  for (const actorId of [...dispatches.keys()]) if (!settled[actorId]) dispatches.delete(actorId);
  for (const actorId of [...notHeld]) if (!settled[actorId]) notHeld.delete(actorId);
  await takeUp(settled);
  cursors = { [p.id]: lapFrom() };
  let lastRoster = settled;
  let offlineSince = null;
  while (!life.aborted) {
    let batch;
    try {
      const eager = [...dispatches.values()].some((d) => d.busy || d.pending.length > 0);
      batch = await routes.watchLog({ cursors, waitMs: eager ? 2e3 : 3e4, only: [p.id] }, life);
      if (offlineSince !== null) {
        narrate(`daemon back after ${Math.round((clock.now() - offlineSince) / 1e3)}s \u2014 nothing missed`);
        offlineSince = null;
      }
    } catch (err) {
      if (life.aborted) return;
      if (err instanceof ApiError) throw err;
      if (offlineSince === null) {
        offlineSince = clock.now();
        narrate("the daemon stopped answering \u2014 retrying, and starting it if it is gone");
      }
      await sleep(400);
      continue;
    }
    cursors = batch.cursors;
    if (announced) {
      await routes.updateSession(p.id, announced.sessionId, {}).catch(async () => {
        const again = await routes.createSession(p.id, deps.owner, void 0, void 0, "rc").catch(() => null);
        if (again) {
          announced.sessionId = again.sessionId;
          announce(announced);
        }
      });
    }
    const lapTip = batch.cursors[p.id] ?? 0;
    const snapshot = batch.entries.length > 0 || dispatches.size === 0 ? await routes.snapshot(p.id) : null;
    if (snapshot) {
      lastRoster = snapshot.canvas.agents ?? {};
      policyState.roster = lastRoster;
      policyState.joined = snapshot.joined;
      policyState.nameOf = nameResolver(snapshot);
      for (const [id, row] of Object.entries(lastRoster)) known.set(id, row.actor.name);
      if (batch.entries.some((e2) => !ownersWord(keeping, e2.envelope.actor.id, snapshot.joined))) {
        await refreshHands();
      }
    }
    const roster2 = lastRoster;
    await takeUp(roster2);
    for (const entry of batch.entries) {
      const op = entry.envelope.op;
      const by = entry.envelope.actor;
      if (op.type === "agent.enroll") {
        known.set(op.agent.id, op.agent.name);
        if (entry.seq > startTip) {
          const parked = await parkAgent(op.agent.id, await ownRow(op.agent.id), entry.seq);
          if (parked === "not-held") {
            await sayNotHeld(op.agent.id);
            continue;
          }
          const record2 = roster2[op.agent.id];
          narrate(`${by.name} enrolled ${op.agent.name} \u2014 answerable here${record2 ? ` \xB7 ${policyLine(record2)}` : ""}`);
          if (record2) await sayPolicy(record2);
          const row = await adoptionRow(op.agent.id, op.agent.name);
          const adopted = await rows.adopt(row);
          if (adopted) narrate(`${op.agent.name} \xB7 where and how supplied \u2014 ${suppliedWords(row)}`);
          if (parked !== "held") couldNotHold(op.agent.id, parked.error);
        }
        continue;
      }
      if (op.type === "agent.withdraw" && entry.seq > startTip && notHeld.delete(op.actorId)) {
        continue;
      }
      if (op.type === "agent.withdraw" && entry.seq > startTip) {
        const name = known.get(op.actorId) ?? op.actorId;
        narrate(`${by.name} dismissed ${name} \u2014 no longer answering here`);
        await rows.remove(p.id, op.actorId);
        dispatches.delete(op.actorId);
        rolls.delete(op.actorId);
        await state.delete(keys.session(op.actorId));
        continue;
      }
      for (const record2 of Object.values(roster2)) {
        const dispatch = dispatches.get(record2.actor.id);
        if (!dispatch || entry.seq <= dispatch.scannedTip) continue;
        const joined = snapshot?.joined;
        const carried = await originsOf(by.id);
        const agent = {
          actorId: record2.actor.id,
          names: [{ id: record2.actor.id, name: record2.actor.name }],
          rules: rulesOf(record2.rules),
          policy: policyOf(record2),
          hands: keeping.hands,
          ...joined ? { joined } : {},
          ...carried && carried.size > 0 ? { onBehalfOf: [...carried] } : {}
        };
        const reason = dispatchReason(op, by.id, agent, snapshot?.canvas ?? null);
        if (reason) {
          dispatch.pending.push(entry);
          continue;
        }
        if (turnedAway(op, by.id, agent) && (op.type === "thread.create" || op.type === "thread.reply")) {
          const key = keys.turnedAwaySaid(p.id, `${op.threadId} ${by.id} ${record2.actor.id}`);
          if (await state.get(key)) continue;
          await state.set(key, true);
          const nameOf = snapshot ? nameResolver(snapshot) : (id) => known.get(id);
          const askers = agent.onBehalfOf ? agent.onBehalfOf.filter((id) => !mayWake(agent.policy, id, joined, keeping.hands)).map((id) => nameOf(id) ?? id) : [by.name];
          const asker = askers.join(",") || by.name;
          const askerIds = agent.onBehalfOf ?? [by.id];
          const ran = askerIds.map((id) => lapsedFor(agent.policy, id, joined)).find((at) => at !== void 0);
          const line = turnedAwayLine(record2.actor.name, agent.policy, nameOf, asker, { lapsed: ran });
          const already = snapshot?.canvas.threads[op.threadId]?.comments.some(
            (c) => isSystemActor(c.author.id) && c.body === line
          );
          const who = agent.onBehalfOf ? `${by.name}, for ${askers.join(" and ")},` : by.name;
          narrate(`${record2.actor.name} \xB7 ${who} asked; ${policyLine(record2)} \u2014 said so in the thread, nothing started`);
          if (!already) await sayInThread(op.threadId, line);
        }
      }
    }
    for (const [actorId, dispatch] of dispatches) {
      const before = dispatch.scannedTip;
      dispatch.scannedTip = Math.max(dispatch.scannedTip, lapTip);
      if (!dispatch.busy && dispatch.pending.length === 0 && dispatch.scannedTip > before) {
        await routes.parkAdvance({ canvasId: p.id, actorId, parkId: dispatch.parkId, to: dispatch.scannedTip }).then(() => {
          dispatch.cursor = dispatch.scannedTip;
        }).catch(() => {
        });
      }
    }
    for (const [actorId, dispatch] of dispatches) {
      if (dispatch.busy || dispatch.pending.length === 0) continue;
      if (clock.now() < dispatch.retryAfter) continue;
      const record2 = roster2[actorId];
      if (!record2) continue;
      const enrolledIds = new Set(Object.keys(roster2));
      const hasPersonWord = dispatch.pending.some(
        (e2) => !enrolledIds.has(e2.envelope.actor.id) && !isSystemActor(e2.envelope.actor.id)
      );
      const guard = await guardOf(actorId);
      const wasHeld = guard.held !== null;
      const verdict = gateTurn(guard, hasPersonWord, { turnsPerHour: TURNS_PER_HOUR, agentChain: AGENT_CHAIN }, clock.now());
      await state.set(keys.guard(actorId), guard);
      if (verdict.verdict === "hold-cycle") {
        if (verdict.announce) {
          const line = `${record2.actor.name} paused after ${guard.agentChain} agent-to-agent ${guard.agentChain === 1 ? "turn" : "turns"} with no person in the conversation \u2014 a human word resumes it.`;
          narrate(`${line}`);
          await sayInThread(threadOf(dispatch.pending), line);
        }
        continue;
      }
      if (verdict.verdict === "hold-ceiling") {
        dispatch.retryAfter = verdict.retryAfter;
        if (verdict.announce) {
          const line = `${record2.actor.name} is at its ceiling \u2014 ${TURNS_PER_HOUR} turns in the past hour. This summons waits (about ${Math.max(1, Math.round((verdict.freesAt - clock.now()) / 6e4))} min).`;
          narrate(`${line}`);
          await sayInThread(threadOf(dispatch.pending), line);
        }
        continue;
      }
      if (wasHeld) {
        narrate(`${record2.actor.name}'s hold lifted \u2014 dispatching what waited`);
      }
      const failedThread = threadOf(dispatch.pending);
      dispatch.busy = true;
      void runSummons(record2, dispatch).catch(async (err) => {
        if (await withdrawnHere(actorId)) {
          dispatch.pending.length = 0;
          narrate(`${record2.actor.name} \xB7 turn stopped \u2014 ${record2.actor.name} was withdrawn`);
          return;
        }
        if (err instanceof RoomHold) {
          narrate(`${record2.actor.name} \xB7 turn held \u2014 ${err.line}`);
          await sayInThread(failedThread, err.line);
          dispatch.retryAfter = err.retryAfter;
          return;
        }
        const why = err.message;
        narrate(`${record2.actor.name} \xB7 turn FAILED \u2014 ${why} (retrying in 60s)`);
        await sayInThread(
          failedThread,
          `${record2.actor.name} couldn't answer \u2014 ${why}. The summons is held and will be retried; \`isocan rc\`'s log has the detail.`
        );
        dispatch.retryAfter = clock.now() + 6e4;
      }).finally(() => {
        dispatch.busy = false;
      });
    }
  }
}

// packages/rc/src/skill.ts
var COLLAB_SKILL = '---\nname: isocan-collab\ndescription: Collaborate on an isocan canvas as a visible agent \u2014 address comments, build/edit items, and run the wait-driven feedback loop via the isocan CLI. Use when asked to work on a canvas, address canvas comments, "park" and wait for feedback, or run a canvas session. Triggers on "isocan", "canvas comments", "park on the canvas", "address my comments".\n---\n\n# Collaborating on an isocan canvas\n\nisocan is an infinite shared canvas. A local daemon owns the state; the web\napp (which the human watches) and the `isocan` CLI (you) are equal clients \u2014\nevery operation you run appears on their screen live, and your presence\nrenders as a named cursor.\n\n**The instructions live in the tool.** Run this first, once per session, and\nfollow what it says:\n\n```sh\nisocan --agent-help     # the protocol: your name, presence, the lap, parking\n                        # on `wait`, every verb \u2014 and the topics it lists\nisocan --agent-help <topic>   # one of those topics in full\n```\n\nIt ships inside the CLI, so it describes the build you are actually running \u2014\nthis file cannot fall behind it. `isocan --help` is the command-by-command\nreference alongside it, and is also written for you.\n\n## If `isocan` isn\'t there\n\nThis skill can arrive without the tool (`npx skills add dglazkov/isocan`\ninstalls this file alone). If `isocan --version` fails, one command installs\nit and sets up the directory you are in \u2014 the repo is the package, no registry\ninvolved:\n\n```sh\nnpx github:dglazkov/isocan#release setup   # CLI on PATH, skill, daemon, app\n```\n\nIt is idempotent \u2014 run it whenever you land somewhere new \u2014 and it puts\n`isocan` on your PATH itself, so `isocan --agent-help` works right after.\n\nKeep the `#release` on the spec \u2014 without it npm installs nothing usable.\nSetup\'s report says where the CLI landed, and if your shell cannot see it (a\nnon-login subshell often can\'t see nvm\'s or asdf\'s directories) that line\ncarries the `export PATH=\u2026` that reaches it. Prefixing every command with\n`npx github:dglazkov/isocan#release` also works, with no install at all.\n\n## The one rule to carry in\n\n**The canvas is the channel that keeps.** The human is watching the web app,\nand so is everyone else here \u2014 what you put on the canvas is the record, and\nanything you say only in your own conversation is invisible to all of them.\nSo every lap of work ends parked on `isocan wait`, never on a summary typed\nat a person, however attentive that person is.\n\nIf somebody IS reading your terminal \u2014 you are in an IDE or an agent manager,\nand your conversation is a window they have open \u2014 then you have two channels\nand they are a team room and a DM, not two chats to keep in sync. The guide\'s\n"Who is at your terminal" says which belongs where, and how to tell which\nmode you are in. `isocan --agent-help` is how you do all of this properly; go\nread it.\n';
export {
  ApiError,
  COLLAB_SKILL,
  DaemonRoutes,
  RoomHold,
  actorNamesOn,
  canvasUrlWithPass,
  gateTurn,
  isLoopbackBase,
  itemCenter,
  mapState,
  nameResolver,
  parseCanvasAddress,
  runRoom,
  summonsPrompt,
  threadLocus
};
