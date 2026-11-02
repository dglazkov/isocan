/** No model or login needed. Run with CODEX_BIN pointing at Codex >=0.153.4.
 * The same probe runs on macOS and Linux: HTTP daemon reach, Git/npm,
 * workspace/state writes, an outside write refusal, and an unlisted host.
 * Uses only synthetic files; creates and removes its own directory under
 * the home because /tmp is intentionally writable in a workspace sandbox. */
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const exec = promisify(execFile);
const root = await mkdtemp(path.join(os.homedir(), '.isocan-native-proof-'));
const cwd = path.join(root, 'workspace');
const home = path.join(root, 'state');
const configHome = path.join(root, 'codex');
for (const dir of [cwd, home, configHome]) await mkdir(dir);
const server = createServer((_req, res) => res.end('synthetic-daemon'));
const other = createServer((_req, res) => res.end('unlisted-loopback'));
try {
 await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
 const base = `http://127.0.0.1:${server.address().port}`;
 await new Promise((resolve, reject) => other.once('error', reject).listen(0, '::1', resolve));
 const otherBase = `http://[::1]:${other.address().port}`;
 await exec('git', ['init', '-q', cwd]);
 const script = `set -eu
printf ok > workspace-write
printf ok > "$PROBE_STATE/state-write"
git status --porcelain > git-status
if git add workspace-write 2>/dev/null; then echo "protected git metadata escaped"; exit 1; fi
curl -fsS --max-time 20 "$PROBE_DAEMON" | test "$(cat)" = synthetic-daemon
npm view is-number@7.0.0 version --registry=https://registry.npmjs.org --fetch-timeout=20000 --fetch-retries=0 | test "$(cat)" = 7.0.0
git -c http.version=HTTP/1.1 ls-remote https://github.com/dglazkov/isocan.git HEAD > remote-ref
test -s remote-ref
if (printf bad > "$PROBE_OUTSIDE") 2>/dev/null; then echo 'outside write escaped'; exit 1; fi
if curl -fsS --max-time 10 https://example.com >/dev/null 2>&1; then echo 'unlisted host escaped'; exit 1; fi
if curl --noproxy '*' -fsS --max-time 10 https://example.com >/dev/null 2>&1; then echo 'direct public network escaped'; exit 1; fi
if curl --noproxy '*' -fsS --max-time 5 "$PROBE_OTHER" >/dev/null 2>&1; then echo 'other-loopback reachable'; else echo 'other-loopback refused'; fi
printf 'native sandbox held\\n'
`;
 const scriptPath = path.join(cwd, 'probe.sh'); await writeFile(scriptPath, script);
 const config = ['sandbox_mode="workspace-write"', 'sandbox_workspace_write.network_access=true', `sandbox_workspace_write.writable_roots=${JSON.stringify([home])}`,
   'features.network_proxy.enabled=true', 'features.network_proxy.allow_local_binding=false',
   'features.network_proxy.domains={"127.0.0.1"="allow","registry.npmjs.org"="allow","github.com"="allow"}'];
 const args = ['app-server', ...config.flatMap(value => ['-c', value])];
 const env = { ...process.env, CODEX_HOME: configHome, npm_config_cache: path.join(home, 'npm'), PROBE_OTHER: otherBase, PROBE_STATE: home, PROBE_DAEMON: base, PROBE_OUTSIDE: path.join(root, 'outside') };
 delete env.CODEX_CONFIG;
 const child = spawn(process.env.CODEX_BIN ?? 'codex', args, { env, cwd, stdio: ['pipe', 'pipe', 'pipe'] });
 let buffer = '', stderr = '', next = 0; const pending = new Map();
 child.stderr.on('data', b => { stderr += b; });
 child.stdout.on('data', b => { buffer += b; let newline; while ((newline = buffer.indexOf('\n')) >= 0) {
   const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
   const msg = JSON.parse(line); const waiter = pending.get(msg.id); if (waiter) { pending.delete(msg.id); msg.error ? waiter.reject(new Error(JSON.stringify(msg.error))) : waiter.resolve(msg.result); }
 } });
 const rpc = (method, params) => new Promise((resolve, reject) => { const id = ++next; pending.set(id, {resolve,reject}); child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params}) + '\n'); });
 const timeout = setTimeout(() => { child.kill(); for (const waiter of pending.values()) waiter.reject(new Error('probe timeout: ' + stderr)); }, 120000);
 let result;
 try {
  await rpc('initialize', {clientInfo:{name:'isocan-sandbox-proof',version:'1.0.0'}, capabilities:{experimentalApi:true}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'initialized'}) + '\n');
  result = await rpc('command/exec', {command:['sh',scriptPath],cwd,env:{PROBE_OTHER:otherBase,PROBE_STATE:home,PROBE_DAEMON:base,PROBE_OUTSIDE:path.join(root,'outside'),npm_config_cache:path.join(home,'npm')},sandboxPolicy:{type:'workspaceWrite',writableRoots:[home],networkAccess:false},timeoutMs:100000});
  assert.equal(result.exitCode, 0, JSON.stringify(result));
 } finally {clearTimeout(timeout); child.kill();}
 assert.match(result.stdout, /native sandbox held/);
 assert.match(result.stdout, /other-loopback refused/);
 assert.equal(await readFile(path.join(home, 'state-write'), 'utf8'), 'ok');
 console.log(JSON.stringify({ platform: process.platform, ...await exec(process.env.CODEX_BIN ?? 'codex', ['--version'], {env}).then(r => ({version:r.stdout.trim()})), daemon:true, gitRead:true, gitMetadataWriteDenied:true, npm:true, workspaceWrite:true, stateWrite:true, outsideWriteDenied:true, unlistedHostDenied:true, directPublicNetworkDenied:true, otherLoopbackReachable:result.stdout.includes("other-loopback reachable") }, null, 2));
} finally { if (other.listening) await new Promise(r => other.close(r)); if (server.listening) await new Promise(r => server.close(r)); await rm(root, {recursive:true,force:true,maxRetries:5,retryDelay:100}); }
