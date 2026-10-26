// Canonical transition inventory. lib/names.mjs re-exports this managed source;
// render installs these same bytes in scripts/plates/names.mjs. No second table.
// Exact identities only. A prefix ending in / or - denotes its documented family.
// migrationHold records EXISTING migration protection, not transition authority.
// Rows without it were never held by rename's DURABLE pass; adding them there
// would change phase 109 behavior. Unknown owner interfaces are protected separately.
// IDs remain stable when a row transitions. The bare git namespace is also
// read by machine queue bounds; its open owner protection stays in rename.
export const NAMES = Object.freeze([
  Object.freeze({"id": "git ref:keel/", "surface": "git ref", "keel": "keel/", "plates": "plates/", "phase": 125, "state": "dual"}),
  Object.freeze({"id": "git ref:keel-night/","surface": "git ref","keel": "keel-night/","plates": "plates-night/","phase": 125,"state": "dual","migrationHold": "keel-night\\\\?\\/"}),
  Object.freeze({"id": "git ref:keel-night-plan","surface": "git ref","keel": "keel-night-plan","plates": "plates-night-plan","phase": 125,"state": "dual","migrationHold": "keel-night-plan\\b"}),
  Object.freeze({"id": "git ref:keel-climb/","surface": "git ref","keel": "keel-climb/","plates": "plates-climb/","phase": 125,"state": "dual","migrationHold": "keel-climb\\\\?\\/"}),
  Object.freeze({"id": "git ref:keel-tend/","surface": "git ref","keel": "keel-tend/","plates": "plates-tend/","phase": 125,"state": "dual","migrationHold": "keel-tend\\\\?\\/"}),
  Object.freeze({"id": "git ref:keel-loop/","surface": "git ref","keel": "keel-loop/","plates": "plates-loop/","phase": 125,"state": "dual","migrationHold": "keel-loop\\\\?\\/"}),
  Object.freeze({"id": "git ref:keel/robot-","surface": "git ref","keel": "keel/robot-","plates": "plates/robot-","phase": 125,"state": "dual","migrationHold": "keel\\\\?\\/(?:robot-)"}),
  Object.freeze({"id": "git ref:keel/update-","surface": "git ref","keel": "keel/update-","plates": "plates/update-","phase": 125,"state": "dual","migrationHold": "keel\\\\?\\/(?:update-)"}),
  Object.freeze({"id": "git ref:keel/web-update-","surface": "git ref","keel": "keel/web-update-","plates": "plates/web-update-","phase": 125,"state": "dual","migrationHold": "keel\\/web-update-"}),
  Object.freeze({"id": "git ref:keel-verify","surface": "git ref","keel": "keel-verify","plates": "plates-verify","phase": 125,"state": "dual","migrationHold": "keel-verify\\b"}),
  Object.freeze({"id": "git ref:keel-claims/phase-","surface": "local Git path","keel": "keel-claims/phase-","plates": "plates-claims/phase-","phase": 128,"state": "held","migrationHold": "keel-claims\\b"}),
  Object.freeze({"id": "concurrency group:keel-night","surface": "concurrency group","keel": "keel-night","plates": "plates-night","phase": 125,"state": "dual"}),
  Object.freeze({"id": "concurrency group:keel-morning","surface": "concurrency group","keel": "keel-morning","plates": "plates-morning","phase": 125,"state": "dual"}),
  Object.freeze({"id": "concurrency group:keel-climb","surface": "concurrency group","keel": "keel-climb","plates": "plates-climb","phase": 125,"state": "dual"}),
  Object.freeze({"id": "concurrency group:keel-tend","surface": "concurrency group","keel": "keel-tend","plates": "plates-tend","phase": 125,"state": "dual"}),
  Object.freeze({"id": "concurrency group:keel-loop","surface": "concurrency group","keel": "keel-loop","plates": "plates-loop","phase": 125,"state": "dual"}),
  Object.freeze({"id": "concurrency group:keel-robot","surface": "concurrency group","keel": "keel-robot","plates": "plates-robot","phase": 125,"state": "dual"}),
  Object.freeze({"id": "concurrency group:keel-robot-route-","surface": "concurrency group","keel": "keel-robot-route-","plates": "plates-robot-route-","phase": 125,"state": "dual"}),
  Object.freeze({"id": "concurrency group:keel-cross-review-","surface": "concurrency group","keel": "keel-cross-review-","plates": "plates-cross-review-","phase": 125,"state": "dual"}),
  Object.freeze({"id": "concurrency group:keel-impact-","surface": "concurrency group","keel": "keel-impact-","plates": "plates-impact-","phase": 125,"state": "dual"}),
  Object.freeze({"id": "concurrency group:keel-web-typecheck-","surface": "concurrency group","keel": "keel-web-typecheck-","plates": "plates-web-typecheck-","phase": 125,"state": "dual"}),
  Object.freeze({"id": "concurrency group:keel-web-update-","surface": "concurrency group","keel": "keel-web-update-","plates": "plates-web-update-","phase": 125,"state": "dual"}),
  Object.freeze({"id": "artifact:keel-test-runs","surface": "artifact","keel": "keel-test-runs","plates": "plates-test-runs","phase": 126,"state": "dual","migrationHold": "keel-test-runs\\b"}),
  Object.freeze({"id": "artifact:keel-production-","surface": "artifact","keel": "keel-production-","plates": "plates-production-","phase": 126,"state": "dual","migrationHold": "keel-production-(?=\\d|\\$\\{|['\"`]|$)"}),
  Object.freeze({"id": "artifact:keel-canvas-night","surface": "artifact","keel": "keel-canvas-night","plates": "plates-canvas-night","phase": 126,"state": "dual","migrationHold": "keel\\-canvas\\-night\\b"}),
  Object.freeze({"id": "artifact:keel-canvas-card","surface": "artifact","keel": "keel-canvas-card","plates": "plates-canvas-card","phase": 126,"state": "dual","migrationHold": "keel\\-canvas\\-card\\b"}),
  Object.freeze({"id": "artifact:keel-tend-page","surface": "artifact","keel": "keel-tend-page","plates": "plates-tend-page","phase": 126,"state": "dual","migrationHold": "keel-tend-page\\b"}),
  Object.freeze({"id": "artifact:keel-time-proposal","surface": "artifact","keel": "keel-time-proposal","plates": "plates-time-proposal","phase": 126,"state": "dual","migrationHold": "keel-time-proposal\\b"}),
  Object.freeze({"id": "artifact:keel-time-proposals","surface": "artifact","keel": "keel-time-proposals","plates": "plates-time-proposals","phase": 126,"state": "held","migrationHold": "keel-time-proposals\\b"}),
  Object.freeze({"id": "marker:keel:health-report:begin","surface": "marker","keel": "keel:health-report:begin","plates": "plates:health-report:begin","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:health-report:end","surface": "marker","keel": "keel:health-report:end","plates": "plates:health-report:end","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:morning","surface": "marker","keel": "keel:morning","plates": "plates:morning","phase": 126,"state": "held"}),
  Object.freeze({"id": "marker:keel:class","surface": "marker","keel": "keel:class","plates": "plates:class","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:review-after", "surface": "marker", "keel": "keel:review-after", "plates": "plates:review-after", "phase": 126, "state": "dual"}),
  Object.freeze({"id": "marker:keel:review-after-pending", "surface": "marker", "keel": "keel:review-after-pending", "plates": "plates:review-after-pending", "phase": 126, "state": "dual"}),
  Object.freeze({"id": "marker:keel:cross-review","surface": "marker","keel": "keel:cross-review","plates": "plates:cross-review","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:robot-authorization","surface": "marker","keel": "keel:robot-authorization","plates": "plates:robot-authorization","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:robot-continuation","surface": "marker","keel": "keel:robot-continuation","plates": "plates:robot-continuation","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:robot-data","surface": "marker","keel": "keel:robot-data","plates": "plates:robot-data","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:robot-delivery","surface": "marker","keel": "keel:robot-delivery","plates": "plates:robot-delivery","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:robot-issue","surface": "marker","keel": "keel:robot-issue","plates": "plates:robot-issue","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:robot-note","surface": "marker","keel": "keel:robot-note","plates": "plates:robot-note","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:robot-permission","surface": "marker","keel": "keel:robot-permission","plates": "plates:robot-permission","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:robot-publication","surface": "marker","keel": "keel:robot-publication","plates": "plates:robot-publication","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:robot-review","surface": "marker","keel": "keel:robot-review","plates": "plates:robot-review","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:robot-rubric:v1","surface": "marker","keel": "keel:robot-rubric:v1","plates": "plates:robot-rubric:v1","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:robot-state","surface": "marker","keel": "keel:robot-state","plates": "plates:robot-state","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:hygiene-proposal:v1","surface": "marker","keel": "keel:hygiene-proposal:v1","plates": "plates:hygiene-proposal:v1","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:hygiene-data","surface": "marker","keel": "keel:hygiene-data","plates": "plates:hygiene-data","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:time-proposal:begin","surface": "marker","keel": "keel:time-proposal:begin","plates": "plates:time-proposal:begin","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:time-proposal:end","surface": "marker","keel": "keel:time-proposal:end","plates": "plates:time-proposal:end","phase": 126,"state": "dual"}),
  Object.freeze({"id": "marker:keel:inconclusive","surface": "marker","keel": "keel:inconclusive","plates": "plates:inconclusive","phase": 126,"state": "dual"}),
  Object.freeze({"id": "label:keel:agent","surface": "label","keel": "keel:agent","plates": "plates:agent","phase": 126,"state": "held"}),
  Object.freeze({"id": "label:keel:review-after","surface": "label","keel": "keel:review-after","plates": "plates:review-after","phase": 126,"state": "held"}),
  Object.freeze({"id": "label:keel:review-after-pending","surface": "label","keel": "keel:review-after-pending","plates": "plates:review-after-pending","phase": 126,"state": "held"}),
  Object.freeze({"id": "label:keel:morning","surface": "label","keel": "keel:morning","plates": "plates:morning","phase": 126,"state": "held"}),
  Object.freeze({"id": "label:keel:wait-for-review","surface": "label","keel": "keel:wait-for-review","plates": "plates:wait-for-review","phase": 126,"state": "held"}),
  Object.freeze({"id": "label:keel:owner","surface": "label","keel": "keel:owner","plates": "plates:owner","phase": 126,"state": "held"}),
  Object.freeze({"id": "fence:keel-time-proposal", "surface": "fence", "keel": "keel-time-proposal", "plates": "plates-time-proposal", "phase": 126, "state": "dual"}),
  Object.freeze({"id": "fence:keel-impact","surface": "fence","keel": "keel-impact","plates": "plates-impact","phase": 126,"state": "dual","migrationHold": "keel-impact\\b"}),
  Object.freeze({"id": "fence:keel-decision","surface": "fence","keel": "keel-decision","plates": "plates-decision","phase": 126,"state": "dual","migrationHold": "keel-decision\\b"}),
  Object.freeze({"id": "fence:keel-reconciliation","surface": "fence","keel": "keel-reconciliation","plates": "plates-reconciliation","phase": 126,"state": "dual","migrationHold": "keel-reconciliation\\b"}),
  Object.freeze({"id": "fence:keel-proof","surface": "fence","keel": "keel-proof","plates": "plates-proof","phase": 126,"state": "dual","migrationHold": "keel-proof\\b"}),
  Object.freeze({"id": "fence:keel-measurements","surface": "fence","keel": "keel-measurements","plates": "plates-measurements","phase": 126,"state": "dual","migrationHold": "keel-measurements\\b"}),
  Object.freeze({"id":"variable:KEEL_AGENT_GIT","surface":"variable","keel":"KEEL_AGENT_GIT","plates":"PLATES_AGENT_GIT","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"binding-required"}),
  Object.freeze({"id":"variable:KEEL_GH","surface":"variable","keel":"KEEL_GH","plates":"PLATES_GH","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"binding-required"}),
  Object.freeze({"id":"variable:KEEL_CANVAS_ISOCAN_HOME","surface":"variable","keel":"KEEL_CANVAS_ISOCAN_HOME","plates":"PLATES_CANVAS_ISOCAN_HOME","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"binding-required"}),
  Object.freeze({"id":"variable:KEEL_CANVAS_ISOCAN_VERSION","surface":"variable","keel":"KEEL_CANVAS_ISOCAN_VERSION","plates":"PLATES_CANVAS_ISOCAN_VERSION","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"binding-required"}),
  Object.freeze({"id":"variable:KEEL_CANVAS_KEEL_VERSION","surface":"variable","keel":"KEEL_CANVAS_KEEL_VERSION","plates":"PLATES_CANVAS_PLATES_VERSION","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"binding-required"}),
  Object.freeze({"id": "web:__Host-keel-session","surface": "web","keel": "__Host-keel-session","plates": "__Host-plates-session","phase": 127,"state": "held","migrationHold": "__Host\\-keel\\-session\\b"}),
  Object.freeze({"id": "web:__Host-keel-login","surface": "web","keel": "__Host-keel-login","plates": "__Host-plates-login","phase": 127,"state": "held","migrationHold": "__Host\\-keel\\-login\\b"}),
  Object.freeze({"id": "web:__Host-keel-oauth","surface": "web","keel": "__Host-keel-oauth","plates": "__Host-plates-oauth","phase": 127,"state": "held","migrationHold": "__Host\\-keel\\-oauth\\b"}),
  Object.freeze({"id":"web:KEEL_WEB_ORIGIN","surface":"web","keel":"KEEL_WEB_ORIGIN","plates":"PLATES_WEB_ORIGIN","phase":127,"state":"dual","migrationHold":"KEEL_WEB_ORIGIN\\b","providerScope":"binding-required"}),
  Object.freeze({"id": "web:KEEL_WEB_OPERATION","surface": "web","keel": "KEEL_WEB_OPERATION","plates": "PLATES_WEB_OPERATION","phase": 127,"state": "dual","migrationHold": "KEEL_WEB_OPERATION\\b"}),
  Object.freeze({"id":"web:KEEL_WEB_CONFIG","surface":"web","keel":"KEEL_WEB_CONFIG","plates":"PLATES_WEB_CONFIG","phase":127,"state":"dual","providerScope":"binding-required"}),
  Object.freeze({"id":"web:KEEL_CONNECTION_ENCRYPTION_KEY","surface":"web","keel":"KEEL_CONNECTION_ENCRYPTION_KEY","plates":"PLATES_CONNECTION_ENCRYPTION_KEY","phase":127,"state":"dual","providerScope":"binding-required"}),
  Object.freeze({"id":"web:KEEL_GITHUB_CLIENT_SECRET","surface":"web","keel":"KEEL_GITHUB_CLIENT_SECRET","plates":"PLATES_GITHUB_CLIENT_SECRET","phase":127,"state":"dual","providerScope":"binding-required"}),
  Object.freeze({"id":"web:KEEL_SESSION_ENCRYPTION_KEY","surface":"web","keel":"KEEL_SESSION_ENCRYPTION_KEY","plates":"PLATES_SESSION_ENCRYPTION_KEY","phase":127,"state":"dual","providerScope":"binding-required"}),
  Object.freeze({"id": "web:Keel-Operation","surface": "web","keel": "Keel-Operation","plates": "Plates-Operation","phase": 127,"state": "held","migrationHold": "Keel-Operation\\b"}),
  Object.freeze({"id": "web:Keel-Update-Operation","surface": "web","keel": "Keel-Update-Operation","plates": "Plates-Update-Operation","phase": 127,"state": "held","migrationHold": "Keel-Update-Operation\\b"}),
  Object.freeze({"id": "web:trusted-keel","surface": "web","keel": "trusted-keel","plates": "trusted-plates","phase": 127,"state": "held","migrationHold": "trusted-keel\\b"}),
  Object.freeze({"id": "web:keel.css","surface": "web","keel": "keel.css","plates": "plates.css","phase": 127,"state": "held"}),
  Object.freeze({"id": "web:KEELM1","surface": "web","keel": "KEELM1","plates": "PLATESM1","phase": 127,"state": "held"}),
  Object.freeze({"id": "web:keel.journal.v1","surface": "web","keel": "keel.journal.v1","plates": "plates.journal.v1","phase": 127,"state": "held"}),
  Object.freeze({"id": "web:keel_operation","surface": "web","keel": "keel_operation","plates": "plates_operation","phase": 127,"state": "held","migrationHold": "keel_operation\\b"}),
  Object.freeze({"id": "web:keelWindow","surface": "web","keel": "keelWindow","plates": "platesWindow","phase": 127,"state": "held","migrationHold": "keelWindow\\b"}),
  Object.freeze({"id": "database:keel_private","surface": "database","keel": "keel_private","plates": "plates_private","phase": 127,"state": "held","migrationHold": "keel_private\\b"}),
  Object.freeze({"id": "database:keel_model_credential_read","surface": "database","keel": "keel_model_credential_read","plates": "plates_model_credential_read","phase": 127,"state": "held","migrationHold": "keel_model_credential_read\\b"}),
  Object.freeze({"id": "database:keel_web_rpc","surface": "database","keel": "keel_web_rpc","plates": "plates_web_rpc","phase": 127,"state": "held","migrationHold": "keel_web_rpc\\b"}),
  Object.freeze({"id": "database:keel_home_cache_rpc","surface": "database","keel": "keel_home_cache_rpc","plates": "plates_home_cache_rpc","phase": 127,"state": "held","migrationHold": "keel_home_cache_rpc\\b"}),
  Object.freeze({"id": "database:keel_home_quota_rpc","surface": "database","keel": "keel_home_quota_rpc","plates": "plates_home_quota_rpc","phase": 127,"state": "held","migrationHold": "keel_home_quota_rpc\\b"}),
  Object.freeze({"id": "database:keel_home_cursor_rpc","surface": "database","keel": "keel_home_cursor_rpc","plates": "plates_home_cursor_rpc","phase": 127,"state": "held","migrationHold": "keel_home_cursor_rpc\\b"}),
  Object.freeze({"id": "database:keel_decision_rpc","surface": "database","keel": "keel_decision_rpc","plates": "plates_decision_rpc","phase": 127,"state": "held","migrationHold": "keel_decision_rpc\\b"}),
  Object.freeze({"id": "database:keel_walk_rpc","surface": "database","keel": "keel_walk_rpc","plates": "plates_walk_rpc","phase": 127,"state": "held","migrationHold": "keel_walk_rpc\\b"}),
  Object.freeze({"id": "database:keel_media_rpc","surface": "database","keel": "keel_media_rpc","plates": "plates_media_rpc","phase": 127,"state": "held","migrationHold": "keel_media_rpc\\b"}),
  Object.freeze({"id": "database:keel_connection_rpc","surface": "database","keel": "keel_connection_rpc","plates": "plates_connection_rpc","phase": 127,"state": "held","migrationHold": "keel_connection_rpc\\b"}),
  Object.freeze({"id": "database:keel_job_rpc","surface": "database","keel": "keel_job_rpc","plates": "plates_job_rpc","phase": 127,"state": "held","migrationHold": "keel_job_rpc\\b"}),
  Object.freeze({"id": "database:keel_fleet_rpc","surface": "database","keel": "keel_fleet_rpc","plates": "plates_fleet_rpc","phase": 127,"state": "held","migrationHold": "keel_fleet_rpc\\b"}),
  Object.freeze({"id": "database:keel_model_rpc","surface": "database","keel": "keel_model_rpc","plates": "plates_model_rpc","phase": 127,"state": "held","migrationHold": "keel_model_rpc\\b"}),
  Object.freeze({"id": "database:keel_editor_draft_rpc","surface": "database","keel": "keel_editor_draft_rpc","plates": "plates_editor_draft_rpc","phase": 127,"state": "held","migrationHold": "keel_editor_draft_rpc\\b"}),
  Object.freeze({"id": "database:keel_night_retry_rpc","surface": "database","keel": "keel_night_retry_rpc","plates": "plates_night_retry_rpc","phase": 127,"state": "held","migrationHold": "keel_night_retry_rpc\\b"}),
  Object.freeze({"id": "database:keel_run_history","surface": "database","keel": "keel_run_history","plates": "plates_run_history","phase": 127,"state": "held","migrationHold": "keel_run_history\\b"}),
  Object.freeze({"id": "database:keel-job-migrations","surface": "database","keel": "keel-job-migrations","plates": "plates-job-migrations","phase": 127,"state": "held","migrationHold": "keel\\-job\\-migrations\\b"}),
  Object.freeze({"id": "machine:keel.project","surface": "machine","keel": "keel.project","plates": "plates.project","phase": 128,"state": "held"}),
  Object.freeze({"id": "machine:keel.operation","surface": "machine","keel": "keel.operation","plates": "plates.operation","phase": 128,"state": "held"}),
  Object.freeze({"id": "machine:keel.hash","surface": "machine","keel": "keel.hash","plates": "plates.hash","phase": 128,"state": "held"}),
  Object.freeze({"id": "machine:keel.key","surface": "machine","keel": "keel.key","plates": "plates.key","phase": 128,"state": "held"}),
  Object.freeze({"id": "machine:keel-goodnight-loop","surface": "machine","keel": "keel-goodnight-loop","plates": "plates-goodnight-loop","phase": 128,"state": "dual","migrationHold": "keel-goodnight-loop\\b"}),
  Object.freeze({"id": "machine:.keel-time-proposals.lock","surface": "machine","keel": ".keel-time-proposals.lock","plates": ".plates-time-proposals.lock","phase": 128,"state": "held"}),
  Object.freeze({"id": "machine:keel-night-plan-","surface": "machine","keel": "keel-night-plan-","plates": "plates-night-plan-","phase": 128,"state": "dual"}),
  Object.freeze({"id": "machine:keel-canvas-night-","surface": "machine","keel": "keel-canvas-night-","plates": "plates-canvas-night-","phase": 128,"state": "dual"}),
  Object.freeze({"id": "machine:keel-canvas-card-","surface": "machine","keel": "keel-canvas-card-","plates": "plates-canvas-card-","phase": 128,"state": "held"}),
  Object.freeze({"id": "machine:~/.keel/night-card/run.sh","surface": "machine","keel": "~/.keel/night-card/run.sh","plates": "~/.plates/night-card/run.sh","phase": 128,"state": "held"}),
  Object.freeze({"id": "machine:~/Library/LaunchAgents/com.keel.night-card.plist","surface": "machine","keel": "~/Library/LaunchAgents/com.keel.night-card.plist","plates": "~/Library/LaunchAgents/com.plates.night-card.plist","phase": 128,"state": "held"}),
  Object.freeze({"id": "machine:~/.keel/tools/","surface": "machine","keel": "~/.keel/tools/","plates": "~/.plates/tools/","phase": 128,"state": "held"}),
  Object.freeze({"id": "database:keel_private.connection_credentials","surface": "database","keel": "keel_private.connection_credentials","plates": "plates_private.connection_credentials","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.decision_operations","surface": "database","keel": "keel_private.decision_operations","plates": "plates_private.decision_operations","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.decision_previews","surface": "database","keel": "keel_private.decision_previews","plates": "plates_private.decision_previews","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.editor_draft_generation","surface": "database","keel": "keel_private.editor_draft_generation","plates": "plates_private.editor_draft_generation","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.editor_drafts","surface": "database","keel": "keel_private.editor_drafts","plates": "plates_private.editor_drafts","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.fleet_records","surface": "database","keel": "keel_private.fleet_records","plates": "plates_private.fleet_records","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.home_cache","surface": "database","keel": "keel_private.home_cache","plates": "plates_private.home_cache","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.home_cursors","surface": "database","keel": "keel_private.home_cursors","plates": "plates_private.home_cursors","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.home_quota","surface": "database","keel": "keel_private.home_quota","plates": "plates_private.home_quota","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.job_previews","surface": "database","keel": "keel_private.job_previews","plates": "plates_private.job_previews","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.job_rpc_before_night","surface": "database","keel": "keel_private.job_rpc_before_night","plates": "plates_private.job_rpc_before_night","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.jobs","surface": "database","keel": "keel_private.jobs","plates": "plates_private.jobs","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.keel_job_rpc","surface": "database","keel": "keel_private.keel_job_rpc","plates": "plates_private.plates_job_rpc","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.media_receipts","surface": "database","keel": "keel_private.media_receipts","plates": "plates_private.media_receipts","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.media_slots","surface": "database","keel": "keel_private.media_slots","plates": "plates_private.media_slots","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.model_attempts","surface": "database","keel": "keel_private.model_attempts","plates": "plates_private.model_attempts","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.model_cooldowns","surface": "database","keel": "keel_private.model_cooldowns","plates": "plates_private.model_cooldowns","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.model_cooldowns.blocked_until","surface": "database","keel": "keel_private.model_cooldowns.blocked_until","plates": "plates_private.model_cooldowns.blocked_until","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.model_cooldowns.observed_at","surface": "database","keel": "keel_private.model_cooldowns.observed_at","plates": "plates_private.model_cooldowns.observed_at","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.model_records","surface": "database","keel": "keel_private.model_records","plates": "plates_private.model_records","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.model_reservations","surface": "database","keel": "keel_private.model_reservations","plates": "plates_private.model_reservations","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.model_tasks","surface": "database","keel": "keel_private.model_tasks","plates": "plates_private.model_tasks","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.night_previews","surface": "database","keel": "keel_private.night_previews","plates": "plates_private.night_previews","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.night_retries","surface": "database","keel": "keel_private.night_retries","plates": "plates_private.night_retries","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.walk_drafts","surface": "database","keel": "keel_private.walk_drafts","plates": "plates_private.walk_drafts","phase": 127,"state": "held"}),
  Object.freeze({"id": "database:keel_private.web_records","surface": "database","keel": "keel_private.web_records","plates": "plates_private.web_records","phase": 127,"state": "held"}),
  Object.freeze({"id": "web:keel-web-","surface": "web","keel": "keel-web-","plates": "plates-web-","phase": 127,"state": "held","migrationHold": "keel-web-"}),
  Object.freeze({"id":"variable:KEEL_MILESTONES_OFFLINE","surface":"variable","keel":"KEEL_MILESTONES_OFFLINE","plates":"PLATES_MILESTONES_OFFLINE","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_CANVAS_PERSISTENCE","surface":"variable","keel":"KEEL_CANVAS_PERSISTENCE","plates":"PLATES_CANVAS_PERSISTENCE","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_CANVAS_RECOVERY","surface":"variable","keel":"KEEL_CANVAS_RECOVERY","plates":"PLATES_CANVAS_RECOVERY","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_CANVAS_OUTPUT","surface":"variable","keel":"KEEL_CANVAS_OUTPUT","plates":"PLATES_CANVAS_OUTPUT","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_ISOCAN","surface":"variable","keel":"KEEL_ISOCAN","plates":"PLATES_ISOCAN","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_CI_OFFLINE","surface":"variable","keel":"KEEL_CI_OFFLINE","plates":"PLATES_CI_OFFLINE","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_FLEET_PRACTICE","surface":"variable","keel":"KEEL_FLEET_PRACTICE","plates":"PLATES_FLEET_PRACTICE","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_NPM","surface":"variable","keel":"KEEL_NPM","plates":"PLATES_NPM","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_GIT","surface":"variable","keel":"KEEL_GIT","plates":"PLATES_GIT","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_CLAUDE_DIR","surface":"variable","keel":"KEEL_CLAUDE_DIR","plates":"PLATES_CLAUDE_DIR","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_PROVE_MUTANT_MS","surface":"variable","keel":"KEEL_PROVE_MUTANT_MS","plates":"PLATES_PROVE_MUTANT_MS","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_PROVE_IGNORED_BYTES","surface":"variable","keel":"KEEL_PROVE_IGNORED_BYTES","plates":"PLATES_PROVE_IGNORED_BYTES","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_REVIEW_POLL_MS","surface":"variable","keel":"KEEL_REVIEW_POLL_MS","plates":"PLATES_REVIEW_POLL_MS","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_CACHE","surface":"variable","keel":"KEEL_CACHE","plates":"PLATES_CACHE","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_PREVIOUS_PRACTICES","surface":"variable","keel":"KEEL_PREVIOUS_PRACTICES","plates":"PLATES_PREVIOUS_PRACTICES","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_SELF_UPDATED","surface":"variable","keel":"KEEL_SELF_UPDATED","plates":"PLATES_SELF_UPDATED","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_CLIMB_CLOCK","surface":"variable","keel":"KEEL_CLIMB_CLOCK","plates":"PLATES_CLIMB_CLOCK","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_CLI","surface":"variable","keel":"KEEL_CLI","plates":"PLATES_CLI","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_NOW","surface":"variable","keel":"KEEL_NOW","plates":"PLATES_NOW","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_STITCH","surface":"variable","keel":"KEEL_STITCH","plates":"PLATES_STITCH","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_DRAIN_WAIT_MS","surface":"variable","keel":"KEEL_DRAIN_WAIT_MS","plates":"PLATES_DRAIN_WAIT_MS","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_QUOTA_FLOOR","surface":"variable","keel":"KEEL_QUOTA_FLOOR","plates":"PLATES_QUOTA_FLOOR","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_STALLS_SHAPE","surface":"variable","keel":"KEEL_STALLS_SHAPE","plates":"PLATES_STALLS_SHAPE","phase":128,"state":"dual","environmentPolicy":"current-presence","environmentScope":"process","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_PROVIDER","surface":"variable","keel":"KEEL_PROVIDER","plates":"PLATES_PROVIDER","phase":128,"state":"dual","environmentPolicy":"identity-conflict","environmentScope":"claim-identity","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_SESSION","surface":"variable","keel":"KEEL_SESSION","plates":"PLATES_SESSION","phase":128,"state":"dual","environmentPolicy":"identity-conflict","environmentScope":"claim-identity","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_MACHINE","surface":"variable","keel":"KEEL_MACHINE","plates":"PLATES_MACHINE","phase":128,"state":"dual","environmentPolicy":"identity-conflict","environmentScope":"claim-identity","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_RUN_START","surface":"variable","keel":"KEEL_RUN_START","plates":"PLATES_RUN_START","phase":128,"state":"dual","environmentPolicy":"identity-conflict","environmentScope":"ledger-invocation","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_GATE_INVOCATION","surface":"variable","keel":"KEEL_GATE_INVOCATION","plates":"PLATES_GATE_INVOCATION","phase":128,"state":"dual","environmentPolicy":"identity-conflict","environmentScope":"ledger-invocation","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_USUAL","surface":"variable","keel":"KEEL_USUAL","plates":"PLATES_USUAL","phase":128,"state":"dual","environmentPolicy":"identity-conflict","environmentScope":"ledger-invocation","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_GATE_ACTIVE","surface":"variable","keel":"KEEL_GATE_ACTIVE","plates":"PLATES_GATE_ACTIVE","phase":128,"state":"dual","environmentPolicy":"identity-conflict","environmentScope":"ledger-invocation","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_SUITE_PLAN","surface":"variable","keel":"KEEL_SUITE_PLAN","plates":"PLATES_SUITE_PLAN","phase":128,"state":"dual","environmentPolicy":"identity-conflict","environmentScope":"ledger-invocation","providerScope":"unestablished"}),
  Object.freeze({"id":"variable:KEEL_PUBLISHER","surface":"variable","keel":"KEEL_PUBLISHER","plates":"PLATES_PUBLISHER","phase":128,"state":"dual","environmentPolicy":"identity-conflict","environmentScope":"publisher-identity","providerScope":"unestablished"}),
]);

export function nameRow(id, rows = NAMES) {
  const row = rows.find(row => row.id === id);
  if (!row) throw new Error(`Unknown name identity: ${id}`);
  if (!['held', 'dual', 'retired'].includes(row.state)) throw new Error(`Invalid name state: ${id}`);
  return row;
}
/** Ordinary overrides use presence, not truthiness. Consumers validate the selected
 * value; invalid current values never fall through to a legacy binding. */
export function environmentValue(id, env = process.env) {
  const row = nameRow(id);
  if (row.environmentPolicy !== 'current-presence') throw new Error(`Not an ordinary environment identity: ${id}`);
  return env[row.plates] !== undefined ? env[row.plates] : env[row.keel];
}

/** Identity aliases never silently change ownership, invocation or source attribution.
 * Return raw values so the existing consumer still validates its own contract. */
export function identityEnvironmentValue(id, env = process.env) {
  const row = nameRow(id);
  if (row.environmentPolicy !== 'identity-conflict') throw new Error(`Not an identity environment binding: ${id}`);
  const current = env[row.plates], legacy = env[row.keel];
  if (current !== undefined && legacy !== undefined && current !== legacy) {
    const error = new Error(`Conflicting environment names: ${row.plates}, ${row.keel}`);
    error.code = 'conflicting_names';
    throw error;
  }
  return current !== undefined ? current : legacy;
}
/** Remove only explicitly selected table bindings from a copied child environment. */
export function scrubEnvironment(ids, env = process.env) {
  const clean = { ...env };
  for (const id of ids) {
    const row = nameRow(id);
    if (!row.environmentPolicy) throw new Error(`Not an environment binding: ${id}`);
    delete clean[row.plates]; delete clean[row.keel];
  }
  return clean;
}

export function writeName(id, rows = NAMES) {
  const row = nameRow(id, rows);
  // Label evidence is repository-bound; generic writers cannot activate it.
  return row.surface === 'label' || row.state === 'held' ? row.keel : row.plates;
}
export function readNames(id, rows = NAMES) {
  const row = nameRow(id, rows);
  return row.state === 'held' ? [row.keel] : row.state === 'dual' ? [row.plates, row.keel] : [row.plates];
}
/** A protection matcher, never a rewrite allowlist or source-scanner exception. */
export function durableNames(rows = NAMES) {
  const patterns = rows.filter(row => ['held', 'dual'].includes(row.state) && row.migrationHold).map(row => row.migrationHold);
  return new RegExp(patterns.length ? patterns.join('|') : '(?!)', 'g');
}

/** Exact named artifact candidates, ordered current then historical. Presence wins:
 * validation happens afterwards, so a corrupt current artifact cannot hide behind
 * a valid historical one from the same attempt. Retention is the caller's policy.
 */
export function artifactNames(id, suffix = '', rows = NAMES) {
  if (nameRow(id, rows).surface !== 'artifact') throw new Error(`Not an artifact identity: ${id}`);
  return readNames(id, rows).map(name => name + suffix);
}
export function selectArtifacts(artifacts, id, suffix = '', rows = NAMES) {
  if (!Array.isArray(artifacts)) throw new Error('Artifact inventory unavailable');
  for (const name of artifactNames(id, suffix, rows)) {
    const matches = artifacts.filter(artifact => artifact?.name === name);
    if (matches.length) return { name, matches };
  }
  return { name: null, matches: [] };
}

/** Historical metadata names are permanent readers, including after live-state
 * retirement. Normalize syntax in memory only; never rewrite source records.
 */
export function historicalFence(type, rows = NAMES) {
  return rows.find(row => row.surface === 'fence' && [row.plates, row.keel].includes(type)) ?? null;
}
/** Normalize each record independently; consumers own declaration cardinality and identity. */
export function normalizeFences(fences, rows = NAMES) {
  return fences.map(fence => {
    const row = historicalFence(fence.type, rows);
    if (!row) return fence;
    return { ...fence, identity: row.id, sourceType: fence.type, type: row.keel };
  });
}

/** Select one comment namespace before validating its payload. Current presence
 * wins even when invalid; duplicate comments in that namespace remain visible.
 * Offsets always address the original body, never rewritten historical text.
 */
export function markerComments(text, id, accept = () => true, rows = NAMES) {
  const row = nameRow(id, rows);
  if (row.surface !== 'marker') throw new Error(`Not a marker identity: ${id}`);
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const name of readNames(id, rows)) {
    const pattern = new RegExp(`<!-- ${escape(name)}(?: ([^\\r\\n]*?))? -->`, 'g');
    const all = [...String(text ?? '').matchAll(pattern)].map(match => ({ name, raw: match[0], payload: match[1] ?? '', start: match.index, end: match.index + match[0].length }));
    const matches = all.filter(accept);
    // A malformed opening cannot fall through to a valid historical comment.
    if (matches.length || (!all.length && new RegExp(`<!-- /?${escape(name)}(?= |-->|$)`).test(String(text ?? '')))) return { name, matches };
  }
  return { name: null, matches: [] };
}
export function markerComment(id, payload = '', rows = NAMES) {
  return `<!-- ${writeName(id, rows)}${payload ? ' ' + payload : ''} -->`;
}
/** Versioned begin/end wrappers use one spelling for both delimiters. */
export function markerSection(text, id, rows = NAMES) {
  const { name } = markerComments(text, id, undefined, rows);
  if (!name) return null;
  const begin = `<!-- ${name} -->`, end = `<!-- /${name} -->`;
  if (text.split(begin).length !== 2 || text.split(end).length !== 2) throw new Error('exactly one matching marker section is required');
  const start = text.indexOf(begin), finish = text.indexOf(end) + end.length;
  if (finish <= start + begin.length) throw new Error('marker section end precedes begin');
  return { name, start, end: finish, text: text.slice(start, finish) };
}

/** A leading marker may have a redundant historical spelling before it, but
 * quoted markers and ordinary prose never become a leading machine marker. */
export function markerAtStart(text, id, payload = '', rows = NAMES) {
  text = String(text ?? '');
  const selected = markerComments(text, id, mark => mark.payload === payload, rows).matches[0];
  if (!selected) return false;
  const prefix = text.slice(0, selected.start);
  let at = 0;
  for (const prior of markerComments(prefix, id, undefined, rows).matches) {
    if (prior.payload !== payload || prefix.slice(at, prior.start).trim()) return false;
    at = prior.end;
  }
  return !prefix.slice(at).trim();
}

/** Only consecutive complete marker lines at the beginning may identify a
 * machine record. Markers quoted later in agent prose never gain authority. */
export function leadingMarkers(text, id, rows = NAMES) {
  const lines = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const candidate = markerComments(line, id, undefined, rows);
    if (!candidate.name) break;
    if (candidate.matches.length !== 1 || candidate.matches[0].raw !== line) return {name:candidate.name,matches:[]};
    lines.push(line);
  }
  return markerComments(lines.join('\n'), id, undefined, rows);
}

/** Paired marker IDs share a namespace; never splice one version's opening
 * into another version's closing boundary. All positions address source bytes. */
export function markerRegion(text, beginId, endId, rows = NAMES) {
  const begin = markerComments(text, beginId, undefined, rows), end = markerComments(text, endId, undefined, rows);
  if (!begin.name && !end.name) return null;
  if (begin.matches.length !== 1 || end.matches.length !== 1) throw new Error('ambiguous managed marker region');
  const before = begin.matches[0], after = end.matches[0];
  const row = nameRow(beginId, rows), expected = nameRow(endId, rows)[begin.name === row.plates ? 'plates' : 'keel'];
  if (end.name !== expected || after.start < before.end || after.payload) throw new Error('mismatched managed marker region');
  return {start:before.start,end:after.end,begin:before,close:after,body:text.slice(before.end,after.start)};
}


/** Labels have permanent exact-name readers; a receipt never authorizes a write. */
export function labelNames(id, rows = NAMES) {
  const row = nameRow(id, rows);
  if (row.surface !== 'label') throw new Error(`Not a label identity: ${id}`);
  return [row.plates, row.keel];
}
export function matchesLabel(value, id, rows = NAMES) {
  return labelNames(id, rows).includes(typeof value === 'string' ? value : value?.name);
}

/** Select a label using a fresh complete provider observation. No
 * create/rename entitlement is returned. Callers retain their own write gate.
 * observedAt is captured by the caller after its successful provider read, never
 * taken from a saved receipt; a one-minute bound prevents reuse across jobs.
 */
export function labelWriter({id, repo, repositoryId, receipt = null, observation, now = Date.now()}, rows = NAMES) {
  const row = nameRow(id, rows), refuse = reason => { throw new Error(`Label mutation refused: ${reason}`); };
  const positive = n => Number.isSafeInteger(n) && n > 0;
  const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === keys.slice().sort().join(',');
  const stamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
  if (row.surface !== 'label' || !positive(repositoryId) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? '')) refuse('repository or table identity unavailable');
  if (!observation || observation.repo !== repo || observation.repositoryId !== repositoryId || observation.complete !== true || !stamp(observation.observedAt) || !Number.isFinite(now) || now < Date.parse(observation.observedAt) || now - Date.parse(observation.observedAt) > 60000 || !Array.isArray(observation.labels)) refuse('current complete provider label facts unavailable or stale');
  const ids = new Set(), names = new Set();
  for (const label of observation.labels) {
    if (!positive(label?.id) || typeof label.name !== 'string' || !label.name || ids.has(label.id) || names.has(label.name)) refuse('conflicting provider label facts');
    ids.add(label.id); names.add(label.name);
  }
  let entry;
  if (receipt !== null) {
    const v2 = receipt.version === 2;
    if (!exact(receipt,v2 ? ['version','repositoryId','repo','renames','creations'] : ['version','repositoryId','repo','renames']) || ![1,2].includes(receipt.version) || receipt.repositoryId !== repositoryId || receipt.repo !== repo || !Array.isArray(receipt.renames) || (v2 && !Array.isArray(receipt.creations)) || receipt.renames.length + (v2 ? receipt.creations.length : 0) > 100) refuse('invalid repository receipt');
    const seenRows = new Set(), seenLabels = new Set(), operations = new Set();
    for (const candidate of [...receipt.renames, ...(v2 ? receipt.creations : [])]) {
      const created = v2 && receipt.creations.includes(candidate);
      if (created ? !exact(candidate,['kind','row','labelId','newName','operationId','verifiedAt','readback']) || candidate.kind !== 'created' : !exact(candidate,['row','labelId','oldName','newName','operationId','verifiedAt','readback'])) refuse('invalid receipt entry');
      const target = rows.find(r => r.id === candidate.row && r.surface === 'label');
      if (!target || seenRows.has(candidate.row) || !positive(candidate.labelId) || seenLabels.has(candidate.labelId) || (!created && candidate.oldName !== target.keel) || candidate.newName !== target.plates || typeof candidate.operationId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,199}$/.test(candidate.operationId) || operations.has(candidate.operationId) || !stamp(candidate.verifiedAt) || Date.parse(candidate.verifiedAt) > Date.parse(observation.observedAt)) refuse('conflicting or uncertain rename evidence');
      if (!exact(candidate.readback,['repositoryId','labelId','name']) || candidate.readback.repositoryId !== repositoryId || candidate.readback.labelId !== candidate.labelId || candidate.readback.name !== target.plates) refuse('rename readback mismatch');
      seenRows.add(candidate.row); seenLabels.add(candidate.labelId); operations.add(candidate.operationId);
      if (candidate.row === id) entry = candidate;
    }
  }
  const current = observation.labels.filter(label => label.name === row.plates);
  const legacy = observation.labels.filter(label => label.name === row.keel);
  if (entry) {
    if (legacy.length || current.length !== 1 || current[0].id !== entry.labelId) refuse('provider observation conflicts with confirmed rename');
    return row.plates;
  }
  if (current.length || legacy.length > 1) refuse('legacy label conflicts or current name lacks confirmed receipt');
  return row.keel;
}

/** Read only committed receipt bytes: an ignored/untracked local file cannot
 * activate CI writers. A modified tracked receipt is uncertainty, not absence.
 */
export async function readLabelReceipt(root) {
  const path = '.plates/name-transition/label-renames.json';
  const {execFile} = await import('node:child_process');
  const {promisify} = await import('node:util');
  const exec = promisify(execFile);
  const git = async args => (await exec('git',['--no-optional-locks','-c','core.fsmonitor=false',...args],{cwd:root,maxBuffer:262144})).stdout;
  const tracked = await git(['ls-files','--',path]);
  const {readFile,lstat} = await import('node:fs/promises');
  const {join} = await import('node:path');
  let local;
  try {
    const info = await lstat(join(root,path));
    if (!info.isFile() || info.isSymbolicLink() || info.size > 262144) throw new Error('Unsafe label receipt');
    local = await readFile(join(root,path),'utf8');
  } catch (error) { if (error.code === 'ENOENT' && !tracked.trim()) return null; throw error; }
  if (tracked.trim() !== path || await git(['show',`HEAD:${path}`]) !== local) throw new Error('Label receipt is not unchanged committed evidence');
  return JSON.parse(local);
}


/** Provider adapter returns {status,data}; callers with a just-read complete
 * observation pass it directly, avoiding duplicate requests. No label is created.
 */
export async function repositoryLabelSelection({root, repo, id, github, observation, receipt: suppliedReceipt, now = Date.now()}) {
  const receipt = suppliedReceipt === undefined ? await readLabelReceipt(root) : suppliedReceipt;
  if (!observation) {
    const meta = await github({method:'GET',path:`/repos/${repo}`});
    if (meta?.status !== 200 || meta.data?.full_name !== repo || !Number.isSafeInteger(meta.data?.id)) throw new Error('Label mutation refused: repository identity unavailable');
    const labels = [];
    for (let page=1;page<=20;page++) {
      const result = await github({method:'GET',path:`/repos/${repo}/labels?per_page=100&page=${page}`});
      if (result?.status !== 200 || !Array.isArray(result.data)) throw new Error('Label mutation refused: complete label list unavailable');
      labels.push(...result.data);
      if (result.data.length < 100) {
        observation={repo,repositoryId:meta.data.id,labels,complete:true,observedAt:new Date(now).toISOString()};
        break;
      }
    }
  }
  const name=labelWriter({id,repo,repositoryId:observation?.repositoryId,observation,receipt,now});
  return {name,exists:observation.labels.some(label=>label.name===name)};
}


/** A checkout-free publisher reads the tracked file at its exact run revision. */
export async function remoteLabelReceipt({repo, revision, github}) {
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('Label receipt requires an exact source revision');
  const path='.plates/name-transition/label-renames.json';
  const result=await github({method:'GET',path:`/repos/${repo}/contents/${path}?ref=${revision}`});
  if (result?.status === 404) return null;
  const file=result?.data;
  if (result?.status !== 200 || file?.type !== 'file' || file.path !== path || file.encoding !== 'base64' || typeof file.content !== 'string' || file.content.length > 350000 || !/^[a-f0-9]{40}$/.test(file.sha ?? '')) throw new Error('Label receipt source unavailable');
  const bytes=Buffer.from(file.content,'base64');
  const {createHash}=await import('node:crypto');
  if (createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== file.sha) throw new Error('Label receipt source digest mismatch');
  return JSON.parse(bytes.toString('utf8'));
}


/** Standalone comments retain original offsets and same-namespace duplicates. */
export function markerLines(text,id,rows=NAMES) {
  text=String(text??'');
  return markerComments(text,id,undefined,rows).matches.filter(mark =>
    (mark.start===0 || text[mark.start-1]==='\n') &&
    (mark.end===text.length || text[mark.end]==='\n' || text.slice(mark.end,mark.end+2)==='\r\n'));
}
/** Required machine headers may be repeated under the other spelling only.
 * Agent prose cannot supply a header; all selected IDs must be in the prefix.
 */
export function markerHeader(text,ids,rows=NAMES) {
  text=String(text??'');let end=0;
  for(const line of text.split('\n')) {
    if(!ids.some(id=>markerComments(line,id,undefined,rows).matches.some(mark=>mark.raw===line))) break;
    end+=line.length+1;
  }
  const found={};
  for(const id of ids) {
    const selected=markerComments(text,id,undefined,rows);
    if(selected.matches.length!==1 || selected.matches[0].end>=end || !markerLines(text,id,rows).some(mark=>mark.start===selected.matches[0].start)) return null;
    found[id]=selected.matches[0];
  }
  return {marks:found,end:Math.min(end,text.length),suffix:text.slice(end)};
}


/** Diagnostic tokens are plain text, not HTML comments. */
export function markerDiagnostic(text,id,rows=NAMES) {
  text=String(text??'').trim();
  for(const name of readNames(id,rows)) {
    if(text===name)return '';
    if(text.startsWith(name) && /^\s/.test(text.slice(name.length)))return text.slice(name.length).trim();
  }
  return null;
}


export function configuredLabelMatches(value,configured,id,rows=NAMES) {
  const row=nameRow(id,rows);
  return configured===row.keel || configured===row.plates ? matchesLabel(value,id,rows) : (typeof value==='string'?value:value?.name)===configured;
}

export async function repositoryLabelWriter(options) { return (await repositoryLabelSelection(options)).name; }

/** Only explicit table families share a queue; unknown owner prefixes stay exact. */
export function branchPrefixes(prefix) {
  const row = NAMES.find(row => row.surface === 'git ref' && [row.keel, row.plates].includes(prefix));
  return row ? readNames(row.id) : [prefix];
}
export const inBranchQueue = (branch, prefix) => typeof branch === 'string' && branchPrefixes(prefix).some(p => branch.startsWith(p));
export function branchSuffix(branch, id) {
  const prefix = readNames(id).find(p => typeof branch === 'string' && branch.startsWith(p));
  return prefix === undefined ? null : branch.slice(prefix.length);
}
export const robotIssueOf = branch => {
  const suffix = branchSuffix(branch, 'git ref:keel/robot-');
  return /^[1-9]\d*$/.test(suffix ?? '') ? Number(suffix) : null;
};
export const nightBranches = date => readNames('git ref:keel-night/').map(p => `${p}${date}`);
export function finalNightBranch(date, branch = null) {
  const night = nightBranches(date).find(n => branch === n || branch === `${n}-final`);
  return `${night ?? writeName('git ref:keel-night/') + date}-final`;
}
