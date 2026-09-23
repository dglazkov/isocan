import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  CONTRAST_BODY,
  CONTRAST_UI,
  DESIGN_SECTIONS,
  DTCG_EXTENSION,
  DTCG_SCHEMA,
  canonicalSection,
  compileDesignContract,
  contrastRatio,
  designConversionNotes,
  dtcgColorString,
  dtcgDimensionString,
  fromDtcg,
  luminance,
  parseDesign,
  parseDesignJson,
  parseDimension,
  parseFrontMatter,
  parseHex,
  parseSrgb,
  passesContrast,
  referencesIn,
  resolveToken,
  serializeDesign,
  toCss,
  toDtcg,
  unresolvedReferences
} from "./chunk-TE337AEY.mjs";
import {
  __export
} from "./chunk-JYOOXWJZ.mjs";

// packages/core/src/index.ts
var src_exports = {};
__export(src_exports, {
  ACTOR_KINDS_ROUTE: () => ACTOR_KINDS_ROUTE,
  AGENT_KIND: () => AGENT_KIND,
  ALIGN_EDGES: () => ALIGN_EDGES,
  ALL_EMOJI: () => ALL_EMOJI,
  AMBIGUOUS_HOME: () => AMBIGUOUS_HOME,
  ANNOTATES_PROP: () => ANNOTATES_PROP,
  ANSWER_WITHIN_MS: () => ANSWER_WITHIN_MS,
  AREA_CARD_HEIGHT: () => AREA_CARD_HEIGHT,
  AREA_COLS_PROP: () => AREA_COLS_PROP,
  AREA_COL_NAMES_PROP: () => AREA_COL_NAMES_PROP,
  AREA_FILENAME: () => AREA_FILENAME,
  AREA_HEAD: () => AREA_HEAD,
  AREA_INSET: () => AREA_INSET,
  AREA_KIND: () => AREA_KIND,
  AREA_MIME: () => AREA_MIME,
  AREA_PROPERTIES: () => AREA_PROPERTIES,
  AREA_ROWS_PROP: () => AREA_ROWS_PROP,
  AREA_ROW_NAMES_PROP: () => AREA_ROW_NAMES_PROP,
  AREA_TINT_PROP: () => AREA_TINT_PROP,
  AREA_TITLE_HEIGHT: () => AREA_TITLE_HEIGHT,
  ASSETS_MAX_BYTES: () => ASSETS_MAX_BYTES,
  ASSET_MAX_BYTES: () => ASSET_MAX_BYTES,
  ATTEST_ROUTE: () => ATTEST_ROUTE,
  AUTH_ACTION_PATH: () => AUTH_ACTION_PATH,
  ApiError: () => ApiError,
  BADGES_ROUTE: () => BADGES_ROUTE,
  BADGE_COOKIE: () => BADGE_COOKIE,
  BADGE_ENDED: () => BADGE_ENDED,
  BADGE_RESTART_HINT: () => BADGE_RESTART_HINT,
  BAD_GROUP: () => BAD_GROUP,
  BAD_ID_TOKEN: () => BAD_ID_TOKEN,
  BAD_SPACE: () => BAD_SPACE,
  BENCH_ITEM_SIZE: () => BENCH_ITEM_SIZE,
  BENCH_JOIN_VERB: () => BENCH_JOIN_VERB,
  BENCH_REACH: () => BENCH_REACH,
  BOARD_GAP: () => BOARD_GAP,
  BOARD_PROP: () => BOARD_PROP,
  BRIEF_PROP: () => BRIEF_PROP,
  BROWSER_MIME: () => BROWSER_MIME,
  CANVASES_REACH_PARAM: () => CANVASES_REACH_PARAM,
  CANVAS_GROUPS_FEATURE: () => CANVAS_GROUPS_FEATURE,
  CANVAS_GROUPS_REQUIRED: () => CANVAS_GROUPS_REQUIRED,
  CANVAS_IN_SPACE: () => CANVAS_IN_SPACE,
  CANVAS_ITEM_FILENAME: () => CANVAS_ITEM_FILENAME,
  CANVAS_ITEM_SIZE: () => CANVAS_ITEM_SIZE,
  CANVAS_KIND: () => CANVAS_KIND,
  CANVAS_PATH_PREFIX: () => CANVAS_PATH_PREFIX,
  CANVAS_PROP: () => CANVAS_PROP,
  CANVAS_ROUTE: () => CANVAS_ROUTE,
  CANVAS_SORTS: () => CANVAS_SORTS,
  CANVAS_SORT_LABEL: () => CANVAS_SORT_LABEL,
  CLAIM_REFUSAL: () => CLAIM_REFUSAL,
  CLIENT_FEATURES_HEADER: () => CLIENT_FEATURES_HEADER,
  CLIENT_FEATURES_PARAM: () => CLIENT_FEATURES_PARAM,
  COMMAND_NAME: () => COMMAND_NAME,
  CONTEXT_PROP: () => CONTEXT_PROP,
  CONTEXT_SHEET_SIZE: () => CONTEXT_SHEET_SIZE,
  CONTEXT_SHEET_TITLE: () => CONTEXT_SHEET_TITLE,
  CONTEXT_SOURCE_PROP: () => CONTEXT_SOURCE_PROP,
  CONTRAST_BODY: () => CONTRAST_BODY,
  CONTRAST_UI: () => CONTRAST_UI,
  CONVERGED_PROP: () => CONVERGED_PROP,
  CURRENT_CLIENT_FEATURES: () => CURRENT_CLIENT_FEATURES,
  CURSORS: () => CURSORS,
  CURSOR_PROP: () => CURSOR_PROP,
  CURSOR_SIGNAL_MAX_LENGTH: () => CURSOR_SIGNAL_MAX_LENGTH,
  CURSOR_SIGNAL_MS: () => CURSOR_SIGNAL_MS,
  DECK_ROUTE: () => DECK_ROUTE,
  DEFAULT_COMMANDS: () => DEFAULT_COMMANDS,
  DEFAULT_COMMAND_CATALOGUE: () => DEFAULT_COMMAND_CATALOGUE,
  DEFAULT_HOME_URL: () => DEFAULT_HOME_URL,
  DEFAULT_PORT: () => DEFAULT_PORT,
  DESIGN_REQUESTS_FEATURE: () => DESIGN_REQUESTS_FEATURE,
  DESIGN_REQUESTS_REQUIRED: () => DESIGN_REQUESTS_REQUIRED,
  DESIGN_SECTIONS: () => DESIGN_SECTIONS,
  DESIGN_SYSTEM_AFTER: () => DESIGN_SYSTEM_AFTER,
  DESIGN_SYSTEM_LIMIT: () => DESIGN_SYSTEM_LIMIT,
  DESIGN_SYSTEM_ROLE: () => DESIGN_SYSTEM_ROLE,
  DESK_OF_PROP: () => DESK_OF_PROP,
  DOC_EXPORT_ROUTE: () => DOC_EXPORT_ROUTE,
  DOC_MIME: () => DOC_MIME,
  DOC_STATES: () => DOC_STATES,
  DOC_SYNCED_PROP: () => DOC_SYNCED_PROP,
  DOOR_ROUTE: () => DOOR_ROUTE,
  DRAWING_FILENAME: () => DRAWING_FILENAME,
  DRAWING_KIND: () => DRAWING_KIND,
  DRAWING_MIME: () => DRAWING_MIME,
  DRAWING_PROPERTIES: () => DRAWING_PROPERTIES,
  DRAWING_TITLE: () => DRAWING_TITLE,
  DTCG_EXTENSION: () => DTCG_EXTENSION,
  DTCG_SCHEMA: () => DTCG_SCHEMA,
  EMOJI_GROUPS: () => EMOJI_GROUPS,
  ENDED: () => ENDED,
  EXPORT_FORMAT: () => EXPORT_FORMAT,
  EXPORT_LAYOUT: () => EXPORT_LAYOUT,
  EXTENSION_ICONS: () => EXTENSION_ICONS,
  FIDELITY_PROP: () => FIDELITY_PROP,
  FILENAME_HEADER: () => FILENAME_HEADER,
  FILE_PROP: () => FILE_PROP,
  FORMAT_GAP_X: () => FORMAT_GAP_X,
  FORMAT_MODES: () => FORMAT_MODES,
  FREE_NAME_ROUTE: () => FREE_NAME_ROUTE,
  GOOGLE_DRIVE_ABOUT_URL: () => GOOGLE_DRIVE_ABOUT_URL,
  GRANTED_BY_HOME: () => GRANTED_BY_HOME,
  GRANTED_BY_MIGRATION: () => GRANTED_BY_MIGRATION,
  GROUND_MAX_BYTES: () => GROUND_MAX_BYTES,
  GROUND_PROP: () => GROUND_PROP,
  GROUND_SCRIM: () => GROUND_SCRIM,
  GROUPS_ROUTE: () => GROUPS_ROUTE,
  GROUP_DEFAULT_SIZE: () => GROUP_DEFAULT_SIZE,
  GROUP_ID_PREFIX: () => GROUP_ID_PREFIX,
  GROUP_NAME_MAX: () => GROUP_NAME_MAX,
  GROUP_NAME_TAKEN: () => GROUP_NAME_TAKEN,
  GROUP_NOT_FOUND: () => GROUP_NOT_FOUND,
  GroupConflictError: () => GroupConflictError,
  HOMES_ROUTE: () => HOMES_ROUTE,
  HOME_GC_ROUTE: () => HOME_GC_ROUTE,
  HOME_JOIN_ROUTE: () => HOME_JOIN_ROUTE,
  IDENTITY_COLORS: () => IDENTITY_COLORS,
  INBOX_ROUTE: () => INBOX_ROUTE,
  INK_PADDING: () => INK_PADDING,
  INK_PROP: () => INK_PROP,
  INSTALL_SPEC: () => INSTALL_SPEC,
  INTERNAL_OP_TYPES: () => INTERNAL_OP_TYPES,
  ISOCAN_NAMES: () => ISOCAN_NAMES,
  ITEM_KINDS: () => ITEM_KINDS,
  ITEM_ROUTE: () => ITEM_ROUTE,
  KEPT_AFTER_MS: () => KEPT_AFTER_MS,
  KIND_MARK_MIN: () => KIND_MARK_MIN,
  LABEL_LIMIT: () => LABEL_LIMIT,
  LENS_REFUSAL: () => LENS_REFUSAL,
  LENS_WINDOWS: () => LENS_WINDOWS,
  LINK: () => LINK,
  LISTEN_ANYONE: () => LISTEN_ANYONE,
  MAX_DIRECT_UPLOAD_BYTES: () => MAX_DIRECT_UPLOAD_BYTES,
  MEMORY_INHERIT: () => MEMORY_INHERIT,
  MEMORY_PERSONAL: () => MEMORY_PERSONAL,
  MEMORY_PROP: () => MEMORY_PROP,
  MODULE_API_VERSION: () => MODULE_API_VERSION,
  MODULE_PAGE_ROUTE: () => MODULE_PAGE_ROUTE,
  MigrationBoundaryError: () => MigrationBoundaryError,
  NET_REFUSAL_DEFAULT_MS: () => NET_REFUSAL_DEFAULT_MS,
  NEWS_ROUTE: () => NEWS_ROUTE,
  NOTE_FOR_PROP: () => NOTE_FOR_PROP,
  NOTE_GAP: () => NOTE_GAP,
  NOTE_HEIGHT: () => NOTE_HEIGHT,
  NOT_ADMITTED: () => NOT_ADMITTED,
  NOT_OPERATOR: () => NOT_OPERATOR,
  NOT_YOUR_BADGE: () => NOT_YOUR_BADGE,
  NOT_YOUR_RC_CODE: () => NOT_YOUR_RC_CODE,
  NO_ATTESTER: () => NO_ATTESTER,
  NO_OPERATOR: () => NO_OPERATOR,
  NO_OPERATOR_PROOF: () => NO_OPERATOR_PROOF,
  NO_RC_CODE: () => NO_RC_CODE,
  OPERATOR_API_PREFIX: () => OPERATOR_API_PREFIX,
  OPERATOR_END_ROUTE: () => OPERATOR_END_ROUTE,
  OPERATOR_LOG_ROUTE: () => OPERATOR_LOG_ROUTE,
  OPERATOR_LOOK_MS: () => OPERATOR_LOOK_MS,
  OPERATOR_LOOK_ROUTE: () => OPERATOR_LOOK_ROUTE,
  OPERATOR_PROOF_HEADER: () => OPERATOR_PROOF_HEADER,
  OPERATOR_PROOF_WINDOW_MS: () => OPERATOR_PROOF_WINDOW_MS,
  OPERATOR_PURGE_ROUTE: () => OPERATOR_PURGE_ROUTE,
  OPERATOR_REFUSE_ROUTE: () => OPERATOR_REFUSE_ROUTE,
  OPERATOR_REVOKE_ROUTE: () => OPERATOR_REVOKE_ROUTE,
  OPERATOR_SHOW_ROUTE: () => OPERATOR_SHOW_ROUTE,
  OPERATOR_TAKEDOWN_ROUTE: () => OPERATOR_TAKEDOWN_ROUTE,
  OpValidationError: () => OpValidationError,
  OplogFencedError: () => OplogFencedError,
  PANEL_ROLE: () => PANEL_ROLE,
  PANEL_SIDES: () => PANEL_SIDES,
  PAPERS: () => PAPERS,
  PAPER_PROP: () => PAPER_PROP,
  PAPER_SIZE: () => PAPER_SIZE,
  PARENT_PROP: () => PARENT_PROP,
  PARK_ADOPTED_CODE: () => PARK_ADOPTED_CODE,
  PASS_EXPIRED: () => PASS_EXPIRED,
  PASS_MINTER_ENDED: () => PASS_MINTER_ENDED,
  PASS_REDEEM_ROUTE: () => PASS_REDEEM_ROUTE,
  PASS_SPENT: () => PASS_SPENT,
  PASS_TTL_MS: () => PASS_TTL_MS,
  PASS_UNKNOWN: () => PASS_UNKNOWN,
  PERSONA_DIR: () => PERSONA_DIR,
  PERSONA_DOORWAY: () => PERSONA_DOORWAY,
  PERSON_HARNESSES: () => PERSON_HARNESSES,
  PHASES: () => PHASES,
  PLACEMENT_CLEARANCE: () => PLACEMENT_CLEARANCE,
  PLACEMENT_GAP: () => PLACEMENT_GAP,
  PREFERRED_OVER_PROP: () => PREFERRED_OVER_PROP,
  PRESENCE_WHERE_ROUTE: () => PRESENCE_WHERE_ROUTE,
  PROOF_STALE: () => PROOF_STALE,
  PROPOSED: () => PROPOSED,
  PROVE_PATH_PREFIX: () => PROVE_PATH_PREFIX,
  PUBLIC_CANVASES_ROUTE: () => PUBLIC_CANVASES_ROUTE,
  QUESTIONNAIRES_FEATURE: () => QUESTIONNAIRES_FEATURE,
  QUESTIONNAIRES_REQUIRED: () => QUESTIONNAIRES_REQUIRED,
  QUICK_REACTIONS: () => QUICK_REACTIONS,
  QUIET_AFTER_MS: () => QUIET_AFTER_MS,
  REFUSAL_LIMIT: () => REFUSAL_LIMIT,
  REFUSED: () => REFUSED,
  RENAMED_WIRE_KEYS: () => RENAMED_WIRE_KEYS,
  RUNGS: () => RUNGS,
  SEEN_ROUTE: () => SEEN_ROUTE,
  SERVING_ROUTE: () => SERVING_ROUTE,
  SHELF: () => SHELF,
  SHELVED_PROP: () => SHELVED_PROP,
  SHORTCUTS: () => SHORTCUTS,
  SHORTCUT_GROUPS: () => SHORTCUT_GROUPS,
  SIGN_BLOBS_LIMIT: () => SIGN_BLOBS_LIMIT,
  SIGN_BLOBS_PARAM: () => SIGN_BLOBS_PARAM,
  SIGN_BLOBS_ROUTE: () => SIGN_BLOBS_ROUTE,
  SKILL_INSTALL_COMMAND: () => SKILL_INSTALL_COMMAND,
  SLIDE_EMOJI: () => SLIDE_EMOJI,
  SLIDE_PROP: () => SLIDE_PROP,
  SLOP_RULES: () => SLOP_RULES,
  SOURCE_ACCESS_ROUTE: () => SOURCE_ACCESS_ROUTE,
  SOURCE_PATH_PROP: () => SOURCE_PATH_PROP,
  SOURCE_POLICY_HEADER: () => SOURCE_POLICY_HEADER,
  SOURCE_PROP: () => SOURCE_PROP,
  SPACES_ROUTE: () => SPACES_ROUTE,
  SPACE_NAME_MAX: () => SPACE_NAME_MAX,
  SPACE_NAME_TAKEN: () => SPACE_NAME_TAKEN,
  SPACE_NOT_FOUND: () => SPACE_NOT_FOUND,
  SPOKEN_COLOURS: () => SPOKEN_COLOURS,
  SPRINT_BOARD: () => SPRINT_BOARD,
  SPRINT_END: () => SPRINT_END,
  SPRINT_PROP: () => SPRINT_PROP,
  STALE_CLIENT_CODE: () => STALE_CLIENT_CODE,
  STALE_CLIENT_STATUS: () => STALE_CLIENT_STATUS,
  SYSTEM_ACTOR: () => SYSTEM_ACTOR,
  TAKEDOWNS_CANVAS_PARAM: () => TAKEDOWNS_CANVAS_PARAM,
  TAKEDOWNS_ROUTE: () => TAKEDOWNS_ROUTE,
  TAKEDOWN_REASONS: () => TAKEDOWN_REASONS,
  TAKEN_DOWN: () => TAKEN_DOWN,
  TEXT_ATTENTION_MS: () => TEXT_ATTENTION_MS,
  TEXT_COLUMN: () => TEXT_COLUMN,
  TEXT_COLUMN_MAX: () => TEXT_COLUMN_MAX,
  TEXT_FACES: () => TEXT_FACES,
  TEXT_FACE_PROP: () => TEXT_FACE_PROP,
  TEXT_FACE_SCALE: () => TEXT_FACE_SCALE,
  TEXT_FACE_STACK: () => TEXT_FACE_STACK,
  TEXT_FILENAME: () => TEXT_FILENAME,
  TEXT_KIND: () => TEXT_KIND,
  TEXT_MARK_MAX: () => TEXT_MARK_MAX,
  TEXT_MIME: () => TEXT_MIME,
  TEXT_PROPERTIES: () => TEXT_PROPERTIES,
  TEXT_SIZE: () => TEXT_SIZE,
  TEXT_STYLES: () => TEXT_STYLES,
  TEXT_STYLE_LABEL: () => TEXT_STYLE_LABEL,
  TEXT_STYLE_PROP: () => TEXT_STYLE_PROP,
  TEXT_STYLE_SIZE: () => TEXT_STYLE_SIZE,
  TEXT_WIDTH: () => TEXT_WIDTH,
  THEMES: () => THEMES,
  THEME_ANCHOR_PROP: () => THEME_ANCHOR_PROP,
  THEME_PROP: () => THEME_PROP,
  THREAD_QUERY: () => THREAD_QUERY,
  TITLE_LIMIT: () => TITLE_LIMIT,
  TOOL_ROLE: () => TOOL_ROLE,
  UNKNOWN_ROUTE: () => UNKNOWN_ROUTE,
  UnmergeableError: () => UnmergeableError,
  VIEW_ONLY: () => VIEW_ONLY,
  VISUAL_FILE_PROP: () => VISUAL_FILE_PROP,
  WITHDRAWN: () => WITHDRAWN,
  WORKBENCH_ITEM_ROUTE: () => WORKBENCH_ITEM_ROUTE,
  WORKBENCH_ROUTE: () => WORKBENCH_ROUTE,
  WS_BAD_ORIGIN: () => WS_BAD_ORIGIN,
  WS_BEHIND: () => WS_BEHIND,
  WS_CLOSE_REASON_BYTES: () => WS_CLOSE_REASON_BYTES,
  WS_NOT_ADMITTED: () => WS_NOT_ADMITTED,
  WS_NO_BADGE: () => WS_NO_BADGE,
  WS_NO_CANVAS: () => WS_NO_CANVAS,
  WS_STALE_CLIENT: () => WS_STALE_CLIENT,
  activityOpType: () => activityOpType,
  actorAliases: () => actorAliases,
  actorColor: () => actorColor,
  actorColors: () => actorColors,
  actorJoins: () => actorJoins,
  actorKinds: () => actorKinds,
  actorMarks: () => actorMarks,
  actorNameIn: () => actorNameIn,
  actorNames: () => actorNames,
  actorsAnswerTo: () => actorsAnswerTo,
  addableKind: () => addableKind,
  addableWords: () => addableWords,
  addressesActor: () => addressesActor,
  advanceSeen: () => advanceSeen,
  agentActorIds: () => agentActorIds,
  ago: () => ago,
  alignLabel: () => alignLabel,
  alignMoves: () => alignMoves,
  allocateName: () => allocateName,
  ambientContextItems: () => ambientContextItems,
  ambientContextManifest: () => ambientContextManifest,
  anchorOf: () => anchorOf,
  anchorOffset: () => anchorOffset,
  anchorPatch: () => anchorPatch,
  annotationProperties: () => annotationProperties,
  annotationRegion: () => annotationRegion,
  annotationTarget: () => annotationTarget,
  annotationTargetFor: () => annotationTargetFor,
  annotationsOf: () => annotationsOf,
  answerPolicy: () => answerPolicy,
  answeringExcerpt: () => answeringExcerpt,
  applePlatform: () => applePlatform,
  applyActorColor: () => applyActorColor,
  applyActorJoin: () => applyActorJoin,
  applyActorMark: () => applyActorMark,
  applyClaim: () => applyClaim,
  applyGroupChange: () => applyGroupChange,
  applyOperation: () => applyOperation,
  areaEnclosing: () => areaEnclosing,
  areaGrid: () => areaGrid,
  areaInner: () => areaInner,
  areaOf: () => areaOf,
  areaTint: () => areaTint,
  areaTintPatch: () => areaTintPatch,
  areasOf: () => areasOf,
  askTemplate: () => askTemplate,
  askTheDoor: () => askTheDoor,
  assetProblems: () => assetProblems,
  at: () => at,
  atCorner: () => atCorner,
  atLeast: () => atLeast,
  attestationSatisfying: () => attestationSatisfying,
  attestedKindOf: () => attestedKindOf,
  authActionOutcome: () => authActionOutcome,
  automaticCanvasTarget: () => automaticCanvasTarget,
  axisGrain: () => axisGrain,
  axisTicks: () => axisTicks,
  backingOf: () => backingOf,
  badgeEndNotice: () => badgeEndNotice,
  badgeRoute: () => badgeRoute,
  barSubjectRefusal: () => barSubjectRefusal,
  bearerHeader: () => bearerHeader,
  benchAgentOf: () => benchAgentOf,
  benchAgents: () => benchAgents,
  benchItemOf: () => benchItemOf,
  benchJoinAsk: () => benchJoinAsk,
  benchJoinRefusal: () => benchJoinRefusal,
  benchJoinWords: () => benchJoinWords,
  benchMentions: () => benchMentions,
  benchRows: () => benchRows,
  benchStandingWords: () => benchStandingWords,
  benchWords: () => benchWords,
  benchWriteFor: () => benchWriteFor,
  besideBox: () => besideBox,
  bindClaim: () => bindClaim,
  bindHandoff: () => bindHandoff,
  bindName: () => bindName,
  bindVerdict: () => bindVerdict,
  blobFileName: () => blobFileName,
  blobsInProperties: () => blobsInProperties,
  blobsNamedBy: () => blobsNamedBy,
  boardArea: () => boardArea,
  boardAreaFor: () => boardAreaFor,
  boardLayout: () => boardLayout,
  boardOf: () => boardOf,
  boundsOf: () => boundsOf,
  briefCard: () => briefCard,
  briefItem: () => briefItem,
  buildCorpus: () => buildCorpus,
  buildRecap: () => buildRecap,
  buildRecapHead: () => buildRecapHead,
  burnDown: () => burnDown,
  bySeverity: () => bySeverity,
  canListGrant: () => canListGrant,
  cancelledSince: () => cancelledSince,
  canonicalSection: () => canonicalSection,
  canvasContextRoute: () => canvasContextRoute,
  canvasCursorName: () => canvasCursorName,
  canvasGroupMigrationPreview: () => canvasGroupMigrationPreview,
  canvasIdFromBlob: () => canvasIdFromBlob,
  canvasIdOf: () => canvasIdOf,
  canvasItemOf: () => canvasItemOf,
  canvasPath: () => canvasPath,
  canvasScopes: () => canvasScopes,
  canvasUrl: () => canvasUrl,
  canvasUrlWithPass: () => canvasUrlWithPass,
  canvasesRoute: () => canvasesRoute,
  capabilityOf: () => capabilityOf,
  capabilityWord: () => capabilityWord,
  captureGroupExpectations: () => captureGroupExpectations,
  categoriseAsk: () => categoriseAsk,
  cellBox: () => cellBox,
  cellOf: () => cellOf,
  cellSpot: () => cellSpot,
  checkDesign: () => checkDesign,
  childrenOf: () => childrenOf,
  cidrContains: () => cidrContains,
  claimName: () => claimName,
  claimsActor: () => claimsActor,
  classifyAddable: () => classifyAddable,
  classifyToken: () => classifyToken,
  cleanFilePath: () => cleanFilePath,
  clipRecapLabel: () => clipRecapLabel,
  clockLabel: () => clockLabel,
  cloudAgentInstructions: () => cloudAgentInstructions,
  cmdKey: () => cmdKey,
  collectCanvasActors: () => collectCanvasActors,
  collectCanvasNames: () => collectCanvasNames,
  collectItemRefCandidates: () => collectItemRefCandidates,
  commandFileText: () => commandFileText,
  commentContextRoute: () => commentContextRoute,
  commentReferencedItemIds: () => commentReferencedItemIds,
  contextClosure: () => contextClosure,
  contextContentPage: () => contextContentPage,
  contextLayerKey: () => contextLayerKey,
  contextLayers: () => contextLayers,
  contextManifest: () => contextManifest,
  contextMark: () => contextMark,
  contextPieces: () => contextPieces,
  contextPinDecoration: () => contextPinDecoration,
  contextReport: () => contextReport,
  contextSheet: () => contextSheet,
  contextSheetSpot: () => contextSheetSpot,
  contextSourceOf: () => contextSourceOf,
  contextSourceProperty: () => contextSourceProperty,
  contrastRatio: () => contrastRatio,
  contributions: () => contributions,
  convergePlan: () => convergePlan,
  copiedContextItems: () => copiedContextItems,
  copyProperties: () => copyProperties,
  cursorChipLabel: () => cursorChipLabel,
  cursorLabel: () => cursorLabel,
  cursorOf: () => cursorOf,
  cursorPatch: () => cursorPatch,
  cursorSignal: () => cursorSignal,
  dayOf: () => dayOf,
  deck: () => deck,
  deckFilename: () => deckFilename,
  deckHtml: () => deckHtml,
  deckPages: () => deckPages,
  deckPath: () => deckPath,
  deckStep: () => deckStep,
  deckUrl: () => deckUrl,
  decodeFilename: () => decodeFilename,
  decodeHandoff: () => decodeHandoff,
  defaultSize: () => defaultSize,
  describeExportedCanvas: () => describeExportedCanvas,
  describeLosses: () => describeLosses,
  designConversionNotes: () => designConversionNotes,
  designScopeStanding: () => designScopeStanding,
  designSkipPatch: () => designSkipPatch,
  designSkipped: () => designSkipped,
  designStanding: () => designStanding,
  designSystem: () => designSystem,
  designSystemProperties: () => designSystemProperties,
  designTargetScopes: () => designTargetScopes,
  designUnskipPatch: () => designUnskipPatch,
  deskOf: () => deskOf,
  deskTitle: () => deskTitle,
  detectFormat: () => detectFormat,
  dispatchReason: () => dispatchReason,
  distributeMoves: () => distributeMoves,
  docFilenameFrom: () => docFilenameFrom,
  docProperties: () => docProperties,
  docStale: () => docStale,
  docStatus: () => docStatus,
  docSyncedAt: () => docSyncedAt,
  docTitleFrom: () => docTitleFrom,
  drawingProperties: () => drawingProperties,
  drawingSvg: () => drawingSvg,
  drawingViewBox: () => drawingViewBox,
  dtcgColorString: () => dtcgColorString,
  dtcgDimensionString: () => dtcgDimensionString,
  duplicatePlacements: () => duplicatePlacements,
  editableText: () => editableText,
  elapsedLabel: () => elapsedLabel,
  emojiName: () => emojiName,
  emptyActorRegistry: () => emptyActorRegistry,
  emptyCanvas: () => emptyCanvas,
  encodeFilename: () => encodeFilename,
  encodeHandoff: () => encodeHandoff,
  endedSentence: () => endedSentence,
  enginesSatisfied: () => enginesSatisfied,
  excludedItems: () => excludedItems,
  extensionFor: () => extensionFor,
  extensionOf: () => extensionOf,
  extractItemRefs: () => extractItemRefs,
  extractMentions: () => extractMentions,
  faceMark: () => faceMark,
  fileOf: () => fileOf,
  filenameFromTitle: () => filenameFromTitle,
  filenamesInUse: () => filenamesInUse,
  filterCanvases: () => filterCanvases,
  filterLens: () => filterLens,
  findArea: () => findArea,
  findCommand: () => findCommand,
  findCommandSpans: () => findCommandSpans,
  findItemRefSpans: () => findItemRefSpans,
  findMentionSpans: () => findMentionSpans,
  fitMoves: () => fitMoves,
  formatBadgeToken: () => formatBadgeToken,
  formatBytes: () => formatBytes,
  formatContextSource: () => formatContextSource,
  formatDotToken: () => formatDotToken,
  formatMoves: () => formatMoves,
  formatPassToken: () => formatPassToken,
  formatRecapHead: () => formatRecapHead,
  formatScope: () => formatScope,
  frameVerdict: () => frameVerdict,
  freeSpotIn: () => freeSpotIn,
  fromDtcg: () => fromDtcg,
  fuzzyMatch: () => fuzzyMatch,
  gateSetAside: () => gateSetAside,
  goalLine: () => goalLine,
  googleDocExportUrl: () => googleDocExportUrl,
  googleDocId: () => googleDocId,
  googleDocPreviewUrl: () => googleDocPreviewUrl,
  googleDocUrl: () => googleDocUrl,
  googleDriveExportUrl: () => googleDriveExportUrl,
  googleDriveMetaUrl: () => googleDriveMetaUrl,
  governingDesign: () => governingDesign,
  grantRevokeRoute: () => grantRevokeRoute,
  grantRoute: () => grantRoute,
  grantSubjectOf: () => grantSubjectOf,
  grantSubjectRefusal: () => grantSubjectRefusal,
  grantsRoute: () => grantsRoute,
  gridPatch: () => gridPatch,
  groundIsPlace: () => groundIsPlace,
  groundOf: () => groundOf,
  groundPatch: () => groundPatch,
  groupActingRoute: () => groupActingRoute,
  groupAncestors: () => groupAncestors,
  groupArrangeAction: () => groupArrangeAction,
  groupCellBox: () => groupCellBox,
  groupChangeItemIds: () => groupChangeItemIds,
  groupChildren: () => groupChildren,
  groupContentBox: () => groupContentBox,
  groupCopyAction: () => groupCopyAction,
  groupCopySource: () => groupCopySource,
  groupDescendants: () => groupDescendants,
  groupDropPolicy: () => groupDropPolicy,
  groupDropTarget: () => groupDropTarget,
  groupFitAction: () => groupFitAction,
  groupFitBox: () => groupFitBox,
  groupFrameMinimum: () => groupFrameMinimum,
  groupGridNeedsRoom: () => groupGridNeedsRoom,
  groupIdOf: () => groupIdOf,
  groupMemberRefusal: () => groupMemberRefusal,
  groupMemberRoute: () => groupMemberRoute,
  groupNameRefusal: () => groupNameRefusal,
  groupPlacement: () => groupPlacement,
  groupPreviewBoxes: () => groupPreviewBoxes,
  groupRemoveAction: () => groupRemoveAction,
  groupResizeBox: () => groupResizeBox,
  groupResizeMinimum: () => groupResizeMinimum,
  groupRestorePreview: () => groupRestorePreview,
  groupRoute: () => groupRoute,
  groupScopeRoots: () => groupScopeRoots,
  groupScopedRoot: () => groupScopedRoot,
  groupSelectionRoots: () => groupSelectionRoots,
  groupSubject: () => groupSubject,
  groupSwitchRows: () => groupSwitchRows,
  groupTransform: () => groupTransform,
  groupTransformClosure: () => groupTransformClosure,
  groupViewOf: () => groupViewOf,
  groupWrapAction: () => groupWrapAction,
  handInPatch: () => handInPatch,
  handedInFor: () => handedInFor,
  harnessOf: () => harnessOf,
  harvestConverge: () => harvestConverge,
  harvestPreferences: () => harvestPreferences,
  hasDistinctVisualFace: () => hasDistinctVisualFace,
  hasGround: () => hasGround,
  hasReacted: () => hasReacted,
  healthPath: () => healthPath,
  hidesVotes: () => hidesVotes,
  highest: () => highest,
  importDesign: () => importDesign,
  importedBody: () => importedBody,
  inArea: () => inArea,
  inCanvasScope: () => inCanvasScope,
  inForce: () => inForce,
  inScope: () => inScope,
  inboxLine: () => inboxLine,
  inboxNewestFirst: () => inboxNewestFirst,
  inboxOn: () => inboxOn,
  inboxRoute: () => inboxRoute,
  inboxTally: () => inboxTally,
  inheritedPieces: () => inheritedPieces,
  inkBounds: () => inkBounds,
  inkColour: () => inkColour,
  inkFromSvg: () => inkFromSvg,
  inkPath: () => inkPath,
  invertGroupChange: () => invertGroupChange,
  invertOperation: () => invertOperation,
  isAgentHarness: () => isAgentHarness,
  isAnnotation: () => isAnnotation,
  isArea: () => isArea,
  isBar: () => isBar,
  isBesideSide: () => isBesideSide,
  isBuiltinKind: () => isBuiltinKind,
  isCanvasItem: () => isCanvasItem,
  isCanvasRecord: () => isCanvasRecord,
  isCanvasSort: () => isCanvasSort,
  isCapability: () => isCapability,
  isCursor: () => isCursor,
  isDataOnly: () => isDataOnly,
  isDesignSystem: () => isDesignSystem,
  isDrawingItem: () => isDrawingItem,
  isFaceMark: () => isFaceMark,
  isFormatMode: () => isFormatMode,
  isFramedItem: () => isFramedItem,
  isGoogleDocItem: () => isGoogleDocItem,
  isGrantListingDecision: () => isGrantListingDecision,
  isGroupItem: () => isGroupItem,
  isGroupLive: () => isGroupLive,
  isGroupSubject: () => isGroupSubject,
  isIdentityColor: () => isIdentityColor,
  isListedGrant: () => isListedGrant,
  isLive: () => isLive,
  isLoopbackBase: () => isLoopbackBase,
  isNote: () => isNote,
  isOpId: () => isOpId,
  isPanelExtension: () => isPanelExtension,
  isPaper: () => isPaper,
  isRefusal: () => isRefusal,
  isShelved: () => isShelved,
  isSlide: () => isSlide,
  isSpaceGrant: () => isSpaceGrant,
  isSpaceLive: () => isSpaceLive,
  isSystemActor: () => isSystemActor,
  isTakedownReason: () => isTakedownReason,
  isTextItem: () => isTextItem,
  isTheme: () => isTheme,
  isToolExtension: () => isToolExtension,
  isWireframeScreen: () => isWireframeScreen,
  itemColour: () => itemColour,
  itemKind: () => itemKind,
  itemKinds: () => itemKinds,
  itemPath: () => itemPath,
  itemThread: () => itemThread,
  itemUrl: () => itemUrl,
  itemsIn: () => itemsIn,
  itemsTouchedBy: () => itemsTouchedBy,
  itemsWearing: () => itemsWearing,
  keyFor: () => keyFor,
  kindFamily: () => kindFamily,
  landingsOf: () => landingsOf,
  laneFor: () => laneFor,
  laneOf: () => laneOf,
  lapsedFor: () => lapsedFor,
  latelyOrder: () => latelyOrder,
  latestCancel: () => latestCancel,
  layersReport: () => layersReport,
  lensActs: () => lensActs,
  lensEntries: () => lensEntries,
  lensGroups: () => lensGroups,
  lensKinds: () => lensKinds,
  lensLive: () => lensLive,
  lensLiveList: () => lensLiveList,
  lensLiveWords: () => lensLiveWords,
  lensShape: () => lensShape,
  lensStanding: () => lensStanding,
  lensSubjectLabels: () => lensSubjectLabels,
  lensSubjects: () => lensSubjects,
  lineageProperties: () => lineageProperties,
  linkedCanvasId: () => linkedCanvasId,
  listenGrants: () => listenGrants,
  listenUntil: () => listenUntil,
  listenWords: () => listenWords,
  listeners: () => listeners,
  listensTo: () => listensTo,
  litRuns: () => litRuns,
  localAgentInstructions: () => localAgentInstructions,
  looksLikeSite: () => looksLikeSite,
  loopbackRefusal: () => loopbackRefusal,
  luminance: () => luminance,
  mainThread: () => mainThread,
  majorLine: () => majorLine,
  majorWhat: () => majorWhat,
  majors: () => majors,
  makeTextAnchor: () => makeTextAnchor,
  manifestRecord: () => manifestRecord,
  markLabel: () => markLabel,
  markOf: () => markOf,
  markPatch: () => markPatch,
  markdownResource: () => markdownResource,
  markedItems: () => markedItems,
  matchCommands: () => matchCommands,
  mayWake: () => mayWake,
  memoryLinks: () => memoryLinks,
  memoryOf: () => memoryOf,
  memoryPatch: () => memoryPatch,
  mergeCommands: () => mergeCommands,
  mergeDrawings: () => mergeDrawings,
  mergeSeen: () => mergeSeen,
  mimeFromName: () => mimeFromName,
  modifierClick: () => modifierClick,
  moduleAsset: () => moduleAsset,
  moduleBase: () => moduleBase,
  moduleCommands: () => moduleCommands,
  moduleContextPieces: () => moduleContextPieces,
  moduleEdges: () => moduleEdges,
  moduleKindOf: () => moduleKindOf,
  moduleKinds: () => moduleKinds,
  modulePagePath: () => modulePagePath,
  modulePageUrl: () => modulePageUrl,
  moduleSlug: () => moduleSlug,
  moduleWebPath: () => moduleWebPath,
  modules: () => modules,
  movedSince: () => movedSince,
  namesFor: () => namesFor,
  narrowed: () => narrowed,
  nearestFreeSpot: () => nearestFreeSpot,
  needsDesignSystem: () => needsDesignSystem,
  newActorId: () => newActorId,
  newCanvasId: () => newCanvasId,
  newClientId: () => newClientId,
  newCommentId: () => newCommentId,
  newGroupId: () => newGroupId,
  newId: () => newId,
  newItemId: () => newItemId,
  newOpId: () => newOpId,
  newSince: () => newSince,
  newThreadId: () => newThreadId,
  newVersionId: () => newVersionId,
  newestDay: () => newestDay,
  news: () => news,
  noCursorPatch: () => noCursorPatch,
  noGroundPatch: () => noGroundPatch,
  noThemePatch: () => noThemePatch,
  normalizeAttribute: () => normalizeAttribute,
  normalizeHomeUrl: () => normalizeHomeUrl,
  normalizeSiteUrl: () => normalizeSiteUrl,
  normalizeSubject: () => normalizeSubject,
  notBothActors: () => notBothActors,
  notYourActor: () => notYourActor,
  noteFor: () => noteFor,
  noteProperties: () => noteProperties,
  noteSpot: () => noteSpot,
  noteTarget: () => noteTarget,
  notesMarkdown: () => notesMarkdown,
  notesOn: () => notesOn,
  noticeOf: () => noticeOf,
  opMatchesFilters: () => opMatchesFilters,
  opTouchesAreas: () => opTouchesAreas,
  opTypeMatches: () => opTypeMatches,
  opWords: () => opWords,
  openAsk: () => openAsk,
  openAsks: () => openAsks,
  operatorLookUrl: () => operatorLookUrl,
  operatorTurnedOff: () => operatorTurnedOff,
  opsTouching: () => opsTouching,
  overlaps: () => overlaps,
  ownerOf: () => ownerOf,
  ownersWord: () => ownersWord,
  ownsCanvas: () => ownsCanvas,
  ownsGroup: () => ownsGroup,
  ownsSpace: () => ownsSpace,
  panelCapabilities: () => panelCapabilities,
  panelExtensionItems: () => panelExtensionItems,
  panelProperties: () => panelProperties,
  paperLabel: () => paperLabel,
  paperOf: () => paperOf,
  paperPatch: () => paperPatch,
  parentOf: () => parentOf,
  parseBadgeToken: () => parseBadgeToken,
  parseBound: () => parseBound,
  parseCanvasAddress: () => parseCanvasAddress,
  parseCidr: () => parseCidr,
  parseCommandFile: () => parseCommandFile,
  parseContextSource: () => parseContextSource,
  parseDesign: () => parseDesign,
  parseDimension: () => parseDimension,
  parseDotToken: () => parseDotToken,
  parseDuration: () => parseDuration,
  parseExportTarget: () => parseExportTarget,
  parseFrontMatter: () => parseFrontMatter,
  parseHex: () => parseHex,
  parseItemAddress: () => parseItemAddress,
  parseListen: () => parseListen,
  parsePassToken: () => parsePassToken,
  parsePersona: () => parsePersona,
  parseRefusalDuration: () => parseRefusalDuration,
  parseSlashCommand: () => parseSlashCommand,
  parseSourcePolicyHeader: () => parseSourcePolicyHeader,
  parseSprintCommand: () => parseSprintCommand,
  parseSrgb: () => parseSrgb,
  parseUriList: () => parseUriList,
  passExpired: () => passExpired,
  passRoute: () => passRoute,
  passesContrast: () => passesContrast,
  passesRoute: () => passesRoute,
  past: () => past,
  personaWarnings: () => personaWarnings,
  personalCanvasItemOf: () => personalCanvasItemOf,
  personalCanvasRoute: () => personalCanvasRoute,
  personalContributions: () => personalContributions,
  personalDelegatesRoute: () => personalDelegatesRoute,
  personalMemoryLinks: () => personalMemoryLinks,
  personalRoute: () => personalRoute,
  phaseOver: () => phaseOver,
  phaseSpec: () => phaseSpec,
  pinnedItems: () => pinnedItems,
  policyWords: () => policyWords,
  positionIsMeaningful: () => positionIsMeaningful,
  preferPatch: () => preferPatch,
  preferences: () => preferences,
  preferredOver: () => preferredOver,
  preparedGroupCreation: () => preparedGroupCreation,
  provePath: () => provePath,
  proveSegmentIn: () => proveSegmentIn,
  pruneVersions: () => pruneVersions,
  prunedVersions: () => prunedVersions,
  publicListingRoute: () => publicListingRoute,
  purgeNeedsTakedown: () => purgeNeedsTakedown,
  quoteRange: () => quoteRange,
  rankCanvases: () => rankCanvases,
  rcAnsweringRoute: () => rcAnsweringRoute,
  rcAskRoute: () => rcAskRoute,
  reactionGroups: () => reactionGroups,
  reactionPointsOf: () => reactionPointsOf,
  reactionsOf: () => reactionsOf,
  readCssTokens: () => readCssTokens,
  readPanelExtension: () => readPanelExtension,
  readToolExtension: () => readToolExtension,
  readingOrder: () => readingOrder,
  readsAsTurnedAway: () => readsAsTurnedAway,
  reasonFor: () => reasonFor,
  recapHeadRoute: () => recapHeadRoute,
  recentActivity: () => recentActivity,
  referencesIn: () => referencesIn,
  refusalInForce: () => refusalInForce,
  refusalNoticeOf: () => refusalNoticeOf,
  refusalSentence: () => refusalSentence,
  refusalSubjectOf: () => refusalSubjectOf,
  refusalSubjectRefusal: () => refusalSubjectRefusal,
  refusalUntil: () => refusalUntil,
  refusedContributions: () => refusedContributions,
  refusedMentions: () => refusedMentions,
  regionOf: () => regionOf,
  registerModule: () => registerModule,
  registerModuleBase: () => registerModuleBase,
  rejectPublicContext: () => rejectPublicContext,
  remainingSeconds: () => remainingSeconds,
  renamedFilename: () => renamedFilename,
  renderKeys: () => renderKeys,
  replicasHorizon: () => replicasHorizon,
  resolveActor: () => resolveActor,
  resolveCanvasGroupMigration: () => resolveCanvasGroupMigration,
  resolveCanvasGroupRequest: () => resolveCanvasGroupRequest,
  resolveContextOperation: () => resolveContextOperation,
  resolveGroupOperation: () => resolveGroupOperation,
  resolvePlacement: () => resolvePlacement,
  resolveSourcePinPiece: () => resolveSourcePinPiece,
  resolveTextAnchor: () => resolveTextAnchor,
  resolveToken: () => resolveToken,
  revokedSentence: () => revokedSentence,
  roster: () => roster,
  roundRunning: () => roundRunning,
  roundsOn: () => roundsOn,
  rulesOf: () => rulesOf,
  runFindings: () => runFindings,
  sameActor: () => sameActor,
  sameGroupName: () => sameGroupName,
  sameSpaceName: () => sameSpaceName,
  scopeOf: () => scopeOf,
  scopedDesignSystems: () => scopedDesignSystems,
  searchEmoji: () => searchEmoji,
  seenMarksRoute: () => seenMarksRoute,
  seenRoute: () => seenRoute,
  selectDesignSystem: () => selectDesignSystem,
  selectGoverningDesign: () => selectGoverningDesign,
  serializeDesign: () => serializeDesign,
  sessionState: () => sessionState,
  setupCommand: () => setupCommand,
  shelvePatch: () => shelvePatch,
  shelvedAt: () => shelvedAt,
  shiftKey: () => shiftKey,
  shortcut: () => shortcut,
  shortcutsAsText: () => shortcutsAsText,
  shortcutsIn: () => shortcutsIn,
  siteFilename: () => siteFilename,
  siteLabel: () => siteLabel,
  skillNameFrom: () => skillNameFrom,
  skillSource: () => skillSource,
  slideIntent: () => slideIntent,
  slidePatch: () => slidePatch,
  slides: () => slides,
  slopRulesAsText: () => slopRulesAsText,
  sortCanvases: () => sortCanvases,
  sourceClassificationRoute: () => sourceClassificationRoute,
  sourceFaceOf: () => sourceFaceOf,
  sourceOf: () => sourceOf,
  sourcePinPieces: () => sourcePinPieces,
  sourcePolicyHeader: () => sourcePolicyHeader,
  spaceActingRoute: () => spaceActingRoute,
  spaceCanvasRoute: () => spaceCanvasRoute,
  spaceGrantRevokeRoute: () => spaceGrantRevokeRoute,
  spaceGrantRoute: () => spaceGrantRoute,
  spaceGrantsRoute: () => spaceGrantsRoute,
  spaceLinkRoute: () => spaceLinkRoute,
  spaceNameRefusal: () => spaceNameRefusal,
  spaceRoute: () => spaceRoute,
  span: () => span,
  speakersFor: () => speakersFor,
  spellListen: () => spellListen,
  splitFrontMatter: () => splitFrontMatter,
  splitPassFragment: () => splitPassFragment,
  spokenColour: () => spokenColour,
  sprintState: () => sprintState,
  staleClientRefusal: () => staleClientRefusal,
  standingWords: () => standingWords,
  standings: () => standings,
  statusProblems: () => statusProblems,
  subjectShown: () => subjectShown,
  summonedBy: () => summonedBy,
  summonsLine: () => summonsLine,
  summonsState: () => summonsState,
  supportsCanvasGroups: () => supportsCanvasGroups,
  supportsDesignDecisions: () => supportsDesignDecisions,
  supportsDesignRepairs: () => supportsDesignRepairs,
  supportsDesignRequests: () => supportsDesignRequests,
  supportsQuestionnaires: () => supportsQuestionnaires,
  takedownDate: () => takedownDate,
  takedownDateShort: () => takedownDateShort,
  takedownReasonList: () => takedownReasonList,
  takedownSentence: () => takedownSentence,
  takenSentence: () => takenSentence,
  tally: () => tally,
  tallyOutcomes: () => tallyOutcomes,
  textAttention: () => textAttention,
  textBox: () => textBox,
  textDrawSize: () => textDrawSize,
  textFaceLabel: () => textFaceLabel,
  textFaceOf: () => textFaceOf,
  textIsLegible: () => textIsLegible,
  textMarkSize: () => textMarkSize,
  textSizeOf: () => textSizeOf,
  textStyleFrom: () => textStyleFrom,
  textStyleOf: () => textStyleOf,
  textTitle: () => textTitle,
  themeCursorName: () => themeCursorName,
  themeLabel: () => themeLabel,
  themeOf: () => themeOf,
  themePatch: () => themePatch,
  threadPath: () => threadPath,
  threadSummonses: () => threadSummonses,
  titleRoom: () => titleRoom,
  toCss: () => toCss,
  toDtcg: () => toDtcg,
  toJsonCanvas: () => toJsonCanvas,
  toolCapabilities: () => toolCapabilities,
  toolExtensionItems: () => toolExtensionItems,
  toolProperties: () => toolProperties,
  track: () => track,
  turnedAway: () => turnedAway,
  turnedAwayLine: () => turnedAwayLine,
  undoneSeqs: () => undoneSeqs,
  uniqueFilename: () => uniqueFilename,
  unknownOperation: () => unknownOperation,
  unknownProposals: () => unknownProposals,
  unpreferPatch: () => unpreferPatch,
  unregisterModule: () => unregisterModule,
  unresolvedReferences: () => unresolvedReferences,
  unseen: () => unseen,
  unshelvePatch: () => unshelvePatch,
  untilWords: () => untilWords,
  upsertAttestation: () => upsertAttestation,
  urlWithPass: () => urlWithPass,
  validateContextManifest: () => validateContextManifest,
  validateGroupForest: () => validateGroupForest,
  validateTextAnchor: () => validateTextAnchor,
  visualFaceOf: () => visualFaceOf,
  visualFileOf: () => visualFileOf,
  waitingLine: () => waitingLine,
  wallFor: () => wallFor,
  weightOf: () => weightOf,
  withBaseline: () => withBaseline,
  withLanding: () => withLanding,
  withListener: () => withListener,
  withModuleCommands: () => withModuleCommands,
  withoutDesignRole: () => withoutDesignRole,
  wokenLine: () => wokenLine,
  workbenchItemPath: () => workbenchItemPath,
  workbenchPath: () => workbenchPath,
  workbenchUrl: () => workbenchUrl,
  workedFor: () => workedFor,
  workersOn: () => workersOn
});

// packages/core/src/model.ts
var SYSTEM_ACTOR = { id: "sys_isocan", name: "isocan" };
function isSystemActor(actorId) {
  return actorId.startsWith("sys_");
}
function visualFaceOf(version) {
  if (version.visual) {
    return {
      blobHash: version.visual.blobHash,
      mimeType: version.visual.mimeType,
      filename: version.visual.filename ?? version.filename,
      size: version.visual.size ?? version.size
    };
  }
  return {
    blobHash: version.blobHash,
    mimeType: version.mimeType,
    filename: version.filename,
    size: version.size
  };
}
function sourceFaceOf(version) {
  return {
    blobHash: version.blobHash,
    mimeType: version.mimeType,
    filename: version.filename,
    size: version.size
  };
}
function hasDistinctVisualFace(version) {
  return version.visual !== void 0 && version.visual.blobHash !== version.blobHash;
}
function emptyCanvas() {
  return { items: {}, threads: {}, trash: [], agents: {} };
}
function mainThread(canvas) {
  return Object.values(canvas.threads).find((thread) => thread.main) ?? null;
}

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

// packages/core/src/errors.ts
var REFUSED = "refused";
var ApiError = class extends Error {
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
var OpValidationError = class extends Error {
  constructor(code, message, reason) {
    super(message);
    this.code = code;
    this.reason = reason;
    this.name = "OpValidationError";
  }
  code;
  reason;
};
var GroupConflictError = class extends OpValidationError {
  constructor(message) {
    super("group-conflict", message);
    this.name = "GroupConflictError";
  }
};
var MigrationBoundaryError = class extends OpValidationError {
  constructor(message) {
    super("migration-boundary", message);
    this.name = "MigrationBoundaryError";
  }
};
var OplogFencedError = class extends Error {
  constructor(canvasId, seq, message) {
    super(message ?? `another writer already holds seq ${seq} on ${canvasId}`);
    this.canvasId = canvasId;
    this.seq = seq;
    this.name = "OplogFencedError";
  }
  canvasId;
  seq;
  code = "writer-fenced";
};
function unknownOperation(op) {
  const type = op.type;
  throw new OpValidationError("unknown-op", `unknown operation: ${String(type)}`);
}

// packages/core/src/drawing.ts
var DRAWING_MIME = "image/svg+xml";
var DRAWING_FILENAME = "sketch.svg";
var DRAWING_TITLE = "Sketch";
var DRAWING_KIND = "drawing";
var DRAWING_PROPERTIES = { kind: DRAWING_KIND };
var INK_PROP = "ink";
var INK_PADDING = 8;
var INK_FALLBACK_COLOR = "#23262b";
function drawingViewBox(svg) {
  const match = /viewBox\s*=\s*"([-\d.eE\s,]+)"/.exec(svg);
  if (!match) return null;
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, width, height] = parts;
  if (width <= 0 || height <= 0) return null;
  return { minX: x, minY: y, maxX: x + width, maxY: y + height };
}
function isDrawingItem(item) {
  return item.properties.kind === DRAWING_KIND;
}
function r(value) {
  return Math.round(value * 100) / 100;
}
function inkBounds(strokes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    const reach = stroke.width / 2;
    for (const point of stroke.points) {
      minX = Math.min(minX, point.x - reach);
      minY = Math.min(minY, point.y - reach);
      maxX = Math.max(maxX, point.x + reach);
      maxY = Math.max(maxY, point.y + reach);
    }
  }
  if (minX === Infinity) return null;
  return {
    minX: minX - INK_PADDING,
    minY: minY - INK_PADDING,
    maxX: maxX + INK_PADDING,
    maxY: maxY + INK_PADDING
  };
}
function inkPath(points) {
  if (points.length === 0) return "";
  const first = points[0];
  if (points.length === 1) return `M ${r(first.x)} ${r(first.y)} l 0.01 0`;
  if (points.length === 2) {
    const second = points[1];
    return `M ${r(first.x)} ${r(first.y)} L ${r(second.x)} ${r(second.y)}`;
  }
  let d = `M ${r(first.x)} ${r(first.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const control = points[i];
    const next = points[i + 1];
    d += ` Q ${r(control.x)} ${r(control.y)} ${r((control.x + next.x) / 2)} ${r((control.y + next.y) / 2)}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${r(last.x)} ${r(last.y)}`;
}
function inkFromSvg(svg) {
  const strokes = [];
  for (const [element] of svg.matchAll(/<path\b[^>]*\/>/g)) {
    const colour = /\bstroke="([^"]*)"/.exec(element)?.[1];
    if (colour === void 0) continue;
    const width = Number(/\bstroke-width="([^"]*)"/.exec(element)?.[1] ?? "1");
    const d = /\bd="([^"]*)"/.exec(element)?.[1];
    if (d === void 0) continue;
    const points = inkPoints(d);
    if (points.length === 0) continue;
    strokes.push({ points, color: colour, width: Number.isFinite(width) ? width : 1 });
  }
  return strokes;
}
function inkPoints(d) {
  if (/^\s*M\s+(-?[\d.]+)\s+(-?[\d.]+)\s+l\s+[\d.]+\s+[\d.]+\s*$/.test(d)) {
    const dot = /^\s*M\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(d);
    return [{ x: Number(dot[1]), y: Number(dot[2]) }];
  }
  const points = [];
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  const take = () => {
    const x = Number(tokens[i++]);
    const y = Number(tokens[i++]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  };
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === "Q") i += 2;
    else if (command !== "M" && command !== "L") return points;
    const point = take();
    if (!point) return points;
    points.push(point);
  }
  return points;
}
function safeColor(color) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : INK_FALLBACK_COLOR;
}
function drawingSvg(strokes, bounds) {
  const width = r(bounds.maxX - bounds.minX);
  const height = r(bounds.maxY - bounds.minY);
  const paths = strokes.filter((stroke) => stroke.points.length > 0).map(
    (stroke) => `  <path d="${inkPath(stroke.points)}" fill="none" stroke="${safeColor(stroke.color)}" stroke-width="${r(stroke.width)}" stroke-linecap="round" stroke-linejoin="round"/>`
  ).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${r(bounds.minX)} ${r(bounds.minY)} ${width} ${height}">
${paths}
</svg>
`;
}

// packages/core/src/annotation.ts
var ANNOTATES_PROP = "annotates";
var REGION_PROP = "region";
function regionOf(ink, target) {
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const width = Math.max(target.width, 1);
  const height = Math.max(target.height, 1);
  const x = clamp((ink.x - target.x) / width);
  const y = clamp((ink.y - target.y) / height);
  return {
    x: Number(x.toFixed(3)),
    y: Number(y.toFixed(3)),
    width: Number((clamp((ink.x + ink.width - target.x) / width) - x).toFixed(3)),
    height: Number((clamp((ink.y + ink.height - target.y) / height) - y).toFixed(3))
  };
}
function annotationProperties(targetId, region) {
  return {
    [ANNOTATES_PROP]: targetId,
    [REGION_PROP]: `${region.x},${region.y},${region.width},${region.height}`
  };
}
function annotationTarget(item) {
  const target = item.properties[ANNOTATES_PROP];
  return isDrawingItem(item) && target ? target : null;
}
function isAnnotation(item) {
  return annotationTarget(item) !== null;
}
function annotationRegion(item) {
  const raw = item.properties[REGION_PROP];
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}
function annotationsOf(canvas, itemId) {
  return Object.values(canvas.items).filter((item) => annotationTarget(item) === itemId);
}
function annotationTargetFor(ink, candidates, minimumShare = 0.6) {
  const inkArea = Math.max(ink.width * ink.height, 1);
  let best = null;
  for (const item of candidates) {
    if (isDrawingItem(item)) continue;
    const overlapW = Math.min(ink.x + ink.width, item.x + item.width) - Math.max(ink.x, item.x);
    const overlapH = Math.min(ink.y + ink.height, item.y + item.height) - Math.max(ink.y, item.y);
    if (overlapW <= 0 || overlapH <= 0) continue;
    const share = overlapW * overlapH / inkArea;
    if (share >= minimumShare && (!best || share > best.share)) best = { item, share };
  }
  return best?.item ?? null;
}

// packages/core/src/canvas-group-context.ts
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var bad = (message) => {
  throw new OpValidationError("bad-op", message);
};
var ids = (value) => Array.isArray(value) && value.length <= 1e5 && value.every((id) => typeof id === "string" && id.length > 0);
var unique = (values) => [...new Set(values)];
function contextClosure(canvas, rootIds) {
  const children = /* @__PURE__ */ new Map();
  const annotations = /* @__PURE__ */ new Map();
  const append = (index, key, item) => {
    const rows = index.get(key);
    if (rows) rows.push(item);
    else index.set(key, [item]);
  };
  for (const item of Object.values(canvas.items)) {
    if (item.containerId) append(children, item.containerId, item);
    const target = annotationTarget(item);
    if (target) append(annotations, target, item);
  }
  const order = (items) => items.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  for (const rows of [...children.values(), ...annotations.values()]) order(rows);
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  const visit = (id, depth) => {
    if (seen.has(id)) return;
    seen.add(id);
    result.push({ itemId: id, depth });
    const item = canvas.items[id];
    if (!item) return;
    for (const mark of annotations.get(id) ?? []) visit(mark.id, depth);
    if (item.properties?.kind === "group") for (const child of children.get(id) ?? []) visit(child.id, depth + 1);
  };
  const selected = new Set(rootIds);
  const covered = (id) => {
    const item = canvas.items[id];
    if (!item) return false;
    const target = annotationTarget(item);
    if (target && target !== id && selected.has(target)) return true;
    let parent = item.containerId;
    const visited = /* @__PURE__ */ new Set([id]);
    while (parent && !visited.has(parent)) {
      if (selected.has(parent)) return true;
      visited.add(parent);
      parent = canvas.items[parent]?.containerId;
    }
    return false;
  };
  for (const id of unique(rootIds).filter((id2) => !covered(id2))) visit(id, 0);
  return result;
}
function excludedInAmbient(canvas, item) {
  const visited = /* @__PURE__ */ new Set();
  let current2 = item;
  while (current2 && !visited.has(current2.id)) {
    visited.add(current2.id);
    if (current2.properties?.context === "excluded") return true;
    current2 = current2.containerId ? canvas.items[current2.containerId] : void 0;
  }
  return false;
}
function ambientContextItems(canvas) {
  const roots = Object.values(canvas.items).filter((item) => item.properties?.context === "pinned").map((item) => item.id);
  return contextClosure(canvas, roots).flatMap(({ itemId }) => {
    const item = canvas.items[itemId];
    return item && !excludedInAmbient(canvas, item) ? [item] : [];
  });
}
function validateContextManifest(value, canvasId) {
  if (!object(value) || value.canvasId !== canvasId || !Number.isSafeInteger(value.revision) || value.revision < 0 || !ids(value.rootIds) || !ids(value.expandedIds) || !Array.isArray(value.entries) || value.entries.length !== value.expandedIds.length || typeof value.includeExcluded !== "boolean" || typeof value.ambient !== "boolean") bad("invalid frozen context manifest");
  if (unique(value.expandedIds).length !== value.expandedIds.length) bad("context repeats an expanded item");
  const counts = { included: 0, excluded: 0, unavailable: 0 };
  for (const [index, entry] of value.entries.entries()) {
    if (!object(entry) || entry.itemId !== value.expandedIds[index] || typeof entry.title !== "string" || typeof entry.kind !== "string" || typeof entry.excluded !== "boolean" || !Number.isInteger(entry.depth) || entry.depth < 0 || entry.parentId !== null && typeof entry.parentId !== "string" || !ids(entry.threadIds) || entry.unavailable !== void 0 && typeof entry.unavailable !== "string") bad("invalid context entry");
    if (entry.version !== null) {
      const version = entry.version;
      if (!object(version) || typeof version.id !== "string" || typeof version.blobHash !== "string" || typeof version.mimeType !== "string" || typeof version.filename !== "string" || !Number.isFinite(version.size) || version.size < 0) bad("invalid retained context version");
      if (version.visual !== void 0 && (!object(version.visual) || typeof version.visual.blobHash !== "string" || typeof version.visual.mimeType !== "string" || typeof version.visual.filename !== "string" || !Number.isFinite(version.visual.size) || version.visual.size < 0)) bad("invalid retained visual face");
    }
    if (entry.annotation !== void 0 && (!object(entry.annotation) || typeof entry.annotation.targetId !== "string" || entry.annotation.region !== null && typeof entry.annotation.region !== "string")) bad("invalid retained annotation reference");
    counts[entry.excluded ? "excluded" : entry.unavailable ? "unavailable" : "included"]++;
  }
  if (!object(value.counts) || Object.keys(counts).some((key) => value.counts[key] !== counts[key])) bad("invalid context counts");
}
function canvasContextRoute(canvasId) {
  return `/api/projects/${encodeURIComponent(canvasId)}/context`;
}
function commentContextRoute(canvasId, threadId, commentId) {
  return `/api/projects/${encodeURIComponent(canvasId)}/threads/${encodeURIComponent(threadId)}/comments/${encodeURIComponent(commentId)}/context`;
}

// packages/core/src/design-record.ts
function retainedDesignVersion(version) {
  const { designRecord: _marker, ...plain } = version;
  return structuredClone({ ...plain, createdBy: { id: version.createdBy.id, name: version.createdBy.name } });
}
function validateDesignRecordVersion(version, canvasId) {
  const marker = version.designRecord;
  if (marker === void 0) return;
  const fail2 = () => {
    throw new OpValidationError("bad-op", "invalid canonical design record metadata");
  };
  const text3 = (value) => typeof value === "string" && value.length > 0;
  const keys2 = (value, allowed) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => allowed.includes(key));
  const identities = /* @__PURE__ */ new Set();
  if (!marker || Object.keys(marker).some((key) => !["schemaVersion", "kind", "requestId", "epoch", "opId", "intentHash", "retainedReferences"].includes(key)) || marker.schemaVersion !== 1 || !["brief", "receipt"].includes(marker.kind) || !text3(marker.requestId) || !text3(marker.opId) || !/^[a-f0-9]{64}$/.test(marker.intentHash) || !Number.isSafeInteger(marker.epoch) || marker.epoch < 1 || version.mimeType !== "application/json" || !Array.isArray(marker.retainedReferences) || marker.retainedReferences.length > 4096) fail2();
  for (const row2 of marker.retainedReferences) {
    if (!keys2(row2, ["artifact", "version"]) || !keys2(row2.artifact, ["home", "canvasId", "itemId", "versionId", "blobHash"]) || !keys2(row2.version, ["id", "blobHash", "mimeType", "filename", "size", "visual", "createdAt", "createdBy"]) || !keys2(row2.version.createdBy, ["id", "name"]) || !text3(row2.version.createdBy.id) || !text3(row2.version.createdBy.name) || !text3(row2.version.createdAt) || row2.artifact.canvasId !== canvasId || row2.artifact.versionId !== row2.version.id || row2.artifact.blobHash !== row2.version.blobHash || !/^[a-f0-9]{64}$/.test(row2.version.blobHash) || !text3(row2.artifact.home) || !text3(row2.artifact.itemId) || !text3(row2.version.mimeType) || !text3(row2.version.filename) || !Number.isSafeInteger(row2.version.size) || row2.version.size < 0) fail2();
    const identity = JSON.stringify([row2.artifact.home, row2.artifact.canvasId, row2.artifact.itemId, row2.artifact.versionId, row2.artifact.blobHash]);
    if (identities.has(identity)) fail2();
    identities.add(identity);
    if (row2.version.visual && (!keys2(row2.version.visual, ["blobHash", "mimeType", "filename", "size"]) || !/^[a-f0-9]{64}$/.test(row2.version.visual.blobHash) || !text3(row2.version.visual.mimeType) || !text3(row2.version.visual.filename) || !Number.isSafeInteger(row2.version.visual.size) || row2.version.visual.size < 0)) fail2();
  }
}
function validateDesignRecordState(state) {
  for (const thread of Object.values(state.canvas.threads)) for (const comment of thread.comments) {
    const versions = [...comment.context?.entries.flatMap((e2) => e2.version ? [e2.version] : []) ?? [], ...comment.designReferences?.map((r2) => r2.version) ?? []];
    if (versions.some((v) => v.designRecord !== void 0)) throw new OpValidationError("bad-op", "retained comment context cannot contain nested design admission");
  }
  for (const item of [...Object.values(state.canvas.items), ...state.canvas.trash.map((row2) => row2.item)]) for (const version of item.versions) validateDesignRecordVersion(version, state.project.id);
}
function validateDesignRecordEffect(state, envelope) {
  const op = envelope.op;
  if (op.type !== "design.request" && op.type !== "design.receipt") return;
  const fail2 = () => {
    throw new OpValidationError("bad-op", "design act disagrees with its canonical writer effect");
  };
  const effect = op.effect;
  if (!effect) return fail2();
  const update = op.type === "design.request" && op.action.kind !== "start";
  const itemId = op.type === "design.receipt" ? op.itemId : op.action.kind === "start" ? op.action.itemId : op.action.brief.itemId;
  const versionId = op.type === "design.receipt" ? op.versionId : op.action.versionId;
  let version;
  if (effect.type === "group.change") {
    const change = effect.action.change;
    if (update || change.intent !== "insert" || change.canvasId !== state.project.id || change.migration || change.cohorts || change.writes.some((w) => w.kind !== "create" && (w.kind !== "patch" || w.content))) return fail2();
    const creates = change.writes.filter((w) => w.kind === "create");
    if (creates.length !== 1 || creates[0].item.id !== itemId || creates[0].item.versions.length !== 1 || creates[0].item.currentVersionId !== versionId) return fail2();
    version = creates[0].item.versions[0];
  } else {
    if (effect.itemId !== itemId || effect.type !== (update ? "item.edit" : "item.add")) return fail2();
    if (effect.type === "item.edit" && (Object.keys(effect.patch).length || op.type !== "design.request" || op.action.kind === "start" || effect.expectedVersionId !== op.action.brief.versionId)) return fail2();
    version = effect.version;
  }
  const marker = version?.designRecord;
  const priorVersionId = op.type === "design.request" && op.action.kind !== "start" ? op.action.brief.versionId : void 0;
  const requestId = op.type === "design.receipt" ? op.receipt.requestId : op.action.kind === "start" ? op.action.requestId : state.canvas.items[itemId]?.versions.find((v) => v.id === priorVersionId)?.designRecord?.requestId;
  const epoch = op.type === "design.receipt" ? op.receipt.epoch : op.action.kind === "start" ? 1 : op.action.epoch + (op.action.kind === "resume" ? 1 : 0);
  if (!version || version.id !== versionId || !marker || marker.kind !== (op.type === "design.receipt" ? "receipt" : "brief") || marker.requestId !== requestId || marker.epoch !== epoch || marker.opId !== envelope.id) fail2();
}

// packages/core/src/canvas-group-context-resolve.ts
var object2 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var bad2 = (message) => {
  throw new OpValidationError("bad-op", message);
};
var ids2 = (value) => Array.isArray(value) && value.length <= 1e5 && value.every((id) => typeof id === "string" && id.length > 0);
var unique2 = (values) => [...new Set(values)];
function validateRequest(value) {
  if (!object2(value) || Object.keys(value).some((key) => !["rootIds", "includeExcluded", "expectedRevision"].includes(key)) || !ids2(value.rootIds)) bad2("context needs selected root IDs");
  if (value.includeExcluded !== void 0 && typeof value.includeExcluded !== "boolean") bad2("includeExcluded must be a boolean");
  if (value.expectedRevision !== void 0 && (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0)) bad2("context revision must be a nonnegative integer");
}
function manifest(state, revision, request, ambient) {
  validateRequest(request);
  if (request.expectedRevision !== void 0 && request.expectedRevision !== revision) throw new GroupConflictError("canvas context changed since preview; refresh the context before sending");
  const rootIds = unique2(request.rootIds);
  const threads = /* @__PURE__ */ new Map();
  for (const thread of Object.values(state.canvas.threads)) if (thread.anchorItemId) threads.set(thread.anchorItemId, [...threads.get(thread.anchorItemId) ?? [], thread.id]);
  const entries = contextClosure(state.canvas, rootIds).map(({ itemId, depth }) => {
    const item = state.canvas.items[itemId];
    if (!item) return { itemId, parentId: null, depth, title: itemId, kind: "missing", excluded: false, unavailable: "item is not live at this revision", version: null, threadIds: [] };
    const current2 = item.versions.find((version2) => version2.id === item.currentVersionId);
    const version = current2 ? retainedDesignVersion(current2) : null;
    if (version?.visual) version.visual = { ...version.visual, filename: version.visual.filename ?? version.filename, size: version.visual.size ?? version.size };
    return {
      itemId,
      parentId: item.containerId ?? null,
      depth,
      title: item.title,
      kind: item.properties?.kind ?? current2?.mimeType ?? "unknown",
      excluded: !request.includeExcluded && (ambient ? excludedInAmbient(state.canvas, item) : item.properties?.context === "excluded"),
      ...!version ? { unavailable: "current version is unavailable" } : {},
      version,
      threadIds: [...threads.get(itemId) ?? []].sort(),
      ...annotationTarget(item) ? { annotation: { targetId: annotationTarget(item), region: item.properties.region ?? null } } : {}
    };
  });
  const counts = { included: 0, excluded: 0, unavailable: 0 };
  for (const entry of entries) counts[entry.excluded ? "excluded" : entry.unavailable ? "unavailable" : "included"]++;
  return { canvasId: state.project.id, revision, rootIds, expandedIds: entries.map((entry) => entry.itemId), includeExcluded: request.includeExcluded === true, ambient, entries, counts };
}
function contextManifest(state, revision, request) {
  return manifest(state, revision, request, false);
}
function ambientContextManifest(state, revision) {
  return manifest(state, revision, { rootIds: Object.values(state.canvas.items).filter((item) => item.properties?.context === "pinned").map((item) => item.id) }, true);
}
function rejectPublicContext(op) {
  const value = op.type === "thread.create" || op.type === "thread.reply" ? op.comment : op.type === "comment.update" ? op : null;
  if (value && Object.prototype.hasOwnProperty.call(value, "context")) bad2("frozen context is produced by the writer; send contextRequest instead");
}
function resolveContextOperation(state, revision, op) {
  if (op.type !== "thread.create" && op.type !== "thread.reply" && op.type !== "comment.update") return op;
  const input = op.type === "comment.update" ? op : op.comment;
  const explicit = input.contextRequest;
  if (Object.prototype.hasOwnProperty.call(input, "contextRequest")) {
    validateRequest(explicit);
    if (state.project.groupMode !== "groups") bad2("frozen context requires a group-mode canvas");
  }
  if (state.project.groupMode !== "groups") return op;
  const existing = op.type === "comment.update" ? state.canvas.threads[op.threadId]?.comments.find((comment) => comment.id === op.commentId) : void 0;
  const request = explicit ?? (!existing?.context && input.items?.some((id) => state.canvas.items[id]?.properties?.kind === "group") ? { rootIds: input.items } : void 0);
  if (!request) return existing?.context && op.type === "comment.update" ? { ...op, items: [...existing.context.expandedIds] } : op;
  const context = contextManifest(state, revision, request);
  const { contextRequest: _request, ...plain } = input;
  const resolved = { ...plain, context, items: [...context.expandedIds] };
  return op.type === "comment.update" ? resolved : { ...op, comment: resolved };
}
function contextContentPage(manifest2, options = {}) {
  const offset = options.offset ?? 0, limit = options.limit ?? 50, face = options.face ?? "source";
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !["source", "visual"].includes(face)) bad2("context page needs an offset and a limit between 1 and 200");
  const entries = manifest2.entries.slice(offset, offset + limit).map((entry) => {
    const base2 = { itemId: entry.itemId, versionId: entry.version?.id ?? null, face };
    if (entry.excluded) return { ...base2, status: "excluded", reason: "content excluded for this request" };
    if (!entry.version || entry.unavailable) return { ...base2, status: "unavailable", reason: entry.unavailable ?? "version unavailable" };
    const blob = face === "visual" ? visualFaceOf(entry.version) : sourceFaceOf(entry.version);
    return { ...base2, status: "available", blob, url: `/api/projects/${encodeURIComponent(manifest2.canvasId)}/blobs/${encodeURIComponent(blob.blobHash)}` };
  });
  const counts = { included: 0, excluded: 0, unavailable: 0 };
  for (const entry of entries) counts[entry.status === "available" ? "included" : entry.status]++;
  return { canvasId: manifest2.canvasId, revision: manifest2.revision, offset, limit, total: manifest2.entries.length, nextOffset: offset + limit < manifest2.entries.length ? offset + limit : null, entries, counts };
}

// packages/core/src/textnode.ts
var TEXT_MIME = "text/markdown";
var TEXT_FILENAME = "text.md";
var TEXT_KIND = "text";
var TEXT_PROPERTIES = { kind: TEXT_KIND };
function isTextItem(item) {
  return item.properties.kind === TEXT_KIND;
}
var TEXT_WIDTH = 320;
var TEXT_SIZE = 16;
var TEXT_STYLES = ["body", "heading", "title", "display"];
var TEXT_STYLE_SIZE = {
  body: TEXT_SIZE,
  heading: 32,
  title: 64,
  display: 128
};
var TEXT_STYLE_LABEL = {
  body: "S",
  heading: "M",
  title: "L",
  display: "XL"
};
function textStyleFrom(value) {
  const wanted = value.trim().toLowerCase();
  return TEXT_STYLES.find((s) => s === wanted || TEXT_STYLE_LABEL[s].toLowerCase() === wanted) ?? null;
}
var TEXT_STYLE_PROP = "textStyle";
function textStyleOf(item) {
  const raw = item.properties[TEXT_STYLE_PROP];
  return isTextStyle(raw) ? raw : "body";
}
function isTextStyle(value) {
  return typeof value === "string" && TEXT_STYLES.includes(value);
}
function textSizeOf(item) {
  return TEXT_STYLE_SIZE[textStyleOf(item)];
}
var TEXT_FACES = ["sans", "mono", "serif", "hand"];
function textFaceLabel(face) {
  switch (face) {
    case "sans":
      return "Sans";
    case "mono":
      return "Mono";
    case "serif":
      return "Serif";
    case "hand":
      return "Handwriting";
  }
}
var TEXT_FACE_STACK = {
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  // The fallbacks are what a reader sees offline, or before the swap lands.
  // They are the split `cursive` argued about above: not the same tone as
  // each other, but both nearer to handwriting than the sans would be.
  hand: 'Caveat, "Bradley Hand", "Segoe Print", cursive'
};
var TEXT_FACE_SCALE = {
  sans: 1,
  mono: 1,
  serif: 1,
  hand: 1.25
};
function textDrawSize(item) {
  return Math.round(textSizeOf(item) * TEXT_FACE_SCALE[textFaceOf(item)]);
}
var TEXT_FACE_PROP = "textFace";
function textFaceOf(item) {
  const raw = item.properties[TEXT_FACE_PROP];
  return isTextFace(raw) ? raw : "sans";
}
function isTextFace(value) {
  return typeof value === "string" && TEXT_FACES.includes(value);
}
var PAPERS = ["yellow", "pink", "blue", "green", "grey"];
function paperLabel(paper) {
  return paper.charAt(0).toUpperCase() + paper.slice(1);
}
var PAPER_PROP = "paper";
function paperOf(item) {
  const raw = item.properties[PAPER_PROP];
  return isPaper(raw) ? raw : null;
}
function isPaper(value) {
  return typeof value === "string" && PAPERS.includes(value);
}
function paperPatch(paper) {
  return paper === null ? { removeProperties: [PAPER_PROP] } : { properties: { [PAPER_PROP]: paper } };
}
var PAPER_SIZE = 220;
var TEXT_LEGIBLE_PX = 5;
function textIsLegible(worldSize, scale) {
  return worldSize * scale >= TEXT_LEGIBLE_PX;
}
var TEXT_MARK_MAX = 14;
function textMarkSize(boxWidth, boxHeight, scale) {
  const room = Math.min(boxWidth, boxHeight) * scale;
  return Math.max(1, Math.min(TEXT_MARK_MAX, room * 0.8));
}
function textTitle(body) {
  const hasWords = (line) => /[\p{L}\p{N}]/u.test(line);
  const first = body.split("\n").map((line) => line.trim()).find(hasWords);
  if (!first) return "Text";
  const bare = first.replace(/^#{1,6}\s+/, "").replace(/^[-*+]\s+/, "").replace(/^>\s+/, "").replace(/[*_`]/g, "").trim();
  if (!hasWords(bare)) return "Text";
  return bare.length <= 48 ? bare : `${bare.slice(0, 47).trimEnd()}\u2026`;
}
var TEXT_COLUMN = {
  body: TEXT_WIDTH,
  heading: 480,
  title: 640,
  display: 880
};
var TEXT_COLUMN_MAX = {
  body: TEXT_COLUMN.body * 2,
  heading: TEXT_COLUMN.heading * 2,
  title: TEXT_COLUMN.title * 2,
  display: TEXT_COLUMN.display * 2
};
var LINE_HEIGHT = 1.5;
var PAD_Y = 8;
var PAD_X = 12;
var PARAGRAPH_GAP = 0.35;
var SLACK = 1.1;
var LIST_INDENT = 40;
var HEADING_PX = 18;
function glyphEm(ch, face) {
  if (face === "mono") return 0.6;
  const wide = face === "serif" ? 1.06 : 1;
  if (ch === " ") return 0.28 * wide;
  if (/[iljtfI!.,;:'|]/.test(ch)) return 0.3 * wide;
  if (/[mwMW@%]/.test(ch)) return 0.9 * wide;
  if (/[A-Z]/.test(ch)) return 0.7 * wide;
  if (/[0-9]/.test(ch)) return 0.56 * wide;
  if (/[a-z]/.test(ch)) return 0.55 * wide;
  return 0.6 * wide;
}
function bareLine(line) {
  return line.replace(/^\s{0,3}(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/, "").replace(/[*_`~]/g, "").trim();
}
function textBox(body, style = "body", face = "sans") {
  const size = TEXT_STYLE_SIZE[style] * TEXT_FACE_SCALE[face];
  const column = TEXT_COLUMN[style];
  const hardMax = TEXT_COLUMN_MAX[style];
  let rows = 0;
  let widest = 0;
  let gaps = 0;
  let wrapped = false;
  let lastBlank = true;
  let extra = 0;
  let listed = false;
  for (const raw of body.replace(/\r/g, "").split("\n")) {
    const line = bareLine(raw);
    if (line === "") {
      if (!lastBlank) gaps += 1;
      lastBlank = true;
      continue;
    }
    lastBlank = false;
    const indent = /^\s{0,3}([-*+]|\d+[.)])\s+/.test(raw) ? LIST_INDENT : 0;
    if (indent && !listed) {
      listed = true;
      extra += PARAGRAPH_GAP * 2 / LINE_HEIGHT;
    }
    const heading = /^\s{0,3}#{1,6}\s+/.test(raw);
    if (heading) extra += 0.6;
    const lineSize = heading ? Math.max(size, HEADING_PX) : size;
    const em = (text3) => [...text3].reduce((w, ch) => w + glyphEm(ch, face), 0) * lineSize;
    let lineRows = 1;
    let run = indent;
    for (const word of line.split(/\s+/)) {
      const w = Math.min(em(word), hardMax - PAD_X - indent);
      const spaced = run === indent ? run + w : run + em(" ") + w;
      if (run > indent && spaced > column - PAD_X) {
        lineRows += 1;
        wrapped = true;
        run = indent + w;
      } else {
        run = spaced;
      }
      widest = Math.max(widest, run, indent + w);
    }
    rows += lineRows;
  }
  const paragraphs = Math.max(0, gaps - (lastBlank ? 1 : 0));
  const width = wrapped ? Math.max(column, Math.min(hardMax, Math.round(widest * SLACK + PAD_X))) : Math.round(Math.min(hardMax, Math.max(size * 2, widest * SLACK + PAD_X)));
  const height = Math.round(
    (Math.max(1, rows) + extra) * size * LINE_HEIGHT * SLACK + paragraphs * size * PARAGRAPH_GAP + PAD_Y
  );
  return { width, height };
}

// packages/core/src/placement.ts
var PLACEMENT_GAP = 40;
var PLACEMENT_CLEARANCE = 12;
var MAX_RINGS = 14;
function anchorOffset(item) {
  return { x: item.width, y: 0 };
}
var overlaps = (a, b, pad) => a.x < b.x + b.width + pad && b.x < a.x + a.width + pad && a.y < b.y + b.height + pad && b.y < a.y + a.height + pad;
function nearestFreeSpot(want, occupied, within) {
  const inside = (box2) => within === void 0 || box2.x >= within.x && box2.y >= within.y && box2.x + box2.width <= within.x + within.width && box2.y + box2.height <= within.y + within.height;
  const clear = (box2) => inside(box2) && !occupied.some((item) => overlaps(box2, item, PLACEMENT_CLEARANCE));
  if (clear(want)) return { x: want.x, y: want.y };
  const stepX = want.width + PLACEMENT_GAP;
  const stepY = want.height + PLACEMENT_GAP;
  const order = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1]
  ];
  for (let ring = 1; ring <= MAX_RINGS; ring++) {
    const cells = [];
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === ring) cells.push({ dx, dy });
      }
    }
    cells.sort((a, b) => {
      const da = a.dx * a.dx + a.dy * a.dy;
      const db = b.dx * b.dx + b.dy * b.dy;
      if (da !== db) return da - db;
      const rank = (c) => order.findIndex(([ox, oy]) => Math.sign(c.dx) === ox && Math.sign(c.dy) === oy);
      return rank(a) - rank(b);
    });
    for (const { dx, dy } of cells) {
      const box2 = { ...want, x: want.x + dx * stepX, y: want.y + dy * stepY };
      if (clear(box2)) return { x: box2.x, y: box2.y };
    }
  }
  if (within !== void 0) return { x: want.x, y: want.y };
  const right = Math.max(...occupied.map((i) => i.x + i.width));
  return { x: right + PLACEMENT_GAP, y: want.y };
}
function resolvePlacement(canvas, placement2, width, height = 0, exact = false) {
  let want;
  if ("anchorItemId" in placement2) {
    const anchor = canvas.items[placement2.anchorItemId];
    if (!anchor) {
      throw new OpValidationError(
        "unknown-anchor",
        `anchor item not found: ${placement2.anchorItemId}`
      );
    }
    want = { x: anchor.x - PLACEMENT_GAP - width, y: anchor.y };
  } else {
    want = { x: placement2.x, y: placement2.y };
  }
  const occupied = Object.values(canvas.items);
  if (exact || height <= 0 || width <= 0 || occupied.length === 0) return want;
  return nearestFreeSpot({ ...want, width, height }, occupied);
}
function positionIsMeaningful(op) {
  if (op.version.mimeType === DRAWING_MIME) return true;
  if (op.properties?.[ANNOTATES_PROP] !== void 0) return true;
  if (!("x" in op.placement)) return false;
  return op.placement.chosen === true || op.properties?.kind === TEXT_KIND;
}
function besideBox(moving, anchor, side, gap = PLACEMENT_GAP) {
  const middleY = anchor.y + anchor.height / 2 - moving.height / 2;
  const middleX = anchor.x + anchor.width / 2 - moving.width / 2;
  switch (side) {
    case "left":
      return { x: anchor.x - gap - moving.width, y: middleY };
    case "right":
      return { x: anchor.x + anchor.width + gap, y: middleY };
    case "above":
      return { x: middleX, y: anchor.y - gap - moving.height };
    case "below":
      return { x: middleX, y: anchor.y + anchor.height + gap };
  }
}
function isBesideSide(value) {
  return value === "left" || value === "right" || value === "above" || value === "below";
}

// packages/core/src/design-partner-values.ts
var DesignPartnerContractError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "DesignPartnerContractError";
  }
  code;
};
var bad3 = (message) => {
  throw new DesignPartnerContractError("invalid", message);
};
var object3 = (v, fields3) => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return bad3("Expected an object.");
  if (fields3 && Object.keys(v).some((key) => !fields3.includes(key))) bad3("Unknown field in design-partner record.");
  return v;
};
var recordFields = ["schemaVersion", "requestId", "epoch", "kind"];
var text = (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 32e3 ? v : bad3("Expected nonempty bounded text.");
var bool = (v) => typeof v === "boolean" ? v : bad3("Expected a boolean.");
var integer = (v, min = 0) => Number.isSafeInteger(v) && v >= min ? v : bad3("Expected an integer in range.");
var choice = (v, values) => values.includes(v) ? v : bad3(`Expected one of ${values.join(", ")}.`);
var list = (v, parse, max = 1e3) => Array.isArray(v) && v.length <= max ? v.map(parse) : bad3("Expected a bounded array.");
var nonempty = (items) => items.length ? items : bad3("Expected at least one entry.");
var unique3 = (items, key) => new Set(items.map(key)).size === items.length ? items : bad3("Repeated identity.");
var ids3 = (v) => unique3(list(v, text), (x) => x);
var nullableText = (v) => v === null ? null : text(v);
var url = (v) => {
  const value = text(v);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return bad3("Expected an absolute HTTP(S) URL.");
  }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) bad3("Expected an HTTP(S) URL without credentials.");
  return value;
};
var fidelity = (v) => choice(v, ["wireframe", "designed", "implementation"]);
var hash = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v) ? v : bad3("Expected a lowercase SHA-256 blob identity.");
function base(v) {
  if (v.schemaVersion !== 1) bad3("Unsupported design-partner schema version.");
  return { schemaVersion: 1, requestId: text(v.requestId), epoch: integer(v.epoch, 1) };
}

// packages/core/src/design-request-parse.ts
var fieldNames = ["intent", "fidelity", "delivery", "targetItemId", "groupId", "audience", "primaryTask", "constraints", "facts", "references", "outstandingDecisionIds", "outputIds"];
function fields(value, partial) {
  const v = object3(value, fieldNames), result = {};
  const parsers = {
    intent: (x) => choice(x, ["create", "extend", "refine"]),
    fidelity,
    delivery: (x) => choice(x, ["html-node", "connected-app", "wireframe", "exploration"]),
    targetItemId: nullableText,
    groupId: nullableText,
    audience: nullableText,
    primaryTask: nullableText,
    constraints: (x) => list(x, text),
    facts: (x) => unique3(list(x, (entry) => {
      const f = object3(entry, ["id", "name", "value", "origin", "sources"]);
      return { id: text(f.id), name: text(f.name), value: text(f.value), origin: choice(f.origin, ["supplied", "context", "assumed"]), sources: list(f.sources, parseDesignArtifactRef) };
    }), (f) => f.id),
    references: (x) => unique3(list(x, parseDesignReference), (r2) => r2.id),
    outstandingDecisionIds: ids3,
    outputIds: ids3
  };
  for (const key of fieldNames) if (!partial || v[key] !== void 0) result[key] = parsers[key](v[key]);
  return result;
}
function source(value) {
  const v = object3(value), entrance = choice(v.entrance, ["canvas-chat", "external-agent"]);
  object3(v, entrance === "canvas-chat" ? ["entrance", "threadId", "commentId"] : ["entrance", "externalRequestId"]);
  return entrance === "canvas-chat" ? { entrance, threadId: text(v.threadId), commentId: text(v.commentId) } : { entrance, externalRequestId: text(v.externalRequestId) };
}
function questionSource(value) {
  const v = object3(value, ["threadId", "commentId", "payloadId", "revision"]);
  return { threadId: text(v.threadId), commentId: text(v.commentId), payloadId: text(v.payloadId), revision: integer(v.revision, 1) };
}
function responses(value) {
  return unique3(list(value, (entry) => {
    const v = object3(entry, ["question", "responseId"]);
    return { question: questionSource(v.question), responseId: text(v.responseId) };
  }), (v) => v.responseId);
}
function parseDesignContinuation(value) {
  const v = object3(value, ["sourceCapture", "scopeCapture", "acceptedResponses", "factProvenance", "resumedBy"]);
  const capture = v.sourceCapture === null ? null : object3(v.sourceCapture, ["bodyHash", "boundaryCommentId"]);
  const scope = object3(v.scopeCapture, ["kind", "revision"]);
  const resumed = v.resumedBy === void 0 ? void 0 : object3(v.resumedBy, ["actorId", "reason"]);
  return { sourceCapture: capture && { bodyHash: hash(capture.bodyHash), boundaryCommentId: text(capture.boundaryCommentId) }, scopeCapture: { kind: choice(scope.kind, ["source-comment", "current-selection", "current-ambient"]), revision: integer(scope.revision) }, acceptedResponses: responses(v.acceptedResponses), factProvenance: unique3(list(v.factProvenance, (entry) => {
    const f = object3(entry, ["field", "actorId", "kind", "responseId"]);
    const kind = choice(f.kind, ["direct", "reported", "questionnaire"]);
    if (kind === "questionnaire" !== (f.responseId !== void 0)) bad3("Questionnaire provenance requires its accepted response.");
    return { field: text(f.field), actorId: text(f.actorId), kind, ...f.responseId === void 0 ? {} : { responseId: text(f.responseId) } };
  }), (f) => f.field), ...resumed ? { resumedBy: { actorId: text(resumed.actorId), reason: text(resumed.reason) } } : {} };
}
function parseDesignDiscovery(value) {
  const v = object3(value, ["purpose", "reason", "source", "factBindings"]), purpose = choice(v.purpose, ["initial", "consequential", "interview"]);
  if (purpose !== "initial" && v.reason === void 0 || purpose === "interview" && v.source === void 0) bad3("Additional discovery needs a reason and interviews need provenance.");
  return { purpose, ...v.reason === void 0 ? {} : { reason: text(v.reason) }, ...v.source === void 0 ? {} : { source: source(v.source) }, factBindings: unique3(list(v.factBindings, (entry) => {
    const f = object3(entry, ["questionId", "factId"]);
    return { questionId: text(f.questionId), factId: text(f.factId) };
  }, 32), (f) => f.questionId) };
}
function parseDesignGoverning(value) {
  const v = object3(value, ["atItemId", "artifact", "explicitNone"]);
  const result = { atItemId: nullableText(v.atItemId), artifact: v.artifact === null ? null : parseDesignArtifactRef(v.artifact), explicitNone: bool(v.explicitNone) };
  return result;
}
function contextRequest(value) {
  const v = object3(value, ["rootIds", "includeExcluded", "expectedRevision"]);
  return { rootIds: ids3(v.rootIds), ...v.includeExcluded === void 0 ? {} : { includeExcluded: bool(v.includeExcluded) }, ...v.expectedRevision === void 0 ? {} : { expectedRevision: integer(v.expectedRevision) } };
}
function placement(value) {
  const v = object3(value, ["x", "y", "chosen", "anchorItemId"]);
  if (v.anchorItemId !== void 0) {
    if (v.x !== void 0 || v.y !== void 0 || v.chosen !== void 0) bad3("An anchor cannot also name coordinates.");
    return { anchorItemId: text(v.anchorItemId) };
  }
  if (typeof v.x !== "number" || !Number.isFinite(v.x) || typeof v.y !== "number" || !Number.isFinite(v.y)) bad3("Placement needs finite coordinates.");
  return { x: v.x, y: v.y, ...v.chosen === void 0 ? {} : { chosen: bool(v.chosen) } };
}
function position(v) {
  return { ...v.placement === void 0 ? {} : { placement: placement(v.placement) }, ...v.width === void 0 ? {} : { width: integer(v.width, 1) }, ...v.height === void 0 ? {} : { height: integer(v.height, 1) }, ...v.title === void 0 ? {} : { title: text(v.title) } };
}
function parseDesignRequestAction(value) {
  const v = object3(value), kind = choice(v.kind, ["start", "update", "resume", "cancel", "complete"]);
  if (kind === "start") {
    object3(v, ["kind", "requestId", "itemId", "versionId", "source", "fields", "admission", "contextRequest", "placement", "width", "height", "title"]);
    return { kind, requestId: text(v.requestId), itemId: text(v.itemId), versionId: text(v.versionId), source: source(v.source), fields: fields(v.fields, false), admission: choice(v.admission, ["explicit", "automatic"]), ...v.contextRequest === void 0 ? {} : { contextRequest: contextRequest(v.contextRequest) }, ...position(v) };
  }
  object3(v, ["kind", "brief", "epoch", "versionId", ...kind === "cancel" ? ["reason"] : ["patch", "acceptedResponses", ...kind === "resume" ? ["reason", "contextRequest"] : []]]);
  const basis = { brief: parseDesignArtifactRef(v.brief), epoch: integer(v.epoch, 1), versionId: text(v.versionId) };
  if (kind === "cancel") return { kind, ...basis, ...v.reason === void 0 ? {} : { reason: text(v.reason) } };
  const changes = { ...v.patch === void 0 ? {} : { patch: fields(v.patch, true) }, ...v.acceptedResponses === void 0 ? {} : { acceptedResponses: responses(v.acceptedResponses) } };
  return kind === "resume" ? { kind, ...basis, ...changes, reason: text(v.reason), ...v.contextRequest === void 0 ? {} : { contextRequest: contextRequest(v.contextRequest) } } : { kind, ...basis, ...changes };
}
function parseDesignRequestOperation(value) {
  const v = object3(value);
  if (v.type === "design.request") {
    object3(v, ["type", "action"]);
    return { type: v.type, action: parseDesignRequestAction(v.action) };
  }
  object3(v, ["type", "itemId", "versionId", "receipt", "placement", "width", "height", "title"]);
  if (v.type !== "design.receipt") bad3("Expected a design request or receipt act.");
  return { type: "design.receipt", itemId: text(v.itemId), versionId: text(v.versionId), receipt: parseDesignReceipt(v.receipt), ...position(v) };
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",") + "}";
  return JSON.stringify(value);
}
async function designIntentHash(operation, authoredActorId) {
  const { effect: _effect, ...publicIntent } = operation;
  const bytes = new TextEncoder().encode(canonical({ operation: parseDesignRequestOperation(publicIntent), actorId: text(authoredActorId) }));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((n) => n.toString(16).padStart(2, "0")).join("");
}

// packages/core/src/design-brief.ts
function parseDesignBrief(value) {
  const v = object3(value, [...recordFields, "requestingActorId", "source", "progress", "intent", "fidelity", "delivery", "targetItemId", "groupId", "audience", "primaryTask", "constraints", "facts", "context", "references", "outstandingDecisionIds", "outputIds", "continuation"]);
  if (v.kind !== "brief") bad3("Expected a brief.");
  const rawSource = object3(v.source);
  const entrance = choice(rawSource.entrance, ["canvas-chat", "external-agent"]);
  object3(rawSource, entrance === "canvas-chat" ? ["entrance", "threadId", "commentId"] : ["entrance", "externalRequestId"]);
  const source3 = entrance === "canvas-chat" ? { entrance, threadId: text(rawSource.threadId), commentId: text(rawSource.commentId) } : { entrance, externalRequestId: text(rawSource.externalRequestId) };
  const rawContext = object3(v.context);
  validateContextManifest(rawContext, text(rawContext.canvasId));
  return {
    ...base(v),
    kind: "brief",
    requestingActorId: text(v.requestingActorId),
    source: source3,
    ...v.continuation === void 0 ? {} : { continuation: parseDesignContinuation(v.continuation) },
    progress: choice(v.progress, ["active", "cancelled", "completed"]),
    intent: choice(v.intent, ["create", "extend", "refine"]),
    fidelity: fidelity(v.fidelity),
    delivery: choice(v.delivery, ["html-node", "connected-app", "wireframe", "exploration"]),
    targetItemId: nullableText(v.targetItemId),
    groupId: nullableText(v.groupId),
    audience: nullableText(v.audience),
    primaryTask: nullableText(v.primaryTask),
    constraints: list(v.constraints, text),
    facts: unique3(list(v.facts, (entry) => {
      const f = object3(entry, ["id", "name", "value", "origin", "sources"]);
      return { id: text(f.id), name: text(f.name), value: text(f.value), origin: choice(f.origin, ["supplied", "context", "assumed"]), sources: list(f.sources, parseDesignArtifactRef) };
    }), (f) => f.id),
    context: structuredClone(rawContext),
    references: unique3(list(v.references, parseDesignReference), (r2) => r2.id),
    outstandingDecisionIds: ids3(v.outstandingDecisionIds),
    outputIds: ids3(v.outputIds)
  };
}

// packages/core/src/design-partner.ts
var DESIGN_PARTNER_MAX_QUESTIONS = 32;
var DESIGN_PARTNER_POLICY_PROPERTY = "design.workflow";
function parseDesignArtifactRef(value) {
  const v = object3(value, ["home", "canvasId", "itemId", "versionId", "blobHash"]);
  return { home: url(v.home), canvasId: text(v.canvasId), itemId: text(v.itemId), versionId: text(v.versionId), blobHash: hash(v.blobHash) };
}
function parseDesignReference(value) {
  const v = object3(value, ["id", "state", "url", "artifact", "reason"]);
  const state = choice(v.state, ["supplied", "fetched", "inaccessible", "superseded"]);
  const result = {
    id: text(v.id),
    state,
    ...v.url === void 0 ? {} : { url: url(v.url) },
    ...v.artifact === void 0 ? {} : { artifact: parseDesignArtifactRef(v.artifact) },
    ...v.reason === void 0 ? {} : { reason: text(v.reason) }
  };
  if (!result.url && !result.artifact) bad3("A reference requires an actual URL or artifact identity, not a filename.");
  if (state === "fetched" && !result.artifact) bad3("A fetched reference requires retrievable version identity.");
  if ((state === "inaccessible" || state === "superseded") && !result.reason) bad3("Unavailable references require a reason.");
  return result;
}
function questionSource2(value) {
  const v = object3(value, ["threadId", "commentId", "payloadId", "revision"]);
  return { threadId: text(v.threadId), commentId: text(v.commentId), payloadId: text(v.payloadId), revision: integer(v.revision, 1) };
}
function question(value) {
  const v = object3(value, ["id", "title", "consequence", "renderer", "options", "multiple", "skippable", "delegatable", "recommendedOptionId"]);
  const renderer = choice(v.renderer, ["choice-list", "visual-cards", "freeform", "url-collection", "upload"]);
  const options = unique3(list(v.options, (entry) => {
    const o = object3(entry, ["id", "title", "consequence", "preview"]);
    return { id: text(o.id), title: text(o.title), consequence: text(o.consequence), ...o.preview === void 0 ? {} : { preview: parseDesignArtifactRef(o.preview) } };
  }, 12), (o) => o.id);
  const isChoice = renderer === "choice-list" || renderer === "visual-cards";
  if (isChoice ? options.length < 2 : options.length !== 0) bad3("Options must match the question renderer.");
  if (renderer === "visual-cards" && options.some((o) => !o.preview)) bad3("Visual alternatives require actual version previews.");
  const result = { id: text(v.id), title: text(v.title), consequence: text(v.consequence), renderer, options, multiple: bool(v.multiple), skippable: bool(v.skippable), delegatable: bool(v.delegatable), ...v.recommendedOptionId === void 0 ? {} : { recommendedOptionId: text(v.recommendedOptionId) } };
  if (result.recommendedOptionId && !options.some((o) => o.id === result.recommendedOptionId)) bad3("Recommendation names an unknown option.");
  if (!isChoice && result.multiple) bad3("Only option questions may select multiple options.");
  return result;
}
function parseDesignQuestionSet(value) {
  const v = object3(value, [...recordFields, "id", "revision", "brief", "respondentActorId", "headline", "inferredAnswers", "questions", "supersedes", "discovery"]);
  if (v.kind !== "questions") bad3("Expected questions.");
  return { ...base(v), kind: "questions", id: text(v.id), revision: integer(v.revision, 1), brief: parseDesignArtifactRef(v.brief), respondentActorId: text(v.respondentActorId), headline: text(v.headline), inferredAnswers: unique3(list(v.inferredAnswers, (entry) => {
    const a = object3(entry, ["questionId", "value", "sources"]);
    return { questionId: text(a.questionId), value: text(a.value), sources: list(a.sources, parseDesignArtifactRef) };
  }), (a) => a.questionId), questions: unique3(nonempty(list(v.questions, question, DESIGN_PARTNER_MAX_QUESTIONS)), (q) => q.id), supersedes: v.supersedes === null ? null : questionSource2(v.supersedes), ...v.discovery === void 0 ? {} : { discovery: parseDesignDiscovery(v.discovery) } };
}
function resolution(value) {
  const v = object3(value, ["questionId", "state", "value", "agentActorId"]);
  const questionId = text(v.questionId), state = choice(v.state, ["answered", "skipped", "dismissed", "delegated"]);
  if (state === "skipped" || state === "dismissed") {
    if (v.value !== void 0 || v.agentActorId !== void 0) bad3("Skipped/dismissed is not an answer.");
    return { questionId, state };
  }
  if (state === "delegated") {
    if (v.value !== void 0) bad3("Delegation is not an answer.");
    return { questionId, state, agentActorId: text(v.agentActorId) };
  }
  const answer = object3(v.value), kind = choice(answer.kind, ["options", "text", "references"]);
  object3(answer, ["kind", kind === "options" ? "optionIds" : kind === "text" ? "text" : "references"]);
  if (v.agentActorId !== void 0) bad3("An answer cannot also carry delegation.");
  if (kind === "options") return { questionId, state, value: { kind, optionIds: nonempty(ids3(answer.optionIds)) } };
  if (kind === "text") return { questionId, state, value: { kind, text: text(answer.text) } };
  return { questionId, state, value: { kind, references: unique3(nonempty(list(answer.references, parseDesignReference, 20)), (r2) => r2.id) } };
}
function parseDesignResponse(value) {
  const v = object3(value, [...recordFields, "id", "question", "respondentActorId", "resolutions", "supersedesResponseId"]);
  if (v.kind !== "response") bad3("Expected a response.");
  return { ...base(v), kind: "response", id: text(v.id), question: questionSource2(v.question), respondentActorId: text(v.respondentActorId), resolutions: unique3(nonempty(list(v.resolutions, resolution, DESIGN_PARTNER_MAX_QUESTIONS)), (r2) => r2.questionId), supersedesResponseId: nullableText(v.supersedesResponseId) };
}
function parseDesignReceipt(value) {
  const v = object3(value, [...recordFields, "id", "brief", "output", "context", "fidelity", "status", "checks", "unresolved", "governing"]);
  if (v.kind !== "receipt") bad3("Expected a receipt.");
  const rawOutput = object3(v.output), outputKind = choice(rawOutput.kind, ["canvas", "repository"]);
  object3(rawOutput, outputKind === "canvas" ? ["kind", "artifact"] : ["kind", "repository", "revision", "buildId", "runtimeUrl"]);
  const output = outputKind === "canvas" ? { kind: outputKind, artifact: parseDesignArtifactRef(rawOutput.artifact) } : { kind: outputKind, repository: text(rawOutput.repository), revision: text(rawOutput.revision), buildId: text(rawOutput.buildId), runtimeUrl: url(rawOutput.runtimeUrl) };
  const result = {
    ...base(v),
    kind: "receipt",
    id: text(v.id),
    brief: parseDesignArtifactRef(v.brief),
    output,
    context: list(v.context, parseDesignArtifactRef),
    fidelity: fidelity(v.fidelity),
    status: choice(v.status, ["draft", "ready"]),
    ...v.governing === void 0 ? {} : { governing: parseDesignGoverning(v.governing) },
    checks: unique3(list(v.checks, (entry) => {
      const c = object3(entry, ["id", "kind", "tool", "toolVersion", "result", "coverage", "state", "viewport", "evidence"]), viewport = c.viewport === null ? null : object3(c.viewport, ["width", "height"]);
      return { id: text(c.id), kind: choice(c.kind, ["source", "browser-task", "craft"]), tool: text(c.tool), toolVersion: text(c.toolVersion), result: choice(c.result, ["passed", "failed", "unavailable"]), coverage: text(c.coverage), state: text(c.state), viewport: viewport === null ? null : { width: integer(viewport.width, 1), height: integer(viewport.height, 1) }, evidence: list(c.evidence, parseDesignArtifactRef) };
    }), (c) => c.id),
    unresolved: list(v.unresolved, (entry) => {
      const u = object3(entry, ["severity", "description"]);
      return { severity: choice(u.severity, ["critical", "noncritical"]), description: text(u.description) };
    })
  };
  if (result.checks.some((c) => c.kind === "browser-task" && c.result === "passed" && (!c.viewport || !c.evidence.length))) bad3("Browser evidence requires a viewport and retrievable evidence.");
  if (result.status === "ready" && (result.unresolved.some((u) => u.severity === "critical") || result.checks.some((c) => c.result === "failed") || !result.checks.some((c) => c.kind === "browser-task" && c.result === "passed"))) bad3("Ready cannot be claimed without browser/task evidence or with known failures.");
  return result;
}
function designPartnerPolicy(properties) {
  const value = properties[DESIGN_PARTNER_POLICY_PROPERTY];
  return value === void 0 || value === "off" ? "off" : value === "adaptive-v1" ? value : "unsupported";
}

// packages/core/src/design-decision-parse.ts
var keys = ["schemaVersion", "kind", "id", "requestId", "epoch"];
var source2 = (value) => {
  const v = object3(value, ["threadId", "commentId", "payloadId", "revision"]);
  return { threadId: text(v.threadId), commentId: text(v.commentId), payloadId: text(v.payloadId), revision: integer(v.revision, 1) };
};
var optionalWords = (value) => typeof value === "string" && value.length <= 32e3 ? value : bad3("Expected bounded text.");
function parseDesignComparison(value) {
  const v = object3(value, [...keys, "revision", "brief", "decisionKey", "audience", "mode", "uncertainty", "scenario", "fidelity", "alternatives", "recommendedAlternativeId", "recommendation", "target", "governing", "supersedes", "correctsDecisionId", "followsResponseId"]);
  if (v.kind !== "comparison") bad3("Expected a comparison.");
  const a = object3(v.audience), kind = choice(a.kind, ["human", "external-agent"]);
  object3(a, kind === "human" ? ["kind", "respondentActorId"] : ["kind", "externalRequestId", "reporterActorId"]);
  const audience = kind === "human" ? { kind, respondentActorId: text(a.respondentActorId) } : { kind, externalRequestId: text(a.externalRequestId), reporterActorId: text(a.reporterActorId) };
  const target = object3(v.target, ["itemId", "groupId"]), mode = choice(v.mode, ["comparison", "direct", "delegated"]);
  const alternatives = unique3(list(v.alternatives, (entry) => {
    const o = object3(entry, ["id", "title", "hypothesis", "tradeoff", "artifact"]);
    return { id: text(o.id), title: text(o.title), hypothesis: text(o.hypothesis), tradeoff: text(o.tradeoff), artifact: parseDesignArtifactRef(o.artifact) };
  }, 3), (o) => o.id);
  if (!alternatives.length || mode === "comparison" && alternatives.length < 2) bad3("A comparison needs two or three options; a single option requires an explicit direct/delegated mode.");
  if (!alternatives.some((a2) => a2.id === v.recommendedAlternativeId)) bad3("Recommendation names an unknown alternative.");
  return { ...base(v), kind: "comparison", id: text(v.id), revision: integer(v.revision, 1), brief: parseDesignArtifactRef(v.brief), decisionKey: text(v.decisionKey), audience, mode, uncertainty: choice(v.uncertainty, ["structure", "visual"]), scenario: text(v.scenario), fidelity: fidelity(v.fidelity), alternatives, recommendedAlternativeId: text(v.recommendedAlternativeId), recommendation: text(v.recommendation), target: { itemId: nullableText(target.itemId), groupId: nullableText(target.groupId) }, governing: parseDesignGoverning(v.governing), supersedes: v.supersedes === null ? null : source2(v.supersedes), correctsDecisionId: nullableText(v.correctsDecisionId), followsResponseId: nullableText(v.followsResponseId) };
}
function parseDesignComparisonResponse(value) {
  const v = object3(value, [...keys, "comparison", "authority", "outcome", "supersedesResponseId"]);
  if (v.kind !== "comparison-response") bad3("Expected a comparison response.");
  const a = object3(v.authority), authorityKind = choice(a.kind, ["human", "external-report"]);
  object3(a, authorityKind === "human" ? ["kind"] : ["kind", "externalRequestId", "statement"]);
  const authority = authorityKind === "human" ? { kind: authorityKind } : { kind: authorityKind, externalRequestId: text(a.externalRequestId), statement: text(a.statement) };
  const o = object3(v.outcome), kind = choice(o.kind, ["delegate", "more", "combine", "skip", "dismiss"]);
  object3(o, kind === "delegate" ? ["kind", "agentActorId"] : kind === "more" ? ["kind", "count", "instruction"] : kind === "combine" ? ["kind", "parts", "instruction"] : ["kind"]);
  let outcome;
  if (kind === "delegate") outcome = { kind, agentActorId: text(o.agentActorId) };
  else if (kind === "more") {
    const count = o.count === null ? null : integer(o.count, 1);
    if (count !== null && count > 100) bad3("Requested exploration count exceeds the protocol bound.");
    outcome = { kind, count, instruction: nullableText(o.instruction) };
  } else if (kind === "combine") {
    const parts = list(o.parts, (entry) => {
      const p = object3(entry, ["optionId", "part"]);
      return { optionId: text(p.optionId), part: text(p.part) };
    }, 32);
    if (parts.length < 2) bad3("A combination identifies at least two parts.");
    outcome = { kind, parts, instruction: text(o.instruction) };
  } else outcome = { kind };
  return { ...base(v), kind: "comparison-response", id: text(v.id), comparison: source2(v.comparison), authority, outcome, supersedesResponseId: nullableText(v.supersedesResponseId) };
}
function parseDesignTarget(value) {
  const t = object3(value, ["artifact", "title", "description", "properties", "scope"]), s = object3(t.scope, ["containerId", "scopeIds"]), p = object3(t.properties);
  return { artifact: parseDesignArtifactRef(t.artifact), title: optionalWords(t.title), description: optionalWords(t.description), properties: Object.fromEntries(Object.entries(p).map(([key, value2]) => [text(key), optionalWords(value2)])), scope: { containerId: nullableText(s.containerId), scopeIds: unique3(list(s.scopeIds, text, 128), (id) => id) } };
}
function parseDesignApprovalBasis(value) {
  const v = object3(value, ["brief", "epoch", "alternatives", "target", "governing"]);
  return { brief: parseDesignArtifactRef(v.brief), epoch: integer(v.epoch, 1), alternatives: list(v.alternatives, parseDesignArtifactRef, 3), target: parseDesignTarget(v.target), governing: parseDesignGoverning(v.governing) };
}
function parseDesignDecisionInput(value) {
  const v = object3(value, ["id", "requestId", "decisionKey", "source", "basis", "chosenAlternativeId", "versionId", "supersedesDecisionId", "authority"]), s = object3(v.source), sourceKind = choice(s.kind, ["comparison", "direct"]);
  object3(s, sourceKind === "comparison" ? ["kind", "source"] : ["kind", "proposal"]);
  const a = object3(v.authority), kind = choice(a.kind, ["human-choice", "canvas-delegation", "external-report", "agent-judgment"]);
  object3(a, kind === "human-choice" ? ["kind", "reason"] : kind === "canvas-delegation" ? ["kind", "responseId", "rationale"] : kind === "external-report" ? ["kind", "externalRequestId", "reportedOutcome", "statement", "reportedReason", "rationale"] : ["kind", "rationale"]);
  const authority = kind === "human-choice" ? { kind, reason: nullableText(a.reason) } : kind === "canvas-delegation" ? { kind, responseId: text(a.responseId), rationale: text(a.rationale) } : kind === "external-report" ? { kind, externalRequestId: text(a.externalRequestId), reportedOutcome: choice(a.reportedOutcome, ["choice", "delegation"]), statement: text(a.statement), reportedReason: nullableText(a.reportedReason), rationale: text(a.rationale) } : { kind, rationale: text(a.rationale) };
  return { id: text(v.id), requestId: text(v.requestId), decisionKey: text(v.decisionKey), source: sourceKind === "comparison" ? { kind: sourceKind, source: source2(s.source) } : { kind: sourceKind, proposal: parseDesignComparison(s.proposal) }, basis: parseDesignApprovalBasis(v.basis), chosenAlternativeId: text(v.chosenAlternativeId), versionId: text(v.versionId), supersedesDecisionId: nullableText(v.supersedesDecisionId), authority };
}
function parseDesignCompareOperation(value) {
  const v = object3(value, ["type", "threadId", "commentId", "comparison"]);
  if (v.type !== "design.compare") bad3("Expected design.compare.");
  return { type: "design.compare", threadId: text(v.threadId), commentId: text(v.commentId), comparison: parseDesignComparison(v.comparison) };
}
function parseDesignRespondOperation(value) {
  const v = object3(value, ["type", "threadId", "commentId", "response"]);
  if (v.type !== "design.respond") bad3("Expected design.respond.");
  return { type: "design.respond", threadId: text(v.threadId), commentId: text(v.commentId), response: parseDesignComparisonResponse(v.response) };
}
function parseDesignDecideOperation(value) {
  const v = object3(value, ["type", "threadId", "commentId", "decision"]);
  if (v.type !== "design.decide") bad3("Expected design.decide.");
  return { type: "design.decide", threadId: text(v.threadId), commentId: text(v.commentId), decision: parseDesignDecisionInput(v.decision) };
}
function parseDesignDecisionOperation(value) {
  const v = object3(value);
  return v.type === "design.compare" ? parseDesignCompareOperation(v) : v.type === "design.respond" ? parseDesignRespondOperation(v) : parseDesignDecideOperation(v);
}
function canonical2(value) {
  if (Array.isArray(value)) return `[${value.map(canonical2).join(",")}]`;
  if (value !== null && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical2(value[key])}`).join(",") + "}";
  return JSON.stringify(value);
}
async function designDecisionIntentHash(op, actorId) {
  const { effect: _effect, canonicalComment: _comment, ...intent } = op;
  const bytes = new TextEncoder().encode(canonical2({ operation: parseDesignDecisionOperation(intent), actorId: text(actorId) }));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((n) => n.toString(16).padStart(2, "0")).join("");
}

// packages/core/src/design-repair-parse.ts
function parseDesignRepairBasis(value) {
  const v = object3(value, ["request", "review", "target", "governing", "ruleVersion"]);
  const r2 = v.request === null ? null : object3(v.request, ["brief", "requestId", "epoch"]), review = v.review === null ? null : object3(v.review, ["run", "runId", "passId"]);
  const result = { request: r2 === null ? null : { brief: parseDesignArtifactRef(r2.brief), requestId: text(r2.requestId), epoch: integer(r2.epoch, 1) }, review: review === null ? null : { run: parseDesignArtifactRef(review.run), runId: text(review.runId), passId: text(review.passId) }, target: parseDesignTarget(v.target), governing: parseDesignGoverning(v.governing), ruleVersion: text(v.ruleVersion) };
  if (result.request === null !== (result.review === null)) bad3("Task repair requires its exact review run and pass; standalone audit repair has neither.");
  if (result.governing.atItemId !== result.target.artifact.itemId) bad3("Repair governing scope must name its exact target.");
  return result;
}
function parseDesignRepairInput(value) {
  const v = object3(value, ["id", "request", "review", "target", "governing", "ruleVersion", "version"]);
  const version = object3(v.version, ["id", "blobHash", "size"]);
  const result = { ...parseDesignRepairBasis({ request: v.request, review: v.review, target: v.target, governing: v.governing, ruleVersion: v.ruleVersion }), id: text(v.id), version: { id: text(version.id), blobHash: hash(version.blobHash), size: integer(version.size, 1) } };
  if (result.version.id === result.target.artifact.versionId) bad3("A repair requires a fresh version identity.");
  return result;
}
function parseDesignRepairOperation(value) {
  const v = object3(value, ["type", "repair"]);
  if (v.type !== "design.repair") bad3("Expected design.repair.");
  return { type: "design.repair", repair: parseDesignRepairInput(v.repair) };
}
function canonical3(value) {
  return Array.isArray(value) ? `[${value.map(canonical3).join(",")}]` : value !== null && typeof value === "object" ? "{" + Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical3(value[k])}`).join(",") + "}" : JSON.stringify(value);
}
async function designRepairIntentHash(op, actorId) {
  const bytes = new TextEncoder().encode(canonical3({ operation: parseDesignRepairOperation({ type: op.type, repair: op.repair }), actorId: text(actorId) }));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((n) => n.toString(16).padStart(2, "0")).join("");
}

// packages/core/src/design-retention.ts
function validateDesignRetainedReferences(value, canvasId, required, limit) {
  const fail2 = () => {
    throw new OpValidationError("bad-op", "invalid or missing retained design reference metadata");
  };
  const keys2 = (v, names) => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).every((k) => names.includes(k));
  const text3 = (v) => typeof v === "string" && v.length > 0;
  const identities = /* @__PURE__ */ new Set();
  const identity = (a) => JSON.stringify([a.home, a.canvasId, a.itemId, a.versionId, a.blobHash]);
  if (!Array.isArray(value) || value.length > limit) return fail2();
  for (const row2 of value) {
    if (!keys2(row2, ["artifact", "version"])) return fail2();
    const artifact = parseDesignArtifactRef(row2.artifact), v = row2.version;
    if (!keys2(v, ["id", "blobHash", "mimeType", "filename", "size", "visual", "createdAt", "createdBy"]) || !keys2(v.createdBy, ["id", "name"]) || !text3(v.createdBy.id) || !text3(v.createdBy.name) || !text3(v.createdAt) || !text3(v.mimeType) || !text3(v.filename) || !Number.isSafeInteger(v.size) || v.size < 0 || artifact.canvasId !== canvasId || artifact.versionId !== v.id || artifact.blobHash !== v.blobHash) return fail2();
    if (v.visual !== void 0 && (!keys2(v.visual, ["blobHash", "mimeType", "filename", "size"]) || !/^[a-f0-9]{64}$/.test(String(v.visual.blobHash)) || !text3(v.visual.mimeType) || !text3(v.visual.filename) || !Number.isSafeInteger(v.visual.size) || v.visual.size < 0)) return fail2();
    const key = identity(artifact);
    if (identities.has(key)) return fail2();
    identities.add(key);
    const version = v;
    validateContextManifest({ canvasId, revision: 0, rootIds: [artifact.itemId], expandedIds: [artifact.itemId], includeExcluded: false, ambient: false, entries: [{ itemId: artifact.itemId, parentId: null, depth: 0, title: "Retained reference", kind: version.mimeType, excluded: false, version, threadIds: [] }], counts: { included: 1, excluded: 0, unavailable: 0 } }, canvasId);
  }
  if (required.some((artifact) => !identities.has(identity(artifact)))) fail2();
}

// packages/core/src/area.ts
var AREA_KIND = "area";
var AREA_PROPERTIES = { kind: AREA_KIND };
var AREA_MIME = "text/markdown";
var AREA_FILENAME = "area.md";
var AREA_TINT_PROP = "tint";
var AREA_TITLE_HEIGHT = 56;
var AREA_CARD_HEIGHT = 120;
var AREA_HEAD = AREA_TITLE_HEIGHT + AREA_CARD_HEIGHT;
var AREA_INSET = 24;
function isArea(item) {
  return item.properties.kind === AREA_KIND;
}
function areaTint(item) {
  const raw = item.properties[AREA_TINT_PROP];
  return isPaper(raw) ? raw : null;
}
function areaTintPatch(tint) {
  return tint === null ? { removeProperties: [AREA_TINT_PROP] } : { properties: { [AREA_TINT_PROP]: tint } };
}
function areasOf(canvas) {
  return Object.values(canvas.items).filter(isArea).sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
}
function areaInner(area) {
  return {
    x: area.x + AREA_INSET,
    y: area.y + AREA_HEAD,
    width: Math.max(0, area.width - AREA_INSET * 2),
    height: Math.max(0, area.height - AREA_HEAD - AREA_INSET)
  };
}
function inArea(area, item) {
  if (item.id === area.id || isArea(item)) return false;
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  return cx >= area.x && cx < area.x + area.width && cy >= area.y && cy < area.y + area.height;
}
function itemsIn(canvas, area) {
  return Object.values(canvas.items).filter((item) => inArea(area, item)).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}
function areaOf(canvas, item) {
  const holding = areasOf(canvas).filter((area) => inArea(area, item));
  if (holding.length === 0) return null;
  return holding.sort((a, b) => a.width * a.height - b.width * b.height)[0];
}
function findArea(canvas, ref) {
  const areas = areasOf(canvas);
  const exact = areas.find((a) => a.id === ref || a.title === ref);
  if (exact) return exact;
  const needle = ref.trim().toLowerCase();
  if (!needle) return null;
  return areas.find((a) => a.title.toLowerCase().startsWith(needle)) ?? null;
}
function freeSpotIn(canvas, area, width, height) {
  const inner = areaInner(area);
  const occupied = Object.values(canvas.items).filter((item) => !isArea(item)).map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height }));
  const want = { x: inner.x, y: inner.y, width, height };
  const within = {
    x: inner.x - PLACEMENT_CLEARANCE,
    y: inner.y - PLACEMENT_CLEARANCE,
    width: inner.width + PLACEMENT_CLEARANCE * 2,
    height: inner.height + PLACEMENT_CLEARANCE * 2
  };
  const spot = nearestFreeSpot(want, occupied, within);
  const inside = spot.x >= within.x && spot.y >= within.y && spot.x + width <= within.x + within.width && spot.y + height <= within.y + within.height;
  const clear = inside && !occupied.some((item) => overlaps({ ...spot, width, height }, item, PLACEMENT_CLEARANCE));
  if (clear) {
    return { x: spot.x, y: spot.y };
  }
  const growWidth = Math.max(inner.width, width);
  const growWithin = {
    x: inner.x - PLACEMENT_CLEARANCE,
    y: inner.y - PLACEMENT_CLEARANCE,
    width: growWidth + PLACEMENT_CLEARANCE * 2,
    height: Number.MAX_SAFE_INTEGER
  };
  const grownSpot = nearestFreeSpot(want, occupied, growWithin);
  const grownInside = grownSpot.x >= growWithin.x && grownSpot.y >= growWithin.y && grownSpot.x + width <= growWithin.x + growWithin.width;
  const grownClear = grownInside && !occupied.some((item) => overlaps({ ...grownSpot, width, height }, item, PLACEMENT_CLEARANCE));
  let finalSpot;
  if (grownClear) {
    finalSpot = grownSpot;
  } else {
    const inThisArea = itemsIn(canvas, area);
    const lowestY = inThisArea.length === 0 ? inner.y : Math.max(...inThisArea.map((i) => i.y + i.height));
    finalSpot = { x: inner.x, y: lowestY + PLACEMENT_GAP };
  }
  const neededWidth = Math.max(area.width, Math.round(finalSpot.x + width - area.x + AREA_INSET));
  const neededHeight = Math.max(area.height, Math.round(finalSpot.y + height - area.y + AREA_INSET));
  const shifts = [];
  if (neededWidth > area.width) {
    const deltaX = neededWidth - area.width;
    const rightThreshold = area.x + area.width - PLACEMENT_CLEARANCE;
    for (const item of Object.values(canvas.items)) {
      if (item.id !== area.id && item.x >= rightThreshold) {
        shifts.push({ itemId: item.id, x: item.x + deltaX, y: item.y });
      }
    }
  }
  return {
    x: finalSpot.x,
    y: finalSpot.y,
    areaId: area.id,
    resizedArea: { width: neededWidth, height: neededHeight },
    ...shifts.length > 0 ? { shifts } : {}
  };
}
function areaEnclosing(area, items) {
  if (items.length === 0) return null;
  const maxRight = Math.max(...items.map((i) => i.x + i.width));
  const maxBottom = Math.max(...items.map((i) => i.y + i.height));
  const neededWidth = Math.max(area.width, Math.round(maxRight - area.x + AREA_INSET));
  const neededHeight = Math.max(area.height, Math.round(maxBottom - area.y + AREA_INSET));
  if (neededWidth === area.width && neededHeight === area.height) return null;
  return { width: neededWidth, height: neededHeight };
}
var AREA_ROWS_PROP = "rows";
var AREA_COLS_PROP = "cols";
var AREA_ROW_NAMES_PROP = "rowNames";
var AREA_COL_NAMES_PROP = "colNames";
function splitNames(raw) {
  return (raw ?? "").split(",").map((one2) => one2.trim()).filter((one2) => one2.length > 0);
}
function areaGrid(area) {
  const rows = Number(area.properties[AREA_ROWS_PROP]);
  const cols = Number(area.properties[AREA_COLS_PROP]);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) return null;
  return {
    rows,
    cols,
    rowNames: splitNames(area.properties[AREA_ROW_NAMES_PROP]),
    colNames: splitNames(area.properties[AREA_COL_NAMES_PROP])
  };
}
function gridPatch(grid) {
  if (grid === null) {
    return { removeProperties: [AREA_ROWS_PROP, AREA_COLS_PROP, AREA_ROW_NAMES_PROP, AREA_COL_NAMES_PROP] };
  }
  return {
    properties: {
      [AREA_ROWS_PROP]: String(grid.rows),
      [AREA_COLS_PROP]: String(grid.cols),
      [AREA_ROW_NAMES_PROP]: (grid.rowNames ?? []).join(","),
      [AREA_COL_NAMES_PROP]: (grid.colNames ?? []).join(",")
    }
  };
}
function cellBox(area, row2, col) {
  const grid = areaGrid(area);
  if (!grid) throw new Error(`"${area.title}" has no grid`);
  if (!Number.isInteger(row2) || !Number.isInteger(col) || row2 < 1 || col < 1 || row2 > grid.rows || col > grid.cols) {
    throw new Error(`"${area.title}" is ${grid.rows}\xD7${grid.cols} \u2014 there is no cell ${row2},${col}`);
  }
  const inner = areaInner(area);
  const width = inner.width / grid.cols;
  const height = inner.height / grid.rows;
  return {
    x: Math.round(inner.x + (col - 1) * width),
    y: Math.round(inner.y + (row2 - 1) * height),
    width: Math.round(width),
    height: Math.round(height)
  };
}
function cellOf(area, item) {
  const grid = areaGrid(area);
  if (!grid || !inArea(area, item)) return null;
  const inner = areaInner(area);
  const cx = item.x + item.width / 2 - inner.x;
  const cy = item.y + item.height / 2 - inner.y;
  if (cx < 0 || cy < 0 || cx >= inner.width || cy >= inner.height) return null;
  return {
    row: Math.min(grid.rows, Math.floor(cy / (inner.height / grid.rows)) + 1),
    col: Math.min(grid.cols, Math.floor(cx / (inner.width / grid.cols)) + 1)
  };
}
function cellSpot(canvas, area, row2, col, width, height) {
  const cell = cellBox(area, row2, col);
  const pad = 8;
  const occupied = Object.values(canvas.items).filter((item) => !isArea(item)).map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height }));
  const want = { x: cell.x + pad, y: cell.y + pad, width, height };
  const within = {
    x: cell.x + pad - PLACEMENT_CLEARANCE,
    y: cell.y + pad - PLACEMENT_CLEARANCE,
    width: Math.max(0, cell.width - pad * 2) + PLACEMENT_CLEARANCE * 2,
    height: Math.max(0, cell.height - pad * 2) + PLACEMENT_CLEARANCE * 2
  };
  return nearestFreeSpot(want, occupied, within);
}

// packages/core/src/canvas-scope.ts
function canvasScopes(canvas, item) {
  if (isGroupItem(item)) return [item, ...groupAncestors(canvas, item.id)];
  const parents = groupAncestors(canvas, item.id);
  if (parents.length) return parents;
  const areas = areasOf(canvas).filter((area) => inArea(area, item)).sort((a, b) => a.width * a.height - b.width * b.height);
  return isArea(item) ? [item, ...areas] : areas;
}
function inCanvasScope(canvas, scope, item) {
  return isGroupItem(scope) ? groupAncestors(canvas, item.id).some((parent) => parent.id === scope.id) : inArea(scope, item);
}

// packages/core/src/design-decision-state.ts
var DesignRestoreConflict = class extends OpValidationError {
  constructor(message) {
    super("edit-conflict", message);
    this.name = "DesignRestoreConflict";
  }
};
function sameDesignValue(a, b) {
  const stable = (v) => Array.isArray(v) ? `[${v.map(stable).join(",")}]` : v !== null && typeof v === "object" ? "{" + Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",") + "}" : JSON.stringify(v);
  return stable(a) === stable(b);
}
function currentDesignScope(canvas, item) {
  return { containerId: item.containerId ?? null, scopeIds: canvasScopes(canvas, item).map((scope) => scope.id) };
}
function designTargetMatches(canvas, basis) {
  const item = canvas.items[basis.artifact.itemId], version = item?.versions.find((v) => v.id === item.currentVersionId);
  return !!item && !!version && version.id === basis.artifact.versionId && version.blobHash === basis.artifact.blobHash && item.title === basis.title && item.description === basis.description && sameDesignValue(item.properties, basis.properties) && sameDesignValue(currentDesignScope(canvas, item), basis.scope);
}
function designDecisionMarkdown(record2) {
  if (record2.kind === "comparison") return [`${record2.uncertainty === "structure" ? "Workflow" : "Visual"} directions: ${record2.scenario}`, ...record2.alternatives.map((a2) => `${a2.title}: ${a2.hypothesis}
Tradeoff: ${a2.tradeoff}`), `Recommendation: ${record2.recommendation}`].join("\n\n");
  if (record2.kind === "comparison-response") return `Design response: ${record2.outcome.kind}`;
  const a = record2.input.authority, words = a.kind === "human-choice" ? a.reason : a.rationale;
  return `Adopted ${record2.comparison.alternatives.find((o) => o.id === record2.input.chosenAlternativeId)?.title ?? record2.input.chosenAlternativeId}

${a.kind}${words ? `: ${words}` : ""}`;
}
function validateDesignDecisionComment(comment, canvasId) {
  const meta = comment.designDecision;
  if (meta === void 0) return;
  object3(meta, ["schemaVersion", "opId", "intentHash", "record"]);
  if (meta.schemaVersion !== 1 || comment.design !== void 0 || comment.designLegacySource !== void 0) throw new OpValidationError("bad-op", "invalid canonical design decision comment");
  text(meta.opId);
  hash(meta.intentHash);
  text(comment.author.id);
  text(comment.author.name);
  const record2 = meta.record;
  let required = [];
  if (record2.kind === "comparison") {
    parseDesignComparison(record2);
    required = [record2.brief, ...record2.alternatives.map((o) => o.artifact)];
  } else if (record2.kind === "comparison-response") parseDesignComparisonResponse(record2);
  else {
    object3(record2, ["schemaVersion", "kind", "input", "comparison", "recommendationAuthor", "adopted"]);
    if (record2.kind !== "adoption-decision" || record2.schemaVersion !== 1) throw new OpValidationError("bad-op", "unknown design decision record");
    parseDesignDecisionInput(record2.input);
    parseDesignComparison(record2.comparison);
    parseDesignArtifactRef(record2.adopted);
    object3(record2.recommendationAuthor, ["id", "name"]);
    text(record2.recommendationAuthor.id);
    text(record2.recommendationAuthor.name);
    const d = record2.input, comparison = record2.comparison, chosen = comparison.alternatives.find((o) => o.id === d.chosenAlternativeId);
    if (d.requestId !== comparison.requestId || d.decisionKey !== comparison.decisionKey || d.basis.epoch !== comparison.epoch || !sameDesignValue(d.basis.brief, comparison.brief) || !sameDesignValue(d.basis.alternatives, comparison.alternatives.map((o) => o.artifact)) || d.source.kind === "direct" && !sameDesignValue(d.source.proposal, comparison) || d.source.kind === "comparison" && (d.source.source.payloadId !== comparison.id || d.source.source.revision !== comparison.revision) || record2.adopted.versionId !== d.versionId || record2.adopted.itemId !== d.basis.target.artifact.itemId || record2.adopted.home !== d.basis.target.artifact.home || record2.adopted.canvasId !== d.basis.target.artifact.canvasId || record2.adopted.itemId !== (comparison.target.itemId ?? chosen?.artifact.itemId) || !chosen || chosen.artifact.blobHash !== record2.adopted.blobHash || d.supersedesDecisionId !== comparison.correctsDecisionId) throw new OpValidationError("bad-op", "canonical adoption association disagrees");
    required = [comparison.brief, ...comparison.alternatives.map((o) => o.artifact), d.basis.target.artifact, record2.adopted];
  }
  validateDesignRetainedReferences(comment.designReferences, canvasId, required, 4096);
  if (record2.kind === "adoption-decision") {
    const find = (artifact) => comment.designReferences.find((r2) => sameDesignValue(r2.artifact, artifact)).version;
    const chosen = find(record2.comparison.alternatives.find((o) => o.id === record2.input.chosenAlternativeId).artifact), target = find(record2.input.basis.target.artifact), adopted = find(record2.adopted);
    if (!["text/html", "image/svg+xml"].includes(target.mimeType) || chosen.mimeType !== target.mimeType || adopted.mimeType !== target.mimeType || adopted.filename !== target.filename || adopted.size !== chosen.size || !sameDesignValue(adopted.visual, chosen.visual) || !sameDesignValue(adopted.createdBy, comment.author) || adopted.createdAt !== comment.createdAt) throw new OpValidationError("bad-op", "canonical adopted version disagrees with retained source and target");
  }
}
function rejectDesignDecisionMetadata(op) {
  if (op.type === "thread.create" || op.type === "thread.reply") {
    if ("designDecision" in op.comment) throw new OpValidationError("bad-op", "design decision metadata is writer-owned");
  }
  if (op.type === "comment.update" && "designDecision" in op) throw new OpValidationError("bad-op", "design decision metadata is immutable");
}
function designComparisonStates(canvas) {
  const all = Object.values(canvas.threads).flatMap((t) => t.comments.map((comment) => ({ threadId: t.id, comment })));
  return all.flatMap(({ threadId, comment }) => {
    const comparison = comment.designDecision?.record;
    if (comparison?.kind !== "comparison") return [];
    const source3 = { threadId, commentId: comment.id, payloadId: comparison.id, revision: comparison.revision };
    const responses2 = all.flatMap((row2) => {
      const response = row2.comment.designDecision?.record;
      return response?.kind === "comparison-response" && sameDesignValue(response.comparison, source3) ? [{ source: { threadId: row2.threadId, commentId: row2.comment.id, payloadId: response.id, revision: 1 }, response, author: row2.comment.author }] : [];
    });
    const superseded = all.some((row2) => {
      const next = row2.comment.designDecision?.record;
      return next?.kind === "comparison" && sameDesignValue(next.supersedes, source3);
    });
    const effectiveResponses = responses2.filter((r2) => !responses2.some((later) => later.response.supersedesResponseId === r2.response.id));
    const brief = canvas.items[comparison.brief.itemId], reasons = comment.body !== designDecisionMarkdown(comparison) ? ["The comparison source text changed."] : [];
    if (!brief || brief.currentVersionId !== comparison.brief.versionId || brief.versions.find((v) => v.id === comparison.brief.versionId)?.blobHash !== comparison.brief.blobHash) reasons.push("The comparison brief changed.");
    const decided = all.flatMap((row2) => {
      const r2 = row2.comment.designDecision?.record;
      return r2?.kind === "adoption-decision" && r2.input.source.kind === "comparison" && sameDesignValue(r2.input.source.source, source3) ? [r2] : [];
    })[0];
    return [{ source: source3, comparison, author: comment.author, responses: responses2, currentReporterActorId: null, adoptedDecisionId: decided?.input.id ?? null, effectiveResponse: effectiveResponses.length === 1 ? effectiveResponses[0] : null, status: superseded ? "superseded" : reasons.length ? "stale" : decided || responses2.length ? "settled" : "open", reasons, references: comment.designReferences ?? [] }];
  });
}
function designInputTransition(canvas, briefItemId, requestId, epoch, input, repairs = []) {
  const adoptions = Object.values(canvas.threads).flatMap((t) => t.comments.flatMap((c) => {
    const r2 = c.designDecision?.record;
    return r2?.kind === "adoption-decision" && c.body === designDecisionMarkdown(r2) && r2.input.requestId === requestId && r2.input.basis.brief.itemId === briefItemId && r2.input.basis.epoch === epoch && r2.adopted.itemId === input.itemId ? [{ target: r2.input.basis.target, adopted: r2.adopted, decision: r2 }] : [];
  }));
  const records = [...adoptions, ...repairs.filter((r2) => r2.request.brief.itemId === briefItemId && r2.request.requestId === requestId && r2.request.epoch === epoch && r2.adopted.itemId === input.itemId)];
  let current2 = input, previous;
  const visited = /* @__PURE__ */ new Set();
  for (let i = 0; i <= records.length; i++) {
    const edges = records.filter((r2) => sameDesignValue(r2.target.artifact, current2));
    if (edges.length !== 1 || visited.has(current2.versionId)) return false;
    visited.add(current2.versionId);
    const edge = edges[0];
    if (previous && (!sameDesignValue({ ...previous.target, artifact: previous.adopted }, edge.target) || previous.decision && edge.decision && previous.decision.input.decisionKey === edge.decision.input.decisionKey && edge.decision.input.supersedesDecisionId !== previous.decision.input.id)) return false;
    if (designTargetMatches(canvas, { ...edge.target, artifact: edge.adopted })) return true;
    current2 = edge.adopted;
    previous = edge;
  }
  return false;
}

// packages/core/src/design-repair-state.ts
function validateDesignRepairCanonical(envelope) {
  const op = envelope.op;
  if (op.type !== "design.repair") return;
  const fail2 = () => {
    throw new OpValidationError("bad-op", "canonical repair differs from its captured intent");
  };
  object3(op, ["type", "repair", "effect", "canonical"]);
  const repair = parseDesignRepairInput(op.repair), effect = op.effect, canonical6 = op.canonical;
  if (!effect || !canonical6 || envelope.canvasId !== repair.target.artifact.canvasId) return fail2();
  object3(canonical6, ["intentHash", "retainedReferences"]);
  hash(canonical6.intentHash);
  object3(effect, ["type", "itemId", "expectedVersionId", "expectedMetadata", "patch", "version"]);
  const ref = repair.target.artifact, required = [ref, ...repair.request ? [repair.request.brief] : [], ...repair.review ? [repair.review.run] : [], ...repair.governing.artifact ? [repair.governing.artifact] : []].filter((r2) => r2.home === ref.home && r2.canvasId === ref.canvasId);
  validateDesignRetainedReferences(canonical6.retainedReferences, ref.canvasId, required, 4096);
  const before = canonical6.retainedReferences.find((r2) => sameDesignValue(r2.artifact, ref)).version;
  if (before.mimeType !== "text/html" || effect.type !== "item.edit" || effect.itemId !== ref.itemId || effect.expectedVersionId !== ref.versionId || !sameDesignValue(effect.expectedMetadata, { title: repair.target.title, properties: repair.target.properties }) || !sameDesignValue(effect.patch, {}) || !sameDesignValue(effect.version, { ...repair.version, mimeType: "text/html", filename: before.filename })) fail2();
}
function activeDesignRepairEntries(history) {
  const causes = /* @__PURE__ */ new Map();
  for (const row2 of history) if (row2.cause && (!causes.has(row2.cause.targetSeq) || causes.get(row2.cause.targetSeq).seq < row2.seq)) causes.set(row2.cause.targetSeq, row2);
  return history.filter((row2) => row2.envelope.op.type === "design.repair" && !row2.cause && causes.get(row2.seq)?.cause?.kind !== "undo");
}
function designRepairTransitions(history) {
  return activeDesignRepairEntries(history).flatMap((row2) => {
    validateDesignRepairCanonical(row2.envelope);
    const op = row2.envelope.op, r2 = op.repair;
    return r2.request ? [{ id: row2.envelope.id, request: r2.request, target: r2.target, adopted: { ...r2.target.artifact, versionId: r2.version.id, blobHash: r2.version.blobHash } }] : [];
  });
}

// packages/core/src/text-anchor.ts
function makeTextAnchor(text3, identity, range) {
  const chars = Array.from(text3);
  if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end <= range.start || range.end > chars.length || range.end - range.start > 65536) {
    throw new Error("Select between 1 and 65536 characters in the rendered document");
  }
  return {
    ...identity,
    textSpace: "markdown-hast-v1",
    ...range,
    quote: chars.slice(range.start, range.end).join(""),
    prefix: chars.slice(Math.max(0, range.start - 32), range.start).join(""),
    suffix: chars.slice(range.end, range.end + 32).join("")
  };
}
function validateTextAnchor(value, item) {
  if (value === void 0 || value === null) return null;
  const a = value;
  const version = item?.versions.find((v) => v.id === a.versionId);
  if (!version || ![version, version.visual].some((face) => face?.blobHash === a.blobHash && ["text/markdown", "text/plain"].includes(face.mimeType)) || a.textSpace !== "markdown-hast-v1" || !["document", "text-node", "plain"].includes(a.flavor) || typeof a.quote !== "string" || !a.quote.length || a.quote.length > 131072 || Array.from(a.quote).length > 65536 || typeof a.prefix !== "string" || a.prefix.length > 64 || Array.from(a.prefix).length > 32 || typeof a.suffix !== "string" || a.suffix.length > 64 || Array.from(a.suffix).length > 32 || !Number.isSafeInteger(a.start) || !Number.isSafeInteger(a.end) || a.start < 0 || a.end > 1e7 || a.end - a.start !== Array.from(a.quote).length) {
    throw new OpValidationError("bad-op", "Text anchors need a valid quote and saved Markdown/plain-text representation on the anchored item");
  }
  return { versionId: a.versionId, blobHash: a.blobHash, textSpace: a.textSpace, flavor: a.flavor, quote: a.quote, prefix: a.prefix, suffix: a.suffix, start: a.start, end: a.end };
}
function resolveTextAnchor(anchor, text3, identity) {
  if (!anchor.quote || identity.flavor !== anchor.flavor) return { status: "unavailable" };
  const chars = Array.from(text3);
  if (identity.blobHash === anchor.blobHash && chars.slice(anchor.start, anchor.end).join("") === anchor.quote) return { status: "resolved", start: anchor.start, end: anchor.end };
  const matches = [];
  for (let at2 = text3.indexOf(anchor.quote); at2 >= 0; at2 = text3.indexOf(anchor.quote, at2 + 1)) matches.push(at2);
  if (!matches.length) return { status: "missing" };
  const contextual = matches.length === 1 ? matches : matches.filter((at2) => text3.slice(Math.max(0, at2 - anchor.prefix.length), at2) === anchor.prefix && text3.slice(at2 + anchor.quote.length, at2 + anchor.quote.length + anchor.suffix.length) === anchor.suffix);
  if (contextual.length !== 1) return { status: "ambiguous" };
  const start = Array.from(text3.slice(0, contextual[0])).length;
  return { status: "resolved", start, end: start + Array.from(anchor.quote).length };
}

// packages/core/src/identity.ts
var IDENTITY_COLORS = [
  { name: "Teal", value: "#0f8a80" },
  { name: "Crimson", value: "#c93a55" },
  { name: "Violet", value: "#7a3fd0" },
  { name: "Amber", value: "#b26a00" },
  { name: "Forest", value: "#3a7d2c" },
  { name: "Periwinkle", value: "#3d63dd" },
  { name: "Graphite", value: "#6b7280" }
];
function resolveActor(joined, actorId) {
  if (!joined) return actorId;
  let current2 = actorId;
  const seen = /* @__PURE__ */ new Set([current2]);
  for (; ; ) {
    const next = joined[current2];
    if (next === void 0 || seen.has(next)) return current2;
    seen.add(next);
    current2 = next;
  }
}
function sameActor(joined, a, b) {
  return a === b || resolveActor(joined, a) === resolveActor(joined, b);
}
function actorAliases(joined, actorId) {
  const person = resolveActor(joined, actorId);
  const aliases = [person];
  for (const from of Object.keys(joined ?? {})) {
    if (from !== person && resolveActor(joined, from) === person) aliases.push(from);
  }
  return aliases;
}
function isFaceMark(mark) {
  const trimmed = mark.trim();
  if (!trimmed) return false;
  const graphemes = [...new Intl.Segmenter(void 0, { granularity: "grapheme" }).segment(trimmed)];
  if (graphemes.length !== 1) return false;
  return new RegExp("\\p{Extended_Pictographic}", "u").test(trimmed);
}
function markOf(marks, actor) {
  const mark = marks?.[actor.id];
  return mark ? mark : null;
}
function faceMark(marks, actor, displayName) {
  const mark = markOf(marks, actor);
  if (mark) return mark;
  return (displayName ?? actor.name).trim().charAt(0).toUpperCase();
}
function actorNameIn(names, actor) {
  const current2 = names?.[actor.id];
  return current2 && current2.trim() ? current2 : actor.name;
}
function isIdentityColor(value) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}
function actorColor(actorId, colors) {
  const chosen = colors?.[actorId];
  if (chosen && isIdentityColor(chosen)) return chosen;
  let hash2 = 0;
  for (let i = 0; i < actorId.length; i++) {
    hash2 = hash2 * 31 + actorId.charCodeAt(i) >>> 0;
  }
  return IDENTITY_COLORS[hash2 % (IDENTITY_COLORS.length - 1)].value;
}

// packages/core/src/questionnaire-adoption.ts
function legacyQuestionSet(payload, identity) {
  const valid = parseLegacyQuestionnaire(`/ask ${JSON.stringify(payload)}`);
  if (!valid) throw new OpValidationError("bad-op", "legacy questionnaire is malformed and cannot be adopted");
  return parseDesignQuestionSet({
    schemaVersion: 1,
    kind: "questions",
    ...identity,
    headline: valid.headline ?? "Design questions",
    inferredAnswers: (valid.inferredAnswers ?? []).map((a) => ({ questionId: a.questionId, value: a.displayValue, sources: [] })),
    supersedes: null,
    questions: valid.questions.map((q) => ({ id: q.id, title: q.title, consequence: q.description ?? "No design consequence was recorded in this legacy question.", renderer: q.renderer === "visual-cards" ? "choice-list" : q.renderer, multiple: q.multiSelect ?? false, skippable: q.skippable ?? true, delegatable: true, options: (q.options ?? []).map((o) => ({ id: o.id, title: o.title, consequence: o.description ?? o.body ?? "No tradeoff was recorded." })) }))
  });
}

// packages/core/src/questionnaire.ts
var questionnaireActorsRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/questionnaire/actors`;
var sameSource = (a, b) => a.threadId === b.threadId && a.commentId === b.commentId && a.payloadId === b.payloadId && a.revision === b.revision;
function questionnaireSourceCurrent(canvas, question2) {
  const { source: source3, questions, legacySource } = question2;
  const comment = canvas.threads[source3.threadId]?.comments.find((c) => c.id === source3.commentId);
  if (!comment || comment.design?.kind !== "questions" || comment.design.id !== source3.payloadId || comment.design.revision !== source3.revision || comment.body !== questionnaireQuestionMarkdown(questions, !!legacySource)) return false;
  return !legacySource || canvas.threads[legacySource.threadId]?.comments.find((c) => c.id === legacySource.commentId)?.body === legacySource.body;
}
function questionnaireStates(canvas, filter = {}) {
  const all = Object.values(canvas.threads).flatMap((thread) => thread.comments.map((comment) => ({ thread, comment })));
  const asks = all.filter(({ comment }) => comment.design?.kind === "questions");
  return asks.flatMap(({ thread, comment }) => {
    const questions = comment.design;
    if (filter.threadId && filter.threadId !== thread.id || filter.requestId && filter.requestId !== questions.requestId || filter.respondentActorId && !sameActor(filter.joined, filter.respondentActorId, questions.respondentActorId)) return [];
    const source3 = { threadId: thread.id, commentId: comment.id, payloadId: questions.id, revision: questions.revision };
    const responses2 = all.flatMap(({ thread: answerThread, comment: answer }) => {
      const response = answer.design;
      return response?.kind === "response" && answerThread.id === source3.threadId && sameSource(response.question, source3) && response.requestId === questions.requestId && response.epoch === questions.epoch ? [{ response, commentId: answer.id, author: answer.author }] : [];
    });
    const live = responses2.filter((r2) => !responses2.some((other) => other.response.supersedesResponseId === r2.response.id));
    const resolutions = live.flatMap((r2) => r2.response.resolutions);
    const outstandingQuestionIds = questions.questions.filter((q) => !resolutions.some((r2) => r2.questionId === q.id)).map((q) => q.id);
    const brief = canvas.items[questions.brief.itemId];
    const superseded = asks.some(({ comment: other }) => other.design?.kind === "questions" && other.design.supersedes && sameSource(other.design.supersedes, source3));
    const legacy = comment.designLegacySource;
    const stale = !questionnaireSourceCurrent(canvas, { source: source3, questions, ...legacy ? { legacySource: legacy } : {} }) || !brief || brief.currentVersionId !== questions.brief.versionId || brief.versions.find((v) => v.id === questions.brief.versionId)?.blobHash !== questions.brief.blobHash;
    const references = [comment, ...responses2.map((r2) => all.find(({ thread: t, comment: c }) => t.id === source3.threadId && c.id === r2.commentId).comment)].flatMap((c) => c.designReferences ?? []);
    return [{ source: source3, questions, author: comment.author, responses: responses2, resolutions, outstandingQuestionIds, references, status: superseded ? "superseded" : stale ? "stale" : outstandingQuestionIds.length ? "open" : "answered", ...legacy ? { legacySource: legacy } : {} }];
  });
}
function questionnaireQuestionMarkdown(questions, adopted = false) {
  return [
    ...adopted ? ["Adopted legacy questionnaire for the named respondent.", ""] : [],
    questions.headline,
    ...questions.inferredAnswers.map((a) => `Using ${a.questionId}: ${a.value}`),
    ...questions.questions.map((q) => [`${q.title} \u2014 ${q.consequence}`, ...q.options.map((o) => `- ${o.title}: ${o.consequence}`)].join("\n"))
  ].join("\n\n");
}
function questionnaireArtifacts(design) {
  const references = design.kind === "questions" ? [design.brief, ...design.inferredAnswers.flatMap((a) => a.sources), ...design.questions.flatMap((q) => q.options.flatMap((o) => o.preview ? [o.preview] : []))] : design.resolutions.flatMap((r2) => r2.state === "answered" && r2.value.kind === "references" ? r2.value.references.flatMap((reference) => reference.artifact ? [reference.artifact] : []) : []);
  if (references.length > 1024) throw new OpValidationError("bad-op", "questionnaire has too many retained references");
  return references;
}
function rejectQuestionnaireMetadata(op) {
  const raw = op;
  const comment = op.type === "thread.create" || op.type === "thread.reply" ? op.comment : op.type === "comment.update" ? raw : null;
  const fields3 = ["design", "designReferences", "designLegacySource"];
  if (comment && fields3.some((key) => key in comment) || fields3.some((key) => key in raw)) throw new OpValidationError("bad-op", "typed questionnaire metadata is writer-owned; use questionnaire.ask or questionnaire.answer");
}
function validateQuestionnaireComment(comment, canvasId) {
  try {
    validateCanonicalComment(comment, canvasId);
  } catch (error) {
    if (error instanceof DesignPartnerContractError) throw new OpValidationError("bad-op", error.message);
    throw error;
  }
}
function validateCanonicalComment(comment, canvasId) {
  if (comment.designDecision !== void 0) {
    validateDesignDecisionComment(comment, canvasId);
    return;
  }
  if (comment.design === void 0) {
    if (comment.designReferences !== void 0 || comment.designLegacySource !== void 0) throw new OpValidationError("bad-op", "questionnaire metadata requires a typed record");
    return;
  }
  const design = comment.design?.kind === "questions" ? parseDesignQuestionSet(comment.design) : parseDesignResponse(comment.design);
  if (comment.designLegacySource !== void 0 && (design.kind !== "questions" || !obj(comment.designLegacySource, ["threadId", "commentId", "body"]) || !str(comment.designLegacySource.threadId) || !str(comment.designLegacySource.commentId) || !parseLegacyQuestionnaire(comment.designLegacySource.body))) throw new OpValidationError("bad-op", "invalid retained legacy questionnaire source");
  validateDesignRetainedReferences(comment.designReferences, canvasId, questionnaireArtifacts(design), 1024);
}
var obj = (value, fields3) => !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => fields3.includes(key));
var str = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 32e3;
var optionalStrings = (value, names) => names.every((key) => value[key] === void 0 || str(value[key]));
function parseLegacyQuestionnaire(body) {
  if (!/^\/ask\s+\{/.test(body) || body.length > 256e3) return null;
  try {
    const value = JSON.parse(body.slice(4).trim());
    if (!obj(value, ["headline", "inferredAnswers", "questions"]) || !optionalStrings(value, ["headline"]) || !Array.isArray(value.questions) || !value.questions.length || value.questions.length > 32) return null;
    const questionIds = /* @__PURE__ */ new Set();
    for (const q of value.questions) {
      if (!obj(q, ["id", "title", "description", "renderer", "label", "multiSelect", "skippable", "placeholder", "options"]) || !str(q.id) || questionIds.has(q.id) || !str(q.title) || !optionalStrings(q, ["description", "label", "placeholder"]) || !["choice-list", "visual-cards", "upload", "url-collection", "freeform"].includes(q.renderer) || ["multiSelect", "skippable"].some((key) => q[key] !== void 0 && typeof q[key] !== "boolean")) return null;
      questionIds.add(q.id);
      const isChoice = q.renderer === "choice-list" || q.renderer === "visual-cards";
      if (isChoice && (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 12) || !isChoice && q.options !== void 0 && (!Array.isArray(q.options) || q.options.length !== 0)) return null;
      const optionIds = /* @__PURE__ */ new Set();
      for (const o of q.options ?? []) {
        if (!obj(o, ["id", "title", "body", "eyebrow", "colors", "description"]) || !str(o.id) || optionIds.has(o.id) || !str(o.title) || !optionalStrings(o, ["body", "eyebrow", "description"]) || o.colors !== void 0 && (!Array.isArray(o.colors) || o.colors.length > 12 || o.colors.some((color) => typeof color !== "string" || !/^#[\da-f]{3,8}$/i.test(color)))) return null;
        optionIds.add(o.id);
      }
    }
    if (value.inferredAnswers !== void 0 && (!Array.isArray(value.inferredAnswers) || value.inferredAnswers.length > 1e3 || new Set(value.inferredAnswers.map((a) => a?.questionId)).size !== value.inferredAnswers.length || value.inferredAnswers.some((a) => !obj(a, ["questionId", "displayValue"]) || !str(a.questionId) || !str(a.displayValue)))) return null;
    return structuredClone(value);
  } catch {
    return null;
  }
}

// packages/core/src/design-partner-plan.ts
function refuse(code, reason) {
  throw new DesignPartnerContractError(code, reason);
}
function sameDesignArtifact(a, b) {
  return a.home === b.home && a.canvasId === b.canvasId && a.itemId === b.itemId && a.versionId === b.versionId && a.blobHash === b.blobHash;
}
function sameQuestion(a, b) {
  return a.threadId === b.threadId && a.commentId === b.commentId && a.payloadId === b.payloadId && a.revision === b.revision;
}
function currentRequest(request, record2, basis) {
  const brief = parseDesignBrief(request.brief);
  if (brief.requestId !== record2.requestId) refuse("association", "This record belongs to another request.");
  if (brief.epoch !== record2.epoch || brief.progress !== "active") refuse("stale", "The design request has changed or is no longer active.");
  if (!sameDesignArtifact(request.ref, basis) || brief.context.canvasId !== request.ref.canvasId) refuse("stale", "The record was based on a different brief version.");
}
function validateDesignResponseAssociation(input, context, actor) {
  const response = parseDesignResponse(input), questions = parseDesignQuestionSet(context.questions);
  currentRequest(context.request, questions, questions.brief);
  currentRequest(context.request, response, questions.brief);
  if (context.sourceStatus !== "current") refuse("stale", "The question was removed or superseded.");
  if (questions.id !== context.source.payloadId || questions.revision !== context.source.revision || !sameQuestion(response.question, context.source)) refuse("association", "The answer does not name this exact question version.");
  if (isSystemActor(actor.actorId) || actor.kind !== "human" || actor.actorId !== response.respondentActorId || actor.actorId !== questions.respondentActorId) refuse("actor", "Only the intended human respondent can resolve this question.");
  for (const answer of response.resolutions) {
    const q = questions.questions.find((one2) => one2.id === answer.questionId);
    if (!q) refuse("association", "The answer names an unknown question.");
    if (answer.state === "skipped" && !q.skippable) refuse("invalid", "This question cannot be skipped.");
    if (answer.state === "delegated" && (!q.delegatable || answer.agentActorId === actor.actorId || isSystemActor(answer.agentActorId))) refuse("actor", "This question cannot be delegated to that actor.");
    if (answer.state !== "answered") continue;
    const value = answer.value;
    if (value.kind === "options") {
      if (q.renderer !== "choice-list" && q.renderer !== "visual-cards") refuse("invalid", "This question does not accept option answers.");
      if (!q.multiple && value.optionIds.length !== 1) refuse("invalid", "This question accepts one option.");
      if (value.optionIds.some((id) => !q.options.some((o) => o.id === id))) refuse("association", "The answer names a removed or unknown option.");
    } else if (value.kind === "references") {
      if (q.renderer !== "upload" && q.renderer !== "url-collection") refuse("invalid", "This question does not accept reference answers.");
      if (q.renderer === "upload" && value.references.some((r2) => r2.state !== "fetched" || !r2.artifact)) refuse("invalid", "An upload answer requires retrievable uploaded versions.");
    } else if (q.renderer === "upload" || q.renderer === "url-collection") refuse("invalid", "Reference questions require identified references.");
  }
  return response;
}
function canonical4(value) {
  if (Array.isArray(value)) return `[${value.map(canonical4).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical4(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function designResponseMarkdown(response, questions) {
  return ["Design answers", ...response.resolutions.map((answer) => {
    const q = questions.questions.find((one2) => one2.id === answer.questionId);
    if (!q) refuse("association", "The answer names an unknown question.");
    let value;
    if (answer.state === "answered") {
      const result = answer.value;
      value = result.kind === "text" ? result.text : result.kind === "options" ? result.optionIds.map((id) => {
        const option = q.options.find((o) => o.id === id);
        if (!option) refuse("association", "The answer names an unknown option.");
        return option.title;
      }).join(", ") : result.references.map((r2) => `${r2.url ?? r2.artifact.itemId} (${r2.state})`).join(", ");
    } else value = answer.state === "delegated" ? `Delegated to ${answer.agentActorId}` : answer.state === "skipped" ? "Skipped" : "Dismissed";
    return `- ${q.title}: ${value}`;
  })].join("\n");
}
function planDesignAnswer(input) {
  const response = parseDesignResponse(input.response);
  if (!input.commentId.trim() || !input.opId.trim()) refuse("invalid", "Retry identities must be generated before submitting.");
  const previous = (input.previousResponses ?? []).map(parseDesignResponse);
  const retry = previous.find((r2) => r2.id === response.id);
  if (retry) {
    if (canonical4(retry) !== canonical4(response)) refuse("conflict", "The response identity was reused with different content.");
    if (input.context.request.brief.requestId !== response.requestId) refuse("association", "The accepted answer belongs to another request.");
    if (input.actor.actorId !== retry.respondentActorId || isSystemActor(input.actor.actorId)) refuse("actor", "Only the original respondent may retry this answer.");
    return { kind: "already-recorded", responseId: response.id };
  }
  validateDesignResponseAssociation(response, input.context, input.actor);
  if (response.supersedesResponseId !== null) {
    const replaced = previous.find((r2) => r2.id === response.supersedesResponseId);
    if (!replaced || replaced.respondentActorId !== response.respondentActorId || !sameQuestion(replaced.question, response.question) || replaced.requestId !== response.requestId || replaced.epoch !== response.epoch) refuse("association", "The superseded response does not belong to this respondent and question.");
    if (previous.some((r2) => r2.supersedesResponseId === replaced.id)) refuse("stale", "This answer has already been superseded.");
    if (replaced.resolutions.some((prior) => !response.resolutions.some((next) => next.questionId === prior.questionId))) refuse("invalid", "A replacement must retain an explicit resolution for every previously answered question.");
  }
  const live = previous.filter((r2) => r2.requestId === response.requestId && r2.epoch === response.epoch && sameQuestion(r2.question, response.question) && !previous.some((other) => other.supersedesResponseId === r2.id) && r2.id !== response.supersedesResponseId);
  if (live.some((r2) => r2.resolutions.some((a) => response.resolutions.some((b) => a.questionId === b.questionId)))) refuse("conflict", "This question already has an answer; supersede it explicitly.");
  return { kind: "answer-materialization", reply: { type: "thread.reply", threadId: response.question.threadId, comment: { id: input.commentId, body: designResponseMarkdown(response, input.context.questions) } }, design: response, opId: input.opId, guard: { requestId: response.requestId, epoch: response.epoch, brief: structuredClone(input.context.request.ref), question: structuredClone(response.question) } };
}

// packages/core/src/reducer.ts
function applyOperation(state, envelope) {
  try {
    return applyValidatedOperation(state, envelope);
  } catch (error) {
    if (error instanceof DesignPartnerContractError) throw new OpValidationError("bad-op", error.message);
    throw error;
  }
}
function applyValidatedOperation(state, envelope) {
  const op = envelope.op;
  rejectQuestionnaireMetadata(op);
  rejectDesignDecisionMetadata(op);
  if ((op.type === "item.add" || op.type === "item.edit" || op.type === "item.addVersion") && op.version.designRecord !== void 0) throw new OpValidationError("bad-op", "design admission requires its canonical design operation");
  const contexts = op.type === "questionnaire.ask" || op.type === "questionnaire.answer" ? [op.context] : op.type === "thread.create" || op.type === "thread.reply" || op.type === "comment.restore" ? [op.comment.context] : op.type === "comment.update" ? [op.context] : op.type === "thread.restore" ? op.thread.comments.map((comment) => comment.context) : [];
  if (op.type === "comment.restore") validateQuestionnaireComment(op.comment, envelope.canvasId);
  if (op.type === "thread.restore") for (const comment of op.thread.comments) validateQuestionnaireComment(comment, envelope.canvasId);
  for (const context of contexts) if (context) {
    if (!state || state.project.groupMode !== "groups") throw new OpValidationError("bad-op", "frozen context requires a group-mode canvas");
    validateContextManifest(context, state.project.id);
  }
  const next = reduceOperation(state, envelope);
  if (next?.project.groupMode === "groups") validateGroupForest(next);
  if (next) validateDesignRecordState(next);
  if (next) for (const thread of Object.values(next.canvas.threads)) for (const comment of thread.comments) validateDesignDecisionComment(comment, next.project.id);
  return next;
}
function reduceOperation(state, envelope) {
  const { op, actor, ts } = envelope;
  if (op.type === "project.create") {
    if (state !== null) {
      throw new OpValidationError("bad-op", "project.create on existing canvas");
    }
    const project2 = {
      id: op.canvasId,
      title: op.title,
      description: op.description ?? "",
      properties: { ...op.properties },
      ...op.groupMode !== void 0 ? { groupMode: op.groupMode } : {},
      createdAt: ts,
      createdBy: actor,
      updatedAt: ts,
      updatedBy: actor
    };
    return { project: project2, canvas: emptyCanvas() };
  }
  if (state === null) {
    throw new OpValidationError("bad-op", `${op.type} on missing canvas`);
  }
  if (op.type === "project.delete") {
    return null;
  }
  const stamp = { updatedAt: ts, updatedBy: actor };
  const { project, canvas } = state;
  const touched = { ...project, ...stamp, lastOp: op.type };
  const withCanvas = (next) => ({
    project: touched,
    canvas: next
  });
  const getItem = (itemId) => {
    const item = canvas.items[itemId];
    if (!item) throw new OpValidationError("unknown-item", `unknown item: ${itemId}`);
    return item;
  };
  const putItem = (item) => withCanvas({ ...canvas, items: { ...canvas.items, [item.id]: item } });
  const getThread = (threadId) => {
    const thread = canvas.threads[threadId];
    if (!thread) throw new OpValidationError("unknown-thread", `unknown thread: ${threadId}`);
    return thread;
  };
  switch (op.type) {
    case "design.repair": {
      validateDesignRepairCanonical(envelope);
      if (!designTargetMatches(canvas, op.repair.target)) throw new OpValidationError("edit-conflict", "The captured repair target changed.");
      const next = reduceOperation(state, { ...envelope, actor: { id: actor.id, name: actor.name }, op: op.effect });
      return { ...next, project: { ...next.project, lastOp: op.type } };
    }
    case "design.compare":
    case "design.respond": {
      const comment = op.canonicalComment, expected = op.type === "design.compare" ? op.comparison : op.response;
      if (!comment || comment.id !== op.commentId || comment.author.id !== actor.id || comment.designDecision?.opId !== envelope.id || !sameDesignValue(comment.designDecision.record, expected)) throw new OpValidationError("bad-op", "canonical comparison effect disagrees with intent");
      validateDesignDecisionComment(comment, project.id);
      return reduceOperation(state, { ...envelope, op: { type: "comment.restore", threadId: op.threadId, comment } });
    }
    case "design.decide": {
      const effect = op.effect, record2 = effect?.comment.designDecision?.record;
      if (!effect || Object.keys(effect).some((key) => !["edit", "threadId", "comment"].includes(key)) || effect.edit.type !== "item.edit" || Object.keys(effect.edit).some((key) => !["type", "itemId", "version", "expectedVersionId", "expectedMetadata", "patch"].includes(key)) || effect.threadId !== op.threadId || effect.comment.id !== op.commentId || effect.comment.author.id !== actor.id || effect.comment.designDecision?.opId !== envelope.id || record2?.kind !== "adoption-decision" || !sameDesignValue(record2.input, op.decision) || effect.edit.itemId !== op.decision.basis.target.artifact.itemId || effect.edit.version.id !== op.decision.versionId || effect.edit.version.blobHash !== record2.adopted.blobHash || Object.keys(effect.edit.patch).length || !sameDesignValue(effect.edit.expectedMetadata, { title: op.decision.basis.target.title, properties: op.decision.basis.target.properties }) || !designTargetMatches(canvas, op.decision.basis.target)) throw new OpValidationError("edit-conflict", "canonical adoption pair disagrees or its approved target changed");
      validateDesignDecisionComment(effect.comment, project.id);
      if (record2.input.source.kind === "comparison") {
        const source3 = record2.input.source.source, sourceComment = canvas.threads[source3.threadId]?.comments.find((c) => c.id === source3.commentId);
        if (source3.threadId !== op.threadId || !sourceComment || !sameDesignValue(sourceComment.designDecision?.record, record2.comparison) || sourceComment.body !== designDecisionMarkdown(record2.comparison) || !sameDesignValue(sourceComment.author, record2.recommendationAuthor)) throw new OpValidationError("bad-op", "canonical adoption source or recommendation author disagrees");
      } else if (!sameDesignValue(record2.recommendationAuthor, { id: actor.id, name: actor.name })) throw new OpValidationError("bad-op", "direct recommendation author disagrees");
      const retained = effect.comment.designReferences.find((r2) => sameDesignValue(r2.artifact, record2.adopted));
      const { createdAt: _createdAt, createdBy: _createdBy, ...version } = retained.version;
      if (!sameDesignValue(effect.edit.version, version) || effect.edit.expectedVersionId !== record2.input.basis.target.artifact.versionId || effect.comment.createdAt !== ts || !sameDesignValue(effect.comment.author, { id: actor.id, name: actor.name })) throw new OpValidationError("bad-op", "canonical edit differs from its retained adopted version");
      const edited = reduceOperation(state, { ...envelope, actor: { id: actor.id, name: actor.name }, op: effect.edit });
      const next = reduceOperation(edited, { ...envelope, op: { type: "comment.restore", threadId: effect.threadId, comment: effect.comment } });
      return { ...next, project: { ...next.project, lastOp: op.type } };
    }
    case "design.restore": {
      const e2 = op.effect, current2 = canvas.threads[e2.threadId]?.comments.find((c) => c.id === e2.commentId) ?? null;
      if (!designTargetMatches(canvas, e2.target) || !canvas.threads[e2.threadId] || !sameDesignValue(current2, e2.expectedComment) || e2.item.itemId !== e2.target.artifact.itemId || e2.comment && e2.comment.id !== e2.commentId || e2.comment === null && e2.expectedComment === null) throw new DesignRestoreConflict("The adopted target or decision comment changed; neither half was restored.");
      if (Object.keys(e2).some((key) => !["target", "item", "threadId", "commentId", "expectedComment", "comment"].includes(key)) || e2.item.type !== "item.removeVersion" && e2.item.type !== "item.restoreVersion") throw new DesignRestoreConflict("Invalid paired restoration.");
      const original = e2.expectedComment ?? e2.comment, record2 = original?.designDecision?.record;
      if (!original || record2?.kind !== "adoption-decision") throw new DesignRestoreConflict("Paired restoration requires its original decision.");
      validateDesignDecisionComment(original, project.id);
      const adopted = original.designReferences.find((r2) => sameDesignValue(r2.artifact, record2.adopted)).version;
      const removing = e2.item.type === "item.removeVersion";
      if (Object.keys(e2.item).some((key) => !(removing ? ["type", "itemId", "versionId", "prevCurrentVersionId", "patch"] : ["type", "itemId", "version", "patch"]).includes(key))) throw new DesignRestoreConflict("Unknown paired restoration semantics.");
      if (!sameDesignValue(e2.target, { ...record2.input.basis.target, artifact: removing ? record2.adopted : record2.input.basis.target.artifact }) || e2.item.patch && Object.keys(e2.item.patch).length || e2.item.type === "item.removeVersion" && (e2.comment !== null || e2.item.versionId !== record2.adopted.versionId || e2.item.prevCurrentVersionId !== record2.input.basis.target.artifact.versionId) || e2.item.type === "item.restoreVersion" && (e2.expectedComment !== null || !sameDesignValue(e2.item.version, adopted))) throw new DesignRestoreConflict("Restoration disagrees with its exact original target/comment pair.");
      const edited = reduceOperation(state, { ...envelope, op: e2.item });
      const next = reduceOperation(edited, { ...envelope, op: e2.comment ? { type: "comment.restore", threadId: e2.threadId, comment: e2.comment } : { type: "comment.remove", threadId: e2.threadId, commentId: e2.commentId } });
      return { ...next, project: { ...next.project, lastOp: op.type } };
    }
    case "design.request":
    case "design.receipt": {
      if (!op.effect) throw new OpValidationError("bad-op", "design act requires its canonical writer effect");
      validateDesignRecordEffect(state, envelope);
      const next = reduceOperation(state, { ...envelope, op: op.effect });
      return next && { ...next, project: { ...next.project, lastOp: op.type } };
    }
    case "group.change": {
      const resolved = op.action.kind === "apply" ? op : resolveGroupOperation(state, op, { actor, ts, opId: envelope.id });
      if (resolved.action.kind !== "apply") throw new OpValidationError("bad-op", "unresolved group operation");
      return applyGroupChange(state, resolved.action.change, actor, ts);
    }
    case "actor.claim":
    case "actor.setColor":
    case "actor.setMark":
    case "actor.join":
      throw new OpValidationError("bad-op", `${op.type} is not a canvas operation`);
    case "project.update":
      return {
        project: { ...project, ...applyMetaPatch(project, op.patch), ...stamp },
        canvas
      };
    case "item.add": {
      if (canvas.items[op.itemId] || canvas.trash.some((t) => t.item.id === op.itemId)) {
        throw new OpValidationError("duplicate-id", `item id already exists: ${op.itemId}`);
      }
      requireFinite({ width: op.width, height: op.height }, "item.add");
      if ("x" in op.placement) {
        requireFinite({ x: op.placement.x, y: op.placement.y }, "item.add placement");
      }
      const { x, y } = resolvePlacement(
        canvas,
        op.placement,
        op.width,
        op.height,
        positionIsMeaningful(op)
      );
      const item = {
        id: op.itemId,
        x,
        y,
        width: op.width,
        height: op.height,
        title: op.title ?? op.version.filename,
        description: op.description ?? "",
        properties: { ...op.properties },
        versions: [toItemVersion(op.version, actor, ts)],
        currentVersionId: op.version.id,
        createdAt: ts,
        createdBy: actor,
        ...stamp
      };
      return putItem(item);
    }
    case "item.react": {
      const item = getItem(op.itemId);
      const emoji = op.emoji.trim();
      if (!emoji) throw new OpValidationError("bad-op", "item.react: an emoji is required");
      const worn = item.reactions?.[emoji] ?? [];
      const next = op.on ? worn.includes(actor.id) ? worn : [...worn, actor.id] : worn.filter((id) => id !== actor.id);
      const reactions = { ...item.reactions };
      if (next.length > 0) reactions[emoji] = next;
      else delete reactions[emoji];
      const hasAny = Object.keys(reactions).length > 0;
      if (op.at !== void 0) {
        const { x, y } = op.at;
        if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) {
          throw new OpValidationError("bad-op", "item.react: `at` is a point on the item, 0..1 each");
        }
      }
      const points = { ...item.reactionPoints };
      if (op.on && op.at !== void 0) {
        points[emoji] = { ...points[emoji], [actor.id]: { x: op.at.x, y: op.at.y } };
      }
      const hasPoints = Object.keys(points).length > 0;
      const { reactions: _drop, reactionPoints: _dropPoints, ...rest } = item;
      return putItem({
        ...rest,
        ...hasAny ? { reactions } : {},
        ...hasPoints ? { reactionPoints: points } : {},
        ...stamp
      });
    }
    case "item.move":
      requireFinite({ x: op.x, y: op.y }, "item.move");
      return putItem({ ...getItem(op.itemId), x: op.x, y: op.y, ...stamp });
    case "item.resize":
      requireFinite({ width: op.width, height: op.height }, "item.resize");
      return putItem({ ...getItem(op.itemId), width: op.width, height: op.height, ...stamp });
    case "item.update": {
      const item = getItem(op.itemId);
      const renamed = op.filename === void 0 ? item.versions : item.versions.map(
        (version) => version.id === item.currentVersionId ? { ...version, filename: op.filename } : version
      );
      return putItem({
        ...item,
        ...applyMetaPatch(item, op.patch),
        versions: renamed,
        ...stamp
      });
    }
    case "item.edit":
    case "item.addVersion": {
      const item = getItem(op.itemId);
      if (op.type === "item.edit") {
        const expected = op.expectedMetadata;
        if (item.currentVersionId !== op.expectedVersionId || expected && (item.title !== expected.title || Object.keys({ ...item.properties, ...expected.properties }).some(
          (key) => item.properties[key] !== expected.properties[key]
        ))) {
          throw new OpValidationError("edit-conflict", `\u201C${item.title}\u201D changed while editing. Reload it before saving; your draft has not been applied.`);
        }
      }
      if (item.versions.some((v) => v.id === op.version.id)) {
        throw new OpValidationError("duplicate-id", `version id already exists: ${op.version.id}`);
      }
      return putItem({
        ...item,
        ...op.type === "item.edit" ? applyMetaPatch(item, op.patch) : {},
        versions: [...item.versions, toItemVersion(op.version, actor, ts)],
        currentVersionId: op.version.id,
        ...stamp
      });
    }
    case "item.setCurrentVersion": {
      const item = getItem(op.itemId);
      requireVersion(item, op.versionId);
      return putItem({ ...item, currentVersionId: op.versionId, ...stamp });
    }
    case "item.pruneVersions": {
      const item = getItem(op.itemId);
      if (!Number.isInteger(op.keep) || op.keep < 1) {
        throw new OpValidationError("bad-op", `keep must be a whole number of at least 1: ${op.keep}`);
      }
      return putItem({ ...item, versions: pruneVersions(item, op.keep), ...stamp });
    }
    case "item.removeVersion": {
      const item = getItem(op.itemId);
      requireVersion(item, op.versionId);
      const versions = item.versions.filter((v) => v.id !== op.versionId);
      if (versions.length === 0) {
        throw new OpValidationError("bad-op", "cannot remove the only version");
      }
      if (!versions.some((v) => v.id === op.prevCurrentVersionId)) {
        throw new OpValidationError(
          "unknown-version",
          `prevCurrentVersionId not among remaining versions: ${op.prevCurrentVersionId}`
        );
      }
      return putItem({ ...item, ...op.patch ? applyMetaPatch(item, op.patch) : {}, versions, currentVersionId: op.prevCurrentVersionId, ...stamp });
    }
    case "item.restoreVersion": {
      const item = getItem(op.itemId);
      if (item.versions.some((v) => v.id === op.version.id)) {
        throw new OpValidationError("duplicate-id", `version id already exists: ${op.version.id}`);
      }
      return putItem({
        ...item,
        ...op.patch ? applyMetaPatch(item, op.patch) : {},
        versions: [...item.versions, op.version],
        currentVersionId: op.version.id,
        ...stamp
      });
    }
    case "item.delete": {
      const item = getItem(op.itemId);
      const items = { ...canvas.items };
      delete items[op.itemId];
      return withCanvas({
        ...canvas,
        items,
        trash: [...canvas.trash, { item, deletedAt: ts, deletedBy: actor }]
      });
    }
    case "item.restore": {
      const entry = canvas.trash.find((t) => t.item.id === op.itemId);
      if (!entry) throw new OpValidationError("not-in-trash", `item not in trash: ${op.itemId}`);
      return withCanvas({
        ...canvas,
        items: { ...canvas.items, [op.itemId]: entry.item },
        trash: canvas.trash.filter((t) => t.item.id !== op.itemId)
      });
    }
    case "items.move": {
      requireUniqueIds(op.moves.map((m) => m.itemId));
      for (const move of op.moves) {
        getItem(move.itemId);
        requireFinite({ x: move.x, y: move.y }, `items.move ${move.itemId}`);
      }
      const items = { ...canvas.items };
      for (const move of op.moves) {
        items[move.itemId] = { ...items[move.itemId], x: move.x, y: move.y, ...stamp };
      }
      return withCanvas({ ...canvas, items });
    }
    case "items.delete": {
      requireUniqueIds(op.itemIds);
      const deleted = op.itemIds.map(getItem);
      const items = { ...canvas.items };
      for (const itemId of op.itemIds) delete items[itemId];
      return withCanvas({
        ...canvas,
        items,
        trash: [
          ...canvas.trash,
          ...deleted.map((item) => ({ item, deletedAt: ts, deletedBy: actor }))
        ]
      });
    }
    case "items.restore": {
      requireUniqueIds(op.itemIds);
      const wanted = new Set(op.itemIds);
      const entries = canvas.trash.filter((t) => wanted.has(t.item.id));
      if (entries.length !== op.itemIds.length) {
        const found = new Set(entries.map((t) => t.item.id));
        const missing2 = op.itemIds.find((id) => !found.has(id));
        throw new OpValidationError("not-in-trash", `item not in trash: ${missing2}`);
      }
      const items = { ...canvas.items };
      for (const entry of entries) items[entry.item.id] = entry.item;
      return withCanvas({
        ...canvas,
        items,
        trash: canvas.trash.filter((t) => !wanted.has(t.item.id))
      });
    }
    case "trash.empty": {
      const { groupCohorts: _dropCohorts, ...remaining } = canvas;
      return withCanvas({ ...remaining, trash: [] });
    }
    case "thread.create": {
      if (canvas.threads[op.threadId]) {
        throw new OpValidationError("duplicate-id", `thread id already exists: ${op.threadId}`);
      }
      requireBody(op.comment.body);
      requireFinite({ x: op.x, y: op.y }, "thread.create");
      if (op.anchorItemId !== null) getItem(op.anchorItemId);
      const textAnchor = validateTextAnchor(op.textAnchor, op.anchorItemId ? canvas.items[op.anchorItemId] : void 0);
      if (op.main && mainThread(canvas)) {
        throw new OpValidationError("main-exists", "canvas already has a main thread");
      }
      const thread = {
        id: op.threadId,
        x: op.x,
        y: op.y,
        anchorItemId: op.anchorItemId,
        ...textAnchor ? { textAnchor } : {},
        comments: [toComment(op.comment, actor, ts)],
        ...op.main ? { main: true } : {},
        createdAt: ts,
        createdBy: actor
      };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [thread.id]: thread } });
    }
    case "questionnaire.ask":
    case "questionnaire.answer": {
      const thread = getThread(op.threadId);
      if (thread.comments.some((c) => c.id === op.commentId)) throw new OpValidationError("duplicate-id", `comment id already exists: ${op.commentId}`);
      const design = op.type === "questionnaire.ask" ? parseDesignQuestionSet(op.questions) : parseDesignResponse(op.response);
      let body;
      if (design.kind === "questions") body = questionnaireQuestionMarkdown(design, op.type === "questionnaire.ask" && !!op.legacySource);
      else {
        const source3 = questionnaireStates(state.canvas).find((q) => q.source.threadId === design.question.threadId && q.source.commentId === design.question.commentId && q.source.payloadId === design.question.payloadId && q.source.revision === design.question.revision);
        if (!source3 || source3.questions.requestId !== design.requestId || source3.questions.epoch !== design.epoch) throw new OpValidationError("bad-op", "questionnaire response source association disagrees");
        body = designResponseMarkdown(design, source3.questions);
      }
      const comment = { id: op.commentId, author: actor, body, createdAt: ts, design, designReferences: structuredClone(op.retainedReferences ?? []), ...op.context ? { context: structuredClone(op.context) } : {}, ...op.type === "questionnaire.ask" && op.legacySource ? { designLegacySource: structuredClone(op.legacySource) } : {} };
      validateQuestionnaireComment(comment, state.project.id);
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [thread.id]: { ...thread, comments: [...thread.comments, comment] } } });
    }
    case "thread.reply": {
      const thread = getThread(op.threadId);
      requireBody(op.comment.body);
      if (thread.comments.some((c) => c.id === op.comment.id)) {
        throw new OpValidationError("duplicate-id", `comment id already exists: ${op.comment.id}`);
      }
      const next = { ...thread, comments: [...thread.comments, toComment(op.comment, actor, ts)] };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }
    case "thread.setMain": {
      const prev = mainThread(canvas);
      const next = op.threadId === null ? null : getThread(op.threadId);
      if (prev?.id === next?.id) return withCanvas(canvas);
      const threads = { ...canvas.threads };
      if (prev) {
        const demoted = { ...prev };
        delete demoted.main;
        threads[prev.id] = demoted;
      }
      if (next) threads[next.id] = { ...next, main: true };
      return withCanvas({ ...canvas, threads });
    }
    case "thread.setAnchor": {
      const thread = getThread(op.threadId);
      requireFinite({ x: op.x, y: op.y }, "thread.setAnchor");
      if (op.anchorItemId !== null && !canvas.items[op.anchorItemId] && !canvas.trash.some((t) => t.item.id === op.anchorItemId)) {
        throw new OpValidationError("unknown-item", `unknown item: ${op.anchorItemId}`);
      }
      const anchorItem = op.anchorItemId ? canvas.items[op.anchorItemId] ?? canvas.trash.find((t) => t.item.id === op.anchorItemId)?.item : void 0;
      const textAnchor = validateTextAnchor(op.textAnchor, anchorItem);
      const next = { ...thread, anchorItemId: op.anchorItemId, x: op.x, y: op.y };
      if (textAnchor) next.textAnchor = textAnchor;
      else delete next.textAnchor;
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }
    case "comment.update": {
      const thread = getThread(op.threadId);
      const existing = thread.comments.find((c) => c.id === op.commentId);
      if (!existing) {
        throw new OpValidationError("unknown-comment", `unknown comment: ${op.commentId}`);
      }
      if (existing.author.id !== actor.id) {
        throw new OpValidationError(
          "bad-op",
          `a comment belongs to its author: ${op.commentId} is ${existing.author.name}'s`
        );
      }
      const { mentions: _wasMentions, items: _wasItems, ...bare } = existing;
      const edited = {
        ...bare,
        body: op.body,
        ...op.mentions ? { mentions: op.mentions } : {},
        ...op.items ? { items: op.items } : {},
        editedAt: ts
      };
      if (op.context === null) delete edited.context;
      else if (op.context !== void 0) {
        validateContextManifest(op.context, state.project.id);
        edited.context = structuredClone(op.context);
      }
      const next = {
        ...thread,
        comments: thread.comments.map((c) => c.id === op.commentId ? edited : c)
      };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }
    case "comment.remove": {
      const thread = getThread(op.threadId);
      if (!thread.comments.some((c) => c.id === op.commentId)) {
        throw new OpValidationError("unknown-comment", `unknown comment: ${op.commentId}`);
      }
      if (thread.comments.length === 1) {
        throw new OpValidationError("last-comment", "cannot remove the last comment of a thread");
      }
      const next = { ...thread, comments: thread.comments.filter((c) => c.id !== op.commentId) };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }
    case "comment.restore": {
      const thread = getThread(op.threadId);
      if (thread.comments.some((c) => c.id === op.comment.id)) {
        throw new OpValidationError("duplicate-id", `comment id already exists: ${op.comment.id}`);
      }
      const next = { ...thread, comments: [...thread.comments, op.comment] };
      return withCanvas({ ...canvas, threads: { ...canvas.threads, [next.id]: next } });
    }
    case "thread.delete": {
      getThread(op.threadId);
      const threads = { ...canvas.threads };
      delete threads[op.threadId];
      return withCanvas({ ...canvas, threads });
    }
    case "thread.restore": {
      if (canvas.threads[op.thread.id]) {
        throw new OpValidationError("duplicate-id", `thread id already exists: ${op.thread.id}`);
      }
      const { main: wasMain, ...bare } = op.thread;
      const thread = wasMain && !mainThread(canvas) ? { ...bare, main: true } : bare;
      return withCanvas({
        ...canvas,
        threads: { ...canvas.threads, [op.thread.id]: thread }
      });
    }
    case "agent.enroll": {
      const standing = canvas.agents?.[op.agent.id];
      const rules = op.rules !== void 0 ? op.rules : standing?.rules;
      const row2 = {
        actor: op.agent,
        ...rules !== void 0 ? { rules } : {},
        writtenBy: actor
      };
      return withCanvas({
        ...canvas,
        agents: { ...canvas.agents ?? {}, [op.agent.id]: row2 }
      });
    }
    case "agent.invite": {
      const agents = { ...canvas.agents ?? {} };
      const standing = agents[op.agent.id];
      const row2 = standing ? { ...standing, invitedFrom: op.from } : { actor: op.agent, writtenBy: actor, invitedFrom: op.from };
      return withCanvas({ ...canvas, agents: { ...agents, [op.agent.id]: row2 } });
    }
    case "agent.withdraw": {
      const agents = { ...canvas.agents ?? {} };
      if (!agents[op.actorId]) {
        throw new OpValidationError("unknown-actor", `no standing agent: ${op.actorId}`);
      }
      delete agents[op.actorId];
      return withCanvas({ ...canvas, agents });
    }
    default:
      return unknownOperation(op);
  }
}
function applyMetaPatch(target, patch) {
  const properties = { ...target.properties, ...patch.properties };
  for (const key of patch.removeProperties ?? []) delete properties[key];
  return {
    title: patch.title ?? target.title,
    description: patch.description ?? target.description,
    properties
  };
}
function toItemVersion(v, actor, ts) {
  return { ...v, createdAt: ts, createdBy: actor };
}
function toComment(c, actor, ts) {
  const comment = { id: c.id, author: actor, body: c.body, createdAt: ts };
  if (c.mentions && c.mentions.length > 0) comment.mentions = [...c.mentions];
  if (c.record) comment.record = true;
  if (c.items && c.items.length > 0) comment.items = [...c.items];
  if (c.context) {
    validateContextManifest(c.context, c.context.canvasId);
    comment.context = structuredClone(c.context);
  }
  return comment;
}
function requireFinite(values, what) {
  for (const [field, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) {
      throw new OpValidationError(
        "bad-op",
        `${what}: ${field} must be a finite number, got ${typeof value === "number" ? String(value) : JSON.stringify(value)}`
      );
    }
  }
}
function requireUniqueIds(ids4) {
  if (ids4.length === 0) {
    throw new OpValidationError("bad-op", "batch op requires at least one item");
  }
  if (new Set(ids4).size !== ids4.length) {
    throw new OpValidationError("duplicate-id", "batch op lists an item twice");
  }
}
function pruneVersions(item, keep) {
  const cut = Math.max(0, item.versions.length - Math.max(1, Math.floor(keep)));
  return item.versions.filter((v, index) => index >= cut || v.id === item.currentVersionId);
}
function prunedVersions(item, keep) {
  const kept = new Set(pruneVersions(item, keep).map((v) => v.id));
  return item.versions.filter((v) => !kept.has(v.id));
}
function requireVersion(item, versionId) {
  if (!item.versions.some((v) => v.id === versionId)) {
    throw new OpValidationError("unknown-version", `unknown version: ${versionId}`);
  }
}
function requireBody(body) {
  if (body.trim().length === 0) {
    throw new OpValidationError("empty-body", "comment body cannot be empty");
  }
}

// packages/core/src/browseritem.ts
var BROWSER_MIME = "text/uri-list";
function normalizeSiteUrl(input) {
  const trimmed = input.trim();
  if (trimmed === "") throw new Error("empty URL");
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url2;
  try {
    url2 = new URL(candidate);
  } catch {
    throw new Error(`not a URL: ${input}`);
  }
  if (url2.protocol !== "http:" && url2.protocol !== "https:") {
    throw new Error(`only http(s) can be projected, got: ${url2.protocol}`);
  }
  return url2.href;
}
function parseUriList(text3) {
  for (const line of text3.split(/\r?\n/)) {
    const entry = line.trim();
    if (entry !== "" && !entry.startsWith("#")) return entry;
  }
  return null;
}
function siteLabel(url2) {
  return url2.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
function siteFilename(url2) {
  const stem = siteLabel(url2).replace(/[^a-zA-Z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${stem || "site"}.uri`;
}

// packages/core/src/address.ts
var CANVAS_PATH_PREFIX = "/p";
var CANVAS_ROUTE = `${CANVAS_PATH_PREFIX}/:canvasId`;
var ITEM_ROUTE = `${CANVAS_ROUTE}/i/:itemId`;
function canvasPath(canvasId) {
  return `${CANVAS_PATH_PREFIX}/${encodeURIComponent(canvasId)}`;
}
var ITEM_PATH_SEGMENT = "i";
function itemPath(canvasId, itemId) {
  return `${canvasPath(canvasId)}/${ITEM_PATH_SEGMENT}/${encodeURIComponent(itemId)}`;
}
function itemUrl(origin, canvasId, itemId) {
  return `${origin.replace(/\/+$/, "")}${itemPath(canvasId, itemId)}`;
}
var DECK_PATH_SEGMENT = "deck";
var DECK_ROUTE = `${CANVAS_ROUTE}/${DECK_PATH_SEGMENT}`;
function deckPath(canvasId) {
  return `${canvasPath(canvasId)}/${DECK_PATH_SEGMENT}`;
}
function deckUrl(origin, canvasId) {
  return `${origin.replace(/\/+$/, "")}${deckPath(canvasId)}`;
}
var MODULE_PAGE_PATH_SEGMENT = "x";
var MODULE_PAGE_ROUTE = `${CANVAS_ROUTE}/${MODULE_PAGE_PATH_SEGMENT}/:segment`;
function modulePagePath(canvasId, segment) {
  return `${canvasPath(canvasId)}/${MODULE_PAGE_PATH_SEGMENT}/${segment}`;
}
function modulePageUrl(origin, canvasId, segment) {
  return `${origin.replace(/\/+$/, "")}${modulePagePath(canvasId, segment)}`;
}
var WORKBENCH_PATH_SEGMENT = "w";
var WORKBENCH_ROUTE = `${CANVAS_ROUTE}/${WORKBENCH_PATH_SEGMENT}`;
var WORKBENCH_ITEM_ROUTE = `${WORKBENCH_ROUTE}/:wbItemId`;
function workbenchPath(canvasId) {
  return `${canvasPath(canvasId)}/${WORKBENCH_PATH_SEGMENT}`;
}
function workbenchItemPath(canvasId, itemId) {
  return `${workbenchPath(canvasId)}/${encodeURIComponent(itemId)}`;
}
function workbenchUrl(origin, canvasId, itemId) {
  const path = itemId ? workbenchItemPath(canvasId, itemId) : workbenchPath(canvasId);
  return `${origin.replace(/\/+$/, "")}${path}`;
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
function parseItemAddress(raw) {
  const { address } = splitPassFragment(raw.trim());
  if (!address) return null;
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
  if (parts.length !== 5 || parts[0] !== "" || `/${parts[1]}` !== CANVAS_PATH_PREFIX || parts[3] !== ITEM_PATH_SEGMENT) {
    return null;
  }
  const canvasId = decodeSegment(parts[2]);
  const itemId = decodeSegment(parts[4]);
  if (!canvasId || !itemId) return null;
  return { origin: url2.origin, canvasId, itemId };
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
var INSTALL_SPEC = "github:dglazkov/isocan#release";
var DEFAULT_HOME_URL = "https://isocan.io";
var SKILL_INSTALL_COMMAND = "npx skills add dglazkov/isocan";
function setupCommand(origin, canvasId, token) {
  const address = token ? canvasUrlWithPass(origin, canvasId, token) : canvasUrl(origin, canvasId);
  return `npx ${INSTALL_SPEC} setup ${address}`;
}
function localAgentInstructions(origin, canvasId, token) {
  const address = token ? canvasUrlWithPass(origin, canvasId, token) : canvasUrl(origin, canvasId);
  return [
    "use isocan. Run this in the current directory to join the canvas:",
    "",
    `  npx ${INSTALL_SPEC} setup ${address}`,
    "",
    "Then run `isocan --agent-help` and follow its instructions."
  ].join("\n");
}
function cloudAgentInstructions(origin, canvasId, token) {
  const address = token ? canvasUrlWithPass(origin, canvasId, token) : canvasUrl(origin, canvasId);
  return [
    "use isocan. This workspace is disposable, so set up with no local copy:",
    "",
    `  ISOCAN_DIRECT=1 npx ${INSTALL_SPEC} setup ${address}`,
    "",
    "Then run `isocan --agent-help` and follow its instructions."
  ].join("\n");
}
var THREAD_QUERY = "thread";
function threadPath(canvasId, threadId) {
  return `${canvasPath(canvasId)}?${new URLSearchParams({ [THREAD_QUERY]: threadId })}`;
}

// packages/core/src/canvasitem.ts
var CANVAS_KIND = "canvas";
var CANVAS_PROP = "canvas";
var SOURCE_PROP = "source";
var CANVAS_ITEM_FILENAME = "canvas.uri";
var CANVAS_ITEM_SIZE = { width: 800, height: 600 };
function isCanvasItem(item) {
  return item.properties.kind === CANVAS_KIND;
}
function canvasIdOf(item) {
  if (!isCanvasItem(item)) return null;
  return item.properties[CANVAS_PROP] ?? null;
}
function automaticCanvasTarget(declaredCanvasId, source3) {
  const unavailable = { kind: "unavailable", refused: "This card's declared canvas address is incomplete or inconsistent." };
  const validId = (id) => /^[A-Za-z0-9_-]+$/.test(id);
  if (declaredCanvasId !== null && !validId(declaredCanvasId)) return unavailable;
  let address = null;
  if (source3?.trim()) {
    try {
      address = parseCanvasAddress(source3);
    } catch {
      return unavailable;
    }
    if (!address) {
      let url2;
      try {
        const raw = source3.trim();
        url2 = new URL(raw.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`, "https://invalid.invalid");
      } catch {
      }
      if (url2?.pathname.split("/")[1] === CANVAS_PATH_PREFIX.slice(1)) {
        if (source3.trim().startsWith("/") || !["http:", "https:"].includes(url2.protocol)) return unavailable;
        try {
          address = parseCanvasAddress(`${url2.origin}${url2.pathname.split("/").slice(0, 3).join("/")}`);
        } catch {
          return unavailable;
        }
        if (!address) return unavailable;
      }
    }
    if (!address && declaredCanvasId !== null) return unavailable;
  }
  if (address) {
    if (!validId(address.canvasId) || declaredCanvasId !== null && declaredCanvasId !== address.canvasId) return unavailable;
    return { kind: "canvas", canvasId: address.canvasId, source: canvasUrl(address.origin, address.canvasId) };
  }
  return declaredCanvasId === null ? { kind: "none" } : { kind: "canvas", canvasId: declaredCanvasId, source: null };
}
function sourceOf(item) {
  return item.properties[SOURCE_PROP] ?? null;
}
function canvasItemOf(origin, canvasId) {
  const address = canvasUrl(origin, canvasId);
  return {
    properties: { kind: CANVAS_KIND, [CANVAS_PROP]: canvasId, [SOURCE_PROP]: address },
    blob: `${address}
`,
    mimeType: BROWSER_MIME,
    filename: CANVAS_ITEM_FILENAME
  };
}
function canvasIdFromBlob(text3) {
  const address = parseUriList(text3);
  if (!address) return null;
  return parseCanvasAddress(address)?.canvasId ?? null;
}

// packages/core/src/modules.ts
function declaredPoint(id) {
  for (const m of modules()) {
    const hit = (m.points ?? []).find((p) => p.id === id);
    if (hit) return hit;
  }
  return null;
}
function contributions(pointId) {
  const point = declaredPoint(pointId);
  if (!point) return [];
  const out = [];
  for (const m of modules()) {
    for (const value of m.contributes?.[pointId] ?? []) {
      if (point.validate(value).length === 0) out.push({ module: m.name, value });
    }
  }
  return out;
}
function refusedContributions() {
  const out = [];
  for (const m of modules()) {
    for (const [pointId, values] of Object.entries(m.contributes ?? {})) {
      const point = declaredPoint(pointId);
      if (!point) {
        out.push({ module: m.name, point: pointId, problems: [`no loaded module declares ${pointId} \u2014 orphaned, not an error`] });
        continue;
      }
      values.forEach((value, i) => {
        const problems = point.validate(value);
        if (problems.length > 0) out.push({ module: m.name, point: pointId, problems: problems.map((p) => `#${i + 1}: ${p}`) });
      });
    }
  }
  return out;
}
function moduleRounds(canvas) {
  return modules().flatMap((m) => [...m.rounds?.(canvas) ?? []]);
}
function roundsOn(canvas, item) {
  return moduleRounds(canvas).filter((round3) => {
    const area = canvas.items[round3.areaId];
    return area !== void 0 && inCanvasScope(canvas, area, item);
  });
}
function roundRunning(round3, nowMs) {
  return Date.parse(round3.until) > nowMs;
}
var BASES = /* @__PURE__ */ new Map();
function registerModuleBase(name, base2) {
  BASES.set(name, base2.endsWith("/") ? base2 : `${base2}/`);
}
function moduleBase(name) {
  return BASES.get(name) ?? null;
}
function moduleCommands() {
  return modules().flatMap((m) => (m.commands ?? []).map((c) => ({ ...c, source: "module" }))).sort((a, b) => a.name.localeCompare(b.name));
}
function withModuleCommands(commands) {
  const byName = /* @__PURE__ */ new Map();
  for (const command of moduleCommands()) byName.set(command.name, command);
  for (const command of commands) byName.set(command.name, command);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
var REGISTRY = /* @__PURE__ */ new Map();
function registerModule(record2) {
  REGISTRY.set(record2.name, record2);
}
function unregisterModule(name) {
  REGISTRY.delete(name);
}
function modules() {
  return [...REGISTRY.values()];
}
function moduleContextPieces(canvas) {
  return modules().flatMap((m) => m.contextPieces?.(canvas) ?? []);
}
function moduleEdges(canvas) {
  return modules().flatMap((m) => m.edges?.(canvas) ?? []);
}
function moduleKinds() {
  return modules().flatMap((m) => m.kinds ?? []);
}
function moduleKindOf(mime) {
  return moduleKinds().find((k) => k.mimes.includes(mime)) ?? null;
}
var TEMPLATE_ID = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9.-]*$/;
function askTemplate(raw) {
  if (raw.template === void 0 && raw.args === void 0) return {};
  if (typeof raw.template !== "string" || !TEMPLATE_ID.test(raw.template)) {
    return { error: "a template is named by an id like `module.name`" };
  }
  const args = {};
  if (raw.args !== void 0) {
    if (!raw.args || typeof raw.args !== "object" || Array.isArray(raw.args)) return { error: "template args are an object of strings" };
    const entries = Object.entries(raw.args);
    if (entries.length > 16) return { error: "at most 16 template args" };
    for (const [k, v] of entries) {
      if (!/^[a-z][a-z0-9-]{0,31}$/.test(k)) return { error: `template arg "${k}" is not a plain key` };
      if (typeof v !== "string" || v.length > 512) return { error: `template arg "${k}" is not a string of at most 512 characters` };
      args[k] = v;
    }
  }
  return { template: raw.template, ...Object.keys(args).length ? { args } : {} };
}
function isDataOnly(manifest2) {
  return !manifest2.web && !manifest2.cli;
}
var MODULE_API_VERSION = "0.2.2";
var PROPOSED = [
  "overlays",
  "drops",
  "host",
  "assets",
  "points",
  "dialogs",
  "templates",
  "rounds",
  "workspaces",
  "composer"
];
function unknownProposals(wanted) {
  return (wanted ?? []).filter((one2) => !PROPOSED.includes(one2));
}
function moduleSlug(name) {
  return name.split("/").pop() ?? name;
}
function moduleWebPath(manifest2) {
  return manifest2.web ? `/modules/${moduleSlug(manifest2.name)}/${manifest2.web}` : null;
}
function manifestRecord(manifest2) {
  return {
    name: manifest2.name,
    ...manifest2.kinds ? { kinds: manifest2.kinds } : {},
    ...manifest2.propertyKeys ? { propertyKeys: manifest2.propertyKeys } : {},
    ...manifest2.contributes ? { contributes: manifest2.contributes } : {}
  };
}
function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}
function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
function enginesSatisfied(range, version = MODULE_API_VERSION) {
  const have = parseVersion(version);
  if (!have) return { ok: false, why: `this build's module API version "${version}" cannot be read` };
  const r2 = (range ?? "*").trim();
  if (r2 === "*" || r2 === "") return { ok: true };
  const m = /^(>=|\^)?\s*(.+)$/.exec(r2);
  const want = m ? parseVersion(m[2]) : null;
  if (!m || !want) return { ok: false, why: `cannot read the engines range "${r2}" \u2014 use >=a.b.c, ^a.b.c or *` };
  const op = m[1] ?? "^";
  if (compare(have, want) < 0) return { ok: false, why: `needs module API ${r2}, and this build is ${version}` };
  if (op === "^") {
    const sameLine = want[0] === 0 ? have[0] === 0 && have[1] === want[1] : have[0] === want[0];
    if (!sameLine) return { ok: false, why: `needs module API ${r2}, and this build is ${version}` };
  }
  return { ok: true };
}

// packages/core/src/kinds.ts
var ITEM_KINDS = [
  "drawing",
  "text",
  "screen",
  "image",
  "video",
  "document",
  "site",
  "canvas",
  "other"
];
function isBuiltinKind(kind) {
  return ITEM_KINDS.includes(kind);
}
function kindFamily(kind) {
  if (kind === "other") return "other";
  const at2 = ITEM_KINDS.indexOf(kind);
  if (at2 === -1) return moduleKinds().some((k) => k.id === kind) ? "made" : "other";
  return at2 < ITEM_KINDS.indexOf("image") ? "made" : "brought";
}
function itemKinds() {
  const added = moduleKinds().map((k) => k.id);
  return [...ITEM_KINDS.filter((k) => k !== "other"), ...added, "other"];
}
function itemKind(item) {
  if (isDrawingItem(item)) return "drawing";
  if (isTextItem(item)) return "text";
  if (isCanvasItem(item)) return "canvas";
  const current2 = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  const mime = current2?.mimeType ?? "";
  const added = moduleKindOf(mime);
  if (added) return added.id;
  if (mime === BROWSER_MIME) return "site";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "text/html") return "screen";
  if (mime.startsWith("text/") || mime === "application/pdf") return "document";
  return "other";
}
function isFramedItem(item) {
  const current2 = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  if (current2?.visual && current2.visual.mimeType === "text/html") return true;
  const kind = itemKind(item);
  return kind === "screen" || kind === "site";
}
function editableText(mimeType) {
  return mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "image/svg+xml";
}
var KIND_MARK_MIN = 9;

// packages/core/src/lineage.ts
var PARENT_PROP = "parent";
function parentOf(item) {
  const parent = item.properties[PARENT_PROP];
  return parent && parent.length > 0 ? parent : null;
}
function lineageProperties(parentId) {
  return { [PARENT_PROP]: parentId };
}
function childrenOf(canvas, itemId) {
  return Object.values(canvas.items).filter((item) => parentOf(item) === itemId).sort((a, b) => a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
}

// packages/core/src/format.ts
var FORMAT_GAP_X = 80;
var FORMAT_GAP_Y = 64;
var FORMAT_CHILD_GAP_Y = 40;
var FORMAT_BAND_GAP_Y = 160;
var FORMAT_MODES = ["grid", "smart"];
function isFormatMode(value) {
  return typeof value === "string" && FORMAT_MODES.includes(value);
}
function formatScope(canvas, itemIds) {
  const picked = itemIds.map((id) => canvas.items[id]).filter((one2) => Boolean(one2));
  if (picked.length < 2) return null;
  return {
    scope: { ...canvas, items: Object.fromEntries(picked.map((one2) => [one2.id, one2])) },
    origin: {
      x: Math.min(...picked.map((one2) => one2.x)),
      y: Math.min(...picked.map((one2) => one2.y))
    }
  };
}
function role(canvas, item) {
  if (annotationTarget(item) && canvas.items[annotationTarget(item)]) return "attached";
  const kind = itemKind(item);
  return kind === "image" || kind === "video" ? "reference" : "screen";
}
function gridMoves(canvas, options) {
  const items = Object.values(canvas.items).filter(
    (item) => role(canvas, item) !== "attached"
  );
  if (items.length === 0) return [];
  const origin = options.origin ?? {
    x: Math.min(...items.map((item) => item.x)),
    y: Math.min(...items.map((item) => item.y))
  };
  const band = Math.max(...items.map((item) => item.height));
  const ordered = [...items].sort(
    (a, b) => Math.floor(a.y / band) - Math.floor(b.y / band) || a.x - b.x || a.id.localeCompare(b.id)
  );
  const perRow = Math.max(1, options.perRow ?? Math.ceil(Math.sqrt(ordered.length)));
  const column = Math.max(...items.map((item) => item.width));
  const moves = [];
  let rowTop = origin.y;
  for (let i = 0; i < ordered.length; i += perRow) {
    const row2 = ordered.slice(i, i + perRow);
    row2.forEach((item, col) => {
      const x = Math.round(origin.x + col * (column + (options.gap ?? FORMAT_GAP_X)));
      const y = Math.round(rowTop);
      if (item.x !== x || item.y !== y) moves.push({ itemId: item.id, x, y });
    });
    rowTop += Math.max(...row2.map((item) => item.height)) + (options.gap ?? FORMAT_GAP_Y);
  }
  return moves;
}
function formatMoves(canvas, options = {}) {
  const items = Object.values(canvas.items);
  if (items.length === 0) return [];
  if ((options.mode ?? "grid") === "grid") return gridMoves(canvas, options);
  const screens = items.filter((item) => role(canvas, item) === "screen");
  const reference = items.filter((item) => role(canvas, item) === "reference");
  const screenIds = new Set(screens.map((item) => item.id));
  const roots = screens.filter((item) => {
    const parent = parentOf(item);
    return parent === null || !screenIds.has(parent);
  }).sort((a, b) => a.x - b.x || a.y - b.y);
  const origin = options.origin ?? {
    x: Math.min(...items.map((item) => item.x)),
    y: Math.min(...items.map((item) => item.y))
  };
  const placed = /* @__PURE__ */ new Map();
  function placeColumn(item, x, y, seen2) {
    if (seen2.has(item.id)) return { width: 0, bottom: y };
    seen2.add(item.id);
    placed.set(item.id, { x, y });
    let width = item.width;
    let bottom = y + item.height;
    for (const child of childrenOf(canvas, item.id)) {
      if (!screenIds.has(child.id)) continue;
      const below = placeColumn(child, x, bottom + FORMAT_CHILD_GAP_Y, seen2);
      width = Math.max(width, below.width);
      bottom = below.bottom;
    }
    return { width, bottom };
  }
  const seen = /* @__PURE__ */ new Set();
  let cursorX = origin.x;
  let deepest = origin.y;
  for (const root of roots) {
    const column = placeColumn(root, cursorX, origin.y, seen);
    cursorX += column.width + (options.gap ?? FORMAT_GAP_X);
    deepest = Math.max(deepest, column.bottom);
  }
  if (reference.length > 0) {
    const perRow = Math.max(1, options.perRow ?? Math.ceil(Math.sqrt(reference.length)));
    const ordered = [...reference].sort((a, b) => a.x - b.x || a.y - b.y);
    let rowTop = roots.length > 0 ? deepest + FORMAT_BAND_GAP_Y : origin.y;
    for (let i = 0; i < ordered.length; i += perRow) {
      const row2 = ordered.slice(i, i + perRow);
      let x = origin.x;
      for (const item of row2) {
        placed.set(item.id, { x, y: rowTop });
        x += item.width + (options.gap ?? FORMAT_GAP_X);
      }
      rowTop += Math.max(...row2.map((item) => item.height)) + (options.gap ?? FORMAT_GAP_Y);
    }
  }
  const moves = [];
  for (const [itemId, at2] of placed) {
    const item = canvas.items[itemId];
    const x = Math.round(at2.x);
    const y = Math.round(at2.y);
    if (item.x !== x || item.y !== y) moves.push({ itemId, x, y });
  }
  return moves;
}

// packages/core/src/opwords.ts
function activityOpType(op) {
  if (op.type === "group.change") {
    if (op.action.kind === "insert") return "item.add";
    if (op.action.kind === "apply" && op.action.change.intent === "insert" && op.action.change.writes.some((write) => write.kind === "create")) return "item.add";
  }
  return op.type;
}
var OP_WORDS = {
  "design.repair": "repaired a design",
  "design.compare": "published design alternatives",
  "design.respond": "responded to design alternatives",
  "design.decide": "adopted a design direction",
  "design.restore": "restored a design decision",
  "design.request": "updated a design task",
  "design.receipt": "published design evidence",
  "group.change": "changed a canvas group",
  "project.create": "made the canvas",
  "project.update": "renamed the canvas",
  "item.add": "added something",
  "item.delete": "deleted something",
  "items.delete": "deleted several things",
  "item.restore": "restored something",
  "items.restore": "restored several things",
  "item.addVersion": "made a new version",
  "item.edit": "edited",
  "item.setCurrentVersion": "switched version",
  "item.removeVersion": "removed a version",
  "item.restoreVersion": "restored a version",
  "item.pruneVersions": "pruned old versions",
  "item.move": "moved something",
  "items.move": "moved several things",
  "item.resize": "resized something",
  "item.update": "edited something",
  "item.react": "left a mark",
  "thread.create": "started a conversation",
  "thread.reply": "replied",
  "questionnaire.ask": "asked design questions",
  "questionnaire.answer": "answered design questions",
  "thread.delete": "removed a conversation",
  "thread.restore": "restored a conversation",
  "thread.setAnchor": "moved a conversation",
  "thread.setMain": "moved the Chat",
  "comment.update": "edited a comment",
  "comment.remove": "removed a comment",
  "comment.restore": "restored a comment",
  "trash.empty": "emptied the trash",
  "agent.enroll": "enrolled an agent",
  "agent.invite": "brought an agent from their bench",
  "agent.withdraw": "dismissed an agent"
};
function opWords(type) {
  if (!type) return void 0;
  return OP_WORDS[type];
}

// packages/core/src/canvas-groups.ts
var GROUP_KIND = "group";
var GROUP_LIMIT = 1e4;
var GROUP_MIN_SIZE = { width: 160, height: 160 };
var GROUP_DEFAULT_SIZE = { width: 1600, height: 1e3 };
var GROUP_LABEL_HEIGHT = 24;
var fields2 = ["x", "y", "width", "height", "containerId", "groupLayout"];
var own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
var sorted = (ids4) => [...new Set(ids4)].sort();
var round = (n) => Math.round(n * 1e6) / 1e6;
function fail(message) {
  throw new OpValidationError("bad-op", `canvas group: ${message}`);
}
var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var equal = (a, b) => JSON.stringify(canonical5(a)) === JSON.stringify(canonical5(b));
function canonical5(value) {
  if (Array.isArray(value)) return value.map(canonical5);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical5(value[key])]));
  return value;
}
function idList(ids4, allowEmpty = false) {
  if (!Array.isArray(ids4) || ids4.length > GROUP_LIMIT || !allowEmpty && ids4.length === 0 || ids4.some((id) => typeof id !== "string" || !id) || new Set(ids4).size !== ids4.length) fail("expected unique item IDs within the operation limit");
}
function exactKeys(value, keys2, label) {
  if (!record(value) || Object.keys(value).some((key) => !keys2.includes(key))) fail(`invalid ${label} fields`);
}
function boxOf(item) {
  return { x: item.x, y: item.y, width: item.width, height: item.height };
}
function persistedBox(box2) {
  return { x: round(box2.x), y: round(box2.y), width: round(box2.width), height: round(box2.height) };
}
function validBox(box2) {
  if (!record(box2) || ["x", "y", "width", "height"].some((key) => typeof box2[key] !== "number" || !Number.isFinite(box2[key])) || Number(box2.width) <= 0 || Number(box2.height) <= 0) fail("a box needs finite coordinates and positive dimensions");
}
function requestBox(box2) {
  exactKeys(box2, ["x", "y", "width", "height"], "box");
  validBox(box2);
}
function validProperties(value) {
  if (!record(value) || Object.values(value).some((property) => typeof property !== "string")) fail("properties must be a string-valued object");
}
function validVisual(value) {
  exactKeys(value, ["blobHash", "mimeType", "filename", "size"], "visual face");
  if (typeof value.blobHash !== "string" || !value.blobHash || typeof value.mimeType !== "string" || !value.mimeType) fail("visual face needs a content hash and MIME type");
  if (own(value, "filename") && typeof value.filename !== "string") fail("invalid visual filename");
  if (own(value, "size") && (typeof value.size !== "number" || !Number.isFinite(value.size) || value.size < 0)) fail("invalid visual size");
}
function validLayout(layout) {
  exactKeys(layout, ["titleHeight", "briefHeight", "inset", "rowGutter", "columnGutter", "rows", "columns", "rowCount", "columnCount"], "layout");
  for (const [key, value] of Object.entries(layout)) {
    if (key === "rows" || key === "columns") {
      if (!Array.isArray(value) || value.length > 100 || value.some((label) => typeof label !== "string" || label.length > 1e3)) fail("invalid grid labels");
    } else if (key === "rowCount" || key === "columnCount") {
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 100) fail("invalid grid count");
    } else if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e4) fail("invalid layout reservation");
  }
  if (Number(layout.titleHeight ?? 56) < 24 || Number(layout.inset ?? 24) < 0) fail("invalid title or inset reservation");
  const grid = layout;
  if ((grid.rows?.length ?? 0) > (grid.rowCount ?? Math.max(1, grid.rows?.length ?? 0)) || (grid.columns?.length ?? 0) > (grid.columnCount ?? Math.max(1, grid.columns?.length ?? 0))) fail("more grid labels than cells");
}
function hasGridCounts(layout) {
  return !!layout && (own(layout, "rowCount") || own(layout, "columnCount"));
}
function validCell(cell) {
  exactKeys(cell, ["row", "column"], "cell");
  if (!Number.isInteger(cell.row) || !Number.isInteger(cell.column) || Number(cell.row) < 1 || Number(cell.column) < 1) fail("cell indices start at one");
}
function itemIn(canvas, id) {
  const item = canvas.items[id];
  if (!item) throw new OpValidationError("unknown-item", `unknown item: ${id}`);
  return item;
}
function groupIn(canvas, id) {
  const item = itemIn(canvas, id);
  if (!isGroupItem(item)) fail(`${id} is not a canvas group`);
  return item;
}
function isGroupItem(item) {
  return item.properties.kind === GROUP_KIND;
}
function hasCanvasGroups(state) {
  return state.project.groupMode === "groups";
}
function groupIndex(canvas) {
  const index = /* @__PURE__ */ new Map();
  for (const item of Object.values(canvas.items)) {
    const key = item.containerId ?? null;
    const children = index.get(key) ?? [];
    children.push(item);
    index.set(key, children);
  }
  for (const children of index.values()) children.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  return index;
}
function relations(canvas) {
  const children = groupIndex(canvas);
  const annotations = /* @__PURE__ */ new Map();
  for (const item of Object.values(canvas.items)) {
    const target = annotationTarget(item);
    if (target) {
      const marks = annotations.get(target) ?? [];
      marks.push(item);
      annotations.set(target, marks);
    }
  }
  return { children, annotations, trash: new Map(canvas.trash.map((entry) => [entry.item.id, entry])) };
}
function groupChildren(canvas, groupId) {
  return groupIndex(canvas).get(groupId) ?? [];
}
function groupAncestors(canvas, itemId) {
  return ancestors(canvas, itemIn(canvas, itemId)).map((id) => itemIn(canvas, id));
}
function groupScopedRoot(canvas, itemId, activeGroupId) {
  if (!canvas.items[itemId] || itemId === activeGroupId) return null;
  const chain = [itemIn(canvas, itemId), ...groupAncestors(canvas, itemId)];
  return chain.find((item) => (item.containerId ?? null) === activeGroupId)?.id ?? null;
}
function groupScopeRoots(canvas, activeGroupId) {
  return groupChildren(canvas, activeGroupId);
}
function groupWrapAction(canvas, creation, itemIds) {
  idList(itemIds);
  return { kind: "create", group: creation, itemIds: groupSelectionRoots(canvas, itemIds) };
}
function groupRemoveAction(canvas, itemIds, toRoot = false) {
  idList(itemIds);
  return { kind: "remove", itemIds: groupSelectionRoots(canvas, itemIds), toRoot };
}
function groupDescendants(canvas, groupId) {
  const index = groupIndex(canvas);
  const found = [];
  const seen = /* @__PURE__ */ new Set([groupId]);
  const visit = (id) => {
    for (const child of index.get(id) ?? []) {
      if (seen.has(child.id)) fail("membership cycle");
      seen.add(child.id);
      found.push(child);
      visit(child.id);
    }
  };
  visit(groupId);
  return found;
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
function groupSelectionRoots(canvas, ids4) {
  const wanted = new Set(ids4);
  return sorted(ids4).filter((id) => {
    const item = itemIn(canvas, id);
    if (ancestors(canvas, item).some((parent) => wanted.has(parent))) return false;
    const target = annotationTarget(item);
    return !(target && canvas.items[target] && (wanted.has(target) || ancestors(canvas, itemIn(canvas, target)).some((parent) => wanted.has(parent))));
  });
}
function groupTransformClosure(canvas, ids4) {
  const found = /* @__PURE__ */ new Set();
  const index = relations(canvas);
  const visit = (id) => {
    if (found.has(id)) return;
    found.add(id);
    for (const child of index.children.get(id) ?? []) visit(child.id);
  };
  for (const id of groupSelectionRoots(canvas, ids4)) visit(id);
  for (const id of [...found]) for (const mark of index.annotations.get(id) ?? []) found.add(mark.id);
  if (found.size > GROUP_LIMIT) fail("too many affected items");
  return sorted(found);
}
function validateGroupForest(state) {
  const { canvas } = state;
  if (state.project.groupMigration !== void 0) {
    const boundary = state.project.groupMigration;
    exactKeys(boundary, ["version", "opId", "seq"], "migration boundary");
    if (state.project.groupMode !== "groups" || boundary.version !== 1 || typeof boundary.opId !== "string" || !boundary.opId || !Number.isSafeInteger(boundary.seq) || boundary.seq < 1) fail("invalid migration boundary");
  }
  if (!hasCanvasGroups(state)) {
    if (Object.values(canvas.items).some((item) => item.containerId !== void 0 || item.groupLayout !== void 0 || isGroupItem(item))) fail("canvas groups require group mode");
    if (canvas.trash.some((entry) => entry.legacyGroupRestore !== void 0 || entry.item.containerId !== void 0 || entry.item.groupLayout !== void 0 || isGroupItem(entry.item))) fail("group trash requires group mode");
    return;
  }
  for (const entry of canvas.trash) {
    const item = entry.item;
    validBox(item);
    if (item.properties.kind === "area") fail("legacy areas cannot be retained in group mode");
    if (entry.legacyGroupRestore !== void 0 && !["root", "frame-only"].includes(entry.legacyGroupRestore)) fail("invalid legacy trash restore policy");
    if (entry.legacyGroupRestore === "frame-only" && !isGroupItem(item)) fail("frame-only restore requires a group");
    if (item.groupLayout !== void 0) {
      if (!isGroupItem(item)) fail("layout belongs to groups only");
      validLayout(item.groupLayout);
    }
    if (isGroupItem(item)) {
      validBox(groupContentBox(item));
      if (item.width < GROUP_MIN_SIZE.width || item.height < GROUP_MIN_SIZE.height) fail("group frame is below its minimum size");
    }
  }
  for (const item of Object.values(canvas.items)) {
    validBox(item);
    if (item.properties.kind === "area") fail("legacy areas cannot be written in group mode");
    if (item.containerId !== void 0) {
      if (typeof item.containerId !== "string" || !item.containerId) fail("invalid container ID");
      groupIn(canvas, item.containerId);
    }
    ancestors(canvas, item);
    if (item.groupLayout !== void 0) {
      if (!isGroupItem(item)) fail("layout belongs to groups only");
      validLayout(item.groupLayout);
    }
    if (isGroupItem(item)) {
      validBox(groupContentBox(item));
      if (item.width < GROUP_MIN_SIZE.width || item.height < GROUP_MIN_SIZE.height) fail("group frame is below its minimum size");
    }
    const targetId = annotationTarget(item);
    const target = targetId ? canvas.items[targetId] : void 0;
    if (target) {
      if (isDrawingItem(target)) fail("ink-to-ink attachment is unsupported");
      if ((target.containerId ?? null) !== (item.containerId ?? null)) fail("an annotation and its target must share a group");
    }
  }
}
function groupContentBox(item) {
  const layout = item.groupLayout ?? {};
  const inset = layout.inset ?? 24;
  const left = inset + (layout.rows?.length ? layout.rowGutter ?? 120 : 0);
  const top = (layout.titleHeight ?? 56) + (layout.briefHeight ?? 0) + inset + (layout.columns?.length ? layout.columnGutter ?? 32 : 0);
  return { x: item.x + left, y: item.y + top, width: item.width - left - inset, height: item.height - top - inset };
}
function labelHeight(item) {
  return isGroupItem(item) || annotationTarget(item) || ["text", "drawing"].includes(item.properties.kind ?? "") ? 0 : GROUP_LABEL_HEIGHT;
}
function groupFootprint(item, canvas) {
  const ownBox = { ...boxOf(item), height: item.height + labelHeight(item) };
  const marks = canvas ? annotationsOf(canvas, item.id).map(boxOf) : [];
  return enclosing([ownBox, ...marks]);
}
function groupFrameMinimum(item) {
  const band = reservations(item);
  const layout = item.groupLayout ?? {};
  const rows = layout.rowCount ?? Math.max(1, layout.rows?.length ?? 0);
  const columns = layout.columnCount ?? Math.max(1, layout.columns?.length ?? 0);
  return { width: Math.max(GROUP_MIN_SIZE.width, band.left + band.right + (columns - 1) * PLACEMENT_GAP + columns), height: Math.max(GROUP_MIN_SIZE.height, band.top + band.bottom + (rows - 1) * PLACEMENT_GAP + rows) };
}
function groupGridNeedsRoom(item) {
  const minimum = groupFrameMinimum(item);
  return item.width < minimum.width || item.height < minimum.height;
}
function groupCellBox(group, row2, column) {
  validCell({ row: row2, column });
  const layout = group.groupLayout ?? {};
  const rows = layout.rowCount ?? Math.max(1, layout.rows?.length ?? 0);
  const columns = layout.columnCount ?? Math.max(1, layout.columns?.length ?? 0);
  if (row2 > rows || column > columns) fail(`cell ${row2},${column} is outside ${rows}x${columns}`);
  const inner = groupContentBox(group);
  const gapX = columns > 1 ? Math.min(PLACEMENT_GAP, Math.max(0, (inner.width - columns) / (columns - 1))) : 0;
  const gapY = rows > 1 ? Math.min(PLACEMENT_GAP, Math.max(0, (inner.height - rows) / (rows - 1))) : 0;
  const width = (inner.width - gapX * (columns - 1)) / columns;
  const height = (inner.height - gapY * (rows - 1)) / rows;
  const box2 = { x: inner.x + (column - 1) * (width + gapX), y: inner.y + (row2 - 1) * (height + gapY), width, height };
  validBox(box2);
  return box2;
}
function groupPlacement(canvas, groupId, footprint, options = {}) {
  const group = groupIn(canvas, groupId);
  const inner = options.cell ? groupCellBox(group, options.cell.row, options.cell.column) : groupContentBox(group);
  const ignored = new Set(options.ignoreIds ?? []);
  const occupied = groupSelectionRoots(canvas, groupChildren(canvas, groupId).filter((item) => !ignored.has(item.id)).map((item) => item.id)).map((id) => groupFootprint(itemIn(canvas, id), canvas));
  const at2 = options.at ?? { x: inner.x, y: inner.y };
  const size = { width: footprint.width, height: footprint.height };
  const requested = { ...at2, ...size };
  validBox(requested);
  const inside = (box2) => box2.x >= inner.x && box2.y >= inner.y && box2.x + box2.width <= inner.x + inner.width && box2.y + box2.height <= inner.y + inner.height;
  if (options.policy === "preserve" || options.policy === "exact") {
    if (options.cell && !inside(requested)) fail("exact placement does not fit the requested grid cell");
    return at2;
  }
  const want = { ...requested, x: Math.max(inner.x, at2.x), y: Math.max(inner.y, at2.y) };
  const spot = nearestFreeSpot(want, occupied, inner);
  const found = { ...spot, ...size };
  if (inside(found) && !occupied.some((other) => overlaps(found, other, PLACEMENT_CLEARANCE))) return spot;
  if (options.cell) fail("no clear space in the requested grid cell; enlarge the frame or choose another cell");
  return { x: inner.x, y: Math.max(inner.y, ...occupied.map((other) => other.y + other.height + PLACEMENT_GAP)) };
}
function groupDropTarget(canvas, point, movingIds) {
  const excluded = new Set(groupTransformClosure(canvas, movingIds));
  return Object.values(canvas.items).map((item, order) => ({ item, order })).filter(({ item }) => {
    if (!isGroupItem(item) || excluded.has(item.id)) return false;
    const box2 = boxOf(item);
    return point.x >= box2.x && point.y >= box2.y && point.x <= box2.x + box2.width && point.y <= box2.y + box2.height;
  }).sort((a, b) => groupAncestors(canvas, b.item.id).length - groupAncestors(canvas, a.item.id).length || b.order - a.order)[0]?.item ?? null;
}
function groupDropPolicy(group, point) {
  const box2 = groupContentBox(group);
  return point.x >= box2.x && point.y >= box2.y && point.x <= box2.x + box2.width && point.y <= box2.y + box2.height ? "preserve" : "auto";
}
function groupArrangeAction(state, itemIds, options) {
  const roots = groupSelectionRoots(state.canvas, itemIds);
  if (!roots.length) fail("select items to arrange");
  const units = roots.map((id) => ({ item: itemIn(state.canvas, id), box: groupFootprint(itemIn(state.canvas, id), state.canvas) }));
  const bounds = enclosing(units.map((unit) => unit.box));
  const moves = units.map(({ item }) => ({ itemId: item.id, x: item.x, y: item.y }));
  if (options.kind === "align") {
    units.forEach(({ item, box: box2 }, i) => {
      const dx = options.edge === "left" ? bounds.x - box2.x : options.edge === "right" ? bounds.x + bounds.width - box2.x - box2.width : options.edge === "center" || options.edge === "hcenter" ? bounds.x + bounds.width / 2 - box2.x - box2.width / 2 : 0;
      const dy = options.edge === "top" ? bounds.y - box2.y : options.edge === "bottom" ? bounds.y + bounds.height - box2.y - box2.height : options.edge === "middle" || options.edge === "vcenter" ? bounds.y + bounds.height / 2 - box2.y - box2.height / 2 : 0;
      moves[i] = { itemId: item.id, x: item.x + dx, y: item.y + dy };
    });
  } else if (options.kind === "distribute") {
    const horizontal = options.axis === "h";
    const ordered = [...units].sort((a, b) => (horizontal ? a.box.x - b.box.x : a.box.y - b.box.y) || a.item.id.localeCompare(b.item.id));
    const used = ordered.reduce((sum, unit) => sum + (horizontal ? unit.box.width : unit.box.height), 0);
    const gap = ordered.length > 1 ? ((horizontal ? bounds.width : bounds.height) - used) / (ordered.length - 1) : 0;
    let cursor = horizontal ? bounds.x : bounds.y;
    for (const { item, box: box2 } of ordered) {
      const move = moves.find((row2) => row2.itemId === item.id);
      if (horizontal) move.x += cursor - box2.x;
      else move.y += cursor - box2.y;
      cursor += (horizontal ? box2.width : box2.height) + gap;
    }
  } else {
    const perRow = options.perRow ?? Math.max(1, Math.ceil(Math.sqrt(units.length)));
    const gap = options.gap ?? PLACEMENT_GAP;
    if (!Number.isInteger(perRow) || perRow < 1 || !Number.isFinite(gap) || gap < PLACEMENT_CLEARANCE) fail("invalid tidy spacing");
    const formatted = formatMoves({ ...state.canvas, items: Object.fromEntries(units.map(({ item, box: box2 }) => [item.id, { ...item, ...box2, properties: { ...item.properties, annotates: "" } }])) }, { perRow, gap, mode: options.mode ?? "grid" });
    const positions = new Map(formatted.map((move) => [move.itemId, move]));
    const origin = options.containerId ? groupContentBox(groupIn(state.canvas, options.containerId)) : bounds;
    const placed = units.map(({ box: box2, item }) => ({ ...box2, ...positions.get(item.id) ?? {} }));
    const packed = enclosing(placed);
    units.forEach(({ item, box: box2 }, i) => {
      const at2 = positions.get(item.id) ?? box2;
      moves[i] = { itemId: item.id, x: item.x + at2.x - box2.x + origin.x - packed.x, y: item.y + at2.y - box2.y + origin.y - packed.y };
    });
  }
  return { kind: "transform", moves, expected: captureGroupExpectations(state, roots) };
}
function groupFitAction(state, targets) {
  const roots = groupSelectionRoots(state.canvas, targets.map((target) => target.itemId));
  const excluded = new Set(groupTransformClosure(state.canvas, roots));
  const settled = /* @__PURE__ */ new Map();
  const fitted = [];
  const occupiedAt = (parent) => {
    let occupied = settled.get(parent);
    if (!occupied) {
      occupied = groupSelectionRoots(state.canvas, groupChildren(state.canvas, parent).filter((sibling) => !excluded.has(sibling.id)).map((sibling) => sibling.id)).map((siblingId) => groupFootprint(itemIn(state.canvas, siblingId), state.canvas));
      settled.set(parent, occupied);
    }
    return occupied;
  };
  const ordered = [...roots].sort((a, b) => Number(isGroupItem(itemIn(state.canvas, b))) - Number(isGroupItem(itemIn(state.canvas, a))) || itemIn(state.canvas, a).y - itemIn(state.canvas, b).y || itemIn(state.canvas, a).x - itemIn(state.canvas, b).x);
  for (const id of ordered) {
    const item = itemIn(state.canvas, id);
    const target = targets.find((row2) => row2.itemId === id);
    const frameFit = isGroupItem(item) && target.width === void 0 && target.height === void 0;
    const desired = frameFit ? groupFitBox(state.canvas, id) : { ...boxOf(item), width: target.width ?? item.width, height: target.height ?? item.height };
    validBox(desired);
    const occupied = occupiedAt(item.containerId ?? null);
    const footprint = enclosing([{ ...desired, height: desired.height + labelHeight(item) }, ...annotationsOf(state.canvas, id).map((mark) => mapBox(mark, item, desired))]);
    const at2 = isGroupItem(item) ? footprint : nearestFreeSpot(footprint, occupied);
    const box2 = { ...desired, x: desired.x + at2.x - footprint.x, y: desired.y + at2.y - footprint.y };
    fitted.push({ itemId: id, ...frameFit ? {} : { box: box2 } });
    occupied.push({ ...footprint, x: at2.x, y: at2.y });
  }
  return { kind: "frame", targets: fitted, expected: captureGroupExpectations(state, roots) };
}
function groupPreviewBoxes(state, action) {
  const stamp = { actor: state.project.updatedBy, ts: state.project.updatedAt, opId: "op_preview" };
  const resolved = resolveGroupOperation(state, { type: "group.change", action }, stamp);
  if (resolved.action.kind !== "apply") fail("preview did not resolve");
  const after = applyGroupChange(state, resolved.action.change, stamp.actor, stamp.ts);
  return new Map(resolved.action.change.writes.flatMap((write) => {
    const id = write.kind === "create" ? write.item.id : write.itemId;
    const item = after.canvas.items[id];
    return item ? [[id, boxOf(item)]] : [];
  }));
}
function enclosing(boxes) {
  const x = Math.min(...boxes.map((box2) => box2.x));
  const y = Math.min(...boxes.map((box2) => box2.y));
  return { x, y, width: Math.max(...boxes.map((box2) => box2.x + box2.width)) - x, height: Math.max(...boxes.map((box2) => box2.y + box2.height)) - y };
}
function reservations(item) {
  const content = groupContentBox(item);
  return { left: content.x - item.x, top: content.y - item.y, right: item.x + item.width - content.x - content.width, bottom: item.y + item.height - content.y - content.height };
}
function groupFitBox(canvas, groupId, growOnly = false) {
  const group = groupIn(canvas, groupId);
  const units = groupSelectionRoots(canvas, groupChildren(canvas, groupId).map((item) => item.id));
  if (units.length === 0) return boxOf(group);
  const bounds = enclosing(units.map((id) => groupFootprint(itemIn(canvas, id), canvas)));
  const band = reservations(group);
  const minimum = groupFrameMinimum(group);
  let box2 = { x: bounds.x - band.left, y: bounds.y - band.top, width: Math.max(minimum.width, bounds.width + band.left + band.right), height: Math.max(minimum.height, bounds.height + band.top + band.bottom) };
  if (growOnly) box2 = enclosing([box2, boxOf(group)]);
  return box2;
}
function groupResizeBox(item, size, anchor = "nw") {
  return { x: anchor.endsWith("e") ? item.x + item.width - size.width : item.x, y: anchor.startsWith("s") ? item.y + item.height - size.height : item.y, ...size };
}
function minimumSize(canvas, item, index = relations(canvas)) {
  if (!isGroupItem(item)) return { width: Math.min(item.width, 80), height: Math.min(item.height, 60) };
  const content = groupContentBox(item);
  validBox(content);
  let sx = 0;
  let sy = 0;
  for (const child of index.children.get(item.id) ?? []) {
    if (annotationTarget(child) && canvas.items[annotationTarget(child)]) continue;
    const minimum = minimumSize(canvas, child, index);
    sx = Math.max(sx, minimum.width / child.width);
    const label = labelHeight(child);
    sy = Math.max(sy, (minimum.height + label) / (child.height + label));
    const bottomRoom = content.y + content.height - child.y - child.height;
    if (child.x < content.x - 1e-5 || child.y < content.y - 1e-5 || child.x + child.width > content.x + content.width + 1e-5 || bottomRoom < label - 1e-5) fail(`fit ${item.id} before resizing: member intrudes into reserved space`);
  }
  const band = reservations(item);
  const ownMinimum = groupFrameMinimum(item);
  return { width: Math.max(ownMinimum.width, band.left + band.right + Math.max(1, content.width * sx)), height: Math.max(ownMinimum.height, band.top + band.bottom + Math.max(1, content.height * sy)) };
}
function groupResizeMinimum(canvas, itemId) {
  return minimumSize(canvas, groupIn(canvas, itemId));
}
function mapBox(box2, before, after) {
  validBox(before);
  validBox(after);
  const sx = after.width / before.width;
  const sy = after.height / before.height;
  return { x: round(after.x + (box2.x - before.x) * sx), y: round(after.y + (box2.y - before.y) * sy), width: round(box2.width * sx), height: round(box2.height * sy) };
}
function groupTransform(canvas, action) {
  const boxes = /* @__PURE__ */ new Map();
  if ("moves" in action) {
    const wanted = new Map(action.moves.map((move) => [move.itemId, move]));
    for (const id of groupSelectionRoots(canvas, [...wanted.keys()])) {
      const item = itemIn(canvas, id);
      const move = wanted.get(id);
      for (const childId of groupTransformClosure(canvas, [id])) {
        const child = itemIn(canvas, childId);
        boxes.set(childId, { ...boxOf(child), x: round(child.x + move.x - item.x), y: round(child.y + move.y - item.y) });
      }
    }
    return boxes;
  }
  if ("by" in action) {
    if (!record(action.by) || !Number.isFinite(action.by.x) || !Number.isFinite(action.by.y)) fail("invalid move delta");
    for (const id of groupTransformClosure(canvas, action.itemIds)) {
      const item = itemIn(canvas, id);
      boxes.set(id, { ...boxOf(item), x: round(item.x + action.by.x), y: round(item.y + action.by.y) });
    }
    return boxes;
  }
  const root = itemIn(canvas, action.itemId);
  const index = relations(canvas);
  validBox(action.box);
  const minimum = minimumSize(canvas, root, index);
  const destination = groupResizeBox(action.box, { width: Math.max(action.box.width, minimum.width), height: Math.max(action.box.height, minimum.height) }, action.anchor);
  const walk = (item, box2) => {
    boxes.set(item.id, box2);
    if (!isGroupItem(item)) return;
    const before = groupContentBox(item);
    const after = groupContentBox({ ...item, ...box2 });
    validBox(before);
    validBox(after);
    for (const child of index.children.get(item.id) ?? []) {
      if (annotationTarget(child) && canvas.items[annotationTarget(child)]) continue;
      const label = labelHeight(child);
      const scaled = mapBox({ ...boxOf(child), height: child.height + label }, before, after);
      walk(child, { ...scaled, height: round(scaled.height - label) });
    }
  };
  walk(root, destination);
  for (const [id, box2] of [...boxes]) for (const mark of index.annotations.get(id) ?? []) boxes.set(mark.id, mapBox(mark, itemIn(canvas, id), box2));
  return boxes;
}
function facts(item) {
  const current2 = item.versions.find((version) => version.id === item.currentVersionId);
  return { ...boxOf(item), containerId: item.containerId ?? null, groupLayout: item.groupLayout ?? null, kind: item.properties.kind ?? null, annotates: annotationTarget(item), mimeType: current2?.mimeType ?? null };
}
function expectation(state, itemId, content, index = relations(state.canvas)) {
  const live = state.canvas.items[itemId];
  const trash = index.trash.get(itemId);
  if (!live && !trash) return { itemId, location: "absent" };
  const item = live ?? trash.item;
  return { itemId, location: live ? "live" : "trash", facts: facts(item), children: sorted((index.children.get(itemId) ?? []).map((child) => child.id)), annotations: sorted((index.annotations.get(itemId) ?? []).map((mark) => mark.id)), ...trash ? { cohortId: trash.cohort?.id ?? null } : {}, ...trash?.legacyGroupRestore ? { legacyGroupRestore: trash.legacyGroupRestore } : {}, ...content ? { content: contentFacts(item, content) } : {} };
}
function captureGroupExpectations(state, itemIds) {
  const wanted = new Set(itemIds);
  const live = itemIds.filter((id) => state.canvas.items[id]);
  for (const id of groupTransformClosure(state.canvas, live)) {
    wanted.add(id);
    for (const ancestor of ancestors(state.canvas, itemIn(state.canvas, id))) wanted.add(ancestor);
  }
  for (const id of groupTransformClosure(state.canvas, [...wanted].filter((id2) => state.canvas.items[id2]))) wanted.add(id);
  const index = relations(state.canvas);
  return sorted(wanted).map((id) => expectation(state, id, void 0, index));
}
function checkExpectations(state, expected) {
  if (!Array.isArray(expected) || expected.length > GROUP_LIMIT) fail("invalid expected state");
  for (const row2 of expected) {
    exactKeys(row2, ["itemId", "location", "facts", "children", "annotations", "cohortId", "content", "legacyGroupRestore"], "expectation");
    if (typeof row2.itemId !== "string" || !["live", "trash", "absent"].includes(String(row2.location))) fail("invalid expected item");
    if (own(row2, "legacyGroupRestore") && !["root", "frame-only"].includes(String(row2.legacyGroupRestore))) fail("invalid legacy trash precondition");
    if (own(row2, "content")) validContent(row2.content);
  }
  idList(expected.map((row2) => row2.itemId), true);
  const index = relations(state.canvas);
  for (const row2 of expected) if (!equal(row2, expectation(state, row2.itemId, row2.content, index))) throw new GroupConflictError(`canvas group changed since planning: ${row2.itemId}`);
}
function validContent(content) {
  exactKeys(content, ["title", "description", "properties", "versions", "currentVersionId"], "content patch");
  for (const key of ["title", "description", "currentVersionId"]) if (own(content, key) && typeof content[key] !== "string") fail("invalid content text");
  if (own(content, "properties") && (!record(content.properties) || Object.values(content.properties).some((value) => value !== null && typeof value !== "string"))) fail("invalid property patch");
  if (own(content, "versions") && (!Array.isArray(content.versions) || content.versions.length > GROUP_LIMIT)) fail("invalid version patch");
}
function contentFacts(item, spec) {
  validContent(spec);
  const result = {};
  for (const key of ["title", "description", "versions", "currentVersionId"]) if (own(spec, key)) result[key] = item[key];
  if (spec.properties) result.properties = Object.fromEntries(Object.keys(spec.properties).map((key) => [key, item.properties[key] ?? null]));
  return result;
}
function patchContent(item, content) {
  validContent(content);
  const properties = { ...item.properties };
  for (const [key, value] of Object.entries(content.properties ?? {})) {
    if (value === null) delete properties[key];
    else Object.defineProperty(properties, key, { value, enumerable: true, configurable: true, writable: true });
  }
  const result = { ...item, ...content, properties };
  validateCreatedItem(result);
  return result;
}
function validateGroupRequest(action) {
  if (!record(action) || typeof action.kind !== "string") fail("invalid action");
  const allowed = {
    copy: ["kind", "sourceCanvasId", "rootIds", "items", "containerId", "at", "cell", "groupPlacement"],
    create: ["kind", "group", "itemIds", "containerId"],
    reparent: ["kind", "itemIds", "containerId", "place"],
    remove: ["kind", "itemIds", "toRoot"],
    ungroup: ["kind", "itemIds"],
    transform: "by" in action ? ["kind", "itemIds", "by", "expected"] : "moves" in action ? ["kind", "moves", "expected"] : ["kind", "itemId", "box", "anchor", "expected"],
    frame: ["kind", "itemId", "box", "fit"],
    layout: ["kind", "itemId", "layout", "tidy"],
    delete: ["kind", "itemIds"],
    restore: ["kind", "itemIds"]
  };
  allowed.insert = ["kind", "item"];
  allowed.content = ["kind", "operation"];
  allowed.reparent.push("cell", "groupPlacement", "expected");
  allowed.transform.push("containerId", "cell", "groupPlacement");
  if (action.kind === "frame" && "itemIds" in action) allowed.frame = ["kind", "itemIds", "fit"];
  if (action.kind === "frame" && "targets" in action) allowed.frame = ["kind", "targets"];
  allowed.frame.push("expected");
  allowed.layout.push("clearGrid");
  if (!own(allowed, action.kind)) fail("resolved group changes are writer-only");
  exactKeys(action, allowed[action.kind], "action");
  if (action.kind === "copy") {
    if (typeof action.sourceCanvasId !== "string" || !action.sourceCanvasId || !Array.isArray(action.items)) fail("copy source and new items required");
    idList(action.rootIds);
    idList(action.items.map((item) => item?.id));
    for (const item of action.items) {
      exactKeys(item, ["id", "title", "version", "description", "properties", "box", "layout", "containerId"], "copied item");
      const { containerId, ...creation } = item;
      if (containerId !== void 0 && (typeof containerId !== "string" || !action.items.some((parent) => parent.id === containerId && parent.properties?.kind === GROUP_KIND))) fail("copied parent must be another copied group");
      requestBox(item.box);
      validateGroupRequest({ kind: "create", group: creation });
    }
    if (action.rootIds.some((id) => !action.items.some((item) => item.id === id))) fail("copy roots must name copied items");
    if (own(action, "at")) {
      exactKeys(action.at, ["x", "y"], "copy position");
      if (!Number.isFinite(action.at.x) || !Number.isFinite(action.at.y)) fail("invalid copy position");
    }
  }
  if (own(action, "expected") && !Array.isArray(action.expected)) fail("expected state must be an array");
  for (const flag of ["place", "fit", "tidy", "toRoot", "clearGrid"]) if (own(action, flag) && typeof action[flag] !== "boolean") fail(`${flag} must be a boolean`);
  if (["reparent", "remove", "ungroup", "delete", "restore"].includes(action.kind)) idList(action.itemIds);
  if ((action.kind === "layout" || action.kind === "frame" && !("itemIds" in action) && !("targets" in action)) && typeof action.itemId !== "string") fail("item ID required");
  if (action.kind === "reparent" && !own(action, "containerId")) fail("destination group required");
  if ("itemIds" in action) idList(action.itemIds, action.kind === "create");
  if ("itemId" in action && (typeof action.itemId !== "string" || !action.itemId)) fail("item ID required");
  if ("containerId" in action && action.containerId !== null && (typeof action.containerId !== "string" || !action.containerId)) fail("invalid destination group");
  if ("containerId" in action || "cell" in action || "groupPlacement" in action) validateDestination(action);
  if ("groupPlacement" in action && !["auto", "preserve", "exact"].includes(String(action.groupPlacement))) fail("invalid group placement policy");
  if (action.kind === "frame" && "targets" in action) {
    if (!Array.isArray(action.targets)) fail("fit targets required");
    for (const target of action.targets) {
      exactKeys(target, ["itemId", "box"], "fit target");
      if (own(target, "box")) requestBox(target.box);
    }
    idList(action.targets.map((target) => target.itemId));
  }
  if (action.kind === "insert") {
    const item = action.item;
    exactKeys(item, ["type", "itemId", "version", "width", "height", "placement", "title", "description", "properties", "containerId", "cell", "groupPlacement"], "insertion");
    if (item.type !== "item.add" || typeof item.itemId !== "string" || !item.itemId) fail("insertion item required");
    if (!record(item.placement)) fail("insertion placement required");
    exactKeys(item.placement, "anchorItemId" in item.placement ? ["anchorItemId"] : ["x", "y", "chosen"], "insertion placement");
    if ("anchorItemId" in item.placement ? typeof item.placement.anchorItemId !== "string" : !Number.isFinite(item.placement.x) || !Number.isFinite(item.placement.y)) fail("invalid insertion position");
    if ("chosen" in item.placement && typeof item.placement.chosen !== "boolean") fail("invalid chosen placement");
    validateGroupRequest({ kind: "create", group: { id: item.itemId, title: item.title ?? "", version: item.version, box: { x: 0, y: 0, width: item.width, height: item.height }, ...item.description !== void 0 ? { description: item.description } : {}, ...item.properties !== void 0 ? { properties: item.properties } : {} } });
    validateDestination(item);
  }
  if (action.kind === "content") {
    const op = action.operation;
    if (!record(op) || !["item.update", "item.addVersion", "item.setCurrentVersion"].includes(op.type) || typeof op.itemId !== "string") fail("invalid content operation");
    exactKeys(op, op.type === "item.update" ? ["type", "itemId", "patch", "filename", "size", "briefHeight", "containerId", "cell", "groupPlacement"] : op.type === "item.addVersion" ? ["type", "itemId", "version", "briefHeight"] : ["type", "itemId", "versionId", "briefHeight"], "content operation");
    if (own(op, "briefHeight") && (typeof op.briefHeight !== "number" || !Number.isFinite(op.briefHeight) || op.briefHeight < 0 || op.briefHeight > 1e4)) fail("invalid brief reservation");
    if (op.type === "item.update") {
      exactKeys(op.patch, ["title", "description", "properties", "removeProperties"], "metadata");
      for (const key of ["title", "description"]) if (own(op.patch, key) && typeof op.patch[key] !== "string") fail("metadata text required");
      if (own(op.patch, "properties")) validProperties(op.patch.properties);
      if (own(op.patch, "removeProperties")) idList(op.patch.removeProperties, true);
      if (op.filename !== void 0 && typeof op.filename !== "string") fail("invalid filename");
      if (own(op, "size")) {
        exactKeys(op.size, ["width", "height"], "resize");
        validBox({ x: 0, y: 0, ...op.size });
      }
      validateDestination(op);
    } else if (op.type === "item.addVersion") {
      validateGroupRequest({ kind: "create", group: { id: op.itemId, title: "", version: op.version } });
    } else if (typeof op.versionId !== "string" || !op.versionId) fail("current version ID required");
  }
  if (action.kind === "create") {
    exactKeys(action.group, ["id", "title", "version", "description", "properties", "box", "layout"], "creation");
    if (typeof action.group.id !== "string" || !action.group.id || typeof action.group.title !== "string") fail("group identity and title required");
    if (own(action.group, "description") && typeof action.group.description !== "string") fail("description must be text");
    if (own(action.group, "properties")) validProperties(action.group.properties);
    exactKeys(action.group.version, ["id", "blobHash", "mimeType", "filename", "size", "visual"], "version");
    if (typeof action.group.version.id !== "string" || typeof action.group.version.blobHash !== "string" || typeof action.group.version.mimeType !== "string" || typeof action.group.version.filename !== "string" || !Number.isFinite(action.group.version.size) || action.group.version.size < 0) fail("group content version required");
    if (own(action.group.version, "visual")) validVisual(action.group.version.visual);
    if (own(action.group, "box")) requestBox(action.group.box);
    if (own(action.group, "layout")) validLayout(action.group.layout);
  }
  if (action.kind === "transform") {
    if (!Array.isArray(action.expected) || action.expected.length === 0) fail("a transform requires captured expected geometry");
    if ("by" in action) {
      idList(action.itemIds);
      exactKeys(action.by, ["x", "y"], "delta");
      if (!Number.isFinite(action.by.x) || !Number.isFinite(action.by.y)) fail("invalid delta");
    } else if ("moves" in action) {
      if (!Array.isArray(action.moves)) fail("move list required");
      for (const move of action.moves) {
        exactKeys(move, ["itemId", "x", "y"], "move");
        if (!Number.isFinite(move.x) || !Number.isFinite(move.y)) fail("invalid move position");
      }
      idList(action.moves.map((move) => move.itemId));
    } else {
      if (typeof action.itemId !== "string") fail("resize item ID required");
      requestBox(action.box);
      if (action.anchor !== void 0 && !["nw", "ne", "sw", "se"].includes(action.anchor)) fail("invalid anchor");
    }
  }
  if (action.kind === "frame" && "box" in action) requestBox(action.box);
  if (action.kind === "layout") validLayout(action.layout);
}
function validateDestination(value) {
  if (own(value, "containerId") && value.containerId !== null && (typeof value.containerId !== "string" || !value.containerId)) fail("invalid destination group");
  if (own(value, "cell")) validCell(value.cell);
  if (own(value, "groupPlacement") && !["auto", "preserve", "exact"].includes(String(value.groupPlacement))) fail("invalid group placement policy");
  if (value.cell && !value.containerId) fail("a grid cell requires a destination group");
}
function patchItem(item, patch) {
  const next = { ...item, ...patch };
  if (patch.containerId === null) delete next.containerId;
  if (patch.groupLayout === null) delete next.groupLayout;
  return next;
}
function validateCreatedItem(item) {
  if (!record(item) || typeof item.id !== "string" || !item.id || !record(item.properties) || typeof item.title !== "string" || typeof item.description !== "string" || !Array.isArray(item.versions) || item.versions.length === 0 || item.versions.length > GROUP_LIMIT) fail("invalid created item");
  validProperties(item.properties);
  validBox(item);
  const ids4 = /* @__PURE__ */ new Set();
  for (const version of item.versions) {
    if (!record(version) || typeof version.id !== "string" || ids4.has(version.id) || typeof version.blobHash !== "string" || typeof version.mimeType !== "string" || typeof version.filename !== "string" || !Number.isFinite(version.size) || version.size < 0 || !record(version.createdBy) || typeof version.createdAt !== "string") fail("invalid created version");
    if (own(version, "visual")) validVisual(version.visual);
    ids4.add(version.id);
  }
  if (!ids4.has(item.currentVersionId)) fail("current version is absent");
}
function applyGroupChange(state, change, actor, ts) {
  if (!hasCanvasGroups(state) && change.intent !== "migrate") fail("canvas groups require group mode");
  exactKeys(change, ["canvasId", "intent", "expected", "writes", "cohorts", "skippedIds", "schemaVersion", "migration"], "resolved change");
  if (change.schemaVersion !== void 0 && change.schemaVersion !== 2 && change.schemaVersion !== 4) fail("unsupported group schema");
  if (!Array.isArray(change.writes) || change.writes.length > GROUP_LIMIT) fail("invalid write set");
  for (const write of change.writes) if (!record(write) || !["patch", "create", "trash", "restore", ...change.schemaVersion === 4 ? ["patchTrash"] : []].includes(String(write.kind)) || write.kind === "create" && !record(write.item)) fail("invalid structural write");
  const modern = change.schemaVersion === 2 || change.schemaVersion === 4;
  if (change.intent === "migrate") {
    if (change.schemaVersion !== 4 || !change.migration) fail("migration requires bounded v4 mode effects");
    const migration = change.migration;
    exactKeys(migration, ["expectedMode", "expectedBoundary", "mode", "boundary"], "migration effect");
    if (!["legacy", "groups"].includes(migration.expectedMode) || !["legacy", "groups"].includes(migration.mode) || migration.expectedMode === migration.mode) fail("invalid migration mode transition");
    if (migration.expectedMode !== (state.project.groupMode ?? "legacy") || !equal(migration.expectedBoundary, state.project.groupMigration ?? null)) throw new GroupConflictError("canvas migration boundary changed since planning");
    if (migration.mode === "groups" !== (migration.boundary !== null)) fail("migration boundary must accompany group mode");
    if (change.writes.some((write) => write.kind !== "patch" && write.kind !== "patchTrash")) fail("migration only patches existing live and trash fields");
  } else if (change.migration !== void 0) fail("only migration changes the mode boundary");
  if (change.canvasId !== state.project.id) fail("change belongs to another canvas");
  if (!["create", "reparent", "ungroup", "transform", "frame", "layout", "delete", "restore", ...modern ? ["insert", "content"] : [], ...change.schemaVersion === 4 ? ["migrate"] : []].includes(change.intent)) fail("unknown semantic intent");
  checkExpectations(state, change.expected);
  if (!modern && change.expected.some((row2) => hasGridCounts(row2.facts?.groupLayout))) fail("grid count preconditions require group schema v2");
  if (change.schemaVersion !== 4 && change.expected.some((row2) => row2.legacyGroupRestore !== void 0)) fail("legacy trash preconditions require group schema v4");
  const writeIds = change.writes.map((write) => write.kind === "create" ? write.item.id : write.itemId);
  idList(writeIds, true);
  const guarded = new Set(change.expected.map((row2) => row2.itemId));
  if (writeIds.some((id) => !guarded.has(id))) fail("every write needs a precondition");
  const items = { ...state.canvas.items };
  const trash = new Map(state.canvas.trash.map((entry) => [entry.item.id, entry]));
  for (const write of change.writes) {
    const layout = write.kind === "create" ? write.item.groupLayout : write.kind === "patch" || write.kind === "patchTrash" ? write.fields?.groupLayout : void 0;
    if (hasGridCounts(layout) && !modern) fail("grid counts require group schema v2");
    if (write.kind === "create") {
      exactKeys(write, ["kind", "item"], "create write");
      validateCreatedItem(write.item);
      if (items[write.item.id] || trash.has(write.item.id)) fail("duplicate item ID");
      items[write.item.id] = structuredClone(write.item);
    } else if (write.kind === "patch" || write.kind === "patchTrash") {
      if (write.kind === "patchTrash" && change.intent !== "migrate") fail("legacy trash patches belong to migration only");
      exactKeys(write, ["kind", "itemId", "fields", ...modern ? ["content"] : [], ...write.kind === "patchTrash" ? ["legacyGroupRestore"] : []], "patch write");
      exactKeys(write.fields, fields2, "structural patch");
      const item = write.kind === "patch" ? items[write.itemId] : trash.get(write.itemId)?.item;
      if (!item) fail("patch target is unavailable");
      if (own(write, "content")) {
        validContent(write.content);
        if (change.intent === "migrate") {
          exactKeys(write.content, ["properties"], "migration content patch");
          exactKeys(write.content.properties, ["kind"], "migration kind patch");
          if (!["area", "group"].includes(String(write.content.properties.kind))) fail("migration only converts area kinds");
        }
        const guardedContent = change.expected.find((row2) => row2.itemId === write.itemId)?.content;
        if (!guardedContent || Object.keys(write.content).some((key) => !own(guardedContent, key)) || Object.keys(write.content.properties ?? {}).some((key) => !own(guardedContent.properties ?? {}, key))) fail("every content field needs its own precondition");
      }
      const patched = patchItem(write.content ? patchContent(item, write.content) : item, write.fields);
      if (write.kind === "patch") items[write.itemId] = { ...patched, updatedBy: actor, updatedAt: ts };
      else {
        const entry = { ...trash.get(write.itemId), item: patched };
        if (own(write, "legacyGroupRestore")) {
          if (write.legacyGroupRestore === null) delete entry.legacyGroupRestore;
          else if (write.legacyGroupRestore === "root" || write.legacyGroupRestore === "frame-only") entry.legacyGroupRestore = write.legacyGroupRestore;
          else fail("invalid legacy trash restore policy");
        }
        trash.set(write.itemId, entry);
      }
    } else if (write.kind === "trash") {
      exactKeys(write, ["kind", "itemId", "deletedAt", "deletedBy", "cohort", ...change.schemaVersion === 4 ? ["legacyGroupRestore"] : []], "trash write");
      const item = items[write.itemId];
      if (!item) fail("delete target is not live");
      if (typeof write.deletedAt !== "string" || !record(write.deletedBy) || typeof write.deletedBy.id !== "string") fail("invalid deletion stamp");
      if (own(write, "legacyGroupRestore") && !["root", "frame-only"].includes(String(write.legacyGroupRestore))) fail("invalid legacy trash restore policy");
      if (write.cohort) {
        exactKeys(write.cohort, ["id", "rootIds"], "deletion cohort");
        idList(write.cohort.rootIds);
        if (typeof write.cohort.id !== "string") fail("invalid cohort ID");
      }
      trash.set(write.itemId, { item, deletedAt: write.deletedAt, deletedBy: write.deletedBy, ...write.cohort ? { cohort: write.cohort } : {}, ...write.legacyGroupRestore ? { legacyGroupRestore: write.legacyGroupRestore } : {} });
      delete items[write.itemId];
    } else if (write.kind === "restore") {
      exactKeys(write, ["kind", "itemId", "containerId"], "restore write");
      const entry = trash.get(write.itemId);
      if (!entry || items[write.itemId]) fail("restore target is not in trash");
      items[write.itemId] = { ...patchItem(entry.item, { containerId: write.containerId }), updatedBy: actor, updatedAt: ts };
      trash.delete(write.itemId);
    } else fail("unknown structural write");
  }
  const cohorts = { ...state.canvas.groupCohorts };
  if (change.cohorts !== void 0) {
    if (!record(change.cohorts) || Object.keys(change.cohorts).length > GROUP_LIMIT) fail("invalid cohort records");
    for (const [id, cohort] of Object.entries(change.cohorts)) {
      exactKeys(cohort, ["rootIds", "members"], "cohort record");
      idList(cohort.rootIds);
      if (!Array.isArray(cohort.members)) fail("cohort members required");
      for (const member of cohort.members) exactKeys(member, ["itemId", "containerId", "annotates"], "cohort member");
      idList(cohort.members.map((member) => member.itemId));
      if (own(cohorts, id) && !equal(cohorts[id], cohort)) throw new GroupConflictError(`deletion cohort changed: ${id}`);
      Object.defineProperty(cohorts, id, { value: structuredClone(cohort), enumerable: true, configurable: true, writable: true });
    }
  }
  const next = { project: { ...state.project, updatedBy: actor, updatedAt: ts, lastOp: activityOpType({ type: "group.change", action: { kind: "apply", change } }) }, canvas: { ...state.canvas, items, trash: [...trash.values()], ...Object.keys(cohorts).length ? { groupCohorts: cohorts } : {} } };
  if (change.migration) {
    next.project.groupMode = change.migration.mode;
    if (change.migration.boundary) next.project.groupMigration = structuredClone(change.migration.boundary);
    else delete next.project.groupMigration;
  }
  validateGroupForest(next);
  return next;
}
function invertGroupChange(state, change) {
  const synthetic = { id: "inverse", name: "inverse" };
  const after = applyGroupChange(state, change, synthetic, "inverse");
  const writes = change.writes.map((write) => {
    if (write.kind === "create") return { kind: "trash", itemId: write.item.id, deletedAt: write.item.createdAt, deletedBy: write.item.createdBy, cohort: { id: `undo-create:${write.item.id}`, rootIds: [write.item.id] } };
    if (write.kind === "patch" || write.kind === "patchTrash") {
      const entry2 = state.canvas.trash.find((row2) => row2.item.id === write.itemId);
      const item = write.kind === "patch" ? itemIn(state.canvas, write.itemId) : entry2.item;
      const previous = {};
      for (const key of fields2) if (own(write.fields, key)) previous[key] = item[key] ?? null;
      const patch = { itemId: write.itemId, fields: previous, ...write.content ? { content: contentFacts(item, write.content) } : {} };
      return write.kind === "patch" ? { kind: "patch", ...patch } : { kind: "patchTrash", ...patch, ...own(write, "legacyGroupRestore") ? { legacyGroupRestore: entry2?.legacyGroupRestore ?? null } : {} };
    }
    if (write.kind === "trash") return { kind: "restore", itemId: write.itemId, containerId: itemIn(state.canvas, write.itemId).containerId ?? null };
    const entry = state.canvas.trash.find((row2) => row2.item.id === write.itemId);
    return { kind: "trash", itemId: write.itemId, deletedAt: entry.deletedAt, deletedBy: entry.deletedBy, ...entry.cohort ? { cohort: entry.cohort } : {}, ...entry.legacyGroupRestore ? { legacyGroupRestore: entry.legacyGroupRestore } : {} };
  });
  const cohorts = {};
  for (const write of writes) if (write.kind === "trash" && write.cohort && !state.canvas.groupCohorts?.[write.cohort.id]) {
    cohorts[write.cohort.id] = { rootIds: write.cohort.rootIds, members: writes.filter((row2) => row2.kind === "trash" && row2.cohort?.id === write.cohort.id).map((row2) => ({ itemId: row2.itemId, containerId: after.canvas.items[row2.itemId]?.containerId ?? null, annotates: after.canvas.items[row2.itemId] ? annotationTarget(after.canvas.items[row2.itemId]) : null })) };
  }
  const afterIndex = relations(after.canvas);
  return { canvasId: change.canvasId, intent: change.intent, expected: change.expected.map((row2) => expectation(after, row2.itemId, row2.content, afterIndex)), writes, ...change.schemaVersion ? { schemaVersion: change.schemaVersion } : {}, ...change.migration ? { migration: { expectedMode: change.migration.mode, expectedBoundary: change.migration.boundary, mode: change.migration.expectedMode, boundary: change.migration.expectedBoundary } } : {}, ...Object.keys(cohorts).length ? { cohorts } : {} };
}
function resolveGroupOperation(state, op, stamp) {
  if (op.action.kind === "migrate") fail("migration requires an authoritative preview and writer revision");
  validateGroupRequest(op.action);
  if (!hasCanvasGroups(state)) fail("canvas groups require group mode");
  validateGroupForest(state);
  const action = op.action;
  if (action.kind === "apply") fail("resolved action cannot be submitted");
  const original = state.canvas;
  let canvas = { ...original, items: { ...original.items }, trash: [...original.trash] };
  const creates = /* @__PURE__ */ new Map();
  const deletions = /* @__PURE__ */ new Set();
  const restores = /* @__PURE__ */ new Map();
  const dependencies = /* @__PURE__ */ new Set();
  const skipped = /* @__PURE__ */ new Set();
  const contents = /* @__PURE__ */ new Map();
  const want = (ids4) => {
    for (const row2 of captureGroupExpectations(state, ids4)) dependencies.add(row2.itemId);
  };
  const put = (id, patch) => {
    const saved = { ...patch };
    for (const key of ["x", "y", "width", "height"]) if (typeof saved[key] === "number") saved[key] = round(saved[key]);
    canvas.items[id] = patchItem(itemIn(canvas, id), saved);
    dependencies.add(id);
  };
  const adjustFrame = (id, box2) => {
    const before = itemIn(canvas, id);
    put(id, box2);
    for (const mark of annotationsOf(canvas, id)) put(mark.id, mapBox(mark, before, itemIn(canvas, id)));
  };
  const fitAncestors = (ids4) => {
    const parents = /* @__PURE__ */ new Set();
    for (const id of ids4) if (canvas.items[id]) for (const parent of ancestors(canvas, itemIn(canvas, id))) parents.add(parent);
    const bottomFirst = [...parents].sort((a, b) => ancestors(canvas, itemIn(canvas, b)).length - ancestors(canvas, itemIn(canvas, a)).length);
    for (const parent of bottomFirst) adjustFrame(parent, groupFitBox(canvas, parent, true));
  };
  const reparent = (ids4, parent) => {
    if (parent !== null) groupIn(canvas, parent);
    for (const id of ids4) {
      const item = itemIn(canvas, id);
      const target = annotationTarget(item);
      if (target && canvas.items[target] && !ids4.includes(target) && (canvas.items[target].containerId ?? null) !== parent) fail("detach the annotation before changing its group");
      put(id, { containerId: parent });
      for (const mark of annotationsOf(canvas, id)) put(mark.id, { containerId: parent });
    }
    validateGroupForest({ ...state, canvas });
  };
  const placeUnits = (ids4, parent, policy = "auto", cell) => {
    const moving = new Set(groupTransformClosure(canvas, ids4));
    for (const id of groupSelectionRoots(canvas, ids4)) {
      const item = itemIn(canvas, id);
      const footprint = groupFootprint(item, canvas);
      const spot = groupPlacement(canvas, parent, footprint, { at: { x: footprint.x, y: footprint.y }, policy, ignoreIds: [...moving], ...cell ? { cell } : {} });
      const dx = spot.x - footprint.x;
      const dy = spot.y - footprint.y;
      for (const childId of groupTransformClosure(canvas, [id])) {
        const child = itemIn(canvas, childId);
        put(childId, { x: child.x + dx, y: child.y + dy });
        moving.delete(childId);
      }
    }
  };
  const destination = (ids4, parent, policy = "preserve", cell) => {
    if (parent) want([parent]);
    reparent(ids4, parent);
    if (parent) {
      placeUnits(ids4, parent, policy, cell);
      adjustFrame(parent, groupFitBox(canvas, parent, true));
      fitAncestors([parent]);
    }
  };
  const trashIds = (ids4) => {
    for (const id of ids4) {
      dependencies.add(id);
      deletions.add(id);
      delete canvas.items[id];
    }
  };
  let roots = [];
  if (action.kind === "copy") {
    const parent = action.containerId ?? null;
    if (parent) {
      groupIn(original, parent);
      want([parent]);
    }
    const copiedIds = new Set(action.items.map((item) => item.id));
    for (const creation of action.items) {
      if (original.items[creation.id] || original.trash.some((entry) => entry.item.id === creation.id)) fail("copied ID already exists");
      const properties = { ...creation.properties };
      const containerId = creation.containerId ?? parent;
      const target = properties.annotates;
      if (target && !copiedIds.has(target)) {
        const external = original.items[target];
        if (action.sourceCanvasId !== state.project.id || !external || (external.containerId ?? null) !== containerId) {
          delete properties.annotates;
          delete properties.region;
        } else want([target]);
      }
      const item = {
        id: creation.id,
        title: creation.title,
        description: creation.description ?? "",
        properties,
        ...persistedBox(creation.box),
        ...containerId ? { containerId } : {},
        ...creation.layout ? { groupLayout: structuredClone(creation.layout) } : {},
        versions: [{ ...creation.version, createdAt: stamp.ts, createdBy: stamp.actor }],
        currentVersionId: creation.version.id,
        createdAt: stamp.ts,
        createdBy: stamp.actor,
        updatedAt: stamp.ts,
        updatedBy: stamp.actor
      };
      validateCreatedItem(item);
      canvas.items[item.id] = item;
      creates.set(item.id, item);
      dependencies.add(item.id);
    }
    validateGroupForest({ ...state, canvas });
    roots = groupSelectionRoots(canvas, [...copiedIds]);
    if (!equal(sorted(roots), sorted(action.rootIds))) fail("copy roots do not match the copied forest");
    const footprints = roots.map((id) => groupFootprint(itemIn(canvas, id), canvas));
    const left = Math.min(...footprints.map((box2) => box2.x)), top = Math.min(...footprints.map((box2) => box2.y));
    const footprint = { x: left, y: top, width: Math.max(...footprints.map((box2) => box2.x + box2.width)) - left, height: Math.max(...footprints.map((box2) => box2.y + box2.height)) - top };
    const desired = action.at ?? { x: footprint.x + PLACEMENT_GAP, y: footprint.y + PLACEMENT_GAP };
    const policy = action.groupPlacement ?? "auto";
    const spot = parent ? groupPlacement(canvas, parent, { width: footprint.width, height: footprint.height }, { at: desired, policy, ignoreIds: [...copiedIds], ...action.cell ? { cell: action.cell } : {} }) : policy === "preserve" || policy === "exact" ? desired : nearestFreeSpot({ ...desired, width: footprint.width, height: footprint.height }, Object.values(original.items).filter((item) => !item.containerId).map((item) => ({ id: item.id, ...groupFootprint(item, original) })));
    for (const id of copiedIds) {
      const item = itemIn(canvas, id);
      put(id, { x: item.x + spot.x - footprint.x, y: item.y + spot.y - footprint.y });
    }
    fitAncestors(roots);
  } else if (action.kind === "insert") {
    const op2 = action.item;
    if (original.items[op2.itemId] || original.trash.some((entry) => entry.item.id === op2.itemId)) throw new OpValidationError("duplicate-id", "item ID already exists");
    const targetId = op2.properties?.annotates;
    const target = targetId ? original.items[targetId] : void 0;
    const parent = target ? target.containerId ?? null : op2.containerId ?? null;
    if (target && own(op2, "containerId") && op2.containerId !== parent) fail("annotation destination differs from its target");
    if (target) want([target.id]);
    if (parent) want([parent]);
    const at2 = resolvePlacement(original, op2.placement, op2.width, op2.height, parent !== null || positionIsMeaningful(op2));
    const primitive = reduceOperation(state, { id: stamp.opId, actor: stamp.actor, ts: stamp.ts, canvasId: state.project.id, op: { ...op2, placement: { ...at2, chosen: true } } });
    const created = primitive.canvas.items[op2.itemId];
    const item = { ...created, ...persistedBox(created) };
    validateCreatedItem(item);
    canvas.items[item.id] = item;
    creates.set(item.id, item);
    dependencies.add(item.id);
    roots = [item.id];
    const policy = target ? "preserve" : op2.groupPlacement ?? ("chosen" in op2.placement && op2.placement.chosen ? "preserve" : "auto");
    destination(roots, parent, policy, op2.cell);
  } else if (action.kind === "content") {
    const op2 = action.operation;
    const before = itemIn(original, op2.itemId);
    want([before.id]);
    roots = [before.id];
    const primitive = reduceOperation(state, { id: stamp.opId, actor: stamp.actor, ts: stamp.ts, canvasId: state.project.id, op: op2 });
    let item = primitive.canvas.items[before.id];
    validateCreatedItem(item);
    const content = {};
    for (const key of ["title", "description", "versions", "currentVersionId"]) if (!equal(before[key], item[key])) content[key] = item[key];
    const properties = Object.fromEntries([.../* @__PURE__ */ new Set([...Object.keys(before.properties), ...Object.keys(item.properties)])].filter((key) => before.properties[key] !== item.properties[key]).map((key) => [key, item.properties[key] ?? null]));
    if (Object.keys(properties).length) content.properties = properties;
    if (op2.type === "item.update" && op2.filename !== void 0) content.currentVersionId = item.currentVersionId;
    if (Object.keys(content).length) contents.set(item.id, content);
    canvas.items[item.id] = item;
    const target = annotationTarget(item);
    if (target && canvas.items[target]) {
      want([target]);
      reparent([item.id], canvas.items[target].containerId ?? null);
    }
    if (isGroupItem(item) && op2.briefHeight !== void 0) {
      const oldContent = groupContentBox(item);
      put(item.id, { groupLayout: { ...item.groupLayout, briefHeight: op2.briefHeight } });
      const newContent = groupContentBox(itemIn(canvas, item.id));
      const dy = oldContent.y - newContent.y;
      adjustFrame(item.id, { ...boxOf(item), y: item.y + dy, height: Math.max(GROUP_MIN_SIZE.height, item.height - dy) });
      item = itemIn(canvas, item.id);
    } else if (!isGroupItem(item) && op2.briefHeight !== void 0) fail("brief reservation belongs to a group");
    if (op2.type === "item.update" && op2.size) {
      const transform = { kind: "transform", itemId: item.id, box: { ...boxOf(item), ...op2.size }, expected: [] };
      for (const [id, box2] of groupTransform(canvas, transform)) put(id, box2);
    }
    if (op2.type === "item.update" && own(op2, "containerId")) destination([item.id], op2.containerId ?? null, op2.groupPlacement ?? "preserve", op2.cell);
    fitAncestors([item.id]);
  } else if (action.kind === "create") {
    const ids4 = action.itemIds ?? [];
    want(ids4);
    roots = groupSelectionRoots(original, ids4);
    let parent = action.containerId;
    if (parent === void 0) {
      const chains = roots.map((id) => ancestors(original, itemIn(original, id)));
      parent = chains[0]?.find((id) => chains.every((chain) => chain.includes(id))) ?? null;
    }
    if (parent) {
      want([parent]);
      groupIn(original, parent);
    }
    const creation = action.group;
    if (original.items[creation.id] || original.trash.some((entry) => entry.item.id === creation.id)) fail("group ID already exists");
    const box2 = persistedBox(creation.box ?? { x: 0, y: 0, ...GROUP_DEFAULT_SIZE });
    const group = { id: creation.id, ...box2, title: creation.title, description: creation.description ?? "", properties: { ...creation.properties, kind: GROUP_KIND }, ...parent ? { containerId: parent } : {}, groupLayout: { ...creation.layout }, versions: [{ ...creation.version, createdAt: stamp.ts, createdBy: stamp.actor }], currentVersionId: creation.version.id, createdAt: stamp.ts, createdBy: stamp.actor, updatedAt: stamp.ts, updatedBy: stamp.actor };
    validateCreatedItem(group);
    canvas.items[group.id] = group;
    dependencies.add(group.id);
    creates.set(group.id, group);
    const waitingMarks = annotationsOf(original, group.id);
    want(waitingMarks.map((mark) => mark.id));
    for (const mark of waitingMarks) put(mark.id, { containerId: parent ?? null });
    reparent(roots, group.id);
    if (roots.length) put(group.id, groupFitBox(canvas, group.id));
    const createdFrame = itemIn(canvas, group.id);
    const minimum = groupFrameMinimum(createdFrame);
    if (createdFrame.width < minimum.width || createdFrame.height < minimum.height) fail("new group is too small for its grid cells");
    fitAncestors([group.id]);
    roots = [group.id];
  } else if (action.kind === "restore") {
    roots = action.itemIds;
    want(roots);
    const selected = /* @__PURE__ */ new Set();
    for (const id of roots) {
      const entry = original.trash.find((row2) => row2.item.id === id);
      if (!entry) fail(`not in trash: ${id}`);
      selected.add(id);
      const capture = entry.cohort ? original.groupCohorts?.[entry.cohort.id] : void 0;
      if (!entry.legacyGroupRestore && isGroupItem(entry.item) && entry.cohort && capture) {
        const walk = (parent) => {
          for (const member of capture.members) if (member.containerId === parent || member.annotates === parent) {
            const child = original.trash.find((row2) => row2.item.id === member.itemId);
            if (!child || child.cohort?.id !== entry.cohort.id) {
              skipped.add(member.itemId);
              continue;
            }
            if (selected.has(member.itemId)) continue;
            selected.add(member.itemId);
            walk(member.itemId);
          }
        };
        walk(id);
      }
      if (!entry.legacyGroupRestore) {
        for (const mark of original.trash) if (annotationTarget(mark.item) === id && mark.cohort?.id === entry.cohort?.id) selected.add(mark.item.id);
      }
    }
    for (const id of selected) {
      const entry = original.trash.find((row2) => row2.item.id === id);
      let parent = entry.legacyGroupRestore ? null : entry.item.containerId ?? null;
      const seen = /* @__PURE__ */ new Set([id]);
      while (parent && !original.items[parent] && !selected.has(parent)) {
        if (seen.has(parent)) fail("trashed membership cycle");
        seen.add(parent);
        parent = original.trash.find((row2) => row2.item.id === parent)?.item.containerId ?? null;
      }
      dependencies.add(id);
      if (parent && original.items[parent]) want([parent]);
      canvas.items[id] = patchItem(entry.item, { containerId: parent });
      restores.set(id, parent);
    }
    canvas.trash = canvas.trash.filter((entry) => !selected.has(entry.item.id));
    for (const item of Object.values(canvas.items)) {
      const target = annotationTarget(item);
      if (target && canvas.items[target] && (selected.has(item.id) || selected.has(target))) {
        put(item.id, { containerId: canvas.items[target].containerId ?? null });
        if (restores.has(item.id)) restores.set(item.id, canvas.items[target].containerId ?? null);
      }
    }
    fitAncestors([...selected]);
  } else {
    const ids4 = "itemIds" in action ? action.itemIds : "moves" in action ? action.moves.map((move) => move.itemId) : "targets" in action ? action.targets.map((target) => target.itemId) : [action.itemId];
    want(ids4);
    roots = groupSelectionRoots(original, ids4);
    if (action.kind === "reparent") {
      if (action.containerId) want([action.containerId]);
      if (action.expected) {
        checkExpectations(state, action.expected);
        if ([...dependencies].some((id) => !action.expected.some((row2) => row2.itemId === id))) fail("reparent expectations omit destination dependencies");
      }
      destination(roots, action.containerId, action.groupPlacement ?? (action.place ? "auto" : "preserve"), action.cell);
    } else if (action.kind === "remove") {
      const destinations = roots.map((id) => {
        const parent = itemIn(original, id).containerId;
        if (!parent) fail(`${id} is already at the canvas root`);
        return { id, parent: action.toRoot ? null : itemIn(original, parent).containerId ?? null };
      });
      for (const destination2 of destinations) reparent([destination2.id], destination2.parent);
      fitAncestors(roots);
    } else if (action.kind === "ungroup") {
      for (const id of roots) {
        const group = groupIn(canvas, id);
        reparent(groupChildren(canvas, id).map((child) => child.id), group.containerId ?? null);
        trashIds([id, ...annotationsOf(canvas, id).map((mark) => mark.id)]);
      }
    } else if (action.kind === "delete") {
      trashIds(groupTransformClosure(original, roots));
    } else if (action.kind === "transform") {
      if (action.containerId) want([action.containerId]);
      checkExpectations(state, action.expected);
      const captured = new Set(action.expected.map((row2) => row2.itemId));
      if ([...dependencies].some((id) => !captured.has(id))) fail("transform expectations omit affected items or ancestors");
      for (const [id, box2] of groupTransform(original, action)) put(id, box2);
      if (own(action, "containerId")) destination(roots, action.containerId ?? null, action.groupPlacement ?? "preserve", action.cell);
      fitAncestors(roots);
    } else if (action.kind === "frame") {
      if (action.expected) {
        checkExpectations(state, action.expected);
        const captured = new Set(action.expected.map((row2) => row2.itemId));
        if ([...dependencies].some((id) => !captured.has(id))) fail("frame expectations omit a structural dependency");
      }
      const targets = "targets" in action ? action.targets : "itemIds" in action ? action.itemIds.map((itemId) => ({ itemId })) : [{ itemId: action.itemId, ...action.box && !action.fit ? { box: action.box } : {} }];
      if (!("targets" in action) && !("itemIds" in action) && !action.fit && !action.box) fail("frame needs a box or fit");
      const normalized = new Set(groupSelectionRoots(canvas, targets.map((target) => target.itemId)));
      for (const target of targets.filter((target2) => normalized.has(target2.itemId))) {
        const item = itemIn(canvas, target.itemId);
        if (!isGroupItem(item) && !target.box) fail("ordinary fit needs its measured box");
        adjustFrame(item.id, target.box ?? groupFitBox(canvas, item.id));
        if (isGroupItem(item)) {
          const minimum = groupFrameMinimum(itemIn(canvas, item.id));
          if (itemIn(canvas, item.id).width < minimum.width || itemIn(canvas, item.id).height < minimum.height) fail("frame is too small for its grid cells");
        }
        if (isGroupItem(item) && target.box && !equal(groupFitBox(canvas, item.id, true), target.box)) fail("frame would exclude members or cover reserved labels; fit it or choose a larger box");
      }
      fitAncestors(ids4);
    } else if (action.kind === "layout") {
      const group = groupIn(canvas, action.itemId);
      const oldContent = groupContentBox(group);
      const layout = { ...group.groupLayout, ...action.layout };
      if (action.clearGrid) for (const key of ["rows", "columns", "rowCount", "columnCount", "rowGutter", "columnGutter"]) delete layout[key];
      put(group.id, { groupLayout: layout });
      const content = groupContentBox(itemIn(canvas, group.id));
      const dx = oldContent.x - content.x;
      const dy = oldContent.y - content.y;
      adjustFrame(group.id, { x: group.x + dx, y: group.y + dy, width: Math.max(GROUP_MIN_SIZE.width, group.width - dx), height: Math.max(GROUP_MIN_SIZE.height, group.height - dy) });
      const minimum = groupFrameMinimum(itemIn(canvas, group.id));
      const reservedFrame = itemIn(canvas, group.id);
      if (reservedFrame.width < minimum.width || reservedFrame.height < minimum.height) adjustFrame(group.id, { ...boxOf(reservedFrame), width: Math.max(reservedFrame.width, minimum.width), height: Math.max(reservedFrame.height, minimum.height) });
      if (action.tidy) {
        const units = groupSelectionRoots(canvas, groupChildren(canvas, group.id).map((child) => child.id));
        if (units.length) {
          const layout2 = itemIn(canvas, group.id).groupLayout ?? {};
          const columns = layout2.columnCount ?? Math.max(1, layout2.columns?.length ?? 0, Math.ceil(Math.sqrt(units.length)));
          const rows = layout2.rowCount ?? Math.max(1, layout2.rows?.length ?? 0, Math.ceil(units.length / columns));
          if (units.length > rows * columns) fail("the grid has fewer cells than placement units");
          const footprints = units.map((id) => groupFootprint(itemIn(canvas, id), canvas));
          const inner = groupContentBox(itemIn(canvas, group.id));
          const width = Math.max(inner.width, columns * Math.max(...footprints.map((box2) => box2.width)) + PLACEMENT_GAP * (columns - 1));
          const height = Math.max(inner.height, rows * Math.max(...footprints.map((box2) => box2.height)) + PLACEMENT_GAP * (rows - 1));
          const frame = itemIn(canvas, group.id);
          adjustFrame(group.id, { ...boxOf(frame), width: frame.width + width - inner.width, height: frame.height + height - inner.height });
          const cellWidth = (width - PLACEMENT_GAP * (columns - 1)) / columns;
          const cellHeight = (height - PLACEMENT_GAP * (rows - 1)) / rows;
          for (let i = 0; i < units.length; i++) {
            const footprint = footprints[i];
            const dx2 = inner.x + i % columns * (cellWidth + PLACEMENT_GAP) - footprint.x;
            const dy2 = inner.y + Math.floor(i / columns) * (cellHeight + PLACEMENT_GAP) - footprint.y;
            for (const id of groupTransformClosure(canvas, [units[i]])) {
              const child = itemIn(canvas, id);
              put(id, { x: child.x + dx2, y: child.y + dy2 });
            }
          }
        }
      }
      adjustFrame(group.id, groupFitBox(canvas, group.id, true));
      fitAncestors([group.id]);
    }
  }
  const writes = [];
  for (const id of sorted(dependencies)) {
    if (deletions.has(id)) {
      writes.push({ kind: "trash", itemId: id, deletedAt: stamp.ts, deletedBy: stamp.actor, cohort: { id: stamp.opId, rootIds: roots } });
      continue;
    }
    if (creates.has(id)) {
      writes.push({ kind: "create", item: canvas.items[id] });
      continue;
    }
    if (restores.has(id)) {
      writes.push({ kind: "restore", itemId: id, containerId: restores.get(id) });
      continue;
    }
    const before = original.items[id];
    const after = canvas.items[id];
    if (!before || !after) continue;
    const patch = {};
    for (const key of fields2) if (!equal(before[key] ?? null, after[key] ?? null)) patch[key] = after[key] ?? null;
    if (Object.keys(patch).length || contents.has(id)) writes.push({ kind: "patch", itemId: id, fields: patch, ...contents.has(id) ? { content: contents.get(id) } : {} });
  }
  const cohorts = deletions.size ? { [stamp.opId]: { rootIds: roots, members: sorted(deletions).map((id) => ({ itemId: id, containerId: original.items[id].containerId ?? null, annotates: annotationTarget(original.items[id]) })) } } : void 0;
  const originalIndex = relations(original);
  const expected = sorted(dependencies).map((id) => expectation(state, id, contents.get(id), originalIndex));
  const v2Layout = expected.some((row2) => hasGridCounts(row2.facts?.groupLayout)) || writes.some((write) => hasGridCounts(write.kind === "create" ? write.item.groupLayout : write.kind === "patch" ? write.fields.groupLayout : void 0));
  const change = { canvasId: state.project.id, intent: action.kind === "remove" ? "reparent" : action.kind === "copy" ? "create" : action.kind, expected, writes, ...expected.some((row2) => row2.legacyGroupRestore !== void 0) ? { schemaVersion: 4 } : action.kind === "insert" || action.kind === "content" || v2Layout ? { schemaVersion: 2 } : {}, ...cohorts ? { cohorts } : {}, ...skipped.size ? { skippedIds: sorted(skipped) } : {} };
  applyGroupChange(state, change, stamp.actor, stamp.ts);
  return { type: "group.change", action: { kind: "apply", change } };
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
function resolveCanvasGroupRequest(state, op, stamp) {
  if (op.type === "group.change") return resolveGroupOperation(state, op, stamp);
  if (!hasCanvasGroups(state)) return op;
  if (op.type === "item.add") return resolveGroupOperation(state, { type: "group.change", action: { kind: "insert", item: op } }, stamp);
  if (op.type === "item.update" || op.type === "item.addVersion" || op.type === "item.setCurrentVersion") {
    const item = itemIn(state.canvas, op.itemId);
    const changesBand = op.briefHeight !== void 0 && op.briefHeight !== (item.groupLayout?.briefHeight ?? 0);
    const structural = changesBand || op.type === "item.update" && (op.size !== void 0 || own(op, "containerId") || own(op.patch.properties ?? {}, "annotates") || op.patch.removeProperties?.includes("annotates"));
    if (structural) return resolveGroupOperation(state, { type: "group.change", action: { kind: "content", operation: op } }, stamp);
    if (op.briefHeight !== void 0) {
      const { briefHeight: _height, ...plain } = op;
      return plain;
    }
    return op;
  }
  const groupRelated = (id) => {
    const item = state.canvas.items[id];
    return !!item && (isGroupItem(item) || !!item.containerId || annotationsOf(state.canvas, id).length > 0 || !!annotationTarget(item));
  };
  let action;
  if (op.type === "item.move" && groupRelated(op.itemId)) {
    action = { kind: "transform", moves: [{ itemId: op.itemId, x: op.x, y: op.y }], expected: captureGroupExpectations(state, [op.itemId]) };
  } else if (op.type === "items.move" && op.moves.some((move) => groupRelated(move.itemId))) {
    action = { kind: "transform", moves: op.moves, expected: captureGroupExpectations(state, op.moves.map((move) => move.itemId)) };
  } else if (op.type === "item.resize" && groupRelated(op.itemId)) {
    const item = itemIn(state.canvas, op.itemId);
    action = { kind: "transform", itemId: item.id, box: { x: item.x, y: item.y, width: op.width, height: op.height }, expected: captureGroupExpectations(state, [item.id]) };
  } else if (op.type === "item.delete" && groupRelated(op.itemId)) action = { kind: "delete", itemIds: [op.itemId] };
  else if (op.type === "items.delete" && op.itemIds.some(groupRelated)) action = { kind: "delete", itemIds: op.itemIds };
  else if (op.type === "item.restore" && state.canvas.trash.some((entry) => entry.item.id === op.itemId && (entry.legacyGroupRestore || entry.cohort || isGroupItem(entry.item) || entry.item.containerId || annotationsOf(state.canvas, entry.item.id).length))) action = { kind: "restore", itemIds: [op.itemId] };
  else if (op.type === "items.restore" && state.canvas.trash.some((entry) => op.itemIds.includes(entry.item.id) && (entry.legacyGroupRestore || entry.cohort || isGroupItem(entry.item) || entry.item.containerId || annotationsOf(state.canvas, entry.item.id).length))) action = { kind: "restore", itemIds: op.itemIds };
  return action ? resolveGroupOperation(state, { type: "group.change", action }, stamp) : op;
}

// packages/core/src/duplicate.ts
function boundsOf(items) {
  if (items.length === 0) return null;
  const minX = Math.min(...items.map((i) => i.x));
  const minY = Math.min(...items.map((i) => i.y));
  const maxX = Math.max(...items.map((i) => i.x + i.width));
  const maxY = Math.max(...items.map((i) => i.y + i.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
function duplicatePlacements(canvas, items, want) {
  const box2 = boundsOf(items);
  if (!box2) return [];
  const asked = want ?? { x: box2.x + PLACEMENT_GAP, y: box2.y + PLACEMENT_GAP };
  const occupied = Object.values(canvas.items).map((i) => ({
    id: i.id,
    x: i.x,
    y: i.y,
    width: i.width,
    height: i.height
  }));
  const at2 = nearestFreeSpot({ ...asked, width: box2.width, height: box2.height }, occupied);
  return items.map((item) => ({
    item,
    x: at2.x + (item.x - box2.x),
    y: at2.y + (item.y - box2.y)
  }));
}
function copyProperties(source3, options) {
  const carried = { ...source3.properties };
  delete carried.file;
  if (!options.sameCanvas) {
    delete carried[PARENT_PROP];
    return carried;
  }
  return { ...carried, [PARENT_PROP]: source3.id };
}

// packages/core/src/canvas-group-copy.ts
function groupCopySource(canvasId, canvas, rootIds) {
  const roots = groupSelectionRoots(canvas, rootIds);
  return { canvasId, rootIds: roots, items: groupTransformClosure(canvas, roots).map((id) => structuredClone(canvas.items[id])) };
}
function groupCopyAction(source3, destinationCanvasId, options) {
  const remap = new Map(source3.items.map((item) => [item.id, options.newItemId()]));
  if (new Set(remap.values()).size !== remap.size) throw new OpValidationError("bad-op", "copy needs distinct new item IDs");
  const references = /* @__PURE__ */ new Set(["parent", "annotates", "noteFor", ...modules().flatMap((module) => module.itemReferenceProperties ?? [])]);
  const families = new Set(modules().flatMap((module) => module.groupIdentityProperties ?? []));
  const familyIds = /* @__PURE__ */ new Map();
  const sameCanvas = source3.canvasId === destinationCanvasId;
  const items = source3.items.map((item) => {
    const current2 = item.versions.find((version) => version.id === item.currentVersionId);
    if (!current2) throw new OpValidationError("bad-op", `copy cannot read the current version of ${item.id}`);
    const properties = copyProperties(item, { sameCanvas });
    for (const [key, value] of Object.entries(properties)) {
      if (key === "parent" && sameCanvas && value === item.id) continue;
      if (references.has(key) && remap.has(value)) properties[key] = remap.get(value);
      else if (families.has(key)) {
        const identity = `${key}:${value}`;
        if (!familyIds.has(identity)) familyIds.set(identity, options.newItemId());
        properties[key] = familyIds.get(identity);
      } else if (!sameCanvas && references.has(key)) delete properties[key];
    }
    if (!properties.annotates) delete properties.region;
    const decorated = options.decorate ? options.decorate(properties, item, source3.rootIds.includes(item.id)) : properties;
    return {
      id: remap.get(item.id),
      title: item.title,
      description: item.description,
      properties: decorated,
      box: { x: item.x, y: item.y, width: item.width, height: item.height },
      ...item.containerId && remap.has(item.containerId) ? { containerId: remap.get(item.containerId) } : {},
      ...item.groupLayout ? { layout: structuredClone(item.groupLayout) } : {},
      version: { id: options.newVersionId(), blobHash: current2.blobHash, mimeType: current2.mimeType, filename: current2.filename, size: current2.size, ...current2.visual ? { visual: structuredClone(current2.visual) } : {} }
    };
  });
  return {
    kind: "copy",
    sourceCanvasId: source3.canvasId,
    rootIds: source3.rootIds.map((id) => remap.get(id)),
    items,
    ...options.containerId !== void 0 ? { containerId: options.containerId } : {},
    ...options.at ? { at: options.at } : {},
    ...options.cell ? { cell: options.cell } : {},
    ...options.groupPlacement ? { groupPlacement: options.groupPlacement } : {}
  };
}
function groupRestorePreview(state, itemIds) {
  const op = resolveGroupOperation(state, { type: "group.change", action: { kind: "restore", itemIds } }, { actor: { id: "preview", name: "Preview" }, ts: "preview", opId: "preview" });
  if (op.action.kind !== "apply") throw new Error("restore was not resolved");
  const restored = op.action.change.writes.filter((write) => write.kind === "restore");
  return { restoredIds: restored.map((write) => write.itemId), skippedIds: op.action.change.skippedIds ?? [], parents: Object.fromEntries(restored.map((write) => [write.itemId, write.containerId])) };
}

// packages/core/src/canvas-group-migration.ts
var box = (item) => ({ x: item.x, y: item.y, width: item.width, height: item.height });
var equal2 = (a, b) => JSON.stringify(a) === JSON.stringify(b);
var rounded = (rect) => Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, Math.round(value * 1e6) / 1e6]));
var row = (before, after) => ({ itemId: before.id, title: before.title, kindBefore: before.properties.kind ?? null, kindAfter: after.properties.kind ?? null, parentBefore: before.containerId ?? null, parentAfter: after.containerId ?? null, boxBefore: box(before), boxAfter: box(after) });
function groupFromArea(item) {
  const grid = areaGrid(item);
  const layout = { titleHeight: AREA_TITLE_HEIGHT, briefHeight: AREA_CARD_HEIGHT, inset: AREA_INSET, ...grid ? { rowCount: grid.rows, columnCount: grid.cols, ...grid.rowNames.length ? { rows: grid.rowNames } : {}, ...grid.colNames.length ? { columns: grid.colNames } : {} } : {} };
  const next = { ...item, properties: { ...item.properties, kind: "group" }, groupLayout: layout };
  delete next.containerId;
  const legacy = areaInner(item), content = groupContentBox(next);
  const dx = legacy.x - content.x, dy = legacy.y - content.y;
  const minimum = groupFrameMinimum(next);
  return { ...next, ...rounded({ x: item.x + dx, y: item.y + dy, width: Math.max(item.width - dx, minimum.width), height: Math.max(item.height - dy, minimum.height) }) };
}
function plan(state, revision) {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new OpValidationError("bad-op", "migration needs an authoritative revision");
  validateGroupForest(state);
  const already = state.project.groupMode === "groups";
  const original = Object.values(state.canvas.items).sort((a, b) => a.id.localeCompare(b.id));
  const preview = {
    canvasId: state.project.id,
    revision,
    migrationVersion: 1,
    status: already ? "already-groups" : "ready",
    fromMode: already ? "groups" : "legacy",
    toMode: "groups",
    boundary: state.project.groupMigration ?? null,
    live: [],
    trash: [],
    ambiguities: [],
    danglingAnnotations: [],
    repairs: [],
    history: { undoBoundarySeq: already ? state.project.groupMigration?.seq ?? null : revision + 1, explanation: already ? "This canvas already uses groups; no conversion will be written." : "Conversion is one undo boundary for every actor. Earlier Undo and Redo are refused without consuming history. Rollback requires the converted fields to be unchanged and no later group-dependent live, trash, Undo or Redo state." }
  };
  if (already) {
    preview.live = original.map((item) => row(item, item));
    preview.trash = state.canvas.trash.map(({ item, legacyGroupRestore }) => ({ ...row(item, item), ...legacyGroupRestore ? { restorePolicy: legacyGroupRestore } : {} }));
    return { preview, after: state };
  }
  const items = Object.fromEntries(original.map((item) => [item.id, isArea(item) ? groupFromArea(item) : { ...item }]));
  const areas = original.filter(isArea).sort((a, b) => a.width * a.height - b.width * b.height || a.id.localeCompare(b.id));
  for (const item of original) {
    if (isArea(item) || annotationTarget(item)) continue;
    const candidates = areas.filter((area) => inArea(area, item));
    if (candidates[0]) items[item.id].containerId = candidates[0].id;
    if (candidates.length > 1) preview.ambiguities.push({ itemId: item.id, candidateIds: candidates.map((area) => area.id), chosenId: candidates[0].id });
  }
  for (const item of original) {
    const targetId = annotationTarget(item);
    if (!targetId) continue;
    const target = items[targetId];
    if (target?.containerId) items[item.id].containerId = target.containerId;
    else delete items[item.id].containerId;
    if (!target) preview.danglingAnnotations.push(item.id);
  }
  const canvas = { ...state.canvas, items };
  for (const area of areas) items[area.id] = { ...items[area.id], ...rounded(groupFitBox(canvas, area.id, true)) };
  for (const item of original) {
    const converted = items[item.id];
    preview.live.push(row(item, converted));
    if (!equal2(box(item), box(converted))) preview.repairs.push({ itemId: item.id, location: "live", boxBefore: box(item), boxAfter: box(converted), reasons: [...areaGrid(item)?.rowNames.length || areaGrid(item)?.colNames.length ? ["Reserve named row and column label gutters"] : [], "Reserve header, item labels and attached-ink footprints"] });
  }
  const trash = state.canvas.trash.map((entry) => {
    const item = isArea(entry.item) ? groupFromArea(entry.item) : { ...entry.item };
    delete item.containerId;
    const restorePolicy = isArea(entry.item) ? "frame-only" : "root";
    preview.trash.push({ ...row(entry.item, item), restorePolicy });
    if (annotationTarget(item) && !items[annotationTarget(item)]) preview.danglingAnnotations.push(item.id);
    if (!equal2(box(entry.item), box(item))) preview.repairs.push({ itemId: item.id, location: "trash", boxBefore: box(entry.item), boxAfter: box(item), reasons: ["Reserve header and named label gutters on this frame-only restore"] });
    return { ...entry, item, legacyGroupRestore: restorePolicy };
  });
  const after = { project: { ...state.project, groupMode: "groups" }, canvas: { ...canvas, trash } };
  validateGroupForest(after);
  return { preview, after };
}
function canvasGroupMigrationPreview(state, revision) {
  return plan(state, revision).preview;
}
function resolveCanvasGroupMigration(state, revision, action, stamp) {
  if (!action || typeof action !== "object" || Object.keys(action).some((key) => !["kind", "expectedRevision"].includes(key)) || action.kind !== "migrate" || !Number.isSafeInteger(action.expectedRevision) || action.expectedRevision < 0) throw new OpValidationError("bad-op", "migration needs only its expectedRevision");
  if (action.expectedRevision !== revision) throw new GroupConflictError("canvas changed since migration preview; preview the conversion again");
  const { preview, after } = plan(state, revision);
  if (preview.status !== "ready") throw new GroupConflictError("this canvas already uses groups; no conversion is needed");
  const ids4 = [...Object.keys(state.canvas.items), ...state.canvas.trash.map((entry) => entry.item.id)];
  const expected = captureGroupExpectations(state, ids4);
  const writes = [];
  for (const original of [...Object.values(state.canvas.items), ...state.canvas.trash.map((entry) => entry.item)]) {
    const live = !!state.canvas.items[original.id];
    const next = live ? after.canvas.items[original.id] : after.canvas.trash.find((entry) => entry.item.id === original.id).item;
    const fields3 = {};
    for (const key of ["x", "y", "width", "height", "containerId", "groupLayout"]) if (!equal2(original[key] ?? null, next[key] ?? null)) fields3[key] = next[key] ?? null;
    const content = original.properties.kind !== next.properties.kind ? { properties: { kind: next.properties.kind } } : void 0;
    if (content) expected.find((entry) => entry.itemId === original.id).content = { properties: { kind: original.properties.kind ?? null } };
    if (live && !Object.keys(fields3).length && !content) continue;
    const patch = { itemId: original.id, fields: fields3, ...content ? { content } : {} };
    writes.push(live ? { kind: "patch", ...patch } : { kind: "patchTrash", ...patch, legacyGroupRestore: isArea(original) ? "frame-only" : "root" });
  }
  const change = { canvasId: state.project.id, intent: "migrate", schemaVersion: 4, expected, writes, migration: { expectedMode: "legacy", expectedBoundary: null, mode: "groups", boundary: { version: 1, opId: stamp.opId, seq: revision + 1 } } };
  applyGroupChange(state, change, stamp.actor, stamp.ts);
  return { type: "group.change", action: { kind: "apply", change } };
}

// packages/core/src/ops.ts
var INTERNAL_OP_TYPES = /* @__PURE__ */ new Set([
  "design.restore",
  "item.removeVersion",
  "item.restoreVersion",
  "comment.remove",
  "comment.restore",
  "thread.restore"
]);

// packages/core/src/badge.ts
var BADGE_COOKIE = "isocan_badge";
var BADGE_SCHEME = "Bearer";
function formatDotToken(id, secret) {
  return `${id}.${secret}`;
}
function parseDotToken(raw) {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return null;
  const id = raw.slice(0, dot);
  const secret = raw.slice(dot + 1);
  if (id.includes(".")) return null;
  return { id, secret };
}
function formatBadgeToken(badgeId, secret) {
  return formatDotToken(badgeId, secret);
}
function parseBadgeToken(raw) {
  const parsed = parseDotToken(raw);
  return parsed ? { badgeId: parsed.id, secret: parsed.secret } : null;
}
var DOOR_ROUTE = "/api/door";
async function askTheDoor(base2, timeoutMs = 1e4, signal) {
  try {
    const res = await fetch(`${base2}${DOOR_ROUTE}`, {
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
var BADGE_RESTART_HINT = "if this is an isocan CLI from before the door, `isocan restart` brings up this build's daemon";
var WS_NO_BADGE = 4401;
var WS_BAD_ORIGIN = 4403;
var WS_NO_CANVAS = 4404;
var BADGES_ROUTE = "/api/badges";
var badgeRoute = (badgeId) => `${BADGES_ROUTE}/${encodeURIComponent(badgeId)}`;
var NOT_YOUR_BADGE = "not-your-badge";
var AMBIGUOUS_HOME = "ambiguous-home";
var SHELF = "shelf";

// packages/core/src/grants.ts
function ownerOf(project, joined) {
  return resolveActor(joined, project.createdBy.id);
}
function ownsCanvas(project, actorId, joined) {
  return ownerOf(project, joined) === resolveActor(joined, actorId);
}
var RUNGS = ["view", "read", "edit", "own"];
function rungIndex(capability) {
  return RUNGS.indexOf(capability);
}
function atLeast(held, needed) {
  return rungIndex(held) >= rungIndex(needed);
}
function highest(a, b) {
  return rungIndex(a) >= rungIndex(b) ? a : b;
}
function isCapability(word) {
  return typeof word === "string" && RUNGS.includes(word);
}
function narrowed(capability) {
  return capability !== void 0 && capability !== "edit";
}
function capabilityOf(grant) {
  return grant.capability ?? "edit";
}
var capabilityWord = {
  dialog: {
    own: "Owner",
    edit: "Editor",
    read: "Canvas Viewer",
    view: "Presentation Viewer"
  },
  presence: {
    own: "editing",
    edit: "editing",
    read: "reading",
    view: "viewing"
  }
};
var LINK = "link";
function attestedKindOf(subject) {
  if (subject.startsWith("email:")) return "email";
  if (subject.startsWith("repo:")) return "repo";
  return null;
}
var GROUP_ID_PREFIX = "ppl";
function groupSubject(groupId) {
  return `group:${groupId}`;
}
function isGroupSubject(subject) {
  return typeof subject === "string" && subject.startsWith("group:");
}
function groupIdOf(subject) {
  return isGroupSubject(subject) ? subject.slice("group:".length) : null;
}
function scopeOf(grant) {
  return "spaceId" in grant ? { kind: "space", id: grant.spaceId } : { kind: "canvas", id: grant.canvasId };
}
function isSpaceGrant(grant) {
  return "spaceId" in grant;
}
function isBar(grant) {
  return grant.bars === true;
}
var GRANTED_BY_HOME = "home";
var GRANTED_BY_MIGRATION = "migration";
function grantSubjectRefusal(subject) {
  if (typeof subject !== "string" || subject === "") {
    return "a grant needs a subject \u2014 `link`, `email:<addr>`, `repo:<host>/<owner>/<name>` or `group:<id>`";
  }
  if (subject === LINK) return null;
  if (isGroupSubject(subject)) {
    const id = subject.slice("group:".length);
    if (!id.startsWith(`${GROUP_ID_PREFIX}_`) || id.length <= GROUP_ID_PREFIX.length + 1 || /\s/.test(id)) {
      return `not a group id: ${id} (a grant subject is \`group:${GROUP_ID_PREFIX}_\u2026\` \u2014 \`isocan group list\` shows the ids)`;
    }
    return null;
  }
  if (subject.startsWith("email:")) {
    const addr = subject.slice("email:".length);
    const at2 = addr.indexOf("@");
    if (at2 <= 0 || at2 === addr.length - 1 || /\s/.test(addr)) {
      return `not an email address: ${addr} (a grant subject is \`email:someone@example.com\`)`;
    }
    return null;
  }
  if (subject.startsWith("repo:")) {
    const parts = subject.slice("repo:".length).split("/");
    if (parts.length !== 3 || parts.some((part) => part === "" || /\s/.test(part))) {
      return `not a repo: ${subject.slice("repo:".length)} (a grant subject is \`repo:github.com/acme/widgets\`)`;
    }
    return null;
  }
  return `not a grant subject: ${subject} (expected \`link\`, \`email:<addr>\`, \`repo:<host>/<owner>/<name>\` or \`group:<id>\`)`;
}
function barSubjectRefusal(subject) {
  if (subject === LINK) {
    return "the link cannot be kept out \u2014 turn it off instead (`isocan share --link off`)";
  }
  if (isGroupSubject(subject)) {
    return "a group cannot be kept out \u2014 un-invite it instead";
  }
  return grantSubjectRefusal(subject);
}
function normalizeAttribute(attribute) {
  const trimmed = attribute.trim();
  return attestedKindOf(trimmed) ? trimmed.toLowerCase() : trimmed;
}
function normalizeSubject(subject) {
  return normalizeAttribute(subject);
}
function upsertAttestation(existing, attestation) {
  const row2 = {
    ...attestation,
    attribute: normalizeAttribute(attestation.attribute)
  };
  return [...(existing ?? []).filter((a) => a.attribute !== row2.attribute), row2];
}
function attestationSatisfying(subject, attestations) {
  if (subject === LINK || isGroupSubject(subject)) return null;
  const wanted = normalizeSubject(subject);
  return attestations.find((row2) => normalizeAttribute(row2.attribute) === wanted) ?? null;
}
function isLive(grant) {
  return grant.revokedAt === void 0;
}
var grantsRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/grants`;
var grantRoute = (canvasId, grantId) => `${grantsRoute(canvasId)}/${encodeURIComponent(grantId)}`;
var grantRevokeRoute = (canvasId, grantId, options = {}) => {
  const query = new URLSearchParams();
  if (options.actorId) query.set("actorId", options.actorId);
  if (options.bar) query.set("bar", "1");
  const route = grantRoute(canvasId, grantId);
  const tail = query.toString();
  return tail ? `${route}?${tail}` : route;
};
function ownsSpace(space, actorId) {
  return space.createdBy === actorId;
}
function isSpaceLive(space) {
  return space.deletedAt === void 0;
}
var SPACE_NAME_MAX = 80;
function spaceNameRefusal(name) {
  if (typeof name !== "string" || name.trim() === "") return "a space needs a name";
  if (name.trim().length > SPACE_NAME_MAX) {
    return `a space's name is at most ${SPACE_NAME_MAX} characters`;
  }
  if (/[\n\r]/.test(name)) return "a space's name is one line";
  return null;
}
function sameSpaceName(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
var SPACES_ROUTE = "/api/spaces";
var spaceRoute = (spaceId) => `${SPACES_ROUTE}/${encodeURIComponent(spaceId)}`;
var spaceCanvasRoute = (spaceId, canvasId) => `${spaceRoute(spaceId)}/canvases/${encodeURIComponent(canvasId)}`;
var spaceGrantsRoute = (spaceId) => `${spaceRoute(spaceId)}/grants`;
var spaceGrantRoute = (spaceId, grantId) => `${spaceGrantsRoute(spaceId)}/${encodeURIComponent(grantId)}`;
var spaceGrantRevokeRoute = (spaceId, grantId, options = {}) => {
  const query = new URLSearchParams();
  if (options.actorId) query.set("actorId", options.actorId);
  if (options.bar) query.set("bar", "1");
  const route = spaceGrantRoute(spaceId, grantId);
  const tail = query.toString();
  return tail ? `${route}?${tail}` : route;
};
var spaceLinkRoute = (spaceId) => `${spaceRoute(spaceId)}/link`;
var spaceActingRoute = (route, actorId) => actorId ? `${route}?${new URLSearchParams({ actorId }).toString()}` : route;
var SPACE_NOT_FOUND = "space-not-found";
var CANVAS_IN_SPACE = "canvas-in-space";
var BAD_SPACE = "bad-space";
var SPACE_NAME_TAKEN = "space-name-taken";
function ownsGroup(group, actorId) {
  return group.createdBy === actorId;
}
function isGroupLive(group) {
  return group.deletedAt === void 0;
}
var GROUP_NAME_MAX = SPACE_NAME_MAX;
function groupNameRefusal(name) {
  if (typeof name !== "string" || name.trim() === "") return "a group needs a name";
  if (name.trim().length > GROUP_NAME_MAX) {
    return `a group's name is at most ${GROUP_NAME_MAX} characters`;
  }
  if (/[\n\r]/.test(name)) return "a group's name is one line";
  return null;
}
var sameGroupName = sameSpaceName;
function groupMemberRefusal(attribute) {
  if (attribute === LINK) return "a group holds addresses, not the link \u2014 turn the link on instead";
  if (isGroupSubject(attribute)) return "a group holds addresses, not other groups";
  const refusal = grantSubjectRefusal(attribute);
  if (refusal) return refusal;
  return attestedKindOf(attribute) === null ? `not something a person can prove: ${String(attribute)} (a member is \`email:<addr>\` or \`repo:<host>/<owner>/<name>\`)` : null;
}
var GROUPS_ROUTE = "/api/groups";
var groupRoute = (groupId) => `${GROUPS_ROUTE}/${encodeURIComponent(groupId)}`;
var groupMemberRoute = (groupId, attribute) => `${groupRoute(groupId)}/members/${encodeURIComponent(attribute)}`;
function groupViewOf(group, forOwner) {
  return {
    id: group.id,
    name: group.name,
    createdBy: group.createdBy,
    at: group.at,
    size: group.members.length,
    ...forOwner ? { members: [...group.members] } : {},
    ...group.deletedAt !== void 0 ? { deletedAt: group.deletedAt } : {}
  };
}
var groupActingRoute = spaceActingRoute;
var GROUP_NOT_FOUND = "group-not-found";
var BAD_GROUP = "bad-group";
var GROUP_NAME_TAKEN = "group-name-taken";
var NOT_ADMITTED = "not-admitted";
var VIEW_ONLY = "view-only";
var WS_NOT_ADMITTED = 4402;
var WITHDRAWN = "withdrawn";

// packages/core/src/public.ts
function isGrantListingDecision(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row2 = value;
  return Object.keys(row2).every((key) => key === "listed" || key === "at" || key === "by") && typeof row2.listed === "boolean" && typeof row2.at === "string" && Number.isFinite(Date.parse(row2.at)) && typeof row2.by === "string" && row2.by.length > 0;
}
function canListGrant(grant) {
  return !isSpaceGrant(grant) && typeof grant.canvasId === "string" && grant.canvasId.length > 0 && isLive(grant) && grant.subject === LINK && !grant.bars && (grant.capability === "read" || grant.capability === "view");
}
function isListedGrant(grant) {
  return canListGrant(grant) && isGrantListingDecision(grant.listing) && grant.listing.listed;
}
var PUBLIC_CANVASES_ROUTE = "/api/public";
function publicListingRoute(canvasId, grantId) {
  return `/api/projects/${encodeURIComponent(canvasId)}/grants/${encodeURIComponent(grantId)}/listing`;
}

// packages/core/src/personal.ts
var SOURCE_POLICY_HEADER = "X-Isocan-Source-Policy";
function parseSourcePolicyHeader(value) {
  if (value.length > 4096) throw new Error("source policy is too large");
  const row2 = JSON.parse(value);
  if (!row2 || typeof row2 !== "object" || Array.isArray(row2) || Object.keys(row2).some((key) => key !== "policy" && key !== "expectedHome") || row2.expectedHome !== void 0 && (typeof row2.expectedHome !== "string" || !row2.expectedHome)) {
    throw new Error("invalid source policy");
  }
  const policy = row2.policy;
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) throw new Error("invalid source policy");
  if (policy.mode === "exclude" && Object.keys(policy).length === 1) {
    return Object.freeze({
      policy: Object.freeze({ mode: "exclude" }),
      ...typeof row2.expectedHome === "string" ? { expectedHome: row2.expectedHome } : {}
    });
  }
  if (policy.mode !== "direct" || Object.keys(policy).length !== 3 || typeof policy.actorId !== "string" || !policy.actorId || policy.actorId.length > 256 || policy.intent !== "read" && policy.intent !== "edit" && policy.intent !== "own") {
    throw new Error("invalid source policy");
  }
  return Object.freeze({
    policy: Object.freeze({ mode: "direct", actorId: policy.actorId, intent: policy.intent }),
    ...typeof row2.expectedHome === "string" ? { expectedHome: row2.expectedHome } : {}
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
var SOURCE_ACCESS_ROUTE = "/api/source-access";
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

// packages/core/src/passes.ts
var PASS_TTL_MS = 15 * 60 * 1e3;
function formatPassToken(passId, secret) {
  return formatDotToken(passId, secret);
}
function parsePassToken(raw) {
  const parsed = parseDotToken(raw);
  return parsed ? { passId: parsed.id, secret: parsed.secret } : null;
}
var passesRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/passes`;
var passRoute = (canvasId, passId) => `${passesRoute(canvasId)}/${encodeURIComponent(passId)}`;
var PASS_REDEEM_ROUTE = "/api/passes/redeem";
var PASS_MINTER_ENDED = "pass-minter-ended";
var PASS_UNKNOWN = "unknown-pass";
var PASS_SPENT = "pass-spent";
var PASS_EXPIRED = "pass-expired";
function passExpired(pass, now) {
  return Date.parse(now) >= Date.parse(pass.expiresAt);
}

// packages/core/src/emoji.ts
var e = (emoji, name, ...keywords) => ({
  emoji,
  name,
  keywords
});
var EMOJI_GROUPS = [
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
      e("\u{1F3D3}", "table tennis", "ping pong", "sport"),
      e("\u{1F3F8}", "badminton", "sport"),
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
var ALL_EMOJI = /* @__PURE__ */ EMOJI_GROUPS.flatMap((group) => group.entries);
function wordsOf(entry) {
  return [entry.name, ...entry.keywords].flatMap((text3) => text3.split(/[\s-]+/)).map((word) => word.toLowerCase());
}
function searchEmoji(query, limit = 48) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const scored = [];
  ALL_EMOJI.forEach((entry, at2) => {
    let score = 0;
    for (const term of terms) {
      const words = wordsOf(entry);
      const name = entry.name.toLowerCase();
      const nameWords = name.split(/[\s-]+/);
      const hit = words.some((word) => word.startsWith(term));
      if (!hit) return;
      if (name === term) score += 8;
      else if (words.includes(term)) score += 5;
      else if (name.startsWith(term)) score += 4;
      else if (nameWords.some((word) => word.startsWith(term))) score += 2;
      else score += 1;
    }
    scored.push({ entry, score, at: at2 });
  });
  return scored.sort((a, b) => b.score === a.score ? a.at - b.at : b.score - a.score).slice(0, limit).map((row2) => row2.entry);
}
function emojiName(emoji) {
  return ALL_EMOJI.find((entry) => entry.emoji === emoji)?.name ?? emoji;
}

// packages/core/src/reactions.ts
var QUICK_REACTIONS = ["\u{1F44D}", "\u{1F389}", "\u{1F440}", "\u{1F914}", "\u2764\uFE0F", "\u{1F525}", "\u{1F6A7}", "\u2705"];
function reactionPointsOf(item, emoji) {
  const wearing = new Set(item.reactions?.[emoji] ?? []);
  const points = item.reactionPoints?.[emoji] ?? {};
  return Object.entries(points).filter(([actorId]) => wearing.has(actorId)).map(([actorId, point]) => ({ actorId, x: point.x, y: point.y }));
}
function reactionsOf(item, selfId) {
  const entries = Object.entries(item.reactions ?? {});
  const out = entries.map(([emoji, actorIds]) => ({
    emoji,
    actorIds,
    count: actorIds.length,
    mine: selfId !== void 0 && actorIds.includes(selfId)
  }));
  return out.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}
function hasReacted(item, emoji, actorId) {
  return (item.reactions?.[emoji] ?? []).includes(actorId);
}
function reactionGroups(canvas) {
  const byEmoji = /* @__PURE__ */ new Map();
  const recent = Object.values(canvas.items).sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );
  for (const item of recent) {
    for (const emoji of Object.keys(item.reactions ?? {})) {
      const bucket = byEmoji.get(emoji);
      if (bucket) bucket.push(item);
      else byEmoji.set(emoji, [item]);
    }
  }
  return [...byEmoji.entries()].map(([emoji, items]) => ({ emoji, items, count: items.length })).sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}
function itemsWearing(canvas, emoji) {
  return reactionGroups(canvas).find((group) => group.emoji === emoji)?.items ?? [];
}

// packages/core/src/touches.ts
function itemsTouchedBy(op, canvas) {
  const anchorOf2 = (threadId) => {
    const anchor = canvas?.threads[threadId]?.anchorItemId;
    return anchor ? [anchor] : [];
  };
  switch (op.type) {
    case "design.decide":
      return [op.decision.basis.target.artifact.itemId, ...anchorOf2(op.threadId)];
    case "design.restore":
      return [op.effect.item.itemId, ...anchorOf2(op.effect.threadId)];
    case "design.repair":
      return [op.repair.target.artifact.itemId];
    case "design.compare":
    case "design.respond":
      return anchorOf2(op.threadId);
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
      return anchorOf2(op.threadId);
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

// packages/core/src/recap-window.ts
function touchedItems(entry) {
  if (entry.envelope.op.type === "group.change") return itemsTouchedBy(entry.envelope.op);
  const op = entry.envelope.op;
  if (op.itemId) return [op.itemId];
  if (op.itemIds) return op.itemIds;
  if (op.moves) return op.moves.map((move) => move.itemId);
  return [];
}
function summarizeRecapWindow(entries, canvas) {
  const first = entries[0];
  const last = entries[entries.length - 1];
  const actors = /* @__PURE__ */ new Map();
  const items = /* @__PURE__ */ new Map();
  let comments = 0;
  for (const entry of entries) {
    const op = entry.envelope.op;
    const who = entry.envelope.actor.name;
    actors.set(who, (actors.get(who) ?? 0) + 1);
    if (op.type === "thread.create" || op.type === "thread.reply" || op.type === "questionnaire.ask" || op.type === "questionnaire.answer") comments++;
    for (const id of touchedItems(entry)) {
      const row2 = items.get(id) ?? { title: null, ops: 0 };
      row2.ops++;
      const carried = op.title;
      if (carried && !row2.title) row2.title = carried;
      items.set(id, row2);
    }
  }
  for (const [id, row2] of items) {
    const live = canvas?.items[id];
    if (live) row2.title = live.title;
  }
  return {
    fromSeq: first.seq,
    toSeq: last.seq,
    fromTs: first.envelope.ts,
    toTs: last.envelope.ts,
    count: entries.length,
    actors: [...actors.entries()].map(([name, ops]) => ({ name, ops })).sort((a, b) => b.ops - a.ops || a.name.localeCompare(b.name)),
    comments,
    items: [...items.entries()].map(([id, row2]) => ({ id, ...row2 })).sort((a, b) => b.ops - a.ops || a.id.localeCompare(b.id))
  };
}

// packages/core/src/recap.ts
function buildRecap(entries, options = {}) {
  const verbatim = Math.max(0, options.verbatim ?? 10);
  const recent = verbatim > 0 ? entries.slice(-verbatim) : [];
  let older = entries.slice(0, entries.length - recent.length);
  const windows = [];
  let size = Math.max(1, verbatim) * 2;
  while (older.length > 0) {
    const take = older.length <= size * 2 ? older.length : size;
    windows.unshift(summarizeRecapWindow(older.slice(-take), options.canvas));
    older = older.slice(0, -take);
    size *= 2;
  }
  return {
    total: entries.length,
    archived: options.archived ?? 0,
    windows,
    recent
  };
}

// packages/core/src/recap-head.ts
var HEAD_OPERATIONS = 100;
var HEAD_ACTORS = 5;
var HEAD_ITEMS = 8;
var HEAD_LABEL_POINTS = 160;
function clipRecapLabel(value) {
  const points = Array.from(value);
  return { text: points.slice(0, HEAD_LABEL_POINTS).join(""), clipped: points.length > HEAD_LABEL_POINTS };
}
function sameRecord(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
  const a = left, b = right;
  const keys2 = Object.keys(a);
  return keys2.length === Object.keys(b).length && keys2.every((key) => Object.hasOwn(b, key) && sameRecord(a[key], b[key]));
}
function buildRecapHead(entries, canvas, revision) {
  if (!Number.isSafeInteger(revision) || revision < 1) return null;
  const bySeq = /* @__PURE__ */ new Map();
  const fromSeq = Math.max(1, revision - HEAD_OPERATIONS + 1);
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.seq) || entry.seq < 1 || entry.seq > revision) return null;
    const prior = bySeq.get(entry.seq);
    if (entry.seq >= fromSeq && prior && !sameRecord(prior, entry)) return null;
    bySeq.set(entry.seq, entry);
  }
  const recent = [];
  for (let seq = fromSeq; seq <= revision; seq++) {
    const entry = bySeq.get(seq);
    if (!entry) return null;
    recent.push(entry);
  }
  const window = summarizeRecapWindow(recent, canvas);
  const visible = window.items.filter(({ id }) => canvas.items[id] && !excludedInAmbient(canvas, canvas.items[id]));
  let clippedLabels = 0;
  const label = (value) => {
    const clipped = clipRecapLabel(value);
    if (clipped.clipped) clippedLabels++;
    return clipped.text;
  };
  return {
    fromSeq,
    toSeq: revision,
    fromTs: window.fromTs,
    toTs: window.toTs,
    count: recent.length,
    comments: window.comments,
    actors: window.actors.slice(0, HEAD_ACTORS).map(({ name, ops }) => ({ name: label(name), ops })),
    items: visible.slice(0, HEAD_ITEMS).map(({ id, ops }) => ({ id, title: label(canvas.items[id].title), ops })),
    omitted: {
      earlierAvailableOps: [...bySeq.keys()].filter((seq) => seq < fromSeq).length,
      actors: Math.max(0, window.actors.length - HEAD_ACTORS),
      items: Math.max(0, visible.length - HEAD_ITEMS),
      hiddenItems: window.items.length - visible.length,
      clippedLabels
    }
  };
}
function formatRecapHead(head) {
  const parts = [
    `seq ${head.fromSeq}\u2013${head.toSeq}: ${head.count} operations, ${head.comments} comments`,
    `${head.fromTs} \u2013 ${head.toTs}`
  ];
  if (head.actors.length) parts.push(`Active: ${head.actors.map((actor) => `${actor.name} (${actor.ops})`).join(", ")}`);
  if (head.items.length) parts.push(`Current items: ${head.items.map((item) => `${item.title} (${item.ops})`).join(", ")}`);
  const omitted = head.omitted;
  if (omitted.earlierAvailableOps) parts.push(`${omitted.earlierAvailableOps} earlier available operations outside this head`);
  if (omitted.actors) parts.push(`${omitted.actors} additional actor rows omitted`);
  if (omitted.items) parts.push(`${omitted.items} less-active current item rows omitted`);
  if (omitted.hiddenItems) parts.push(`${omitted.hiddenItems} removed or excluded item details omitted`);
  if (omitted.clippedLabels) parts.push(`${omitted.clippedLabels} labels clipped at ${HEAD_LABEL_POINTS} Unicode code points`);
  return parts.join("; ");
}
function recapHeadRoute(canvasId) {
  return `/api/projects/${encodeURIComponent(canvasId)}/context/recap`;
}

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
function findCommandSpans(body, known) {
  const verbs = [...known].sort((a, b) => b.length - a.length);
  const spans = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "/") continue;
    const startOfLine = i === 0 || body[i - 1] === "\n";
    if (!startOfLine) continue;
    const hit = verbs.find((verb) => {
      if (body.slice(i + 1, i + 1 + verb.length) !== verb) return false;
      const after = body[i + 1 + verb.length];
      return after === void 0 || after === " " || after === "\n";
    });
    if (!hit) continue;
    const end = i + 1 + hit.length;
    spans.push({ start: i, end, name: hit });
    i = end - 1;
  }
  return spans;
}
function extractMentions(body, candidates) {
  const mentioned = new Set(findMentionSpans(body, candidates).map((span2) => span2.actorId));
  const ids4 = [];
  for (const candidate of candidates) {
    if (mentioned.has(candidate.id) && !ids4.includes(candidate.id)) ids4.push(candidate.id);
  }
  return ids4;
}
function actorsAnswerTo(actors, names, joined) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (id, name) => {
    const key = `${id}\0${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id, name });
  };
  for (const actor of actors) add(resolveActor(joined, actor.id), actor.name);
  for (const actor of actors) {
    const now = names?.[actor.id];
    if (now) add(resolveActor(joined, actor.id), now);
  }
  return out;
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

// packages/core/src/activity.ts
function recentActivity(canvas, actorId, limit = 6) {
  const entries = [];
  for (const item of Object.values(canvas.items)) {
    if (item.createdBy.id === actorId) {
      entries.push({ kind: "made", at: item.createdAt, itemId: item.id, subject: item.title });
    }
    for (const version of item.versions.slice(1)) {
      if (version.createdBy.id !== actorId) continue;
      entries.push({ kind: "edited", at: version.createdAt, itemId: item.id, subject: item.title });
    }
  }
  for (const thread of Object.values(canvas.threads)) {
    const anchor = thread.anchorItemId ? canvas.items[thread.anchorItemId] : void 0;
    if (thread.anchorItemId && !anchor) continue;
    const subject = anchor ? anchor.title : thread.main ? "the main thread" : "the canvas";
    for (const comment of thread.comments) {
      if (comment.author.id !== actorId) continue;
      entries.push({
        kind: "said",
        at: comment.createdAt,
        threadId: thread.id,
        ...anchor ? { itemId: anchor.id } : {},
        subject,
        body: comment.body
      });
    }
  }
  return entries.sort((a, b) => a.at < b.at ? 1 : a.at > b.at ? -1 : 0).slice(0, limit);
}

// packages/core/src/roster.ts
var QUIET_AFTER_MS = 35e3;
function openAsk(thread) {
  for (let i = thread.comments.length - 1; i >= 0; i--) {
    const comment = thread.comments[i];
    if (comment.design) continue;
    if (thread.comments.some((later) => later.designLegacySource?.threadId === thread.id && later.designLegacySource.commentId === comment.id)) continue;
    const match = comment.body.match(/^\/ask\b\s*([\s\S]*)$/);
    if (match) {
      const answered = !parseLegacyQuestionnaire(comment.body) && thread.comments.slice(i + 1).some((later) => later.author.id !== comment.author.id);
      return answered ? null : {
        threadId: thread.id,
        commentId: comment.id,
        askerId: comment.author.id,
        body: match[1].trim()
      };
    }
  }
  return null;
}
function openAsks(canvas) {
  const open = [];
  const typed = questionnaireStates(canvas);
  for (const thread of Object.values(canvas.threads)) {
    const ask = openAsk(thread);
    if (ask && !typed.some((row2) => row2.legacySource?.threadId === ask.threadId && row2.legacySource.commentId === ask.commentId)) open.push(ask);
  }
  open.push(...typed.filter((row2) => row2.status === "open").map((row2) => ({ threadId: row2.source.threadId, commentId: row2.source.commentId, askerId: row2.author.id, body: row2.questions.headline })));
  return open.reverse();
}
function sessionState(session, canvas, nowMs) {
  if (canvas && openAsks(canvas).some((ask) => ask.askerId === session.actor.id)) {
    return "blocked";
  }
  if (session.activity != null) return "working";
  if (session.statusSource === "lifecycle" && session.status !== null) return "parked";
  if (session.kind === "cli" && nowMs - Date.parse(session.lastSeen) >= QUIET_AFTER_MS) {
    return "quiet";
  }
  return "here";
}
var AWAY_ROWS = 6;
function roster(sessions, canvas, nowMs, answerable) {
  const byActor = /* @__PURE__ */ new Map();
  for (const session of sessions) {
    const held = byActor.get(session.actor.id);
    if (held) held.push(session);
    else byActor.set(session.actor.id, [session]);
  }
  const live = [];
  for (const [actorId, held] of byActor) {
    const clis = held.filter((s) => s.kind === "cli").sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
    const primary = clis[0];
    if (!primary) continue;
    live.push({
      actorId,
      name: primary.label ?? primary.actor.name,
      state: sessionState(primary, canvas, nowMs),
      primary,
      others: held.filter((s) => s !== primary),
      harness: primary.harness ?? null,
      lastAct: canvas ? recentActivity(canvas, actorId, 1)[0] ?? null : null
    });
  }
  const ORDER = {
    blocked: 0,
    working: 1,
    parked: 2,
    quiet: 3,
    here: 4,
    answerable: 5,
    enrolled: 6,
    away: 7
  };
  live.sort((a, b) => {
    if (ORDER[a.state] !== ORDER[b.state]) return ORDER[a.state] - ORDER[b.state];
    const seen = (b.primary?.lastSeen ?? "").localeCompare(a.primary?.lastSeen ?? "");
    return seen !== 0 ? seen : a.actorId.localeCompare(b.actorId);
  });
  if (!canvas) return live;
  const enrolled = [];
  for (const record2 of Object.values(canvas.agents ?? {})) {
    if (byActor.has(record2.actor.id)) continue;
    enrolled.push({
      actorId: record2.actor.id,
      name: record2.actor.name,
      state: answerable?.has(record2.actor.id) ? "answerable" : "enrolled",
      primary: null,
      others: [],
      harness: null,
      lastAct: recentActivity(canvas, record2.actor.id, 1)[0] ?? null
    });
  }
  enrolled.sort((a, b) => a.name.localeCompare(b.name));
  const away = [];
  for (const actor of collectCanvasActors(canvas)) {
    if (byActor.has(actor.id)) continue;
    if (canvas.agents?.[actor.id]) continue;
    const lastAct = recentActivity(canvas, actor.id, 1)[0];
    if (!lastAct) continue;
    away.push({
      actorId: actor.id,
      name: actor.name,
      state: "away",
      primary: null,
      others: [],
      harness: null,
      lastAct
    });
  }
  away.sort((a, b) => (b.lastAct?.at ?? "").localeCompare(a.lastAct?.at ?? ""));
  return [...live, ...enrolled, ...away.slice(0, AWAY_ROWS)];
}
function answeringExcerpt(canvas, session) {
  const threadId = session.onThread;
  if (!threadId) return null;
  const last = canvas.threads[threadId]?.comments.at(-1);
  return last ? { threadId, body: last.body } : null;
}

// node_modules/nanoid/index.js
import { webcrypto as crypto2 } from "node:crypto";

// node_modules/nanoid/url-alphabet/index.js
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// node_modules/nanoid/index.js
var POOL_SIZE_MULTIPLIER = 128;
var pool;
var poolOffset;
function fillPool(bytes) {
  if (bytes < 0) throw new RangeError("Wrong ID size");
  try {
    if (!pool || pool.length < bytes) {
      pool = Buffer.allocUnsafe(bytes * POOL_SIZE_MULTIPLIER);
      crypto2.getRandomValues(pool);
      poolOffset = 0;
    } else if (poolOffset + bytes > pool.length) {
      crypto2.getRandomValues(pool);
      poolOffset = 0;
    }
  } catch (e2) {
    pool = void 0;
    throw e2;
  }
  poolOffset += bytes;
}
function nanoid(size = 21) {
  fillPool(size |= 0);
  let id = "";
  for (let i = poolOffset - size; i < poolOffset; i++) {
    id += urlAlphabet[pool[i] & 63];
  }
  return id;
}

// packages/core/src/ids.ts
function newId(prefix) {
  return `${prefix}_${nanoid(10)}`;
}
var newCanvasId = () => newId("prj");
var newItemId = () => newId("itm");
var newVersionId = () => newId("ver");
var newThreadId = () => newId("thr");
var newCommentId = () => newId("cmt");
var newOpId = () => newId("op");
var newGroupId = () => newId("grp");
var isOpId = (value) => typeof value === "string" && /^op_[A-Za-z0-9_-]{6,32}$/.test(value);
var newActorId = () => newId("usr");
var newClientId = () => newId("cli");

// packages/core/src/claims.ts
var emptyActorRegistry = () => ({
  names: {},
  colors: {},
  marks: {},
  joined: {},
  harnesses: {}
});
var PERSON_HARNESSES = /* @__PURE__ */ new Set(["web", "home", "cli", "person"]);
var isAgentHarness = (harness) => harness !== null && harness !== void 0 && harness !== "" && !PERSON_HARNESSES.has(harness.toLowerCase());
function actorKinds(registry) {
  const kinds = {};
  for (const [id, harness] of Object.entries(registry.harnesses ?? {})) {
    if (isAgentHarness(harness)) kinds[resolveActor(registry.joined, id)] = "agent";
  }
  return kinds;
}
var INITIAL_NAMES = {
  a: ["Ada", "Arlo", "Anya", "Amos", "Aziz", "Alba", "Ansel", "Ari"],
  b: ["Bo", "Bram", "Bea", "Bodhi", "Basil", "Bex", "Boaz", "Bree"],
  c: ["Charlie", "Cass", "Cleo", "Cyrus", "Coral", "Caleb", "Cato", "Ciri"],
  d: ["Dara", "Dov", "Della", "Dex", "Duna", "Dmitri", "Dot", "Devi"],
  e: ["Esme", "Ewan", "Elu", "Ezra", "Effie", "Enzo", "Eira", "Emrys"],
  f: ["Fen", "Faye", "Flor", "Felix", "Fiora", "Fitz", "Freya", "Fox"],
  g: ["Gina", "Gus", "Gale", "Greta", "Gideon", "Goro", "Gwen", "Gil"],
  h: ["Hana", "Hugo", "Hale", "Hester", "Hiro", "Hopper", "Hedy", "Halcyon"],
  i: ["Ines", "Ivo", "Isla", "Idris", "Ilse", "Iggy", "Ione", "Ilya"],
  j: ["Juno", "Jai", "Jess", "Jonah", "Jade", "Joss", "Juniper", "Jules"],
  k: ["Kit", "Kai", "Kira", "Knox", "Kesh", "Kova", "Kaya", "Kepler"],
  l: ["Lore", "Luca", "Liv", "Lyra", "Linus", "Lark", "Leif", "Lumen"],
  m: ["Mira", "Milo", "Mae", "Marlow", "Mika", "Moss", "Maren", "Mordecai"],
  n: ["Noor", "Nils", "Nell", "Nova", "Nyx", "Nero", "Nadia", "Niko"],
  o: ["Orin", "Ola", "Odie", "Otis", "Oona", "Osric", "Opal", "Oren"],
  p: ["Pip", "Pax", "Posy", "Perrin", "Piper", "Prue", "Pascal", "Poe"],
  q: ["Quinn", "Quill", "Qi", "Quest", "Quenna", "Quade", "Qadir", "Quincy"],
  r: ["Remy", "Rue", "Ro", "Rowan", "Rex", "Reva", "Rafi", "Ridley"],
  s: ["Sage", "Soren", "Sol", "Sable", "Sunny", "Sasha", "Sig", "Selah"],
  t: ["Tess", "Thea", "Toma", "Tobin", "Tully", "Tarek", "Tamsin", "Tycho"],
  u: ["Uma", "Uri", "Udo", "Ulla", "Umber", "Unwin", "Ursa", "Usha"],
  v: ["Vera", "Vik", "Vale", "Vesper", "Vida", "Volt", "Verity", "Viggo"],
  w: ["Wren", "Wes", "Willa", "Wilder", "Wynn", "Wade", "Wanda", "Wolfe"],
  x: ["Xan", "Xia", "Xola", "Xeno", "Ximena", "Xerxes", "Xanthe", "Xu"],
  y: ["Yuki", "Yael", "Yann", "Yara", "Yves", "Yusuf", "Yorick", "Yumi"],
  z: ["Zia", "Zed", "Zoe", "Zane", "Zora", "Zeph", "Zuri", "Zamir"]
};
function hashOf(text3) {
  let h = 2166136261;
  for (let i = 0; i < text3.length; i++) {
    h ^= text3.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function firstFree(roster2, taken, seed) {
  const start = roster2.length > 0 ? hashOf(seed) % roster2.length : 0;
  for (let i = 0; i < roster2.length; i++) {
    const name = roster2[(start + i) % roster2.length];
    if (!taken.has(name.toLowerCase())) return name;
  }
  return null;
}
function harnessOf(sessionKey) {
  const harness = sessionKey?.split(":")[0]?.trim();
  return harness ? harness : null;
}
var ISOCAN_NAMES = [
  "Isaac",
  "Kenny",
  "Nico",
  "Sonia",
  "Iona",
  "Osian",
  "Isao",
  "Cana"
];
var FREE_NAME_ROUTE = "/api/actors/free-name";
var CLAIM_STANDS_MS = 30 * 60 * 1e3;
function applyClaim(ctx, op) {
  const mint = ctx.mintId ?? newActorId;
  const own2 = ctx.own;
  const shelved = ctx.shelved;
  const claimed = own2.find((row2) => row2.sessionKey === op.sessionKey);
  const mine = claimed ?? shelved;
  const adopted = !claimed && shelved ? op.sessionKey : void 0;
  const settle2 = (actor) => ({
    registry: bindName(ctx.registry, { actor, ts: ctx.now, sessionKey: op.sessionKey }),
    actor,
    claims: bindClaim(own2, { actor, ts: ctx.now, op }),
    ...adopted !== void 0 ? { adopted } : {}
  });
  if (op.as) {
    if (op.fresh) {
      throw new OpValidationError("bad-op", "`as` resumes an existing actor; `fresh` mints a new one \u2014 pick one");
    }
    return settle2(reincarnate(ctx, op, op.as, mine));
  }
  if (op.fresh) {
    return settle2({ id: mint(), name: op.name ?? allocateName(ctx, op.sessionKey) });
  }
  if (!op.name) {
    if (mine) return settle2({ id: mine.actorId, name: nameOf(ctx, mine.actorId) });
    return settle2({ id: mint(), name: allocateName(ctx, op.sessionKey) });
  }
  if (mine) {
    if (!sameName(nameOf(ctx, mine.actorId), op.name)) requireFree(ctx, op, mine.actorId);
    return settle2({ id: mine.actorId, name: op.name });
  }
  requireFree(ctx, op, void 0);
  return settle2({ id: mint(), name: op.name });
}
function bindName(registry, envelope) {
  const { actor, ts, sessionKey } = envelope;
  const harness = harnessOf(sessionKey);
  const withHarness = harness && harness.toLowerCase() !== "replica" ? { ...registry, harnesses: { ...registry.harnesses ?? {}, [actor.id]: harness } } : registry;
  const current2 = registry.names[actor.id];
  if (current2 && current2.at > ts) return withHarness;
  return { ...withHarness, names: { ...registry.names, [actor.id]: { name: actor.name, at: ts } } };
}
function bindClaim(claims, envelope) {
  const { actor, ts, op } = envelope;
  const kept = claims.filter(
    (row2) => row2.actorId !== actor.id && row2.sessionKey !== op.sessionKey
  );
  kept.push({
    actorId: actor.id,
    boundAt: ts,
    sessionKey: op.sessionKey,
    ...op.canvasId !== void 0 ? { canvasId: op.canvasId } : {}
  });
  return kept;
}
function bindHandoff(claims, envelope) {
  const { actor, ts, canvasId } = envelope;
  return [
    ...claims.filter((row2) => row2.actorId !== actor.id),
    { actorId: actor.id, boundAt: ts, ...canvasId !== void 0 ? { canvasId } : {} }
  ];
}
function claimsActor(claims, actorId) {
  return claims.some((row2) => row2.actorId === actorId);
}
function notYourActor(actorId) {
  return new OpValidationError(
    "not-your-actor",
    `this badge does not speak for ${actorId} \u2014 claim that actor first (\`isocan identity --session\`, or the web app's identity dialog); \`--as <actor id>\` is how a holder that lost its badge comes back, and since phase 9 it needs a vouch when another surface still speaks as them \u2014 a pass from that surface, or the address they signed in with`
  );
}
function applyActorColor(registry, op) {
  if (op.color !== null && !isIdentityColor(op.color)) {
    throw new OpValidationError("bad-op", `not a color: ${op.color}`);
  }
  const colors = { ...registry.colors };
  if (op.color === null) delete colors[op.actorId];
  else colors[op.actorId] = op.color;
  return { ...registry, colors };
}
function applyActorMark(registry, op) {
  if (op.mark !== null && !isFaceMark(op.mark)) {
    throw new OpValidationError("bad-op", `not a single emoji: ${JSON.stringify(op.mark)}`);
  }
  const marks = { ...registry.marks ?? {} };
  if (op.mark === null) delete marks[op.actorId];
  else marks[op.actorId] = op.mark;
  return { ...registry, marks };
}
function applyActorJoin(registry, op) {
  const { from, into } = op;
  if (from === into) {
    throw new OpValidationError("bad-join", `${from} cannot be folded into itself`);
  }
  for (const id of [from, into]) {
    if (!registry.names[id]) {
      throw new OpValidationError("unknown-actor", `no actor ${id} is known here`);
    }
  }
  const joined = registry.joined ?? {};
  if (joined[from] !== void 0) {
    throw new OpValidationError(
      "bad-join",
      `${from} is already folded into ${resolveActor(joined, from)}`
    );
  }
  if (resolveActor(joined, into) === from) {
    throw new OpValidationError(
      "bad-join",
      `${into} already resolves to ${from} \u2014 folding ${from} into it would close a cycle`
    );
  }
  return { ...registry, joined: { ...joined, [from]: into } };
}
function notBothActors(from, into, missing2) {
  return new OpValidationError(
    "bad-join",
    `this badge does not speak for ${missing2} \u2014 folding ${from} into ${into} needs a badge that is both. Prove the address they signed in with (the web app's identity menu), or \`isocan identity --as <actor id>\` with a vouch, then fold.`
  );
}
function actorJoins(registry) {
  return { ...registry.joined ?? {} };
}
function actorMarks(registry) {
  const marks = { ...registry.marks ?? {} };
  for (const from of Object.keys(registry.joined ?? {})) {
    const mark = marks[resolveActor(registry.joined, from)];
    if (mark) marks[from] = mark;
    else delete marks[from];
  }
  return marks;
}
function actorColors(registry) {
  const colors = { ...registry.colors };
  for (const from of Object.keys(registry.joined ?? {})) {
    colors[from] = actorColor(resolveActor(registry.joined, from), registry.colors);
  }
  return colors;
}
function actorNames(registry) {
  const names = {};
  for (const [actorId, row2] of Object.entries(registry.names)) names[actorId] = row2.name;
  for (const from of Object.keys(registry.joined ?? {})) {
    const name = registry.names[resolveActor(registry.joined, from)]?.name;
    if (name) names[from] = name;
  }
  return names;
}
function reincarnate(ctx, op, as, mine) {
  const registered = ctx.registry.names[as];
  const known = registered ? { id: as, name: registered.name } : ctx.held.find((holder) => holder.actor.id === as)?.actor;
  if (!known && !op.name) {
    throw new OpValidationError(
      "unknown-actor",
      `no actor ${as} is known here \u2014 pass a name to bring one in from elsewhere`
    );
  }
  const vouched = handedRow(ctx, as, mine) || ctx.vouchedBy !== void 0;
  return admit(ctx, op, as, known, vouched);
}
var CLAIM_REFUSAL = {
  heldElsewhere: "held-elsewhere",
  claimedJustNow: "claimed-just-now",
  live: "live"
};
function admit(ctx, op, as, known, vouched) {
  const wornLive = !vouched && ctx.held.some((h) => h.live && h.actor.id === as);
  const heldElsewhere = !vouched && ctx.heldElsewhere === true;
  const otherSession = !vouched && ctx.claimants.some(
    (row2) => row2.sessionKey !== op.sessionKey && row2.actorId === as && Date.parse(ctx.now) - Date.parse(row2.boundAt) < CLAIM_STANDS_MS
  );
  if (wornLive || heldElsewhere || otherSession) {
    throw new OpValidationError(
      "name-taken",
      `${as} is somebody else here (${heldElsewhere ? "another surface already speaks as them" : wornLive ? "live on a canvas" : "claimed by another session just now"}) \u2014 becoming them would be one actor wearing two faces. Be handed it by a surface that already is them (\`isocan pass\`, or \u201CBring your own agent\u2026\u201D), or prove the address they signed in with.`,
      heldElsewhere ? CLAIM_REFUSAL.heldElsewhere : wornLive ? CLAIM_REFUSAL.live : CLAIM_REFUSAL.claimedJustNow
    );
  }
  const name = op.name ?? known.name;
  if (op.name && !sameName(known?.name ?? "", op.name)) requireFree(ctx, op, as);
  return { id: as, name };
}
function handedRow(ctx, as, mine) {
  return mine?.actorId === as || ctx.own.some((row2) => row2.actorId === as && row2.sessionKey === void 0);
}
function requireFree(ctx, op, selfId) {
  const name = op.name;
  const holder = ctx.held.find(
    (h) => sameName(h.actor.name, name) && h.actor.id !== selfId && !folded(ctx, h.actor.id)
  );
  const bound = ctx.scoped.find(
    (row2) => row2.sessionKey !== op.sessionKey && row2.actorId !== selfId && !folded(ctx, row2.actorId) && sameName(nameOf(ctx, row2.actorId), name)
  );
  if (!holder && !bound) return;
  const takenBy = holder?.actor.id ?? bound.actorId;
  const where = holder ? `${holder.actor.id}, ${holder.live ? "on" : "known to"} "${holder.canvas}"` : `${bound.actorId}, claimed by another session`;
  throw new OpValidationError(
    "name-taken",
    `"${name}" is taken here (${where}) \u2014 @${name} would reach both of you. Pick another name, or claim without one to be handed a free one; \`--as ${takenBy}\` if you are ${name} returning from a lost session, or \`--new\` to be a second ${name} on purpose.`
  );
}
function allocateName(ctx, sessionKey) {
  const taken = /* @__PURE__ */ new Set();
  for (const holder of ctx.held) {
    if (!folded(ctx, holder.actor.id)) taken.add(holder.actor.name.trim().toLowerCase());
  }
  for (const row2 of ctx.scoped) {
    if (!folded(ctx, row2.actorId)) taken.add(nameOf(ctx, row2.actorId).trim().toLowerCase());
  }
  const preferred = ctx.preferred?.trim();
  if (preferred && !taken.has(preferred.toLowerCase())) return preferred;
  const seed = sessionKey?.trim() || "";
  const initial = harnessOf(sessionKey ?? void 0)?.toLowerCase()[0];
  const byLetter = initial && INITIAL_NAMES[initial] || [];
  const lettered = firstFree(byLetter, taken, seed);
  if (lettered) return lettered;
  const roster2 = firstFree(ISOCAN_NAMES, taken, seed);
  if (roster2) return roster2;
  for (let round3 = 2; ; round3++) {
    for (const base2 of ISOCAN_NAMES) {
      const name = `${base2} ${round3}`;
      if (!taken.has(name.toLowerCase())) return name;
    }
  }
}
function nameOf(ctx, actorId) {
  return ctx.registry.names[actorId]?.name ?? "";
}
function folded(ctx, actorId) {
  return resolveActor(ctx.registry.joined, actorId) !== actorId;
}
function sameName(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// packages/core/src/invert.ts
function invertOperation(stateBefore, op) {
  if (op.type === "project.create") {
    return null;
  }
  if (stateBefore === null) {
    throw new OpValidationError("bad-op", `${op.type} on missing canvas`);
  }
  const { project, canvas } = stateBefore;
  const getItem = (itemId) => {
    const item = canvas.items[itemId];
    if (!item) throw new OpValidationError("unknown-item", `unknown item: ${itemId}`);
    return item;
  };
  switch (op.type) {
    case "design.repair":
      if (!op.effect) throw new OpValidationError("bad-op", "resolve repair before inversion");
      return invertOperation(stateBefore, op.effect);
    case "design.compare":
    case "design.respond":
      return { type: "comment.remove", threadId: op.threadId, commentId: op.commentId };
    case "design.decide": {
      if (!op.effect) throw new OpValidationError("bad-op", "resolve adoption before inversion");
      const inverse = invertOperation(stateBefore, op.effect.edit);
      if (inverse?.type !== "item.removeVersion") throw new OpValidationError("bad-op", "invalid adoption inverse");
      const record2 = op.effect.comment.designDecision?.record;
      if (record2?.kind !== "adoption-decision") throw new OpValidationError("bad-op", "missing canonical adoption");
      return { type: "design.restore", effect: { target: { ...op.decision.basis.target, artifact: record2.adopted }, item: inverse, threadId: op.threadId, commentId: op.commentId, expectedComment: op.effect.comment, comment: null } };
    }
    case "design.restore": {
      const e2 = op.effect, item = getItem(e2.item.itemId), inverse = invertOperation(stateBefore, e2.item);
      if (inverse?.type !== "item.removeVersion" && inverse?.type !== "item.restoreVersion") throw new OpValidationError("bad-op", "invalid paired inverse");
      const change = e2.item;
      const version = change.type === "item.removeVersion" ? item.versions.find((v) => v.id === change.prevCurrentVersionId) : change.version;
      return { type: "design.restore", effect: { target: { artifact: { ...e2.target.artifact, versionId: version.id, blobHash: version.blobHash }, title: item.title, description: item.description, properties: structuredClone(item.properties), scope: currentDesignScope(canvas, item) }, item: inverse, threadId: e2.threadId, commentId: e2.commentId, expectedComment: e2.comment, comment: e2.expectedComment } };
    }
    case "design.request":
    case "design.receipt":
      if (!op.effect) throw new OpValidationError("bad-op", "resolve design intent before inversion");
      return invertOperation(stateBefore, op.effect);
    case "group.change":
      if (op.action.kind !== "apply") throw new OpValidationError("bad-op", "resolve group intent before inversion");
      return { type: "group.change", action: { kind: "apply", change: invertGroupChange(stateBefore, op.action.change) } };
    case "actor.claim":
    case "actor.setColor":
    case "actor.setMark":
    case "actor.join":
      return null;
    // home-scoped and never undoable; never reaches a canvas
    case "agent.enroll":
    case "agent.invite":
    case "agent.withdraw":
      return null;
    case "project.update":
      return { type: "project.update", patch: invertMetaPatch(project, op.patch) };
    case "project.delete":
      return null;
    case "item.add":
      return { type: "item.delete", itemId: op.itemId };
    case "item.move": {
      const { x, y } = getItem(op.itemId);
      return { type: "item.move", itemId: op.itemId, x, y };
    }
    case "item.resize": {
      const { width, height } = getItem(op.itemId);
      return { type: "item.resize", itemId: op.itemId, width, height };
    }
    case "item.react":
      return { type: "item.react", itemId: op.itemId, emoji: op.emoji, on: !op.on };
    case "item.update": {
      const item = getItem(op.itemId);
      const current2 = item.versions.find((version) => version.id === item.currentVersionId);
      return {
        type: "item.update",
        itemId: op.itemId,
        patch: invertMetaPatch(item, op.patch),
        // Undoing a rename puts the file back under its old name.
        ...op.filename !== void 0 && current2 ? { filename: current2.filename } : {}
      };
    }
    case "item.edit":
    case "item.addVersion":
      return {
        type: "item.removeVersion",
        itemId: op.itemId,
        versionId: op.version.id,
        prevCurrentVersionId: getItem(op.itemId).currentVersionId,
        ...op.type === "item.edit" ? { patch: invertMetaPatch(getItem(op.itemId), op.patch) } : {}
      };
    case "item.setCurrentVersion":
      return {
        type: "item.setCurrentVersion",
        itemId: op.itemId,
        versionId: getItem(op.itemId).currentVersionId
      };
    case "item.removeVersion": {
      const item = getItem(op.itemId);
      const version = item.versions.find((v) => v.id === op.versionId);
      if (!version) {
        throw new OpValidationError("unknown-version", `unknown version: ${op.versionId}`);
      }
      return {
        type: "item.restoreVersion",
        itemId: op.itemId,
        version,
        ...op.patch ? { patch: invertMetaPatch(item, op.patch) } : {}
      };
    }
    case "item.restoreVersion":
      return {
        type: "item.removeVersion",
        itemId: op.itemId,
        versionId: op.version.id,
        prevCurrentVersionId: getItem(op.itemId).currentVersionId,
        ...op.patch ? { patch: invertMetaPatch(getItem(op.itemId), op.patch) } : {}
      };
    case "item.delete":
      return { type: "item.restore", itemId: op.itemId };
    case "item.restore":
      return { type: "item.delete", itemId: op.itemId };
    case "items.move":
      return {
        type: "items.move",
        moves: op.moves.map((move) => {
          const { x, y } = getItem(move.itemId);
          return { itemId: move.itemId, x, y };
        })
      };
    case "items.delete":
      return { type: "items.restore", itemIds: op.itemIds };
    case "items.restore":
      return { type: "items.delete", itemIds: op.itemIds };
    case "trash.empty":
    case "item.pruneVersions":
      return null;
    case "thread.create":
      return { type: "thread.delete", threadId: op.threadId };
    case "thread.reply":
      return { type: "comment.remove", threadId: op.threadId, commentId: op.comment.id };
    case "questionnaire.ask":
    case "questionnaire.answer":
      return { type: "comment.remove", threadId: op.threadId, commentId: op.commentId };
    case "thread.setMain": {
      if (op.threadId !== null && !canvas.threads[op.threadId]) {
        throw new OpValidationError("unknown-thread", `unknown thread: ${op.threadId}`);
      }
      const prev = Object.values(canvas.threads).find((t) => t.main);
      return { type: "thread.setMain", threadId: prev?.id ?? null };
    }
    case "thread.setAnchor": {
      const thread = canvas.threads[op.threadId];
      if (!thread) throw new OpValidationError("unknown-thread", `unknown thread: ${op.threadId}`);
      return {
        type: "thread.setAnchor",
        threadId: op.threadId,
        anchorItemId: thread.anchorItemId,
        ...thread.textAnchor ? { textAnchor: thread.textAnchor } : {},
        x: thread.x,
        y: thread.y
      };
    }
    case "comment.update": {
      const thread = canvas.threads[op.threadId];
      const existing = thread?.comments.find((c) => c.id === op.commentId);
      if (!existing) {
        throw new OpValidationError("unknown-comment", `unknown comment: ${op.commentId}`);
      }
      return {
        type: "comment.update",
        threadId: op.threadId,
        commentId: op.commentId,
        body: existing.body,
        ...existing.mentions ? { mentions: existing.mentions } : {},
        ...existing.items ? { items: existing.items } : {},
        ...op.context !== void 0 ? { context: existing.context ?? null } : {}
      };
    }
    case "comment.remove": {
      const thread = canvas.threads[op.threadId];
      if (!thread) throw new OpValidationError("unknown-thread", `unknown thread: ${op.threadId}`);
      const comment = thread.comments.find((c) => c.id === op.commentId);
      if (!comment) {
        throw new OpValidationError("unknown-comment", `unknown comment: ${op.commentId}`);
      }
      return { type: "comment.restore", threadId: op.threadId, comment };
    }
    case "comment.restore":
      return { type: "comment.remove", threadId: op.threadId, commentId: op.comment.id };
    case "thread.delete": {
      const thread = canvas.threads[op.threadId];
      if (!thread) throw new OpValidationError("unknown-thread", `unknown thread: ${op.threadId}`);
      return { type: "thread.restore", thread };
    }
    case "thread.restore":
      return { type: "thread.delete", threadId: op.thread.id };
    default:
      return unknownOperation(op);
  }
}
function invertMetaPatch(prev, patch) {
  const inverse = {};
  if (patch.title !== void 0) inverse.title = prev.title;
  if (patch.description !== void 0) inverse.description = prev.description;
  const restore = {};
  const removeAdded = [];
  for (const key of Object.keys(patch.properties ?? {})) {
    const prevValue = prev.properties[key];
    if (prevValue !== void 0) restore[key] = prevValue;
    else removeAdded.push(key);
  }
  for (const key of patch.removeProperties ?? []) {
    const prevValue = prev.properties[key];
    if (prevValue !== void 0) restore[key] = prevValue;
  }
  if (Object.keys(restore).length > 0) inverse.properties = restore;
  if (removeAdded.length > 0) inverse.removeProperties = removeAdded;
  return inverse;
}

// packages/core/src/canvas-group-create.ts
function preparedGroupCreation(canvasId, items, at2) {
  const ids4 = new Set(items.map((item) => item.id));
  return { type: "group.change", action: {
    kind: "copy",
    sourceCanvasId: canvasId,
    items,
    rootIds: items.filter((item) => !item.containerId || !ids4.has(item.containerId)).map((item) => item.id),
    at: at2,
    groupPlacement: "preserve"
  } };
}

// packages/core/src/bench.ts
var AGENT_KIND = "agent";
var AGENT_ACTOR_PROP = "actorId";
var AGENT_HARNESS_PROP = "harness";
var AGENT_RUNS_AT_PROP = "runsAt";
var BENCH_ITEM_FILENAME = "agent.md";
var BENCH_ITEM_SIZE = { width: 320, height: 180 };
var BENCH_PER_ROW = 4;
var BENCH_GAP = 40;
var BENCH_REACH = ["ready", "elsewhere", "unreachable"];
var ANSWERING = /* @__PURE__ */ new Set(["parked", "answerable"]);
function isAgentItem(item) {
  return item.properties.kind === AGENT_KIND;
}
function benchAgentOf(item) {
  if (!isAgentItem(item)) return null;
  const actorId = item.properties[AGENT_ACTOR_PROP];
  if (!actorId) return null;
  return {
    itemId: item.id,
    name: item.title || actorId,
    actorId,
    harness: item.properties[AGENT_HARNESS_PROP] ?? null,
    runsAt: item.properties[AGENT_RUNS_AT_PROP] ?? null
  };
}
function benchAgents(canvas) {
  return Object.values(canvas.items).map(benchAgentOf).filter((agent) => agent !== null).sort((a, b) => a.name.localeCompare(b.name));
}
function benchItemOf(name, agent) {
  const properties = { kind: AGENT_KIND, [AGENT_ACTOR_PROP]: agent.actorId };
  if (agent.harness) properties[AGENT_HARNESS_PROP] = agent.harness;
  if (agent.runsAt) properties[AGENT_RUNS_AT_PROP] = agent.runsAt;
  const lines = [
    `# ${name}`,
    "",
    `- actor: ${agent.actorId}`,
    `- harness: ${agent.harness ?? "unsaid"}`,
    `- runs at: ${agent.runsAt ?? "unsaid"}`,
    "",
    "A bench row is a record. It grants no standing and no reach."
  ];
  return {
    properties,
    blob: `${lines.join("\n")}
`,
    mimeType: "text/markdown",
    filename: BENCH_ITEM_FILENAME
  };
}
function benchWriteFor(canvas, agent, explicit) {
  const rows = benchAgents(canvas);
  const already = rows.find((row2) => row2.actorId === agent.actorId);
  if (!already) {
    const at2 = rows.length;
    return {
      kind: "add",
      x: at2 % BENCH_PER_ROW * (BENCH_ITEM_SIZE.width + BENCH_GAP),
      y: Math.floor(at2 / BENCH_PER_ROW) * (BENCH_ITEM_SIZE.height + BENCH_GAP)
    };
  }
  const properties = {};
  if (agent.harness && (!already.harness || explicit?.harness && agent.harness !== already.harness)) {
    properties[AGENT_HARNESS_PROP] = agent.harness;
  }
  if (agent.runsAt && (!already.runsAt || explicit?.runsAt && agent.runsAt !== already.runsAt)) {
    properties[AGENT_RUNS_AT_PROP] = agent.runsAt;
  }
  return Object.keys(properties).length > 0 ? { kind: "fill", itemId: already.itemId, properties } : { kind: "already", itemId: already.itemId };
}
function benchRows(agents, canvases, runsHere, nowMs) {
  const answering = /* @__PURE__ */ new Set();
  for (const one2 of canvases) {
    for (const row2 of roster(one2.sessions, one2.canvas, nowMs, one2.answerable)) {
      if (ANSWERING.has(row2.state)) answering.add(row2.actorId);
    }
  }
  return agents.map((agent) => {
    const standing = canvases.filter((one2) => one2.canvas.agents?.[agent.actorId]).map((one2) => ({ canvasId: one2.canvasId, canvasTitle: one2.canvasTitle }));
    const reach = answering.has(agent.actorId) ? "ready" : runsHere.has(agent.actorId) || standing.length > 0 ? "elsewhere" : "unreachable";
    return { ...agent, reach, standing };
  });
}
function benchWords(row2) {
  if (row2.reach === "ready") return row2.runsAt ? `ready (${row2.runsAt})` : "ready";
  if (row2.reach === "elsewhere") return "its machine is not here";
  return "nothing here can run it";
}
function benchStandingWords(row2) {
  const count = row2.standing.length;
  if (count === 0) return "standing nowhere";
  return `standing on ${count} canvas${count === 1 ? "" : "es"}`;
}

// packages/core/src/benchjoin.ts
var BENCH_JOIN_VERB = "join";
function benchMentions(bench, canvas) {
  return bench.map((agent) => ({
    id: agent.actorId,
    name: agent.name,
    notHereYet: canvas?.agents?.[agent.actorId] === void 0
  }));
}
function benchJoinAsk(body, bench) {
  let at2 = 0;
  for (const line of body.split("\n")) {
    const start = at2;
    at2 += line.length + 1;
    const said = line.trimEnd();
    if (!said.startsWith("@") || !said.endsWith(BENCH_JOIN_VERB)) continue;
    const head = said.slice(0, said.length - BENCH_JOIN_VERB.length);
    if (!/\s$/.test(head)) continue;
    const named2 = head.trimEnd();
    const name = named2.slice(1);
    if (!name) continue;
    const hit = findMentionSpans(named2, [...bench]).find(
      (span2) => span2.start === 0 && span2.end === named2.length
    );
    return { start, end: start + said.length, name, actorId: hit?.actorId ?? null };
  }
  return null;
}
function benchJoinRefusal(name) {
  return `${name} is not on your bench`;
}
function benchJoinWords(name) {
  return `${name} answers on this canvas now, from a bench. Nothing else moved: no turn was started, no summons rule was written, and no other canvas changed.`;
}

// packages/core/src/googledoc.ts
var DOC_SYNCED_PROP = "synced";
var DOC_MIME = "text/markdown";
var DOC_ID = /^[A-Za-z0-9_-]{20,}$/;
function googleDocId(url2) {
  let parsed;
  try {
    parsed = new URL(url2.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)docs\.google\.com$/.test(parsed.hostname)) return null;
  const match = parsed.pathname.match(/^\/document\/(?:u\/\d+\/)?d\/([^/]+)/);
  if (!match || !DOC_ID.test(match[1])) return null;
  return match[1];
}
function googleDocUrl(id) {
  return `https://docs.google.com/document/d/${id}/edit`;
}
function googleDocExportUrl(id) {
  return `https://docs.google.com/document/d/${id}/export?format=md`;
}
function googleDriveExportUrl(id) {
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent(DOC_MIME)}`;
}
function googleDriveMetaUrl(id) {
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=modifiedTime,name`;
}
var GOOGLE_DRIVE_ABOUT_URL = "https://www.googleapis.com/drive/v3/about?fields=user";
function docStale(syncedAt, modifiedTime) {
  if (!syncedAt) return true;
  return Date.parse(modifiedTime) > Date.parse(syncedAt);
}
function googleDocPreviewUrl(id) {
  return `https://docs.google.com/document/d/${id}/preview`;
}
function docTitleFrom(markdown, fallback) {
  const lines = markdown.split("\n").map((one2) => one2.trim());
  const heading = lines.find((one2) => /^#{1,6}\s+\S/.test(one2));
  const first = heading ? heading.replace(/^#{1,6}\s+/, "") : lines.find((one2) => one2.length > 0);
  const title = (first ?? "").replace(/[*_`]/g, "").trim();
  if (!title) return fallback;
  return title.length > 80 ? `${title.slice(0, 79)}\u2026` : title;
}
function docFilenameFrom(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${slug || "document"}.md`;
}
function docProperties(source3, syncedAt) {
  return { [SOURCE_PROP]: source3, [DOC_SYNCED_PROP]: syncedAt };
}
function isGoogleDocItem(item) {
  const source3 = sourceOf(item);
  return source3 !== null && googleDocId(source3) !== null;
}
function docSyncedAt(item) {
  return item.properties[DOC_SYNCED_PROP] ?? null;
}

// packages/core/src/addable.ts
function looksLikeSite(input) {
  const s = input.trim();
  if (!s || /\s/.test(s)) return false;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^localhost(:\d+)?(\/|$)/i.test(s) || /^[^/]+\.[a-z]{2,}(:\d+)?(\/|$)/i.test(s) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(s);
}
function classifyAddable(input, canvases, selfId) {
  const s = input.trim();
  if (!s) return { kind: "empty" };
  const doc = googleDocId(s);
  if (doc) return { kind: "doc", id: doc, url: googleDocUrl(doc) };
  const address = parseCanvasAddress(s);
  if (address) {
    const known = canvases.find((c) => c.id === address.canvasId);
    return { kind: "canvas", canvasId: address.canvasId, origin: address.origin, title: known?.title ?? null };
  }
  const others = canvases.filter((c) => c.id !== selfId);
  const byId = others.find((c) => c.id === s);
  if (byId) return { kind: "canvas", canvasId: byId.id, origin: null, title: byId.title };
  if (!looksLikeSite(s)) {
    const needle = s.toLowerCase();
    const exact = others.filter((c) => c.title.toLowerCase() === needle);
    const prefix = others.filter((c) => c.title.toLowerCase().startsWith(needle));
    const one2 = exact.length === 1 ? exact[0] : prefix.length === 1 ? prefix[0] : null;
    if (one2) return { kind: "canvas", canvasId: one2.id, origin: null, title: one2.title };
    return { kind: "search", query: s };
  }
  return { kind: "site", url: normalizeSiteUrl(s) };
}
function addableKind(a) {
  switch (a.kind) {
    case "empty":
      return null;
    case "search":
      return "canvas";
    default:
      return a.kind;
  }
}
function addableWords(a) {
  switch (a.kind) {
    case "doc":
      return "Add as a document \u2014 its words, with a \u2197 to the doc";
    case "canvas":
      return a.title ? `Place the canvas \u201C${a.title}\u201D` : `Place the canvas ${a.canvasId}`;
    case "site":
      return `Add ${siteLabel(a.url)} as a live site`;
    case "search":
      return "Searching your canvases \u2014 or paste an address";
    case "empty":
      return null;
  }
}

// packages/core/src/titleroom.ts
function titleRoom(item, others, strip, gap = 0) {
  const top = item.y - strip;
  const bottom = item.y;
  let limit = Infinity;
  for (const other of others) {
    const otherTop = other.titled ? other.y - strip : other.y;
    const otherBottom = other.y + other.height;
    if (otherBottom <= top || otherTop >= bottom) continue;
    if (other.x <= item.x) continue;
    limit = Math.min(limit, other.x - gap);
  }
  if (limit === Infinity) return Infinity;
  return Math.max(item.width, limit - item.x);
}

// packages/core/src/whatsnew.ts
var MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
function dayOf(title) {
  const m = title.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return title.trim();
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return title.trim();
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
function news(markdown) {
  const days = [];
  const parts = markdown.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const [heading = "", ...rest] = part.split("\n");
    const items = rest.map((line) => line.trim()).filter((line) => line.startsWith("- ") || line.startsWith("* ")).map((line) => line.slice(2).trim()).filter(Boolean);
    if (items.length === 0) continue;
    days.push({ day: dayOf(heading), title: heading.trim(), items });
  }
  return days.sort((a, b) => b.day.localeCompare(a.day));
}
function unseen(days, lastSeenDay) {
  if (lastSeenDay === null) return [];
  return days.filter((d) => d.day > lastSeenDay);
}
function newestDay(days) {
  return days[0]?.day ?? null;
}

// packages/core/src/protocol.ts
var DEFAULT_PORT = 4441;
var CANVAS_GROUPS_FEATURE = "canvas-groups-v4";
var QUESTIONNAIRES_FEATURE = "questionnaires-v1";
var QUESTIONNAIRES_REQUIRED = "questionnaires-required";
var DESIGN_REQUESTS_FEATURE = "design-requests-v2";
var DESIGN_DECISIONS_FEATURE = "design-decisions-v1";
var DESIGN_REPAIRS_FEATURE = "design-repairs-v1";
var CURRENT_CLIENT_FEATURES = `${CANVAS_GROUPS_FEATURE},${QUESTIONNAIRES_FEATURE},design-requests-v1,${DESIGN_REQUESTS_FEATURE},${DESIGN_DECISIONS_FEATURE},${DESIGN_REPAIRS_FEATURE}`;
function supportsDesignRepairs(value) {
  return typeof value === "string" && value.split(",").some((s) => s.trim() === DESIGN_REPAIRS_FEATURE);
}
function supportsDesignDecisions(value) {
  return typeof value === "string" && value.split(",").map((s) => s.trim()).includes(DESIGN_DECISIONS_FEATURE);
}
var DESIGN_REQUESTS_REQUIRED = "design-requests-required";
function supportsDesignRequests(value) {
  return typeof value === "string" && value.split(",").some((part) => part.trim() === DESIGN_REQUESTS_FEATURE);
}
function supportsQuestionnaires(value) {
  return typeof value === "string" && value.split(",").some((part) => part.trim() === QUESTIONNAIRES_FEATURE);
}
var CLIENT_FEATURES_HEADER = "x-isocan-features";
var CLIENT_FEATURES_PARAM = "features";
var CANVAS_GROUPS_REQUIRED = "canvas-groups-required";
function supportsCanvasGroups(value) {
  return typeof value === "string" && value.split(",").some((part) => part.trim() === CANVAS_GROUPS_FEATURE);
}
var PARK_ADOPTED_CODE = "park-adopted";
var rcAnsweringRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/rc`;
var rcAskRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/agents/ask`;
var NO_RC_CODE = "no-rc";
var NOT_YOUR_RC_CODE = "not-your-rc";
var RENAMED_WIRE_KEYS = [
  ["canvasId", "projectId"],
  ["canvasTitle", "projectTitle"]
];
var STALE_CLIENT_CODE = "stale-client";
var STALE_CLIENT_STATUS = 426;
var WS_STALE_CLIENT = 4426;
var WS_BEHIND = 4409;
var WS_CLOSE_REASON_BYTES = 123;
function sent(carrier, key) {
  if (carrier instanceof URLSearchParams) return (carrier.get(key) ?? "") !== "";
  return carrier[key] !== void 0;
}
function missing(carrier, key) {
  if (carrier instanceof URLSearchParams) return (carrier.get(key) ?? "") === "";
  return carrier[key] === void 0 || carrier[key] === null;
}
function staleClientRefusal(...carriers) {
  for (const carrier of carriers) {
    if (!carrier || typeof carrier !== "object") continue;
    for (const [now, before] of RENAMED_WIRE_KEYS) {
      if (!missing(carrier, now) || !sent(carrier, before)) continue;
      return {
        code: STALE_CLIENT_CODE,
        error: `this home speaks isocan's post-rename protocol: it needs \`${now}\`, and this request sent \`${before}\` instead. Your isocan is older than this home \u2014 upgrade it with \`npx ${INSTALL_SPEC} setup\` and run this again.`,
        closeReason: `isocan: this home needs ${now}, not ${before}; upgrade: npx ${INSTALL_SPEC} setup`
      };
    }
  }
  return null;
}
var FILENAME_HEADER = "X-Isocan-Filename";
var MAX_DIRECT_UPLOAD_BYTES = 24 * 1024 * 1024;
var encodeFilename = (filename) => encodeURIComponent(filename);
function decodeFilename(raw) {
  const value = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  if (!value) return "upload.bin";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
var LOOPBACK = /^(\[::1\]|::1|localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;
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
var CANVASES_REACH_PARAM = "reach";
function canvasesRoute(reach) {
  return reach ? `/api/projects?${CANVASES_REACH_PARAM}=${reach}` : "/api/projects";
}
var HOME_JOIN_ROUTE = "/api/home/join";
var HOMES_ROUTE = "/api/homes";
var PRESENCE_WHERE_ROUTE = "/api/presence/where";
var NEWS_ROUTE = "/api/news";
var ACTOR_KINDS_ROUTE = "/api/kinds";
var DOC_EXPORT_ROUTE = "/api/docs/export";
var SERVING_ROUTE = "/api/serving";
var SIGN_BLOBS_ROUTE = "/api/projects/:id/blobs/signed";
var SIGN_BLOBS_PARAM = "hashes";
var SIGN_BLOBS_LIMIT = 100;
var UNKNOWN_ROUTE = "unknown-route";
var HOME_GC_ROUTE = "/api/gc";

// packages/core/src/itemrefs.ts
function findItemRefSpans(body, candidates) {
  const names = referableNames(candidates);
  const spans = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "#") continue;
    if (i > 0 && isWordChar2(body[i - 1])) continue;
    const hit = names.find((candidate) => matchesAt2(body, i + 1, candidate.name));
    if (!hit) continue;
    const end = i + 1 + hit.name.length;
    spans.push({ start: i, end, itemId: hit.id, text: body.slice(i + 1, end) });
    i = end - 1;
  }
  return spans;
}
function extractItemRefs(body, candidates) {
  const referenced = new Set(findItemRefSpans(body, candidates).map((span2) => span2.itemId));
  const ids4 = [];
  for (const candidate of candidates) {
    if (referenced.has(candidate.id) && !ids4.includes(candidate.id)) ids4.push(candidate.id);
  }
  return ids4;
}
function collectItemRefCandidates(canvas) {
  const candidates = [];
  for (const item of Object.values(canvas.items)) {
    const title = item.title.trim();
    if (title) candidates.push({ id: item.id, title });
    candidates.push({ id: item.id, title: item.id });
  }
  return candidates;
}
function referableNames(candidates) {
  const names = [];
  for (const candidate of candidates) {
    const name = candidate.title.trim();
    if (!name) continue;
    if (!names.some((n) => n.id === candidate.id && n.name === name)) {
      names.push({ id: candidate.id, name });
    }
  }
  return names.sort((a, b) => b.name.length - a.name.length);
}
function matchesAt2(body, index, name) {
  const slice = body.slice(index, index + name.length);
  if (slice.toLowerCase() !== name.toLowerCase()) return false;
  const after = body[index + name.length];
  return after === void 0 || !isWordChar2(after);
}
function isWordChar2(ch) {
  return /[\p{L}\p{N}_]/u.test(ch);
}

// packages/core/src/filenames.ts
function extensionOf(filename) {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot) : "";
}
function extensionFor(filename, mimeType) {
  const fromName = extensionOf(filename).slice(1).toLowerCase();
  if (/^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  const map = {
    "text/markdown": "md",
    "text/uri-list": "uri",
    "text/html": "html",
    "text/plain": "txt",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov"
  };
  return map[mimeType] ?? "bin";
}
function filenameFromTitle(title, previous) {
  const extension = extensionOf(previous);
  const stem = title.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase();
  if (stem === "") return previous;
  return `${stem}${extension}`;
}
function uniqueFilename(candidate, taken) {
  const used = new Set([...taken].map((name) => name.toLowerCase()));
  if (!used.has(candidate.toLowerCase())) return candidate;
  const extension = extensionOf(candidate);
  const stem = candidate.slice(0, candidate.length - extension.length);
  for (let n = 2; n < 1e3; n++) {
    const next = `${stem}-${n}${extension}`;
    if (!used.has(next.toLowerCase())) return next;
  }
  return candidate;
}
function filenamesInUse(canvas, exceptItemId) {
  const names = [];
  for (const item of Object.values(canvas.items)) {
    if (item.id === exceptItemId) continue;
    for (const version of item.versions) names.push(version.filename);
  }
  return names;
}
function renamedFilename(canvas, itemId, title, previous) {
  return uniqueFilename(filenameFromTitle(title, previous), filenamesInUse(canvas, itemId));
}

// packages/core/src/blobrefs.ts
var SHA256 = /^[0-9a-f]{64}$/;
function blobsInProperties(state) {
  const found = /* @__PURE__ */ new Set();
  const scan = (properties) => {
    for (const value of Object.values(properties ?? {})) {
      if (SHA256.test(value)) found.add(value);
    }
  };
  scan(state.project.properties);
  const canvas = state.canvas;
  for (const item of Object.values(canvas.items)) scan(item.properties);
  for (const entry of canvas.trash) scan(entry.item.properties);
  return found;
}

// packages/core/src/elapsed.ts
function elapsedLabel(fromISO, toISO) {
  const ms = Math.max(0, Date.parse(toISO) - Date.parse(fromISO));
  const seconds = Math.round(ms / 1e3);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
function workedFor(comment) {
  return comment.editedAt ? elapsedLabel(comment.createdAt, comment.editedAt) : null;
}
function ago(iso, nowMs) {
  const ms = nowMs - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const h = ms / 36e5;
  if (h < 1) return `${Math.max(1, Math.round(ms / 6e4))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

// packages/core/src/layout.ts
function alignLabel(edge) {
  switch (edge) {
    case "left":
      return "Left";
    case "hcenter":
      return "Center";
    case "right":
      return "Right";
    case "top":
      return "Top";
    case "vcenter":
      return "Middle";
    case "bottom":
      return "Bottom";
  }
}
var ALIGN_EDGES = [
  "left",
  "hcenter",
  "right",
  "top",
  "vcenter",
  "bottom"
];
function settle(boxes, placed) {
  const moves = [];
  for (const box2 of boxes) {
    const target = placed.get(box2.id);
    if (!target) continue;
    const x = Math.round(target.x);
    const y = Math.round(target.y);
    if (x !== box2.x || y !== box2.y) moves.push({ itemId: box2.id, x, y });
  }
  return moves;
}
function alignMoves(boxes, edge) {
  if (boxes.length < 2) return [];
  const placed = /* @__PURE__ */ new Map();
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  for (const box2 of boxes) {
    switch (edge) {
      case "left":
        placed.set(box2.id, { x: minX, y: box2.y });
        break;
      case "right":
        placed.set(box2.id, { x: maxX - box2.width, y: box2.y });
        break;
      case "hcenter":
        placed.set(box2.id, { x: (minX + maxX) / 2 - box2.width / 2, y: box2.y });
        break;
      case "top":
        placed.set(box2.id, { x: box2.x, y: minY });
        break;
      case "bottom":
        placed.set(box2.id, { x: box2.x, y: maxY - box2.height });
        break;
      case "vcenter":
        placed.set(box2.id, { x: box2.x, y: (minY + maxY) / 2 - box2.height / 2 });
        break;
    }
  }
  return settle(boxes, placed);
}
function distributeMoves(boxes, axis) {
  if (boxes.length < 3) return [];
  const size = (box2) => axis === "h" ? box2.width : box2.height;
  const start = (box2) => axis === "h" ? box2.x : box2.y;
  const ordered = [...boxes].sort((a, b) => start(a) - start(b));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const span2 = start(last) + size(last) - start(first);
  const occupied = ordered.reduce((total, box2) => total + size(box2), 0);
  const gap = (span2 - occupied) / (ordered.length - 1);
  const placed = /* @__PURE__ */ new Map();
  let cursor = start(first);
  for (const box2 of ordered) {
    placed.set(box2.id, axis === "h" ? { x: cursor, y: box2.y } : { x: box2.x, y: cursor });
    cursor += size(box2) + gap;
  }
  return settle(boxes, placed);
}

// packages/core/src/backing.ts
var FILE_PROP = "file";
var VISUAL_FILE_PROP = "visualFile";
function fileOf(item) {
  const raw = item.properties[FILE_PROP];
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}
function visualFileOf(item) {
  const raw = item.properties[VISUAL_FILE_PROP];
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}
function backingOf(item, bound, onDisk) {
  const path = fileOf(item);
  if (path === null) return null;
  const visualPath = visualFileOf(item);
  if (!bound) {
    return {
      path,
      state: "unbound",
      ...visualPath !== null ? { visualPath, visualState: "unbound" } : {}
    };
  }
  const found = onDisk(path);
  const current2 = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  let state;
  if (found === null) {
    state = "absent";
  } else if (found === current2?.blobHash) {
    state = "written";
  } else if (item.versions.some((v) => v.blobHash === found)) {
    state = "behind";
  } else {
    state = "drifted";
  }
  let visualState;
  if (visualPath !== null) {
    const vFound = onDisk(visualPath);
    const vCurrentHash = current2?.visual?.blobHash;
    if (vFound === null) {
      visualState = "absent";
    } else if (vCurrentHash && vFound === vCurrentHash) {
      visualState = "written";
    } else if (item.versions.some((v) => v.visual?.blobHash === vFound)) {
      visualState = "behind";
    } else {
      visualState = "drifted";
    }
  }
  return {
    path,
    state,
    ...visualPath !== null && visualState !== void 0 ? { visualPath, visualState } : {}
  };
}
function cleanFilePath(raw) {
  const value = raw.trim().replace(/\\/g, "/");
  if (value === "" || value.startsWith("/")) return null;
  const segments = value.split("/").filter((one2) => one2 !== "" && one2 !== ".");
  if (segments.length === 0) return null;
  if (segments.some((one2) => one2 === ".." || one2.startsWith("."))) return null;
  return segments.join("/");
}

// packages/core/src/commands.ts
var COMMAND_NAME = /^[a-z][a-z0-9-]{0,31}$/;
function parseSlashCommand(body) {
  const lead = body.length - body.trimStart().length;
  const text3 = body.slice(lead);
  if (!text3.startsWith("/")) return null;
  const match = /^\/([a-z][a-z0-9-]{0,31})(?=$|\s)/.exec(text3);
  if (!match) return null;
  return {
    name: match[1],
    args: text3.slice(match[0].length).trim(),
    end: lead + match[0].length
  };
}
function matchCommands(commands, query, limit = 6) {
  const q = query.trim().toLowerCase();
  if (q === "") return commands.slice(0, limit);
  const starts = commands.filter((c) => c.name.startsWith(q));
  const contains = commands.filter(
    (c) => !c.name.startsWith(q) && (c.name.includes(q) || c.description.toLowerCase().includes(q))
  );
  return [...starts, ...contains].slice(0, limit);
}
function findCommand(commands, name) {
  const wanted = name.toLowerCase();
  return commands.find((c) => c.name === wanted) ?? // An old name still opens the door. Checked second, so a command that
  // takes a name another one used to have wins it — the current vocabulary
  // outranks the history of it.
  commands.find((c) => c.aka?.includes(wanted)) ?? null;
}
function mergeCommands(builtIns, home) {
  const byName = /* @__PURE__ */ new Map();
  for (const command of builtIns) byName.set(command.name, command);
  for (const command of home) byName.set(command.name, { ...command, source: "home" });
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
function parseCommandFile(name, text3) {
  if (!COMMAND_NAME.test(name)) return null;
  let description = "";
  let usage = "";
  let body = text3;
  const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text3);
  if (front) {
    body = text3.slice(front[0].length);
    for (const line of front[1].split(/\r?\n/)) {
      const pair = /^([a-z]+):\s*(.*)$/i.exec(line.trim());
      if (!pair) continue;
      const value = pair[2].trim().replace(/^["']|["']$/g, "");
      if (pair[1].toLowerCase() === "description") description = value;
      if (pair[1].toLowerCase() === "usage") usage = value;
    }
  }
  body = body.trim();
  if (body === "") return null;
  return {
    name,
    // A command with no description still has to be pickable from the menu.
    description: description || `Run the ${name} command`,
    usage,
    body,
    source: "home"
  };
}
function commandFileText(command) {
  const lines = ["---", `description: ${command.description}`];
  if (command.usage) lines.push(`usage: ${command.usage}`);
  lines.push("---", "", command.body.trim(), "");
  return lines.join("\n");
}

// packages/core/src/undone.ts
function undoneSeqs(entries) {
  const undoneBy = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    if (entry.cause?.kind === "undo") undoneBy.set(entry.cause.targetSeq, entry.seq);
    else if (entry.cause?.kind === "redo") undoneBy.delete(entry.cause.targetSeq);
  }
  return undoneBy;
}

// packages/core/src/evals.ts
var COMMAND_CATEGORY = {
  cancel: "cancel",
  format: "arrange",
  variation: "variation",
  "design-audit": "critique",
  "grill-me": "critique",
  "design-system": "restyle",
  sprint: "orchestrate",
  ask: "question"
};
function categoriseAsk(body, command) {
  if (command !== null) return COMMAND_CATEGORY[command] ?? "question";
  const text3 = body.replace(/\s+/g, " ").trim();
  const lower = text3.toLowerCase();
  const words = lower.replace(/@[\w'’.-]+(?:\s+[\w'’.-]+)*?\s*🤖?/g, " ").replace(/[^\p{L}\p{N}?]+/gu, " ").trim();
  if (/^(thanks|thank you|amazing|awesome|nice|great|love it|hello|hi|hey)\b/.test(lower) && words.split(" ").length <= 6) return "social";
  if (words.split(" ").filter(Boolean).length <= 1) return "orchestrate";
  if (/^(probe\b|echo check)/.test(lower)) return "probe";
  if (/\b(this one'?s for you|this is for you|take (on|up) this|pick this up|can you work on this|are you (there|here)|read .* and do it|\^\^\^)/.test(lower)) return "orchestrate";
  if (/\b(github pages|deploy|host(ed|ing)?\b|make it public)/.test(lower)) return "ops";
  if (/\b(fix|broken|bug|doesn'?t work|isn'?t working|not working|don'?t see|still (broken|not)|looks broken)\b/.test(lower)) return "repair";
  if (/^(how|what|why|when|where|who|which|does|do|is|are|wait|can i|could i)\b/.test(lower) && !/\b(what would a .* (version|look)|what do you think about having)/.test(lower)) return "question";
  if (/\b(variations?|different (styles|designs|takes|versions)|\d+ (variations|versions|takes|options)|what would an? .* version look like|best shots?|your take)\b/.test(lower)) return "variation";
  if (/\b(merge (the|these|both) .*(take|version|best)|best of both|take the best|use this (one|version)|update the main .* to use)\b/.test(lower)) return "converge";
  if (/\b(critique|audit|which (one )?(is|do you think)|are these good|what do you think of|superior|grill)\b/.test(lower)) return "critique";
  if (/\b(tidy|rearrange|organi[sz]ed?|merge these into one|line (them )?up|clean up|delete the|remove the)\b/.test(lower)) return "arrange";
  if (/\b(readme|spec\b|design\.md|write up|write a doc|document(ation)?\b|information architecture|extract the .* design system)/.test(lower)) return "document";
  if (/\b(restyle|redesign|reimagine|reskin|look and feel|make it pop|glassmorphic|design system|font pairings?|fonts?\b|high end|modern (fonts|layout))/.test(lower)) return "restyle";
  if (/\b(change|update|replace|nudge|reorder|hover|animate[ds]?|integrate|swap|centered|sparkly|dark mode|light\/dark|sorted|add (another|a bullet|the image)|make (it|this|these|them|that)\b|space it out|moving around|flying out|explodes)/.test(lower)) return "revise";
  if (/\b(create|build|make|draw|sketch|wireframe|generate|design (a|an|me|two|three)|new screen|add a text node|greeting|card for|quiz|deck|diagrams?)\b/.test(lower)) return "create";
  return lower.endsWith("?") ? "question" : "revise";
}
function askKind(comment, thread, agents) {
  if ((comment.mentions ?? []).length > 0) return "addressed";
  if (thread.main !== true) return null;
  return agents.has(comment.author.id) ? null : "broadcast";
}
function buildCorpus(canvas, log, knownAgents = []) {
  const asks = [];
  const agents = /* @__PURE__ */ new Set([...Object.keys(canvas.agents ?? {}), ...knownAgents]);
  const work = log.filter((entry) => entry.cause === void 0);
  const undone = undoneSeqs(log);
  for (const thread of Object.values(canvas.threads)) {
    for (const [index, comment] of thread.comments.entries()) {
      const kind = askKind(comment, thread, agents);
      if (kind === null) continue;
      const later = thread.comments.slice(index + 1);
      const answer = later.find((c) => c.author.id !== comment.author.id);
      const ownNext = later.find((c) => c.author.id === comment.author.id);
      const cancelled = ownNext !== void 0 && parseSlashCommand(ownNext.body)?.name === "cancel";
      const nextWord = later[0]?.createdAt;
      const outcome = cancelled ? "cancelled" : answer ? "answered" : "silent";
      const referenced = /* @__PURE__ */ new Set([
        ...comment.items ?? [],
        ...answer?.items ?? []
      ]);
      const anchor = thread.anchorItemId;
      const answerers = new Set(
        [answer?.author.id, ...comment.mentions ?? []].filter(
          (id) => id !== void 0
        )
      );
      const produced = [];
      for (const entry of work) {
        const ts = entry.envelope.ts;
        if (ts < comment.createdAt) continue;
        const itemId = itemOf(entry);
        let how = null;
        if (itemId !== void 0 && anchor !== null && itemId === anchor) how = "anchor";
        else if (itemId !== void 0 && referenced.has(itemId)) how = "reference";
        else if (answerers.has(entry.envelope.actor.id) && (nextWord === void 0 || ts < nextWord))
          how = "window";
        if (how === null) continue;
        produced.push({
          seq: entry.seq,
          type: entry.envelope.op.type,
          ...itemId !== void 0 ? { itemId } : {},
          how,
          undone: undone.has(entry.seq)
        });
      }
      asks.push({
        threadId: thread.id,
        commentId: comment.id,
        at: comment.createdAt,
        askedBy: { id: comment.author.id, name: comment.author.name },
        askedOf: comment.mentions ?? [],
        main: thread.main === true,
        kind,
        command: parseSlashCommand(comment.body)?.name ?? null,
        category: categoriseAsk(comment.body, parseSlashCommand(comment.body)?.name ?? null),
        body: comment.body,
        outcome,
        ...answer ? {
          answeredIn: Math.max(
            0,
            Math.round(
              (Date.parse(answer.createdAt) - Date.parse(comment.createdAt)) / 1e3
            )
          ),
          answeredBy: answer.author.name
        } : {},
        produced
      });
    }
  }
  asks.sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
  const commands = /* @__PURE__ */ new Map();
  for (const ask of asks) {
    if (ask.command === null) continue;
    commands.set(ask.command, (commands.get(ask.command) ?? 0) + 1);
  }
  const categories = /* @__PURE__ */ new Map();
  for (const ask of asks) {
    const row2 = categories.get(ask.category) ?? { count: 0, silent: 0 };
    row2.count += 1;
    if (ask.outcome === "silent") row2.silent += 1;
    categories.set(ask.category, row2);
  }
  const every = asks.flatMap((a) => a.produced);
  return {
    summary: {
      asks: asks.length,
      addressed: asks.filter((a) => a.kind === "addressed").length,
      broadcast: asks.filter((a) => a.kind === "broadcast").length,
      broadcastUnfiltered: agents.size === 0,
      answered: asks.filter((a) => a.outcome === "answered").length,
      cancelled: asks.filter((a) => a.outcome === "cancelled").length,
      silent: asks.filter((a) => a.outcome === "silent").length,
      opsAttributed: every.length,
      opsByAnchorOrReference: every.filter((o) => o.how !== "window").length,
      opsUndone: every.filter((o) => o.undone).length,
      commands: [...commands].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1)),
      categories: [...categories].map(([name, row2]) => ({ name, ...row2 })).sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1))
    },
    asks
  };
}
var CONVERGED_PROP = "converged";
var KEPT_AFTER_MS = 12 * 60 * 60 * 1e3;
function withLanding(existing, versionId, at2) {
  const entry = `${versionId}@${at2}`;
  return existing && existing.trim() ? `${existing.trim()},${entry}` : entry;
}
function landingsOf(item) {
  const raw = item.properties[CONVERGED_PROP];
  if (!raw) return [];
  return raw.split(",").map((one2) => one2.trim()).filter(Boolean).map((one2) => {
    const at2 = one2.indexOf("@");
    return at2 < 0 ? { versionId: one2, landedAt: "" } : { versionId: one2.slice(0, at2), landedAt: one2.slice(at2 + 1) };
  });
}
function harvestConverge(canvas, now = Date.now()) {
  const landings = [];
  for (const item of Object.values(canvas.items)) {
    const order = item.versions.map((v) => v.id);
    const currentAt = order.indexOf(item.currentVersionId);
    for (const { versionId, landedAt } of landingsOf(item)) {
      const landedIndex = order.indexOf(versionId);
      let status;
      if (landedIndex < 0) status = "reverted";
      else if (currentAt >= 0 && currentAt < landedIndex) status = "reverted";
      else if (order.length - 1 > landedIndex) status = "built-on";
      else if (landedAt && now - Date.parse(landedAt) >= KEPT_AFTER_MS) status = "kept";
      else status = "standing";
      landings.push({ itemId: item.id, title: item.title, versionId, landedAt, status });
    }
  }
  landings.sort((a, b) => a.landedAt < b.landedAt ? 1 : a.landedAt > b.landedAt ? -1 : 0);
  const kept = landings.filter((l) => l.status === "kept" || l.status === "built-on").length;
  const reverted = landings.filter((l) => l.status === "reverted").length;
  const standing = landings.filter((l) => l.status === "standing").length;
  return { landings, kept, reverted, standing, acceptRate: kept + reverted === 0 ? null : kept / (kept + reverted) };
}
function harvestPreferences(canvas, log) {
  const pairs = [];
  const seen = /* @__PURE__ */ new Map();
  for (const entry of log) {
    const op = entry.envelope.op;
    if (op.type === "group.change" && op.action.kind === "apply") {
      for (const write of op.action.change.writes) {
        if (write.kind === "create") seen.set(write.item.id, write.item.versions.map((version) => version.id));
        if (write.kind === "patch" && write.content) {
          if (write.content.versions) seen.set(write.itemId, write.content.versions.map((version) => version.id));
          const chosen = write.content.currentVersionId;
          const stack2 = seen.get(write.itemId) ?? [];
          const at3 = chosen ? stack2.indexOf(chosen) : -1;
          if (chosen && at3 >= 0 && at3 < stack2.length - 1) pairs.push({ itemId: write.itemId, title: canvas.items[write.itemId]?.title ?? write.itemId, chosen, chosenAt: entry.envelope.ts, chosenBy: entry.envelope.actor.name, chosenById: entry.envelope.actor.id, against: stack2.filter((id) => id !== chosen) });
        }
      }
      continue;
    }
    if (op.type === "item.add") {
      seen.set(op.itemId, [op.version.id]);
      continue;
    }
    if (op.type === "item.addVersion" || op.type === "item.edit") {
      const stack2 = seen.get(op.itemId) ?? [];
      seen.set(op.itemId, [...stack2, op.version.id]);
      continue;
    }
    if (op.type !== "item.setCurrentVersion") continue;
    const stack = seen.get(op.itemId) ?? [];
    const at2 = stack.indexOf(op.versionId);
    if (at2 === -1 || at2 === stack.length - 1) continue;
    const against = stack.filter((id) => id !== op.versionId);
    if (against.length === 0) continue;
    pairs.push({
      itemId: op.itemId,
      title: canvas.items[op.itemId]?.title ?? op.itemId,
      chosen: op.versionId,
      chosenAt: entry.envelope.ts,
      chosenBy: entry.envelope.actor.name,
      chosenById: entry.envelope.actor.id,
      against
    });
  }
  return pairs;
}
function itemOf(entry) {
  const op = entry.envelope.op;
  if (op.type === "group.change") return void 0;
  if ("itemId" in op && typeof op.itemId === "string") return op.itemId;
  return void 0;
}

// packages/core/src/command-catalogue.ts
var DEFAULT_COMMAND_CATALOGUE = [
  {
    name: "help",
    description: "Keyboard shortcuts, and what else you can ask for",
    usage: "",
    source: "built-in",
    // Answered where it is typed: the app knows its own keyboard.
    local: true
  },
  {
    name: "accessibility-audit",
    description: "Audit selected screens against WCAG \u2014 from the real HTML, not a picture",
    usage: "[what to focus on]",
    source: "built-in"
  },
  {
    name: "app-store-assets",
    description: "Icon, three marketing screenshots, and the ASO metadata",
    usage: "[what to emphasise]",
    source: "built-in"
  },
  {
    name: "web-assets",
    description: "Favicon, Apple touch icon, and a manifest.json",
    usage: "[what to emphasise]",
    source: "built-in"
  },
  {
    name: "marketing-kit",
    description: "Social card, banner, email header, and the copy to go with them",
    usage: "[the angle to take]",
    source: "built-in"
  },
  {
    name: "design-audit",
    description: "Review a screen's craft and copy against the design system, then offer to fix it",
    usage: "[what to look at]",
    source: "built-in"
  },
  {
    name: "design-system",
    description: "Write down what this canvas has decided things look like \u2014 a DESIGN.md",
    usage: "[what to change]",
    source: "built-in"
  },
  {
    name: "skill",
    description: "Find a published skill, or add one to this canvas",
    usage: "find <what you want> | add <owner/repo/path>",
    source: "built-in"
  },
  {
    name: "cancel",
    description: "Call off what was asked here \u2014 stop, say where you got to",
    usage: "[why, or what to do instead]",
    source: "built-in"
  },
  {
    name: "tidy",
    aka: ["format"],
    description: "Tidy the canvas \u2014 grid (default), smart, or your own instructions",
    usage: "[grid|smart|note]",
    source: "built-in"
  },
  {
    name: "variation",
    description: "Make N variations of a screen, each explored differently",
    usage: "[n=3] <how they should differ>",
    source: "built-in"
  },
  {
    name: "grill-me",
    description: "A relentless interview that ends in a spec, not a vibe",
    usage: "[what you want to build]",
    source: "built-in"
  },
  {
    name: "sprint",
    description: "Run a design sprint here \u2014 you facilitate, people and agents sketch, one person decides",
    usage: "[what we are designing] | <phase> [8m] [note]",
    source: "built-in"
  }
];

// packages/core/src/slop.ts
var SLOP_RULES = [
  {
    name: "The default typeface",
    kind: "visual",
    spot: "font-family lists Inter, Space Grotesk, or the bare system stack, and no second face is declared anywhere",
    instead: "Two faces with different jobs, or one with real weight contrast. A page set entirely in one sans at one weight reads as unstyled."
  },
  {
    name: "Italic serif display",
    kind: "visual",
    spot: "font-style: italic on an h1/h2 in a serif face",
    instead: "It signals 'editorial' and nothing else, and every generated landing page has it. Earn the seriousness with scale and spacing."
  },
  {
    name: "Purple-to-blue gradient hero",
    kind: "visual",
    spot: "linear-gradient in a hero or header with hues between 240 and 280",
    instead: "A gradient the subject asks for, or a flat ground with one accent. This one is the single most identifiable AI tell."
  },
  {
    name: "Glassmorphism everywhere",
    kind: "visual",
    spot: "backdrop-filter: blur on cards or panels that do not overlap anything",
    instead: "Blur is for something showing through. Over a flat background it is decoration that costs contrast."
  },
  {
    name: "One radius for everything",
    kind: "visual",
    spot: "the same border-radius on cards, buttons, inputs, avatars, and images",
    instead: "Radius is hierarchy: a button and a page section are not the same object. Pick two or three and mean them."
  },
  {
    name: "Everything centered",
    kind: "visual",
    spot: "text-align: center on more than the hero, or every section a centered column",
    instead: "Centred text is hard to read past two lines and flattens hierarchy. Left-align body copy; centre what is genuinely a statement."
  },
  {
    name: "Emoji as section markers",
    kind: "visual",
    spot: "emoji at the start of headings, list items, or feature cards",
    instead: "They read as filler, they break in Windows and in print, and they are not iconography. Use type weight, a rule, or a real icon."
  },
  {
    name: "Generic call to action",
    kind: "copy",
    spot: "button text of 'Get Started', 'Learn More', 'Click Here', or 'Discover'",
    instead: "Say what happens: 'Send the invite', 'See this month's bill'. A CTA that fits any product is a CTA for none."
  },
  {
    name: "Three feature cards, always three",
    kind: "visual",
    spot: "a grid of exactly three equal cards, each an icon, a two-word heading, and a sentence",
    instead: "The layout came before the content. Say what there actually is, and let the count follow."
  },
  {
    name: "Marketing adjectives instead of facts",
    kind: "copy",
    spot: "seamless, revolutionise, unlock, elevate, effortless, cutting-edge, 'take it to the next level'",
    instead: "A number, a noun, or a verb the reader recognises. Specific beats aspirational."
  },
  {
    name: "Lorem or invented content",
    kind: "copy",
    spot: "lorem ipsum, 'John Doe', 'Company Name', placeholder avatars, fabricated testimonials or logos",
    instead: "Real content, or clearly-labelled empty states. Fake reviews and fake logos are worse than blank space."
  },
  {
    name: "Contrast sacrificed to taste",
    kind: "visual",
    spot: "grey body text under 4.5:1 on its background, or a light-grey placeholder standing in for a label",
    instead: "Compute the ratio. #999 on white is a design decision that excludes people."
  },
  {
    name: "Type with no scale",
    kind: "visual",
    spot: "font-size values that do not follow a ratio, or more than six distinct sizes on one page",
    instead: "A scale, stated in the design system, and every size taken from it."
  },
  {
    name: "Spacing by eyeball",
    kind: "visual",
    spot: "margins and paddings in unrelated values (13px, 22px, 7px) rather than steps of a unit",
    instead: "One spacing unit and multiples of it. Inconsistent gaps read as sloppiness even when nobody can name why."
  },
  {
    name: "Shadow as a substitute for structure",
    kind: "visual",
    spot: "box-shadow on every card, at the same blur, doing the work a border or a background would do better",
    instead: "Depth should mean something is above something. Flat groups with a hairline read cleaner."
  },
  {
    name: "Hover states only",
    kind: "visual",
    spot: ":hover styled, :focus-visible absent",
    instead: "Half your users are on a keyboard or a touchscreen. A focus ring is not optional."
  },
  {
    name: "The dark mode that was not designed",
    kind: "visual",
    spot: "colours defined only inside a prefers-color-scheme block, or a light palette inverted wholesale",
    instead: "Tokens at the root, re-valued for dark. Check that the accent still works on the dark ground."
  },
  {
    name: "Not just X \u2014 it's Y",
    kind: "copy",
    spot: "the escalation template: 'not just a todo app, it's a system for thinking', 'more than a X \u2014 a Y'",
    instead: "Say the second thing and drop the first. The construction works by denying a claim nobody made."
  },
  {
    name: "The opener that says nothing",
    kind: "copy",
    spot: "a hero or intro beginning 'In today's fast-paced world', 'In an era of', 'Whether you're a X or a Y'",
    instead: "Open on the specific thing this product does. The reader arrived already knowing the world is fast-paced."
  },
  {
    name: "Apology as an error message",
    kind: "copy",
    spot: "'Oops!', 'Something went wrong', 'We're sorry' \u2014 with no cause and no next step",
    instead: "What failed, and what to do: 'That file is over 24 MB. Try a smaller one.' An apology is not information."
  },
  {
    name: "Copy that narrates the interface",
    kind: "copy",
    spot: "'Click the button below to get started', 'Use this section to manage your team', 'Here you can'",
    instead: "The interface is on screen; describing it is a sentence the reader has to skip. Say what the thing does."
  },
  {
    name: "Title Case On Everything",
    kind: "copy",
    spot: "headings, buttons, labels and menu items all in Title Case, with no sentence case anywhere",
    instead: "Pick one and mean it. Sentence case for anything longer than a couple of words reads faster and dates less."
  },
  {
    name: "The tricolon on repeat",
    kind: "copy",
    spot: "three-item lists throughout \u2014 'fast, simple, and reliable' \u2014 where the third item adds nothing the first two did not",
    instead: "Two if there are two, four if there are four. A rhythm applied to every claim is a rhythm doing the claiming."
  }
];
function slopRulesAsText(kind) {
  const rules = kind ? SLOP_RULES.filter((rule) => rule.kind === kind) : SLOP_RULES;
  return rules.map((rule, i) => `${i + 1}. **${rule.name}** \u2014 spot it: ${rule.spot}. ${rule.instead}`).join("\n");
}

// packages/core/src/command-bodies.ts
function builtInCommands() {
  const bodies = {
    "help": `Say what can be done here.

Answer with three things, short enough to read in the thread:

1. THE COMMANDS. \`isocan command list\` \u2014 every one available on this canvas,
   including any this home added. Give the name, what it does, and one example
   of the arguments, e.g. "/variation 3 try a vertical nav".
2. THE KEYS, if they asked about the web app. \`isocan --help shortcuts\` is not
   a thing; the list lives in the app's help panel, which opens with ? \u2014 say
   that, and name the two or three that matter for what they are doing.
3. WHAT YOU CAN DO for them right now, in one line. Not a menu of capabilities
   \u2014 the one or two things that would obviously help on THIS canvas, given
   what is on it.

If they asked about something specific, answer that instead of reciting the
list. A person typing /help mid-task has a question, not a curiosity.`,
    "accessibility-audit": `Audit the screens for accessibility, and write the report onto the canvas.

READ THE SOURCE, NOT THE SCREENSHOT. \`isocan get <item> screen.html\` gives you
the actual HTML and CSS. This is the whole reason the audit is worth running
here rather than by eye: half of accessibility is invisible in a picture \u2014 a
div pretending to be a button looks identical to a button.

WHICH SCREENS: the items attached to the message, the ones #-referenced in it,
or the selection. If none of those answers, ask.

WHAT TO CHECK, in the order that matters:
- **Semantic HTML.** Headings in order and not skipping levels; landmarks
  (header/nav/main/footer); lists that are lists; \`<button>\` for things that
  do something and \`<a href>\` for things that go somewhere. A clickable div is
  the single most common finding and the most consequential.
- **Names.** Every control has an accessible name \u2014 visible text, aria-label,
  or a label element that actually points at it. Icon-only buttons are where
  this fails.
- **ARIA.** Roles that match what the element does, aria-describedby that
  resolves to a real id, no aria-hidden on something focusable. No ARIA is
  better than wrong ARIA; say so when you find decoration.
- **Contrast.** Compute the ratio from the CSS rather than judging by eye:
  4.5:1 for body text, 3:1 for large text and for the boundary of a control.
  Give the numbers.
- **Keyboard.** Tab order follows the DOM; nothing is reachable only by hover
  or pointer; focus is VISIBLE (an \`outline: none\` with no replacement is a
  finding); no keyboard trap.
- **Images.** alt text that says what the image is FOR, empty alt on
  decoration, and no alt that just repeats the filename.
- **Motion and media**, if any: a \`prefers-reduced-motion\` path, captions.

WRITE IT AS A DOCUMENT, not a chat message. \`isocan add audit.md --title
"<screen> \u2014 accessibility audit" --prop parent=<the screen's item id>\`, so it
hangs under the screen it is about.

Structure it so somebody can act on it before lunch:
- A one-paragraph verdict, and a count by severity.
- Findings ordered by severity, each with: what is wrong, WHERE (the selector,
  the element, the line if you can), which WCAG criterion it fails (with the
  number, e.g. 1.4.3 Contrast (Minimum)), and the fix as a diff or a snippet.
- What you checked and found FINE. A report with no green is a report nobody
  believes.
- What you could not check from source \u2014 anything that needs a screen reader
  or a real keyboard \u2014 said plainly rather than left implied.

Then reply on the thread with the count, the worst one in a sentence, and
#the-report. If the person named a focus in the argument, lead with that.`,
    "app-store-assets": `Produce a full App Store set from the selected screens.

Read "Making an image" in \`isocan --agent-help\` first \u2014 it has the three ways
to make a picture here and a working headless-Chrome recipe. The short version:
compose in HTML/SVG and render at an exact size. Do not generate UI.

FIVE DELIVERABLES. Produce all five, even for a partial-sounding request; a
half set is not usable in App Store Connect.

**1. App icon \u2014 1024x1024 PNG.**
- The whole image IS the icon. No rounded rectangle, no squircle, no container
  shape, no border, no margin: the store applies the mask itself, and an icon
  that draws its own corners gets them clipped twice.
- Full-bleed background, edge to edge \u2014 a 2-3 stop gradient from the app's own
  palette, never a flat fill.
- One motif, centred, orthographic, generous negative space. Distil what the
  app IS into a single mark; do not draw a phone, and do not put text in it.
- Weight and light: a soft top-down specular and a hint of material make it
  read as an object rather than a sticker.

**2-4. Three marketing screenshots \u2014 1290x2796 PNG** (the 6.7" size; the store
scales the rest down from it).
- Put the REAL screen inside the device frame: \`isocan get\` it and drop it in
  an \`<iframe>\`. Never redraw a UI. This is the rule the whole command hangs
  on \u2014 a screenshot with invented UI is a lie about the product, and it is the
  one thing reviewers notice.
- Frame: straight on, no tilt, titanium rim, layered shadow for depth. No
  hands, no desks, no caf\xE9s.
- Layout: headline in the top fifth, device below it, ~150px of quiet at every
  edge. Identical headline typography across all three \u2014 same face, weight,
  size, alignment. That consistency is what makes a set read as a set.
- Each one carries ONE idea: (2) the hook \u2014 what this is; (3) the feature that
  makes it worth having; (4) polish \u2014 dark mode or the most visually
  confident view, on a deep background with a midnight device.
- The palette evolves gently across the three; it does not change.

**5. ASO metadata \u2014 a document on the canvas.** Respect the limits exactly and
count the characters rather than estimating:
- App name, 30. Subtitle, 30. Short description, 80. Long description, 4000.
- Keywords, 100 total, comma-separated, no spaces after commas, and NEVER a
  word already in the name or subtitle \u2014 that is a wasted slot.
- Category, primary and secondary, with a sentence on why.
- What's New, 500.
Lead with benefits, not features. Say what the person gets, not what the app
contains.

Everything lands on the canvas \u2014 \`isocan add icon.png --title "App icon"
--prop parent=<the screen it came from>\` \u2014 so \`isocan tidy\` hangs the set
under its source. Finish with one comment:
the five deliverables, which way each image was made, and two or three
follow-ups worth doing.`,
    "web-assets": `Produce the web asset set from the selected screens.

Read "Making an image" in \`isocan --agent-help\`. For icons, prefer AUTHORING
the SVG over rendering or generating: a favicon is geometry, an SVG one is
sharp at every size, and \`icon.svg\` is a first-class favicon in every current
browser. Render the PNGs from that same SVG so they cannot drift.

**1. Favicon.** One recognisable mark from the app's branding, on a full-bleed
background \u2014 no squircle, no container shape, no margin. Deliver \`icon.svg\`
plus \`favicon-32.png\` and \`favicon-192.png\` rendered from it. It has to be
legible at 16px: if the mark has more than three parts, it is a logo, not a
favicon.

**2. Apple touch icon \u2014 180x180 PNG.** Same mark, no transparency (iOS
composites on white and a transparent icon looks broken), no rounded corners \u2014
iOS applies the mask.

**3. manifest.json.** \`name\`, \`short_name\` (12 chars or it truncates on the
home screen), \`icons\` covering 192 and 512 with \`purpose: "any maskable"\`,
\`start_url\`, \`display: "standalone"\`, and \`theme_color\`/\`background_color\`
taken from the app's actual palette rather than invented \u2014 the background
colour is what people see during the splash, so it must match the app's first
paint or the launch flashes.

**4. The two lines nobody remembers.** Include the \`<link>\` tags to paste into
\`<head>\`, since assets with no wiring are assets nobody installs.

Land everything with \`isocan add icon.svg --title "Favicon" --prop
parent=<the screen it came from>\`. Finish with one comment listing what you
made, how each was made, and the head snippet.`,
    "marketing-kit": `Produce a marketing set from the selected screens.

Read "Making an image" in \`isocan --agent-help\`. These are compositions \u2014
type, gradient, geometry, and where it helps a framed shot of the real screen \u2014
so compose and render rather than generate.

**1. Social card \u2014 1200x630 PNG** (the size Open Graph and Twitter actually
use; 1:1 is for a feed post, and if they asked for one, do both).
- It will be seen at 300px wide in a timeline. One idea, six words at most,
  type large enough to read at a third of this size.
- The product visible, not described.

**2. Banner \u2014 1600x900 PNG.** 16:9, room for the headline to breathe, safe
margins so nothing important dies in a crop.

**3. Email header \u2014 1600x900 PNG,** and remember it renders at ~600px wide in
most clients: no small type, no thin strokes, and legible on a white ground
since half of clients strip backgrounds.

**4. The copy, as HTML on the canvas.** A headline, a subhead, three short
benefit lines, and one call to action. Reference the email header with a
relative \`<img>\` so the document is self-contained on the canvas. Write like a
person: no "revolutionise", no "seamless", no "unlock the power of". Say what
it does and who it is for.

ONE VOICE ACROSS ALL FOUR. Same palette, same type, same claim. A kit whose
pieces argue with each other is worse than one piece.

Land everything with \`isocan add card.png --title "Social card" --prop
parent=<the screen it came from>\`. Finish with one comment: the four
deliverables, how each image was made, and the single sentence you would lead
with if you only got one.`,
    "design-audit": `Audit the design of the selected screens, from the source.

READ TWO THINGS FIRST.

1. THE DESIGN SYSTEM: \`isocan style\` for the whole thing, \`isocan style
   --tokens\` for just the values, \`isocan style --css\` for the custom
   properties. If this canvas has one it is the standard, and the tokens are
   the normative half: a finding is "16px is not in the scale (12, 14, 18, 27)"
   and not "I would have chosen otherwise". Run \`isocan style check\` first \u2014
   if the system itself is broken, say so before grading anything against it.
   If there is no design system, say so once at the top and audit against the
   list below alone; do not invent one and then grade against it.
2. THE SCREEN: \`isocan get <item> screen.html\`. Audit the HTML and CSS, not a
   picture of them. A ratio you computed beats a colour you looked at, and
   half of what matters here \u2014 the scale, the spacing unit, the focus states \u2014
   is invisible in a screenshot.

WHAT TO LOOK FOR, in this order:

**Conformance.** Where the screen departs from the design system. Cite the
declared value and the one it should have been.

**The usual tells.** These are the moves a generated interface reaches for \u2014
in the pixels AND in the words, because copy is most of what is on a screen and
an audit that grades the type scale and skips the sentences has graded half of
it. Each one says how to spot it, so report it only when you can point at the
line:

${slopRulesAsText()}

**Craft, in the parts a list cannot hold.** Hierarchy (does the eye land on
the right thing first?), rhythm (do the gaps mean something?), and whether the
copy says anything. Be specific or say nothing: "the hero and the first card
compete because both are 32px semibold" is worth reading; "improve visual
hierarchy" is not.

WRITE IT AS A DOCUMENT: \`isocan add design-audit.md --title "<screen> \u2014
design audit" --prop parent=<the screen's item id>\`, so it hangs under what it
is about.

Structure it to be acted on:
- One paragraph of verdict, and the single change that would help most.
- Findings worst first, each with the selector or element, what is wrong, and
  the fix as a snippet or a diff \u2014 a value, not an adjective.
- What is GOOD, named specifically. A report with no green is a report the
  person stops believing, and it tells them what to keep.
- What you could not judge from source.

This list is a FLOOR, not taste. Removing every item on it makes a screen
unembarrassing, not good; say plainly which findings are hygiene and which are
the one or two that would actually make it better.

THEN ASK BEFORE YOU CHANGE ANYTHING. An audit nobody acts on is a document,
and most of these fixes are ten seconds of work for whoever wrote the screen.
So reply on the thread with the verdict, the top fix, #the-report, and the
offer \u2014 findings numbered, and how to answer:

> Want me to apply these? Reply with the numbers, or \`all\`, or \`hygiene\` for
> the mechanical ones (1, 4, 7) and none of the judgement calls.

Do NOT apply anything until that reply comes back. The person who asked for an
audit asked for an audit; a screen that changed under them while they were
reading about it is a worse outcome than a finding they never got to.

WHEN THEY SAY YES, the fix lands as a NEW VERSION of the screen \u2014 write the
corrected file and \`isocan edit <the screen's item> <file>\`. Never a new item
beside it: a variant is a different thing to choose between, and this is the
same screen with a fault removed. The version stack is what makes saying yes
cheap \u2014 every fix is one keystroke from being undone, and the before is still
there to compare against.

Apply only what they named. Then reply saying which findings are now fixed,
which you left and why, and that the previous version is still in the stack.`,
    "design-system": `Write or update this canvas's design system.

The format is DESIGN.md (github.com/google-labs-code/design.md): YAML front
matter carrying typed design tokens, then markdown sections carrying the
reasoning. Use it \u2014 it converts to and from \`tokens.json\`, Figma variables
and Tailwind themes, so what you write here does not stop at the edge of this
canvas. \`isocan style\` prints the current one, \`--tokens\` and \`--css\`
give you its machine-readable halves, and \`isocan style check\` grades it.

It is an item on the canvas, not a file in a repo \u2014 so it sits beside the
designs it governs, versions like everything else, and the person can read it
without knowing it exists.

IF THERE IS NONE, DERIVE IT FROM WHAT IS ALREADY THERE. Do not invent a system
and impose it: \`isocan ls --kind site --kind document\`, \`isocan get\` the two
or three screens that look most like what they want, and write down what they
ALREADY do. Where the screens disagree, pick the one that appears most, and
say in the document that you did.

FRONT MATTER \u2014 the normative half. Numbers, not adjectives:

    ---
    version: alpha
    name: <what this system is called>
    colors:            # at least \`primary\`; \`neutral\` is the ground
      primary: "#1c1c1c"
    typography:        # 4\u201312 levels, each with a real fontSize
      body:
        fontFamily: ...
        fontSize: 14px
        lineHeight: 1.5
    spacing:           # one unit and its steps
      md: 16px
    rounded:
      md: 10px
    components:        # references, not repeats: "{colors.tertiary}"
      button-primary:
        background: "{colors.tertiary}"
    ---

Quote hex values and references \u2014 unquoted, a \`#\` is a YAML comment and
\`{\u2026}\` is a mapping. A section you deliberately have no tokens for goes in
\`omitted\` so the linter stays quiet about it.

SECTIONS \u2014 the reasoning, in this order: Overview, Colors, Typography, Layout,
Elevation & Depth, Shapes, Components, Do's and Don'ts. Skip what does not
apply. The prose says WHY and WHEN; the tokens say what. Do not restate the
hex values in sentences \u2014 say what each colour is for.

Finish with rules the project actually cares about: three to six, imperative,
each one falsifiable. "Body text is left-aligned." "One accent per screen."
"No shadow without overlap." An unfalsifiable rule ("keep it clean") grades
nothing and will be ignored.

Keep it under two pages. A style guide nobody finishes is a style guide nobody
follows.

THEN: \`isocan design set DESIGN.md\` \u2014 a new version when one exists, so the
style you are moving away from is still there to compare against. Run
\`isocan style check\` and fix what it finds before you reply; it catches
references to tokens nobody kept, values that are not colours, and contrast
that fails. Then say what you wrote down and, honestly, where the existing
screens disagree with each other \u2014 that disagreement is the decision the
person now gets to make.`,
    "skill": `Get this canvas a new skill.

A slash command's body IS a skill \u2014 same markdown, same frontmatter \u2014 which is
why anything published for Claude Code, Codex or Cursor drops straight in. The
first argument says which job:

**\`/skill find <what you want>\`** \u2014 look, propose, install NOTHING.

START AT AN INDEX, NOT A SEARCH BOX. A web search for a skill returns ten
reprints of the same repo and the original is rarely the first hit. These are
the directories worth reading first \u2014 they are indexes, not skills, so nothing
here is a candidate to install:

- \`VoltAgent/awesome-agent-skills\` \u2014 the broadest, 1000+ entries
- \`ComposioHQ/awesome-claude-skills\` \u2014 smaller, better curated
- \`github/awesome-copilot\` \u2014 the same format from the other direction

And these are the collections most things worth having actually live in, so
check them before concluding something does not exist: \`obra/superpowers\`
(methodology), \`mattpocock/skills\` and \`addyosmani/agent-skills\`
(engineering practice), \`anthropics/skills\` (documents, design, testing),
\`pbakaus/impeccable\` (design language), \`kepano/obsidian-skills\`.

ONE WARNING TO PASS ON: \`anthropics/skills\` ships no LICENSE file and no
licence note. It is worth reading and worth learning from; recommend it only
while saying that, and never suggest vendoring it.

Then, for the two or three worth their time, reply with:
- what it does, in your words, and whether it actually fits this canvas
- the CANONICAL source \u2014 the repo it lives in, not the tenth aggregator site
  that reprinted it. Most search results for skills are SEO copies; find the
  original and name it.
- its licence, and roughly how used it is (stars, installs) \u2014 one line
- the exact command to add it, ready to paste

Then stop. Choosing is theirs.

**\`/skill add <owner/repo/path/SKILL.md or https URL>\`** \u2014 fetch and show it.

    isocan command add --from <ref>          # prints it, installs nothing
    isocan command add --from <ref> --yes    # installs it

Run the first form. Post what it printed \u2014 or, if it is long, the frontmatter,
what it instructs an agent to DO, and anything that reaches outside this canvas
(network calls, shell, credentials, files outside the project). Then ask
whether to install it, and wait.

WHY THE TWO STEPS. A command's body is read as instructions by every future
agent here, with this CLI, on this canvas. Adding one is not downloading a
document, it is giving a stranger a seat at the table \u2014 and a bad one does not
misbehave now, it waits until somebody runs it. So nothing lands unread. If
they tell you to skip the reading, install it and say plainly what you did not
check.

A file already on their disk is different: they wrote it or they already have
it, so \`isocan command add <name> <file>\` needs no ceremony.

AFTERWARDS: say the name, that \`/name\` now works in any composer, and that
\`isocan command rm <name>\` takes it back. If it shadows a built-in, say which
one and that removing yours gives ours back.

ONE SKILL PER JOB. Before proposing anything, check what this canvas already
has (\`isocan command list\`). A second skill that does a job we already do is
not more capability, it is a menu where two entries mean the same thing and
nobody knows which to pick \u2014 say so and name the one that already covers it.

WHAT NOT TO DO: do not add several at once "to be helpful", and do not add
anything they did not ask for. A canvas whose menu is forty commands nobody
chose is worse than one with eight.`,
    "cancel": `Stop what you are doing on this thread.

They have called it off. That is a complete instruction and it does not need
justifying \u2014 do not argue with it, do not finish the last bit because you were
nearly done, and do not ask whether they are sure.

WHAT TO DO, in order:

1. **Stop.** No more building, no more ops beyond the ones below.
2. **Say where you got to**, precisely, in one comment: what you finished, what
   is half done, and what you were about to do. "Stopped" is not enough; they
   are cancelling because something changed, and what to do with the pieces is
   their decision.
3. **Leave the canvas consistent.** Anything you added that is only half a
   thing \u2014 an item with placeholder content, a screen that references a file
   you never wrote \u2014 either finish that ONE step so it stands on its own, or
   remove it (\`isocan rm\`, which is the trash, so it is recoverable) and say
   which you did. Never leave something on the canvas that looks finished and
   is not.
4. **Put the thread down**: posting your reply does this by itself.

If they said what to do instead, that is a new request, not a continuation.
Treat it as one: read it fresh, and if it is unclear, ask rather than assume it
resembles what you were doing.

If you had not started, say so in one line. That is the best possible outcome
of a cancellation and it costs them nothing to hear.`,
    "tidy": `Arrange the canvas.

The layout is a core function both surfaces share, so it lands every item on
the same coordinate whoever asks, and it is ONE \`items.move\`, which means one
undo. Do not place items by hand with \`mv\` unless the note below asks for
something the arrangement cannot do.

**Read the argument first, because it decides which of three things this is.**

**WITH ITEMS SELECTED OR ATTACHED, tidy those and nothing else** \u2014 run
\`isocan format grid <item ids>\`. They land in the box they already occupy,
so the rest of the canvas does not move and nothing is shoved through
somebody else's work. Somebody who picked six screens and asked for a tidy
has said which six; rearranging the whole canvas is doing more than was
asked, to work that was not chosen.

**\`/format\` or \`/format grid\`** \u2014 run \`isocan format grid\`. It straightens
the lines and decides nothing: every item on one lattice, uniform gutters,
columns the width of the widest thing so left edges agree down the canvas. It
reads no lineage and no kinds. This is the default because "make it neat" is
the request nine times out of ten, and a tidy that only straightens is one
somebody can run without wondering what it will decide.

**\`/format smart\`** \u2014 run \`isocan format smart\`. This one READS the canvas:
- Screens go in a row, left to right, keeping the reading order they already had.
- Anything made FROM a screen hangs in a column beneath it (the \`parent\`
  property \u2014 see /variation).
- Images and video gather into a grid below the screens: reference material,
  not slots in the row.
- Ink that annotates an item is left alone. It travels with what it marks.

Then look at what is left and group at a larger scale where the canvas
obviously asks for it \u2014 a cluster that is plainly one feature, a run of
rejected attempts, a set of references about one screen. Use \`isocan mv\`,
\`align\` and \`distribute\`, and say what you grouped and why. If nothing
obviously groups, say that instead of inventing a structure: a canvas with no
clusters in it is a fine answer.

**\`/format <anything else>\`** \u2014 the words are instructions for this one time.
Start from \`grid\` unless they describe something closer to \`smart\`, then
adjust to what they asked for, and say which part of what you did came from
their words. They are looking at the canvas and you are not.

Reply on the thread with what moved and what you left alone. If nothing moved,
say that too: a canvas that is already formatted is a good answer, not a
failure.`,
    "variation": `Make variations of a screen.

WHICH SCREEN: the items attached to the message, or the ones #-referenced in
it, or \u2014 failing both \u2014 the single item they had selected. If none of those
answers, ask which one rather than guessing; a variation of the wrong screen
wastes their time and yours.

HOW MANY: the first argument if it is a number, otherwise three.

HOW THEY SHOULD DIFFER: the rest of the argument. If it is empty, vary the
thing that actually carries the design \u2014 layout and hierarchy \u2014 and not the
palette, and say that is what you chose.

For each variation:
- Build a REAL alternative, not a recolour. Two variations that differ by a
  font are one variation.
- \`isocan add <file> --title "<original title> \u2014 <what makes it different>"\`
  with \`--prop parent=<source item id>\`. That property is what makes it a
  child: /format will hang it under its source, and anyone can see where it
  came from.
- Give it a name that says the IDEA, not a number. "\u2014 single column" is worth
  reading; "\u2014 variation 2" is not.

Then run \`isocan format\` so they land under the original in the order you
made them, and post ONE comment on the thread: what you varied, what each one
is trying, and which you would keep and why. You looked at all three; say what
you saw.`,
    "grill-me": `Interview them until nothing is left silently assumed, then write the spec.

The procedure is Matt Pocock's \`grilling\` skill (github.com/mattpocock/skills,
MIT), adapted to a canvas thread. If you already have that skill, use it and
apply the thread notes at the bottom.

THE TREE AND THE FRONTIER. Map the work as a design tree: every decision
branches into the decisions that hang off it. The FRONTIER is every decision
whose prerequisites are already settled \u2014 the questions you can ask NOW without
guessing at answers you have not heard. A question whose answer depends on
another question still open belongs to a LATER round, not this one.

WORK IN ROUNDS. Ask the WHOLE frontier in one comment, numbered, each with your
recommended answer:

    \u2753 **Q1** \u2014 **<title>**: <the question, with options where there are any>

    \u27A1\uFE0F <what you would do, and why in one line>

    ---

    \u2753 **Q2** \u2014 **<title>**: \u2026

Then \`isocan wait --timeout 900\` and stop. Their answers reshape the tree:
settled decisions push the frontier outward and unblock what depended on them.
Recompute and ask the next round.

FINDING FACTS IS YOUR JOB, NEVER THEIRS. If a question needs something the
canvas can answer \u2014 what is already built, what a screen does, what the house
style says \u2014 go and look: \`isocan ls\`, \`isocan get\`, \`isocan style\`,
\`isocan activity\`. Asking somebody what is on their own canvas wastes the one
thing this costs, which is their attention. The DECISIONS are theirs; put each
one to them and wait.

ON A CANVAS, TWO CHANGES TO THE ABOVE:
- One comment per ROUND, not per question. Every round costs them a trip back
  to the thread, and every wait costs you a turn.
- Say where you are: "Round 2 of about 4" costs nothing and tells them how long
  this is.

DONE IS AN EMPTY FRONTIER. Then write the spec as an item \u2014
\`isocan add spec.md --title "<what it is> \u2014 spec" --prop parent=<the screen
it is about, if there is one>\` \u2014 covering what is being built and for whom,
every decision they made and WHY in their own words, what is explicitly out of
scope, and what is still open. Reply with #the-spec and the one thing to do
first.

Do not start building until they confirm you have understood the same thing.
The value is in the decisions, not the prose: a spec that says "clean, modern"
recorded nothing.`,
    "sprint": `Facilitate a design sprint on this canvas. You hold the clock; you never vote,
never sketch, and never decide.

The method is Knapp's Sprint (character.vc/guide/design-sprint) in AJ&Smart's
four-day cut, and the whole thing is a script over verbs you already have.
\`isocan sprint\` reads the state; \`isocan sprint phase\` sets it; the bell is
\`isocan wait\`. Read docs/research/2026-09-01-design-sprint.md if you have the
repo \u2014 it says why each rule below is there.

TWO WAYS THIS COMMAND IS TYPED. \`/sprint <phase> [8m] [note]\` \u2014 where <phase>
is one of map experts hmw target demos notes ideas crazy8s sketch museum
heatmap critique poll supervote storyboard prototype test wrap, or end \u2014 IS the
phase change: the clock chip and \`isocan sprint\` derive the current phase from
the newest such line in the Chat. Anything else after /sprint is a BRIEF for
you: what the team wants to design. Only you post phase lines.

SETUP, ONE ROUND \u2014 AND THE BOARD FIRST. Two things at once, in this order:
    isocan sprint board
lays the board: eleven sheets to the right of the work, one per stretch of
the week \u2014 Brief \xB7 Map \xB7 Experts & HMW \xB7 Target \xB7 Demos \xB7 Sketches \xB7 Vote \xB7
Storyboard \xB7 Prototype \xB7 Test \xB7 Wrap \u2014 each carrying a card that says what
happens there. The board IS the walkthrough: nobody in the room has to know
the method, because every sheet says what to do on it. Then, in one Chat
comment, ask and wait:
1. Who is the DECIDER \u2014 one person, named. Never you, never an agent.
2. Who is sketching \u2014 the people, and which agents by name. Agents sketch as
   peers under the same rules.
3. The long-term goal in one sentence, and the two or three sprint questions.
4. Which cut \u2014 four days, one day, or the one-hour version (hmw \u2192 ideas \u2192
   heatmap \u2192 poll \u2192 supervote). Default to one day if nobody says.
Write the answers onto the Brief sheet as they come:
    isocan sprint brief --goal "\u2026" --question "\u2026" --question "\u2026" --decider Maya --sketcher Theo --sketcher Nia --cut "one day"
Every call is a new VERSION of the one brief, never a second card. Then ask
for \u2705 on the brief, or "go", and do not call a phase before you have it.
\`isocan sprint --json\` shows the marks each vote uses (\u{1F534} heat map, \u2B50 straw
poll, \u{1F3C6} supervote); say them once so nobody invents a fourth.

THE CLOCK, AND THE WALK. Every phase begins with exactly one command:
    isocan sprint phase <phase> [duration] [note]
That posts the /sprint line to the Chat, which is the only thing that starts a
clock \u2014 and, with the board laid, it walks the room: everyone's camera glides
to the phase's sheet, and the clock chip offers the phase's one action (New
note on the phase's paper, in the sheet; Hand in, which lands the selection
on the sheet). You never need to say where to go or what to click; call the
phase and the board does that. \`isocan sprint\` names the sheet. Then read the seconds left and park on them:
    isocan wait --timeout $(isocan sprint --json | jq .remainingSeconds)
Exit 2 is the bell \u2014 call the next phase. A wake mid-box is somebody's question:
answer it and park again for what is left (\`isocan sprint --json\` again). A
phase with no clock (museum, supervote, prototype) runs until you call the next.

SILENCE IS THE METHOD. During hmw, notes, ideas, crazy8s and sketch:
- Do not post in the Chat \u2014 every parked sketcher wakes on it. Narrate with
  \`isocan session say "\u2026"\` instead; the chip shows the clock.
- Sketchers work ALONE, each on a DESK you give them before the first silent
  box: \`isocan sprint desk <name>\` makes a private canvas for that one
  person \u2014 link off, one pass in \u2014 and prints an address to hand to them and
  nobody else (a DM, never the Chat). An agent sketches in its own directory
  or on a desk of its own. Nothing lands on this canvas until the bell. At
  the bell each hands in \u2014 the desk's clock chip has a Hand in button that
  lands the selection on this sprint's sheet, or from a terminal
  \`isocan copy <items> --to <this canvas> --in <sheet> --handin\` \u2014 and you
  \`isocan format --in <sheet>\` once so the wall arrives together. Six
  arrivals at once beat six arrivals in a row.
- QUOTAS hold the wall to one voice each: eight frames in crazy8s, ONE solution
  sketch per sketcher. An agent that could make forty makes one. Check with
  \`isocan sprint\` (it counts hand-ins) and say so if somebody is over.
- An agent's sketch follows the paper rules: three panels, a title that says the
  idea, self-explanatory without its author. It may be a real HTML screen; it is
  still judged as a sketch, and polish is not a vote.

THE PHASES, AND THE VERB FOR EACH.
- map: \`isocan map new "<goal>"\`, actors left, ending right, 5\u201315 steps.
- experts: one thread per expert; personas (\`isocan persona ls\`) count as
  experts \u2014 interview them, don't debate. Everyone writes HMWs while listening:
  \`isocan text "HMW \u2026" --paper yellow\`, one idea per note. Cluster with
  \`isocan mv\`; two \u2B50 each; the Decider picks the target on the map.
- demos: three minutes each, \`isocan browse <url>\` for the thing worth
  stealing, one post-it saying what.
- notes, ideas, crazy8s, sketch: silent, above. Agents may run /variation-shaped
  work in THEIR directory; it lands here only as hand-ins.
- museum: \`isocan format\` the sketches in a row. Walk the room:
  \`isocan present <sketch>\` per sketch; people who want the tour follow YOU
  from the agent tray. Nobody presents their own.
- museum: before you call it, put the wall on the Vote sheet \u2014 \`isocan mv
  <sketches...> --in Vote\` then \`isocan format --in Vote\` \u2014 because the
  Vote sheet IS the wall: the curtain hides counts and names there and
  nowhere else.
- heatmap: \`isocan sprint phase heatmap 5m\`. Everyone places \u{1F534} on the PARTS
  they like, as many as they want, silently \u2014 the chip's "Place a \u{1F534}" then a
  click on the part, or \`isocan react \u{1F534} <sketch> --at 0.4,0.6\` (fractions
  of the sketch's box). The dots draw where they were put; under the curtain
  each person sees only their own, and all of them at the bell. You may read
  \`isocan sprint tally\` because you are the referee, not a voter.
- critique: three minutes per sketch, the room narrates, the author speaks last
  and only to say what was missed. A scribe (an agent is good at this) writes
  each big idea as \`isocan text --paper pink\` beside the sketch.
- poll: \`isocan sprint phase poll 2m\`. ONE \u2B50 each, chosen silently, placed at
  once. \`isocan sprint tally\` shows human and agent dots apart \u2014 agent dots
  are a second opinion, never the vote. Remind anybody wearing two.
- supervote: the Decider's \u{1F3C6}, up to three. Nobody else's counts. If the
  winner is a /variation child, \`isocan choose <winner>\` folds it home in one
  undoable gesture; otherwise mark it with \`isocan context pin\`.
- storyboard: \`isocan area grid Storyboard 1x15\` draws fifteen frames on the
  sheet; move the winning sketches in (\`isocan mv <sketch> --in Storyboard
  --cell 1,3\`) rather than redrawing, and a missing frame is a note in its
  cell (\`isocan text "\u2026" --in Storyboard --cell 1,7 --paper yellow\`). Then
  \`isocan slides add --in Storyboard\`: the deck is the row, in order.
- prototype: fan out \u2014 one agent per screen, one name each, said in the Chat
  first; a Stitcher runs \`isocan design check\` and \`isocan format\`; the
  trial run is the deck full screen.
- test: FIVE PEOPLE, interviewed by a person. Before the first interview,
  \`isocan area grid Test 5x15 --rows "<the five names>"\` \u2014 rows are people,
  columns are frames. Agents transcribe, never invent: one note per cell
  from what was said, \`isocan text "\u2026" --in Test --cell <person>,<frame>
  --paper yellow\`. Patterns need three of five; mark one with a reaction on
  the notes that show it.
- wrap: quote Monday's questions by #Title and answer each; \`isocan recap\` and
  \`isocan timeline --majors\` are the week's record. Then \`isocan sprint end\`.

WHAT YOU NEVER DO. Vote. Decide. Sketch. Post in the Chat during a silent box.
Extend a box because somebody asked \u2014 the bell is not negotiated; call another
box if the room truly needs one. Play a user. Hide the record: the log names
everyone, and "not shown while voting" is the honest promise.

Every phase you call, say in the same comment what happens in it and how long,
in one line. A room that knows the rules is a room that plays.`
  };
  return DEFAULT_COMMAND_CATALOGUE.map((command) => ({
    ...command,
    body: bodies[command.name]
  }));
}
var DEFAULT_COMMANDS = /* @__PURE__ */ builtInCommands();

// packages/core/src/shortcut.ts
function applePlatform(hint) {
  const raw = hint ?? (typeof navigator !== "undefined" ? navigator.userAgentData?.platform || navigator.platform || navigator.userAgent : (
    /* A terminal has no navigator, and `isocan shortcuts` prints this
               list into one. Answering "Ctrl" on a Mac's own terminal would be
               exactly the bug this file exists to remove, in the other
               direction.
    
               Read off `globalThis` rather than the `process` global: core is
               browser-safe and carries no node types, and a bare `process` here
               would make every surface that bundles core depend on them. */
    globalThis.process?.platform ?? ""
  ));
  return /mac|darwin|iphone|ipad|ipod/i.test(raw);
}
function cmdKey(hint) {
  return applePlatform(hint) ? "\u2318" : "Ctrl";
}
function shiftKey(hint) {
  return applePlatform(hint) ? "\u21E7" : "Shift";
}
var SPELLED = { "\u23CE": "Enter", "\u232B": "Backspace", "\u238B": "Esc" };
function shortcut(key, options = {}) {
  const apple = applePlatform(options.hint);
  const named2 = apple ? key : SPELLED[key] ?? key;
  if (apple) return `${options.shift ? "\u21E7" : ""}\u2318${named2}`;
  return `Ctrl+${options.shift ? "Shift+" : ""}${named2}`;
}
function modifierClick(hint) {
  return `${cmdKey(hint)}-click`;
}
function renderKeys(keys2, hint) {
  if (applePlatform(hint)) return keys2;
  const mods = [];
  let rest = keys2;
  for (const [glyph, word] of [["\u2318", "Ctrl"], ["\u2303", "Ctrl"], ["\u21E7", "Shift"], ["\u2325", "Alt"]]) {
    if (rest.includes(glyph)) {
      if (!mods.includes(word)) mods.push(word);
      rest = rest.split(glyph).join("");
    }
  }
  const key = SPELLED[rest] ?? rest;
  const parts = [...mods, key].filter((part) => part !== "");
  const separator = /^[+\-−=]$/.test(key) ? " " : "+";
  return parts.join(separator);
}

// packages/core/src/shortcuts.ts
var SHORTCUT_GROUPS = [
  "Tools",
  "Moving around",
  "Items",
  "Ink",
  "Talking"
];
var SHORTCUTS = [
  // ---- Tools ----
  { keys: ["V"], does: "Select", group: "Tools" },
  { keys: ["H", "Space"], does: "Hand \u2014 drag the canvas", group: "Tools", note: "Holding Space borrows it; let go and your tool comes back" },
  { keys: ["Z"], does: "Zoom \u2014 click an item to fit it, or drag a region", group: "Tools", note: "Tap to keep it, hold to borrow it" },
  { keys: ["P"], does: "Pen \u2014 draw on the canvas", group: "Tools", note: "HOLD P and everything you draw is ONE drawing, however long you take between strokes" },
  { keys: ["T"], does: "Text \u2014 click the canvas and type", group: "Tools", note: "double-click a text node to re-word it; \u2318Enter or click away to commit" },
  { keys: ["C"], does: "Comment \u2014 click anywhere to start a thread", group: "Tools" },
  { keys: ["\u21E7C"], does: "Comment on the selection", group: "Talking", note: "Anchored to the item, so the thread rides it when somebody moves it \u2014 and @-mentioning an agent there wakes it, the same as any other thread" },
  { keys: ["Esc"], does: "Back out: leave full screen, stop watching, close a popover, drop the tool, deselect", group: "Tools", note: "One layer per press, outermost first \u2014 and how you get back to Select" },
  // ---- Moving around ----
  { keys: ["\u2318+", "\u2318\u2212"], does: "Zoom in and out", group: "Moving around", note: "The canvas, never the browser" },
  { keys: ["F", "\u21E72"], does: "Fit the selection", group: "Moving around", note: "With nothing selected, fits everything" },
  { keys: ["\u23180", "0", "\u21E71"], does: "Fit everything", group: "Moving around" },
  { keys: ["W"], does: "Workbench \u2014 the agent room", group: "Moving around", note: "Who is here to work and what each is doing, the main thread beside them, and one item on a stage. A single selection comes along as the stage's focus; Esc steps back out" },
  { keys: ["\u21E70"], does: "Actual size (100%)", group: "Moving around" },
  {
    keys: ["\u2318O"],
    does: "Switch canvas",
    group: "Moving around",
    note: "The canvases you were on lately first, then the rest by activity; type a few letters to find one. Also \u2318K \u2192 Switch canvas\u2026, or the \u2304 beside the canvas's name"
  },
  {
    keys: ["\u2325A"],
    does: "Include archived canvases",
    group: "Moving around",
    note: "In the switcher, when anything is archived. For this opening only: it starts at the canvases in the list every time, the way `canvas list` does without --with-archived"
  },
  { keys: ["\u2318\u2190", "\u2318\u2192", "\u2318\u2191", "\u2318\u2193"], does: "Jump to the nearest item that way", group: "Moving around", note: "Only items clear of the edge you leave \u2014 something overlapping you is beside you, not above it. In full screen the next item opens full screen too: a row of screens is a slideshow" },
  { keys: ["\u2190", "\u2192", "\u2191", "\u2193"], does: "Flip through the slides", group: "Moving around", note: "Full screen only. Items marked \u{1F3AC} (right-click \u2192 Make this a slide) are the deck, in reading order; with none marked, every item is. Page Up/Down flip too, so a presenter's clicker works" },
  { keys: ["Scroll", "Pinch"], does: "Pan and zoom", group: "Moving around" },
  // ---- Items ----
  { keys: ["\u2318G"], does: "Group selection", group: "Items", note: "Wrap selected roots in a named frame, preserving their arrangement" },
  { keys: ["\u2318\u21E7G"], does: "Ungroup", group: "Items", note: "Dissolve the selected group frames and preserve their members" },
  { keys: ["\u21E7F10"], does: "Open selection menu", group: "Items", note: "The Menu key also opens it; arrows move and Enter chooses" },
  { keys: ["\u2190", "\u2192", "\u2191", "\u2193"], does: "Nudge the selection", group: "Items" },
  { keys: ["\u21E7-drag"], does: "Snap harder to the guides", group: "Items", note: "Blue says aligned; purple says the gaps match" },
  { keys: ["F2", "Double-click the name"], does: "Rename", note: "The file follows the title", group: "Items" },
  { keys: ["S"], does: "Show the version stack", group: "Items", note: "On an item with more than one version. Escape or S again closes it" },
  { keys: ["\u21E7F"], does: "Fit the item to its content", group: "Items", note: "F fits the view to an item; \u21E7F fits the item to what is in it. Several at once are settled so nothing overlaps" },
  { keys: ["\u21E7D"], does: "Download", group: "Items", note: "The item's current version, under the filename it carries \u2014 the one the version stack and a rename both follow" },
  { keys: ["Delete", "Backspace"], does: "Move the selection to the trash", group: "Items", note: "One undo for the whole selection" },
  { keys: ["\u2318Z", "\u2318\u21E7Z"], does: "Undo and redo", note: "Yours, not everyone's", group: "Items" },
  {
    keys: ["\u2318C"],
    does: "Copy the selection",
    group: "Items",
    note: "The arrangement is kept, so a row pastes as a row \u2014 and the clipboard survives moving to another canvas, which is how you take things between them"
  },
  {
    keys: ["\u2318V"],
    does: "Paste",
    group: "Items",
    note: "Onto this canvas or another one. One undo takes the whole paste back"
  },
  { keys: ["Scroll a selected item"], does: "Its content moves, not the canvas", group: "Items", note: "Only the wheel is handed over, so a drag still moves it. A page in a frame has to be entered first" },
  { keys: ["Double-click an item"], does: "Step inside it: scroll it, click its links", group: "Items", note: "Inline, without leaving the canvas. Enter gives it the whole screen instead" },
  { keys: ["Enter"], does: "Open the selection full screen", group: "Items", note: "On a group, enter its scope instead. Otherwise the address bar holds the screen you are on; Esc returns to the canvas" },
  { keys: ["\u2325-click"], does: "Reach the item underneath", group: "Items" },
  { keys: ["Drag a box"], does: "Select several", group: "Items" },
  // ---- Ink ----
  { keys: ["\u2318Z"], does: "Take back the last stroke", note: "While the ink is still wet", group: "Ink" },
  { keys: ["\u23CE"], does: "Settle the ink into an item now", note: "Rather than waiting out the pause", group: "Ink" },
  { keys: ["Draw over an item"], does: "Annotate it", note: "The mark travels with what it marks", group: "Ink" },
  // ---- Talking ----
  {
    keys: ["\u2318K"],
    does: "Open the launcher: fit, arm a tool, open a panel, switch canvas, or ask an agent",
    group: "Talking",
    note: "Type a few letters and press Enter. A slash command from here opens the Chat with it typed, ready for the rest"
  },
  {
    keys: ["\u2318J"],
    does: "Open or close the Chat",
    group: "Talking",
    note: "Shut, the rail is a 48px strip: what you have not read, and which agents are working"
  },
  { keys: ["\u23CE"], does: "Send it", group: "Talking", note: "\u21E7\u23CE makes a new line instead; the composer grows to hold it and drops back to one line once sent" },
  { keys: ["\u2318\u23CE"], does: "Send the comment you are writing", group: "Talking", note: "Works from a reply box too, where \u23CE is a new line" },
  { keys: ["@"], does: "Address someone", note: "They wake for it", group: "Talking" },
  { keys: ["#"], does: "Point at an item", note: "It rides along as a card", group: "Talking" },
  { keys: ["/"], does: "Signal on your cursor, or ask for a known piece of work", group: "Talking", note: "On the canvas, type a short message in place of your name for 20s (Esc clears); at the start of a message, opens slash commands" },
  { keys: ["?"], does: "This list", group: "Talking" }
];
function shortcutsIn(group) {
  return SHORTCUTS.filter((shortcut2) => shortcut2.group === group);
}
function keyFor(does) {
  const found = SHORTCUTS.find((shortcut2) => shortcut2.does === does);
  return found?.keys[0] ?? null;
}
function shortcutsAsText() {
  const keysOf = (s) => s.keys.map((key) => renderKeys(key)).join(" / ");
  const column = Math.max(...SHORTCUTS.map((s) => keysOf(s).length)) + 2;
  return SHORTCUT_GROUPS.map((group) => {
    const rows = shortcutsIn(group).map((s) => {
      const head = `  ${keysOf(s).padEnd(column)}${s.does}`;
      return s.note ? `${head}
  ${"".padEnd(column)}${s.note}` : head;
    });
    return `${group}
${rows.join("\n")}`;
  }).join("\n\n");
}

// packages/core/src/bytes.ts
var WHOLE_AT = 100;
var UNITS = ["KB", "MB", "GB", "TB"];
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unit = "B";
  for (const next of UNITS) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  return `${value.toFixed(value >= WHOLE_AT ? 0 : 1)} ${unit}`;
}

// packages/core/src/merge.ts
var UnmergeableError = class extends Error {
};
function pathsOf(svg) {
  return [...svg.matchAll(/<path\b[^>]*\/>/g)].map((match) => match[0]);
}
function mergeDrawings(parts) {
  if (parts.length === 0) throw new UnmergeableError("nothing to merge");
  const boxes = [];
  const paths = [];
  for (const part of parts) {
    const box2 = drawingViewBox(part.svg);
    if (!box2) throw new UnmergeableError(`${part.id} has no viewBox \u2014 not ink this canvas drew`);
    if (/<g\b/.test(part.svg) || /\btransform\s*=/.test(part.svg)) {
      throw new UnmergeableError(`${part.id} has groups or transforms \u2014 merging would move it`);
    }
    const found = pathsOf(part.svg);
    if (found.length === 0) throw new UnmergeableError(`${part.id} has no strokes in it`);
    boxes.push(box2);
    paths.push(...found);
  }
  const bounds = {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY))
  };
  const width = round2(bounds.maxX - bounds.minX);
  const height = round2(bounds.maxY - bounds.minY);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${round2(bounds.minX)} ${round2(bounds.minY)} ${width} ${height}">
${paths.map((path) => `  ${path}`).join("\n")}
</svg>
`;
  return { svg, bounds };
}
function round2(value) {
  return Math.round(value * 100) / 100;
}

// packages/core/src/onit.ts
function workersOn(sessions, threadId) {
  return sessions.filter((session) => session.onThread === threadId).map((session) => ({
    sessionId: session.sessionId,
    actorId: session.actor.id,
    name: session.label ?? session.actor.name,
    status: session.status,
    kind: session.kind,
    lastSeen: session.lastSeen
  }));
}
function listeners(sessions) {
  return sessions.filter((session) => session.kind === "cli");
}
function summonedBy(sessions, thread) {
  const last = thread.comments[thread.comments.length - 1];
  if (!last) return [];
  const agents = listeners(sessions).filter((session) => session.actor.id !== last.author.id);
  if (thread.main) return agents;
  const addressed = new Set(last.mentions ?? []);
  return agents.filter((session) => addressed.has(session.actor.id));
}
var CANCEL_COMMAND = "cancel";
function latestCancel(thread) {
  for (let i = thread.comments.length - 1; i >= 0; i--) {
    const comment = thread.comments[i];
    const parsed = parseSlashCommand(comment.body);
    if (parsed?.name === CANCEL_COMMAND) return comment;
  }
  return null;
}
function cancelledSince(thread, sinceISO) {
  const cancel = latestCancel(thread);
  if (!cancel) return null;
  if (sinceISO && cancel.createdAt <= sinceISO) return null;
  return cancel;
}

// packages/core/src/skillsource.ts
function skillSource(ref) {
  const trimmed = ref.trim();
  if (trimmed === "") return null;
  if (/^https?:\/\//i.test(trimmed)) {
    if (!/^https:\/\//i.test(trimmed)) return null;
    const blob = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i.exec(trimmed);
    if (blob) {
      const [, owner2, repo2, gitRef, path] = blob;
      return {
        url: `https://raw.githubusercontent.com/${owner2}/${repo2}/${gitRef}/${path}`,
        label: `${owner2}/${repo2}`
      };
    }
    try {
      const url2 = new URL(trimmed);
      return { url: trimmed, label: url2.host };
    } catch {
      return null;
    }
  }
  const parts = trimmed.split("/").filter((part) => part !== "");
  if (parts.length < 3) return null;
  if (!parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part) && part !== "." && part !== "..")) {
    return null;
  }
  const [owner, repo, ...rest] = parts;
  return {
    url: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${rest.join("/")}`,
    label: `${owner}/${repo}`
  };
}
function skillNameFrom(ref) {
  const path = ref.replace(/^https?:\/\/[^/]+\//i, "").split("?")[0] ?? "";
  const parts = path.split("/").filter((part) => part !== "");
  const file = parts[parts.length - 1] ?? "";
  const base2 = /^skill\.md$/i.test(file) ? parts[parts.length - 2] ?? "" : file.replace(/\.[a-z]+$/i, "");
  const name = base2.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return name === "" ? null : name;
}

// packages/core/src/designsystem.ts
var ROLE_PROP = "role";
var DESIGN_SYSTEM_ROLE = "design-system";
var LEGACY_DESIGN_ROLE = "house-style";
function designSystemProperties() {
  return { [ROLE_PROP]: DESIGN_SYSTEM_ROLE };
}
function isDesignSystem(item) {
  const role2 = item.properties[ROLE_PROP];
  return role2 === DESIGN_SYSTEM_ROLE || role2 === LEGACY_DESIGN_ROLE;
}
function withoutDesignRole(properties) {
  const role2 = properties[ROLE_PROP];
  if (role2 !== DESIGN_SYSTEM_ROLE && role2 !== LEGACY_DESIGN_ROLE) return properties;
  const { [ROLE_PROP]: _role, ...rest } = properties;
  return rest;
}
function designSystem(canvas, opts) {
  return selectDesignSystem(canvas, opts).item;
}
function designTargetScopes(canvas, opts = {}) {
  if (opts.groupId !== void 0) {
    if (opts.groupId === null) return { scopes: [] };
    const group = canvas.items[opts.groupId];
    if (!group || group.properties.kind !== "group" && !isArea(group)) return { scopes: [], unavailable: `The requested design scope ${opts.groupId} is unavailable.` };
    return { scopes: canvasScopes(canvas, group) };
  }
  const at2 = opts.at;
  if (!at2) return { scopes: [] };
  if ("id" in at2) {
    const current2 = canvas.items[at2.id];
    if (!current2) return { scopes: [], unavailable: `The design target ${at2.id} is unavailable.` };
    return { scopes: canvasScopes(canvas, current2) };
  }
  if (!Number.isFinite(at2.x) || !Number.isFinite(at2.y)) return { scopes: [], unavailable: "The proposed design location is invalid." };
  return { scopes: areasOf(canvas).filter((area) => at2.x >= area.x && at2.x < area.x + area.width && at2.y >= area.y && at2.y < area.y + area.height).sort((a, b) => a.width * a.height - b.width * b.height) };
}
function selectDesignSystem(canvas, opts = {}) {
  const target = designTargetScopes(canvas, opts);
  const empty = { item: null, level: "none", scopeId: null, scopeDepth: null, candidates: [] };
  if (target.unavailable) return { ...empty, status: "unavailable", reason: target.unavailable };
  const systems = Object.values(canvas.items).filter(isDesignSystem);
  const pick = (items, scope, depth) => {
    const candidates = [...items].sort((a, b) => a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0);
    if (!candidates.length) return null;
    const location = scope ? `${depth === 0 ? "direct scope" : "ancestor scope"} \u201C${scope.title}\u201D` : "canvas level";
    return { status: "selected", item: candidates[0], level: scope ? "scope" : "canvas", scopeId: scope?.id ?? null, scopeDepth: depth, candidates, reason: `Selected the newest system at ${location}.${candidates.length > 1 ? ` ${candidates.length} systems compete at this level.` : ""}` };
  };
  for (const [depth, scope] of target.scopes.entries()) {
    const selected = pick(systems.filter((item) => canvasScopes(canvas, item)[0]?.id === scope.id), scope, depth);
    if (selected) return selected;
  }
  return pick(systems.filter((item) => !canvasScopes(canvas, item).length), null, null) ?? { ...empty, status: "none", reason: "No local design system governs this target." };
}
function scopedDesignSystems(canvas) {
  return Object.values(canvas.items).filter(isDesignSystem).flatMap((item) => {
    const area = canvasScopes(canvas, item)[0];
    return area ? [{ area, item }] : [];
  });
}
var DESIGN_SYSTEM_AFTER = 2;
function needsDesignSystem(canvas, screens, project) {
  return designStanding(canvas, screens, project) !== "fine";
}
var DESIGN_SYSTEM_LIMIT = DESIGN_SYSTEM_AFTER * 3;
function designStanding(canvas, screens, project) {
  if (designSystem(canvas)) return "fine";
  if (project !== void 0 && designSkipped(project)) return "fine";
  if (screens >= DESIGN_SYSTEM_LIMIT) return "overdue";
  return screens >= DESIGN_SYSTEM_AFTER ? "owed" : "fine";
}
var DESIGN_SKIP_PROP = "design";
var DESIGN_SKIP_VALUE = "none";
function designSkipped(canvas) {
  return canvas.properties?.[DESIGN_SKIP_PROP] === DESIGN_SKIP_VALUE;
}
function designSkipPatch() {
  return { properties: { [DESIGN_SKIP_PROP]: DESIGN_SKIP_VALUE } };
}
function designUnskipPatch() {
  return { removeProperties: [DESIGN_SKIP_PROP] };
}

// packages/core/src/contextmark.ts
var CONTEXT_PROP = "context";
function contextMark(item) {
  const raw = item.properties?.[CONTEXT_PROP];
  return raw === "pinned" || raw === "excluded" ? raw : null;
}
function pinnedItems(canvas) {
  return Object.values(canvas.items).filter((item) => contextMark(item) === "pinned");
}
function excludedItems(canvas) {
  return Object.values(canvas.items).filter((item) => contextMark(item) === "excluded");
}
function markPatch(mark) {
  return mark === null ? { removeProperties: [CONTEXT_PROP] } : { properties: { [CONTEXT_PROP]: mark } };
}
function markLabel(mark) {
  return mark === "pinned" ? "pinned into context" : "kept out of context";
}

// packages/core/src/context-source.ts
var CONTEXT_SOURCE_PROP = "contextSource";
function parseContextSource(raw) {
  if (typeof raw !== "string" || raw.length > 4096) return null;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const row2 = value;
  const keys2 = ["home", "canvasId", "canvasTitle", "itemId", "itemTitle", "versionId"];
  const out = {};
  for (const key of keys2) {
    const field = row2[key];
    if (typeof field !== "string" || field.length === 0 || field.length > 1024) return null;
    out[key] = field;
  }
  return out;
}
function contextSourceOf(item) {
  return parseContextSource(item.properties?.[CONTEXT_SOURCE_PROP]);
}
function copiedContextItems(canvas) {
  return Object.values(canvas.items).flatMap((item) => {
    const source3 = contextSourceOf(item);
    return source3 && !excludedInAmbient(canvas, item) ? [{ item, source: source3 }] : [];
  }).sort((a, b) => a.item.y - b.item.y || a.item.x - b.item.x || a.item.id.localeCompare(b.item.id));
}

// packages/core/src/context-report.ts
function formatContextSource(source3) {
  return `copied from \u201C${source3.itemTitle}\u201D on ${source3.canvasTitle} (${source3.canvasId}) at ${source3.home}`;
}
function contextReport(pieces, nowMs = Date.now()) {
  const lines = [];
  const width = Math.max(...pieces.map((p) => p.name.length)) + 2;
  for (const piece of pieces) {
    const mark = piece.present ? piece.stale ? "!" : " " : "\xB7";
    const when = piece.updatedAt ? ` \xB7 ${ago(piece.updatedAt, nowMs)}` : "";
    const size = piece.present ? piece.size ?? "yes" : "not here";
    const beaten = piece.overridden ? ` (${piece.overridden})` : "";
    lines.push(`${mark} ${piece.name.padEnd(width)}${size}${when}${beaten}`);
    if (piece.recap) lines.push(formatRecapHead(piece.recap.head).replace(/^/gm, `  ${" ".repeat(width)}`));
    for (const one2 of piece.copied ?? []) lines.push(`  ${" ".repeat(width)}\u201C${one2.title}\u201D \u2014 ${formatContextSource(one2.source)}`);
    if (piece.stale) lines.push(`  ${" ".repeat(width)}${piece.stale}`);
    if (piece.fix && (piece.stale || !piece.present)) {
      lines.push(`  ${" ".repeat(width)}\u2192 ${piece.fix}`);
    }
  }
  return lines.join("\n");
}

// packages/core/src/context.ts
function markedItems(canvas) {
  return Object.values(canvas.items).filter(
    (item) => Object.keys(item.reactions ?? {}).length > 0
  );
}
function contextPieces(canvas, extras = {}, nowMs = Date.now()) {
  const pieces = [];
  const items = Object.values(canvas.items);
  const design = designSystem(canvas);
  if (design) {
    const newer = items.filter(
      (item) => item.id !== design.id && item.updatedAt > design.updatedAt
    ).length;
    pieces.push({
      name: "Design system",
      source: "canvas",
      present: true,
      size: `v${design.versions.length}`,
      updatedAt: design.updatedAt,
      ...newer >= 3 ? {
        stale: `${newer} items have changed since it was last written`,
        fix: "`isocan design set` after a look, or `/design-system` to derive one"
      } : {},
      ...extras.designProblems ? {
        stale: `${extras.designProblems} finding${extras.designProblems === 1 ? "" : "s"} from \`design check\``,
        fix: "`isocan design check` lists them"
      } : {}
    });
  } else {
    pieces.push({
      name: "Design system",
      source: "canvas",
      present: false,
      stale: items.length >= 2 ? "screens here, and nothing says what they should look like" : void 0,
      fix: "`/design-system` derives one from what these screens already do"
    });
  }
  const chat = mainThread(canvas);
  pieces.push({
    name: "The Chat",
    source: "canvas",
    present: chat !== null,
    ...chat ? {
      size: `${chat.comments.length} message${chat.comments.length === 1 ? "" : "s"}`,
      updatedAt: chat.comments[chat.comments.length - 1]?.createdAt ?? chat.createdAt
    } : {}
  });
  const pinned = ambientContextItems(canvas);
  pieces.push({
    name: "Pinned items",
    source: "canvas",
    present: pinned.length > 0,
    ...pinned.length > 0 ? { size: pinned.map((item) => item.title).join(", ") } : { fix: "`isocan context pin <item>` to say what an agent should read first" }
  });
  const copied = copiedContextItems(canvas);
  if (copied.length > 0) {
    pieces.push({
      name: "Copied from a source",
      source: "canvas",
      present: true,
      size: `${copied.length} item${copied.length === 1 ? "" : "s"}`,
      copied: copied.map(({ item, source: source3 }) => ({ itemId: item.id, title: item.title, source: source3 }))
    });
  }
  const marked = markedItems(canvas);
  pieces.push({
    name: "Marked items",
    source: "canvas",
    present: marked.length > 0,
    ...marked.length > 0 ? { size: `${marked.length}` } : {}
  });
  const excluded = excludedItems(canvas);
  if (excluded.length > 0) {
    pieces.push({
      name: "Excluded items",
      source: "canvas",
      present: true,
      size: excluded.map((item) => item.title).join(", ")
    });
  }
  pieces.push(...moduleContextPieces(canvas));
  pieces.push({
    name: "The canvas",
    source: "canvas",
    present: items.length > 0,
    size: `${items.length} item${items.length === 1 ? "" : "s"}`,
    ...items.length > 0 ? {
      updatedAt: items.reduce((latest, item) => item.updatedAt > latest ? item.updatedAt : latest, items[0].updatedAt)
    } : {}
  });
  if (extras.directory !== void 0) {
    pieces.push({
      name: "Bound directory",
      source: "machine",
      present: extras.directory !== null,
      ...extras.directory ? { size: extras.directory } : {},
      ...extras.directory === null ? { fix: "`isocan use <canvas>` binds this canvas to the directory you are in" } : {}
    });
  }
  if (extras.ops !== void 0) {
    pieces.push({
      name: "History",
      source: "canvas",
      present: extras.ops > 0,
      size: `${extras.ops} operation${extras.ops === 1 ? "" : "s"}`
    });
  }
  if (extras.guideVersion !== void 0) {
    pieces.push({
      name: "Agent guide",
      source: "cli",
      present: true,
      size: extras.guideVersion
    });
  }
  return pieces;
}

// packages/core/src/memory.ts
var MEMORY_PROP = "memory";
var MEMORY_INHERIT = "inherit";
var MEMORY_PERSONAL = "personal";
function memoryOf(item) {
  if (!isCanvasItem(item)) return null;
  const raw = item.properties?.[MEMORY_PROP];
  return raw === MEMORY_INHERIT || raw === MEMORY_PERSONAL ? raw : null;
}
function memoryLinks(canvas) {
  return linksOfKind(canvas, MEMORY_INHERIT);
}
function personalMemoryLinks(canvas) {
  return linksOfKind(canvas, MEMORY_PERSONAL);
}
function linksOfKind(canvas, kind) {
  return Object.values(canvas.items).filter((item) => memoryOf(item) === kind && !!canvasIdOf(item) && !excludedInAmbient(canvas, item)).sort((a, b) => a.y - b.y || a.x - b.x);
}
function personalContributions(canvas) {
  const design = designSystem(canvas);
  const pieces = [];
  if (design && !excludedInAmbient(canvas, design)) pieces.push({ kind: "design", item: design });
  const included = new Set(pieces.map(({ item }) => item.id));
  for (const item of ambientContextItems(canvas)) {
    if (included.has(item.id)) continue;
    included.add(item.id);
    pieces.push({ kind: "pin", item });
  }
  return pieces.map((piece) => ({
    ...piece,
    version: piece.item.versions.find((version) => version.id === piece.item.currentVersionId) ?? null
  }));
}
function personalCanvasItemOf(home, sourceCanvasId, owner) {
  const card = canvasItemOf(home, sourceCanvasId);
  return { ...card, title: `${owner.name}'s canvas`, properties: { ...card.properties, [MEMORY_PROP]: MEMORY_PERSONAL } };
}
function memoryPatch(memory) {
  return memory === null ? { removeProperties: [MEMORY_PROP] } : { properties: { [MEMORY_PROP]: memory } };
}
function inheritedPieces(linked, from, localHasDesign, recap) {
  const pieces = [];
  const ownPieces = contextPieces(linked);
  const design = designSystem(linked);
  const designPiece = ownPieces.find((piece) => piece.name === "Design system");
  if (design) {
    pieces.push({
      name: "Design system",
      source: "canvas",
      present: true,
      size: `v${design.versions.length}`,
      updatedAt: design.updatedAt,
      from,
      ...designPiece?.stale ? { stale: designPiece.stale, ...designPiece.fix ? { fix: designPiece.fix } : {} } : {},
      ...localHasDesign ? { overridden: "this canvas's wins" } : {}
    });
  }
  const pinned = ambientContextItems(linked);
  if (pinned.length > 0) {
    pieces.push({
      name: "Pinned items",
      source: "canvas",
      present: true,
      size: pinned.map((item) => item.title).join(", "),
      from
    });
  }
  const items = Object.values(linked.items);
  const excluded = ownPieces.find((piece) => piece.name === "Excluded items");
  if (excluded) pieces.push({ ...excluded, from });
  if (recap) pieces.push({
    name: "Recent work",
    source: "canvas",
    present: "value" in recap,
    ..."value" in recap ? { recap: recap.value, from: { canvasId: recap.value.canvasId, title: recap.value.title }, size: `${recap.value.head.count} operations` } : { from, stale: recap.refused }
  });
  pieces.push({
    name: "The canvas",
    source: "canvas",
    present: items.length > 0,
    size: `${items.length} item${items.length === 1 ? "" : "s"}`,
    from
  });
  return pieces;
}
function contextLayers(canvas, linked, extras = {}, nowMs = Date.now()) {
  const layers = [
    { kind: "local", canvasId: null, heading: "This canvas", pieces: contextPieces(canvas, extras, nowMs) }
  ];
  const localHasDesign = designSystem(canvas) !== null;
  for (const link of linked) {
    if (!link.canvas) {
      layers.push({
        kind: "inherited",
        canvasId: link.canvasId,
        itemId: link.item.id,
        heading: link.title,
        pieces: [],
        refused: link.refused ?? "could not be read"
      });
      continue;
    }
    layers.push({
      kind: "inherited",
      canvasId: link.canvasId,
      itemId: link.item.id,
      heading: link.title,
      pieces: inheritedPieces(link.canvas, { canvasId: link.canvasId, title: link.title }, localHasDesign, link.recap)
    });
  }
  return layers;
}
function governingDesign(canvas, linked, opts) {
  const selected = selectGoverningDesign(canvas, linked, opts);
  return selected.item ? { item: selected.item, from: selected.from } : null;
}
function selectGoverningDesign(canvas, linked, opts = {}) {
  const own2 = selectDesignSystem(canvas, opts), exempt = designSkipped(opts.project ?? {});
  const refusedSources = linked.flatMap((link) => !link.canvas ? [{ canvasId: link.canvasId, itemId: link.item.id, reason: link.refused ?? "The inherited canvas could not be read." }] : []);
  if (own2.status !== "none") return { ...own2, from: null, exempt, refusedSources };
  for (const link of linked) {
    if (!link.canvas) continue;
    const selected = selectDesignSystem(link.canvas);
    if (selected.item) return { ...selected, level: "inherited", from: { canvasId: link.canvasId, title: link.title }, exempt, refusedSources, reason: `First readable inherited system, from \u201C${link.title}\u201D. ${selected.reason}` };
  }
  return { ...own2, status: refusedSources.length ? "unavailable" : "none", from: null, exempt, refusedSources, reason: refusedSources.length ? "A possible inherited governing source could not be read." : "No design system governs this target." };
}
function layersReport(layers, report) {
  const out = [];
  for (const layer of layers) {
    out.push(contextLayerHeading(layer));
    if (layer.refused) out.push(`  ${layer.refused}`);
    else if (layer.pieces.length === 0) out.push(layer.kind === "personal" ? "  no personal contributions" : "  nothing to inherit");
    else out.push(report(layer.pieces).replace(/^/gm, "  "));
    out.push("");
  }
  return out.join("\n").trimEnd();
}
function contextLayerHeading(layer) {
  return layer.kind === "local" ? layer.heading : `${layer.heading} \u2014 ${layer.kind} (${layer.canvasId})`;
}
function contextLayerKey(layer) {
  return layer.kind === "local" ? "local" : `${layer.kind}:${layer.canvasId}:${layer.itemId}`;
}
function linkedCanvasId(item) {
  return memoryOf(item) === MEMORY_INHERIT ? canvasIdOf(item) : null;
}
var CONTEXT_SHEET_TITLE = "Context";
var CONTEXT_SHEET_SIZE = { width: 1760, height: 1400 };
function contextSheet(canvas) {
  return Object.values(canvas.items).find((item) => isGroupItem(item) && item.title === CONTEXT_SHEET_TITLE) ?? areasOf(canvas).find((area) => area.title === CONTEXT_SHEET_TITLE) ?? null;
}
function contextSheetSpot(canvas, size = CONTEXT_SHEET_SIZE) {
  const all = Object.values(canvas.items);
  const clear = all.every(
    (item) => item.x >= size.width || item.y >= size.height || item.x + item.width <= 0 || item.y + item.height <= 0
  );
  if (clear) return { x: 0, y: 0 };
  const left = Math.min(...all.map((item) => item.x)) - PLACEMENT_GAP - size.width;
  const top = Math.min(...all.map((item) => item.y));
  return { x: left, y: top };
}

// packages/core/src/design-scope.ts
var FIDELITY_PROP = "fidelity";
function isWireframeScreen(item) {
  return item.properties?.[FIDELITY_PROP] === "wireframe";
}
function designScopeStanding(canvas, screenItems, project, opts = {}) {
  const target = designTargetScopes(canvas, opts), scoped = opts.at !== void 0 || opts.groupId !== void 0;
  const scopeId = target.scopes[0]?.id ?? null, linked = opts.linked ?? [];
  const selection = selectGoverningDesign(canvas, linked, { ...opts, ...project ? { project } : {} });
  const screens = [...new Set(screenItems.map((item) => item.id))].flatMap((id) => {
    const item = canvas.items[id];
    return item && !isWireframeScreen(item) && (!scoped || (canvasScopes(canvas, item)[0]?.id ?? null) === scopeId) ? [item] : [];
  });
  const uncoveredIds = screens.filter((item) => !selectGoverningDesign(canvas, linked, { at: item }).item).map((item) => item.id);
  const count = scoped ? screens.length : uncoveredIds.length;
  const standing = designSkipped(project ?? {}) || scoped && selection.item || !uncoveredIds.length ? "fine" : count >= DESIGN_SYSTEM_LIMIT ? "overdue" : count >= DESIGN_SYSTEM_AFTER ? "owed" : "fine";
  return { standing, screenCount: screens.length, uncoveredIds, scopeId, selection };
}

// packages/core/src/preference.ts
var PREFERRED_OVER_PROP = "preferredOver";
function preferredOver(item) {
  const raw = item.properties[PREFERRED_OVER_PROP];
  if (typeof raw !== "string" || raw === "") return [];
  return raw.split(",").filter((id) => id !== "");
}
function preferPatch(winner, loserIds) {
  const already = preferredOver(winner);
  const fresh = loserIds.filter((id) => id !== winner.id && !already.includes(id));
  if (fresh.length === 0) return null;
  return { properties: { [PREFERRED_OVER_PROP]: [...already, ...fresh].join(",") } };
}
function unpreferPatch(winner, loserId) {
  const kept = preferredOver(winner).filter((id) => id !== loserId);
  if (kept.length === preferredOver(winner).length) return null;
  return kept.length === 0 ? { removeProperties: [PREFERRED_OVER_PROP] } : { properties: { [PREFERRED_OVER_PROP]: kept.join(",") } };
}
function preferences(canvas) {
  const out = [];
  for (const item of Object.values(canvas.items)) {
    for (const loserId of preferredOver(item)) out.push({ winnerId: item.id, loserId });
  }
  return out;
}
function standings(canvas) {
  const won = /* @__PURE__ */ new Map();
  for (const { winnerId } of preferences(canvas)) won.set(winnerId, (won.get(winnerId) ?? 0) + 1);
  return [...won.entries()].map(([itemId, n]) => ({ itemId, won: n })).sort((a, b) => b.won - a.won || a.itemId.localeCompare(b.itemId));
}

// packages/core/src/extensions.ts
var ROLE_PROP2 = "role";
var TOOL_ROLE = "tool";
function toolProperties() {
  return { [ROLE_PROP2]: TOOL_ROLE };
}
function isToolExtension(item) {
  return item.properties[ROLE_PROP2] === TOOL_ROLE;
}
var EXTENSION_ICONS = [
  "broom",
  "wand",
  "check",
  "star",
  "tag",
  "list",
  "eye",
  "bolt",
  "clock",
  "flag",
  "link",
  "note"
];
var LABEL_LIMIT = 24;
var RESERVED_LABELS = ["select", "hand", "zoom", "pen", "text", "comment", "add", "isocan"];
function flattened(label) {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function readToolExtension(text3, commands) {
  let parsed;
  try {
    parsed = JSON.parse(text3);
  } catch {
    return { problem: "not JSON \u2014 a tool is a small JSON file, see `isocan tool add --help`." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { problem: "not a JSON object \u2014 a tool is one object, not a list." };
  }
  const raw = parsed;
  if (raw.kind !== "tool") {
    return {
      problem: raw.kind === void 0 ? 'no "kind" \u2014 a tool declares `"kind": "tool"`.' : `"kind" is ${JSON.stringify(raw.kind)}; this reads tools${raw.kind === PANEL_ROLE ? " \u2014 a panel is added with `isocan panel add`" : ""}.`
    };
  }
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (!label) return { problem: 'no "label" \u2014 a button with no words on it is not a button.' };
  if (label.length > LABEL_LIMIT) {
    return { problem: `"label" is ${label.length} characters; a rail button holds ${LABEL_LIMIT}.` };
  }
  if (RESERVED_LABELS.includes(flattened(label))) {
    return {
      problem: `"${label}" is one of the app's own tools. An extension wears its own name, because a control that looks exactly like isocan is where somebody would put a convincing "sign in to continue".`
    };
  }
  const icon = raw.icon;
  if (typeof icon !== "string" || !EXTENSION_ICONS.includes(icon)) {
    return {
      problem: `"icon" must be one of the named set \u2014 ${EXTENSION_ICONS.join(", ")} \u2014 and not an image of your own, because an icon is a place anything at all could be painted.`
    };
  }
  const does = typeof raw.does === "string" ? raw.does.trim() : "";
  if (!does) return { problem: 'no "does" \u2014 a tool is a button plus the ask it makes.' };
  const ask = parseSlashCommand(does);
  if (!ask) {
    return { problem: `"does" is ${JSON.stringify(does)}; it must be a slash command, like "/format".` };
  }
  if (!COMMAND_NAME.test(ask.name)) {
    return { problem: `"/${ask.name}" is not a command name \u2014 lowercase letters, digits and dashes.` };
  }
  if (!findCommand(commands, ask.name)) {
    return {
      problem: `no command called "/${ask.name}" here. A tool may only ask for what a person could ask for, so it can name a command this canvas has and no other.`
    };
  }
  return { tool: { kind: "tool", label, icon, does } };
}
function toolCapabilities(tool, commands) {
  const ask = parseSlashCommand(tool.does);
  const command = ask ? findCommand(commands, ask.name) : null;
  const can = [];
  if (!command) {
    can.push(`asks for /${ask?.name ?? "?"}, which this canvas does not have`);
    return can;
  }
  if (command.local) {
    can.push(`answers in the app: ${command.description}`);
  } else {
    can.push(`posts a comment as you, asking an agent to: ${command.description}`);
    can.push("whatever that agent then does is attributed to it, and undoable per actor");
  }
  if (ask?.args) can.push(`always with the same words after it: "${ask.args}"`);
  can.push(`the command is ${command.source === "built-in" ? "one isocan ships" : command.source === "home" ? "this home's own" : "carried by a loaded module"}`);
  return can;
}
function toolExtensionItems(canvas) {
  return Object.values(canvas.items).filter(isToolExtension).sort((a, b) => a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id.localeCompare(b.id));
}
var PANEL_ROLE = "panel";
function panelProperties() {
  return { [ROLE_PROP2]: PANEL_ROLE };
}
function isPanelExtension(item) {
  return item.properties[ROLE_PROP2] === PANEL_ROLE;
}
var PANEL_SIDES = ["left"];
var TITLE_LIMIT = 32;
var RESERVED_TITLES = ["chat", "main", "files", "agents", "context", "personas", "isocan"];
var OFF_CANVAS = /^[a-z][a-z0-9+.-]*:|^\/\/|^\//i;
function readPanelExtension(text3, canvas) {
  let parsed;
  try {
    parsed = JSON.parse(text3);
  } catch {
    return { problem: "not JSON \u2014 a panel is a small JSON file, see `isocan panel add --help`." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { problem: "not a JSON object \u2014 a panel is one object, not a list." };
  }
  const raw = parsed;
  if (raw.kind !== "panel") {
    return {
      problem: raw.kind === void 0 ? 'no "kind" \u2014 a panel declares `"kind": "panel"`.' : `"kind" is ${JSON.stringify(raw.kind)}; this reads panels${raw.kind === TOOL_ROLE ? " \u2014 a tool is added with `isocan tool add`" : ""}.`
    };
  }
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return { problem: `no "title" \u2014 a panel with no name is a panel nobody can tell from the app's own.` };
  if (title.length > TITLE_LIMIT) {
    return { problem: `"title" is ${title.length} characters; a dock header holds ${TITLE_LIMIT}.` };
  }
  if (RESERVED_TITLES.includes(flattened(title))) {
    return {
      problem: `"${title}" is one of the app's own panels. An extension wears its own name, because a panel that looks exactly like isocan is where somebody would put a convincing "sign in to continue".`
    };
  }
  const side = raw.side;
  if (typeof side !== "string" || !PANEL_SIDES.includes(side)) {
    return {
      problem: `"side" must be one of the slots the app has \u2014 ${PANEL_SIDES.join(", ")} \u2014 because isocan draws the slot and a panel paints inside it and nowhere else.`
    };
  }
  const src = typeof raw.src === "string" ? raw.src.trim() : "";
  if (!src) return { problem: 'no "src" \u2014 a panel is a name plus the bytes it shows.' };
  if (OFF_CANVAS.test(src)) {
    return {
      problem: `"src" is ${JSON.stringify(src)}, which is somewhere else. A panel shows bytes that are already on this canvas \u2014 name an item here, because an extension may not read past the canvas it is on.`
    };
  }
  const named2 = Object.values(canvas.items).filter((item2) => item2.title === src);
  if (named2.length === 0) {
    return {
      problem: `"src" is ${JSON.stringify(src)}, and nothing on this canvas is called that. Add the page first \u2014 \`isocan add ${src}\` \u2014 because a panel may only show bytes this canvas already has.`
    };
  }
  if (named2.length > 1) {
    return {
      problem: `"src" is ${JSON.stringify(src)}, and ${named2.length} items here are called that. Rename one: a panel that could mean either is a panel whose bytes nobody can name.`
    };
  }
  const item = named2[0];
  const version = item.versions.find((v) => v.id === item.currentVersionId);
  if (!version) {
    return { problem: `"src" is ${JSON.stringify(src)}, which has no bytes on this canvas yet \u2014 a panel shows a version, and that item has none.` };
  }
  if (!version.mimeType.startsWith("text/html")) {
    return {
      problem: `"src" is ${JSON.stringify(src)}, which is ${version.mimeType}. A panel is a page, so its bytes are HTML.`
    };
  }
  return {
    panel: {
      kind: "panel",
      title,
      side,
      src,
      bytes: { itemId: item.id, blobHash: version.blobHash, filename: version.filename, mimeType: version.mimeType }
    }
  };
}
function panelCapabilities(panel) {
  return [
    `shows ${panel.bytes.filename} (${panel.bytes.itemId}): its bytes are an item on this canvas, and the manifest can name no other source`,
    `whoever may edit ${panel.src} decides what this panel shows, without touching this manifest \u2014 and its versions are the panel's history, so a bad one rolls back`,
    "cannot run yet: nothing renders a panel in this build, so these bytes are stored and read and never executed",
    "when it renders it will be a sandboxed page served from the content origin \u2014 never isocan's own origin, so it holds no badge and cannot act as you",
    `it will paint in the ${panel.side} dock and nowhere else: not over the canvas, the top bar or another panel`,
    "it cannot send an operation: the door a panel asks through is not built, so nothing it contains can change this canvas"
  ];
}
function panelExtensionItems(canvas) {
  return Object.values(canvas.items).filter(isPanelExtension).sort((a, b) => a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id.localeCompare(b.id));
}

// packages/core/src/media.ts
var BY_EXT = {
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime"
};
function mimeFromName(filename) {
  const ext = extensionOf(filename).slice(1).toLowerCase();
  if (!ext) return void 0;
  const added = moduleKinds().find((k) => k.extensions?.includes(ext));
  if (added) return added.mimes[0];
  return BY_EXT[ext];
}
function defaultSize(mimeType) {
  if (mimeType.startsWith("image/")) return { width: 480, height: 360 };
  if (mimeType.startsWith("video/")) return { width: 480, height: 270 };
  return { width: 420, height: 320 };
}

// packages/core/src/colour.ts
var SPOKEN_COLOURS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "brown",
  "black",
  "grey",
  "white"
];
var HUE_BUCKETS = [
  { from: 345, to: 360, colour: "red" },
  { from: 0, to: 15, colour: "red" },
  { from: 15, to: 45, colour: "orange" },
  { from: 45, to: 70, colour: "yellow" },
  { from: 70, to: 165, colour: "green" },
  { from: 165, to: 255, colour: "blue" },
  { from: 255, to: 320, colour: "purple" },
  { from: 320, to: 345, colour: "pink" }
];
var ACHROMATIC_SATURATION = 0.15;
var BLACK_LIGHTNESS = 0.07;
var WHITE_LIGHTNESS = 0.95;
var NEAR_BLACK_LIGHTNESS = 0.18;
var NEAR_WHITE_LIGHTNESS = 0.85;
var BROWN_MAX_LIGHTNESS = 0.4;
var PINK_MIN_LIGHTNESS = 0.75;
function toHsl(rgb) {
  const r2 = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r2, g, b);
  const min = Math.min(r2, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r2) h = 60 * ((g - b) / d % 6);
  else if (max === g) h = 60 * ((b - r2) / d + 2);
  else h = 60 * ((r2 - g) / d + 4);
  if (h < 0) h += 360;
  return { h, s, l };
}
function spokenColour(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const { h, s, l } = toHsl(rgb);
  if (l <= BLACK_LIGHTNESS) return "black";
  if (l >= WHITE_LIGHTNESS) return "white";
  if (s < ACHROMATIC_SATURATION) {
    if (l < NEAR_BLACK_LIGHTNESS) return "black";
    if (l > NEAR_WHITE_LIGHTNESS) return "white";
    return "grey";
  }
  const bucket = HUE_BUCKETS.find((b) => h >= b.from && h < b.to)?.colour ?? "red";
  if (bucket === "orange" && l < BROWN_MAX_LIGHTNESS) return "brown";
  if (bucket === "red" && l >= PINK_MIN_LIGHTNESS) return "pink";
  return bucket;
}
function inkColour(strokes) {
  const length = /* @__PURE__ */ new Map();
  for (const stroke of strokes) {
    const word = spokenColour(stroke.color);
    if (!word) continue;
    let run = 0;
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1];
      const b = stroke.points[i];
      run += Math.hypot(b.x - a.x, b.y - a.y);
    }
    if (stroke.points.length === 1) run = stroke.width;
    length.set(word, (length.get(word) ?? 0) + run);
  }
  let best = null;
  let most = 0;
  for (const word of SPOKEN_COLOURS) {
    const run = length.get(word);
    if (run !== void 0 && run > most) {
      best = word;
      most = run;
    }
  }
  return best;
}
function drawingProperties(strokes) {
  const inked = inkColour(strokes);
  return inked ? { ...DRAWING_PROPERTIES, [INK_PROP]: inked } : { ...DRAWING_PROPERTIES };
}
function itemColour(item) {
  if (item.ink && item.ink.length > 0) {
    const inked = inkColour(item.ink);
    if (inked) return inked;
  }
  const properties = item.properties ?? {};
  const ink = properties[INK_PROP];
  if (ink !== void 0 && SPOKEN_COLOURS.includes(ink)) {
    return ink;
  }
  for (const key of [PAPER_PROP, AREA_TINT_PROP]) {
    const raw = properties[key];
    if (isPaper(raw) && SPOKEN_COLOURS.includes(raw)) {
      return raw;
    }
  }
  return null;
}

// packages/core/src/designcheck.ts
function omittedSections(doc) {
  const out = /* @__PURE__ */ new Set();
  for (const entry of doc.tokens.omitted ?? []) {
    out.add(typeof entry === "string" ? entry.toLowerCase() : entry.section.toLowerCase());
  }
  return out;
}
function checkDesign(doc) {
  const findings = [];
  const { tokens } = doc;
  for (const problem of doc.problems) {
    findings.push({ severity: "error", where: "front matter", what: problem });
  }
  for (const problem of compileDesignContract(tokens).problems) {
    findings.push({ severity: "error", where: problem.path, what: problem.message });
  }
  if (!tokens.name) {
    findings.push({
      severity: "warning",
      where: "front matter",
      what: "the system has no name",
      fix: "add `name:` \u2014 it is what an agent cites when it says which system it built to"
    });
  }
  if (!tokens.colors || Object.keys(tokens.colors).length === 0) {
    findings.push({
      severity: "error",
      where: "colors",
      what: "no colour tokens",
      fix: "at least `primary` \u2014 the spec requires it, and prose alone cannot be graded against"
    });
  } else if (!tokens.colors.primary) {
    findings.push({
      severity: "warning",
      where: "colors",
      what: "no `primary` colour",
      fix: "name one palette `primary`, so anything reading this knows where to start"
    });
  }
  for (const [name, value] of Object.entries(tokens.colors ?? {})) {
    if (String(value).includes("{")) {
      const missing2 = unresolvedReferences(tokens, String(value));
      if (missing2.length > 0) {
        findings.push({
          severity: "error",
          where: `colors.${name}`,
          what: `points at ${missing2.join(" and ")}, which ${missing2.length === 1 ? "is" : "are"} not in this file`,
          fix: "fix the path, or inline the value"
        });
      }
      continue;
    }
    if (parseHex(String(value)) === null && !/^(rgba?|hsla?|hwb|oklch|oklab|lch|lab|color-mix|color)\(|^[a-z]+$/i.test(String(value).trim())) {
      findings.push({
        severity: "error",
        where: `colors.${name}`,
        what: `"${value}" is not a CSS colour`
      });
    }
  }
  for (const [component, props] of Object.entries(tokens.components ?? {})) {
    for (const [prop, value] of Object.entries(props)) {
      const missing2 = String(value).includes("{") ? unresolvedReferences(tokens, String(value)) : [];
      if (missing2.length > 0) {
        findings.push({
          severity: "error",
          where: `components.${component}.${prop}`,
          what: `points at ${missing2.join(" and ")}, which ${missing2.length === 1 ? "is" : "are"} not in this file`
        });
      }
    }
  }
  for (const [name, level] of Object.entries(tokens.typography ?? {})) {
    if (!level.fontSize) {
      findings.push({
        severity: "warning",
        where: `typography.${name}`,
        what: "no fontSize",
        fix: "a level without a size cannot be applied; give it one or drop it"
      });
    }
  }
  const ground = tokens.colors?.neutral ?? tokens.colors?.background ?? tokens.colors?.surface;
  const ink = tokens.colors?.primary;
  if (ground && ink) {
    const ratio = contrastRatio(String(ink), String(ground));
    if (ratio !== null && ratio < CONTRAST_BODY) {
      findings.push({
        severity: "error",
        where: "colors.primary",
        what: `${ratio}:1 against the ground \u2014 body text needs ${CONTRAST_BODY}:1`,
        fix: "darken the ink or lighten the ground; this is the one finding that excludes people"
      });
    }
  }
  const accent = tokens.colors?.tertiary ?? tokens.colors?.accent;
  if (ground && accent) {
    const ratio = contrastRatio(String(accent), String(ground));
    if (ratio !== null && ratio < CONTRAST_UI) {
      findings.push({
        severity: "warning",
        where: "colors.accent",
        what: `${ratio}:1 against the ground \u2014 a control's edge needs ${CONTRAST_UI}:1`
      });
    }
  }
  const excused = omittedSections(doc);
  const present = doc.sections.map((section) => section.title);
  for (const section of ["Overview", "Colors", "Typography"]) {
    if (!present.includes(section) && !excused.has(section.toLowerCase())) {
      findings.push({
        severity: "warning",
        where: section,
        what: "section missing",
        fix: `add "## ${section}" \u2014 the tokens say what, the prose says why`
      });
    }
  }
  const ranked = present.map((title) => DESIGN_SECTIONS.indexOf(title)).filter((index) => index >= 0);
  if (ranked.some((index, i) => i > 0 && index < ranked[i - 1])) {
    findings.push({
      severity: "note",
      where: "sections",
      what: "sections are out of the spec's order",
      fix: DESIGN_SECTIONS.join(" \u2192 ")
    });
  }
  return findings;
}
function bySeverity(findings) {
  const rank = { error: 0, warning: 1, note: 2 };
  return [...findings].sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// packages/core/src/fit.ts
function fitMoves(canvas, targets) {
  const growing = targets.map((t) => ({ t, item: canvas.items[t.itemId] })).filter((p) => Boolean(p.item)).sort((a, b) => a.item.y - b.item.y || a.item.x - b.item.x);
  const ids4 = new Set(growing.map((g) => g.t.itemId));
  const settled = Object.values(canvas.items).filter((i) => !ids4.has(i.id)).map((i) => ({ id: i.id, x: i.x, y: i.y, width: i.width, height: i.height }));
  const resizes = [];
  const moves = [];
  for (const { t, item } of growing) {
    if (item.width !== t.width || item.height !== t.height) {
      resizes.push({ itemId: t.itemId, width: t.width, height: t.height });
    }
    const want = { x: item.x, y: item.y, width: t.width, height: t.height };
    const at2 = nearestFreeSpot(want, settled);
    if (at2.x !== item.x || at2.y !== item.y) moves.push({ itemId: t.itemId, x: at2.x, y: at2.y });
    settled.push({ id: t.itemId, ...at2, width: t.width, height: t.height });
  }
  return { resizes, moves };
}

// packages/core/src/attest.ts
var ATTEST_ROUTE = "/api/attest";
var BAD_ID_TOKEN = "bad-id-token";
var NO_ATTESTER = "no-attester";
function grantSubjectOf(who) {
  const trimmed = who.trim();
  if (trimmed.startsWith("email:") || trimmed.startsWith("repo:")) return trimmed;
  if (trimmed.includes("@")) return `email:${trimmed}`;
  if (trimmed.split("/").length === 3) return `repo:${trimmed}`;
  return trimmed;
}

// packages/core/src/authaction.ts
var AUTH_ACTION_PATH = "/__/auth/action";
var AUTH_ACTION_PARAMS = ["mode", "oobCode", "apiKey", "continueUrl", "lang"];
var AUTH_ACTION_MODE = "signIn";
function authActionOutcome(query) {
  const mode = one(query, "mode");
  if (mode !== AUTH_ACTION_MODE) return { refusal: wrongMode(mode) };
  const code = one(query, "oobCode");
  if (!code) return { refusal: NO_CODE };
  return { redirect: landing(one(query, "continueUrl"), mode, code) };
}
var NOWHERE = "http://this-origin.invalid";
function landing(continueUrl, mode, code) {
  let url2;
  try {
    url2 = new URL(continueUrl ?? "", NOWHERE);
  } catch {
    url2 = new URL("/", NOWHERE);
  }
  const params = url2.searchParams;
  for (const key of AUTH_ACTION_PARAMS) params.delete(key);
  params.set("mode", mode);
  params.set("oobCode", code);
  const query = params.toString();
  return `${samePath(url2.pathname)}${query ? `?${query}` : ""}`;
}
function samePath(pathname) {
  return `/${pathname.replace(/^[/\\]+/, "")}`;
}
function one(query, key) {
  const raw = query instanceof URLSearchParams ? query.get(key) : query[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value : null;
}
var NO_CODE = "That sign-in link carries no code, so there is nothing here to sign in with. Ask for a fresh link.";
function wrongMode(mode) {
  return `This is isocan's sign-in handler, and it answers ${AUTH_ACTION_MODE} links only. That link asked for ${named(mode)}.

isocan has no password to reset and no address of its own to verify: signing in here borrows your inbox once and writes one row on the badge this browser already carries. There is no account behind it and nothing to recover.

If you were signing in, ask for a fresh link.`;
}
function named(mode) {
  if (mode === null) return "no mode at all";
  return /^[A-Za-z][A-Za-z0-9]{0,31}$/.test(mode) ? `\`${mode}\`` : "a mode this handler will not repeat";
}

// packages/core/src/operator.ts
var OPERATOR_PROOF_HEADER = "x-isocan-operator-proof";
var OPERATOR_PROOF_WINDOW_MS = 10 * 60 * 1e3;
var OPERATOR_SHOW_ROUTE = "/api/operator/canvases/:id";
var OPERATOR_LOG_ROUTE = "/api/operator/log";
var OPERATOR_API_PREFIX = "/api/operator/";
var NO_OPERATOR = "no-operator";
var NOT_OPERATOR = "not-operator";
var PROOF_STALE = "proof-stale";
var NO_OPERATOR_PROOF = "no-operator-proof";
var PROVE_PATH_PREFIX = "/operator/prove";
function encodeHandoff(handoff) {
  return base64url(JSON.stringify(handoff));
}
function decodeHandoff(segment) {
  try {
    const parsed = JSON.parse(unbase64url(segment));
    if (!parsed || typeof parsed !== "object") return null;
    const { to, state, act } = parsed;
    if (typeof to !== "string" || typeof state !== "string" || typeof act !== "string") return null;
    if (!to || !state) return null;
    return { to, state, act };
  } catch {
    return null;
  }
}
function provePath(handoff) {
  return `${PROVE_PATH_PREFIX}/${encodeHandoff(handoff)}`;
}
function proveSegmentIn(pathname) {
  if (!pathname.startsWith(`${PROVE_PATH_PREFIX}/`)) return null;
  const rest = pathname.slice(PROVE_PATH_PREFIX.length + 1);
  return rest.length > 0 ? rest.split("/")[0] : null;
}
function loopbackRefusal(to) {
  let url2;
  try {
    url2 = new URL(to);
  } catch {
    return `that is not an address this page can hand a sign-in to: ${shown(to)}`;
  }
  if (url2.protocol !== "http:") {
    return `this page hands a proof to a terminal on this machine and nowhere else, over http on a loopback address. That link asked for ${url2.protocol}//${url2.host}.`;
  }
  if (url2.username || url2.password) {
    return "that link carries a username or a password in its address, which no isocan terminal does.";
  }
  if (!isLoopbackHostname(url2.hostname)) {
    return `this page hands a proof to a terminal on this machine and nowhere else. That link asked for ${url2.hostname}, which is not a loopback address \u2014 so somebody else's machine was being asked to receive your sign-in.`;
  }
  return null;
}
function isLoopbackHostname(hostname) {
  if (hostname === "[::1]" || hostname === "::1") return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!v4) return false;
  const parts = v4.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return false;
  return parts[0] === 127;
}
function shown(raw) {
  const trimmed = raw.trim();
  return /^[\x20-\x7e]{1,80}$/.test(trimmed) ? `\`${trimmed}\`` : "an address this page will not repeat";
}
function base64url(text3) {
  const bytes = new TextEncoder().encode(text3);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unbase64url(segment) {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - padded.length % 4) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// packages/core/src/takedown.ts
var TAKEN_DOWN = "taken-down";
var TAKEDOWN_REASONS = {
  "stolen-content": "stolen content",
  "illegal-content": "illegal content",
  "sexual-content-involving-minors": "sexual content involving minors",
  "harassment": "harassment",
  "malware": "malware",
  "spam": "spam",
  "impersonation": "impersonation",
  "legal-demand": "a legal demand",
  "other": "a reason the operator did not put in this list"
};
function isTakedownReason(raw) {
  return Object.prototype.hasOwnProperty.call(TAKEDOWN_REASONS, raw);
}
function takedownReasonList() {
  return Object.keys(TAKEDOWN_REASONS).join(", ");
}
function inForce(row2) {
  return row2.liftedAt === void 0;
}
function noticeOf(row2) {
  return {
    canvasId: row2.canvasId,
    at: row2.at,
    reason: row2.reason,
    by: addressOf(row2.by),
    sentence: takedownSentence(row2)
  };
}
function takedownSentence(row2) {
  return `This canvas was taken down by the operator of this home on ${takedownDate(row2.at)}: ${TAKEDOWN_REASONS[row2.reason]}. Write to ${addressOf(row2.by)}.`;
}
function takedownDate(iso) {
  const at2 = new Date(iso);
  if (Number.isNaN(at2.getTime())) return iso;
  return `${at2.getUTCDate()} ${MONTHS2[at2.getUTCMonth()]} ${at2.getUTCFullYear()}`;
}
function takedownDateShort(iso) {
  const at2 = new Date(iso);
  if (Number.isNaN(at2.getTime())) return iso;
  return `${at2.getUTCDate()} ${MONTHS2[at2.getUTCMonth()].slice(0, 3)}`;
}
var MONTHS2 = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
function addressOf(attribute) {
  return attribute.replace(/^email:/, "");
}
var OPERATOR_TAKEDOWN_ROUTE = "/api/operator/canvases/:id/takedown";
var OPERATOR_LOOK_ROUTE = "/api/operator/canvases/:id/look";
var TAKEDOWNS_ROUTE = "/api/takedowns";
var TAKEDOWNS_CANVAS_PARAM = "canvas";
var OPERATOR_LOOK_MS = 60 * 60 * 1e3;
function operatorLookUrl(home, canvasId, token) {
  return urlWithPass(deckUrl(home.replace(/\/+$/, ""), canvasId), token);
}

// packages/core/src/purge.ts
var OPERATOR_PURGE_ROUTE = "/api/operator/canvases/:id/purge";
function replicasHorizon(relaying) {
  const seen = relaying === 0 ? "none was relaying when it came down" : `${relaying} ${relaying === 1 ? "was" : "were"} relaying when it came down`;
  return {
    kind: "replicas",
    days: null,
    sentence: `copies on members' machines are theirs \u2014 ${seen}, and a replica or an export somebody holds is not this home's to erase. A takedown never reached them either.`
  };
}
function purgeNeedsTakedown(canvasId) {
  return `purge erases; take ${canvasId} down first, so the erasure is the second of two deliberate acts. \`isocan operator takedown ${canvasId} --reason \u2026\``;
}

// packages/core/src/ended.ts
var ENDED = "ended";
var BADGE_ENDED = "badge-ended";
function badgeEndNotice(badgeId, at2, operator) {
  if (!operator) {
    return { badgeId, at: at2, by: "holder", sentence: endedSentence({ at: at2, by: "holder" }) };
  }
  const address = addressOf2(operator.by);
  return {
    badgeId,
    at: at2,
    by: "operator",
    reason: operator.reason,
    address,
    sentence: endedSentence({ at: at2, by: "operator", reason: operator.reason, address })
  };
}
function endedSentence(end) {
  const date = takedownDate(end.at);
  if (end.by === "operator" && end.reason && end.address) {
    return `This surface was ended by the operator of this home on ${date}: ${TAKEDOWN_REASONS[end.reason]}. Write to ${end.address}.`;
  }
  return `This surface was ended on ${date} from another of its holder's surfaces.`;
}
function addressOf2(attribute) {
  return attribute.replace(/^email:/, "");
}
var OPERATOR_END_ROUTE = "/api/operator/end/:target";

// packages/core/src/revoked.ts
var OPERATOR_REVOKE_ROUTE = "/api/operator/revoke/:target";
function revokedSentence(grant) {
  if (grant.revokedVia !== "operator" || !grant.revocation || !grant.revokedAt) return null;
  return `Turned off by the operator of this home on ${takedownDate(grant.revokedAt)}: ${TAKEDOWN_REASONS[grant.revocation.reason]}. Write to ${grant.revocation.by.replace(/^email:/, "")}.`;
}
function operatorTurnedOff(rows) {
  const live = new Set(rows.filter((row2) => row2.revokedAt === void 0 && !isBar(row2)).map((row2) => row2.subject));
  const newest = /* @__PURE__ */ new Map();
  for (const row2 of rows) {
    if (row2.revokedAt === void 0 || isBar(row2) || live.has(row2.subject)) continue;
    const seen = newest.get(row2.subject);
    if (!seen || row2.revokedAt > seen.revokedAt) newest.set(row2.subject, row2);
  }
  return [...newest.values()].filter((row2) => row2.revokedVia === "operator");
}

// packages/core/src/refusal.ts
var OPERATOR_REFUSE_ROUTE = "/api/operator/refuse/:subject";
var NET_REFUSAL_DEFAULT_MS = 24 * 60 * 60 * 1e3;
function refusalInForce(row2, now) {
  if (row2.liftedAt !== void 0) return false;
  if (row2.expiresAt !== void 0 && Date.parse(row2.expiresAt) <= now) return false;
  return true;
}
function refusalSubjectOf(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("email:")) {
    const address = trimmed.slice("email:".length).trim();
    if (!address.includes("@") || /\s/.test(address)) return null;
    return { subject: normalizeAttribute(`email:${address}`), kind: "email" };
  }
  if (trimmed.startsWith("repo:")) {
    const repo = trimmed.slice("repo:".length).trim();
    if (repo.split("/").length !== 3 || /\s/.test(repo)) return null;
    return { subject: normalizeAttribute(`repo:${repo}`), kind: "repo" };
  }
  if (trimmed.startsWith("actor:")) {
    const id = trimmed.slice("actor:".length).trim();
    if (!/^[A-Za-z0-9_-]+$/.test(id) || !id.includes("_")) return null;
    return { subject: `actor:${id}`, kind: "actor" };
  }
  if (trimmed.startsWith("net:")) {
    const cidr = parseCidr(trimmed.slice("net:".length).trim());
    if (!cidr) return null;
    return { subject: `net:${cidrText(cidr)}`, kind: "net" };
  }
  return null;
}
function refusalSubjectRefusal(raw) {
  if (refusalSubjectOf(raw)) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("net:")) {
    return `not a network: ${shown2(trimmed.slice(4))} \u2014 say net:<address>/<prefix>, like net:203.0.113.0/24 or net:2001:db8::/32`;
  }
  if (trimmed.startsWith("actor:")) {
    return `not an actor id: ${shown2(trimmed.slice(6))} \u2014 say actor:<id>, the usr_\u2026 or agt_\u2026 a report names`;
  }
  if (trimmed.startsWith("email:") || trimmed.startsWith("repo:")) {
    return `not an address: ${shown2(trimmed)} \u2014 say email:<address> or repo:<host>/<owner>/<name>`;
  }
  return `a refusal names one of four things: email:<address>, repo:<host>/<owner>/<name>, actor:<id>, or net:<cidr> \u2014 not ${shown2(trimmed)}`;
}
function shown2(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return "nothing";
  return /^[\x20-\x7e]{1,80}$/.test(trimmed) ? `\`${trimmed}\`` : "something this home will not repeat";
}
function parseCidr(text3) {
  const [address, rawPrefix, extra] = text3.trim().split("/");
  if (!address || extra !== void 0) return null;
  const parsed = parseAddress(address);
  if (!parsed) return null;
  const width = parsed.version === 4 ? 32 : 128;
  let prefix = width;
  if (rawPrefix !== void 0) {
    if (!/^\d{1,3}$/.test(rawPrefix)) return null;
    prefix = Number(rawPrefix);
    if (prefix > width) return null;
  }
  return { version: parsed.version, bits: mask(parsed.bits, prefix, width), prefix };
}
function cidrContains(cidr, address) {
  const parsed = parseAddress(address.trim());
  if (!parsed || parsed.version !== cidr.version) return false;
  const width = cidr.version === 4 ? 32 : 128;
  return mask(parsed.bits, cidr.prefix, width) === cidr.bits;
}
function cidrText(cidr) {
  return `${cidr.version === 4 ? v4Text(cidr.bits) : v6Text(cidr.bits)}/${cidr.prefix}`;
}
function mask(bits, prefix, width) {
  if (prefix === 0) return 0n;
  const keep = (1n << BigInt(prefix)) - 1n << BigInt(width - prefix);
  return bits & keep;
}
function parseAddress(text3) {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text3);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((n) => n > 255)) return null;
    return { version: 4, bits: parts.reduce((acc, n) => acc << 8n | BigInt(n), 0n) };
  }
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(text3);
  if (mapped) return parseAddress(mapped[1]);
  if (!text3.includes(":") || /[^0-9a-fA-F:]/.test(text3)) return null;
  const halves = text3.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const groups = halves.length === 2 ? [...head, ...Array(8 - head.length - tail.length).fill("0"), ...tail] : head;
  if (groups.length !== 8 || groups.some((g) => g === "" || g.length > 4)) return null;
  return { version: 6, bits: groups.reduce((acc, g) => acc << 16n | BigInt(parseInt(g, 16)), 0n) };
}
function v4Text(bits) {
  return [24n, 16n, 8n, 0n].map((shift) => String(bits >> shift & 0xffn)).join(".");
}
function v6Text(bits) {
  const groups = [];
  for (let i = 7; i >= 0; i -= 1) groups.push((bits >> BigInt(i * 16) & 0xffffn).toString(16));
  let best = { at: -1, len: 0 };
  for (let i = 0; i < 8; ) {
    if (groups[i] !== "0") {
      i += 1;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === "0") j += 1;
    if (j - i > best.len) best = { at: i, len: j - i };
    i = j;
  }
  if (best.len < 2) return groups.join(":");
  const before = groups.slice(0, best.at).join(":");
  const after = groups.slice(best.at + best.len).join(":");
  return `${before}::${after}`;
}
function parseRefusalDuration(text3) {
  const match = /^(\d+)(s|m|h|d)$/.exec(text3.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  if (amount <= 0) return null;
  const unit = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[match[2]];
  return amount * unit;
}
function refusalNoticeOf(row2) {
  return {
    subject: row2.subject,
    kind: row2.kind,
    at: row2.at,
    reason: row2.reason,
    by: addressOf3(row2.by),
    ...row2.expiresAt !== void 0 ? { expiresAt: row2.expiresAt } : {},
    sentence: refusalSentence(row2)
  };
}
function refusalSentence(row2) {
  const what = row2.kind === "net" ? "the network" : row2.kind === "actor" ? "the name" : "the address";
  const until = row2.expiresAt !== void 0 ? `, until ${refusalUntil(row2.expiresAt)}` : "";
  return `This home will not admit ${subjectShown(row2)} \u2014 its operator refused ${what} on ${takedownDate(row2.at)}: ${TAKEDOWN_REASONS[row2.reason]}${until}. Write to ${addressOf3(row2.by)}.`;
}
function refusalUntil(iso) {
  const at2 = new Date(iso);
  if (Number.isNaN(at2.getTime())) return iso;
  const hh = String(at2.getUTCHours()).padStart(2, "0");
  const mm = String(at2.getUTCMinutes()).padStart(2, "0");
  return `${takedownDate(iso)} ${hh}:${mm} UTC`;
}
function subjectShown(row2) {
  return row2.subject.replace(/^(email|repo|actor|net):/, "");
}
function addressOf3(attribute) {
  return attribute.replace(/^email:/, "");
}
var REFUSAL_LIMIT = "a stranger who proves nothing and enters by a link cannot be refused by who they are; turn the link off.";

// packages/core/src/lane.ts
var CLAIM_GRACE_MS = 12e4;
function nextWordFrom(thread, comment) {
  const later = thread.comments.filter((c) => c.author.id === comment.author.id && c.createdAt > comment.createdAt).map((c) => c.createdAt).sort();
  return later[0] ?? null;
}
function sinceFor(thread, comment) {
  const earlier = thread.comments.filter((c) => c.author.id === comment.author.id && c.createdAt < comment.createdAt).map((c) => c.createdAt).sort();
  const previous = earlier[earlier.length - 1];
  if (previous) return previous;
  return new Date(Date.parse(comment.createdAt) - CLAIM_GRACE_MS).toISOString();
}
function laneFor(canvas, thread, comment) {
  const until = nextWordFrom(thread, comment);
  const since = sinceFor(thread, comment);
  const entries = [];
  for (const itemId of comment.items ?? []) {
    const item = canvas.items[itemId];
    if (!item) continue;
    const mine = item.versions.filter(
      (v) => v.createdBy.id === comment.author.id && v.createdAt >= since && (until === null || v.createdAt < until)
    );
    if (mine.length === 0) continue;
    const last = mine[mine.length - 1];
    entries.push({
      itemId,
      title: item.title,
      version: item.versions.findIndex((v) => v.id === last.id) + 1,
      born: item.createdAt >= since && (until === null || item.createdAt < until)
    });
  }
  return entries;
}
function laneOf(canvas, thread) {
  return thread.comments.map((comment) => ({ comment, made: laneFor(canvas, thread, comment) })).filter((row2) => row2.made.length > 0);
}

// packages/core/src/frameable.ts
function readXFrameOptions(value) {
  if (value === null) return null;
  const directive = value.trim().toLowerCase().split(/[\s,;]+/)[0] ?? "";
  if (directive === "deny" || directive === "sameorigin") {
    return {
      ok: false,
      refusedBy: `x-frame-options: ${value.trim()}`,
      why: directive === "deny" ? "refuses to be shown in a frame anywhere" : "only allows itself to be framed by its own site"
    };
  }
  return null;
}
function readFrameAncestors(csp, self) {
  if (csp === null) return null;
  const directive = csp.split(";").map((part) => part.trim()).find((part) => part.toLowerCase().startsWith("frame-ancestors"));
  if (directive === void 0) return null;
  const sources = directive.split(/\s+/).slice(1);
  if (sources.length === 0) return null;
  if (sources.some((s) => s.toLowerCase() === "'none'")) {
    return {
      ok: false,
      refusedBy: `content-security-policy: ${directive}`,
      why: "refuses to be shown in a frame anywhere"
    };
  }
  if (sources.some((s) => s === "*")) return { ok: true };
  const allowed = self !== null && sources.some((s) => s === self || s === `${self}/`);
  if (allowed) return { ok: true };
  const shown3 = sources.slice(0, 2).join(", ");
  const rest = sources.length - 2;
  return {
    ok: false,
    refusedBy: `content-security-policy: ${directive}`,
    why: rest > 0 ? `only allows itself to be framed by ${shown3} and ${rest} other${rest === 1 ? "" : "s"}` : `only allows itself to be framed by ${shown3}`
  };
}
function frameVerdict(headers, self = null) {
  const csp = readFrameAncestors(headers.get("content-security-policy"), self);
  if (csp) return csp;
  const xfo = readXFrameOptions(headers.get("x-frame-options"));
  if (xfo) return xfo;
  return { ok: true };
}

// packages/core/src/moduleassets.ts
var ASSET_MAX_BYTES = 256 * 1024;
var ASSETS_MAX_BYTES = 2 * 1024 * 1024;
function assetProblems(assets) {
  const problems = [];
  let total = 0;
  for (const a of assets ?? []) {
    total += a.size;
    if (!/^assets\/[^\0]+$/.test(a.path) || a.path.split("/").includes("..")) problems.push(`${a.path} is not inside assets/`);
    if (a.size > ASSET_MAX_BYTES) problems.push(`${a.path} is ${a.size} bytes, over the ${ASSET_MAX_BYTES}-byte bound for one asset`);
  }
  if (total > ASSETS_MAX_BYTES) problems.push(`assets total ${total} bytes, over the ${ASSETS_MAX_BYTES}-byte bound for a module`);
  return problems;
}
function moduleAsset(moduleName, relative) {
  const base2 = moduleBase(moduleName);
  if (!base2) return null;
  const clean = relative.replace(/^\.?\//, "");
  if (clean.split("/").includes("..")) return null;
  return base2 + clean;
}

// packages/core/src/designimport.ts
var COLOUR_WORDS = [
  "color",
  "colour",
  "background",
  "foreground",
  "primary",
  "secondary",
  "accent",
  "muted",
  "destructive",
  "danger",
  "warning",
  "success",
  "info",
  "border",
  "ring",
  "input",
  "card",
  "popover",
  "surface",
  "ink",
  "text",
  "fill",
  "stroke",
  "shadow",
  "overlay",
  "brand",
  "neutral",
  "gray",
  "grey"
];
var RADIUS_WORDS = ["radius", "rounded", "corner"];
var SPACING_WORDS = ["spacing", "space", "gap", "gutter", "inset", "size"];
var TYPE_WORDS = ["font", "text-size", "leading", "tracking", "type"];
var HSL_TRIPLET = /^-?[\d.]+\s+-?[\d.]+%\s+-?[\d.]+%$/;
var LOOKS_LIKE_COLOUR = /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\(|transparent$|currentcolor$)/i;
var LOOKS_LIKE_LENGTH = /^-?[\d.]+(px|rem|em|%|vh|vw|ch|pt)$/;
function has(name, words) {
  const flat = name.toLowerCase();
  return words.some((w) => flat.includes(w));
}
function normaliseColour(value) {
  return HSL_TRIPLET.test(value.trim()) ? `hsl(${value.trim().replace(/\s+/g, " ")})` : value.trim();
}
function classifyToken(name, value) {
  const v = value.trim();
  if (LOOKS_LIKE_COLOUR.test(v)) return "colors";
  if (HSL_TRIPLET.test(v) && has(name, COLOUR_WORDS)) return "colors";
  if (has(name, RADIUS_WORDS)) return "rounded";
  if (has(name, TYPE_WORDS)) return "typography";
  if (LOOKS_LIKE_LENGTH.test(v)) return has(name, SPACING_WORDS) ? "spacing" : "spacing";
  if (has(name, COLOUR_WORDS)) return "colors";
  return null;
}
function tidyName(name) {
  return name.replace(/^--/, "").trim();
}
function readCssTokens(css) {
  const found = /* @__PURE__ */ new Map();
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of clean.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
    found.set(match[1], match[2].trim());
  }
  return found;
}
function walkDtcg(node, path, out) {
  if (node === null || typeof node !== "object") return;
  const record2 = node;
  if ("$value" in record2) {
    const value = record2.$value;
    const type = typeof record2.$type === "string" ? record2.$type : null;
    if (typeof value === "string" || typeof value === "number") {
      out.set(path.join("."), { value: String(value), ...type ? { type } : {} });
      return;
    }
    const asColor = dtcgColorString(value);
    if (asColor !== void 0 && (type === "color" || type === null)) {
      out.set(path.join("."), { value: asColor, type: "color" });
      return;
    }
    const asDimension = dtcgDimensionString(value);
    if (asDimension !== void 0) {
      out.set(path.join("."), { value: String(asDimension), ...type ? { type } : { type: "dimension" } });
      return;
    }
    if (type === "typography" && value && typeof value === "object") {
      for (const [prop, raw] of Object.entries(value)) {
        const flat = typeof raw === "string" || typeof raw === "number" ? String(raw) : dtcgDimensionString(raw);
        if (flat !== void 0) out.set([...path, prop].join("."), { value: String(flat), type: "typography" });
      }
      return;
    }
    out.set(path.join("."), { value: "", type: "composite" });
    return;
  }
  for (const [key, child] of Object.entries(record2)) {
    if (key.startsWith("$")) continue;
    walkDtcg(child, [...path, key], out);
  }
}
function detectFormat(text3) {
  const trimmed = text3.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "dtcg";
  return "css";
}
function importedName(source3) {
  return source3.replace(/\.[^.]+$/, "").replace(/[-_.]+/g, " ").trim();
}
function importDesign(text3, source3) {
  const format = detectFormat(text3);
  const tokens = source3 ? { name: importedName(source3) } : {};
  const problems = [];
  const notes = format === "css" ? ["CSS import reads token values only and cannot restore isocan policies, recipes, exceptions or other extension data. Use the native DESIGN.md or vendor-extended DTCG JSON to retain a contract."] : [];
  const put = (bucket, key, value) => {
    if (bucket === "typography") {
      const roles = tokens.typography ??= {};
      const role2 = roles[key] ??= {};
      if (/family/i.test(key)) role2.fontFamily = value;
      else if (/size/i.test(key)) role2.fontSize = value;
      else if (/weight/i.test(key)) role2.fontWeight = value;
      else if (/leading|line/i.test(key)) role2.lineHeight = value;
      else if (/tracking|letter/i.test(key)) role2.letterSpacing = value;
      else role2.fontFamily = value;
      return;
    }
    const into = tokens[bucket] ??= {};
    into[key] = value;
  };
  if (format === "dtcg") {
    let parsed;
    try {
      parsed = parseDesignJson(text3);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("DTCG must be a JSON object");
    } catch (err) {
      return { tokens, problems: [`not valid JSON: ${err.message}`], notes, format };
    }
    const document = parsed;
    const extensions = document.$extensions;
    const ours = extensions?.[DTCG_EXTENSION];
    const nativeGroups = /* @__PURE__ */ new Set(["color", "colors", "spacing", "rounded", "typography"]);
    if (ours !== void 0) {
      try {
        Object.assign(tokens, fromDtcg(document));
      } catch (error) {
        return { tokens, problems: [error.message], notes, format };
      }
    }
    const leaves = /* @__PURE__ */ new Map();
    walkDtcg(parsed, [], leaves);
    if (leaves.size === 0 && !ours) problems.push("no tokens found \u2014 expected objects carrying `$value`");
    for (const [path, leaf] of leaves) {
      const group = path.split(".")[0];
      if (ours && nativeGroups.has(group)) {
        const bucket2 = group === "color" ? "colors" : group;
        const restored = Object.keys(tokens[bucket2] ?? {}).some((key) => path === `${group}.${key}` || bucket2 === "typography" && path.startsWith(`${group}.${key}.`));
        if (!restored) problems.push(`${path}: unsupported native DTCG value could not be restored; preserved contract references may be unresolved`);
        continue;
      }
      if (leaf.type === "composite") {
        problems.push(`${path}: a composite value (shadow, gradient) has no home in DESIGN.md yet`);
        continue;
      }
      const declared = leaf.type === "color" ? "colors" : leaf.type === "dimension" ? has(path, RADIUS_WORDS) ? "rounded" : "spacing" : leaf.type === "fontFamily" || leaf.type === "typography" ? "typography" : null;
      const bucket = declared ?? classifyToken(path, leaf.value);
      if (bucket === null) {
        problems.push(`${path}: could not tell what kind of token this is (${leaf.value})`);
        continue;
      }
      put(bucket, path, bucket === "colors" ? normaliseColour(leaf.value) : leaf.value);
    }
    return { tokens, problems, notes, format };
  }
  const props = readCssTokens(text3);
  if (props.size === 0) problems.push("no custom properties found \u2014 expected `--name: value` declarations");
  for (const [name, value] of props) {
    const key = tidyName(name);
    const bucket = classifyToken(key, value);
    if (bucket === null) {
      problems.push(`--${key}: could not tell what kind of token this is (${value})`);
      continue;
    }
    put(bucket, key, bucket === "colors" ? normaliseColour(value) : value);
  }
  return { tokens, problems, notes, format };
}
function importedBody(source3, tokens) {
  const colours = Object.keys(tokens.colors ?? {}).length;
  const type = Object.keys(tokens.typography ?? {}).length;
  return `## Overview

Imported from \`${source3}\`: ${colours} colour${colours === 1 ? "" : "s"}, ${type} type role${type === 1 ? "" : "s"}.

**The tokens are real; this prose is a starting point.** What a house has
actually agreed \u2014 when to use the accent, what a card may not do, which of
these colours is never a background \u2014 is not in a palette, and an import
cannot invent it. Replace these sections as the canvas learns its own rules.

## Colors

The imported palette. \`isocan design check\` reads contrast from here, so a
pair that fails is a pair to fix rather than one to work around.

## Typography

\`isocan design check\` will name what the theme did not carry \u2014 a type role
with no size, a pair whose contrast fails. Those are not import errors; they
are the parts of a design system that live in a house's head rather than in
its stylesheet, and they are the first things worth writing down here.

## Layout

## Components
`;
}

// packages/core/src/converge.ts
function convergePlan(canvas, chosenId) {
  const chosen = canvas.items[chosenId];
  if (!chosen) return { refused: `no item ${chosenId} on this canvas` };
  const parentId = parentOf(chosen);
  if (parentId === null) {
    return {
      refused: `"${chosen.title}" was not made from anything \u2014 there is nothing to fold it back into`
    };
  }
  const parent = canvas.items[parentId];
  if (!parent) {
    return {
      refused: `"${chosen.title}" was made from an item that is no longer on the canvas`
    };
  }
  const version = chosen.versions.find((v) => v.id === chosen.currentVersionId) ?? chosen.versions[0];
  if (!version) return { refused: `"${chosen.title}" has no content to fold in` };
  const family = childrenOf(canvas, parentId).map((item) => item.id);
  const trash = family.includes(chosenId) ? family : [chosenId, ...family];
  return {
    parentId,
    version,
    trash,
    label: `chose ${chosen.title}`
  };
}
function isRefusal(plan2) {
  return "refused" in plan2;
}

// packages/core/src/itemthread.ts
function atCorner(canvas, thread) {
  const item = thread.anchorItemId ? canvas.items[thread.anchorItemId] : void 0;
  return item ? thread.x >= item.width && thread.y <= 0 : false;
}
function itemThread(canvas, itemId) {
  const mine = Object.values(canvas.threads).filter((thread) => !thread.main && !thread.textAnchor && thread.anchorItemId === itemId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return mine.find((thread) => atCorner(canvas, thread)) ?? mine[0] ?? null;
}

// packages/core/src/claim.ts
function bindVerdict(claim, canvasId) {
  if (!claim) return "free";
  return claim.canvasId === canvasId ? "adopt" : "taken";
}
function claimName(claim) {
  return claim.title && claim.title.trim() !== "" ? claim.title : claim.canvasId;
}
function takenSentence(root, claim) {
  return `${root} already belongs to ${claimName(claim)}`;
}

// packages/core/src/persona.ts
var PERSONA_DIR = ".agents/personas";
var PERSONA_DOORWAY = ".claude/agents";
function splitFrontMatter(text3) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text3);
  if (!match) return null;
  return { front: match[1], body: text3.slice(match[0].length) };
}
function readFront(front) {
  const out = /* @__PURE__ */ new Map();
  let key = null;
  for (const raw of front.split(/\r?\n/)) {
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue;
    const indented = /^\s/.test(raw);
    if (!indented) {
      const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(raw);
      if (!m) continue;
      key = m[1];
      out.set(key, m[2].trim() === "" ? [] : [m[2].trim()]);
      continue;
    }
    if (key) out.get(key).push(raw.trim());
  }
  return out;
}
var unquote = (s) => s.replace(/^["']|["']$/g, "").trim();
function parseBound(text3) {
  const m = /^(at most|at least)\s+([0-9]+(?:\.[0-9]+)?)\s*([%a-zA-Z]*)$/.exec(text3.trim());
  if (!m) return null;
  return {
    bound: { kind: m[1], value: Number(m[2]) },
    ...m[3] ? { unit: m[3] } : {}
  };
}
function readGoals(lines) {
  const goals = [];
  let current2 = null;
  const flush = () => {
    if (!current2) return;
    const name = current2["name"];
    const measuredBy = current2["measured by"] ?? current2["measuredBy"];
    const boundText = current2["at most"] !== void 0 ? `at most ${current2["at most"]}` : current2["at least"] !== void 0 ? `at least ${current2["at least"]}` : "";
    const parsed = parseBound(boundText);
    if (name && measuredBy && parsed) {
      goals.push({
        name,
        bound: parsed.bound,
        measuredBy,
        ...parsed.unit ? { unit: parsed.unit } : {},
        ...current2["against"] ? { against: current2["against"] } : {},
        ...current2["baseline"] ? (() => {
          const [value, at2, commit] = current2["baseline"].split(/\s*,\s*/);
          return Number.isFinite(Number(value)) && at2 ? { baseline: { value: Number(value), at: at2, ...commit ? { commit } : {} } } : {};
        })() : {}
      });
    }
    current2 = null;
  };
  for (const line of lines) {
    const start = /^-\s*(.*)$/.exec(line);
    if (start) {
      flush();
      current2 = {};
      if (start[1]) {
        const m2 = /^([^:]+):\s*(.*)$/.exec(start[1]);
        if (m2) current2[m2[1].trim()] = unquote(m2[2]);
      }
      continue;
    }
    const m = /^([^:]+):\s*(.*)$/.exec(line);
    if (m && current2) current2[m[1].trim()] = unquote(m[2]);
  }
  flush();
  return goals;
}
function readTrigger(lines) {
  if (!lines || lines.length === 0) return { kind: "manual" };
  const kv = /* @__PURE__ */ new Map();
  for (const line of lines) {
    const m = /^([^:]+):\s*(.*)$/.exec(line);
    if (m) kv.set(m[1].trim(), unquote(m[2]));
  }
  const cron = kv.get("cron") ?? kv.get("schedule");
  if (cron) return { kind: "schedule", cron };
  if (kv.get("on") === "push") {
    const paths = kv.get("paths");
    return {
      kind: "push",
      to: kv.get("to") ?? "main",
      ...paths ? { paths: paths.split(/\s*,\s*/).filter(Boolean) } : {}
    };
  }
  return { kind: "manual" };
}
function parsePersona(text3, filename) {
  const split = splitFrontMatter(text3);
  if (!split) return null;
  const front = readFront(split.front);
  const one2 = (key) => front.get(key)?.[0];
  const stem = filename.replace(/\.md$/i, "").split("/").pop() ?? filename;
  const known = /* @__PURE__ */ new Set(["name", "description", "model", "effort", "tools", "goal", "goals", "trigger", "runs", "color"]);
  const extra = {};
  for (const [key, value] of front) {
    if (!known.has(key)) extra[key] = value.join("\n");
  }
  return {
    name: one2("name") ?? stem,
    description: one2("description") ?? "",
    ...one2("model") !== void 0 ? { model: one2("model") } : {},
    ...one2("effort") !== void 0 ? { effort: one2("effort") } : {},
    tools: (one2("tools") ?? "").split(/\s*,\s*/).map((t) => t.trim()).filter(Boolean),
    goals: readGoals(front.get("goal") ?? front.get("goals") ?? []),
    trigger: readTrigger(front.get("trigger")),
    ...one2("runs") !== void 0 ? { runs: one2("runs") } : {},
    body: split.body,
    extra
  };
}
function goalLine(goal) {
  const unit = goal.unit ?? "";
  const target = `${goal.bound.kind} ${goal.bound.value}${unit}` + (goal.against ? ` of what \`${goal.against}\` prints` : "");
  if (!goal.baseline) return `${goal.name} \u2014 ${target}, never measured`;
  const met = goal.bound.kind === "at most" ? goal.baseline.value <= goal.bound.value : goal.baseline.value >= goal.bound.value;
  return `${goal.name} \u2014 ${target}; was ${goal.baseline.value}${unit} on ${goal.baseline.at}${met ? "" : " \u2014 MISSED"}`;
}
function personaWarnings(persona) {
  const out = [];
  if (persona.goals.length === 0) {
    out.push("no goal \u2014 this persona cannot report a number, only prose");
  }
  const unmeasured = persona.goals.filter((g) => !g.baseline);
  if (unmeasured.length > 0) {
    out.push(
      `${unmeasured.length} goal${unmeasured.length === 1 ? "" : "s"} never measured \u2014 run it once and record the baseline, or the bound is a guess`
    );
  }
  if (persona.trigger.kind === "manual" && persona.goals.length > 0) {
    out.push("no trigger \u2014 somebody has to remember to run it");
  }
  return out;
}
function withBaseline(persona, goalName, reading) {
  return {
    ...persona,
    goals: persona.goals.map((g) => g.name === goalName ? { ...g, baseline: reading } : g)
  };
}
var OUTCOMES = /* @__PURE__ */ new Set(["accepted", "rejected", "unanswered"]);
function runFindings(page) {
  const start = page.indexOf("## Findings");
  if (start < 0) return [];
  const out = [];
  for (const line of page.slice(start).split(/\r?\n/)) {
    if (line.startsWith("#") && !line.startsWith("## Findings")) break;
    const cells = /^\|([^|]*)\|([^|]*)\|\s*$/.exec(line);
    if (!cells) continue;
    const finding = cells[1].trim();
    const outcome = cells[2].trim().toLowerCase();
    if (finding === "" || finding === "\u2014" || finding === "Finding" || /^-+$/.test(finding)) continue;
    out.push({
      finding,
      outcome: OUTCOMES.has(outcome) ? outcome : "unanswered"
    });
  }
  return out;
}
function tallyOutcomes(findings) {
  const tally2 = { accepted: 0, rejected: 0, unanswered: 0 };
  for (const f of findings) tally2[f.outcome] += 1;
  return tally2;
}

// packages/core/src/inbox.ts
function namesFor(actor, label) {
  const names = [actor];
  if (label && label !== actor.name) names.push({ id: actor.id, name: label });
  return names;
}
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
var LISTEN_ANYONE = "*";
function parseListen(entry) {
  if (typeof entry === "string") return { id: entry };
  const until = entry.until;
  return until !== void 0 && Number.isFinite(Date.parse(until)) ? { id: entry.id, until } : { id: entry.id };
}
function spellListen(id, until) {
  return until ? { id, until } : id;
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
function withListener(policy, actorId, admit2, opts) {
  const joined = opts?.joined;
  const now = opts?.now ?? Date.now();
  const standing = policy.listen.filter((e2) => e2 !== LISTEN_ANYONE);
  if (actorId === LISTEN_ANYONE) {
    if (!admit2) return standing.filter((e2) => !grantLapsed(parseListen(e2), now));
    return [LISTEN_ANYONE];
  }
  const others = standing.filter((entry) => !sameActor(joined, parseListen(entry).id, actorId));
  const open = policy.listen.includes(LISTEN_ANYONE);
  if (!admit2) return open ? [LISTEN_ANYONE] : others;
  if (open) return [LISTEN_ANYONE];
  return [...others.filter((e2) => !grantLapsed(parseListen(e2), now)), spellListen(actorId, opts?.until)];
}
function lapsedFor(policy, actorId, joined, now = Date.now()) {
  for (const grant of listenGrants(policy.listen, now)) {
    if (grant.lapsed && sameActor(joined, grant.id, actorId)) return grant.until;
  }
  return void 0;
}
function listenUntil(spec, now = Date.now()) {
  const said = spec.trim().toLowerCase();
  if (said === "" || said === "never" || said === "forever") return null;
  if (said === "tonight") {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.toISOString();
  }
  const days = /^(\d+)d$/.exec(said);
  if (days) return new Date(now + Number(days[1]) * 864e5).toISOString();
  const hours = /^(\d+)h$/.exec(said);
  if (hours) return new Date(now + Number(hours[1]) * 36e5).toISOString();
  const at2 = Date.parse(spec);
  if (Number.isFinite(at2)) return new Date(at2).toISOString();
  throw new Error(
    `"${spec}" is not a length of time \u2014 try tonight, 7d, 24h, never, or a date`
  );
}
function untilWords(until, now = Date.now()) {
  const left = Date.parse(until) - now;
  if (!Number.isFinite(left)) return "";
  if (left <= 0) {
    const gone = -left;
    if (gone < 36e5) return `lapsed ${Math.max(1, Math.round(gone / 6e4))}m ago`;
    if (gone < 864e5) return `lapsed ${Math.round(gone / 36e5)}h ago`;
    return `lapsed ${Math.round(gone / 864e5)}d ago`;
  }
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
function listenWords(rules, nameOf2, now = Date.now()) {
  const listen = rules?.listen ?? [];
  if (listen.length === 0 || listen.includes(LISTEN_ANYONE)) return null;
  const names = listenGrants(listen, now).filter((g) => !g.lapsed).map((g) => nameOf2(g.id) ?? g.id);
  if (names.length === 0) return "listens to nobody else \u2014 every grant has lapsed";
  if (names.length === 1) return `listens to ${names[0]}`;
  if (names.length === 2) return `listens to ${names[0]} and ${names[1]}`;
  return `listens to ${names[0]} and ${names.length - 1} others`;
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
function policyWords(policy, nameOf2, viewerId, joined, now = Date.now()) {
  if (policy.listen.includes(LISTEN_ANYONE)) return null;
  const you = (id) => viewerId !== void 0 && sameActor(joined, id, viewerId);
  const called = (id, fallback) => nameOf2(id) ?? fallback;
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
function refusedMentions(mentions, authorId, policies, joined, now = Date.now()) {
  if (!policies) return [];
  const out = [];
  for (const actorId of new Set(mentions ?? [])) {
    const policy = policies[actorId];
    if (!policy || mayWake(policy, authorId, joined, void 0, now)) continue;
    const ran = lapsedFor(policy, authorId, joined, now);
    out.push({ actorId, policy, ...ran ? { lapsed: ran } : {} });
  }
  return out;
}
function turnedAwayLine(agentName, policy, nameOf2, asker, opts) {
  const now = opts?.now ?? Date.now();
  const owner = nameOf2(policy.owner.id) ?? policy.owner.name;
  const gate = policyWords(policy, nameOf2, void 0, void 0, now) ?? `listens only to ${owner}`;
  const names = [
    ...listenGrants(policy.listen, now).filter((g) => !g.lapsed).map((g) => nameOf2(g.id) ?? g.id),
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
function readsAsTurnedAway(body, agentName) {
  return body.includes(turnedAwayMark(agentName));
}
function dispatchReason(op, authorId, agent, canvas) {
  if (sameActor(agent.joined, authorId, agent.actorId)) return null;
  if (isSystemActor(authorId)) return null;
  const admitted = agent.policy ? admits(agent.policy, authorId, agent) : listensTo(agent.rules, authorId, agent.joined);
  if (!admitted) return null;
  if (op.type === "thread.create" || op.type === "thread.reply") {
    const thread = canvas?.threads[op.threadId];
    const candidates = canvas ? collectCanvasNames(canvas) : void 0;
    const reason = reasonFor(op.comment, thread, agent.actorId, agent.names, agent.joined, candidates);
    if (reason) return reason;
  }
  if (op.type === "questionnaire.ask" || op.type === "questionnaire.answer") {
    const thread = canvas?.threads[op.threadId];
    const comment = thread?.comments.find((c) => c.id === op.commentId);
    const candidates = canvas ? collectCanvasNames(canvas) : void 0;
    const reason = comment && reasonFor(comment, thread, agent.actorId, agent.names, agent.joined, candidates);
    if (reason) return reason;
  }
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
function inboxOn(canvas, actor, names, canvasId, canvasTitle, joined) {
  const candidates = collectCanvasNames(canvas);
  const out = [];
  for (const thread of Object.values(canvas.threads ?? {})) {
    for (const comment of thread.comments) {
      if (sameActor(joined, comment.author.id, actor.id)) continue;
      const reason = reasonFor(comment, thread, actor.id, names, joined, candidates);
      if (!reason) continue;
      out.push({
        canvasId,
        ...canvasTitle ? { canvasTitle } : {},
        threadId: thread.id,
        comment,
        reason
      });
    }
  }
  return out.sort((a, b) => a.comment.createdAt.localeCompare(b.comment.createdAt));
}
function inboxNewestFirst(entries) {
  return [...entries].sort((a, b) => b.comment.createdAt.localeCompare(a.comment.createdAt));
}
function inboxTally(entries) {
  const tally2 = {
    mentioned: 0,
    "main-thread": 0,
    "in-your-thread": 0
  };
  for (const entry of entries) tally2[entry.reason] += 1;
  return tally2;
}
function inboxLine(entry) {
  const where = entry.canvasTitle ?? entry.canvasId;
  const first = entry.comment.body.split("\n").find((l) => l.trim() !== "") ?? "";
  return `${entry.comment.author.name} \xB7 ${where} \u2014 ${first.slice(0, 90)}`;
}

// packages/core/src/summons.ts
var ANSWER_WITHIN_MS = 45e3;
function summonsState(summons, seen, now) {
  const waitedMs = Math.max(0, now - summons.askedAt);
  if (seen.policy && summons.askerId !== void 0 && !mayWake(seen.policy, summons.askerId, seen.joined)) {
    return { state: "refused", policy: seen.policy };
  }
  const reply = seen.thread?.comments.find(
    (c) => c.author.id === summons.actorId && Date.parse(c.createdAt) >= summons.askedAt
  );
  if (reply) return { state: "answered", afterMs: Math.max(0, Date.parse(reply.createdAt) - summons.askedAt) };
  if (seen.pickedUpAt !== void 0) {
    return { state: "picked-up", afterMs: Math.max(0, seen.pickedUpAt - summons.askedAt) };
  }
  const working = seen.sessions.some(
    (s) => s.actor.id === summons.actorId && s.onThread === summons.threadId
  );
  if (working) return { state: "picked-up", afterMs: waitedMs };
  if (waitedMs >= ANSWER_WITHIN_MS) {
    return { state: "unanswered", waitedMs, rcParked: seen.rcParked };
  }
  return { state: "asked", waitedMs };
}
function threadSummonses(thread, askerId, seen, now) {
  const comments = thread.comments;
  let i = comments.length - 1;
  while (i >= 0 && comments[i].author.id !== askerId) i--;
  const ask = comments[i];
  const named2 = [...new Set(ask?.mentions)].filter((id) => seen.agents?.[id]);
  if (!ask || !comments.slice(i + 1).every((c) => named2.includes(c.author.id))) return [];
  const pending = i === comments.length - 1;
  const woken = pending ? summonedBy([...seen.sessions], thread).map((s) => s.actor.id) : [];
  const refused = pending ? refusedMentions(named2, askerId, seen.policies, seen.joined, now) : [];
  const askedAt = Date.parse(ask.createdAt);
  return named2.filter((id) => !woken.includes(id)).map((actorId) => {
    const turnedAway2 = refused.find((r2) => r2.actorId === actorId);
    if (turnedAway2) {
      return { actorId, state: { state: "refused", policy: turnedAway2.policy }, lapsed: turnedAway2.lapsed };
    }
    const state = summonsState(
      { actorId, threadId: thread.id, askedAt },
      { sessions: seen.sessions, thread, rcParked: seen.answering.has(actorId) },
      now
    );
    return { actorId, state };
  });
}
function summonsLine(name, state, nameOf2 = () => void 0) {
  const secs = (ms) => `${Math.max(1, Math.round(ms / 1e3))}s`;
  switch (state.state) {
    case "refused": {
      const owner = nameOf2(state.policy.owner.id) ?? state.policy.owner.name;
      return `${name} ${policyWords(state.policy, nameOf2) ?? "listens to everyone"} \u2014 this did not wake ${name}. Ask ${owner} to widen it.`;
    }
    case "asked":
      return `asked ${name}`;
    case "picked-up":
      return `${name} picked it up (${secs(state.afterMs)})`;
    case "answered":
      return `${name} answered (${secs(state.afterMs)})`;
    case "unanswered":
      return state.rcParked ? `nothing answered \u2014 the rc is parked but did not respond` : `nothing answered \u2014 nothing is listening for ${name} here`;
  }
}
function wokenLine(names, waitedMs) {
  const who = names.join(", ");
  const they = names.length === 1 ? "them" : "one of them";
  if (waitedMs < ANSWER_WITHIN_MS) {
    return `${who} ${names.length === 1 ? "was" : "were"} woken \u2014 waiting for ${they} to pick this up.`;
  }
  const secs = Math.round(waitedMs / 1e3);
  return names.length === 1 ? `${who} was woken ${secs}s ago and has not picked this up.` : `${who} were woken ${secs}s ago and none has picked this up.`;
}
function waitingLine(parked) {
  if (parked === 0) return "Nobody is parked \u2014 this waits on the thread for the next agent.";
  return parked === 1 ? "Sent. One agent is listening." : `Sent. ${parked} agents are listening.`;
}

// packages/core/src/docstatus.ts
var DOC_STATES = [
  /** No verdict recorded. Not a failure — an untriaged doc is a real state and
   *  counting them is half the point of having this at all. */
  "open",
  /** Written, argued, nothing built. Something is OWED. */
  "designed",
  /**
   * Read, absorbed, and owing nothing.
   *
   * A survey of what other people shipped is finished when it has been read —
   * its value is the finding, and there is no build behind it to be waiting
   * for. Without this state such a note sits in `open` forever (which reads as
   * "nobody has looked at it", and is a lie once somebody has) or gets marked
   * `designed` (which reads as "there is work here", and is a different lie).
   * Both distort the only number the roadmap is for.
   */
  "noted",
  /** Some of it is built; the doc says which part. */
  "partial",
  /** Built. */
  "built",
  /** Waiting on something NAMED. `blocked` with no `blockedBy` is a shrug. */
  "blocked",
  /** Replaced by something else, which `supersededBy` names. */
  "superseded"
];
var isState = (s) => DOC_STATES.includes(s);
function docStatus(text3) {
  const split = splitFrontMatter(text3);
  if (!split) return { status: "open", see: [] };
  const kv = /* @__PURE__ */ new Map();
  for (const line of split.front.split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (m) kv.set(m[1], m[2].trim().replace(/^["']|["']$/g, ""));
  }
  const raw = kv.get("status") ?? "";
  const list2 = (kv.get("see") ?? "").split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
  return {
    // An unrecognised word is `open` rather than an error: a typo must not
    // silently promote a doc to "built".
    status: isState(raw) ? raw : "open",
    ...kv.get("since") ? { since: kv.get("since") } : {},
    see: list2,
    ...kv.get("blockedBy") ? { blockedBy: kv.get("blockedBy") } : {},
    ...kv.get("supersededBy") ? { supersededBy: kv.get("supersededBy") } : {},
    ...kv.get("note") ? { note: kv.get("note") } : {},
    // A number, or nothing: "#134" and "134" both mean issue 134, and a word
    // there is not an issue.
    .../^#?\d+$/.test(kv.get("issue") ?? "") ? { issue: Number(kv.get("issue").replace(/^#/, "")) } : {}
  };
}
function burnDown(all) {
  const byState = Object.fromEntries(DOC_STATES.map((s) => [s, 0]));
  for (const doc of all) byState[doc.status] += 1;
  const done = byState.built;
  const left = byState.open + byState.designed + byState.partial + byState.blocked;
  return { done, left, byState };
}
function statusProblems(doc) {
  const out = [];
  if (doc.status === "blocked" && !doc.blockedBy) {
    out.push("blocked with nothing named \u2014 a blocker nobody can read is a shrug");
  }
  if (doc.status === "superseded" && !doc.supersededBy) {
    out.push("superseded by nothing \u2014 say what replaced it");
  }
  if (doc.status !== "open" && !doc.since) {
    out.push("a verdict with no date is a verdict nobody can age");
  }
  return out;
}

// packages/core/src/jsoncanvas.ts
var current = (item) => item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[item.versions.length - 1];
function toJsonCanvas(canvas, read = {}) {
  const nodes = [];
  for (const item of Object.values(canvas.items)) {
    const version = current(item);
    if (!version) continue;
    const base2 = {
      id: item.id,
      x: Math.round(item.x),
      y: Math.round(item.y),
      width: Math.round(item.width),
      height: Math.round(item.height)
    };
    if (item.properties?.kind === "group") {
      nodes.push({ ...base2, type: "group", label: item.title });
      continue;
    }
    if (version.mimeType === BROWSER_MIME && read.bodyOf) {
      const body = read.bodyOf(item);
      const url2 = body ? parseUriList(body) : null;
      if (url2) {
        nodes.push({ ...base2, type: "link", url: url2 });
        continue;
      }
    }
    nodes.push({
      ...base2,
      type: "file",
      file: read.fileRef ? read.fileRef(item, version.filename) : version.filename
    });
  }
  const edges = moduleEdges(canvas).map(({ from, to }) => ({
    id: `${from.id}-${to.id}`,
    fromNode: from.id,
    toNode: to.id,
    toEnd: "arrow"
  }));
  const items = Object.values(canvas.items);
  const groupMemberships = items.filter((item) => item.containerId).length;
  const groupLayouts = items.filter((item) => item.properties?.kind === "group").length;
  const contextRequests = Object.values(canvas.threads ?? {}).reduce((count, thread) => count + thread.comments.filter((comment) => comment.context).length, 0);
  return {
    file: { nodes, edges },
    lost: {
      // Every version but the current one: the format holds one state per node.
      versions: items.reduce((n, i) => n + Math.max(0, i.versions.length - 1), 0),
      threads: Object.keys(canvas.threads ?? {}).length,
      properties: items.reduce((n, i) => n + Object.keys(i.properties ?? {}).length, 0),
      reactions: items.reduce((n, i) => n + Object.keys(i.reactions ?? {}).length, 0),
      ...groupMemberships ? { groupMemberships } : {},
      ...groupLayouts ? { groupLayouts } : {},
      ...contextRequests ? { contextRequests } : {}
    }
  };
}
function describeLosses(lost) {
  const out = [];
  if (lost.versions) out.push(`${lost.versions} older version${lost.versions === 1 ? "" : "s"}`);
  if (lost.threads) out.push(`${lost.threads} comment thread${lost.threads === 1 ? "" : "s"}`);
  if (lost.properties) out.push(`${lost.properties} propert${lost.properties === 1 ? "y" : "ies"}`);
  if (lost.reactions) out.push(`${lost.reactions} reaction${lost.reactions === 1 ? "" : "s"}`);
  if (lost.groupMemberships) out.push(`${lost.groupMemberships} explicit group membership${lost.groupMemberships === 1 ? "" : "s"} (frames become geometric groups)`);
  if (lost.groupLayouts) out.push(`${lost.groupLayouts} group layout${lost.groupLayouts === 1 ? "" : "s"} and brief reservation${lost.groupLayouts === 1 ? "" : "s"}`);
  if (lost.contextRequests) out.push(`${lost.contextRequests} frozen request context${lost.contextRequests === 1 ? "" : "s"}`);
  return out;
}

// packages/core/src/context-pin.ts
function contextSourceProperty(source3) {
  return { [CONTEXT_SOURCE_PROP]: JSON.stringify(source3) };
}
function closureRefusal(canvas, ids4) {
  for (const id of ids4) {
    const item = canvas.items[id];
    if (!item) return "part of this piece is no longer on the source canvas";
    if (isCanvasItem(item)) return `\u201C${item.title}\u201D is a canvas link \u2014 place and inherit that canvas instead of copying its card`;
    if (excludedInAmbient(canvas, item)) return `\u201C${item.title}\u201D is kept out of context on the source`;
    if (!item.versions.some((version) => version.id === item.currentVersionId)) return `\u201C${item.title}\u201D has no current version to copy`;
  }
  return void 0;
}
function sourcePinPieces(canvas) {
  const roots = [];
  const design = designSystem(canvas);
  if (design && !excludedInAmbient(canvas, design)) roots.push({ kind: "design", item: design });
  const seen = new Set(roots.map((row2) => row2.item.id));
  const pins = Object.values(canvas.items).filter((item) => contextMark(item) === "pinned" && !seen.has(item.id) && !excludedInAmbient(canvas, item)).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  for (const item of pins) roots.push({ kind: "pin", item });
  return roots.map(({ kind, item }) => {
    let ids4;
    try {
      ids4 = groupTransformClosure(canvas, [item.id]);
    } catch (error) {
      return { kind, itemId: item.id, title: item.title, count: 0, refused: error instanceof Error ? error.message : String(error) };
    }
    const refused = closureRefusal(canvas, ids4);
    return { kind, itemId: item.id, title: item.title, count: ids4.length, ...refused ? { refused } : {} };
  });
}
function resolveSourcePinPiece(pieces, ref) {
  const exact = pieces.find((piece) => piece.itemId === ref);
  if (exact) return exact;
  const needle = ref.trim().toLowerCase();
  const matches = needle ? pieces.filter((piece) => piece.itemId.toLowerCase().startsWith(needle) || piece.title.toLowerCase().startsWith(needle)) : [];
  if (matches.length === 1) return matches[0];
  const list2 = pieces.map((piece) => `  ${piece.itemId}  ${piece.title}${piece.refused ? `  \u2014 ${piece.refused}` : ""}`).join("\n");
  if (matches.length === 0) throw new Error(`no piece called ${JSON.stringify(ref)} on that source \u2014 it offers:
${list2 || "  nothing"}`);
  throw new Error(`ambiguous piece ${JSON.stringify(ref)}; use an ID:
${matches.map((piece) => `  ${piece.itemId}  ${piece.title}`).join("\n")}`);
}
function contextPinDecoration(from) {
  return (properties, item, isRoot) => ({
    ...withoutDesignRole(properties),
    ...contextSourceProperty({ ...from, itemId: item.id, itemTitle: item.title, versionId: item.currentVersionId }),
    ...isRoot ? { [CONTEXT_PROP]: "pinned" } : {}
  });
}

// packages/core/src/slides.ts
var SLIDE_PROP = "slide";
var SLIDE_EMOJI = "\u{1F3AC}";
function isSlide(item) {
  return Boolean(item.properties?.[SLIDE_PROP]);
}
function slidePatch(on) {
  return on ? { properties: { [SLIDE_PROP]: "yes" } } : { removeProperties: [SLIDE_PROP] };
}
function slideIntent(items) {
  const on = !(items.length > 0 && items.every(isSlide));
  return { on, changing: items.filter((item) => isSlide(item) !== on) };
}
function readingOrder(items) {
  const byTop = [...items].sort(
    (a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)
  );
  const rows = [];
  let bottom = -Infinity;
  for (const item of byTop) {
    if (rows.length === 0 || item.y >= bottom) {
      rows.push([item]);
      bottom = item.y + item.height;
    } else {
      rows[rows.length - 1].push(item);
      bottom = Math.max(bottom, item.y + item.height);
    }
  }
  return rows.flatMap(
    (row2) => row2.sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id))
  );
}
function slides(canvas) {
  return readingOrder(Object.values(canvas.items).filter((item) => isSlide(item) && !isNote(item) && item.properties?.kind !== "group"));
}
function deck(canvas, groupId) {
  const scoped = groupId ? { ...canvas, items: Object.fromEntries(contextClosure(canvas, [groupId]).flatMap(({ itemId }) => canvas.items[itemId] ? [[itemId, canvas.items[itemId]]] : [])) } : canvas;
  const marked = slides(scoped);
  return marked.length > 0 ? marked : readingOrder(Object.values(scoped.items).filter((item) => !isNote(item) && item.properties?.kind !== "group"));
}
var NOTE_FOR_PROP = "noteFor";
var NOTE_GAP = 24;
var NOTE_HEIGHT = 160;
function isNote(item) {
  return Boolean(item.properties?.[NOTE_FOR_PROP]);
}
function noteTarget(item) {
  return item.properties?.[NOTE_FOR_PROP] ?? null;
}
function noteFor(canvas, slideId) {
  const notes = Object.values(canvas.items).filter((item) => noteTarget(item) === slideId).sort((a, b) => a.id.localeCompare(b.id));
  return notes[0] ?? null;
}
function notesOn(canvas) {
  return deck(canvas).map((slide) => ({ slide, note: noteFor(canvas, slide.id) }));
}
function noteSpot(slide) {
  return { x: slide.x, y: slide.y + slide.height + NOTE_GAP, width: slide.width, height: NOTE_HEIGHT };
}
function noteProperties(slideId) {
  return { ...TEXT_PROPERTIES, [NOTE_FOR_PROP]: slideId };
}
function notesMarkdown(canvas, bodyOf) {
  const sections = notesOn(canvas).map(({ slide, note }, i) => {
    const body = note ? bodyOf(note).trim() : "";
    return `## ${i + 1}. ${slide.title}

${body === "" ? "_No notes._" : body}
`;
  });
  return sections.join("\n");
}
function deckStep(canvas, currentId, delta) {
  const order = deck(canvas);
  const at2 = order.findIndex((item) => item.id === currentId);
  if (at2 === -1) return order[delta === 1 ? 0 : order.length - 1] ?? null;
  return order[at2 + delta] ?? null;
}

// packages/core/src/deckexport.ts
function deckPages(canvas, groupId) {
  return deck(canvas, groupId).flatMap((item) => {
    const current2 = currentVersion(item);
    if (!current2) return [];
    const note = noteFor(canvas, item.id);
    const noteVersion = note ? currentVersion(note) : null;
    return [
      {
        id: item.id,
        title: item.title,
        mimeType: current2.mimeType,
        blobHash: current2.blobHash,
        ...note && noteVersion ? { note: { id: note.id, blobHash: noteVersion.blobHash } } : {}
      }
    ];
  });
}
function currentVersion(item) {
  return item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0] ?? null;
}
function attr(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
function text2(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function deckHtml(title, pages, options = {}) {
  const slides2 = pages.map((page, i) => {
    const body = page.html !== void 0 ? `<iframe sandbox="allow-scripts" srcdoc="${attr(page.html)}" title="${attr(page.title)}"></iframe>` : page.imageDataUrl !== void 0 ? `<img src="${page.imageDataUrl}" alt="${attr(page.title)}">` : `<div class="empty">${text2(page.title)}<small>${text2(page.mimeType)} \u2014 not something a deck can show</small></div>`;
    const notes = page.notes !== void 0 && page.notes.trim() !== "" ? `<aside class="notes">${text2(page.notes)}</aside>` : "";
    return `<section class="slide" data-n="${i + 1}" aria-label="${attr(page.title)}"><div class="picture">${body}</div>${notes}</section>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${text2(title)}</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; color: #fff; font: 14px system-ui, sans-serif; }
  .slide { position: absolute; inset: 0; display: none; flex-direction: column; }
  .slide.current { display: flex; }
  .picture { flex: 1; min-height: 0; }
  .slide iframe, .slide img { width: 100%; height: 100%; border: 0; object-fit: contain; background: #fff; }
  .notes { display: none; flex: none; max-height: 38%; overflow: auto; padding: 14px 20px; white-space: pre-wrap;
           background: #111; color: #ddd; border-top: 1px solid #333; font-size: 16px; line-height: 1.5; }
  body.notes .notes { display: block; }
  .empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #aaa; }
  .counter { position: fixed; right: 14px; bottom: 10px; opacity: 0.6; font-variant-numeric: tabular-nums; }
  @media print {
    @page { size: 13.333in 7.5in; margin: 0; }
    body { background: #fff; }
    .slide { position: static; display: flex; width: 100vw; height: 100vh; break-after: page; }
    body.notes .notes { display: block; max-height: 38%; background: #fff; color: #000; border-top: 1px solid #ccc; }
    .counter { display: none; }
  }
</style>
</head>
<body${options.withNotes ? ' class="notes"' : ""}>
${slides2}
<div class="counter"><span id="n">1</span> / ${pages.length}</div>
<script>
  (function () {
    var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
    var at = Math.max(0, Math.min(slides.length - 1, (parseInt(location.hash.slice(1), 10) || 1) - 1));
    function show(i) {
      at = Math.max(0, Math.min(slides.length - 1, i));
      slides.forEach(function (s, k) { s.classList.toggle("current", k === at); });
      document.getElementById("n").textContent = String(at + 1);
      history.replaceState(null, "", "#" + (at + 1));
    }
    var next = ["ArrowRight", "ArrowDown", "PageDown", " "], prev = ["ArrowLeft", "ArrowUp", "PageUp"];
    window.addEventListener("keydown", function (e) {
      if (next.indexOf(e.key) >= 0) { e.preventDefault(); show(at + 1); }
      else if (prev.indexOf(e.key) >= 0) { e.preventDefault(); show(at - 1); }
      else if (e.key === "Home") show(0);
      else if (e.key === "End") show(slides.length - 1);
      else if (e.key === "n" || e.key === "N") document.body.classList.toggle("notes");
    });
    window.addEventListener("click", function (e) { if (e.target === document.body) show(at + 1); });
    show(at);
  })();
</script>
</body>
</html>
`;
}
function deckFilename(title, ext) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "deck";
  return `${slug}.${ext}`;
}

// packages/core/src/shelf.ts
var SHELVED_PROP = "shelved";
function shelvedAt(canvas) {
  return canvas.properties?.[SHELVED_PROP] ?? null;
}
function isShelved(canvas) {
  return shelvedAt(canvas) !== null;
}
function shelvePatch(when) {
  return { properties: { [SHELVED_PROP]: when } };
}
function unshelvePatch() {
  return { removeProperties: [SHELVED_PROP] };
}
function inScope(canvas, scope) {
  if (scope === "all") return true;
  return isShelved(canvas) === (scope === "shelved");
}

// packages/core/src/theme.ts
var THEME_PROP = "theme";
var THEMES = ["galaxy", "ocean", "mountains", "farm", "desert"];
function themeLabel(theme) {
  switch (theme) {
    case "galaxy":
      return "Space Galaxy";
    case "ocean":
      return "Ocean";
    case "mountains":
      return "Mountains";
    case "farm":
      return "Farmland";
    case "desert":
      return "Desert";
  }
}
function isTheme(value) {
  return THEMES.includes(value);
}
function themeOf(canvas) {
  const value = canvas.properties?.[THEME_PROP];
  return value !== void 0 && isTheme(value) ? value : null;
}
var THEME_ANCHOR_PROP = "themeAnchor";
function anchorOf(canvas) {
  return canvas.properties?.[THEME_ANCHOR_PROP] === "window" ? "window" : "world";
}
function anchorPatch(anchor) {
  return anchor === "window" ? { properties: { [THEME_ANCHOR_PROP]: "window" } } : { removeProperties: [THEME_ANCHOR_PROP] };
}
function themePatch(theme) {
  return { properties: { [THEME_PROP]: theme }, removeProperties: [GROUND_PROP] };
}
function noThemePatch() {
  return { removeProperties: [THEME_PROP, GROUND_PROP, THEME_ANCHOR_PROP] };
}
var GROUND_PROP = "ground";
var SHA2562 = /^[0-9a-f]{64}$/;
function groundOf(canvas) {
  const value = canvas.properties?.[GROUND_PROP];
  return value !== void 0 && SHA2562.test(value) ? value : null;
}
var GROUND_MAX_BYTES = 2e6;
var GROUND_SCRIM = 0.7;
function groundPatch(hash2) {
  return { properties: { [GROUND_PROP]: hash2 }, removeProperties: [THEME_PROP] };
}
function noGroundPatch() {
  return { removeProperties: [GROUND_PROP] };
}
function hasGround(canvas) {
  return themeOf(canvas) !== null || groundOf(canvas) !== null;
}
function groundIsPlace(canvas) {
  return themeOf(canvas) !== null && anchorOf(canvas) === "world";
}
var CURSOR_PROP = "cursor";
var CURSORS = ["arrow", "sparkle", "fish", "flag", "drop", "heart", "crescent", "sheep"];
function isCursor(value) {
  return CURSORS.includes(value);
}
function cursorLabel(cursor) {
  switch (cursor) {
    case "arrow":
      return "Arrow";
    case "sparkle":
      return "Sparkle";
    case "fish":
      return "Fish";
    case "flag":
      return "Flag";
    case "drop":
      return "Drop";
    case "heart":
      return "Heart";
    case "crescent":
      return "Crescent";
    case "sheep":
      return "Sheep";
  }
}
function cursorOf(canvas) {
  const value = canvas.properties?.[CURSOR_PROP];
  return value !== void 0 && isCursor(value) ? value : null;
}
function cursorPatch(cursor) {
  return { properties: { [CURSOR_PROP]: cursor } };
}
function noCursorPatch() {
  return { removeProperties: [CURSOR_PROP] };
}
function canvasCursorName(canvas) {
  const theme = themeOf(canvas);
  if (theme !== null) return themeCursorName(theme);
  return cursorOf(canvas) ?? "arrow";
}
function themeCursorName(theme) {
  switch (theme) {
    case "galaxy":
      return "sparkle";
    case "ocean":
      return "fish";
    case "mountains":
      return "flag";
    case "farm":
      return "sheep";
    case "desert":
      return "crescent";
    default:
      return "arrow";
  }
}

// packages/core/src/sprint.ts
var SPRINT_PROP = "sprint";
var BOARD_PROP = "board";
var BOARD_GAP = 200;
var SPRINT_BOARD = [
  {
    key: "brief",
    title: "Brief",
    tint: "grey",
    width: 1200,
    height: 900,
    card: "**What we are designing, and who decides.**\n\nThe goal in a sentence, the two or three questions the week has to answer, the Decider, the sketchers, the cut. Done before the first bell \u2014 react \u2705 on the brief when it is right."
  },
  {
    key: "map",
    title: "Map",
    tint: "blue",
    width: 2400,
    height: 1400,
    card: "**Monday \xB7 Map \xB7 45 min.**\n\nThe customer's path in 5\u201315 steps, actors on the left, the ending on the right. Say the steps; the facilitator draws them. Drag a node and the arrows follow."
  },
  {
    key: "experts",
    title: "Experts & HMW",
    tint: "yellow",
    width: 2e3,
    height: 1400,
    card: "**Monday \xB7 Ask the Experts, then How Might We \xB7 10 min.**\n\nInterviews pin here, one thread each. While listening, write *How might we\u2026* on yellow notes \u2014 one idea per note, silently. **New note** on the clock chip puts one here."
  },
  {
    key: "target",
    title: "Target",
    tint: "pink",
    width: 1200,
    height: 900,
    card: "**Monday \xB7 Pick a target.**\n\nTwo \u2B50 each on the HMW notes, silently. Then the Decider's \u{1F3AF} on one step of the map \u2014 that step and its notes come here. One thing on this sheet."
  },
  {
    key: "demos",
    title: "Demos",
    tint: "blue",
    width: 1600,
    height: 1e3,
    card: "**Tuesday \xB7 Lightning Demos \xB7 3 min each.**\n\nA site worth stealing from, as an item, with one pink note under it saying what to steal."
  },
  {
    key: "sketches",
    title: "Sketches",
    tint: "yellow",
    width: 2400,
    height: 1400,
    card: "**Tuesday \xB7 Notes, Ideas, Crazy 8s, Solution sketch.**\n\nWork alone, on your desk \u2014 nothing lands here until the bell. Then **Hand in**: one solution sketch each, three panels, a title that says the idea. The wall arrives together."
  },
  {
    key: "vote",
    title: "Vote",
    tint: "pink",
    width: 2400,
    height: 1400,
    card: "**Wednesday \xB7 Museum, Heat Map, Critique, Straw Poll, Supervote.**\n\nWalk the wall in silence. \u{1F534} on the parts you like, as many as you want. Three minutes of critique per sketch, the author last. One \u2B50 each. The Decider's \u{1F3C6} decides. Votes are hidden until the bell."
  },
  {
    key: "storyboard",
    title: "Storyboard",
    tint: "grey",
    width: 3200,
    height: 900,
    card: "**Wednesday \xB7 Storyboard \xB7 60 min.**\n\nFifteen frames in a row. Move the winning sketches in; a missing frame is a yellow note saying what goes there. The row is the deck."
  },
  {
    key: "prototype",
    title: "Prototype",
    tint: "green",
    width: 2400,
    height: 1400,
    card: "**Thursday \xB7 Prototype.**\n\nA fa\xE7ade, frame by frame: one maker per stretch of frames, named in the Chat first; a Stitcher owns consistency. Each frame lands here as a screen. The trial run is the deck full screen."
  },
  {
    key: "test",
    title: "Test",
    tint: "blue",
    width: 3200,
    height: 1400,
    card: "**Friday \xB7 Test \xB7 five people.**\n\nRows are people, columns are frames. One note per cell, from what was said \u2014 never invented. A pattern needs three of five."
  },
  {
    key: "wrap",
    title: "Wrap",
    tint: "grey",
    width: 1200,
    height: 900,
    card: "**Friday \xB7 Wrap-up \xB7 30 min.**\n\nQuote Monday's questions and answer each with a # to the thing that answers it. `isocan recap` writes the page. The board stays: it is the record."
  }
];
function boardArea(key) {
  return SPRINT_BOARD.find((one2) => one2.key === key);
}
function boardLayout(origin) {
  let x = origin.x;
  return SPRINT_BOARD.map((one2) => {
    const placed = { ...one2, x, y: origin.y };
    x += one2.width + BOARD_GAP;
    return placed;
  });
}
function boardAreaFor(canvas, key) {
  return Object.values(canvas.items).find(
    (item) => (item.properties.kind === AREA_KIND || isGroupItem(item)) && item.properties[BOARD_PROP] === key
  ) ?? null;
}
function boardOf(canvas) {
  return SPRINT_BOARD.map((one2) => boardAreaFor(canvas, one2.key)).filter((one2) => one2 !== null);
}
var BRIEF_PROP = "brief";
function briefCard(brief) {
  const lines = ["# Brief", ""];
  if (brief.goal) lines.push(`**Goal.** ${brief.goal}`, "");
  if (brief.questions && brief.questions.length > 0) {
    lines.push("**Sprint questions.**");
    for (const q of brief.questions) lines.push(`- ${q}`);
    lines.push("");
  }
  if (brief.decider) lines.push(`**Decider.** ${brief.decider}`, "");
  if (brief.sketchers && brief.sketchers.length > 0) lines.push(`**Sketching.** ${brief.sketchers.join(", ")}`, "");
  if (brief.cut) lines.push(`**Cut.** ${brief.cut}`, "");
  return lines.join("\n").trimEnd() + "\n";
}
function briefItem(canvas) {
  return Object.values(canvas.items).find((item) => item.properties[BRIEF_PROP] === "1") ?? null;
}
var DESK_OF_PROP = "sprintOf";
function deskOf(project) {
  return project.properties?.[DESK_OF_PROP] ?? null;
}
function deskTitle(name) {
  const trimmed = name.trim();
  return /s$/i.test(trimmed) ? `${trimmed}' desk` : `${trimmed}'s desk`;
}
var PHASES = [
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
var SPRINT_END = "end";
function phaseSpec(name) {
  const key = name.toLowerCase();
  return PHASES.find((p) => p.name === key) ?? null;
}
function parseDuration(text3) {
  const t = text3.trim().toLowerCase();
  if (t === "") return null;
  if (/^\d+$/.test(t)) return Number(t) * 60;
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || m[1] === void 0 && m[2] === void 0 && m[3] === void 0) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}
function clockLabel(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const rest = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(rest).padStart(2, "0")}`;
}
function parseSprintCommand(body) {
  const parsed = parseSlashCommand(body);
  if (!parsed || parsed.name !== "sprint") return null;
  const words = parsed.args.split(/\s+/).filter(Boolean);
  const first = words[0]?.toLowerCase();
  if (!first) return null;
  if (first === SPRINT_END) return { phase: SPRINT_END, seconds: null, note: words.slice(1).join(" ") };
  if (!phaseSpec(first)) return null;
  const seconds = words[1] !== void 0 ? parseDuration(words[1]) : null;
  const rest = seconds === null ? words.slice(1) : words.slice(2);
  return { phase: first, seconds, note: rest.join(" ") };
}
function sprintState(canvas) {
  const chat = mainThread(canvas);
  if (!chat) return null;
  for (let i = chat.comments.length - 1; i >= 0; i--) {
    const comment = chat.comments[i];
    const cmd = parseSprintCommand(comment.body);
    if (!cmd) continue;
    if (cmd.phase === SPRINT_END) return null;
    const phase = phaseSpec(cmd.phase);
    const seconds = cmd.seconds ?? phase.defaultSeconds;
    const startedMs = Date.parse(comment.createdAt);
    return {
      phase,
      note: cmd.note,
      facilitatorId: comment.author.id,
      facilitatorName: comment.author.name,
      threadId: chat.id,
      commentId: comment.id,
      startedAt: comment.createdAt,
      endsAt: seconds === null ? null : new Date(startedMs + seconds * 1e3).toISOString(),
      handedIn: Object.values(canvas.items).filter(
        (item) => item.properties[SPRINT_PROP] === phase.name
      ),
      area: boardAreaFor(canvas, phase.area)
    };
  }
  return null;
}
function remainingSeconds(state, nowMs) {
  if (state.endsAt === null) return null;
  return Math.max(0, Math.round((Date.parse(state.endsAt) - nowMs) / 1e3));
}
function phaseOver(state, nowMs) {
  return remainingSeconds(state, nowMs) === 0;
}
function hidesVotes(state, nowMs) {
  return state !== null && state.phase.kind === "vote" && !phaseOver(state, nowMs);
}
function handInPatch(phase) {
  return { properties: { [SPRINT_PROP]: phase } };
}
function handedInFor(item) {
  return item.properties[SPRINT_PROP] ?? null;
}
function agentActorIds(sessions, canvas) {
  const ids4 = /* @__PURE__ */ new Set();
  for (const s of sessions) if (s.kind === "cli" && s.harness) ids4.add(s.actor.id);
  for (const id of Object.keys(canvas.agents ?? {})) ids4.add(id);
  return ids4;
}
function tally(items, mark, agents) {
  return items.map((item) => {
    const actorIds = item.reactions?.[mark] ?? [];
    const agentCount = actorIds.filter((id) => agents.has(id)).length;
    return { item, humans: actorIds.length - agentCount, agents: agentCount, actorIds };
  }).filter((t) => t.actorIds.length > 0).sort(
    (a, b) => b.humans + b.agents - (a.humans + a.agents) || b.humans - a.humans || a.item.id.localeCompare(b.item.id)
  );
}
function wallFor(canvas, state) {
  const chat = mainThread(canvas);
  const items = Object.values(canvas.items);
  const vote = boardAreaFor(canvas, "vote");
  if (vote) {
    const onSheet = isGroupItem(vote) ? groupChildren(canvas, vote.id) : items.filter((item) => inArea(vote, item));
    if (onSheet.length > 0) return onSheet;
  }
  if (!chat) return items;
  const at2 = chat.comments.findIndex((c) => c.id === state.commentId);
  for (let i = at2 - 1; i >= 0; i--) {
    const cmd = parseSprintCommand(chat.comments[i].body);
    if (!cmd || cmd.phase === SPRINT_END) continue;
    const spec = phaseSpec(cmd.phase);
    if (spec.kind !== "silent") continue;
    const handed = items.filter((item) => item.properties[SPRINT_PROP] === spec.name);
    if (handed.length > 0) return handed;
  }
  return items;
}

// packages/core/src/timeline.ts
var WEIGHT = {
  // Births and deaths — the events a person narrates a canvas by.
  "item.add": 5,
  "item.delete": 5,
  "items.delete": 5,
  "item.restore": 4,
  "items.restore": 4,
  // A version is the artifact itself changing, which is what the focused
  // scrubber is for and the strongest single signal on the whole track.
  "item.addVersion": 6,
  "item.edit": 6,
  // Conversation. The FIRST comment on a thread is a seam; a reply is the
  // conversation continuing, which is not the same event.
  "thread.create": 4,
  "thread.reply": 1,
  "questionnaire.ask": 1,
  "questionnaire.answer": 1,
  // The designated channel moving is rare and always means something.
  "thread.setMain": 5,
  "project.create": 8,
  // Churn. Present with a low weight rather than absent, so a burst of it can
  // still raise a window above the bar without any single one qualifying.
  "item.move": 0.2,
  "items.move": 0.4,
  "item.update": 1,
  "item.resize": 0.2
};
function weightOf(entry) {
  const op = entry.envelope.op;
  if (op.type === "group.change") {
    const intent = op.action.kind === "apply" ? op.action.change.intent : op.action.kind;
    if (intent === "content") {
      if (op.action.kind === "apply") return op.action.change.writes.some((write) => write.kind === "patch" && write.content?.versions) ? 6 : 1;
      return op.action.kind === "content" && op.action.operation.type === "item.addVersion" ? 6 : 1;
    }
    return intent === "transform" || intent === "frame" ? 0.4 : 5;
  }
  return WEIGHT[entry.envelope.op.type] ?? 0;
}
function aboutOf(op) {
  const firstLine = (text3) => {
    if (typeof text3 !== "string") return null;
    const line = text3.split("\n").find((one2) => one2.trim().length > 0)?.trim() ?? "";
    if (!line) return null;
    return line.length > 80 ? `${line.slice(0, 79)}\u2026` : line;
  };
  const o = op;
  switch (op.type) {
    case "group.change":
      if (op.action.kind === "create") return firstLine(op.action.group.title);
      if (op.action.kind === "apply") {
        const creation = op.action.change.writes.find((write) => write.kind === "create");
        return creation?.kind === "create" ? firstLine(creation.item.title) : firstLine(op.action.change.intent);
      }
      return firstLine(op.action.kind);
    case "item.add":
      return firstLine(o.title) ?? firstLine(o.version?.filename);
    case "item.addVersion":
    case "item.edit":
      return firstLine(o.version?.filename);
    case "questionnaire.ask":
      return firstLine(op.questions?.headline);
    case "questionnaire.answer":
      return "Answered design questions";
    case "thread.create":
    case "thread.reply":
      return firstLine(o.comment?.body);
    case "project.create":
      return firstLine(o.title);
    case "project.update":
      return firstLine(o.patch?.title);
    default:
      return null;
  }
}
function majors(entries, minWeight = 4) {
  const out = [];
  for (const entry of entries) {
    if (entry.undoneBy !== void 0) continue;
    if (entry.cause) continue;
    const weight = weightOf(entry);
    if (weight < minWeight) continue;
    const actual = entry.envelope.op;
    const creation = actual.type === "group.change" && actual.action.kind === "apply" ? actual.action.change.writes.find((write) => write.kind === "create") : void 0;
    const op = actual.type === "group.change" ? { itemId: creation?.kind === "create" ? creation.item.id : groupChangeItemIds(actual)[0] } : actual;
    out.push({
      seq: entry.seq,
      ts: entry.envelope.ts,
      actor: entry.envelope.actor.name,
      kind: activityOpType(entry.envelope.op),
      weight,
      itemId: typeof op.itemId === "string" ? op.itemId : null,
      about: aboutOf(entry.envelope.op)
    });
  }
  return out;
}
function track(entries, buckets = 60) {
  if (entries.length === 0) return [];
  const first = entries[0].seq;
  const last = entries[entries.length - 1].seq;
  const span2 = Math.max(1, last - first + 1);
  const n = Math.max(1, Math.min(buckets, span2));
  const size = span2 / n;
  const marks = majors(entries);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const fromSeq = Math.round(first + i * size);
    const toSeq = i === n - 1 ? last : Math.round(first + (i + 1) * size) - 1;
    out.push({ fromSeq, toSeq, count: 0, weight: 0, majors: [], fromTs: null, toTs: null });
  }
  const bucketFor = (seq) => Math.min(n - 1, Math.max(0, Math.floor((seq - first) / size)));
  for (const entry of entries) {
    const b = out[bucketFor(entry.seq)];
    b.count += 1;
    b.weight += weightOf(entry);
    b.fromTs ??= entry.envelope.ts;
    b.toTs = entry.envelope.ts;
  }
  for (const mark of marks) out[bucketFor(mark.seq)].majors.push(mark);
  return out;
}
function majorWhat(major) {
  const words = `${major.actor} ${opWords(major.kind) ?? major.kind}`;
  return major.about ? `${words} \u2014 \u201C${major.about}\u201D` : words;
}
function majorLine(major) {
  return `${major.seq}  ${majorWhat(major)}`;
}
function past(entries, seq) {
  let state = null;
  const skipped = [];
  for (const entry of entries) {
    if (entry.seq > seq) break;
    try {
      state = applyOperation(state, entry.envelope);
    } catch (err) {
      skipped.push({
        seq: entry.seq,
        kind: entry.envelope.op.type,
        why: err instanceof Error ? err.message : String(err)
      });
    }
  }
  return { state, skipped };
}
function at(entries, seq) {
  return past(entries, seq).state;
}
function span(entries) {
  const first = entries[0];
  const last = entries[entries.length - 1];
  if (!first || !last) return null;
  return { first: first.seq, last: last.seq };
}
var MIN_TICK_GAP = 0.09;
var HOUR = 36e5;
var DAY = 24 * HOUR;
function axisGrain(spanMs) {
  if (spanMs <= 2 * DAY) return "hour";
  if (spanMs <= 120 * DAY) return "day";
  if (spanMs <= 3 * 365 * DAY) return "month";
  return "year";
}
var MONTHS3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function grainKey(d, grain) {
  const y = d.getFullYear();
  if (grain === "year") return `${y}`;
  if (grain === "month") return `${y}-${d.getMonth()}`;
  if (grain === "day") return `${y}-${d.getMonth()}-${d.getDate()}`;
  return `${y}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}
function grainLabel(d, grain, showYear) {
  const month = MONTHS3[d.getMonth()];
  if (grain === "year") return `${d.getFullYear()}`;
  if (grain === "month") return showYear ? `${month} ${d.getFullYear()}` : month;
  if (grain === "day") return `${d.getDate()} ${month}`;
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}
function axisTicks(entries, max = 8) {
  if (entries.length === 0) return [];
  const first = entries[0];
  const last = entries[entries.length - 1];
  const span2 = Math.max(1, last.seq - first.seq);
  const spanMs = Math.max(0, Date.parse(last.envelope.ts) - Date.parse(first.envelope.ts));
  const grain = axisGrain(spanMs);
  const crossesYear = new Date(first.envelope.ts).getFullYear() !== new Date(last.envelope.ts).getFullYear();
  const turns = [];
  let seen = null;
  for (const entry of entries) {
    const d = new Date(entry.envelope.ts);
    const key = grainKey(d, grain);
    if (key === seen) continue;
    seen = key;
    turns.push({
      at: (entry.seq - first.seq) / span2,
      label: grainLabel(d, grain, crossesYear),
      seq: entry.seq,
      ts: entry.envelope.ts
    });
  }
  const endLabel = grainLabel(new Date(last.envelope.ts), grain, crossesYear);
  const withEnd = turns.at(-1)?.seq === last.seq ? turns : [
    ...turns.filter((t) => t.label !== endLabel),
    { at: 1, label: endLabel, seq: last.seq, ts: last.envelope.ts }
  ];
  const kept = [];
  for (const t of withEnd) {
    const previous = kept.at(-1);
    const isEnd = t.at === 1;
    if (previous && !isEnd && t.at - previous.at < MIN_TICK_GAP) continue;
    if (isEnd && previous && t.at - previous.at < MIN_TICK_GAP && kept.length > 1) kept.pop();
    kept.push(t);
  }
  if (kept.length <= max) return kept;
  const withEnd2 = kept;
  const step = (withEnd2.length - 1) / (max - 1);
  const thinned = [];
  for (let i = 0; i < max; i += 1) thinned.push(withEnd2[Math.round(i * step)]);
  return thinned.filter((t, i, all) => i === 0 || t.seq !== all[i - 1].seq);
}

// packages/core/src/canvassort.ts
var CANVAS_SORTS = ["recent", "name", "created"];
var CANVAS_SORT_LABEL = {
  recent: "Recent activity",
  name: "Name",
  created: "Newest first"
};
function isCanvasSort(value) {
  return typeof value === "string" && CANVAS_SORTS.includes(value);
}
function sortCanvases(canvases, sort) {
  const by = [...canvases];
  switch (sort) {
    case "name":
      return by.sort(
        (a, b) => a.title.localeCompare(b.title, void 0, { sensitivity: "base" }) || a.id.localeCompare(b.id)
      );
    case "created":
      return by.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    case "recent":
      return by.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }
}
function filterCanvases(canvases, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...canvases];
  return canvases.filter((canvas) => {
    const hay = `${canvas.title} ${canvas.description}`.toLowerCase();
    return terms.every((term) => hay.includes(term));
  });
}

// packages/core/src/canvasswitch.ts
function fuzzyMatch(query, text3) {
  const needle = query.replace(/\s+/g, "").toLowerCase();
  if (needle.length === 0) return { score: 0, positions: [] };
  const hay = text3.toLowerCase();
  const literal = query.trim().toLowerCase();
  const exact = needle.length > 1 ? hay.indexOf(literal) : -1;
  if (exact >= 0) {
    const positions2 = Array.from({ length: literal.length }, (_, i) => exact + i).filter((i) => !/\s/.test(hay[i]));
    return { score: matchScore(hay, positions2), positions: positions2 };
  }
  const positions = [];
  let from = 0;
  for (const ch of needle) {
    const at2 = hay.indexOf(ch, from);
    if (at2 === -1) return null;
    let pick = at2;
    if (!startsWord(hay, at2)) {
      for (let i = at2 + 1; i < Math.min(hay.length, at2 + 12); i++) {
        if (hay[i] === ch && startsWord(hay, i)) {
          pick = i;
          break;
        }
      }
    }
    positions.push(pick);
    from = pick + 1;
  }
  return { score: matchScore(hay, positions), positions };
}
function matchScore(hay, positions) {
  let score = 0;
  let from = 0;
  for (const [i, pick] of positions.entries()) {
    const previous = positions[i - 1];
    if (previous !== void 0 && pick === previous + 1) score += 4;
    else if (startsWord(hay, pick)) score += 3;
    else score += 1;
    score -= (pick - from) * 0.1;
    from = pick + 1;
  }
  if (positions[0] === 0) score += 2;
  return score - hay.length * 0.01;
}
function startsWord(text3, at2) {
  if (at2 === 0) return true;
  const before = text3[at2 - 1];
  return !/[\p{L}\p{N}]/u.test(before);
}
function rankCanvases(canvases, query, recentIds, except = null, scope = "live") {
  const candidates = canvases.filter((canvas) => canvas.id !== except && inScope(canvas, scope));
  const byId = new Map(candidates.map((canvas) => [canvas.id, canvas]));
  const rank = new Map(recentIds.map((id, i) => [id, i]));
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    const recent = recentIds.map((id) => byId.get(id)).filter((canvas) => canvas !== void 0);
    const rest = sortCanvases(
      candidates.filter((canvas) => !rank.has(canvas.id)),
      "recent"
    );
    return [
      ...recent.map((canvas) => ({ canvas, positions: [], recent: true, shelved: isShelved(canvas) })),
      ...rest.map((canvas) => ({ canvas, positions: [], recent: false, shelved: isShelved(canvas) }))
    ];
  }
  const hits = candidates.flatMap((canvas) => {
    const shelved = isShelved(canvas);
    const onTitle = fuzzyMatch(trimmed, canvas.title);
    if (onTitle) return [{ canvas, shelved, positions: onTitle.positions, score: onTitle.score }];
    const onDescription = canvas.description ? fuzzyMatch(trimmed, canvas.description) : null;
    if (onDescription) return [{ canvas, shelved, positions: [], score: onDescription.score - 100 }];
    return [];
  });
  hits.sort(
    (a, b) => b.score - a.score || (rank.get(a.canvas.id) ?? Infinity) - (rank.get(b.canvas.id) ?? Infinity) || b.canvas.updatedAt.localeCompare(a.canvas.updatedAt) || a.canvas.id.localeCompare(b.canvas.id)
  );
  return hits.map(({ canvas, positions, shelved }) => ({
    canvas,
    positions,
    recent: rank.has(canvas.id),
    shelved
  }));
}
function litRuns(text3, positions) {
  const lit = new Set(positions);
  const runs = [];
  for (let i = 0; i < text3.length; i++) {
    const on = lit.has(i);
    const last = runs[runs.length - 1];
    if (last && last[1] === on) last[0] += text3[i];
    else runs.push([text3[i], on]);
  }
  return runs;
}
function groupSwitchRows(rows, spaces, query) {
  if (query.trim()) return rows.map((row2) => ({ row: row2, group: null, groupId: null }));
  const membership = /* @__PURE__ */ new Map();
  for (const space of spaces) {
    if (space.deletedAt) continue;
    for (const id of space.canvasIds) membership.set(id, space);
  }
  const recent = rows.filter((row2) => row2.recent).map((row2) => ({ row: row2, group: "Recent", groupId: "recent" }));
  const groups = /* @__PURE__ */ new Map();
  for (const row2 of rows) {
    if (row2.recent) continue;
    const space = membership.get(row2.canvas.id);
    const id = space?.id ?? "unfiled";
    const group = groups.get(id) ?? { name: space?.name ?? "No space", rows: [] };
    group.rows.push(row2);
    groups.set(id, group);
  }
  return [...recent, ...[...groups].sort(
    ([a, av], [b, bv]) => a === "unfiled" ? 1 : b === "unfiled" ? -1 : av.name.localeCompare(bv.name) || a.localeCompare(b)
  ).flatMap(([groupId, group]) => group.rows.map((row2) => ({ row: row2, group: group.name, groupId })))];
}

// packages/core/src/seen.ts
var SEEN_ROUTE = "/api/seen";
function seenMarksRoute(actorId, canvasId) {
  const query = new URLSearchParams();
  if (actorId !== void 0) query.set("actorId", actorId);
  if (canvasId !== void 0) query.set("canvasId", canvasId);
  return `${SEEN_ROUTE}${query.size ? `?${query}` : ""}`;
}
function seenRoute(canvasId) {
  return `${SEEN_ROUTE}/${canvasId}`;
}
function advanceSeen(current2, incoming) {
  if (!current2) return { seq: Math.max(0, incoming.seq), at: incoming.at };
  return {
    seq: Math.max(current2.seq, incoming.seq),
    at: incoming.at > current2.at ? incoming.at : current2.at
  };
}
function mergeSeen(...sources) {
  const out = {};
  for (const source3 of sources) {
    for (const [canvasId, mark] of Object.entries(source3)) {
      out[canvasId] = advanceSeen(out[canvasId], mark);
    }
  }
  return out;
}
function movedSince(mark, canvas) {
  return !mark || canvas.updatedAt > mark.at;
}
function newSince(entries, marks) {
  return entries.filter((entry) => {
    const mark = marks[entry.canvasId];
    return !mark || (entry.seq !== void 0 ? entry.seq > mark.seq : entry.comment.createdAt > mark.at);
  });
}
function latelyOrder(marks) {
  return Object.entries(marks).map(([canvasId, mark]) => ({ canvasId, mark })).sort((a, b) => b.mark.at.localeCompare(a.mark.at));
}

// packages/core/src/lens.ts
function lensEntries(sources, actorId) {
  const entries = [];
  for (const source3 of sources) {
    for (const item of Object.values(source3.canvas.items)) {
      if (item.createdBy.id !== actorId) continue;
      entries.push({
        itemId: item.id,
        canvasId: source3.canvasId,
        canvasTitle: source3.canvasTitle,
        title: item.title,
        kind: itemKind(item),
        at: item.createdAt,
        editedSince: item.updatedBy.id !== actorId
      });
    }
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at) || a.itemId.localeCompare(b.itemId));
}
function lensGroups(entries, by = "canvas") {
  const groups = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const key = by === "canvas" ? entry.canvasId : by === "kind" ? entry.kind : entry.at.slice(0, 10);
    const label = by === "canvas" ? entry.canvasTitle : by === "kind" ? entry.kind : entry.at.slice(0, 10);
    const group = groups.get(key) ?? { key, label, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) => b.entries[0].at.localeCompare(a.entries[0].at) || a.key.localeCompare(b.key)
  );
}
var LENS_REFUSAL = "these live on their own canvases \u2014 open one to move it";
function lensSubjectLabels(subjects) {
  const seen = /* @__PURE__ */ new Map();
  for (const s of subjects) seen.set(s.name, (seen.get(s.name) ?? 0) + 1);
  const labels = /* @__PURE__ */ new Map();
  for (const s of subjects) {
    labels.set(s.id, (seen.get(s.name) ?? 0) > 1 ? `${s.name} (${s.id.slice(0, 8)})` : s.name);
  }
  return labels;
}
function lensSubjects(sources) {
  const seen = /* @__PURE__ */ new Map();
  for (const source3 of sources) {
    for (const item of Object.values(source3.canvas.items)) {
      if (!seen.has(item.createdBy.id)) seen.set(item.createdBy.id, item.createdBy);
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
function filterLens(entries, filter, nowMs) {
  return entries.filter((entry) => {
    if (filter.kind !== void 0 && entry.kind !== filter.kind) return false;
    if (filter.untouched === true && entry.editedSince) return false;
    if (filter.withinHours !== void 0) {
      const age = nowMs - Date.parse(entry.at);
      if (!Number.isFinite(age) || age > filter.withinHours * 36e5) return false;
    }
    return true;
  });
}
function lensKinds(entries) {
  const tally2 = /* @__PURE__ */ new Map();
  for (const entry of entries) tally2.set(entry.kind, (tally2.get(entry.kind) ?? 0) + 1);
  return [...tally2.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}
var LENS_WINDOWS = [
  { label: "Today", hours: 24 },
  { label: "This week", hours: 24 * 7 },
  { label: "This month", hours: 24 * 30 }
];
function lensActs(logs, who, naming) {
  const wanted = typeof who === "string" ? (a) => a.id === who : who;
  const acts = [];
  for (const log of logs) {
    for (const entry of log.entries) {
      const actor = entry.envelope.actor;
      if (!wanted(actor)) continue;
      acts.push({
        ts: entry.envelope.ts,
        canvasId: log.canvasId,
        canvasTitle: log.canvasTitle,
        actor: naming ? naming(actor) : actor.name,
        op: activityOpType(entry.envelope.op)
      });
    }
  }
  return acts.sort((a, b) => b.ts.localeCompare(a.ts) || a.canvasId.localeCompare(b.canvasId));
}
function lensShape(acts) {
  const tally2 = /* @__PURE__ */ new Map();
  for (const act of acts) tally2.set(act.op, (tally2.get(act.op) ?? 0) + 1);
  const top = [...tally2.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    acts: acts.length,
    canvases: new Set(acts.map((a) => a.canvasId)).size,
    mostly: top ? top[0] : null
  };
}
function lensStanding(sources, acts, live, answerable, actorId) {
  const rows = /* @__PURE__ */ new Map();
  const rowFor = (canvasId, canvasTitle) => {
    let row2 = rows.get(canvasId);
    if (!row2) {
      row2 = { canvasId, canvasTitle, enrolled: false, state: null, acts: 0, replies: 0, lastAct: null };
      rows.set(canvasId, row2);
    }
    return row2;
  };
  for (const source3 of sources) {
    if (source3.canvas.agents?.[actorId]) rowFor(source3.canvasId, source3.canvasTitle).enrolled = true;
  }
  for (const act of acts) {
    const row2 = rowFor(act.canvasId, act.canvasTitle);
    row2.acts += 1;
    if (act.op === "thread.create" || act.op === "thread.reply" || act.op === "questionnaire.ask" || act.op === "questionnaire.answer") row2.replies += 1;
    if (row2.lastAct === null || act.ts > row2.lastAct) row2.lastAct = act.ts;
  }
  const titleOf = (canvasId) => sources.find((s) => s.canvasId === canvasId)?.canvasTitle ?? canvasId;
  for (const canvasId of live.here) rowFor(canvasId, titleOf(canvasId)).state = "here";
  for (const row2 of rows.values()) {
    if (row2.state === "here") continue;
    if (answerable.has(row2.canvasId) || live.available.has(row2.canvasId)) row2.state = "answerable";
    else if (row2.enrolled) row2.state = "enrolled";
  }
  const rank = { here: 0, answerable: 1, enrolled: 2 };
  return [...rows.values()].sort(
    (a, b) => (a.state ? rank[a.state] : 3) - (b.state ? rank[b.state] : 3) || (b.lastAct ?? "").localeCompare(a.lastAct ?? "") || a.canvasTitle.localeCompare(b.canvasTitle)
  );
}
function standingWords(row2) {
  if (row2.state === "here") return "here now";
  if (row2.state === "answerable") return "standing by \u2014 an rc answers here";
  if (row2.state === "enrolled") return "enrolled \u2014 nobody listening";
  return null;
}
function lensLive(where, actorId) {
  const here = /* @__PURE__ */ new Set();
  const parked = /* @__PURE__ */ new Set();
  for (const row2 of where) {
    if (row2.actor.id !== actorId) continue;
    (row2.kind === "rc" ? parked : here).add(row2.canvasId);
  }
  for (const canvasId of here) parked.delete(canvasId);
  return { here, available: parked };
}
function lensLiveWords(live) {
  if (live.here.size > 0) {
    return live.here.size === 1 ? "on a canvas now" : `on ${live.here.size} canvases now`;
  }
  if (live.available.size > 0) {
    return live.available.size === 1 ? "standing by" : `standing by on ${live.available.size}`;
  }
  return null;
}
function lensLiveList(live) {
  return [
    ...[...live.here].sort().map((canvasId) => ({ canvasId, state: "here" })),
    ...[...live.available].sort().map((canvasId) => ({ canvasId, state: "available" }))
  ];
}

// packages/core/src/export.ts
var EXPORT_FORMAT = "isocan-export/1";
var EXPORT_LAYOUT = {
  manifest: "manifest.json",
  names: "names.json",
  canvases: "projects",
  items: "items",
  record: "project.json",
  snapshot: "canvas.json",
  trash: "trash.json",
  oplog: "oplog.jsonl",
  blobIndex: "blobs.json",
  blobs: "blobs",
  item: "item.json",
  itemOps: "ops.jsonl",
  itemThreads: "threads.json",
  versions: "versions"
};
function parseExportTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const item = parseItemAddress(trimmed);
  if (item) return { kind: "item", ...item };
  const canvas = parseCanvasAddress(trimmed);
  if (canvas) return { kind: "canvas", origin: canvas.origin, canvasId: canvas.canvasId };
  const loopback = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/?$/.test(trimmed);
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !loopback) return null;
  const schemed = loopback && !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? `http://${trimmed}` : trimmed;
  let url2;
  try {
    url2 = new URL(schemed);
  } catch {
    return null;
  }
  if (url2.protocol !== "http:" && url2.protocol !== "https:") return null;
  if (url2.pathname.replace(/\/+$/, "") !== "") return null;
  return { kind: "home", origin: url2.origin };
}
function blobsNamedBy(entries, state) {
  const found = /* @__PURE__ */ new Map();
  const explicit = /* @__PURE__ */ new Map();
  const remember = (hash2, meta, fields3) => {
    const previous = found.get(hash2);
    const priorFields = explicit.get(hash2);
    if (!previous || !priorFields) {
      found.set(hash2, meta);
      explicit.set(hash2, fields3);
      return;
    }
    if (fields3.filename && !priorFields.filename) previous.filename = meta.filename;
    if (fields3.size && !priorFields.size) previous.size = meta.size;
    priorFields.filename ||= fields3.filename;
    priorFields.size ||= fields3.size;
  };
  const visit = (value) => {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const v of value) visit(v);
      return;
    }
    const record2 = value;
    if (typeof record2.blobHash === "string" && typeof record2.mimeType === "string" && typeof record2.filename === "string") {
      remember(record2.blobHash, {
        mimeType: record2.mimeType,
        filename: record2.filename,
        size: typeof record2.size === "number" ? record2.size : 0
      }, { filename: true, size: typeof record2.size === "number" });
      const visual = record2.visual;
      if (visual !== null && typeof visual === "object" && !Array.isArray(visual)) {
        const face = visual;
        if (typeof face.blobHash === "string" && typeof face.mimeType === "string") {
          remember(face.blobHash, { mimeType: face.mimeType, filename: typeof face.filename === "string" ? face.filename : record2.filename, size: typeof face.size === "number" ? face.size : typeof record2.size === "number" ? record2.size : 0 }, { filename: typeof face.filename === "string", size: typeof face.size === "number" });
        }
      }
    }
    for (const v of Object.values(record2)) visit(v);
  };
  for (const entry of entries) {
    visit(entry.envelope.op);
    visit(entry.inverse);
  }
  if (state) visit(state);
  return found;
}
function opsTouching(entries, itemId) {
  const mentions = (value) => {
    if (value === itemId) return true;
    if (value === null || typeof value !== "object") return false;
    return Object.values(value).some(mentions);
  };
  return entries.filter((entry) => mentions(entry.envelope.op));
}
function blobFileName(hash2, filename, mimeType) {
  const ext = extensionFor(filename, mimeType);
  return ext ? `${hash2}.${ext}` : hash2;
}
function describeExportedCanvas(row2) {
  const ops = `${row2.entries} op${row2.entries === 1 ? "" : "s"}`;
  const blobs = `${row2.blobs} blob${row2.blobs === 1 ? "" : "s"}`;
  const missing2 = row2.missing.length > 0 ? `, ${row2.missing.length} missing` : "";
  return `${row2.title} (${row2.id}) \u2014 ${ops}, ${blobs}${missing2}`;
}
function isCanvasRecord(value) {
  const record2 = value;
  return typeof record2 === "object" && record2 !== null && typeof record2.id === "string" && typeof record2.title === "string" && typeof record2.createdAt === "string";
}

// packages/core/src/text-attention.ts
var TEXT_ATTENTION_MS = 15e3;
function textAttention(value, now = Date.now(), canvas) {
  if (!value || typeof value !== "object") return null;
  const v = value;
  if (v.textSpace !== "markdown-hast-v1" || !["document", "text-node", "plain"].includes(v.flavor)) return null;
  if (![v.itemId, v.versionId, v.blobHash].every((s) => typeof s === "string" && s.length > 0 && s.length <= 128)) return null;
  if (!Number.isSafeInteger(v.start) || !Number.isSafeInteger(v.end) || v.start < 0 || v.end <= v.start || v.end > 1e7) return null;
  if (!Number.isFinite(v.expiresAt) || v.expiresAt <= now) return null;
  if (canvas) {
    const version = canvas.items[v.itemId]?.versions.find((one2) => one2.id === v.versionId);
    if (!version || ![version, version.visual].some((face) => face?.blobHash === v.blobHash && ["text/markdown", "text/plain"].includes(face.mimeType))) return null;
  }
  return {
    itemId: v.itemId,
    versionId: v.versionId,
    blobHash: v.blobHash,
    textSpace: v.textSpace,
    flavor: v.flavor,
    start: v.start,
    end: v.end,
    expiresAt: Math.min(v.expiresAt, now + TEXT_ATTENTION_MS)
  };
}
function quoteRange(text3, quote, occurrence) {
  if (!quote) throw new Error("The quote must contain text");
  const matches = [];
  for (let at2 = text3.indexOf(quote); at2 >= 0; at2 = text3.indexOf(quote, at2 + 1)) matches.push(at2);
  if (!matches.length) throw new Error("Quote not found in the rendered text");
  if (occurrence === void 0 && matches.length !== 1) throw new Error(`Quote matches ${matches.length} passages; pass --occurrence`);
  const chosen = occurrence ?? 1;
  if (!Number.isSafeInteger(chosen) || chosen < 1 || chosen > matches.length) throw new Error("Occurrence is outside the matching passages");
  const start = Array.from(text3.slice(0, matches[chosen - 1])).length;
  return { start, end: start + Array.from(quote).length };
}
var CURSOR_SIGNAL_MS = 2e4;
var CURSOR_SIGNAL_MAX_LENGTH = 80;
function cursorSignal(value, now = Date.now()) {
  if (typeof value === "string") {
    const text4 = value.trim().slice(0, CURSOR_SIGNAL_MAX_LENGTH);
    return text4 ? { text: text4, expiresAt: now + CURSOR_SIGNAL_MS } : null;
  }
  if (!value || typeof value !== "object") return null;
  const v = value;
  if (typeof v.text !== "string") return null;
  const text3 = v.text.trim().slice(0, CURSOR_SIGNAL_MAX_LENGTH);
  if (!text3 || typeof v.expiresAt !== "number" || !Number.isFinite(v.expiresAt) || v.expiresAt <= now) return null;
  return { text: text3, expiresAt: Math.min(v.expiresAt, now + CURSOR_SIGNAL_MS) };
}
function cursorChipLabel(signal, fallbackName, now = Date.now()) {
  return cursorSignal(signal, now)?.text ?? fallbackName;
}

// packages/core/src/markdown-resources.ts
var SOURCE_PATH_PROP = "sourcePath";
function markdownResource(canvas, source3, versionId, raw) {
  if (raw.startsWith("#")) return { kind: "fragment", url: raw };
  if (raw.startsWith(`${CANVAS_PATH_PREFIX}/`) || /^(?:https?:|mailto:)/i.test(raw) || raw.startsWith("//")) return { kind: "external", url: raw };
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || /[\\\x00-\x1f]/.test(raw)) return { kind: "unsafe", path: raw };
  const version = source3.versions.find((v) => v.id === versionId);
  if (!version) return { kind: "missing", path: raw };
  const base2 = cleanFilePath((version.visual ? visualFileOf(source3) : null) ?? fileOf(source3) ?? source3.properties[SOURCE_PATH_PROP] ?? visualFaceOf(version).filename);
  let decoded;
  try {
    decoded = decodeURIComponent(raw.split(/[?#]/)[0]);
  } catch {
    return { kind: "unsafe", path: raw };
  }
  if (/[\\\x00-\x1f]/.test(decoded)) return { kind: "unsafe", path: raw };
  const parts = decoded.startsWith("/") ? [] : base2?.split("/").slice(0, -1) ?? [];
  for (const part of decoded.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return { kind: "unsafe", path: raw };
      parts.pop();
    } else parts.push(part);
  }
  const target = parts.join("/");
  const matches = Object.values(canvas.items).flatMap((item) => {
    const v = item.versions.find((one2) => one2.id === (item.id === source3.id ? versionId : item.currentVersionId));
    if (!v) return [];
    const face = visualFaceOf(v);
    const pathname = cleanFilePath((v.visual ? visualFileOf(item) : null) ?? fileOf(item) ?? item.properties[SOURCE_PATH_PROP] ?? face.filename);
    return pathname === target ? [{ itemId: item.id, blobHash: face.blobHash, mimeType: face.mimeType }] : [];
  });
  if (matches.length !== 1) return { kind: matches.length ? "ambiguous" : "missing", path: target };
  return { kind: "item", ...matches[0], fragment: raw.includes("#") ? raw.slice(raw.indexOf("#") + 1) : "" };
}

// packages/core/src/inbox-api.ts
var INBOX_ROUTE = "/api/inbox";
function inboxRoute(actorId, options = {}) {
  const query = new URLSearchParams({ actorId });
  if (options.canvasId !== void 0) query.set("canvasId", options.canvasId);
  if (options.label !== void 0) query.set("label", options.label);
  return `${INBOX_ROUTE}?${query}`;
}

export {
  SYSTEM_ACTOR,
  isSystemActor,
  visualFaceOf,
  sourceFaceOf,
  hasDistinctVisualFace,
  emptyCanvas,
  mainThread,
  commentReferencedItemIds,
  REFUSED,
  ApiError,
  OpValidationError,
  GroupConflictError,
  MigrationBoundaryError,
  OplogFencedError,
  unknownOperation,
  DRAWING_MIME,
  DRAWING_FILENAME,
  DRAWING_TITLE,
  DRAWING_KIND,
  DRAWING_PROPERTIES,
  INK_PROP,
  INK_PADDING,
  drawingViewBox,
  isDrawingItem,
  inkBounds,
  inkPath,
  inkFromSvg,
  drawingSvg,
  ANNOTATES_PROP,
  regionOf,
  annotationProperties,
  annotationTarget,
  isAnnotation,
  annotationRegion,
  annotationsOf,
  annotationTargetFor,
  contextClosure,
  ambientContextItems,
  validateContextManifest,
  canvasContextRoute,
  commentContextRoute,
  retainedDesignVersion,
  validateDesignRecordVersion,
  validateDesignRecordState,
  contextManifest,
  ambientContextManifest,
  rejectPublicContext,
  resolveContextOperation,
  contextContentPage,
  TEXT_MIME,
  TEXT_FILENAME,
  TEXT_KIND,
  TEXT_PROPERTIES,
  isTextItem,
  TEXT_WIDTH,
  TEXT_SIZE,
  TEXT_STYLES,
  TEXT_STYLE_SIZE,
  TEXT_STYLE_LABEL,
  textStyleFrom,
  TEXT_STYLE_PROP,
  textStyleOf,
  textSizeOf,
  TEXT_FACES,
  textFaceLabel,
  TEXT_FACE_STACK,
  TEXT_FACE_SCALE,
  textDrawSize,
  TEXT_FACE_PROP,
  textFaceOf,
  PAPERS,
  paperLabel,
  PAPER_PROP,
  paperOf,
  isPaper,
  paperPatch,
  PAPER_SIZE,
  textIsLegible,
  TEXT_MARK_MAX,
  textMarkSize,
  textTitle,
  TEXT_COLUMN,
  TEXT_COLUMN_MAX,
  textBox,
  PLACEMENT_GAP,
  PLACEMENT_CLEARANCE,
  anchorOffset,
  overlaps,
  nearestFreeSpot,
  resolvePlacement,
  positionIsMeaningful,
  besideBox,
  isBesideSide,
  DesignPartnerContractError,
  parseDesignGoverning,
  parseDesignRequestAction,
  parseDesignRequestOperation,
  designIntentHash,
  parseDesignBrief,
  parseDesignArtifactRef,
  parseDesignReference,
  parseDesignQuestionSet,
  parseDesignResponse,
  parseDesignReceipt,
  designPartnerPolicy,
  parseDesignComparison,
  parseDesignComparisonResponse,
  parseDesignTarget,
  parseDesignDecisionInput,
  parseDesignCompareOperation,
  parseDesignRespondOperation,
  parseDesignDecideOperation,
  parseDesignDecisionOperation,
  designDecisionIntentHash,
  parseDesignRepairBasis,
  parseDesignRepairInput,
  parseDesignRepairOperation,
  designRepairIntentHash,
  AREA_KIND,
  AREA_PROPERTIES,
  AREA_MIME,
  AREA_FILENAME,
  AREA_TINT_PROP,
  AREA_TITLE_HEIGHT,
  AREA_CARD_HEIGHT,
  AREA_HEAD,
  AREA_INSET,
  isArea,
  areaTint,
  areaTintPatch,
  areasOf,
  areaInner,
  inArea,
  itemsIn,
  areaOf,
  findArea,
  freeSpotIn,
  areaEnclosing,
  AREA_ROWS_PROP,
  AREA_COLS_PROP,
  AREA_ROW_NAMES_PROP,
  AREA_COL_NAMES_PROP,
  areaGrid,
  gridPatch,
  cellBox,
  cellOf,
  cellSpot,
  canvasScopes,
  inCanvasScope,
  DesignRestoreConflict,
  sameDesignValue,
  currentDesignScope,
  designTargetMatches,
  designDecisionMarkdown,
  validateDesignDecisionComment,
  designComparisonStates,
  designInputTransition,
  validateDesignRepairCanonical,
  activeDesignRepairEntries,
  designRepairTransitions,
  makeTextAnchor,
  validateTextAnchor,
  resolveTextAnchor,
  IDENTITY_COLORS,
  resolveActor,
  sameActor,
  actorAliases,
  isFaceMark,
  markOf,
  faceMark,
  actorNameIn,
  isIdentityColor,
  actorColor,
  legacyQuestionSet,
  questionnaireActorsRoute,
  questionnaireSourceCurrent,
  questionnaireStates,
  questionnaireArtifacts,
  rejectQuestionnaireMetadata,
  validateQuestionnaireComment,
  parseLegacyQuestionnaire,
  sameDesignArtifact,
  planDesignAnswer,
  applyOperation,
  pruneVersions,
  prunedVersions,
  BROWSER_MIME,
  normalizeSiteUrl,
  parseUriList,
  siteLabel,
  siteFilename,
  CANVAS_PATH_PREFIX,
  CANVAS_ROUTE,
  ITEM_ROUTE,
  canvasPath,
  itemPath,
  itemUrl,
  DECK_ROUTE,
  deckPath,
  deckUrl,
  MODULE_PAGE_ROUTE,
  modulePagePath,
  modulePageUrl,
  WORKBENCH_ROUTE,
  WORKBENCH_ITEM_ROUTE,
  workbenchPath,
  workbenchItemPath,
  workbenchUrl,
  canvasUrl,
  canvasUrlWithPass,
  urlWithPass,
  splitPassFragment,
  parseCanvasAddress,
  parseItemAddress,
  normalizeHomeUrl,
  INSTALL_SPEC,
  DEFAULT_HOME_URL,
  SKILL_INSTALL_COMMAND,
  setupCommand,
  localAgentInstructions,
  cloudAgentInstructions,
  THREAD_QUERY,
  threadPath,
  CANVAS_KIND,
  CANVAS_PROP,
  SOURCE_PROP,
  CANVAS_ITEM_FILENAME,
  CANVAS_ITEM_SIZE,
  isCanvasItem,
  canvasIdOf,
  automaticCanvasTarget,
  sourceOf,
  canvasItemOf,
  canvasIdFromBlob,
  contributions,
  refusedContributions,
  roundsOn,
  roundRunning,
  registerModuleBase,
  moduleBase,
  moduleCommands,
  withModuleCommands,
  registerModule,
  unregisterModule,
  modules,
  moduleContextPieces,
  moduleEdges,
  moduleKinds,
  moduleKindOf,
  askTemplate,
  isDataOnly,
  MODULE_API_VERSION,
  PROPOSED,
  unknownProposals,
  moduleSlug,
  moduleWebPath,
  manifestRecord,
  enginesSatisfied,
  ITEM_KINDS,
  isBuiltinKind,
  kindFamily,
  itemKinds,
  itemKind,
  isFramedItem,
  editableText,
  KIND_MARK_MIN,
  PARENT_PROP,
  parentOf,
  lineageProperties,
  childrenOf,
  FORMAT_GAP_X,
  FORMAT_MODES,
  isFormatMode,
  formatScope,
  formatMoves,
  activityOpType,
  opWords,
  GROUP_DEFAULT_SIZE,
  isGroupItem,
  groupChildren,
  groupAncestors,
  groupScopedRoot,
  groupScopeRoots,
  groupWrapAction,
  groupRemoveAction,
  groupDescendants,
  groupSelectionRoots,
  groupTransformClosure,
  validateGroupForest,
  groupContentBox,
  groupFrameMinimum,
  groupGridNeedsRoom,
  groupCellBox,
  groupPlacement,
  groupDropTarget,
  groupDropPolicy,
  groupArrangeAction,
  groupFitAction,
  groupPreviewBoxes,
  groupFitBox,
  groupResizeBox,
  groupResizeMinimum,
  groupTransform,
  captureGroupExpectations,
  applyGroupChange,
  invertGroupChange,
  resolveGroupOperation,
  groupChangeItemIds,
  resolveCanvasGroupRequest,
  boundsOf,
  duplicatePlacements,
  copyProperties,
  groupCopySource,
  groupCopyAction,
  groupRestorePreview,
  canvasGroupMigrationPreview,
  resolveCanvasGroupMigration,
  INTERNAL_OP_TYPES,
  BADGE_COOKIE,
  formatDotToken,
  parseDotToken,
  formatBadgeToken,
  parseBadgeToken,
  DOOR_ROUTE,
  askTheDoor,
  bearerHeader,
  BADGE_RESTART_HINT,
  WS_NO_BADGE,
  WS_BAD_ORIGIN,
  WS_NO_CANVAS,
  BADGES_ROUTE,
  badgeRoute,
  NOT_YOUR_BADGE,
  AMBIGUOUS_HOME,
  SHELF,
  ownerOf,
  ownsCanvas,
  RUNGS,
  atLeast,
  highest,
  isCapability,
  narrowed,
  capabilityOf,
  capabilityWord,
  LINK,
  attestedKindOf,
  GROUP_ID_PREFIX,
  groupSubject,
  isGroupSubject,
  groupIdOf,
  scopeOf,
  isSpaceGrant,
  isBar,
  GRANTED_BY_HOME,
  GRANTED_BY_MIGRATION,
  grantSubjectRefusal,
  barSubjectRefusal,
  normalizeAttribute,
  normalizeSubject,
  upsertAttestation,
  attestationSatisfying,
  isLive,
  grantsRoute,
  grantRoute,
  grantRevokeRoute,
  ownsSpace,
  isSpaceLive,
  SPACE_NAME_MAX,
  spaceNameRefusal,
  sameSpaceName,
  SPACES_ROUTE,
  spaceRoute,
  spaceCanvasRoute,
  spaceGrantsRoute,
  spaceGrantRoute,
  spaceGrantRevokeRoute,
  spaceLinkRoute,
  spaceActingRoute,
  SPACE_NOT_FOUND,
  CANVAS_IN_SPACE,
  BAD_SPACE,
  SPACE_NAME_TAKEN,
  ownsGroup,
  isGroupLive,
  GROUP_NAME_MAX,
  groupNameRefusal,
  sameGroupName,
  groupMemberRefusal,
  GROUPS_ROUTE,
  groupRoute,
  groupMemberRoute,
  groupViewOf,
  groupActingRoute,
  GROUP_NOT_FOUND,
  BAD_GROUP,
  GROUP_NAME_TAKEN,
  NOT_ADMITTED,
  VIEW_ONLY,
  WS_NOT_ADMITTED,
  WITHDRAWN,
  isGrantListingDecision,
  canListGrant,
  isListedGrant,
  PUBLIC_CANVASES_ROUTE,
  publicListingRoute,
  SOURCE_POLICY_HEADER,
  parseSourcePolicyHeader,
  sourcePolicyHeader,
  sourceClassificationRoute,
  SOURCE_ACCESS_ROUTE,
  personalRoute,
  personalCanvasRoute,
  personalDelegatesRoute,
  PASS_TTL_MS,
  formatPassToken,
  parsePassToken,
  passesRoute,
  passRoute,
  PASS_REDEEM_ROUTE,
  PASS_MINTER_ENDED,
  PASS_UNKNOWN,
  PASS_SPENT,
  PASS_EXPIRED,
  passExpired,
  EMOJI_GROUPS,
  ALL_EMOJI,
  searchEmoji,
  emojiName,
  QUICK_REACTIONS,
  reactionPointsOf,
  reactionsOf,
  hasReacted,
  reactionGroups,
  itemsWearing,
  itemsTouchedBy,
  opTypeMatches,
  opTouchesAreas,
  opMatchesFilters,
  buildRecap,
  clipRecapLabel,
  buildRecapHead,
  formatRecapHead,
  recapHeadRoute,
  findMentionSpans,
  findCommandSpans,
  extractMentions,
  actorsAnswerTo,
  collectCanvasActors,
  collectCanvasNames,
  recentActivity,
  QUIET_AFTER_MS,
  openAsk,
  openAsks,
  sessionState,
  roster,
  answeringExcerpt,
  newId,
  newCanvasId,
  newItemId,
  newVersionId,
  newThreadId,
  newCommentId,
  newOpId,
  newGroupId,
  isOpId,
  newActorId,
  newClientId,
  emptyActorRegistry,
  PERSON_HARNESSES,
  isAgentHarness,
  actorKinds,
  harnessOf,
  ISOCAN_NAMES,
  FREE_NAME_ROUTE,
  applyClaim,
  bindName,
  bindClaim,
  bindHandoff,
  claimsActor,
  notYourActor,
  applyActorColor,
  applyActorMark,
  applyActorJoin,
  notBothActors,
  actorJoins,
  actorMarks,
  actorColors,
  actorNames,
  CLAIM_REFUSAL,
  allocateName,
  invertOperation,
  preparedGroupCreation,
  AGENT_KIND,
  BENCH_ITEM_SIZE,
  BENCH_REACH,
  benchAgentOf,
  benchAgents,
  benchItemOf,
  benchWriteFor,
  benchRows,
  benchWords,
  benchStandingWords,
  BENCH_JOIN_VERB,
  benchMentions,
  benchJoinAsk,
  benchJoinRefusal,
  benchJoinWords,
  DOC_SYNCED_PROP,
  DOC_MIME,
  googleDocId,
  googleDocUrl,
  googleDocExportUrl,
  googleDriveExportUrl,
  googleDriveMetaUrl,
  GOOGLE_DRIVE_ABOUT_URL,
  docStale,
  googleDocPreviewUrl,
  docTitleFrom,
  docFilenameFrom,
  docProperties,
  isGoogleDocItem,
  docSyncedAt,
  looksLikeSite,
  classifyAddable,
  addableKind,
  addableWords,
  titleRoom,
  dayOf,
  news,
  unseen,
  newestDay,
  DEFAULT_PORT,
  CANVAS_GROUPS_FEATURE,
  QUESTIONNAIRES_FEATURE,
  QUESTIONNAIRES_REQUIRED,
  DESIGN_REQUESTS_FEATURE,
  CURRENT_CLIENT_FEATURES,
  supportsDesignRepairs,
  supportsDesignDecisions,
  DESIGN_REQUESTS_REQUIRED,
  supportsDesignRequests,
  supportsQuestionnaires,
  CLIENT_FEATURES_HEADER,
  CLIENT_FEATURES_PARAM,
  CANVAS_GROUPS_REQUIRED,
  supportsCanvasGroups,
  PARK_ADOPTED_CODE,
  rcAnsweringRoute,
  rcAskRoute,
  NO_RC_CODE,
  NOT_YOUR_RC_CODE,
  RENAMED_WIRE_KEYS,
  STALE_CLIENT_CODE,
  STALE_CLIENT_STATUS,
  WS_STALE_CLIENT,
  WS_BEHIND,
  WS_CLOSE_REASON_BYTES,
  staleClientRefusal,
  FILENAME_HEADER,
  MAX_DIRECT_UPLOAD_BYTES,
  encodeFilename,
  decodeFilename,
  isLoopbackBase,
  healthPath,
  CANVASES_REACH_PARAM,
  canvasesRoute,
  HOME_JOIN_ROUTE,
  HOMES_ROUTE,
  PRESENCE_WHERE_ROUTE,
  NEWS_ROUTE,
  ACTOR_KINDS_ROUTE,
  DOC_EXPORT_ROUTE,
  SERVING_ROUTE,
  SIGN_BLOBS_ROUTE,
  SIGN_BLOBS_PARAM,
  SIGN_BLOBS_LIMIT,
  UNKNOWN_ROUTE,
  HOME_GC_ROUTE,
  findItemRefSpans,
  extractItemRefs,
  collectItemRefCandidates,
  extensionOf,
  extensionFor,
  filenameFromTitle,
  uniqueFilename,
  filenamesInUse,
  renamedFilename,
  blobsInProperties,
  elapsedLabel,
  workedFor,
  ago,
  alignLabel,
  ALIGN_EDGES,
  alignMoves,
  distributeMoves,
  FILE_PROP,
  VISUAL_FILE_PROP,
  fileOf,
  visualFileOf,
  backingOf,
  cleanFilePath,
  COMMAND_NAME,
  parseSlashCommand,
  matchCommands,
  findCommand,
  mergeCommands,
  parseCommandFile,
  commandFileText,
  undoneSeqs,
  categoriseAsk,
  buildCorpus,
  CONVERGED_PROP,
  KEPT_AFTER_MS,
  withLanding,
  landingsOf,
  harvestConverge,
  harvestPreferences,
  DEFAULT_COMMAND_CATALOGUE,
  SLOP_RULES,
  slopRulesAsText,
  DEFAULT_COMMANDS,
  applePlatform,
  cmdKey,
  shiftKey,
  shortcut,
  modifierClick,
  renderKeys,
  SHORTCUT_GROUPS,
  SHORTCUTS,
  shortcutsIn,
  keyFor,
  shortcutsAsText,
  formatBytes,
  UnmergeableError,
  mergeDrawings,
  workersOn,
  listeners,
  summonedBy,
  latestCancel,
  cancelledSince,
  skillSource,
  skillNameFrom,
  DESIGN_SYSTEM_ROLE,
  designSystemProperties,
  isDesignSystem,
  withoutDesignRole,
  designSystem,
  designTargetScopes,
  selectDesignSystem,
  scopedDesignSystems,
  DESIGN_SYSTEM_AFTER,
  needsDesignSystem,
  DESIGN_SYSTEM_LIMIT,
  designStanding,
  designSkipped,
  designSkipPatch,
  designUnskipPatch,
  CONTEXT_PROP,
  contextMark,
  pinnedItems,
  excludedItems,
  markPatch,
  markLabel,
  CONTEXT_SOURCE_PROP,
  parseContextSource,
  contextSourceOf,
  copiedContextItems,
  formatContextSource,
  contextReport,
  markedItems,
  contextPieces,
  MEMORY_PROP,
  MEMORY_INHERIT,
  MEMORY_PERSONAL,
  memoryOf,
  memoryLinks,
  personalMemoryLinks,
  personalContributions,
  personalCanvasItemOf,
  memoryPatch,
  inheritedPieces,
  contextLayers,
  governingDesign,
  selectGoverningDesign,
  layersReport,
  contextLayerKey,
  linkedCanvasId,
  CONTEXT_SHEET_TITLE,
  CONTEXT_SHEET_SIZE,
  contextSheet,
  contextSheetSpot,
  FIDELITY_PROP,
  isWireframeScreen,
  designScopeStanding,
  PREFERRED_OVER_PROP,
  preferredOver,
  preferPatch,
  unpreferPatch,
  preferences,
  standings,
  TOOL_ROLE,
  toolProperties,
  isToolExtension,
  EXTENSION_ICONS,
  LABEL_LIMIT,
  readToolExtension,
  toolCapabilities,
  toolExtensionItems,
  PANEL_ROLE,
  panelProperties,
  isPanelExtension,
  PANEL_SIDES,
  TITLE_LIMIT,
  readPanelExtension,
  panelCapabilities,
  panelExtensionItems,
  mimeFromName,
  defaultSize,
  SPOKEN_COLOURS,
  spokenColour,
  inkColour,
  drawingProperties,
  itemColour,
  checkDesign,
  bySeverity,
  fitMoves,
  ATTEST_ROUTE,
  BAD_ID_TOKEN,
  NO_ATTESTER,
  grantSubjectOf,
  AUTH_ACTION_PATH,
  authActionOutcome,
  OPERATOR_PROOF_HEADER,
  OPERATOR_PROOF_WINDOW_MS,
  OPERATOR_SHOW_ROUTE,
  OPERATOR_LOG_ROUTE,
  OPERATOR_API_PREFIX,
  NO_OPERATOR,
  NOT_OPERATOR,
  PROOF_STALE,
  NO_OPERATOR_PROOF,
  PROVE_PATH_PREFIX,
  encodeHandoff,
  decodeHandoff,
  provePath,
  proveSegmentIn,
  loopbackRefusal,
  TAKEN_DOWN,
  TAKEDOWN_REASONS,
  isTakedownReason,
  takedownReasonList,
  inForce,
  noticeOf,
  takedownSentence,
  takedownDate,
  takedownDateShort,
  OPERATOR_TAKEDOWN_ROUTE,
  OPERATOR_LOOK_ROUTE,
  TAKEDOWNS_ROUTE,
  TAKEDOWNS_CANVAS_PARAM,
  OPERATOR_LOOK_MS,
  operatorLookUrl,
  OPERATOR_PURGE_ROUTE,
  replicasHorizon,
  purgeNeedsTakedown,
  ENDED,
  BADGE_ENDED,
  badgeEndNotice,
  endedSentence,
  OPERATOR_END_ROUTE,
  OPERATOR_REVOKE_ROUTE,
  revokedSentence,
  operatorTurnedOff,
  OPERATOR_REFUSE_ROUTE,
  NET_REFUSAL_DEFAULT_MS,
  refusalInForce,
  refusalSubjectOf,
  refusalSubjectRefusal,
  parseCidr,
  cidrContains,
  parseRefusalDuration,
  refusalNoticeOf,
  refusalSentence,
  refusalUntil,
  subjectShown,
  REFUSAL_LIMIT,
  laneFor,
  laneOf,
  frameVerdict,
  ASSET_MAX_BYTES,
  ASSETS_MAX_BYTES,
  assetProblems,
  moduleAsset,
  classifyToken,
  readCssTokens,
  detectFormat,
  importDesign,
  importedBody,
  convergePlan,
  isRefusal,
  atCorner,
  itemThread,
  bindVerdict,
  claimName,
  takenSentence,
  PERSONA_DIR,
  PERSONA_DOORWAY,
  splitFrontMatter,
  parseBound,
  parsePersona,
  goalLine,
  personaWarnings,
  withBaseline,
  runFindings,
  tallyOutcomes,
  namesFor,
  addressesActor,
  reasonFor,
  LISTEN_ANYONE,
  parseListen,
  spellListen,
  listenGrants,
  withListener,
  lapsedFor,
  listenUntil,
  untilWords,
  rulesOf,
  listensTo,
  listenWords,
  ownersWord,
  answerPolicy,
  gateSetAside,
  mayWake,
  speakersFor,
  policyWords,
  turnedAway,
  refusedMentions,
  turnedAwayLine,
  readsAsTurnedAway,
  dispatchReason,
  inboxOn,
  inboxNewestFirst,
  inboxTally,
  inboxLine,
  ANSWER_WITHIN_MS,
  summonsState,
  threadSummonses,
  summonsLine,
  wokenLine,
  waitingLine,
  DOC_STATES,
  docStatus,
  burnDown,
  statusProblems,
  toJsonCanvas,
  describeLosses,
  contextSourceProperty,
  sourcePinPieces,
  resolveSourcePinPiece,
  contextPinDecoration,
  SLIDE_PROP,
  SLIDE_EMOJI,
  isSlide,
  slidePatch,
  slideIntent,
  readingOrder,
  slides,
  deck,
  NOTE_FOR_PROP,
  NOTE_GAP,
  NOTE_HEIGHT,
  isNote,
  noteTarget,
  noteFor,
  notesOn,
  noteSpot,
  noteProperties,
  notesMarkdown,
  deckStep,
  deckPages,
  deckHtml,
  deckFilename,
  SHELVED_PROP,
  shelvedAt,
  isShelved,
  shelvePatch,
  unshelvePatch,
  inScope,
  THEME_PROP,
  THEMES,
  themeLabel,
  isTheme,
  themeOf,
  THEME_ANCHOR_PROP,
  anchorOf,
  anchorPatch,
  themePatch,
  noThemePatch,
  GROUND_PROP,
  groundOf,
  GROUND_MAX_BYTES,
  GROUND_SCRIM,
  groundPatch,
  noGroundPatch,
  hasGround,
  groundIsPlace,
  CURSOR_PROP,
  CURSORS,
  isCursor,
  cursorLabel,
  cursorOf,
  cursorPatch,
  noCursorPatch,
  canvasCursorName,
  themeCursorName,
  SPRINT_PROP,
  BOARD_PROP,
  BOARD_GAP,
  SPRINT_BOARD,
  boardArea,
  boardLayout,
  boardAreaFor,
  boardOf,
  BRIEF_PROP,
  briefCard,
  briefItem,
  DESK_OF_PROP,
  deskOf,
  deskTitle,
  PHASES,
  SPRINT_END,
  phaseSpec,
  parseDuration,
  clockLabel,
  parseSprintCommand,
  sprintState,
  remainingSeconds,
  phaseOver,
  hidesVotes,
  handInPatch,
  handedInFor,
  agentActorIds,
  tally,
  wallFor,
  weightOf,
  majors,
  track,
  majorWhat,
  majorLine,
  past,
  at,
  span,
  axisGrain,
  axisTicks,
  CANVAS_SORTS,
  CANVAS_SORT_LABEL,
  isCanvasSort,
  sortCanvases,
  filterCanvases,
  fuzzyMatch,
  rankCanvases,
  litRuns,
  groupSwitchRows,
  SEEN_ROUTE,
  seenMarksRoute,
  seenRoute,
  advanceSeen,
  mergeSeen,
  movedSince,
  newSince,
  latelyOrder,
  lensEntries,
  lensGroups,
  LENS_REFUSAL,
  lensSubjectLabels,
  lensSubjects,
  filterLens,
  lensKinds,
  LENS_WINDOWS,
  lensActs,
  lensShape,
  lensStanding,
  standingWords,
  lensLive,
  lensLiveWords,
  lensLiveList,
  EXPORT_FORMAT,
  EXPORT_LAYOUT,
  parseExportTarget,
  blobsNamedBy,
  opsTouching,
  blobFileName,
  describeExportedCanvas,
  isCanvasRecord,
  TEXT_ATTENTION_MS,
  textAttention,
  quoteRange,
  CURSOR_SIGNAL_MS,
  CURSOR_SIGNAL_MAX_LENGTH,
  cursorSignal,
  cursorChipLabel,
  SOURCE_PATH_PROP,
  markdownResource,
  INBOX_ROUTE,
  inboxRoute,
  src_exports
};
